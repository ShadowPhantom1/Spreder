import { useOutletContext } from 'react-router-dom'
import { Users, CheckCircle, Smartphone, Database, Activity, Eye, Zap } from 'lucide-react'

export default function Dashboard(){
  const {users, stats} = useOutletContext<any>()
  const active = users.filter((u:any)=>u.is_active).length
  const online = users.filter((u:any)=>u.session).length
  const superCount = users.filter((u:any)=>u.is_super).length
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-black text-xl text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of users, sessions and hives</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {l:'TOTAL USERS', v:users.length, sub:`${superCount} super • ${active} active`, i:Users, bg:'bg-white', accent:'text-slate-900', iconBg:'bg-slate-900 text-white'},
          {l:'ACTIVE', v:active, sub:`${users.length-active} disabled`, i:CheckCircle, bg:'bg-white', accent:'text-emerald-700', iconBg:'bg-emerald-50 text-emerald-600 border border-emerald-200'},
          {l:'ONLINE', v:online, sub:'Live sessions', i:Smartphone, bg:'bg-white', accent:'text-slate-900', iconBg:'bg-slate-900 text-white'},
          {l:'HIVES / CAMPAIGNS', v:`${stats?.firebases ?? 0} / ${stats?.campaigns?.total ?? 0}`, sub:'Firebase & jobs', i:Database, bg:'bg-white', accent:'text-violet-700', iconBg:'bg-violet-50 text-violet-600 border border-violet-200'},
        ].map(x=>(
          <div key={x.l} className={`rounded-2xl p-5 ${x.bg} border border-slate-200 shadow-sm`}>
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl grid place-items-center ${x.iconBg}`}><x.i size={18}/></div>
              <span className="text-[11px] font-bold tracking-widest px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600">{x.l}</span>
            </div>
            <div className="mt-3"><div className={`text-2xl font-black ${x.accent}`}>{x.v}</div><div className="text-xs text-slate-500">{x.sub}</div></div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2 text-slate-900"><Eye size={16} className="text-slate-500"/> Recent Users</h3>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-900 text-white font-bold">{users.length} total</span>
          </div>
          <div className="mt-4 space-y-2">
            {users.slice(0,6).map((u:any)=>(
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white grid place-items-center font-black text-sm">{u.username[0].toUpperCase()}</div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">{u.username} {u.is_super && <span className="px-1.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold">SUPER</span>} {u.session && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>}</div>
                    <div className="text-xs text-slate-500">{u.is_active?'Active':'Disabled'} • {u.per_sim_limit}/SIM • {u.allowed_device ? 'Device locked' : 'No lock'}</div>
                  </div>
                </div>
                <div className="text-right"><div className="text-xs font-bold text-slate-700">{u.expires_at? new Date(u.expires_at).toLocaleDateString(): '∞'}</div><div className="text-[11px] text-slate-400">{new Date(u.created_at).toLocaleDateString()}</div></div>
              </div>
            ))}
            {users.length===0 && <div className="text-sm text-slate-400 text-center py-8">No users yet</div>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold flex items-center gap-2 text-slate-900"><Activity size={16} className="text-emerald-600"/> Capacity</h3>
            <div className="mt-3">
              <div className="flex justify-between text-sm text-slate-600"><span>Active users</span><b className="text-slate-900">{users.length?Math.round(active/users.length*100):0}%</b></div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-2"><div className="h-full bg-slate-900" style={{width:`${users.length?active/users.length*100:0}%`}}/></div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center"><div className="text-xl font-black text-slate-900">{active}</div><div className="text-xs font-bold text-slate-600">Active</div></div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center"><div className="text-xl font-black text-slate-900">{online}</div><div className="text-xs font-bold text-slate-600">Online</div></div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900 p-5 text-white">
            <h3 className="font-bold flex items-center gap-2"><Zap size={16} className="text-white"/> Quick Actions</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href="/adminbhnstock/users" className="py-2.5 rounded-xl bg-white text-slate-900 font-bold text-sm text-center hover:bg-slate-100">Manage Users</a>
              <button onClick={()=>location.reload()} className="py-2.5 rounded-xl bg-white/10 border border-white/20 font-bold text-sm hover:bg-white/15">Refresh</button>
            </div>
            <p className="text-xs text-white/60 mt-3">Add user → first login device lock → revoke → new device</p>
          </div>
        </div>
      </div>
    </div>
  )
}
