import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Database, Plus, Trash2, TestTube, Sprout, Link2, Radio, Eraser, AlertTriangle, ShieldCheck } from 'lucide-react'

export default function Firebases(){
  const [list,setList]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [name,setName]=useState('')
  const [url,setUrl]=useState('')
  const [bulk,setBulk]=useState('')
  const [showBulk,setShowBulk]=useState(false)
  const [testing,setTesting]=useState<string | null>(null)
  const [dupInfo,setDupInfo]=useState<any>(null)
  const [threshold,setThreshold]=useState('10')
  const [cleaning,setCleaning]=useState(false)

  const load=async()=>{
    try{
      const data = await api.get('/api/firebases')
      setList(data)
    }catch{} finally{ setLoading(false) }
  }
  useEffect(()=>{ load(); const id=setInterval(load,7000); return()=>clearInterval(id)},[])

  useEffect(()=>{
    if(!url || url.length<8){ setDupInfo(null); return}
    const t=setTimeout(async()=>{
      try{ const r=await api.get(`/api/firebases/check-duplicate?url=${encodeURIComponent(url)}`); setDupInfo(r)}catch{}
    },500)
    return()=>clearTimeout(t)
  },[url])

  const create=async()=>{
    if(!name.trim() || !url.trim()) return alert('Name & URL required')
    if(dupInfo?.duplicate) return alert(`Duplicate! Already exists as "${dupInfo.duplicateHive?.name}"`)
    try{ await api.post('/api/firebases', { name: name.trim(), database_url: url.trim() }); setName(''); setUrl(''); setDupInfo(null); load()}catch(e:any){ alert(e.message || 'Failed')}
  }
  const test=async(id:string)=>{
    setTesting(id)
    try{ const r=await api.post(`/api/firebases/${id}/test`); alert(`[${r.ok?'OK':'FAIL'}] ${r.message} • ${r.latencyMs}ms`); load()}catch(e:any){ alert(e.message)} finally{ setTesting(null)}
  }
  const seed=async(id:string)=>{ try{ const r=await api.post(`/api/firebases/${id}/seed`); alert(`Seeded ${r.seeded} devices`); load()}catch(e:any){ alert(e.message)}}
  const remove=async(id:string)=>{ if(!confirm('Delete hive? All its devices will be deleted!')) return; await api.del(`/api/firebases/${id}`); load()}
  const bulkImport=async()=>{
    const lines=bulk.split('\n').map(l=>l.trim()).filter(Boolean)
    const items=lines.map(l=>{
      if(l.includes(',')){
        const [n,u]=l.split(',').map(s=>s.trim())
        if(!u && n?.startsWith('http')) return { database_url: n }
        return { name: n, database_url: u }
      }
      if(l.startsWith('http')) return { database_url: l }
      return { name: l, database_url: '' }
    }).filter(x=>x.database_url)
    if(items.length===0) return alert('Paste URLs — one per line, or "Name, https://..."')
    try{
      const r=await api.post('/api/firebases/bulk', { items });
      alert(`Imported ${r.imported}${r.skippedDuplicates?`, skipped ${r.skippedDuplicates} duplicate`:''}`);
      setBulk(''); setShowBulk(false); load()
    }catch(e:any){ alert(e.message)}
  }

  const cleanupLowOnline=async()=>{
    const n=parseInt(threshold,10)
    if(!n || n<=0) return alert('Threshold likho e.g., 10')
    if(!confirm(`Jin hives me ONLINE < ${n} hai, wo sab DELETE ho jayenge?`)) return
    setCleaning(true)
    try{
      const r=await api.post('/api/firebases/cleanup-low-online', { threshold: n })
      alert(r.message || `Deleted ${r.deleted}`)
      load()
    }catch(e:any){ alert(e.message)} finally{ setCleaning(false)}
  }

  const perHiveCleanup=async(id:string, online:number)=>{
    const input = prompt(`Hive me ${online} online hai.\nThreshold (e.g., 10) — online < threshold to poora hive DELETE.\nKhali chhodo to sirf offline clean:`, threshold)
    if(input===null) return
    const thr = input.trim()===''? null : parseInt(input,10)
    if(thr!==null && (!thr || thr<=0)) return alert('Threshold 1+ ya khali chhodo')
    if(!confirm(thr===null ? `Offline clean? Online ${online} bachenge.` : `online ${online} < ${thr} hai to poora delete. Continue?`)) return
    try{
      const r=await api.post(`/api/firebases/${id}/cleanup`, thr!==null ? {threshold: thr} : {})
      alert(r.message); load()
    }catch(e:any){ alert(e.message)}
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-black text-xl text-slate-900">Firebase Hives</h1>
          <p className="text-sm text-slate-500 mt-1">Each RTDB is a hive • {list.length} connected • Polling every 7s (cached)</p>
        </div>
        <button onClick={()=>setShowBulk(v=>!v)} className="px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-black">{showBulk?'CLOSE':'BULK IMPORT'}</button>
      </div>

      {dupInfo?.duplicate && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="text-amber-600"/>
          <div><b>Duplicate!</b> Already exists as <b className="text-slate-900">"{dupInfo.duplicateHive?.name}"</b> — same URL, add blocked.</div>
        </div>
      )}
      {!dupInfo?.duplicate && url && dupInfo && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-2 text-sm text-emerald-700">
          <ShieldCheck size={16}/> No duplicate — safe to add.
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
        <div className="text-xs font-black tracking-widest text-slate-500">CONNECT A NEW HIVE</div>
        <p className="text-xs text-slate-500 mt-1">Duplicate URL auto-blocked (409). Speed: REST + indexes + pool 20.</p>
        <div className="mt-3 grid lg:grid-cols-[1.2fr_1.8fr_auto] gap-3">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Hive name e.g., Queens-01" className="px-4 py-3 rounded-xl bg-white border border-slate-300 outline-none focus:border-slate-900 text-sm text-slate-900 placeholder:text-slate-400" />
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://your-project.firebaseio.com" className={`px-4 py-3 rounded-xl bg-white border outline-none text-sm font-mono text-slate-900 placeholder:text-slate-400 ${dupInfo?.duplicate?'border-amber-400 focus:border-amber-500':'border-slate-300 focus:border-slate-900'}`} />
          <button onClick={create} disabled={!!dupInfo?.duplicate} className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-2"><Plus size={16}/> CONNECT</button>
        </div>
        <div className="text-[11px] text-slate-400 mt-2 font-mono">REST polling via <code className="bg-slate-100 px-1.5 py-0.5 rounded border">/devices.json</code> + 7s cache. Same URL → 409 Duplicate.</div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 text-xs font-black tracking-widest text-slate-700"><Eraser size={14}/> CLEANUP — LOW ONLINE</div>
        <p className="text-xs text-slate-500 mt-1">Min ONLINE likho (e.g., 10) → CLEAN → jisme online &lt; n, wo hive + devices delete. Careful!</p>
        <div className="mt-3 flex flex-wrap gap-3 items-end">
          <label className="flex-1 min-w-[180px] max-w-[260px]">
            <span className="text-xs font-bold text-slate-700">Min ONLINE required</span>
            <input value={threshold} onChange={e=>setThreshold(e.target.value)} type="number" min={1} placeholder="10" className="mt-1 w-full px-4 py-3 rounded-xl bg-white border border-slate-300 focus:border-slate-900 outline-none text-sm font-mono text-slate-900" />
          </label>
          <button onClick={cleanupLowOnline} disabled={cleaning} className="px-6 py-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            <Eraser size={16}/> {cleaning?'CLEANING…':`CLEAN < ${threshold||10} ONLINE`}
          </button>
          <span className="text-xs text-slate-500 self-center">{list.length} hives • live</span>
        </div>
      </div>

      {showBulk && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="text-sm font-bold text-slate-900">Bulk Import — name optional, duplicate auto-skip</div>
          <div className="text-xs text-slate-500">Just URLs one per line — name auto-generated. Or <code>Name, https://url</code></div>
          <textarea value={bulk} onChange={e=>setBulk(e.target.value)} rows={6} placeholder={"https://chilgunisr-default-rtdb.firebaseio.com\nhttps://mukesh-458b7-default-rtdb.firebaseio.com"} className="mt-2 w-full px-4 py-3 rounded-xl bg-white border border-slate-300 focus:border-slate-900 outline-none text-sm font-mono text-slate-900 placeholder:text-slate-400" />
          <div className="mt-3 flex gap-2">
            <button onClick={bulkImport} className="px-6 py-2 rounded-full bg-slate-900 text-white text-sm font-bold hover:bg-black">IMPORT HIVES</button>
            <button onClick={()=>setShowBulk(false)} className="px-4 py-2 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">CANCEL</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i=> <div key={i} className="h-44 rounded-2xl bg-white border border-slate-200 animate-pulse"/>)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((f:any)=>(
            <div key={f.id} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white"><Database size={16}/></div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest border ${f.status==='online'?'bg-emerald-50 text-emerald-700 border-emerald-200': f.status==='offline'?'bg-red-50 text-red-700 border-red-200':'bg-slate-100 text-slate-600 border-slate-200'}`}>{(f.status||'UNKNOWN').toUpperCase()}</span>
              </div>
              <div className="font-bold text-sm text-slate-900 mt-3 truncate">{f.name}</div>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-mono text-slate-500 truncate"><Link2 size={12}/><span className="truncate">{f.database_url}</span></div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono flex items-center gap-1"><Radio size={10}/>{f.online_count ?? 0} online</span>
                <span className="px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600">{f.device_count ?? f.online_count ?? 0} total</span>
                {f.last_tested_at && <span className="text-slate-400 text-xs">{new Date(f.last_tested_at).toLocaleTimeString()}</span>}
              </div>
              <div className="mt-4 grid grid-cols-4 gap-1.5">
                <button onClick={()=>test(f.id)} disabled={testing===f.id} className="py-2 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-black disabled:opacity-50"><TestTube size={11}/>{testing===f.id?'…':'TEST'}</button>
                <button onClick={()=>seed(f.id)} className="py-2 rounded-full bg-white border border-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-slate-50 text-slate-700"><Sprout size={11}/> SEED</button>
                <button onClick={()=>perHiveCleanup(f.id, f.online_count ?? 0)} className="py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-amber-100"><Eraser size={11}/> CLEAN</button>
                <button onClick={()=>remove(f.id)} className="py-2 rounded-full bg-white border border-red-200 text-red-600 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-red-50"><Trash2 size={11}/> DEL</button>
              </div>
              <div className="mt-2 text-[10px] font-mono text-slate-400 truncate">ID: {f.id}</div>
            </div>
          ))}
        </div>
      )}
      {!loading && list.length===0 && <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No hives yet — connect your first Firebase RTDB above.</div>}
    </div>
  )
}
