import { Link } from 'react-router-dom'
export default function Admin(){
  return (
    <div className="min-h-screen bg-[#F0F7FF] flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-[24px] bg-white p-8 shadow-xl border border-[#EAF4FF] text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0066CC] to-[#1E40AF] grid place-items-center mx-auto text-white font-black">!</div>
        <h1 className="font-black text-xl mt-4">Admin Panel — Rebuilding</h1>
        <p className="text-sm text-zinc-600 mt-2">Purana admin delete kar diya. Naya <b>/adminbhnstock</b> multi-page premium console is plan se ban raha hai. Thodi der me live hoga.</p>
        <p className="text-xs text-zinc-400 mt-2">Plan: ADMIN_PLAN.md</p>
        <Link to="/dashboard" className="mt-6 inline-flex px-5 py-2.5 rounded-xl bg-[#0066CC] text-white font-black">← Back to App</Link>
      </div>
    </div>
  )
}
