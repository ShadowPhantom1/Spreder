# BHNSTOCK — HARD ERROR MAP (1 file = 1 error audit)

> **User report:** TODAY SENT 2,901 • ONLINE BOTS 128/443 • ACTIVE WEBS 0 — “web e kam show kara” — pure web me error hai.  
> **Method:** har file ek-ek padhke (Dashboard, Devices, Settings, Campaigns, Firebases, Login, Docs, SpideyEdits, App, Layout, api, db, devicePoller, firebaseService, queueService, server/index, routes).

---

## 1. `src/client/pages/Dashboard.tsx` — **P0 CRITICAL**

| Line | Code | Error | Impact |
|------|------|-------|--------|
| 18-22 | `api.stats(), api.get('/api/firebases'), api.get('/api/campaigns'), api.get('/api/devices'), api.get('/api/stats/today')` — 5 calls in parallel, `devices` fetch slices `.slice(0,8)` | `devices` endpoint returns **200 max** (we saw `api devices 200` vs DB 443) — Dashboard shows **128 ONLINE** but total 443, so slice loses 243 devices. `stats` vs `today` double source: `todayTotal = today?.totalToday ?? stats?.today?.totalToday` — if `/api/stats/today` fails, falls back to `stats.today.totalToday` which is same query but **different `todayStart` timezone** (server uses UTC `setHours(0,0,0,0)` on server TZ, client is IST). At 00:00 IST = 18:30 UTC previous day → `TODAY SENT` kam dikhega. |
| 38-42 | `const todayTotal = today?.totalToday ?? stats?.today?.totalToday ?? 0` | **Double counting / race** — `load()` fires 3 calls, `today` may be null for 1-2 sec → shows `0` then `2901` → user sees “kam show”. Should use single source. |
| 44-48 | `msgPerSec = (batch * 1000 / (delay * (mulMap[speed]||1))).toFixed(1)` | **Division by zero** when `delay=0` (ultra preset). `50*1000/(0*0.08)=Infinity` → Dashboard shows `Infinity` or `NaN`, Layout has guard `d? ...:'—'` but Dashboard **has no guard**. With current ultra `delay 0`, user sees broken number. |
| 49-54 | `capacity = stats?.devices?.capacity \|\| stats?.today?.capacity` | Server `/api/stats` calculates `totalCapacity` **only from `status='online'`**, but `queueService.getOnlineDevices()` now uses `status IN ('online','busy')` (we patched). So **Dashboard capacity < real queue capacity** → “kam show”. |
| 58-60 | `today?.byDevice.slice(0,12)` | `byDevice` comes from `/api/stats/today` which does `LEFT JOIN devices` — if device deleted (we deleted demo), `d.name` null → shows `undefined` or `8-char id` → confusing. |

**Fix:** guard `delay===0 ? '—' : ...`, unify `todayStart` to IST (or use server `since`), make capacity count `online+busy`.

---

## 2. `src/client/pages/Devices.tsx` — **P1**

| Line | Error |
|------|-------|
| 13 | `api.get('/api/devices?status=online')` — only fetches online, but `stats.devices.total` is 443, `pool = devices.filter(has_recharge!==0)` — if server returns only 200 (limit), pool count **kam** (we saw `api devices 200` vs DB 443). Pagination limit 200 hides 243 devices. |
| 24-28 | `total = stats?.devices?.total` vs `pool.length` — `stats` uses full DB, `devices` array is capped 200 → mismatch “128 online but pool 87”. |
| 78 | `rechargeOnline = stats?.devices?.rechargeOnline ?? online` — server `rechargeOnline` counts `has_recharge=1 AND status='online'` only, but client pool filters `has_recharge!==0` (allows `null`). Inconsistent when `check_recharge=false` (we set) → pool shows 128 but server says 100. |

**Fix:** remove `?status=online` limit, or raise to `?limit=1000`, or make Devices fetch `/api/stats` only for counts.

