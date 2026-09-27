import { Link } from 'react-router-dom'
import { Shield, Zap, Smartphone, Radio, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function Landing(){
  return (
    <div className="min-h-screen bg-[#0A1628] text-white overflow-x-hidden">
      {/* header */}
      <header className="sticky top-0 z-30 backdrop-blur bg-[#0A1628]/80 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-bhnstock.png" alt="BHN" className="w-9 h-9 rounded-xl object-contain bg-white p-1"/>
            <span className="font-black tracking-widest text-sm">BHNSTOCK <span className="text-[#00D9FF]">SPREADER 3D</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 rounded-full bg-white text-[#0A1628] text-sm font-black">Login</Link>
            <Link to="/super" className="hidden sm:inline-flex px-4 py-2 rounded-full bg-[#E30613] text-white text-sm font-black">Super Admin</Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="max-w-6xl mx-auto px-4 py-12 lg:py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold tracking-widest"><Shield size={12}/> ENTERPRISE SMS SPREADER</div>
          <h1 className="font-black text-4xl lg:text-5xl leading-none mt-4">BRAND NEW DAY<br/><span className="text-[#00D9FF]">SPREAD • FAST • SECURE</span></h1>
          <p className="text-white/60 mt-4 max-w-xl">Connect your Firebase Hives, add Spider-Bots, launch campaigns to thousands in one click. Every message is tracked, every device is validated.</p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link to="/login" className="px-6 py-3 rounded-full bg-[#E30613] text-white font-black flex items-center gap-2">Enter Dashboard <ArrowRight size={16}/></Link>
            <a href="#features" className="px-6 py-3 rounded-full bg-white/10 border border-white/20 font-bold">View Features</a>
          </div>
          <div className="flex gap-6 mt-8 text-sm">
            <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400"/> Per-SIM 100/day</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400"/> Device Validation</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400"/> One Device Lock</span>
          </div>
        </div>
        <div className="relative rounded-3xl bg-gradient-to-br from-[#0E3A5C] to-[#162447] border border-white/10 p-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white text-[#0A1628] p-4">
            <Radio size={20} className="text-[#E30613]"/>
            <div className="font-black mt-2">Hives</div>
            <div className="text-sm text-black/60">Firebase RTDB</div>
            <div className="text-2xl font-black mt-4">∞</div>
          </div>
          <div className="rounded-2xl bg-[#0A1628] border border-white/10 p-4">
            <Smartphone size={20} className="text-[#00D9FF]"/>
            <div className="font-black mt-2">Spider-Bots</div>
            <div className="text-sm text-white/60">Auto-validated</div>
            <div className="text-2xl font-black mt-4">500+</div>
          </div>
          <div className="rounded-2xl bg-[#0A1628] border border-white/10 p-4">
            <Zap size={20} className="text-[#FFD23F]"/>
            <div className="font-black mt-2">Speed</div>
            <div className="text-sm text-white/60">Ultra 0.08x</div>
            <div className="text-2xl font-black mt-4">10k / min</div>
          </div>
          <div className="rounded-2xl bg-[#E30613] text-white p-4">
            <Shield size={20}/>
            <div className="font-black mt-2">Secure</div>
            <div className="text-sm text-white/80">Device Lock</div>
            <div className="text-2xl font-black mt-4">100%</div>
          </div>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-4 pb-16 grid md:grid-cols-3 gap-4">
        {[
          {t:'For Users',d:'Add your own Firebase, manage devices, launch campaigns — isolated per account.'},
          {t:'For Super Admin',d:'View all users, manage limits, device lock, sessions — Spidey theme.'},
          {t:'Built for Scale',d:'Per-slot load, validated bots only, auto 3-day cleanup — no drops.'},
        ].map(f=>(
          <div key={f.t} className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="font-black">{f.t}</div>
            <div className="text-sm text-white/60 mt-1">{f.d}</div>
          </div>
        ))}
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/40">© 2026 BHNSTOCK • SPREADER 3D • BRAND NEW DAY</footer>
    </div>
  )
}
