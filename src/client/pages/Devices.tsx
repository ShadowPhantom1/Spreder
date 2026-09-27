import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Smartphone, Zap, RefreshCw, Eye, Signal, Battery, CreditCard } from 'lucide-react'

export default function Devices(){
  const [stats,setStats]=useState<any>(null)
  const [devices,setDevices]=useState<any[]>([])
  const [loading,setLoading]=useState(false)
  const [showList,setShowList]=useState(false)
  const [q,setQ]=useState('')

  const load=async()=>{
    setLoading(true)
    try{
      const [s,d]=await Promise.all([ api.get('/api/stats'), api.get('/api/devices?limit=200') ])
      setStats(s)
      setDevices(d)
    }catch{} finally{ setLoading(false)}
  }
  useEffect(()=>{ load(); const id=setInterval(load,5000); return()=>clearInterval(id)},[])

  const total = stats?.devices?.total ?? 0
  const online = stats?.devices?.online ?? 0
  const offline = stats?.devices?.offline ?? 0
  const busy = stats?.devices?.busy ?? 0
  const cap = stats?.devices?.capacity || { totalCapacity:0, remaining:0, perSim:100 }
  const capTotal = cap.totalCapacity
  const capRem = cap.remaining
  const capUsed = capTotal - capRem
  const pct = capTotal? Math.round((capUsed/capTotal)*100):0
  const rechargeOnline = stats?.devices?.rechargeOnline ?? stats?.devices?.capacity?.perSim ? Math.floor((stats?.devices?.capacity?.totalCapacity||0) / (stats?.devices?.capacity?.perSim||100)) : online

  // only online + recharge are actually used for sending
  const pool = devices.filter(d=> d.has_recharge!==0)
  const filteredPool = q ? pool.filter((d:any)=> (d.name||'').toLowerCase().includes(q.toLowerCase()) || (d.id||'').toLowerCase().includes(q.toLowerCase())) : pool

  return (
    <div className="space-y-8">
      {/* BIG SCENE HEADER */}
      <div className="relative overflow-hidden rounded-[32px] comic-border bg-gradient-to-br from-[#0F2340] via-[#1A0A2E] to-[#0A1628] p-[1.5px]">
        <div className="rounded-[30px] bg-gradient-to-br from-[#0F2340]/90 to-[#0A1628]/90 p-8 lg:p-10 relative overflow-hidden">
          <div className="absolute -top-28 -right-28 w-[640px] h-[640px] rounded-full bg-gradient-to-br from-[#8B5CF6]/20 to-[#EC4899]/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 -left-28 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#E30613]/15 to-[#FFD23F]/10 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 web-pattern opacity-10 pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-[#0A1628] text-xs font-black tracking-[0.14em]">🕷️ COUNT MODE — 1000 DEVICES BHI COMPACT</div>
            <h1 className="font-display text-[42px] lg:text-[56px] leading-[0.9] tracking-[-0.02em] mt-4">SPIDER-BOTS <span className="text-white/40 text-[18px] font-mono tracking-widest">— SIRF COUNT</span></h1>
            <p className="text-white/60 text-base mt-3 max-w-[820px] leading-relaxed">Bohut sare devices add karoge to table ka koi fayda nahi — isliye <b className="text-white">bas COUNT dikhega</b>. Sirf <b className="text-emerald-400">ONLINE + RECHARGE wale hi bhejenge</b> — offline bas ginne ke liye. Bada scene, saaf dikhega.</p>
            <div className="flex flex-wrap gap-3 mt-5">
              <button onClick={load} className="px-6 py-3 rounded-full bg-white text-[#0A1628] text-sm font-black flex items-center gap-2"><RefreshCw size={16} className={loading?'animate-spin':''}/> REFRESH COUNT</button>
              <button onClick={()=>setShowList(!showList)} className="px-6 py-3 rounded-full bg-white/10 border border-white/15 text-sm font-bold flex items-center gap-2"><Eye size={16}/> {showList? 'HIDE ONLINE LIST' : `SHOW ONLINE POOL (${pool.length})`}</button>
              <span className="self-center text-xs font-mono text-white/40">Auto refresh 4s • search/table hata diya • sirf pool count</span>
            </div>
          </div>
        </div>
      </div>

      {/* BIG COUNT CARDS — bada scene */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-[28px] p-7 bg-gradient-to-br from-[#162447] to-[#0A1628] border border-white/10 comic-border relative overflow-hidden">
          <div className="absolute inset-0 halftone opacity-10" />
          <div className="relative">
            <div className="text-xs font-black tracking-[0.16em] text-white/50 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"/> TOTAL FLEET</div>
            <div className="font-display text-[64px] leading-none mt-3">{total}</div>
            <div className="text-sm font-mono text-white/50 mt-1">{online} online • {offline} offline • {busy} busy</div>
            <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-white" style={{width:`${total? Math.round((online/total)*100):0}%`}}/></div>
            <div className="text-xs font-mono text-white/40 mt-1">{total? Math.round((online/total)*100):0}% online</div>
          </div>
        </div>

        <div className="rounded-[28px] p-7 bg-gradient-to-br from-emerald-600 to-emerald-800 border border-emerald-500/30 comic-border relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          <div className="relative">
            <div className="text-xs font-black tracking-[0.16em] text-white/80 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse"/> ONLINE + RECHARGE ✓</div>
            <div className="font-display text-[64px] leading-none mt-3 text-white">{rechargeOnline}</div>
            <div className="text-sm font-bold text-white/90 mt-1">Bhejne layak pool — yahi se jayega!</div>
            <div className="text-xs font-mono text-white/60 mt-1">1 SIM=100/day • Dual=200/day</div>
            <div className="mt-4 flex gap-2">
              <span className="px-3 py-1 rounded-full bg-white text-emerald-700 text-xs font-black">{pool.length} usable</span>
              <span className="px-3 py-1 rounded-full bg-black/20 text-white text-xs font-bold border border-white/20">{online - rechargeOnline} no-recharge skip</span>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] p-7 bg-gradient-to-br from-[#0E3A5C] to-[#1A0A2E] border border-white/10 comic-border relative overflow-hidden">
          <div className="absolute inset-0 web-pattern opacity-20" />
          <div className="relative">
            <div className="text-xs font-black tracking-[0.16em] text-white/50 flex items-center gap-2"><Zap size={14} className="text-[#FFD23F]"/> CAPACITY TODAY</div>
            <div className="font-display text-[42px] leading-none mt-3"><span className="text-sky-300">{capRem.toLocaleString()}</span><span className="text-white/30 text-[22px]"> / {capTotal.toLocaleString()}</span></div>
            <div className="text-sm font-bold text-white/70">Bacha hai • {capUsed.toLocaleString()} used • {capTotal? pct:0}%</div>
            <div className="mt-4 h-3 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-[#E30613]" style={{width:`${pct}%`}}/></div>
            <div className="text-xs font-mono text-white/40 mt-1">{cap.perSim}/SIM • round-robin 1→2→3→4→5→6</div>
          </div>
        </div>
      </div>

      {/* BIG CAPACITY BAR */}
      <div className="rounded-[28px] comic-border bg-black border border-white/10 p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#8B5CF6]/10 via-transparent to-[#E30613]/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-2xl">📡</div>
            <div>
              <div className="text-xs font-black tracking-[0.16em] text-white/50">TODAY PROGRESS — BIG SCENE</div>
              <div className="text-lg font-black mt-1">Total <span className="text-[#FFD23F]">{capTotal.toLocaleString()}</span> • Used <span className="text-emerald-400">{capUsed.toLocaleString()}</span> • <span className="text-sky-300">Bacha {capRem.toLocaleString()}</span></div>
              <div className="text-xs font-mono text-white/40">Dual SIM auto 200/day, बिना recharge skip — sirf online count</div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-center px-6 py-3 rounded-2xl bg-white text-[#0A1628] min-w-[120px]">
              <div className="text-[11px] font-black tracking-widest opacity-60">BACHA</div>
              <div className="font-display text-2xl leading-none">{capRem}</div>
            </div>
            <div className="text-center px-6 py-3 rounded-2xl bg-white/10 border border-white/15 min-w-[120px]">
              <div className="text-[11px] font-black tracking-widest text-white/60">USED</div>
              <div className="font-display text-2xl leading-none">{pct}%</div>
            </div>
          </div>
        </div>
        <div className="relative mt-6 h-4 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-[#E30613] transition-all duration-700" style={{width:`${pct}%`}} />
        </div>
      </div>

      {/* ONLINE POOL — compact pills, not table */}
      {showList && (
        <div className="rounded-[28px] comic-border bg-[#0F2340] border border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl flex items-center gap-2"><Smartphone size={18} className="text-emerald-400"/> ONLINE POOL — SIRF BHEJNE LAYAK ({filteredPool.length}/{pool.length})</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name or ID" className="pl-8 pr-3 py-1.5 rounded-full bg-[#0A1628] border border-white/10 text-xs w-44 outline-none focus:border-[#E30613]/50 placeholder:text-white/30" />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30">🔍</span>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300">LIVE</span>
            </div>
          </div>
          <p className="text-xs font-mono text-white/40 mt-1">Offline wale yaha nahi — sirf count me. Har pill = 1 SIM (100/day). Dual wale 2×. Limit 200 fetch — search se filter karo.</p>
          <div className="mt-4 flex flex-wrap gap-2 max-h-[320px] overflow-auto">
            {filteredPool.slice(0,100).map((d:any)=>(
              <div key={d.id} className="px-3 py-2 rounded-full bg-white text-[#0A1628] text-xs font-bold flex items-center gap-2 border-2 border-white shadow">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {d.name}
                <span className="px-2 py-0.5 rounded-full bg-[#0A1628] text-white text-[10px]">{d.sim_count||1} SIM</span>
                <span className="text-[10px] font-mono opacity-60">{d.battery ?? '—'}% <Battery size={10} className="inline"/></span>
              </div>
            ))}
          </div>
          {filteredPool.length>100 && <div className="text-xs font-mono text-white/40 mt-3">+{filteredPool.length-100} aur — search se filter karo</div>}
          {filteredPool.length===0 && <div className="text-xs text-white/50 py-6 text-center">No device matches “{q}”</div>}
          <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs leading-relaxed text-white/60">
            Table hata diya — 500+ devices pe bhi yehi pills dikhenge, page halka rahega. Recharge toggle ya SIM change karna ho to abhi bhi API se ho jayega, par default count-only rakha hai jaisa bola.
          </div>
        </div>
      )}

      {!showList && (
        <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center">
          <div className="text-sm font-bold text-white/70">Bohut devices? Table hata diya — sirf count dikhega. Online pool dekhna ho to upar <b className="text-white">SHOW ONLINE POOL</b> dabao.</div>
          <div className="text-xs font-mono text-white/40 mt-1">Offline wale sirf number me — list me nahi, ekdum halka ⚡</div>
        </div>
      )}
    </div>
  )
}
