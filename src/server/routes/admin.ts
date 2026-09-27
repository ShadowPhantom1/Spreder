import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { db, useMongo } from '../db/index.js'
import { authRequired, superRequired } from '../middleware/auth.js'
import mongoose from 'mongoose'

const r = Router()
r.use(authRequired, superRequired)

// list all users + stats — fully Mongo
r.get('/users', async (req,res)=>{
  let users:any[]=[]
  if(useMongo){
    const User=mongoose.model('User')
    const docs=await User.find().sort({created_at:-1}).lean() as any
    users=docs.map((d:any)=>({ ...d, id:d._id, _id:d._id }))
  } else {
    users = db.prepare('SELECT id, username, role, is_super, is_active, allowed_ip, allowed_device, per_sim_limit, max_devices, expires_at, created_at FROM users ORDER BY created_at DESC').all() as any[]
  }
  const enriched = users.map((u:any)=>{
    const dev = db.prepare("SELECT COUNT(*) as c FROM devices WHERE status='online'").get() as any
    const camps = db.prepare('SELECT COUNT(*) as c FROM campaigns').get() as any
    const sess = db.prepare('SELECT ip, device_id, last_active FROM sessions WHERE user_id=?').get(u.id) as any
    return {...u, devices: dev.c, campaigns: camps.c, session: sess||null}
  })
  res.json(enriched)
})

// create user — fully Mongo
r.post('/users', async (req,res)=>{
  const { username, password, per_sim_limit=100, max_devices=100, allowed_ip='', expires_at } = req.body
  if(!username || !password) return res.status(400).json({error:'username/password required'})
  if(useMongo){
    const User=mongoose.model('User')
    const exists=await User.findOne({username}).lean()
    if(exists) return res.status(400).json({error:'exists'})
    const id=randomUUID()
    const hash=await bcrypt.hash(password,10)
    const now=new Date().toISOString()
    await User.create({_id:id, username, password_hash:hash, role:'user', is_super:0, is_active:1, allowed_ip:allowed_ip||null, allowed_device:null, per_sim_limit, max_devices, expires_at:expires_at||null, created_at:now})
    return res.json({id, username})
  } else {
    if(db.prepare('SELECT id FROM users WHERE username=?').get(username)) return res.status(400).json({error:'exists'})
    const id=randomUUID()
    const hash=await bcrypt.hash(password,10)
    const now=new Date().toISOString()
    db.prepare('INSERT INTO users (id, username, password_hash, role, is_super, is_active, allowed_ip, per_sim_limit, max_devices, expires_at, created_at) VALUES (?,?,?,?,0,1,?,?,?,?,?)').run(id, username, hash, 'user', allowed_ip||null, per_sim_limit, max_devices, expires_at||null, now)
    return res.json({id, username})
  }
})

// edit user (limit, ip, expiry) — fully Mongo
r.put('/users/:id', async (req,res)=>{
  const { per_sim_limit, max_devices, allowed_ip, expires_at } = req.body
  if(useMongo){
    const User=mongoose.model('User')
    const u=await User.findOne({_id:req.params.id}).lean() as any
    if(!u) return res.status(404).json({error:'not found'})
    const upd:any={}
    if(per_sim_limit!=null) upd.per_sim_limit=per_sim_limit
    if(max_devices!=null) upd.max_devices=max_devices
    if(allowed_ip!==undefined) upd.allowed_ip=allowed_ip
    if(expires_at!==undefined) upd.expires_at=expires_at
    await User.updateOne({_id:req.params.id}, {$set:upd})
    return res.json({ok:true})
  } else {
    const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id) as any
    if(!u) return res.status(404).json({error:'not found'})
    db.prepare('UPDATE users SET per_sim_limit=COALESCE(?,per_sim_limit), max_devices=COALESCE(?,max_devices), allowed_ip=COALESCE(?,allowed_ip), expires_at=COALESCE(?,expires_at) WHERE id=?').run(per_sim_limit??null, max_devices??null, allowed_ip??null, expires_at??null, req.params.id)
    return res.json({ok:true})
  }
})

// disable/enable — fully Mongo
r.post('/users/:id/disable', async (req,res)=>{
  if(useMongo){
    const User=mongoose.model('User')
    await User.updateOne({_id:req.params.id}, {$set:{is_active:0}})
  } else {
    db.prepare('UPDATE users SET is_active=0 WHERE id=?').run(req.params.id)
  }
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.params.id)
  res.json({ok:true})
})
r.post('/users/:id/enable', async (req,res)=>{
  if(useMongo){
    const User=mongoose.model('User')
    await User.updateOne({_id:req.params.id}, {$set:{is_active:1}})
  } else {
    db.prepare('UPDATE users SET is_active=1 WHERE id=?').run(req.params.id)
  }
  res.json({ok:true})
})
// kill session (force logout)
r.post('/users/:id/kick', (req,res)=>{
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.params.id)
  res.json({ok:true})
})
// reset device/IP lock (for first-login lock) — fully Mongo
r.post('/users/:id/reset-lock', async (req,res)=>{
  if(useMongo){
    const User=mongoose.model('User')
    await User.updateOne({_id:req.params.id}, {$set:{allowed_ip:null, allowed_device:null}})
  } else {
    db.prepare('UPDATE users SET allowed_ip=NULL, allowed_device=NULL WHERE id=?').run(req.params.id)
  }
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.params.id)
  res.json({ok:true, msg:'Lock reset — next login will lock to new device/IP'})
})
// delete user + wipe data — fully Mongo
r.delete('/users/:id', async (req,res)=>{
  const id=req.params.id
  if(useMongo){
    const User=mongoose.model('User')
    const u=await User.findOne({_id:id}).lean() as any
    if(u?.is_super===1) return res.status(403).json({error:'cannot delete super'})
    await User.deleteOne({_id:id})
  } else {
    const u=db.prepare('SELECT is_super FROM users WHERE id=?').get(id) as any
    if(u?.is_super===1) return res.status(403).json({error:'cannot delete super'})
    db.prepare('DELETE FROM users WHERE id=?').run(id)
  }
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(id)
  res.json({ok:true})
})

// storage clean for a user (or global for now)
r.post('/storage/clean', (req,res)=>{
  const { userId, days=3 } = req.body
  const cutoff=new Date(Date.now()-days*24*60*60*1000).toISOString()
  let deleted=0
  const toDel=db.prepare("SELECT id FROM campaigns WHERE status='completed' AND finished_at < ?").all(cutoff) as any[]
  const txn=db.transaction(()=>{
    for(const r of toDel){
      db.prepare('DELETE FROM queue_items WHERE campaign_id=?').run(r.id)
      db.prepare('DELETE FROM campaign_messages WHERE campaign_id=?').run(r.id)
      db.prepare('DELETE FROM campaigns WHERE id=?').run(r.id)
      deleted++
    }
  })
  txn()
  res.json({deleted, cutoff})
})

export default r
