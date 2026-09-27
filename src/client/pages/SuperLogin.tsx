import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Crown, Shield, Lock } from 'lucide-react'

export default function SuperLogin(){
  const [u,setU]=useState('')
  const [p,setP]=useState('')
  const [show,setShow]=useState(false)
  const [loading,setLoading]=useState(false)
  const [err,setErr]=useState<string|null>(null)
  const nav=useNavigate()
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault()
    setErr(null); setLoading(true)
    try{
      const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username:u,password:p})})
      const data=await res.json().catch(()=>({}))
      if(!res.ok) throw new Error(data?.error||'Login failed')
      if(data.token) localStorage.setItem('token',data.token)
      // verify super
      const me=await fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${data.token}`},credentials:'include'}).then(r=>r.json()).catch(()=>null)
      if(!me?.user?.is_super) { localStorage.removeItem('token'); throw new Error('Not a Super Admin — access denied') }
      nav('/admin')
    }catch(e:any){ setErr(e.message)} finally{ setLoading(false)}
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#EAF4FF] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0066CC]/10 via-transparent to-[#00BFFF]/10" />
      <div className="absolute top-20 right-20 w-72 h-72 bg-[#0066CC]/5 rounded-full blur-3xl" />
      <div className="relative w-full max-w-[440px]">
        <div className="text-center mb-6">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0066CC] to-[#1E40AF] flex items-center justify-center shadow-xl border border-white/20"><Crown size={32} className="text-white"/></div>
          <h1 className="font-black text-2xl mt-4 text-[#0A1628]">SUPER ADMIN <span className="text-[#0066CC]">LOGIN</span></h1>
          <p className="text-xs tracking-widest text-[#0066CC]/60">NIVEA 3D • SECURE • ONE DEVICE</p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0066CC] text-white text-xs font-bold"><Shield size={12}/> EARTH-616 SECURE</div>
        </div>
        <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-[0_20px_60px_rgba(0,102,204,0.15)] border border-[#BFD9FF]">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF4FF] border border-[#BFD9FF] text-xs font-black text-[#0066CC]"><Lock size={12}/> SUPER ONLY</div>
          </div>
          {err && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{err}</div>}
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-black tracking-widest text-black/60">SUPER USERNAME</span>
              <input value={u} onChange={e=>setU(e.target.value)} required placeholder="admin" className="mt-1 w-full px-4 py-3 rounded-xl bg-[#EAF4FF] border border-[#BFD9FF] outline-none focus:border-[#0066CC] text-sm"/>
            </label>
            <label className="block">
              <span className="text-xs font-black tracking-widest text-black/60">PASSWORD</span>
              <div className="mt-1 relative">
                <input type={show?'text':'password'} value={p} onChange={e=>setP(e.target.value)} required placeholder="••••••••" className="w-full px-4 py-3 pr-12 rounded-xl bg-[#EAF4FF] border border-[#BFD9FF] outline-none focus:border-[#0066CC] text-sm"/>
                <button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-1 top-1 bottom-1 w-10 grid place-items-center rounded-xl hover:bg-black/5">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>
            </label>
            <button disabled={loading} className="w-full py-3 rounded-full bg-gradient-to-r from-[#0066CC] to-[#1E40AF] text-white font-black flex items-center justify-center gap-2 shadow-lg">{loading?'VERIFYING…':'ENTER SUPER ADMIN'}</button>
            <div className="text-center text-xs text-zinc-500">Normal users → <Link to="/login" className="text-[#0066CC] font-bold">User Login</Link></div>
          </div>
        </form>
        <p className="text-center text-[10px] tracking-widest text-[#0066CC]/30 mt-4">© 2026 BHNSTOCK • SUPER ADMIN • NIVEA 3D</p>
      </div>
    </div>
  )
}
