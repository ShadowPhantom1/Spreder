import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Shield, Crown, Zap } from 'lucide-react'

export default function SuperLogin(){
  const [u,setU]=useState('')
  const [p,setP]=useState('')
  const [show,setShow]=useState(false)
  const [loading,setLoading]=useState(false)
  const [err,setErr]=useState<string|null>(null)
  const nav=useNavigate()
  const getDeviceId=()=>{
    try{
      let id=localStorage.getItem('device_id')
      if(!id){ id='dev_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36); localStorage.setItem('device_id', id)}
      return id
    }catch{ return 'web'}
  }
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault()
    setErr(null); setLoading(true)
    try{
      const did=getDeviceId()
      const res = await fetch('/api/auth/login', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-device-id':did},
        credentials:'include',
        body: JSON.stringify({username:u, password:p})
      })
      const data = await res.json().catch(()=>({}))
      if(!res.ok) {
        let m=data?.error || `Login failed (${res.status})`
        if(m.includes('Device not allowed')) m='Device locked — first device only. Super ka bhi same rule, dusre device se nahi khulega. Admin panel se Revoke karna padega ya dusre browser ka device_id clear karo.'
        throw new Error(m)
      }
      if(data.token) localStorage.setItem('token', data.token)
      // verify super
      const me=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${data.token}`,'x-device-id':did},credentials:'include'}).then(r=>r.json()).catch(()=>null)
      if(!me?.user?.is_super){ localStorage.removeItem('token'); throw new Error('Not a Super Admin — access denied') }
      nav('/adminbhnstock')
    }catch(e:any){ setErr(e.message) } finally{ setLoading(false)}
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A1628] relative overflow-hidden">
      {/* spidey webs */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#E30613]/20 via-transparent to-[#0066CC]/15 pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.06]" style={{backgroundImage:`radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,backgroundSize:'22px 22px'}} />
      <div className="absolute -top-24 -right-24 w-[520px] h-[520px] bg-[#E30613]/20 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[640px] h-[640px] bg-[#0066CC]/15 rounded-full blur-[90px] pointer-events-none" />
      {/* web lines svg */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{backgroundImage:`repeating-linear-gradient(0deg, transparent 0 28px, rgba(255,255,255,0.5) 29px), repeating-linear-gradient(90deg, transparent 0 28px, rgba(255,255,255,0.5) 29px)`}} />

      <div className="relative w-full max-w-[460px]">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-black tracking-widest text-white/60 hover:text-white">← Back to Home</Link>
          <div className="mt-4 flex justify-center">
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-r from-[#E30613] to-[#0066CC] rounded-[22px] blur-xl opacity-40" />
              <div className="relative w-[92px] h-[92px] rounded-2xl bg-white flex items-center justify-center shadow-xl p-1.5 border-2 border-[#E30613]">
                <img src="/logo-bhnstock.png" alt="BHN" className="w-full h-full object-contain rounded-xl" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#E30613] border-2 border-white grid place-items-center shadow-lg"><Crown size={14} className="text-white"/></div>
            </div>
          </div>
          <h1 className="font-black text-2xl mt-4 text-white tracking-tight">🕷️ SPIDER ADMIN <span className="text-[#FF3B30]">CONSOLE</span></h1>
          <p className="text-xs tracking-widest text-white/50">BRAND NEW DAY • WEB-OS v3.0 • /adminbhnstock</p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E30613] text-white text-[11px] font-black tracking-widest shadow-lg"><Shield size={12}/> SUPER ADMIN ONLY</div>
        </div>

        <form onSubmit={submit} className="rounded-[24px] p-6 shadow-2xl border-2 border-[#E30613]/30 bg-gradient-to-br from-white to-[#FFF5F5] text-[#0A1628] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E30613] via-[#FFD23F] to-[#0066CC]" />
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black tracking-widest bg-[#E30613] text-white"><Zap size={12}/> FRIENDLY NEIGHBORHOOD ACCESS</div>
            <p className="text-xs text-black/60 mt-2">Users • Devices • Campaigns • Security • Full control</p>
          </div>
          {err && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-bold">{err}</div>}
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-black tracking-widest text-[#E30613]">SUPER USERNAME</span>
              <input value={u} onChange={e=>setU(e.target.value)} required className="mt-1 w-full px-4 py-3 rounded-xl bg-white border-2 border-zinc-200 outline-none focus:border-[#E30613] focus:bg-white text-sm font-bold text-[#0A1628] placeholder:text-zinc-400 caret-[#E30613]" placeholder="admin" />
            </label>
            <label className="block">
              <span className="text-xs font-black tracking-widest text-[#0A1628]">PASSWORD</span>
              <div className="mt-1 relative">
                <input type={show?'text':'password'} value={p} onChange={e=>setP(e.target.value)} required className="w-full px-4 py-3 pr-12 rounded-xl bg-white border-2 border-zinc-200 outline-none focus:border-[#0066CC] focus:bg-white text-sm text-[#0A1628] placeholder:text-zinc-400 caret-[#0066CC]" placeholder="••••••••" />
                <button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-1 top-1 bottom-1 w-10 grid place-items-center rounded-xl hover:bg-black/5 text-zinc-500">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>
            </label>
            <button disabled={loading} className="w-full py-3 rounded-full text-white text-sm font-black flex items-center justify-center gap-2 bg-gradient-to-r from-[#E30613] to-[#9A0007] hover:from-[#FF2D3B] hover:to-[#E30613] shadow-[0_8px_20px_rgba(227,6,19,0.35)] disabled:opacity-60">
              <Crown size={16}/>{loading?'THWIPPING…':'ENTER SPIDER CONSOLE'}
            </button>
          </div>
        </form>

        <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center gap-3 backdrop-blur">
          <div className="w-10 h-10 rounded-xl bg-[#FFD23F] grid place-items-center font-black text-[#0A1628]">!</div>
          <div className="text-xs leading-relaxed text-white/70"><b className="text-white">One Device</b> — first login locks device. Revoke to allow new device. Super only via <b className="text-[#FFD23F]">/adminbhnstock</b> or <b className="text-[#FFD23F]">/super</b>.</div>
        </div>
        <p className="text-center text-[10px] tracking-widest text-white/30 mt-4">© 2026 BHNSTOCK • SPIDER ADMIN • WITH GREAT POWER</p>
      </div>
    </div>
  )
}
