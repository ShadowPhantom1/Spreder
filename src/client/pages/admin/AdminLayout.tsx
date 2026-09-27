import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { Shield, Users, BarChart3, Lock, Settings, Crown, LogOut, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react'

export default function AdminLayout(){
  const [users,setUsers]=useState<any[]>([])
  const [stats,setStats]=useState<any>(null)
  const nav=useNavigate()
  const load=async()=>{
    try{
      const [d,s]=await Promise.all([ api.get('/api/admin/users'), api.get('/api/stats').catch(()=>null) ])
      setUsers(d); if(s) setStats(s)
    }catch{}
  }
  useEffect(()=>{
    api.get('/api/auth/me').then((r:any)=>{
      if(!r?.user?.is_super) window.location.href='/login'
    }).catch(()=>{})
    load()
  },[])
  const logout=async()=>{ await api.post('/api/auth/logout'); localStorage.removeItem('token'); nav('/login')}

  const online = users.filter(u=>u.session).length
  const active = users.filter(u=>u.is_active).length

  return (
    <div className="min-h-screen bg-[#F0F7FF] text-[#0A1628] flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 border-b border-[#BFDBFF] shadow-[0_4px_20px_rgba(0,102,204,0.08)]">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 h-[64px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EAF4FF] border border-[#BFDBFF] text-xs font-bold text-[#0066CC] hover:bg-white"><ArrowLeft size={14}/> Back to App</Link>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0066CC] to-[#1E40AF] flex items-center justify-center shadow-lg"><Crown size={20} className="text-white"/></div>
            <div className="leading-none">
              <div className="font-black text-[18px] tracking-tight flex items-center gap-2">ADMIN CONSOLE <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-[#0066CC] text-white text-[10px] font-black">NIVEA 3D</span></div>
              <div className="text-[11px] tracking-[0.12em] font-bold text-[#0066CC]/60">USER MANAGEMENT • SYSTEM CONTROL • /adminbhnstock</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EAF4FF] border border-[#BFDBFF]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/> <span className="text-xs font-bold">{online} ONLINE</span>
              <span className="w-px h-3 bg-[#BFDBFF] mx-1"/> <Users size={12} className="text-[#0066CC]"/> <span className="text-xs font-bold">{users.length} USERS</span>
            </div>
            <button onClick={load} className="p-2.5 rounded-xl bg-[#EAF4FF] border border-[#BFDBFF] hover:bg-white text-[#0066CC]"><RefreshCw size={16}/></button>
            <button onClick={logout} className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A1628] text-white text-sm font-black"><LogOut size={14}/> Logout</button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1600px] w-full mx-auto">
        <aside className="hidden lg:flex w-[240px] shrink-0 flex-col gap-2 p-4 sticky top-[64px] h-[calc(100vh-64px)]">
          <div className="rounded-2xl bg-gradient-to-br from-[#0066CC] to-[#1E40AF] p-5 text-white shadow-xl border border-white/10 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"/>
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-black tracking-widest opacity-80"><Sparkles size={12}/> ADMIN ACCESS</div>
              <div className="font-black text-lg leading-none mt-1">Full Control</div>
              <div className="text-xs text-white/70 mt-1">Users • Security • System • Hives</div>
              <div className="mt-4 flex gap-2">
                <span className="px-2.5 py-1 rounded-full bg-white text-[#0066CC] text-xs font-black">{users.length} USERS</span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-400 text-[#0A1628] text-xs font-black">{active} ACTIVE</span>
              </div>
            </div>
          </div>

          <nav className="space-y-1 mt-2">
            {[
              {to:'/adminbhnstock', l:'Dashboard', d:'Stats & health', i:BarChart3, end:true},
              {to:'/adminbhnstock/users', l:'Users', d:'Create, edit, revoke', i:Users},
              {to:'/adminbhnstock/security', l:'Security', d:'IP / Device logs', i:Lock},
              {to:'/adminbhnstock/system', l:'System', d:'Storage & hives', i:Settings},
            ].map(n=>(
              <NavLink key={n.to} to={n.to} end={(n as any).end} className={({isActive})=>`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition ${isActive?'bg-[#0066CC] text-white border-[#0066CC] shadow-lg':'bg-white border-[#EAF4FF] hover:border-[#BFDBFF] hover:bg-[#F8FBFF] text-[#0A1628]'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${location.pathname===n.to?'bg-white/20':'bg-[#EAF4FF]'}`}><n.i size={18} /></div>
                <div className="leading-none"><div className="font-black text-sm">{n.l}</div><div className="text-xs opacity-70">{n.d}</div></div>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto p-4 rounded-2xl bg-white border border-[#EAF4FF] shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black text-[#0066CC]"><Shield size={14}/> Security</div>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li className="flex gap-2">✓ First-login IP auto-lock</li>
              <li className="flex gap-2">✓ 1 ID 1 device enforced</li>
              <li className="flex gap-2">✓ JWT + HttpOnly</li>
            </ul>
          </div>
          <div className="text-[10px] text-center text-zinc-400 tracking-widest">© 2026 BHNSTOCK • ADMIN</div>
        </aside>

        <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-1 p-1.5 rounded-full bg-white border border-[#BFDBFF] shadow-xl">
          {[
            {to:'/adminbhnstock', i:BarChart3}, {to:'/adminbhnstock/users', i:Users}, {to:'/adminbhnstock/security', i:Lock}, {to:'/adminbhnstock/system', i:Settings}
          ].map(n=>(
            <NavLink key={n.to} to={n.to} end={n.to==='/adminbhnstock'} className={({isActive})=>`w-12 h-12 rounded-full grid place-items-center ${isActive?'bg-[#0066CC] text-white':'text-[#0066CC]/60'}`}><n.i size={18}/></NavLink>
          ))}
        </div>

        <main className="flex-1 min-w-0 p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet context={{users, stats, load}} />
        </main>
      </div>
    </div>
  )
}
