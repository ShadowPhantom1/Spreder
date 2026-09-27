import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Save, Sliders, Timer, Layers, Radio, Zap, Shield, Trash2, Clock, Gauge, Smartphone } from 'lucide-react'

export default function Settings(){
  const [form,setForm]=useState<Record<string,string>>({})
  const [saving,setSaving]=useState(false)
  const load=async()=>{ try{ const s=await api.get('/api/settings'); setForm(s)}catch{}}
  useEffect(()=>{ load() },[])

  const save=async()=>{
    setSaving(true)
    try{ const s=await api.put('/api/settings', form); setForm(s); alert('Suit config saved — web tuned ✓')}catch(e:any){ alert(e.message)} finally{ setSaving(false)}
  }

  // EASY 50/sec — one-tap preset (user asked: 1 sec me 50 bina delay)
  const applyPreset=async(preset:string)=>{
    let cfg:Record<string,string>={}
    if(preset==='10') cfg={ dispatch_batch_size:'10', dispatch_delay_ms:'1000', ack_timeout_ms:'3000', poll_interval_ms:'1500', hive_concurrency:'4', speed_profile:'balanced' }
    if(preset==='25') cfg={ dispatch_batch_size:'25', dispatch_delay_ms:'200', ack_timeout_ms:'2200', poll_interval_ms:'1000', hive_concurrency:'6', speed_profile:'beast' }
    if(preset==='50') cfg={ dispatch_batch_size:'50', dispatch_delay_ms:'0', ack_timeout_ms:'1200', poll_interval_ms:'500', hive_concurrency:'6', speed_profile:'ultra' }
    if(preset==='100') cfg={ dispatch_batch_size:'50', dispatch_delay_ms:'0', ack_timeout_ms:'1000', poll_interval_ms:'400', hive_concurrency:'6', speed_profile:'ultra' }
    if(preset==='max') cfg={ dispatch_batch_size:'50', dispatch_delay_ms:'0', ack_timeout_ms:'800', poll_interval_ms:'400', hive_concurrency:'6', speed_profile:'ultra' }
    const next={...form,...cfg}
    setForm(next)
    setSaving(true)
    try{ const s=await api.put('/api/settings', next); setForm(s); alert(`${preset==='max'?'MAX':preset+'/sec'} lag gaya — ${preset==='50'?'50 msg/sec NO DELAY ✅':''} Ab campaign chalao toh rocket!`)}catch(e:any){ alert(e.message)} finally{ setSaving(false)}
  }

  const fields=[
    { key:'poll_interval_ms', label:'Poll Interval (ms)', icon: Radio, hint:'Hive sweep — 1500 ultra (5-6 hives ke liye, beast)' },
    { key:'dispatch_batch_size', label:'Wave Batch Size', icon: Layers, hint:'Msgs per wave (24 = beast • 10 = turbo • 5 = balanced)' },
    { key:'dispatch_delay_ms', label:'Wave Delay (ms)', icon: Timer, hint:'Pause between waves (220ms beast, 300→220 ultra fast)' },
    { key:'ack_timeout_ms', label:'ACK Timeout (ms)', icon: Timer, hint:'Wait for isSended true (4500 beast — 12s se 2.6× kam)' },
  ]
  const hiveFields=[
    { key:'default_sim_count', label:'Default SIM Count', icon: Smartphone, hint:'1 = single SIM, 2 = dual SIM — new devices pe default, 5-6 hives ke liye', type:'select', opts:['1','2'] },
    { key:'check_recharge', label:'Check Recharge? (skip no-recharge)', icon: Shield, hint:'true = without-recharge wale SIM ko skip, false = sab se bhej', type:'select', opts:['true','false'] },
    { key:'hive_concurrency', label:'Hive Poll Concurrency', icon: Radio, hint:'5-6 hives parallel me poll — 3 default, 2=slow, 5=max' , type:'select', opts:['1','2','3','4','5','6'] },
    { key:'per_sim_limit', label:'Per SIM Daily Limit (alias)', icon: Shield, hint:'Alias for max_sms_per_device_per_day — 100 default' },
  ]
  const webhookFields=[
    { key:'webhook_url', label:'Webhook URL (on campaign completed)', icon: Radio, hint:'e.g., https://your-app.com/api/hook — JSON POST hoga', type:'text' },
    { key:'webhook_enabled', label:'Webhook Enabled?', icon: Zap, hint:'true = campaign completed pe auto POST, false = off', type:'select', opts:['true','false'] },
    { key:'webhook_secret', label:'Webhook Secret', icon: Shield, hint:'Optional — header X-Webhook-Secret me jayega', type:'text' },
  ]
  const mast=[
    { key:'max_sms_per_device_per_day', label:'MAX SMS / SIM / Day', icon: Shield, hint:'1 SIM = 100 SMS/day default — daily limit, auto-skip if hit', type:'number' },
    { key:'daily_limit_enabled', label:'Daily Limit ON?', icon: Shield, hint:'true = enforce 100/day, false = unlimited' },
    { key:'speed_profile', label:'Speed Profile', icon: Gauge, hint:'slow | balanced | fast | turbo | beast | ultra — multiplies delay (beast 0.14× = 7× tez!)' },
    { key:'auto_delete_completed_after_days', label:'Auto-Delete (days)', icon: Trash2, hint:'0 = disabled, 7 = delete completed campaigns after 7 days' },
    { key:'today_start_hour', label:'Day Start Hour', icon: Clock, hint:'0 = midnight reset for daily counts' },
  ]

  const speedInfo: Record<string,string> = {
    slow: '1.6× delay — safe for low-end SIM',
    balanced: '1.0× — default',
    fast: '0.6× — 40% faster',
    turbo: '0.28× — turbo!',
    beast: '0.14× — 7× faster! PHONK SPEED',
    ultra: '0.08× — 12× ULTRA!',
  }

  return (
    <div className="max-w-[860px] space-y-6">
      <div>
        <h1 className="font-display text-[30px] leading-none tracking-wide">SUIT CONFIG • MAST SETTINGS</h1>
        <p className="text-sm text-white/60 mt-1">Ab code nahi chute — sab yaha se: speed, daily limit, auto-delete, row-select, variable mapping sab setting me!</p>
      </div>

      <div className="rounded-[22px] comic-border bg-gradient-to-br from-[#0F2340] to-[#0A1628] p-6">
        <div className="flex items-center gap-2 text-[#FFD23F] text-xs font-black tracking-[0.16em]"><Zap size={14}/> MAST FEATURES — NO CODE NEEDED</div>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {mast.map(f=>(
            <label key={f.key} className="block">
              <span className="text-xs font-black tracking-widest text-white/70 flex items-center gap-1.5"><f.icon size={12} className="text-[#E30613]"/>{f.label}</span>
              {f.key==='speed_profile' ? (
                <select value={form[f.key]||'beast'} onChange={e=>setForm({...form,[f.key]:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#E30613]/50 text-sm">
                  <option value="slow">slow — {speedInfo.slow}</option>
                  <option value="balanced">balanced — {speedInfo.balanced}</option>
                  <option value="fast">fast — {speedInfo.fast}</option>
                  <option value="turbo">turbo — {speedInfo.turbo}</option>
                  <option value="beast">beast — {speedInfo.beast}</option>
                  <option value="ultra">ultra — {speedInfo.ultra}</option>
                </select>
              ) : (
                <input
                  value={form[f.key] || ''}
                  onChange={e=>setForm({...form, [f.key]: e.target.value})}
                  className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#E30613]/50 text-sm font-mono"
                  placeholder={f.key}
                />
              )}
              <span className="text-[11px] font-mono text-white/40 mt-1 block">{f.hint}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-2xl bg-[#E30613]/10 border border-[#E30613]/20 text-xs leading-relaxed text-white/80">
          <b className="text-[#FFD23F]">1 SIM = 100 SMS/day kaise kaam karta hai?</b> — Har device pe campaign_messages me sent_at today 00:00 se count hota hai. Limit hit hua toh us SIM ko skip kar deta hai, dusre SIM se bhejta hai. Live Dashboard pe aaj ka total + per-SIM count dikhta hai. Bar-bar code nahi — yaha se 100 ko 50 ya 200 kar do, instant lag jayega!
        </div>
      </div>

      {/* EASY SPEED — 1 TAP 50/SEC (user: easy bna do) */}
      <div className="rounded-[22px] comic-border bg-gradient-to-br from-[#8B5CF6]/20 via-[#0F2340] to-[#0A1628] p-6 border-[#8B5CF6]/30">
        <div className="flex items-center gap-2 text-[#FFD23F] text-xs font-black tracking-[0.16em]"><Gauge size={14}/> EASY SPEED — 1 TAP ME 50/SEC (NO DELAY)</div>
        <p className="text-xs text-white/60 mt-1">Time set karna hard tha → ab sirf 1 button dabao. <b className="text-white">50/sec = batch 50 + delay 0 + ultra</b>. Manual me ulajhna nahi!</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button onClick={()=>applyPreset('10')} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-center">
            <div className="text-[11px] font-black tracking-widest text-white/60">SLOW</div><div className="font-display text-xl text-white">10<span className="text-xs font-mono">/sec</span></div><div className="text-[10px] font-mono text-white/40">1s delay</div>
          </button>
          <button onClick={()=>applyPreset('25')} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-center">
            <div className="text-[11px] font-black tracking-widest text-white/60">FAST</div><div className="font-display text-xl text-[#00D9FF]">25<span className="text-xs font-mono">/sec</span></div><div className="text-[10px] font-mono text-white/40">0.2s gap</div>
          </button>
          <button onClick={()=>applyPreset('50')} className="p-3 rounded-2xl bg-[#E30613] border border-[#E30613] text-white shadow-spidey text-center scale-[1.02]">
            <div className="text-[11px] font-black tracking-widest">50/SEC ⭐</div><div className="font-display text-xl">50<span className="text-xs font-mono">/sec</span></div><div className="text-[10px] font-mono opacity-80">0 delay • ULTRA</div>
          </button>
          <button onClick={()=>applyPreset('100')} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-center">
            <div className="text-[11px] font-black tracking-widest text-white/60">BEAST</div><div className="font-display text-xl text-[#FFD23F]">100<span className="text-xs font-mono">/sec</span></div><div className="text-[10px] font-mono text-white/40">max batch</div>
          </button>
          <button onClick={()=>applyPreset('max')} className="p-3 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] border border-white/20 text-white text-center">
            <div className="text-[11px] font-black tracking-widest">MAX</div><div className="font-display text-xl">∞</div><div className="text-[10px] font-mono opacity-80">0.5s poll</div>
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15">Current: {form.dispatch_batch_size||'-'} batch • {form.dispatch_delay_ms||'-'}ms delay • {form.speed_profile||'-'} • {form.poll_interval_ms||'-'}ms poll</span>
          <span className="text-white/40">→ Tap 50/SEC for no-delay!</span>
        </div>
      </div>

      <div className="rounded-[22px] comic-border bg-gradient-to-br from-[#0F2340] to-[#0A1628] p-6">
        <div className="flex items-center gap-2 text-[#FFD23F] text-xs font-black tracking-[0.16em]"><Sliders size={14}/> DISPATCH ENGINE</div>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {fields.map(f=>(
            <label key={f.key} className="block">
              <span className="text-xs font-black tracking-widest text-white/70 flex items-center gap-1.5"><f.icon size={12} className="text-[#E30613]"/>{f.label}</span>
              <input
                value={form[f.key] || ''}
                onChange={e=>setForm({...form, [f.key]: e.target.value})}
                className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#E30613]/50 text-sm font-mono"
                placeholder={f.key}
              />
              <span className="text-[11px] font-mono text-white/40 mt-1 block">{f.hint}</span>
            </label>
          ))}
        </div>

        {/* HIVE & SIM TRACKING */}
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-[#1A0A2E] to-[#0F2340] border border-[#8B5CF6]/20 p-4">
          <div className="text-xs font-black tracking-[0.16em] text-[#FFD23F] flex items-center gap-2"><Smartphone size={12}/> HIVE & SIM TRACKING — 5-6 HIVES READY</div>
          <div className="mt-3 grid sm:grid-cols-2 gap-4">
            {hiveFields.map(f=>(
              <label key={f.key} className="block">
                <span className="text-xs font-black tracking-widest text-white/70 flex items-center gap-1.5"><f.icon size={12} className="text-[#8B5CF6]"/>{f.label}</span>
                {(f as any).type==='select' ? (
                  <select value={form[f.key]|| (f.key==='default_sim_count'?'1': f.key==='check_recharge'?'true': f.key==='hive_concurrency'?'3': '')} onChange={e=>setForm({...form,[f.key]:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#8B5CF6]/50 text-sm">
                    {((f as any).opts as string[]).map((o:string)=><option key={o} value={o}>{o} {f.key==='default_sim_count'?(o==='1'?'— Single SIM':'— Dual SIM (200/day)'):''} {f.key==='hive_concurrency'?`— ${o} parallel`:''}</option>)}
                  </select>
                ) : (
                  <input value={form[f.key] || ''} onChange={e=>setForm({...form,[f.key]:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#8B5CF6]/50 text-sm font-mono" placeholder={f.key}/>
                )}
                <span className="text-[11px] font-mono text-white/40 mt-1 block">{f.hint}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-xs leading-relaxed text-white/80">
            <b className="text-[#FFD23F]">5-6 hives kaise handle hota hai?</b> — Poller hive_concurrency=3 se 3 hives ek saath poll karta hai, overload nahi. Per-SIM capacity: 1 SIM=100, 2 SIM=200 (agar ek slot no-recharge to 100), bina recharge wala SIM auto-skip. Device table me har device ka SIM count + recharge toggle hai — waha se mark karo kaunsa SIM recharge pe hai!
          </div>
        </div>

        {/* WEBHOOK & REPORTS */}
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-[#0E3A5C] to-[#1A0A2E] border border-[#00D9FF]/20 p-4">
          <div className="text-xs font-black tracking-[0.16em] text-[#00D9FF] flex items-center gap-2"><Radio size={12}/> WEBHOOK & REPORTS — AUTO NOTIFY</div>
          <div className="mt-3 grid sm:grid-cols-2 gap-4">
            {webhookFields.map(f=>(
              <label key={f.key} className="block">
                <span className="text-xs font-black tracking-widest text-white/70 flex items-center gap-1.5"><f.icon size={12} className="text-[#00D9FF]"/>{f.label}</span>
                {(f as any).type==='select' ? (
                  <select value={form[f.key]|| (f.key==='webhook_enabled'?'false':'')} onChange={e=>setForm({...form,[f.key]:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#00D9FF]/50 text-sm">
                    {((f as any).opts as string[]).map((o:string)=><option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input value={form[f.key] || ''} onChange={e=>setForm({...form,[f.key]:e.target.value})} className="mt-1 w-full px-4 py-3 rounded-2xl bg-[#0A1628] border border-white/10 outline-none focus:border-[#00D9FF]/50 text-sm font-mono" placeholder={f.key==='webhook_url'?'https://...':f.key} />
                )}
                <span className="text-[11px] font-mono text-white/40 mt-1 block">{f.hint}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={async()=>{
              try{
                const r=await api.post('/api/settings/test-webhook',{})
                alert(`Webhook test: ${r.status} → ${JSON.stringify(r.response||r).slice(0,400)}`)
              }catch(e:any){ alert('Webhook test failed: '+(e.message||e.error)) }
            }} className="px-4 py-2 rounded-full bg-[#00D9FF] text-[#0A1628] text-xs font-black flex items-center gap-1"><Radio size={12}/> TEST WEBHOOK</button>
            <span className="text-xs font-mono text-white/40 self-center">Campaign completed pe auto POST with JSON {`{event, campaignId, sent, failed}`}</span>
          </div>
        </div>

        <button onClick={save} disabled={saving} className="mt-6 px-8 py-3 rounded-full bg-[#E30613] hover:bg-[#FF2D3B] disabled:opacity-50 text-white text-sm font-black tracking-wide shadow-spidey flex items-center gap-2">
          <Save size={16}/>{saving?'SAVING…':'SAVE CONFIG — NO CODE NEEDED'}
        </button>

        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
            <div className="text-xs font-black tracking-widest text-white/60">CSV VARIABLE MAPPING — AUTO</div>
            <ul className="text-[13px] leading-relaxed text-white/70 mt-2 list-disc pl-5 space-y-1">
              <li>CSV header auto-detect: `phone,vehicle` ya `phone,vehical` ya `phone,name,vehicle`</li>
              <li>Phone column khud detect — `+91` ho ya 10-digit, kisi bhi column me ho</li>
              <li>Template me `{"{{vehical}}"}` / `{"{{vehicle}}"}` / `{"{{name}}"}` / `{"{{phone}}"}` sab chalega — case-insensitive</li>
              <li>Row select: CSV upload ke baad table me checkbox se choose karo kaunsi rows bhejni hai</li>
            </ul>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
            <div className="text-xs font-black tracking-widest text-white/60">AUTO-DELETE & LIVE</div>
            <ul className="text-[13px] leading-relaxed text-white/70 mt-2 list-disc pl-5 space-y-1">
              <li>Auto-Delete days 1 se bada ho to cleanup se purane campaigns auto delete</li>
              <li>Dashboard pe Aaj ka total + per-SIM aaj ka count live</li>
              <li>Delete button har campaign card + bulk delete bhi</li>
              <li>Speed profile se delay multiplier — turbo pe 65% tez!</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] comic-border bg-[#0A1628] p-6 border border-white/10">
        <div className="text-xs font-black tracking-[0.16em] text-white/60">RAW SETTINGS — EXPORT</div>
        <pre className="mt-3 p-4 rounded-2xl bg-black/40 border border-white/10 text-xs font-mono text-white/80 overflow-auto">{JSON.stringify(form, null, 2)}</pre>
        <div className="mt-3 flex gap-2">
          <button onClick={async()=>{ if(!confirm('Cleanup old completed campaigns?')) return; const r=await api.post('/api/campaigns/cleanup',{}); alert(`Deleted ${r.deleted} old campaigns`); }} className="px-4 py-2 rounded-full bg-white/10 border border-white/15 text-xs font-bold flex items-center gap-1"><Trash2 size={12}/> RUN CLEANUP NOW</button>
          <button onClick={()=>navigator.clipboard.writeText(JSON.stringify(form,null,2))} className="px-4 py-2 rounded-full bg-white text-[#0A1628] text-xs font-black">COPY JSON</button>
        </div>
      </div>
    </div>
  )
}
