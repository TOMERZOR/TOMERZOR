// Writes the HyperFrames project for the SHARD brag film from one beat table, so the whole cut
// retimes from the music's tempo and downbeat. usage: node build.mjs   (then: cd composition && npx hyperframes check)
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';

const DIR = new URL('./composition/', import.meta.url).pathname;
const CAP = new URL('./capture/', import.meta.url).pathname;
mkdirSync(`${DIR}compositions`, { recursive: true });

// ---------- the clock: everything lands on the beat grid ----------
const MUSIC = existsSync(`${DIR}assets/bgm/track.mp3`) ? JSON.parse(readFileSync(`${DIR}assets/bgm/track.json`, 'utf8')) : null;
const BPM = MUSIC?.bpm ?? 128;
const FPS = 30;
const beat = (n) => Math.round((n * 60) / BPM * FPS) / FPS; // each beat from its index, rounded to a frame
const BEATS = 48;
const END = beat(BEATS);
const f3 = (v) => Math.round(v * 1000) / 1000;

// ---------- the brand ----------
const C = {
  ink: '#3E3A4F', ink2: '#5B5670', accent: '#FF7A59',
  dawn: ['#FFF8F1', '#F4D6C3'], mint: ['#F2FAF5', '#C5E3D3'], lilac: ['#F6F2FC', '#D2C6EE'],
  ember: ['#FFEBD3', '#F3AE90'], night: ['#141A2E', '#2B3558'],
  inks: { dawn: '#3E3A4F', mint: '#2E4A44', lilac: '#383063', ember: '#4A2D2A', night: '#E7EAF6' },
  accents: { dawn: '#FF7A59', mint: '#20B486', lilac: '#7A5CFF', ember: '#FF4D3D', night: '#78E0FF' },
  glass: ['#96CDFF', '#FFBEC8', '#BEAFFF'], indigo: ['#2E2A6E', '#120F2B'],
};
const FONT = `'SHARD Nunito', 'Nunito', sans-serif`;
const fontFace = `@font-face { font-family: 'SHARD Nunito'; src: url('assets/fonts/nunito.woff2') format('woff2'); font-weight: 200 1000; font-display: block; }`;

// ---------- clips: the game's own footage, timed so its moments land on beats ----------
// clip time of an event = from the capture's sound log; place(fireBeat) puts the shot on that beat
const log = (n) => JSON.parse(readFileSync(`${CAP}${n}-sfx.json`, 'utf8'));
const fireT = (n) => log(n).find((e) => e.k === 'fire').t;
const lastT = (n) => log(n).filter((e) => e.k === 'shatter').pop().t;
const clips = [
  // id, file, scene start beat, end beat, clip time shown at the start
  { id: 'hero', start: 8, end: 16, media: fireT('hero') - (beat(9) - beat(8)) },
  { id: 'ember', start: 16, end: 24, media: fireT('ember') - (beat(16.5) - beat(16)) },
  { id: 'night', start: 24, end: 30, media: lastT('night') - (beat(26) - beat(24)) },
  { id: 'map0', start: 30, end: 31, media: 0 },
  { id: 'map1', start: 31, end: 32, media: 0 },
  { id: 'map2', start: 32, end: 33, media: 0 },
  { id: 'map3', start: 33, end: 34, media: 0 },
  { id: 'map4', start: 34, end: 36.7, media: 0 }, // stays lit until the phone has dropped out of frame
];
// bomb kicks: one per cluster (booms within 0.3 s are one blast to the eye)
const booms = log('ember').filter((e) => e.k === 'boom').map((e) => beat(16) + (e.t - clips[1].media))
  .reduce((a, t) => (a.length && t - a[a.length - 1] < 0.3 ? a : [...a, t]), []);

// ---------- the soundtrack ----------
// peaks: seconds from a file's start to its loudest moment (measured with `hyperframes audio`), so hits land on the picture
const SND = JSON.parse(readFileSync(`${CAP}sounds.json`, 'utf8')); // { name: { peak, dur } } measured by `hyperframes audio`
const PEAK = Object.fromEntries(Object.entries(SND).map(([k, v]) => [k, v.peak]));
const hit = (file, at, vol, extra = {}) => ({ file, start: Math.max(0, at + 1 / FPS - (PEAK[file] ?? 0)), vol, ...extra });
const sounds = [
  hit('click-soft', beat(0) + 0.1, 0.55),
  hit('game-fire1', beat(2), 0.9), hit('whoosh-hi', beat(2) + 0.05, 0.5),
  // the slam: a deep hit for headphones and the game's own boom for the body a phone speaker can play
  hit('impact-1', beat(4), 0.85), hit('game-boom1', beat(4), 0.4),
  hit('game-glass_b1', beat(5), 1.0), hit('game-glass_b2', beat(5) + 0.04, 0.8), hit('sparkle', beat(5) + 0.15, 0.4),
  hit('whoosh-lo', beat(7.6), 0.45),
  hit('whoosh', beat(8.1), 0.4),
  { file: 'game-hero', ext: 'wav', start: beat(8), dur: beat(16) - beat(8), media: clips[0].media, vol: 0.62 },
  hit('whoosh-hi', beat(15.75), 0.45),
  { file: 'game-ember', ext: 'wav', start: beat(16), dur: beat(24) - beat(16), media: clips[1].media, vol: 0.62 },
  hit('whoosh-lo', beat(23.7), 0.5),
  { file: 'game-night', ext: 'wav', start: beat(24), dur: beat(30) - beat(24), media: clips[2].media, vol: 0.72 },
  hit('whoosh', beat(29.75), 0.4),
  ...[30, 31, 32, 33, 34].map((b, i) => hit('click-soft', beat(b), 0.3 + (i % 2) * 0.05)),
  hit('whoosh-hi', beat(35.8), 0.4),
  ...[0, 3, 6, 9, 11].map((k, i) => hit('pop', beat(36.25) + k * beat(0.25), 0.32 + 0.04 * (i % 3))),
  { file: 'riser', start: beat(40) - 2.6 + 1 / FPS, media: (PEAK.riser ?? 3.47) - 2.6, dur: 2.9, vol: 0.5 },
  hit('game-glass-rev', beat(40.9), 0.65),
  hit('impact-2', beat(41), 0.75),
  hit('sparkle', beat(41.2), 0.45),
  hit('sparkle', beat(44), 0.3),
];

