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
db.pragma('foreign_keys = ON')

// Mongo fallback: if MONGODB_URI set, also save there; else local only
import mongoose from 'mongoose'
export let useMongo = false
if(config.MONGODB_URI){
  mongoose.connect(config.MONGODB_URI).then(async ()=>{
    useMongo = true
    console.log('[DB] Mongo connected — dual save (Mongo + local fallback) active')
    // restore users from Mongo if local empty (Render ephemeral FS)
    try{
      const cnt=(db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c
      if(cnt<=1){ // only admin or empty → try restore
        const User=mongoose.model('User')
        const docs:any[]=await User.find().lean() as any
        if(docs.length>cnt){
          for(const d of docs){
            const _id=(d._id as any)?.toString?.() || (d as any)._id || (d as any).id
            const exists=db.prepare('SELECT id FROM users WHERE id=?').get(_id) as any
            if(!exists){
              try{
                db.prepare('INSERT INTO users (id, username, password_hash, role, is_super, is_active, allowed_ip, allowed_device, per_sim_limit, max_devices, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(_id, (d as any).username, (d as any).password_hash, (d as any).role||'user', (d as any).is_super||0, (d as any).is_active??1, (d as any).allowed_ip||null, (d as any).allowed_device||null, (d as any).per_sim_limit||100, (d as any).max_devices||100, (d as any).expires_at||null, (d as any).created_at||new Date().toISOString())
              }catch{}
            }
          }
          console.log(`[DB] Restored ${docs.length} users from Mongo → SQLite`)
        }
      }
    }catch(e:any){ console.log('[DB] Mongo restore fail',e.message)}
  }).catch(e=>{
    console.log('[DB] Mongo connect fail, using local DB fallback:', e.message)
  })
  // simple User schema for Mongo dual save
  const userSchema = new mongoose.Schema({ _id:String, username:String, password_hash:String, role:String, is_super:Number, is_active:Number, allowed_ip:String, per_sim_limit:Number, max_devices:Number, expires_at:String, created_at:String }, { _id:false, collection:'users' })
  try{ mongoose.model('User', userSchema) }catch{}
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
try{ db.exec("CREATE TABLE IF NOT EXISTS sessions (user_id TEXT PRIMARY KEY, ip TEXT, device_id TEXT, token TEXT, last_active TEXT, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)") }catch{}
try{ db.exec("ALTER TABLE devices ADD COLUMN validated_score INTEGER DEFAULT 0") }catch{}
try{ db.exec("ALTER TABLE devices ADD COLUMN validated_at TEXT") }catch{}
try{ db.exec("ALTER TABLE devices ADD COLUMN validator_fail_count INTEGER DEFAULT 0") }catch{}

// Seed admin user
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const adminExists = db.prepare('SELECT id, is_super FROM users WHERE username = ?').get(config.ADMIN_USER) as any
if (!adminExists) {
  const hash = bcrypt.hashSync(config.ADMIN_PASS, 10)
  db.prepare('INSERT INTO users (id, username, password_hash, role, is_super, is_active, created_at) VALUES (?, ?, ?, ?, 1, 1, ?)').run(
    randomUUID(),
    config.ADMIN_USER,
    hash,
    'admin',
    new Date().toISOString()
  )
  console.log(`[DB] Seeded super admin: ${config.ADMIN_USER} / ${config.ADMIN_PASS}`)
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
