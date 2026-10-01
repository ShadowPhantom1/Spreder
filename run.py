#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BHNSTOCK SMS SPREADER - VPS Runner
Run: python3 run.py  (or ./run.py)
Options:
  1) Set Database (MongoDB / Local)
  2) Launch (VPS IP + port, open anywhere)
"""
import os, sys, json, subprocess, pathlib, time, re, shutil

ROOT = pathlib.Path(__file__).parent.resolve()
ENV_PATH = ROOT / ".env"
DATA_DIR = ROOT / "data"
LOCAL_DB = DATA_DIR / "local.db"

# colors
C = {
    "g": "\033[92m", "y": "\033[93m", "r": "\033[91m",
    "b": "\033[94m", "c": "\033[96m", "m": "\033[95m",
    "w": "\033[97m", "dim": "\033[2m", "rst": "\033[0m",
    "bold": "\033[1m"
}
def cprint(msg, col="w"): print(f"{C.get(col,'')}{msg}{C['rst']}")
def run(cmd, cwd=ROOT, check=True, shell=False):
    if isinstance(cmd, str) and not shell:
        cmd = cmd.split()
    return subprocess.run(cmd, cwd=cwd, check=check, shell=shell)

def read_env():
    env = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line=line.strip()
            if not line or line.startswith("#") or "=" not in line: continue
            k,v=line.split("=",1)
            env[k.strip()] = v.strip()
    return env

def write_env(env):
    lines=[]
    order=["DATABASE_TYPE","MONGODB_URI","JWT_SECRET","ADMIN_USER","ADMIN_PASS","PORT","HOST","DISABLE_AUTH","NODE_ENV","ALLOWED_ORIGINS"]
    for k in order:
        if k in env: lines.append(f"{k}={env[k]}")
    for k,v in env.items():
        if k not in order: lines.append(f"{k}={v}")
    ENV_PATH.write_text("\n".join(lines)+"\n")
    cprint(f"✓ .env saved ({ENV_PATH})", "g")

def ensure_env_defaults(env):
    changed=False
    if "JWT_SECRET" not in env or len(env.get("JWT_SECRET","")) < 32:
        import secrets
        env["JWT_SECRET"] = secrets.token_urlsafe(48)
        changed=True
    if "ADMIN_USER" not in env: env["ADMIN_USER"]="shadowphantom"; changed=True
    if "ADMIN_PASS" not in env: env["ADMIN_PASS"]="Shadow@123456"; changed=True
    if "PORT" not in env: env["PORT"]="3000"; changed=True
    if "HOST" not in env: env["HOST"]="0.0.0.0"; changed=True
    if "DISABLE_AUTH" not in env: env["DISABLE_AUTH"]="false"; changed=True
    if "DATABASE_TYPE" not in env:
        # auto-detect
        if env.get("MONGODB_URI"): env["DATABASE_TYPE"]="mongo"
        else: env["DATABASE_TYPE"]="local"
        changed=True
    if changed: write_env(env)
    return env

def get_vps_ip():
    ip="127.0.0.1"
    try:
        # try hostname -I
        out=subprocess.check_output("hostname -I 2>/dev/null | awk '{print $1}'", shell=True, text=True).strip()
        if out: ip=out
    except: pass
    try:
        # try public IP
        out=subprocess.check_output("curl -s -m 3 ifconfig.me 2>/dev/null || curl -s -m 3 ipinfo.io/ip 2>/dev/null", shell=True, text=True).strip()
        if out and re.match(r"^\d+\.\d+\.\d+\.\d+$", out):
            # keep private ip for LAN, but also show public
            return ip, out
    except: pass
    return ip, None

def banner():
    print(f"""
{C['c']}{C['bold']}╔════════════════════════════════════════════════╗
║  🕷️  BHNSTOCK SMS SPREADER — Brand New Day     ║
║     VPS Launcher • Fast • Anywhere             ║
╚════════════════════════════════════════════════╝{C['rst']}
{C['dim']}  run.py — 1) Set Database  2) Launch{C['rst']}
""")

def set_database():
    cprint("\n━━━ Set Database ━━━", "b")
    env=read_env()
    env=ensure_env_defaults(env)
    cur=env.get("DATABASE_TYPE","local")
    cprint(f"Current: {cur} | MONGODB_URI={'set' if env.get('MONGODB_URI') else 'not set'}", "dim")
    print(f"""
 {C['g']}1{C['rst']}) MongoDB (Atlas / VPS mongo://)
 {C['y']}2{C['rst']}) Local   (SQLite ./data/local.db — zero config, VPS offline ok)
 {C['dim']}3) Back{C['rst']}
