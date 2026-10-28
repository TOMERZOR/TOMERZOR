# keep only the first burst of a vocal sound effect, trimmed, peak-normalised, faded
import subprocess, array, math, sys
src, dst, maxlen = sys.argv[1], sys.argv[2], float(sys.argv[3])
raw = subprocess.run(['ffmpeg','-v','error','-i',src,'-ac','1','-ar','8000','-f','s16le','-'],capture_output=True).stdout
a = array.array('h', raw); win = 80
env = []
for i in range(0, len(a) - win, win):
    s = sum(x*x for x in a[i:i+win]) / win
    env.append(20*math.log10(math.sqrt(s)/32768 + 1e-9))
dt = win / 8000
start = next(i for i, e in enumerate(env) if e > -30)
end = start; quiet = 0
for i in range(start, len(env)):
    if env[i] > -34: end = i; quiet = 0
    else:
        quiet += dt
        if quiet > 0.14: break
s = max(0, start*dt - 0.02); e = min(end*dt + 0.08, s + maxlen)
fade = min(0.08, (e - s) / 3)
subprocess.run(['ffmpeg','-y','-v','error','-ss',f'{s:.3f}','-to',f'{e:.3f}','-i',src,
  '-af',f'afade=t=in:d=0.008,areverse,afade=t=in:d={fade:.3f},areverse,dynaudnorm=f=150:g=5:p=0.95,volume=0.95',
  '-ac','1','-ar','44100','-b:a','80k',dst], check=True)
print(dst, round(e - s, 2))
