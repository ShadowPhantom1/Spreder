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

app.get('/api/stats', async (_req, res) => {
  const {Firebase, Device, Campaign, CampaignMessage, Setting} = await import('./db/index.js')
  const fbCount = await Firebase.countDocuments()
  const devStatsAgg = await Device.aggregate([
    {$group:{_id:null, total:{$sum:1}, online:{$sum:{$cond:[{$eq:['$status','online']},1,0]}}, offline:{$sum:{$cond:[{$eq:['$status','offline']},1,0]}}, busy:{$sum:{$cond:[{$eq:['$status','busy']},1,0]}}, rechargeOnline:{$sum:{$cond:[{$and:[{$eq:['$has_recharge',1]}, {$in:['$status',['online','busy']]}]},1,0]}}}}
  ]) as any[]
  const devStats = devStatsAgg[0] || {total:0, online:0, offline:0, busy:0, rechargeOnline:0}
  const perSimDoc = await Setting.findOne({_id:'per_sim_limit'}).lean() as any || await Setting.findOne({_id:'max_sms_per_device_per_day'}).lean() as any
  const perSim = parseInt(perSimDoc?.value || '100',10)
  const checkRechargeDoc = await Setting.findOne({_id:'check_recharge'}).lean() as any
  const checkRecharge = (checkRechargeDoc?.value || 'true') !== 'false'
  const devRows = await Device.find({status:{$in:['online','busy']}}).lean() as any[]
  let totalCapacity=0
  for(const d of devRows){
    const sc=d.sim_count||1
    if(checkRecharge && d.has_recharge===0) continue
    if(sc===2 && checkRecharge && d.sim1_recharge===0 && d.sim2_recharge===0) continue
    if(sc===2 && checkRecharge && (d.sim1_recharge===0 || d.sim2_recharge===0)) totalCapacity+= perSim
    else totalCapacity+= sc * perSim
  }
  const istOffset = 5.5*60*60*1000
  const istNow = new Date(Date.now() + istOffset)
  istNow.setUTCHours(0,0,0,0)
  const todayISO=new Date(istNow.getTime() - istOffset).toISOString()
  const todaySent = await CampaignMessage.countDocuments({status:'sent', sent_at:{$gte:todayISO}})
  const remaining=Math.max(0, totalCapacity - todaySent)
  const campStatsAgg = await Campaign.aggregate([
    {$group:{_id:null, total:{$sum:1}, running:{$sum:{$cond:[{$eq:['$status','running']},1,0]}}, completed:{$sum:{$cond:[{$eq:['$status','completed']},1,0]}}, draft:{$sum:{$cond:[{$eq:['$status','draft']},1,0]}}, totalSent:{$sum:'$sent'}, totalFailed:{$sum:'$failed'}}}
  ]) as any[]
  const campStats = campStatsAgg[0] || {total:0, running:0, completed:0, draft:0, totalSent:0, totalFailed:0}
  const todayByDevice = await CampaignMessage.aggregate([
    {$match:{status:'sent', sent_at:{$gte:todayISO}}},
    {$group:{_id:'$device_id', c:{$sum:1}}},
    {$sort:{c:-1}},
    {$limit:10},
    {$lookup:{from:'devices', localField:'_id', foreignField:'_id', as:'dev'}},
    {$unwind:{path:'$dev', preserveNullAndEmptyArrays:true}},
    {$project:{device_id:'$_id', name:'$dev.name', c:1}}
  ]) as any[]
  const totalToday = todaySent
  res.json({ firebases: fbCount, devices: { ...devStats, capacity: { totalCapacity, remaining, perSim } }, campaigns: campStats, today: { totalToday, byDevice: todayByDevice, since: todayISO, capacity: { totalCapacity, remaining, perSim } } })
})

