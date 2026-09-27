import { useState } from 'react'
import { BookOpen, Layers, Database, Zap, Shield, Radio, Smartphone, Megaphone, Palette, Rocket, Search, Copy, Check, ExternalLink } from 'lucide-react'

const SECTIONS = [
  { id:'overview', label:'01 Overview', icon: BookOpen },
  { id:'stack', label:'02 Stack & Folders', icon: Layers },
  { id:'db', label:'03 DB Schema', icon: Database },
  { id:'hive', label:'04 Hive & SIM Tracking', icon: Radio },
  { id:'firebase', label:'05 Firebase Service', icon: Radio },
  { id:'queue', label:'06 Queue Engine', icon: Zap },
  { id:'poller', label:'07 Device Poller', icon: Smartphone },
  { id:'auth', label:'08 Auth', icon: Shield },
  { id:'api', label:'09 API Routes', icon: Layers },
  { id:'realtime', label:'10 Realtime', icon: Radio },
  { id:'frontend', label:'11 Frontend 3D', icon: Palette },
  { id:'edits', label:'12 Edits • Phonk', icon: Megaphone },
  { id:'deploy', label:'13 Deploy', icon: Rocket },
]

export default function Docs(){
  const [q,setQ]=useState('')
  const [copied,setCopied]=useState<string|null>(null)
  const copy = (t:string, id:string)=>{ navigator.clipboard.writeText(t); setCopied(id); setTimeout(()=>setCopied(null),1200) }

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-[28px] comic-border bg-gradient-to-br from-[#0F2340] via-[#1A0A2E] to-[#0A1628] p-[1px]">
        <div className="rounded-[27px] bg-gradient-to-br from-[#0F2340]/90 to-[#0A1628]/90 p-7 lg:p-8 relative overflow-hidden">
          <div className="absolute inset-0 web-pattern opacity-10" />
          <div className="absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full bg-[#8B5CF6]/15 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E30613] text-white text-xs font-black tracking-[0.14em]">📚 DOCS • SINGLE SOURCE — SAB YAHI</div>
            <h1 className="font-display text-[38px] lg:text-[52px] leading-[0.9] tracking-[-0.02em] mt-3"><span className="text-white">BHNSTOCK</span> <span className="bg-gradient-to-r from-[#E30613] to-[#FFD23F] bg-clip-text text-transparent">DOCS</span> <span className="text-white/60 text-[18px] font-mono tracking-widest">— BRAND NEW DAY</span></h1>
            <p className="text-white/60 text-sm mt-3 max-w-[760px] leading-relaxed">Pehle explanation pure web pe bikhra tha — ab <b className="text-white">sab kuch ek jagah</b>. Stack, DB, Hive, SIM, Queue, Poller, Auth, API, Realtime, Frontend 3D, Edits — ek hi page pe. Search karo, copy karo, deploy karo.</p>
            <div className="mt-4 flex gap-2 max-w-[520px]">
              <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-full bg-white text-[#0A1628]">
                <Search size={16} className="text-black/40"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search docs... (hive, sim, queue, phonk)" className="flex-1 bg-transparent outline-none text-sm placeholder:text-black/40"/>
              </div>
              <a href="/BHNSTOCK_SMS_SPREADER_3D_ARCHITECTURE.html" target="_blank" className="hidden sm:flex items-center gap-1.5 px-4 py-3 rounded-full bg-white/10 border border-white/15 text-xs font-black">FULL HTML <ExternalLink size={12}/></a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        {/* TOC */}
        <aside className="hidden lg:block sticky top-[88px] h-fit">
          <div className="rounded-2xl comic-border bg-[#0F2340] border border-white/10 p-3">
            <div className="text-xs font-black tracking-[0.14em] text-white/50 px-2 py-1">CONTENTS</div>
            <nav className="mt-2 space-y-1">
              {SECTIONS.map(s=>{
                const hide = q && !s.label.toLowerCase().includes(q.toLowerCase())
                if(hide) return null
                return <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] text-xs font-bold text-white/80 hover:text-white"><s.icon size={12} className="text-[#E30613]"/>{s.label}</a>
              })}
            </nav>
            <div className="mt-3 p-3 rounded-xl bg-[#E30613]/10 border border-[#E30613]/20 text-xs leading-relaxed text-white/70">
              <b className="text-[#FFD23F]">Tip:</b> Video + gana LIVE PREVIEW me hi chalega — docs me sab likha hai (#edits dekho).
            </div>
          </div>
        </aside>

        <main className="space-y-6 min-w-0">
          {/* 01 Overview */}
          <section id="overview" className="rounded-[22px] comic-border bg-[#0F2340] border border-white/10 p-6">
            <h2 className="font-display text-2xl flex items-center gap-2"><BookOpen size={18} className="text-[#E30613]"/> 01 — OVERVIEW</h2>
            <p className="text-sm text-white/70 mt-2 leading-relaxed"><b className="text-white">BHNSTOCK SMS SPREADER 3D WEB</b> — Android fleet ko Firebase RTDB hives ke through SMS fabric banata hai. Template <code className="font-mono bg-white/10 px-1 rounded">{'{{name}} {{phone}} {{vehical}}'}</code>, contacts import, wave me round-robin, ACK chase, retry, live Socket.io — sab Brand New Day 3D theme me.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
              {[
                {t:'Multi-Hive', d:'5-6 Firebase DB ek saath, concurrency 3'},
                {t:'Wave Dispatch', d:'Batch + delay, pause/resume/cancel'},
                {t:'ACK Chase', d:'12s timeout, 1 retry, phir fail'},
                {t:'Live UI', d:'Socket.io push + 4s poll fallback'},
              ].map(x=>(
                <div key={x.t} className="p-3 rounded-xl bg-white/5 border border-white/10"><b className="text-sm">{x.t}</b><div className="text-xs text-white/50 mt-1">{x.d}</div></div>
              ))}
            </div>
          </section>

          {/* 02 Stack */}
          <section id="stack" className="rounded-[22px] comic-border bg-[#0F2340] border border-white/10 p-6">
            <h2 className="font-display text-2xl flex items-center gap-2"><Layers size={18} className="text-[#E30613]"/> 02 — STACK & FOLDERS</h2>
            <div className="grid md:grid-cols-2 gap-4 mt-3">
              <div>
                <div className="text-xs font-black tracking-widest text-white/60">STACK</div>
                <div className="mt-2 space-y-1 text-xs font-mono">
                  <div className="flex justify-between bg-white/5 px-3 py-2 rounded-xl"><span>Frontend</span><span className="text-white/60">React 18 • Vite 5.4 • Router 6</span></div>
                  <div className="flex justify-between bg-white/5 px-3 py-2 rounded-xl"><span>Styling</span><span className="text-white/60">Tailwind 3 • Framer Motion</span></div>
                  <div className="flex justify-between bg-white/5 px-3 py-2 rounded-xl"><span>Backend</span><span className="text-white/60">Express 4 • Socket.io 4</span></div>
                  <div className="flex justify-between bg-white/5 px-3 py-2 rounded-xl"><span>DB</span><span className="text-white/60">better-sqlite3 WAL</span></div>
                  <div className="flex justify-between bg-white/5 px-3 py-2 rounded-xl"><span>Auth</span><span className="text-white/60">JWT HttpOnly • bcrypt</span></div>
                </div>
              </div>
              <div>
                <div className="text-xs font-black tracking-widest text-white/60">FOLDERS</div>
                <pre className="mt-2 p-3 rounded-xl bg-black/40 border border-white/10 text-xs font-mono overflow-auto">src/server/config, db, middleware/auth, services/firebase|queue|poller, routes/*
src/client/components/Layout, pages/Dashboard|Campaigns|Devices|Firebases|Settings|Docs|SpideyEdits, lib/api
data/sms.db (WAL)</pre>
                <button onClick={()=>copy('npm run dev → :5173 + :3000\nnpm run build && npm start','stack')} className="mt-2 px-3 py-1.5 rounded-full bg-white text-[#0A1628] text-xs font-black flex items-center gap-1">{copied==='stack'?<Check size={12}/>:<Copy size={12}/>} {copied==='stack'?'COPIED':'COPY SCRIPTS'}</button>
              </div>
            </div>
          </section>

          {/* 03 DB */}
          <section id="db" className="rounded-[22px] comic-border bg-[#0F2340] border border-white/10 p-6">
            <h2 className="font-display text-2xl flex items-center gap-2"><Database size={18} className="text-[#E30613]"/> 03 — DATABASE SCHEMA (WAL)</h2>
            <pre className="mt-3 p-4 rounded-xl bg-black/50 border border-white/10 text-xs font-mono overflow-auto">firebases(id, name, database_url, service_account_json, status, device_count)
devices(id, firebase_id, name, model, status, battery, signal, last_seen, total_sent, total_failed,
        sim_count, has_recharge, sim1_recharge, sim2_recharge)  ← NEW
campaigns(id, name, template, status, total, sent, failed, pending, batch_size, delay_ms)
campaign_messages(id, campaign_id, phone, variables JSON, rendered, status, device_id, attempts, sent_at)
queue_items(id, campaign_id, message_id, status)
settings(key, value) — per_sim_limit, max_sms..., default_sim_count, hive_concurrency, check_recharge
users(id, username, password_hash)</pre>
            <div className="text-xs text-white/60 mt-2">• WAL + foreign_keys ON • transaction on campaign create • rendered baked at create-time</div>
          </section>

          {/* 04 HIVE & SIM */}
          <section id="hive" className="rounded-[22px] comic-border bg-gradient-to-br from-[#1A0A2E] to-[#0F2340] border border-[#8B5CF6]/20 p-6">
            <h2 className="font-display text-2xl flex items-center gap-2"><Radio size={18} className="text-[#8B5CF6]"/> 04 — HIVE & SIM TRACKING (NEW — 5-6 HIVES)</h2>
            <div className="grid md:grid-cols-2 gap-4 mt-3 text-sm leading-relaxed">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <b className="text-[#FFD23F]">Hive Concurrency</b>
                <ul className="list-disc pl-5 text-white/70 mt-2 space-y-1 text-xs">
                  <li><code>hive_concurrency=3</code> — 6 hives ko 3+3 chunk me poll, overload nahi</li>
                  <li>Har hive try/catch — ek fail to baaki chalte</li>
                  <li>Poller har 3s, WAL me upsert — sim_count preserve</li>
                  <li>Settings me live badal sakte</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <b className="text-[#FFD23F]">Per-SIM Capacity</b>
                <ul className="list-disc pl-5 text-white/70 mt-2 space-y-1 text-xs">
                  <li>1 SIM = 100/day, 2 SIM = 200/day</li>
                  <li>2 SIM me 1 slot no-recharge → 100</li>
                  <li>2 SIM dono no-recharge → 0 skip</li>
                  <li>1 SIM no-recharge → 0 skip</li>
                  <li>check_recharge=false → sab bypass</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-xl bg-[#E30613]/10 border border-[#E30613]/20 text-xs text-white/80">
              <b>Round-robin:</b> 1 SIM → 1 msg → next SIM → 1→2→3→4→5→6→wrap. Sirf ONLINE + RECHARGE pool se. Offline sirf count. Devices page ab count-only — 1000 pe bhi halka.
            </div>
            <div className="mt-3 grid md:grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">GET /api/stats → totalCapacity, remaining, perSim</div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">PUT /api/devices/:id → sim_count, has_recharge, sim1/2</div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">PUT /api/devices/bulk/recharge</div>
            </div>
          </section>

          {/* 05 Firebase */}
          <section id="firebase" className="rounded-[22px] comic-border bg-[#0F2340] border border-white/10 p-6">
            <h2 className="font-display text-2xl">05 — FIREBASE SERVICE (REST)</h2>
            <div className="mt-3 grid md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10"><b>testConnection</b><div className="text-white/50">GET /.json?shallow=true → latency</div></div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10"><b>pollDevices</b><div className="text-white/50">GET /devices.json | /clients.json → upsert</div></div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10"><b>queueSms</b><div className="text-white/50">PUT /queue/... + webhookEvent</div></div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10"><b>waitForAck</b><div className="text-white/50">poll sendSms.isSended, timeout 12s</div></div>
            </div>
            <div className="text-xs text-white/50 mt-2">Mock fallback jab URL me mock/demo ho — synthetic devices + 82% delivered for demo.</div>
          </section>

          {/* 06 Queue */}
          <section id="queue" className="rounded-[22px] comic-border bg-[#0F2340] border border-white/10 p-6">
            <h2 className="font-display text-2xl flex items-center gap-2"><Zap size={18} className="text-[#FFD23F]"/> 06 — QUEUE / CAMPAIGN ENGINE</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-mono">
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">Draft → dedupe → rendered</span>
              <span>→</span>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">queued</span>
              <span>→</span>
              <span className="px-3 py-1 rounded-full bg-[#E30613] text-white">wave (batch) round-robin</span>
              <span>→</span>
              <span className="px-3 py-1 rounded-full bg-emerald-500 text-white">sent / retry / failed</span>
            </div>
            <ul className="list-disc pl-5 mt-3 text-xs text-white/70 space-y-1">
              <li>Dedupe: <code>{'^\\+?[0-9]{7,15}$'}</code>, variables JSON, rendered once</li>
              <li>Speed: turbo 0.35× (550ms → ~192ms per wave), batch 10</li>
              <li>Retry once if attempts&lt;2 else fail</li>
              <li>Pause/Resume/Cancel via Map state + DB status</li>
            </ul>
          </section>

          {/* 07 Poller */}
          <section id="poller" className="rounded-[22px] comic-border bg-[#0F2340] border border-white/10 p-6">
            <h2 className="font-display text-2xl">07 — DEVICE POLLER</h2>
            <pre className="mt-2 p-3 rounded-xl bg-black/40 border border-white/10 text-xs font-mono overflow-auto">{`setInterval(pollAll, 3000)
pollAll: for i+=concurrency chunk → Promise.all(pollDevices)
upsert ON CONFLICT, emit devices:update, firebases:update, stats:devices`}</pre>
          </section>

          {/* 08 Auth */}
          <section id="auth" className="rounded-[22px] comic-border bg-[#0F2340] border border-white/10 p-6">
            <h2 className="font-display text-2xl flex items-center gap-2"><Shield size={18} className="text-emerald-400"/> 08 — AUTH</h2>
            <div className="text-xs text-white/70 mt-2">Login → bcrypt.compare → jwt.sign 7d → HttpOnly cookie + localStorage. Guard reads cookie/Bearer. DISABLE_AUTH=true pe open.</div>
            <div className="mt-2 flex gap-2 text-xs font-mono">
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">POST /api/auth/login</span>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">GET /api/auth/me</span>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">POST /api/auth/logout</span>
            </div>
          </section>

          {/* 09 API */}
          <section id="api" className="rounded-[22px] comic-border bg-[#0F2340] border border-white/10 p-6">
            <h2 className="font-display text-2xl">09 — API ROUTES</h2>
            <div className="mt-3 grid md:grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">GET /api/stats, /api/stats/today</div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">GET/POST /api/firebases, /:id/test, /bulk</div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">GET /api/devices, PUT /:id, PUT /bulk/recharge</div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">GET/POST /api/campaigns, /:id/start|pause|resume|cancel, /:id/messages</div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">GET/PUT /api/settings</div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">GET /api/health</div>
            </div>
          </section>

          {/* 10 Realtime */}
          <section id="realtime" className="rounded-[22px] comic-border bg-[#0F2340] border border-white/10 p-6">
            <h2 className="font-display text-2xl">10 — REALTIME</h2>
            <div className="text-xs text-white/70">Socket.io: hello, devices:update, firebases:update, stats:devices, campaign:created/status/progress/completed, message:sending/sent/failed/retry, campaign:log</div>
          </section>

          {/* 11 Frontend */}
          <section id="frontend" className="rounded-[22px] comic-border bg-[#0F2340] border border-white/10 p-6">
            <h2 className="font-display text-2xl flex items-center gap-2"><Palette size={18} className="text-[#8B5CF6]"/> 11 — FRONTEND 3D (Brand New Day)</h2>
            <div className="grid md:grid-cols-2 gap-3 mt-2 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10"><b className="text-[#FFD23F]">Tokens</b><div className="text-white/60 mt-1">red #E30613, blue #0A1628, cyan #00D9FF, yellow #FFD23F, Bebas/Anton/Space Grotesk</div></div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10"><b className="text-[#FFD23F]">Effects</b><div className="text-white/60 mt-1">mesh, web-pattern, halftone, card-3d tilt, comic-border, glass blur, shimmer</div></div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10"><b>Routes</b><div className="text-white/60 mt-1">/ → Dashboard, /campaigns, /devices (count-only big scene), /firebases, /settings, /edits (phonk), /docs</div></div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10"><b>Compact</b><div className="text-white/60 mt-1">Counts only for 1000+ devices, no table by default</div></div>
            </div>
          </section>

          {/* 12 Edits */}
          <section id="edits" className="rounded-[22px] comic-border bg-gradient-to-br from-[#1A0A2E] to-[#0A1628] border border-[#8B5CF6]/20 p-6">
            <h2 className="font-display text-2xl">12 — EDITS • PHONK 3D (Video Fix)</h2>
            <div className="text-sm text-white/70 mt-2 leading-relaxed">
              <b className="text-white">Video + gana LIVE PREVIEW me hi chalega.</b> Workspace ka in-app preview <code>sandbox="allow-scripts"</code> me network block hota hai, isliye YouTube iframe + phonk audio waha nahi bajega. <b className="text-[#FFD23F]">Solution:</b> Upar <b className="text-white">LIVE PREVIEW → Website (5173) → /edits</b> kholo. Background phonk video fixed (opacity 0.13, blur) + main player (YouTube embed) + hidden phonk audio loop. Muted pe start, UNMUTE dabao.
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-white text-[#0A1628] font-black">8 BNT edits curated</span>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15">3D tilt on mouse</span>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15">phonk aura purple/pink</span>
            </div>
          </section>

          {/* 13 Deploy */}
          <section id="deploy" className="rounded-[22px] comic-border bg-[#0F2340] border border-white/10 p-6">
            <h2 className="font-display text-2xl flex items-center gap-2"><Rocket size={18} className="text-emerald-400"/> 13 — DEPLOY</h2>
            <pre className="mt-3 p-3 rounded-xl bg-black/40 border border-white/10 text-xs font-mono overflow-auto">{`PORT=3000
JWT_SECRET=32+ chars
ADMIN_USER=admin ADMIN_PASS=••••••••
DATABASE_PATH=./data/sms.db
npm run build && npm start → serves API + static + Socket.io`}</pre>
            <div className="mt-3 flex gap-2">
              <button onClick={()=>copy('JWT_SECRET=bhn-supersecret-2026-32chars-long-secret-key-123456 DEVICE_TOKEN=bhn-device-secret-2026 DISABLE_AUTH=true node dist/src/server/index.js','deploy')} className="px-4 py-2 rounded-full bg-white text-[#0A1628] text-xs font-black flex items-center gap-1">{copied==='deploy'?<Check size={12}/>:<Copy size={12}/>} {copied==='deploy'?'COPIED':'COPY START CMD'}</button>
              <a href="/BHNSTOCK_SMS_SPREADER_3D_ARCHITECTURE.html" target="_blank" className="px-4 py-2 rounded-full bg-white/10 border border-white/15 text-xs font-bold flex items-center gap-1">OPEN FULL HTML DOC <ExternalLink size={12}/></a>
            </div>
          </section>

          <div className="text-center text-xs font-mono text-white/30 py-4">© 2026 BHNSTOCK — Brand New Day • Docs single source • “With great power, great throughput” 🕷️</div>
        </main>
      </div>
    </div>
  )
}
