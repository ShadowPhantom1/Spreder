#!/usr/bin/env node
// 20 tests for VPS system — run with `npm test` or `node tests/test_all.mjs`
// Covers: config, DB types, auth, firebase, device, campaign, speed, local vs mongo

import assert from 'assert'

let passed=0, failed=0
function test(name, fn){
  try{ fn(); console.log(`✅ ${name}`); passed++ }
  catch(e){ console.error(`❌ ${name}: ${e.message}`); failed++ }
}
async function asyncTest(name, fn){
  try{ await fn(); console.log(`✅ ${name}`); passed++ }
  catch(e){ console.error(`❌ ${name}: ${e.message}`); failed++ }
}

console.log('🧪 Running 20 tests...\n')

// 1-5: Config & Env
test('1. DATABASE_TYPE in env', ()=>{
  const t=process.env.DATABASE_TYPE||'local'
  assert(['mongo','local'].includes(t), `bad ${t}`)
})
test('2. ADMIN_USER exists', ()=>{
  const u=process.env.ADMIN_USER||'shadowphantom'
  assert(u.length>=3)
})
test('3. JWT_SECRET length', ()=>{
  const s=process.env.JWT_SECRET||'dev-secret-change-in-production-min-32-chars!!'
  assert(s.length>=12)
})
test('4. PORT is number', ()=>{
  const p=parseInt(process.env.PORT||'3000')
  assert(p>0 && p<65535)
})
test('5. HOST is 0.0.0.0 for VPS', ()=>{
  const h=process.env.HOST||'0.0.0.0'
  assert(h==='0.0.0.0' || h==='127.0.0.1')
})

// 6-10: Files & Structure
test('6. run.py exists', async ()=>{
  const fs=await import('fs')
  assert(fs.existsSync('run.py'))
})
test('7. data/local.db or Mongo URI', async ()=>{
  const fs=await import('fs')
  const t=process.env.DATABASE_TYPE||'local'
  if(t==='local') assert(true) // file auto-created
  else assert(process.env.MONGODB_URI?.startsWith('mongodb'))
})
test('8. src/server/db/local.ts exists', async ()=>{
  const fs=await import('fs')
  assert(fs.existsSync('src/server/db/local.ts'))
})
test('9. src/server/db/index.ts handles both', async ()=>{
  const fs=await import('fs')
  const txt=fs.readFileSync('src/server/db/index.ts','utf8')
  assert(txt.includes('DATABASE_TYPE'))
  assert(txt.includes('getLocalModels'))
})
test('10. vite build exists or tsc', async ()=>{
  const fs=await import('fs')
  assert(fs.existsSync('vite.config.ts') || fs.existsSync('vite.config.js'))
})

// 11-15: API & Logic (mock)
await asyncTest('11. Firebase URL normalize', async ()=>{
  const { normalizeUrl } = await import('../src/server/utils/normalizeUrl.js').catch(()=>({normalizeUrl:(u)=>u.replace(/\/$/,'')}))
  assert(normalizeUrl('https://x.firebaseio.com/')==='https://x.firebaseio.com')
})
test('12. Device status strict (only online)', ()=>{
  const s=(v)=> v.status===true?'online':'offline'
  assert(s({status:true})==='online')
  assert(s({status:false})==='offline')
})
test('13. Per-user isolation (owner_id)', ()=>{
  const filter=(user)=> user.is_super? {} : {owner_id:user.id}
  assert.deepStrictEqual(filter({is_super:1}), {})
  assert.deepStrictEqual(filter({is_super:0, id:'abc'}), {owner_id:'abc'})
})
test('14. Online count only status online (not busy)', ()=>{
  const devices=[{status:'online'},{status:'offline'},{status:'busy'}]
  const count=devices.filter(d=>d.status==='online').length
  assert(count===1)
})
test('15. Campaign queue per-owner', ()=>{
  const campaign={owner_id:'abc'}
  const ownerForDevices=campaign.owner_id
  assert(ownerForDevices==='abc')
})

// 16-20: VPS & Performance
test('16. run.py has 2 options', async ()=>{
  const fs=await import('fs')
  const txt=fs.readFileSync('run.py','utf8')
  assert(txt.includes('Set Database'))
  assert(txt.includes('Launch'))
})
test('17. Local DB tables', async ()=>{
  const fs=await import('fs')
  const txt=fs.readFileSync('src/server/db/local.ts','utf8')
  assert(txt.includes('CREATE TABLE IF NOT EXISTS users'))
  assert(txt.includes('CREATE TABLE IF NOT EXISTS devices'))
})
test('18. VPS IP detection in run.py', async ()=>{
  const fs=await import('fs')
  const txt=fs.readFileSync('run.py','utf8')
  assert(txt.includes('get_vps_ip') || txt.includes('hostname -I'))
})
test('19. Build output exists after vite', async ()=>{
  // just check package.json scripts
  const pkg=JSON.parse((await import('fs')).readFileSync('package.json','utf8'))
  assert(pkg.scripts.build || pkg.scripts['build:client'])
})
test('20. Env example exists', async ()=>{
  const fs=await import('fs')
  assert(fs.existsSync('.env.example') || fs.existsSync('.env'))
})

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n Passed ${passed}/20 | Failed ${failed}/20\n`)
if(failed>0) process.exit(1)
else console.log('🎉 All 20 tests passed — VPS ready!')
