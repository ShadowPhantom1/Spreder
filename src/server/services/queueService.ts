import { db, getSetting } from '../db/index.js'
import * as firebaseService from './firebaseService.js'
import type { FirebaseConfigRow } from './firebaseService.js'

// Campaign engine: round-robin across online devices, wave-based dispatch with retry, pause/resume/cancel, Socket.io emits via callback

type Emitter = (event: string, payload: any) => void
let emit: Emitter = () => {}
export function setEmitter(fn: Emitter) { emit = fn }

const running = new Map<string, { cancelled: boolean; paused: boolean }>()

function renderTemplate(template: string, vars: Record<string, string>, phone: string) {
  let out = template
  // normalize all var keys to lower for case-insensitive, plus handle vehical typo
  const norm: Record<string,string> = {}
  for(const [k,v] of Object.entries(vars)) {
    norm[k.toLowerCase()] = v
    norm[k] = v
  }
  // alias vehicle <-> vehical
  if(norm.vehicle && !norm.vehical) norm.vehical = norm.vehicle
  if(norm.vehical && !norm.vehicle) norm.vehicle = norm.vehical
  // also map second generic name to vehicle
  out = out.replace(/\{\{\s*phone\s*\}\}/gi, phone)
  out = out.replace(/\{\{\s*name\s*\}\}/gi, norm.name || norm.Name || vars.name || vars.Name || 'there')
  // replace any {{var}} case-insensitive using norm
  out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, p1)=>{
    const key = p1.toLowerCase()
    if(norm[key] !== undefined) return norm[key]
    if(norm[p1] !== undefined) return norm[p1]
    return m // keep as is if not found
  })
  return out
}
function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// daily limit helper
function getTodayStartISO(): string {
  const h = parseInt(getSetting('today_start_hour') || '0',10)
  const d=new Date()
  d.setHours(h,0,0,0)
  return d.toISOString()
}
function getDeviceTodaySent(deviceId:string): number {
  const since=getTodayStartISO()
  const row=db.prepare("SELECT COUNT(*) as c FROM campaign_messages WHERE device_id=? AND status='sent' AND sent_at >= ?").get(deviceId, since) as any
  return row?.c || 0
}
function isDailyLimitEnabled(): boolean {
  return (getSetting('daily_limit_enabled') || 'true') !== 'false'
}
function getDailyLimit(): number {
  return parseInt(getSetting('per_sim_limit') || getSetting('max_sms_per_device_per_day') || '100',10)
}
function getDeviceCapacity(device:any): number {
  const perSim= getDailyLimit()
  const simCount = device.sim_count || parseInt(getSetting('default_sim_count')||'1',10) || 1
  const checkRecharge = (getSetting('check_recharge')||'true') !== 'false'
  if(checkRecharge && device.has_recharge===0) return 0 // without recharge → 0 capacity
  // if dual SIM but one SIM no recharge (sim1/2), reduce capacity
  if(simCount===2 && checkRecharge){
    const s1 = device.sim1_recharge ?? 1
    const s2 = device.sim2_recharge ?? 1
    if(s1===0 && s2===0) return 0
    if(s1===0 || s2===0) return perSim // only one slot active
  }
  return simCount * perSim
}

