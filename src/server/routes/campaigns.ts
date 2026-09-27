import { Router } from 'express'
import { db } from '../db/index.js'
import { authRequired } from '../middleware/auth.js'
import * as queueService from '../services/queueService.js'

const router = Router()
router.use(authRequired as any)

function generateSimplePdf(campaign:any, messages:any[]): Buffer {
  const lines: string[] = []
  lines.push(`Campaign: ${campaign.name} (${campaign.id})`)
  lines.push(`Status: ${campaign.status} | Total: ${campaign.total} | Sent: ${campaign.sent} | Failed: ${campaign.failed} | Pending: ${campaign.pending}`)
  lines.push(`Template: ${campaign.template.slice(0,120)}`)
  lines.push(`Created: ${campaign.created_at} | Finished: ${campaign.finished_at||'-'}`)
  lines.push('')
  lines.push('Messages (phone, status, device, sent_at, error):')
  for(const m of messages.slice(0,600)){
    const err=(m.last_error||'').replace(/[\r\n]+/g,' ').slice(0,40)
    lines.push(`${m.phone}, ${m.status}, ${m.device_id||'-'}, ${m.sent_at||'-'}, ${err}`)
  }
  if(messages.length>600) lines.push(`... and ${messages.length-600} more`)
  const content = lines.map((l,idx)=> `BT /F1 8 Tf 40 ${770 - idx*10} Td (${l.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').slice(0,110)}) Tj ET`).join('\n')
  const stream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  const objs = [
    `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`,
    `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`,
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >> endobj`,
    `4 0 obj ${stream} endobj`,
  ]
  let pdf = `%PDF-1.4\n`
  const offs: number[] = []
  for(const o of objs){ offs.push(pdf.length); pdf += o + '\n' }
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length+1}\n0000000000 65535 f \n`
  for(const o of offs) pdf += `${String(o).padStart(10,'0')} 00000 n \n`
  pdf += `trailer << /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all()
  res.json(rows)
})

router.post('/', async (req, res) => {
  const { name, template, contacts, contactsText, batch_size, delay_ms } = req.body || {}
  if (!name || !template) return res.status(400).json({ error: 'name & template required' })

  let contactList: Array<{ phone: string; vars?: Record<string,string> }> = contacts || []
  if (contactsText && typeof contactsText === 'string') {
    let lines = contactsText.split(/[\r\n;]+/).map((l:string)=>l.trim()).filter(Boolean)
    // header detection: if first line looks like header (contains phone/vehicle/name without digits)
    let headers: string[] | null = null
    if(lines.length>0){
      const first = lines[0].toLowerCase()
      const hasHeader = (first.includes('phone') || first.includes('vehicle') || first.includes('vehical') || first.includes('name')) && !/^\+?[0-9]/.test(lines[0].split(',')[0].trim())
      if(hasHeader){
        headers = lines[0].split(',').map(s=>s.trim().toLowerCase())
        lines = lines.slice(1)
      }
    }
    for (const line of lines) {
      const parts = line.split(',').map((s:string)=>s.trim())
      if (!parts[0]) continue
      // auto-detect phone column: find part matching phone regex
      let phoneIdx = 0
      let phone = parts[0]
      if(headers){
        const pIdx = headers.findIndex(h=> h.includes('phone'))
        if(pIdx>=0) { phoneIdx = pIdx; phone = parts[pIdx] }
        // fallback auto-detect
        if(!/^\+?[0-9]{7,15}$/.test(phone.replace(/\s/g,''))){
          for(let i=0;i<parts.length;i++) if(/^\+?[0-9]{7,15}$/.test(parts[i].replace(/\s/g,''))){ phoneIdx=i; phone=parts[i]; break }
        }
      } else {
        // without header, first col is phone
        phone = parts[0]
      }
      const vars: Record<string,string> = {}
      if(headers){
        headers.forEach((h, idx)=>{
          if(idx===phoneIdx) return
          const val = parts[idx] || ''
          if(!val) return
          vars[h] = val
          // alias
          if(h==='vehicle') { vars.vehical = val; vars.vehicle = val }
          if(h==='vehical') { vars.vehicle = val; vars.vehical = val }
        })
        // ensure name fallback
        if(!vars.name && (vars.vehicle || vars.vehical)) vars.name = vars.vehicle || vars.vehical
        if(!vars.vehicle && vars.name) { vars.vehicle = vars.name; vars.vehical = vars.name }
      } else {
        const second = parts[1] || ''
        if(second){
          vars.name = second
          vars.vehicle = second
          vars.vehical = second
          if(parts[2]) { vars.vehicle = parts[2]; vars.vehical = parts[2] }
        }
      }
      contactList.push({ phone, vars })
    }
  }
  if (contactList.length === 0) return res.status(400).json({ error: 'At least one contact required — phone numbers se web banao!' })

  try {
    const result = await queueService.createCampaign({ name, template, contacts: contactList, batch_size, delay_ms })
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id=?').get(result.id)
    res.status(201).json({ campaign, ...result })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id) as any
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(row)
})

router.get('/:id/messages', (req, res) => {
  const { status, limit = 100, offset = 0 } = req.query as any
  let sql = 'SELECT * FROM campaign_messages WHERE campaign_id = ?'
  const params: any[] = [req.params.id]
  if (status) { sql += ' AND status = ?'; params.push(status) }
  sql += ' ORDER BY sent_at DESC, created_at DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))
  const rows = db.prepare(sql).all(...params)
  const total = (db.prepare('SELECT COUNT(*) as c FROM campaign_messages WHERE campaign_id=?').get(req.params.id) as any).c
  res.json({ messages: rows, total })
})

router.get('/:id/export', (req, res)=>{
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id) as any
  if(!campaign) return res.status(404).json({ error:'Not found' })
  const format = ((req.query.format as string)||'csv').toLowerCase()
  const messages = db.prepare('SELECT phone, status, device_id, firebase_id, attempts, last_error, sent_at, rendered, variables FROM campaign_messages WHERE campaign_id=? ORDER BY sent_at, created_at').all(req.params.id) as any[]
  if(format==='csv'){
    const header=['phone','status','device_id','firebase_id','attempts','last_error','sent_at','rendered']
    const rows=messages.map((m:any)=> header.map(h=>{
      let v=m[h]??''
      v=String(v).replace(/"/g,'""').replace(/\r?\n/g,' ')
      if(v.includes(',')||v.includes('"')||v.includes('\n')) v=`"${v}"`
      return v
    }).join(','))
    const csv=[header.join(','), ...rows].join('\n')
    res.setHeader('Content-Type','text/csv; charset=utf-8')
    res.setHeader('Content-Disposition',`attachment; filename="campaign-${campaign.id}.csv"`)
    return res.send(csv)
  } else if(format==='pdf'){
    const pdf=generateSimplePdf(campaign, messages)
    res.setHeader('Content-Type','application/pdf')
    res.setHeader('Content-Disposition',`attachment; filename="campaign-${campaign.id}.pdf"`)
    return res.send(pdf)
  } else return res.status(400).json({ error:'format must be csv or pdf' })
})

router.post('/:id/notify-webhook', async (req,res)=>{
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id) as any
  if(!campaign) return res.status(404).json({ error:'Not found' })
  const url = (db.prepare("SELECT value FROM settings WHERE key='webhook_url'").get() as any)?.value
  const enabled = (db.prepare("SELECT value FROM settings WHERE key='webhook_enabled'").get() as any)?.value === 'true'
  if(!enabled || !url) return res.status(400).json({ error:'Webhook not enabled/configured in Settings' })
  const secret = (db.prepare("SELECT value FROM settings WHERE key='webhook_secret'").get() as any)?.value || ''
  try{
    const payload={ event:'campaign.manual_notify', campaign, sent: campaign.sent, failed: campaign.failed, total: campaign.total }
    // @ts-ignore
    const r=await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', ...(secret?{'X-Webhook-Secret':secret}:{}) }, body: JSON.stringify(payload) })
    const text=await r.text().catch(()=>'')
    res.json({ ok:true, status: r.status, response: text.slice(0,500), url })
  }catch(e:any){ res.status(500).json({ error: e.message })}
})

router.post('/bulk-delete', (req, res)=>{
  const { ids } = req.body || {}
  if(!Array.isArray(ids)) return res.status(400).json({ error:'ids array required' })
  let deleted=0
  const txn=db.transaction(()=>{
    for(const id of ids){
      const r=db.prepare('DELETE FROM campaigns WHERE id=?').run(id)
      deleted+= r.changes
    }
  })
  txn()
  res.json({ deleted })
})

router.post('/:id/start', async (req, res) => {
  const r = await queueService.startCampaign(req.params.id)
  if (!r.ok) return res.status(400).json(r)
  res.json({ ok: true, message: 'Campaign launched — thwip! 🕸️' })
})
router.post('/:id/pause', async (req, res) => {
  const c = await queueService.pauseCampaign(req.params.id)
  res.json(c)
})
router.post('/:id/resume', async (req, res) => {
  const r = await queueService.resumeCampaign(req.params.id)
  if (!r.ok) return res.status(400).json(r)
  res.json({ ok: true })
})
router.post('/:id/cancel', async (req, res) => {
  const c = await queueService.cancelCampaign(req.params.id)
  res.json(c)
})
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM campaigns WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

export default router
