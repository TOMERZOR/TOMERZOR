// Every source frame the film shows, per placement (from motion/edit.js) -> qa/uses.json for `prodcheck.py ranges --uses`.
// The page's drawing code is not needed: lib.js only gets a do-nothing canvas.
const fs = require('fs');
const stub = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : stub), apply: () => stub, set: () => true });
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => stub }) };
const code = ['clips.js', 'aims.js', 'lib.js', 'edit.js'].map((f) => fs.readFileSync('motion/' + f, 'utf8')).join('\n');
const { PL, CLIPS, FPS } = new Function(code + '\nreturn { PL, CLIPS, FPS };')();
const SRC = { p_A1: 'gen/plate_A1.mp4', p_A2: 'gen/plate_A2.mp4', p_B: 'gen/plate_B.mp4', p_C: 'gen/plate_C.mp4', p_D: 'gen/plate_D.mp4' };
const src = (id) => SRC[id] || (/^g_(hero2|ember2|night2)$/.test(id) ? `src/game2/${id.slice(2)}.mp4` : `src/game/clips/${id.replace(/^g_/, '')}.mp4`);
const out = PL.map((p) => {
  const c = CLIPS[p.clip], seen = new Set();
  for (let f = Math.ceil(p.t0 * FPS - 1e-9); f < Math.ceil(p.t1 * FPS - 1e-9); f++) {
    const x = Math.max(0, Math.min(c.n - 1, p.src(f / FPS) * c.fps)), i = Math.floor(x + 1e-4);
    seen.add(i);
    if (p.blend && x - i > 0.02 && i + 1 < c.n) seen.add(i + 1);
  }
  const fr = [...seen].sort((a, b) => a - b);
  return { clip: src(p.clip), f0: fr[0], f1: fr[fr.length - 1], label: p.label, frames: fr.length, contiguous: fr[fr.length - 1] - fr[0] + 1 === fr.length };
});
fs.writeFileSync('qa/uses.json', JSON.stringify(out, null, 1));
out.forEach((u) => console.log(`${u.clip.padEnd(26)} ${String(u.f0).padStart(4)}-${String(u.f1).padEnd(4)} ${u.contiguous ? '' : '(gaps) '}${u.label}`));
