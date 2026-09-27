import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db, useMongo, Session } from '../db/index.js'
import { config } from '../config/index.js'
import mongoose from 'mongoose'

const router = Router()

async function getUserByUsername(username:string){
  if(useMongo){
    const User=mongoose.model('User')
    const d=await User.findOne({_id: {$exists:true}, username} as any).lean() as any
    if(d) return {...d, id:d._id}
    return null
  }
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any
}
async function getUserById(id:string){
  if(useMongo){
    const User=mongoose.model('User')
    const d=await User.findOne({_id:id}).lean() as any
    if(d) return {...d, id:d._id}
    return null
  }
  return db.prepare('SELECT * FROM users WHERE id=?').get(id) as any
}
async function updateUserLock(id:string, ip:string, deviceId:string){
  if(useMongo){
    const User=mongoose.model('User')
    await User.updateOne({_id:id}, {$set:{allowed_device:deviceId}, $unset:{allowed_ip:""}} as any)
  } else {
    // SQLite: keep column for compat but null it (fully Mongo now, SQLite is in-memory dummy)
    try{ db.prepare('UPDATE users SET allowed_device=? , allowed_ip=NULL WHERE id=?').run(deviceId, id) }catch{}
  }
}

router.post('/login', async (req, res) => {
  try{
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username & password required' })
  const user = await getUserByUsername(username) as any
  if (!user) return res.status(401).json({ error: 'Invalid credentials — wrong web!' })
  if(user.is_active===0) return res.status(403).json({ error: 'Account disabled by Admin' })
  if(user.expires_at && new Date(user.expires_at) < new Date()) return res.status(403).json({ error: 'Account expired' })
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || ''
  const deviceId = (req.headers['x-device-id'] as string) || req.headers['user-agent']?.slice(0,80) || 'web'
  // FIRST LOGIN auto-lock: only device lock, IP system removed — kahi se bhi login
  if(!user.allowed_device || user.allowed_device===''){
    if(user.is_super!==1){
      await updateUserLock(user.id, ip, deviceId)
      user.allowed_device = deviceId
      console.log(`[Auth] First login device lock ${user.username} → Device ${deviceId.slice(0,20)}`)
    }
  } else {
    if(user.allowed_device && user.allowed_device!=='*' && user.allowed_device!==''){
      if(deviceId !== user.allowed_device) return res.status(403).json({ error: `Device not allowed` })
    }
  }
  const ok = bcrypt.compareSync(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials — wrong web!' })
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, is_super: user.is_super }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRY } as any)
  // FULLY MONGO sessions
  try{
    await Session.deleteOne({_id: user.id} as any)
    await Session.deleteOne({user_id: user.id} as any)
    await Session.create({_id: user.id, user_id: user.id, ip, device_id: deviceId, token, last_active: new Date().toISOString()} as any)
  }catch{}
  try{ db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id); db.prepare('INSERT INTO sessions (user_id, ip, device_id, token, last_active) VALUES (?,?,?,?,?)').run(user.id, ip, deviceId, token, new Date().toISOString()) }catch{}
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' })
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, is_super: user.is_super } })
  }catch(e:any){ console.error('[login] err',e); res.status(500).json({error:e.message})}
})

router.post('/logout', async (req:any, res) => {
  try{
    const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null)
    if(token){
      const p:any = jwt.verify(token, config.JWT_SECRET)
      try{ await Session.deleteOne({_id: p.id} as any); await Session.deleteOne({user_id: p.id} as any) }catch{}
      try{ db.prepare('DELETE FROM sessions WHERE user_id=?').run(p.id) }catch{}
    }
  }catch{}
  res.clearCookie('token', { path: '/' })
  res.json({ ok: true })
})

router.get('/me', async (req: any, res) => {
  const raw = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : req.headers.authorization?.slice(7))
  const token = raw as string
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as any
    const u = await getUserById(payload.id) as any
    res.json({ user: {...payload, is_super: u?.is_super||0, is_active: u?.is_active} })
  } catch { res.status(401).json({ error: 'Invalid' }) }
})

export default router
