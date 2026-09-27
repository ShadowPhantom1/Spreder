import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Shield, Trash2, Power, UserPlus, Save, RefreshCw, Ban, Search, Users, Activity, Cpu, HardDrive, Crown, Lock, Smartphone, TrendingUp, CheckCircle, Download, LogOut, ArrowLeft, Settings, Database, Zap, Eye, Sparkles, BarChart3 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Admin(){
  const [users,setUsers]=useState<any[]>([])
  const [stats,setStats]=useState<any>(null)
  const [form,setForm]=useState({username:'', password:'', sub_days:'30'})
  const [msg,setMsg]=useState('')
  const [tab,setTab]=useState<'dash'|'users'|'system'>('users')
  const [q,setQ]=useState('')
  const [filter,setFilter]=useState<'all'|'active'|'disabled'|'super'>('all')
  const [showAdd,setShowAdd]=useState(false)
  const [editing,setEditing]=useState<string|null>(null)
  const [formError,setFormError]=useState('')
  const [creating,setCreating]=useState(false)
  const nav=useNavigate()

  const load=async()=>{
    try{
      const [d,s]=await Promise.all([ api.get('/api/admin/users'), api.get('/api/stats').catch(()=>null) ])
      setUsers(d); if(s) setStats(s)
    }catch(e:any){ setMsg(e.message)}
  }
  useEffect(()=>{
    api.get('/api/auth/me').then((r:any)=>{
      if(!r?.user?.is_super) window.location.href='/login'
    }).catch(()=>{})
    load()
  },[])

  const create=async()=>{
    setFormError('')
    if(!form.username.trim() || !form.password.trim()){ setFormError('Username & password required'); setMsg('Username & password required'); return}
    if(form.password.trim().length < 6){ setFormError('Password min 6 chars'); return}
    const days=parseInt(form.sub_days||'0',10)
    if(isNaN(days) || days < 0){ setFormError('Days must be 0 or more'); return}
    const expires_at = days>0 ? new Date(Date.now()+days*24*60*60*1000).toISOString() : null
    setCreating(true)
    try{
      await api.post('/api/admin/users', { username: form.username.trim(), password: form.password, per_sim_limit:100, max_devices:100, allowed_ip:'', expires_at });
      setMsg('✓ '+form.username+' created • '+ (days?days+' days':'lifetime')+' • IP auto on first login');
      setForm({username:'', password:'', sub_days:'30'});
      setFormError('');
      setShowAdd(false);
      load()
    }catch(e:any){
      const m=e.message||'Create failed'
      setFormError(m)
      setMsg(m)
    }finally{ setCreating(false)}
  }
  const act=async(p:string,id:string)=>{ try{ await api.post(`/api/admin/users/${id}/${p}`); load()}catch(e:any){ setMsg(e.message)} }
  const del=async(id:string)=>{ if(!confirm('Delete user + data?')) return; try{ await api.del(`/api/admin/users/${id}`); load()}catch(e:any){ setMsg(e.message)} }
  const save=async(id:string, per:number, ip:string)=>{ try{ await api.put(`/api/admin/users/${id}`, {per_sim_limit:per, allowed_ip:ip}); setMsg('✓ Saved'); setEditing(null); load()}catch(e:any){ setMsg(e.message)} }
  const clean=async()=>{ try{ const r=await api.post('/api/admin/storage/clean', {days:3}); setMsg(`✓ Cleaned ${r.deleted}`)}catch(e:any){ setMsg(e.message)} }
  const logout=async()=>{ await api.post('/api/auth/logout'); localStorage.removeItem('token'); nav('/login')}

  const filtered = users.filter(u=>{
    if(q && !u.username.toLowerCase().includes(q.toLowerCase()) && !(u.allowed_ip||'').includes(q)) return false
    if(filter==='active' && !u.is_active) return false
    if(filter==='disabled' && u.is_active) return false
    if(filter==='super' && !u.is_super) return false
    return true
  })

  const active = users.filter(u=>u.is_active).length
  const online = users.filter(u=>u.session).length
  const superCount = users.filter(u=>u.is_super).length

  return (
    <div className="min-h-screen bg-[#F0F7FF] text-[#0A1628] flex flex-col">
      {/* ADMIN HEADER — separate, premium Nivea */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 border-b border-[#BFDBFF] shadow-[0_4px_20px_rgba(0,102,204,0.08)]">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 h-[64px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EAF4FF] border border-[#BFDBFF] text-xs font-bold text-[#0066CC] hover:bg-white"><ArrowLeft size={14}/> Back to App</Link>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0066CC] to-[#1E40AF] flex items-center justify-center shadow-lg"><Crown size={20} className="text-white"/></div>
            <div className="leading-none">
              <div className="font-black text-[18px] tracking-tight flex items-center gap-2">ADMIN CONSOLE <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-[#0066CC] text-white text-[10px] font-black">NIVEA 3D</span></div>
              <div className="text-[11px] tracking-[0.12em] font-bold text-[#0066CC]/60">USER MANAGEMENT • SYSTEM CONTROL</div>
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
        {/* SIDEBAR — admin only */}
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
              {k:'dash', l:'Overview', d:'Stats & health', i:BarChart3},
              {k:'users', l:'User Management', d:'Create, edit, revoke', i:Users},
              {k:'system', l:'System', d:'Storage & hives', i:Settings},
            ].map(n=>(
              <button key={n.k} onClick={()=>setTab(n.k as any)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition ${tab===n.k?'bg-[#0066CC] text-white border-[#0066CC] shadow-lg':'bg-white border-[#EAF4FF] hover:border-[#BFDBFF] hover:bg-[#F8FBFF] text-[#0A1628]'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tab===n.k?'bg-white/20':'bg-[#EAF4FF]'}`}><n.i size={18} className={tab===n.k?'text-white':'text-[#0066CC]'}/></div>
                <div className="leading-none"><div className="font-black text-sm">{n.l}</div><div className={`text-xs ${tab===n.k?'text-white/70':'text-zinc-500'}`}>{n.d}</div></div>
              </button>
            ))}
          </nav>

          <div className="mt-auto p-4 rounded-2xl bg-white border border-[#EAF4FF] shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black text-[#0066CC]"><Shield size={14}/> Security</div>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li className="flex gap-2"><CheckCircle size={12} className="text-emerald-500 mt-0.5"/> First-login IP auto-lock</li>
              <li className="flex gap-2"><CheckCircle size={12} className="text-emerald-500 mt-0.5"/> 1 ID 1 device enforced</li>
              <li className="flex gap-2"><CheckCircle size={12} className="text-emerald-500 mt-0.5"/> JWT + HttpOnly</li>
            </ul>
          </div>
          <div className="text-[10px] text-center text-zinc-400 tracking-widest">© 2026 BHNSTOCK • ADMIN</div>
        </aside>

        {/* Mobile tabs */}
        <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-1 p-1.5 rounded-full bg-white border border-[#BFDBFF] shadow-xl">
          {[
            {k:'dash', i:BarChart3}, {k:'users', i:Users}, {k:'system', i:Settings}
          ].map(n=>(
            <button key={n.k} onClick={()=>setTab(n.k as any)} className={`w-12 h-12 rounded-full flex items-center justify-center ${tab===n.k?'bg-[#0066CC] text-white':'text-[#0066CC]/60'}`}><n.i size={18}/></button>
          ))}
        </div>

        {/* MAIN */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 pb-20 lg:pb-6 space-y-5">
          {msg && <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className="px-4 py-3 rounded-2xl bg-white border border-[#BFDBFF] shadow-sm flex items-center gap-2 text-sm"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>{msg} <button onClick={()=>setMsg('')} className="ml-auto text-zinc-400">✕</button></motion.div>}

          {tab==='dash' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {l:'TOTAL USERS', v:users.length, sub:`${superCount} super`, i:Users, g:'from-[#0066CC] to-[#3B82F6]', iconBg:'bg-white/20'},
                  {l:'ACTIVE', v:active, sub:`${users.length-active} disabled`, i:CheckCircle, g:'from-emerald-500 to-teal-600', iconBg:'bg-white/20'},
                  {l:'ONLINE SESSIONS', v:online, sub:'Live now', i:Smartphone, g:'from-[#0A1628] to-[#162447]', iconBg:'bg-white/10'},
                  {l:'HIVES / CAMPAIGNS', v:`${stats?.firebases ?? 0} / ${stats?.campaigns?.total ?? 0}`, sub:'Firebase & jobs', i:Database, g:'from-violet-600 to-indigo-600', iconBg:'bg-white/20'},
                ].map(x=>(
                  <div key={x.l} className={`rounded-[20px] p-5 bg-gradient-to-br ${x.g} text-white shadow-lg border border-white/10 relative overflow-hidden`}>
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl"/>
                    <div className="relative flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${x.iconBg} flex items-center justify-center`}><x.i size={18}/></div>
                      <div><div className="text-[11px] font-black tracking-widest opacity-80">{x.l}</div><div className="text-2xl font-black">{x.v}</div><div className="text-xs opacity-70">{x.sub}</div></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-[20px] bg-white border border-[#EAF4FF] shadow-sm p-5">
                  <div className="flex items-center justify-between"><h3 className="font-black flex items-center gap-2"><TrendingUp size={16} className="text-[#0066CC]"/> Recent Users</h3><span className="text-xs px-2.5 py-1 rounded-full bg-[#EAF4FF] border border-[#BFDBFF] font-bold">{users.length} total</span></div>
                  <div className="mt-4 space-y-2">
                    {users.slice(0,6).map(u=>(
                      <div key={u.id} className="flex items-center justify-between p-3 rounded-2xl bg-[#F8FBFF] border border-[#EAF4FF] hover:border-[#BFDBFF] transition">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0066CC] to-[#1E40AF] text-white flex items-center justify-center font-black">{u.username[0].toUpperCase()}</div>
                          <div><div className="font-bold text-sm flex items-center gap-1.5">{u.username} {u.is_super && <span className="px-1.5 py-0.5 rounded-full bg-[#0066CC] text-white text-[10px] font-black">SUPER</span>} {u.session && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>}</div><div className="text-xs text-zinc-500">{u.is_active?'Active':'Disabled'} • {u.per_sim_limit}/SIM • {u.allowed_ip || 'IP auto'}</div></div>
                        </div>
                        <div className="text-right"><div className="text-xs font-bold">{u.expires_at? new Date(u.expires_at).toLocaleDateString(): '—'}</div><div className="text-[11px] text-zinc-400">{new Date(u.created_at).toLocaleDateString()}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-[20px] bg-white border border-[#EAF4FF] shadow-sm p-5">
                    <h3 className="font-black flex items-center gap-2"><Activity size={16} className="text-emerald-600"/> Capacity</h3>
                    <div className="mt-3">
                      <div className="flex justify-between text-sm"><span>Active users</span><b>{users.length?Math.round(active/users.length*100):0}%</b></div>
                      <div className="h-2.5 rounded-full bg-[#EAF4FF] overflow-hidden mt-2"><motion.div initial={{width:0}} animate={{width:`${users.length?active/users.length*100:0}%`}} className="h-full bg-gradient-to-r from-[#0066CC] to-[#00BFFF]" /></div>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center"><div className="text-2xl font-black text-emerald-700">{active}</div><div className="text-xs font-bold">Active</div></div>
                        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center"><div className="text-2xl font-black text-amber-700">{online}</div><div className="text-xs font-bold">Online</div></div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[20px] bg-gradient-to-br from-[#0066CC] to-[#1E40AF] p-5 text-white border border-white/10">
                    <h3 className="font-black flex items-center gap-2"><Zap size={16}/> Quick Actions</h3>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={()=>setTab('users')} className="py-2.5 rounded-xl bg-white text-[#0066CC] font-black text-sm">Manage Users</button>
                      <button onClick={load} className="py-2.5 rounded-xl bg-white/15 border border-white/20 font-bold text-sm">Refresh</button>
                    </div>
                    <p className="text-xs text-white/60 mt-3">Add user → first login auto IP lock → revoke → new device</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab==='users' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-lg flex items-center gap-2"><Users size={18} className="text-[#0066CC]"/> User Management <span className="px-2.5 py-1 rounded-full bg-[#0066CC] text-white text-xs font-black">{filtered.length}</span></h2>
                  <p className="text-xs text-zinc-500">Add via popup • First login IP auto-lock • 1 ID 1 device • Super only</p>
                </div>
                <button onClick={()=>setShowAdd(true)} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#0066CC] to-[#1E40AF] text-white font-black flex items-center gap-2 shadow-lg hover:shadow-xl"><UserPlus size={18}/> Add User</button>
              </div>

              <div className="rounded-[20px] bg-white border border-[#EAF4FF] shadow-sm p-4">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <div className="flex gap-1 p-1 rounded-full bg-[#F0F7FF] border border-[#EAF4FF]">
                    {['all','active','disabled','super'].map(f=>(
                      <button key={f} onClick={()=>setFilter(f as any)} className={`px-4 py-1.5 rounded-full text-xs font-black capitalize ${filter===f?'bg-[#0066CC] text-white shadow':'text-zinc-600 hover:bg-white'}`}>{f}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                      <input placeholder="Search username or IP" value={q} onChange={e=>setQ(e.target.value)} className="pl-9 pr-3 py-2.5 rounded-full bg-[#F8FBFF] border border-[#EAF4FF] focus:border-[#0066CC] outline-none text-sm w-64"/>
                    </div>
                    <button onClick={load} className="p-2.5 rounded-xl bg-[#0A1628] text-white"><RefreshCw size={16}/></button>
                  </div>
                </div>

                <div className="overflow-x-auto mt-4 rounded-2xl border border-[#F0F7FF]">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F0F7FF] text-[#0A1628] text-xs font-black tracking-widest">
                      <tr><th className="text-left p-3.5">USER</th><th className="p-3.5 text-left">IP / DEVICE LOCK</th><th className="p-3.5">LIMIT</th><th className="p-3.5">EXPIRY</th><th className="p-3.5">STATUS</th><th className="p-3.5">SESSION</th><th className="p-3.5 text-right">ACTIONS</th></tr>
                    </thead>
                    <tbody>
                      {filtered.map(u=>(
                        <tr key={u.id} className="border-t border-[#F8FBFF] hover:bg-[#F8FBFF]">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0066CC] to-[#1E40AF] text-white grid place-items-center font-black">{u.username[0].toUpperCase()}</div>
                              <div><div className="font-black flex items-center gap-1.5">{u.username} {u.is_super && <span className="px-2 py-0.5 rounded-full bg-[#0066CC] text-white text-[10px] font-black">SUPER</span>}</div><div className="text-xs text-zinc-500 font-mono">{u.id.slice(0,8)} • {new Date(u.created_at).toLocaleDateString()}</div></div>
                            </div>
                          </td>
                          <td className="p-3">
                            {editing===u.id ? (
                              <input autoFocus defaultValue={u.allowed_ip||''} id={`ip-${u.id}`} placeholder="auto" className="px-3 py-1.5 rounded-xl bg-white border-2 border-[#0066CC] text-xs w-32 outline-none"/>
                            ) : (
                              <div onClick={()=>setEditing(u.id)} className="cursor-pointer px-3 py-1.5 rounded-xl bg-[#F0F7FF] border border-[#EAF4FF] text-xs font-mono hover:border-[#0066CC]">
                                {u.allowed_ip || '— auto —'}
                              </div>
                            )}
                            <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1"><Lock size={10}/>{u.allowed_device?u.allowed_device.slice(0,18):'first-login lock'}</div>
                          </td>
                          <td className="p-3">
                            {editing===u.id ? (
                              <input type="number" defaultValue={u.per_sim_limit} id={`per-${u.id}`} className="w-20 px-2 py-1.5 rounded-xl bg-white border-2 border-[#0066CC] text-xs text-center font-black"/>
                            ) : (
                              <div onClick={()=>setEditing(u.id)} className="cursor-pointer font-black text-center px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">{u.per_sim_limit}<span className="font-normal text-xs">/SIM</span></div>
                            )}
                            <div className="text-[11px] text-center text-zinc-500">max {u.max_devices}</div>
                          </td>
                          <td className="p-3 text-center text-xs font-bold">{u.expires_at? new Date(u.expires_at).toLocaleDateString(): <span className="text-zinc-400">∞ Lifetime</span>}</td>
                          <td className="p-3 text-center">{u.is_active? <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black border border-emerald-200">ACTIVE</span>: <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black">DISABLED</span>}</td>
                          <td className="p-3 text-center text-xs">{u.session? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0066CC] text-white font-mono"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>{u.session.ip.slice(0,12)}</span>: <span className="text-zinc-300">—</span>}</td>
                          <td className="p-3">
                            <div className="flex justify-end gap-1">
                              {editing===u.id ? (
                                <>
                                  <button onClick={()=>{ const ip=(document.getElementById(`ip-${u.id}`) as HTMLInputElement).value; const per=parseInt((document.getElementById(`per-${u.id}`) as HTMLInputElement).value||'100'); save(u.id, per, ip)}} className="px-3 py-1.5 rounded-xl bg-[#0066CC] text-white font-black text-xs">Save</button>
                                  <button onClick={()=>setEditing(null)} className="px-3 py-1.5 rounded-xl bg-zinc-100 font-bold text-xs">Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={()=>setEditing(u.id)} className="p-2 rounded-xl bg-[#EAF4FF] hover:bg-[#0066CC] hover:text-white text-[#0066CC]"><Eye size={14}/></button>
                                  {u.is_active? <button onClick={()=>act('disable',u.id)} className="p-2 rounded-xl bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-700"><Ban size={14}/></button>: <button onClick={()=>act('enable',u.id)} className="p-2 rounded-xl bg-emerald-100 hover:bg-emerald-600 hover:text-white text-emerald-700"><Power size={14}/></button>}
                                  <button onClick={()=>act('kick',u.id)} className="p-2 rounded-xl bg-zinc-800 hover:bg-black text-white"><LogOut size={14}/></button>
                                  <button onClick={async()=>{ if(confirm('Revoke IP/Device? Next login new lock.')){ await api.post(`/api/admin/users/${u.id}/reset-lock`); load()}}} className="px-2.5 py-2 rounded-xl bg-[#0066CC] text-white font-black text-xs">Revoke</button>
                                  <button onClick={()=>del(u.id)} className="p-2 rounded-xl bg-red-50 hover:bg-red-600 hover:text-white text-red-600"><Trash2 size={14}/></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length===0 && <div className="p-10 text-center text-zinc-400">No users found</div>}
                </div>
              </div>
            </div>
          )}

          {tab==='system' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-[20px] bg-white border border-[#EAF4FF] shadow-sm p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0066CC] to-[#00BFFF] grid place-items-center mx-auto text-white"><HardDrive size={22}/></div>
                  <h3 className="font-black mt-3">Storage</h3>
                  <p className="text-sm text-zinc-500">Auto-clean 3 days • Mongo</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-left">
                    <div className="p-3 rounded-xl bg-[#F0F7FF] border"><div className="text-xs font-bold">Campaigns</div><div className="text-lg font-black">{stats?.campaigns?.total ?? 0}</div></div>
                    <div className="p-3 rounded-xl bg-[#F0F7FF] border"><div className="text-xs font-bold">Devices</div><div className="text-lg font-black">{stats?.devices?.total ?? 0}</div></div>
                  </div>
                  <button onClick={clean} className="mt-4 w-full py-3 rounded-xl bg-[#0A1628] text-white font-black">Clean Now (3d)</button>
                </div>
                <div className="rounded-[20px] bg-white border border-[#EAF4FF] shadow-sm p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500 grid place-items-center mx-auto text-white"><Activity size={22}/></div>
                  <h3 className="font-black mt-3">Health</h3>
                  <p className="text-sm text-zinc-500">{stats?.devices?.online ?? 0} online • {stats?.firebases ?? 0} hives</p>
                  <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <div className="flex justify-between text-sm"><span>Online</span><b>{stats?.devices?.online ?? 0}/{stats?.devices?.total ?? 0}</b></div>
                    <div className="h-2 rounded-full bg-white overflow-hidden mt-2"><div className="h-full bg-emerald-500" style={{width: `${stats?.devices?.total ? (stats.devices.online/stats.devices.total*100):0}%`}}/></div>
                  </div>
                  <div className="mt-3 text-xs flex items-center justify-center gap-2 text-emerald-700"><CheckCircle size={12}/> All systems operational</div>
                </div>
                <div className="rounded-[20px] bg-gradient-to-br from-[#0066CC] to-[#1E40AF] p-6 text-white border border-white/10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 grid place-items-center mx-auto"><Download size={22}/></div>
                  <h3 className="font-black mt-3">Export & Logs</h3>
                  <p className="text-sm text-white/70">Download users, hives, campaigns</p>
                  <button onClick={()=>{ const blob=new Blob([JSON.stringify(users,null,2)],{type:'application/json'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download='admin-users.json'; a.click()}} className="mt-4 w-full py-3 rounded-xl bg-white text-[#0066CC] font-black">Download Users JSON</button>
                  <Link to="/dashboard" className="mt-3 block text-xs text-white/70">← Back to App Dashboard</Link>
                </div>
              </div>

              <div className="rounded-[20px] bg-white border border-[#EAF4FF] shadow-sm p-6">
                <h3 className="font-black flex items-center gap-2"><Cpu size={18} className="text-[#0066CC]"/> System Info</h3>
                <div className="grid md:grid-cols-3 gap-3 mt-4">
                  {[
                    {k:'DB', v:'MongoDB (Cluster0)', d:'FULLY Mongo • in-memory dummy for sessions'},
                    {k:'Auth', v:'1 ID 1 Device', d:'First-login IP+device auto-lock • Revoke → new lock'},
                    {k:'Speed', v:stats?.devices?.capacity?.perSim ? `${stats.devices.capacity.perSim}/SIM` : '100/SIM', d:'Ultra 0.08x • per-slot equal load'},
                  ].map(x=>(
                    <div key={x.k} className="p-4 rounded-2xl bg-[#F8FBFF] border border-[#EAF4FF]">
                      <div className="text-xs font-black tracking-widest text-[#0066CC]">{x.k}</div>
                      <div className="font-black mt-1">{x.v}</div>
                      <div className="text-xs text-zinc-500 mt-1">{x.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ADD USER MODAL — premium glass */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div onClick={()=>setShowAdd(false)} className="absolute inset-0 bg-[#0A1628]/60 backdrop-blur-md"/>
            <motion.div initial={{scale:0.92, y:20, opacity:0}} animate={{scale:1, y:0, opacity:1}} exit={{scale:0.92, opacity:0}} className="relative w-full max-w-[480px] rounded-[24px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-white/50 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#0066CC] via-[#00BFFF] to-[#0066CC]"/>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0066CC] to-[#1E40AF] grid place-items-center text-white"><UserPlus size={18}/></div>
                    <div><h2 className="font-black text-lg leading-none">New User</h2><p className="text-xs text-zinc-500">Add to MongoDB • auto IP on first login</p></div>
                  </div>
                  <button onClick={()=>setShowAdd(false)} className="w-9 h-9 rounded-full bg-[#F0F7FF] grid place-items-center hover:bg-zinc-100">✕</button>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="text-xs font-black tracking-widest text-zinc-600">USERNAME</span>
                    <input autoFocus placeholder="e.g. rahul123" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#F0F7FF] border-2 border-transparent focus:border-[#0066CC] focus:bg-white outline-none text-sm font-bold"/>
                  </label>
                  <label className="block">
                    <span className="text-xs font-black tracking-widest text-zinc-600">PASSWORD</span>
                    <input placeholder="•••••••• (min 6)" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#F0F7FF] border-2 border-transparent focus:border-[#0066CC] focus:bg-white outline-none text-sm"/>
                  </label>
                  <label className="block">
                    <span className="text-xs font-black tracking-widest text-zinc-600">SUBSCRIPTION DAYS <span className="font-normal text-zinc-400 normal-case">— kitne din?</span></span>
                    <input placeholder="30" type="number" value={form.sub_days} onChange={e=>setForm({...form, sub_days:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#F0F7FF] border-2 border-transparent focus:border-[#0066CC] focus:bg-white outline-none text-sm font-black"/>
                    <div className="text-[11px] text-zinc-500 mt-1"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">0 = Lifetime</span> <span className="px-2 py-0.5 rounded-full bg-[#EAF4FF] font-bold">30 = 30 din</span></div>
                  </label>
                </div>

                {formError && <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-bold">⚠️ {formError}</div>}

                <div className="mt-4 p-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white grid place-items-center shrink-0"><Lock size={14}/></div>
                  <div className="text-xs leading-relaxed"><b>Auto IP lock:</b> User pehli baar login karega → IP + Device auto save → 1 ID 2 device block. <b>Revoke</b> se naya lock.</div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={()=>setShowAdd(false)} className="flex-1 py-3 rounded-2xl bg-[#F0F7FF] border border-[#EAF4FF] font-black">Cancel</button>
                  <button onClick={create} disabled={creating} className={`flex-1 py-3 rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 ${creating?'bg-zinc-300 text-zinc-600':'bg-gradient-to-r from-[#0066CC] to-[#1E40AF] text-white'}`}>{creating?'Creating…':'Create User'}</button>
                </div>
                <div className="text-center text-[11px] text-zinc-400 mt-3">Stored in <b>MongoDB Cluster0</b> • persists after Render restart</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