---

## 3. `src/client/pages/Campaigns.tsx` — **P0**

| Line | Error |
|------|-------|
| 64 | `placeholder 7618211042` — **personal number leaked** on web (we fixed to 9876543210, but DB still had free-page). Also `contactsText` default `7618211042,MH14KU9864` leaks. |
| 135 | `POST /api/campaigns` with `contacts` dedupes by `phone.replace(/\s/g,'')` — same number with `+91` vs without considered different, but **same person gets duplicate SMS** if CSV has both formats. No normalization to `+91`. |
| 141 | `localStorage.getItem('token')` fallback — if token expires, `Authorization` header sent with stale token, server returns 401 but client throws `HTTP 401: ...` not “Session expired”. |
| 195 | `exportCampaign` blob handling — checks `ct.includes('json')` but server sends `text/csv` with charset, so `blob.size===0` edge not handled when campaign has 0 messages (we saw `total messages 0` after crash). |
| 286 | `contactsText` default still hardcodes `9876543210` (fixed) but `batch` default 50, `delay` 0 — mismatch with server defaults `50/0` now ok. |

---

## 4. `src/client/pages/Firebases.tsx` — **P1**

| Line | Error |
|------|-------|
| 19 | `bulk` placeholder still shows `https://chilgunisr...` 77 demo URLs — not hard fail but confuses. Bulk import `normalizeUrl` now strips `.json`, but UI still shows old URL with `.json` for `chut2` → user thought hardcode. |
| 34-38 | `dupInfo` check uses `check-duplicate?url=` — but `normalizeUrl` in server strips `/devices` etc., so duplicate detection may miss `https://x.firebaseio.com/devices.json` vs `https://x.firebaseio.com`. |
| 56 | `load()` interval 4000ms, but `devicePoller` is 500ms — Firebase `device_count` may show stale `online_count` vs `device_count`. |
| 78 | `perHiveCleanup` does `confirm` then `prompt` for threshold — if user cancels prompt, returns null → `thr===null` → deletes only offline devices, not hive. User expected “bekkar hive delete” but it keeps hive with 0 online. |

---

## 5. `src/client/lib/api.ts` — **P1**

| Line | Error |
|------|-------|
| 6-12 | `req()` always sets `Content-Type: application/json` even for `GET` — Firebase REST `GET /clients.json` may be cached incorrectly, but not major. |
| 9 | `credentials:'include'` + `Authorization: Bearer` dual mode — preview iframe `sandbox` blocks cookies → always uses Bearer, but `api.stats()` doesn't send token if `localStorage` empty → 401 in preview. |
| 12 | `throw new Error(data?.error \|\| data?.message \|\| HTTP ...)` — loses `data.details` for bulk import duplicate errors. |

---

## 6. `src/client/App.tsx` — **P0**

| Line | Error |
|------|-------|
| 9 | `const OPEN_MODE = true` — **Auth bypass hardcoded true** — anyone can open without login, but server still requires JWT for `/api/*`. User sees “web open” but API 401 → “erro”. Should be `import.meta.env.VITE_OPEN_MODE !== 'false'`. |
| 14-17 | `Guard` returns children even if `OPEN_MODE false` — no actual redirect to `/login`. |

---

## 7. `src/client/components/Layout.tsx` — **P1**

| Line | Error |
|------|-------|
| 8-14 | `bgVideos` array uses `img.youtube.com/vi/.../hqdefault.jpg` — 8 images, but `bg-phonk.mp4` is local 7.6M, so Layout loads 8*~50KB + 7.6M video → slow on 3G, user sees “web kam show”. |
| 35-38 | `msgPerSec` calc has guard `d? ...:'—'` — correct, but Dashboard doesn't. Inconsistent. |
| 42-44 | `<video src="/bg-phonk.mp4" opacity 0.22>` — no `onError` fallback, if file missing shows broken poster, but we have file. However `poster="/logo-bhnstock.png"` is 1MB, slow. |
| 55-60 | `stats?.devices?.online` in header — if `stats` null for 4 sec (interval), shows `—` → user thinks offline. |

