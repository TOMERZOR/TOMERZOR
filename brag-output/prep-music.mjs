// Brings a music track into the film: measures its tempo, downbeats and sections with `hyperframes audio`,
// lines its strongest entrance (the drop) up with the reveal on beat 8, loops a short library bed so it covers
// the whole cut, and writes assets/bgm/track.json for build.mjs.
// usage: node prep-music.mjs <track.mp3|wav> [--drop <seconds>] [--bpm <n>]   (then: node build.mjs)
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const [src, ...rest] = process.argv.slice(2);
if (!src) { console.error('usage: node prep-music.mjs <track> [--drop <seconds>] [--bpm <n>]'); process.exit(1); }
const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? +rest[i + 1] : null; };
const COMP = new URL('./composition/', import.meta.url).pathname;
const DIR = `${COMP}assets/bgm/`;
const BEATS = 48, DROP_BEAT = 8; // as in build.mjs: the cut is 48 beats long and the reveal sits on beat 8
mkdirSync(DIR, { recursive: true });
const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1' };

const a = JSON.parse(execFileSync('npx', ['hyperframes', 'audio', src, '--json', '--only', 'beats,downbeats,bpm,sections,loudness'], { env, encoding: 'utf8', cwd: COMP, maxBuffer: 1 << 26 })).items[0];

// tempo: the tracker's value, else the median beat gap; folded into a dance range (trackers often report double or half time)
const beats = a.beats?.times ?? [];
const gaps = beats.slice(1).map((t, i) => t - beats[i]).sort((x, y) => x - y);
let bpm = opt('--bpm') ?? a.bpm?.value ?? (gaps.length ? 60 / gaps[gaps.length >> 1] : null);
if (!bpm) { console.error(`no steady beat found in ${src} (${a.beats?.reason ?? 'unknown'}); pass --bpm <n> and --drop <seconds>`); process.exit(1); }
while (bpm > 165) bpm /= 2;
while (bpm < 85) bpm *= 2;
const beatLen = 60 / bpm;
const downbeats = a.downbeats?.times ?? [];

// the drop: given by hand, else the section that starts with the biggest jump in loudness (measured here, since
// the analysis labels sections but doesn't rate them), else the first downbeat at or after beat 8
const rms = (from, to) => {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', String(from), '-t', String(Math.max(0.1, to - from)), '-i', src, '-af', 'astats=metadata=0', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const all = [...log.matchAll(/RMS level dB: (-?[\d.]+|-inf)/g)];
  const v = all.length ? all[all.length - 1][1] : '-inf';
  return v === '-inf' ? -120 : +v;
};
const spans = a.sections?.spans ?? [];
let drop = opt('--drop');
if (drop == null && spans.length > 1) {
  const level = spans.map((s) => rms(s.start, Math.min(s.end, s.start + 8 * beatLen)));
  const best = spans.slice(1).map((s, i) => ({ t: s.start, gain: level[i + 1] - level[i] })).sort((x, y) => y.gain - x.gain)[0];
  if (best.gain > 1.5) drop = best.t;
}
if (drop == null) drop = downbeats.find((t) => t >= DROP_BEAT * beatLen - 0.05) ?? DROP_BEAT * beatLen;
// onto the grid: a downbeat when one is close (trackers sometimes put the bar line a beat off), else the nearest beat
const nearest = (list, t) => list.reduce((x, y) => (Math.abs(y - t) < Math.abs(x - t) ? y : x), Infinity);
const bar = nearest(downbeats, drop), hit = nearest(beats, drop);
if (Math.abs(bar - drop) <= beatLen / 4) drop = bar;
else if (Math.abs(hit - drop) <= beatLen / 2) drop = hit;

// where it sits in the film: the drop lands on beat 8; a drop that comes early means the music enters mid-hook
const lead = DROP_BEAT * beatLen;
const start = drop >= lead ? 0 : lead - drop; // film time the music begins
const offset = drop >= lead ? drop - lead : 0; // track time at that moment
const need = offset + BEATS * beatLen - start + 0.5;
const loops = Math.max(0, Math.ceil(need / a.duration) - 1);

// one clean copy, looped when the bed is shorter than the film: 48 kHz stereo, peaks under -1 dBFS
execFileSync('ffmpeg', ['-v', 'error', '-y', '-stream_loop', String(loops), '-i', src, '-t', String(need), '-ar', '48000', '-ac', '2', '-af', 'alimiter=limit=0.89:level=false', '-c:a', 'libmp3lame', '-q:a', '1', `${DIR}track.mp3`]);
const meta = { source: src.split('/').pop(), bpm: +bpm.toFixed(3), drop: +drop.toFixed(3), start: +start.toFixed(3), offset: +offset.toFixed(3), loops, volume: 0.9, lufs: a.loudness?.lufsIntegrated ?? null };
writeFileSync(`${DIR}track.json`, JSON.stringify(meta, null, 1));
console.log(meta);
