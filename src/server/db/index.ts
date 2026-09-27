import Database from 'better-sqlite3'
import { config } from '../config/index.js'
import fs from 'fs'
import path from 'path'

const dir = path.dirname(config.DATABASE_PATH)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

export const db = new Database(config.DATABASE_PATH)
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('wal_autocheckpoint = 1000')
db.pragma('foreign_keys = OFF')

// Mongo fully — no local fallback for users (other tables still SQLite for now, next full migration)
import mongoose from 'mongoose'
export let useMongo = false
const userSchema = new mongoose.Schema({ _id:String, username:String, password_hash:String, role:String, is_super:Number, is_active:Number, allowed_ip:String, allowed_device:String, per_sim_limit:Number, max_devices:Number, expires_at:String, created_at:String }, { _id:false, collection:'users' })
try{ mongoose.model('User', userSchema) }catch{}
if(config.MONGODB_URI){
  // will connect; useMongo set on success
  mongoose.connect(config.MONGODB_URI).then(async ()=>{
    useMongo = true
    console.log('[DB] Mongo connected — FULLY Mongo for users (no local fallback)')
  }).catch(e=>{
    console.log('[DB] Mongo connect fail:', e.message)
    process.exit(1)
  })
} else {
  console.log('[DB] MONGODB_URI missing — exiting (fully Mongo required)')
  process.exit(1)
}