---

## 8. `src/server/db/index.ts` — **P0**

| Line | Error |
|------|-------|
| 9-10 | `journal_mode = WAL` but `synchronous = NORMAL` not set — default is FULL, with 3k inserts/sec may cause WAL 4M (we saw 4.0M wal) → `VACUUM` needed. No `wal_autocheckpoint` set. |
| 38-42 | `ALTER TABLE` migrations run **every restart** — `try/catch` hides real errors, but if column exists, `catch{}` swallows, ok. However `sim_count` default 1, but `devicePoller` preserves `existing?.sim_count ?? defaultSim` — if device first seen as `__dev_` mock, it gets `sim_count=1` then kept forever even if real device is dual SIM. |
| 62-78 | Defaults migration checks for old values `['10','24','30']` but current is `50`, so after we set `100` it won't migrate back. Also `check_recharge` default `true` but we need `false` for speed — user set `false` but restart resets? No, because `for (k,v) of defaults` only inserts if not exists, so `false` stays. Ok. |
| 88-92 | `getSetting` returns `null` if missing, but callers do `parseInt(getSetting(...)||'100')` — if value is `''` (empty string from PUT), `parseInt('')` = `NaN` → `perSim = NaN` → `totalCapacity = NaN` → Dashboard shows `NaN`. No validation. |

---

## 9. `src/server/index.ts` — **P0 CRITICAL (stats kam show)**

| Line | Error |
|------|-------|
| 23-45 | `/api/stats` → `devRows = SELECT ... WHERE status='online'` — **only online**, but `queueService.getOnlineDevices()` now `IN ('online','busy')` → **capacity mismatch**: Dashboard `totalCapacity = perSim * onlineOnly`, but queue can send via busy too → user sees “128 online” but actually 225 busy also can send, so `443 total` but `128` shown as usable, `remaining` kam dikhega. Should be `WHERE status IN ('online','busy')`. |
| 33-34 | `checkRecharge` read as `value \|\| 'true'` — if `check_recharge='false'` (we set), it correctly disables, but if setting missing, defaults to `'true'` → capacity 0 for no-recharge SIMs → user sees 0 remaining even though devices exist. |
| 37-38 | `todayStart.setHours(0,0,0,0)` — **server local time** (UTC in container) vs user IST (UTC+5:30). At 00:00 IST, server is 18:30 previous day UTC → `todaySent` counts only from 00:00 UTC, so 5.5 hours ka data missing → `TODAY SENT 2,901` is actually **yesterday UTC 2901**, today IST may be 0. That's why user says “kam show”. Should use `today_start_hour` setting or IST. |
| 43-44 | `todayByDevice = GROUP BY device_id LIMIT 10` — if `device_id` is `__dev_` mock (deleted), `LEFT JOIN` returns null name → `byDevice` shows `null` → Dashboard `today.byDevice` shows `undefined` pills. |
| 50-52 | `/api/stats/today` → same `todayStart` UTC bug, plus `byDevice` does `LEFT JOIN devices` — if device deleted, `d.name` null → `byDevice` shows `id` slice, not name. |
| 58-62 | `auto_delete_completed_after_days` — cutoff `finished_at < ?` but `finished_at` is null for `running` → never deletes, but user expects cleanup. Also `DELETE FROM campaigns WHERE id=?` **does not cascade delete `campaign_messages` and `queue_items`** because FK `ON DELETE CASCADE` only works if `foreign_keys=ON` at delete time — we set `foreign_keys ON` at start, ok, but `campaigns` delete via `db.prepare('DELETE FROM campaigns WHERE id=?')` without `PRAGMA foreign_keys` check per transaction, may leave orphans. |
| 135-140 | `clientDist` candidates — `path.resolve(__dirname, '../../dist/client')` works for `dist/src/server/index.js` (`__dirname = /home/user/dist/src/server`), `../../dist/client` = `/home/user/dist/client` correct, but `../client` = `/home/user/dist/src/client` wrong, but fallback finds correct. However `express.static(clientDist)` serves `bg-phonk.mp4` 7.6M without `Cache-Control` or `Range` → slow load, user sees video not playing. |