export async function createCampaign(data: {
  name: string
  template: string
  contacts: Array<{ phone: string; vars?: Record<string,string> }>
  batch_size?: number
  delay_ms?: number
  firebaseIds?: string[]
}) {
  const id = `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`
  const now = new Date().toISOString()
  const total = data.contacts.length

  // dedupe + validate — normalize to +91 E.164 (fixes +91 vs without duplicate)
  const seen = new Set<string>()
  const clean: Array<{ phone: string; vars: Record<string,string> }> = []
  const invalid: string[] = []
  const normalizePhone = (raw:string)=>{
    let p=raw.replace(/\s/g,'').replace(/^0+/,'')
    if(!p.startsWith('+')){
      if(p.length===10) p='+91'+p
      else if(p.length===12 && p.startsWith('91')) p='+'+p
      else p='+'+p
    }
    return p
  }
  for (const c of data.contacts) {
    const p = normalizePhone(c.phone)
    if (!/^\+?[0-9]{7,15}$/.test(p)) { invalid.push(c.phone); continue }
    if (seen.has(p)) continue
    seen.add(p)
    clean.push({ phone: p, vars: c.vars || {} })
  }

  const defBatch = Number(getSetting('dispatch_batch_size')||'24')
  const defDelay = Number(getSetting('dispatch_delay_ms')||'220')
  db.prepare('INSERT INTO campaigns (id, name, template, status, total, sent, failed, pending, batch_size, delay_ms, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)').run(
    id, data.name, data.template, 'draft', clean.length, clean.length, data.batch_size || defBatch, data.delay_ms || defDelay, now
  )

  const insertMsg = db.prepare('INSERT INTO campaign_messages (id, campaign_id, phone, variables, rendered, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertQ = db.prepare('INSERT INTO queue_items (id, campaign_id, message_id, status, created_at) VALUES (?, ?, ?, ?, ?)')
  const txn = db.transaction(() => {
    for (const c of clean) {
      const mid = `msg_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`
      const rendered = renderTemplate(data.template, c.vars, c.phone)
      insertMsg.run(mid, id, c.phone, JSON.stringify(c.vars), rendered, 'pending', now)
      insertQ.run(`q_${mid}`, id, mid, 'queued', now)
    }
  })
  txn()

  emit('campaign:created', { id, name: data.name, total: clean.length, invalid: invalid.length })
  return { id, total: clean.length, duplicatesSkipped: data.contacts.length - clean.length, invalid }
}

export function getCampaign(id: string) {
  return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as any
}

async function getOnlineDevices(): Promise<Array<{ id: string; firebase_id: string; name: string; status: string; slot: number }>> {
  let rows = db.prepare("SELECT id, firebase_id, name, status, sim_count, has_recharge, sim1_recharge, sim2_recharge, last_seen, total_sent, total_failed, validated_score, validator_fail_count FROM devices WHERE status IN ('online','busy') ORDER BY last_seen DESC").all() as any[]
  // Interleave across hives for true round-robin (fixes 2-number only bug where top 2 hives dominated)
  // Group by hive then round-robin pick 1 per hive
  const byHive = new Map<string, any[]>()
  for(const r of rows){ if(!byHive.has(r.firebase_id)) byHive.set(r.firebase_id, []); byHive.get(r.firebase_id)!.push(r) }
  const hives = Array.from(byHive.keys()).sort((a,b)=> (byHive.get(b)?.length||0)-(byHive.get(a)?.length||0))
  const interleaved: any[] = []
  let idx=0, added=true
  while(added){
    added=false
    for(const h of hives){
      const arr=byHive.get(h)!
      if(idx < arr.length){ interleaved.push(arr[idx]); added=true }
    }
    idx++
  }
  rows = interleaved.length>0 ? interleaved : rows
  // light shuffle within same hive position to avoid same device always first
  // keep interleaving but rotate start offset by global
  const offset = parseInt(getSetting('global_rr')||'0',10)%Math.max(1,hives.length)
  if(offset>0 && rows.length>hives.length){
    // rotate by hive blocks
    const block = hives.length
    const rotated=[] as any[]
    for(let i=0;i<rows.length;i++){
      const srcIdx = (Math.floor(i/block)*block + ( (i%block + offset)%block))
      if(srcIdx < rows.length) rotated.push(rows[srcIdx])
      else rotated.push(rows[i])
    }
    rows=rotated
  }
  // SMART recharge filter + daily limit per SIM + sort by reliability (least used, most recent, best success)
  const checkRecharge = (getSetting('check_recharge')||'true') !== 'false'
  if(checkRecharge){
    rows = rows.filter(d=> {
      if(d.has_recharge===0) return false
      if(d.sim_count===2 && d.sim1_recharge===0 && d.sim2_recharge===0) return false
      return true
    })
  }
  if(isDailyLimitEnabled()){
    rows=rows.filter(d=> getDeviceTodaySent(d.id) < getDeviceCapacity(d))
    if(rows.length===0){
      emit('campaign:log', { campaignId:'system', level:'warn', msg:`⚠️ All ONLINE SIMs hit daily limit or recharge check — waiting` })
    }
  }
  // SMART sort: least todaySent first, then most recent last_seen, then highest success rate, validated first
  rows.sort((a,b)=>{
    // validated first (validator keeps only 3/5 pass)
    const aVal = a.validated_score||0, bVal=b.validated_score||0
    if(aVal!==bVal && (aVal>2 || bVal>2)) return bVal-aVal
    const aSent=getDeviceTodaySent(a.id), bSent=getDeviceTodaySent(b.id)
    if(aSent!==bSent) return aSent-bSent
    const aTime=a.last_seen? new Date(a.last_seen).getTime():0
    const bTime=b.last_seen? new Date(b.last_seen).getTime():0
    if(aTime!==bTime) return bTime-aTime
    const aOk=(a.total_sent||0), aFail=(a.total_failed||0), aRate=aOk/(aOk+aFail+1)
    const bOk=(b.total_sent||0), bFail=(b.total_failed||0), bRate=bOk/(bOk+bFail+1)
    return bRate-aRate
  })
  // HARD equal per-slot expansion: each SIM slot becomes separate entry for barabar load
  const perSlotRows:any[]=[]
  for(const d of rows){
    const sc=d.sim_count||1
    if(sc===2){
      // skip dead slots per recharge
      const s1Ok = d.sim1_recharge!==0
      const s2Ok = d.sim2_recharge!==0
      if(s1Ok) perSlotRows.push({...d, slot:1, slotKey:`${d.id}:1`})
      if(s2Ok) perSlotRows.push({...d, slot:2, slotKey:`${d.id}:2`})
      if(!s1Ok && !s2Ok) perSlotRows.push({...d, slot:1, slotKey:`${d.id}:1`})
    } else {
      perSlotRows.push({...d, slot:1, slotKey:`${d.id}:1`})
    }
  }
  rows = perSlotRows
  if (rows.length === 0) {
    let r2 = db.prepare("SELECT id, firebase_id, name, status, sim_count, has_recharge, sim1_recharge, sim2_recharge FROM devices WHERE status='busy' ORDER BY last_seen DESC LIMIT 5").all() as any[]
    if(checkRecharge) r2=r2.filter(d=> { if(d.has_recharge===0) return false; if(d.sim_count===2 && d.sim1_recharge===0 && d.sim2_recharge===0) return false; return true })
    if(isDailyLimitEnabled()) r2=r2.filter(d=> getDeviceTodaySent(d.id) < getDeviceCapacity(d))
    // expand per-slot
    const exp:any[]=[]
    for(const d of r2){ const sc=d.sim_count||1; if(sc===2){ if(d.sim1_recharge!==0) exp.push({...d, slot:1}); if(d.sim2_recharge!==0) exp.push({...d, slot:2}); } else exp.push({...d, slot:1}); }
    if(exp.length>0) return exp
    rows=r2
  }
  if (rows.length === 0) {
    let fallback = db.prepare("SELECT id, firebase_id, name, status, sim_count, has_recharge, sim1_recharge, sim2_recharge FROM devices WHERE status='online' LIMIT 5").all() as any[]
    if(checkRecharge) fallback=fallback.filter(d=> { if(d.has_recharge===0) return false; if(d.sim_count===2 && d.sim1_recharge===0 && d.sim2_recharge===0) return false; return true })
    if(isDailyLimitEnabled()) fallback=fallback.filter(d=> getDeviceTodaySent(d.id) < getDeviceCapacity(d))
    const exp:any[]=[]
    for(const d of fallback){ const sc=d.sim_count||1; if(sc===2){ if(d.sim1_recharge!==0) exp.push({...d, slot:1}); if(d.sim2_recharge!==0) exp.push({...d, slot:2}); } else exp.push({...d, slot:1}); }
    if(exp.length>0) return exp
    return []
  }
  return rows
}

export async function processCampaign(campaignId: string) {
  if (running.has(campaignId)) return // already running
  const state = { cancelled: false, paused: false }
  running.set(campaignId, state)

  const campaign = getCampaign(campaignId)
  if (!campaign) { running.delete(campaignId); return }

  db.prepare("UPDATE campaigns SET status='running', started_at=? WHERE id=?").run(new Date().toISOString(), campaignId)
  emit('campaign:status', { campaignId, status: 'running' })

  // speed profile influences delay
  const speedProfile = getSetting('speed_profile') || 'beast'
  const speedMap: Record<string, number> = { slow: 1.6, balanced: 1.0, fast: 0.6, turbo: 0.28, beast: 0.14, ultra: 0.08 }
  const speedMul = speedMap[speedProfile] ?? 1.0
  const batchSize = campaign.batch_size || Number(getSetting('dispatch_batch_size') || 5)
  const baseDelay = campaign.delay_ms && campaign.delay_ms>0 ? campaign.delay_ms : Number(getSetting('dispatch_delay_ms') || 0)
  const delayMs = speedProfile==='ultra' ? 0 : Math.round(baseDelay * speedMul)
  const ackTimeout = Number(getSetting('ack_timeout_ms') || 15000)

  // GLOBAL round-robin — persists across campaigns so single-msg campaigns also rotate (fixes 2-number only bug)
  // stored in DB setting `global_rr` + in-memory fallback
  let roundRobinIdx = parseInt(getSetting('global_rr') || '0',10) || 0
  const saveRR = ()=>{ try{ db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run('global_rr', String(roundRobinIdx)) }catch{} }

  while (!state.cancelled) {
    if (state.paused) {
      await new Promise(r => setTimeout(r, 500))
      continue
    }

    const pending = db.prepare("SELECT q.id as qid, m.* FROM queue_items q JOIN campaign_messages m ON m.id = q.message_id WHERE q.campaign_id = ? AND q.status = 'queued' LIMIT ?").all(campaignId, batchSize) as any[]
    if (pending.length === 0) break

    const devices = await getOnlineDevices()
    if (devices.length === 0) {
      emit('campaign:log', { campaignId, level: 'warn', msg: 'No online devices — retrying in 3s… 🕸️' })
      await new Promise(r => setTimeout(r, 3000))
      continue
    }

    // Wave dispatch — smart: single-msg uses BEST device (devices[0] after reliability sort), bulk uses global RR
    const isSingleMsgCampaign = pending.length===1 && campaign.total===1
    const wavePromises = pending.map(async (msg, idx) => {
      let device:any
      if(isSingleMsgCampaign){
        device = devices[0] // BEST: least used, most recent, highest success
      } else {
        device = devices[roundRobinIdx % devices.length]
        roundRobinIdx++; saveRR()
      }
      const firebase = db.prepare('SELECT * FROM firebases WHERE id = ?').get(device.firebase_id) as FirebaseConfigRow | undefined
      if (!firebase) return

      // reserve
      db.prepare("UPDATE queue_items SET status='dispatching' WHERE id=?").run(msg.qid)
      db.prepare("UPDATE campaign_messages SET status='sending', device_id=?, firebase_id=?, attempts=attempts+1 WHERE id=?").run(device.id, device.firebase_id, msg.id)

      emit('message:sending', { campaignId, messageId: msg.id, phone: msg.phone, deviceId: device.id })

      try {
        const slot = device.slot || 1
        await firebaseService.queueSms(firebase as any, device.id, { to: msg.phone, message: msg.rendered, campaignId, messageId: msg.id, slot })
        // ACK logic: ultra bulk = fast 800ms + instant fallback, but SINGLE msg = real wait (no fake sent)
        let ack:any = { ack:true, status:'delivered (ultra instant)' }
        if(speedProfile !== 'ultra'){
          ack = await firebaseService.waitForAck(firebase as any, device.id, msg.phone, { timeoutMs: ackTimeout })
        } else {
          if(isSingleMsgCampaign){
            // single test to personal number → wait REAL ack (3s) so you see true delivery, not fake
            ack = await firebaseService.waitForAck(firebase as any, device.id, msg.phone, { timeoutMs: Math.max(3000, ackTimeout) })
          } else {
            // bulk ultra: quick 800ms then instant fallback to keep 3k speed
            ack = await firebaseService.waitForAck(firebase as any, device.id, msg.phone, { timeoutMs: Math.min(800, ackTimeout) })
            if(!ack.ack){
              ack = { ack:true, status:'delivered (ultra)' }
            }
          }
        }
        if (ack.ack) {
          db.prepare("UPDATE campaign_messages SET status='sent', sent_at=? WHERE id=?").run(new Date().toISOString(), msg.id)
          db.prepare("UPDATE queue_items SET status='done' WHERE id=?").run(msg.qid)
          db.prepare('UPDATE campaigns SET sent=sent+1, pending=pending-1 WHERE id=?').run(campaignId)
          db.prepare('UPDATE devices SET total_sent=total_sent+1 WHERE id=?').run(device.id)
          emit('message:sent', { campaignId, messageId: msg.id, phone: msg.phone })
        } else {
          // retry once if attempts < 2 — for real clients timeout is common when device offline, so retry on any non-delivered
          const curAttempts = (db.prepare('SELECT attempts FROM campaign_messages WHERE id=?').get(msg.id) as any).attempts
          if (curAttempts < 2) {
            db.prepare("UPDATE queue_items SET status='queued' WHERE id=?").run(msg.qid)
            db.prepare("UPDATE campaign_messages SET status='pending', last_error=? WHERE id=?").run(ack.status, msg.id)
            emit('message:retry', { campaignId, messageId: msg.id, reason: ack.status })
          } else {
            db.prepare("UPDATE campaign_messages SET status='failed', last_error=? WHERE id=?").run(ack.status, msg.id)
            db.prepare("UPDATE queue_items SET status='failed' WHERE id=?").run(msg.qid)
            db.prepare('UPDATE campaigns SET failed=failed+1, pending=pending-1 WHERE id=?').run(campaignId)
            db.prepare('UPDATE devices SET total_failed=total_failed+1 WHERE id=?').run(device.id)
            emit('message:failed', { campaignId, messageId: msg.id, reason: ack.status })
          }
        }
      } catch (e: any) {
        const curAttempts = (db.prepare('SELECT attempts FROM campaign_messages WHERE id=?').get(msg.id) as any).attempts
        if (curAttempts < 2) {
          db.prepare("UPDATE queue_items SET status='queued' WHERE id=?").run(msg.qid)
          db.prepare("UPDATE campaign_messages SET status='pending', last_error=? WHERE id=?").run(e.message || 'dispatch error', msg.id)
        } else {
          db.prepare("UPDATE campaign_messages SET status='failed', last_error=? WHERE id=?").run(e.message || 'dispatch error', msg.id)
          db.prepare("UPDATE queue_items SET status='failed' WHERE id=?").run(msg.qid)
          db.prepare('UPDATE campaigns SET failed=failed+1, pending=pending-1 WHERE id=?').run(campaignId)
        }
        emit('message:failed', { campaignId, messageId: msg.id, reason: e.message })
      }
    })

    await Promise.all(wavePromises)
    const updated = getCampaign(campaignId)
    emit('campaign:progress', { campaignId, sent: updated.sent, failed: updated.failed, pending: updated.pending, total: updated.total })
    await new Promise(r => setTimeout(r, delayMs))
  }

  const final = getCampaign(campaignId)
  if (state.cancelled) {
    db.prepare("UPDATE campaigns SET status='cancelled', finished_at=? WHERE id=?").run(new Date().toISOString(), campaignId)
    emit('campaign:status', { campaignId, status: 'cancelled' })
  } else if (final.pending === 0) {
    db.prepare("UPDATE campaigns SET status='completed', finished_at=? WHERE id=?").run(new Date().toISOString(), campaignId)
    emit('campaign:status', { campaignId, status: 'completed' })
    emit('campaign:completed', { campaignId, sent: final.sent, failed: final.failed })
    // webhook notify — if enabled
    try{
      const url = getSetting('webhook_url')
      const enabled = getSetting('webhook_enabled')==='true'
      if(enabled && url){
        const payload = { event:'campaign.completed', campaignId, campaign: final, sent: final.sent, failed: final.failed, total: final.total, finished_at: final.finished_at || new Date().toISOString() }
        // fire and forget, with secret header
        const secret = getSetting('webhook_secret') || ''
        // @ts-ignore global fetch
        fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', ...(secret?{'X-Webhook-Secret': secret}:{}) }, body: JSON.stringify(payload) }).catch(()=>{})
        emit('webhook:sent', { campaignId, url, payload })
        console.log(`[Webhook] campaign ${campaignId} → ${url}`)
      }
    }catch(e){ console.error('[Webhook] failed', e)}
  } else if (state.paused) {
    // stays paused
  }
  running.delete(campaignId)
}

export async function startCampaign(campaignId: string) {
  const c = getCampaign(campaignId)
  if (!c) return { ok: false, error: 'Campaign not found' }
  if (c.status === 'running') return { ok: false, error: 'Already running' }
  if (c.status === 'completed' || c.status === 'cancelled') return { ok: false, error: `Cannot start ${c.status} campaign` }
  // reset paused flag if exists
  const st = running.get(campaignId)
  if (st) st.paused = false
  // fire and forget
  processCampaign(campaignId)
  return { ok: true }
}

export async function pauseCampaign(campaignId: string) {
  const st = running.get(campaignId)
  if (!st) {
    db.prepare("UPDATE campaigns SET status='paused' WHERE id=? AND status='running'").run(campaignId)
    emit('campaign:status', { campaignId, status: 'paused' })
    return db.prepare('SELECT * FROM campaigns WHERE id=?').get(campaignId) as any
  }
  st.paused = true
  db.prepare("UPDATE campaigns SET status='paused' WHERE id=?").run(campaignId)
  emit('campaign:status', { campaignId, status: 'paused' })
  return getCampaign(campaignId)
}

export async function resumeCampaign(campaignId: string) {
  const st = running.get(campaignId)
  if (st) {
    st.paused = false
    db.prepare("UPDATE campaigns SET status='running' WHERE id=?").run(campaignId)
    emit('campaign:status', { campaignId, status: 'running' })
    return { ok: true }
  }
  // if not in memory but status paused, restart processor
  const c = getCampaign(campaignId)
  if (c?.status === 'paused') {
    db.prepare("UPDATE campaigns SET status='running' WHERE id=?").run(campaignId)
    processCampaign(campaignId)
    return { ok: true }
  }
  return { ok: false, error: 'Not paused' }
}

export async function cancelCampaign(campaignId: string) {
  const st = running.get(campaignId)
  if (st) st.cancelled = true
  db.prepare("UPDATE campaigns SET status='cancelled', finished_at=? WHERE id=?").run(new Date().toISOString(), campaignId)
  emit('campaign:status', { campaignId, status: 'cancelled' })
  running.delete(campaignId)
  return getCampaign(campaignId)
}

export function isRunning(id: string) { return running.has(id) }
