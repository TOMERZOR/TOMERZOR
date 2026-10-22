// Canvas renderer: premium-minimal look, interpolated physics, particles and juice.
import { W, PIVOT_Y, BALL_R, CEIL, DOME_R, MUZZLE } from './engine.js';

const TAU = Math.PI * 2;
const FONT = '"Nunito", ui-rounded, system-ui, sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const stat = document.createElement('canvas');
  const sctx = stat.getContext('2d');
  let cw = 0, ch = 0, dpr = 1, s = 40, ox = 0, oy = 0, pal = null;
  let staticDirty = true, simRef = null;
  const fx = [];
  const texts = [];
  let flash = 0;

  const R = {
    get scale() { return s; },
    resize(w, h, ratio, safe = { top: 0, bottom: 0 }) {
      cw = w; ch = h; dpr = ratio;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      stat.width = canvas.width; stat.height = canvas.height;
      const top = safe.top + 66, bottom = Math.max(safe.bottom + 30, 46);
      s = Math.min(w / W, (h - top - bottom) / CEIL);
      ox = (w - W * s) / 2;
      const extra = Math.max(0, h - top - bottom - CEIL * s);
      oy = h - bottom - extra * 0.42;
      staticDirty = true;
    },
    setPalette(p) { pal = p; staticDirty = true; },
    setSim(sim) { simRef = sim; staticDirty = true; fx.length = 0; texts.length = 0; },
    invalidate() { staticDirty = true; },
    toScreen(x, y) { return [ox + x * s, oy - y * s]; },
    toWorld(px, py) { return [(px - ox) / s, (oy - py) / s]; },
    floorY: () => oy,
    burst, ring, text, sparkle, setFlash: (v) => { flash = v; },
    draw,
    bounds: () => ({ ox, oy, s, cw, ch }),
  };

  // ---------- static layer ----------
  function renderStatic() {
    const c = sctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sky
    const g = c.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, pal.sky[0]); g.addColorStop(1, pal.sky[1]);
    c.fillStyle = g; c.fillRect(0, 0, cw, ch);
    // soft orbs for depth
    for (const [fx_, fy, fr, a] of [[0.15, 0.18, 0.55, pal.dark ? 0.05 : 0.35], [0.9, 0.45, 0.45, pal.dark ? 0.04 : 0.25], [0.4, 0.8, 0.5, pal.dark ? 0.03 : 0.18]]) {
      const rg = c.createRadialGradient(cw * fx_, ch * fy, 0, cw * fx_, ch * fy, cw * fr);
      rg.addColorStop(0, pal.dark ? `rgba(140,170,255,${a})` : `rgba(255,255,255,${a})`);
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = rg; c.fillRect(0, 0, cw, ch);
    }
    if (pal.dark) {
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 70; i++) {
        c.fillStyle = `rgba(230,238,255,${0.15 + rnd() * 0.5})`;
        c.beginPath(); c.arc(rnd() * cw, rnd() * (oy - 40), rnd() * 1.3 + 0.3, 0, TAU); c.fill();
      }
    }
    const cy = oy - CEIL * s;
    // margins beyond walls (wide screens)
    if (ox > 1) {
      c.fillStyle = pal.floor;
      c.fillRect(0, 0, ox, ch); c.fillRect(ox + W * s, 0, ox + 1, ch);
      c.fillStyle = pal.floorEdge;
      c.fillRect(ox - 2, cy, 2, oy - cy); c.fillRect(ox + W * s, cy, 2, oy - cy);
    }
    // ceiling and floor bands frame the room
    c.fillStyle = pal.floor; c.fillRect(0, 0, cw, cy);
    c.fillRect(0, oy, cw, ch - oy);
    c.fillStyle = pal.floorEdge; c.fillRect(0, oy, cw, 2); c.fillRect(0, cy - 2, cw, 2);
    // a soft inner shade under the ceiling
    const sg = c.createLinearGradient(0, cy, 0, cy + 18);
    sg.addColorStop(0, pal.dark ? 'rgba(0,0,0,0.25)' : 'rgba(80,50,40,0.07)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sg; c.fillRect(ox, cy, W * s, 18);
    if (!simRef) return;
    // static bodies
    for (const e of simRef.ents) {
      if (!e.alive) continue;
      if (e.kind === 'shelf' || e.kind === 'pad') drawBody(c, e, e.body.getPosition(), e.body.getAngle(), true);
    }
    for (const rp of simRef.ropes) {
      if (rp.A) continue;
      const [ax, ay] = R.toScreen(rp.ax, rp.ay);
      c.fillStyle = pal.ink;
      c.beginPath(); c.arc(ax, ay, 0.11 * s, 0, TAU); c.fill();
      c.fillRect(ax - 0.32 * s, ay - 0.16 * s, 0.64 * s, 0.07 * s);
    }
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

  function drawBody(c, e, p, a, isStatic) {
    const [sx, sy] = R.toScreen(p.x, p.y);
    c.save();
    c.translate(sx, sy);
    c.rotate(-a);
    c.scale(s, -s);
    const lw = 1 / s;
    switch (e.kind) {
      case 'shelf': case 'mover': {
        c.fillStyle = 'rgba(0,0,0,0.07)';
        c.save(); c.translate(0.04, -0.07); roundedRect(c, e.w, e.h, Math.min(e.w, e.h) * 0.5); c.fill(); c.restore();
        c.fillStyle = e.kind === 'mover' ? pal.ink2 : pal.ink;
        roundedRect(c, e.w, e.h, Math.min(e.w, e.h) * 0.5); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.14)';
        roundedRect(c, e.w - 0.06, Math.max(0.02, e.h * 0.28), 0.03); c.save(); c.translate(0, e.h * 0.22); c.fill(); c.restore();
        if (e.kind === 'mover') {
          c.fillStyle = pal.accent; c.globalAlpha = 0.9;
          c.beginPath(); c.arc(0, 0, Math.min(0.06, e.h * 0.3), 0, TAU); c.fill(); c.globalAlpha = 1;
        }
        break;
      }
      case 'pad': {
        c.fillStyle = 'rgba(0,0,0,0.07)';
        c.save(); c.translate(0.04, -0.07); roundedRect(c, e.w, e.h, e.h / 2); c.fill(); c.restore();
        c.fillStyle = pal.accent;
        roundedRect(c, e.w, e.h, e.h / 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * e.w / 6, 0, e.h * 0.16, 0, TAU); c.fill(); }
        break;
      }
      case 'glass': drawGlass(c, e, lw); break;
      case 'shard': drawShard(c, e, lw); break;
      case 'stone': {
        c.fillStyle = 'rgba(0,0,0,0.1)';
        c.save(); c.translate(0.05, -0.08);
        if (e.circle) { c.beginPath(); c.arc(0, 0, e.circle, 0, TAU); } else polyPath(c, e.outline);
        c.fill(); c.restore();
        const gr = c.createLinearGradient(0, (e.h || e.circle * 2) / 2, 0, -(e.h || e.circle * 2) / 2);
        gr.addColorStop(0, pal.dark ? '#8A90A8' : '#6E6A78'); gr.addColorStop(1, pal.dark ? '#5C627A' : '#4A4654');
        c.fillStyle = gr;
        if (e.circle) { c.beginPath(); c.arc(0, 0, e.circle, 0, TAU); } else polyPath(c, e.outline);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.12)';
        c.beginPath(); c.arc(-(e.w || 0.5) * 0.18, (e.h || 0.5) * 0.18, Math.min(e.w || 0.5, e.h || 0.5) * 0.14, 0, TAU); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.beginPath(); c.arc((e.w || 0.5) * 0.2, -(e.h || 0.5) * 0.12, Math.min(e.w || 0.5, e.h || 0.5) * 0.09, 0, TAU); c.fill();
        break;
      }
      case 'wood': {
        c.fillStyle = 'rgba(0,0,0,0.08)';
        c.save(); c.translate(0.04, -0.06); roundedRect(c, e.w, e.h, 0.035); c.fill(); c.restore();
        c.fillStyle = '#E2B47A';
        roundedRect(c, e.w, e.h, 0.035); c.fill();
        c.strokeStyle = 'rgba(140,85,35,0.35)'; c.lineWidth = lw * 1.2;
        const long = e.w > e.h;
        c.beginPath();
        for (let i = -1; i <= 1; i += 2) {
          if (long) { c.moveTo(-e.w / 2 + 0.08, i * e.h * 0.18); c.lineTo(e.w / 2 - 0.08, i * e.h * 0.18); }
          else { c.moveTo(i * e.w * 0.18, -e.h / 2 + 0.08); c.lineTo(i * e.w * 0.18, e.h / 2 - 0.08); }
        }
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.22)';
        if (long) c.fillRect(-e.w / 2 + 0.03, e.h / 2 - 0.045, e.w - 0.06, 0.025);
        else c.fillRect(-e.w / 2 + 0.025, -e.h / 2 + 0.03, 0.025, e.h - 0.06);
        break;
      }
      case 'bomb': {
        const r = e.circle;
        const t = performance.now() / 1000;
        c.fillStyle = 'rgba(0,0,0,0.1)'; c.beginPath(); c.arc(0.04, -0.07, r, 0, TAU); c.fill();
        const pulse = 0.5 + 0.5 * Math.sin(t * 5 + e.id);
        c.fillStyle = pal.accent;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = lw * 2.4;
        c.beginPath(); c.arc(0, 0, r * 0.62, 0, TAU); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.95)';
        c.beginPath(); c.arc(0, 0, r * (0.18 + pulse * 0.08), 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.3)';
        c.beginPath(); c.arc(-r * 0.35, r * 0.4, r * 0.18, 0, TAU); c.fill();
        break;
      }
    }
    c.restore();
  }

  function glassRGB(e) { return pal.glass[(e.tint || 0) % pal.glass.length]; }

  function drawGlass(c, e, lw) {
    const [r, g, b] = glassRGB(e);
    const path = () => { if (e.circle) { c.beginPath(); c.arc(0, 0, e.circle, 0, TAU); } else polyPath(c, e.outline); };
    // soft shadow
    c.fillStyle = pal.dark ? 'rgba(0,0,0,0.18)' : 'rgba(40,40,80,0.06)';
    c.save(); c.translate(0.04, -0.07); path(); c.fill(); c.restore();
    // body
    const hh = e.circle || (e.h || 0.6) / 2;
    const gr = c.createLinearGradient(-hh, hh, hh, -hh);
    const a0 = pal.dark ? 0.32 : 0.5, a1 = pal.dark ? 0.16 : 0.26;
    gr.addColorStop(0, `rgba(${r},${g},${b},${a0})`);
    gr.addColorStop(1, `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 30)},${Math.min(255, b + 20)},${a1})`);
    c.fillStyle = gr; path(); c.fill();
    // edge
    c.strokeStyle = pal.glassEdge; c.lineWidth = lw * 1.6; c.lineJoin = 'round';
    path(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = lw * 1.1;
    c.save(); c.translate(-0.012, 0.012); path(); c.stroke(); c.restore();
    // specular streaks
    c.save(); path(); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    const w = (e.w || e.circle * 2), h = (e.h || e.circle * 2);
    c.moveTo(-w * 0.5, h * 0.1); c.lineTo(-w * 0.5 + w * 0.16, h * 0.1 + w * 0.16 + h * 0.3); c.lineTo(-w * 0.5 + w * 0.26, h * 0.4 + w * 0.2); c.lineTo(-w * 0.5 + w * 0.1, h * -0.05);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fillRect(w * 0.18, -h * 0.4, Math.max(0.03, w * 0.07), h * 0.55);
    c.restore();
  }

  function drawShard(c, e, lw) {
    const k = Math.max(0, Math.min(1, (e.life - e.age) / 0.45));
    if (k <= 0) return;
    const [r, g, b] = glassRGB(e);
    c.globalAlpha = k;
    c.fillStyle = `rgba(${r},${g},${b},${pal.dark ? 0.45 : 0.6})`;
    polyPath(c, e.polys[0]); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = lw * 1.1; c.stroke();
    c.strokeStyle = pal.glassEdge; c.lineWidth = lw * 0.8;
    c.save(); c.translate(0.008, -0.008); c.stroke(); c.restore();
    c.globalAlpha = 1;
  }

  function drawBall(c, x, y, r, skin, angle = 0) {
    const [base, light, dark] = skin.c;
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.arc(r * 0.18, r * 0.28, r, 0, TAU); c.fill();
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
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath(); c.ellipse(-r * 0.36, -r * 0.42, r * 0.26, r * 0.16, -0.6, 0, TAU); c.fill();
    c.restore();
  }
  R.drawBall = drawBall;

  // ---------- fx ----------
  function burst(x, y, n, col, speed = 4, size = 0.06, life = 0.7, grav = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.3 + Math.random() * 0.7);
      fx.push({ t: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + speed * 0.25, life: life * (0.6 + Math.random() * 0.6), age: 0, size: size * (0.5 + Math.random()), col, grav });
    }
  }
  function sparkle(x, y, n = 6) {
    for (let i = 0; i < n; i++) fx.push({ t: 's', x: x + (Math.random() - 0.5) * 0.8, y: y + (Math.random() - 0.5) * 0.8, life: 0.4 + Math.random() * 0.5, age: -Math.random() * 0.25, size: 0.07 + Math.random() * 0.09 });
  }
  function ring(x, y, r, col = 'rgba(255,255,255,0.9)', life = 0.45, width = 0.08) {
    fx.push({ t: 'r', x, y, r, col, life, age: 0, width });
  }
  function text(x, y, str, col, size = 0.55, life = 0.9) {
    texts.push({ x, y, str, col, size, life, age: 0 });
  }

  function stepFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.age += dt;
      if (f.age > f.life) { fx.splice(i, 1); continue; }
      if (f.t === 'p') { f.vy -= 10 * f.grav * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.y < 0.03) { f.y = 0.03; f.vy *= -0.3; f.vx *= 0.6; } }
    }
    for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.age += dt; if (t.age > t.life) texts.splice(i, 1); }
    if (fx.length > 500) fx.splice(0, fx.length - 500);
  }

  // ---------- frame ----------
  function lerpBody(e, alpha) {
    const p = e.body.getPosition(), a = e.body.getAngle();
    if (e.px === undefined) return [p, a];
    let da = a - e.pa;
    return [{ x: e.px + (p.x - e.px) * alpha, y: e.py + (p.y - e.py) * alpha }, e.pa + da * alpha];
  }

  function draw(sim, o) {
    if (!pal) return;
    if (staticDirty) { renderStatic(); staticDirty = false; }
    stepFx(o.fxDt || 0);
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(stat, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, (o.shakeX || 0) * dpr, (o.shakeY || 0) * dpr);
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
    // movers, dynamic bodies
    for (const e of sim.ents) {
      if (!e.alive) continue;
      if (e.kind === 'mover' || e.kind === 'glass' || e.kind === 'stone' || e.kind === 'wood' || e.kind === 'bomb') {
        const [p, a] = lerpBody(e, o.alpha);
        drawBody(c, e, p, a, false);
      }
    }
    for (const e of sim.shards) {
      if (!e.alive) continue;
      const [p, a] = lerpBody(e, o.alpha);
      drawBody(c, e, p, a, false);
    }
    // aim
    if (o.aim) drawAim(c, sim, o);
    if (o.hintAngle != null) drawHint(c, sim, o.hintAngle);
    // launcher barrel + loaded ball
    if (!o.hideLauncher) drawLauncher(c, sim, o);
    // balls + trails
    for (const e of sim.ents) {
      if (!e.alive || e.kind !== 'ball') continue;
      const [p, a] = lerpBody(e, o.alpha);
      if (e.trail) {
        c.strokeStyle = o.skin.trail; c.lineCap = 'round'; c.lineJoin = 'round';
        for (let i = 1; i < e.trail.length; i++) {
          const [x0, y0] = R.toScreen(e.trail[i - 1][0], e.trail[i - 1][1]), [x1, y1] = R.toScreen(e.trail[i][0], e.trail[i][1]);
          c.lineWidth = (i / e.trail.length) * BALL_R * s * 1.5;
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        }
      }
      const [sx, sy] = R.toScreen(p.x, p.y);
      drawBall(c, sx, sy, BALL_R * s, o.skin, -a);
    }
    // fx
    for (const f of fx) {
      if (f.age < 0) continue;
      const k = 1 - f.age / f.life;
      const [sx, sy] = R.toScreen(f.x, f.y);
      if (f.t === 'p') {
        c.globalAlpha = Math.min(1, k * 1.5);
        c.fillStyle = f.col;
        const z = f.size * s;
        c.fillRect(sx - z / 2, sy - z / 2, z, z);
      } else if (f.t === 's') {
        c.globalAlpha = Math.sin(k * Math.PI);
        c.fillStyle = '#FFFFFF';
        const z = f.size * s * (0.5 + Math.sin(k * Math.PI) * 0.7);
        c.beginPath(); c.moveTo(sx, sy - z); c.lineTo(sx + z * 0.22, sy - z * 0.22); c.lineTo(sx + z, sy); c.lineTo(sx + z * 0.22, sy + z * 0.22);
        c.lineTo(sx, sy + z); c.lineTo(sx - z * 0.22, sy + z * 0.22); c.lineTo(sx - z, sy); c.lineTo(sx - z * 0.22, sy - z * 0.22); c.closePath(); c.fill();
      } else if (f.t === 'r') {
        const e2 = 1 - Math.pow(k, 2.2);
        c.globalAlpha = k;
        c.strokeStyle = f.col; c.lineWidth = f.width * s * k + 1;
        c.beginPath(); c.arc(sx, sy, f.r * s * (0.25 + e2 * 0.75), 0, TAU); c.stroke();
      }
    }
    c.globalAlpha = 1;
    // texts
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const t of texts) {
      const k = t.age / t.life;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : 1.15 - Math.min(0.15, (k - 0.15) * 0.6);
      const [sx, sy] = R.toScreen(t.x, t.y + k * 0.7);
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.font = `900 ${Math.round(t.size * s * pop)}px ${FONT}`;
      c.lineWidth = Math.max(2, t.size * s * 0.16); c.strokeStyle = pal.dark ? 'rgba(10,14,30,0.6)' : 'rgba(255,255,255,0.9)';
      c.strokeText(t.str, sx, sy);
      c.fillStyle = t.col; c.fillText(t.str, sx, sy);
    }
    c.globalAlpha = 1;
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
    // barrel
    c.save();
    c.translate(lx, ly);
    c.rotate(-a);
    c.translate(-(o.recoil || 0) * 0.18 * s, 0);
    const L = 1.0 * s, Wd = 0.56 * s;
    c.fillStyle = pal.ink;
    c.beginPath();
    c.moveTo(-0.1 * s, -Wd / 2); c.lineTo(L - Wd * 0.18, -Wd / 2); c.quadraticCurveTo(L, -Wd / 2, L, -Wd / 2 + Wd * 0.18);
    c.lineTo(L, Wd / 2 - Wd * 0.18); c.quadraticCurveTo(L, Wd / 2, L - Wd * 0.18, Wd / 2); c.lineTo(-0.1 * s, Wd / 2); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.fillRect(0.1 * s, -Wd / 2 + Wd * 0.14, L - 0.22 * s, Wd * 0.14);
    c.fillStyle = pal.accent;
    c.fillRect(L - 0.13 * s, -Wd / 2, 0.06 * s, Wd);
    c.restore();
    // loaded ball peeks out of the muzzle
    if (ready) {
      const k = o.loadK ?? 1;
      const dist = MUZZLE * (0.55 + 0.45 * k);
      drawBall(c, lx + Math.cos(a) * dist, ly - Math.sin(a) * dist, BALL_R * s * (0.7 + 0.3 * k), o.skin, 0);
    }
    // dome
    c.fillStyle = pal.ink;
    c.beginPath(); c.arc(fx, fy, DOME_R * s, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.1)';
    c.beginPath(); c.arc(fx, fy, DOME_R * s * 0.7, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = pal.accent;
    c.beginPath(); c.arc(fx, fy - DOME_R * s * 0.42, Math.max(2.5, 0.07 * s), 0, TAU); c.fill();
    // ball count pips on the floor band
    const total = sim.st.balls;
    const pipR = Math.max(3.2, 0.09 * s), gap = pipR * 3;
    const py = oy + Math.min(22, (ch - oy) * 0.4);
    const shown = Math.min(total, 8);
    const startX = lx - ((shown - 1) * gap) / 2;
    c.fillStyle = pal.ink; c.globalAlpha = 0.85;
    for (let i = 0; i < shown; i++) { c.beginPath(); c.arc(startX + i * gap, py, pipR, 0, TAU); c.fill(); }
    if (total > shown) {
      c.font = `900 ${Math.round(pipR * 3.2)}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('+' + (total - shown), startX + shown * gap - pipR, py + 0.5);
    }
    c.globalAlpha = 1;
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
    const dots = dotsAlong(pts, 0.15, 0.42);
    const n = dots.length;
    const phase = (performance.now() / 600) % 1;
    c.fillStyle = pal.ink;
    for (let i = 0; i < n; i++) {
      const [sx, sy] = R.toScreen(dots[i][0], dots[i][1]);
      const k = 1 - i / (n + 2);
      c.globalAlpha = 0.25 + 0.6 * k;
      const pr = (0.055 + 0.03 * k) * s * (1 + 0.25 * Math.max(0, Math.sin((i / 3 - phase) * Math.PI)));
      c.beginPath(); c.arc(sx, sy, pr, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    const ring = (h, alpha) => {
      const [sx, sy] = R.toScreen(h.x, h.y);
      const glass = h.kind === 'glass' || h.kind === 'bomb';
      c.strokeStyle = glass ? pal.accent : pal.ink; c.globalAlpha = alpha;
      c.lineWidth = Math.max(1.5, 0.045 * s);
      c.beginPath(); c.arc(sx, sy, BALL_R * s, 0, TAU); c.stroke();
      c.globalAlpha = 1;
    };
    if (o.aim.hit) ring(o.aim.hit, 0.85);
    // after the first bounce: a fainter guide, like a pool cue line
    if (o.aim.pts2 && o.aim.pts2.length > 1) {
      const d2 = dotsAlong(o.aim.pts2, 0.3, 0.42);
      c.fillStyle = pal.ink;
      for (let i = 0; i < d2.length; i++) {
        const [sx, sy] = R.toScreen(d2[i][0], d2[i][1]);
        c.globalAlpha = 0.32 * (1 - i / (d2.length + 3));
        c.beginPath(); c.arc(sx, sy, 0.045 * s, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
      if (o.aim.hit2) ring(o.aim.hit2, 0.5);
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
