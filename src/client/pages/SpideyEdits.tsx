import { useState, useEffect, useRef } from 'react'
import { Search, Play, Volume2, VolumeX, Sparkles, Flame, Zap, Eye, Heart, Share2, SkipForward, Shuffle, Repeat, Music2, Video, Layers, Maximize2 } from 'lucide-react'
import { motion } from 'framer-motion'

const VIDEOS = [
  { id: "3OvNlYP9PSQ", title: "POV: Spider-Man Brand New Day — Brazilian Phonk", channel: "BNT Edits • Phonk", views: "1.2M", likes: "84K", tag: "PHONK", duration: "0:29", color: "from-[#8B5CF6] to-[#EC4899]" },
  { id: "4GDzePD4hJc", title: "This Trailer is Insane — BND Edit | FUNK TAKA (Slowed)", channel: "Spidey Funk • 2026", views: "890K", likes: "52K", tag: "FUNK TAKA", duration: "0:19", color: "from-[#E30613] to-[#FF4D5A]" },
  { id: "nxkRE3vIIWI", title: "Spider-Man is Freaked Out — Brand New Day AMV", channel: "AMV Universe", views: "2.4M", likes: "121K", tag: "AMV", duration: "2:11", color: "from-[#00D9FF] to-[#0E3A5C]" },
  { id: "sWr3JIVuJ7Y", title: "I'm Both — Brand New Day (Montagem Guerreiro Slowed)", channel: "Montagem Edits", views: "560K", likes: "38K", tag: "MONTAGEM", duration: "0:35", color: "from-[#FFD23F] to-[#FF8A00]" },
  { id: "qLd9s2zmhc8", title: "I'm Both — Brand New Day | MANANA (Slowed)", channel: "BNT Slowed", views: "1.1M", likes: "71K", tag: "MANANA", duration: "0:32", color: "from-[#8B5CF6] to-[#00D9FF]" },
  { id: "i6OfBlm8lRM", title: "Brand New Day Edit — LOSER (Tame Impala)", channel: "Tame Edit", views: "430K", likes: "29K", tag: "LOSER", duration: "0:24", color: "from-[#162447] to-[#8B5CF6]" },
  { id: "cxYQvMatt7U", title: "Brand New Day (2026) — Fan Made Trailer 4K", channel: "Marvel Fan", views: "3.7M", likes: "189K", tag: "TRAILER 4K", duration: "2:03", color: "from-[#E30613] to-[#0A1628]" },
  { id: "62bIsvRcPv0", title: "Brand New Day — Official Trailer (July 31) • Marvel", channel: "Marvel Entertainment", views: "18M", likes: "1.2M", tag: "OFFICIAL", duration: "2:25", color: "from-[#0A1628] to-[#E30613]" },
]

const PHONK_PLAYLIST = [
  { title: "LXNGVX - Montagem Sonora", dur: "2:34" },
  { title: "Metamorphosis × BND Phonk Slowed", dur: "3:11" },
  { title: "Brazilian Phonk • Spider Swing Mix", dur: "2:58" },
]

// LOCAL phonk assets — guaranteed to play (no 403, no YouTube iframe error)
const DEMO_VIDEO = "/bg-phonk.mp4"
const PHONK_SRC = "/phonk-loop.wav"

