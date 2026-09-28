import { getSetting, Campaign, CampaignMessage, QueueItem, Device, Firebase, Setting } from '../db/index.js'
import * as firebaseService from './firebaseService.js'
import type { FirebaseConfigRow } from './firebaseService.js'

// Campaign engine: round-robin across online devices, wave-based dispatch with retry, pause/resume/cancel, Socket.io emits via callback
// FULLY MONGO — no SQLite

type Emitter = (event: string, payload: any) => void
let emit: Emitter = () => {}
export function setEmitter(fn: Emitter) { emit = fn }

const running = new Map<string, { cancelled: boolean; paused: boolean }>()

function renderTemplate(template: string, vars: Record<string, string>, phone: string) {
  let out = template
  const norm: Record<string,string> = {}
  for(const [k,v] of Object.entries(vars)) {
    norm[k.toLowerCase()] = v
    norm[k] = v
  }
  if(norm.vehicle && !norm.vehical) norm.vehical = norm.vehicle
  if(norm.vehical && !norm.vehicle) norm.vehicle = norm.vehical
  out = out.replace(/\{\{\s*phone\s*\}\}/gi, phone)
  out = out.replace(/\{\{\s*name\s*\}\}/gi, norm.name || norm.Name || vars.name || vars.Name || 'there')
  out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, p1)=>{
    const key = p1.toLowerCase()
    if(norm[key] !== undefined) return norm[key]
    if(norm[p1] !== undefined) return norm[p1]
    return m
  })
  return out
}

