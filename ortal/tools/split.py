import subprocess, re, sys
src, outdir, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
noise = sys.argv[4] if len(sys.argv) > 4 else '-38dB'
dur = float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',src],capture_output=True,text=True).stdout)
log = subprocess.run(['ffmpeg','-hide_banner','-i',src,'-af',f'silencedetect=noise={noise}:d=0.45','-f','null','-'],capture_output=True,text=True).stderr
starts=[float(x) for x in re.findall(r'silence_start: ([\d.]+)',log)]; ends=[float(x) for x in re.findall(r'silence_end: ([\d.]+)',log)]
segs=[]; cur=0.0
for s,e in zip(starts,ends):
    if s-cur>0.2: segs.append((cur,s))
    cur=e
if dur-cur>0.2: segs.append((cur,dur))
print(len(segs),'segments for',len(names),'names')
if len(segs)!=len(names): print(segs); sys.exit(1)
for (a,b),n in zip(segs,names):
    a=max(0,a-0.05); b=min(dur,b+0.12)
    subprocess.run(['ffmpeg','-y','-v','error','-ss',f'{a:.3f}','-to',f'{b:.3f}','-i',src,'-af','afade=t=in:d=0.02,areverse,afade=t=in:d=0.06,areverse','-ac','1','-b:a','64k',f'{outdir}/{n}.mp3'],check=True)
print('ok')
