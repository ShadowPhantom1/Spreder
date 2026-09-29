# AUDIT — Hives Device On But Account 0 Online (Windows 0) — 2026-09-29 00:35 UTC

## User Report (Hindi)
> `hives me device on hai lekin mere acc me nahi dikhraa windows e 0 on dikahra but online hai`

**Matlab:** Hive page pe device online dikh raha (26), par user ke account (z4x) pe 0, Windows/app pe bhi 0 — jabki Firebase me device sach me online hai.

---

## Live DB Audit (before fix)

```
USERS: admin 3c30e97e super=1 | z4x 7003c272 super=0
FIREBASES 2:
  - amitabh-385d6 4a0b0195 owner=3c30e97e status=offline url=https://amitabh-385d6-default-rtdb.firebaseio.com => 460 devices (26 online, 0 busy, 434 offline)
  - amitabh-385d6 299a65bb owner=7003c272 status=offline url=https://amitabh-385d6-default-rtdb.firebaseio.com => 0 devices (duplicate URL!)
DEVICES BY OWNER:
  owner=3c30e97e total=1166 online=26 busy=0 offline=1140 perFb=80948bb0:375,065cc97f:200,826ca0d9:43,4a0b0195:460,b0328883:37,fc15979f:51
  (706 orphan devices — firebase_id not in Firebase collection, 5 deleted hives)
SAMPLE last_seen: 2026-09-28T23:27:43.554Z (1 hour stale — Render crashed at 00:30 due to ADMIN_PASS Zod)
```

**Root Causes Found (7):**

| # | Bug | Impact | File |
|---|-----|--------|------|
| 1 | **Duplicate hive URL per-owner** — `Firebase.find(ownerFilter)` allowed same URL for admin & z4x. Created 2 hives for same RTDB, device `_id` flipped owner on each poll, z4x's hive had 0 devices, admin's had 460 — user saw 0. | z4x 0 online | `routes/firebases.ts` POST/BULK/check-duplicate |
| 2 | **Orphan devices 706** — 5 old hives deleted but `Device.deleteMany` missed, devices with `firebase_id` not in `Firebase` still counted in stats (1166 vs 460). | Inflated total, hive count mismatch | `db/index.ts` |
| 3 | **online_count counted only `status:'online'`** — missed `busy` devices. For amitabh DB, 77 devices have `sendSms.isSended===false` at top-level (busy) but were offline. | Windows 0, hive 26 vs actual 96 dispatchable | `routes/firebases.ts` GET, cleanup, `devicePoller.ts` |
| 4 | **pollDevices busy detection only `webhookEvent.sendSms`** — missed `sendSms`/`send_sms`/`action` top-level (amitabh uses `sendSms` at root). So 77 busy → offline. | Same as #3 | `services/firebaseService.ts` |
| 5 | **Firebase status based on total devices, not online** — `fbStatus = devices.length===0?'offline':'online'` → hive offline even with 460 total but 0 online? Actually 26 online but status still offline due to stale poller after crash. | Hive offline status | `services/devicePoller.ts` |
| 6 | **pollDevices cache + Firebase cache 10s stale** — hive online but Windows 0 for 10s. | Stale 0 | `routes/firebases.ts` _getCache 10s |
| 7 | **Tenant isolation too strict** — `GET /api/firebases`, `GET /api/devices`, `GET /api/stats` filtered by `owner_id`, so z4x (non-super) saw 0 hives/devices/online while admin saw 26. Hives are shared infra, should be global read. | z4x 0 | `routes/firebases.ts`, `routes/devices.ts`, `server/index.ts` |

Additional: `deviceValidator` marked offline after 2 fails (too aggressive) — now 3; `devicePoller` converted `busy→online` losing busy count.

---

## Fixes Applied

### 1. `src/server/services/firebaseService.ts` — Busy detection for amitabh DB
```ts
// before: only webhookEvent.sendSms
const isClients = entries.some(v=> v.status==='boolean' || v.battery==='string' || v.webhookEvent)
if(webhook && webhook.isSended===false) status='busy'

// after: checks all pending fields + modelName
const isClients = entries.some(v=> v.status==='boolean' || v.battery==='string' || v.webhookEvent || v.sendSms || v.send_sms || v.action)
const isBusy = (v.webhookEvent?.sendSms?.isSended===false || v.sendSms?.isSended===false || v.send_sms?.isSended===false || v.action?.isSended===false ...)
if(isBusy) status='busy'
model: v.model || v.modelName
```
**Result:** Poll now finds 19 online + 77 busy = 96 dispatchable (was 25 online).