// ---------- the phone ----------
// the slow-motion punch-in: the screen point (x, y) in points lands at frame height y0, at scale k0 easing to k1
const FOCUS = { x: 215, y: 540, y0: 470, k0: 2.45, k1: 2.52 };
const PHONE = { w: 418, h: 870 }; // a 392x844 screen behind a 10 px bezel and a 3 px rim

// ---------- index.html: the ground, the phone and the sound, plus one host per scene ----------
const scenes = [
  { id: 'hook', from: 0, to: 8 },
  { id: 'reveal', from: 8, to: 16 },
  { id: 'chains', from: 16, to: 24 },
  { id: 'slowmo', from: 24, to: 30 },
  { id: 'worlds', from: 30, to: 36 },
  { id: 'balls', from: 36, to: 40.5 },
  { id: 'mark', from: 40, to: BEATS },
];

const videos = clips.map((c, i) => `          <video id="v-${c.id}" class="clip screen-media" src="assets/clips/${c.id}.mp4" muted playsinline data-start="${beat(c.start)}" data-duration="${f3(beat(c.end) - beat(c.start))}" data-media-start="${f3(c.media)}" data-track-index="${2 + (i % 2)}"></video>`).join('\n');
// every sound gets its real length and a lane of its own while it plays
const lanes = [];
for (const s of [...sounds].sort((a, b) => a.start - b.start)) {
  s.dur = Math.min(s.dur ?? (SND[s.file].dur - (s.media ?? 0) - 0.06), END - s.start);
  let k = lanes.findIndex((end) => end <= s.start + 1e-6);
  if (k < 0) { k = lanes.length; lanes.push(0); }
  lanes[k] = s.start + s.dur; s.lane = 11 + k;
}
const audios = [
  // the bed: its drop on the reveal (prep-music.mjs), a short fade in when it enters mid-track, out under the end card
  MUSIC ? `    <audio id="music" class="clip" src="assets/bgm/track.mp3" data-start="${f3(MUSIC.start ?? 0)}" data-duration="${f3(END - (MUSIC.start ?? 0))}" data-media-start="${f3(MUSIC.offset)}" data-volume="${MUSIC.volume ?? 0.9}" data-fade-in="${MUSIC.offset ? 0.4 : 0.03}" data-fade-out="1.5" data-track-index="10"></audio>` : '',
  ...sounds.map((s, i) => `    <audio id="a${i}-${s.file}" class="clip" src="assets/${s.ext === 'wav' ? 'audio' : 'sfx'}/${s.file}.${s.ext || 'mp3'}" data-start="${f3(s.start)}" data-duration="${f3(s.dur)}"${s.media ? ` data-media-start="${f3(s.media)}"` : ''} data-volume="${s.vol}" data-track-index="${s.lane}"></audio>`),
].filter(Boolean).join('\n');

const index = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      ${fontFace}
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #000; }
      #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; font-family: ${FONT}; }
      /* the ground: a solid fill, a soft glow, and a flood that sweeps each new world in */
      #ground { position: absolute; inset: 0; background: #000; }
      #glow { position: absolute; left: 50%; top: 50%; width: 1700px; height: 1700px; margin: -850px 0 0 -850px; border-radius: 50%; background: radial-gradient(closest-side, var(--glow), rgba(0, 0, 0, 0)); opacity: 0; --glow: ${C.dawn[1]}; }
      #flood { position: absolute; inset: 0; background: ${C.dawn[0]}; clip-path: circle(0% at 50% 50%); }
      /* the phone: a generic modern handset, its screen showing the real game */
      #rig { position: absolute; left: 50%; top: 50%; width: ${PHONE.w}px; height: ${PHONE.h}px; margin: ${-PHONE.h / 2}px 0 0 ${-PHONE.w / 2}px; }
      #shake { position: absolute; inset: 0; }
      #phone { position: absolute; inset: 0; border-radius: 70px; padding: 3px; background: linear-gradient(140deg, #8A8A93 0%, #2A2A31 18%, #1B1B21 50%, #3A3A43 82%, #9A9AA3 100%); box-shadow: 0 60px 120px -40px rgba(20, 16, 40, .55), 0 26px 50px -24px rgba(20, 16, 40, .45); }
      #phone::before, #phone::after { content: ""; position: absolute; width: 4px; border-radius: 2px; background: #2A2A31; }
      #phone::before { left: -4px; top: 190px; height: 70px; box-shadow: 0 90px 0 #2A2A31; }
      #phone::after { right: -4px; top: 250px; height: 110px; }
      #bezel { position: absolute; inset: 3px; border-radius: 67px; background: #050507; padding: 10px; }
      #screen { position: relative; width: 392px; height: 844px; border-radius: 57px; overflow: hidden; background: ${C.dawn[0]}; }
      .screen-media { position: absolute; left: 0; top: 0; width: 392px; height: 844px; object-fit: cover; }
      #island { position: absolute; left: 50%; top: 11px; width: 118px; height: 35px; margin-left: -59px; border-radius: 18px; background: #000; z-index: 3; }
      #homebar { position: absolute; left: 50%; bottom: 9px; width: 136px; height: 5px; margin-left: -68px; border-radius: 3px; background: currentColor; color: ${C.ink}; opacity: .55; z-index: 2; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${END}" data-width="1920" data-height="1080" data-motion-blur="on">
      <div id="ground"></div>
      <div id="flood"></div>
      <div id="glow"></div>
      <div id="hook" data-composition-id="hook" data-composition-src="compositions/hook.html" data-start="${beat(0)}" data-duration="${f3(beat(8) - beat(0))}" data-track-kind="graphics" data-track-index="1" data-width="1920" data-height="1080" style="z-index: 6"></div>
      <div id="rig" data-layout-allow-overflow>
        <div id="shake">
          <div id="phone">
            <div id="bezel">
              <div id="screen">
