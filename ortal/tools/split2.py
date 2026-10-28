# cut a take of short shouts into separate files by loudness (not silence), for breathy recordings
import array, math, subprocess, sys
src, outdir, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
thr = float(sys.argv[4]) if len(sys.argv) > 4 else -30
gap = float(sys.argv[5]) if len(sys.argv) > 5 else 0.25
raw = subprocess.run(['ffmpeg','-v','error','-i',src,'-ac','1','-ar','8000','-f','s16le','-'],capture_output=True).stdout
a = array.array('h', raw); win = 160
on = []
for i in range(0, len(a) - win, win):
    s = sum(x*x for x in a[i:i+win]) / win
    on.append(20*math.log10(math.sqrt(s)/32768 + 1e-9) > thr)
segs = []; start = None; last = None
for k, v in enumerate(on):
    t = k * 0.02
    if v:
        if start is None: start = t
        elif t - last > gap: segs.append((start, last)); start = t
        last = t
if start is not None: segs.append((start, last))
segs = [(s, e) for s, e in segs if e - s >= 0.08]
print(len(segs), 'segments', [(round(s,2), round(e,2)) for s, e in segs])
if len(segs) != len(names): sys.exit(1)
for (s, e), n in zip(segs, names):
    s = max(0, s - 0.04); e = e + 0.15
    subprocess.run(['ffmpeg','-y','-v','error','-ss',f'{s:.3f}','-to',f'{e:.3f}','-i',src,'-af','afade=t=in:d=0.01,areverse,afade=t=in:d=0.05,areverse','-ac','1','-b:a','64k',f'{outdir}/{n}.mp3'],check=True)
print('ok')
