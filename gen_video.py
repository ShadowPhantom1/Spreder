import cv2
import numpy as np
import math

W, H = 1280, 720
fps = 30
dur = 8
frames = fps*dur
out_path = 'public/bg-phonk.mp4'
out_path2 = 'dist/client/bg-phonk.mp4'

fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(out_path, fourcc, fps, (W,H))

# also try to write second copy via same writer? We'll write one then copy
for i in range(frames):
    t = i/fps
    # base dark
    img = np.zeros((H,W,3), dtype=np.uint8)
    # gradient: dark blue to purple
    for y in range(H):
        ratio = y/H
        r = int(10 + 18*ratio + 12*math.sin(t*0.6 + ratio*2))
        g = int(12 + 8*ratio)
        b = int(36 + 70*ratio + 20*math.sin(t*0.4))
        # blend purple phonk
        # add phonk pulse
        pulse = 12*math.sin(t*1.8)
        b = np.clip(b + pulse, 0,255)
        r = np.clip(r + pulse*0.6, 0,255)
        img[y,:] = (b,g,r)  # opencv BGR

    # moving web lines
    cols = 6
    for c in range(cols):
        x = int(W*(c+0.5)/cols + math.sin(t*0.7 + c)*90)
        cv2.line(img, (x,0), (x+ int(30*math.sin(t+c)), H), (255,255,255), 1, cv2.LINE_AA)
        # glow
        cv2.line(img, (x,0), (x+ int(30*math.sin(t+c)), H), (180,80,255), 2, cv2.LINE_AA)

    # concentric circles aura
    cx, cy = W//2, H//2
    for rad in [180, 260, 340, 420]:
        rr = int(rad + math.sin(t*1.2)*14)
        color = (90, 30, 230) if rad%2==0 else (220, 40, 60)  # BGR purple/red
        alpha = 0.35 + 0.15*math.sin(t*2 + rad*0.01)
        overlay = img.copy()
        cv2.circle(overlay, (cx,cy), rr, color, 2, cv2.LINE_AA)
        cv2.addWeighted(overlay, alpha, img, 1-alpha, 0, img)

    # spider web radial
    spokes = 10
    for s in range(spokes):
        ang = 2*math.pi*s/spokes + t*0.15
        x2 = int(cx + math.cos(ang)*480)
        y2 = int(cy + math.sin(ang)*480)
        cv2.line(img, (cx,cy), (x2,y2), (255,255,255), 1, cv2.LINE_AA)

    # pulsing neon spider in center
    scale = 1 + 0.06*math.sin(t*2.5)
    # draw simple spider shape via ellipse + lines
    # glow behind
    cv2.circle(img, (cx,cy), int(90*scale), (255,0,120), -1, cv2.LINE_AA)
    cv2.circle(img, (cx,cy), int(74*scale), (20,8,40), -1, cv2.LINE_AA)
    # spider body
    cv2.ellipse(img, (cx,cy), (int(44*scale), int(62*scale)), 0, 0,360, (230,20,20), -1, cv2.LINE_AA)
    cv2.ellipse(img, (cx,cy), (int(36*scale), int(52*scale)), 0, 0,360, (255,255,255), 1, cv2.LINE_AA)
    # eyes
    cv2.ellipse(img, (cx-14, cy-10), (18,22), -18, 0,360, (240,240,255), -1, cv2.LINE_AA)
    cv2.ellipse(img, (cx+14, cy-10), (18,22), 18, 0,360, (240,240,255), -1, cv2.LINE_AA)
    cv2.ellipse(img, (cx-14, cy-10), (12,16), -18, 0,360, (10,10,30), -1, cv2.LINE_AA)
    cv2.ellipse(img, (cx+14, cy-10), (12,16), 18, 0,360, (10,10,30), -1, cv2.LINE_AA)
    # legs aura
    for leg in range(4):
        ang = -70 + leg*45 + math.sin(t*3+leg)*4
        rad = math.radians(ang)
        x1 = int(cx + math.cos(rad)*50)
        y1 = int(cy + math.sin(rad)*30)
        x2 = int(cx + math.cos(rad)*110)
        y2 = int(cy + math.sin(rad)*90)
        cv2.line(img, (x1,y1), (x2,y2), (180,50,255), 3, cv2.LINE_AA)
        # mirrored other side
        cv2.line(img, (cx*2 - x1, y1), (cx*2 - x2, y2), (180,50,255), 3, cv2.LINE_AA)

    # scanline
    if i%3==0:
        for sy in range(0,H,6):
            img[sy:sy+1,:] = (img[sy:sy+1,:]*0.85).astype(np.uint8)

    # vignette
    vign = np.zeros((H,W), dtype=np.float32)
    cv2.circle(vign, (cx,cy), 620, 1, -1, cv2.LINE_AA)
    vign = cv2.GaussianBlur(vign, (201,201), 0)
    vign = np.stack([vign]*3, axis=2)
    img = (img.astype(np.float32)*(0.72+0.28*vign)).astype(np.uint8)

    # text BHNSTOCK watermark bottom
    cv2.putText(img, "BHNSTOCK  PHONK  3D  WEB", (W//2-210, H-42), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (255,210,50), 2, cv2.LINE_AA)
    cv2.putText(img, "BRAND NEW DAY  •  ANDREW GARFIELD", (W//2-210, H-18), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255,255,255), 1, cv2.LINE_AA)

    out.write(img)

out.release()
print(f"video written {out_path} {frames} frames")

# copy to dist
import shutil
shutil.copy(out_path, out_path2)
print(f"copied to {out_path2}")

# verify
import os
print(os.path.getsize(out_path), "bytes")