// Today stats dedicated — IST — FULLY MONGO
app.get('/api/stats/today', async (_req, res)=>{
  const istOffset = 5.5*60*60*1000
  const istNow = new Date(Date.now() + istOffset)
  istNow.setUTCHours(0,0,0,0)
  const iso=new Date(istNow.getTime() - istOffset).toISOString()
  try{
    const {CampaignMessage} = await import('./db/index.js')
    const total = await CampaignMessage.countDocuments({status:'sent', sent_at: {$gte: iso}})
    const byDeviceAgg = await CampaignMessage.aggregate([
      {$match:{status:'sent', sent_at: {$gte: iso}}},
      {$group:{_id:'$device_id', sent:{$sum:1}}},
      {$sort:{sent:-1}},
      {$lookup:{from:'devices', localField:'_id', foreignField:'_id', as:'dev'}},
      {$unwind:{path:'$dev', preserveNullAndEmptyArrays:true}},
      {$project:{id:'$_id', name:'$dev.name', sent:1}}
    ]) as any[]
    const byHour = await CampaignMessage.aggregate([
      {$match:{status:'sent', sent_at: {$gte: iso}}},
      {$group:{_id:{$substr:['$sent_at',11,2]}, c:{$sum:1}}},
      {$sort:{_id:1}},
      {$project:{hr:'$_id', c:1, _id:0}}
    ]) as any[]
    res.json({ totalToday: total, byDevice: byDeviceAgg, byHour, since: iso })
  }catch(e:any){
    // fallback dummy
    res.json({ totalToday: 0, byDevice:[], byHour:[], since: iso })
  }
})

// Cleanup old completed campaigns (auto-delete) — FULLY MONGO
app.post('/api/campaigns/cleanup', async (req, res)=>{
  try{
    const {Campaign, CampaignMessage, QueueItem, Setting} = await import('./db/index.js')
    const setting = await Setting.findOne({_id:'auto_delete_completed_after_days'}).lean() as any
    const days = parseInt((req.body?.days ?? req.query.days ?? setting?.value ?? '0'),10)
    if(!days || days<=0) return res.json({ deleted:0, message:'Auto-delete disabled (0 days)' })
    const cutoff=new Date(Date.now() - days*24*60*60*1000).toISOString()
    const toDelete = await Campaign.find({status:'completed', finished_at: {$lt: cutoff}}).lean() as any[]
    let deleted=0
    for(const r of toDelete){
      const cid=r._id || r.id
      await QueueItem.deleteMany({campaign_id: cid})
      await CampaignMessage.deleteMany({campaign_id: cid})
      await Campaign.deleteOne({_id: cid})
      deleted++
    }
    res.json({ deleted, cutoff, days })
  }catch(e:any){
    res.status(500).json({error:e.message})
  }
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
httpServer.listen(config.PORT, config.HOST, async () => {
  console.log(`\n🕷️  BHNSTOCK SMS SPREADER 3D WEB — Brand New Day`)
  console.log(`   ███████╗██████╗ ██╗██████╗ ███████╗██████╗ `)
  console.log(`   Server running at http://${config.HOST}:${config.PORT}`)
  console.log(`   Env: ${config.NODE_ENV} | DB: MongoDB (fully)`)
  console.log(`   Admin: ${config.ADMIN_USER} / ${config.ADMIN_PASS}\n`)
  devicePoller.start()
  deviceValidator.startValidator()

  // seed demo firebase if empty — Mongo
  try{
    const {Firebase} = await import('./db/index.js')
    const count = await Firebase.countDocuments()
    if (count === 0) {
      const id = 'fb_demo_' + Math.random().toString(36).slice(2,6)
      await Firebase.create({_id:id, id, name:'BHNSTOCK • NYC Hive-01 (Demo)', database_url:'https://bhnstock-demo-spiderverse.mock.firebaseio.com', status:'online', created_at:new Date().toISOString()})
      console.log(`[Seed] Demo Firebase created: ${id}`)
    }
  }catch(e:any){ console.log('[Seed] demo fail',e.message)}
})
