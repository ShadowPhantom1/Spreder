import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/api'
import { Shield, Trash2, Power, UserPlus, Ban, Search, Users, Lock, Smartphone, LogOut, Eye } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function UsersPage(){
  const {users, load} = useOutletContext<any>()
  const [form,setForm]=useState({username:'', password:'', sub_days:'30'})
  const [msg,setMsg]=useState('')
  const [q,setQ]=useState('')
  const [filter,setFilter]=useState<'all'|'active'|'disabled'|'super'>('all')
  const [showAdd,setShowAdd]=useState(false)
  const [editing,setEditing]=useState<string|null>(null)
  const [formError,setFormError]=useState('')
  const [creating,setCreating]=useState(false)

  const create=async()=>{
    setFormError('')
    if(!form.username.trim() || !form.password.trim()){ setFormError('Username & password required'); setMsg('Username & password required'); return}
    if(form.password.trim().length < 6){ setFormError('Password min 6 chars'); return}
    const days=parseInt(form.sub_days||'0',10)
    if(isNaN(days) || days < 0){ setFormError('Days must be 0 or more'); return}
    const expires_at = days>0 ? new Date(Date.now()+days*24*60*60*1000).toISOString() : null
    setCreating(true)
    try{
      await api.post('/api/admin/users', { username: form.username.trim(), password: form.password, per_sim_limit:100, max_devices:100, expires_at });
      setMsg('✓ '+form.username+' created • '+ (days?days+' days':'lifetime')+' • Device lock on first login');
      setForm({username:'', password:'', sub_days:'30'});
      setFormError('');
      setShowAdd(false);
      load()
    }catch(e:any){
      let m=e.message||'Create failed'
      if(m.includes('Invalid token')||m.includes('Unauthorized')||m.includes('thwip')){
        m='Session expired — please login again at /super as admin'
        setTimeout(()=> window.location.href='/super', 1500)
      }
      if(m.includes('Super admin only')) m='Super admin only — login at /super with admin credentials'
      setFormError(m)
      setMsg(m)
    }finally{ setCreating(false)}
  }
  const act=async(p:string,id:string)=>{ try{ await api.post(`/api/admin/users/${id}/${p}`); setMsg('✓ '+p); load()}catch(e:any){ let m=e.message||'failed'; if(m.includes('Invalid token')){ m='Session expired — re-login at /super'; setTimeout(()=> window.location.href='/super',1200)}; setMsg(m)} }
  const del=async(id:string)=>{ if(!confirm('Delete user + data?')) return; try{ await api.del(`/api/admin/users/${id}`); setMsg('✓ Deleted'); load()}catch(e:any){ let m=e.message||'failed'; if(m.includes('Invalid token')) m='Session expired — re-login at /super'; setMsg(m)} }
  const save=async(id:string, per:number)=>{ try{ await api.put(`/api/admin/users/${id}`, {per_sim_limit:per}); setMsg('✓ Saved'); setEditing(null); load()}catch(e:any){ let m=e.message||'failed'; if(m.includes('Invalid token')) m='Session expired — re-login at /super'; setMsg(m)} }

  const filtered = users.filter((u:any)=>{
    if(q && !u.username.toLowerCase().includes(q.toLowerCase())) return false
    if(filter==='active' && !u.is_active) return false
    if(filter==='disabled' && u.is_active) return false
    if(filter==='super' && !u.is_super) return false
    return true
  })

  return (
    <div className="space-y-5">
      {msg && <div className="px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-2 text-sm text-slate-700"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>{msg} <button onClick={()=>setMsg('')} className="ml-auto text-slate-400 hover:text-slate-600">✕</button></div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-lg text-slate-900 flex items-center gap-2"><Users size={18} className="text-slate-700"/> User Management <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs font-bold">{filtered.length}</span></h2>
          <p className="text-xs text-slate-500 mt-1">Add via popup • Device lock on first login • 1 ID 1 device</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="px-5 py-3 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-2 hover:bg-black shadow"><UserPlus size={18}/> Add User</button>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-1 p-1 rounded-full bg-slate-100 border border-slate-200">
            {['all','active','disabled','super'].map(f=>(
              <button key={f} onClick={()=>setFilter(f as any)} className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize ${filter===f?'bg-slate-900 text-white':'text-slate-600 hover:bg-white'}`}>{f}</button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input placeholder="Search username" value={q} onChange={e=>setQ(e.target.value)} className="pl-9 pr-3 py-2.5 rounded-full bg-white border border-slate-300 focus:border-slate-900 outline-none text-sm w-64 text-slate-900 placeholder:text-slate-400"/>
          </div>
        </div>

        <div className="overflow-x-auto mt-4 rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-bold tracking-widest">
              <tr><th className="text-left p-3">USER</th><th className="p-3 text-left">DEVICE LOCK</th><th className="p-3">LIMIT</th><th className="p-3">EXPIRY</th><th className="p-3">STATUS</th><th className="p-3">SESSION</th><th className="p-3 text-right">ACTIONS</th></tr>
            </thead>
            <tbody>
              {filtered.map((u:any)=>(
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white grid place-items-center font-black text-sm">{u.username[0].toUpperCase()}</div>
                      <div><div className="font-bold text-slate-900 flex items-center gap-1.5">{u.username} {u.is_super && <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold">SUPER</span>}</div><div className="text-xs text-slate-500">{u.id.slice(0,8)} • {new Date(u.created_at).toLocaleDateString()}</div></div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="text-xs text-slate-600 flex items-center gap-1"><Lock size={12} className="text-slate-400"/>{u.allowed_device?u.allowed_device.slice(0,22):'— first login lock —'}</div>
                    <div className="text-xs text-slate-500">{u.allowed_device ? '1 device only' : 'any device (not yet locked)'}</div>
                  </td>
                  <td className="p-3">
                    {editing===u.id ? (
                      <input type="number" defaultValue={u.per_sim_limit} id={`per-${u.id}`} className="w-20 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-center font-bold text-slate-900"/>
                    ) : (
                      <div onClick={()=>setEditing(u.id)} className="cursor-pointer font-bold text-center px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200">{u.per_sim_limit}<span className="font-normal text-xs">/SIM</span></div>
                    )}
                    <div className="text-[11px] text-center text-slate-500">max {u.max_devices}</div>
                  </td>
                  <td className="p-3 text-center text-xs font-semibold text-slate-700">{u.expires_at? new Date(u.expires_at).toLocaleDateString(): <span className="text-slate-400">∞</span>}</td>
                  <td className="p-3 text-center">{u.is_active? <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">ACTIVE</span>: <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200">DISABLED</span>}</td>
                  <td className="p-3 text-center text-xs">{u.session? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 text-white font-mono text-xs"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>{u.session.ip?.slice(0,12) || 'online'}</span>: <span className="text-slate-400">—</span>}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {editing===u.id ? (
                        <>
                          <button onClick={()=>{ const per=parseInt((document.getElementById(`per-${u.id}`) as HTMLInputElement).value||'100'); save(u.id, per)}} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs">Save</button>
                          <button onClick={()=>setEditing(null)} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-bold text-xs text-slate-700">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={()=>setEditing(u.id)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"><Eye size={14}/></button>
                          {u.is_active? <button onClick={()=>act('disable',u.id)} className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"><Ban size={14}/></button>: <button onClick={()=>act('enable',u.id)} className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"><Power size={14}/></button>}
                          <button onClick={()=>act('kick',u.id)} className="p-2 rounded-lg bg-slate-900 hover:bg-black text-white"><LogOut size={14}/></button>
                          <button onClick={async()=>{ if(confirm('Revoke Device? Next login new device lock.')){ await api.post(`/api/admin/users/${u.id}/reset-lock`); load()}}} className="px-2.5 py-2 rounded-lg bg-slate-900 text-white font-bold text-xs">Revoke</button>
                          <button onClick={()=>del(u.id)} className="p-2 rounded-lg bg-white hover:bg-red-50 text-red-600 border border-slate-200"><Trash2 size={14}/></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && <div className="p-10 text-center text-slate-400 text-sm">No users found</div>}
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div onClick={()=>setShowAdd(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"/>
            <motion.div initial={{scale:0.96, y:12, opacity:0}} animate={{scale:1, y:0, opacity:1}} exit={{scale:0.96, opacity:0}} className="relative w-full max-w-[480px] rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 grid place-items-center text-white"><UserPlus size={18}/></div>
                    <div><h2 className="font-bold text-base text-slate-900 leading-none">New User</h2><p className="text-xs text-slate-500">Add to MongoDB • device lock on first login</p></div>
                  </div>
                  <button onClick={()=>setShowAdd(false)} className="w-9 h-9 rounded-full bg-slate-100 grid place-items-center hover:bg-slate-200 text-slate-600">✕</button>
                </div>
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="text-xs font-bold tracking-widest text-slate-700">USERNAME</span>
                    <input autoFocus placeholder="e.g. rahul123" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-xl bg-white border border-slate-300 focus:border-slate-900 outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400"/>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold tracking-widest text-slate-700">PASSWORD</span>
                    <input placeholder="•••••••• (min 6)" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-xl bg-white border border-slate-300 focus:border-slate-900 outline-none text-sm text-slate-900 placeholder:text-slate-400"/>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold tracking-widest text-slate-700">SUBSCRIPTION DAYS <span className="font-normal text-slate-500 normal-case">— kitne din?</span></span>
                    <input placeholder="30" type="number" value={form.sub_days} onChange={e=>setForm({...form, sub_days:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-xl bg-white border border-slate-300 focus:border-slate-900 outline-none text-sm font-bold text-slate-900 placeholder:text-slate-400"/>
                    <div className="text-[11px] text-slate-500 mt-1"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">0 = Lifetime</span> <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-bold ml-1">30 = 30 din</span></div>
                  </label>
                </div>
                {formError && <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">⚠️ {formError}</div>}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white grid place-items-center shrink-0"><Lock size={14}/></div>
                  <div className="text-xs leading-relaxed text-slate-600"><b className="text-slate-900">Device lock:</b> First login → device auto-save → 1 ID 2 device block. <b>Revoke</b> se naya device.</div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={()=>setShowAdd(false)} className="flex-1 py-3 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
                  <button onClick={create} disabled={creating} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${creating?'bg-slate-200 text-slate-500':'bg-slate-900 text-white hover:bg-black'}`}>{creating?'Creating…':'Create User'}</button>
                </div>
                <div className="text-center text-[11px] text-slate-400 mt-3">Stored in <b className="text-slate-600">MongoDB Cluster0</b> • persists after restart</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
