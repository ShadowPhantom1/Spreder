import { Lock, Shield, Smartphone } from 'lucide-react'
export default function Security(){
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-black text-xl text-slate-900 flex items-center gap-2"><Shield size={20} className="text-slate-700"/> Security Center</h2>
        <p className="text-sm text-slate-500">Device lock and session controls</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 text-slate-900"><Lock size={18} className="text-slate-700"/> Device Lock</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="p-3 rounded-xl bg-slate-50 border border-slate-200"><b className="text-slate-900">First login</b> — <span className="text-slate-600">device fingerprint auto save, next login only same device</span></li>
            <li className="p-3 rounded-xl bg-slate-50 border border-slate-200"><b className="text-slate-900">Revoke</b> — <span className="text-slate-600">Super can reset → next login new device</span></li>
            <li className="p-3 rounded-xl bg-slate-50 border border-slate-200"><b className="text-slate-900">Session</b> — <span className="text-slate-600">1 user = 1 token, 1 device, kick old</span></li>
            <li className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs"><b>IP check removed</b> — kahi se bhi login, sirf device lock</li>
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 text-slate-900"><Smartphone size={18} className="text-slate-700"/> Auth</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"><span className="text-slate-600">JWT</span><b className="text-slate-900">Bearer + HttpOnly</b></div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"><span className="text-slate-600">Expiry</span><b className="text-slate-900">7 days</b></div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"><span className="text-slate-600">Admin route</span><b className="text-slate-900">/adminbhnstock super only</b></div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"><span className="text-slate-600">Device</span><b className="text-slate-900">x-device-id + UA</b></div>
          </div>
        </div>
      </div>
    </div>
  )
}
