// Drawing. The camera stands a few metres behind the walker and a little above,
// looking down the rope toward the far mountain. World axes: x to the right,
// y up, z along the rope (0 = start cliff, L = far cliff). Everything is projected
// with a plain pinhole camera onto a 2D canvas.
import { rimAngle, birdLoad, gustWarning } from './sim.js';

const THEMES = {
  morning: {
    sky: ['#4d97dd', '#a9d3f0', '#e6f2f7'], sun: { x: 0.8, y: 0.1, r: 26, c: '#fff7dc', glow: 'rgba(255,244,210,0.55)' },
    ranges: ['#a9c5dc', '#86a8c7', '#668cad'], top: '#78a35a', rock: '#8a7765', fog: '#cfe2ee', deep: '#33505f',
    fogDist: 150, clouds: 5, rope: '#d6b07a', shirt: ['#d8352a', '#f6efe4'],
  },
  noon: {
    sky: ['#2f86d8', '#8cc6ef', '#dbeef8'], sun: { x: 0.3, y: 0.06, r: 24, c: '#ffffff', glow: 'rgba(255,255,235,0.6)' },
    ranges: ['#9fbfd8', '#7c9fbf', '#5a7f9f'], top: '#6d9a4c', rock: '#8c7a66', fog: '#c6ddec', deep: '#2f4b5a',
    fogDist: 170, clouds: 7, rope: '#d6b07a', shirt: ['#d8352a', '#f6efe4'],
  },
  sunset: {
    sky: ['#3a3b78', '#c8607a', '#f7b267'], sun: { x: 0.62, y: 0.24, r: 34, c: '#ffd59a', glow: 'rgba(255,170,110,0.55)' },
    ranges: ['#9b6b8e', '#764f78', '#523a63'], top: '#8a6a4c', rock: '#7a5248', fog: '#e5a083', deep: '#2b2140',
    fogDist: 130, clouds: 4, rope: '#e2b07a', shirt: ['#2a4fb8', '#f6efe4'],
  },
  night: {
    sky: ['#040816', '#0d1a3a', '#22355f'], moon: { x: 0.24, y: 0.1, r: 18 }, stars: 140,
    ranges: ['#1e2c4c', '#18233e', '#111a30'], top: '#2c3b4a', rock: '#2a3140', fog: '#1d2b48', deep: '#070b18',
    fogDist: 90, clouds: 2, rope: '#a89270', shirt: ['#d8352a', '#e8e1d6'], dark: true,
  },
  snow: {
    sky: ['#7b8a99', '#aab6c1', '#d6dde3'], ranges: ['#c3ccd5', '#a9b5c1', '#8e9cab'],
    top: '#eef2f5', rock: '#6f7782', fog: '#d1d8de', deep: '#56616d',
    fogDist: 70, clouds: 0, rope: '#c9a87a', shirt: ['#1f7a5a', '#f2f2ee'], snow: true,
  },
  canyon: {
    sky: ['#3f86cf', '#9fc8e6', '#f2d7a8'], sun: { x: 0.18, y: 0.12, r: 28, c: '#fff4d6', glow: 'rgba(255,230,180,0.55)' },
    ranges: ['#d4a07a', '#b97e58', '#99603f'], top: '#d79a5c', rock: '#b4623a', fog: '#efcfa4', deep: '#5a2e22',
    fogDist: 160, clouds: 3, rope: '#e0b682', shirt: ['#d8352a', '#f6efe4'],
  },
};

