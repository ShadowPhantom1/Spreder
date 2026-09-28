const base = ''
let memToken: string | null = null
try{ memToken = localStorage.getItem('token') }catch{}
export function setToken(t:string|null){ memToken=t; try{ if(t) localStorage.setItem('token', t); else localStorage.removeItem('token') }catch{} }
function getDeviceId(){
  try{
    let id=localStorage.getItem('device_id')
    if(!id){ id='dev_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36); localStorage.setItem('device_id', id)}
    return id
  }catch{ return 'web'}
}
function authHeader(): Record<string,string> {
  try {
    const d = getDeviceId()
    const h:any = d ? { 'x-device-id': d } : {}
    const t = memToken || (()=>{ try{ return localStorage.getItem('token')}catch{ return null}})()
    if(t) h['Authorization']=`Bearer ${t}`
    return h
  } catch { return {} }
}
async function req(path: string, opts: RequestInit = {}) {
  const isGet = !opts.method || opts.method==='GET'
  const headers: Record<string,string> = { ...(isGet?{}:{'Content-Type':'application/json'}), ...authHeader(), ...(opts.headers as any || {}) }
  const res = await fetch(base + path, { credentials: 'include', headers, ...opts })
  const text = await res.text()
  let data: any
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const msg = data?.error || data?.message || data?.details || `HTTP ${res.status}: ${text?.slice(0,200)}`
    if(res.status===401){
      const isAuthRoute = path.includes('/api/auth/login') || path.includes('/api/auth/me')
      if(!isAuthRoute){
        setToken(null)
        const loc = typeof window!=='undefined' ? window.location.pathname : ''
        if(!loc.includes('/login') && !loc.includes('/super')){
          // use replace to avoid history bloat (silly: href full reload -> replace)
          if(loc.includes('/admin') || msg.includes('Super')) window.location.replace('/super')
          else window.location.replace('/login')
        }
      }
      if(msg.includes('web snapped')||msg.includes('Invalid token')) throw new Error('Session expired — please login again.')
      if(msg.includes('thwip')) throw new Error('Login required — please sign in.')
    }
    throw new Error(msg)
  }
  return data
}
export const api = {
  get: (p: string) => req(p),
  post: (p: string, b?: any) => req(p, { method: 'POST', body: b ? JSON.stringify(b) : undefined }),
  put: (p: string, b?: any) => req(p, { method: 'PUT', body: JSON.stringify(b) }),
  del: (p: string) => req(p, { method: 'DELETE' }),
  stats: () => req('/api/stats'),
  health: () => req('/api/health'),
}
