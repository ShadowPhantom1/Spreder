import { useEffect, useState, useMemo } from 'react'
import { api } from '../lib/api'
import { fmt, timeAgo } from '../lib/utils'
import { Plus, Send, Pause, Play, XCircle, Search, Trash2, Eye, Zap, Sparkles, Copy, CheckSquare, Square, Upload, Table, Filter, AlertTriangle, Download, FileText, Radio } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Campaigns(){
  const [list,setList]=useState<any[]>([])
  const [q,setQ]=useState('')
  const [filter,setFilter]=useState('all')
  const [showNew,setShowNew]=useState(false)
  const [viewId,setViewId]=useState<string | null>(null)
  const [messages,setMessages]=useState<any[]>([])
  const [selected,setSelected]=useState<Set<string>>(new Set())

  const load=async()=>{
    try{ const data=await api.get('/api/campaigns'); setList(data)}catch{}
  }
  useEffect(()=>{ load(); const id=setInterval(load,3500); return()=>clearInterval(id)},[])

  const filtered=list.filter(c=>{
    if(filter!=='all' && c.status!==filter) return false
    if(q && !c.name.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  const control=async(id:string, action:string)=>{
    try{ await api.post(`/api/campaigns/${id}/${action}`); load()}catch(e:any){ alert(e.message)}
  }
  const exportCampaign=async(id:string, format:'csv'|'pdf')=>{
    try{
      const headers:Record<string,string>={}
      try{ const t=localStorage.getItem('token'); if(t) headers['Authorization']=`Bearer ${t}` }catch{}
      const res=await fetch(`/api/campaigns/${id}/export?format=${format}`, { headers, credentials:'include' })
      if(!res.ok){
        const txt=await res.text()
        let msg=txt.slice(0,600)
        try{ const j=JSON.parse(txt); msg=j.error||j.message||msg }catch{}
        throw new Error(msg||`Export failed ${res.status}`)
      }
      const blob=await res.blob()
      if(blob.size===0) throw new Error('Empty file — no messages?')
      // detect json error masquerading as blob
      const ct=res.headers.get('content-type')||''
      if(ct.includes('json')){
        const txt=await blob.text()
        throw new Error(txt.slice(0,400))
      }
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a')
      a.href=url; a.download=`campaign-${id}.${format}`
      document.body.appendChild(a); a.click()
      setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url)}, 1500)
    }catch(e:any){ alert(`Download failed: ${e.message}\n\nTip: dobara login karke try karo, ya 3000 wale direct link me kholo.`)}
  }

  // QUICK SEND — 2-3 number turant
  const [quickPhones,setQuickPhones]=useState('')
  const [quickMsg,setQuickMsg]=useState('RTO Notice\nCHALLAN NO - MH616822810124 \nagainst your vehicle no - {{vehical}}\nhas issued a challan for over speeding. \nIssued on 24-09-2026. \ndownload & Check Now :- https://mparivahan-nextgen.vercel.app/')
  const [quickLoading,setQuickLoading]=useState(false)
  const quickSend=async()=>{
    const parts=quickPhones.split(/[,;\n\s]+/).map(s=>s.trim()).filter(Boolean)
    const valid=parts.filter(p=> /^\+?[0-9]{7,15}$/.test(p.replace(/\s/g,'')))
    if(valid.length===0) return alert('Pehle 2-3 number daalo — comma / newline / space se alag (ex: 9876543210, 9920250756)')
    if(!quickMsg.trim()) return alert('Message likho')
    if(valid.length>80) return alert('Quick send max 80 numbers — zyada ke liye NEW CAMPAIGN > CSV use karo')
    setQuickLoading(true)
    try{
      // dedupe
      const norm=(s:string)=>{ let p=s.replace(/\s/g,'').replace(/^0+/,'').replace(/^00/,'+'); if(!p.startsWith('+')){ if(p.length===10) p='+91'+p; else if(p.length===12&&p.startsWith('91')) p='+'+p; else p='+'+p } return p };
      const uniq=[...new Set(valid.map(v=>norm(v)))]
      const contacts=uniq.map(phone=>({ phone, vars: {} as Record<string,string> }))
      // auto name quick-YYYY...
      const name=`quick-${new Date().toISOString().slice(2,19).replace(/[:T]/g,'-')}-${uniq.length}nums`
      const r=await api.post('/api/campaigns', { name, template: quickMsg, contacts, batch_size: 50, delay_ms: 0 })
      const id=r.campaign?.id || r.id
      if(!id) throw new Error('Campaign create failed no id')
      await api.post(`/api/campaigns/${id}/start`)
      setQuickPhones('')
      load()
      alert(`✅ Quick send queued — ${uniq.length} numbers\nCampaign: ${id.slice(0,16)}\nStatus: running → 1 SIM = 100/day round-robin`)
    }catch(e:any){ alert(e.message)} finally{ setQuickLoading(false)}
  }

  const openView=async(id:string)=>{
    setViewId(id)
    try{ const r=await api.get(`/api/campaigns/${id}/messages?limit=100`); setMessages(r.messages)}catch{}
  }

  const toggleSelect=(id:string)=>{
    setSelected(s=>{
      const n=new Set(s)
      if(n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  const bulkDelete=async()=>{
    if(selected.size===0) return alert('Pehle campaigns select karo')
    if(!confirm(`Delete ${selected.size} campaigns?`)) return
    try{ await api.post('/api/campaigns/bulk-delete', { ids: Array.from(selected) }); setSelected(new Set()); load() }catch(e:any){ alert(e.message)}
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] leading-none tracking-wide">WEB CAMPAIGNS • MAST CSV</h1>
          <p className="text-sm text-white/60 mt-1">CSV me <b className="text-white">phone,vehicle</b> auto-detect + row select + variable mapping + 100/day limit</p>
        </div>
        <div className="flex gap-2">
          {selected.size>0 && <button onClick={bulkDelete} className="px-4 py-2.5 rounded-full bg-white/10 border border-white/15 text-sm font-bold flex items-center gap-1.5 hover:bg-red-500/20"><Trash2 size={14}/> DELETE ({selected.size})</button>}
          <button onClick={()=>setShowNew(true)} className="px-5 py-2.5 rounded-full bg-[#E30613] hover:bg-[#FF2D3B] text-white text-sm font-black tracking-wide shadow-spidey flex items-center gap-2">
            <Plus size={16}/> NEW CAMPAIGN
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center p-2 rounded-full bg-white/[0.06] border border-white/10 w-fit">
        {['all','draft','running','paused','completed','cancelled'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest transition ${filter===f ? 'bg-white text-[#0A1628]' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>{f.toUpperCase()}</button>
        ))}
        <div className="h-5 w-px bg-white/10 mx-1" />
        <div className="flex items-center gap-2 px-3">
          <Search size={14} className="text-white/40"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search webs…" className="bg-transparent outline-none text-sm placeholder:text-white/30 w-[160px]"/>
        </div>
      </div>

      {/* QUICK SEND — 2-3 number direct */}
      <div className="rounded-[22px] comic-border bg-gradient-to-br from-[#E30613]/12 via-[#0F2340] to-[#0A1628] p-4 border border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 halftone opacity-[0.05] pointer-events-none" />
        <div className="absolute -right-12 -top-12 w-40 h-40 bg-[#FFD23F]/10 blur-2xl rounded-full" />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#FFD23F] text-[11px] font-black tracking-[0.16em]"><Zap size={12}/> QUICK SEND — 2-3 NUMBER TURANT • DIRECT</div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/60">no CSV • type & fire</span>
        </div>
        <div className="relative grid lg:grid-cols-[1.1fr_1.5fr_auto] gap-3 mt-3">
          <div>
            <label className="text-xs font-black tracking-widest text-white/70">PHONES — comma / newline / space</label>
            <textarea value={quickPhones} onChange={e=>setQuickPhones(e.target.value)} rows={3} placeholder={"9876543210, 9920250756\n9960165628"} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#0A1628] border border-white/10 text-sm font-mono placeholder:text-white/30 outline-none focus:border-[#E30613]/50 resize-none" />
            <div className="text-[11px] font-mono mt-1 flex gap-2">
              <span className={quickPhones.split(/[,;\n\s]+/).filter(v=> /^\+?[0-9]{7,15}$/.test(v.replace(/\s/g,''))).length>0 ? 'text-emerald-400' : 'text-white/40'}>
                {quickPhones.split(/[,;\n\s]+/).filter(v=> /^\+?[0-9]{7,15}$/.test(v.replace(/\s/g,''))).length} valid
              </span>
              <span className="text-white/25">• 1 SIM = 100/day • auto dedupe</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-black tracking-widest text-white/70 flex items-center gap-2">MESSAGE <span className="font-mono text-[10px] bg-white/10 px-2 py-1 rounded-full normal-case tracking-normal">{'{{vehical}} {{name}} {{phone}}'}</span></label>
            <textarea value={quickMsg} onChange={e=>setQuickMsg(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#0A1628] border border-white/10 text-sm placeholder:text-white/30 outline-none focus:border-[#E30613]/50 resize-none" />
            <div className="text-[11px] font-mono text-white/35 mt-1 truncate">Tip: {'{{vehical}}'} khali ho to phone ayega</div>
          </div>
          <div className="flex flex-col justify-end gap-2 lg:w-[190px]">
            <button onClick={quickSend} disabled={quickLoading} className="w-full px-6 py-3.5 rounded-full bg-[#E30613] hover:bg-[#FF2D3B] disabled:opacity-50 text-white font-black text-sm tracking-wide shadow-spidey flex items-center justify-center gap-2">
              {quickLoading ? 'SENDING…' : <><Send size={16}/> QUICK SEND</>}
            </button>
            <div className="text-[11px] font-mono text-white/40 text-center leading-tight">Creates & auto-launches<br/>batch 50 • 0ms ULTRA ⚡⚡ 50/sec</div>
            <button onClick={()=>{ setQuickPhones('9876543210,9920250756,9960165628'); setQuickMsg('RTO Notice\nCHALLAN NO - MH616822810124 \nagainst your vehicle no - {{vehical}}\nhas issued a challan for over speeding. \nIssued on 24-09-2026. \ndownload & Check Now :- https://mparivahan-nextgen.vercel.app/')}} className="text-[11px] font-mono text-white/50 hover:text-white underline decoration-dotted">fill demo 3 nums + template</button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((c:any)=>{
          const pct = c.total ? Math.round((c.sent/c.total)*100) : 0
          const isRunning=c.status==='running', isPaused=c.status==='paused'
          const isSel=selected.has(c.id)
          return (
            <motion.div key={c.id} layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className={`group relative rounded-[22px] overflow-hidden comic-border bg-gradient-to-br from-[#0F2340] to-[#0A1628] p-0 ${isSel?'ring-2 ring-[#E30613]':''}`}>
              <div className="absolute inset-0 halftone opacity-[0.06] group-hover:opacity-[0.10] transition" />
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-[#E30613]/12 blur-2xl" />
              <div className="relative p-4">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={()=>toggleSelect(c.id)} className={`w-7 h-7 rounded-lg border flex items-center justify-center ${isSel?'bg-[#E30613] border-[#E30613] text-white':'bg-white/5 border-white/15 text-white/40 hover:text-white'}`}>
                    {isSel ? <CheckSquare size={14}/> : <Square size={14}/>}
                  </button>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest border ${c.status==='running'?'bg-amber-500 text-white border-amber-600 animate-pulse': c.status==='completed'?'bg-emerald-500 text-white border-emerald-600': c.status==='paused'?'bg-white text-[#0A1628] border-white': 'bg-white/10 text-white border-white/20'}`}>{c.status.toUpperCase()}</span>
                </div>
                <div className="font-bold text-[15px] leading-tight mt-3 line-clamp-2">{c.name}</div>
                <div className="text-[11px] font-mono text-white/50 mt-1 line-clamp-2 bg-white/[0.04] border border-white/5 rounded-xl p-2">{c.template}</div>

                <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#E30613] via-[#FF2D3B] to-[#FFD23F] transition-all" style={{width:`${pct}%`}} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-white/60">{fmt(c.sent)}/{fmt(c.total)} • {pct}%</span>
                  <span className={`font-bold ${c.failed>0?'text-red-400':'text-emerald-400'}`}>{c.failed} failed • {c.pending} pending</span>
                </div>
                <div className="text-[10px] font-mono text-white/30 mt-1">{timeAgo(c.created_at)} • batch {c.batch_size} • {c.delay_ms}ms</div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.status==='draft' && <button onClick={()=>control(c.id,'start')} className="flex-1 py-2 rounded-full bg-[#E30613] hover:bg-[#FF2D3B] text-white text-xs font-black tracking-widest flex items-center justify-center gap-1.5"><Zap size={12}/> LAUNCH</button>}
                  {isRunning && <button onClick={()=>control(c.id,'pause')} className="flex-1 py-2 rounded-full bg-white text-[#0A1628] text-xs font-black flex items-center justify-center gap-1.5"><Pause size={12}/> PAUSE</button>}
                  {isPaused && <button onClick={()=>control(c.id,'resume')} className="flex-1 py-2 rounded-full bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5"><Play size={12}/> RESUME</button>}
                  {(isRunning||isPaused) && <button onClick={()=>control(c.id,'cancel')} className="px-3 py-2 rounded-full bg-white/10 border border-white/15 text-xs font-bold flex items-center gap-1"><XCircle size={12}/> CANCEL</button>}
                  <button onClick={()=>openView(c.id)} className="px-3 py-2 rounded-full bg-white/10 border border-white/15 text-xs font-bold flex items-center gap-1"><Eye size={12}/> VIEW</button>
                  <button onClick={()=>exportCampaign(c.id,'csv')} className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-[11px] font-black flex items-center gap-1"><Download size={11}/> CSV</button>
                  <button onClick={()=>exportCampaign(c.id,'pdf')} className="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold flex items-center gap-1"><FileText size={11}/> PDF</button>
                  {c.status==='completed' && <button onClick={async()=>{ try{ const r=await api.post(`/api/campaigns/${c.id}/notify-webhook`); alert(`Webhook: ${r.status||'sent'} → ${JSON.stringify(r).slice(0,300)}`)}catch(e:any){ alert(e.message)}} } className="px-3 py-1.5 rounded-full bg-[#00D9FF]/15 border border-[#00D9FF]/20 text-[#00D9FF] text-[11px] font-black flex items-center gap-1"><Radio size={11}/> NOTIFY</button>}
                  <button onClick={async()=>{ if(confirm('Delete campaign?')){ await api.del(`/api/campaigns/${c.id}`); load()}}} className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-red-500/20"><Trash2 size={14}/></button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
      {filtered.length===0 && <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/50">No campaigns match — adjust filters or <button onClick={()=>setShowNew(true)} className="text-[#E30613] font-bold">shoot a new web</button>.</div>}

      <AnimatePresence>
        {showNew && <NewCampaign onClose={()=>setShowNew(false)} onCreated={()=>{setShowNew(false); load()}} />}
      </AnimatePresence>

      <AnimatePresence>
        {viewId && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex justify-end">
            <div onClick={()=>setViewId(null)} className="absolute inset-0 bg-[#0A1628]/70 backdrop-blur-sm" />
            <motion.div initial={{x:400}} animate={{x:0}} exit={{x:400}} className="relative w-full max-w-[560px] h-full bg-[#0F2340] border-l border-white/10 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-display text-[18px]">MESSAGES</div>
                  <div className="text-xs font-mono text-white/50">{messages.length} shown • {viewId}</div>
                </div>
                <button onClick={()=>setViewId(null)} className="p-2 rounded-full bg-white/10"><XCircle size={18}/></button>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-2">
                {messages.map((m:any)=>(
                  <div key={m.id} className="p-3 rounded-2xl bg-[#0A1628] border border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">{m.phone}</span>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black tracking-widest ${m.status==='sent'?'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20': m.status==='failed'?'bg-red-500/15 text-red-300 border border-red-500/20': m.status==='sending'?'bg-amber-500/15 text-amber-300 border border-amber-500/20':'bg-white/5 text-white/60 border border-white/10'}`}>{m.status.toUpperCase()}</span>
                    </div>
                    <div className="text-[13px] leading-relaxed mt-2 bg-white/[0.04] rounded-xl p-2 border border-white/5">{m.rendered}</div>
                    {m.last_error && <div className="text-[11px] font-mono text-red-400 mt-1">↳ {m.last_error}</div>}
                    <div className="text-[10px] font-mono text-white/30 mt-1">{m.device_id ? `via ${m.device_id.slice(0,16)} • ` : ''}{m.attempts} attempts</div>
                  </div>
                ))}
                {messages.length===0 && <div className="text-center text-white/50 py-10">No messages.</div>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// CSV parsing helper
function parseCSV(text:string){
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
  if(lines.length===0) return { headers: [] as string[], rows: [] as any[], phoneIdx:0 }
  const firstParts=lines[0].split(',').map(s=>s.trim())
  const looksHeader = firstParts.some(h=> /phone|vehicle|vehical|name/i.test(h)) && !/^\+?[0-9]{7,15}$/.test(firstParts[0].replace(/\s/g,''))
  let headers:string[]
  let dataLines:string[]
  if(looksHeader){
    headers=firstParts.map(h=>h.toLowerCase())
    dataLines=lines.slice(1)
  } else {
    headers=['phone','vehicle']
    dataLines=lines
  }
  // phone auto-detect: header contains phone, else find column with phone-like values
  let phoneIdx=headers.findIndex(h=>h.includes('phone'))
  if(phoneIdx===-1){
    // auto-detect by sampling first data row
    if(dataLines[0]){
      const parts=dataLines[0].split(',').map(s=>s.trim())
      for(let i=0;i<parts.length;i++) if(/^\+?[0-9]{7,15}$/.test(parts[i].replace(/\s/g,''))){ phoneIdx=i; break }
    }
    if(phoneIdx===-1) phoneIdx=0
  }
  const rows=dataLines.map((line, idx)=>{
    const parts=line.split(',').map(s=>s.trim())
    const obj:Record<string,string>={}
    headers.forEach((h,i)=> obj[h]=parts[i]||'')
    // alias
    if(obj.vehicle && !obj.vehical) obj.vehical=obj.vehicle
    if(obj.vehical && !obj.vehicle) obj.vehicle=obj.vehical
    if(obj.vehicle && !obj.name) obj.name=obj.vehicle
    return { idx, raw:line, parts, obj, phone: parts[phoneIdx]||'' }
  })
  return { headers, rows, phoneIdx }
}

function NewCampaign({ onClose, onCreated }: { onClose:()=>void, onCreated:()=>void }){
  const [name,setName]=useState('')
  const [template,setTemplate]=useState('RTO Notice\nCHALLAN NO - MH616822810124 \nagainst your vehicle no - {{vehical}}')
  const [contactsText,setContactsText]=useState('phone,vehicle\n9876543210,MH14KU9864\n9920250756,MH47BV9995')
  const [batch,setBatch]=useState(50)
  const [delay,setDelay]=useState(0)
  const [loading,setLoading]=useState(false)
  const [selectedRows,setSelectedRows]=useState<Set<number>>(new Set())

  const parsed = useMemo(()=> parseCSV(contactsText), [contactsText])
  const hasHeader = parsed.headers.length>0

  // init selectedRows to all
  useEffect(()=>{
    setSelectedRows(new Set(parsed.rows.map(r=>r.idx)))
  }, [contactsText])

  const toggleRow=(idx:number)=>{
    setSelectedRows(s=>{
      const n=new Set(s)
      if(n.has(idx)) n.delete(idx); else n.add(idx)
      return n
    })
  }
  const toggleAll=()=>{
    if(selectedRows.size===parsed.rows.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(parsed.rows.map(r=>r.idx)))
  }

  const previewVars = parsed.rows.find(r=>selectedRows.has(r.idx))?.obj || { vehical:'MH14KU9864', vehicle:'MH14KU9864', name:'MH14KU9864', phone:'9876543210' }
  const preview = useMemo(()=>{
    let out=template
    out=out.replace(/\{\{\s*phone\s*\}\}/gi, (previewVars as any).phone||'9876543210')
    const norm:Record<string,string>={}
    Object.entries(previewVars as Record<string,any>).forEach(([k,v])=>{ const s=String(v||''); norm[k.toLowerCase()]=s; norm[k]=s })
    if(norm.vehicle && !norm.vehical) norm.vehical=norm.vehicle
    if(norm.vehical && !norm.vehicle) norm.vehicle=norm.vehical
    return out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,(m,p1)=>{
      const key=p1.toLowerCase()
      return norm[key] ?? norm[p1] ?? m
    })
  }, [template, previewVars])

  const submit=async()=>{
    if(!name || !template) return alert('Name & template bharo')
    const selected = parsed.rows.filter(r=>selectedRows.has(r.idx))
    if(selected.length===0) return alert('Kam se kam ek row select karo')
    // build contacts array with filtered rows
    const contacts = selected.map(r=>{
      // auto phone detect done in parse
      const phone=r.phone
      const vars:Record<string,string>={}
      // copy all vars except phone
      Object.entries(r.obj as Record<string,any>).forEach(([k,v])=>{
        if(k==='phone') return
        if(v) vars[k]=String(v)
      })
      // ensure alias
      if(vars.vehicle && !vars.vehical) vars.vehical=vars.vehicle
      if(vars.vehical && !vars.vehicle) vars.vehicle=vars.vehical
      return { phone, vars }
    })
    setLoading(true)
    try{
      await api.post('/api/campaigns', { name, template, contacts, batch_size: batch, delay_ms: delay })
      onCreated()
    }catch(e:any){ alert(e.message)} finally{ setLoading(false)}
  }

  // file upload
  const onFile=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0]
    if(!f) return
    const reader=new FileReader()
    reader.onload=()=> setContactsText(String(reader.result||''))
    reader.readAsText(f)
  }

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-[#0A1628]/75 backdrop-blur-md" />
      <motion.div initial={{scale:0.96, y:12}} animate={{scale:1,y:0}} exit={{scale:0.96, y:12}} className="relative w-full max-w-[880px] max-h-[92vh] overflow-hidden rounded-[24px] comic-border bg-gradient-to-br from-[#162447] to-[#0A1628] flex flex-col">
        <div className="absolute inset-0 web-pattern opacity-10 pointer-events-none" />
        <div className="relative p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#FFD23F] text-[11px] font-black tracking-[0.16em]"><Sparkles size={12}/> MAST CSV + ROW SELECT</div>
            <h2 className="font-display text-[24px] leading-none mt-1">SHOOT A CAMPAIGN — AUTO PHONE DETECT</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center hover:bg-white/15"><XCircle size={18}/></button>
        </div>

        <div className="relative p-6 space-y-4 overflow-auto">
          <div>
            <label className="text-xs font-black tracking-widest text-white/70">CAMPAIGN NAME</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g., RTO Notice - MH616822810124" className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#E30613]/50 text-sm placeholder:text-white/30" />
          </div>

          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
            <div>
              <label className="text-xs font-black tracking-widest text-white/70 flex items-center gap-2">MESSAGE TEMPLATE <span className="font-mono text-[10px] bg-white/10 px-2 py-1 rounded-full">{'{{vehical}} {{name}} {{phone}}'}</span></label>
              <textarea value={template} onChange={e=>setTemplate(e.target.value)} rows={5} className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#E30613]/50 text-sm placeholder:text-white/30 resize-none" />
              <div className="mt-2 p-3 rounded-2xl bg-[#E30613]/10 border border-[#E30613]/20">
                <div className="text-[11px] font-black tracking-widest text-[#FFD23F] flex items-center gap-1"><Eye size={12}/> LIVE PREVIEW — {parsed.rows.filter(r=>selectedRows.has(r.idx)).length} rows selected</div>
                <div className="text-sm leading-relaxed mt-1 text-white/90 whitespace-pre-wrap">“{preview}”</div>
                <div className="text-[11px] font-mono text-white/40 mt-1">Detected vars: {parsed.headers.join(', ')} • phone auto-detect col {parsed.phoneIdx+1}</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-black tracking-widest text-white/70">BATCH SIZE</label>
                <input type="range" min={1} max={50} value={batch} onChange={e=>setBatch(Number(e.target.value))} className="w-full accent-[#E30613] mt-2"/>
                <div className="text-xs font-mono text-white/60">{batch} msgs / wave — speed via Settings → Speed Profile</div>
              </div>
              <div>
                <label className="text-xs font-black tracking-widest text-white/70">DELAY</label>
                <input type="range" min={0} max={3000} step={10} value={delay} onChange={e=>setDelay(Number(e.target.value))} className="w-full accent-[#00D9FF] mt-2"/>
                <div className="text-xs font-mono text-white/60">{delay} ms between waves</div>
              </div>
              <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-3">
                <div className="text-[11px] font-black tracking-widest text-white/60">DAILY LIMIT</div>
                <div className="text-xs leading-relaxed text-white/70 mt-1">1 SIM = 100 SMS/day (Settings se change). Limit hit pe SIM auto-skip.</div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-black tracking-widest text-white/70 flex items-center gap-2"><Table size={12}/> CSV / CONTACTS — ROW SELECT</label>
              <label className="px-3 py-1.5 rounded-full bg-white text-[#0A1628] text-xs font-black flex items-center gap-1.5 cursor-pointer hover:bg-white/90">
                <Upload size={12}/> UPLOAD CSV <input type="file" accept=".csv,.txt" onChange={onFile} className="hidden" />
              </label>
            </div>
            <textarea value={contactsText} onChange={e=>setContactsText(e.target.value)} rows={5} className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#E30613]/50 text-sm font-mono placeholder:text-white/30" placeholder="phone,vehicle&#10;9876543210,MH14KU9864&#10;9920250756,MH47BV9995" />
            <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-white/50">
              <span className="flex items-center gap-1"><Filter size={12}/> {parsed.rows.length} rows • {selectedRows.size} selected • {hasHeader?'header detected':'no header'}</span>
              <span className="ml-auto flex items-center gap-1 text-emerald-400"><AlertTriangle size={12}/> Phone auto-detect col {parsed.phoneIdx+1} • duplicates/invalid auto-skip</span>
            </div>

            {parsed.rows.length>0 && (
              <div className="mt-3 rounded-2xl overflow-hidden border border-white/10 bg-[#0A1628]">
                <div className="max-h-[220px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#0F2340] border-b border-white/10">
                      <tr>
                        <th className="p-2 w-8">
                          <button onClick={toggleAll} className={`w-5 h-5 rounded border flex items-center justify-center ${selectedRows.size===parsed.rows.length?'bg-[#E30613] border-[#E30613] text-white':'border-white/20 text-white/40'}`}>
                            {selectedRows.size===parsed.rows.length ? <CheckSquare size={12}/> : <Square size={12}/>}
                          </button>
                        </th>
                        <th className="p-2 text-left font-black tracking-widest text-white/60">#</th>
                        {parsed.headers.map((h,i)=> (
                          <th key={h} className={`p-2 text-left font-black tracking-widest ${i===parsed.phoneIdx?'text-[#00D9FF] bg-[#00D9FF]/10':'text-white/60'}`}>{h.toUpperCase()} {i===parsed.phoneIdx?'📱':''}</th>
                        ))}
                        <th className="p-2 text-left font-black tracking-widest text-white/60">PREVIEW</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.map(r=>{
                        const isSel=selectedRows.has(r.idx)
                        const isPhoneRow = /^\+?[0-9]{7,15}$/.test(r.phone.replace(/\s/g,''))
                        return (
                          <tr key={r.idx} className={`border-b border-white/5 ${isSel?'bg-white/[0.04]':'opacity-60'} ${!isPhoneRow?'bg-red-500/10':''}`}>
                            <td className="p-2">
                              <button onClick={()=>toggleRow(r.idx)} className={`w-5 h-5 rounded border flex items-center justify-center ${isSel?'bg-[#E30613] border-[#E30613] text-white':'border-white/15 text-white/40'}`}>
                                {isSel ? <CheckSquare size={12}/> : <Square size={12}/>}
                              </button>
                            </td>
                            <td className="p-2 font-mono text-white/50">{r.idx+1}</td>
                            {parsed.headers.map(h=> (
                              <td key={h} className={`p-2 font-mono ${h.includes('phone') && !isPhoneRow?'text-red-400':''} ${parsed.headers.indexOf(h)===parsed.phoneIdx?'text-[#00D9FF] font-bold':''}`}>{r.obj[h]||'-'}</td>
                            ))}
                            <td className="p-2 text-white/70 truncate max-w-[200px]">{(() => {
                              let out=template
                              out=out.replace(/\{\{\s*phone\s*\}\}/gi, r.phone)
                              const norm:Record<string,string>={}; Object.entries(r.obj as Record<string,any>).forEach(([k,v])=>{ const s=String(v||''); norm[k.toLowerCase()]=s; norm[k]=s })
                              if(norm.vehicle && !norm.vehical) norm.vehical=norm.vehicle
                              return out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,(m,p1)=> norm[p1.toLowerCase()] ?? norm[p1] ?? m).slice(0,60)
                            })()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-2 bg-white/[0.03] border-t border-white/10 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-white/60">{selectedRows.size} selected → will send only these rows</span>
                  <span className="text-white/40">Uncheck to skip • header auto-detect • phone column highlighted 📱</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="relative p-4 border-t border-white/10 flex items-center justify-between gap-3 bg-[#0A1628]/50">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full bg-white/10 border border-white/15 text-sm font-bold">CANCEL</button>
          <button onClick={submit} disabled={loading} className="flex-1 md:flex-none px-8 py-2.5 rounded-full bg-[#E30613] hover:bg-[#FF2D3B] disabled:opacity-50 text-white text-sm font-black tracking-wide shadow-spidey flex items-center justify-center gap-2">
            {loading ? 'WEAVING…' : <><Send size={16}/> CREATE & SELECTED QUEUE ({selectedRows.size})</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
