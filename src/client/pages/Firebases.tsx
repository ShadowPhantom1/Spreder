import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Database, Plus, Trash2, TestTube, Sprout, Link2, Radio, Eraser, AlertTriangle, ShieldCheck } from 'lucide-react'

export default function Firebases(){
  const [list,setList]=useState<any[]>([])
  const [name,setName]=useState('')
  const [url,setUrl]=useState('https://bhnstock-demo-spiderverse.mock.firebaseio.com')
  const [bulk,setBulk]=useState('')
  const [showBulk,setShowBulk]=useState(false)
  const [testing,setTesting]=useState<string | null>(null)
  const [dupInfo,setDupInfo]=useState<any>(null)
  const [threshold,setThreshold]=useState('10')
  const [cleaning,setCleaning]=useState(false)

  const load=async()=>{ try{ setList(await api.get('/api/firebases'))}catch{}}
  useEffect(()=>{ load(); const id=setInterval(load,4000); return()=>clearInterval(id)},[])

  // duplicate check on url change
  useEffect(()=>{
    if(!url || url.length<8){ setDupInfo(null); return}
    const t=setTimeout(async()=>{
      try{ const r=await api.get(`/api/firebases/check-duplicate?url=${encodeURIComponent(url)}`); setDupInfo(r)}catch{}
    },500)
    return()=>clearTimeout(t)
  },[url])

  const create=async()=>{
    if(!name || !url) return alert('Name & URL required')
    if(dupInfo?.duplicate) return alert(`Duplicate! Already exists as "${dupInfo.duplicateHive?.name}" — same URL. Add nahi hoga.`)
    try{ await api.post('/api/firebases', { name, database_url: url }); setName(''); setUrl(''); setDupInfo(null); load()}catch(e:any){ alert(e.message || e.error || 'Failed')}
  }
  const test=async(id:string)=>{
    setTesting(id)
    try{ const r=await api.post(`/api/firebases/${id}/test`); alert(`[${r.ok?'OK':'FAIL'}] ${r.message} • ${r.latencyMs}ms`); load()}catch(e:any){ alert(e.message)} finally{ setTesting(null)}
  }
  const seed=async(id:string)=>{ try{ const r=await api.post(`/api/firebases/${id}/seed`); alert(`Seeded ${r.seeded} demo bots 🕷️`); load()}catch(e:any){ alert(e.message)}}
  const remove=async(id:string)=>{ if(!confirm('Delete hive? All its devices bhi delete honge!')) return; await api.del(`/api/firebases/${id}`); load()}
  const bulkImport=async()=>{
    const lines=bulk.split('\n').map(l=>l.trim()).filter(Boolean)
    const items=lines.map(l=>{
      if(l.includes(',')){
        const [n,u]=l.split(',').map(s=>s.trim())
        // if url part missing, treat whole line as url
        if(!u && n?.startsWith('http')) return { database_url: n }
        return { name: n, database_url: u }
      }
      // just URL per line — name auto-generated
      if(l.startsWith('http')) return { database_url: l }
      return { name: l, database_url: '' }
    }).filter(x=>x.database_url)
    if(items.length===0) return alert('Paste URLs — one per line, or "Name, https://..."')
    try{
      const r=await api.post('/api/firebases/bulk', { items });
      alert(`Imported ${r.imported} hives${r.skippedDuplicates?`, skipped ${r.skippedDuplicates} duplicate(s)`:''}${r.autoNamed?`, auto-named ${r.autoNamed}`:''}`);
      setBulk(''); setShowBulk(false); load()
    }catch(e:any){ alert(e.message)}
  }

  const cleanupLowOnline=async()=>{
    const n=parseInt(threshold,10)
    if(!n || n<=0) return alert('Threshold likho e.g., 10')
    if(!confirm(`Clean: Jin hives me ONLINE < ${n} hai, wo sab DELETE ho jayenge (devices समेत)?`)) return
    setCleaning(true)
    try{
      const r=await api.post('/api/firebases/cleanup-low-online', { threshold: n })
      alert(r.message || `Deleted ${r.deleted}`)
      load()
    }catch(e:any){ alert(e.message)} finally{ setCleaning(false)}
  }

  const perHiveCleanup=async(id:string, online:number)=>{
    const mode = confirm(`Hive me ${online} online hai.\n\nOK = Offline devices clean karo (online bachenge)\nCancel = Poora hive delete karo?`)
    // For simplicity, ask threshold
    const input = prompt(`Threshold likho (e.g., 10) — agar online < threshold to poora hive delete hoga. Khali chhodo to sirf offline clean hoga:`, threshold)
    if(input===null) return
    const thr = input.trim()===''? null : parseInt(input,10)
    try{
      const r=await api.post(`/api/firebases/${id}/cleanup`, thr!==null ? {threshold: thr} : {})
      alert(r.message); load()
    }catch(e:any){ alert(e.message)}
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] leading-none tracking-wide">FIREBASE HIVES</h1>
          <p className="text-sm text-white/60 mt-1">Each RTDB is a hive. Duplicate URL block hai — same hive dobara add nahi hoga.</p>
        </div>
        <button onClick={()=>setShowBulk(v=>!v)} className="px-4 py-2 rounded-full bg-white/10 border border-white/15 text-xs font-black tracking-widest hover:bg-white/15">{showBulk?'CLOSE':'BULK IMPORT'}</button>
      </div>

      {/* Duplicate guard info */}
      {dupInfo?.duplicate && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-center gap-3 text-sm">
          <AlertTriangle size={18} className="text-amber-400"/>
          <div><b className="text-amber-300">Duplicate hive!</b> — Already exists as <b className="text-white">"{dupInfo.duplicateHive?.name}"</b> ({dupInfo.duplicateHive?.database_url}). Add block hai.</div>
        </div>
      )}
      {!dupInfo?.duplicate && url && dupInfo && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 flex items-center gap-2 text-sm text-emerald-300">
          <ShieldCheck size={16}/> No duplicate — safe to add.
        </div>
      )}

      {/* Create */}
      <div className="rounded-[22px] comic-border bg-gradient-to-br from-[#0F2340] to-[#0A1628] p-5">
        <div className="text-xs font-black tracking-[0.16em] text-[#FFD23F]">CONNECT A NEW HIVE — DUPLICATE BLOCKED</div>
        <div className="mt-3 grid lg:grid-cols-[1.2fr_1.8fr_auto] gap-3">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Hive name e.g., NYC Queens-01" className="px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#E30613]/50 text-sm placeholder:text-white/30" />
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://your-project.firebaseio.com" className={`px-4 py-3 rounded-2xl bg-[#0A1628] border outline-none text-sm placeholder:text-white/30 font-mono ${dupInfo?.duplicate?'border-amber-500/50 focus:border-amber-500':'border-white/10 focus:border-[#E30613]/50'}`} />
          <button onClick={create} disabled={!!dupInfo?.duplicate} className="px-6 py-3 rounded-full bg-[#E30613] hover:bg-[#FF2D3B] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black tracking-wide shadow-spidey flex items-center justify-center gap-2"><Plus size={16}/> CONNECT</button>
        </div>
        <div className="text-[11px] font-mono text-white/40 mt-2">REST polling via <code className="bg-white/10 px-1.5 py-0.5 rounded">/devices.json</code>. Same URL dobara add karoge to 409 Duplicate error ayega.</div>
      </div>

      {/* GLOBAL CLEANUP — min online threshold */}
      <div className="rounded-[22px] comic-border bg-gradient-to-br from-[#1A0A2E] to-[#0F2340] border border-[#8B5CF6]/20 p-5">
        <div className="flex items-center gap-2 text-[#FFD23F] text-xs font-black tracking-[0.16em]"><Eraser size={14}/> CLEANUP — LOW ONLINE HIVES</div>
        <p className="text-xs text-white/60 mt-2 leading-relaxed">Yaha number likho e.g., <b className="text-white">10</b> aur <b className="text-white">CLEAN</b> dabao — jin hives me <b className="text-white">ONLINE {"<"} 10</b> hai, wo sab hives + unke devices <b className="text-red-300">delete</b> ho jayenge. Jese bola: 10 likha aur clean kiya to jis hive me 10 online nahi wo sab delete.</p>
        <div className="mt-3 flex flex-wrap gap-3 items-end">
          <label className="flex-1 min-w-[180px] max-w-[260px]">
            <span className="text-xs font-bold text-white/70">Min ONLINE required</span>
            <input value={threshold} onChange={e=>setThreshold(e.target.value)} type="number" min={1} placeholder="10" className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#8B5CF6]/50 text-sm font-mono" />
          </label>
          <button onClick={cleanupLowOnline} disabled={cleaning} className="px-6 py-3 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white text-sm font-black flex items-center gap-2 disabled:opacity-50">
            <Eraser size={16}/> {cleaning?'CLEANING…':`CLEAN HIVES WITH < ${threshold||10} ONLINE`}
          </button>
          <span className="text-xs font-mono text-white/40 self-center">Checked {list.length} hives • Online count live</span>
        </div>
      </div>

      {showBulk && (
        <div className="rounded-[22px] comic-border bg-[#0A1628] p-5 border border-[#E30613]/20">
          <div className="text-sm font-bold">Bulk Import — name optional, duplicate auto-skip</div>
          <div className="text-xs font-mono text-white/50">Paste <b className="text-white">just URLs</b> one per line — name auto-generated from URL. Or <code>Name, https://url</code> per line.</div>
          <textarea value={bulk} onChange={e=>setBulk(e.target.value)} rows={8} placeholder={"https://chilgunisr-default-rtdb.firebaseio.com\nhttps://mukesh-458b7-default-rtdb.firebaseio.com\nQueens Hive-02, https://project2.firebaseio.com"} className="mt-2 w-full px-4 py-3 rounded-2xl bg-[#0F2340] border border-white/10 outline-none text-sm font-mono placeholder:text-white/30" />
          <div className="mt-3 flex gap-2">
            <button onClick={bulkImport} className="px-6 py-2 rounded-full bg-white text-[#0A1628] text-sm font-black">IMPORT HIVES</button>
            <button onClick={()=>setShowBulk(false)} className="px-4 py-2 rounded-full bg-white/10 border border-white/15 text-sm font-bold">CANCEL</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((f:any)=>(
          <div key={f.id} className="relative rounded-[20px] overflow-hidden comic-border bg-gradient-to-br from-[#162447] to-[#0A1628] p-5 group hover:border-[#E30613]/30 transition">
            <div className="absolute inset-0 web-pattern opacity-[0.06]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E30613] to-[#9A0007] flex items-center justify-center"><Database size={16} className="text-white"/></div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest border ${f.status==='online'?'bg-emerald-500 text-white border-emerald-600': f.status==='offline'?'bg-red-500 text-white border-red-600':'bg-white/10 text-white/70 border-white/15'}`}>{(f.status||'UNKNOWN').toUpperCase()}</span>
              </div>
              <div className="font-bold text-[15px] leading-tight mt-3 line-clamp-1">{f.name}</div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono text-[#00D9FF] truncate"><Link2 size={12}/><span className="truncate">{f.database_url}</span></div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 flex items-center gap-1"><Radio size={10}/>{f.online_count ?? 0} online</span>
                <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">{f.device_count ?? 0} total</span>
                {f.last_tested_at && <span className="text-white/40">• {new Date(f.last_tested_at).toLocaleTimeString()}</span>}
              </div>

              <div className="mt-4 grid grid-cols-4 gap-1.5">
                <button onClick={()=>test(f.id)} disabled={testing===f.id} className="py-2 rounded-full bg-white text-[#0A1628] text-[11px] font-black flex items-center justify-center gap-1 hover:bg-white/90 disabled:opacity-50">
                  <TestTube size={11}/>{testing===f.id?'…':'TEST'}
                </button>
                <button onClick={()=>seed(f.id)} className="py-2 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-white/15">
                  <Sprout size={11}/> SEED
                </button>
                <button onClick={()=>perHiveCleanup(f.id, f.online_count ?? 0)} className="py-2 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-amber-500/25">
                  <Eraser size={11}/> CLEAN
                </button>
                <button onClick={()=>remove(f.id)} className="py-2 rounded-full bg-red-500/15 border border-red-500/20 text-red-300 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-red-500/25">
                  <Trash2 size={11}/> DEL
                </button>
              </div>
              <div className="mt-2 text-[10px] font-mono text-white/30 truncate">ID: {f.id}</div>
            </div>
          </div>
        ))}
      </div>
      {list.length===0 && <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/50">No hives yet — connect your first Firebase RTDB above.</div>}
    </div>
  )
}
