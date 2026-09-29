import 'dotenv/config'
import { config } from '../config/index.js'
import mongoose from 'mongoose'
import { getModels } from './mongo.js'

export let useMongo = true

if(!config.MONGODB_URI){
  console.error('[DB] MONGODB_URI required — fully Mongo mode, exiting')
  process.exit(1)
}

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
// SPEED: additional indexes for hives stats (was slow 2.6s + 4.3s on 709 devices)
try{
  await Device.collection.createIndex({status:1})
  await Device.collection.createIndex({firebase_id:1})
  await Device.collection.createIndex({firebase_id:1, status:1})
  await Device.collection.createIndex({last_seen:-1})
  await DeviceDailyStat.collection.createIndex({date:1})
  console.log('[DB] speed indexes ok')
}catch{}

import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
// STRICT: only ONE super — if ADMIN_USER changed in env, update existing super instead of creating duplicate (was creating 2 supers)
// Find any existing super (old admin) — there should be only one
const adminExists = await User.findOne({username: config.ADMIN_USER}).lean() as any
const existingSupers = await User.find({is_super:1}).lean() as any[]
if (!adminExists) {
  if(existingSupers.length>0){
    // Env changed (e.g. admin -> shadowphantom): reuse old super's _id, update username+password, delete duplicates
    const keep = existingSupers[0]
    const hash = bcrypt.hashSync(config.ADMIN_PASS, 10)
    await User.updateOne({_id: keep._id}, {$set:{username: config.ADMIN_USER, password_hash: hash, is_super:1, is_active:1, role:'admin'}})
    console.log(`[DB] Updated existing super ${keep.username} (${String(keep._id).slice(0,8)}) -> ${config.ADMIN_USER} (env changed, no duplicate)`)
    // delete any extra supers (duplicates)
    for(const dup of existingSupers.slice(1)){
      await User.deleteOne({_id: dup._id})
      console.log(`[DB] Deleted duplicate super ${dup.username} ${String(dup._id).slice(0,8)}`)
    }
    // also handle the case where we just updated keep but there might be a newly created duplicate with same username race — ensure only one left
    const stillDups = await User.find({is_super:1}).lean() as any[]
    if(stillDups.length>1){
      for(const dup of stillDups.filter((u:any)=> String(u._id)!==String(keep._id))){
        await User.deleteOne({_id: dup._id})
        console.log(`[DB] Deleted extra super after update ${dup.username}`)
      }
    }
  } else {
    const hash = bcrypt.hashSync(config.ADMIN_PASS, 10)
    const id=randomUUID()
    await User.create({_id:id, username: config.ADMIN_USER, password_hash:hash, role:'admin', is_super:1, is_active:1, allowed_device:null, per_sim_limit:100, max_devices:100, expires_at:null, created_at:new Date().toISOString()} as any)
    console.log(`[DB] Seeded super admin Mongo: ${config.ADMIN_USER}`)
  }
} else {
  // exists with correct username — ensure password matches env (if env pass changed, update hash) and only one super
  const hash = bcrypt.hashSync(config.ADMIN_PASS, 10)
  // Only update password if it doesn't match (compare sync would be needed, but we just update to env hash for strict)
  // To avoid rehash every restart, check if count of supers >1 then dedup, otherwise just ensure active
  if(adminExists.is_super!==1){
    await User.updateOne({username: config.ADMIN_USER}, {$set:{is_super:1, is_active:1}})
    console.log(`[DB] Upgraded to super admin: ${config.ADMIN_USER}`)
  }
  // If password in env changed, update it (so old admin pass becomes shadow phantom)
  // We always sync password to env on boot for super
  await User.updateOne({_id: adminExists._id}, {$set:{password_hash: hash, is_active:1}})
  console.log(`[DB] Synced super password to env for ${config.ADMIN_USER}`)
  if(existingSupers.length>1){
    for(const dup of existingSupers.filter((u:any)=> String(u._id)!==String(adminExists._id))){
      await User.deleteOne({_id: dup._id})
      console.log(`[DB] Deleted duplicate super ${dup.username} ${String(dup._id).slice(0,8)} (keep ${config.ADMIN_USER})`)
    }
  }
}

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
// AUDIT FIX: orphan devices + duplicate hive URL cleanup (global duplicate caused z4x 0 + owner flip-flop)
try{
  const allFbIds = await Firebase.distinct('_id') as any[]
  if(allFbIds.length>=0){
    const orphan = await Device.deleteMany({firebase_id: {$nin: allFbIds.length? allFbIds : ['__none__']}})
    if((orphan as any).deletedCount) console.log(`[DB] cleaned orphan devices x${(orphan as any).deletedCount} (hive deleted, no Firebase)`)
  }
  const allFbs = await Firebase.find().lean() as any[]
  const seen = new Map<string, any>()
  let dupDel=0
  for(const fb of allFbs){
    const norm = String(fb.database_url||'').trim().toLowerCase().replace(/\.json$/,'').replace(/\/$/,'')
    if(!norm) continue
    if(seen.has(norm)){
      await Firebase.deleteOne({_id: fb._id})
      await Device.deleteMany({firebase_id: fb._id})
      dupDel++
      console.log(`[DB] deleted duplicate hive ${fb.name} ${String(fb._id).slice(0,8)} url=${norm} (kept ${String(seen.get(norm)._id).slice(0,8)})`)
    } else seen.set(norm, fb)
  }
  if(dupDel) console.log(`[DB] duplicate hive cleanup x${dupDel}`)
}catch(e:any){ console.log('[DB] orphan/duplicate cleanup skip', e.message) }
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
setInterval(()=>{ loadCache().catch(()=>{}) }, 15000)

export function getSetting(key:string){
  return settingsCache[key] || ''
}
export async function setSetting(key:string, value:string){
  settingsCache[key]=value
  await Setting.updateOne({_id:key}, {$set:{key, value, updated_at:new Date().toISOString()}}, {upsert:true})
}
export async function getSettingAsync(key:string){
  const doc=await Setting.findOne({_id:key}).lean() as any
  return doc?.value
}
export async function syncUserToMongo(user:any){ /* no-op, fully Mongo */ }
