# VPS Deploy — BHNSTOCK SMS SPREADER

## 1. Clone & Run
```bash
git clone https://github.com/ShadowPhantom1/Spreder.git
cd Spreder
python3 run.py
```

## 2. run.py Menu
```
1) Set Database   — choose MongoDB (Atlas) or Local (SQLite ./data/local.db)
2) Launch         — 0.0.0.0:3000 → http://YOUR_VPS_IP:3000 (open anywhere)
3) Run Tests      — 20 tests
4) Show Env & IPs
5) Exit
```

- **Option 1 → 2** : Local = zero config, no internet needed, file `./data/local.db`
- **Option 1 → 1** : MongoDB = paste `mongodb+srv://...` (Atlas)

## 3. VPS Fast Launch (no menu)
```bash
# Local (fast, offline)
echo "DATABASE_TYPE=local" > .env
python3 run.py   # then choose 2

# OR one-liner
DATABASE_TYPE=local PORT=3000 HOST=0.0.0.0 npx tsx src/server/index.ts
# OR with PM2 (production)
pm2 start "npx tsx src/server/index.ts" --name spreder
pm2 logs spreder
```

## 4. Open Anywhere
- VPS Security Group: allow `3000/tcp` (0.0.0.0/0)
- URLs after launch:
  - Local:   http://localhost:3000
  - LAN:     http://<private-ip>:3000  (169.254.x.x)
  - Public:  http://<public-ip>:3000   (136.109.x.x) ← open anywhere

## 5. Env (.env)
```
DATABASE_TYPE=local   # or mongo
MONGODB_URI=mongodb+srv://... # only if mongo
JWT_SECRET=48-char-random
ADMIN_USER=shadowphantom
ADMIN_PASS=Shadow@123456
PORT=3000
HOST=0.0.0.0
```

## 6. Tests (20)
```bash
npm test
# → 20/20 passed = VPS ready
```

## 7. Build (fast load)
```bash
npm run build   # vite + tsc → 477kB (136kB gzip)
```

## 8. System Design
- `run.py` — DB switch + launch (VPS IP auto-detect)
- `src/server/db/local.ts` — SQLite (better-sqlite3) for local
- `src/server/db/index.ts` — switch mongo/local via DATABASE_TYPE
- Per-user hives: har user ka Firebase alag, kisi aur ko nahi dikhega
- Online only: status:true only, busy 0
- Cache 8s + indexes → <600ms stats/firebases (was 4s)
```