${videos}
                <div id="island"></div>
                <div id="homebar"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
${scenes.filter((s) => s.id !== 'hook').map((s) => `      <div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${beat(s.from)}" data-duration="${f3(beat(s.to) - beat(s.from))}" data-track-kind="graphics" data-track-index="1" data-width="1920" data-height="1080" style="z-index: ${s.id === 'slowmo' || s.id === 'balls' || s.id === 'mark' ? 7 : 5}"></div>`).join('\n')}
${audios}
    </div>
    <script>
      // the root timeline moves only what persists across scenes: the ground, the glow and the phone
      const tl = gsap.timeline({ paused: true });
      const B = (n) => Math.round((n * 60) / ${BPM} * ${FPS}) / ${FPS};
      const flood = (b, colour, glow, glowOpacity = 0.85, at = '50% 50%', dur = 0.38) => {
        tl.set('#flood', { background: colour, clipPath: 'circle(0% at ' + at + ')' }, B(b) - 0.001);
        tl.to('#flood', { clipPath: 'circle(125% at ' + at + ')', duration: dur, ease: 'power2.inOut' }, B(b));
        tl.set('#ground', { background: colour }, B(b) + dur);
        tl.to('#glow', { '--glow': glow, opacity: glowOpacity, duration: dur, ease: 'power2.inOut' }, B(b));
      };
      // the home indicator follows the screen: dark over light worlds, light over Night (the game hides the status bar)
      const bar = (b, ink, home = ink) => tl.set('#homebar', { color: home }, B(b));

      // the hook plays on black; the phone waits below the frame
      tl.set('#rig', { x: 330, y: 1150, rotation: -6, scale: 1, opacity: 1 }, 0);
      tl.set('#shake', { x: 0, y: 0 }, 0);
      tl.set('#glow', { scale: 1 }, 0);

      // reveal: the shards' light floods to Dawn and the phone rises into it
      flood(7.55, '${C.dawn[0]}', '${C.dawn[1]}', 0.9, '50% 50%', 0.42);
      tl.to('#rig', { y: 0, rotation: 0, duration: 0.62, ease: 'expo.out' }, B(8));
      bar(8, '${C.inks.dawn}');

      // chains: Ember sweeps in from the phone as it whips left
      tl.to('#rig', { x: -330, duration: 0.42, ease: 'power3.inOut' }, B(15.72));
      flood(15.9, '${C.ember[0]}', '${C.ember[1]}', 0.9, '33% 50%');
      bar(16, '${C.inks.ember}');
