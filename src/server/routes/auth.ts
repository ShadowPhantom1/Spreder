import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Session } from '../db/index.js'
import { config } from '../config/index.js'
import mongoose from 'mongoose'

const router = Router()

async function getUserByUsername(username:string){
  const User=mongoose.model('User')
  const d=await User.findOne({username}).lean() as any
  if(d) return {...d, id:d._id}
  return null
}
async function getUserById(id:string){
  const User=mongoose.model('User')
  const d=await User.findOne({_id:id}).lean() as any
  if(d) return {...d, id:d._id}
  return null
}

router.post('/login', async (req, res) => {
  try{
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username & password required' })
  const user = await getUserByUsername(username) as any
  if (!user) return res.status(401).json({ error: 'Invalid credentials — wrong web!' })
  if(user.is_active===0) return res.status(403).json({ error: 'Account disabled by Admin' })
  if(user.expires_at && new Date(user.expires_at) < new Date()) return res.status(403).json({ error: 'Account expired' })
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials — wrong web!' })
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, is_super: user.is_super }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRY } as any)
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV==='production', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' })
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, is_super: user.is_super } })
  await Session.deleteOne({_id: user.id} as any).catch(()=>{})
  await Session.deleteOne({user_id: user.id} as any).catch(()=>{})
  await Session.create({_id: user.id, user_id: user.id, ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '', device_id: (req.headers['x-device-id'] as string) || 'web', token, last_active: new Date().toISOString()} as any).catch(()=>{})
  }catch(e:any){ res.status(500).json({error:e.message})}
})

router.post('/logout', async (req:any, res) => {
  try{
    const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null)
    if(token){
      const p:any = jwt.verify(token, config.JWT_SECRET)
      await Session.deleteOne({_id: p.id} as any).catch(()=>{})
      await Session.deleteOne({user_id: p.id} as any).catch(()=>{})
    }
  }catch{}
  res.clearCookie('token', { path: '/' })
  res.json({ ok: true })
})

router.get('/me', async (req: any, res) => {
  const raw = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null)
  const token = raw as string
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as any
    const u = await getUserById(payload.id) as any
    res.json({ user: {...payload, is_super: u?.is_super||0, is_active: u?.is_active} })
  } catch { res.status(401).json({ error: 'Invalid' }) }
})

export default router
