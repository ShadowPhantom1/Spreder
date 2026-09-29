import { Router } from 'express'
import { randomUUID } from 'crypto'
import { Firebase, Device } from '../db/index.js'
import { authRequired } from '../middleware/auth.js'
import * as firebaseService from '../services/firebaseService.js'
import { normalizeUrl } from '../utils/normalizeUrl.js'

const router = Router()
router.use(authRequired as any)

function isSuper(req:any){ return req.user?.is_super===1 }
function ownerFilterFb(req:any){ if(isSuper(req)) return {}; return {owner_id: req.user.id} }
function assertOwnerFb(doc:any, req:any){ if(isSuper(req)) return true; return doc && doc.owner_id===req.user.id }

let _cacheMap=new Map<string,{data:any, ts:number}>()
function _invalidateCache(ownerId?:string){
  if(ownerId) _cacheMap.delete(ownerId)
  else _cacheMap.clear()
}
function _getCache(ownerId:string){
  const c=_cacheMap.get(ownerId)
  // AUDIT FIX: was 10s stale (hives device on but windows 0 for 10s). Now 3s for near-realtime.
  if(c && Date.now()-c.ts < 3000) return c.data
  return null
}
router.get('/', async (req:any, res) => {
  // AUDIT FIX: hives are SHARED infrastructure — all users see all hives (was per-owner, caused z4x 0 online while admin had 26). Write still per-owner via assertOwnerFb.
  const filter:any={}
  const cacheKey='global'
  const cached=_getCache(cacheKey)
  if(cached) return res.json(cached)
  const rows = await Firebase.find(filter).sort({created_at:-1}).lean() as any[]
  const matchStage:any={status:{$in:['online','busy']}}
  const counts = await Device.aggregate([{$match:matchStage}, {$group:{_id:'$firebase_id', c:{$sum:1}}}]) as any[]
  const onlineMap = new Map<string, number>(counts.map((r:any)=>[r._id, r.c]))
  const enriched = rows.map((r:any)=> ({...r, id:r._id, online_count: onlineMap.get(r._id) ?? 0 }))
  _cacheMap.set(cacheKey,{data:enriched, ts:Date.now()})
  res.json(enriched)
})

router.post('/', async (req:any, res) => {
  const { name, database_url, service_account_json } = req.body || {}
  if (!name || !database_url) return res.status(400).json({ error: 'name & database_url required' })
  try { new URL(database_url) } catch { return res.status(400).json({ error: 'Invalid database_url' }) }
  const norm = normalizeUrl(database_url)
  // AUDIT FIX: duplicate check must be GLOBAL (same URL for different owners caused 2 hives for amitabh + device owner flip-flop + z4x 0 devices). Was per-owner before.
  const existing = await Firebase.find().lean() as any[]
  const dup = existing.find((f:any)=> normalizeUrl(f.database_url)===norm)
  if(dup) return res.status(409).json({ error: `Duplicate hive — already exists as "${dup.name}"`, duplicateId: dup._id })
  const id = randomUUID()
  await Firebase.create({_id:id, id, name, database_url, service_account_json: service_account_json ? JSON.stringify(service_account_json) : null, status:'unknown', created_at:new Date().toISOString(), owner_id: req.user.id})
  _invalidateCache('global')
  _invalidateCache(req.user.id)
  // AUDIT FIX: immediate poll so new hive (crow) doesn't show 0 online for 5s+ (was waiting for next 5s poll cycle)
  ;(async()=>{
    try{
      const devices = await firebaseService.pollDevices({id, name, database_url} as any)
      const now=new Date().toISOString()
      if(devices.length){
        const fbOwner=req.user.id
        const ops=devices.map((d:any)=>({
          updateOne:{ filter:{_id:d.id}, update:{$set:{id:d.id, firebase_id:id, name:d.name, model:d.model||null, status:d.status, battery:d.battery??null, signal:d.signal??null, last_seen:d.last_seen||now, owner_id:fbOwner}, $setOnInsert:{_id:d.id, created_at:now, sim_count:1, has_recharge:1, sim1_recharge:1, sim2_recharge:1, owner_id:fbOwner}}, upsert:true}
        }))
        for(let k=0;k<ops.length;k+=500) await Device.bulkWrite(ops.slice(k,k+500) as any, {ordered:false})
      }
      const onlineCount=devices.filter((d:any)=>d.status==='online'||d.status==='busy').length
      await Firebase.updateOne({_id:id}, {$set:{device_count:devices.length, online_count:onlineCount, status: onlineCount>0?'online': (devices.length>0?'offline':'offline'), last_polled_at: now}})
      _invalidateCache('global')
    }catch(e:any){ console.log('[Firebase POST] immediate poll fail', e.message)}
  })()
  const created = await Firebase.findOne({_id:id}).lean()
  res.status(201).json({...created, id})
})

