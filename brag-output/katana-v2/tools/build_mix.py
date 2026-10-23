#!/usr/bin/env python3
"""The SHARD film soundtrack (v2, 48.4 s): Take this Higher (Mixkit 1012) from 0 s with a closing fade, a bed of recorded
CC0 library effects (sfx.py bed), a bed of the game's own sounds synced to the picture, and every glass break on one
softened bus (a presence dip, a gentler top and the game's small room). Writes
audio/mix.wav (48 kHz stereo, exactly the film length) and audio/mix.m4a (AAC 256k) and prints the encoded
loudness. Run from the workspace: python3 tools/build_mix.py"""
import json, os, subprocess, sys

W = os.getcwd()
RR = os.path.expandvars('$HF_WORKFLOWS/katana/scripts')
DUR = 1452 / 30
BEAT, B0 = 0.48388, -0.0016
tb = lambda b: B0 + b * BEAT
GS = 'src/sfx/assets/sfx/'      # the game's recorded effects (+ two Pixabay edits from the first film)
ST2 = 'src/game2/'               # each level's own game sound, rebuilt from the game's sound log during capture

# ---- library effects (CC0): t = where the sound's onset lands; whooshes into a cut start at cut - their peak
L = lambda t, f, g=0: {'t': round(t, 4), 'file': f, 'gain_db': g}
lib = [
    L(3.12, 'whoosh/swish__swosh-03.ogg', -2),
    L(3.87, 'scan/sf50__terminal_09.ogg', -2), L(4.32, 'ui_blip/kui__switch1.ogg'),
    L(5.81, 'boom/kimp__impactPunch_heavy_000.ogg', -4), L(7.2, 'whoosh/swish__swosh-13.ogg'),
    L(tb(16), 'boom/ksci__lowFrequency_explosion_000.ogg'),
    L(tb(16.5), 'hit/kimp__impactPlate_heavy_003.ogg', -3),
    L(tb(20), 'hit/kimp__impactMetal_light_003.ogg', -2), L(9.78, 'scan/sf60__sfx_08a.ogg', -3),
    L(tb(24), 'boom/ksci__explosionCrunch_000.ogg', -4), L(tb(24) + 0.02, 'whoosh/swish__swosh-06.ogg', -2),
    # a soft click as each how-to-play caption arrives
    *[L(t, 'ui_blip/kui__click2.ogg', -4) for t in (12.0, 15.05, 17.05, tb(44) + 0.3, tb(56.5) + 0.12, 29.25)],
    # level -> world zoom-throughs (whoosh peaks on the cut), arrivals, whips back to the next level
    L(tb(41) - 0.569, 'longwhoosh/swish__swosh-38.ogg', -1),
    L(tb(44) - 0.1, 'whoosh/swish__swosh-01.ogg', -2),
    L(tb(53) - 0.609, 'longwhoosh/swish__swosh-35.ogg', -1), L(tb(53), 'boom/kimp__impactPunch_heavy_002.ogg', -4),
    L(tb(56.5) - 0.1, 'whoosh/swish__swosh-06.ogg', -2),
    L(tb(64) - 0.678, 'longwhoosh/swish__swosh-41.ogg', -1),
    L(tb(68) - 0.1, 'whoosh/swish__swosh-12.ogg', -2),
    L(tb(68) + 0.03, 'ui_blip/kui__rollover3.ogg', -4), L(tb(68) + 0.08, 'ui_blip/kui__rollover3.ogg', -5), L(tb(68) + 0.13, 'ui_blip/kui__rollover3.ogg', -6),
    *[L(tb(70) + 0.1 * i, 'type/key__keypress-006.ogg', 6) for i in range(6)],
    L(tb(76) - 0.2, 'whoosh/swish__swosh-14.ogg', -2),
    L(tb(76), 'whoosh/swish__swosh-20.ogg', -2), L(tb(76) + 0.07, 'ui_blip/kui__rollover4.ogg', -4), L(tb(76) + 0.17, 'ui_blip/kui__rollover4.ogg', -5),
    L(tb(84) - 0.17, 'dataswish/kdig__phaserUp7.ogg', -3),
    # the rewind and the logo
    L(tb(84), 'dataswish/kdig__phaserDown3.ogg', -4), L(tb(84) + 0.06, 'longwhoosh/swish__swosh-31.ogg', -6),
    L(tb(88), 'boom/ksci__lowFrequency_explosion_001.ogg'), L(tb(88) + 0.02, 'whoosh/swish__swosh-05.ogg', -2),
    L(tb(89.4), 'hit/kimp__impactMetal_light_000.ogg', -4), L(tb(89.4) + 0.11, 'scan/sf60__sfx_08b.ogg', -5),
]
os.makedirs('comp', exist_ok=True)
json.dump(lib, open('comp/sfx_cues.json', 'w'), indent=1)
subprocess.run([sys.executable, f'{RR}/sfx.py', 'bed', W, '--cues', 'comp/sfx_cues.json', '--music', 'music/1012.mp3', '--dur', f'{DUR:.4f}', '--out', 'audio/sfx_bed.wav'], check=True)

