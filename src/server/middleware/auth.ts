import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import mongoose from 'mongoose'

export interface AuthedRequest extends Request {
  user?: { id: string; username: string; role: string; is_super?: number }
}

const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true'
const _userCache = new Map<string,{u:any, exp:number}>()
const _sessCache = new Map<string,{tok:string|null, exp:number}>()

export async function authRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  if (DISABLE_AUTH) {
    req.user = { id: 'open-mode', username: 'admin', role: 'admin', is_super: 1 } as any
    return next()
  }
  const token = (req.cookies as any)?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null) || (req.query as any)?.token
  if (!token) return res.status(401).json({ error: 'Unauthorized — thwip! Login required.' })
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as any
    const cacheKey = payload.id
    let u:any = _userCache.get(cacheKey)?.u
    if(!u || Date.now() > (_userCache.get(cacheKey)?.exp||0)){
      const User=mongoose.model('User')
      const d=await User.findOne({_id:payload.id}).lean() as any
      if(d) u={...d, id:d._id}
      if(u) _userCache.set(cacheKey,{u, exp:Date.now()+10000})
    }
    if(!u) return res.status(401).json({ error: 'User not found' })
    if(u.is_active===0) return res.status(403).json({ error: 'Account disabled by Admin' })
    if(u.expires_at && new Date(u.expires_at) < new Date()) return res.status(403).json({ error: 'Account expired' })
    // device lock removed — fully tenant isolated, kahi se bhi login
    const sessCache = _sessCache.get(cacheKey)
    if(!sessCache || Date.now() > sessCache.exp){
      const {Session} = await import('../db/index.js')
      const sess:any = await Session.findOne({_id: payload.id} as any).lean() || await Session.findOne({user_id: payload.id}).lean()
      _sessCache.set(cacheKey,{tok: sess?.token||null, exp:Date.now()+10000})
      if(sess && sess.token !== token) return res.status(401).json({ error: 'Logged in elsewhere — single device only' })
    } else {
      if(sessCache.tok && sessCache.tok !== token) return res.status(401).json({ error: 'Logged in elsewhere — single device only' })
    }
    req.user = { ...payload, is_super: u.is_super } as any
    next()
  } catch(e:any) {
    return res.status(401).json({ error: 'Session expired — please login again.' })
  }
}
export function superRequired(req: AuthedRequest, res: Response, next: NextFunction){
  const u = (req as any).user as any
  if(!u || u.is_super!==1) return res.status(403).json({ error: 'Super admin only' })
  next()
}
