import 'dotenv/config'
import { config } from '../config/index.js'
import mongoose from 'mongoose'
import { getModels } from './mongo.js'

export let useMongo = false

if(!config.MONGODB_URI){
  console.error('[DB] MONGODB_URI required — fully Mongo mode, exiting')
  process.exit(1)
}

// connect — optimized pool + timeouts for fast Atlas
await mongoose.connect(config.MONGODB_URI, {
  maxPoolSize: 20,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 20000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
} as any)
useMongo = true
console.log('[DB] Mongo connected — FULLY Mongo (ALL DATA) | pool 20')

const {User, Firebase, Device, Campaign, CampaignMessage, QueueItem, Setting, Session} = getModels()
export {User, Firebase, Device, Campaign, CampaignMessage, QueueItem, Setting, Session}

// ensure indexes in background (fast queries)
Promise.all([
  User.syncIndexes().catch(()=>{}),
  Firebase.syncIndexes().catch(()=>{}),
  Device.syncIndexes().catch(()=>{}),
  Campaign.syncIndexes().catch(()=>{}),
  CampaignMessage.syncIndexes().catch(()=>{}),
  QueueItem.syncIndexes().catch(()=>{}),
  Session.syncIndexes().catch(()=>{}),
]).then(()=> console.log('[DB] indexes synced')).catch(()=>{})

// keep sqlite db as dummy for legacy imports that still reference db.prepare (will throw if used)
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
const dir = path.dirname(config.DATABASE_PATH)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
export const db = new Database(':memory:')
db.pragma('foreign_keys = OFF')
db.exec(`
CREATE TABLE IF NOT EXISTS sessions (user_id TEXT PRIMARY KEY, ip TEXT, device_id TEXT, token TEXT, last_active TEXT);
CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, firebase_id TEXT, name TEXT, status TEXT, last_seen TEXT);
CREATE TABLE IF NOT EXISTS campaign_messages (id TEXT PRIMARY KEY, campaign_id TEXT, device_id TEXT, status TEXT, sent_at TEXT);
`)
// SQLite dummy removed — fully Mongo (no log)

// seed admin into Mongo
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
const adminExists = await User.findOne({username: config.ADMIN_USER}).lean() as any
if (!adminExists) {
  const hash = bcrypt.hashSync(config.ADMIN_PASS, 10)
  const id=randomUUID()
  await User.create({_id:id, username: config.ADMIN_USER, password_hash:hash, role:'admin', is_super:1, is_active:1, allowed_device:null, per_sim_limit:100, max_devices:100, expires_at:null, created_at:new Date().toISOString()} as any)
  console.log(`[DB] Seeded super admin Mongo: ${config.ADMIN_USER}`)
} else if(adminExists.is_super!==1){
  await User.updateOne({username: config.ADMIN_USER}, {$set:{is_super:1, is_active:1}})
  console.log(`[DB] Upgraded to super admin: ${config.ADMIN_USER}`)
}

// default settings into Mongo
const defaults: Record<string,string> = {
  poll_interval_ms: '500',
  dispatch_batch_size: '50',
  dispatch_delay_ms: '0',
  ack_timeout_ms: '1200',
  web_theme: 'spidey-brand-new-day',
  max_sms_per_device_per_day: '100',
  daily_limit_enabled: 'true',
  auto_delete_completed_after_days: '0',
  speed_profile: 'ultra',
  enable_row_selection: 'true',
  today_start_hour: '0',
}
for(const [k,v] of Object.entries(defaults)){
  const exists=await Setting.findOne({_id:k}).lean()
  if(!exists) await Setting.create({_id:k, key:k, value:v, updated_at:new Date().toISOString()})
}

let settingsCache: Record<string,string> = {}
async function loadCache(){
  try{
    const all=await Setting.find().lean() as any[]
    settingsCache={}
    for(const s of all) settingsCache[s.key]=s.value
  }catch(e:any){ console.log('[DB] loadCache fail',e.message)}
}
loadCache().catch(()=>{})

export function getSetting(key:string){
  return settingsCache[key] || ''
}
export async function setSetting(key:string, value:string){
  settingsCache[key]=value
  await Setting.updateOne({_id:key}, {$set:{key, value, updated_at:new Date().toISOString()}}, {upsert:true})
}

// keep async version for new code
export async function getSettingAsync(key:string){
  const doc=await Setting.findOne({_id:key}).lean() as any
  return doc?.value
}

// dummy helpers for legacy
export async function syncUserToMongo(user:any){ /* no-op, fully Mongo */ }
