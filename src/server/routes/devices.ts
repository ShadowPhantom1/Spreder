import { Router } from 'express'
import { Device, Firebase } from '../db/index.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()
router.use(authRequired as any)

router.get('/', async (req, res) => {
  const { firebase_id, status, q } = req.query as any
  const filter:any={}
  if (firebase_id) filter.firebase_id = firebase_id
  if (status) filter.status = status
  if (q) filter.$or=[{name:{$regex:q, $options:'i'}}, {model:{$regex:q, $options:'i'}}]
  const limit = Math.min(1000, Math.max(1, parseInt((req.query as any).limit as string,10) || 1000))
  const rows = await Device.find(filter).sort({last_seen:-1}).limit(limit).lean() as any[]
  const fbMap=new Map<string,any>()
  const fbIds=[...new Set(rows.map((r:any)=>r.firebase_id))]
  if(fbIds.length){
    const fbs=await Firebase.find({_id:{$in:fbIds}}).lean() as any[]
    fbs.forEach((f:any)=> fbMap.set(f._id, f))
  }
  const enriched=rows.map((r:any)=> ({...r, id:r._id, firebase_name: fbMap.get(r.firebase_id)?.name, database_url: fbMap.get(r.firebase_id)?.database_url}))
  res.json(enriched)
})

router.get('/:id', async (req, res) => {
  const row = await Device.findOne({_id:req.params.id}).lean() as any
  if (!row) return res.status(404).json({ error: 'Device not found' })
  const fb=await Firebase.findOne({_id:row.firebase_id}).lean() as any
  res.json({...row, id:row._id, firebase_name: fb?.name})
})

router.put('/:id', async (req, res)=>{
  const { sim_count, has_recharge, sim1_recharge, sim2_recharge } = req.body || {}
  const existing = await Device.findOne({_id:req.params.id}).lean() as any
  if(!existing) return res.status(404).json({ error:'Not found' })
  const sc = sim_count!==undefined ? parseInt(sim_count,10) : existing.sim_count
  const hr = has_recharge!==undefined ? (has_recharge?1:0) : existing.has_recharge
  const s1 = sim1_recharge!==undefined ? (sim1_recharge?1:0) : (existing.sim1_recharge ?? 1)
  const s2 = sim2_recharge!==undefined ? (sim2_recharge?1:0) : (existing.sim2_recharge ?? 1)
  await Device.updateOne({_id:req.params.id}, {$set:{sim_count:sc, has_recharge:hr, sim1_recharge:s1, sim2_recharge:s2, last_seen:new Date().toISOString()}})
  const updated=await Device.findOne({_id:req.params.id}).lean()
  res.json({...updated, id:(updated as any)._id})
})

router.put('/bulk/recharge', async (req,res)=>{
  const { ids, has_recharge } = req.body || {}
  if(!Array.isArray(ids)) return res.status(400).json({ error:'ids array' })
  const v = has_recharge?1:0
  await Device.updateMany({_id:{$in:ids}}, {$set:{has_recharge:v}})
  res.json({ updated: ids.length, has_recharge: v })
})

router.post('/refresh', async (_req, res) => {
  res.json({ ok: true, message: 'Poll triggered — webs vibrating…' })
})

export default router
