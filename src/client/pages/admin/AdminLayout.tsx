import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { Shield, Users, BarChart3, Lock, Settings, Crown, LogOut, ArrowLeft, RefreshCw } from 'lucide-react'

export default function AdminLayout(){
  const [users,setUsers]=useState<any[]>([])
  const [stats,setStats]=useState<any>(null)
  const nav=useNavigate()
  const load=async()=>{
    try{
      const [d,s]=await Promise.all([ api.get('/api/admin/users'), api.get('/api/stats').catch(()=>null) ])
      setUsers(d); if(s) setStats(s)
    }catch(e:any){
      const m = String(e?.message||'')
      if(m.includes('Invalid token')||m.includes('Unauthorized')||m.includes('thwip')){
        localStorage.removeItem('token')
        window.location.href='/super'
      }
    }
  }
  useEffect(()=>{ load() },[])
  const logout=async()=>{ await api.post('/api/auth/logout').catch(()=>{}); localStorage.removeItem('token'); nav('/super')}

  const online = users.filter(u=>u.session).length
  const active = users.filter(u=>u.is_active).length

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 h-[64px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-200">← Back to App</Link>
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white"><Crown size={16}/></div>
            <div className="leading-none">
              <div className="font-black text-[15px] tracking-tight text-slate-900 flex items-center gap-2">SPIDER CONSOLE <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black tracking-widest">ADMIN</span></div>
              <div className="text-[11px] font-semibold tracking-widest text-slate-500">/adminbhnstock • SECURE</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/> {online} ONLINE</span>
              <span className="w-px h-4 bg-slate-200"/>
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><Users size={12} className="text-slate-500"/> {users.length} USERS</span>
              <span className="w-px h-4 bg-slate-200"/>
              <span className="text-xs font-bold text-slate-700">{active} ACTIVE</span>
            </div>
            <button onClick={load} className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"><RefreshCw size={16}/></button>
            <button onClick={logout} className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-black"><LogOut size={14}/> Logout</button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1600px] w-full mx-auto">
        <aside className="hidden lg:flex w-[264px] shrink-0 flex-col gap-4 p-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="text-[11px] font-black tracking-widest text-slate-500">OVERVIEW</div>
            <div className="font-black text-lg leading-none mt-1 text-slate-900">Admin Panel</div>
            <div className="text-xs text-slate-500 mt-1">Manage users, devices & hives</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-slate-900 text-white text-center"><div className="text-lg font-black">{users.length}</div><div className="text-[11px] font-bold tracking-widest opacity-80">USERS</div></div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center"><div className="text-lg font-black text-emerald-700">{active}</div><div className="text-[11px] font-bold tracking-widest text-emerald-700">ACTIVE</div></div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-600"><Shield size={12}/> One device • Secure</div>
          </div>

          <nav className="space-y-1">
            {[
              {to:'/adminbhnstock', l:'Dashboard', d:'Stats & health', i:BarChart3, end:true},
              {to:'/adminbhnstock/users', l:'Users', d:'Create, edit, revoke', i:Users},
              {to:'/adminbhnstock/security', l:'Security', d:'Device logs', i:Lock},
              {to:'/adminbhnstock/system', l:'System', d:'Storage & hives', i:Settings},
            ].map(n=>(
              <NavLink key={n.to} to={n.to} end={(n as any).end} className={({isActive})=>`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition ${isActive?'bg-slate-900 text-white border-slate-900':'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                <div className={`w-9 h-9 rounded-xl grid place-items-center ${location.pathname===n.to?'bg-white/15':'bg-slate-100'}`}><n.i size={18} /></div>
                <div className="leading-none"><div className="font-bold text-sm">{n.l}</div><div className="text-xs opacity-70">{n.d}</div></div>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-xs font-black text-slate-900">Rules</div>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
              <li>✓ First-login device auto-lock</li>
              <li>✓ 1 ID = 1 device</li>
              <li>✓ Revoke → new device</li>
            </ul>
          </div>
          <div className="text-[10px] text-center text-slate-400 tracking-widest">© 2026 BHNSTOCK</div>
        </aside>

        {/* mobile bottom nav */}
        <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-1 p-1.5 rounded-full bg-white border border-slate-200 shadow-xl">
          {[
            {to:'/adminbhnstock', i:BarChart3}, {to:'/adminbhnstock/users', i:Users}, {to:'/adminbhnstock/security', i:Lock}, {to:'/adminbhnstock/system', i:Settings}
          ].map(n=>(
            <NavLink key={n.to} to={n.to} end={n.to==='/adminbhnstock'} className={({isActive})=>`w-12 h-12 rounded-full grid place-items-center ${isActive?'bg-slate-900 text-white':'text-slate-500 hover:bg-slate-100'}`}><n.i size={18}/></NavLink>
          ))}
        </div>

        <main className="flex-1 min-w-0 p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet context={{users, stats, load}} />
        </main>
      </div>
    </div>
  )
}
