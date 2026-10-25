// Drawing. The camera stands a few metres behind the walker and a little above,
// looking down the rope toward the far mountain. World axes: x to the right,
// y up, z along the rope (0 = start cliff, L = far cliff).
//
// The scenery is painted: a backdrop per theme (sky, distant ranges, the gorge),
// the far cliff as a sprite that grows as you approach, and the walker as a
// sprite whose legs are split so each one can lift on its step. The rope, the
// water, droplets, weather and HUD are drawn live on top.
import { rimAngle, birdLoad, gustWarning } from './sim.js';
import { ART, img } from './assets.js';

// hz: where the painted horizon sits, as a share of the backdrop's height.
// tint: colour laid over the walker and the cliff so they sit in the light.
const THEMES = {
  morning: { bg: 'img/bg_morning.webp', hz: 0.27, cliff: 'green', sky: ['#4d97dd', '#e6f2f7'], fog: '#dbe9f2', rope: '#d6b07a', tint: null },
  noon: { bg: 'img/bg_noon.webp', hz: 0.3, cliff: 'green', sky: ['#2f86d8', '#dbeef8'], fog: '#d4e4f1', rope: '#d6b07a', tint: null },
  sunset: { bg: 'img/bg_sunset.webp', hz: 0.24, cliff: 'green', sky: ['#3a3b78', '#f7b267'], fog: '#b48ac4', rope: '#e2b07a', tint: 'rgba(110,40,110,0.34)', walkerTint: 'rgba(255,120,80,0.16)' },
  night: { bg: 'img/bg_night.webp', hz: 0.3, cliff: 'green', sky: ['#040816', '#22355f'], fog: '#2a3d6e', rope: '#a89270', tint: 'rgba(8,18,52,0.66)', walkerTint: 'rgba(14,26,70,0.46)', dark: true },
  snow: { bg: 'img/bg_snow.webp', hz: 0.3, cliff: 'snow', sky: ['#7b8a99', '#d6dde3'], fog: '#d7dde3', rope: '#c9a87a', tint: 'rgba(170,185,200,0.18)', walkerTint: 'rgba(170,190,215,0.16)', snow: true },
  canyon: { bg: 'img/bg_canyon.webp', hz: 0.27, cliff: 'canyon', sky: ['#3f86cf', '#f2d7a8'], fog: '#f1d2a2', rope: '#e0b682', tint: null, walkerTint: 'rgba(255,170,90,0.08)' },
};
const CLIFF_WIDTH = 40;   // metres the cliff painting spans

function rgbOf(c) {
  if (c[0] === '#') {
    const p = parseInt(c.slice(1), 16);
    return [(p >> 16) & 255, (p >> 8) & 255, p & 255];
  }
  return c.slice(c.indexOf('(') + 1, -1).split(',').map(Number);
}
function mix(a, b, t) {
  const pa = rgbOf(a), pb = rgbOf(b);
  return `rgb(${(pa[0] * (1 - t) + pb[0] * t) | 0},${(pa[1] * (1 - t) + pb[1] * t) | 0},${(pa[2] * (1 - t) + pb[2] * t) | 0})`;
}
function shade(hex, k) {
  return mix(hex, k < 0 ? '#000000' : '#ffffff', Math.abs(k));
}

