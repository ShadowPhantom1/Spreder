import numpy as np
import wave
import math

sr = 44100
duration = 12  # seconds
t = np.linspace(0, duration, int(sr*duration), False)

# phonk vibe: slowed + reverb, memphis, cowbell + 808
audio = np.zeros_like(t)

bpm = 142
beat = 60/bpm  # ~0.422s per beat
# kick pattern: 4 on floor
for i in range(int(duration/beat)):
    start = int(i*beat*sr)
    # 808 kick: sine 55hz decaying + pitch drop
    kick_len = int(0.35*sr)
    if start+kick_len < len(audio):
        kt = np.linspace(0, 0.35, kick_len)
        freq = 110 * np.exp(-15*kt) + 45  # pitch drop
        kick = np.sin(2*np.pi*freq*kt) * np.exp(-8*kt) * 0.9
        # distortion
        kick = np.tanh(kick*2.2) * 0.7
        audio[start:start+kick_len] += kick
        # hihat offbeat
        if i%2==1:
            hat_len = int(0.08*sr)
            ht = np.linspace(0,0.08, hat_len)
            hat = np.random.uniform(-1,1, hat_len) * np.exp(-30*ht) * 0.15
            audio[start:start+hat_len] += hat

# cowbell phonk signature every 2 beats
for i in range(0, int(duration/beat), 2):
    start = int(i*beat*sr + 0.15*sr)
    bell_len = int(0.6*sr)
    if start+bell_len < len(audio):
        bt = np.linspace(0,0.6, bell_len)
        # cowbell 740hz + 880hz
        bell = (np.sin(2*np.pi*740*bt) + np.sin(2*np.pi*880*bt))*0.5 * np.exp(-6*bt) * 0.28
        bell = bell * (1 + 0.3*np.sin(2*np.pi*5*bt)) # tremolo
        audio[start:start+bell_len] += bell

# 808 bassline slowed - two notes alternating
for i in range(int(duration/2)):
    # 2 sec per note
    start = int(i*2*sr)
    note_len = int(1.8*sr)
    if start+note_len < len(audio):
        freq = 45 if i%2==0 else 38  # F1 ~ 43hz phonk
        bt = np.linspace(0,1.8, note_len)
        bass = np.sin(2*np.pi*freq*bt) * np.exp(-0.8*bt) * 0.55
        # slide
        slide = np.linspace(freq, freq*0.97, note_len)
        bass = np.sin(2*np.pi*slide*bt) * 0.55 * np.exp(-0.6*bt)
        bass = np.tanh(bass*1.8) * 0.5
        # lowpass vibe
        audio[start:start+note_len] += bass

# memphis vocal chop? simple pitch-shifted "yeah" via sine 200hz burst
for i in range(3):
    start = int((1.2 + i*4)*sr)
    vlen = int(0.4*sr)
    vt = np.linspace(0,0.4, vlen)
    vocal = np.sin(2*np.pi*180*vt) * np.exp(-4*vt) * 0.12
    vocal += np.sin(2*np.pi*360*vt) * np.exp(-5*vt) * 0.06
    audio[start:start+vlen] += vocal

# master
audio = audio / np.max(np.abs(audio)) * 0.89
# add slight vinyl crackle
audio += np.random.uniform(-1,1, len(audio)) * 0.008 * (np.abs(audio)<0.1)

# convert to stereo
stereo = np.column_stack([audio, audio * 0.95])
# slight stereo delay
delay = int(0.012*sr)
stereo[delay:,1] = stereo[:-delay,1]*0.85 + stereo[delay:,1]*0.15

# quantize
audio_i16 = (stereo * 32767).astype(np.int16)

# write wav
with wave.open('public/phonk-loop.wav','w') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes(audio_i16.tobytes())

with wave.open('dist/client/phonk-loop.wav','w') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes(audio_i16.tobytes())

# also create mp3 placeholder copy (wav but named mp3 for fallback? browsers can play wav as mp3 if correct mime? better keep wav)
# we will use wav directly via <audio src="/phonk-loop.wav">
print("phonk wav written 12s stereo")

# also create voice welcome? keep existing