router.put('/:id', async (req:any, res) => {
  const { name, database_url, service_account_json } = req.body || {}
  const existing = await Firebase.findOne({_id:req.params.id}).lean() as any
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if(!assertOwnerFb(existing, req)) return res.status(403).json({ error: 'Not yours' })
  await Firebase.updateOne({_id:req.params.id}, {$set:{
    name: name || existing.name,
    database_url: database_url || existing.database_url,
    service_account_json: service_account_json ? JSON.stringify(service_account_json) : existing.service_account_json
  }})
  _invalidateCache('global')
  _invalidateCache(req.user.id)
  const updated = await Firebase.findOne({_id:req.params.id}).lean()
  res.json({...updated, id: (updated as any)._id})
})

router.delete('/:id', async (req:any, res) => {
  const fid=req.params.id
  const fb=await Firebase.findOne({_id:fid}).lean() as any
  if(!fb) return res.status(404).json({ error:'Not found' })
  if(!assertOwnerFb(fb, req)) return res.status(403).json({ error:'Not yours' })
  await Device.deleteMany({firebase_id:fid})
  await Firebase.deleteOne({_id:fid})
  _invalidateCache('global')
  _invalidateCache(req.user.id)
  res.json({ ok: true })
})

router.post('/:id/test', async (req:any, res) => {
  const fb = await Firebase.findOne({_id:req.params.id}).lean() as any
  if (!fb) return res.status(404).json({ error: 'Not found' })
  if(!assertOwnerFb(fb, req)) return res.status(403).json({ error:'Not yours' })
  const fbForTest={...fb, id:fb._id}
  const result = await firebaseService.testConnection(fbForTest)
  await Firebase.updateOne({_id:fb._id}, {$set:{status: result.ok ? 'online' : 'offline', last_tested_at:new Date().toISOString()}})
  res.json(result)
})

router.post('/:id/seed', async (req:any, res) => {
  const fb = await Firebase.findOne({_id:req.params.id}).lean() as any
  if (!fb) return res.status(404).json({ error: 'Not found' })
  if(!assertOwnerFb(fb, req)) return res.status(403).json({ error:'Not yours' })
  const r = await firebaseService.seedDevicesIfEmpty({...fb, id:fb._id})
  res.json(r)
})

router.post('/bulk', async (req:any, res) => {
  const { items } = req.body || {}
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' })
  const out: any[] = []
  let skippedDuplicates = 0
  let autoNamed = 0
  // AUDIT FIX: global duplicate check (was per-owner, allowed same URL for admin+z4x)
  const existing = await Firebase.find().lean() as any[]
  const existingNorms = new Set(existing.map((f:any)=> normalizeUrl(f.database_url)))
  const seenInBatch = new Set<string>()
  for (const raw of items) {
    let name: string | null = null
    let url: string | null = null
    if(typeof raw === 'string'){ url = raw.trim() }
    else if(raw && typeof raw === 'object'){ name = (raw.name || '').toString().trim() || null; url = (raw.database_url || raw.url || '').toString().trim() || null; if(!url && name && name.startsWith('http')){ url = name; name = null } }
    if(!url) continue
    if(!name){
      try{ const u = new URL(url); const host = u.hostname; const m = host.match(/^([a-z0-9-]+?)(?:-default-rtdb)?\.firebaseio\.com$/i); name = m ? m[1] : host.split('.')[0]; name = name || `Hive-${Math.random().toString(36).slice(2,4)}`; autoNamed++ } catch { name = `Hive-${Math.random().toString(36).slice(2,4)}`; autoNamed++ }
    }
    const norm = normalizeUrl(url)
    if(existingNorms.has(norm) || seenInBatch.has(norm)){ skippedDuplicates++; continue }
    try{ new URL(url)} catch{ continue }
    seenInBatch.add(norm); existingNorms.add(norm)
    const id = randomUUID()
    await Firebase.create({_id:id, id, name, database_url:url, status:'unknown', created_at:new Date().toISOString(), owner_id: req.user.id})
    const created=await Firebase.findOne({_id:id}).lean()
    out.push({...created, id})
  }
  if(out.length){ _invalidateCache('global'); _invalidateCache(req.user.id) }
  res.status(201).json({ imported: out.length, skippedDuplicates, autoNamed, firebases: out })
})

