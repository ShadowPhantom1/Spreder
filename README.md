# 🕷️ BHNSTOCK SMS SPREADER 3D WEB — Brand New Day Edition

> **Your Friendly Neighborhood SMS Spreader — now swinging in 3D.**

A full-stack SMS campaign OS that fans messages across **multiple Firebase Realtime Database hives**, with **wave-based round-robin dispatch**, **ACK chasing + retry**, and **live Socket.io observability** — wrapped in a Spider-Man *Brand New Day* 3D design system.

**Live at:** `http://localhost:3000` (or preview URL in Arena)  
**Login:** `admin / admin123456`  
**Architecture Doc:** [`BHNSTOCK_SMS_SPREADER_3D_ARCHITECTURE.html`](./BHNSTOCK_SMS_SPREADER_3D_ARCHITECTURE.html) — single-file, printable, 12-section deep dive

---

## ⚡ Quick Start

```bash
npm install
npm run dev          # :5173 (Vite HMR → proxies /api → :3000) + :3000 (Express + Socket.io)
# production
npm run build        # tsc + vite → dist/client + dist/src/server
npm start            # Express serves API + static + WebSocket on :3000
curl http://localhost:3000/api/health
```

Env defaults (override in shell or `.env`):
```
PORT=3000  HOST=0.0.0.0
JWT_SECRET=dev-secret-change-in-production-min-32-chars!!
JWT_EXPIRY=7d
ADMIN_USER=admin  ADMIN_PASS=admin123456
DATABASE_PATH=./data/sms.db
POLL_INTERVAL_MS=5000  DISPATCH_BATCH_SIZE=5  DISPATCH_DELAY_MS=1200  ACK_TIMEOUT_MS=15000
```

---

## 🏗️ Architecture at a Glance

```
Browser (React 18 + Vite + Tailwind + Framer Motion)
   │  REST /api/*  +  Socket.io
   └─▶ Express 4 + Socket.io 4
          ├─ auth (JWT HttpOnly cookie + Bearer)
          ├─ /firebases  /devices  /campaigns  /settings  /stats
          ├─ DevicePoller (5s sweep → upsert devices → emit)
          ├─ QueueService (wave loop: batch + round-robin + ACK wait + retry)
          ├─ FirebaseService (REST: .json?shallow, /devices.json, /queue/{dev}/{msg}.json)
          └─ SQLite WAL (better-sqlite3) → ./data/sms.db
```

**DB Tables:** `firebases, devices, campaigns, campaign_messages, queue_items, settings, users`  
**Key flows:** `Campaign create` (dedupe → rendered → transaction) → `processCampaign` (wave → parallel dispatch → ack → progress emits) → `pause/resume/cancel` via in-memory flags.

📄 **Full 12-section doc** with schema, sequence diagrams, API table, frontend token map, and clean rebuild guide: open [`BHNSTOCK_SMS_SPREADER_3D_ARCHITECTURE.html`](./BHNSTOCK_SMS_SPREADER_3D_ARCHITECTURE.html) in the viewer / browser (printable).

---

## 🎨 Brand New Day 3D Design System

**Palette:** Spidey Red `#E30613` → Dark `#9A0007`, Night Blue `#0A1628` → `#162447`, Cyan `#00D9FF`, Eye Glint `#FFD23F`  
**Typography:** Bebas Neue / Anton (display) + Space Grotesk (body) + JetBrains Mono  
**Effects:** `bg-spidey-mesh` (triple radial dusk), `web-pattern` (28px dots), `halftone` (10px comic), `web-lines` (SVG concentric), `card-3d` (perspective tilt on hover), `comic-border` (inset red rim + glow), `glass-spidey` (blur16+saturate), `shimmer` sweep, header red→yellow→cyan line.

**Pages:** Login (giant web SVG + mask), Dashboard (hero + 3D KPIs + live log), Campaigns (3D cards + new-campaign modal with template preview + messages drawer), Devices (phone mockups + battery/signal), Firebase Hives (connect + bulk CSV + Test/Seed), Settings (tunable poll/batch/delay/ACK + “How it works”).

---

## 🔌 API & Real-time

| Group | Examples |
|---|---|
| Auth | `POST /api/auth/login` → JWT+cookie, `GET /api/auth/me` |
| Hives | `GET/POST /api/firebases`, `POST /api/firebases/:id/test|seed`, `POST /api/firebases/bulk` |
| Devices | `GET /api/devices?firebase_id&status&q`, `GET /api/devices/:id` |
| Campaigns | `POST /api/campaigns` (name, template, contacts/contactsText, batch_size, delay_ms), `POST /api/campaigns/:id/start|pause|resume|cancel` |
| Settings | `GET/PUT /api/settings` |
| Socket.io | `devices:update`, `firebases:update`, `campaign:progress`, `message:sent|failed|retry`, `campaign:status` |

Firebase REST is **mock-aware** — any URL containing `mock|demo|bhnstock|example` synthesizes devices/ACKs so the demo is instantly alive without credentials.

---

## 🧪 Verified

- Admin seeded, login → cookie works, `/api/firebases` authed
- Poller upserts 4–8 synthetic bots (battery/signal) every 5s → `stats` & `devices:update`
- Campaign create (3 contacts, dedupe, rendered) → `start` → waves (batch 2) → ACK → 3 sent, `completed` in ~5s, messages drawer shows device + attempts

---

## 📦 Workspace

```
/src/server/{config,db,middleware,routes,services,utils}
/src/client/{components, pages, lib}
/data/sms.db (WAL)  •  dist/client  •  dist/src/server
BHNSTOCK_SMS_SPREADER_3D_ARCHITECTURE.html  ← the full design doc
```

— With great power comes great throughput. 🕸️
