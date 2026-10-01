import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { createServer } from 'http'
import { Server as IOServer } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'
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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean)
const io = new IOServer(httpServer, { cors: { origin: allowedOrigins.length? allowedOrigins : true, credentials: true } })

// middleware — CORS whitelist (silly: origin:true allow-all fixed)
app.use(cors({ origin: allowedOrigins.length? allowedOrigins : true, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }))

// attach poller & queue emitter
devicePoller.attachIO(io)
queueService.setEmitter((event, payload) => io.emit(event, payload))

// helper: get owner filter from token (multi-tenant: har user ka alg data)
function getStatsOwner(req:any){
  try{
    const tok=(req.cookies as any)?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null)
    if(!tok) return {filter:{}, isSuper:true, cacheKey:'global'}
    const p:any=jwt.verify(tok, config.JWT_SECRET) as any
    if(p?.is_super===1) return {filter:{}, isSuper:true, cacheKey:'global'}
    return {filter:{owner_id: p.id}, isSuper:false, cacheKey:p.id}
  }catch{ return {filter:{}, isSuper:true, cacheKey:'global'} }
}
function getTodayDateIST(){
  const now=new Date()
  const istOffset=5.5*60*60*1000
  const ist=new Date(now.getTime()+istOffset)
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth()+1).padStart(2,'0')}-${String(ist.getUTCDate()).padStart(2,'0')}`
}
let _statsCacheMap=new Map<string,{data:any, ts:number}>()
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'BHNSTOCK SMS SPREADER 3D WEB', theme: 'Brand New Day', time: new Date().toISOString() }))
app.get('/api/system/ip', async (req, res) => {
  try{
    const os=await import('os')
    const nets=(os.default||os).networkInterfaces()
    let ips:string[]=[]
    for(const name of Object.keys(nets)){
      for(const net of (nets as any)[name] || []){
        if(net.family==='IPv4' && !net.internal) ips.push(net.address)
      }
    }
    const host=req.get('host')||''
    const forwarded=(req.headers['x-forwarded-for'] as string)||''
    // VPS IP from env or detected
    const vpsIp=process.env.PUBLIC_IP || ips[0] || '127.0.0.1'
    const port=config.PORT
    const proto=(req.headers['x-forwarded-proto'] as string) || req.protocol || 'http'
    res.json({ ok:true, host, vpsIp, publicIp: forwarded.split(',')[0]||vpsIp, ips, port, url:`${proto}://${host}`, lanUrl:`http://${vpsIp}:${port}`, hostHeader: host })
  }catch(e:any){ res.json({ok:true, host:req.get('host'), port: config.PORT, error:e.message}) }
})

