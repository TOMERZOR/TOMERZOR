// The 3D room: a real perspective camera over a floor and a back wall, with the
// cartoon art standing in it as cut-out sprites that always face the camera.
// Sprites are drawn back to front by hand (no depth test), like layers of paper.

import * as THREE from 'three';
import { COLS, ROWS, cellOf, idx } from './game.js';

const SIZE = {
  lior: 1.5, lior_run: 1.08, lior_caught: 1.5, lior_glue: 1.45, lior_eat: 1.35, lior_ko: 1.3, lior_ghost: 1.3,
  minion_run: 0.82, fat_run: 0.98, fast_run: 0.62, bucket: 1.05, splat: 1.15, block: 1.25, toolbox: 1.1, snap: 0.92, glue: 0.95, cheese: 0.8, food: 1.25, burrow: 1.05,
};

export const IMAGES = ['lior', 'lior_run', 'lior_caught', 'lior_glue', 'lior_eat', 'lior_ko', 'lior_ghost', 'minion_run', 'fat_run', 'fast_run', 'bucket', 'splat', 'wall_meeting', 'wall_yard',
  'block', 'toolbox', 'snap', 'glue', 'cheese', 'food', 'burrow', 'floor', 'wall_office', 'wall_store', 'wall_kitchen'];

const RUN = { lior: 'lior_run', minion: 'minion_run', fat: 'fat_run', fast: 'fast_run' };

