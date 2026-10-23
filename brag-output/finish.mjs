// The last mile: renders the film at full quality, brings the mix to -14 LUFS (true peak under -1 dBTP),
// and bakes the poster in as frame 0 so every player shows it before playback.
// usage: node finish.mjs [--poster <seconds>] [--skip-render]   (after: node build.mjs && cd composition && npx hyperframes check)
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = new URL('.', import.meta.url).pathname;
const COMP = `${HERE}composition/`;
const RAW = `${HERE}brag-raw.mp4`, OUT = `${HERE}brag.mp4`, POSTER = `${HERE}brag.jpg`;
const flag = process.argv.indexOf('--poster');
const POSTER_AT = flag > 0 ? +process.argv[flag + 1] : JSON.parse(readFileSync(`${HERE}poster.json`, 'utf8')).at; // chosen by build.mjs
const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1' };
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 1 << 26, ...opts });

if (!process.argv.includes('--skip-render')) {
  console.log('render (high quality)…');
  run('npx', ['hyperframes', 'render', '-o', RAW, '--quality', 'high', '--workers', '4'], { cwd: COMP });
}
const length = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', RAW]).trim();

// the poster, straight from the composition (lossless), not from the compressed video
const snap = mkdtempSync(`${tmpdir()}/poster-`);
run('npx', ['hyperframes', 'snapshot', '--at', String(POSTER_AT), '-o', snap, '--json'], { cwd: COMP });
const png = readdirSync(snap).find((f) => f.startsWith('frame-00-'));
run('ffmpeg', ['-v', 'error', '-y', '-i', `${snap}/${png}`, '-q:v', '2', POSTER]);
rmSync(snap, { recursive: true, force: true });

// loudness, pass 1: measure (ffmpeg prints the measurement on stderr)
const log = spawnSync('ffmpeg', ['-hide_banner', '-i', RAW, '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 }).stderr;
const measured = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
const ln = `loudnorm=I=-14:TP=-1.2:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;

// pass 2: the poster replaces frame 0 (same frame count, so picture and sound stay in sync), the mix is normalised
run('ffmpeg', ['-v', 'error', '-y', '-i', RAW, '-loop', '1', '-framerate', '30', '-t', String(1 / 30), '-i', POSTER,
  '-filter_complex', '[1:v]scale=1920:1080:out_color_matrix=bt709:out_range=tv,setsar=1,format=yuv420p[p];[0:v]trim=start_frame=1,setpts=PTS-STARTPTS[rest];[p][rest]concat=n=2:v=1:a=0[v]',
  '-map', '[v]', '-map', '0:a', '-af', `${ln},atrim=end=${length}`, '-ar', '48000', '-t', length,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', OUT]);
console.log({ out: OUT, poster: POSTER, posterAt: POSTER_AT, loudnessIn: measured.input_i });