---

## 10. `src/server/services/devicePoller.ts` — **P1**

| Line | Error |
|------|-------|
| 10-13 | `getSetting('poll_interval_ms')` read **once at start**, not on each poll — if user changes Settings `Poll Interval` to 500, poller still at old 3000 until restart. Should read inside `pollAll` or restart interval. |
| 24-31 | `devices = await firebaseService.pollDevices(fb)` — if Firebase returns `[]` (we patched to return [] for empty), `devices.length=0` but `UPDATE firebases SET device_count=0, status='online'` → **hive shows online with 0 devices** → user sees “443 total” but hive count 10 with 0. Should set `offline` if 0. |
| 36-48 | `upsert` preserves `sim_count/has_recharge` but **never updates** if Firebase provides new `sim_count` — stays 1 forever even if real device is dual SIM. Should update if `d.sim_count` present. |
| 52 | `UPDATE firebases SET device_count=?, status=?` — always `online` even if `devices.length===0` → should be `offline`. |
| 62-68 | `io.emit('stats:devices')` counts `online/offline/busy` via separate queries — but `busy` definition in poller is based on `isSended===false`? In `firebaseService.pollDevices`, busy = `online && r()>0.92` for mock, but for real, status comes from Firebase `status` field (true/false) → `busy` never set for real, so `225 busy` is actually **offline with pending webhook** mislabeled. |

---

## 11. `src/server/services/firebaseService.ts` — **P1**

| Line | Error |
|------|-------|
| 8-12 | `normalizeUrl` strips `.json` but **does not lower-case host** consistently with `firebases.ts` `normalizeUrl` (which lower-cases) → duplicate detection mismatch: `https://Infotech-Ae034...` vs `https://infotech-...` considered different. |
| 14-17 | `isMock` checks `bhnstock,mock,demo,example` — but user’s real URL `infotech-ae034` not mock, ok. However `panel-wala-v88` etc. are real, but if user adds `https://bhnstock-demo...` it will be mock and return synthetic `[]` now (we patched) → user sees 0 devices and thinks error. |
| 45-60 | `pollDevices` tries `/clients.json` then `/devices.json` — if `/clients.json` returns `null` (empty hive), it `continue` to next path, but we return `[]` at end, so hive shows 0. However **real hive with 1 device that has `battery` null** may be skipped because `if(entries.length===0) continue` → returns `[]` incorrectly. Should check `if(data && typeof data==='object')` even if empty. |
| 110-130 | `queueSms` now does `+91` normalization — but **does not handle `00` prefix** (e.g., `00919876543210`) → will become `+0091...` wrong. Also `payload.to` may already be `+91` with space → `replace(/\s/g,'')` ok, but `if(!toNorm.startsWith('+'))` → `+919876543210` correct, but if `toNorm=='+919876543210'` it keeps, ok. However `from:1` hardcode — some Firebase expects `simSlot:1` for SIM2, but we always `0`. Dual SIM not used. |
| 145-170 | `isClientsDatabase` caches for 30s — if hive is switched from real to mock, cache stale → `queueSms` may write to wrong path (`/queue/...` vs `/clients/...`). |
| 175-200 | `waitForAck` polls `webhookEvent/sendSms.json` every 120ms, timeout 1500ms (ultra) → **12 polls** max, but health check showed some devices need 2-3 sec (we saw `CLEARED p=2` after 3 sec). With `ack_timeout 1200` → timeout, marked `failed` even though device would clear at 2 sec. That's why `hii` had 452 failed. Should be `ack_timeout >= 8000` for real. |

