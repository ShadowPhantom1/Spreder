import { Router } from 'express'
import { randomUUID } from 'crypto'
import { db } from '../db/index.js'
import { authRequired } from '../middleware/auth.js'
import * as firebaseService from '../services/firebaseService.js'

const router = Router()
router.use(authRequired as any)

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u.trim())
    let host = url.host.toLowerCase()
    let path = url.pathname.replace(/\/+$/, '').replace(/\.json$/i,'')
    // strip known RTDB subpaths if present
    path = path.replace(/\/(devices|queue|clients|hives).*$/i,'')
    if(path==='/') path=''
    return `${url.protocol}//${host}${path}`.toLowerCase()
  } catch { return u.trim().toLowerCase().replace(/\/+$/,'').replace(/\.json$/i,'') }
}

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM firebases ORDER BY created_at DESC').all() as any[]
  // attach online count per firebase for UI
  const onlineMap = new Map<string, number>()
  try {
    const counts = db.prepare("SELECT firebase_id, COUNT(*) as c FROM devices WHERE status='online' GROUP BY firebase_id").all() as any[]
    counts.forEach(r=> onlineMap.set(r.firebase_id, r.c))
  } catch {}
  const enriched = rows.map(r=> ({...r, online_count: onlineMap.get(r.id) ?? 0 }))
  res.json(enriched)
})

router.post('/', (req, res) => {
  const { name, database_url, service_account_json } = req.body || {}
  if (!name || !database_url) return res.status(400).json({ error: 'name & database_url required' })
  try { new URL(database_url) } catch { return res.status(400).json({ error: 'Invalid database_url' }) }
  const norm = normalizeUrl(database_url)
  const existing = db.prepare('SELECT * FROM firebases').all() as any[]
  const dup = existing.find(f=> normalizeUrl(f.database_url)===norm)
  if(dup) return res.status(409).json({ error: `Duplicate hive — already exists as "${dup.name}"`, duplicateId: dup.id })
  const id = randomUUID()
  db.prepare('INSERT INTO firebases (id, name, database_url, service_account_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, name, database_url, service_account_json ? JSON.stringify(service_account_json) : null, 'unknown', new Date().toISOString()
  )
  res.status(201).json(db.prepare('SELECT * FROM firebases WHERE id=?').get(id))
})