export default function SpideyEdits(){
  const [active, setActive] = useState(VIDEOS[0])
  const [query, setQuery] = useState("")
  const [muted, setMuted] = useState(false)
  const [autoPhonk, setAutoPhonk] = useState(true)
  const [phonkPlaying, setPhonkPlaying] = useState(false)
  const [tilt, setTilt] = useState({x:0,y:0})
  const containerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const filtered = VIDEOS.filter(v => v.title.toLowerCase().includes(query.toLowerCase()) || v.tag.toLowerCase().includes(query.toLowerCase()))

  useEffect(()=>{
    const onMove = (e:MouseEvent)=>{
      if(!containerRef.current) return
      const r = containerRef.current.getBoundingClientRect()
      const cx = r.left + r.width/2
      const cy = r.top + r.height/2
      const dx = (e.clientX - cx)/ (r.width/2)
      const dy = (e.clientY - cy)/ (r.height/2)
      setTilt({x: dy * -6, y: dx * 10})
    }
    window.addEventListener('mousemove', onMove)
    return ()=> window.removeEventListener('mousemove', onMove)
  },[])

  useEffect(()=>{
    const a = audioRef.current
    if(!a) return
    a.loop = true
    a.volume = 0.6
    if(phonkPlaying && !muted){ a.play().catch(()=>{}) } else { a.pause() }
  },[phonkPlaying, muted])

  useEffect(()=>{
    if(videoRef.current){
      videoRef.current.muted = muted
      if(autoPhonk) videoRef.current.play().catch(()=>{})
    }
  },[active, muted, autoPhonk])

  const togglePhonk = ()=>{
    const a = audioRef.current
    if(!a) return
    if(phonkPlaying){ a.pause(); setPhonkPlaying(false) }
    else { a.play().then(()=> setPhonkPlaying(true)).catch(()=> setPhonkPlaying(true)) }
  }

  return (
    <div className="space-y-6">
      {/* Background — CSS only, no YouTube iframe */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#0A1628]" />
        <div className="absolute -top-32 -right-32 w-[720px] h-[720px] rounded-full bg-gradient-to-br from-[#8B5CF6]/18 to-[#EC4899]/12 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[680px] h-[680px] rounded-full bg-gradient-to-br from-[#E30613]/12 to-[#FFD23F]/08 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06]" style={{backgroundImage:'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)', backgroundSize:'22px 22px'}} />
      </div>

      <audio ref={audioRef} src={PHONK_SRC} loop preload="auto" />

      {/* HERO — CLEAN ENGLISH */}
      <div ref={containerRef} className="relative overflow-hidden rounded-[28px] comic-border bg-gradient-to-br from-[#0F2340] via-[#1A0A2E] to-[#0A1628] p-[1px]">
        <div className="relative rounded-[27px] overflow-hidden bg-gradient-to-br from-[#0F2340]/90 via-[#130A2E]/90 to-[#0A1628]/90 p-6 lg:p-8" style={{transform:`perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle:'preserve-3d'}}>
          <div className="absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-[#8B5CF6]/20 to-[#EC4899]/15 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 web-pattern opacity-10 pointer-events-none" />
          <div className="relative grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-center">
            <div style={{transform:'translateZ(40px)'}}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white text-[11px] font-black tracking-[0.14em]">LIVE • BNT EDITS • 3D</div>
              <h1 className="font-display text-[36px] lg:text-[48px] leading-[0.9] tracking-[-0.02em] mt-3">
                <span className="text-white">BNT SPIDER-MAN</span><br/>
                <span className="bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#FFD23F] bg-clip-text text-transparent">PHONK EDITS</span><br/>
                <span className="text-white/90 text-[22px] lg:text-[26px] tracking-[0.18em]">BRAND NEW DAY</span>
              </h1>
              <p className="text-white/60 text-sm leading-relaxed mt-3 max-w-[560px]">Browse Brand New Day edits — Brazilian phonk, funk taka, montagem slowed. 3D tilt, aura and scanline. See Docs for details.</p>
              <div className="mt-4 flex items-center gap-2 max-w-[560px]">
                <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-full bg-white text-[#0A1628] shadow-xl">
                  <Search size={18} className="text-black/40"/>
                  <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search edits..." className="flex-1 bg-transparent outline-none text-sm placeholder:text-black/40 font-medium"/>
                  {query && <button onClick={()=>setQuery('')} className="text-xs font-bold px-2 py-1 rounded-full bg-black/10">✕</button>}
                </div>
                <button onClick={()=>setQuery('phonk')} className="hidden sm:inline-flex px-5 py-3 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white text-sm font-black">PHONK</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {['phonk','funk taka','montagem','trailer','official'].map(k=>(
                  <button key={k} onClick={()=>setQuery(k)} className={`px-3 py-1.5 rounded-full text-xs font-black tracking-widest border ${query===k?'bg-white text-[#0A1628] border-white':'bg-white/10 text-white border-white/15 hover:bg-white/15'}`}>{k.toUpperCase()}</button>
                ))}
                <span className="text-xs font-mono text-white/40 self-center ml-1">{filtered.length} edits</span>
              </div>
            </div>
            <div className="relative hidden lg:block" style={{transform:'translateZ(60px)'}}>
              <div className="relative rounded-[24px] overflow-hidden border border-white/10 bg-black/40 backdrop-blur p-2 shadow-2xl">
                <div className="rounded-[16px] overflow-hidden bg-[#0A1628] relative">
                  <img src="https://images.unsplash.com/photo-1635805737707-575885ab0820?w=600&q=80&auto=format&fit=crop" alt="spidey" className="w-full h-[260px] object-cover opacity-90"/>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#E30613]/50 via-transparent to-[#8B5CF6]/20" />
                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-[#E30613] text-white text-xs font-black">3D • PHONK AURA</div>
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 border border-white/15 text-white text-xs font-mono backdrop-blur">Brand New Day • 2026</div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[{k:'EDITS',v:`${VIDEOS.length}`,c:'text-[#8B5CF6]'},{k:'VIEWS',v:'18M+',c:'text-[#FFD23F]'},{k:'MODE',v:'3D',c:'text-emerald-400'}].map(s=>(
                    <div key={s.k} className="rounded-xl bg-white/5 border border-white/10 p-2 text-center">
                      <div className={`font-display text-lg leading-none ${s.c}`}>{s.v}</div>
                      <div className="text-[9px] tracking-widest font-bold text-white/50">{s.k}</div>
                    </div>
                  ))}
                </div>
              </div>
              <motion.div animate={{y:[ -6, 6, -6]}} transition={{duration:4, repeat:Infinity}} className="absolute -top-3 -right-3 px-4 py-2 rounded-2xl bg-gradient-to-r from-[#FFD23F] to-[#FF8A00] text-[#0A1628] text-xs font-black shadow-xl rotate-2">PHONK VIBE</motion.div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.55fr_0.85fr] gap-6">
        <div className="space-y-4">
          <div className="rounded-[24px] overflow-hidden comic-border bg-black border border-white/10 shadow-2xl">
            <div className="h-10 bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#E30613] flex items-center justify-between px-4">
              <div className="flex items-center gap-2 text-white text-xs font-black tracking-widest"><Video size={14}/> NOW PLAYING — {active.tag} • {active.views}</div>
              <div className="flex items-center gap-1.5">
                <button onClick={()=>setMuted(!muted)} className="w-8 h-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center hover:bg-white/20">{muted ? <VolumeX size={14} className="text-white"/> : <Volume2 size={14} className="text-white"/>}</button>
                <button onClick={()=> videoRef.current?.requestFullscreen()} className="w-8 h-8 rounded-full bg-white text-[#0A1628] flex items-center justify-center"><Maximize2 size={14}/></button>
              </div>
            </div>
            <div className="relative aspect-video bg-black overflow-hidden">
              <video
                ref={videoRef}
                key={active.id}
                src={DEMO_VIDEO}
                poster="/logo-bhnstock.png"
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                muted={muted}
                loop
                playsInline
                controls
              />
              <div className="pointer-events-none absolute inset-0 border-[3px] border-[#8B5CF6]/15" />
            </div>
            <div className="p-4 bg-gradient-to-br from-[#0F2340] to-[#0A1628] border-t border-white/10">
              <h2 className="text-[18px] font-black leading-tight line-clamp-2">{active.title}</h2>
              <div className="text-sm text-white/60 mt-1 flex flex-wrap items-center gap-2">
                <span className="font-bold text-white/80">{active.channel}</span>
                <span>•</span><span className="flex items-center gap-1"><Eye size={12}/>{active.views}</span>
                <span>•</span><span className="flex items-center gap-1"><Heart size={12} className="text-[#E30613]"/>{active.likes}</span>
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black bg-gradient-to-r ${active.color} text-white`}>{active.tag}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={()=>{
                  const idx = VIDEOS.findIndex(v=>v.id===active.id)
                  setActive(VIDEOS[(idx+1)%VIDEOS.length])
                }} className="flex-1 py-2.5 rounded-full bg-[#E30613] text-white text-sm font-black flex items-center justify-center gap-2"><Play size={16} fill="white"/> PLAY NEXT <SkipForward size={14}/></button>
                <button onClick={()=>{
                  const idx = VIDEOS.findIndex(v=>v.id===active.id)
                  setActive(VIDEOS[(idx+1)%VIDEOS.length])
                }} className="px-4 py-2.5 rounded-full bg-white/10 border border-white/15 text-sm font-bold">NEXT →</button>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] glass-spidey comic-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[14px] tracking-wide flex items-center gap-2"><Layers size={14} className="text-[#8B5CF6]"/> GALLERY — HOVER TO PREVIEW</h3>
              <span className="text-[11px] font-mono px-2 py-1 rounded-full bg-white/5 border border-white/10">{filtered.length} edits</span>
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              {filtered.map(v=>(
                <button key={v.id} onClick={()=>setActive(v)} className={`group text-left rounded-2xl overflow-hidden border-2 transition-all ${active.id===v.id?'border-[#8B5CF6] scale-[1.02] shadow-xl shadow-[#8B5CF6]/20':'border-white/10 hover:border-white/20'} bg-[#0A1628]`}>
                  <div className="relative aspect-video overflow-hidden">
                    <img src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`} alt={v.title} className="w-full h-full object-cover group-hover:scale-110 transition duration-500"/>
                    <div className={`absolute inset-0 bg-gradient-to-t ${v.color} opacity-20`} />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><span className="w-10 h-10 rounded-full bg-white/90 text-[#0A1628] flex items-center justify-center"><Play size={16} fill="#0A1628"/></span></div>
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono">{v.duration}</span>
                    <span className={`absolute top-1 left-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r ${v.color} text-white`}>{v.tag}</span>
                  </div>
                  <div className="p-2.5">
                    <div className="text-xs font-bold leading-tight line-clamp-2 group-hover:text-[#8B5CF6] transition">{v.title}</div>
                    <div className="text-[11px] font-mono text-white/40 mt-1">{v.views} • {v.channel.split('•')[0]}</div>
                  </div>
                </button>
              ))}
            </div>
            {filtered.length===0 && <div className="text-center py-8 text-white/40">No edits for "{query}"</div>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] comic-border bg-gradient-to-br from-[#1A0A2E] to-[#0F2340] p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[16px] flex items-center gap-2"><Flame size={16} className="text-[#E30613]"/> UP NEXT</h3>
              <button onClick={()=>setActive(VIDEOS[Math.floor(Math.random()*VIDEOS.length)])} className="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-bold flex items-center gap-1"><Shuffle size={12}/> SHUFFLE</button>
            </div>
            <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
              {VIDEOS.map(v=>(
                <button key={v.id} onClick={()=>setActive(v)} className={`w-full flex gap-3 p-2 rounded-2xl border text-left transition ${active.id===v.id?'bg-white text-[#0A1628] border-white shadow-lg':'bg-white/[0.04] border-white/10 hover:bg-white/[0.07] text-white'}`}>
                  <div className="relative w-[92px] h-[52px] rounded-xl overflow-hidden shrink-0 bg-black">
                    <img src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`} className="w-full h-full object-cover" alt=""/>
                    <div className="absolute inset-0 flex items-center justify-center"><span className={`w-7 h-7 rounded-full flex items-center justify-center ${active.id===v.id?'bg-[#E30613] text-white':'bg-white/90 text-[#0A1628]'}`}><Play size={12} fill="currentColor"/></span></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold leading-tight line-clamp-2">{v.title}</div>
                    <div className={`text-[11px] font-mono mt-1 ${active.id===v.id?'text-black/50':'text-white/40'}`}>{v.tag} • {v.views}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] overflow-hidden comic-border bg-black border border-white/10">
            <div className="bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#FF8A00] p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-black text-xs tracking-widest"><Music2 size={14}/> PHONK MIX</div>
              <span className="text-white text-xs font-bold px-2 py-1 rounded-full bg-white/15">{phonkPlaying?'PLAYING':'PAUSED'}</span>
            </div>
            <div className="p-3 bg-[#0A1628] space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-[#8B5CF6]/20 to-[#EC4899]/20 border border-[#8B5CF6]/30">
                <button onClick={togglePhonk} className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${phonkPlaying?'bg-[#8B5CF6] text-white':'bg-white text-[#0A1628]'}`}>{phonkPlaying? <Volume2 size={16}/> : <Play size={16} fill="currentColor"/>}</button>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black">{phonkPlaying?'PHONK PLAYING':'TAP TO PLAY PHONK'}</div>
                  <div className="text-[11px] font-mono text-white/50">Loop • {muted?'muted':'unmuted'}</div>
                </div>
                <button onClick={()=>setMuted(!muted)} className="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-bold flex items-center gap-1">{muted?<VolumeX size={12}/>:<Volume2 size={12}/>} {muted?'UNMUTE':'MUTE'}</button>
              </div>
              {PHONK_PLAYLIST.map((p,i)=>(
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.04] border border-white/10">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center shrink-0"><Music2 size={14} className="text-white"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{p.title}</div>
                    <div className="text-[11px] font-mono text-white/40">{p.dur} • Brazilian Phonk</div>
                  </div>
                  <button onClick={togglePhonk} className={`px-3 py-1.5 rounded-full text-xs font-black ${phonkPlaying?'bg-[#8B5CF6] text-white':'bg-white text-[#0A1628]'}`}>{phonkPlaying?'PAUSE':'PLAY'}</button>
                </div>
              ))}
              <div className="text-[11px] font-mono text-white/30 text-center pt-1">Docs has full details — this page is clean.</div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0F2340] border border-white/10 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center shrink-0"><Sparkles size={16} className="text-white"/></div>
            <div className="text-xs leading-relaxed text-white/70"><b className="text-white">Tip:</b> Hover gallery for preview. All details moved to <a href="/docs" className="text-[#8B5CF6] underline">Docs</a>.</div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 rounded-full bg-gradient-to-r from-[#0A1628] via-[#1A0A2E] to-[#0A1628] border border-white/10 shadow-2xl p-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center animate-pulse shrink-0"><Zap size={16} className="text-white"/></div>
        <div className="flex-1 min-w-0 hidden sm:block">
          <div className="text-xs font-black truncate">NOW PLAYING — {active.title}</div>
          <div className="text-[11px] font-mono text-white/50">{active.tag} • Auto-shuffle {autoPhonk?'ON':'OFF'}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={()=>{
            const idx = VIDEOS.findIndex(v=>v.id===active.id)
            setActive(VIDEOS[(idx-1+VIDEOS.length)%VIDEOS.length])
          }} className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center"><SkipForward size={14} className="rotate-180"/></button>
          <button onClick={()=>{
            const idx = VIDEOS.findIndex(v=>v.id===active.id)
            setActive(VIDEOS[(idx+1)%VIDEOS.length])
          }} className="w-10 h-10 rounded-full bg-white text-[#0A1628] flex items-center justify-center"><Play size={16} fill="#0A1628"/></button>
          <button onClick={()=>setAutoPhonk(!autoPhonk)} className={`w-9 h-9 rounded-full border flex items-center justify-center ${autoPhonk?'bg-[#8B5CF6] border-[#8B5CF6] text-white':'bg-white/10 border-white/15 text-white'}`}><Repeat size={14}/></button>
          <button onClick={()=>setMuted(!muted)} className="hidden sm:flex w-9 h-9 rounded-full bg-white/10 border border-white/15 items-center justify-center">{muted?<VolumeX size={14}/>:<Volume2 size={14}/>}</button>
        </div>
      </div>
    </div>
  )
}