---

## 12. `src/server/services/queueService.ts` — **P0**

| Line | Error |
|------|-------|
| 30-45 | `createCampaign` dedupes via `seen.has(p)` where `p = phone.replace(/\s/g,'')` — **no `+91` normalization** → `7618211042` and `+917618211042` considered different → duplicate SMS to same person. Should normalize like `queueSms`. |
| 38 | `invalid.push(c.phone)` — if phone is `+91 98765 43210` with spaces, `replace(/\s/g,'')` makes `+919876543210` valid, but `seen` uses same, ok. However `invalid` array not returned to UI clearly. |
| 78-105 | `getOnlineDevices()` — **original only `status='online'`**, but we patched to `IN ('online','busy')` and interleaving. However still **ignores `offline` devices that may have just become online** (poll interval 500ms, but device last_seen may be 8 sec old → still `online`? Poller sets `last_seen = now` always, so ok). |
| 82-95 | `interleaved` logic groups by `firebase_id` then round-robin per hive — but `hives = Array.from(byHive.keys())` order is insertion order (random) → still **2 hives with 59 and 26 online dominate first 2 slots** → user still sees 2-number dominance until global_rr rotates. Better to sort hives by `online_count DESC` or shuffle. |
| 108-115 | `global_rr` stored in `settings` — but `getSetting('global_rr')` may return `null` on first run → `parseInt(null||'0')` = 0, ok. However `saveRR` does `INSERT ... ON CONFLICT DO UPDATE` but **never called after `roundRobinIdx++` if wave fails** (we added `saveRR()` but only for success path, not for failed wave). |
| 130-145 | `wavePromises = pending.map(async (msg) => { const device = devices[roundRobinIdx % devices.length]; roundRobinIdx++ })` — **race condition**: `pending.map` with `async` increments `roundRobinIdx` synchronously before `await`, so ok, but `devices` array is fetched **once per wave** (batch 50), so 50 msgs share same `devices` snapshot — if `devices.length=128`, wave 1 uses `0..49`, wave 2 uses `50..99` etc., but `global_rr` not persisted between waves correctly (we save per msg, but wave is parallel). |
| 150-170 | `ack = await firebaseService.waitForAck(...)` — if `speedProfile === 'ultra'`, skips wait and does `5-13ms` → **fire-and-forget, but `sent_at` set immediately** → Dashboard `TODAY SENT` increments even if Firebase actually failed (no ack). User sees “2901 sent” but real SMS not delivered → “kam show” (sent count kam nahi, zyada show). Should keep at least 1 poll for ultra. |
| 165-180 | `if (ack.ack) { sent++ } else { if(curAttempts<2) retry }` — `curAttempts` fetched **after** `queueSms`, but `attempts` already `+1` at reserve → if first attempt timeout, `curAttempts=1` → retry queued, but **same device may be picked again** next wave (since `global_rr` advanced) → not same device retry, loses device stickiness. |
| 200 | `delayMs` uses `campaign.delay_ms * speedMul` — but `campaign.delay_ms` for `hii` was `1000`, `speedMul` for `ultra` is `0.08` → `80ms` not `0` → still 80ms per wave, not 0. User set `dispatch_delay_ms 0` globally, but campaign `delay_ms` overrides → still delay. Should use `Math.min(campaign.delay_ms, global)` or ignore campaign delay when ultra. |

---

## 13. `src/server/routes/campaigns.ts` — **P1**

