# Builds the film's sound: the effects stem from the cue list (minus the riser, which the music now does),
# the music stretched from 127 to the film's 128 BPM and cut so its first drop lands on film beat 8.
import json, subprocess, sys
W = sys.argv[1]
cues = json.load(open(f'{W}/src/sfx/cues.json'))
D = cues['duration']
keep = [c for c in cues['cues'] if 'riser' not in c['id']]
args, chains = [], []
for i, c in enumerate(keep):
    args += ['-i', f"{W}/src/sfx/{c['src']}"]
    ms = int(round(c['start'] * 1000))
    chains.append(f"[{i}:a]atrim=start={c['media']}:duration={c['dur']},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume={c['vol']},adelay={ms}|{ms}[s{i}]")
mix = ''.join(f'[s{i}]' for i in range(len(keep))) + f"amix=inputs={len(keep)}:normalize=0:duration=longest,apad=whole_dur={D},atrim=end={D}[out]"
subprocess.run(['ffmpeg', '-v', 'error', '-y', *args, '-filter_complex', ';'.join(chains) + ';' + mix, '-map', '[out]', '-c:a', 'pcm_f32le', f'{W}/audio/sfx.wav'], check=True)
# music: tempo 127 -> 128 (measured beat period 0.47243 s -> 0.46875 s), then the window that puts track beat 32 (the drop) on film beat 8
f = 0.47243 / 0.46875
start = 24 * 0.46875  # track beat 24 in stretched time = film 0
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{W}/audio/golden-storm.mp3', '-af', f'aresample=48000,rubberband=tempo={f:.6f}', '-c:a', 'pcm_f32le', f'{W}/audio/music_128.wav'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{W}/audio/music_128.wav', '-af', f'atrim=start={start}:duration={D},asetpts=PTS-STARTPTS,afade=t=in:d=0.25,afade=t=out:st={D - 1.5}:d=1.5', '-c:a', 'pcm_f32le', f'{W}/audio/music_cut.wav'], check=True)
print('stems:', len(keep), 'cues; music window', round(start, 3), '+', D, 's at tempo x', round(f, 6))
