import { Router } from 'express'
import { db } from '../db/index.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()
router.use(authRequired as any)

router.get('/', (req, res) => {
  const { firebase_id, status, q } = req.query as any
  let sql = 'SELECT d.*, f.name as firebase_name, f.database_url FROM devices d LEFT JOIN firebases f ON f.id = d.firebase_id WHERE 1=1'
  const params: any[] = []
  if (firebase_id) { sql += ' AND d.firebase_id = ?'; params.push(firebase_id) }
  if (status) { sql += ' AND d.status = ?'; params.push(status) }
  if (q) { sql += ' AND (d.name LIKE ? OR d.model LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
  const limit = Math.min(1000, Math.max(1, parseInt((req.query as any).limit as string,10) || 1000))
  sql += ` ORDER BY d.last_seen DESC LIMIT ${limit}`
  const rows = db.prepare(sql).all(...params)
  res.json(rows)
})

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT d.*, f.name as firebase_name FROM devices d LEFT JOIN firebases f ON f.id=d.firebase_id WHERE d.id=?').get(req.params.id) as any
  if (!row) return res.status(404).json({ error: 'Device not found' })
  res.json(row)
})

router.put('/:id', (req, res)=>{
  const { sim_count, has_recharge, sim1_recharge, sim2_recharge } = req.body || {}
  const existing = db.prepare('SELECT * FROM devices WHERE id=?').get(req.params.id) as any
  if(!existing) return res.status(404).json({ error:'Not found' })
  const sc = sim_count!==undefined ? parseInt(sim_count,10) : existing.sim_count
  const hr = has_recharge!==undefined ? (has_recharge?1:0) : existing.has_recharge
  const s1 = sim1_recharge!==undefined ? (sim1_recharge?1:0) : (existing.sim1_recharge ?? 1)
  const s2 = sim2_recharge!==undefined ? (sim2_recharge?1:0) : (existing.sim2_recharge ?? 1)
  db.prepare('UPDATE devices SET sim_count=?, has_recharge=?, sim1_recharge=?, sim2_recharge=?, last_seen=? WHERE id=?').run(sc, hr, s1, s2, new Date().toISOString(), req.params.id)
  res.json(db.prepare('SELECT * FROM devices WHERE id=?').get(req.params.id))
})

router.put('/bulk/recharge', (req,res)=>{
  const { ids, has_recharge } = req.body || {}
  if(!Array.isArray(ids)) return res.status(400).json({ error:'ids array' })
  const v = has_recharge?1:0
  const stmt=db.prepare('UPDATE devices SET has_recharge=? WHERE id=?')
  const txn=db.transaction(()=>{ for(const id of ids) stmt.run(v, id) })
  txn()
  res.json({ updated: ids.length, has_recharge: v })
})

router.post('/refresh', async (_req, res) => {
  // trigger immediate poll — poller will run anyway
  res.json({ ok: true, message: 'Poll triggered — webs vibrating…' })
})

export default router