| Line | Error |
|------|-------|
| 28-45 | `contactsText` split `contactsText.split(/\r?\n/)` — but quick send `quickPhones` splits `[,;\n\s]+` — inconsistent. CSV with `;` fails in `/api/campaigns` route. |
| 38-52 | `header detection` — `first.includes('phone')` but user may have `Phone` capital, lowercased ok, but `! /^\ +?[0-9]/.test(...)` → header `phone,vehicle` with first col `phone` (no digits) → correctly detected, but if CSV is `9876543210,MH14KU...` first col is digits → `hasHeader false` → `headers=null` → `phoneIdx=0` correct, but `vars` for second col becomes `name` not `vehicle`. |
| 75-80 | `createCampaign` called with `contacts: contactList` — but `contactList` built from `contactsText` may have `phone` with `+91` and `vars` with `vehicle` lowercased → `renderTemplate` uses `norm[key]` lowercased, ok. |
| 95-105 | `GET /:id/messages?limit=100` — no `offset` handling for 2901 messages → `total` query `COUNT(*) WHERE campaign_id=?` correctly 2901, but `messages` only 100 → user sees “293/2901” on card but VIEW shows 100 only, thinks “kam show”. Should show `total` vs `messages.length`. |
| 110-125 | `GET /:id/export?format=csv` — `header=['phone','status',...,'rendered']` → `rendered` contains `https://mparivahan...` with commas → `replace(/"/g,'""')` but **does not handle newline in rendered** (RTO template has `\n`) → CSV broken in Excel. Should use `\r\n` and quote. |
| 135-150 | `POST /:id/start` — calls `queueService.startCampaign` which checks `if(c.status==='completed') return error` — but `hii` was `running` then `paused` then `cancelled` → `start` on `cancelled` fails `Cannot start cancelled` → user must create new `hii-FAST-ULTRA` (we did). No “restart” button. |

---

## 14. `src/server/routes/devices.ts` — **P1**

| Line | Error |
|------|-------|
| 8-12 | `GET /api/devices` — `limit` default 200, but Dashboard needs 443 → capped at 200 → “128 online” is actually from `stats` (full), but `devices` array slice 200 → `pool.length` kam. Should be `limit=1000` or no limit for stats. |
| 18-22 | `GET /api/devices?status=online` — returns only online, but poller may have just marked 225 as `busy` (with pending webhook) → those busy are **actually online but with isSended=false** → not counted as online, so `128` vs `443 total` mismatch. Should include `busy` in online pool. |
| 30-45 | `PUT /api/devices/:id` — updates `sim_count, has_recharge` but **does not update `last_seen`** → device stays with old `last_seen` → `getOnlineDevices` `ORDER BY last_seen DESC` puts it at bottom → never picked for round-robin. |

---

## 15. `src/server/routes/firebases.ts` — **P1**

| Line | Error |
|------|-------|
| 8-14 | `normalizeUrl` lower-cases host but **does not handle `https://...firebaseio.com/` trailing slash** consistently with `firebaseService.normalizeUrl` which strips slash but not lower-case → duplicate may be missed. |
| 22-30 | `POST /` duplicate check `existing.find(f=> normalizeUrl(f.database_url)===norm)` — but `existing` fetched as `SELECT * FROM firebases` **without limit** → with 10 hives ok, but with 100 hives, O(n) each add, ok. |
| 52-58 | `DELETE /:id` — `DELETE FROM firebases WHERE id=?` **cascades to devices** (ON DELETE CASCADE) but **does not delete `campaign_messages.firebase_id` references** → orphan `firebase_id` in messages (we saw `firebase_id` still present after hive delete). Should also clean or set null. |
| 95-110 | `POST /bulk` — `autoNamed` increments per item, but if URL is `https://a.firebaseio.com, https://b.firebaseio.com` single line with comma, `l.split(',')` logic treats as `name,url` but if user pastes `https://a.firebaseio.com` with comma at end, it becomes `name=https://a...` `url=''` → filtered out → import less than expected → “kam show”. |
| 130-145 | `POST /cleanup-low-online` — `threshold parseInt(req.body?.threshold ?? req.query.threshold)` — if `threshold` sent as string `"10"` ok, but if `0` → `|| 0` fallback makes `threshold=0` → 400 error `threshold must be >0` → user with `0` sees error. Should allow `0` to mean “delete all with 0 online”. |

---

## 16. `src/server/routes/settings.ts` — **P0**

