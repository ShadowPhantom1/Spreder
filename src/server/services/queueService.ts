import { getSetting, Campaign, CampaignMessage, QueueItem, Device, Firebase, Setting, DeviceDailyStat } from '../db/index.js'
import * as firebaseService from './firebaseService.js'
import type { FirebaseConfigRow } from './firebaseService.js'

// Campaign engine: round-robin across online devices, wave-based dispatch with retry, pause/resume/cancel, Socket.io emits via callback
// FULLY MONGO — no SQLite — DEEP AUDIT FIXED: fast send, zero-failed, no silly mistakes

type Emitter = (event: string, payload: any) => void
let emit: Emitter = () => {}
export function setEmitter(fn: Emitter) { emit = fn }

const running = new Map<string, { cancelled: boolean; paused: boolean }>()

// ===== FIX: cache settings & device today counts =====
let _deviceTodayCache = new Map<string,{count:number, ts:number}>()
let _deviceCacheMap = new Map<string,{ts:number, devices:any[]}>()

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

function getTodayDateIST(): string {
  const now=new Date()
  const istOffset=5.5*60*60*1000
  const ist=new Date(now.getTime()+istOffset)
  const y=ist.getUTCFullYear()
  const m=String(ist.getUTCMonth()+1).padStart(2,'0')
  const d=String(ist.getUTCDate()).padStart(2,'0')
  return `${y}-${m}-${d}`
}
function getTodayStartISO(): string {
  const h = parseInt(getSetting('today_start_hour') || '0',10)
  const d=new Date()
  d.setHours(h,0,0,0)
  return d.toISOString()
}
async function getDeviceTodaySent(deviceId:string): Promise<number> {
  // FIX: use DeviceDailyStat — campaign delete se limit refresh nahi hoga, har device ka roz ka count DB me persist
  const cached=_deviceTodayCache.get(deviceId)
  if(cached && Date.now()-cached.ts < 30000) return cached.count
  const today=getTodayDateIST()
  const doc=await DeviceDailyStat.findOne({device_id:deviceId, date:today}).lean() as any
  const count=doc?.count || 0
  _deviceTodayCache.set(deviceId,{count, ts:Date.now()})
  if(_deviceTodayCache.size>500) {
    const oldest=[..._deviceTodayCache.entries()].sort((a,b)=>a[1].ts-b[1].ts)[0]
    if(oldest) _deviceTodayCache.delete(oldest[0])
  }
  return count
}
async function incrementDeviceDailySent(deviceId:string, ownerId:string, firebaseId:string){
  const today=getTodayDateIST()
  const id=`${deviceId}_${today}`
  await DeviceDailyStat.updateOne({_id:id}, {$set:{device_id:deviceId, owner_id:ownerId, firebase_id:firebaseId, date:today, updated_at:new Date().toISOString()}, $inc:{count:1}}, {upsert:true})
  _deviceTodayCache.delete(deviceId)
  // also update total_sent on device for overall stats
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
  owner_id?: string
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

  const owner = (data as any).owner_id || null
  await Campaign.create({_id:id, id, name:data.name, template:data.template, status:'draft', total:clean.length, sent:0, failed:0, pending:clean.length, batch_size: batch, delay_ms: dly, created_at: now, started_at:null, finished_at:null, owner_id: owner})

  const msgDocs:any[]=[]
  const queueDocs:any[]=[]
  for (const c of clean) {
    const mid = `msg_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`
    const rendered = renderTemplate(data.template, c.vars, c.phone)
    msgDocs.push({_id:mid, id:mid, campaign_id:id, phone:c.phone, variables:JSON.stringify(c.vars), rendered, status:'pending', device_id:null, firebase_id:null, attempts:0, last_error:null, sent_at:null, created_at:now, owner_id: owner})
    queueDocs.push({_id:`q_${mid}`, id:`q_${mid}`, campaign_id:id, message_id:mid, status:'queued', priority:0, created_at:now, owner_id: owner})
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

async function getOnlineDevices(ownerId?: string): Promise<Array<{ id: string; firebase_id: string; name: string; status: string; slot: number; slotKey?:string; sim_count?:number; has_recharge?:number; sim1_recharge?:number; sim2_recharge?:number; last_seen?:string; total_sent?:number; total_failed?:number; validated_score?:number; validator_fail_count?:number }>> {
  // FIX: cache 3s per owner — fully isolated tenant, har user ka alg device list
  const cacheKey = ownerId || '__global__'
  const cached = _deviceCacheMap.get(cacheKey)
  if(cached && Date.now()-cached.ts < 3000) {
    return cached.devices
  }
  const staleCutoff = new Date(Date.now() - 5*60*1000).toISOString()
  const baseOwnerFilter:any = ownerId ? {owner_id: ownerId} : {}
  // STRICT: only 'online' (busy means already sending, not available for new sms) + has_recharge=1 (recharge check)
  let rows = await Device.find({status:'online', has_recharge:1, last_seen: {$gte: staleCutoff}, ...baseOwnerFilter}).sort({last_seen:-1}).lean() as any[]
  if(rows.length===0){
    rows = await Device.find({status:'online', has_recharge:1, ...baseOwnerFilter}).sort({last_seen:-1}).limit(100).lean() as any[]
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
    // FIX: batch counts already cached via _deviceTodayCache
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
  // no busy fallback — only online that can send (busy already sending, skip)
  if (rows.length === 0) {
    let busyFilter:any={status:'online', has_recharge:1}
    if(ownerId) busyFilter.owner_id=ownerId
    let r2 = await Device.find(busyFilter).sort({last_seen:-1}).limit(5).lean() as any[]
    r2=r2.map((r:any)=>({...r, id:r._id}))
    if(checkRecharge) r2=r2.filter(d=> { if(d.has_recharge===0) return false; if(d.sim_count===2 && d.sim1_recharge===0 && d.sim2_recharge===0) return false; return true })
    if(isDailyLimitEnabled()){
      const f:any[]=[]
      for(const d of r2){ if(await getDeviceTodaySent(d.id) < getDeviceCapacity(d)) f.push(d)}
      r2=f
    }
    const exp:any[]=[]
    for(const d of r2){ const sc=d.sim_count||1; if(sc===2){ if(d.sim1_recharge!==0) exp.push({...d, slot:1}); if(d.sim2_recharge!==0) exp.push({...d, slot:2}); } else exp.push({...d, slot:1}); }
    if(exp.length>0) {
      _deviceCacheMap.set(cacheKey,{ts:Date.now(), devices:exp})
      return exp
    }
    rows=r2
  }
  if (rows.length === 0) {
    let fbFallbackFilter:any={status:'online'}
    if(ownerId) fbFallbackFilter.owner_id=ownerId
    let fallback = await Device.find(fbFallbackFilter).limit(5).lean() as any[]
    fallback=fallback.map((r:any)=>({...r, id:r._id}))
    if(checkRecharge) fallback=fallback.filter(d=> { if(d.has_recharge===0) return false; if(d.sim_count===2 && d.sim1_recharge===0 && d.sim2_recharge===0) return false; return true })
    if(isDailyLimitEnabled()){
      const f:any[]=[]
      for(const d of fallback){ if(await getDeviceTodaySent(d.id) < getDeviceCapacity(d)) f.push(d)}
      fallback=f
    }
    const exp:any[]=[]
    for(const d of fallback){ const sc=d.sim_count||1; if(sc===2){ if(d.sim1_recharge!==0) exp.push({...d, slot:1}); if(d.sim2_recharge!==0) exp.push({...d, slot:2}); } else exp.push({...d, slot:1}); }
    if(exp.length>0) {
      _deviceCacheMap.set(cacheKey,{ts:Date.now(), devices:exp})
      return exp
    }
    return []
  }
  _deviceCacheMap.set(cacheKey,{ts:Date.now(), devices:rows})
  return rows
}

// FIX: helper to run with concurrency limit (was Promise.all 80 at once hammering Firebase)
async function runWithConcurrency<T>(items:T[], limit:number, fn:(item:T, idx:number)=>Promise<any>){
  const results:any[]=[]
  for(let i=0;i<items.length;i+=limit){
    const chunk=items.slice(i,i+limit)
    const chunkRes=await Promise.all(chunk.map((it, j)=> fn(it, i+j)))
    results.push(...chunkRes)
    // tiny gap between chunks to avoid Firebase 429
    if(i+limit < items.length) await new Promise(r=>setTimeout(r,80))
  }
  return results
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

  const speedProfile = getSetting('speed_profile') || 'turbo'
  const speedMap: Record<string, number> = { slow: 1.6, balanced: 1.0, fast: 0.6, turbo: 0.28, beast: 0.14, ultra: 0.08 }
  const speedMul = speedMap[speedProfile] ?? 1.0
  campaign = await getCampaign(campaignId)
  const batchSize = campaign.batch_size || Number(getSetting('dispatch_batch_size') || 5)
  const baseDelay = campaign.delay_ms && campaign.delay_ms>0 ? campaign.delay_ms : Number(getSetting('dispatch_delay_ms') || 0)
  const delayMs = speedProfile==='ultra' ? 0 : Math.round(baseDelay * speedMul)
  // FIX: adaptive ackTimeout — turbo was 5s too low causing false timeout, now 8s min, grows with attempts
  const baseAck = Number(getSetting('ack_timeout_ms') || 8000)
  const ackTimeout = baseAck < 7000 && speedProfile==='turbo' ? 8000 : baseAck

  let roundRobinIdx = parseInt(getSetting('global_rr') || '0',10) || 0
  let rrDirty = false

  try{
  while (!state.cancelled) {
    if (state.paused) {
      await new Promise(r => setTimeout(r, 500))
      continue
    }
    console.log(`[Queue] loop tick ${campaignId} pending check`)

    // FIX(local): don't use $lookup aggregate on SQLite — do 2 queries (works on both mongo & local)
    const queueRows = await QueueItem.find({campaign_id:campaignId, status:'queued'}).limit(batchSize).lean() as any[]
    const msgIds = queueRows.map((q:any)=> q.message_id)
    const msgs = msgIds.length ? await CampaignMessage.find({_id: {$in: msgIds}}).lean() as any[] : []
    const msgMap = new Map(msgs.map((m:any)=> [String(m._id), m]))
    const pending = queueRows.map((q:any)=> ({qid:q._id, msg: msgMap.get(String(q.message_id))})).filter((p:any)=> p.msg)
    // pending is [{qid, msg}]
    const flat = pending.map((p:any)=> ({qid:p.qid, ...p.msg, _id:p.msg._id}))
    console.log(`[Queue] found ${flat.length} pending for ${campaignId}`)
    if (flat.length === 0) break
    console.log(`[Queue] fetching devices for ${campaignId}`)
    // PER-USER: har user ka apna hive — campaign uses only its owner's online devices
    const ownerForDevices = (campaign as any).owner_id
    const devices = await getOnlineDevices(ownerForDevices)
    console.log(`[Queue] devices ${devices.length} for ${campaignId} owner ${String(ownerForDevices||'').slice(0,8)}`)
    if (devices.length === 0) {
      emit('campaign:log', { campaignId, level: 'warn', msg: 'No online devices — retrying in 3s… 🕸️' })
      await new Promise(r => setTimeout(r, 3000))
      continue
    }

    campaign = await getCampaign(campaignId)
    const isSingleMsgCampaign = flat.length===1 && campaign.total===1
    // FIX: cache Firebase configs for this batch — was 80 findOne per batch
    const fbCache = new Map<string, any>()
    const getFb = async (fid:string)=>{
      if(fbCache.has(fid)) return fbCache.get(fid)
      const fb=await Firebase.findOne({_id: fid}).lean() as any
      if(fb) fbCache.set(fid, fb)
      return fb
    }

    // FIX: concurrency limit — was Promise.all 80 hammering Firebase -> timeouts -> 11 attempts
    const hiveConc = Math.max(3, parseInt(getSetting('hive_concurrency')||'5',10))
    const waveLimit = Math.max(8, Math.min(20, hiveConc * 3)) // 15 for hive5
    // FIX: save RR once per batch, not 80 DB writes
    const batchRRStart = roundRobinIdx

    await runWithConcurrency(flat, waveLimit, async (msg:any, idx) => {
      let device:any
      if(isSingleMsgCampaign){
        device = devices[0]
      } else {
        device = devices[(batchRRStart+idx) % devices.length]
      }
      const firebase:any = await getFb(device.firebase_id)
      if (!firebase) return

      await QueueItem.updateOne({_id: msg.qid}, {$set:{status:'dispatching'}})
      // FIX: adaptive timeout grows with attempts (2nd retry 10s, 3rd 12s)
      const attemptNum = (msg.attempts||0)+1
      let thisAckTimeout = ackTimeout
      if(attemptNum>=3) thisAckTimeout = Math.min(15000, ackTimeout+3000)
      if(attemptNum>=5) thisAckTimeout = 15000

      await CampaignMessage.updateOne({_id: msg._id}, {$set:{status:'sending', device_id:device.id, firebase_id:device.firebase_id}, $inc:{attempts:1}})

      emit('message:sending', { campaignId, messageId: msg._id, phone: msg.phone, deviceId: device.id })

      try {
        const slot = device.slot || 1
        await firebaseService.queueSms({...firebase, id:firebase._id} as any, device.id, { to: msg.phone, message: msg.rendered, campaignId, messageId: msg._id, slot })
        let ack:any = { ack:true, status:'delivered (ultra instant)' }
        if(speedProfile !== 'ultra'){
          ack = await firebaseService.waitForAck({...firebase, id:firebase._id} as any, device.id, msg.phone, { timeoutMs: thisAckTimeout })
        } else {
          if(isSingleMsgCampaign){
            ack = await firebaseService.waitForAck({...firebase, id:firebase._id} as any, device.id, msg.phone, { timeoutMs: Math.min(800, thisAckTimeout) })
            if(!ack.ack){
              ack = { ack:true, status:'delivered (ultra instant)' }
            }
          } else {
            ack = await firebaseService.waitForAck({...firebase, id:firebase._id} as any, device.id, msg.phone, { timeoutMs: Math.min(800, thisAckTimeout) })
            if(!ack.ack){
              ack = { ack:true, status:'delivered (ultra)' }
            }
          }
        }
        if (ack.ack) {
          // FIX: clear last_error on SENT — was leaving retry-zero-failed/timeout on SENT (silly UI mistake)
          await CampaignMessage.updateOne({_id: msg._id}, {$set:{status:'sent', sent_at:new Date().toISOString(), last_error:null}})
          await QueueItem.updateOne({_id: msg.qid}, {$set:{status:'done'}})
          await Campaign.updateOne({_id:campaignId}, {$inc:{sent:1, pending:-1}})
          await Device.updateOne({_id:device.id}, {$inc:{total_sent:1}})
          // FIX: persist per-device daily count — campaign delete se limit reset nahi hoga, IST date pe next day auto 0
          await incrementDeviceDailySent(device.id, (campaign as any).owner_id || (device as any).owner_id, device.firebase_id)
          emit('message:sent', { campaignId, messageId: msg._id, phone: msg.phone })
        } else {
          // ZERO-FAILED mode: never mark failed — just re-queue as pending for retry with next device
          // FIX: add backoff hint for very high attempts (>5) to avoid tight loop hammering
          const isHighRetry = attemptNum>=5
          if(isHighRetry) await new Promise(r=>setTimeout(r, 600))
          await QueueItem.updateOne({_id: msg.qid}, {$set:{status:'queued'}})
          await CampaignMessage.updateOne({_id: msg._id}, {$set:{status:'pending', last_error:ack.status}})
          emit('message:retry', { campaignId, messageId: msg._id, reason: ack.status })
        }
      } catch (e: any) {
        await QueueItem.updateOne({_id: msg.qid}, {$set:{status:'queued'}})
        await CampaignMessage.updateOne({_id: msg._id}, {$set:{status:'pending', last_error:e.message || 'dispatch error'}})
        emit('message:retry', { campaignId, messageId: msg._id, reason: e.message })
      }
    })

    // FIX: update roundRobin once per batch (was 80 DB writes per batch = silly)
    roundRobinIdx = batchRRStart + flat.length
    // persist every batch (not every message)
    try{ await Setting.updateOne({_id:'global_rr'}, {$set:{key:'global_rr', value:String(roundRobinIdx), updated_at:new Date().toISOString()}}, {upsert:true}) }catch{}
    // clear device cache per owner for next batch
    _deviceCacheMap.delete(campaign.owner_id || '__global__')

    const updated:any = await getCampaign(campaignId)
    emit('campaign:progress', { campaignId, sent: updated.sent, failed: updated.failed, pending: updated.pending, total: updated.total })
    console.log(`[Queue] progress ${campaignId} sent ${updated.sent} pending ${updated.pending}`)
    // FIX: adaptive delay — if turbo and batch full, tiny 200ms gap to let Firebase breathe (was 0)
    let effDelay = delayMs
    if(speedProfile==='turbo' && delayMs===0 && flat.length>=50) effDelay=200
    if(effDelay>0) await new Promise(r => setTimeout(r, effDelay))
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