${booms.map((t) => `      tl.fromTo('#shake', { x: 0, y: 0 }, { keyframes: [{ x: -7, y: 5, duration: 0.04 }, { x: 5, y: -4, duration: 0.05 }, { x: -2, y: 2, duration: 0.06 }, { x: 0, y: 0, duration: 0.08 }], ease: 'none' }, ${f3(t)});\n      tl.fromTo('#glow', { scale: 1.08 }, { scale: 1, duration: 0.35, ease: 'power3.out' }, ${f3(t)});`).join('\n')}

      // slow motion: zoom through the screen into Night, framed on the shelf where the last piece breaks
      tl.to('#rig', { x: ${f3(-FOCUS.k0 * (FOCUS.x - 196))}, y: ${f3(FOCUS.y0 - 540 - FOCUS.k0 * (FOCUS.y - 422))}, scale: ${FOCUS.k0}, duration: 0.46, ease: 'power3.in' }, B(23.55));
      tl.set('#ground, #flood', { background: '${C.night[0]}' }, B(24));
      tl.set('#glow', { '--glow': '${C.night[1]}', opacity: 0.7 }, B(24));
      bar(24, '${C.inks.night}', '#E7EAF6');
      tl.to('#rig', { x: ${f3(-FOCUS.k1 * (FOCUS.x - 196))}, y: ${f3(FOCUS.y0 - 540 - FOCUS.k1 * (FOCUS.y - 422))}, scale: ${FOCUS.k1}, duration: B(29.6) - B(24), ease: 'none' }, B(24));

      // worlds: pull back to the whole phone, centred, and step through the five worlds on the beat
      tl.to('#rig', { y: 18, scale: 0.94, duration: 0.5, ease: 'expo.out' }, B(29.75));
      flood(30, '${C.dawn[0]}', '${C.dawn[1]}', 0.9);
      bar(30, '${C.inks.dawn}');
      flood(31, '${C.mint[0]}', '${C.mint[1]}', 0.9);
      bar(31, '${C.inks.mint}');
      flood(32, '${C.lilac[0]}', '${C.lilac[1]}', 0.9);
      bar(32, '${C.inks.lilac}');
      flood(33, '${C.ember[0]}', '${C.ember[1]}', 0.9);
      bar(33, '${C.inks.ember}');
      flood(34, '${C.night[0]}', '${C.night[1]}', 0.75);
      bar(34, '#E7EAF6');

      // balls: the phone drops away and the ground clears to warm white
      tl.to('#rig', { y: 1250, rotation: 4, duration: 0.42, ease: 'power3.in' }, B(35.7));
      flood(35.85, '#FBF7F2', '${C.dawn[1]}', 0.55);

      // the mark: deep indigo, the icon's own ground
      flood(39.9, '${C.indigo[1]}', '${C.indigo[0]}', 0.9, '50% 50%', 0.3);

      tl.to({}, { duration: 0.01 }, ${f3(END - 0.01)});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(`${DIR}index.html`, index);

// ---------- shared: a word broken into glass shards (a jittered grid, seeded so every render matches) ----------
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function shardGrid(cols, rows, seed, split = false) {
  const r = rng(seed), P = [];
  for (let j = 0; j <= rows; j++) {
    const row = [];
    for (let i = 0; i <= cols; i++) {
      const edgeX = i === 0 || i === cols, edgeY = j === 0 || j === rows;
      row.push([(i + (edgeX ? 0 : (r() - 0.5) * 0.7)) / cols * 100, (j + (edgeY ? 0 : (r() - 0.5) * 0.7)) / rows * 100]);
    }
    P.push(row);
  }
  const shards = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
    // split each cell along a diagonal: triangles read as glass
    const tris = !split ? [[a, b, c, d]] : r() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    for (const t of tris) {
      const cx = t.reduce((s, p) => s + p[0], 0) / t.length, cy = t.reduce((s, p) => s + p[1], 0) / t.length;
      shards.push({ poly: t.map(([x, y]) => `${f3(x)}% ${f3(y)}%`).join(', '), cx, cy, r: r(), r2: r(), r3: r() });
    }
  }
  return shards;
}
const scene = (id, css, html, js) => `<template>
  <style>
    ${fontFace}
    #root { position: absolute; inset: 0; font-family: ${FONT}; }
    ${css}
  </style>
  <div id="root" data-composition-id="${id}" data-width="1920" data-height="1080">
${html}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    const B = (n) => Math.round((n * 60) / ${BPM} * ${FPS}) / ${FPS};
${js}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`;
const words = (id, text, cls = '') => text.split(' ').map((w, i) => `<span class="w ${cls}" id="${id}-w${i}">${w}</span>`).join(' ');
const blurIn = (sel, at, { stagger = 0.07, dur = 0.16, y = 0 } = {}) => `    tl.fromTo('${sel}', { opacity: 0, filter: 'blur(10px)', y: ${y} }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: ${dur}, ease: 'power4.out', stagger: ${stagger} }, ${at});`;
const blurOut = (sel, at, { stagger = 0.04, dur = 0.16 } = {}) => `    tl.to('${sel}', { opacity: 0, filter: 'blur(10px)', duration: ${dur}, ease: 'power2.in', stagger: ${stagger} }, ${at});`;

