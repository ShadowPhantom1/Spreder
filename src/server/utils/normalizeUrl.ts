export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u.trim())
    let host = url.host.toLowerCase()
    let path = url.pathname.replace(/\/+$/, '').replace(/\.json$/i,'')
    path = path.replace(/\/(devices|queue|clients|hives).*$/i,'')
    if(path==='/') path=''
    return `${url.protocol}//${host}${path}`.toLowerCase()
  } catch { return u.trim().toLowerCase().replace(/\/+$/,'').replace(/\.json$/i,'') }
}
