import { db, getSetting } from '../db/index.js'
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
  const firebases = db.prepare("SELECT * FROM firebases").all() as any[]
  if (firebases.length === 0) return
  const concurrency = Math.max(1, parseInt(getSetting('hive_concurrency')||'3',10))
  // chunk poll for 5-6 hives without overloading
  for(let i=0;i<firebases.length;i+=concurrency){
    const chunk = firebases.slice(i,i+concurrency)
    await Promise.all(chunk.map(async (fb:any)=>{
      try {
        const devices = await firebaseService.pollDevices(fb)
        const now = new Date().toISOString()
        const defaultSim = parseInt(getSetting('default_sim_count')||'1',10) || 1
        const upsert = db.prepare(`
          INSERT INTO devices (id, firebase_id, name, model, status, battery, signal, last_seen, created_at, sim_count, has_recharge, sim1_recharge, sim2_recharge)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name, model=excluded.model, status=excluded.status, battery=excluded.battery, signal=excluded.signal, last_seen=excluded.last_seen
        `)
        const txn = db.transaction(() => {
          for (const d of devices) {
            // normalize busy: if Firebase status is true but webhook pending, mark busy, else online
            if(d.status==='busy' && !d.name.includes('pending')) d.status='online'
            // preserve existing sim_count/has_recharge if already set
            const existing = db.prepare('SELECT sim_count, has_recharge, sim1_recharge, sim2_recharge FROM devices WHERE id=?').get(d.id) as any
            const simCount = existing?.sim_count ?? defaultSim
            const hasRec = existing?.has_recharge ?? 1
            const s1 = existing?.sim1_recharge ?? 1
            const s2 = existing?.sim2_recharge ?? 1
            upsert.run(d.id, fb.id, d.name, d.model || null, d.status, d.battery ?? null, d.signal ?? null, d.last_seen || now, now, simCount, hasRec, s1, s2)
          }
        })
        txn()
        const fbStatus = devices.length===0 ? 'offline' : 'online'
        db.prepare('UPDATE firebases SET device_count=?, status=? WHERE id=?').run(devices.length, fbStatus, fb.id)
        if (io) {
          io.emit('devices:update', { firebaseId: fb.id, count: devices.length, devices: devices.slice(0, 8) })
          io.emit('firebases:update', { id: fb.id, device_count: devices.length, status: 'online' })
        }
      } catch (e: any) {
        db.prepare('UPDATE firebases SET status=? WHERE id=?').run('offline', fb.id)
        if (io) io.emit('firebases:update', { id: fb.id, status: 'offline', error: e.message })
      }
    }))
  }
  if (io) {
    const stats = db.prepare(`SELECT 
      (SELECT COUNT(*) FROM devices WHERE status='online') as online,
      (SELECT COUNT(*) FROM devices WHERE status='offline') as offline,
      (SELECT COUNT(*) FROM devices WHERE status='busy') as busy,
      (SELECT COUNT(*) FROM devices) as total
    `).get() as any
    io.emit('stats:devices', stats)
  }
}
