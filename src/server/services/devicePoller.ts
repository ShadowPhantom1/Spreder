import { getSetting } from '../db/index.js'
import { Firebase, Device } from '../db/index.js'
import * as firebaseService from './firebaseService.js'
import type { Server as IOServer } from 'socket.io'

let io: IOServer | null = null
let interval: NodeJS.Timeout | null = null
let running = false

export function attachIO(server: IOServer) { io = server }

export function start() {
  if (running) return
  running = true
  pollAll()
  let ms = Number(getSetting('poll_interval_ms') || 500)
  if(isNaN(ms) || ms<200) ms=500
  interval = setInterval(()=>{
    const cur = Number(getSetting('poll_interval_ms') || 500)
    const curMs = isNaN(cur) || cur<200 ? 500 : cur
    if(curMs !== ms){
      ms=curMs
      if(interval) clearInterval(interval)
      interval = setInterval(pollAll, ms)
      console.log(`[Poller] Interval updated to ${ms}ms`)
    }
    pollAll()
  }, ms)
  console.log(`[Poller] Started every ${ms}ms 🕷️`)
}
export function stop() {
  running = false
  if (interval) clearInterval(interval)
  interval = null
}

async function pollAll() {
  const firebases = await Firebase.find().lean() as any[]
  if (firebases.length === 0) return
  const concurrency = Math.max(1, parseInt(getSetting('hive_concurrency')||'3',10))
  for(let i=0;i<firebases.length;i+=concurrency){
    const chunk = firebases.slice(i,i+concurrency)
    await Promise.all(chunk.map(async (fb:any)=>{
      const fbId=fb._id || fb.id
      try {
        const devices = await firebaseService.pollDevices({...fb, id:fbId})
        const now = new Date().toISOString()
        const defaultSim = parseInt(getSetting('default_sim_count')||'1',10) || 1
        for (const d of devices) {
          if(d.status==='busy' && !d.name.includes('pending')) d.status='online'
          const existing = await Device.findOne({_id:d.id}).lean() as any
          const simCount = existing?.sim_count ?? defaultSim
          const hasRec = existing?.has_recharge ?? 1
          const s1 = existing?.sim1_recharge ?? 1
          const s2 = existing?.sim2_recharge ?? 1
          await Device.updateOne({_id:d.id}, {$set:{ _id:d.id, id:d.id, firebase_id:fbId, name:d.name, model:d.model||null, status:d.status, battery:d.battery??null, signal:d.signal??null, last_seen:d.last_seen||now, created_at: existing?.created_at || now, sim_count:simCount, has_recharge:hasRec, sim1_recharge:s1, sim2_recharge:s2}}, {upsert:true})
        }
        const fbStatus = devices.length===0 ? 'offline' : 'online'
        await Firebase.updateOne({_id:fbId}, {$set:{device_count:devices.length, status:fbStatus}})
        if (io) {
          io.emit('devices:update', { firebaseId: fbId, count: devices.length, devices: devices.slice(0, 8) })
          io.emit('firebases:update', { id: fbId, device_count: devices.length, status: 'online' })
        }
      } catch (e: any) {
        await Firebase.updateOne({_id:fbId}, {$set:{status:'offline'}})
        if (io) io.emit('firebases:update', { id: fbId, status: 'offline', error: e.message })
      }
    }))
  }
  if (io) {
    const online=await Device.countDocuments({status:'online'})
    const offline=await Device.countDocuments({status:'offline'})
    const busy=await Device.countDocuments({status:'busy'})
    const total=await Device.countDocuments()
    io.emit('stats:devices', {online, offline, busy, total})
  }
}
