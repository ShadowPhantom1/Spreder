import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { createServer } from 'http'
import { Server as IOServer } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from './config/index.js'
import './db/index.js'
import authRoutes from './routes/auth.js'
import firebaseRoutes from './routes/firebases.js'
import deviceRoutes from './routes/devices.js'
import campaignRoutes from './routes/campaigns.js'
import settingsRoutes from './routes/settings.js'
import adminRoutes from './routes/admin.js'
import * as devicePoller from './services/devicePoller.js'
import * as queueService from './services/queueService.js'
import * as deviceValidator from './services/deviceValidator.js'
import { db } from './db/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)
const io = new IOServer(httpServer, { cors: { origin: true, credentials: true } })

// middleware
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }))

// attach poller & queue emitter
devicePoller.attachIO(io)
queueService.setEmitter((event, payload) => io.emit(event, payload))

// health & stats
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'BHNSTOCK SMS SPREADER 3D WEB', theme: 'Brand New Day', time: new Date().toISOString() }))

app.get('/api/stats', (_req, res) => {
  const fbCount = (db.prepare('SELECT COUNT(*) as c FROM firebases').get() as any).c
  const devStats = db.prepare(`SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status='online' THEN 1 ELSE 0 END) as online,
    SUM(CASE WHEN status='offline' THEN 1 ELSE 0 END) as offline,
    SUM(CASE WHEN status='busy' THEN 1 ELSE 0 END) as busy,
    SUM(CASE WHEN has_recharge=1 AND status IN ('online','busy') THEN 1 ELSE 0 END) as rechargeOnline
  FROM devices`).get() as any
  // capacity per SIM — per_sim_limit alias for max_sms_per_device_per_day
  const perSim = parseInt((db.prepare("SELECT value FROM settings WHERE key='per_sim_limit'").get() as any)?.value || (db.prepare("SELECT value FROM settings WHERE key='max_sms_per_device_per_day'").get() as any)?.value || '100',10)
  const checkRecharge = ((db.prepare("SELECT value FROM settings WHERE key='check_recharge'").get() as any)?.value || 'true') !== 'false'
  // sum capacity across online+busy devices (queue uses both) — fixes kam show
  const devRows = db.prepare("SELECT sim_count, has_recharge, sim1_recharge, sim2_recharge, status FROM devices WHERE status IN ('online','busy')").all() as any[]
  let totalCapacity=0
  for(const d of devRows){
    const sc=d.sim_count||1
    if(checkRecharge && d.has_recharge===0) continue
    if(sc===2 && checkRecharge && d.sim1_recharge===0 && d.sim2_recharge===0) continue
    if(sc===2 && checkRecharge && (d.sim1_recharge===0 || d.sim2_recharge===0)) totalCapacity+= perSim
    else totalCapacity+= sc * perSim
  }
  // IST today 00:00 — fixes 5.5h lag (server UTC vs user IST)
  const todayStart=new Date()
  const istOffset = 5.5*60*60*1000
  const istNow = new Date(Date.now() + istOffset)
  istNow.setUTCHours(0,0,0,0)
  const todayISO=new Date(istNow.getTime() - istOffset).toISOString()
  const todaySent=(db.prepare("SELECT COUNT(*) as c FROM campaign_messages WHERE status='sent' AND sent_at >= ?").get(todayISO) as any).c || 0
  const remaining=Math.max(0, totalCapacity - todaySent)
  const campStats = db.prepare(`SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) as running,
    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as draft,
    COALESCE(SUM(sent),0) as totalSent,
    COALESCE(SUM(failed),0) as totalFailed
  FROM campaigns`).get() as any
  const todayByDevice = db.prepare("SELECT m.device_id, d.name, COUNT(*) as c FROM campaign_messages m LEFT JOIN devices d ON d.id=m.device_id WHERE m.status='sent' AND m.sent_at >= ? GROUP BY m.device_id ORDER BY c DESC LIMIT 10").all(todayISO) as any[]
  const totalToday = todaySent
  res.json({ firebases: fbCount, devices: { ...devStats, capacity: { totalCapacity, remaining, perSim } }, campaigns: campStats, today: { totalToday, byDevice: todayByDevice, since: todayISO, capacity: { totalCapacity, remaining, perSim } } })
})