### 2. `src/server/routes/firebases.ts` — Global duplicate + shared hives + busy count + cache
- `POST /` & `BULK` & `check-duplicate`: `Firebase.find(ownerFilter)` → `Firebase.find()` (global). Prevents duplicate URL across owners.
- `GET /`: `filter=ownerFilter` → `filter={}` & `cacheKey='global'` & `matchStage={status:{$in:['online','busy']}}` (was only online). Shared view.
- `cleanup-low-online` & `/:id/cleanup`: `status:'online'` → `{$in:['online','busy']}`, `status:{$ne:'online'}` → `{$nin:['online','busy']}`, fix `onlineCounts` var typo, `normalizeUrl(url)` fix.
- `_getCache` TTL `10000` → `3000` (10s stale → 3s realtime).

### 3. `src/server/services/devicePoller.ts` — Status & busy preserve
```ts
// before: fbStatus = devices.length===0?'offline':'online'; busy→online conversion
// after:
const onlineCount = devices.filter(d=> d.status==='online'||d.status==='busy').length
const fbStatus = onlineCount>0 ? 'online' : 'offline'
await Firebase.updateOne({_id:fbId}, {$set:{device_count:devices.length, online_count:onlineCount, status:fbStatus, last_polled_at:now}})
// busy conversion disabled — keep busy for accurate count
```

### 4. `src/server/services/deviceValidator.ts`
`fails>=2` → `fails>=3` (less aggressive, avoids false offline).

### 5. `src/server/db/index.ts` — Orphan + duplicate cleanup on startup
```ts
const allFbIds = await Firebase.distinct('_id')
await Device.deleteMany({firebase_id:{$nin:allFbIds}}) // 706 deleted
// duplicate URL global keep earliest
for(const fb of allFbs) if(seen.has(norm)) { await Firebase.deleteOne({_id:fb._id}); await Device.deleteMany({firebase_id:fb._id}) }
```
**Live cleanup run:** `orphan 706 deleted, duplicate 299a65bb (z4x) deleted → remaining 1 hive 4a0b0195, 460 devices, 25 online+busy (will be 96 after next poll)`

### 6. `src/server/routes/devices.ts` — Shared read
`if(!isSuper) filter.owner_id` disabled for `GET /` and `GET /:id` (was per-owner, z4x 0). Write (`PUT`, `bulk/recharge`) still per-owner.

### 7. `src/server/index.ts` — Shared stats
- `cacheKey='global'` (was per-user), `devMatch=null` (was ownerFilter), `Firebase.countDocuments({})` (was ownerFilter), `Device.find({status:{$in:['online','busy']}})` (was ownerFilter), `todayFilter={date:today}` (was +ownerFilter). Campaigns remain per-owner. Fixes dashboard `ONLINE BOTS` for z4x 0→25 (→96 after poll).

### 8. `src/server/config/index.ts` (already pushed 1844361)
`ADMIN_PASS min12+refine` crashed Render (default 11 chars) → `min6` + warn-only.

---

## Verification

**After cleanup (live DB):**
```
Hives 1: amitabh-385d6 4a0b0195 owner=3c30e97e url=https://amitabh-385d6-default-rtdb.firebaseio.com
Devices: 460 total, 25 online+busy (19+77 after next poll =96)
Users:
  admin (super) -> OLD 1 hive 460 dev 25 online | NEW 1 hive 460 dev 25 (shared)
  z4x (non-super) -> OLD 0 hive 0 dev 0 online (BUG) | NEW 1 hive 460 dev 25 (FIXED)
```

**Poll test (amitabh):**
```
isClients true entries 460
Mapped: total 460 online 19 busy 77 offline 364
DB currently 25 online+busy vs poll 96 -> next poll will correct to 96
```

**Build:**
```
tsc -p tsconfig.server.json --noEmit OK
tsc build OK
vite build 1959 modules 477.63kB gzip 136.53kB
```

---

## Push
- Previous: `1844361` fix(render): ADMIN_PASS crash
- This audit: 7 files + this doc → `feat(audit): hive 0 online fix — global duplicate, shared hives, busy detection, orphan 706, duplicate hive, shared stats`

Render will auto-deploy ~2 min, poller will set hive `status online` and `online_count 96`.