// ---------- 1 hook: "Aim." "Fire." "Shatter." and the word breaks into glass ----------
{
  const SH = shardGrid(8, 3, 11);
  const shards = SH.map((s, i) => `      <div class="shard" id="hk-s${i}" style="clip-path: polygon(${s.poly})"><span>Shatter.</span></div>`).join('\n');
  const fly = SH.map((s, i) => {
    const dx = (s.cx - 50) / 50, dy = (s.cy - 50) / 50;
    const dist = 380 + s.r * 760, ang = Math.atan2(dy * 0.55 + (s.r2 - 0.5) * 0.5, dx + (s.r3 - 0.5) * 0.4);
    const x = f3(Math.cos(ang) * dist), y = f3(Math.sin(ang) * dist * 0.8);
    const cx = f3(Math.cos(ang) * (4 + s.r * 8)), cy = f3(Math.sin(ang) * (4 + s.r * 8));
    const rot = f3((s.r2 - 0.5) * 120), sc = f3(1.1 + s.r3 * 1.5), tint = ['#D6EBFF', '#FFDDE3', '#E2DAFF'][i % 3];
    // crack, burst outward and slow, while a second push (its own transform channel, so the two add up and the
    // glass never stops dead) gathers into a rush past the camera on the drop
    const burst = 0.12, out = 0.6, push = 0.3, rest = f3(beat(8) - beat(5) - burst);
    return `    tl.fromTo('#hk-s${i}', { x: 0, y: 0, rotation: 0, color: '#FFFFFF' }, { x: ${cx}, y: ${cy}, rotation: ${f3((s.r2 - 0.5) * 4)}, duration: ${burst}, ease: 'power2.out' }, B(5));
    tl.to('#hk-s${i}', { x: ${f3(x * 0.62)}, y: ${f3(y * 0.62)}, color: '${tint}', duration: ${out}, ease: 'power2.out' }, B(5) + ${burst});
    tl.fromTo('#hk-s${i}', { xPercent: 0, yPercent: 0 }, { xPercent: ${f3((x * 1.08) / 11)}, yPercent: ${f3((y * 1.08) / 2.8)}, duration: ${f3(beat(8) - beat(5) - push)}, ease: 'power1.in' }, B(5) + ${push});
    tl.to('#hk-s${i}', { rotation: ${f3(rot * 1.4)}, duration: ${rest}, ease: 'sine.in' }, B(5) + ${burst});
    tl.fromTo('#hk-s${i}', { scale: 1 }, { scale: ${f3(sc * 1.8)}, duration: ${rest}, ease: 'power2.in' }, B(5) + ${burst});
    tl.fromTo('#hk-s${i}', { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'power2.in' }, B(7.6) + ${f3(s.r2 * 0.15)});`;
  }).join('\n');
  // the shot: the ball rests where the aim guide starts, then flies the guide's own parabola (steady sideways
  // speed, gravity down), sampled once per frame, trailing light along the same curve (no render-time motion blur here)
  const P0 = [130, 950], APEX = [1047, 424], X1 = 1990, FLIGHT = 14; // frames from launch until the ball is out of frame
  const k = (P0[1] - APEX[1]) / (APEX[0] - P0[0]) ** 2;
  const yAt = (x) => APEX[1] + k * (x - APEX[0]) ** 2, slope = (x) => 2 * k * (x - APEX[0]);
  const curve = (xa, xb) => `M${xa} ${f3(yAt(xa))} Q${f3((xa + xb) / 2)} ${f3(yAt(xa) + (slope(xa) * (xb - xa)) / 2)} ${xb} ${f3(yAt(xb))}`;
  const lenTo = (xb) => {
    let L = 0;
    for (let i = 1; i <= 400; i++) { const a = P0[0] + ((xb - P0[0]) * (i - 1)) / 400, b = P0[0] + ((xb - P0[0]) * i) / 400; L += Math.hypot(b - a, yAt(b) - yAt(a)); }
    return L;
  };
  // dash length, width, opacity: twelve faint strokes stacked, so the light thickens and brightens smoothly toward the ball
  const TRAIL = Array.from({ length: 12 }, (_, i) => [Math.round(60 + 700 * (1 - i / 11) ** 1.2), f3(1.5 + 10.5 * (i / 11) ** 1.1), 0.17]);
  const total = lenTo(X1), longest = TRAIL[0][0];
  const steps = [];
  for (let i = 0; i <= FLIGHT; i++) { const x = P0[0] + ((X1 - P0[0]) * i) / FLIGHT; steps.push({ x, y: yAt(x), s: lenTo(x) }); }
  // once the ball is gone its trail keeps going, sliding off the end of the curve
  const ds = steps[FLIGHT].s - steps[FLIGHT - 1].s;
  for (let s = total + ds; s - ds < total + longest; s += ds) steps.push({ s });
  const shot = steps.slice(1).map((p, i) => {
    const at = `B(2) + ${i} / ${FPS}`, verb = i ? 'to' : 'fromTo';
    const ball = p.x === undefined ? '' : `    tl.${verb}('#hk-shot', ${i ? '' : '{ x: 0, y: 0 }, '}{ x: ${f3(p.x - P0[0])}, y: ${f3(p.y - P0[1])}, duration: 1 / ${FPS}, ease: 'none' }, ${at});\n`;
    return `${ball}    tl.${verb}('.hk-tr', ${i ? '' : '{ strokeDashoffset: (j, el) => +el.dataset.l }, '}{ strokeDashoffset: (j, el) => el.dataset.l - ${f3(p.s)}, duration: 1 / ${FPS}, ease: 'none' }, ${at});`;
  }).join('\n');
  const trail = TRAIL.map(([l, w, o]) => `<path class="hk-tr" data-l="${l}" style="stroke-width: ${w}px; opacity: ${o}; stroke-dasharray: ${l}px ${Math.ceil(total + 2 * longest)}px; stroke-dashoffset: ${l}px" d="${curve(P0[0], X1)}"/>`).join('');
  writeFileSync(`${DIR}compositions/hook.html`, scene('hook', `
    .hk-word { position: absolute; left: 0; right: 0; top: 50%; text-align: center; color: #fff; font-weight: 900; letter-spacing: -0.03em; line-height: 1; }
    #hk-aim, #hk-fire { font-size: 200px; margin-top: -100px; opacity: 0; }
    #hk-shatter { font-size: 250px; margin-top: -125px; opacity: 0; }
    #hk-shards { position: absolute; left: 50%; top: 50%; width: 1100px; height: 280px; margin: -140px 0 0 -550px; opacity: 0; }
    .shard { position: absolute; inset: 0; color: #fff; }
    .shard span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 250px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; }
    #hk-burst { position: absolute; left: 50%; top: 50%; width: 1400px; height: 1400px; margin: -700px 0 0 -700px; border-radius: 50%; background: radial-gradient(closest-side, rgba(255, 255, 255, .95), rgba(214, 235, 255, .5) 35%, rgba(0, 0, 0, 0)); opacity: 0; }
    #hk-light { position: absolute; left: 50%; top: 50%; width: 1000px; height: 1000px; margin: -500px 0 0 -500px; border-radius: 50%; background: radial-gradient(closest-side, #FFFFFF 0%, ${C.dawn[0]} 14%, rgba(255, 228, 208, .55) 32%, rgba(244, 214, 195, .16) 58%, rgba(0, 0, 0, 0) 78%); opacity: 0; }
    #hk-guide { position: absolute; left: 120px; top: 360px; width: 820px; height: 600px; }
    #hk-guide path { fill: none; stroke: #fff; stroke-width: 9; stroke-linecap: round; stroke-dasharray: 0.01 30; }
    #hk-trail { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; overflow: visible; }
    .hk-tr { fill: none; stroke: #EAF4FF; stroke-linecap: round; }
    #hk-shot { position: absolute; left: ${P0[0] - 60}px; top: ${P0[1] - 60}px; width: 120px; height: 120px; }
    #hk-ball { position: absolute; inset: 0; width: 120px; height: 120px; opacity: 0; }
  `, `
    <div id="hk-light"></div>
    <div id="hk-burst"></div>
    <svg id="hk-guide" viewBox="120 360 820 600" aria-hidden="true"><path id="hk-path" d="${curve(P0[0], 920)}"/></svg>
    <svg id="hk-trail" viewBox="0 0 1920 1080" aria-hidden="true" data-layout-allow-overflow>${trail}</svg>
    <div id="hk-shot" data-layout-allow-overflow><img id="hk-ball" src="assets/img/balls/steel.png" alt=""></div>
    <div class="hk-word" id="hk-aim">Aim.</div>
    <div class="hk-word" id="hk-fire">Fire.</div>
    <div class="hk-word" id="hk-shatter">Shatter.</div>
    <div id="hk-shards" data-layout-allow-overflow data-layout-ignore>
${shards}
    </div>`, `
    // Aim: the ball sits ready, the game's dotted guide reaches out from it, the word arrives
    tl.fromTo('#hk-ball', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, B(0));
    tl.fromTo('#hk-guide', { clipPath: 'inset(0% 100% 0% 0%)', opacity: 1 }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.45, ease: 'power3.out' }, B(0) + 0.05);
${blurIn('#hk-aim', 'B(0) + 0.1', { dur: 0.2 })}
    tl.to('#hk-guide', { opacity: 0, duration: 0.15, ease: 'power2.in' }, B(2) - 0.12);
${blurOut('#hk-aim', 'B(2) - 0.12', { dur: 0.12 })}
    // Fire: the ball flies the line it was aimed along, over and behind the word, and out of frame
${blurIn('#hk-fire', 'B(2)', { dur: 0.14 })}
${shot}
    tl.set('#hk-shot', { autoAlpha: 0 }, B(2) + ${FLIGHT + 1} / ${FPS});
${blurOut('#hk-fire', 'B(4) - 0.1', { dur: 0.1 })}
    // Shatter: the word slams in, holds a beat, and breaks
    tl.fromTo('#hk-shatter', { opacity: 0, scale: 1.3, filter: 'blur(14px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.24, ease: 'expo.out' }, B(4));
    tl.set('#hk-shatter', { opacity: 0 }, B(5));
    tl.set('#hk-shards', { opacity: 1 }, B(5));
    tl.fromTo('#hk-burst', { opacity: 0, scale: 0.25 }, { keyframes: [{ opacity: 1, scale: 0.7, duration: 0.06 }, { opacity: 0, scale: 1.25, duration: 0.42 }], ease: 'none' }, B(5));
    // a warm light gathers at the centre and the new world opens out of it
    tl.fromTo('#hk-light', { opacity: 0, scale: 0.12 }, { opacity: 1, scale: 0.85, duration: B(7.7) - B(5.6), ease: 'power2.in' }, B(5.6));
${fly}
    tl.set('#hk-shards', { opacity: 0 }, B(8) - 0.05);`));
}

