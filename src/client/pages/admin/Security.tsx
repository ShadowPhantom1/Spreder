import { Lock, Shield, Smartphone } from 'lucide-react'
export default function Security(){
  return (
    <div className="space-y-4">
      <h2 className="font-black text-lg flex items-center gap-2"><Shield size={18} className="text-[#0066CC]"/> Security Center</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-[20px] bg-white p-6 border border-[#EAF4FF] shadow-sm">
          <h3 className="font-black flex items-center gap-2"><Lock size={18} className="text-[#0066CC]"/> IP & Device Lock</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="p-3 rounded-xl bg-[#F0F7FF] border"><b>First login</b> — IP + device fingerprint auto save, next login only same device</li>
            <li className="p-3 rounded-xl bg-[#F0F7FF] border"><b>Revoke</b> — Super can reset → next login new device</li>
            <li className="p-3 rounded-xl bg-[#F0F7FF] border"><b>Session</b> — 1 user = 1 token, 1 device, kick old</li>
          </ul>
        </div>
        <div className="rounded-[20px] bg-gradient-to-br from-[#EAF4FF] to-white p-6 border border-[#EAF4FF]">
          <h3 className="font-black flex items-center gap-2"><Smartphone size={18} className="text-[#0066CC]"/> Auth</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between p-3 rounded-xl bg-white border"><span>JWT</span><b>Bearer + HttpOnly</b></div>
            <div className="flex justify-between p-3 rounded-xl bg-white border"><span>Expiry</span><b>7 days</b></div>
            <div className="flex justify-between p-3 rounded-xl bg-white border"><span>Admin route</span><b>/adminbhnstock super only</b></div>
            <div className="flex justify-between p-3 rounded-xl bg-white border"><span>Device</span><b>x-device-id + UA</b></div>
          </div>
        </div>
      </div>
    </div>
  )
}
