import { Router } from 'express'
import { randomUUID } from 'crypto'
import { Firebase, Device } from '../db/index.js'
import { authRequired } from '../middleware/auth.js'
import * as firebaseService from '../services/firebaseService.js'

const router = Router()
router.use(authRequired as any)

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u.trim())
    let host = url.host.toLowerCase()
    let path = url.pathname.replace(/\/+$/, '').replace(/\.json$/i,'')
    path = path.replace(/\/(devices|queue|clients|hives).*$/i,'')
    if(path==='/') path=''
    return `${url.protocol}//${host}${path}`.toLowerCase()
  } catch { return u.trim().toLowerCase().replace(/\/+$/,'').replace(/\.json$/i,'') }
}

let _cache:any=null
let _cacheTs=0
function _invalidateCache(){ _cache=null; _cacheTs=0 }
router.get('/', async (_req, res) => {
  if(_cache && Date.now()-_cacheTs < 10000) return res.json(_cache)
  const rows = await Firebase.find().sort({created_at:-1}).lean() as any[]
  const counts = await Device.aggregate([{$match:{status:'online'}}, {$group:{_id:'$firebase_id', c:{$sum:1}}}]) as any[]
  const onlineMap = new Map<string, number>(counts.map((r:any)=>[r._id, r.c]))
  const enriched = rows.map((r:any)=> ({...r, id:r._id, online_count: onlineMap.get(r._id) ?? 0 }))
  _cache=enriched; _cacheTs=Date.now()
  res.json(enriched)
})

router.post('/', async (req, res) => {
  const { name, database_url, service_account_json } = req.body || {}
  if (!name || !database_url) return res.status(400).json({ error: 'name & database_url required' })
  try { new URL(database_url) } catch { return res.status(400).json({ error: 'Invalid database_url' }) }
  const norm = normalizeUrl(database_url)
  const existing = await Firebase.find().lean() as any[]
  const dup = existing.find((f:any)=> normalizeUrl(f.database_url)===norm)
  if(dup) return res.status(409).json({ error: `Duplicate hive — already exists as "${dup.name}"`, duplicateId: dup._id })
  const id = randomUUID()
  await Firebase.create({_id:id, id, name, database_url, service_account_json: service_account_json ? JSON.stringify(service_account_json) : null, status:'unknown', created_at:new Date().toISOString()})
  _invalidateCache()
  const created = await Firebase.findOne({_id:id}).lean()
  res.status(201).json({...created, id})
})

router.put('/:id', async (req, res) => {
  const { name, database_url, service_account_json } = req.body || {}
  const existing = await Firebase.findOne({_id:req.params.id}).lean() as any
  if (!existing) return res.status(404).json({ error: 'Not found' })
  await Firebase.updateOne({_id:req.params.id}, {$set:{
    name: name || existing.name,
    database_url: database_url || existing.database_url,
    service_account_json: service_account_json ? JSON.stringify(service_account_json) : existing.service_account_json
  }})
  _invalidateCache()
  const updated = await Firebase.findOne({_id:req.params.id}).lean()
  res.json({...updated, id: (updated as any)._id})
})

router.delete('/:id', async (req, res) => {
  const fid=req.params.id
  await Device.deleteMany({firebase_id:fid})
  await Firebase.deleteOne({_id:fid})
  _invalidateCache()
  res.json({ ok: true })
})

router.post('/:id/test', async (req, res) => {
  const fb = await Firebase.findOne({_id:req.params.id}).lean() as any
  if (!fb) return res.status(404).json({ error: 'Not found' })
  const fbForTest={...fb, id:fb._id}
  const result = await firebaseService.testConnection(fbForTest)
  await Firebase.updateOne({_id:fb._id}, {$set:{status: result.ok ? 'online' : 'offline', last_tested_at:new Date().toISOString()}})
  res.json(result)
})

router.post('/:id/seed', async (req, res) => {
  const fb = await Firebase.findOne({_id:req.params.id}).lean() as any
  if (!fb) return res.status(404).json({ error: 'Not found' })
  const r = await firebaseService.seedDevicesIfEmpty({...fb, id:fb._id})
  res.json(r)
})

router.post('/bulk', async (req, res) => {
  const { items } = req.body || {}
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' })
  const out: any[] = []
  let skippedDuplicates = 0
  let autoNamed = 0
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
    await Firebase.create({_id:id, id, name, database_url:url, status:'unknown', created_at:new Date().toISOString()})
    const created=await Firebase.findOne({_id:id}).lean()
    out.push({...created, id})
  }
  if(out.length) _invalidateCache()
  res.status(201).json({ imported: out.length, skippedDuplicates, autoNamed, firebases: out })
})

router.get('/check-duplicate', async (req, res)=>{
  const url = (req.query.url as string) || ''
  if(!url) return res.json({ duplicate:false })
  const norm = normalizeUrl(url)
  const existing = await Firebase.find().lean() as any[]
  const dup = existing.find((f:any)=> normalizeUrl(f.database_url)===norm)
  res.json({ duplicate: !!dup, duplicateHive: dup ? {...dup, id:dup._id} : null, normalized: norm })
})

router.post('/cleanup-low-online', async (req, res)=>{
  let threshold = Math.max(0, parseInt((req.body?.threshold ?? req.query.threshold) as string,10) || 0)
  const firebases = await Firebase.find().lean() as any[]
  const onlineCounts = await Device.aggregate([{$match:{status:'online'}}, {$group:{_id:'$firebase_id', c:{$sum:1}}}]) as any[]
  const map = new Map<string,number>(onlineCounts.map((r:any)=>[r._id, r.c]))
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
  if(toDelete.length) _invalidateCache()
  res.json({ deleted: toDelete.length, threshold, deletedHives: toDelete, message: `Deleted ${toDelete.length} hive(s) with online < ${threshold}` })
})

router.post('/:id/cleanup', async (req, res)=>{
  const fb = await Firebase.findOne({_id:req.params.id}).lean() as any
  if(!fb) return res.status(404).json({ error: 'Hive not found' })
  const threshold = req.body?.threshold ? parseInt(req.body.threshold,10) : null
  const online = await Device.countDocuments({firebase_id:fb._id, status:'online'})
  const total = await Device.countDocuments({firebase_id:fb._id})
  if(threshold!==null && online >= threshold){
    return res.json({ ok:false, online, total, threshold, message: `Skipped — hive has ${online} online >= ${threshold}, not cleaning` })
  }
  if(threshold!==null && online < threshold){
    await Device.deleteMany({firebase_id:fb._id})
    await Firebase.deleteOne({_id:fb._id})
    _invalidateCache()
    return res.json({ ok:true, deletedHive:true, online, total, threshold, message: `Hive deleted — had ${online} online < ${threshold}` })
  }
  const del = await Device.deleteMany({firebase_id:fb._id, status:{$ne:'online'}})
  res.json({ ok:true, deletedOffline: del.deletedCount, online, total, message: `Cleaned ${del.deletedCount} offline devices, kept ${online} online` })
})

export default router