router.put('/:id', (req, res) => {
  const { name, database_url, service_account_json } = req.body || {}
  const existing = db.prepare('SELECT * FROM firebases WHERE id=?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ error: 'Not found' })
  db.prepare('UPDATE firebases SET name=?, database_url=?, service_account_json=? WHERE id=?').run(
    name || existing.name, database_url || existing.database_url, service_account_json ? JSON.stringify(service_account_json) : existing.service_account_json, req.params.id
  )
  res.json(db.prepare('SELECT * FROM firebases WHERE id=?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  const fid=req.params.id
  db.prepare('UPDATE campaign_messages SET firebase_id=NULL WHERE firebase_id=?').run(fid)
  db.prepare('DELETE FROM devices WHERE firebase_id=?').run(fid)
  db.prepare('DELETE FROM firebases WHERE id=?').run(fid)
  res.json({ ok: true })
})

router.post('/:id/test', async (req, res) => {
  const fb = db.prepare('SELECT * FROM firebases WHERE id=?').get(req.params.id) as any
  if (!fb) return res.status(404).json({ error: 'Not found' })
  const result = await firebaseService.testConnection(fb)
  db.prepare('UPDATE firebases SET status=?, last_tested_at=? WHERE id=?').run(result.ok ? 'online' : 'offline', new Date().toISOString(), fb.id)
  res.json(result)
})

router.post('/:id/seed', async (req, res) => {
  const fb = db.prepare('SELECT * FROM firebases WHERE id=?').get(req.params.id) as any
  if (!fb) return res.status(404).json({ error: 'Not found' })
  const r = await firebaseService.seedDevicesIfEmpty(fb)
  res.json(r)
})

router.post('/bulk', (req, res) => {
  const { items } = req.body || {}
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' })
  const out: any[] = []
  let skippedDuplicates = 0
  let autoNamed = 0
  const existing = db.prepare('SELECT database_url FROM firebases').all() as any[]
  const existingNorms = new Set(existing.map(f=> normalizeUrl(f.database_url)))
  const seenInBatch = new Set<string>()
  const stmt = db.prepare('INSERT INTO firebases (id, name, database_url, status, created_at) VALUES (?, ?, ?, ?, ?)')
  const txn = db.transaction(() => {
    for (const raw of items) {
      let name: string | null = null
      let url: string | null = null
      if(typeof raw === 'string'){
        url = raw.trim()
      } else if(raw && typeof raw === 'object'){
        name = (raw.name || '').toString().trim() || null
        url = (raw.database_url || raw.url || '').toString().trim() || null
        // if line was "url" only but split logic gave name=url, handle
        if(!url && name && name.startsWith('http')){ url = name; name = null }
      }
      if(!url) continue
      // auto-generate name if missing
      if(!name){
        try{
          const u = new URL(url)
          const host = u.hostname
          const m = host.match(/^([a-z0-9-]+?)(?:-default-rtdb)?\.firebaseio\.com$/i)
          name = m ? m[1] : host.split('.')[0]
          name = name || `Hive-${Math.random().toString(36).slice(2,4)}`
          autoNamed++
        } catch { name = `Hive-${Math.random().toString(36).slice(2,4)}`; autoNamed++ }
      }
      const norm = normalizeUrl(url)
      if(existingNorms.has(norm) || seenInBatch.has(norm)){ skippedDuplicates++; continue }
      try{ new URL(url)} catch{ continue }
      seenInBatch.add(norm)
      existingNorms.add(norm)
      const id = randomUUID()
      stmt.run(id, name, url, 'unknown', new Date().toISOString())
      out.push(db.prepare('SELECT * FROM firebases WHERE id=?').get(id))
    }
  })
  txn()
  res.status(201).json({ imported: out.length, skippedDuplicates, autoNamed, firebases: out })
})

// Prevent duplicate check endpoint
router.get('/check-duplicate', (req, res)=>{
  const url = (req.query.url as string) || ''
  if(!url) return res.json({ duplicate:false })
  const norm = normalizeUrl(url)
  const existing = db.prepare('SELECT * FROM firebases').all() as any[]
  const dup = existing.find(f=> normalizeUrl(f.database_url)===norm)
  res.json({ duplicate: !!dup, duplicateHive: dup || null, normalized: norm })
})

// Cleanup: delete hives where online < threshold (and their devices)
// Body: { threshold: number } e.g., 10 => any hive with online <10 gets deleted
router.post('/cleanup-low-online', (req, res)=>{
  let threshold = Math.max(0, parseInt((req.body?.threshold ?? req.query.threshold) as string,10) || 0)
  if(threshold<0) return res.status(400).json({ error: 'threshold must be >=0' })
  const firebases = db.prepare('SELECT id, name FROM firebases').all() as any[]
  const onlineCounts = db.prepare("SELECT firebase_id, COUNT(*) as c FROM devices WHERE status='online' GROUP BY firebase_id").all() as any[]
  const map = new Map<string,number>(onlineCounts.map((r:any)=>[r.firebase_id, r.c]))
  const toDelete: any[] = []
  for(const fb of firebases){
    const online = map.get(fb.id) ?? 0
    if(online < threshold) toDelete.push({...fb, online})
  }
  if(toDelete.length===0) return res.json({ deleted:0, threshold, message: `All hives have >=${threshold} online — nothing to clean`, checked: firebases.length })
  const delFb = db.prepare('DELETE FROM firebases WHERE id=?')
  const delDev = db.prepare('DELETE FROM devices WHERE firebase_id=?')
  const txn = db.transaction(()=>{
    for(const fb of toDelete){
      delDev.run(fb.id)
      delFb.run(fb.id)
    }
  })
  txn()
  res.json({ deleted: toDelete.length, threshold, deletedHives: toDelete, message: `Deleted ${toDelete.length} hive(s) with online < ${threshold}` })
})

// Per-hive cleanup: delete offline devices for that hive, optionally delete hive if online < threshold
router.post('/:id/cleanup', (req, res)=>{
  const fb = db.prepare('SELECT * FROM firebases WHERE id=?').get(req.params.id) as any
  if(!fb) return res.status(404).json({ error: 'Hive not found' })
  const threshold = req.body?.threshold ? parseInt(req.body.threshold,10) : null
  const online = (db.prepare("SELECT COUNT(*) as c FROM devices WHERE firebase_id=? AND status='online'").get(fb.id) as any).c
  const total = (db.prepare("SELECT COUNT(*) as c FROM devices WHERE firebase_id=?").get(fb.id) as any).c
  const offline = total - online
  if(threshold!==null && online >= threshold){
    return res.json({ ok:false, online, total, threshold, message: `Skipped — hive has ${online} online >= ${threshold}, not cleaning` })
  }
  if(threshold!==null && online < threshold){
    // delete hive + all devices
    db.prepare('DELETE FROM devices WHERE firebase_id=?').run(fb.id)
    db.prepare('DELETE FROM firebases WHERE id=?').run(fb.id)
    return res.json({ ok:true, deletedHive:true, online, total, threshold, message: `Hive deleted — had ${online} online < ${threshold}` })
  }
  // default: delete only offline devices
  const del = db.prepare("DELETE FROM devices WHERE firebase_id=? AND status!='online'").run(fb.id)
  res.json({ ok:true, deletedOffline: del.changes, online, total, message: `Cleaned ${del.changes} offline devices, kept ${online} online` })
})

export default router
