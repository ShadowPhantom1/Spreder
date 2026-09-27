import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Shield, Trash2, Power, UserPlus, Save, RefreshCw, Eye, Ban, Search, Users, Activity, Cpu, HardDrive, Crown, Lock, Smartphone, Calendar, TrendingUp, CheckCircle, AlertTriangle, Filter, Download, Edit3, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Admin(){
  const [users,setUsers]=useState<any[]>([])
  const [stats,setStats]=useState<any>(null)
  const [form,setForm]=useState({username:'', password:'', sub_days:'30'})
  const [msg,setMsg]=useState('')
  const [tab,setTab]=useState<'dash'|'users'|'sec'|'sys'>('dash')
  const [q,setQ]=useState('')
  const [filter,setFilter]=useState<'all'|'active'|'disabled'|'super'>('all')
  const [showAdd,setShowAdd]=useState(false)

  const load=async()=>{
    try{
      const [d,s]=await Promise.all([ api.get('/api/admin/users'), api.get('/api/stats').catch(()=>null) ])
      setUsers(d); if(s) setStats(s)
    }catch(e:any){ setMsg(e.message)}
  }
  useEffect(()=>{
    // security: if not super, kick to /super
    api.get('/api/auth/me').then((r:any)=>{
      if(!r?.user?.is_super) window.location.href='/super'
    }).catch(()=>{})
    load()
  },[])

  const create=async()=>{
    if(!form.username || !form.password) return setMsg('Username & password required')
    const days=parseInt(form.sub_days||'0',10)
    const expires_at = days>0 ? new Date(Date.now()+days*24*60*60*1000).toISOString() : null
    try{ await api.post('/api/admin/users', { username: form.username, password: form.password, per_sim_limit:100, max_devices:100, allowed_ip:'', expires_at }); setMsg('✓ '+form.username+' created • '+ (days?days+' days':'lifetime')+' • IP auto on first login'); setForm({username:'', password:'', sub_days:'30'}); setShowAdd(false); load()}catch(e:any){ setMsg(e.message)}
  }
  const act=async(p:string,id:string)=>{ try{ await api.post(`/api/admin/users/${id}/${p}`); load()}catch(e:any){ setMsg(e.message)} }
  const del=async(id:string)=>{ if(!confirm('Delete user + data?')) return; try{ await api.del(`/api/admin/users/${id}`); load()}catch(e:any){ setMsg(e.message)} }
  const save=async(id:string, per:number, ip:string)=>{ try{ await api.put(`/api/admin/users/${id}`, {per_sim_limit:per, allowed_ip:ip}); setMsg('✓ Saved'); load()}catch(e:any){ setMsg(e.message)} }
  const clean=async()=>{ try{ const r=await api.post('/api/admin/storage/clean', {days:3}); setMsg(`✓ Cleaned ${r.deleted}`)}catch(e:any){ setMsg(e.message)} }

  const filtered = users.filter(u=>{
    if(q && !u.username.toLowerCase().includes(q.toLowerCase()) && !(u.allowed_ip||'').includes(q)) return false
    if(filter==='active' && !u.is_active) return false
    if(filter==='disabled' && u.is_active) return false
    if(filter==='super' && !u.is_super) return false
    return true
  })

  const active = users.filter(u=>u.is_active).length
  const online = users.filter(u=>u.session).length

  return (
    <div className="space-y-6">
      {/* HERO — NIVEA 3D */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="rounded-3xl p-6 bg-gradient-to-br from-[#0066CC] via-[#3388DD] to-[#1E3A8A] text-white shadow-[0_20px_60px_rgba(0,102,204,0.3)] border border-white/20 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-transparent" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white text-[#0066CC] flex items-center justify-center shadow-xl"><Crown size={28}/></div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">SUPER ADMIN DASHBOARD</h1>
              <p className="text-white/80 text-sm">Nivea 3D • Full control — users, IP/device, limits, hives, campaigns</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-3 py-1 rounded-full bg-white text-[#0066CC] text-xs font-black">{users.length} USERS</span>
                <span className="px-3 py-1 rounded-full bg-emerald-400 text-[#0A1628] text-xs font-black">{active} ACTIVE</span>
                <span className="px-3 py-1 rounded-full bg-white/20 border border-white/30 text-xs font-bold">{online} ONLINE SESSIONS</span>
                <span className="px-3 py-1 rounded-full bg-white/20 border border-white/30 text-xs font-bold flex items-center gap-1"><Shield size={12}/>SECURE</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="px-4 py-2.5 rounded-xl bg-white text-[#0066CC] font-black flex items-center gap-2 shadow"><RefreshCw size={16}/>Refresh</button>
            <button onClick={clean} className="px-4 py-2.5 rounded-xl bg-white/15 border border-white/30 backdrop-blur text-white font-bold flex items-center gap-2"><HardDrive size={16}/>Clean 3D</button>
          </div>
        </div>
        {msg && <div className="mt-4 px-4 py-2 rounded-xl bg-white/15 border border-white/20 text-sm backdrop-blur">{msg}</div>}
      </motion.div>

      {/* TABS */}
      <div className="flex gap-2 p-1.5 rounded-full bg-[#EAF4FF] border border-[#BFDBFF] w-fit">
        {[
          {k:'dash',l:'Dashboard',i:TrendingUp},
          {k:'users',l:'Users List',i:Users},
          {k:'sec',l:'Security',i:Lock},
          {k:'sys',l:'System',i:Cpu},
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)} className={`px-6 py-2 rounded-full text-sm font-black flex items-center gap-2 transition ${tab===t.k?'bg-[#0066CC] text-white shadow-lg':'text-[#0066CC]/60 hover:bg-white'}`}><t.i size={15}/>{t.l}</button>
        ))}
      </div>

      {tab==='dash' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            {[
              {l:'TOTAL USERS', v:users.length, sub:'All accounts', i:Users, g:'from-[#0066CC] to-[#3B82F6]'},
              {l:'ONLINE NOW', v:online, sub:'Active sessions', i:Smartphone, g:'from-emerald-500 to-teal-600'},
              {l:'HIVES', v:stats?.firebases ?? '—', i:HardDrive, g:'from-indigo-600 to-violet-600'},
              {l:'CAMPAIGNS', v:stats?.campaigns?.total ?? '—', i:Activity, g:'from-orange-500 to-red-500'},
            ].map(x=>(
              <div key={x.l} className={`rounded-2xl p-5 bg-gradient-to-br ${x.g} text-white shadow-lg border border-white/10 relative overflow-hidden`}>
                <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-white/10 rounded-full blur-xl" />
                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><x.i size={18}/></div>
                  <div>
                    <div className="text-[11px] font-black tracking-widest opacity-80">{x.l}</div>
                    <div className="text-3xl font-black">{x.v}</div>
                    <div className="text-xs opacity-80">{x.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white p-5 border border-[#BFDBFF] shadow-sm">
              <h3 className="font-black text-[#0066CC] flex items-center gap-2"><Eye size={16}/> Recent Users</h3>
              <div className="mt-3 space-y-2">
                {users.slice(0,5).map(u=>(
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-[#EAF4FF] border border-[#BFDBFF]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#0066CC] text-white flex items-center justify-center text-xs font-black">{u.username[0].toUpperCase()}</div>
                      <div><div className="font-bold text-sm flex items-center gap-2">{u.username} {u.is_super && <Crown size={12} className="text-[#0066CC]"/>}</div><div className="text-xs text-zinc-500">{u.is_active?'active':'disabled'} • {u.per_sim_limit}/SIM</div></div>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${u.session?'bg-emerald-500':'bg-zinc-300'}`} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 border border-[#BFDBFF] shadow-sm">
              <h3 className="font-black text-[#0066CC] flex items-center gap-2"><Activity size={16}/> Usage</h3>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm"><span>Active</span><b>{users.length?Math.round(active/users.length*100):0}%</b></div>
                <div className="h-2 rounded-full bg-[#EAF4FF] overflow-hidden"><div className="h-full bg-[#0066CC]" style={{width:`${users.length?active/users.length*100:0}%`}} /></div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center"><div className="text-xl font-black text-emerald-700">{active}</div><div className="text-xs">Active</div></div>
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center"><div className="text-xl font-black text-red-700">{users.length-active}</div><div className="text-xs">Disabled</div></div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-[#0066CC] to-[#1E40AF] p-5 text-white border border-white/10">
              <h3 className="font-black flex items-center gap-2"><Shield size={16}/> Security Status</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-300"/> First-login IP lock ON</li>
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-300"/> Device fingerprint ON</li>
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-300"/> Single session enforced</li>
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-300"/> JWT HttpOnly + Bearer</li>
              </ul>
              <button onClick={()=>setTab('sec')} className="mt-4 w-full py-2 rounded-xl bg-white text-[#0066CC] font-black text-sm">View Security →</button>
            </div>
          </div>
        </div>
      )}

      {tab==='users' && (
        <div className="space-y-4">
          {/* CREATE — modal */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-600">Dash • Users List • Add via popup → <b>MongoDB</b> + <b>SQLite</b> dual (URI hai to Mongo, nahi to local)</div>
            <button onClick={()=>setShowAdd(true)} className="px-5 py-2.5 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white font-black flex items-center gap-2 shadow"><UserPlus size={16}/> Add User</button>
          </div>
          {showAdd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div onClick={()=>setShowAdd(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-[#BFDBFF] max-h-[90vh] overflow-auto">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-[#0066CC] flex items-center gap-2"><UserPlus size={18}/> New User</h2>
                  <button onClick={()=>setShowAdd(false)} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">✕</button>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Fill and Create → auto save to <b>Mongo</b> (if URI) + <b>local DB</b> fallback</p>
                <div className="grid grid-cols-1 gap-3 mt-4">
                  <label><span className="text-xs font-bold">Username</span><input placeholder="e.g. rahul123" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#EAF4FF] border border-[#BFDBFF] text-sm outline-none focus:border-[#0066CC]"/></label>
                  <label><span className="text-xs font-bold">Password</span><input placeholder="••••••••" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#EAF4FF] border border-[#BFDBFF] text-sm outline-none focus:border-[#0066CC]"/></label>
                  <label><span className="text-xs font-bold">Subscription Days <span className="font-normal text-zinc-500">(kitne din ka)</span></span><input placeholder="30" type="number" value={form.sub_days} onChange={e=>setForm({...form, sub_days:e.target.value})} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#EAF4FF] border border-[#BFDBFF] text-sm outline-none focus:border-[#0066CC]"/><div className="text-[11px] text-zinc-500">0 = lifetime • 30 = 30 din baad expire</div></label>
                </div>
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                  <b>IP auto:</b> User jab pehli baar `username/pass` se login karega → uska IP + device auto admin me save ho jayega → fir 1 ID 2 devices pe nahi chalega. <b>Revoke</b> dabane pe lock hat jayega, next login pe naya IP set.
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-100 font-bold">Cancel</button>
                  <button onClick={create} className="flex-1 py-2.5 rounded-xl bg-[#0066CC] text-white font-black">Create User</button>
                </div>
                <div className="mt-3 text-xs text-center text-zinc-500">Mongo + SQLite dual — auto save</div>
              </motion.div>
            </div>
          )}

          {/* LIST — premium table */}
          <div className="rounded-2xl bg-white p-5 border border-[#BFDBFF] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-black text-[#0066CC] flex items-center gap-2"><Users size={18}/> Users — List View <span className="px-2 py-0.5 rounded-full bg-[#EAF4FF] border border-[#BFDBFF] text-xs">{filtered.length}</span></h2>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 p-1 rounded-full bg-[#EAF4FF] border border-[#BFDBFF]">
                  {['all','active','disabled','super'].map(f=>(
                    <button key={f} onClick={()=>setFilter(f as any)} className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${filter===f?'bg-[#0066CC] text-white':'text-[#0066CC]/70'}`}>{f}</button>
                  ))}
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0066CC]/50"/>
                  <input placeholder="Search" value={q} onChange={e=>setQ(e.target.value)} className="pl-9 pr-3 py-2 rounded-full bg-[#EAF4FF] border border-[#BFDBFF] text-sm outline-none w-40"/>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto mt-4 rounded-xl border border-[#EAF4FF]">
              <table className="w-full text-sm">
                <thead className="bg-[#EAF4FF] text-[#0066CC] text-xs tracking-widest">
                  <tr><th className="text-left p-3">USER</th><th className="p-3">DEVICE / IP LOCK</th><th className="p-3">LIMIT & DEVICES</th><th className="p-3">EXPIRY</th><th className="p-3">STATUS</th><th className="p-3">SESSION</th><th className="p-3 text-right">ACTIONS</th></tr>
                </thead>
                <tbody>
                  {filtered.map(u=>(
                    <tr key={u.id} className="border-t border-[#F0F7FF] hover:bg-[#F8FBFF]">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0066CC] to-[#1E40AF] text-white flex items-center justify-center font-black text-sm">{u.username[0].toUpperCase()}</div>
                          <div>
                            <div className="font-bold flex items-center gap-1.5">{u.username} {u.is_super && <span className="px-1.5 py-0.5 rounded-full bg-[#0066CC] text-white text-[10px] font-black">SUPER</span>}</div>
                            <div className="text-xs text-zinc-500">{u.id.slice(0,8)} • {new Date(u.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <input defaultValue={u.allowed_ip||''} id={`ip-${u.id}`} placeholder="*" className="px-2.5 py-1.5 rounded-lg bg-white border border-[#BFDBFF] text-xs w-28 outline-none focus:border-[#0066CC]"/>
                        <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1"><Lock size={10}/>{u.allowed_device?u.allowed_device.slice(0,14):'first-login lock'} {u.allowed_ip?`• ${u.allowed_ip}`:'• IP auto'}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input defaultValue={u.per_sim_limit} id={`per-${u.id}`} type="number" className="w-16 px-2 py-1.5 rounded-lg bg-white border border-[#BFDBFF] text-xs text-center font-bold"/>
                          <span className="text-xs font-bold">/SIM</span>
                        </div>
                        <div className="text-xs text-zinc-500">{u.max_devices} devices max</div>
                      </td>
                      <td className="p-3 text-xs">{u.expires_at? new Date(u.expires_at).toLocaleDateString(): <span className="text-zinc-400">—</span>}</td>
                      <td className="p-3">{u.is_active? <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black border border-emerald-200">ACTIVE</span>: <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black border border-red-200">DISABLED</span>}</td>
                      <td className="p-3 text-xs">{u.session? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200 font-mono"><Smartphone size={10}/>{u.session.ip} • {u.session.device_id.slice(0,6)}</span>: <span className="text-zinc-400">—</span>}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button onClick={()=>{
                            const ip=(document.getElementById(`ip-${u.id}`) as HTMLInputElement).value
                            const per=parseInt((document.getElementById(`per-${u.id}`) as HTMLInputElement).value||'100')
                            save(u.id, per, ip)
                          }} className="p-1.5 rounded-lg bg-[#0066CC] text-white hover:bg-[#0052A3]"><Save size={14}/></button>
                          {u.is_active? <button onClick={()=>act('disable',u.id)} className="p-1.5 rounded-lg bg-amber-500 text-white"><Ban size={14}/></button>: <button onClick={()=>act('enable',u.id)} className="p-1.5 rounded-lg bg-emerald-600 text-white"><Power size={14}/></button>}
                          <button onClick={()=>act('kick',u.id)} className="p-1.5 rounded-lg bg-zinc-700 text-white" title="Kick session"><LogOut size={14}/></button>
                          <button onClick={async()=>{ if(confirm('Revoke IP/Device lock? Next login pe naya IP auto set hoga')){ await api.post(`/api/admin/users/${u.id}/reset-lock`); load()}}} className="p-1.5 rounded-lg bg-sky-600 text-white font-bold text-xs px-2" title="Revoke — clear IP/device, next login new lock">Revoke</button>
                          <button onClick={()=>del(u.id)} className="p-1.5 rounded-lg bg-red-600 text-white"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab==='sec' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-6 border border-[#BFDBFF] shadow-sm">
            <h3 className="font-black text-[#0066CC] flex items-center gap-2"><Lock size={18}/> IP & Device Lock</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="p-3 rounded-xl bg-[#EAF4FF] border border-[#BFDBFF]"><b>First login</b> — IP + device fingerprint auto save, next login only same device</li>
              <li className="p-3 rounded-xl bg-[#EAF4FF] border border-[#BFDBFF]"><b>Super can</b> — Reset Lock → next login new device</li>
              <li className="p-3 rounded-xl bg-[#EAF4FF] border border-[#BFDBFF]"><b>Session</b> — 1 user = 1 token, 1 device, kick old</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-[#EAF4FF] to-white p-6 border border-[#BFDBFF]">
            <h3 className="font-black text-[#0066CC] flex items-center gap-2"><Shield size={18}/> Auth</h3>
            <div className="mt-3 text-sm space-y-2">
              <div className="flex justify-between p-2 rounded-lg bg-white border"><span>JWT</span><b>Bearer + HttpOnly</b></div>
              <div className="flex justify-between p-2 rounded-lg bg-white border"><span>Expiry</span><b>7 days</b></div>
              <div className="flex justify-between p-2 rounded-lg bg-white border"><span>Admin route</span><b>/super → /admin (super only)</b></div>
            </div>
          </div>
        </div>
      )}

      {tab==='sys' && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white p-6 border border-[#BFDBFF] text-center">
            <HardDrive size={28} className="mx-auto text-[#0066CC]"/>
            <h3 className="font-black mt-2">Storage</h3>
            <p className="text-sm text-zinc-500">Auto delete after 3 days</p>
            <button onClick={clean} className="mt-4 w-full py-2 rounded-xl bg-[#0066CC] text-white font-black">Clean Now</button>
          </div>
          <div className="rounded-2xl bg-white p-6 border border-[#BFDBFF] text-center">
            <Activity size={28} className="mx-auto text-emerald-600"/>
            <h3 className="font-black mt-2">Health</h3>
            <p className="text-sm text-zinc-500">{stats?.devices?.online ?? 0} online bots</p>
            <div className="mt-4 h-2 rounded-full bg-[#EAF4FF] overflow-hidden"><div className="h-full bg-emerald-500" style={{width:'72%'}}/></div>
          </div>
          <div className="rounded-2xl bg-white p-6 border border-[#BFDBFF] text-center">
            <Download size={28} className="mx-auto text-[#0066CC]"/>
            <h3 className="font-black mt-2">Export</h3>
            <p className="text-sm text-zinc-500">Users & logs</p>
            <button onClick={()=>{ const blob=new Blob([JSON.stringify(users,null,2)],{type:'application/json'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download='users.json'; a.click()}} className="mt-4 w-full py-2 rounded-xl bg-white border border-[#BFDBFF] font-bold">Download JSON</button>
          </div>
        </div>
      )}
    </div>
  )
}
