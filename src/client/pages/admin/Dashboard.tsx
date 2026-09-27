import { useOutletContext } from 'react-router-dom'
import { Users, CheckCircle, Smartphone, Database, TrendingUp, Activity, Shield, Zap, Eye } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Dashboard(){
  const {users, stats} = useOutletContext<any>()
  const active = users.filter((u:any)=>u.is_active).length
  const online = users.filter((u:any)=>u.session).length
  const superCount = users.filter((u:any)=>u.is_super).length
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {l:'TOTAL USERS', v:users.length, sub:`${superCount} super`, i:Users, g:'from-[#0066CC] to-[#3B82F6]'},
          {l:'ACTIVE', v:active, sub:`${users.length-active} disabled`, i:CheckCircle, g:'from-emerald-500 to-teal-600'},
          {l:'ONLINE SESSIONS', v:online, sub:'Live now', i:Smartphone, g:'from-[#0A1628] to-[#162447]'},
          {l:'HIVES / CAMPAIGNS', v:`${stats?.firebases ?? 0} / ${stats?.campaigns?.total ?? 0}`, sub:'Firebase & jobs', i:Database, g:'from-violet-600 to-indigo-600'},
        ].map(x=>(
          <div key={x.l} className={`rounded-[20px] p-5 bg-gradient-to-br ${x.g} text-white shadow-lg border border-white/10 relative overflow-hidden`}>
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl"/>
            <div className="relative flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 grid place-items-center"><x.i size={18}/></div>
              <div><div className="text-[11px] font-black tracking-widest opacity-80">{x.l}</div><div className="text-2xl font-black">{x.v}</div><div className="text-xs opacity-70">{x.sub}</div></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[20px] bg-white border border-[#EAF4FF] shadow-sm p-5">
          <div className="flex items-center justify-between"><h3 className="font-black flex items-center gap-2"><Eye size={16} className="text-[#0066CC]"/> Recent Users</h3><span className="text-xs px-2.5 py-1 rounded-full bg-[#EAF4FF] border border-[#BFDBFF] font-bold">{users.length} total</span></div>
          <div className="mt-4 space-y-2">
            {users.slice(0,6).map((u:any)=>(
              <div key={u.id} className="flex items-center justify-between p-3 rounded-2xl bg-[#F8FBFF] border border-[#EAF4FF]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0066CC] to-[#1E40AF] text-white grid place-items-center font-black">{u.username[0].toUpperCase()}</div>
                  <div><div className="font-bold text-sm flex items-center gap-1.5">{u.username} {u.is_super && <span className="px-1.5 py-0.5 rounded-full bg-[#0066CC] text-white text-[10px] font-black">SUPER</span>} {u.session && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>}</div><div className="text-xs text-zinc-500">{u.is_active?'Active':'Disabled'} • {u.per_sim_limit}/SIM • {u.allowed_device ? 'Device locked' : 'No lock'}</div></div>
                </div>
                <div className="text-right"><div className="text-xs font-bold">{u.expires_at? new Date(u.expires_at).toLocaleDateString(): '∞'}</div><div className="text-[11px] text-zinc-400">{new Date(u.created_at).toLocaleDateString()}</div></div>
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
              <a href="/adminbhnstock/users" className="py-2.5 rounded-xl bg-white text-[#0066CC] font-black text-sm text-center">Manage Users</a>
              <button onClick={()=>location.reload()} className="py-2.5 rounded-xl bg-white/15 border border-white/20 font-bold text-sm">Refresh</button>
            </div>
            <p className="text-xs text-white/60 mt-3">Add user → first login auto device lock → revoke → new device</p>
          </div>
        </div>
      </div>
    </div>
  )
}
