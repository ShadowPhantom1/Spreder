import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { Shield, Users, BarChart3, Lock, Settings, Crown, LogOut, ArrowLeft, RefreshCw, Zap, Sparkles } from 'lucide-react'

export default function AdminLayout(){
  const [users,setUsers]=useState<any[]>([])
  const [stats,setStats]=useState<any>(null)
  const nav=useNavigate()
  const load=async()=>{
    try{
      const [d,s]=await Promise.all([ api.get('/api/admin/users'), api.get('/api/stats').catch(()=>null) ])
      setUsers(d); if(s) setStats(s)
    }catch(e:any){
      // if 401 invalid token, SuperGuard will redirect via /api/auth/me check, but also handle here
      const m = String(e?.message||'')
      if(m.includes('Invalid token')||m.includes('Unauthorized')||m.includes('thwip')){
        localStorage.removeItem('token')
        window.location.href='/super'
      }
    }
  }
  useEffect(()=>{
    load()
  },[])
  const logout=async()=>{ await api.post('/api/auth/logout').catch(()=>{}); localStorage.removeItem('token'); nav('/super')}

  const online = users.filter(u=>u.session).length
  const active = users.filter(u=>u.is_active).length

  return (
    <div className="min-h-screen bg-[#0A1628] text-white flex flex-col relative overflow-hidden">
      {/* spidey background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A1628] via-[#0A1628] to-[#121E3A]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:'repeating-linear-gradient(0deg, transparent 0 28px, rgba(255,255,255,0.6) 29px), repeating-linear-gradient(90deg, transparent 0 28px, rgba(255,255,255,0.6) 29px)'}} />
        <div className="absolute -top-28 -right-28 w-[640px] h-[640px] bg-[#E30613]/18 rounded-full blur-[90px]" />
        <div className="absolute -bottom-40 -left-40 w-[760px] h-[760px] bg-[#0066CC]/14 rounded-full blur-[100px]" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0A1628]/85 border-b border-white/[0.08]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#E30613]/[0.14] via-transparent to-[#0066CC]/[0.10] pointer-events-none" />
        <div className="h-[2px] bg-gradient-to-r from-[#E30613] via-[#FFD23F] to-[#0066CC] absolute bottom-0 left-0 right-0" />
        <div className="relative max-w-[1600px] mx-auto px-4 lg:px-6 h-[64px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs font-black tracking-widest hover:bg-white/10"><ArrowLeft size={14}/> Back to App</Link>
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#E30613] to-[#9A0007] flex items-center justify-center shadow-[0_6px_22px_rgba(227,6,19,0.45)] border border-white/15"><Crown size={18} className="text-white"/><span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FFD23F] rounded-full animate-pulse border border-white/50" /></div>
            <div className="leading-none">
              <div className="font-black text-[17px] tracking-tight flex items-center gap-2">🕷️ SPIDER CONSOLE <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-[#E30613] text-white text-[10px] font-black tracking-widest">ADMIN</span></div>
              <div className="text-[11px] tracking-[0.14em] font-bold text-white/55">/adminbhnstock • SPIDERMAN EDITION</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"/> <span className="text-xs font-black">{online} ONLINE</span>
              <span className="w-px h-3 bg-white/15 mx-1"/> <Users size={12} className="text-[#00D9FF]"/> <span className="text-xs font-black">{users.length} USERS</span>
            </div>
            <button onClick={load} className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/10 text-white"><RefreshCw size={16}/></button>
            <button onClick={logout} className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[#0A1628] text-sm font-black hover:bg-white/90"><LogOut size={14}/> Logout</button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1600px] w-full mx-auto relative">
        <aside className="hidden lg:flex w-[260px] shrink-0 flex-col gap-3 p-4 sticky top-[64px] h-[calc(100vh-64px)]">
          <div className="rounded-[20px] bg-gradient-to-br from-[#E30613] via-[#DC143C] to-[#9A0007] p-5 text-white shadow-[0_12px_32px_rgba(227,6,19,0.35)] border border-white/15 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"/>
            <div className="absolute inset-0 opacity-[0.06]" style={{backgroundImage:'radial-gradient(circle at 2px 2px, white 2px, transparent 0)',backgroundSize:'18px 18px'}} />
            <div className="relative">
              <div className="flex items-center gap-2 text-[11px] font-black tracking-[0.16em] opacity-90"><Sparkles size={12}/> SPIDER ADMIN</div>
              <div className="font-black text-xl leading-none mt-1">With Great<br/>Power</div>
              <div className="text-xs text-white/75 mt-1 leading-relaxed">Users • Security • System • Hives<br/>One device • Thwip!</div>
              <div className="mt-4 flex gap-2">
                <span className="px-2.5 py-1 rounded-full bg-white text-[#E30613] text-xs font-black shadow">{users.length} USERS</span>
                <span className="px-2.5 py-1 rounded-full bg-[#FFD23F] text-[#0A1628] text-xs font-black">{active} ACTIVE</span>
              </div>
            </div>
          </div>

          <nav className="space-y-1.5 mt-1">
            {[
              {to:'/adminbhnstock', l:'Dashboard', d:'Stats & health', i:BarChart3, end:true},
              {to:'/adminbhnstock/users', l:'Users', d:'Create, edit, revoke', i:Users},
              {to:'/adminbhnstock/security', l:'Security', d:'Device logs', i:Lock},
              {to:'/adminbhnstock/system', l:'System', d:'Storage & hives', i:Settings},
            ].map(n=>(
              <NavLink key={n.to} to={n.to} end={(n as any).end} className={({isActive})=>`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition ${isActive?'bg-[#E30613] text-white border-[#E30613] shadow-[0_8px_22px_rgba(227,6,19,0.35)]':'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08] hover:border-white/15 text-white/85'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${location.pathname===n.to?'bg-white/20':'bg-white/[0.06] border border-white/10'}`}><n.i size={18} /></div>
                <div className="leading-none"><div className="font-black text-sm">{n.l}</div><div className="text-xs opacity-70">{n.d}</div></div>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto p-4 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-black text-[#FFD23F]"><Zap size={14}/> Spidey Rules</div>
            <ul className="mt-2 space-y-1.5 text-xs text-white/70">
              <li className="flex gap-2">✓ First-login device auto-lock</li>
              <li className="flex gap-2">✓ 1 ID 1 device enforced</li>
              <li className="flex gap-2">✓ Revoke = new web</li>
            </ul>
          </div>
          <div className="text-[10px] text-center text-white/30 tracking-widest">© 2026 BHNSTOCK • SPIDER ADMIN</div>
        </aside>

        <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-1 p-1.5 rounded-full bg-[#0A1628] border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur">
          {[
            {to:'/adminbhnstock', i:BarChart3}, {to:'/adminbhnstock/users', i:Users}, {to:'/adminbhnstock/security', i:Lock}, {to:'/adminbhnstock/system', i:Settings}
          ].map(n=>(
            <NavLink key={n.to} to={n.to} end={n.to==='/adminbhnstock'} className={({isActive})=>`w-12 h-12 rounded-full grid place-items-center ${isActive?'bg-[#E30613] text-white shadow':'text-white/60'}`}><n.i size={18}/></NavLink>
          ))}
        </div>

        <main className="flex-1 min-w-0 p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet context={{users, stats, load}} />
        </main>
      </div>
    </div>
  )
}