router.get('/check-duplicate', async (req:any, res)=>{
  const url = (req.query.url as string) || ''
  if(!url) return res.json({ duplicate:false })
  const norm = normalizeUrl(url)
  // AUDIT FIX: duplicate check must be GLOBAL (same URL for different owners caused 2 hives for amitabh + device owner flip-flop + z4x 0 devices). Was per-owner before.
  const existing = await Firebase.find().lean() as any[]
  const dup = existing.find((f:any)=> normalizeUrl(f.database_url)===norm)
  res.json({ duplicate: !!dup, duplicateHive: dup ? {...dup, id:dup._id} : null, normalized: norm })
})

router.post('/cleanup-low-online', async (req:any, res)=>{
  let threshold = Math.max(0, parseInt((req.body?.threshold ?? req.query.threshold) as string,10) || 0)
  const filter=ownerFilterFb(req)
  const firebases = await Firebase.find(filter).lean() as any[]
  const matchStage:any={status:'online', has_recharge:1}
  if(!isSuper(req)) matchStage.owner_id=req.user.id
  const counts = await Device.aggregate([{$match:matchStage}, {$group:{_id:'$firebase_id', c:{$sum:1}}}]) as any[]
  const map = new Map<string,number>(counts.map((r:any)=>[r._id, r.c]))
  const toDelete: any[] = []
  for(const fb of firebases){
    const online = map.get(fb._id) ?? 0
    if(online < threshold) toDelete.push({...fb, id:fb._id, online})
  }
  if(toDelete.length===0) return res.json({ deleted:0, threshold, message: `All hives have >=${threshold} online — nothing to clean`, checked: firebases.length })
  for(const fb of toDelete){
    await Device.deleteMany({firebase_id:fb.id})
    await Firebase.deleteOne({_id:fb.id})
  }
  _invalidateCache('global'); _invalidateCache(req.user.id)
  res.json({ deleted: toDelete.length, threshold, deletedHives: toDelete, message: `Deleted ${toDelete.length} hive(s) with online < ${threshold}` })
})

router.post('/:id/cleanup', async (req:any, res)=>{
  const fb = await Firebase.findOne({_id:req.params.id}).lean() as any
  if(!fb) return res.status(404).json({ error: 'Hive not found' })
  if(!assertOwnerFb(fb, req)) return res.status(403).json({ error:'Not yours' })
  const threshold = req.body?.threshold ? parseInt(req.body.threshold,10) : null
  // AUDIT FIX: count online+busy as online (was only online, busy devices missed -> 0 online bug)
  const online = await Device.countDocuments({firebase_id:fb._id, status:{$in:['online','busy']}})
  const total = await Device.countDocuments({firebase_id:fb._id})
  if(threshold!==null && online >= threshold){
    return res.json({ ok:false, online, total, threshold, message: `Skipped — hive has ${online} online >= ${threshold}, not cleaning` })
  }
  if(threshold!==null && online < threshold){
    await Device.deleteMany({firebase_id:fb._id})
    await Firebase.deleteOne({_id:fb._id})
    _invalidateCache('global')
    _invalidateCache(req.user.id)
    return res.json({ ok:true, deletedHive:true, online, total, threshold, message: `Hive deleted — had ${online} online < ${threshold}` })
  }
  const del = await Device.deleteMany({firebase_id:fb._id, status:{$nin:['online','busy']}})
  res.json({ ok:true, deletedOffline: del.deletedCount, online, total, message: `Cleaned ${del.deletedCount} offline devices, kept ${online} online` })
})

export default router