// ---------- 2 reveal: the wordmark and its promise beside the phone ----------
writeFileSync(`${DIR}compositions/reveal.html`, scene('reveal', `
    #rv-block { position: absolute; left: 150px; top: 330px; width: 800px; }
    #rv-logo { display: flex; gap: 2px; font-size: 220px; font-weight: 900; letter-spacing: 0.01em; line-height: 0.9; color: ${C.ink}; }
    #rv-logo span { display: inline-block; background: linear-gradient(105deg, ${C.ink} 0%, ${C.ink} 40%, #FFFFFF 50%, ${C.ink} 60%, ${C.ink} 100%); background-size: 320% 100%; background-position: 100% 0; -webkit-background-clip: text; background-clip: text; color: transparent; }
    #rv-logo span:nth-child(3) { clip-path: polygon(0 0, 100% 0, 100% 46%, 58% 54%, 100% 62%, 100% 100%, 0 100%, 0 58%, 38% 50%, 0 40%); }
    #rv-line { margin-top: 34px; font-size: 52px; font-weight: 800; color: ${C.ink2}; letter-spacing: -0.01em; }
    .w { display: inline-block; }
  `, `
    <div id="rv-block">
      <div id="rv-logo" aria-label="SHARD">${'SHARD'.split('').map((l, i) => `<span id="rv-l${i}">${l}</span>`).join('')}</div>
      <div id="rv-line">${words('rv', 'Satisfying physics puzzles.')}</div>
    </div>`, `
    tl.fromTo('#rv-logo span', { opacity: 0, y: 40, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.42, ease: 'expo.out', stagger: 0.06 }, B(2));
    tl.fromTo('#rv-logo span', { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', duration: 0.9, ease: 'power2.inOut', stagger: 0.05 }, B(3));
${blurIn('#rv-line .w', 'B(4)')}
${blurOut('#rv-logo span, #rv-line .w', 'B(7.6)', { stagger: 0.02, dur: 0.14 })}`));

