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
  let ms = Number(getSetting('poll_interval_ms') || 5000)
  if(isNaN(ms) || ms<1000) ms=5000
  interval = setInterval(()=>{
    const cur = Number(getSetting('poll_interval_ms') || 5000)
    const curMs = isNaN(cur) || cur<1000 ? 5000 : cur
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
  try {
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
          if (devices.length>0) {
            // bulk upsert — no per-device findOne (was N+1 query hammering Atlas)
            const ops = devices.map((d:any)=>{
              if(d.status==='busy' && !d.name.includes('pending')) d.status='online'
              return {
                updateOne: {
                  filter: {_id: d.id},
                  update: {
                    $set: { id:d.id, firebase_id:fbId, name:d.name, model:d.model||null, status:d.status, battery:d.battery??null, signal:d.signal??null, last_seen:d.last_seen||now },
                    $setOnInsert: { _id:d.id, created_at: now, sim_count:defaultSim, has_recharge:1, sim1_recharge:1, sim2_recharge:1 }
                  },
                  upsert: true
                }
              }
            })
            // chunk bulkWrites to avoid 16MB limit
            for(let k=0;k<ops.length;k+=500) await Device.bulkWrite(ops.slice(k,k+500) as any, {ordered:false})
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
    // throttle stats emit — only every 10s, not every poll (was 500ms 4 counts)
    const nowMs = Date.now()
    if (!(global as any)._lastStatsEmit || nowMs - (global as any)._lastStatsEmit > 10000) {
      (global as any)._lastStatsEmit = nowMs
      if (io) {
        const stats = await Device.aggregate([{$group:{_id:null, online:{$sum:{$cond:[{$eq:['$status','online']},1,0]}}, offline:{$sum:{$cond:[{$eq:['$status','offline']},1,0]}}, busy:{$sum:{$cond:[{$eq:['$status','busy']},1,0]}}, total:{$sum:1}}}]) as any[]
        const s = stats[0] || {online:0,offline:0,busy:0,total:0}
        io.emit('stats:devices', s)
      }
    }
  } catch(e:any){ console.error('[Poller] pollAll error', e.message) }
}
