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

const {User, Firebase, Device, Campaign, CampaignMessage, QueueItem, Setting, Session, DeviceDailyStat} = getModels()
export {User, Firebase, Device, Campaign, CampaignMessage, QueueItem, Setting, Session, DeviceDailyStat}

// ensure indexes in background (fast queries)
Promise.all([
  User.syncIndexes().catch(()=>{}),
  Firebase.syncIndexes().catch(()=>{}),
  Device.syncIndexes().catch(()=>{}),
  Campaign.syncIndexes().catch(()=>{}),
  CampaignMessage.syncIndexes().catch(()=>{}),
  QueueItem.syncIndexes().catch(()=>{}),
  Session.syncIndexes().catch(()=>{}),
  DeviceDailyStat.syncIndexes().catch(()=>{}),
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

// default settings into Mongo — DEEP AUDIT: 8k campaign needs 8s ack not 5s (5s -> false timeout -> 11 attempts), keep turbo but sane
const defaults: Record<string,string> = {
  poll_interval_ms: '5000',
  dispatch_batch_size: '80',
  dispatch_delay_ms: '0',
  ack_timeout_ms: '8000',
  web_theme: 'spidey-brand-new-day',
  max_sms_per_device_per_day: '100',
  daily_limit_enabled: 'false',
  auto_delete_completed_after_days: '0',
  speed_profile: 'turbo',
  hive_concurrency: '5',
  enable_row_selection: 'true',
  today_start_hour: '0',
}
for(const [k,v] of Object.entries(defaults)){
  const exists=await Setting.findOne({_id:k}).lean()
  if(!exists) await Setting.create({_id:k, key:k, value:v, updated_at:new Date().toISOString()})
}
// MULTI-TENANCY MIGRATION: ensure every doc has owner_id (fully isolated per user)
try{
  const superAdmin = await User.findOne({is_super:1}).lean() as any
  if(superAdmin){
    const owner = superAdmin._id
    const mig = async (model:any, label:string)=>{
      const r = await model.updateMany({$or:[{owner_id:{$exists:false}},{owner_id:null},{owner_id:''}]}, {$set:{owner_id:owner}})
      if((r as any).modifiedCount) console.log(`[DB] migration ${label} -> owner ${String(owner).slice(0,8)} x${(r as any).modifiedCount}`)
    }
    await mig(Firebase, 'firebases')
    await mig(Device, 'devices')
    await mig(Campaign, 'campaigns')
    await mig(CampaignMessage, 'campaign_messages')
    await mig(QueueItem, 'queue_items')
  }
}catch(e:any){ console.log('[DB] tenant migration skip', e.message) }
// DAILY STAT MIGRATION: per-device daily count persist after campaign delete, next day auto 0
try{
  const istOffset=5.5*60*60*1000
  const ist=new Date(Date.now()+istOffset)
  const today=`${ist.getUTCFullYear()}-${String(ist.getUTCMonth()+1).padStart(2,'0')}-${String(ist.getUTCDate()).padStart(2,'0')}`
  const existingToday=await DeviceDailyStat.countDocuments({date:today})
  if(existingToday===0){
    const since=new Date(); since.setHours(0,0,0,0)
    const sinceISO=since.toISOString()
    const agg=await CampaignMessage.aggregate([
      {$match:{status:'sent', sent_at:{$gte:sinceISO}}},
      {$group:{_id:{device_id:'$device_id', owner_id:'$owner_id', firebase_id:'$firebase_id'}, count:{$sum:1}}}
    ]) as any[]
    for(const r of agg){
      const deviceId=r._id.device_id
      if(!deviceId) continue
      let ownerId=r._id.owner_id
      if(!ownerId){
        const dev=await Device.findOne({_id:deviceId}).lean() as any
        ownerId=dev?.owner_id || (await User.findOne({is_super:1}).lean() as any)?._id
      }
      const firebaseId=r._id.firebase_id || null
      const id=`${deviceId}_${today}`
      await DeviceDailyStat.updateOne({_id:id}, {$set:{device_id:deviceId, owner_id:ownerId, firebase_id:firebaseId, date:today, updated_at:new Date().toISOString()}, $inc:{count:r.count}}, {upsert:true})
    }
    if(agg.length) console.log(`[DB] migrated DeviceDailyStat ${today} x${agg.length} devices from CampaignMessage`)
  }
}catch(e:any){ console.log('[DB] daily stat migration skip', e.message) }

let settingsCache: Record<string,string> = {}
async function loadCache(){
  try{
    const all=await Setting.find().lean() as any[]
    settingsCache={}
    for(const s of all) settingsCache[s.key]=s.value
  }catch(e:any){ console.log('[DB] loadCache fail',e.message)}
}
loadCache().catch(()=>{})
// FIX: auto-refresh every 15s — was stale after DB direct updateMany (silly: cache never refreshed, required restart)
setInterval(()=>{ loadCache().catch(()=>{}) }, 15000)

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
