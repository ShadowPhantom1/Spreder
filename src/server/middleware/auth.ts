import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { db, useMongo } from '../db/index.js'
import mongoose from 'mongoose'

export interface AuthedRequest extends Request {
  user?: { id: string; username: string; role: string }
}

const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true'

export async function authRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  if (DISABLE_AUTH) {
    req.user = { id: 'open-mode', username: 'admin', role: 'admin' } as any
    return next()
  }
  const token = (req.cookies as any)?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null) || (req.query as any)?.token || (req.query as any)?.auth
  if (!token) return res.status(401).json({ error: 'Unauthorized — thwip! Login required.' })
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as any
    let u:any
    if(useMongo){
      const User=mongoose.model('User')
      const d=await User.findOne({_id:payload.id}).lean() as any
      if(d) u={...d, id:d._id}
    } else {
      u = db.prepare('SELECT id, username, role, is_active, is_super, allowed_ip, allowed_device, expires_at FROM users WHERE id=?').get(payload.id) as any
    }
    if(!u) return res.status(401).json({ error: 'User not found' })
    if(u.is_active===0) return res.status(403).json({ error: 'Account disabled by Admin' })
    if(u.expires_at && new Date(u.expires_at) < new Date()) return res.status(403).json({ error: 'Account expired' })
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || ''
    const devId = (req.headers['x-device-id'] as string) || req.headers['user-agent']?.slice(0,80) || ''
    if(u.allowed_ip && u.allowed_ip!=='*' && u.allowed_ip!=='' ){
      if(u.allowed_ip.includes('/')){
        const [base]=u.allowed_ip.split('/')
        if(!ip.startsWith(base.slice(0, base.lastIndexOf('.')))) return res.status(403).json({ error: 'IP not allowed' })
      } else if(ip!==u.allowed_ip && u.allowed_ip!=='' ) {
        if(!ip.includes('127.0.0.1') && ip!=='' ) return res.status(403).json({ error: `IP not allowed (${ip})` })
      }
    }
    if(u.allowed_device && u.allowed_device!=='*' && u.allowed_device!==''){
      if(devId !== u.allowed_device) return res.status(403).json({ error: 'Device not allowed — first device only' })
    }
    // FULLY MONGO sessions — also keep sqlite dummy for legacy
    try{
      const {Session} = await import('../db/index.js')
      const sess:any = await Session.findOne({_id: payload.id} as any).lean() || await Session.findOne({user_id: payload.id}).lean()
      if(sess && sess.token !== token) return res.status(401).json({ error: 'Logged in elsewhere — single device only' })
    }catch{
      const sess = db.prepare('SELECT token FROM sessions WHERE user_id=?').get(payload.id) as any
      if(sess && sess.token !== token) return res.status(401).json({ error: 'Logged in elsewhere — single device only' })
    }
    req.user = { ...payload, is_super: u.is_super, allowed_ip: u.allowed_ip, allowed_device: u.allowed_device } as any
    next()
  } catch(e:any) {
    if(e.message?.includes('disabled')||e.message?.includes('expired')||e.message?.includes('IP')) throw e
    return res.status(401).json({ error: 'Invalid token — web snapped.' })
  }
}
export function superRequired(req: AuthedRequest, res: Response, next: NextFunction){
  const u = (req as any).user as any
  if(!u || u.is_super!==1) return res.status(403).json({ error: 'Super admin only' })
  next()
}