// Deterministic 1D value noise.
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function vnoise(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}
function fbm(x) {
  return vnoise(x) * 0.6 + vnoise(x * 2.3 + 7) * 0.28 + vnoise(x * 5.1 + 3) * 0.12;
}

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

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.drops = [];
    this.streaks = [];
    this.flakes = [];
    this.clouds = [];
    this.theme = THEMES.morning;
    this.level = null;
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
    this.hy = this.H * 0.31;
    this.bakeBackground();
  }

  setLevel(level) {
    this.level = level;
    this.theme = THEMES[level.theme];
    this.seed = level.id * 13.7;
    this.drops.length = 0;
    this.clouds = [];
    for (let i = 0; i < this.theme.clouds; i++) {
      this.clouds.push({ x: hash(i + this.seed) * 1.4 - 0.2, y: 0.03 + hash(i * 3.1 + this.seed) * 0.17, s: 0.6 + hash(i * 7.7) * 0.8 });
    }
    this.flakes = [];
    if (this.theme.snow) {
      for (let i = 0; i < 160; i++) this.flakes.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 });
    }
    this.bakeBackground();
  }

  // Sky, sun or moon, stars and the distant ranges never move, so draw them once.
  bakeBackground() {
    const th = this.theme, W = this.W, H = this.H;
    if (!W) return;
    const b = this.bg;
    b.width = this.c.width;
    b.height = this.c.height;
    const g = b.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const hy = this.hy;
    const sky = g.createLinearGradient(0, 0, 0, hy + 40);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(0.6, th.sky[1]);
    sky.addColorStop(1, th.sky[2]);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    if (th.stars) {
      for (let i = 0; i < th.stars; i++) {
        const x = hash(i * 1.37) * W, y = hash(i * 2.71) * hy * 1.1;
        g.fillStyle = `rgba(255,255,240,${0.3 + hash(i * 5.3) * 0.7})`;
        g.fillRect(x, y, hash(i) > 0.9 ? 2 : 1.2, hash(i) > 0.9 ? 2 : 1.2);
      }
    }
    if (th.sun) {
      const s = th.sun;
      const gl = g.createRadialGradient(s.x * W, s.y * H, 0, s.x * W, s.y * H, s.r * 5);
      gl.addColorStop(0, s.glow);
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gl;
      g.fillRect(0, 0, W, H);
      g.fillStyle = s.c;
      g.beginPath();
      g.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      g.fill();
    }
    if (th.moon) {
      const m = th.moon;
      const gl = g.createRadialGradient(m.x * W, m.y * H, 0, m.x * W, m.y * H, m.r * 6);
      gl.addColorStop(0, 'rgba(200,215,255,0.35)');
      gl.addColorStop(1, 'rgba(200,215,255,0)');
      g.fillStyle = gl;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#eef1ff';
      g.beginPath();
      g.arc(m.x * W, m.y * H, m.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = th.sky[1];
      g.beginPath();
      g.arc(m.x * W + m.r * 0.45, m.y * H - m.r * 0.2, m.r * 0.9, 0, Math.PI * 2);
      g.fill();
    }
    // Three distant ranges, each a little closer and darker.
    const seed = this.seed || 1;
    th.ranges.forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, H);
      const amp = H * (0.05 + i * 0.025);
      const base = hy + H * (0.01 + i * 0.03);
      for (let x = 0; x <= W; x += 4) {
        const n = fbm(x / (W * (0.22 - i * 0.04)) + seed + i * 9.1);
        g.lineTo(x, base - amp * (0.3 + n * 1.1));
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    });
    // Haze over the horizon.
    const hz = g.createLinearGradient(0, hy - H * 0.06, 0, hy + H * 0.12);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(1, th.fog);
    g.fillStyle = hz;
    g.fillRect(0, hy - H * 0.06, W, H);
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
    return 1 - Math.exp(-Math.max(0, z - this.camZ) / this.theme.fogDist);
  }

  draw(s, view, dt) {
    const g = this.g, W = this.W, H = this.H, th = this.theme, L = this.level.length;
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

    g.drawImage(this.bg, 0, 0, W, H);
    this.drawClouds(s, dt);
    this.drawTerrain(s);
    this.drawRope(s);
    this.drawWalker(s, view, manY);
    this.drawDrops(dt);
    this.drawWeather(s, dt);
    g.restore();
    if (th.dark) {
      const v = g.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, H * 0.8);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,10,0.55)');
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
    }
    if (view.hud) {
      this.drawGauge(s, view);
      this.drawLeanMeter(s, view);
      this.drawGustArrow(s);
    }
  }

  drawClouds(s, dt) {
    const g = this.g, W = this.W, H = this.H;
    g.fillStyle = this.theme.dark ? 'rgba(120,140,180,0.18)' : 'rgba(255,255,255,0.75)';
    for (const c of this.clouds) {
      c.x += (0.004 + s.wind * 0.01) * dt;
      if (c.x > 1.3) c.x = -0.3;
      if (c.x < -0.3) c.x = 1.3;
      const x = c.x * W, y = c.y * H, r = 22 * c.s;
      g.beginPath();
      g.ellipse(x, y, r * 2.2, r * 0.7, 0, 0, Math.PI * 2);
      g.ellipse(x - r * 0.9, y - r * 0.25, r, r * 0.7, 0, 0, Math.PI * 2);
      g.ellipse(x + r * 0.6, y - r * 0.45, r * 1.2, r * 0.9, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Valley flanks on both sides, the far mountain with its ledge, and the start ledge.
  drawTerrain(s) {
    const g = this.g, th = this.theme, L = this.level.length, W = this.W, H = this.H;
    const seed = this.seed;
    const deepY = -220;

    // The abyss itself, below the horizon.
    const ab = g.createLinearGradient(0, this.hy, 0, H);
    ab.addColorStop(0, th.fog);
    ab.addColorStop(1, th.deep);
    g.fillStyle = ab;
    g.fillRect(0, this.hy + 2, W, H);

    // Far mountain, behind the ledge.
    const backZ = L + 34;
    this.fillProfile(backZ, (x) => 4 + 15 * Math.exp(-(((x - 12) / 22) ** 2)) + 10 * Math.exp(-(((x + 30) / 18) ** 2)) + fbm(x / 8 + seed) * 6, -60, mix(shade(th.rock, -0.05), th.fog, this.fogOf(backZ) * 0.8), th.top, 0.35);
    // The ledge where the rope ends.
    this.quad([-9, -0.05, L], [9, -0.05, L], [9, -0.05, backZ], [-9, -0.05, backZ], mix(shade(th.top, -0.08), th.fog, this.fogOf(L)));
    this.stake(L + 0.6);

    // Valley flanks, well off to the sides: level with the rope near the two
    // mountains and dropping deep into the valley mid-span.
    const near = Math.max(-12, this.camZ + 0.6);
    const zs = [];
    const n = 34;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      zs.push(near + (L + 4 - near) * (t * t * 0.7 + t * 0.3));
    }
    const top = (z, side) => {
      const v = Math.sin(Math.PI * Math.max(0, Math.min(1, z / L)));
      return 2 * (1 - v) ** 2 - 55 * v ** 0.8 + (fbm(z / 7 + side * 5 + seed) - 0.5) * 10 - 1;
    };
    const inner = (z, side) => 48 + fbm(z / 11 + side * 3 + seed) * 26;
    for (const side of [-1, 1]) {
      for (let i = n - 1; i >= 0; i--) {
        const z0 = zs[i], z1 = zs[i + 1];
        const y0 = top(z0, side), y1 = top(z1, side);
        const x0 = side * inner(z0, side), x1 = side * inner(z1, side);
        const fz = this.fogOf((z0 + z1) / 2);
        // Top surface out to the side, then the face dropping into the abyss.
        this.quad([x0, y0, z0], [side * 400, y0 - 4, z0], [side * 400, y1 - 4, z1], [x1, y1, z1], mix(th.top, th.fog, Math.min(1, fz * 1.1)));
        const face = mix(shade(th.rock, side < 0 ? -0.12 : 0.04), th.fog, fz);
        this.quad([x0, y0, z0], [x1, y1, z1], [x1, deepY, z1], [x0, deepY, z0], face);
      }
    }

    // Front face of the far mountain: a cliff wall that darkens as it drops into the gorge.
    const frontTop = (x) => (Math.abs(x) < 9 ? -0.05 : Math.min(9, (Math.abs(x) - 9) * 0.35) + fbm(x / 6 + seed + 2) * 3 - 1.5);
    const fL = this.fogOf(L);
    const pa = this.project(0, 0, L), pb = this.project(0, -70, L);
    let faceFill = mix(th.rock, th.fog, fL * 0.9);
    if (pa && pb) {
      faceFill = g.createLinearGradient(0, pa.y, 0, pb.y);
      faceFill.addColorStop(0, mix(shade(th.rock, 0.08), th.fog, fL * 0.8));
      faceFill.addColorStop(0.35, mix(shade(th.rock, -0.15), th.fog, fL * 0.85));
      faceFill.addColorStop(1, mix(th.deep, th.fog, fL * 0.4));
    }
    this.fillProfile(L, frontTop, deepY, faceFill, null, 0);
    // Crevices down the cliff.
    if (pa && pb) {
      g.strokeStyle = mix(shade(th.rock, -0.4), th.fog, fL * 0.8);
      g.lineWidth = Math.max(1, 0.25 * pa.k);
      g.globalAlpha = 0.5;
      g.beginPath();
      for (let i = 0; i < 14; i++) {
        const x = (hash(i * 3.3 + seed) - 0.5) * 120;
        const y0 = frontTop(x) - 1 - hash(i * 1.9) * 4;
        const len = 12 + hash(i * 7.1 + seed) * 40;
        const a = this.project(x, y0, L), b = this.project(x + (hash(i * 5.5) - 0.5) * 6, y0 - len, L);
        if (a && b) { g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
      }
      g.stroke();
      g.globalAlpha = 1;
    }
    // Depth haze over the lower faces.
    const pTop = this.project(0, -8, Math.max(L, this.camZ + 30));
    if (pTop) {
      const y0 = Math.max(this.hy, pTop.y);
      const hz = this.g.createLinearGradient(0, y0, 0, H);
      hz.addColorStop(0, 'rgba(0,0,0,0)');
      hz.addColorStop(1, th.deep);
      g.fillStyle = hz;
      g.globalAlpha = 0.85;
      g.fillRect(0, y0, W, H - y0);
      g.globalAlpha = 1;
    }

    // Start ledge, only while the camera is still near it.
    if (this.camZ < 0) {
      this.quad([-7, -0.05, this.camZ + 0.06], [7, -0.05, this.camZ + 0.06], [7, -0.05, 0], [-7, -0.05, 0], shade(th.top, -0.05));
      const e1 = this.project(-7, -0.05, 0), e2 = this.project(7, -0.05, 0);
      if (e1 && e2) {
        g.strokeStyle = shade(th.rock, -0.3);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(e1.x, e1.y);
        g.lineTo(e2.x, e2.y);
        g.stroke();
      }
      this.stake(-0.6);
    }
  }

  // A mountain silhouette at depth z: top edge from fn(x), filled down to yBottom.
  fillProfile(z, fn, yBottom, color, topColor, snowLine) {
    const g = this.g;
    const dz = z - this.camZ;
    if (dz < 0.1) return;
    const k = this.f / dz;
    const xMin = this.camX - (this.W / 2 + 20) / k, xMax = this.camX + (this.W / 2 + 20) / k;
    const step = Math.max(0.25, (xMax - xMin) / 90);
    g.beginPath();
    const pb = this.project(xMin, yBottom, z);
    g.moveTo(pb.x, Math.min(pb.y, this.H + 50));
    for (let x = xMin; x <= xMax + step; x += step) {
      const p = this.project(x, fn(x), z);
      g.lineTo(p.x, p.y);
    }
    const pe = this.project(xMax + step, yBottom, z);
    g.lineTo(pe.x, Math.min(pe.y, this.H + 50));
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (topColor && snowLine) {
      g.save();
      g.clip();
      const p0 = this.project(0, 34, z);
      g.fillStyle = mix(this.theme.top === '#eef2f5' ? '#ffffff' : '#f4f1ec', this.theme.fog, 0.3);
      g.globalAlpha = snowLine;
      g.fillRect(0, 0, this.W, p0.y);
      g.restore();
    }
  }

  quad(a, b, c, d, color) {
    const pa = this.project(...a), pb = this.project(...b), pc = this.project(...c), pd = this.project(...d);
    if (!pa || !pb || !pc || !pd) return;
    const g = this.g;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(pa.x, pa.y);
    g.lineTo(pb.x, pb.y);
    g.lineTo(pc.x, pc.y);
    g.lineTo(pd.x, pd.y);
    g.closePath();
    g.fill();
  }

  stake(z) {
    const p0 = this.project(0, -0.05, z), p1 = this.project(0, 0.32, z);
    if (!p0 || !p1) return;
    const g = this.g;
    g.strokeStyle = '#5b3b22';
    g.lineCap = 'round';
    g.lineWidth = Math.max(2, 0.09 * p0.k);
    g.beginPath();
    g.moveTo(p0.x, p0.y);
    g.lineTo(p1.x, p1.y);
    g.stroke();
  }

  drawRope(s) {
    const g = this.g, L = this.level.length;
    const z0 = this.camZ + 0.3, z1 = L + 0.6;
    const pts = [];
    for (let i = 0; i <= 70; i++) {
      const t = i / 70;
      const z = z0 + (z1 - z0) * t * t;
      const p = this.project(this.ropeX(s, z), this.ropeY(s, z), z);
      if (p) pts.push(p);
    }
    g.lineCap = 'round';
    for (const [col, wk, dy] of [[shade(this.theme.rope, -0.45), 1.0, 0.25], [this.theme.rope, 0.6, 0]]) {
      g.strokeStyle = col;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        g.lineWidth = Math.max(1, 0.035 * a.k * wk);
        g.beginPath();
        g.moveTo(a.x, a.y + dy * 0.035 * a.k);
        g.lineTo(b.x, b.y + dy * 0.035 * b.k);
        g.stroke();
      }
    }
  }

  // The walker, seen from behind, with the pole and the bucket on his head.
  drawWalker(s, view, manY) {
    const g = this.g, th = this.theme;
    const p = this.project(this.ropeX(s, s.z), manY, s.z);
    if (!p) return;
    const k = p.k;
    const lean = view.lean;
    const u = s.u;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(lean);
    g.scale(k, -k);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Pole: mirrors the phone. Its absolute angle is your tilt, so relative to his body it is u - lean.
    const bird = birdLoad(s) * (s.bird ? s.bird.side : 0);
    const poleA = -(u * 0.7 - lean);
    const poleY = 1.2;
    const half = 1.6;
    const ca = Math.cos(poleA), sa = Math.sin(poleA);
    const poleAt = (d, droop) => [d * ca + 0.0, poleY + d * sa - droop];
    const droopFor = (side) => 0.05 + (bird * side > 0 ? 0.12 : 0);
    const L0 = poleAt(-half, droopFor(-1)), R0 = poleAt(half, droopFor(1));
    g.strokeStyle = '#6b4a2b';
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(L0[0], L0[1]);
    g.quadraticCurveTo(0, poleY + 0.03, R0[0], R0[1]);
    g.stroke();
    // End caps and the wind ribbon.
    g.fillStyle = '#c9302c';
    for (const e of [L0, R0]) {
      g.beginPath();
      g.arc(e[0], e[1], 0.045, 0, Math.PI * 2);
      g.fill();
    }
    this.drawRibbon(s, R0, lean);

    // Legs.
    const ph = s.stepPhase % 2;
    const liftL = ph < 1 ? Math.sin(ph * Math.PI) : 0;
    const liftR = ph >= 1 ? Math.sin((ph - 1) * Math.PI) : 0;
    const pants = th.dark ? '#1d2230' : '#273449';
    g.strokeStyle = pants;
    g.lineWidth = 0.13;
    for (const [side, lift] of [[-1, liftL], [1, liftR]]) {
      g.beginPath();
      g.moveTo(side * 0.09, 0.92);
      g.quadraticCurveTo(side * 0.11, 0.45 + lift * 0.1, side * 0.035, 0.07 + lift * 0.12);
      g.stroke();
    }
    g.fillStyle = '#1a1410';
    for (const [side, lift] of [[-1, liftL], [1, liftR]]) {
      g.beginPath();
      g.ellipse(side * 0.035, 0.03 + lift * 0.12, 0.06, 0.04, 0, 0, Math.PI * 2);
      g.fill();
    }

    // Torso with circus stripes.
    g.save();
    g.beginPath();
    g.moveTo(-0.16, 0.86);
    g.lineTo(0.16, 0.86);
    g.quadraticCurveTo(0.2, 1.2, 0.22, 1.44);
    g.quadraticCurveTo(0, 1.52, -0.22, 1.44);
    g.quadraticCurveTo(-0.2, 1.2, -0.16, 0.86);
    g.closePath();
    g.fillStyle = th.shirt[1];
    g.fill();
    g.clip();
    g.fillStyle = th.shirt[0];
    for (let y = 0.86; y < 1.55; y += 0.12) g.fillRect(-0.3, y, 0.6, 0.06);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0.06, 0.8, 0.2, 0.8);
    g.restore();
    // Belt.
    g.fillStyle = '#3a2516';
    g.fillRect(-0.165, 0.86, 0.33, 0.05);

    // Arms to the pole.
    const hl = poleAt(-0.42, 0.0), hr = poleAt(0.42, 0.0);
    g.strokeStyle = th.shirt[0];
    g.lineWidth = 0.085;
    for (const [sx, h] of [[-1, hl], [1, hr]]) {
      g.beginPath();
      g.moveTo(sx * 0.19, 1.41);
      g.quadraticCurveTo(sx * 0.36, 1.32, h[0], h[1]);
      g.stroke();
    }
    g.fillStyle = '#e0a77f';
    for (const h of [hl, hr]) {
      g.beginPath();
      g.arc(h[0], h[1], 0.045, 0, Math.PI * 2);
      g.fill();
    }

    // Neck and head from behind.
    g.fillStyle = '#d99a72';
    g.fillRect(-0.045, 1.45, 0.09, 0.08);
    g.beginPath();
    g.ellipse(0, 1.6, 0.105, 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d0906a';
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.ellipse(sx * 0.105, 1.59, 0.025, 0.04, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#2b1a10';
    g.beginPath();
    g.ellipse(0, 1.63, 0.108, 0.1, 0, 0, Math.PI * 2);
    g.fill();

    this.drawBucket(s, view);
    g.restore();

    // Bird, drawn in screen space so it can fly in from outside.
    if (s.bird) this.drawBird(s, p, k, lean, poleAt, half);
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

  drawBucket(s, view) {
    const g = this.g;
    const rel = s.psi - view.lean;      // water surface relative to the bucket
    const rim = rimAngle(s.fill);
    g.save();
    g.translate(0, 1.71);
    const H = 0.25, wb = 0.13, wt = 0.165;
    // Body.
    const body = g.createLinearGradient(-wt, 0, wt, 0);
    body.addColorStop(0, '#6f7c88');
    body.addColorStop(0.35, '#c8d2da');
    body.addColorStop(0.55, '#e9eef2');
    body.addColorStop(1, '#5d6873');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-wb, 0);
    g.lineTo(wb, 0);
    g.lineTo(wt, H);
    g.lineTo(-wt, H);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(40,50,60,0.45)';
    g.lineWidth = 0.008;
    for (const y of [0.06, 0.17]) {
      const w = wb + (wt - wb) * (y / H);
      g.beginPath();
      g.moveTo(-w, y);
      g.lineTo(w, y);
      g.stroke();
    }
    // Opening, seen slightly from above, with the water inside.
    const ry = 0.035;
    g.fillStyle = '#4a5560';
    g.beginPath();
    g.ellipse(0, H, wt, ry, 0, 0, Math.PI * 2);
    g.fill();
    if (s.fill > 0.01) {
      const depthShown = (1 - s.fill) * 0.05;
      g.save();
      g.beginPath();
      g.ellipse(0, H, wt * 0.96, ry * 0.9, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#2f86c6';
      g.beginPath();
      g.ellipse(0, H - depthShown, wt * 0.96, ry * 0.9, 0, 0, Math.PI * 2);
      g.fill();
      // The tilt shows as a bright crest moving to the low side.
      const off = Math.max(-1, Math.min(1, rel / 0.3)) * wt * 0.7;
      g.fillStyle = 'rgba(190,230,255,0.75)';
      g.beginPath();
      g.ellipse(-off, H - depthShown, wt * 0.45, ry * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // Water climbing over the rim when it is about to spill.
    const near = Math.abs(rel) / rim;
    if (near > 0.6 && s.fill > 0.01) {
      const side = rel > 0 ? -1 : 1;
      const h = Math.min(0.09, (near - 0.6) * 0.12);
      g.fillStyle = 'rgba(70,160,225,0.9)';
      g.beginPath();
      g.moveTo(side * wt * 0.1, H + 0.005);
      g.quadraticCurveTo(side * wt * 0.7, H + h * 1.6, side * (wt + 0.012), H - 0.01);
      g.lineTo(side * wt * 0.1, H - 0.01);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = '#8a96a1';
    g.lineWidth = 0.012;
    g.beginPath();
    g.ellipse(0, H, wt, ry, 0, 0, Math.PI * 2);
    g.stroke();
    // Handle folded down on the near side.
    g.strokeStyle = '#3c454d';
    g.lineWidth = 0.01;
    g.beginPath();
    g.moveTo(-wt * 0.95, H * 0.85);
    g.quadraticCurveTo(0, H * 0.25, wt * 0.95, H * 0.85);
    g.stroke();
    g.restore();

    // Spawn droplets from the rim while water pours out.
    if (s.spillRate > 0 && view.emit) {
      const m = g.getTransform();
      const side = s.spillSide;
      const lx = side * (wt + 0.01), ly = 1.71 + H;
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

  drawBird(s, p, k, lean, poleAt, half) {
    const g = this.g, b = s.bird;
    const side = b.side;
    const tip = poleAt(side * (half - 0.15), 0.05 + (birdLoad(s) > 0 ? 0.12 : 0));
    // Pole tip in screen coords.
    const c = Math.cos(lean), sn = Math.sin(lean);
    const lx = tip[0], ly = tip[1] + 0.09;
    const tx = p.x + (lx * c + ly * sn) * k, ty = p.y + (lx * sn - ly * c) * k;
    const a = s.t - b.t0;
    let x = tx, y = ty, flap = 0;
    const away = { x: tx + side * this.W * 0.7, y: ty - this.H * 0.35 };
    if (a < b.land) {
      const q = a / b.land, e = 1 - (1 - q) * (1 - q);
      x = away.x + (tx - away.x) * e;
      y = away.y + (ty - away.y) * e - Math.sin(q * Math.PI) * 30;
      flap = Math.sin(a * 30);
    } else if (a > b.land + b.sit) {
      const q = Math.min(1, (a - b.land - b.sit) / b.leave);
      x = tx + (away.x - tx) * q * q;
      y = ty + (away.y - ty) * q * q;
      flap = Math.sin(a * 30);
    }
    const sz = Math.max(6, 0.22 * k);
    g.save();
    g.translate(x, y);
    g.scale(-side, 1);
    g.fillStyle = this.theme.dark ? '#cfd6e6' : '#2a2a35';
    g.beginPath();
    g.ellipse(0, 0, sz * 0.55, sz * 0.32, -0.2, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(-sz * 0.45, -sz * 0.25, sz * 0.22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f0a020';
    g.beginPath();
    g.moveTo(-sz * 0.66, -sz * 0.28);
    g.lineTo(-sz * 0.9, -sz * 0.2);
    g.lineTo(-sz * 0.64, -sz * 0.16);
    g.fill();
    g.fillStyle = this.theme.dark ? '#aeb7cc' : '#3d3d4a';
    g.beginPath();
    g.moveTo(-sz * 0.1, -sz * 0.1);
    g.lineTo(sz * 0.5, -sz * (0.2 + flap * 0.6));
    g.lineTo(sz * 0.35, sz * 0.05);
    g.fill();
    g.beginPath();
    g.moveTo(sz * 0.45, 0);
    g.lineTo(sz * 0.85, -sz * 0.08);
    g.lineTo(sz * 0.8, sz * 0.12);
    g.fill();
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
