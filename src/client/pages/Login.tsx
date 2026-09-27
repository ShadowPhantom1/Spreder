import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Shield, Zap, AlertTriangle } from 'lucide-react'

export default function Login(){
  const [u,setU]=useState('admin')
  const [p,setP]=useState('admin123456')
  const [show,setShow]=useState(false)
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
      // store token for Authorization fallback (preview iframe blocks cookies)
      if(data.token) localStorage.setItem('token', data.token)
      // verify
      const me = await fetch('/api/auth/me', { credentials: 'include', headers: { 'Authorization': `Bearer ${data.token}` } })
      if(!me.ok) {
        // still allow — token in storage will be used
        console.warn('me check failed, but token stored', await me.text())
      }
      nav('/')
    }catch(err:any){ setErr(err.message || 'Unknown error'); } finally{ setLoading(false)}
  }
  return (
    <div className="min-h-screen bg-spidey-blue bg-spidey-mesh flex items-center justify-center p-4">
      <div className="absolute inset-0 web-pattern opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#E30613]/15 via-transparent to-[#00D9FF]/10 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] pointer-events-none opacity-[0.04]">
        <svg viewBox="0 0 400 400" className="w-full h-full">
          <g stroke="white" strokeWidth="0.8" fill="none">
            <circle cx="200" cy="200" r="40"/><circle cx="200" cy="200" r="90"/><circle cx="200" cy="200" r="140"/><circle cx="200" cy="200" r="190"/>
            <path d="M200 0 L200 400 M0 200 L400 200 M60 60 L340 340 M340 60 L60 340 M100 0 L300 400 M300 0 L100 400 M0 100 L400 300 M0 300 L400 100"/>
          </g>
        </svg>
      </div>

      <div className="relative w-full max-w-[440px]">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E30613] text-white text-[11px] font-black tracking-[0.16em]"><Shield size={12}/> EARTH-616 SECURE</div>
          <div className="mt-4 flex justify-center">
            <div className="w-[96px] h-[96px] rounded-[22px] bg-white flex items-center justify-center shadow-spidey comic-border-red relative overflow-hidden p-1.5">
              <img src="/logo-bhnstock.png" alt="BHNSTOCK" className="w-full h-full object-contain rounded-[14px]" />
            </div>
          </div>
          <h1 className="font-display text-[32px] tracking-wide mt-3 text-white">BHNSTOCK <span className="text-spidey-gradient">SPREADER 3D</span></h1>
          <p className="text-xs tracking-[0.18em] font-mono text-white/60 -mt-1">BRAND NEW DAY • WEB-OS v3.0</p>
          <p className="text-sm text-white/60 mt-3">Sign in — with great power comes great throughput.</p>
        </div>

        <form onSubmit={submit} className="rounded-[24px] comic-border bg-gradient-to-br from-white to-white/[0.92] p-6 text-[#0A1628] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {err && (
            <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 flex gap-2 items-start text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0"/><span>{err}<br/><span className="text-xs font-mono">Try admin / admin123456 • Check console (F12) for details</span></span>
            </div>
          )}
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-black tracking-widest text-black/60">USERNAME</span>
              <input value={u} onChange={e=>setU(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628]/[0.06] border border-black/10 outline-none focus:border-[#E30613]/40 text-sm" placeholder="admin" />
            </label>
            <label className="block">
              <span className="text-xs font-black tracking-widest text-black/60">PASSWORD</span>
              <div className="mt-1 relative">
                <input type={show?'text':'password'} value={p} onChange={e=>setP(e.target.value)} className="w-full px-4 py-3 pr-12 rounded-2xl bg-[#0A1628]/[0.06] border border-black/10 outline-none focus:border-[#E30613]/40 text-sm" placeholder="••••••••" />
                <button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-1 top-1 bottom-1 w-10 grid place-items-center rounded-xl hover:bg-black/5">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>
            </label>
            <button disabled={loading} className="w-full py-3 rounded-full bg-[#E30613] hover:bg-[#FF2D3B] disabled:opacity-50 text-white text-sm font-black tracking-wide shadow-spidey flex items-center justify-center gap-2">
              <LogIn size={16}/>{loading?'SWINGING IN…':'ENTER THE WEB'}
            </button>
            <div className="flex items-center justify-between text-[11px] font-mono text-black/50">
              <span className="flex items-center gap-1"><Zap size={12} className="text-[#E30613]"/> Demo: admin / admin123456</span>
              <span>JWT • HttpOnly + Bearer fallback</span>
            </div>
            <div className="text-[11px] font-mono text-black/40 bg-black/5 rounded-xl p-2 border border-black/5">
              Preview iframe me cookie block ho to token <code>localStorage</code> se Authorization header bhejta hai — ab fix hai. Agar fir bhi na khule to <b>3000 wala link</b> use karo, 5173 proxy me cookie issue tha.
            </div>
          </div>
        </form>

        <p className="text-center text-[10px] font-mono tracking-widest text-white/30 mt-4">© 2026 BHNSTOCK • FRIENDLY NEIGHBORHOOD SMS • NYC</p>
      </div>
    </div>
  )
}