// Schema
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS firebases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  database_url TEXT NOT NULL,
  service_account_json TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_tested_at TEXT,
  device_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  firebase_id TEXT NOT NULL REFERENCES firebases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'offline',
  battery INTEGER,
  signal INTEGER,
  last_seen TEXT,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  extra TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0,
  batch_size INTEGER DEFAULT 5,
  delay_ms INTEGER DEFAULT 1200,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS campaign_messages (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  variables TEXT,
  rendered TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  device_id TEXT,
  firebase_id TEXT,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS queue_items (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES campaign_messages(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`)

// Migrations for 5-6 hive + dual SIM + recharge
try{ db.exec("ALTER TABLE devices ADD COLUMN sim_count INTEGER DEFAULT 1") }catch{}
try{ db.exec("ALTER TABLE devices ADD COLUMN sim_count INTEGER DEFAULT 1") }catch{}
try{ db.exec("ALTER TABLE devices ADD COLUMN has_recharge INTEGER DEFAULT 1") }catch{}
try{ db.exec("ALTER TABLE devices ADD COLUMN sim1_recharge INTEGER DEFAULT 1") }catch{}
try{ db.exec("ALTER TABLE devices ADD COLUMN sim2_recharge INTEGER DEFAULT 1") }catch{}
// Admin + single device + IP lock
try{ db.exec("ALTER TABLE users ADD COLUMN is_super INTEGER DEFAULT 0") }catch{}
try{ db.exec("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1") }catch{}
try{ db.exec("ALTER TABLE users ADD COLUMN allowed_ip TEXT") }catch{}
try{ db.exec("ALTER TABLE users ADD COLUMN allowed_device TEXT") }catch{}
try{ db.exec("ALTER TABLE users ADD COLUMN per_sim_limit INTEGER DEFAULT 100") }catch{}
try{ db.exec("ALTER TABLE users ADD COLUMN max_devices INTEGER DEFAULT 100") }catch{}
try{ db.exec("ALTER TABLE users ADD COLUMN expires_at TEXT") }catch{}
try{ db.exec("CREATE TABLE IF NOT EXISTS sessions (user_id TEXT PRIMARY KEY, ip TEXT, device_id TEXT, token TEXT, last_active TEXT)") }catch{}
try{ db.exec("DROP TRIGGER IF EXISTS fk_sessions") }catch{}
try{ db.exec("ALTER TABLE devices ADD COLUMN validated_score INTEGER DEFAULT 0") }catch{}
try{ db.exec("ALTER TABLE devices ADD COLUMN validated_at TEXT") }catch{}
try{ db.exec("ALTER TABLE devices ADD COLUMN validator_fail_count INTEGER DEFAULT 0") }catch{}

// Seed admin user — SQLite (legacy) + Mongo (primary)
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const adminExists = db.prepare('SELECT id, is_super FROM users WHERE username = ?').get(config.ADMIN_USER) as any
if (!adminExists) {
  const hash = bcrypt.hashSync(config.ADMIN_PASS, 10)
  const id=randomUUID()
  db.prepare('INSERT INTO users (id, username, password_hash, role, is_super, is_active, created_at) VALUES (?, ?, ?, ?, 1, 1, ?)').run(
    id,
    config.ADMIN_USER,
    hash,
    'admin',
    new Date().toISOString()
  )
  console.log(`[DB] Seeded super admin SQLite: ${config.ADMIN_USER} / ${config.ADMIN_PASS}`)
  // also seed Mongo
  setTimeout(async()=>{
    try{
      if(mongoose.connection.readyState===1){
        const User=mongoose.model('User')
        const exists=await User.findOne({username:config.ADMIN_USER}).lean()
        if(!exists){
          await User.create({_id:id, username:config.ADMIN_USER, password_hash:hash, role:'admin', is_super:1, is_active:1, allowed_ip:null, allowed_device:null, per_sim_limit:100, max_devices:100, expires_at:null, created_at:new Date().toISOString()})
          console.log(`[DB] Seeded super admin Mongo: ${config.ADMIN_USER}`)
        }
      }
    }catch(e:any){ console.log('[DB] Mongo seed fail',e.message)}
  },1500)
} else if(adminExists.is_super!==1){
  db.prepare('UPDATE users SET is_super=1, is_active=1 WHERE username=?').run(config.ADMIN_USER)
  console.log(`[DB] Upgraded to super admin: ${config.ADMIN_USER}`)
}
// dual save helper
export async function syncUserToMongo(user:any){
  if(!config.MONGODB_URI) return
  try{
    const { default: mongoose } = await import('mongoose')
    if(mongoose.connection.readyState!==1) return
    const User = mongoose.model('User')
    await User.updateOne({_id:user.id}, {$set:user}, {upsert:true})
  }catch(e:any){ console.log('[Mongo sync] fail', e.message) }
}

// Default settings — 50/sec NO-DELAY (user asked)
const defaults: Record<string, string> = {
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
  default_sim_count: '1',
  check_recharge: 'true',
  hive_concurrency: '6',
  webhook_url: '',
  webhook_enabled: 'false',
  webhook_secret: '',
}
// MIGRATE old slow defaults to 50/sec NO-DELAY
try{
  const curBatch = db.prepare("SELECT value FROM settings WHERE key='dispatch_batch_size'").get() as any
  if(curBatch && ['10','24','30'].includes(curBatch.value)) db.prepare("UPDATE settings SET value='50', updated_at=? WHERE key='dispatch_batch_size'").run(new Date().toISOString())
  const curDelay = db.prepare("SELECT value FROM settings WHERE key='dispatch_delay_ms'").get() as any
  if(curDelay && ['550','220','120'].includes(curDelay.value)) db.prepare("UPDATE settings SET value='0', updated_at=? WHERE key='dispatch_delay_ms'").run(new Date().toISOString())
  const curAck = db.prepare("SELECT value FROM settings WHERE key='ack_timeout_ms'").get() as any
  if(curAck && ['12000','4500','2800','1800'].includes(curAck.value)) db.prepare("UPDATE settings SET value='1200', updated_at=? WHERE key='ack_timeout_ms'").run(new Date().toISOString())
  const curPoll = db.prepare("SELECT value FROM settings WHERE key='poll_interval_ms'").get() as any
  if(curPoll && ['3000','1500','1200','800'].includes(curPoll.value)) db.prepare("UPDATE settings SET value='500', updated_at=? WHERE key='poll_interval_ms'").run(new Date().toISOString())
  const curHive = db.prepare("SELECT value FROM settings WHERE key='hive_concurrency'").get() as any
  if(curHive && curHive.value==='3') db.prepare("UPDATE settings SET value='6', updated_at=? WHERE key='hive_concurrency'").run(new Date().toISOString())
  const curSpeed = db.prepare("SELECT value FROM settings WHERE key='speed_profile'").get() as any
  if(curSpeed && ['turbo','beast'].includes(curSpeed.value)) db.prepare("UPDATE settings SET value='ultra', updated_at=? WHERE key='speed_profile'").run(new Date().toISOString())
}catch{}
for (const [k, v] of Object.entries(defaults)) {
  const exists = db.prepare('SELECT key FROM settings WHERE key = ?').get(k)
  if (!exists) {
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(k, v, new Date().toISOString())
  }
}

// Helpers — with NaN guard
export const getSetting = (key: string): string | null => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
  const v=row?.value ?? null
  if(v==='' ) return null
  return v
}
export const setSetting = (key: string, value: string) => {
  db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at').run(key, value, new Date().toISOString())
}