# ---- the game's own sounds: (file, at, gain dB, source in-point, source length, tempo, fade-out s)
G = [
    (GS + 'game-fire1.mp3', 5.80, -4), (GS + 'impact-1.mp3', tb(16), -3), (GS + 'sparkle.mp3', tb(20) + 0.02, -8),
    # the three levels' own sound, from their capture logs (capture/stems.py: the game's chain with softened glass, all
    # three at one fixed level; these gains keep the cannon, bombs and bells where they were and let the glass drop);
    # the level-clear chime of level 4 lifted so it is heard
    (ST2 + 'game-hero2.mp3', tb(24), 0.7, 0.75, 6.35, 1.0, 0.12),
    (ST2 + 'game-hero2.mp3', tb(24) + 6.35, 9.7, 7.1, tb(41) - tb(24) - 6.35, 1.0, 0.3),
    (GS + 'sparkle.mp3', tb(41) + 0.02, -10),
    (ST2 + 'game-ember2.mp3', tb(44), -2.6, 2.3, tb(53) - tb(44), 1.0, 0.25),
    (GS + 'game-boom1.mp3', tb(53), -6),
    (ST2 + 'game-night2.mp3', tb(56.5), 4.1, 2.708, tb(64) - tb(56.5), 1.0, 0.25),
    (GS + 'impact-2.mp3', tb(88), -2), (GS + 'game-boom1.mp3', tb(88), -8),
    (GS + 'sparkle.mp3', tb(89.4), -9),
]
ins, fc, labels = [], [], []
for i, g in enumerate(G):
    f, at, gain = g[:3]
    ins += ['-i', f]
    chain = [f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo']
    if len(g) > 3:
        ss, ln, tempo, fo = g[3:]
        chain.append(f'atrim=start={ss}:duration={ln * tempo:.4f},asetpts=PTS-STARTPTS,afade=t=in:d=0.03')
        if tempo != 1.0: chain.append(f'atempo={tempo}')
        chain.append(f'afade=t=out:st={max(0, ln - fo):.4f}:d={fo}')
    chain.append(f'volume={gain}dB,adelay={int(round(at * 1000))}:all=1')
    fc.append(','.join(chain) + f'[g{i}]'); labels.append(f'[g{i}]')
fc.append(''.join(labels) + f'amix=inputs={len(G)}:normalize=0:dropout_transition=0,atrim=end={DUR:.4f},apad=whole_dur={DUR:.4f}[out]')
subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', ';'.join(fc), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', 'audio/game_bed.wav'], check=True)

# ---- every glass break on one bus: one or two layers per moment, well under the hits' booms, the same softening as
# capture/stems.py (a presence dip and a gentler top) and the game's small room. (file, onset time, gain dB on the raw file)
import numpy as np
SR = 48000
LIB = f'{RR}/sfx_lib/'
SOFT = 'equalizer=f=3400:t=q:w=0.9:g=-5,highshelf=f=7000:g=-5,lowpass=f=12000'
GLASS = [
    (LIB + 'crack/kint__glass_005.ogg', 0.03, -22), (LIB + 'flash/kint__glass_004.ogg', 1.21, -27), (LIB + 'crack/kint__glass_003.ogg', 2.18, -24),
    (LIB + 'crack/kimp__impactGlass_heavy_000.ogg', tb(16), -12.5), (GS + 'game-glass_b1.mp3', tb(16), -6),
    (LIB + 'crack/kint__glass_001.ogg', 8.52, -20),
    (LIB + 'crack/kimp__impactGlass_heavy_002.ogg', tb(18), -12.5), (GS + 'game-glass_b2.mp3', tb(18), -9),
    (GS + 'game-glass-rev.mp3', tb(20) - 0.731, -5),
    (LIB + 'crack/kimp__impactGlass_medium_001.ogg', 11.37, -12),
    (LIB + 'crack/kimp__impactGlass_heavy_003.ogg', tb(24), -10.5), (GS + 'game-glass_b3.mp3', tb(24), -6),
    (LIB + 'flash/kimp__impactGlass_light_000.ogg', tb(41), -19),
    (LIB + 'flash/kimp__impactGlass_light_002.ogg', tb(64), -19),
    (LIB + 'crack/kimp__impactGlass_medium_004.ogg', tb(64) + 0.8, -13), (GS + 'game-glass_s2.mp3', tb(64) + 0.8, -9),
    (GS + 'game-glass-rev.mp3', tb(84), -5), (GS + 'game-glass-rev.mp3', tb(84) + 0.5, -7),
    (LIB + 'flash/kimp__impactGlass_light_002.ogg', tb(86.4), -19),
    (LIB + 'crack/kimp__impactGlass_heavy_000.ogg', tb(88), -9), (GS + 'game-glass_b1.mp3', tb(88), -8),
]
cat = {s['file']: s for s in json.load(open(LIB + 'catalog.json'))['sounds']}
with open('audio/sfx_licenses.txt', 'a', encoding='utf-8') as fh:  # sfx.py lists its own bed; the glass bus's library files join it
    for rel in sorted({f[len(LIB):] for f, _, _ in GLASS if f.startswith(LIB)}):
        s = cat[rel]; fh.write(f"{rel}  |  {s.get('pack')}  |  {s.get('author')}  |  {s.get('page')}  |  {s.get('license')}\n")
