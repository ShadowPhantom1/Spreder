import { useOutletContext, Link } from 'react-router-dom'
import { HardDrive, Activity, Download, Cpu, CheckCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { useState } from 'react'

export default function SystemPage(){
  const {users, stats} = useOutletContext<any>()
  const [msg,setMsg]=useState('')
  const clean=async()=>{ try{ const r=await api.post('/api/admin/storage/clean', {days:3}); setMsg(`✓ Cleaned ${r.deleted}`)}catch(e:any){ setMsg(e.message)} }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-black text-xl text-slate-900">System Control</h2>
        <p className="text-sm text-slate-500">Storage, health and exports</p>
      </div>
      {msg && <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">{msg}</div>}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 grid place-items-center mx-auto text-white"><HardDrive size={22}/></div>
          <h3 className="font-bold mt-3 text-slate-900">Storage</h3>
          <p className="text-sm text-slate-500">Auto-clean 3 days • Mongo</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200"><div className="text-xs font-bold text-slate-600">Campaigns</div><div className="text-lg font-black text-slate-900">{stats?.campaigns?.total ?? 0}</div></div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200"><div className="text-xs font-bold text-slate-600">Devices</div><div className="text-lg font-black text-slate-900">{stats?.devices?.total ?? 0}</div></div>
          </div>
          <button onClick={clean} className="mt-4 w-full py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-black">Clean Now (3d)</button>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 grid place-items-center mx-auto text-white"><Activity size={22}/></div>
          <h3 className="font-bold mt-3 text-slate-900">Health</h3>
          <p className="text-sm text-slate-500">{stats?.devices?.online ?? 0} online • {stats?.firebases ?? 0} hives</p>
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex justify-between text-sm text-slate-700"><span>Online</span><b>{stats?.devices?.online ?? 0}/{stats?.devices?.total ?? 0}</b></div>
            <div className="h-2 rounded-full bg-white border border-emerald-200 overflow-hidden mt-2"><div className="h-full bg-emerald-600" style={{width: `${stats?.devices?.total ? (stats.devices.online/stats.devices.total*100):0}%`}}/></div>
          </div>
          <div className="mt-3 text-xs flex items-center justify-center gap-2 text-emerald-700 font-semibold"><CheckCircle size={12}/> All systems operational</div>
        </div>
        <div className="rounded-2xl bg-slate-900 p-6 text-white text-center border border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 grid place-items-center mx-auto"><Download size={22}/></div>
          <h3 className="font-bold mt-3">Export & Logs</h3>
          <p className="text-sm text-white/60">Download users, hives, campaigns</p>
          <button onClick={()=>{ const blob=new Blob([JSON.stringify(users,null,2)],{type:'application/json'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download='admin-users.json'; a.click()}} className="mt-4 w-full py-3 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100">Download Users JSON</button>
          <Link to="/dashboard" className="mt-3 block text-xs text-white/60 hover:text-white">← Back to App Dashboard</Link>
        </div>
      </div>
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold flex items-center gap-2 text-slate-900"><Cpu size={18} className="text-slate-600"/> System Info</h3>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          {[
            {k:'DB', v:'MongoDB (Cluster0)', d:'FULLY Mongo • clean & stable'},
            {k:'Auth', v:'1 ID 1 Device', d:'First-login device auto-lock • Revoke → new lock • IP free'},
            {k:'Speed', v:stats?.devices?.capacity?.perSim ? `${stats.devices.capacity.perSim}/SIM` : '100/SIM', d:'Ultra 0.08x • per-slot equal load'},
          ].map(x=>(
            <div key={x.k} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-black tracking-widest text-slate-500">{x.k}</div>
              <div className="font-bold mt-1 text-slate-900">{x.v}</div>
              <div className="text-xs text-slate-500 mt-1">{x.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