app.get('/api/stats', async (req:any, res) => {
  // AUDIT FIX: devices/firebases are SHARED (all see same hives, fixes Windows 0 while hive has 26). Campaigns stay per-owner.
  const {filter:ownerFilter, cacheKey} = getStatsOwner(req)
  const cached=_statsCacheMap.get(cacheKey)
  if(cached && Date.now()-cached.ts < 8000) return res.json(cached.data)
  const {Firebase, Device, Campaign, CampaignMessage, Setting, DeviceDailyStat} = await import('./db/index.js')
  const istOffset = 5.5*60*60*1000
  const istNow = new Date(Date.now() + istOffset)
  istNow.setUTCHours(0,0,0,0)
  const todayISO=new Date(istNow.getTime() - istOffset).toISOString()
  const todayDate=getTodayDateIST()
  // PER-USER: har user ka alg stats (devices per-owner, firebases per-owner) — super global
  const devMatch:any=Object.keys(ownerFilter).length? {$match: ownerFilter} : null
  const campMatch:any=Object.keys(ownerFilter).length? {$match: ownerFilter} : null
  // SPEED: use indexed countDocuments instead of full aggregate (was 4.3s on 709 devices)
  const campAggPipeline:any[]= campMatch? [campMatch, {$group:{_id:null, total:{$sum:1}, running:{$sum:{$cond:[{$eq:['$status','running']},1,0]}}, completed:{$sum:{$cond:[{$eq:['$status','completed']},1,0]}}, draft:{$sum:{$cond:[{$eq:['$status','draft']},1,0]}}, totalSent:{$sum:'$sent'}, totalFailed:{$sum:'$failed'}}}]: [{$group:{_id:null, total:{$sum:1}, running:{$sum:{$cond:[{$eq:['$status','running']},1,0]}}, completed:{$sum:{$cond:[{$eq:['$status','completed']},1,0]}}, draft:{$sum:{$cond:[{$eq:['$status','draft']},1,0]}}, totalSent:{$sum:'$sent'}, totalFailed:{$sum:'$failed'}}}]
  const todayFilter:any=Object.keys(ownerFilter).length? {date:todayDate, ...ownerFilter} : {date:todayDate}
  const todayFilterCamp:any={date:todayDate, ...ownerFilter}
  const devFilter:any=ownerFilter
  const [fbCount, totalCount, onlineCountRaw, offlineCount, busyCount, rechargeOnlineCount, perSimDocRaw, checkRechargeDoc, devRows, todayAgg, campStatsAgg] = await Promise.all([
    Firebase.countDocuments(ownerFilter),
    Device.countDocuments(devFilter) as Promise<number>,
    Device.countDocuments({status:'online', has_recharge:1, ...devFilter}) as Promise<number>,
    Device.countDocuments({status:'offline', ...devFilter}) as Promise<number>,
    Device.countDocuments({status:'busy', ...devFilter}) as Promise<number>,
    Device.countDocuments({status:'online', has_recharge:1, ...devFilter}) as Promise<number>,
    Setting.findOne({_id:'per_sim_limit'}).lean() as Promise<any>,
    Setting.findOne({_id:'check_recharge'}).lean() as Promise<any>,
    Device.find({status:'online', ...devFilter}).lean() as Promise<any[]>,
    DeviceDailyStat.aggregate([{$match:todayFilter}, {$group:{_id:null, total:{$sum:'$count'}}}]) as Promise<any[]>,
    Campaign.aggregate(campAggPipeline) as Promise<any[]>,
  ])
  const todaySent=(todayAgg[0]?.total || 0) as number
  const devStats = {total: totalCount, online: onlineCountRaw, offline: offlineCount, busy: busyCount, rechargeOnline: rechargeOnlineCount}
  let perSimDoc = perSimDocRaw as any
  if(!perSimDoc) perSimDoc = await Setting.findOne({_id:'max_sms_per_device_per_day'}).lean() as any
  const perSim = parseInt(perSimDoc?.value || '100',10)
  const checkRecharge = ((checkRechargeDoc as any)?.value || 'true') !== 'false'
  let totalCapacity=0
  for(const d of (devRows as any[])){
    const sc=d.sim_count||1
    if(checkRecharge && d.has_recharge===0) continue
    if(sc===2 && checkRecharge && d.sim1_recharge===0 && d.sim2_recharge===0) continue
    if(sc===2 && checkRecharge && (d.sim1_recharge===0 || d.sim2_recharge===0)) totalCapacity+= perSim
    else totalCapacity+= sc * perSim
  }
  const remaining=Math.max(0, totalCapacity - (todaySent as number))
  const campStats = (campStatsAgg as any[])[0] || {total:0, running:0, completed:0, draft:0, totalSent:0, totalFailed:0}
  // per-device today via DeviceDailyStat — per-user (super global)
  const todayByDevice = await DeviceDailyStat.aggregate([
    {$match:todayFilter},
    {$group:{_id:'$device_id', c:{$sum:'$count'}}},
    {$sort:{c:-1}},
    {$limit:10},
    {$lookup:{from:'devices', localField:'_id', foreignField:'_id', as:'dev'}},
    {$unwind:{path:'$dev', preserveNullAndEmptyArrays:true}},
    {$project:{device_id:'$_id', name:'$dev.name', c:1}}
  ]) as any[]
  const totalToday = todaySent as number
  const out = { firebases: fbCount, devices: { ...devStats, capacity: { totalCapacity, remaining, perSim } }, campaigns: campStats, today: { totalToday, byDevice: todayByDevice, since: todayISO, capacity: { totalCapacity, remaining, perSim } } }
  _statsCacheMap.set(cacheKey,{data:out, ts:Date.now()})
  res.json(out)
})

// Today stats dedicated — IST — FULLY MONGO — SHARED devices, per-owner campaigns
app.get('/api/stats/today', async (req:any, res)=>{
  const {filter:ownerFilter}=getStatsOwner(req)
  const istOffset = 5.5*60*60*1000
  const istNow = new Date(Date.now() + istOffset)
  istNow.setUTCHours(0,0,0,0)
  const iso=new Date(istNow.getTime() - istOffset).toISOString()
  const todayDate=getTodayDateIST()
  try{
    const {CampaignMessage, DeviceDailyStat} = await import('./db/index.js')
    const todayFilter:any=Object.keys(ownerFilter).length? {date:todayDate, ...ownerFilter} : {date:todayDate}
    const todayFilterCamp:any={date:todayDate, ...ownerFilter}
    // total via DeviceDailyStat — per-user
    const aggTotal=await DeviceDailyStat.aggregate([{$match:todayFilter}, {$group:{_id:null, total:{$sum:'$count'}}}]) as any[]
    const total=aggTotal[0]?.total || 0
    const byDeviceAgg = await DeviceDailyStat.aggregate([
      {$match:todayFilter},
      {$group:{_id:'$device_id', sent:{$sum:'$count'}}},
      {$sort:{sent:-1}},
      {$lookup:{from:'devices', localField:'_id', foreignField:'_id', as:'dev'}},
      {$unwind:{path:'$dev', preserveNullAndEmptyArrays:true}},
      {$project:{id:'$_id', name:'$dev.name', sent:1}}
    ]) as any[]
    const byHour = await CampaignMessage.aggregate([
      {$match:{status:'sent', sent_at: {$gte: iso}, ...ownerFilter}},
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
  console.log(`   Admin: ${config.ADMIN_USER} / ***\n`)
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
