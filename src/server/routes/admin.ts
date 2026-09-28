import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { authRequired, superRequired } from '../middleware/auth.js'
import mongoose from 'mongoose'

const r = Router()
r.use(authRequired, superRequired)

r.get('/users', async (_req,res)=>{
  try{
    const User=mongoose.model('User')
    const docs=await User.find().sort({created_at:-1}).lean() as any
    const users=docs.map((d:any)=>({ ...d, id:d._id, _id:d._id }))
    const enriched = users.map((u:any)=> ({...u, devices: 0, campaigns: 0, session: null}))
    res.json(enriched)
  }catch(e:any){ res.status(500).json({error:e.message})}
})

r.post('/users', async (req,res)=>{
  const { username, password, per_sim_limit=100, max_devices=100, expires_at } = req.body
  if(!username || !password) return res.status(400).json({error:'username/password required'})
  if(String(password).length < 8) return res.status(400).json({error:'password min 8 chars'})
  const User=mongoose.model('User')
  const exists=await User.findOne({username}).lean()
  if(exists) return res.status(400).json({error:'exists'})
  const id=randomUUID()
  const hash=await bcrypt.hash(password,10)
  const now=new Date().toISOString()
  await User.create({_id:id, username, password_hash:hash, role:'user', is_super:0, is_active:1, allowed_device:null, per_sim_limit, max_devices, expires_at:expires_at||null, created_at:now} as any)
  return res.json({id, username})
})

r.put('/users/:id', async (req,res)=>{
  const { per_sim_limit, max_devices, expires_at } = req.body
  const User=mongoose.model('User')
  const u=await User.findOne({_id:req.params.id}).lean() as any
  if(!u) return res.status(404).json({error:'not found'})
  const upd:any={}
  if(per_sim_limit!=null) upd.per_sim_limit=per_sim_limit
  if(max_devices!=null) upd.max_devices=max_devices
  if(expires_at!==undefined) upd.expires_at=expires_at
  await User.updateOne({_id:req.params.id}, {$set:upd})
  return res.json({ok:true})
})

r.post('/users/:id/disable', async (req,res)=>{
  const User=mongoose.model('User')
  await User.updateOne({_id:req.params.id}, {$set:{is_active:0}})
  const {Session} = await import('../db/index.js')
  await Session.deleteOne({_id:req.params.id} as any).catch(()=>{})
  await Session.deleteOne({user_id:req.params.id} as any).catch(()=>{})
  res.json({ok:true})
})
r.post('/users/:id/enable', async (req,res)=>{
  const User=mongoose.model('User')
  await User.updateOne({_id:req.params.id}, {$set:{is_active:1}})
  res.json({ok:true})
})
r.post('/users/:id/kick', async (req,res)=>{
  const {Session} = await import('../db/index.js')
  await Session.deleteOne({_id:req.params.id} as any).catch(()=>{})
  await Session.deleteOne({user_id:req.params.id} as any).catch(()=>{})
  res.json({ok:true})
})
r.post('/users/:id/reset-lock', async (req,res)=>{
  const User=mongoose.model('User')
  await User.updateOne({_id:req.params.id}, {$set:{allowed_device:null}})
  const {Session} = await import('../db/index.js')
  await Session.deleteOne({_id:req.params.id} as any).catch(()=>{})
  await Session.deleteOne({user_id:req.params.id} as any).catch(()=>{})
  res.json({ok:true, msg:'Lock reset — next login will succeed from any device'})
})
r.delete('/users/:id', async (req,res)=>{
  const id=req.params.id
  const User=mongoose.model('User')
  const u=await User.findOne({_id:id}).lean() as any
  if(u?.is_super===1) return res.status(403).json({error:'cannot delete super'})
  await User.deleteOne({_id:id})
  const {Session} = await import('../db/index.js')
  await Session.deleteOne({_id:id} as any).catch(()=>{})
  await Session.deleteOne({user_id:id} as any).catch(()=>{})
  res.json({ok:true})
})

r.post('/storage/clean', async (req,res)=>{
  const { days=3 } = req.body
  const cutoff=new Date(Date.now()-days*24*60*60*1000).toISOString()
  const {Campaign, CampaignMessage, QueueItem} = await import('../db/index.js')
  const toDel = await Campaign.find({status:'completed', finished_at: {$lt: cutoff}}).lean() as any[]
  let deleted=0
  for(const row of toDel){
    const cid=row._id || row.id
    await QueueItem.deleteMany({campaign_id: cid})
    await CampaignMessage.deleteMany({campaign_id: cid})
    await Campaign.deleteOne({_id: cid})
    deleted++
  }
  return res.json({deleted, cutoff})
})

export default r