// ---------- 3 chains ----------
writeFileSync(`${DIR}compositions/chains.html`, scene('chains', `
    #ch-title { position: absolute; left: 1060px; top: 350px; font-size: 140px; font-weight: 900; line-height: 0.95; letter-spacing: -0.03em; color: ${C.inks.ember}; }
    #ch-title .acc { color: ${C.accents.ember}; }
    .w { display: inline-block; }
  `, `
    <div id="ch-title">${words('ch', 'Chain')}<br>${words('cha', 'reactions.', 'acc')}</div>`, `
${blurIn('#ch-title .w', 'B(1)', { stagger: 0.09, dur: 0.18 })}
${blurOut('#ch-title .w', 'B(7.6)', { stagger: 0.03, dur: 0.13 })}`));

// ---------- 4 slow motion: "One shot." over the game's own slow-motion finish ----------
writeFileSync(`${DIR}compositions/slowmo.html`, scene('slowmo', `
    #sm-title { position: absolute; left: 96px; top: 330px; font-size: 140px; font-weight: 900; line-height: 0.95; letter-spacing: -0.03em; color: #fff; }
    .w { display: inline-block; }
  `, `
    <div id="sm-title">${words('sm', 'One')}<br>${words('sm2', 'shot.')}</div>`, `
${blurIn('#sm-title .w', 'B(2)', { stagger: 0.1, dur: 0.18 })}
${blurOut('#sm-title .w', 'B(5.6)', { stagger: 0.04, dur: 0.13 })}`));

// ---------- 5 worlds: the counts flank the phone; their ink follows the ground ----------
writeFileSync(`${DIR}compositions/worlds.html`, scene('worlds', `
    .wd { position: absolute; top: 470px; font-size: 96px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; color: ${C.inks.dawn}; }
    #wd-a { right: 1265px; text-align: right; }
    #wd-b { left: 1265px; }
    .w { display: inline-block; }
  `, `
    <div class="wd" id="wd-a">${words('wda', '5 worlds.')}</div>
    <div class="wd" id="wd-b">${words('wdb', '120 levels.')}</div>`, `
${blurIn('#wd-a .w', 'B(0)', { stagger: 0.09, dur: 0.18 })}
${blurIn('#wd-b .w', 'B(3)', { stagger: 0.09, dur: 0.18 })}
    ${['dawn', 'mint', 'lilac', 'ember', 'night'].map((w, i) => `tl.set('.wd', { color: '${C.inks[w]}' }, B(${i}));`).join('\n    ')}
${blurOut('#wd-a .w, #wd-b .w', 'B(5.6)', { stagger: 0.03, dur: 0.13 })}`));

// ---------- 6 balls: all twelve, as the game draws them, land in a row ----------
{
  const ids = JSON.parse(readFileSync(`${CAP}balls.json`, 'utf8')).map((b) => b.id);
  const size = 118, gap = 16, w = ids.length * size + (ids.length - 1) * gap;
  writeFileSync(`${DIR}compositions/balls.html`, scene('balls', `
    #bl-title { position: absolute; left: 0; right: 0; top: 300px; text-align: center; font-size: 120px; font-weight: 900; letter-spacing: -0.03em; color: ${C.ink}; }
    #bl-row { position: absolute; left: ${(1920 - w) / 2}px; top: 560px; width: ${w}px; height: ${size}px; }
    .ball { position: absolute; top: 0; width: ${size}px; height: ${size}px; }
    .ball img { position: absolute; inset: -8%; width: 116%; height: 116%; }
    .w { display: inline-block; }
  `, `
    <div id="bl-title">${words('bl', 'Collect 12 balls.')}</div>
    <div id="bl-row" data-layout-allow-overflow>
${ids.map((id, i) => `      <div class="ball" id="bl-b${i}" style="left: ${i * (size + gap)}px"><img src="assets/img/balls/${id}.png" alt=""></div>`).join('\n')}
    </div>`, `
${blurIn('#bl-title .w', 'B(0.5)', { stagger: 0.08, dur: 0.16 })}
    ${ids.map((_, i) => `tl.fromTo('#bl-b${i}', { y: -760, scaleY: 1.12, scaleX: 0.92 }, { keyframes: [{ y: 0, scaleY: 1, scaleX: 1, duration: 0.3, ease: 'power2.in' }, { scaleY: 0.82, scaleX: 1.12, duration: 0.05, ease: 'power1.out' }, { scaleY: 1, scaleX: 1, duration: 0.16, ease: 'back.out(2)' }] }, B(0.25) + ${i} * B(0.25));`).join('\n    ')}
    // the row gathers into one point and bursts into the mark
    tl.to('.ball', { x: (i) => ${(1920 / 2)} - (${(1920 - w) / 2} + i * ${size + gap} + ${size / 2}), y: -60, scale: 0.4, duration: 0.34, ease: 'power3.in', stagger: 0.008 }, B(3.55));
    tl.to('.ball', { opacity: 0, duration: 0.06 }, B(4) - 0.02);
${blurOut('#bl-title .w', 'B(3.5)', { stagger: 0.03, dur: 0.13 })}`));
}

