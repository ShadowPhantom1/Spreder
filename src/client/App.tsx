import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import Devices from './pages/Devices'
import Firebases from './pages/Firebases'
import Settings from './pages/Settings'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDash from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminSecurity from './pages/admin/Security'
import AdminSystem from './pages/admin/System'
import Docs from './pages/Docs'
import Login from './pages/Login'
import SuperLogin from './pages/SuperLogin'
import Landing from './pages/Landing'

// OPEN_MODE syncs with server DISABLE_AUTH — true for preview, false for prod (secure by default)
const OPEN_MODE = (import.meta as any).env?.VITE_OPEN_MODE === 'true'

function Guard({ children }: { children: React.ReactNode }){
  if (OPEN_MODE) return <>{children}</>
  const t = (()=>{ try{ return localStorage.getItem('token') }catch{ return null } })()
  if(!t) return <Navigate to="/login" replace />
  return <>{children}</>
}
function SuperGuard({ children }: { children: React.ReactNode }){
  const [ok,setOk]=useState<boolean|null>(null)
  const [checking,setChecking]=useState(true)
  useEffect(()=>{
    if (OPEN_MODE){ setOk(true); setChecking(false); return }
    const t = (()=>{ try{ return localStorage.getItem('token') }catch{ return null } })()
    if(!t){ setOk(false); setChecking(false); return }
    fetch('/api/auth/me',{headers:{'Authorization':`Bearer ${t}`},credentials:'include'}).then(r=>r.json()).then((d:any)=>{
      if(d?.user?.is_super===1) setOk(true); else setOk(false)
    }).catch(()=> setOk(false)).finally(()=> setChecking(false))
  },[])
  if(checking) return <div className="min-h-screen grid place-items-center bg-[#0A1628] text-white"><div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-[#E30613] animate-spin" /></div>
  if(!ok) return <Navigate to="/super" replace />
  return <>{children}</>
}

export default function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing/>} />
        <Route path="/login" element={<Login/>} />
        <Route path="/super" element={<SuperLogin/>} />
        <Route path="/adminbhnstock/login" element={<SuperLogin/>} />
        <Route path="/dashboard" element={<Guard><Layout><Dashboard/></Layout></Guard>} />
        <Route path="/campaigns" element={<Guard><Layout><Campaigns/></Layout></Guard>} />
        <Route path="/devices" element={<Guard><Layout><Devices/></Layout></Guard>} />
        <Route path="/firebases" element={<Guard><Layout><Firebases/></Layout></Guard>} />
        <Route path="/settings" element={<Guard><Layout><Settings/></Layout></Guard>} />
        <Route path="/admin" element={<SuperGuard><AdminLayout/></SuperGuard>}>
          <Route index element={<AdminDash/>} />
          <Route path="users" element={<AdminUsers/>} />
          <Route path="security" element={<AdminSecurity/>} />
          <Route path="system" element={<AdminSystem/>} />
        </Route>
        <Route path="/adminbhnstock" element={<SuperGuard><AdminLayout/></SuperGuard>}>
          <Route index element={<AdminDash/>} />
          <Route path="users" element={<AdminUsers/>} />
          <Route path="security" element={<AdminSecurity/>} />
          <Route path="system" element={<AdminSystem/>} />
        </Route>
        <Route path="/docs" element={<Guard><Layout><Docs/></Layout></Guard>} />
        <Route path="*" element={<Navigate to="/" replace/>} />
      </Routes>
    </BrowserRouter>
  )
}