bus = np.zeros((int(DUR * SR) + 2 * SR, 2))
for f, t, g in GLASS:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-af', f'aresample={SR},aformat=channel_layouts=stereo,{SOFT}', '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    env = np.ones(len(x)); fi, fo = min(len(x), int(0.004 * SR)), min(len(x), int(0.02 * SR))
    env[:fi] = np.linspace(0, 1, fi); env[len(x) - fo:] *= np.linspace(1, 0, fo)
    a = max(0, int(round((t - cat.get(f[len(LIB):], {}).get('onset', 0.0)) * SR)))  # library sounds land on their onset
    n = min(len(x), len(bus) - a)
    bus[a:a + n] += (x * env[:, None] * 10 ** (g / 20))[:n]
# the game's small room (js/audio.js): 1.6 s of decaying stereo noise, scaled the way a Web Audio ConvolverNode normalises it
rng = np.random.default_rng(11); n = int(SR * 1.6)
ir = rng.uniform(-1, 1, (2, n)) * (1 - np.arange(n) / n) ** 3.2
ir *= 0.00125 / np.sqrt((ir ** 2).mean()) * 44100 / SR
m = 1 << (len(bus) + n - 2).bit_length()
wet = np.stack([np.fft.irfft(np.fft.rfft(bus[:, c] * 0.5, m) * np.fft.rfft(ir[c], m), m)[:len(bus)] for c in range(2)], 1)
bus = (bus + wet)[:int(DUR * SR)]
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le', 'audio/glass_bed.wav'],
               input=bus.astype(np.float32).tobytes(), check=True)

# ---- the mix: music ducked a little under the effects, a last-bar fade, a true-peak-safe limiter
fade_at = DUR - 1.6
mix = (f'[0:a]aresample=48000,aformat=channel_layouts=stereo,atrim=end={DUR:.4f},asetpts=PTS-STARTPTS,volume=-2.5dB,'
       f'afade=t=out:st={fade_at:.3f}:d={DUR - fade_at:.3f}:curve=qsin[m];'
       '[1:a][2:a][3:a]amix=inputs=3:normalize=0[fx];[fx]asplit=2[fxk][fxo];'
       '[m][fxk]sidechaincompress=threshold=0.08:ratio=3:attack=5:release=240:makeup=1[md];'
       f'[md][fxo]amix=inputs=2:normalize=0,volume=3.5dB,alimiter=limit=0.75:attack=4:release=60:level=disabled,atrim=end={DUR:.4f},apad=whole_dur={DUR:.4f}[out]')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'music/1012.mp3', '-i', 'audio/sfx_bed.wav', '-i', 'audio/game_bed.wav', '-i', 'audio/glass_bed.wav', '-filter_complex', mix,
                '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', 'audio/mix.wav'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'audio/mix.wav', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', 'audio/mix.m4a'], check=True)
log = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', 'audio/mix.m4a', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
import re
I = re.findall(r'I:\s+(-?[\d.]+) LUFS', log)[-1]; TP = re.findall(r'Peak:\s+(-?[\d.]+|-inf) dBFS', log)[-1]
dur = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'audio/mix.m4a'], capture_output=True, text=True).stdout.strip()
print(json.dumps({'mix': 'audio/mix.m4a', 'integrated_lufs': float(I), 'true_peak_dbtp': float(TP), 'duration': float(dur), 'library_cues': len(lib), 'game_cues': len(G), 'glass_cues': len(GLASS)}))
