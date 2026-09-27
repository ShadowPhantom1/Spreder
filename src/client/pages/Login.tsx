import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Crown, User } from 'lucide-react'

export default function Login(){
  const [u,setU]=useState('')
  const [p,setP]=useState('')
  const [show,setShow]=useState(false)
  const [mode,setMode]=useState<'user'|'super'>('user')
  const [loading,setLoading]=useState(false)
  const [err,setErr]=useState<string | null>(null)
  const nav=useNavigate()
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try{
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: u, password: p })
      })
      const data = await res.json().catch(()=>({}))
      if(!res.ok) throw new Error(data?.error || `Login failed (${res.status})`)
      if(data.token) localStorage.setItem('token', data.token)
      nav('/dashboard')
    }catch(err:any){ setErr(err.message || 'Unknown error'); } finally{ setLoading(false)}
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A1628] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#E30613]/10 via-transparent to-[#00D9FF]/10 pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',backgroundSize:'24px 24px'}} />

      <div className="relative w-full max-w-[440px]">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-black tracking-widest text-white/60 hover:text-white">← Back to Home</Link>
          <div className="mt-3 flex justify-center">
            <div className="w-[88px] h-[88px] rounded-2xl bg-white flex items-center justify-center shadow-xl p-1.5">
              <img src="/logo-bhnstock.png" alt="BHN" className="w-full h-full object-contain rounded-xl" />
            </div>
          </div>
          <h1 className="font-black text-2xl mt-3 text-white">BHNSTOCK <span className="text-[#00D9FF]">SPREADER 3D</span></h1>
          <p className="text-xs tracking-widest text-white/50">BRAND NEW DAY • WEB-OS v3.0</p>
        </div>

        <div className="flex p-1 rounded-full bg-white/10 border border-white/10 mb-4">
          <button onClick={()=>setMode('user')} className={`flex-1 py-2 rounded-full text-sm font-black flex items-center justify-center gap-2 ${mode==='user'?'bg-white text-[#0A1628]':'text-white/70'}`}><User size={14}/> User Login</button>
          <button onClick={()=>setMode('super')} className={`flex-1 py-2 rounded-full text-sm font-black flex items-center justify-center gap-2 ${mode==='super'?'bg-[#E30613] text-white':'text-white/70'}`}><Crown size={14}/> Super Admin</button>
        </div>

        <form onSubmit={submit} className={`rounded-3xl p-6 shadow-2xl border ${mode==='super'?'bg-gradient-to-br from-[#EAF4FF] to-white border-[#0066CC]/20':'bg-white border-black/10'} text-[#0A1628]`}>
          <div className="text-center mb-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black tracking-widest ${mode==='super'?'bg-[#0066CC] text-white':'bg-[#0A1628] text-white'}`}>{mode==='super'?'👑 SUPER ADMIN ACCESS':'USER ACCESS'}</div>
            <p className="text-xs text-black/50 mt-2">{mode==='super'?'Nivea 3D • Full control over users, devices, limits':'Access your hives, devices and campaigns'}</p>
          </div>
          {err && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>}
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-black tracking-widest text-black/60">USERNAME</span>
              <input value={u} onChange={e=>setU(e.target.value)} required className="mt-1 w-full px-4 py-3 rounded-xl bg-black/5 border border-black/10 outline-none focus:border-[#0066CC]/40 text-sm" placeholder={mode==='super'?'admin':'your username'} />
            </label>
            <label className="block">
              <span className="text-xs font-black tracking-widest text-black/60">PASSWORD</span>
              <div className="mt-1 relative">
                <input type={show?'text':'password'} value={p} onChange={e=>setP(e.target.value)} required className="w-full px-4 py-3 pr-12 rounded-xl bg-black/5 border border-black/10 outline-none focus:border-[#0066CC]/40 text-sm" placeholder="••••••••" />
                <button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-1 top-1 bottom-1 w-10 grid place-items-center rounded-xl hover:bg-black/5">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>
            </label>
            <button disabled={loading} className={`w-full py-3 rounded-full text-white text-sm font-black flex items-center justify-center gap-2 ${mode==='super'?'bg-[#0066CC] hover:bg-[#0052A3]':'bg-[#E30613] hover:bg-[#FF2D3B]'}`}>
              <LogIn size={16}/>{loading?'SIGNING IN…': mode==='super'?'ENTER SUPER ADMIN':'SIGN IN'}
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] tracking-widest text-white/30 mt-4">© 2026 BHNSTOCK • SECURE ACCESS • ONE DEVICE ONE IP</p>
      </div>
    </div>
  )
}
