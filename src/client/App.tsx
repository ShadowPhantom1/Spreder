import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import Devices from './pages/Devices'
import Firebases from './pages/Firebases'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Docs from './pages/Docs'
import Login from './pages/Login'
import Landing from './pages/Landing'
import SuperLogin from './pages/SuperLogin'

// OPEN_MODE syncs with server DISABLE_AUTH — true for preview, false for prod (secure by default)
const OPEN_MODE = (import.meta as any).env?.VITE_OPEN_MODE === 'true'

function Guard({ children }: { children: React.ReactNode }){
  if (OPEN_MODE) return <>{children}</>
  const t = (()=>{ try{ return localStorage.getItem('token') }catch{ return null } })()
  if(!t) return <Navigate to="/login" replace />
  return <>{children}</>
}
function SuperGuard({ children }: { children: React.ReactNode }){
  if (OPEN_MODE) return <>{children}</>
  const t = (()=>{ try{ return localStorage.getItem('token') }catch{ return null } })()
  if(!t) return <Navigate to="/super" replace />
  return <>{children}</>
}

export default function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing/>} />
        <Route path="/login" element={<Login/>} />
        <Route path="/super" element={<SuperLogin/>} />
        <Route path="/dashboard" element={<Guard><Layout><Dashboard/></Layout></Guard>} />
        <Route path="/campaigns" element={<Guard><Layout><Campaigns/></Layout></Guard>} />
        <Route path="/devices" element={<Guard><Layout><Devices/></Layout></Guard>} />
        <Route path="/firebases" element={<Guard><Layout><Firebases/></Layout></Guard>} />
        <Route path="/settings" element={<Guard><Layout><Settings/></Layout></Guard>} />
        <Route path="/admin" element={<SuperGuard><Layout><Admin/></Layout></SuperGuard>} />
        <Route path="/docs" element={<Guard><Layout><Docs/></Layout></Guard>} />
        <Route path="*" element={<Navigate to="/" replace/>} />
      </Routes>
    </BrowserRouter>
  )
}
