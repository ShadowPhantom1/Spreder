import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/api'
import { Shield, Trash2, Power, UserPlus, Save, Ban, Search, Users, Lock, Smartphone, LogOut, Eye } from 'lucide-react'
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
      await api.post('/api/admin/users', { username: form.username.trim(), password: form.password, per_sim_limit:100, max_devices:100, allowed_ip:'', expires_at });
      setMsg('✓ '+form.username+' created • '+ (days?days+' days':'lifetime')+' • IP auto on first login');
      setForm({username:'', password:'', sub_days:'30'});
      setFormError('');
      setShowAdd(false);
      load()
    }catch(e:any){
      let m=e.message||'Create failed'
      if(m.includes('Invalid token')||m.includes('Unauthorized')||m.includes('thwip')){
        m='Session expired — please login again at /super as admin'
        // auto redirect after 1.5s
        setTimeout(()=> window.location.href='/super', 1500)
      }
      if(m.includes('Super admin only')) m='Super admin only — login at /super with admin credentials'
      setFormError(m)
      setMsg(m)
    }finally{ setCreating(false)}
  }
  const act=async(p:string,id:string)=>{ try{ await api.post(`/api/admin/users/${id}/${p}`); setMsg('✓ '+p); load()}catch(e:any){ let m=e.message||'failed'; if(m.includes('Invalid token')){ m='Session expired — re-login at /super'; setTimeout(()=> window.location.href='/super',1200)}; setMsg(m)} }
  const del=async(id:string)=>{ if(!confirm('Delete user + data?')) return; try{ await api.del(`/api/admin/users/${id}`); setMsg('✓ Deleted'); load()}catch(e:any){ let m=e.message||'failed'; if(m.includes('Invalid token')) m='Session expired — re-login at /super'; setMsg(m)} }
  const save=async(id:string, per:number, ip:string)=>{ try{ await api.put(`/api/admin/users/${id}`, {per_sim_limit:per, allowed_ip:ip}); setMsg('✓ Saved'); setEditing(null); load()}catch(e:any){ let m=e.message||'failed'; if(m.includes('Invalid token')) m='Session expired — re-login at /super'; setMsg(m)} }

  const filtered = users.filter((u:any)=>{
    if(q && !u.username.toLowerCase().includes(q.toLowerCase()) && !(u.allowed_ip||'').includes(q)) return false
    if(filter==='active' && !u.is_active) return false
    if(filter==='disabled' && u.is_active) return false
    if(filter==='super' && !u.is_super) return false
    return true
  })

  return (
    <div className="space-y-4">
      {msg && <div className="px-4 py-3 rounded-2xl bg-white border border-[#BFDBFF] shadow-sm flex items-center gap-2 text-sm"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>{msg} <button onClick={()=>setMsg('')} className="ml-auto text-zinc-400">✕</button></div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-lg flex items-center gap-2"><Users size={18} className="text-[#0066CC]"/> User Management <span className="px-2.5 py-1 rounded-full bg-[#0066CC] text-white text-xs font-black">{filtered.length}</span></h2>
          <p className="text-xs text-zinc-500">Add via popup • First login IP auto-lock • 1 ID 1 device • Super only • /adminbhnstock</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#E30613] to-[#9A0007] text-white font-black flex items-center gap-2 shadow-[0_8px_22px_rgba(227,6,19,0.35)] hover:shadow-xl"><UserPlus size={18}/> Add User</button>
      </div>

      <div className="rounded-[20px] bg-white border border-[#EAF4FF] shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-1 p-1 rounded-full bg-[#F0F7FF] border border-[#EAF4FF]">
            {['all','active','disabled','super'].map(f=>(
              <button key={f} onClick={()=>setFilter(f as any)} className={`px-4 py-1.5 rounded-full text-xs font-black capitalize ${filter===f?'bg-[#E30613] text-white shadow':'text-zinc-600 hover:bg-white'}`}>{f}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
              <input placeholder="Search username or IP" value={q} onChange={e=>setQ(e.target.value)} className="pl-9 pr-3 py-2.5 rounded-full bg-[#F8FBFF] border border-[#EAF4FF] focus:border-[#0066CC] outline-none text-sm w-64"/>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto mt-4 rounded-2xl border border-[#F0F7FF]">
          <table className="w-full text-sm">
            <thead className="bg-[#F0F7FF] text-[#0A1628] text-xs font-black tracking-widest">
              <tr><th className="text-left p-3.5">USER</th><th className="p-3.5 text-left">IP / DEVICE LOCK</th><th className="p-3.5">LIMIT</th><th className="p-3.5">EXPIRY</th><th className="p-3.5">STATUS</th><th className="p-3.5">SESSION</th><th className="p-3.5 text-right">ACTIONS</th></tr>
            </thead>
            <tbody>
              {filtered.map((u:any)=>(
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
                  <td className="p-3 text-center text-xs font-bold">{u.expires_at? new Date(u.expires_at).toLocaleDateString(): <span className="text-zinc-400">∞</span>}</td>
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

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div onClick={()=>setShowAdd(false)} className="absolute inset-0 bg-[#0A1628]/60 backdrop-blur-md"/>
            <motion.div initial={{scale:0.92, y:20, opacity:0}} animate={{scale:1, y:0, opacity:1}} exit={{scale:0.92, opacity:0}} className="relative w-full max-w-[480px] rounded-[24px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-white/50 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#E30613] via-[#FFD23F] to-[#0066CC]"/>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E30613] to-[#9A0007] grid place-items-center text-white"><UserPlus size={18}/></div>
                    <div><h2 className="font-black text-lg leading-none">New User</h2><p className="text-xs text-zinc-500">Add to MongoDB • auto IP on first login</p></div>
                  </div>
                  <button onClick={()=>setShowAdd(false)} className="w-9 h-9 rounded-full bg-[#F0F7FF] grid place-items-center hover:bg-zinc-100">✕</button>
                </div>
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="text-xs font-black tracking-widest text-zinc-600">USERNAME</span>
                    <input autoFocus placeholder="e.g. rahul123" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-2xl bg-white border-2 border-zinc-200 outline-none focus:border-[#E30613] text-sm font-bold text-[#0A1628] placeholder:text-zinc-400 caret-[#E30613]"/>
                  </label>
                  <label className="block">
                    <span className="text-xs font-black tracking-widest text-zinc-600">PASSWORD</span>
                    <input placeholder="•••••••• (min 6)" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-2xl bg-white border-2 border-zinc-200 outline-none focus:border-[#E30613] text-sm text-[#0A1628] placeholder:text-zinc-400 caret-[#E30613]"/>
                  </label>
                  <label className="block">
                    <span className="text-xs font-black tracking-widest text-zinc-600">SUBSCRIPTION DAYS <span className="font-normal text-zinc-400 normal-case">— kitne din?</span></span>
                    <input placeholder="30" type="number" value={form.sub_days} onChange={e=>setForm({...form, sub_days:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-2xl bg-white border-2 border-zinc-200 outline-none focus:border-[#E30613] text-sm font-black text-[#0A1628] placeholder:text-zinc-400 caret-[#E30613]"/>
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
                  <button onClick={create} disabled={creating} className={`flex-1 py-3 rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 ${creating?'bg-zinc-300 text-zinc-600':'bg-gradient-to-r from-[#E30613] to-[#9A0007] text-white shadow-[0_8px_20px_rgba(227,6,19,0.35)]'}`}>{creating?'Creating…':'Create User'}</button>
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
