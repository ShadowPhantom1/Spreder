import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Smartphone, Database, Megaphone, Settings, LogOut, Zap, Shield, Menu, X, BookOpen, Crown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, sub: 'Command Center', img: '/icons/icon-dashboard.png' },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone, sub: 'Web Spread', img: '/icons/icon-campaigns.png' },
  { to: '/devices', label: 'Devices', icon: Smartphone, sub: 'Spider-Bots', img: '/icons/icon-devices.png' },
  { to: '/firebases', label: 'Firebase Hives', icon: Database, sub: 'RTDB Hives', img: '/icons/icon-hives.png' },
  { to: '/settings', label: 'Settings', icon: Settings, sub: 'Suit Config', img: '/icons/icon-settings.png' },
  { to: '/admin', label: 'Super Admin', icon: Crown, sub: 'Nivea 3D', img: '/icons/icon-admin.png', superOnly: true },
  { to: '/docs', label: 'Docs', icon: BookOpen, sub: 'Single Source', img: '/icons/icon-docs.png' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [isSuper, setIsSuper] = useState(false)
  const navHook = useNavigate()
  useEffect(()=>{ api.get('/api/auth/me').then((r:any)=> setIsSuper(!!r?.user?.is_super)).catch(()=>{}) },[])
  const filteredNav = nav.filter((n:any)=> !(n as any).superOnly || isSuper)
  const [settings,setSettings]=useState<any>({})
  useEffect(() => {
    api.stats().then(setStats).catch(()=>{})
    api.get('/api/settings').then(setSettings).catch(()=>{})
    const id = setInterval(()=> {
      api.stats().then(setStats).catch(()=>{})
      api.get('/api/settings').then(setSettings).catch(()=>{})
    }, 4000)
    return ()=> clearInterval(id)
  }, [])
  const batch = parseInt(settings.dispatch_batch_size || '10',10)
  const delay = parseInt(settings.dispatch_delay_ms || '550',10)
  const speed = settings.speed_profile || 'turbo'
  const mulMap:any = {slow:1.6, balanced:1.0, fast:0.6, turbo:0.28, beast:0.14, ultra:0.08}
  const msgPerSec = (()=>{ const m=mulMap[speed]||1; const d=delay*m; return d? (batch*1000/d).toFixed(1):'—' })()
  const logout = async () => {
    await api.post('/api/auth/logout')
    localStorage.removeItem('token')
    navHook('/login')
  }
  return (
    <div className="min-h-screen bg-[#EAF4FF] dark:bg-[#0A1628] bg-spidey-mesh text-zinc-900 dark:text-white flex flex-col relative">
      {/* Nivea 3D soft background — clean, no phonk */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#EAF4FF] via-[#D6E8FF] to-[#BFD9FF] dark:from-[#0A1628] dark:via-[#0A1628] dark:to-[#0A1628] opacity-100" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0066CC]/[0.06] via-transparent to-[#00BFFF]/[0.05] dark:from-[#8B5CF6]/10 dark:to-[#E30613]/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full border border-[#0066CC]/[0.06] dark:border-white/[0.04] blur-[1px] opacity-40 pointer-events-none hidden lg:block" style={{transform:'translate(-50%,-50%) perspective(800px) rotateX(12deg)'}} />
      </div>
      {/* Top bar — Spidey mask bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0A1628]/80 border-b border-white/[0.08]">
        <div className="absolute inset-0 web-pattern opacity-40 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#E30613]/[0.12] via-transparent to-[#00D9FF]/[0.06] pointer-events-none" />
        <div className="relative max-w-[1600px] mx-auto px-4 lg:px-6 h-[64px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={()=>setOpen(v=>!v)} className="lg:hidden p-2 rounded-xl bg-white/[0.06] border border-white/10">
              {open ? <X size={18}/> : <Menu size={18}/>}
            </button>
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden comic-border-red shadow-spidey shrink-0 bg-white">
                <img src="/logo-bhnstock.png" alt="BHNSTOCK" className="w-full h-full object-cover" />
                {/* spider eyes glow */}
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FFD23F] rounded-full blur-[1px] opacity-0" />
              </div>
              <div className="leading-none">
                <div className="font-display text-[22px] tracking-[0.08em] flex items-baseline gap-1.5">
                  <span>BHNSTOCK</span>
                  <span className="text-spidey-red text-[11px] tracking-[0.18em] font-body font-bold">SMS</span>
                </div>
                <div className="text-[11px] tracking-[0.18em] font-mono text-white/60 -mt-1">SPREADER 3D • BRAND NEW DAY</div>
              </div>
              <span className="hidden md:inline-flex ml-2 px-2.5 py-1 rounded-full bg-[#E30613] text-white text-[10px] font-bold tracking-widest">WEB-OS v3.0</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
              <span className="text-xs font-mono text-white/70">{stats?.devices?.online ?? stats?.devices?.rechargeOnline ?? '—'} ONLINE</span>
              <span className="w-px h-3 bg-white/15 mx-1" />
              <Zap size={12} className="text-[#FFD23F]" />
              <span className="text-xs font-mono">{stats?.devices?.total ?? '—'} BOTS</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFD23F]/15 border border-[#FFD23F]/30">
              <Zap size={12} className="text-[#FFD23F]" />
              <span className="text-xs font-black tracking-widest text-[#FFD23F]">{msgPerSec} MSG/SEC</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0066CC]/15 border border-[#0066CC]/30">
              <Shield size={12} className="text-[#0066CC] dark:text-[#E30613]" />
              <span className="text-xs font-bold tracking-widest">NIVEA 3D</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E30613]/15 border border-[#E30613]/30">
              <Shield size={12} className="text-[#E30613]" />
              <span className="text-xs font-bold tracking-widest">FRIENDLY NEIGHBORHOOD</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end leading-none mr-1">
              <span className="text-xs font-bold tracking-widest">PETER • ADMIN</span>
              <span className="text-[10px] font-mono text-white/50">Earth-616 • NYC Hive</span>
            </div>
            <img src="https://i.pravatar.cc/100?img=15" alt="avatar" className="w-9 h-9 rounded-full border-2 border-[#E30613] object-cover" />
            <button onClick={logout} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-[#0A1628] text-xs font-bold hover:bg-white/90 transition">
              <LogOut size={14}/> EXIT
            </button>
          </div>
        </div>
        {/* web line under header */}
        <div className="h-[2px] bg-gradient-to-r from-[#E30613] via-[#FFD23F] to-[#00D9FF] opacity-90" />
      </header>

      <div className="flex flex-1 max-w-[1600px] w-full mx-auto">
        {/* Sidebar */}
        <aside className={`fixed lg:sticky top-[66px] z-30 h-[calc(100vh-66px)] w-[280px] lg:w-[260px] shrink-0 bg-[#0A1628]/90 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none border-r border-white/[0.06] lg:border-white/[0.04] transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="absolute inset-0 web-lines opacity-[0.03] pointer-events-none hidden lg:block" />
          <nav className="relative p-3 space-y-1.5 overflow-y-auto h-full">
            {filteredNav.map((n:any) => (
              <NavLink key={n.to} to={n.to} onClick={()=>setOpen(false)}
                className={({isActive})=>`group flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all ${isActive ? 'bg-gradient-to-br from-[#E30613] to-[#9A0007] border-[#E30613] shadow-spidey text-white' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] hover:border-white/15 text-white/80 hover:text-white'}`}>
                <div className="w-9 h-9 rounded-xl bg-white/[0.08] group-[.active]:bg-white/20 flex items-center justify-center shrink-0 overflow-hidden">
                  {n.img ? <img src={n.img} alt={n.label} className="w-full h-full object-cover" /> : <n.icon size={18} />}
                </div>
                <div className="leading-none text-left">
                  <div className="text-[13px] font-bold tracking-wide">{n.label}</div>
                  <div className="text-[10px] font-mono opacity-60 tracking-widest">{n.sub}</div>
                </div>
              </NavLink>
            ))}

            <div className="pt-4 mt-4 border-t border-white/10">
              <div className="rounded-2xl overflow-hidden comic-border bg-gradient-to-br from-[#162447] to-[#0A1628] p-4 relative">
                <div className="absolute inset-0 halftone opacity-20" />
                <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-[#E30613]/20 blur-2xl" />
                <div className="relative">
                  <div className="text-[11px] font-black tracking-[0.16em] text-[#FFD23F]">BRAND NEW DAY</div>
                  <div className="font-display text-[18px] leading-none mt-1">YOUR FRIENDLY<br/>NEIGHBORHOOD<br/><span className="text-spidey-gradient">SPREADER</span></div>
                  <p className="text-[11px] leading-relaxed text-white/60 mt-2">Swing across hives. Every message is a web — taut, traceable, thwipped.</p>
                  <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-xl bg-white/[0.06] border border-white/10 py-2">
                      <div className="text-[16px] font-black leading-none">{stats?.campaigns?.total ?? '—'}</div><div className="text-[9px] tracking-widest opacity-60">CAMPAIGNS</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.06] border border-white/10 py-2">
                      <div className="text-[16px] font-black leading-none text-emerald-400">{stats?.campaigns?.totalSent ?? '—'}</div><div className="text-[9px] tracking-widest opacity-60">SENT</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.06] border border-white/10 py-2">
                      <div className="text-[16px] font-black leading-none text-[#FFD23F]">{stats?.firebases ?? '—'}</div><div className="text-[9px] tracking-widest opacity-60">HIVES</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-2 py-3 text-[10px] font-mono text-white/30 tracking-widest text-center">
              © 2026 BHNSTOCK • EARTH-616<br/>WITH GREAT POWER — GREAT THROUGHPUT
            </div>
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 px-4 lg:px-6 py-6">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {open && <div onClick={()=>setOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 lg:hidden" />}
    </div>
  )
}
