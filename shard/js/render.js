// Canvas renderer: premium-minimal look, interpolated physics, particles and juice.
import { W, PIVOT_Y, BALL_R, CEIL, DOME_R, MUZZLE } from './engine.js';

const TAU = Math.PI * 2;
const FONT = '"Nunito", ui-rounded, system-ui, sans-serif';

export function createRenderer(canvas) {
  // two layers: the settled layer (stage plus everything at rest) redraws only when that set changes;
  // the live canvas above it is cleared and redrawn every frame with what moves
  const ctx = canvas.getContext('2d');
  const bgc = document.createElement('canvas');
  bgc.id = 'stage-bg'; bgc.setAttribute('aria-hidden', 'true');
  canvas.parentNode.insertBefore(bgc, canvas);
  const bctx = bgc.getContext('2d', { alpha: false });
  let restKey = -1, shakeCss = '', accentRGB = [255, 122, 89], introEnd = 0;
  const INTRO_DELAY = 0.1, INTRO_POP = 0.32;
  const easeOutBack = (u) => 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2);
  const stat = document.createElement('canvas');
  const sctx = stat.getContext('2d');
  let cw = 0, ch = 0, dpr = 1, s = 40, ox = 0, oy = 0, pal = null;
  let staticDirty = true, simRef = null;
  const fx = [];
  let flash = 0;

  const R = {
    get scale() { return s; },
    resize(w, h, ratio, safe = { top: 0, bottom: 0 }) {
      cw = w; ch = h; dpr = ratio;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      bgc.width = canvas.width; bgc.height = canvas.height;
      bgc.style.width = w + 'px'; bgc.style.height = h + 'px';
      stat.width = canvas.width; stat.height = canvas.height;
      const top = safe.top + 66, bottom = Math.max(safe.bottom + 30, 46);
      s = Math.min(w / W, (h - top - bottom) / CEIL);
      ox = (w - W * s) / 2;
      const extra = Math.max(0, h - top - bottom - CEIL * s);
      oy = h - bottom - extra * 0.42;
      staticDirty = true;
    },
    setPalette(p) { pal = p; accentRGB = hexRGB(p.accent); staticDirty = true; seedMotes(); },
    setSim(sim) {
      simRef = sim; staticDirty = true; while (fx.length) recycle(0); combo.t = -9; cam.kick = 0; cam.ft = 0; cam.z = 1;
      // the level assembles itself: pieces pop in from the bottom up
      const parts = sim.ents.filter((e) => SPRITED[e.kind] === 1 || e.kind === 'bomb');
      parts.sort((a, b) => a.body.getPosition().y - b.body.getPosition().y || a.body.getPosition().x - b.body.getPosition().x);
      const step = Math.min(0.035, 0.42 / Math.max(1, parts.length));
      parts.forEach((e, i) => { e.anim = clock + INTRO_DELAY + i * step; });
      introEnd = parts.length ? clock + INTRO_DELAY + parts.length * step + INTRO_POP : 0;
      return { n: parts.length, step, delay: INTRO_DELAY };
    },
    toScreen(x, y) { return [ox + x * s, oy - y * s]; },
    toWorld(px, py) { return [(px - ox) / s, (oy - py) / s]; },
    floorY: () => oy,
    // a shot during the intro: everything appears at once, nothing is ever hit unseen
    finishIntro() { if (introEnd) introEnd = clock; },
    // a ball squashes against what it hits
    ballHit(x, y, speed) {
      let best = null, bd = Infinity;
      for (const e of simRef?.ents || []) {
        if (e.kind !== 'ball' || !e.alive) continue;
        const p = e.body.getPosition(), d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (!best || bd > 0.5) return;
      const p = best.body.getPosition();
      best.sqT = clock; best.sqK = Math.min(1, speed / 14); best.sqA = -Math.atan2(y - p.y, x - p.x);
    },
    // the pad nearest an impact squashes
    padHit(x, y) {
      let best = null, bd = Infinity;
      for (const e of simRef?.ents || []) {
        if (e.kind !== 'pad') continue;
        const p = e.body.getPosition(), d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (best) best.hitT = performance.now();
    },
    burst, ring, sparkle, shatter, sparks, puff, glow, explosion, muzzle, confetti, punch, focus, combo: comboAt,
    frostHit, lockHit, unlock: unlockFx,
    setTier,
    setFlash: (v) => { flash = v; },
    draw,
  };

  // ---------- stage: wall, light and framing (cached; redrawn on resize, palette or level change) ----------
  const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  let grain = null;
  const stars = [];
  function grainCanvas() {
    if (grain) return grain;
    grain = document.createElement('canvas'); grain.width = grain.height = 160;
    const g = grain.getContext('2d'), img = g.createImageData(160, 160);
    let seed = 90217;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = seed & 1 ? 255 : 0;
      img.data[i + 3] = (seed >> 7) % 30;
    }
    g.putImageData(img, 0, 0);
    return grain;
  }
  // the key light falls from the top left; the beam's axis in world units (y up), shared with the motes
  const BEAM = { x0: W * 0.1, y0: CEIL + 1.2, x1: W * 0.64, y1: -0.5, w0: 1.1, w1: 3.6 };
  function beamBand(c, k, alpha) {
    const [x0, y0] = R.toScreen(BEAM.x0, BEAM.y0), [x1, y1] = R.toScreen(BEAM.x1, BEAM.y1);
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    const a = BEAM.w0 * s * k / 2, b = BEAM.w1 * s * k / 2;
    const g = c.createRadialGradient(x0, y0, 0, x0, y0, L * 1.05);
    g.addColorStop(0, rgba(pal.light, alpha)); g.addColorStop(0.55, rgba(pal.light, alpha * 0.55)); g.addColorStop(1, rgba(pal.light, 0));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x0 + nx * a, y0 + ny * a); c.lineTo(x1 + nx * b, y1 + ny * b);
    c.lineTo(x1 - nx * b, y1 - ny * b); c.lineTo(x0 - nx * a, y0 - ny * a);
    c.closePath(); c.fill();
  }
  function renderStatic() {
    const c = sctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    const top = oy - CEIL * s, left = ox, RW = W * s, RH = CEIL * s;
    // wall
    const g = c.createLinearGradient(0, top, 0, oy);
    g.addColorStop(0, pal.sky[0]); g.addColorStop(1, pal.sky[1]);
    c.fillStyle = g; c.fillRect(0, 0, cw, ch);
    // warm pool of light where the key light enters
    const gl = c.createRadialGradient(left + RW * 0.08, top, 0, left + RW * 0.08, top, RW * 1.05);
    gl.addColorStop(0, rgba(pal.light, pal.dark ? 0.16 : 0.75)); gl.addColorStop(1, rgba(pal.light, 0));
    c.fillStyle = gl; c.fillRect(0, 0, cw, ch);
    // stars (night): fixed sky, a few of them twinkle in the live layer
    stars.length = 0;
    if (pal.dark) {
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 90; i++) {
        const x = rnd() * W, y = 1.2 + rnd() * (CEIL - 1.2), r = rnd() * 0.035 + 0.008, a = 0.18 + rnd() * 0.5;
        const [sx, sy] = R.toScreen(x, y);
        c.fillStyle = `rgba(230,238,255,${a})`;
        c.beginPath(); c.arc(sx, sy, Math.max(0.5, r * s), 0, TAU); c.fill();
        if (i % 9 === 0) stars.push({ x, y, ph: rnd() * TAU, sp: 0.6 + rnd() * 0.9 });
      }
    }
    // shafts of light: nested bands give soft edges
    c.save();
    c.beginPath(); c.rect(left, top, RW, RH); c.clip();
    c.globalCompositeOperation = pal.dark ? 'lighter' : 'source-over';
    const B = pal.beam;
    beamBand(c, 1.0, B * 0.3); beamBand(c, 0.62, B * 0.34); beamBand(c, 0.3, B * 0.32);
    // where the beam lands: a soft pool of light on the wall above the floor
    const [px, py] = R.toScreen(BEAM.x0 + (BEAM.x1 - BEAM.x0) * 0.93, 0.15);
    c.save(); c.translate(px, py); c.scale(1, 0.32);
    const pool = c.createRadialGradient(0, 0, 0, 0, 0, BEAM.w1 * s * 0.75);
    pool.addColorStop(0, rgba(pal.light, B * 0.55)); pool.addColorStop(1, rgba(pal.light, 0));
    c.fillStyle = pool; c.beginPath(); c.arc(0, 0, BEAM.w1 * s * 0.75, 0, TAU); c.fill();
    c.restore();
    c.restore();
    // the room: walls beyond the play area on wide screens, then ceiling and floor
    if (ox > 1) {
      c.fillStyle = pal.floor;
      c.fillRect(0, 0, ox, ch); c.fillRect(ox + RW, 0, ox + 1, ch);
      c.fillStyle = pal.floorEdge;
      c.fillRect(ox - 2, top, 2, RH); c.fillRect(ox + RW, top, 2, RH);
    }
    // ambient occlusion where the wall meets ceiling and floor
    const shade = pal.dark ? 'rgba(0,0,0,0.3)' : 'rgba(90,55,45,0.09)';
    let ao = c.createLinearGradient(0, top, 0, top + 26);
    ao.addColorStop(0, shade); ao.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = ao; c.fillRect(left, top, RW, 26);
    ao = c.createLinearGradient(0, oy - 20, 0, oy);
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, shade);
    c.fillStyle = ao; c.fillRect(left, oy - 20, RW, 20);
    // vignette
    const vx = left + RW / 2, vy = (top + oy) / 2, vr = Math.hypot(RW, RH) / 2;
    const vg = c.createRadialGradient(vx, vy, vr * 0.55, vx, vy, vr * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, pal.dark ? 'rgba(0,0,0,0.32)' : 'rgba(80,45,40,0.1)');
    c.fillStyle = vg; c.fillRect(left, top, RW, RH);
    // ceiling and floor bands frame the room
    let fb = c.createLinearGradient(0, 0, 0, top);
    fb.addColorStop(0, pal.floor); fb.addColorStop(1, pal.floor);
    c.fillStyle = fb; c.fillRect(0, 0, cw, top);
    fb = c.createLinearGradient(0, oy, 0, ch);
    fb.addColorStop(0, pal.floor); fb.addColorStop(1, pal.dark ? '#171C31' : shadeHex(pal.floor, -0.06));
    c.fillStyle = fb; c.fillRect(0, oy, cw, ch - oy);
    c.fillStyle = pal.floorEdge; c.fillRect(0, oy, cw, 2); c.fillRect(0, top - 2, cw, 2);
    c.fillStyle = pal.dark ? 'rgba(0,0,0,0.25)' : 'rgba(90,55,45,0.08)'; c.fillRect(0, oy + 2, cw, 1);
    // fine grain so flat colour reads as a surface
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = pal.dark ? 0.55 : 0.4;
    c.fillStyle = c.createPattern(grainCanvas(), 'repeat');
    c.fillRect(0, 0, stat.width, stat.height);
    c.globalAlpha = 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!simRef) return;
    // static bodies
    for (const e of simRef.ents) {
      if (!e.alive) continue;
      if (e.kind === 'shelf') drawBody(c, e, e.body.getPosition(), e.body.getAngle(), 1, true);
    }
    // a mover's rail shows where it travels
    for (const e of simRef.ents) {
      const t = e.track;
      if (e.kind !== 'mover' || !t || t.spin || (!t.dx && !t.dy)) continue;
      const [ax, ay] = R.toScreen(t.x0 - t.dx, t.y0 - t.dy), [bx, by] = R.toScreen(t.x0 + t.dx, t.y0 + t.dy);
      c.strokeStyle = pal.ink; c.globalAlpha = 0.16; c.lineWidth = 0.05 * s; c.lineCap = 'round';
      c.setLineDash([0.02 * s, 0.14 * s]);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      c.setLineDash([]); c.globalAlpha = 0.3; c.fillStyle = pal.ink;
      for (const [x, y] of [[ax, ay], [bx, by]]) { c.beginPath(); c.arc(x, y, 0.06 * s, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
    }
    for (const rp of simRef.ropes) {
      if (rp.A) continue;
      const [ax, ay] = R.toScreen(rp.ax, rp.ay);
      c.fillStyle = pal.ink;
      c.beginPath(); c.arc(ax, ay, 0.11 * s, 0, TAU); c.fill();
      c.fillRect(ax - 0.32 * s, ay - 0.16 * s, 0.64 * s, 0.07 * s);
    }
  }
  // lighten (k > 0) or darken (k < 0) a #RRGGBB colour
  function shadeHex(hex, k) {
    const n = parseInt(hex.slice(1), 16), t = k < 0 ? 0 : 255, f = Math.abs(k);
    const ch_ = (v) => Math.round(v + (t - v) * f);
    return `rgb(${ch_(n >> 16)},${ch_((n >> 8) & 255)},${ch_(n & 255)})`;
  }

  // ---------- ambient motes: dust in the light, pollen, rising embers, starlight ----------
  const motes = [];
  let moteSprite = null;
  function seedMotes() {
    motes.length = 0;
    const m = pal.motes;
    if (!m) return;
    for (let i = 0; i < m.n; i++) motes.push({ x: Math.random() * W, y: Math.random() * CEIL, r: 0.025 + Math.random() * 0.05, ph: Math.random() * TAU, sp: 0.4 + Math.random() * 0.8 });
    moteSprite = document.createElement('canvas'); moteSprite.width = moteSprite.height = 32;
    const g = moteSprite.getContext('2d'), rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, rgba(m.rgb, 1)); rg.addColorStop(0.35, rgba(m.rgb, 0.55)); rg.addColorStop(1, rgba(m.rgb, 0));
    g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  }
  // 0..1: how deep inside the shaft of light a world point is
  function inBeam(x, y) {
    const dx = BEAM.x1 - BEAM.x0, dy = BEAM.y1 - BEAM.y0, L2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - BEAM.x0) * dx + (y - BEAM.y0) * dy) / L2));
    const d = Math.abs((x - BEAM.x0) * dy - (y - BEAM.y0) * dx) / Math.sqrt(L2);
    const hw = (BEAM.w0 + (BEAM.w1 - BEAM.w0) * t) * 0.5;
    return Math.max(0, 1 - d / hw);
  }
  function drawMotes(c, dt) {
    const m = pal.motes;
    if (!m || !moteSprite) return;
    const t = performance.now() / 1000;
    for (const p of motes) {
      p.x += Math.sin(t * 0.4 + p.ph) * 0.04 * dt * p.sp;
      p.y += (m.rise + Math.sin(t * 0.3 + p.ph * 2) * 0.04) * dt * p.sp;
      if (p.y > CEIL) { p.y = 0.2; p.x = Math.random() * W; }
      if (p.y < 0) { p.y = CEIL - 0.2; p.x = Math.random() * W; }
      if (p.x < 0) p.x += W; else if (p.x > W) p.x -= W;
      let a;
      if (m.ember) a = (0.25 + 0.75 * Math.max(0, 1 - p.y / CEIL)) * (0.55 + 0.45 * Math.sin(t * 6 * p.sp + p.ph));
      else a = (pal.dark ? 0.35 : 0.12) + (pal.dark ? 0.5 : 0.85) * Math.pow(inBeam(p.x, p.y), 1.2);
      const [sx, sy] = R.toScreen(p.x, p.y), z = p.r * s * (m.ember ? 2.2 : 3);
      c.globalAlpha = a * (0.75 + 0.25 * Math.sin(t * 1.3 * p.sp + p.ph));
      c.drawImage(moteSprite, sx - z, sy - z, z * 2, z * 2);
    }
    // a few stars twinkle
    for (const st of stars) {
      const k = Math.pow(Math.max(0, Math.sin(t * st.sp + st.ph)), 18);
      if (k < 0.02) continue;
      const [sx, sy] = R.toScreen(st.x, st.y), z = 0.16 * s * k;
      c.globalAlpha = k * 0.9; c.fillStyle = '#FFFFFF';
      c.beginPath(); c.moveTo(sx, sy - z); c.lineTo(sx + z * 0.16, sy - z * 0.16); c.lineTo(sx + z, sy); c.lineTo(sx + z * 0.16, sy + z * 0.16);
      c.lineTo(sx, sy + z); c.lineTo(sx - z * 0.16, sy + z * 0.16); c.lineTo(sx - z, sy); c.lineTo(sx - z * 0.16, sy - z * 0.16); c.closePath(); c.fill();
    }
    c.globalAlpha = 1;
  }

  // ---------- shapes ----------
  function polyPath(c, pts) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  }
  function roundedRect(c, w, h, r) {
    const x = -w / 2, y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  function drawBody(c, e, p, a, k = 1, isStatic = false) {
    const [sx, sy] = R.toScreen(p.x, p.y);
    c.save();
    c.translate(sx, sy);
    c.rotate(-a);
    c.scale(s * k, -s * k);
    const lw = 1 / s;
    switch (e.kind) {
      case 'shelf': case 'mover': {
        const rr = Math.min(e.w, e.h) * 0.5;
        // lacquered bar: soft cast shadow, lit top, darker underside
        c.save();
        if (isStatic || T.liveShadows) {
          c.shadowColor = pal.dark ? 'rgba(0,0,0,0.55)' : 'rgba(60,35,35,0.3)';
          c.shadowBlur = 0.16 * s * dpr; c.shadowOffsetX = 0.05 * s * dpr; c.shadowOffsetY = 0.1 * s * dpr;
        }
        const g = c.createLinearGradient(0, e.h / 2, 0, -e.h / 2);
        const [top, bottom] = e.kind === 'mover' ? [shadeHex(pal.shelf[0], 0.12), pal.shelf[0]] : pal.shelf;
        g.addColorStop(0, top); g.addColorStop(1, bottom);
        c.fillStyle = g; roundedRect(c, e.w, e.h, rr); c.fill();
        c.restore();
        c.strokeStyle = pal.dark ? 'rgba(235,242,255,0.55)' : 'rgba(255,255,255,0.32)'; c.lineWidth = lw * 1.2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-e.w / 2 + rr, e.h / 2 - lw * 1.2); c.lineTo(e.w / 2 - rr, e.h / 2 - lw * 1.2); c.stroke();
        if (e.kind === 'mover') {
          // a machined hub marks the moving part
          c.fillStyle = pal.accent;
          c.beginPath(); c.arc(0, 0, Math.min(0.075, e.h * 0.34), 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.7)';
          c.beginPath(); c.arc(-0.012, 0.012, Math.min(0.025, e.h * 0.12), 0, TAU); c.fill();
        }
        break;
      }
      case 'pad': {
        // springy: squashes for a moment when the ball lands
        const u = e.hitT ? (performance.now() - e.hitT) / 300 : 1;
        const sq = u < 1 ? Math.sin(u * Math.PI) * (1 - u) * 0.55 : 0;
        c.scale(1 + sq * 0.25, 1 - sq);
        c.save();
        if (T.liveShadows) {
          c.shadowColor = rgba(accentRGB, 0.35 + sq);
          c.shadowBlur = (0.22 + sq * 0.4) * s * dpr; c.shadowOffsetY = 0.04 * s * dpr;
        }
        const g = c.createLinearGradient(0, e.h / 2, 0, -e.h / 2);
        g.addColorStop(0, shadeHex(pal.accent, 0.3)); g.addColorStop(1, shadeHex(pal.accent, -0.12));
        c.fillStyle = g; roundedRect(c, e.w, e.h, e.h / 2); c.fill();
        c.restore();
        c.fillStyle = 'rgba(255,255,255,0.4)';
        roundedRect(c, e.w - e.h * 0.6, e.h * 0.22, e.h * 0.11); c.save(); c.translate(0, e.h * 0.2); c.fill(); c.restore();
        // chevrons say "bounce"
        c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = lw * 1.6; c.lineCap = 'round'; c.lineJoin = 'round';
        const ch_ = e.h * 0.2;
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * e.w / 4 - ch_, -ch_ * 0.55); c.lineTo(i * e.w / 4, ch_ * 0.45); c.lineTo(i * e.w / 4 + ch_, -ch_ * 0.55); c.stroke(); }
        break;
      }
      case 'shard': drawShard(c, e, a, lw); break;
      case 'bomb': {
        const r = e.circle;
        const t = performance.now() / 1000;
        const pulse = 0.5 + 0.5 * Math.sin(t * 5.5 + e.id);
        // live: a warm halo breathes around it
        const halo = c.createRadialGradient(0, 0, r * 0.5, 0, 0, r * (1.6 + pulse * 0.25));
        halo.addColorStop(0, rgba(accentRGB, 0.28 + pulse * 0.12)); halo.addColorStop(1, rgba(accentRGB, 0));
        c.fillStyle = halo; c.beginPath(); c.arc(0, 0, r * 1.9, 0, TAU); c.fill();
        // fuse with a spark
        c.strokeStyle = pal.dark ? '#C9CEDF' : '#4A4152'; c.lineWidth = lw * 2.2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, r * 0.85); c.quadraticCurveTo(r * 0.05, r * 1.3, r * 0.42, r * 1.38); c.stroke();
        const fl = 0.75 + 0.25 * Math.sin(t * 31 + e.id * 3);
        const sg = c.createRadialGradient(r * 0.42, r * 1.38, 0, r * 0.42, r * 1.38, r * 0.42 * fl);
        sg.addColorStop(0, 'rgba(255,250,220,1)'); sg.addColorStop(0.35, rgba(accentRGB, 0.9)); sg.addColorStop(1, rgba(accentRGB, 0));
        c.fillStyle = sg; c.beginPath(); c.arc(r * 0.42, r * 1.38, r * 0.42 * fl, 0, TAU); c.fill();
        // iron shell
        const gr = c.createRadialGradient(-r * 0.35, r * 0.4, r * 0.05, 0, 0, r);
        gr.addColorStop(0, '#6E647E'); gr.addColorStop(0.55, '#2E2838'); gr.addColorStop(1, '#16121C');
        c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.fillStyle = '#3A3346'; c.fillRect(-r * 0.22, r * 0.78, r * 0.44, r * 0.18);
        // glowing core
        const cr = r * (0.36 + pulse * 0.05);
        const cg = c.createRadialGradient(0, 0, 0, 0, 0, cr);
        cg.addColorStop(0, '#FFF3D6'); cg.addColorStop(0.45, shadeHex(pal.accent, 0.25)); cg.addColorStop(1, pal.accent);
        c.fillStyle = cg; c.beginPath(); c.arc(0, 0, cr, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = lw * 1.4; c.beginPath(); c.arc(0, 0, cr + lw * 2, 0, TAU); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.beginPath(); c.ellipse(-r * 0.42, r * 0.44, r * 0.2, r * 0.11, 0.7, 0, TAU); c.fill();
        break;
      }
    }
    c.restore();
  }
  const hexRGB = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const hashId = (e) => (((e.id || 1) * 2654435761) >>> 0) / 4294967296;

  const GOLD = [255, 192, 72];
  function glassRGB(e) { return e.key ? GOLD : pal.glass[(e.tint || 0) % pal.glass.length]; }

  // ---------- glass: each piece is baked into a sprite (rebuilt when scale, palette or tint change) ----------
  const LIGHT = [-0.6, 0.8]; // toward the key light (top left), world units, y up
  const SHADOW = [0.1, -0.14]; // where shadows fall, world units
  function shapePath(c, e) { if (e.circle) { c.beginPath(); c.arc(0, 0, e.circle, 0, TAU); } else polyPath(c, e.outline); }
  function shapeBounds(e) {
    if (e.circle) return [-e.circle, -e.circle, e.circle, e.circle];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of e.outline) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return [x0, y0, x1, y1];
  }
  // paint(c) draws in the body's local units (y up); returns the sprite and its anchor in CSS px
  function bake(e, m, paint) {
    const [x0, y0, x1, y1] = shapeBounds(e), k = s * dpr;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil((x1 - x0 + 2 * m) * k)); cv.height = Math.max(1, Math.ceil((y1 - y0 + 2 * m) * k));
    const c = cv.getContext('2d');
    c.setTransform(k, 0, 0, -k, (m - x0) * k, (y1 + m) * k);
    paint(c, x0, y0, x1, y1);
    return { cv, ax: (m - x0) * s, ay: (y1 + m) * s, w: cv.width / dpr, h: cv.height / dpr };
  }
  // a band across the shape, perpendicular to the light: offsets d0..d1 from the centre along LIGHT
  function lightBand(c, R0, d0, d1, alpha, fade = true) {
    c.save();
    c.rotate(Math.atan2(LIGHT[1], LIGHT[0]) - Math.PI / 2);
    if (fade) {
      const g = c.createLinearGradient(-R0 * 1.2, 0, R0 * 1.2, 0);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`); g.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.8})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
    } else c.fillStyle = `rgba(255,255,255,${alpha})`;
    c.fillRect(-R0 * 1.4, d0 * R0, R0 * 2.8, (d1 - d0) * R0);
    c.restore();
  }
  function star4(c, x, y, z, alpha) {
    c.fillStyle = `rgba(255,255,255,${alpha})`;
    c.beginPath(); c.moveTo(x, y + z); c.lineTo(x + z * 0.18, y + z * 0.18); c.lineTo(x + z, y); c.lineTo(x + z * 0.18, y - z * 0.18);
    c.lineTo(x, y - z); c.lineTo(x - z * 0.18, y - z * 0.18); c.lineTo(x - z, y); c.lineTo(x - z * 0.18, y + z * 0.18); c.closePath(); c.fill();
  }
  function paintGlass(c, e, x0, y0, x1, y1) {
    const [r, g, b] = glassRGB(e);
    const lw = 1 / s, dark = pal.dark;
    const R0 = Math.max(x1 - x0, y1 - y0) / 2;
    const tint = (a) => `rgba(${r},${g},${b},${a})`;
    // body: clear where the light enters, denser away from it
    let gr;
    if (e.circle) {
      gr = c.createRadialGradient(-R0 * 0.32, R0 * 0.36, R0 * 0.05, 0, 0, R0);
      gr.addColorStop(0, tint(dark ? 0.1 : 0.08)); gr.addColorStop(0.68, tint(dark ? 0.26 : 0.3)); gr.addColorStop(1, tint(dark ? 0.62 : 0.68));
    } else {
      gr = c.createLinearGradient(x0, y1, x1, y0);
      gr.addColorStop(0, tint(dark ? 0.14 : 0.16)); gr.addColorStop(1, tint(dark ? 0.42 : 0.5));
    }
    c.fillStyle = gr; shapePath(c, e); c.fill();
    c.save(); shapePath(c, e); c.clip();
    c.lineJoin = 'round';
    // the glass wall seen edge-on: a saturated band just inside the outline
    c.strokeStyle = tint(dark ? 0.55 : 0.62); c.lineWidth = 0.13; shapePath(c, e); c.stroke();
    // reflections: a soft wide streak and a crisp thin one across the lit side, a faint one on the far side
    const v = hashId(e) - 0.5;
    lightBand(c, R0, 0.18 + v * 0.16, 0.46 + v * 0.1, dark ? 0.16 : 0.26);
    lightBand(c, R0, 0.56 + v * 0.12, 0.63 + v * 0.12, dark ? 0.5 : 0.7);
    lightBand(c, R0, -0.86, -0.8, dark ? 0.18 : 0.3, false);
    c.restore();
    // crisp outline, then the rim catching the light on the top-left edges
    c.strokeStyle = pal.glassEdge; c.lineWidth = lw * 1.25; shapePath(c, e); c.stroke();
    c.save();
    c.rotate(Math.atan2(LIGHT[1], LIGHT[0]) - Math.PI / 2);
    c.beginPath(); c.rect(-R0 * 3, -R0 * 0.15, R0 * 6, R0 * 4); c.clip(); // the half facing the light
    c.rotate(-(Math.atan2(LIGHT[1], LIGHT[0]) - Math.PI / 2));
    c.translate(lw * 0.6, -lw * 0.6);
    c.strokeStyle = dark ? 'rgba(220,240,255,0.8)' : 'rgba(255,255,255,0.95)'; c.lineWidth = lw * 1.5; shapePath(c, e); c.stroke();
    c.restore();
    // a point of light where the rim meets the key light
    let gx = 0, gy = 0, best = -Infinity;
    if (e.circle) { gx = LIGHT[0] * R0 * 0.62; gy = LIGHT[1] * R0 * 0.62; }
    else for (const [x, y] of e.outline) { const d = x * LIGHT[0] + y * LIGHT[1]; if (d > best) { best = d; gx = x * 0.82; gy = y * 0.82; } }
    if (e.circle || hashId(e) < 0.45) star4(c, gx, gy, Math.min(0.14, R0 * 0.32), dark ? 0.75 : 0.95);
    if (e.frost) paintFrost(c, e, x0, y0, x1, y1, R0);
    if (e.lock) paintLock(c, R0);
    else if (e.key) paintKey(c, e, R0);
  }
  // frosted glass: thick and milky, with a second wall inside the first; once hit, it carries the crack
  function paintFrost(c, e, x0, y0, x1, y1, R0) {
    const lw = 1 / s, dark = pal.dark;
    c.save(); shapePath(c, e); c.clip();
    c.fillStyle = dark ? 'rgba(220,235,255,0.2)' : 'rgba(255,255,255,0.42)'; shapePath(c, e); c.fill();
    // frost: a fixed stipple, the same every time this piece is drawn
    let seed = Math.floor(hashId(e) * 233280);
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const n = Math.min(70, Math.round((x1 - x0) * (y1 - y0) * 90));
    c.fillStyle = dark ? 'rgba(230,240,255,0.4)' : 'rgba(255,255,255,0.8)';
    for (let i = 0; i < n; i++) { c.beginPath(); c.arc(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.008 + rnd() * 0.018, 0, TAU); c.fill(); }
    const [r, g, b] = glassRGB(e);
    c.strokeStyle = `rgba(${r},${g},${b},${dark ? 0.7 : 0.78})`; c.lineWidth = 0.24; shapePath(c, e); c.stroke();
    c.restore();
    // the inner wall
    c.save(); c.scale(0.74, 0.74);
    c.strokeStyle = dark ? 'rgba(225,240,255,0.65)' : 'rgba(255,255,255,0.95)'; c.lineWidth = lw * 2 / 0.74; shapePath(c, e); c.stroke();
    c.restore();
    if (e.hp > 1) return;
    // cracked: a star of splits from where it was hit, jagged, with a dark edge so it reads on any tint
    // the star starts between the hit and the middle, so it spreads across the pane
    const cx = (e.crack?.[0] || 0) * 0.45, cy = (e.crack?.[1] || 0) * 0.45;
    c.save(); shapePath(c, e); c.clip();
    let sd = Math.floor(hashId(e) * 233280 + 7919) % 233280;
    const rr = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    const path = () => {
      c.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + (rr() - 0.5) * 0.6, L = R0 * (1.0 + rr() * 0.9);
        let px = cx, py = cy;
        c.moveTo(px, py);
        for (let j = 1; j <= 3; j++) {
          const t = (L * j) / 3, ja = a + (rr() - 0.5) * 0.5;
          px = cx + Math.cos(ja) * t; py = cy + Math.sin(ja) * t; c.lineTo(px, py);
        }
      }
      c.moveTo(cx + R0 * 0.22, cy); c.arc(cx, cy, R0 * 0.22, 0, TAU);
    };
    const seed0 = sd;
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = dark ? 'rgba(10,14,30,0.5)' : 'rgba(40,48,70,0.35)'; c.lineWidth = lw * 2.6; path(); c.stroke();
    sd = seed0;
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = lw * 1.2; path(); c.stroke();
    c.restore();
  }
  // a padlock: this piece shrugs off every hit until the gold glass breaks
  function paintLock(c, R0) {
    const z = Math.min(0.3, R0 * 0.62), dark = pal.dark;
    c.save();
    c.fillStyle = dark ? 'rgba(10,14,30,0.45)' : 'rgba(255,255,255,0.7)';
    c.beginPath(); c.arc(0, 0, z * 0.95, 0, TAU); c.fill();
    const bw = z * 1.0, bh = z * 0.78, by = -z * 0.52;
    c.strokeStyle = pal.ink; c.lineWidth = z * 0.17; c.lineCap = 'round';
    c.beginPath(); c.arc(0, by + bh, z * 0.3, 0, Math.PI); c.stroke();
    c.fillStyle = pal.ink;
    c.beginPath(); c.roundRect ? c.roundRect(-bw / 2, by, bw, bh, z * 0.14) : c.rect(-bw / 2, by, bw, bh); c.fill();
    c.fillStyle = dark ? '#141A2E' : '#FFFFFF';
    c.beginPath(); c.arc(0, by + bh * 0.58, z * 0.11, 0, TAU); c.fill();
    c.fillRect(-z * 0.04, by + bh * 0.18, z * 0.08, bh * 0.4);
    c.restore();
  }
  // the key: gold glass marked with a key, the one piece that opens the locks
  function paintKey(c, e, R0) {
    const z = Math.min(0.28, R0 * 0.58);
    c.save();
    // at night the gold glows from inside, so it reads as gold and not as dim brass
    if (pal.dark) {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, R0);
      g.addColorStop(0, 'rgba(255,214,120,0.5)'); g.addColorStop(1, 'rgba(255,190,80,0.12)');
      c.fillStyle = g; shapePath(c, e); c.fill();
    }
    c.lineCap = 'round'; c.lineJoin = 'round';
    const path = () => {
      c.beginPath();
      c.arc(-z * 0.42, 0, z * 0.26, 0, TAU);
      c.moveTo(-z * 0.16, 0); c.lineTo(z * 0.62, 0);
      c.moveTo(z * 0.36, 0); c.lineTo(z * 0.36, -z * 0.24);
      c.moveTo(z * 0.58, 0); c.lineTo(z * 0.58, -z * 0.18);
    };
    c.strokeStyle = 'rgba(150,92,10,0.55)'; c.lineWidth = z * 0.3; path(); c.stroke();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = z * 0.15; path(); c.stroke();
    c.restore();
  }
  function paintShadow(c, e) {
    const [r, g, b] = glassRGB(e);
    const BIG = 1000, k = s * dpr;
    c.save();
    // the silhouette is drawn far away; only its blurred shadow lands in the sprite
    c.shadowColor = pal.dark ? `rgba(${r},${g},${b},0.3)` : `rgba(${r * 0.72 | 0},${g * 0.66 | 0},${b * 0.8 | 0},0.3)`;
    c.shadowBlur = 0.16 * k; c.shadowOffsetX = BIG * k;
    c.translate(-BIG, 0);
    c.fillStyle = '#000'; shapePath(c, e); c.fill();
    c.restore();
    // light focused through the glass: a brighter core inside the shadow
    const [x0, y0, x1, y1] = shapeBounds(e), R0 = Math.max(x1 - x0, y1 - y0) / 2;
    const cg = c.createRadialGradient(0, 0, 0, 0, 0, R0 * 0.6);
    cg.addColorStop(0, `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)},${pal.dark ? 0.28 : 0.4})`);
    cg.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = cg; c.beginPath(); c.arc(0, 0, R0 * 0.6, 0, TAU); c.fill();
  }
  function paintWood(c, e, x0, y0, x1, y1) {
    const lw = 1 / s, w = x1 - x0, h = y1 - y0, long = w >= h, v = hashId(e);
    const g = long ? c.createLinearGradient(0, y1, 0, y0) : c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#F5D3A0'); g.addColorStop(0.45, '#E4B073'); g.addColorStop(1, '#C88D50');
    c.fillStyle = g; shapePath(c, e); c.fill();
    c.save(); shapePath(c, e); c.clip();
    // grain runs along the plank
    const L = long ? w : h, T = long ? h : w;
    c.strokeStyle = 'rgba(128,72,28,0.3)'; c.lineWidth = lw * 1.1;
    for (let i = 0; i < 3; i++) {
      const off = (-0.28 + i * 0.28 + v * 0.1) * T;
      c.beginPath();
      for (let j = 0; j <= 12; j++) {
        const u = -L / 2 + (j / 12) * L, q = off + Math.sin(j * 0.7 + v * 20 + i * 2) * T * 0.05;
        if (long) { if (j) c.lineTo(u, q); else c.moveTo(u, q); } else { if (j) c.lineTo(q, u); else c.moveTo(q, u); }
      }
      c.stroke();
    }
    // a small knot on longer planks
    if (L > 0.9) {
      const kx = (v - 0.5) * L * 0.5, ky = (v - 0.5) * T * 0.3;
      c.fillStyle = 'rgba(120,66,26,0.32)'; c.beginPath();
      if (long) c.ellipse(kx, ky, T * 0.16, T * 0.1, 0, 0, TAU); else c.ellipse(ky, kx, T * 0.1, T * 0.16, 0, 0, TAU);
      c.fill();
    }
    c.restore();
    c.strokeStyle = 'rgba(122,70,30,0.55)'; c.lineWidth = lw * 1.1; shapePath(c, e); c.stroke();
    c.strokeStyle = 'rgba(255,244,222,0.75)'; c.lineWidth = lw * 1.2;
    c.beginPath(); c.moveTo(x0 + lw, y0 + lw * 2); c.lineTo(x0 + lw, y1 - lw); c.lineTo(x1 - lw * 2, y1 - lw); c.stroke();
  }
  function paintStone(c, e, x0, y0, x1, y1) {
    const lw = 1 / s, dark = pal.dark, v = hashId(e);
    const R0 = Math.max(x1 - x0, y1 - y0) / 2;
    const g = c.createLinearGradient(x0, y1, x1, y0);
    g.addColorStop(0, dark ? '#A4AAC2' : '#9A95A6'); g.addColorStop(1, dark ? '#565C78' : '#57525F');
    c.fillStyle = g; shapePath(c, e); c.fill();
    c.save(); shapePath(c, e); c.clip();
    // speckles give it grit and weight
    let seed = Math.floor(v * 1e6) + 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      c.fillStyle = i % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(30,25,40,0.18)';
      c.beginPath(); c.arc(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), (0.012 + rnd() * 0.028), 0, TAU); c.fill();
    }
    lightBand(c, R0, 0.55, 0.95, 0.12, false);
    c.restore();
    c.strokeStyle = dark ? 'rgba(20,24,40,0.6)' : 'rgba(40,34,48,0.45)'; c.lineWidth = lw * 1.2; shapePath(c, e); c.stroke();
  }
  // a soft, neutral contact shadow for opaque things
  function paintShade(c, e) {
    const BIG = 1000, k = s * dpr;
    c.shadowColor = pal.dark ? 'rgba(0,0,0,0.42)' : 'rgba(60,35,40,0.24)';
    c.shadowBlur = 0.14 * k; c.shadowOffsetX = BIG * k;
    c.translate(-BIG, 0);
    c.fillStyle = '#000'; shapePath(c, e); c.fill();
  }
  const PAINT = { glass: paintGlass, wood: paintWood, stone: paintStone };
  function sprites(e) {
    const key = s * dpr + '|' + pal.id + '|' + (e.tint || 0) + '|' + (e.hp || 1) + '|' + (e.lock || 0) + '|' + (e.key || 0);
    if (e.spr?.key !== key) {
      const glass = e.kind === 'glass';
      e.spr = {
        key,
        body: e.kind === 'bomb' ? null : bake(e, 0.08, (c, ...b) => PAINT[e.kind](c, e, ...b)),
        shadow: bake(e, 0.4, (c) => (glass ? paintShadow(c, e) : paintShade(c, e))),
      };
    }
    return e.spr;
  }
  function blit(c, sp, x, y, a, k = 1) {
    c.save(); c.translate(x, y); c.rotate(-a); if (k !== 1) c.scale(k, k);
    c.drawImage(sp.cv, -sp.ax, -sp.ay, sp.w, sp.h);
    c.restore();
  }
  function drawShadow(c, e, p, a, k = 1) {
    const sp = sprites(e).shadow;
    const [sx, sy] = R.toScreen(p.x + SHADOW[0], p.y + SHADOW[1]);
    // at night, glass throws coloured light instead of shade
    if (pal.dark && e.kind === 'glass') c.globalCompositeOperation = 'lighter';
    blit(c, sp, sx, sy, a, k);
    c.globalCompositeOperation = 'source-over';
  }

  function drawShard(c, e, a, lw) {
    const k = Math.max(0, Math.min(1, (e.life - e.age) / 0.45));
    if (k <= 0) return;
    const pts = e.polys[0];
    if (e.fill === undefined) {
      const [r, g, b] = glassRGB(e);
      e.fill = `rgba(${r},${g},${b},${pal.dark ? 0.45 : 0.42})`;
      e.edge = `rgba(${Math.max(0, r - 45)},${Math.max(0, g - 45)},${Math.max(0, b - 30)},0.8)`;
      let A = 0;
      for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; A += x0 * y1 - x1 * y0; }
      e.ccw = A > 0; e.ph = Math.random() * TAU;
    }
    c.globalAlpha = k;
    polyPath(c, pts);
    c.fillStyle = e.fill; c.fill();
    c.lineJoin = 'round'; c.strokeStyle = e.edge; c.lineWidth = lw * 1.1; c.stroke();
    if (!T.edges) { c.globalAlpha = 1; return; } // thinned out on slow devices
    // edges that face the key light catch it
    const ca = Math.cos(a), sa = Math.sin(a);
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      let nx = y1 - y0, ny = x0 - x1;
      if (!e.ccw) { nx = -nx; ny = -ny; }
      const wx = nx * ca - ny * sa, wy = nx * sa + ny * ca;
      if ((wx * LIGHT[0] + wy * LIGHT[1]) / (Math.hypot(wx, wy) || 1) > 0.3) { c.moveTo(x0, y0); c.lineTo(x1, y1); }
    }
    c.strokeStyle = pal.dark ? 'rgba(225,240,255,0.9)' : 'rgba(255,255,255,0.95)'; c.lineWidth = lw * 1.4; c.stroke();
    // a glint as the shard turns toward the light, and a flash of heat as it breaks away
    const gl = Math.pow(Math.max(0, Math.sin(a * 2 + e.ph)), 14) * 0.75 + (e.age < 0.14 ? (1 - e.age / 0.14) * 0.7 : 0);
    if (gl > 0.04) { polyPath(c, pts); c.fillStyle = `rgba(255,255,255,${Math.min(0.9, gl).toFixed(2)})`; c.fill(); }
    c.globalAlpha = 1;
  }

  // st: stretch along `dir` (> 0 at speed, < 0 squashed by an impact)
  function drawBall(c, x, y, r, skin, angle = 0, st = 0, dir = 0) {
    const [base, light, dark] = skin.c;
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.1)'; c.beginPath(); c.arc(r * 0.16, r * 0.26, r * 0.98, 0, TAU); c.fill();
    if (st) { c.rotate(dir); c.scale(1 + st, 1 - st * 0.6); c.rotate(-dir); }
    let gr;
    if (skin.grad) {
      gr = c.createLinearGradient(-r, -r, r, r);
      skin.grad.forEach((col, i) => gr.addColorStop(i / (skin.grad.length - 1), col));
    } else {
      gr = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
      gr.addColorStop(0, light); gr.addColorStop(0.45, base); gr.addColorStop(1, dark);
    }
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    if (skin.prism) {
      c.save(); c.rotate(angle);
      const cols = ['#FF7A7A', '#FFD36E', '#7CF29C', '#6EC8FF', '#B48CFF'];
      cols.forEach((col, i) => { c.fillStyle = col; c.globalAlpha = 0.55; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, (i / 5) * TAU, ((i + 1) / 5) * TAU); c.fill(); });
      c.globalAlpha = 1; c.restore();
    }
    if (skin.veins) {
      c.save(); c.rotate(angle); c.strokeStyle = 'rgba(120,115,135,0.45)'; c.lineWidth = Math.max(1, r * 0.08);
      c.beginPath(); c.moveTo(-r * 0.8, -r * 0.2); c.quadraticCurveTo(-r * 0.1, r * 0.1, r * 0.7, -r * 0.5); c.moveTo(-r * 0.3, r * 0.7); c.quadraticCurveTo(0, r * 0.2, r * 0.6, r * 0.4); c.stroke(); c.restore();
    }
    if (skin.craters) {
      c.save(); c.rotate(angle); c.fillStyle = 'rgba(110,115,130,0.35)';
      for (const [cx, cy, cr] of [[-0.3, 0.2, 0.22], [0.35, -0.25, 0.16], [0.2, 0.45, 0.12]]) { c.beginPath(); c.arc(cx * r, cy * r, cr * r, 0, TAU); c.fill(); }
      c.restore();
    }
    // bounce light from the room on the far side, then a crisp edge and two highlights
    c.strokeStyle = pal?.dark ? 'rgba(150,190,255,0.4)' : 'rgba(255,236,220,0.5)'; c.lineWidth = r * 0.13; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, r * 0.86, 0.05 * Math.PI, 0.62 * Math.PI); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = Math.max(0.8, r * 0.04);
    c.beginPath(); c.arc(0, 0, r - c.lineWidth / 2, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath(); c.ellipse(-r * 0.36, -r * 0.42, r * 0.26, r * 0.16, -0.6, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath(); c.arc(-r * 0.42, -r * 0.46, r * 0.07, 0, TAU); c.fill();
    c.restore();
  }
  R.drawBall = drawBall;

  // ---------- fx: pooled particles, so effects never churn garbage ----------
  const WHITE = [255, 255, 255];
  const pool = [];
  let clock = 0, quality = 1;
  // performance tier (0 = everything; each step drops the effects people notice least)
  let tier = 0;
  const T = { motes: true, dust: true, liveShadows: true, camera: true, edges: true, glow: 1 };
  function setTier(t) {
    tier = t;
    quality = [1, 0.75, 0.5, 0.35][t];
    T.motes = t < 1; T.dust = t < 1; T.liveShadows = t < 2; T.camera = t < 2; T.edges = t < 2; T.glow = t < 2 ? 1 : 0.7;
  }
  function spawn(t, x, y, life) {
    const f = pool.pop() || {};
    f.t = t; f.x = x; f.y = y; f.life = life; f.age = 0;
    f.vx = 0; f.vy = 0; f.grav = 0; f.drag = 0; f.size = 0.06; f.size2 = 0; f.rgb = WHITE; f.ph = Math.random() * TAU; f.col = null; f.width = 0; f.r = 0; f.data = null;
    if (fx.length >= 480) {
      let oldest = 0, most = -1;
      for (let i = 0; i < fx.length; i++) { const k = fx[i].age / fx[i].life; if (k > most) { most = k; oldest = i; } }
      recycle(oldest);
    }
    fx.push(f);
    return f;
  }
  function recycle(i) { const f = fx[i]; fx[i] = fx[fx.length - 1]; fx.pop(); pool.push(f); }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function radial(f, speed, up = 0) { const a = Math.random() * TAU, v = speed * rnd(0.35, 1); f.vx = Math.cos(a) * v; f.vy = Math.sin(a) * v + up; }

  // soft sprites: a white glow and tinted dust dots
  let glowSpr = null;
  const dotSpr = {};
  function softDot(rgb, core) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, rgba(rgb, 1)); rg.addColorStop(core, rgba(rgb, 0.55)); rg.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    return cv;
  }
  const glowSpr2 = {};
  const glowSprite = (rgb) => (!rgb || rgb === WHITE ? glowSpr || (glowSpr = softDot(WHITE, 0.22)) : glowSpr2[rgb] || (glowSpr2[rgb] = softDot(rgb, 0.3)));
  const dotSprite = (rgb) => dotSpr[rgb] || (dotSpr[rgb] = softDot(rgb, 0.4));

  // the moment glass breaks: a flash, a star of cracks, glitter and a puff of glass dust
  // skin: the equipped ball's glitter colours (a ball you bought leaves its own sparkle in every break)
  function shatter(x, y, rgb, power = 0.6, big = false, skin = null) {
    let f = spawn('glow', x, y, big ? 0.45 : 0.26);
    f.size = 0.2; f.size2 = big ? 2.6 : 1.1 + power * 0.5;
    f = spawn('crack', x, y, 0.22);
    const n = 6 + Math.floor(Math.random() * 3);
    f.data = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { f.data[i * 2] = (i / n) * TAU + rnd(-0.25, 0.25); f.data[i * 2 + 1] = rnd(0.35, 0.95) * (0.8 + power * 0.4); }
    const ng = Math.round(((big ? 22 : 11) + power * 7) * quality);
    for (let i = 0; i < ng; i++) {
      f = spawn('glit', x + rnd(-0.15, 0.15), y + rnd(-0.15, 0.15), rnd(0.55, 1.25));
      radial(f, 2.2 + power * 3.2, 1.2); f.grav = 0.35; f.drag = 1.6; f.size = rnd(0.045, 0.11);
      const roll = Math.random();
      f.col = skin && roll < 0.4 ? skin[Math.floor(Math.random() * skin.length)] : roll < 0.7 ? '#FFFFFF' : `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    }
    const nd = Math.round(5 * quality);
    for (let i = 0; i < nd; i++) {
      f = spawn('dust', x + rnd(-0.2, 0.2), y + rnd(-0.2, 0.2), rnd(0.5, 0.9));
      radial(f, 1.1, 0.25); f.drag = 2.6; f.grav = -0.08; f.size = rnd(0.12, 0.2); f.size2 = f.size * rnd(2, 2.8); f.rgb = rgb;
    }
  }
  // a hot, quick spray (ball impacts, bombs)
  function sparks(x, y, n, speed, rgb = WHITE, life = 0.4) {
    for (let i = 0; i < n * quality; i++) {
      const f = spawn('spark', x, y, rnd(life * 0.6, life));
      radial(f, speed, speed * 0.2); f.grav = 0.8; f.drag = 1.2; f.size = rnd(0.02, 0.035);
      f.col = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    }
  }
  function puff(x, y, n, rgb, size = 0.25, life = 0.9) {
    for (let i = 0; i < n * quality; i++) {
      const f = spawn('dust', x + rnd(-0.3, 0.3), y + rnd(-0.3, 0.3), rnd(life * 0.7, life));
      radial(f, 1.4, 0.5); f.drag = 2.2; f.grav = -0.15; f.size = size * rnd(0.6, 1); f.size2 = f.size * 2.4; f.rgb = rgb;
    }
  }
  // a gentle shower of glass confetti from the top of the room
  function confetti(n) {
    const cols = [...pal.glass.map((g) => `rgb(${g[0]},${g[1]},${g[2]})`), '#FFFFFF', pal.accent];
    for (let i = 0; i < n * quality; i++) {
      const f = spawn('conf', rnd(0.3, W - 0.3), CEIL + rnd(0.2, 1.6), rnd(1.6, 2.6));
      f.vx = rnd(-0.6, 0.6); f.vy = rnd(-2.6, -0.8); f.grav = 0.18; f.drag = 0.5; f.size = rnd(0.07, 0.13);
      f.col = cols[Math.floor(Math.random() * cols.length)]; f.r = rnd(4, 9); f.age = -Math.random() * 0.35;
    }
  }
  function glow(x, y, r0, r1, life, rgb = WHITE) { const f = spawn('glow', x, y, life); f.size = r0; f.size2 = r1; f.rgb = rgb; }
  // a bomb: white-hot core inside an orange fireball, hot sparks, shell fragments, falling embers, smoke
  const FIRE = [255, 168, 82], EMBER = [255, 196, 120];
  function explosion(x, y, r, dark) {
    glow(x, y, 0.2, 1.3, 0.2);
    glow(x, y, 0.5, r * 1.15, 0.6, FIRE);
    for (let i = 0; i < 24 * quality; i++) {
      const f = spawn('spark', x, y, rnd(0.35, 0.6));
      radial(f, 11, 2); f.grav = 0.7; f.drag = 1.4; f.size = rnd(0.035, 0.06); f.col = Math.random() < 0.5 ? '#FFF6DC' : 'rgb(255,190,110)';
    }
    for (let i = 0; i < 10 * quality; i++) {
      const f = spawn('chip', x, y, rnd(0.6, 1.0));
      radial(f, 6, 1.5); f.grav = 1; f.size = rnd(0.06, 0.12); f.col = dark ? '#5E6584' : '#3B3343';
    }
    for (let i = 0; i < 12 * quality; i++) {
      const f = spawn('glit', x + rnd(-0.4, 0.4), y + rnd(-0.4, 0.4), rnd(0.8, 1.6));
      radial(f, 3, 1.8); f.grav = 0.22; f.drag = 1.2; f.size = rnd(0.04, 0.08); f.col = Math.random() < 0.5 ? 'rgb(255,214,140)' : 'rgb(255,150,80)';
    }
    puff(x, y, 9, dark ? [120, 125, 150] : [120, 100, 105], r * 0.16, 1.2);
  }
  function burst(x, y, n, col, speed = 4, size = 0.06, life = 0.7, grav = 1) {
    for (let i = 0; i < n * quality; i++) {
      const f = spawn('chip', x, y, life * rnd(0.6, 1.2));
      radial(f, speed, speed * 0.25); f.grav = grav; f.size = size * rnd(0.5, 1.5); f.col = col;
    }
  }
  function sparkle(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const f = spawn('star', x + rnd(-0.4, 0.4), y + rnd(-0.4, 0.4), rnd(0.4, 0.9));
      f.age = -Math.random() * 0.25; f.size = rnd(0.07, 0.16);
    }
  }
  function ring(x, y, r, col = 'rgba(255,255,255,0.9)', life = 0.45, width = 0.08) {
    const f = spawn('ring', x, y, life); f.r = r; f.col = col; f.width = width;
  }
  // frosted glass takes a hit and holds: a short star of white splits, chips and a small ring
  function frostHit(x, y, power = 0.6) {
    const f = spawn('crack', x, y, 0.2);
    const n = 5;
    f.data = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { f.data[i * 2] = (i / n) * TAU + rnd(-0.3, 0.3); f.data[i * 2 + 1] = rnd(0.25, 0.5) * (0.8 + power * 0.4); }
    sparks(x, y, 6, 2.6);
    ring(x, y, 0.5, 'rgba(255,255,255,0.85)', 0.28, 0.06);
  }
  // a locked piece shrugs off a hit
  function lockHit(x, y) { ring(x, y, 0.42, pal.dark ? 'rgba(231,234,246,0.6)' : 'rgba(62,58,79,0.45)', 0.24, 0.05); sparks(x, y, 3, 1.8); }
  // the key broke: light runs from it to each lock, which opens with a ring and a few stars
  function unlockFx(fx0, fy0, x, y) {
    let f = spawn('beam', x, y, 0.55); f.data = [fx0, fy0]; f.col = 'rgb(255,200,90)';
    f = spawn('ring', x, y, 0.5); f.age = -0.18; f.r = 0.75; f.col = 'rgba(255,206,110,0.95)'; f.width = 0.09;
    sparkle(x, y, 5);
  }
  // one counter per chain: it pops bigger with every link
  const combo = { n: 0, x: 0, y: 0, tx: 0, ty: 0, t: -9 };
  function comboAt(n, x, y) {
    if (n < 2) return;
    // above the break and drawn toward the open middle of the room, clear of the glass it came from
    const tx = x + (W / 2 - x) * 0.35, ty = Math.min(CEIL - 1, y + 1.15);
    if (clock - combo.t > 1.1) { combo.x = tx; combo.y = ty; }
    combo.n = n; combo.tx = tx; combo.ty = ty; combo.t = clock;
  }

  function stepFx(dt) {
    clock += dt;
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.age += dt;
      if (f.age > f.life) { recycle(i); continue; }
      if (f.age < 0) continue;
      if (f.drag) { const d = Math.exp(-f.drag * dt); f.vx *= d; f.vy *= d; }
      f.vy -= 10 * f.grav * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.t === 'chip' && f.y < 0.03) { f.y = 0.03; f.vy *= -0.3; f.vx *= 0.6; }
    }
    stepCamera(dt);
  }

  // ---------- camera: impact kicks and a slow push-in on the last piece ----------
  const cam = { z: 1, kick: 0, kx: 0, ky: 0, fz: 1, fx: 0, fy: 0, ft: 0, cx: 0, cy: 0 };
  function punch(x, y, k) {
    if (k > cam.kick) { cam.kick = k; const [sx, sy] = R.toScreen(x, y); cam.kx = sx; cam.ky = sy; }
  }
  function focus(x, y, z, hold) { const [sx, sy] = R.toScreen(x, y); cam.fx = sx; cam.fy = sy; cam.fz = z; cam.ft = hold; }
  function stepCamera(dt) {
    cam.kick *= Math.exp(-dt * 11);
    if (cam.ft > 0) cam.ft -= dt;
    const target = cam.ft > 0 ? cam.fz : 1;
    cam.z += (target - cam.z) * (1 - Math.exp(-dt * (cam.ft > 0 ? 3 : 4.5)));
    if (Math.abs(cam.z - 1) < 0.0005 && cam.ft <= 0) cam.z = 1;
    const w = cam.z > 1.001 ? 1 : 0;
    cam.cx = w ? cam.fx : cam.kx; cam.cy = w ? cam.fy : cam.ky;
  }

  // ---------- frame ----------
  function lerpBody(e, alpha) {
    const p = e.body.getPosition(), a = e.body.getAngle();
    if (e.px === undefined) return [p, a];
    let da = a - e.pa;
    return [{ x: e.px + (p.x - e.px) * alpha, y: e.py + (p.y - e.py) * alpha }, e.pa + da * alpha];
  }

  // where a piece is in its pop-in: null when not visible yet
  const popIn = [1, 1];
  function introOf(e) {
    if (!e.anim) { popIn[0] = 1; popIn[1] = 1; return popIn; }
    const u = (clock - e.anim) / INTRO_POP;
    if (u <= 0) return null;
    if (u >= 1) { popIn[0] = 1; popIn[1] = 1; } else { popIn[0] = 0.55 + 0.45 * easeOutBack(u); popIn[1] = Math.min(1, u * 3); }
    return popIn;
  }
  // asleep and not animating: drawn once into the settled layer
  const SPRITED = { glass: 1, wood: 1, stone: 1 };
  const settled = (e) => SPRITED[e.kind] === 1 && !e.anim && !e.body.isAwake();
  function renderRest(sim) {
    const c = bctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(stat, 0, 0);
    if (!sim) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const e of sim.ents) if (e.alive && settled(e)) drawShadow(c, e, e.body.getPosition(), e.body.getAngle());
    for (const e of sim.ents) {
      if (!e.alive || !settled(e)) continue;
      const [sx, sy] = R.toScreen(e.body.getPosition().x, e.body.getPosition().y);
      blit(c, sprites(e).body, sx, sy, e.body.getAngle());
    }
  }

  function draw(sim, o) {
    if (!pal) return;
    if (staticDirty) { renderStatic(); staticDirty = false; restKey = -1; }
    stepFx(o.fxDt || 0);
    if (introEnd && (clock > introEnd || o.calm) && sim) { for (const e of sim.ents) e.anim = 0; introEnd = 0; }
    // the settled layer changes only when something wakes, sleeps or breaks
    let key = 0;
    if (sim) for (const e of sim.ents) if (e.alive && settled(e)) key = (key * 31 + e.id * 4 + (e.lock ? 1 : 0) + (e.hp > 1 ? 2 : 0)) | 0;
    if (key !== restKey) { renderRest(sim); restKey = key; }
    // shake and camera move both layers together
    const shx = o.shakeX || 0, shy = o.shakeY || 0;
    const z = o.calm || !T.camera ? 1 : cam.z + cam.kick * 0.022, zx = cam.cx, zy = cam.cy;
    const css = shx || shy || z !== 1 ? `${zx.toFixed(1)}px ${zy.toFixed(1)}px|translate3d(${shx.toFixed(1)}px,${shy.toFixed(1)}px,0) scale(${z.toFixed(4)})` : '';
    if (css !== shakeCss) {
      const [origin, tf] = css ? css.split('|') : ['', ''];
      bgc.style.transformOrigin = origin; bgc.style.transform = tf; shakeCss = css;
    }
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.setTransform(dpr * z, 0, 0, dpr * z, (shx + zx * (1 - z)) * dpr, (shy + zy * (1 - z)) * dpr);
    if (T.motes && !o.calm) drawMotes(c, o.fxDt || 0);
    if (!sim) return;
    // ropes
    c.strokeStyle = pal.ink; c.lineWidth = Math.max(1.2, 0.035 * s); c.lineCap = 'round';
    for (const rp of sim.ropes) {
      if (!rp.target.alive) continue;
      const [p, a] = lerpBody(rp.target, o.alpha);
      const ca = Math.cos(a), sa = Math.sin(a);
      const wx = p.x + rp.la.x * ca - rp.la.y * sa, wy = p.y + rp.la.x * sa + rp.la.y * ca;
      let sx0 = rp.ax, sy0 = rp.ay;
      if (rp.A) {
        if (!rp.A.alive) continue;
        const [pa, aa] = lerpBody(rp.A, o.alpha);
        const c2 = Math.cos(aa), s2 = Math.sin(aa);
        sx0 = pa.x + rp.laA.x * c2 - rp.laA.y * s2; sy0 = pa.y + rp.laA.x * s2 + rp.laA.y * c2;
      }
      const [ax, ay] = R.toScreen(sx0, sy0), [bx, by] = R.toScreen(wx, wy);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    }
    // shadows fall on the wall and shelves behind everything
    for (const e of sim.ents) {
      if (!e.alive) continue;
      const k = e.kind;
      if (T.liveShadows && (k === 'glass' || k === 'wood' || k === 'stone' || k === 'bomb') && !settled(e)) {
        const pi = introOf(e);
        if (!pi) continue;
        const [p, a] = lerpBody(e, o.alpha);
        c.globalAlpha = pi[1]; drawShadow(c, e, p, a, pi[0]); c.globalAlpha = 1;
      }
    }
    for (const e of sim.ents) {
      if (!e.alive || settled(e)) continue;
      const k = e.kind;
      if (k === 'glass' || k === 'wood' || k === 'stone') {
        const pi = introOf(e);
        if (!pi) continue;
        const [p, a] = lerpBody(e, o.alpha);
        const [sx, sy] = R.toScreen(p.x, p.y);
        c.globalAlpha = pi[1]; blit(c, sprites(e).body, sx, sy, a, pi[0]); c.globalAlpha = 1;
      } else if (k === 'mover' || k === 'bomb' || k === 'pad') {
        const pi = introOf(e);
        if (!pi) continue;
        const [p, a] = lerpBody(e, o.alpha);
        c.globalAlpha = pi[1]; drawBody(c, e, p, a, pi[0]); c.globalAlpha = 1;
      }
    }
    for (const e of sim.shards) {
      if (!e.alive) continue;
      const [p, a] = lerpBody(e, o.alpha);
      drawBody(c, e, p, a);
    }
    // aim
    if (o.aim) drawAim(c, sim, o);
    if (o.hintAngle != null) drawHint(c, sim, o.hintAngle);
    // launcher barrel + loaded ball
    if (!o.hideLauncher) drawLauncher(c, sim, o);
    // balls: a soft comet tail, a little stretch at speed, a squash on impact
    for (const e of sim.ents) {
      if (!e.alive || e.kind !== 'ball') continue;
      const [p, a] = lerpBody(e, o.alpha);
      const r = BALL_R * s;
      if (e.trail && e.trail.length > 1) {
        const n = e.trail.length;
        c.fillStyle = o.skin.trail;
        for (let i = 0; i < n; i++) {
          const t = (i + 1) / (n + 1), [tx, ty] = R.toScreen(e.trail[i][0], e.trail[i][1]);
          c.globalAlpha = t * t * 0.9;
          c.beginPath(); c.arc(tx, ty, r * (0.3 + 0.62 * t), 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
      }
      const v = e.body.getLinearVelocity(), sp = Math.hypot(v.x, v.y);
      let st = Math.min(0.14, sp / 160), dir = -Math.atan2(v.y, v.x);
      if (e.sqT !== undefined) {
        const u = (clock - e.sqT) / 0.14;
        if (u < 1) { st = -Math.sin(u * Math.PI) * e.sqK * 0.22; dir = e.sqA; }
      }
      const [sx, sy] = R.toScreen(p.x, p.y);
      drawBall(c, sx, sy, r, o.skin, -a, st, dir);
    }
    // fx
    for (const f of fx) {
      if (f.age < 0) continue;
      const u = f.age / f.life, k = 1 - u;
      const [sx, sy] = R.toScreen(f.x, f.y);
      switch (f.t) {
        case 'glow': {
          const g = 1 - Math.pow(1 - Math.min(1, u * 1.7), 3), r = (f.size + (f.size2 - f.size) * g) * s * T.glow;
          c.globalAlpha = k * k * 0.95;
          if (pal.dark) c.globalCompositeOperation = 'lighter';
          c.drawImage(glowSprite(f.rgb), sx - r, sy - r, r * 2, r * 2);
          c.globalCompositeOperation = 'source-over';
          break;
        }
        case 'crack': {
          const grow = Math.min(1, f.age / 0.05);
          c.globalAlpha = k; c.strokeStyle = '#FFFFFF'; c.lineWidth = Math.max(1, 0.026 * s); c.lineCap = 'round';
          c.beginPath();
          for (let i = 0; i < f.data.length; i += 2) {
            const a = f.data[i], L = f.data[i + 1] * grow * s, ca = Math.cos(a), sa = Math.sin(a);
            c.moveTo(sx + ca * 0.1 * s, sy - sa * 0.1 * s); c.lineTo(sx + ca * L, sy - sa * L);
          }
          c.stroke();
          break;
        }
        case 'glit': case 'star': {
          const tw = f.t === 'glit' ? 0.55 + 0.45 * Math.sin(f.age * 28 + f.ph) : Math.sin(k * Math.PI);
          c.globalAlpha = (f.t === 'glit' ? Math.min(1, k * 1.8) : 1) * tw;
          c.fillStyle = f.col || '#FFFFFF';
          const zz = f.size * s * (f.t === 'glit' ? 0.7 + 0.3 * tw : 0.5 + tw * 0.7);
          c.beginPath(); c.moveTo(sx, sy - zz); c.lineTo(sx + zz * 0.2, sy - zz * 0.2); c.lineTo(sx + zz, sy); c.lineTo(sx + zz * 0.2, sy + zz * 0.2);
          c.lineTo(sx, sy + zz); c.lineTo(sx - zz * 0.2, sy + zz * 0.2); c.lineTo(sx - zz, sy); c.lineTo(sx - zz * 0.2, sy - zz * 0.2); c.closePath(); c.fill();
          break;
        }
        case 'dust': {
          if (!T.dust) break;
          const r = (f.size + (f.size2 - f.size) * (1 - k * k)) * s;
          c.globalAlpha = (pal.dark ? 0.22 : 0.32) * k * k;
          c.drawImage(dotSprite(f.rgb), sx - r, sy - r, r * 2, r * 2);
          break;
        }
        case 'spark': {
          c.globalAlpha = Math.min(1, k * 1.5); c.strokeStyle = f.col || '#FFFFFF'; c.lineWidth = Math.max(1, f.size * s); c.lineCap = 'round';
          c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - f.vx * 0.035 * s, sy + f.vy * 0.035 * s); c.stroke();
          break;
        }
        case 'chip': {
          c.globalAlpha = Math.min(1, k * 1.5); c.fillStyle = f.col;
          const zz = f.size * s;
          c.fillRect(sx - zz / 2, sy - zz / 2, zz, zz);
          break;
        }
        case 'conf': {
          // a tumbling diamond: its width flips as it turns
          const t = f.age * f.r + f.ph, w = Math.cos(t), zz = f.size * s;
          c.globalAlpha = Math.min(1, k * 3);
          c.fillStyle = f.col;
          c.save(); c.translate(sx + Math.sin(t * 0.5) * 0.12 * s, sy); c.rotate(t * 0.3);
          c.beginPath(); c.moveTo(0, -zz); c.lineTo(zz * 0.6 * w, 0); c.lineTo(0, zz); c.lineTo(-zz * 0.6 * w, 0); c.closePath(); c.fill();
          if (w > 0.75) { c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill(); }
          c.restore();
          break;
        }
        case 'beam': {
          // a streak from the key to a lock: the head runs ahead, the tail follows
          const [bx, by] = R.toScreen(f.data[0], f.data[1]);
          const h = Math.min(1, u / 0.4), t0 = Math.max(0, (u - 0.2) / 0.8);
          c.globalAlpha = Math.min(1, k * 2); c.strokeStyle = f.col; c.lineWidth = Math.max(1.5, 0.06 * s); c.lineCap = 'round';
          c.beginPath(); c.moveTo(bx + (sx - bx) * t0, by + (sy - by) * t0); c.lineTo(bx + (sx - bx) * h, by + (sy - by) * h); c.stroke();
          break;
        }
        case 'ring': {
          const e2 = 1 - Math.pow(k, 2.2);
          c.globalAlpha = k; c.strokeStyle = f.col; c.lineWidth = f.width * s * k + 1;
          c.beginPath(); c.arc(sx, sy, f.r * s * (0.25 + e2 * 0.75), 0, TAU); c.stroke();
          break;
        }
      }
    }
    c.globalAlpha = 1;
    // the chain counter
    if (combo.n >= 2 && clock - combo.t < 1.05) {
      const age = clock - combo.t, n = combo.n;
      combo.x += (combo.tx - combo.x) * 0.2; combo.y += (combo.ty - combo.y) * 0.2;
      const pop = 1 + 0.55 * Math.exp(-age * 13);
      const size = (0.42 + Math.min(0.55, (n - 2) * 0.06)) * s * pop;
      const [sx, sy] = R.toScreen(combo.x, combo.y + age * 0.35);
      const a = age > 0.72 ? Math.max(0, 1 - (age - 0.72) / 0.33) : 1;
      if (n >= 5) {
        c.globalAlpha = a * 0.55; const r = size * 1.3;
        if (pal.dark) c.globalCompositeOperation = 'lighter';
        c.drawImage(glowSprite(), sx - r, sy - r, r * 2, r * 2);
        c.globalCompositeOperation = 'source-over';
      }
      c.globalAlpha = a;
      c.font = `900 ${Math.round(size)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.lineWidth = Math.max(3, size * 0.17);
      c.strokeStyle = n >= 8 ? pal.accent : pal.dark ? 'rgba(10,14,30,0.65)' : 'rgba(255,255,255,0.95)';
      c.strokeText('\u00d7' + n, sx, sy);
      c.fillStyle = n >= 8 ? '#FFFFFF' : n >= 5 ? '#FFB534' : pal.accent;
      c.fillText('\u00d7' + n, sx, sy);
      c.globalAlpha = 1;
    }
    if (flash > 0) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = `rgba(255,255,255,${flash})`; c.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawLauncher(c, sim, o) {
    const [lx, ly] = R.toScreen(sim.launcherX, PIVOT_Y);
    const [fx, fy] = R.toScreen(sim.launcherX, 0);
    const a = o.angle;
    const ready = sim.st.balls > 0 && !sim.st.won;
    const k = o.loadK ?? 1;
    // contact shadow on the floor
    c.save(); c.translate(fx + 0.04 * s, fy); c.scale(1, 0.22);
    const cs = c.createRadialGradient(0, 0, 0, 0, 0, DOME_R * s * 1.35);
    cs.addColorStop(0, pal.dark ? 'rgba(0,0,0,0.45)' : 'rgba(60,35,40,0.3)'); cs.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = cs; c.beginPath(); c.arc(0, 0, DOME_R * s * 1.35, 0, TAU); c.fill();
    c.restore();
    // barrel: a lit cylinder with an accent muzzle ring
    c.save();
    c.translate(lx, ly);
    c.rotate(-a);
    c.translate(-(o.recoil || 0) * 0.18 * s, 0);
    const L = 1.0 * s, Wd = 0.56 * s;
    const bg = c.createLinearGradient(0, -Wd / 2, 0, Wd / 2);
    bg.addColorStop(0, shadeHex(pal.shelf[0], 0.18)); bg.addColorStop(0.35, pal.shelf[0]); bg.addColorStop(1, pal.shelf[1]);
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(-0.1 * s, -Wd / 2); c.lineTo(L - Wd * 0.18, -Wd / 2); c.quadraticCurveTo(L, -Wd / 2, L, -Wd / 2 + Wd * 0.18);
    c.lineTo(L, Wd / 2 - Wd * 0.18); c.quadraticCurveTo(L, Wd / 2, L - Wd * 0.18, Wd / 2); c.lineTo(-0.1 * s, Wd / 2); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(0.12 * s, -Wd / 2 + Wd * 0.13, L - 0.3 * s, Wd * 0.1);
    c.fillStyle = pal.accent;
    c.fillRect(L - 0.15 * s, -Wd / 2, 0.08 * s, Wd);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(L - 0.15 * s, -Wd / 2, 0.08 * s, Wd * 0.25);
    c.restore();
    // loaded ball peeks out of the muzzle
    if (ready) {
      const dist = MUZZLE * (0.55 + 0.45 * k);
      drawBall(c, lx + Math.cos(a) * dist, ly - Math.sin(a) * dist, BALL_R * s * (0.7 + 0.3 * k), o.skin, 0);
    }
    // dome
    const R0 = DOME_R * s;
    const dg = c.createRadialGradient(fx - R0 * 0.35, fy - R0 * 0.55, R0 * 0.1, fx, fy, R0);
    dg.addColorStop(0, shadeHex(pal.shelf[0], 0.22)); dg.addColorStop(0.5, pal.shelf[0]); dg.addColorStop(1, pal.shelf[1]);
    c.fillStyle = dg;
    c.beginPath(); c.arc(fx, fy, R0, Math.PI, 0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = Math.max(1, 0.03 * s);
    c.beginPath(); c.arc(fx, fy, R0 - c.lineWidth, Math.PI * 1.08, Math.PI * 1.55); c.stroke();
    // ready light: glows when loaded, dim while reloading
    const lit = ready ? 0.35 + 0.65 * k * (0.85 + 0.15 * Math.sin(performance.now() / 260)) : 0.2;
    const [rx, ry] = [fx, fy - R0 * 0.45], rr = Math.max(2.5, 0.075 * s);
    c.globalAlpha = lit * 0.7;
    const gw = rr * 4.2; c.drawImage(glowSprite(accentRGB), rx - gw, ry - gw, gw * 2, gw * 2);
    c.globalAlpha = 0.35 + 0.65 * lit;
    c.fillStyle = pal.accent; c.beginPath(); c.arc(rx, ry, rr, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(rx - rr * 0.3, ry - rr * 0.3, rr * 0.35, 0, TAU); c.fill();
    c.globalAlpha = 1;
    // shots left, as little balls in the equipped skin
    const total = sim.st.balls;
    const pr = Math.max(3.4, 0.1 * s), gap = pr * 2.7;
    const py = oy + Math.min(24, (ch - oy) * 0.42);
    const shown = Math.min(total, 8);
    const startX = lx - ((shown - 1) * gap) / 2;
    for (let i = 0; i < shown; i++) drawBall(c, startX + i * gap, py, pr, o.skin, 0);
    if (total > shown) {
      c.font = `900 ${Math.round(pr * 3)}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = pal.ink; c.globalAlpha = 0.85;
      c.fillText('+' + (total - shown), startX + shown * gap - pr * 0.6, py + 0.5);
      c.globalAlpha = 1;
    }
  }
  // the cannon fires: a flash at the muzzle, a breath of smoke, a few sparks forward
  function muzzle(x, y, a) {
    glow(x, y, 0.15, 0.9, 0.16, [255, 236, 200]);
    for (let i = 0; i < 6 * quality; i++) {
      const f = spawn('spark', x, y, rnd(0.12, 0.22));
      const d = a + rnd(-0.35, 0.35), v = rnd(5, 9);
      f.vx = Math.cos(d) * v; f.vy = Math.sin(d) * v; f.drag = 4; f.size = rnd(0.025, 0.04); f.col = '#FFF4DA';
    }
    for (let i = 0; i < 3 * quality; i++) {
      const f = spawn('dust', x, y, rnd(0.5, 0.8));
      const d = a + rnd(-0.6, 0.6), v = rnd(0.6, 1.6);
      f.vx = Math.cos(d) * v; f.vy = Math.sin(d) * v; f.drag = 2.5; f.grav = -0.1; f.size = rnd(0.1, 0.16); f.size2 = f.size * 2.6;
      f.rgb = pal.dark ? [170, 180, 210] : [205, 195, 200];
    }
  }

  // resample a path into evenly spaced dots
  function dotsAlong(pts, first, gap) {
    const dots = [];
    let acc = 0, need = first;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const L = Math.hypot(x1 - x0, y1 - y0);
      while (acc + L >= need) {
        const t = (need - acc) / L;
        dots.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
        need += gap;
      }
      acc += L;
    }
    return dots;
  }

  function drawAim(c, sim, o) {
    const pts = o.aim.pts;
    if (!pts || pts.length < 2) return;
    // dots flow toward the target, larger and stronger near the cannon
    const gap = 0.42, flow = (performance.now() / 1000 * 1.4) % 1;
    const dots = dotsAlong(pts, 0.15 + flow * gap, gap);
    const n = dots.length;
    c.fillStyle = pal.ink;
    for (let i = 0; i < n; i++) {
      const [sx, sy] = R.toScreen(dots[i][0], dots[i][1]);
      const k = 1 - (i + flow) / (n + 2);
      c.globalAlpha = (0.22 + 0.63 * k) * Math.min(1, (i + 1 - flow) * 1.5);
      c.beginPath(); c.arc(sx, sy, (0.045 + 0.035 * k) * s, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    // where the ball first touches: a ghost ball; on glass it's marked to break
    const mark = (h, alpha) => {
      const [sx, sy] = R.toScreen(h.x, h.y);
      // locked glass won't break yet, so the guide marks it like a wall
      const glass = (h.kind === 'glass' && !h.lock) || h.kind === 'bomb';
      const col = glass ? pal.accent : pal.ink, r = BALL_R * s;
      c.globalAlpha = alpha * (glass ? 0.16 : 0.08); c.fillStyle = col;
      c.beginPath(); c.arc(sx, sy, r, 0, TAU); c.fill();
      c.globalAlpha = alpha; c.strokeStyle = col; c.lineWidth = Math.max(1.5, 0.045 * s);
      c.beginPath(); c.arc(sx, sy, r, 0, TAU); c.stroke();
      if (glass) {
        const t = performance.now() / 1000, br = 1 + 0.12 * Math.sin(t * 7);
        c.lineCap = 'round'; c.lineWidth = Math.max(1.2, 0.035 * s); c.beginPath();
        for (let i = 0; i < 4; i++) {
          const q = i * Math.PI / 2 + Math.PI / 4;
          c.moveTo(sx + Math.cos(q) * r * 1.3 * br, sy + Math.sin(q) * r * 1.3 * br); c.lineTo(sx + Math.cos(q) * r * 1.65 * br, sy + Math.sin(q) * r * 1.65 * br);
        }
        c.stroke();
      }
      c.globalAlpha = 1;
    };
    if (o.aim.hit) mark(o.aim.hit, 0.85);
    // after the first bounce: a fainter guide, like a pool cue line
    if (o.aim.pts2 && o.aim.pts2.length > 1) {
      const d2 = dotsAlong(o.aim.pts2, 0.3 + flow * gap, gap);
      c.fillStyle = pal.ink;
      for (let i = 0; i < d2.length; i++) {
        const [sx, sy] = R.toScreen(d2[i][0], d2[i][1]);
        c.globalAlpha = 0.32 * (1 - i / (d2.length + 3));
        c.beginPath(); c.arc(sx, sy, 0.042 * s, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
      if (o.aim.hit2) mark(o.aim.hit2, 0.5);
    }
  }

  function drawHint(c, sim, ha) {
    const [lx, ly] = R.toScreen(sim.launcherX, PIVOT_Y);
    c.strokeStyle = pal.accent; c.globalAlpha = 0.55 + 0.3 * Math.sin(performance.now() / 200);
    c.lineWidth = Math.max(2, 0.07 * s); c.lineCap = 'round'; c.setLineDash([0.1 * s, 0.16 * s]);
    c.beginPath(); c.moveTo(lx + Math.cos(ha) * 1.2 * s, ly - Math.sin(ha) * 1.2 * s); c.lineTo(lx + Math.cos(ha) * 3.6 * s, ly - Math.sin(ha) * 3.6 * s); c.stroke();
    c.setLineDash([]); c.globalAlpha = 1;
  }

  return R;
}
