import { Router } from 'express'
import { db, getSetting, setSetting } from '../db/index.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()
router.use(authRequired as any)

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value, updated_at FROM settings').all()
  const obj: Record<string, string> = {}
  for (const r of rows as any[]) obj[r.key] = r.value
  res.json(obj)
})

router.put('/', (req, res) => {
  const body = req.body || {}
  const numericKeys=['poll_interval_ms','dispatch_batch_size','dispatch_delay_ms','ack_timeout_ms','max_sms_per_device_per_day','per_sim_limit','hive_concurrency','auto_delete_completed_after_days','today_start_hour']
  for (let [k, v] of Object.entries(body)){
    let s=String(v).trim()
    if(numericKeys.includes(k)){ const n=parseInt(s,10); if(isNaN(n) || n<0){ return res.status(400).json({error:`Invalid ${k}: must be number >=0`}) } s=String(n) }
    if(k==='speed_profile' && !['slow','balanced','fast','turbo','beast','ultra'].includes(s)) return res.status(400).json({error:'Invalid speed_profile'})
    if(k==='check_recharge' && !['true','false'].includes(s)) return res.status(400).json({error:'Invalid check_recharge'})
    setSetting(k, s)
  }
  const rows = db.prepare('SELECT key, value FROM settings').all() as any[]
  const obj: Record<string,string> = {}
  for (const r of rows) obj[r.key] = r.value
  res.json(obj)
})

router.post('/test-webhook', async (_req,res)=>{
  const url = (getSetting('webhook_url')||'').trim()
  const secret = getSetting('webhook_secret')||''
  if(!url) return res.status(400).json({ error:'webhook_url not set in Settings' })
  try{ new URL(url) }catch{ return res.status(400).json({ error:'Invalid webhook_url' }) }
  try{
    const payload={ event:'test.webhook', message:'BHNSTOCK test webhook — Brand New Day', time: new Date().toISOString(), service:'BHNSTOCK SMS SPREADER 3D WEB' }
    // @ts-ignore global fetch
    const r=await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', ...(secret?{'X-Webhook-Secret':secret}:{}) }, body: JSON.stringify(payload) })
    const text=await r.text().catch(()=>'')
    res.json({ ok:true, status: r.status, response: text.slice(0,800), url })
  }catch(e:any){ res.status(500).json({ error: e.message })}
})

export default router