// Today stats dedicated — IST
app.get('/api/stats/today', (_req, res)=>{
  const istOffset = 5.5*60*60*1000
  const istNow = new Date(Date.now() + istOffset)
  istNow.setUTCHours(0,0,0,0)
  const iso=new Date(istNow.getTime() - istOffset).toISOString()
  const total=(db.prepare("SELECT COUNT(*) as c FROM campaign_messages WHERE status='sent' AND sent_at >= ?").get(iso) as any).c
  const byDevice=db.prepare("SELECT d.name, d.id, COUNT(m.id) as sent FROM campaign_messages m LEFT JOIN devices d ON d.id=m.device_id WHERE m.status='sent' AND m.sent_at >= ? GROUP BY m.device_id ORDER BY sent DESC").all(iso) as any[]
  const byHour=db.prepare("SELECT substr(sent_at,12,2) as hr, COUNT(*) as c FROM campaign_messages WHERE status='sent' AND sent_at >= ? GROUP BY hr ORDER BY hr").all(iso) as any[]
  res.json({ totalToday: total, byDevice, byHour, since: iso })
})

// Cleanup old completed campaigns (auto-delete)
app.post('/api/campaigns/cleanup', (req, res)=>{
  const days = parseInt((req.body?.days ?? req.query.days ?? db.prepare("SELECT value FROM settings WHERE key='auto_delete_completed_after_days'").get() as any)?.value || '0',10)
  if(!days || days<=0) return res.json({ deleted:0, message:'Auto-delete disabled (0 days)' })
  const cutoff=new Date(Date.now() - days*24*60*60*1000).toISOString()
  const toDelete=db.prepare("SELECT id FROM campaigns WHERE status='completed' AND finished_at < ?").all(cutoff) as any[]
  let deleted=0
  const txn=db.transaction(()=>{
    for(const r of toDelete){
      db.prepare("DELETE FROM queue_items WHERE campaign_id=?").run(r.id)
      db.prepare("DELETE FROM campaign_messages WHERE campaign_id=?").run(r.id)
      db.prepare("DELETE FROM campaigns WHERE id=?").run(r.id)
      deleted++
    }
  })
  txn()
  res.json({ deleted, cutoff, days })
})

// routes
app.use('/api/auth', authRoutes)
app.use('/api/firebases', firebaseRoutes)
app.use('/api/devices', deviceRoutes)
app.use('/api/campaigns', campaignRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/admin', adminRoutes)

// serve client in production — handle both persist (new) and dist (legacy) + tsx
import fs from 'fs'
const candidates = [
  path.resolve(process.cwd(), 'persist/client'),
  path.resolve(__dirname, '../../persist/client'),
  path.resolve(__dirname, '../../dist/client'),
  path.resolve(__dirname, '../client'),
  path.resolve(__dirname, '../../client'),
  path.resolve(process.cwd(), 'dist/client'),
]
let clientDist = candidates.find(p => fs.existsSync(path.join(p, 'index.html'))) || candidates[0]
app.use(express.static(clientDist, { maxAge: '1h', etag: true }))
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Not found — web missed this route' })
  })
})

// socket auth (optional)
io.on('connection', (socket) => {
  // console.log('[WS] connected', socket.id)
  socket.emit('hello', { message: 'Connected to BHNSTOCK 3D Web — Friendly Neighborhood Spreader 🕷️', id: socket.id })
  socket.on('disconnect', () => {})
})

// start
httpServer.listen(config.PORT, config.HOST, () => {
  console.log(`\n🕷️  BHNSTOCK SMS SPREADER 3D WEB — Brand New Day`)
  console.log(`   ███████╗██████╗ ██╗██████╗ ███████╗██████╗ `)
  console.log(`   Server running at http://${config.HOST}:${config.PORT}`)
  console.log(`   Env: ${config.NODE_ENV} | DB: ${config.DATABASE_PATH}`)
  console.log(`   Admin: ${config.ADMIN_USER} / ${config.ADMIN_PASS}\n`)
  devicePoller.start()
  deviceValidator.startValidator()

  // seed demo firebase if empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM firebases').get() as any).c
  if (count === 0) {
    const id = 'fb_demo_' + Math.random().toString(36).slice(2,6)
    db.prepare('INSERT INTO firebases (id, name, database_url, status, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id, 'BHNSTOCK • NYC Hive-01 (Demo)', 'https://bhnstock-demo-spiderverse.mock.firebaseio.com', 'online', new Date().toISOString()
    )
    console.log(`[Seed] Demo Firebase created: ${id}`)
  }
})