// A copy of an image with a colour laid over its opaque pixels.
function tinted(im, color, scale = 1) {
  const c = document.createElement('canvas');
  c.width = Math.round(im.width * scale);
  c.height = Math.round(im.height * scale);
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0, c.width, c.height);
  if (color) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.drops = [];
    this.streaks = [];
    this.flakes = [];
    this.theme = THEMES.morning;
    this.level = null;
    this.art = {};
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.c.width = Math.round(this.W * dpr);
    this.c.height = Math.round(this.H * dpr);
    this.f = Math.min(this.W * 1.25, this.H * 0.62);
    this.layout();
  }

  // The backdrop covers the screen; the horizon follows wherever it lands.
  layout() {
    const r = 1080 / 1910;
    let w = this.W, h = w / r;
    if (h < this.H) { h = this.H; w = h * r; }
    this.bgRect = { x: (this.W - w) / 2, y: (this.H - h) / 2, w, h };
    this.hy = this.bgRect.y + h * this.theme.hz;
  }

  setLevel(level) {
    this.level = level;
    this.theme = THEMES[level.theme];
    this.drops.length = 0;
    this.flakes = [];
    if (this.theme.snow) {
      for (let i = 0; i < 160; i++) this.flakes.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 });
    }
    this.layout();
    this.prepareArt();
  }

  // Loads this theme's pictures and bakes the tinted copies it needs.
  prepareArt() {
    const th = this.theme;
    const key = th.bg;
    const art = this.art = { key };
    const again = () => { if (this.art.key === key) this.prepareArt(); };
    art.bg = img(th.bg, again);
    const cm = ART.cliffs[th.cliff];
    const cliff = img(cm.src, again);
    if (cliff) {
      art.cliff = th.tint ? tinted(cliff, th.tint) : cliff;
      art.cliffMeta = cm;
      // The cliff's silhouette in the haze colour, faded in with distance.
      art.cliffFog = tinted(cliff, th.fog, 0.4);
    }
    const w = img(ART.walker.src, again);
    if (w) art.walker = th.walkerTint ? tinted(w, th.walkerTint) : w;
    art.birdSit = img(ART.birdSit.src, again);
    art.birdFly = img(ART.birdFly.src, again);
  }

  // Shape of the rope: it dips under the walker, more in the middle of the span.
  ropeDip(s) {
    const L = this.level.length;
    const t = Math.max(0, Math.min(1, s.z / L));
    return 0.06 + 0.02 * L * 4 * t * (1 - t);
  }
  ropeY(s, z) {
    const L = this.level.length, zm = Math.max(0.05, Math.min(L - 0.05, s.z));
    if (z < 0) return Math.min(0.25, -z * 0.4);
    if (z > L) return Math.min(0.25, (z - L) * 0.4);
    const d = this.ropeDip(s);
    const u = z / L;
    const cat = 0.004 * L * 4 * u * (1 - u);
    return -(z < zm ? d * z / zm : d * (L - z) / (L - zm)) - cat;
  }
  ropeX(s, z) {
    const L = this.level.length, zm = Math.max(0.05, Math.min(L - 0.05, s.z));
    if (z <= 0 || z >= L) return 0;
    return s.swayX * (z < zm ? z / zm : (L - z) / (L - zm));
  }

  project(x, y, z) {
    const dz = z - this.camZ;
    if (dz < 0.05) return null;
    const k = this.f / dz;
    return { x: this.W / 2 + (x - this.camX) * k, y: this.hy - (y - this.camY) * k, k };
  }

  fogOf(z) {
    return 1 - Math.exp(-Math.max(0, z - this.camZ) / 150);
  }

  draw(s, view, dt) {
    const g = this.g, W = this.W, H = this.H, th = this.theme;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Camera follows the walker; while he falls it stays put.
    const manY = this.ropeY(s, s.z) - (view.drop || 0);
    if (!view.frozenCam) {
      this.camZ = s.z - 3.8;
      this.camY = this.ropeY(s, s.z) + 2.3;
      this.camX = s.swayX * 0.5;
    }
    const shake = view.shake || 0;
    g.save();
    if (shake) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    this.drawBackdrop();
    this.drawCliff();
    this.drawRope(s);
    this.drawWalker(s, view, manY);
    this.drawDrops(dt);
    this.drawWeather(s, dt);
    g.restore();
    if (th.dark) {
      const v = g.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, H * 0.8);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,10,0.5)');
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
    }
    if (view.hud) {
      this.drawGauge(s, view);
      this.drawLeanMeter(s, view);
      this.drawGustArrow(s);
    }
  }

  drawBackdrop() {
    const g = this.g, b = this.bgRect;
    if (this.art.bg) {
      g.drawImage(this.art.bg, b.x - 8, b.y - 8, b.w + 16, b.h + 16);
      return;
    }
    // Until the painting arrives: a plain sky.
    const sky = g.createLinearGradient(0, 0, 0, this.H);
    sky.addColorStop(0, this.theme.sky[0]);
    sky.addColorStop(1, this.theme.sky[1]);
    g.fillStyle = sky;
    g.fillRect(-10, -10, this.W + 20, this.H + 20);
  }

  // The far cliff: its ledge post sits exactly where the rope is anchored.
  drawCliff() {
    const a = this.art, L = this.level.length;
    if (!a.cliff) return;
    const m = a.cliffMeta;
    const p = this.project(0, -0.05, L);
    if (!p) return;
    const scale = (CLIFF_WIDTH * p.k) / m.w;
    const x = p.x - m.postX * scale, y = p.y - m.ledgeY * scale;
    const w = m.w * scale, h = m.h * scale;
    const g = this.g;
    g.drawImage(a.cliff, x, y, w, h);
    const fog = Math.min(0.45, this.fogOf(L) * 0.8);
    if (fog > 0.02) {
      g.globalAlpha = fog;
      g.drawImage(a.cliffFog, x, y, w, h);
      g.globalAlpha = 1;
    }
  }

  drawRope(s) {
    const g = this.g, L = this.level.length;
    const z0 = this.camZ + 0.3, z1 = L;
    const pts = [];
    for (let i = 0; i <= 70; i++) {
      const t = i / 70;
      const z = z0 + (z1 - z0) * t * t;
      const p = this.project(this.ropeX(s, z), this.ropeY(s, z), z);
      if (p) pts.push(p);
    }
    g.lineCap = 'round';
    for (const [col, wk, dy] of [[shade(this.theme.rope, -0.5), 1.0, 0.25], [this.theme.rope, 0.6, 0], [shade(this.theme.rope, 0.35), 0.22, -0.12]]) {
      g.strokeStyle = col;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        g.lineWidth = Math.max(wk < 0.5 ? 0.5 : 1, 0.035 * a.k * wk);
        g.beginPath();
        g.moveTo(a.x, a.y + dy * 0.035 * a.k);
        g.lineTo(b.x, b.y + dy * 0.035 * b.k);
        g.stroke();
      }
    }
  }

  // The walker sprite, seen from behind. Legs are drawn as two halves so the
  // stepping foot can lift; the rest of him (pole and bucket included) is one piece.
  drawWalker(s, view, manY) {
    const g = this.g, A = ART.walker;
    const p = this.project(this.ropeX(s, s.z), manY, s.z);
    if (!p) return;
    const k = p.k;
    const lean = view.lean;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(lean);
    const im = this.art.walker;
    if (im) {
      const sc = k / A.ppm;
      const ox = -A.cx * sc, oy = -A.feetY * sc;
      const ph = s.stepPhase % 2;
      const liftL = ph < 1 ? Math.sin(ph * Math.PI) : 0;
      const liftR = ph >= 1 ? Math.sin((ph - 1) * Math.PI) : 0;
      const legH = A.h - A.legSplitY;
      // Each leg: lifted a little and foreshortened as the foot comes forward.
      for (const [x0, w, lift] of [[0, A.cx, liftL], [A.cx, A.w - A.cx, liftR]]) {
        const squash = 1 - lift * 0.1;
        const dy = -lift * 0.07 * k;
        g.drawImage(im, x0, A.legSplitY, w, legH,
          ox + x0 * sc, oy + A.legSplitY * sc + dy, w * sc, legH * sc * squash);
      }
      g.drawImage(im, 0, 0, A.w, A.legSplitY + 2, ox, oy, A.w * sc, (A.legSplitY + 2) * sc);
    }
    g.scale(k, -k);
    this.drawWater(s, view);
    const poleY = (A.feetY - A.poleY) / A.ppm;
    const poleEnd = (A.poleR - A.cx) / A.ppm;
    this.drawRibbon(s, [poleEnd, poleY], lean);
    g.restore();

    if (s.bird) this.drawBird(s, p, k, lean, poleEnd, poleY);
  }

  // Water in the bucket on his head, in metres with y up from his feet.
  drawWater(s, view) {
    const g = this.g, A = ART.walker;
    const rel = s.psi - view.lean;      // water surface relative to the bucket
    const rim = rimAngle(s.fill);
    const top = (A.feetY - A.bucketTopY) / A.ppm;
    const wt = A.bucketHalfW / A.ppm * 0.97;
    const ry = 0.032;
    g.save();
    g.translate(0, top - 0.004);
    g.fillStyle = '#3d454c';
    g.beginPath();
    g.ellipse(0, 0, wt, ry, 0, 0, Math.PI * 2);
    g.fill();
    if (s.fill > 0.01) {
      const depthShown = (1 - s.fill) * 0.05;
      g.save();
      g.beginPath();
      g.ellipse(0, 0, wt * 0.95, ry * 0.88, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = this.theme.dark ? '#1f5f93' : '#2f86c6';
      g.beginPath();
      g.ellipse(0, -depthShown, wt * 0.95, ry * 0.88, 0, 0, Math.PI * 2);
      g.fill();
      // The tilt shows as a bright crest moving to the high side.
      const off = Math.max(-1, Math.min(1, rel / 0.3)) * wt * 0.7;
      g.fillStyle = 'rgba(200,236,255,0.75)';
      g.beginPath();
      g.ellipse(-off, -depthShown, wt * 0.45, ry * 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // Water climbing over the rim when it is about to spill.
    const near = Math.abs(rel) / rim;
    if (near > 0.6 && s.fill > 0.01) {
      const side = rel > 0 ? -1 : 1;
      const h = Math.min(0.09, (near - 0.6) * 0.12);
      g.fillStyle = 'rgba(70,160,225,0.92)';
      g.beginPath();
      g.moveTo(side * wt * 0.1, 0.005);
      g.quadraticCurveTo(side * wt * 0.7, h * 1.6, side * (wt + 0.012), -0.01);
      g.lineTo(side * wt * 0.1, -0.01);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = 'rgba(225,232,238,0.9)';
    g.lineWidth = 0.011;
    g.beginPath();
    g.ellipse(0, 0, wt, ry, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // Spawn droplets from the rim while water pours out.
    if (s.spillRate > 0 && view.emit) {
      const m = g.getTransform();
      const side = s.spillSide;
      const lx = side * (wt + 0.01), ly = top;
      const sx = (m.a * lx + m.c * ly + m.e) / this.dpr, sy = (m.b * lx + m.d * ly + m.f) / this.dpr;
      const kk = Math.hypot(m.a, m.b) / this.dpr;
      const count = Math.min(6, 1 + s.spillRate * 12);
      for (let i = 0; i < count; i++) {
        this.drops.push({
          x: sx, y: sy,
          vx: side * (0.5 + Math.random() * 1.1) * kk,
          vy: -(Math.random() * 0.6) * kk,
          r: (0.012 + Math.random() * 0.02) * kk,
          g: 9.8 * kk, life: 1.6,
        });
      }
    }
  }

  drawRibbon(s, end, lean) {
    const g = this.g;
    // In the walker's frame the wind blows sideways; the ribbon trails with it.
    const w = Math.max(-1.6, Math.min(1.6, s.wind));
    const len = 0.25 + Math.abs(w) * 0.35;
    const dir = Math.abs(w) < 0.05 ? 0 : Math.sign(w);
    const t = performance.now() / 1000;
    g.strokeStyle = '#f3c63f';
    g.lineWidth = 0.035;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(end[0], end[1]);
    for (let i = 1; i <= 6; i++) {
      const a = i / 6;
      const x = end[0] + (dir ? dir * len * a : Math.sin(lean) * 0.05 * a);
      const y = end[1] - (dir ? 0.04 * a + (1 - Math.abs(w) / 1.6) * 0.2 * a * a : 0.3 * a) + Math.sin(t * 9 + a * 5) * 0.025 * a;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // A sparrow flies in, sits on one end of the pole for a few seconds and leaves.
  drawBird(s, p, k, lean, poleEnd, poleY) {
    const g = this.g, b = s.bird;
    const side = b.side;
    const lx = side * (poleEnd - 0.14), ly = poleY + 0.03;
    const c = Math.cos(lean), sn = Math.sin(lean);
    const tx = p.x + (lx * c + ly * sn) * k, ty = p.y + (lx * sn - ly * c) * k;
    const a = s.t - b.t0;
    let x = tx, y = ty, flying = false;
    const away = { x: tx + side * this.W * 0.7, y: ty - this.H * 0.35 };
    if (a < b.land) {
      const q = a / b.land, e = 1 - (1 - q) * (1 - q);
      x = away.x + (tx - away.x) * e;
      y = away.y + (ty - away.y) * e - Math.sin(q * Math.PI) * 30;
      flying = q < 0.92;
    } else if (a > b.land + b.sit) {
      const q = Math.min(1, (a - b.land - b.sit) / b.leave);
      x = tx + (away.x - tx) * q * q;
      y = ty + (away.y - ty) * q * q;
      flying = true;
    }
    const im = flying ? this.art.birdFly : this.art.birdSit;
    if (!im) return;
    const hgt = Math.max(14, 0.3 * k);
    const wid = hgt * im.width / im.height;
    g.save();
    g.translate(x, y);
    if (!flying) g.rotate(lean);
    // The painting faces left; coming in from the left it is mirrored.
    if (side < 0) g.scale(-1, 1);
    if (flying) {
      const bob = Math.sin(a * 28) * 0.08;
      g.drawImage(im, -wid / 2, -hgt * (0.6 + bob), wid, hgt);
    } else {
      g.drawImage(im, -wid * ART.birdSit.footX, -hgt, wid, hgt);
    }
    g.restore();
  }

  drawDrops(dt) {
    const g = this.g;
    g.fillStyle = 'rgba(80,170,235,0.9)';
    const keep = [];
    for (const d of this.drops) {
      d.vy += d.g * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
      if (d.life > 0 && d.y < this.H + 20) keep.push(d);
      g.beginPath();
      g.ellipse(d.x, d.y, d.r, d.r * (1 + Math.min(2, Math.abs(d.vy) / (d.g * 0.4))), 0, 0, Math.PI * 2);
      g.fill();
    }
    this.drops = keep;
  }

  drawWeather(s, dt) {
    const g = this.g, W = this.W, H = this.H;
    const w = s.wind;
    // Wind streaks.
    const want = Math.floor(Math.min(1.6, Math.abs(w)) * 28);
    while (this.streaks.length < want) this.streaks.push({ x: Math.random() * W, y: Math.random() * H * 0.85, l: 0.5 + Math.random() });
    if (this.streaks.length > want) this.streaks.length = want;
    if (want) {
      g.strokeStyle = this.theme.dark ? 'rgba(170,190,230,0.22)' : 'rgba(255,255,255,0.45)';
      g.lineWidth = 1.3;
      g.beginPath();
      for (const st of this.streaks) {
        st.x += w * 700 * st.l * dt;
        if (st.x > W + 60) { st.x = -60; st.y = Math.random() * H * 0.85; }
        if (st.x < -60) { st.x = W + 60; st.y = Math.random() * H * 0.85; }
        const len = Math.abs(w) * 50 * st.l;
        g.moveTo(st.x, st.y);
        g.lineTo(st.x - Math.sign(w) * len, st.y);
      }
      g.stroke();
    }
    if (this.flakes.length) {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (const f of this.flakes) {
        f.y += (0.05 + f.z * 0.12) * dt;
        f.x += (w * 0.35 * f.z + Math.sin(f.y * 20 + f.z * 9) * 0.01) * dt;
        if (f.y > 1) { f.y = -0.02; f.x = Math.random(); }
        if (f.x > 1.05) f.x = -0.05;
        if (f.x < -0.05) f.x = 1.05;
        g.beginPath();
        g.arc(f.x * W, f.y * H, 1 + f.z * 2.2, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // Cut-away bucket in the corner: the real water level and surface angle,
  // with the line you must not spill past.
  drawGauge(s, view) {
    const g = this.g;
    const rtl = document.documentElement.dir === 'rtl';
    const w = 58, h = 66;
    const x0 = rtl ? 16 : this.W - 16 - w, y0 = view.hudTop + 8;
    g.save();
    g.translate(x0, y0);
    // Plate.
    g.fillStyle = 'rgba(16,24,38,0.55)';
    roundRect(g, -8, -8, w + 16, h + 16, 14);
    g.fill();
    const bw = 10; // taper
    const shape = () => {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(w, 0);
      g.lineTo(w - bw, h);
      g.lineTo(bw, h);
      g.closePath();
    };
    g.save();
    shape();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fill();
    g.clip();
    // Water: a surface through the fill level, tilted by its angle to the bucket.
    const rel = s.psi - view.lean;
    const level = h * (1 - s.fill);
    const tilt = Math.tan(Math.max(-1.2, Math.min(1.2, rel)));
    const visTilt = tilt * w * 0.5 * (s.fill > 0.02 ? 1 : 0);
    g.fillStyle = '#3b9ae0';
    g.beginPath();
    g.moveTo(-5, level - visTilt);
    g.lineTo(w + 5, level + visTilt);
    g.lineTo(w + 5, h + 5);
    g.lineTo(-5, h + 5);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(6, 0, 4, h);
    g.restore();
    // Limit line.
    const ly = h * this.level.limit;
    g.strokeStyle = '#ff5a4f';
    g.lineWidth = 2;
    g.setLineDash([5, 4]);
    g.beginPath();
    g.moveTo(-4, ly);
    g.lineTo(w + 4, ly);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 2.5;
    shape();
    g.stroke();
    g.restore();
  }

  // Arc at the bottom: the needle is his lean, the small triangle your tilt.
  drawLeanMeter(s, view) {
    const g = this.g;
    const cx = this.W / 2, cy = this.H - 22 - view.safeBottom, r = Math.min(110, this.W * 0.3);
    const max = 0.95;
    const ang = (v) => -Math.PI / 2 + (v / max) * (Math.PI * 0.42);
    g.save();
    g.lineCap = 'round';
    g.lineWidth = 9;
    const seg = (a, b, col) => {
      g.strokeStyle = col;
      g.beginPath();
      g.arc(cx, cy, r, ang(a), ang(b));
      g.stroke();
    };
    seg(-max, -0.6, 'rgba(255,80,70,0.8)');
    seg(-0.6, -0.3, 'rgba(255,200,70,0.7)');
    seg(-0.3, 0.3, 'rgba(255,255,255,0.55)');
    seg(0.3, 0.6, 'rgba(255,200,70,0.7)');
    seg(0.6, max, 'rgba(255,80,70,0.8)');
    const a = ang(Math.max(-max, Math.min(max, view.lean)));
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22));
    g.lineTo(cx + Math.cos(a) * (r + 8), cy + Math.sin(a) * (r + 8));
    g.stroke();
    const b = ang(Math.max(-max, Math.min(max, s.u / 0.6 * max)));
    g.fillStyle = '#f3c63f';
    g.beginPath();
    g.moveTo(cx + Math.cos(b) * (r - 12), cy + Math.sin(b) * (r - 12));
    g.lineTo(cx + Math.cos(b - 0.05) * (r - 26), cy + Math.sin(b - 0.05) * (r - 26));
    g.lineTo(cx + Math.cos(b + 0.05) * (r - 26), cy + Math.sin(b + 0.05) * (r - 26));
    g.closePath();
    g.fill();
    g.restore();
  }

  drawGustArrow(s) {
    const wn = gustWarning(s);
    if (!wn) return;
    const g = this.g;
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 90);
    const x = this.W / 2 + wn.side * -this.W * 0.3, y = this.H * 0.42;
    g.save();
    g.translate(x, y);
    g.scale(wn.side, 1);
    g.globalAlpha = pulse;
    g.fillStyle = '#ffffff';
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-34, -9);
    g.lineTo(6, -9);
    g.lineTo(6, -22);
    g.lineTo(34, 0);
    g.lineTo(6, 22);
    g.lineTo(6, 9);
    g.lineTo(-34, 9);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
