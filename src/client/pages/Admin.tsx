import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Shield, Trash2, Power, UserPlus, Save, RefreshCw, Eye, Ban, Key, Clock, HardDrive } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Admin(){
  const [users,setUsers]=useState<any[]>([])
  const [form,setForm]=useState({username:'', password:'', per_sim_limit:100, max_devices:100, allowed_ip:'', expires_at:''})
  const [msg,setMsg]=useState('')

  const load=async()=>{
    try{ const d=await api.get('/api/admin/users'); setUsers(d)}catch(e:any){ setMsg(e.message)}
  }
  useEffect(()=>{ load(); },[])

  const create=async()=>{
    try{ await api.post('/api/admin/users', form); setMsg('Created'); setForm({username:'', password:'', per_sim_limit:100, max_devices:100, allowed_ip:'', expires_at:''}); load()}catch(e:any){ setMsg(e.message)}
  }
  const act=async(path:string, id:string)=>{
    try{ await api.post(`/api/admin/users/${id}/${path}`); load()}catch(e:any){ setMsg(e.message)}
  }
  const del=async(id:string)=>{
    if(!confirm('Delete user + wipe?')) return
    try{ await api.del(`/api/admin/users/${id}`); load()}catch(e:any){ setMsg(e.message)}
  }
  const save=async(id:string, per_sim_limit:number, max_devices:number, allowed_ip:string)=>{
    try{ await api.put(`/api/admin/users/${id}`, {per_sim_limit, max_devices, allowed_ip}); setMsg('Saved'); load()}catch(e:any){ setMsg(e.message)}
  }
  const clean=async()=>{
    try{ const r=await api.post('/api/admin/storage/clean', {days:3}); setMsg(`Cleaned ${r.deleted}`); load()}catch(e:any){ setMsg(e.message)}
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="rounded-2xl p-6 bg-gradient-to-br from-blue-600 via-sky-500 to-indigo-700 text-white shadow-xl border border-white/20">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/20 backdrop-blur"><Shield className="w-7 h-7"/></div>
          <div>
            <h1 className="text-2xl font-black">SUPER ADMIN — Nivea 3D</h1>
            <p className="text-white/80 text-sm">Har user ka IP, limit, Firebase, storage — 1 click me</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={load} className="px-4 py-2 rounded-xl bg-white text-blue-700 font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4"/>Refresh</button>
            <button onClick={clean} className="px-4 py-2 rounded-xl bg-white/20 border border-white/30 flex items-center gap-2"><HardDrive className="w-4 h-4"/>Clean 3d</button>
          </div>
        </div>
        {msg && <div className="mt-3 text-sm bg-white/20 rounded-lg px-3 py-2">{msg}</div>}
      </motion.div>

      {/* Create */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-lg border border-zinc-200 dark:border-zinc-800">
        <h2 className="font-bold flex items-center gap-2"><UserPlus className="w-4 h-4"/> New User</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
          <input placeholder="username" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800"/>
          <input placeholder="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800"/>
          <input placeholder="per_sim 100" type="number" value={form.per_sim_limit} onChange={e=>setForm({...form, per_sim_limit: parseInt(e.target.value)||100})} className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800"/>
          <input placeholder="max_devices" type="number" value={form.max_devices} onChange={e=>setForm({...form, max_devices: parseInt(e.target.value)||100})} className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800"/>
          <input placeholder="allowed_ip * or 1.2.3.4" value={form.allowed_ip} onChange={e=>setForm({...form, allowed_ip:e.target.value})} className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800"/>
          <button onClick={create} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Create</button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-lg border border-zinc-200 dark:border-zinc-800">
        <h2 className="font-bold flex items-center gap-2"><Eye className="w-4 h-4"/> All Users ({users.length})</h2>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead className="text-zinc-500"><tr><th className="text-left p-2">User</th><th className="p-2">IP/Device Lock</th><th className="p-2">Limit</th><th className="p-2">Expiry</th><th className="p-2">Status</th><th className="p-2">Session</th><th className="p-2">Action</th></tr></thead>
            <tbody>
              {users.map((u:any)=>(
                <tr key={u.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="p-2 font-mono">{u.username} {u.is_super? '👑':''}<div className="text-[10px] text-zinc-400">{u.allowed_device? `🔒 ${u.allowed_device.slice(0,12)}` : '🔓 first login lock'}</div></td>
                  <td className="p-2"><input defaultValue={u.allowed_ip||''} placeholder="* or 1.2.3.4" id={`ip-${u.id}`} className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 w-28 text-xs"/><div className="text-[10px] text-zinc-400">{u.allowed_ip? `IP ${u.allowed_ip}` : 'IP auto on first login'}</div></td>
                  <td className="p-2 flex gap-1"><input defaultValue={u.per_sim_limit} id={`per-${u.id}`} className="w-14 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-xs"/><span className="text-xs">/SIM</span></td>
                  <td className="p-2 text-xs">{u.expires_at? new Date(u.expires_at).toLocaleDateString(): '—'}</td>
                  <td className="p-2">{u.is_active? <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs">active</span> : <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs">disabled</span>}</td>
                  <td className="p-2 text-xs">{u.session? `${u.session.ip} ${u.session.device_id?.slice(0,8)}` : '—'}</td>
                  <td className="p-2 flex flex-wrap gap-1">
                    <button onClick={()=>{
                      const ip=(document.getElementById(`ip-${u.id}`) as HTMLInputElement)?.value
                      const per=parseInt((document.getElementById(`per-${u.id}`) as HTMLInputElement)?.value || '100')
                      save(u.id, per, u.max_devices, ip)
                    }} className="px-2 py-1 rounded bg-blue-600 text-white text-xs flex items-center gap-1"><Save className="w-3 h-3"/>Save</button>
                    {u.is_active? <button onClick={()=>act('disable', u.id)} className="px-2 py-1 rounded bg-amber-500 text-white text-xs flex items-center gap-1"><Ban className="w-3 h-3"/>Disable</button> : <button onClick={()=>act('enable', u.id)} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs flex items-center gap-1"><Power className="w-3 h-3"/>Enable</button>}
                    <button onClick={()=>act('kick', u.id)} className="px-2 py-1 rounded bg-zinc-700 text-white text-xs">Kick</button>
                    <button onClick={async()=>{ if(confirm('Reset device/IP lock? Next login will lock to new device')){ await api.post(`/api/admin/users/${u.id}/reset-lock`); load()}}} className="px-2 py-1 rounded bg-sky-600 text-white text-xs">Reset Lock</button>
                    <button onClick={()=>del(u.id)} className="px-2 py-1 rounded bg-red-600 text-white text-xs flex items-center gap-1"><Trash2 className="w-3 h-3"/>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-zinc-500 flex items-center gap-2"><Key className="w-3 h-3"/> Super login: main page se `admin/admin123456` → auto `/super` 3D Nivea theme (blue-soft, no phonk) • 1 user = 1 device = 1 IP</div>
    </div>
  )
}
