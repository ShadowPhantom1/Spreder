# BHNStock 3D Spreader — FULL VADIA PLAN (Firebase Har User Khud, Admin Sirf Tu)

**Date:** 2026-09-24
**Stack:** Node + Express + React (Vite) + MongoDB Atlas + Firebase (per user) + Render
**Build:** `persist/` (survives sandbox wipe) + `node persist/src/server/index.js`

---

## 1. Vision
- Har user apna Firebase (10 hives) khud add karega, uske devices/campaigns sirf usi ko dikhenge.
- Tu Super Admin (`admin/admin123456` is_super=1) sab users ka IP, Firebase, Device, Campaign, Limit, Storage 1 click me manage karega.
- 1 user = 1 device = 1 login (IP lock + single session)
- Storage auto-clean, per-slot barabar load, 5-msg validator hidden.

---

## 2. Main Page `/` (Public)
- Header: `BHNStock 3D Spreader` + `100 SIM barabar load • 5-msg validator hidden • 3k in 12s`
- Hero: 3 cards `Features | Pricing ₹2499/mo | Demo`
- CTA: `Login | Register` → Register = `pending` (Super approve karega)
- Footer: `Super Admin Login → /super`

---

## 3. Roles
| Role | Login | Access |
|------|-------|--------|
| Super Admin | `admin/admin123456` `is_super=1` | `/super` → sab users, add/delete, IP set, limit edit, storage wipe |
| User | `email/pass` `is_super=0` | `/dashboard` → sirf apna `userId` ka data |

---

## 4. Mongo Collections (Mongoose)

```js
users {
  _id, email, password_hash,
  is_super: bool, is_active: bool,
  allowed_ip: String|null, // "103.22.1.5" / "103.22.1.0/24" / null=*
  per_sim_limit:100, max_devices:100, hive_limit:10,
  expires_at: Date, createdAt
}
firebases {
  _id, userId: ref users, name, database_url, status, device_count
  // UNIQUE(userId, database_url)
}
devices {
  _id, userId, firebaseId, deviceId, name, status, sim_count, has_recharge,
  sim1_recharge, sim2_recharge, last_seen, total_sent, validated_score
}
campaigns { _id, userId, name, template, status, total, sent, failed, pending }
messages { _id, userId, campaignId, phone, rendered, status, deviceId, attempts }
sessions { userId: unique, ip, deviceId, token_jti, last_active } // 1 user =1
settings { userId, key, value } // per user: speed_profile, batch, delay, ack
```

---

## 5. User Flow (Firebase Khud)

1. **Register** → `is_active=0` → Super me `Approve` → `is_active=1`
2. **Add Firebase (khud):** `Settings → + Add Firebase` → `https://mera.firebaseio.com` → `Test Connection` → `firebases.insert({userId})` (max 10 check)
3. **Poller:** `devicePoller` har 500ms → `for fb in firebases.find({userId})` → `pollDevices(fb)` → `devices.update({userId})` → `socket emit` sirf us user ko
4. **Campaign:** `New → template {{name}} {{vehicle}}` → `contacts:[{phone, vars}]` → `campaigns.insert({userId})` → `queueService` `WHERE userId` → `per-slot expansion` → `PUT /clients/{id}/webhookEvent/sendSms.json` → `waitForAck`
5. **View:** `VIEW` me `rendered` alag per contact, `deviceId slot`

---

## 6. Super Admin `/super` (Only is_super)

- **Clients Table:** `User | IP | Firebase 3/10 | Devices 45/100 | Today 1.2k/10k | Storage 320MB | Status ● | [Edit Limit] [Set IP] [Disable] [Delete + Wipe]`
- **Edit Limit Modal:** `per_sim, batch, delay, speed, hive_concurrency, expires_at` → `settings.update({userId})`
- **Set IP:** `Text: 103.22.1.5 or 103.22.1.0/24 or *` → `users.update({allowed_ip})`
- **Disable/Kill:** `is_active=0` → next API `403` → auto logout; `Kill` → `sessions.deleteOne({userId})` + `io.emit('force_logout')`
- **Storage:** `messages.countDocuments({userId})*0.5KB` → `[Clean Failed>30d] [Clean All Completed<3d]`
- **Add/Delete Anything:** `DELETE /api/super/firebases/:id?userId=xxx` → cascade `devices/campaigns`

---

## 7. Auth + IP + Single Device Lock

- **Login:** `POST /api/auth/login` → `check is_active, expires_at, allowed_ip (if set && req.ip !== allowed_ip → 403)` → `sessions.findOneAndDelete({userId})` → `sessions.create({userId, ip, deviceId: req.headers['x-device-id'], token})` → `return JWT`
- **Middleware:** every `Authorization: Bearer` → `verify JWT` → `sessions.findOne({userId, token})` → `if !found → 403 Logged in elsewhere` → `if allowed_ip mismatch → 403`
- **Frontend:** `axios intercept 403 → force logout → /login`

---

## 8. Hard Barabar + Validator (Hidden, Existing Code)

- **Per-slot:** `sim_count=2` → `device:1` + `device:2` → `~500 slots` → `global_rr % slots` → har slot `100/day` barabar
- **Validator:** `deviceValidator.ts` → `45s` first, `12min` cycle → `5 msg per SIM` to `validator_firebase_url` (dusra Firebase `sms reciec`) or `ack-only` → `3/5 per slot` → `KEEP` else `offline` (no UI emit)
- **Single-msg:** `BEST device + 3s real ack`, bulk `ultra 800ms + instant fallback`

---

## 9. Storage Auto-Clean

- **TTL:** `campaigns.expiresAt = finished_at + 3d` → `TTL index` auto delete OR `cron 02:00` → `deleteMany({userId, finished_at < now-3d})`
- **Super Edit:** `auto_delete 3 → 7` days
- **Size Guard:** `>900MB` → `is_active=0` + Super `Clean` button

---

## 10. Render Host

- **Build:** `npm install && npx tsc -p tsconfig.server.json && npx vite build` → `persist/` (survives wipe)
- **Start:** `node persist/src/server/index.js` → `PORT 10000`, `HOST 0.0.0.0`
- **Env:** `MONGODB_URI=mongodb+srv://...`, `JWT_SECRET`, `ADMIN_USER/PASS`
- **Disk:** Not needed (Mongo Atlas), but if SQLite fallback → `Disk /data`
- **Custom Domain:** `spreader.tumhara.com` → CNAME to `onrender.com`

---

## 11. Phase Plan

**P1 (1h):** `users/sessions` migration, `auth` IP+single, `/super` login
**P2 (1h):** `firebases(userId)` + `Poller/Queue/Validator WHERE userId` + `per-slot` + `Landing`
**P3 (30m):** Render `persist` + Disk + live `bhnstock.onrender.com`

**Next Action:** `P1` start? Type `bna do` → I will push code to `persist` and restart on `i45s...` (or new sandbox) in 15min.
