# BHNSTOCK — /adminbhnstock — NEW ADMIN PANEL PLAN

> Purana `Admin.tsx` delete kar diya (backup: `Admin.tsx.bak`). Naya alag, premium, multi-page admin ab is plan se banega.

## 1. Goal
- **User panel** (`/dashboard, /campaigns, /devices, /firebases, /settings`) me **admin kahin nahi dikhe** — fully separate
- **Admin only at `/adminbhnstock`** — super login toggle (`/login` Super) → auto redirect
- **Not single page** — proper multi-page/sub-routes, sidebar navigation, not one tab container
- **No error** — Create, Suspend, Delete, IP Ban, Revoke sab 100% Mongo, inline errors, loading states

## 2. Routes
```
/adminbhnstock              → Layout (AdminLayout) + Dashboard (overview)
/adminbhnstock/users        → User Management (list + add/edit)
/adminbhnstock/users/:id    → (optional) User Detail drawer
/adminbhnstock/security     → IP/Device/Session logs
/adminbhnstock/system       → Storage, Hives, Campaigns overview, Export
/admin                      → redirect → /adminbhnstock (backward compat)
/super                      → removed (already)
/login (Super toggle)       → success → /adminbhnstock
```

## 3. Layout — AdminLayout (standalone, no user Layout)
- **Top bar** (white, Nivea): `ADMIN CONSOLE | NIVEA 3D • BHNSTOCK` + `Back to App → /dashboard` + `Online n / Users n` + `Refresh` + `Logout`
- **Left sidebar** (240px, sticky): 
  - Brand card `Full Control` (users n / active n)
  - Nav: `Dashboard`, `Users`, `Security`, `System` (icons Crown/Users/Lock/Settings, active = blue)
  - Bottom: Security bullets + ©
- **Mobile**: bottom pill nav
- **No user sidebar items** — fully isolated
- **Guard**: `SuperGuard` → if `!is_super` → `/login`

## 4. Pages

### 4.1 Dashboard (`/adminbhnstock`)
- **Stats cards** (4): Total Users, Active, Online Sessions, Hives/Campaigns (gradients)
- **Recent Users** (6) + **Capacity** (active % + online bar) + **Quick Actions** (Manage Users, Refresh)
- Source: `GET /api/admin/users`, `GET /api/stats`

### 4.2 Users (`/adminbhnstock/users`) — CORE
- **Header**: `User Management n` + `Add User` (gradient button)
- **Add User Modal** (glass, premium):
  - Fields: `Username` (unique), `Password` (min 6), `Subscription Days` (0=lifetime, 30)
  - Inline `formError` + top `msg`, `Creating…` disable, keep open on fail
  - POST ` /api/admin/users` → `{username, password, per_sim_limit:100, max_devices:100, allowed_ip:'', expires_at}`
  - Success: `✓ created • IP auto on first login`, reset form, close, reload list
  - Note: `MongoDB Cluster0` persists
- **Toolbar**: filter `all/active/disabled/super` + search `username/IP`
- **Table** (premium):
  - Columns: `USER (avatar+id+date) | IP / DEVICE LOCK (editable on click) | LIMIT (/SIM) | EXPIRY | STATUS | SESSION (live IP) | ACTIONS`
  - Inline edit: click → input → `Save/Cancel`
  - Actions: `View` (eye), `Suspend/Enable` (Ban/Power), `Kick` (LogOut), `Revoke` (clear IP/device), `Delete` (Trash)
  - APIs: `PUT /api/admin/users/:id`, `POST :id/disable|enable|kick|reset-lock`, `DELETE :id`
  - Empty: `No users`

### 4.3 Security (`/adminbhnstock/security`)
- Cards: `First-login IP auto-lock`, `Super can Revoke → new lock`, `1 token 1 device`
- Auth info: `JWT Bearer+HttpOnly, 7 days, /adminbhnstock super only`

### 4.4 System (`/adminbhnstock/system`)
- **Storage**: Campaigns/Devices counts, `Clean Now (3d)` → `POST /api/admin/storage/clean`
- **Health**: online/total bar, `All systems operational`
- **Export**: `Download Users JSON`
- **System Info**: DB `MongoDB`, Auth `1 ID 1 Device`, Speed `100/SIM Ultra`
- Source: `GET /api/stats`

## 5. UI — Premium Nivea 3D
- Colors: `#0066CC`, `#1E40AF`, `#EAF4FF`, `#F0F7FF`, white, emerald/red for status
- Components: `rounded-[20px]`, `border-[#EAF4FF]`, `shadow-sm`, `gradient` buttons, `motion` (framer-motion), `lucide` icons
- States: `msg` toast top, `formError` red in modal, `creating` disabled
- Responsive: desktop sidebar, mobile bottom nav

## 6. Backend — Already FULLY Mongo (no change needed)
- `POST /api/admin/users` → `User.create` (Mongo), duplicate → `400 exists`
- `GET /api/admin/users` → `User.find` + `Device/Campaign` counts + `Session` lookup
- `PUT /api/admin/users/:id` → `User.updateOne`
- `POST :id/disable|enable` → `User.updateOne is_active` + `Session.delete`
- `POST :id/reset-lock` → `User.updateOne allowed_ip/device null` + `Session.delete`
- `DELETE :id` → `User.deleteOne` (block super)
- All via `MONGODB_URI` (Cluster0), dummy SQLite in-memory only

## 7. Spreader Management (User side) — Keep as is, no admin
- User panel remains `Layout` with `Dashboard/Campaigns/Devices/Firebases/Settings/Docs` — no admin link
- Campaign create `Mast CSV + Row Select` already good, no error

## 8. Build & Verify Steps
1. Create `src/client/pages/admin/` → `AdminLayout.tsx`, `Dashboard.tsx`, `Users.tsx`, `System.tsx` (or single `Admin.tsx` with nested routes)
2. Update `App.tsx` → nested routes under `/adminbhnstock`
3. `tsc -p tsconfig.server.json` + `vite build` → `~465k`
4. `node persist/src/server/index.js` → test `POST /api/admin/users` → `admin` → `testuser` → `login` → `IP auto` → `Revoke`
5. `git commit` + `push main` → Render auto-deploy

## 9. Confirmation Needed
- Do you want **3 pages** (Dashboard/Users/System) or **4 pages** (+Security separate)?
- Should `/admin` redirect to `/adminbhnstock` or 404?
- Keep `Days` as number input or dropdown (7/30/90/lifetime)?

> Reply `ok` → I will build exactly this plan. Reply `change` → tell what to tweak.