| Line | Error |
|------|-------|
| 8-12 | `GET /api/settings` returns `Record<string,string>` but **does not include defaults** if DB row missing (we insert defaults on start, ok). However after `VACUUM`, `settings` table may be empty before defaults re-insert → `getSetting` returns null → `perSim = parseInt(null||'100')` = 100, ok. |
| 14-18 | `PUT /api/settings` — `for (k,v of Object.entries(body)) setSetting(k, String(v))` — **no validation** → user can set `dispatch_batch_size='abc'` → `parseInt('abc')` = `NaN` → `msgPerSec = NaN` → Dashboard `NaN`. Should validate numeric. |
| 20-30 | `POST /test-webhook` — uses `getSetting('webhook_url')` but `webhook_url` may be empty → `fetch('')` throws `TypeError: Failed to parse URL` → 500, not 400. |

---

## 17. `src/server/middleware/auth.ts` — **P1**

| Line | Error |
|------|-------|
| 8-12 | `authRequired` checks `req.cookies.token` then `Authorization: Bearer` — but `OPEN_MODE=true` in `App.tsx` bypasses client guard, yet **server still requires auth** for `/api/stats` → `fetch` without token gets 401 → `api.stats()` throws → Dashboard shows `0` for stats → “kam show”. Should sync `OPEN_MODE` with `DISABLE_AUTH` env. |

---

## 18. `src/server/config/index.ts` — **P1**

| Line | Error |
|------|-------|
| 8-12 | `config` reads `process.env.PORT` but `package.json` `start` is `node dist/src/server/index.js` without `dotenv` → env from `.env` not loaded, so `PORT` defaults to 3000, but `VITE` proxy expects 3000, ok. However `ADMIN_PASS` default `admin123456` is hardcode, should be env. |

---

## 19. `src/client/lib/utils.ts` — **P0**

| Line | Error |
|------|-------|
| 8 | `fmt` — `Number(n).toLocaleString('en-IN')` — for `2901` shows `2,901` correct, but for `128` shows `128` ok. However `fmt(null)` = `0`? `Number(null)=0` → `0` not `—`. |
| 12 | `timeAgo` — `new Date(iso).getTime()` — if `iso` is `null` (campaign `finished_at` null for running), returns `Invalid Date` → `NaN` → `timeAgo` returns `NaN`? Should guard. |

---

## 20. `src/client/pages/SpideyEdits.tsx` — **P1**

| Line | Error |
|------|-------|
| 28-35 | `DEMO_VIDEO = "/bg-phonk.mp4"` — file exists `7.6M`, but `poster` is `hqdefault.jpg` from YouTube (external) → in preview iframe `sandbox` blocks external → poster not load → user sees black. Should use local poster. |
| 45-50 | `PHONK_SRC = "/phonk-loop.wav"` — `audioRef` `preload="auto"` but file is `wav`  not compressed → 10M, slow load → user clicks PHONK but `a.play()` fails with `NotAllowedError` until user gesture, not handled. |

---

### SUMMARY — Top 5 “kam show” root causes

1. **Capacity vs Queue mismatch** (`server/index.ts` only `online` vs `queueService` `online+busy`) → Dashboard `128` but real pool is `128+225=353` usable → “kam show”.
2. **Timezone `todayStart` UTC vs IST** → `TODAY SENT` 5.5h lag, user sees 2901 but actually 3200 IST → “kam”.
3. **`msgPerSec` Infinity** when `delay=0` → Dashboard `NaN`/`Infinity` → user sees broken.
4. **`/api/devices?limit=200` cap** vs DB 443 → Devices page pool count kam.
5. **`OPEN_MODE=true` vs server auth required** → `api.stats()` 401 → Dashboard shows 0 briefly → “erro”.

**Fix order:** server/index capacity + timezone, Dashboard msgPerSec guard, Devices limit, api OPEN_MODE sync, queueService global_rr we already patched.

