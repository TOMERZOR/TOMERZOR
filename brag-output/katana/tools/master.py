# The Katana finish: the effects stem rebuilt with accents that must cut through the music, the music ducked
# a few dB under each hit, the sum brought to the target loudness through a limiter, and the picture copied.
# usage: python3 tools/master.py $W [music_gain_db] [target_lufs]
import json, re, subprocess, sys
W = sys.argv[1]
G = float(sys.argv[2]) if len(sys.argv) > 2 else -7.5
TARGET = float(sys.argv[3]) if len(sys.argv) > 3 else -12.0
cues = json.load(open(f'{W}/src/sfx/cues.json'))
D = cues['duration']

def emphasis(c):
    name = c['id'].split('-', 1)[1]
    if name == 'pop': return 3.5                               # the twelve balls landing
    if name == 'click-soft' and c['start'] > 13: return 3.0    # one tick per world
    if name.startswith('whoosh'): return 2.0                   # moves that ride on top of the drop
    if name == 'game-glass-rev': return 1.6                    # the shards flying back into the logo
    if name in ('game-hero', 'game-ember', 'game-night'): return 1.41  # the game's own glass and bells
    return 1.0

keep = [c for c in cues['cues'] if 'riser' not in c['id']]
args, chains = [], []
for i, c in enumerate(keep):
    args += ['-i', f"{W}/src/sfx/{c['src']}"]
    ms = int(round(c['start'] * 1000))
    chains.append(f"[{i}:a]atrim=start={c['media']}:duration={c['dur']},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume={c['vol'] * emphasis(c):.4f},adelay={ms}|{ms}[s{i}]")
mix = ''.join(f'[s{i}]' for i in range(len(keep))) + f"amix=inputs={len(keep)}:normalize=0:duration=longest,apad=whole_dur={D},atrim=end={D}[out]"
subprocess.run(['ffmpeg', '-v', 'error', '-y', *args, '-filter_complex', ';'.join(chains) + ';' + mix, '-map', '[out]', '-c:a', 'pcm_f32le', f'{W}/audio/sfx_mix.wav'], check=True)

fc = (f"[0:a]volume={G}dB[m];[1:a]asplit=2[s][k];"
      "[m][k]sidechaincompress=threshold=0.05:ratio=1.6:attack=8:release=220:knee=4:detection=rms[md];"
      f"[md][s]amix=inputs=2:normalize=0:duration=first,atrim=end={D}[mix]")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{W}/audio/music_cut.wav', '-i', f'{W}/audio/sfx_mix.wav', '-filter_complex', fc, '-map', '[mix]', '-c:a', 'pcm_f32le', f'{W}/audio/mix_raw.wav'], check=True)

def loud(path):
    log = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', log)[-1]); TP = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', log)[-1])
    return I, TP

I0, _ = loud(f'{W}/audio/mix_raw.wav')
gain = TARGET - I0
out = f'{W}/out/shard_katana_master.mp4'
for limit in (0.84, 0.79, 0.75, 0.71):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{W}/src/shard-brag-source.mp4', '-i', f'{W}/audio/mix_raw.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                    '-af', f'volume={gain:.2f}dB,alimiter=limit={limit}:attack=1:release=40:level=disabled', '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', '-t', str(D), '-movflags', '+faststart', out], check=True)
    I, TP = loud(out)
    if TP <= -1.0: break
json.dump({'music_gain_db': G, 'target_lufs': TARGET, 'mix_raw_lufs': I0, 'gain_db': round(gain, 2), 'limiter': limit, 'lufs': I, 'true_peak_dbtp': TP}, open(f'{W}/qa/master.json', 'w'), indent=1)
print({'raw': I0, 'gain': round(gain, 2), 'limit': limit, 'LUFS': I, 'TP': TP})