export const wx = (c) => c - (COLS - 1) / 2;
export const wz = (r) => r - (ROWS - 1) / 2;

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Scene {
  constructor(canvas, textures) {
    this.canvas = canvas;
    this.tex = textures;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a2118);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    this.margins = { top: 80, bottom: 150 };
    this.shake = 0;
    this.time = 0;
    this.items = new Map(); // cell index -> sprite group
    this.mice = new Map(); // mouse id -> view
    this.dots = [];
    this.buildRoom();
    this.shadowTex = canvasTex(128, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)');
      gr.addColorStop(0.6, 'rgba(0,0,0,0.25)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.save(); g.scale(1, h / w); g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); g.fill(); g.restore();
    });
  }

  buildRoom() {
    const floorTex = this.tex.floor;
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(9, 7);
    floorTex.anisotropy = 4;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 24), new THREE.MeshBasicMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 7.5);
    this.scene.add(floor);
    this.floor = floor;

    // the playing area: a slightly lighter, tiled patch with a painted edge
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(COLS + 0.24, ROWS + 0.24), new THREE.MeshBasicMaterial({ color: 0x1e1712, transparent: true, opacity: 0.35 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.002;
    this.scene.add(pad);

    const lines = [];
    const x0 = -COLS / 2, z0 = -ROWS / 2;
    for (let c = 0; c <= COLS; c++) lines.push(x0 + c, 0.01, z0, x0 + c, 0.01, z0 + ROWS);
    for (let r = 0; r <= ROWS; r++) lines.push(x0, 0.01, z0 + r, x0 + COLS, 0.01, z0 + r);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    this.grid = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xfff3d6, transparent: true, opacity: 0.22 }));
    this.scene.add(this.grid);

    const tiles = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0.07 }));
    tiles.rotation.x = -Math.PI / 2;
    tiles.position.y = 0.004;
    this.scene.add(tiles);
    this.tiles = tiles;

    this.wallMat = new THREE.MeshBasicMaterial({ map: this.tex.wall_office });
    const WH = 12 * 752 / 1344;
    for (const x of [-12, 0, 12]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, WH), this.wallMat);
      wall.position.set(x, WH / 2 - 0.02, -ROWS / 2 - 0.35);
      if (x) wall.scale.x = -1; // mirrored copies either side hide the seams
      this.scene.add(wall);
    }
    // a dark strip where the wall meets the floor, so the corner reads
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.set(0, 0.003, -ROWS / 2 - 0.1);
    this.scene.add(skirt);

    this.hover = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ color: 0x7dff6a, transparent: true, opacity: 0.35 }));
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.position.y = 0.015;
    this.hover.visible = false;
    this.scene.add(this.hover);

    this.dotGeo = new THREE.CircleGeometry(0.07, 12);
    this.dotGroup = new THREE.Group();
    this.scene.add(this.dotGroup);
  }

  setArea(area) {
    const t = this.tex[area.wall] || this.tex.wall_office;
    this.wallMat.map = t;
    this.wallMat.needsUpdate = true;
    this.floor.material.color.setHex(area.tint);
  }

  sprite(name, { height, anchor = 0.06, layer = 1 } = {}) {
    const tex = this.tex[name];
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const h = height ?? SIZE[name] ?? 1;
    const asp = tex.image.width / tex.image.height;
    s.userData = { name, h, asp, layer };
    s.center.set(0.5, anchor);
    s.scale.set(h * asp, h, 1);
    return s;
  }

  setImage(s, name, height) {
    if (s.userData.name === name) return;
    const tex = this.tex[name];
    s.material.map = tex;
    s.material.needsUpdate = true;
    const h = height ?? SIZE[name] ?? 1;
    s.userData.name = name;
    s.userData.h = h;
    s.userData.asp = tex.image.width / tex.image.height;
    s.scale.set(h * s.userData.asp, h, 1);
  }

  shadow(w) {
    const mat = new THREE.SpriteMaterial({ map: this.shadowTex, transparent: true, depthTest: false, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.center.set(0.5, 0.5);
    s.scale.set(w, w * 0.32, 1);
    s.userData = { layer: 0, shadow: true };
    return s;
  }

  order(obj, z, layer) {
    // layer 0: things lying on the floor, layer 1: things standing up. Within a layer, back to front.
    obj.renderOrder = (layer ? 1000 : 100) + Math.round((z + 10) * 20);
  }

  // ---------- level contents ----------
  // a mark on the floor where a mouse died; they stay until the level ends
  addSplat(x, z) {
    const s = this.sprite('splat', { anchor: 0.5 });
    s.position.set(wx(x), 0.012, wz(z));
    s.material.rotation = (Math.random() - 0.5) * 0.8;
    s.material.opacity = 0.92;
    s.scale.multiplyScalar(0.85 + Math.random() * 0.3);
    this.order(s, wz(z) - 0.55, 0);
    s.renderOrder -= 50;
    s.userData.born = this.time;
    s.userData.full = { x: s.scale.x, y: s.scale.y };
    this.scene.add(s);
    (this.splats ||= []).push(s);
    if (this.splats.length > 40) this.scene.remove(this.splats.shift());
  }

  // a quick zoom-in punch, for the killing blow
  punch(k = 1) { this.punchT = 0.32; this.punchK = k; }

  clearLevel() {
    for (const s of this.splats || []) this.scene.remove(s);
    this.splats = [];
    for (const v of this.items.values()) this.scene.remove(v);
    for (const v of this.mice.values()) { this.scene.remove(v.group); }
    if (this.foodView) this.scene.remove(this.foodView);
    for (const b of this.burrows || []) this.scene.remove(b);
    this.items.clear();
    this.mice.clear();
    this.burrows = [];
    this.setRoutes([]);
  }

  buildLevel(game) {
    this.clearLevel();
    this.game = game;
    for (const h of game.holes) {
      const { c, r } = cellOf(h);
      const b = this.sprite('burrow', { anchor: 0.5 });
      b.position.set(wx(c), 0.01, wz(r));
      this.order(b, wz(r) - 0.5, 0);
      this.scene.add(b);
      this.burrows.push(b);
    }
    const g = cellOf(game.goal);
    const food = new THREE.Group();
    const plate = this.sprite('food', { anchor: 0.3 });
    const sh = this.shadow(1.0);
    food.add(sh, plate);
    food.position.set(wx(g.c), 0, wz(g.r));
    this.order(sh, wz(g.r) - 0.6, 0);
    this.order(plate, wz(g.r), 1);
    this.foodView = food;
    this.foodPlate = plate;
    this.scene.add(food);
    this.syncItems();
  }

  syncItems() {
    const cells = this.game.cells;
    for (let i = 0; i < cells.length; i++) {
      const it = cells[i];
      const have = this.items.get(i);
      const key = it ? it.kind + (it.kind === 'rock' ? it.look : '') + (it.sprung ? 's' : '') : null;
      if (have && have.userData.key === key) continue;
      // a trap that just sprang is redrawn in place, without the placement pop
      const sameThing = have && it && have.userData.kind === it.kind;
      if (have) { this.scene.remove(have); this.items.delete(i); }
      if (!it) continue;
      const v = this.makeItem(it, i);
      v.userData.kind = it.kind;
      if (sameThing) v.userData.born = -10;
      v.userData.key = key;
      this.items.set(i, v);
      this.scene.add(v);
    }
  }

  makeItem(it, i) {
    const { c, r } = cellOf(i);
    const g = new THREE.Group();
    g.position.set(wx(c), 0, wz(r));
    const z = wz(r);
    let s;
    if (it.kind === 'rock') {
      const look = ['block', 'toolbox', 'block'][it.look % 3];
      s = this.sprite(look, { anchor: 0.12, height: look === 'block' ? 1.22 : 1.08 });
      if (it.look === 2) s.scale.x *= -1;
      const sh = this.shadow(1.05);
      sh.position.z = 0.05;
      this.order(sh, z - 0.5, 0);
      g.add(sh);
      this.order(s, z, 1);
    } else if (it.kind === 'block') {
      s = this.sprite('block', { anchor: 0.12, height: 1.22 });
      const sh = this.shadow(1.05);
      this.order(sh, z - 0.5, 0);
      g.add(sh);
      this.order(s, z, 1);
    } else if (it.kind === 'bucket') {
      s = this.sprite('bucket', { anchor: 0.2 });
      if (it.sprung) { s.scale.multiplyScalar(0.92); s.material.rotation = 0.18; }
      this.order(s, z + 0.3, 1);
    } else {
      s = this.sprite(it.kind, { anchor: 0.42 });
      this.order(s, z, 0);
    }
    g.add(s);
    g.userData.main = s;
    g.userData.born = this.time;
    return g;
  }

  setRoutes(routes) {
    for (const d of this.dots) this.dotGroup.remove(d);
    this.dots = [];
    const colours = [0xffd23f, 0xff6b9d, 0x6ee7ff, 0xb2ff59];
    routes.forEach((rt, n) => {
      const mat = new THREE.MeshBasicMaterial({ color: colours[n % colours.length], transparent: true, opacity: 0.9 });
      const pts = rt.path.map((i) => { const { c, r } = cellOf(i); return new THREE.Vector3(wx(c), 0.02, wz(r)); });
      let along = 0;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k];
        const len = a.distanceTo(b);
        for (let t = 0; t < len; t += 0.25) {
          const d = new THREE.Mesh(this.dotGeo, mat);
          d.rotation.x = -Math.PI / 2;
          d.position.lerpVectors(a, b, t / len);
          d.position.x += (n - (routes.length - 1) / 2) * 0.09; // routes that share a cell sit side by side
          d.userData.along = along + t;
          this.dotGroup.add(d);
          this.dots.push(d);
        }
        along += len;
      }
    });
  }

  showGrid(on) {
    this.grid.visible = on;
    this.tiles.visible = on;
    this.dotGroup.visible = on;
    if (!on) this.hover.visible = false;
  }

  setHover(cell, ok) {
    if (cell == null) { this.hover.visible = false; return; }
    const { c, r } = cellOf(cell);
    this.hover.visible = true;
    this.hover.position.x = wx(c);
    this.hover.position.z = wz(r);
    this.hover.material.color.setHex(ok ? 0x7dff6a : 0xff4a4a);
  }

  // ---------- mice ----------
  mouseView(m) {
    let v = this.mice.get(m.id);
    if (v) return v;
    const group = new THREE.Group();
    const sh = this.shadow(m.type === 'lior' ? 1.0 : 0.75);
    const body = this.sprite(RUN[m.type] || 'minion_run', { anchor: 0.08 });
    group.add(sh, body);
    this.scene.add(group);
    v = { group, sh, body, pose: '', squash: 0, flash: 0, ghost: null };
    this.mice.set(m.id, v);
    return v;
  }

  hitFlash(id) {
    const v = this.mice.get(id);
    if (v) { v.flash = 0.12; v.squash = 0.35; }
  }

  syncMice(dt) {
    const live = new Set();
    for (const g of this.items.values()) g.visible = true;
    for (const m of this.game.mice) {
      live.add(m.id);
      const v = this.mouseView(m);
      this.poseMouse(m, v, dt);
    }
    for (const [id, v] of this.mice) {
      if (!live.has(id)) { this.scene.remove(v.group); this.mice.delete(id); }
    }
  }

  poseMouse(m, v, dt) {
    const lior = m.type === 'lior';
    const run = RUN[m.type] || 'minion_run';
    const t = this.time;
    const body = v.body;
    v.flash = Math.max(0, v.flash - dt);
    v.squash = Math.max(0, v.squash - dt * 2.5);
    const x = wx(m.x), z = wz(m.z);
    v.group.position.set(x, 0, z);
    v.group.visible = m.state !== 'away';
    this.order(v.sh, z - 0.4, 0);
    this.order(body, z + 0.2, 1);
    let pose, bob = 0, rot = 0, sx = 1, sy = 1, alpha = 1, face = m.face;
    const state = m.alive ? m.state : (m.state === 'away' ? 'away' : 'dead');
    const trapItem = m.trapCell != null ? this.items.get(m.trapCell) : null;
    switch (state) {
      case 'emerge': {
        const k = 1 - Math.max(0, m.t) / 0.55; // rising out of the hole
        pose = run;
        sy = 0.2 + 0.8 * k; sx = 0.7 + 0.3 * k; alpha = Math.min(1, k * 2);
        break;
      }
      case 'run': case 'flee': case 'confused': {
        pose = run;
        const f = m.state === 'confused' ? 9 : 17 + (m.dash > 0 ? 8 : 0);
        bob = Math.abs(Math.sin(t * f)) * 0.07;
        rot = Math.sin(t * f) * 0.05;
        sy = 1 + Math.sin(t * f * 2) * 0.04;
        if (m.stumble > 0) { rot = 0.35 * face; bob = 0; }
        if (m.state === 'confused') rot += Math.sin(t * 4) * 0.25;
        break;
      }
      case 'caught':
        pose = lior ? 'lior_caught' : run;
        rot = Math.sin(t * 38) * 0.06;
        bob = lior ? 0 : 0.02;
        if (!lior) { rot = Math.sin(t * 40) * 0.25; }
        face = 1;
        break;
      case 'glued':
        pose = lior ? 'lior_glue' : run;
        sx = 1 + Math.sin(t * 7) * 0.05; sy = 1 - Math.sin(t * 7) * 0.05;
        face = lior ? 1 : face;
        break;
      case 'bucketed':
        pose = run;
        alpha = 0;
        if (trapItem) {
          const b = trapItem.userData.main;
          b.material.rotation = Math.sin(t * 34) * 0.07;
          b.position.y = Math.abs(Math.sin(t * 17)) * 0.06;
        }
        break;
      case 'eating':
        pose = lior ? 'lior_eat' : run;
        sy = 1 + Math.sin(t * 14) * 0.05;
        face = 1;
        break;
      case 'stunned':
        pose = lior ? 'lior' : run;
        rot = Math.sin(t * 60) * 0.04;
        sx = 1.06; sy = 0.94;
        face = 1;
        break;
      case 'leaving': {
        pose = run;
        const k = Math.max(0, m.t) / 0.35;
        sy = 0.2 + 0.8 * k; alpha = k;
        break;
      }
      case 'dead': {
        const k = m.deadT || 0;
        if (lior) {
          pose = 'lior_ko';
          if (k > 1.0) { // the ghost floats up
            if (!v.ghost) {
              v.ghost = this.sprite('lior_ghost', { anchor: 0.0 });
              v.group.add(v.ghost);
            }
            const g = k - 1.0;
            v.ghost.position.y = 0.2 + g * 1.1;
            v.ghost.material.opacity = Math.max(0, 1 - g / 1.5) * 0.85;
            this.order(v.ghost, z + 3, 1);
          }
          alpha = k > 2.0 ? Math.max(0, 1 - (k - 2.0) / 0.6) : 1;
        } else {
          pose = run;
          sy = Math.max(0.12, 1 - k * 4); sx = 1 + Math.min(0.5, k * 2);
          rot = 0;
          alpha = k > 1.6 ? Math.max(0, 1 - (k - 1.6) / 0.8) : 1;
        }
        face = 1;
        break;
      }
      default:
        pose = run;
    }
    if (pose !== v.pose) {
      this.setImage(body, pose);
      v.pose = pose;
    }
    // Lior's own trap pictures already include the trap; hide the one on the floor meanwhile
    if (trapItem && lior && (state === 'caught' || state === 'glued')) trapItem.visible = false;
    const sq = v.squash;
    const h = body.userData.h, asp = body.userData.asp;
    body.scale.set(h * asp * sx * (1 + sq * 0.4) * (face < 0 ? -1 : 1), h * sy * (1 - sq * 0.35), 1);
    body.position.y = bob;
    body.material.rotation = rot;
    body.material.opacity = alpha;
    body.material.color.setRGB(1, v.flash > 0 ? 0.55 : 1, v.flash > 0 ? 0.55 : 1);
    v.sh.material.opacity = alpha * (state === 'dead' && lior ? 0.6 : 1);
    v.sh.visible = state !== 'emerge' || alpha > 0.4;
  }

  // ---------- frame ----------
  resize(w, h, margins) {
    if (margins) this.margins = margins;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.fit();
  }

  // Put the camera where the whole grid (and a mouse standing on its back row) fits
  // between the HUD at the top and the tray at the bottom.
  fit() {
    const cam = this.camera;
    const pitch = THREE.MathUtils.degToRad(54);
    const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
    const pts = [];
    const hx = COLS / 2 + 0.1, hz = ROWS / 2 + 0.1;
    for (const x of [-hx, hx]) {
      pts.push(new THREE.Vector3(x, 0, -hz), new THREE.Vector3(x, 0, hz), new THREE.Vector3(x, 1.1, -hz));
    }
    const top = 1 - 2 * (this.margins.top / this.h);
    const bot = -1 + 2 * (this.margins.bottom / this.h);
    const target = new THREE.Vector3(0, 0, 0.3);
    const wantW = 1.94, wantH = top - bot;
    let dist = 16, box = null;
    cam.clearViewOffset();
    const measure = () => {
      cam.position.copy(target).addScaledVector(dir, dist);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        const q = p.clone().project(cam);
        minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x);
        minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y);
      }
      return { minX, maxX, minY, maxY };
    };
    for (let it = 0; it < 30; it++) {
      box = measure();
      const k = Math.max((box.maxX - box.minX) / wantW, (box.maxY - box.minY) / wantH);
      if (Math.abs(k - 1) < 0.002) break;
      dist = Math.max(4, Math.min(60, dist * (1 + (k - 1) * 0.9)));
    }
    // slide the picture (not the camera) so it sits centred between the HUD and the tray
    const cy = (box.minY + box.maxY) / 2, want = (top + bot) / 2;
    cam.setViewOffset(this.w, this.h, 0, (want - cy) / 2 * this.h, this.w, this.h);
    cam.updateProjectionMatrix();
    this.camBase = cam.position.clone();
    this.camTarget = target.clone();
  }

  render(dt) {
    this.time += dt;
    const cam = this.camera;
    if (this.camBase) {
      this.shake = Math.max(0, this.shake - dt * 3);
      const s = this.shake * this.shake * 0.25;
      cam.position.set(this.camBase.x + (Math.random() - 0.5) * s, this.camBase.y + (Math.random() - 0.5) * s, this.camBase.z);
      cam.lookAt(this.camTarget.x + (Math.random() - 0.5) * s * 0.3, this.camTarget.y, this.camTarget.z);
    }
    for (const d of this.dots) {
      const k = (d.userData.along - this.time * 2.2) % 1.0;
      const f = k < 0 ? k + 1 : k;
      d.scale.setScalar(0.75 + 0.6 * Math.max(0, 1 - Math.abs(f - 0.5) * 4));
    }
    for (const g of this.items.values()) {
      const age = this.time - g.userData.born;
      if (age < 0.35) {
        const k = age / 0.35;
        const pop = 1 + Math.sin(k * Math.PI) * 0.25;
        g.scale.set(pop, k < 0.5 ? 0.4 + k * 1.2 : pop, 1);
        g.position.y = (1 - k) * 0.6;
      } else if (g.scale.x !== 1) { g.scale.set(1, 1, 1); g.position.y = 0; }
    }
    if (this.foodPlate && this.game) {
      const left = this.game.food / this.game.foodMax;
      this.foodPlate.material.opacity = 0.45 + 0.55 * left;
    }
    for (const sp of this.splats || []) {
      const age = this.time - sp.userData.born;
      if (sp.userData.done) continue;
      const f = sp.userData.full;
      if (age >= 0.3) { sp.scale.set(f.x, f.y, 1); sp.userData.done = true; continue; }
      const k = 0.3 + 0.7 * Math.min(1, age / 0.1) + Math.sin(Math.min(1, age / 0.3) * Math.PI) * 0.3;
      sp.scale.set(f.x * k, f.y * k, 1);
    }
    const fov0 = 48;
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - dt);
      const k = Math.sin((this.punchT / 0.32) * Math.PI) * 0.09 * (this.punchK || 1);
      cam.fov = fov0 * (1 - k);
      cam.updateProjectionMatrix();
    } else if (cam.fov !== fov0) { cam.fov = fov0; cam.updateProjectionMatrix(); }
    this.renderer.render(this.scene, cam);
  }

  // ---------- picking ----------
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h };
  }

  mouseScreen(m) {
    const y = m.type === 'lior' ? 0.5 : 0.3;
    return this.project(wx(m.x), y, wz(m.z));
  }

  cellPixels() {
    const a = this.project(0, 0, 0), b = this.project(1, 0, 0);
    return Math.abs(b.x - a.x);
  }

  pickCell(px, py) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(px / this.w * 2 - 1, -(py / this.h) * 2 + 1), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const c = Math.round(hit.x + (COLS - 1) / 2);
    const r = Math.round(hit.z + (ROWS - 1) / 2);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
    return idx(c, r);
  }
}