// ---------- 7 the mark: the hook's shards return and become the wordmark ----------
{
  const SH = shardGrid(7, 3, 29);
  const shards = SH.map((s, i) => `        <div class="shard" id="mk-s${i}" style="clip-path: polygon(${s.poly})"><span>SHARD</span></div>`).join('\n');
  const fly = SH.map((s, i) => {
    const dx = (s.cx - 50) / 50, dy = (s.cy - 50) / 50;
    const ang = Math.atan2(dy * 0.6 + (s.r2 - 0.5) * 0.6, dx + (s.r3 - 0.5) * 0.5), dist = 700 + s.r * 900;
    return `    tl.fromTo('#mk-s${i}', { x: ${f3(Math.cos(ang) * dist)}, y: ${f3(Math.sin(ang) * dist * 0.8)}, rotation: ${f3((s.r2 - 0.5) * 160)}, scale: ${f3(1.6 + s.r3 * 1.4)}, opacity: 0, color: '${C.glass[i % 3]}' }, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, color: '#FFFFFF', duration: ${f3(0.5 + s.r * 0.2)}, ease: 'expo.out' }, B(0.05) + ${f3(s.r2 * 0.1)});`;
  }).join('\n');
  writeFileSync(`${DIR}compositions/mark.html`, scene('mark', `
    #mk-lockup { position: absolute; left: 50%; top: 360px; width: 1200px; height: 260px; margin-left: -600px; }
    #mk-icon { position: absolute; left: 0; top: 14px; width: 232px; height: 232px; border-radius: 52px; box-shadow: 0 30px 60px -24px rgba(0, 0, 0, .6), 0 0 0 1px rgba(255, 255, 255, .08); }
    #mk-word { position: absolute; left: 290px; top: 0; width: 910px; height: 260px; }
    .shard { position: absolute; inset: 0; color: #fff; }
    .shard span { position: absolute; inset: 0; display: flex; align-items: center; font-size: 236px; font-weight: 900; letter-spacing: 0.01em; line-height: 1; }
    #mk-solid { position: absolute; inset: 0; display: flex; align-items: center; font-size: 236px; font-weight: 900; letter-spacing: 0.01em; line-height: 1; background: linear-gradient(105deg, #FFFFFF 0%, #FFFFFF 42%, ${C.glass[0]} 50%, #FFFFFF 58%, #FFFFFF 100%); background-size: 320% 100%; background-position: 100% 0; -webkit-background-clip: text; background-clip: text; color: transparent; }
    #mk-burst { position: absolute; left: 50%; top: 490px; width: 1600px; height: 1600px; margin: -800px 0 0 -800px; border-radius: 50%; background: radial-gradient(closest-side, rgba(214, 235, 255, .55), rgba(190, 175, 255, .2) 40%, rgba(0, 0, 0, 0)); opacity: 0; }
    #mk-cta { position: absolute; left: 0; right: 0; top: 700px; text-align: center; font-size: 46px; font-weight: 800; letter-spacing: -0.01em; color: rgba(255, 255, 255, .78); }
    .w { display: inline-block; }
  `, `
    <div id="mk-burst"></div>
    <div id="mk-lockup" data-layout-allow-overflow>
      <img id="mk-icon" src="assets/img/icon.png" alt="SHARD app icon">
      <div id="mk-word" data-layout-allow-overflow aria-label="SHARD">
        <div id="mk-shards" data-layout-ignore>
${shards}
        </div>
        <div id="mk-solid">SHARD</div>
      </div>
    </div>
    <div id="mk-cta">${words('mk', 'Coming soon to iPhone & Android.')}</div>`, `
${fly}
    tl.fromTo('#mk-burst', { opacity: 0, scale: 0.3 }, { keyframes: [{ opacity: 1, scale: 0.75, duration: 0.08 }, { opacity: 0, scale: 1.2, duration: 0.6 }], ease: 'none' }, B(1));
    tl.fromTo('#mk-solid', { opacity: 0 }, { opacity: 1, duration: 0.1, ease: 'none' }, B(1.75));
    tl.to('.shard', { opacity: 0, duration: 0.1, ease: 'none' }, B(1.8));
    tl.fromTo('#mk-icon', { opacity: 0, scale: 0.6, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(1.6)' }, B(1));
${blurIn('#mk-cta .w', 'B(2)', { stagger: 0.07, dur: 0.18 })}
    tl.fromTo('#mk-solid', { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', duration: 1.1, ease: 'power2.inOut' }, B(4));`));
}

// the poster: the reveal just after the hero clip's last shatter, with the wordmark, the promise and the ×10 on screen
const posterAt = Math.round((beat(8) + lastT('hero') - clips[0].media + 0.17) * FPS) / FPS;
writeFileSync(`${DIR}../poster.json`, JSON.stringify({ at: f3(posterAt) }));
console.log(`built: ${BPM} BPM, ${END}s, ${clips.length} clips, ${sounds.length} sounds${MUSIC ? ', music' : ', no music yet'}`);
