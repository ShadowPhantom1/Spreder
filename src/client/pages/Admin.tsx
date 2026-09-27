import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Shield, Trash2, Power, UserPlus, Save, RefreshCw, Eye, Ban, Key, Search, Users, Activity, Cpu, HardDrive, Crown, Lock, Smartphone, Calendar, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Admin(){
  const [users,setUsers]=useState<any[]>([])
  const [stats,setStats]=useState<any>(null)
  const [form,setForm]=useState({username:'', password:'', per_sim_limit:100, max_devices:100, allowed_ip:'', expires_at:''})
  const [msg,setMsg]=useState('')
  const [tab,setTab]=useState<'overview'|'users'|'activity'|'system'>('overview')
  const [q,setQ]=useState('')

  const load=async()=>{
    try{
      const [d,s]=await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/stats').catch(()=>null)
      ])
      setUsers(d); if(s) setStats(s)
    }catch(e:any){ setMsg(e.message)}
  }
  useEffect(()=>{ load(); },[])

  const create=async()=>{
    if(!form.username || !form.password) {setMsg('username/password required'); return}
    try{ await api.post('/api/admin/users', form); setMsg('✓ Created '+form.username); setForm({username:'', password:'', per_sim_limit:100, max_devices:100, allowed_ip:'', expires_at:''}); load()}catch(e:any){ setMsg(e.message)}
  }
  const act=async(path:string, id:string)=>{
    try{ await api.post(`/api/admin/users/${id}/${path}`); load()}catch(e:any){ setMsg(e.message)}
  }
  const del=async(id:string)=>{
    if(!confirm('Delete user + all his data?')) return
    try{ await api.del(`/api/admin/users/${id}`); load()}catch(e:any){ setMsg(e.message)}
  }
  const save=async(id:string, per:number, max:number, ip:string)=>{
    try{ await api.put(`/api/admin/users/${id}`, {per_sim_limit:per, max_devices:max, allowed_ip:ip}); setMsg('✓ Saved'); load()}catch(e:any){ setMsg(e.message)}
  }
  const clean=async()=>{
    try{ const r=await api.post('/api/admin/storage/clean', {days:3}); setMsg(`✓ Cleaned ${r.deleted} old campaigns`); load()}catch(e:any){ setMsg(e.message)}
  }

  const filtered = users.filter(u=> !q || u.username.toLowerCase().includes(q.toLowerCase()) || (u.allowed_ip||'').includes(q) )
  const active = users.filter(u=>u.is_active).length
  const disabled = users.length - active
  const superCount = users.filter(u=>u.is_super).length
  const onlineSessions = users.filter(u=>u.session).length

  return (
    <div className="space-y-6">
      {/* Hero Nivea 3D */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="rounded-3xl p-6 bg-gradient-to-br from-[#0066CC] via-[#3B82F6] to-[#1E40AF] text-white shadow-xl border border-white/20 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white text-[#0066CC] shadow-lg"><Crown className="w-8 h-8"/></div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">SUPER ADMIN • NIVEA 3D</h1>
              <p className="text-white/80 text-sm">Global control — users, IP/device lock, limits, storage, analytics</p>
              <div className="flex gap-2 mt-2 text-xs font-bold">
                <span className="px-2 py-1 rounded-full bg-white/20 border border-white/30">{users.length} USERS</span>
                <span className="px-2 py-1 rounded-full bg-emerald-400 text-[#0066CC]">{active} ACTIVE</span>
                <span className="px-2 py-1 rounded-full bg-white/20">{onlineSessions} ONLINE</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="px-4 py-2 rounded-xl bg-white text-[#0066CC] font-black flex items-center gap-2 shadow"><RefreshCw className="w-4 h-4"/>Refresh</button>
            <button onClick={clean} className="px-4 py-2 rounded-xl bg-white/20 border border-white/30 backdrop-blur flex items-center gap-2 font-bold"><HardDrive className="w-4 h-4"/>Clean 3D</button>
          </div>
        </div>
        {msg && <div className="mt-4 text-sm bg-white/20 backdrop-blur rounded-xl px-4 py-2 border border-white/20">{msg}</div>}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-full bg-[#EAF4FF] border border-[#BFD9FF] w-fit">
        {[
          {k:'overview',l:'Overview',i:TrendingUp},
          {k:'users',l:`Users (${users.length})`,i:Users},
          {k:'activity',l:'Activity',i:Activity},
          {k:'system',l:'System',i:Cpu},
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)} className={`px-5 py-2 rounded-full text-sm font-black flex items-center gap-2 ${tab===t.k?'bg-[#0066CC] text-white shadow':'text-[#0066CC]/70 hover:bg-white'}`}><t.i size={14}/>{t.l}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab==='overview' && (
        <div className="grid lg:grid-cols-4 gap-4">
          {[
            {l:'Total Users',v:users.length, i:Users, c:'from-[#0066CC] to-[#3B82F6]', sub:`${superCount} super • ${active} active`},
            {l:'Active Sessions',v:onlineSessions, i:Smartphone, c:'from-emerald-500 to-teal-600', sub:'One device lock'},
            {l:'Hives',v:stats?.firebases ?? '—', i:HardDrive, c:'from-[#1E40AF] to-[#6366F1]', sub:'Firebase RTDB'},
            {l:'Today Sent',v:stats?.today?.totalToday ?? stats?.campaigns?.totalSent ?? '—', i:TrendingUp, c:'from-orange-500 to-red-500', sub:'SMS today'},
          ].map((x,i)=>(
            <div key={x.l} className={`rounded-2xl p-5 bg-gradient-to-br ${x.c} text-white shadow-lg border border-white/20 relative overflow-hidden`}>
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
              <div className="relative flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/20"><x.i size={18}/></div>
                <div>
                  <div className="text-xs font-bold tracking-widest opacity-80">{x.l}</div>
                  <div className="text-2xl font-black">{x.v}</div>
                  <div className="text-xs opacity-80">{x.sub}</div>
                </div>
              </div>
            </div>
          ))}
          <div className="lg:col-span-4 grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white p-5 border border-[#BFD9FF] shadow-sm">
              <h3 className="font-black text-[#0066CC] flex items-center gap-2"><AlertTriangle size={14}/> Health</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex justify-between"><span>Active rate</span><b className="text-emerald-600">{users.length?Math.round(active/users.length*100):0}%</b></li>
                <li className="flex justify-between"><span>Disabled</span><b className="text-amber-600">{disabled}</b></li>
                <li className="flex justify-between"><span>Super admins</span><b className="text-[#0066CC]">{superCount}</b></li>
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-5 border border-[#BFD9FF] shadow-sm">
              <h3 className="font-black text-[#0066CC] flex items-center gap-2"><Calendar size={14}/> Limits</h3>
              <p className="text-sm text-zinc-600 mt-2">Per-SIM daily limit controls SMS throughput. Set per user in Users tab.</p>
              <div className="mt-3 text-xs font-mono bg-[#EAF4FF] rounded-lg p-2 border border-[#BFD9FF]">Example: 100/SIM → 2 SIM = 200/day</div>
            </div>
            <div className="rounded-2xl bg-white p-5 border border-[#BFD9FF] shadow-sm">
              <h3 className="font-black text-[#0066CC] flex items-center gap-2"><Lock size={14}/> Security</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500"/> First-login IP lock</li>
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500"/> Device fingerprint</li>
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500"/> Single session</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* USERS */}
      {tab==='users' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 border border-[#BFD9FF] shadow-sm">
            <h2 className="font-black text-[#0066CC] flex items-center gap-2"><UserPlus className="w-5 h-5"/> Create User</h2>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mt-4">
              <input placeholder="username" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="px-3 py-2.5 rounded-xl bg-[#EAF4FF] border border-[#BFD9FF] outline-none focus:border-[#0066CC] text-sm"/>
              <input placeholder="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="px-3 py-2.5 rounded-xl bg-[#EAF4FF] border border-[#BFD9FF] outline-none focus:border-[#0066CC] text-sm"/>
              <input placeholder="per SIM" type="number" value={form.per_sim_limit} onChange={e=>setForm({...form, per_sim_limit: parseInt(e.target.value)||100})} className="px-3 py-2.5 rounded-xl bg-[#EAF4FF] border border-[#BFD9FF] text-sm"/>
              <input placeholder="max devices" type="number" value={form.max_devices} onChange={e=>setForm({...form, max_devices: parseInt(e.target.value)||100})} className="px-3 py-2.5 rounded-xl bg-[#EAF4FF] border border-[#BFD9FF] text-sm"/>
              <input placeholder="IP * or 1.2.3.4" value={form.allowed_ip} onChange={e=>setForm({...form, allowed_ip:e.target.value})} className="px-3 py-2.5 rounded-xl bg-[#EAF4FF] border border-[#BFD9FF] text-sm"/>
              <input type="date" value={form.expires_at} onChange={e=>setForm({...form, expires_at:e.target.value})} className="px-3 py-2.5 rounded-xl bg-[#EAF4FF] border border-[#BFD9FF] text-sm"/>
              <button onClick={create} className="px-4 py-2.5 rounded-xl bg-[#0066CC] text-white font-black shadow">Create</button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 border border-[#BFD9FF] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-black text-[#0066CC] flex items-center gap-2"><Users className="w-5 h-5"/> All Users • {filtered.length}</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#0066CC]/50"/>
                  <input placeholder="Search username/IP" value={q} onChange={e=>setQ(e.target.value)} className="pl-8 pr-3 py-2 rounded-full bg-[#EAF4FF] border border-[#BFD9FF] text-sm outline-none focus:border-[#0066CC] w-56"/>
                </div>
                <span className="text-xs font-bold text-[#0066CC]/60">{active} active • {disabled} disabled</span>
              </div>
            </div>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead className="text-[#0066CC]/60 text-xs tracking-widest"><tr><th className="text-left p-2.5">USER</th><th className="p-2.5">LOCK</th><th className="p-2.5">LIMIT</th><th className="p-2.5">EXPIRY</th><th className="p-2.5">STATUS</th><th className="p-2.5">SESSION</th><th className="p-2.5">ACTIONS</th></tr></thead>
                <tbody>
                  {filtered.map((u:any)=>(
                    <tr key={u.id} className="border-t border-[#EAF4FF] hover:bg-[#EAF4FF]/50">
                      <td className="p-2.5">
                        <div className="font-bold flex items-center gap-2">{u.username} {u.is_super && <span className="px-1.5 py-0.5 rounded-full bg-[#0066CC] text-white text-[10px]">SUPER</span>}</div>
                        <div className="text-xs text-zinc-500 flex items-center gap-1">{u.allowed_device? <><Lock size={10}/> {u.allowed_device.slice(0,12)}</> : '🔓 first-login lock'}</div>
                      </td>
                      <td className="p-2.5">
                        <input defaultValue={u.allowed_ip||''} placeholder="*" id={`ip-${u.id}`} className="px-2 py-1.5 rounded-lg bg-[#EAF4FF] border border-[#BFD9FF] w-28 text-xs outline-none"/>
                        <div className="text-[11px] text-zinc-500">{u.allowed_ip||'auto on first login'}</div>
                      </td>
                      <td className="p-2.5"><div className="flex items-center gap-1"><input defaultValue={u.per_sim_limit} id={`per-${u.id}`} className="w-16 px-2 py-1.5 rounded-lg bg-[#EAF4FF] border border-[#BFD9FF] text-xs"/><span className="text-xs">/SIM</span></div><div className="text-[11px] text-zinc-500">{u.max_devices} devices</div></td>
                      <td className="p-2.5 text-xs">{u.expires_at? new Date(u.expires_at).toLocaleDateString(): '—'}</td>
                      <td className="p-2.5">{u.is_active? <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">active</span> : <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">disabled</span>}</td>
                      <td className="p-2.5 text-xs">{u.session? <span className="px-2 py-1 rounded-full bg-sky-100 text-sky-700 font-mono">{u.session.ip} • {u.session.device_id?.slice(0,6)}</span> : <span className="text-zinc-400">—</span>}</td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          <button onClick={()=>{
                            const ip=(document.getElementById(`ip-${u.id}`) as HTMLInputElement)?.value
                            const per=parseInt((document.getElementById(`per-${u.id}`) as HTMLInputElement)?.value || '100')
                            save(u.id, per, u.max_devices, ip)
                          }} className="px-2.5 py-1 rounded-full bg-[#0066CC] text-white text-xs font-bold flex items-center gap-1"><Save size={12}/>Save</button>
                          {u.is_active? <button onClick={()=>act('disable', u.id)} className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center gap-1"><Ban size={12}/>Disable</button> : <button onClick={()=>act('enable', u.id)} className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold"><Power size={12}/>Enable</button>}
                          <button onClick={()=>act('kick', u.id)} className="px-2.5 py-1 rounded-full bg-zinc-800 text-white text-xs">Kick</button>
                          <button onClick={async()=>{ if(confirm('Reset lock? Next login new device')){ await api.post(`/api/admin/users/${u.id}/reset-lock`); load()}}} className="px-2.5 py-1 rounded-full bg-sky-600 text-white text-xs">Reset</button>
                          <button onClick={()=>del(u.id)} className="px-2.5 py-1 rounded-full bg-red-600 text-white text-xs"><Trash2 size={12}/></button>
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

      {tab==='activity' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-5 border border-[#BFD9FF]">
            <h3 className="font-black text-[#0066CC] flex items-center gap-2"><Eye size={16}/> Recent Logins</h3>
            <div className="mt-3 space-y-2">
              {users.filter(u=>u.session).slice(0,6).map((u:any)=>(
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-[#EAF4FF] border border-[#BFD9FF]">
                  <div><div className="font-bold text-sm">{u.username}</div><div className="text-xs text-zinc-500">{u.session.ip} • {u.session.device_id?.slice(0,10)}</div></div>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">online</span>
                </div>
              ))}
              {users.filter(u=>u.session).length===0 && <div className="text-sm text-zinc-500">No active sessions</div>}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5 border border-[#BFD9FF]">
            <h3 className="font-black text-[#0066CC] flex items-center gap-2"><Activity size={16}/> Campaign Stats</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-[#0066CC] text-white text-center"><div className="text-2xl font-black">{stats?.campaigns?.total ?? '—'}</div><div className="text-xs opacity-80">Total</div></div>
              <div className="p-4 rounded-xl bg-emerald-600 text-white text-center"><div className="text-2xl font-black">{stats?.campaigns?.totalSent ?? '—'}</div><div className="text-xs opacity-80">Sent</div></div>
            </div>
          </div>
        </div>
      )}

      {tab==='system' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-5 border border-[#BFD9FF]">
            <h3 className="font-black text-[#0066CC] flex items-center gap-2"><HardDrive size={16}/> Storage</h3>
            <p className="text-sm text-zinc-600 mt-2">Auto-delete completed campaigns after 3 days. Manual clean available.</p>
            <button onClick={clean} className="mt-4 px-4 py-2 rounded-xl bg-[#0066CC] text-white font-black">Clean 3 Days</button>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-[#EAF4FF] to-white p-5 border border-[#BFD9FF]">
            <h3 className="font-black text-[#0066CC] flex items-center gap-2"><Key size={16}/> Access</h3>
            <div className="text-sm text-zinc-700 mt-2 space-y-1">
              <div>• One user → one device → one IP</div>
              <div>• First login auto-locks IP & device</div>
              <div>• Super admin can Reset Lock</div>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-zinc-500 flex items-center gap-2"><Shield className="w-3 h-3"/> Nivea 3D • Blue soft theme • No phonk • Super admin via main /login</div>
    </div>
  )
}
