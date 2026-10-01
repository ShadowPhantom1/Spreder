import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { User } from '../db/index.js'

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
      // User from db/index
      const d=await User.findOne({_id:payload.id}).lean() as any
      if(d) u={...d, id:d._id}
      if(u) _userCache.set(cacheKey,{u, exp:Date.now()+10000})
    }
    if(!u) return res.status(401).json({ error: 'User not found' })
    if(u.is_active===0) return res.status(403).json({ error: 'Account disabled by Admin' })
    if(u.expires_at && new Date(u.expires_at) < new Date()) return res.status(403).json({ error: 'Account expired' })
    // AUDIT FIX: single-device lock removed (user wants kahi se bhi login, 1 ID 2 devices allow). Was causing 401 'Logged in elsewhere' after login due to stale 10s cache + blocking.
    // Session check disabled for multi-device — only verify user exists/active, not token match.
    // Keep session creation for audit but don't block on token mismatch.
    req.user = { ...payload, is_super: u.is_super } as any
    next()
  } catch(e:any) {
    return res.status(401).json({ error: 'Session expired — please login again.' })
  }
}
export function clearSessionCache(id:string){ _userCache.delete(id); _sessCache.delete(id) }
export function superRequired(req: AuthedRequest, res: Response, next: NextFunction){
  const u = (req as any).user as any
  if(!u || u.is_super!==1) return res.status(403).json({ error: 'Super admin only' })
  next()
}