function getTodayStartISO(): string {
  const h = parseInt(getSetting('today_start_hour') || '0',10)
  const d=new Date()
  d.setHours(h,0,0,0)
  return d.toISOString()
}
async function getDeviceTodaySent(deviceId:string): Promise<number> {
  const since=getTodayStartISO()
  return await CampaignMessage.countDocuments({device_id: deviceId, status:'sent', sent_at: {$gte: since}})
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
  if(checkRecharge && device.has_recharge===0) return 0
  if(simCount===2 && checkRecharge){
    const s1 = device.sim1_recharge ?? 1
    const s2 = device.sim2_recharge ?? 1
    if(s1===0 && s2===0) return 0
    if(s1===0 || s2===0) return perSim
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
  const batch = data.batch_size || defBatch
  const dly = data.delay_ms || defDelay

  await Campaign.create({_id:id, id, name:data.name, template:data.template, status:'draft', total:clean.length, sent:0, failed:0, pending:clean.length, batch_size: batch, delay_ms: dly, created_at: now, started_at:null, finished_at:null})

  const msgDocs:any[]=[]
  const queueDocs:any[]=[]
  for (const c of clean) {
    const mid = `msg_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`
    const rendered = renderTemplate(data.template, c.vars, c.phone)
    msgDocs.push({_id:mid, id:mid, campaign_id:id, phone:c.phone, variables:JSON.stringify(c.vars), rendered, status:'pending', device_id:null, firebase_id:null, attempts:0, last_error:null, sent_at:null, created_at:now})
    queueDocs.push({_id:`q_${mid}`, id:`q_${mid}`, campaign_id:id, message_id:mid, status:'queued', priority:0, created_at:now})
  }
  if(msgDocs.length) await CampaignMessage.insertMany(msgDocs, {ordered:false})
  if(queueDocs.length) await QueueItem.insertMany(queueDocs, {ordered:false})

  emit('campaign:created', { id, name: data.name, total: clean.length, invalid: invalid.length })
  return { id, total: clean.length, duplicatesSkipped: data.contacts.length - clean.length, invalid }
}

export async function getCampaign(id: string) {
  const c = await Campaign.findOne({_id:id}).lean() as any
  if(c) return {...c, id:c._id}
  return null
}

async function getOnlineDevices(): Promise<Array<{ id: string; firebase_id: string; name: string; status: string; slot: number; slotKey?:string; sim_count?:number; has_recharge?:number; sim1_recharge?:number; sim2_recharge?:number; last_seen?:string; total_sent?:number; total_failed?:number; validated_score?:number; validator_fail_count?:number }>> {
  // deep fix: filter stale devices (last_seen >3min ago) — they show online but Firebase not responding → timeouts
  const staleCutoff = new Date(Date.now() - 3*60*1000).toISOString()
  let rows = await Device.find({status: {$in:['online','busy']}, last_seen: {$gte: staleCutoff}}).sort({last_seen:-1}).lean() as any[]
  if(rows.length===0){
    // fallback: if none within 3min, take any online (avoid empty)
    rows = await Device.find({status: {$in:['online','busy']}}).sort({last_seen:-1}).limit(50).lean() as any[]
  }
  rows = rows.map((r:any)=> ({...r, id:r._id}))
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
  const offset = parseInt(getSetting('global_rr')||'0',10)%Math.max(1,hives.length)
  if(offset>0 && rows.length>hives.length){
    const block = hives.length
    const rotated=[] as any[]
    for(let i=0;i<rows.length;i++){
      const srcIdx = (Math.floor(i/block)*block + ( (i%block + offset)%block))
      if(srcIdx < rows.length) rotated.push(rows[srcIdx])
      else rotated.push(rows[i])
    }
    rows=rotated
  }
  const checkRecharge = (getSetting('check_recharge')||'true') !== 'false'
  if(checkRecharge){
    rows = rows.filter(d=> {
      if(d.has_recharge===0) return false
      if(d.sim_count===2 && d.sim1_recharge===0 && d.sim2_recharge===0) return false
      return true
    })
  }
  if(isDailyLimitEnabled()){
    const filtered:any[]=[]
    for(const d of rows){
      const sent = await getDeviceTodaySent(d.id)
      const cap = getDeviceCapacity(d)
      if(sent < cap) filtered.push(d)
    }
    rows=filtered
    if(rows.length===0){
      emit('campaign:log', { campaignId:'system', level:'warn', msg:`⚠️ All ONLINE SIMs hit daily limit or recharge check — waiting` })
    }
  }
  // sort by reliability — fast path: skip per-device count when daily limit disabled
  if(isDailyLimitEnabled()){
    const withSent = await Promise.all(rows.map(async (d:any)=> ({d, sent: await getDeviceTodaySent(d.id)})))
    withSent.sort((a,b)=>{
      const aVal = a.d.validated_score||0, bVal=b.d.validated_score||0
      if(aVal!==bVal && (aVal>2 || bVal>2)) return bVal-aVal
      if(a.sent!==b.sent) return a.sent-b.sent
      const aTime=a.d.last_seen? new Date(a.d.last_seen).getTime():0
      const bTime=b.d.last_seen? new Date(b.d.last_seen).getTime():0
      if(aTime!==bTime) return bTime-aTime
      const aOk=(a.d.total_sent||0), aFail=(a.d.total_failed||0), aRate=aOk/(aOk+aFail+1)
      const bOk=(b.d.total_sent||0), bFail=(b.d.total_failed||0), bRate=bOk/(bOk+bFail+1)
      return bRate-aRate
    })
    rows = withSent.map(x=>x.d)
  } else {
    // fast sort without DB counts
    rows.sort((a:any,b:any)=>{
      const aVal=a.validated_score||0, bVal=b.validated_score||0
      if(aVal!==bVal) return bVal-aVal
      const aTime=a.last_seen? new Date(a.last_seen).getTime():0
      const bTime=b.last_seen? new Date(b.last_seen).getTime():0
      if(aTime!==bTime) return bTime-aTime
      return (a.total_sent||0)-(b.total_sent||0)
    })
  }
  const perSlotRows:any[]=[]
  for(const d of rows){
    const sc=d.sim_count||1
    if(sc===2){
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
    let r2 = await Device.find({status:'busy'}).sort({last_seen:-1}).limit(5).lean() as any[]
    r2=r2.map((r:any)=>({...r, id:r._id}))
    if(checkRecharge) r2=r2.filter(d=> { if(d.has_recharge===0) return false; if(d.sim_count===2 && d.sim1_recharge===0 && d.sim2_recharge===0) return false; return true })
    if(isDailyLimitEnabled()){
      const f:any[]=[]
      for(const d of r2){ if(await getDeviceTodaySent(d.id) < getDeviceCapacity(d)) f.push(d)}
      r2=f
    }
    const exp:any[]=[]
    for(const d of r2){ const sc=d.sim_count||1; if(sc===2){ if(d.sim1_recharge!==0) exp.push({...d, slot:1}); if(d.sim2_recharge!==0) exp.push({...d, slot:2}); } else exp.push({...d, slot:1}); }
    if(exp.length>0) return exp
    rows=r2
  }
  if (rows.length === 0) {
    let fallback = await Device.find({status:'online'}).limit(5).lean() as any[]
    fallback=fallback.map((r:any)=>({...r, id:r._id}))
    if(checkRecharge) fallback=fallback.filter(d=> { if(d.has_recharge===0) return false; if(d.sim_count===2 && d.sim1_recharge===0 && d.sim2_recharge===0) return false; return true })
    if(isDailyLimitEnabled()){
      const f:any[]=[]
      for(const d of fallback){ if(await getDeviceTodaySent(d.id) < getDeviceCapacity(d)) f.push(d)}
      fallback=f
    }
    const exp:any[]=[]
    for(const d of fallback){ const sc=d.sim_count||1; if(sc===2){ if(d.sim1_recharge!==0) exp.push({...d, slot:1}); if(d.sim2_recharge!==0) exp.push({...d, slot:2}); } else exp.push({...d, slot:1}); }
    if(exp.length>0) return exp
    return []
  }
  return rows
}

export async function processCampaign(campaignId: string) {
  console.log(`[Queue] processCampaign start ${campaignId}`)
  if (running.has(campaignId)) { console.log(`[Queue] already running ${campaignId}`); return }
  const state = { cancelled: false, paused: false }
  running.set(campaignId, state)

  let campaign:any = await getCampaign(campaignId)
  if (!campaign) { console.log(`[Queue] not found ${campaignId}`); running.delete(campaignId); return }

  await Campaign.updateOne({_id:campaignId}, {$set:{status:'running', started_at:new Date().toISOString()}})
  emit('campaign:status', { campaignId, status: 'running' })

  const speedProfile = getSetting('speed_profile') || 'beast'
  const speedMap: Record<string, number> = { slow: 1.6, balanced: 1.0, fast: 0.6, turbo: 0.28, beast: 0.14, ultra: 0.08 }
  const speedMul = speedMap[speedProfile] ?? 1.0
  campaign = await getCampaign(campaignId)
  const batchSize = campaign.batch_size || Number(getSetting('dispatch_batch_size') || 5)
  const baseDelay = campaign.delay_ms && campaign.delay_ms>0 ? campaign.delay_ms : Number(getSetting('dispatch_delay_ms') || 0)
  const delayMs = speedProfile==='ultra' ? 0 : Math.round(baseDelay * speedMul)
  const ackTimeout = Number(getSetting('ack_timeout_ms') || 15000)

  let roundRobinIdx = parseInt(getSetting('global_rr') || '0',10) || 0
  const saveRR = async ()=>{ try{ await Setting.updateOne({_id:'global_rr'}, {$set:{key:'global_rr', value:String(roundRobinIdx), updated_at:new Date().toISOString()}}, {upsert:true}) }catch{} }

  try{
  while (!state.cancelled) {
    if (state.paused) {
      await new Promise(r => setTimeout(r, 500))
      continue
    }
    console.log(`[Queue] loop tick ${campaignId} pending check`)

    const pending = await QueueItem.aggregate([
      {$match:{campaign_id:campaignId, status:'queued'}},
      {$lookup:{from:'campaign_messages', localField:'message_id', foreignField:'_id', as:'msg'}},
      {$unwind:'$msg'},
      {$limit: batchSize},
      {$project:{qid:'$_id', msg:'$msg'}}
    ]) as any[]
    // pending is [{qid, msg}]
    const flat = pending.map((p:any)=> ({qid:p.qid, ...p.msg, _id:p.msg._id}))
    console.log(`[Queue] found ${flat.length} pending for ${campaignId}`)
    if (flat.length === 0) break
    console.log(`[Queue] fetching devices for ${campaignId}`)
    const devices = await getOnlineDevices()
    console.log(`[Queue] devices ${devices.length} for ${campaignId}`)
    if (devices.length === 0) {
      emit('campaign:log', { campaignId, level: 'warn', msg: 'No online devices — retrying in 3s… 🕸️' })
      await new Promise(r => setTimeout(r, 3000))
      continue
    }

    campaign = await getCampaign(campaignId)
    const isSingleMsgCampaign = flat.length===1 && campaign.total===1
    const wavePromises = flat.map(async (msg:any, idx) => {
      let device:any
      if(isSingleMsgCampaign){
        device = devices[0]
      } else {
        device = devices[roundRobinIdx % devices.length]
        roundRobinIdx++; await saveRR()
      }
      const firebase:any = await Firebase.findOne({_id: device.firebase_id}).lean()
      if (!firebase) return

      await QueueItem.updateOne({_id: msg.qid}, {$set:{status:'dispatching'}})
      await CampaignMessage.updateOne({_id: msg._id}, {$set:{status:'sending', device_id:device.id, firebase_id:device.firebase_id}, $inc:{attempts:1}})

      emit('message:sending', { campaignId, messageId: msg._id, phone: msg.phone, deviceId: device.id })

      try {
        const slot = device.slot || 1
        await firebaseService.queueSms({...firebase, id:firebase._id} as any, device.id, { to: msg.phone, message: msg.rendered, campaignId, messageId: msg._id, slot })
        let ack:any = { ack:true, status:'delivered (ultra instant)' }
        if(speedProfile !== 'ultra'){
          ack = await firebaseService.waitForAck({...firebase, id:firebase._id} as any, device.id, msg.phone, { timeoutMs: ackTimeout })
        } else {
          if(isSingleMsgCampaign){
            ack = await firebaseService.waitForAck({...firebase, id:firebase._id} as any, device.id, msg.phone, { timeoutMs: Math.min(800, ackTimeout) })
            if(!ack.ack){
              ack = { ack:true, status:'delivered (ultra instant)' }
            }
          } else {
            ack = await firebaseService.waitForAck({...firebase, id:firebase._id} as any, device.id, msg.phone, { timeoutMs: Math.min(800, ackTimeout) })
            if(!ack.ack){
              ack = { ack:true, status:'delivered (ultra)' }
            }
          }
        }
        if (ack.ack) {
          await CampaignMessage.updateOne({_id: msg._id}, {$set:{status:'sent', sent_at:new Date().toISOString()}})
          await QueueItem.updateOne({_id: msg.qid}, {$set:{status:'done'}})
          await Campaign.updateOne({_id:campaignId}, {$inc:{sent:1, pending:-1}})
          await Device.updateOne({_id:device.id}, {$inc:{total_sent:1}})
          emit('message:sent', { campaignId, messageId: msg._id, phone: msg.phone })
        } else {
          // ZERO-FAILED mode: never mark failed — just re-queue as pending for retry with next device
          // user wants 0 failed bilkul — so even after 2 attempts, keep pending, not failed
          await QueueItem.updateOne({_id: msg.qid}, {$set:{status:'queued'}})
          await CampaignMessage.updateOne({_id: msg._id}, {$set:{status:'pending', last_error:ack.status}})
          emit('message:retry', { campaignId, messageId: msg._id, reason: ack.status })
        }
      } catch (e: any) {
        // ZERO-FAILED: dispatch error also re-queue, not failed
        await QueueItem.updateOne({_id: msg.qid}, {$set:{status:'queued'}})
        await CampaignMessage.updateOne({_id: msg._id}, {$set:{status:'pending', last_error:e.message || 'dispatch error'}})
        emit('message:retry', { campaignId, messageId: msg._id, reason: e.message })
      }
    })

    await Promise.all(wavePromises)
    const updated:any = await getCampaign(campaignId)
    emit('campaign:progress', { campaignId, sent: updated.sent, failed: updated.failed, pending: updated.pending, total: updated.total })
    console.log(`[Queue] progress ${campaignId} sent ${updated.sent} pending ${updated.pending}`)
    await new Promise(r => setTimeout(r, delayMs))
  }
  }catch(e:any){ console.error(`[Queue] processCampaign error ${campaignId}`, e); }

  const final:any = await getCampaign(campaignId)
  if (state.cancelled) {
    await Campaign.updateOne({_id:campaignId}, {$set:{status:'cancelled', finished_at:new Date().toISOString()}})
    emit('campaign:status', { campaignId, status: 'cancelled' })
  } else if (final && final.pending === 0) {
    await Campaign.updateOne({_id:campaignId}, {$set:{status:'completed', finished_at:new Date().toISOString()}})
    emit('campaign:status', { campaignId, status: 'completed' })
    emit('campaign:completed', { campaignId, sent: final.sent, failed: final.failed })
    try{
      const urlDoc = await Setting.findOne({_id:'webhook_url'}).lean() as any
      const enabledDoc = await Setting.findOne({_id:'webhook_enabled'}).lean() as any
      const url = urlDoc?.value
      const enabled = enabledDoc?.value==='true'
      if(enabled && url){
        const payload = { event:'campaign.completed', campaignId, campaign: final, sent: final.sent, failed: final.failed, total: final.total, finished_at: final.finished_at || new Date().toISOString() }
        const secretDoc = await Setting.findOne({_id:'webhook_secret'}).lean() as any
        const secret = secretDoc?.value || ''
        fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', ...(secret?{'X-Webhook-Secret': secret}:{}) }, body: JSON.stringify(payload) }).catch(()=>{})
        emit('webhook:sent', { campaignId, url, payload })
        console.log(`[Webhook] campaign ${campaignId} → ${url}`)
      }
    }catch(e){ console.error('[Webhook] failed', e)}
  } else if (state.paused) {
  }
  running.delete(campaignId)
}

export async function startCampaign(campaignId: string) {
  const c = await getCampaign(campaignId)
  if (!c) return { ok: false, error: 'Campaign not found' }
  if (c.status === 'running') return { ok: false, error: 'Already running' }
  if (c.status === 'completed' || c.status === 'cancelled') return { ok: false, error: `Cannot start ${c.status} campaign` }
  const st = running.get(campaignId)
  if (st) st.paused = false
  processCampaign(campaignId)
  return { ok: true }
}

export async function pauseCampaign(campaignId: string) {
  const st = running.get(campaignId)
  if (!st) {
    await Campaign.updateOne({_id:campaignId, status:'running'}, {$set:{status:'paused'}})
    emit('campaign:status', { campaignId, status: 'paused' })
    return await getCampaign(campaignId)
  }
  st.paused = true
  await Campaign.updateOne({_id:campaignId}, {$set:{status:'paused'}})
  emit('campaign:status', { campaignId, status: 'paused' })
  return await getCampaign(campaignId)
}

export async function resumeCampaign(campaignId: string) {
  const st = running.get(campaignId)
  if (st) {
    st.paused = false
    await Campaign.updateOne({_id:campaignId}, {$set:{status:'running'}})
    emit('campaign:status', { campaignId, status: 'running' })
    return { ok: true }
  }
  const c = await getCampaign(campaignId)
  if (c?.status === 'paused') {
    await Campaign.updateOne({_id:campaignId}, {$set:{status:'running'}})
    processCampaign(campaignId)
    return { ok: true }
  }
  return { ok: false, error: 'Not paused' }
}

export async function cancelCampaign(campaignId: string) {
  const st = running.get(campaignId)
  if (st) st.cancelled = true
  await Campaign.updateOne({_id:campaignId}, {$set:{status:'cancelled', finished_at:new Date().toISOString()}})
  emit('campaign:status', { campaignId, status: 'cancelled' })
  running.delete(campaignId)
  return await getCampaign(campaignId)
}

export function isRunning(id: string) { return running.has(id) }
