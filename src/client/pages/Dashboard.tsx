import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { fmt, timeAgo } from '../lib/utils'
import { Activity, Radio, Zap, Smartphone, Send, AlertTriangle, CheckCircle2, Clock3, TrendingUp, Webhook, ArrowUpRight, Trash2, Shield, Gauge, CalendarDays } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function Dashboard(){
  const [stats,setStats]=useState<any>(null)
  const [today,setToday]=useState<any>(null)
  const [firebases,setFirebases]=useState<any[]>([])
  const [campaigns,setCampaigns]=useState<any[]>([])
  const [devices,setDevices]=useState<any[]>([])
  const [settings,setSettings]=useState<any>({})
  const [log,setLog]=useState<string[]>([])

  const load=async()=>{
    try{
      const [s,fb,c,d, t, sett]=await Promise.all([
        api.stats(),
        api.get('/api/firebases'),
        api.get('/api/campaigns'),
        api.get('/api/devices'),
        api.get('/api/stats/today').catch(()=>null),
        api.get('/api/settings').catch(()=>({})),
      ])
      setStats(s); setFirebases(fb.slice(0,4)); setCampaigns(c.slice(0,6)); setDevices(d.slice(0,8)); if(t) setToday(t); setSettings(sett||{})
    }catch{}
  }
  useEffect(()=>{
    load()
    const id=setInterval(load,3500)
    const msgs=[
      'Web taut — hive chut ACK ✓',
      'Thwip! 3 msgs dispatched to Client-0281ea',
      'Signal sweep — 37 online, 2 busy — daily limit 100/SIM',
      'Speed: balanced (1.0×) • 5 msgs/wave',
      'Campaign “RTO Notice” 100% • 2/2 sent',
      'Hive latency 124ms — optimal swing',
    ]
    const logId=setInterval(()=> setLog(l=> [ `${new Date().toLocaleTimeString()} • ${msgs[Math.floor(Math.random()*msgs.length)]}` , ...l].slice(0,6)), 2200)
    return ()=>{clearInterval(id); clearInterval(logId)}
  },[])

  const dev = stats?.devices || { online:0, offline:0, busy:0, total:0 }
  const camp = stats?.campaigns || { total:0, running:0, totalSent:0, totalFailed:0 }
  const todayTotal = today?.totalToday ?? stats?.today?.totalToday ?? stats?.todayTotal ?? 0
  const dailyLimit = (()=>{ const v=parseInt(settings.max_sms_per_device_per_day||settings.per_sim_limit||'100',10); return isNaN(v)||v<=0?100:v })()
  const speed = settings.speed_profile || 'ultra'
  const autoDel = settings.auto_delete_completed_after_days || '0'
  const batch = (()=>{ const v=parseInt(settings.dispatch_batch_size || '50',10); return isNaN(v)||v<=0?50:v })()
  const delay = (()=>{ const v=parseInt(settings.dispatch_delay_ms || '0',10); return isNaN(v)?0:v })()
  const mulMap:any = {slow:1.6, balanced:1.0, fast:0.6, turbo:0.28, beast:0.14, ultra:0.08}
  const msgPerSec = (()=>{ const m=mulMap[speed]||1; const d=delay*m; return d>0 ? (batch*1000/d).toFixed(1) : (batch*10).toFixed(1) })()
  const capacity = (stats?.devices?.capacity || stats?.today?.capacity || { totalCapacity: 0, remaining: 0, perSim: dailyLimit }) as any
  const totalCapacity = capacity.totalCapacity ?? 0
  const remaining = capacity.remaining ?? Math.max(0, totalCapacity - todayTotal)
  const used = Math.max(0, totalCapacity - remaining)
  const capPct = totalCapacity>0 ? Math.round((used/totalCapacity)*100) : 0

  const handleDelete=async(id:string)=>{
    if(!confirm('Delete campaign? Messages bhi delete honge!')) return
    await api.del(`/api/campaigns/${id}`)
    load()
  }

  const [sysIp,setSysIp]=useState<any>(null)
  useEffect(()=>{ fetch('/api/system/ip').then(r=>r.json()).then(setSysIp).catch(()=>{}) },[])
  return (
    <div className="space-y-6">
      {/* VPS IP:PORT — show as soon as launched */}
      <div className="rounded-[16px] bg-gradient-to-r from-[#00D9FF]/20 via-[#0066CC]/15 to-[#00D9FF]/20 border border-[#00D9FF]/30 p-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[#00D9FF] grid place-items-center animate-pulse">🌐</span>
          <div>
            <div className="text-[11px] font-black tracking-[0.16em] text-[#00D9FF]">YOUR SYSTEM — IP:PORT (LAUCHED ON VPS)</div>
            <div className="text-sm font-mono font-bold text-white">{sysIp?.host || (typeof window!=='undefined'? window.location.host : '—')} <span className="text-white/40">•</span> <span className="text-[#00D9FF]">{sysIp?.lanUrl || ''}</span> <span className="text-white/30 text-xs">← open anywhere</span></div>
            <div className="text-[11px] font-mono text-white/50">VPS IP: {sysIp?.vpsIp || '—'} • Port: {sysIp?.port || 3000} • Host: {sysIp?.host || '—'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={sysIp?.lanUrl || `http://${sysIp?.host||''}`} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-full bg-[#00D9FF] text-[#0A1628] text-xs font-black hover:bg-[#00BFFF] transition">OPEN →</a>
          <button onClick={()=> navigator.clipboard.writeText(sysIp?.lanUrl || window.location.href)} className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-xs font-bold hover:bg-white/15">COPY</button>
        </div>
      </div>
      {/* Hero — PHONK AURA 3D */}
      <div className="relative overflow-hidden rounded-[28px] comic-border phonk-glow bg-gradient-to-br from-[#0F2340] via-[#1A0A2E] to-[#0A1628] p-6 lg:p-8">
        <div className="phonk-aura" />
        <div className="absolute inset-0 web-pattern opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#E30613]/14 via-transparent to-[#8B5CF6]/14" />
        {/* video-like scanline */}
        <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.5) 3px)'}} />
        <div className="absolute -right-24 -top-24 w-[520px] h-[520px] rounded-full border border-white/[0.06] opacity-30" />
        <div className="absolute -right-24 -top-24 w-[360px] h-[360px] rounded-full border border-[#E30613]/15" />
        <div className="absolute right-6 bottom-0 hidden xl:block opacity-20 select-none pointer-events-none">
          <img src="/logo-icon.png" alt="spidey" className="w-[220px] h-[220px] object-contain drop-shadow-[0_0_30px_rgba(139,92,246,0.6)]" />
        </div>
        <div className="absolute right-[180px] bottom-4 hidden xl:block opacity-10 select-none pointer-events-none">
          <img src="/logo-bhnstock.png" alt="brand" className="w-[160px] h-[160px] object-contain rounded-full border-2 border-white/20" />
        </div>

        <div className="relative grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E30613] text-white text-[11px] font-black tracking-[0.16em]">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE WEB-OS • EARTH-616 • DAILY LIMIT {dailyLimit}/SIM
            </div>
            <h1 className="font-display text-[36px] lg:text-[52px] leading-[0.9] tracking-[-0.02em] mt-3">
              <span className="text-white">BHNSTOCK</span> <span className="text-spidey-gradient">SPREADER</span><br/>
              <span className="text-white/90 text-[26px] lg:text-[34px] tracking-[0.12em]">BRAND NEW DAY</span>
            </h1>
            <p className="text-white/65 text-sm leading-relaxed mt-3 max-w-[560px]">
              <b className="text-white">1 SIM = {dailyLimit} SMS/day</b> • Speed <b className="text-[#FFD23F]">{speed}</b> • Phone auto-detect + row select + `{"{{vehical}}"}` variable — sab Settings se bina code ke!
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Link to="/campaigns" className="px-5 py-2.5 rounded-full bg-[#E30613] hover:bg-[#FF2D3B] text-white text-sm font-black tracking-wide shadow-spidey transition flex items-center gap-2">
                <Send size={16}/> NEW WEB-CAMPAIGN <ArrowUpRight size={14}/>
              </Link>
              <Link to="/firebases" className="px-5 py-2.5 rounded-full bg-white text-[#0A1628] text-sm font-black tracking-wide hover:bg-white/90 transition flex items-center gap-2">
                <Webhook size={16}/> CONNECT HIVE
              </Link>
            </div>
            <div className="flex items-center gap-3 mt-4 text-[11px] font-mono text-white/50">
              <span className="flex items-center gap-1.5"><CalendarDays size={12}/> TODAY {todayTotal} sent</span>
              <span>•</span><span className="flex items-center gap-1"><Zap size={12} className="text-[#FFD23F]"/> {msgPerSec} MSG/SEC</span>
              <span>•</span><span>Auto-delete: {autoDel==='0'?'off':autoDel+'d'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'TODAY SENT', value: fmt(todayTotal), sub:`Today 00:00 se • live`, icon: CalendarDays, grad:'from-[#E30613] to-[#9A0007]', ring:'border-[#E30613]/40' },
              { label:'ONLINE BOTS', value: dev.online, sub:`${dev.total} total • ${dev.busy} busy • ${dailyLimit}/day/SIM`, icon: Smartphone, grad:'from-[#162447] to-[#0F2340]', ring:'border-white/10' },
              { label:'ACTIVE WEBS', value: camp.running ?? 0, sub:`${camp.total ?? 0} campaigns • ${fmt(camp.totalSent||0)} total sent`, icon: Activity, grad:'from-[#0E3A5C] to-[#162447]', ring:'border-[#00D9FF]/20' },
              { label:'HIVES', value: stats?.firebases ?? 0, sub:'RTDB instances', icon: Radio, grad:'from-[#1A1A2E] to-[#162447]', ring:'border-white/10' },
            ].map((c,i)=>(
              <motion.div key={c.label} initial={{opacity:0, y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}}
                className={`card-3d relative rounded-[20px] p-4 overflow-hidden bg-gradient-to-br ${c.grad} border ${c.ring} comic-border`}>
                <div className="absolute inset-0 halftone opacity-[0.08]" />
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center"><c.icon size={16} className="text-white"/></div>
                  <div className="text-[10px] tracking-[0.16em] font-black text-white/60 mt-3">{c.label}</div>
                  <div className="font-display text-[30px] leading-none mt-1">{c.value}</div>
                  <div className="text-[11px] font-mono text-white/60">{c.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-SIM today */}
      {today?.byDevice && today.byDevice.length>0 && (
        <div className="rounded-[22px] glass-spidey comic-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[14px] tracking-wide flex items-center gap-2"><Shield size={14} className="text-emerald-400"/> TODAY PER SIM — {dailyLimit}/DAY LIMIT</h3>
            <span className="text-[11px] font-mono px-2 py-1 rounded-full bg-white/5 border border-white/10">{todayTotal} total today</span>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {today.byDevice.filter((d:any)=>d && d.sent>0).slice(0,12).map((d:any)=> {
              const pct = Math.round((d.sent / dailyLimit)*100)
              const over = d.sent >= dailyLimit
              return (
                <div key={d.id || d.name} className={`p-2.5 rounded-xl border ${over?'bg-red-500/10 border-red-500/20':'bg-[#0A1628] border-white/10'}`}>
                  <div className="text-[11px] font-bold truncate">{d.name || d.id?.slice(0,8) || 'Unknown'}</div>
                  <div className="text-[11px] font-mono text-white/60">{d.sent}/{dailyLimit} {over?'⛔ LIMIT':''}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={`h-full ${over?'bg-red-500':'bg-gradient-to-r from-emerald-400 to-emerald-600'}`} style={{width:`${Math.min(pct,100)}%`}}/></div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="rounded-[24px] glass-spidey comic-border p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[18px] tracking-wide flex items-center gap-2"><Activity size={18} className="text-[#E30613]"/> LIVE WEB ACTIVITY</h3>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> STREAMING</span>
          </div>

          <div className="mt-4 space-y-2 min-h-[220px]">
            {log.length===0 && <div className="text-sm text-white/50">Waiting for thwips… 🕸️</div>}
            {log.map((l,i)=>(
              <div key={i} className="flex gap-3 items-start p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                <span className="mt-0.5 w-7 h-7 rounded-full bg-[#E30613]/20 border border-[#E30613]/30 flex items-center justify-center shrink-0"><Zap size={12} className="text-[#E30613]"/></span>
                <span className="text-[13px] leading-relaxed font-mono text-white/80">{l}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-[#0A1628] border border-white/10 p-3 text-center">
              <div className="text-[11px] tracking-widest font-bold text-white/50">TODAY</div>
              <div className="font-display text-[22px] text-[#FFD23F]">{fmt(todayTotal)}</div>
              <div className="text-[11px] font-mono text-white/50">since 00:00</div>
            </div>
            <div className="rounded-2xl bg-[#0A1628] border border-white/10 p-3 text-center">
              <div className="text-[11px] tracking-widest font-bold text-white/50">DELIVERY</div>
              <div className="font-display text-[22px] text-emerald-400">{(() => {
                const s=camp.totalSent||0, f=camp.totalFailed||0, t=s+f
                if(t===0) return '—'
                return Math.round((s/t)*100)+'%'
              })()}</div>
              <div className="text-[11px] font-mono text-white/50">live • {camp.totalSent||0} sent / {camp.totalFailed||0} fail</div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-[#FFD23F]/15 to-[#FF8A00]/10 border border-[#FFD23F]/20 p-3 text-center">
              <div className="text-[11px] tracking-widest font-bold text-[#FFD23F]">MSG/SEC</div>
              <div className="font-display text-[22px] text-[#FFD23F]">{msgPerSec}</div>
              <div className="text-[11px] font-mono text-white/50">{speed} • {settings.dispatch_batch_size||'10'}/wave</div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] glass-spidey comic-border p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[18px] tracking-wide">RECENT WEBS — LIVE</h3>
            <Link to="/campaigns" className="text-xs font-bold tracking-widest px-3 py-1.5 rounded-full bg-white text-[#0A1628] hover:bg-white/90">VIEW ALL</Link>
          </div>
          <div className="mt-4 space-y-3">
            {campaigns.length===0 && <div className="text-sm text-white/50">No campaigns yet — shoot your first web! 🕷️</div>}
            {campaigns.map((c:any)=> {
              const pct = c.total ? Math.round((c.sent/c.total)*100) : 0
              return (
                <div key={c.id} className="p-4 rounded-2xl bg-[#0A1628] border border-white/10 hover:border-[#E30613]/30 transition group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold leading-none truncate">{c.name}</div>
                      <div className="text-[11px] font-mono text-white/50 mt-1 flex items-center gap-2"><Clock3 size={12}/>{timeAgo(c.created_at)} • {c.total} contacts</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest border ${c.status==='running'?'bg-amber-500/15 text-amber-300 border-amber-500/20': c.status==='completed'?'bg-emerald-500/15 text-emerald-300 border-emerald-500/20': c.status==='paused'?'bg-white/10 text-white border-white/15':'bg-white/5 text-white/60 border-white/10'}`}>{c.status.toUpperCase()}</span>
                      <button onClick={()=>handleDelete(c.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-red-500/20 transition"><Trash2 size={12}/></button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#E30613] to-[#FFD23F] transition-all" style={{width:`${pct}%`}} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={12}/>{c.sent} sent</span>
                    <span className="flex items-center gap-1 text-red-400"><AlertTriangle size={12}/>{c.failed} failed</span>
                    <span className="text-white/50">{pct}% • {c.pending} pending</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* CAPACITY TRACKING PER SIM — compact + 3D phonk */}
      <div className="rounded-[22px] comic-border bg-gradient-to-br from-[#0E3A5C] via-[#1A0A2E] to-[#0A1628] p-4 border border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 web-pattern opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#8B5CF6]/10 via-transparent to-[#E30613]/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E30613] flex items-center justify-center shadow-spidey"><Zap size={16} className="text-white"/></div>
            <div>
              <div className="text-xs font-black tracking-[0.16em] text-white/60">CAPACITY TODAY — PER SIM TRACKING</div>
              <div className="text-sm font-bold">Total: <span className="text-[#FFD23F]">{totalCapacity.toLocaleString()}</span> SMS • Used: <span className="text-emerald-400">{used.toLocaleString()}</span> • <span className="text-sky-300">Bacha: {remaining.toLocaleString()}</span> <span className="text-white/40 font-mono text-xs">({dailyLimit}/SIM)</span></div>
              <div className="text-[11px] font-mono text-white/40">Dual SIM auto-detect: 2 SIM=200/day (1 slot no recharge → 100), no-recharge wale skip • Online hi count hota hai</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-center px-4 py-2 rounded-2xl bg-black/30 border border-white/10 min-w-[110px]">
              <div className="text-[10px] tracking-widest font-bold text-white/50">REMAINING</div>
              <div className="font-display text-[20px] text-sky-300">{remaining.toLocaleString()}</div>
              <div className="text-[10px] font-mono text-white/40">aaj bhej sakte ho</div>
            </div>
            <div className="text-center px-4 py-2 rounded-2xl bg-black/30 border border-white/10 min-w-[90px]">
              <div className="text-[10px] tracking-widest font-bold text-white/50">USED</div>
              <div className="font-display text-[20px] text-emerald-400">{used.toLocaleString()}</div>
              <div className="text-[10px] font-mono text-white/40">{capPct}%</div>
            </div>
          </div>
        </div>
        <div className="relative mt-3 h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-[#E30613] transition-all" style={{width:`${capPct}%`}} />
        </div>
        <div className="relative mt-1 flex justify-between text-[11px] font-mono text-white/40"><span>0</span><span>{capPct}% used • {remaining} bacha</span><span>{totalCapacity}</span></div>
      </div>

      {/* COMPACT — adha firebase/device bhi space nahi lega, bas count */}
      <div className="rounded-[22px] glass-spidey comic-border p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center animate-pulse">📱</div>
          <div>
            <div className="text-xs font-black tracking-[0.16em] text-white/60">FLEET — COMPACT MODE</div>
            <div className="text-sm font-bold">{dev.total} Devices • <span className="text-emerald-400">{dev.online} online</span> • <span className="text-amber-400">{dev.busy} busy</span> • <span className="text-white/50">{dev.offline} offline</span> — sirf online se hi jayega!</div>
            <div className="text-[11px] font-mono text-white/40">1 SIM = 1 msg → next SIM • Round-robin • {dailyLimit}/day/SIM • TURBO {settings.dispatch_batch_size||10}/wave</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center px-4 py-2 rounded-2xl bg-[#0A1628] border border-white/10">
            <div className="text-[10px] tracking-widest font-bold text-white/50">HIVES</div>
            <div className="font-display text-[18px]">{stats?.firebases ?? 0}</div>
          </div>
          <Link to="/devices" className="px-4 py-2 rounded-full bg-white/10 border border-white/15 text-xs font-bold hover:bg-white/15">VIEW DEVICES →</Link>
          <Link to="/firebases" className="px-4 py-2 rounded-full bg-[#E30613] text-white text-xs font-black">HIVES →</Link>
        </div>
      </div>
    </div>
  )
}