""")
    ch=input(f"{C['c']}Select [1/2/3]: {C['rst']}").strip()
    if ch=="1":
        uri=input(f"{C['y']}Enter MONGODB_URI (mongo+srv://...): {C['rst']}").strip()
        if not uri:
            cprint("✗ empty URI", "r"); return
        if not uri.startswith("mongodb"):
            cprint("✗ must start with mongodb:// or mongodb+srv://", "r"); return
        env["DATABASE_TYPE"]="mongo"
        env["MONGODB_URI"]=uri
        write_env(env)
        cprint("Testing MongoDB connection...", "dim")
        try:
            # quick test via node
            test_js = f"""
import mongoose from 'mongoose';
await mongoose.connect('{uri}', {{serverSelectionTimeoutMS:5000}});
console.log('ok');
await mongoose.disconnect();
"""
            pathlib.Path("/tmp/mongo_test.mjs").write_text(test_js)
            run("node /tmp/mongo_test.mjs", check=True)
            cprint("✓ MongoDB connected!", "g")
        except Exception as e:
            cprint(f"⚠ Could not verify (maybe network), but saved. Error: {e}", "y")
        cprint(f"✓ Database set to MONGO ({uri[:40]}...)", "g")
    elif ch=="2":
        env["DATABASE_TYPE"]="local"
        # keep MONGODB_URI but not required
        write_env(env)
        DATA_DIR.mkdir(exist_ok=True)
        cprint(f"✓ Database set to LOCAL (SQLite)", "g")
        cprint(f"  File: {LOCAL_DB} (auto-created on launch)", "dim")
        # init local db now
        try:
            run("node -e \"import('./src/server/db/local.js').then(m=>m.initLocalDB().then(()=>console.log('local db ready'))).catch(e=>console.error(e))\"", shell=True, check=False)
        except: pass
        cprint("✓ Local DB ready", "g")
    else:
        return
    input(f"{C['dim']}Press Enter to continue...{C['rst']}")

def launch():
    cprint("\n━━━ Launch ━━━", "b")
    env=read_env()
    env=ensure_env_defaults(env)
    dbt=env.get("DATABASE_TYPE","mongo")
    port=env.get("PORT","3000")
    host=env.get("HOST","0.0.0.0")
    cprint(f"DB: {dbt} | HOST={host} PORT={port} | ADMIN={env.get('ADMIN_USER')}", "dim")
    # checks
    if dbt=="mongo" and not env.get("MONGODB_URI"):
        cprint("✗ DATABASE_TYPE=mongo but MONGODB_URI missing! Run Set Database first.", "r")
        return
    if not shutil.which("node"):
        cprint("✗ node not found. Install Node 20+ first: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs", "r")
        return
    # npm install if needed
    if not (ROOT/"node_modules").exists():
        cprint("Installing deps (npm install)...", "y")
        run("npm install --prefer-offline", check=False)
    # build client
    cprint("Building client (vite)...", "dim")
    try:
        run("npx vite build", check=True)
        cprint("✓ Build done", "g")
    except:
        cprint("⚠ Build failed, trying npm run build...", "y")
        run("npm run build", check=False)
    # build server
    cprint("Building server (tsc)...", "dim")
    try:
        run("npx tsc -p tsconfig.server.json", check=False)
    except: pass
    # detect IPs
    priv, pub = get_vps_ip()
    cprint(f"\n{C['g']}🚀 Starting server...{C['rst']}", "g")
    print(f"{C['c']}  Local:   http://localhost:{port}{C['rst']}")
    print(f"{C['c']}  LAN:     http://{priv}:{port}{C['rst']}")
    if pub and pub!=priv:
        print(f"{C['g']}  Public:  http://{pub}:{port}{C['rst']}  ← open anywhere (security group allow {port}/tcp){C['rst']}")
    print(f"{C['dim']}  Logs: tail -f ./logs/app.log   Stop: Ctrl+C{C['rst']}\n")
    # ensure logs dir
    (ROOT/"logs").mkdir(exist_ok=True)
    # run with env HOST PORT
    env_run=os.environ.copy()
    env_run.update(env)
    env_run["HOST"]="0.0.0.0"
    # use tsx for dev or node for prod
    cmd = ["npx","tsx","src/server/index.ts"]
    if (ROOT/"dist"/"server"/"index.js").exists():
        cmd = ["node","dist/server/index.js"]
    # Also support PM2 if available
    use_pm2 = shutil.which("pm2") and "--pm2" in sys.argv
    if use_pm2:
        cprint("Using PM2...", "y")
        run(f"pm2 start {' '.join(cmd)} --name spreder --env PORT={port} --env HOST=0.0.0.0", shell=True, check=False)
        run("pm2 save", shell=True, check=False)
        cprint("✓ PM2 started. pm2 logs spreder | pm2 stop spreder", "g")
        return
    # Background mode: if --bg in args or user wants always background + tunnel
    bg = "--bg" in sys.argv or os.environ.get("RUN_BG")=="1"
    if bg:
        # background + tunnel + URL
        import time as _time
        (ROOT/"logs").mkdir(exist_ok=True)
        cprint(f"\n🚀 Starting in BACKGROUND (always) + tunnel...", "g")
        # server bg
        log_path=ROOT/"logs"/"app.log"
        with open(log_path,"ab") as lf:
            proc=subprocess.Popen(cmd, cwd=ROOT, env=env_run, stdout=lf, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True)
        cprint(f"✓ Server PID {proc.pid} → logs/app.log", "g")
        _time.sleep(3)
        # quick health
        try:
            import urllib.request
            urllib.request.urlopen(f"http://localhost:{port}/api/health", timeout=3).read()
            cprint(f"✅ http://localhost:{port} LIVE", "g")
        except: cprint(f"⚠ http://localhost:{port} not yet, check logs/app.log", "y")
        # tunnel bg
        try:
            cf=ROOT/"cloudflared"
            if not cf.exists():
                cprint("Downloading cloudflared...", "dim")
                subprocess.run("curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared && chmod +x cloudflared", shell=True, cwd=ROOT)
            tlog=ROOT/"logs"/"tunnel.log"
            # kill old
            subprocess.run("pkill -f cloudflared 2>/dev/null; sleep 1", shell=True)
            with open(tlog,"ab") as tf:
                subprocess.Popen([str(cf),"tunnel","--url",f"http://localhost:{port}"], cwd=ROOT, stdout=tf, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True)
            cprint(f"✓ Tunnel starting → logs/tunnel.log", "g")
            for i in range(8):
                _time.sleep(1)
                if tlog.exists():
                    txt=tlog.read_text()
                    import re
                    m=re.search(r"https://[^\s]+trycloudflare\.com", txt)
                    if m:
                        url=m.group(0)
                        cprint(f"\n🌐 TUNNEL URL (khi se bhi open): {url}", "c")
                        cprint(f"   VPS URL: http://{priv}:{port} (LAN) + http://{pub}:{port} (public, if FW open)", "dim")
                        break
            else:
                cprint(f"⚠ Tunnel URL not yet, cat logs/tunnel.log", "y")
        except Exception as e: cprint(f"Tunnel fail: {e}", "r")
        cprint(f"\n✅ Background me hamesha chalega — logs: tail -f logs/app.log | pkill -f \"tsx src/server\" to stop", "g")
        return
    try:
        # foreground stream logs
        proc=subprocess.Popen(cmd, cwd=ROOT, env=env_run)
        cprint(f"PID {proc.pid} — Press Ctrl+C to stop", "dim")
        proc.wait()
    except KeyboardInterrupt:
        cprint("\nStopping...", "y")
        try: proc.terminate()
        except: pass
        cprint("✓ Stopped", "g")

def main():
    banner()
    env=read_env()
    if not ENV_PATH.exists():
        cprint("No .env found — creating default (LOCAL)...", "y")
        env=ensure_env_defaults(env)
        env["DATABASE_TYPE"]="local"
        write_env(env)
    # auto-check
    env=ensure_env_defaults(read_env())
    priv, pub = get_vps_ip()
    cprint(f"VPS IP: {priv}" + (f" / {pub} (public)" if pub else "") + f" | DB: {env.get('DATABASE_TYPE')} | Port: {env.get('PORT')}", "dim")
    while True:
        print(f"""
{C['bold']}Menu:{C['rst']}
 {C['g']}1{C['rst']}) Set Database   (MongoDB vs Local)
 {C['b']}2{C['rst']}) Launch         (0.0.0.0:{env.get('PORT',3000)} → open anywhere)
 {C['m']}3{C['rst']}) Run Tests      (20 tests)
 {C['y']}4{C['rst']}) Show Env & IPs
 {C['r']}5{C['rst']}) Exit
""")
        ch=input(f"{C['c']}Choice [1-5]: {C['rst']}").strip()
        if ch=="1": set_database(); env=ensure_env_defaults(read_env())
        elif ch=="2": launch()
        elif ch=="3":
            cprint("Running 20 tests...", "y")
            run("npm test 2>&1 | head -n 100", shell=True, check=False)
            input(f"{C['dim']}Press Enter...{C['rst']}")
        elif ch=="4":
            print(f"\n{C['bold']}.env:{C['rst']}"); print(ENV_PATH.read_text() if ENV_PATH.exists() else "(none)")
            priv, pub = get_vps_ip()
            print(f"\n{C['bold']}IPs:{C['rst']} priv={priv} pub={pub}")
            pub_url = f"http://{pub}:{env.get('PORT')}" if pub else ""
            print(f"{C['dim']}HOST=0.0.0.0 PORT={env.get('PORT')} → http://{priv}:{env.get('PORT')} + {pub_url}{C['rst']}")
            input(f"{C['dim']}Press Enter...{C['rst']}")
        elif ch=="5": cprint("Bye! 🕷️", "g"); sys.exit(0)

if __name__=="__main__":
    try: main()
    except KeyboardInterrupt: print("\nBye!"); sys.exit(0)
