import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: any[]) { return twMerge(clsx(inputs)) }
export const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n)
export const timeAgo = (iso: string | null | undefined) => { if(!iso) return '—';
  const d = Date.now() - new Date(iso).getTime()
  const s = Math.floor(d/1000)
  if (s<60) return `${s}s ago`
  const m = Math.floor(s/60); if (m<60) return `${m}m ago`
  const h = Math.floor(m/60); if (h<24) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}
