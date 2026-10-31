// The 3D planner: a floor (optionally a room with walls) where items are arranged at real size.
// Also used, in preview mode, as the turntable viewer in an item's sheet.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createItemObject, setSelected, footprint, polygonsOverlap, isSolid, addLights, defaultY, ACCENT, disposeItemObject, LIGHT_DEVICE } from './scene-kit.js';
import { CATEGORIES } from './catalog.js';

const M = v => v / 100;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOutBack = t => { const c1 = 1.3, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOut = t => 1 - Math.pow(1 - t, 3);

export class Studio {
  constructor(canvas, { preview = false, previewDims = true, onSelect, onChange, onConflicts } = {}) {
    this.canvas = canvas;
    this.preview = preview;
    this.previewDims = previewDims;
    this.onSelect = onSelect || (() => {});
    this.onChange = onChange || (() => {});
    this.onConflicts = onConflicts || (() => {});
    this.objects = new Map(); // placement id -> root
    this.selected = null;
    this.tweens = [];
    this.flags = { dims: false, clearance: false, person: false };

    // only the planner needs to read its pixels back (room snapshots)
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !preview });
    r.setPixelRatio(Math.min(devicePixelRatio, LIGHT_DEVICE ? 1.5 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;

    const scene = this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    this.lights = addLights(scene);

    this.camera = new THREE.PerspectiveCamera(preview ? 32 : 42, 1, 0.05, 80);
    this.camera.position.set(3.2, 3.4, 5.2);
    const c = this.controls = new OrbitControls(this.camera, canvas);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.maxPolarAngle = Math.PI * 0.47;
    c.minDistance = 0.6;
    c.maxDistance = 22;
    c.target.set(0, 0.4, 0);
    if (preview) {
      c.autoRotate = !reduceMotion(); c.autoRotateSpeed = 1.1; c.enablePan = false; c.enableZoom = false;
      // sideways drags turn the item, up-and-down swipes still scroll the page around it
      canvas.style.touchAction = 'pan-y';
    }

    // floor: catches shadows, plus a quiet 50cm grid
    const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16 }));
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.receiveShadow = true;
    scene.add(shadowFloor);
    this.floor = shadowFloor;
    if (!preview) {
      const grid = new THREE.GridHelper(40, 80, '#8a8f96', '#8a8f96');
      grid.material.transparent = true; grid.material.opacity = 0.14; grid.material.depthWrite = false;
      grid.position.y = 0.001;
      scene.add(grid);
      this.grid = grid;
    }
    this.roomGroup = new THREE.Group();
    scene.add(this.roomGroup);
    this.person = makePerson();
    this.person.visible = false;
    scene.add(this.person);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.pointers = new Map();
    if (!preview) this.bindPointer();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas);
    this.resize();
    this.last = performance.now();
    this.running = true;
    r.setAnimationLoop(() => this.frame());
  }

  // ---------- lifecycle ----------
  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  pause() { this.running = false; this.renderer.setAnimationLoop(null); }
  resume() { if (!this.running) { this.running = true; this.renderer.setAnimationLoop(() => this.frame()); } }
  dispose() {
    this.disposed = true;
    this.listeners?.abort();
    this.selected = null;
    this.onSelect = this.onChange = this.onConflicts = () => {};
    this.pause();
    this.resizeObs.disconnect();
    for (const root of this.objects.values()) disposeItemObject(root);
    this.objects.clear();
    this.controls.dispose();
    this.renderer.dispose();
    // phones allow only a few WebGL contexts; give this one back now instead of waiting for GC
    this.renderer.forceContextLoss();
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.tweens = this.tweens.filter(t => {
      const k = Math.min(1, (now - t.start) / t.dur);
      t.step(t.ease(k));
      if (k >= 1) { t.done?.(); return false; }
      return true;
    });
    if (this.selected?.userData.ring?.visible) {
      this.selected.userData.ring.material.opacity = 0.65 + 0.35 * Math.sin(now / 260);
    }
    this.updateWalls();
    this.controls.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  tween(dur, step, { ease = easeOut, done } = {}) {
    if (reduceMotion()) { step(1); done?.(); return; }
    this.tweens.push({ start: performance.now(), dur, step, ease, done });
  }

  // ---------- room ----------
  /** Draws a rectangular room, size in cm ({w, l}), or removes it with null. */
  setRoom(size) {
    this.room = size && size.w && size.l ? { w: M(size.w), l: M(size.l) } : null;
    for (const c of [...this.roomGroup.children]) { this.roomGroup.remove(c); c.geometry?.dispose(); }
    if (this.grid) this.grid.visible = !this.room;
    if (!this.room) return;
    const { w, l } = this.room;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ color: '#d9cdbd', roughness: 0.75 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.001;
    floor.receiveShadow = true;
    this.roomGroup.add(floor);
    const g = new THREE.GridHelper(Math.max(w, l), Math.round(Math.max(w, l) / 0.5), '#000', '#000');
    g.material.transparent = true; g.material.opacity = 0.05; g.position.y = 0.0005;
    g.scale.set(w / Math.max(w, l), 1, l / Math.max(w, l));
    this.roomGroup.add(g);
    const H = 2.6, T = 0.1;
    const wallMat = () => new THREE.MeshStandardMaterial({ color: '#f3f1ed', roughness: 0.95, transparent: true, opacity: 1 });
    // walls named by the side of the room they stand on; normal points into the room
    const walls = [
      { name: 'back', size: [w + 2 * T, H, T], pos: [0, H / 2, -l / 2 - T / 2], n: [0, 0, 1] },
      { name: 'front', size: [w + 2 * T, H, T], pos: [0, H / 2, l / 2 + T / 2], n: [0, 0, -1] },
      { name: 'left', size: [T, H, l], pos: [-w / 2 - T / 2, H / 2, 0], n: [1, 0, 0] },
      { name: 'right', size: [T, H, l], pos: [w / 2 + T / 2, H / 2, 0], n: [-1, 0, 0] },
    ];
    this.walls = walls.map(def => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...def.size), wallMat());
      m.position.set(...def.pos);
      m.castShadow = false; m.receiveShadow = true;
      m.userData.normal = new THREE.Vector3(...def.n);
      m.userData.wall = def.name;
      this.roomGroup.add(m);
      return m;
    });
    this.checkConflicts();
  }

  /** Walls between the camera and the room fade out, like a doll's house. */
  updateWalls() {
    if (!this.walls) return;
    const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).setY(0).normalize();
    for (const w of this.walls) {
      const facing = w.userData.normal.dot(dir); // < 0 means the wall faces the camera's back
      const target = facing > 0.2 ? 0.08 : 1;
      w.material.opacity += (target - w.material.opacity) * 0.15;
      w.material.depthWrite = w.material.opacity > 0.5;
      w.visible = w.material.opacity > 0.03;
    }
  }

  // ---------- items ----------
  async addItem(item, placement = {}, { animate = true, select = false } = {}) {
    const root = await createItemObject(item);
    if (this.disposed) { disposeItemObject(root); return null; }
    const pid = placement.pid || `p_${Math.random().toString(36).slice(2, 9)}`;
    root.userData.pid = pid;
    root.position.set(placement.x ?? 0, placement.y ?? defaultY(item), placement.z ?? 0);
    root.rotation.y = placement.rot ?? 0;
    if (placement.x == null && !this.preview) this.findFreeSpot(root);
    this.scene.add(root);
    this.objects.set(pid, root);
    this.applyFlags(root);
    if (animate) {
      const y0 = root.position.y;
      root.scale.setScalar(0.9);
      root.position.y = y0 + 0.18;
      this.tween(520, k => { root.scale.setScalar(0.9 + 0.1 * k); root.position.y = y0 + 0.18 * (1 - k); }, { ease: easeOutBack });
    }
    if (this.preview) this.frameAll();
    if (select) this.select(root);
    this.checkConflicts();
    return root;
  }

  /** Swaps an item's object for a rebuilt one (after its size, colour or model changed). */
  hasItem(id) { return [...this.objects.values()].some(r => r.userData.item.id === id); }

  /** Swaps an item's objects for rebuilt ones (its size, colour or model changed, or it became a copy: fromId). */
  async replaceItem(item, fromId = item.id) {
    for (const [pid, old] of [...this.objects]) {
      if (old.userData.item.id !== fromId) continue;
      const root = await createItemObject(item);
      // another rebuild (or closing the planner) got here first: drop this one
      if (this.disposed || this.objects.get(pid) !== old) { disposeItemObject(root); continue; }
      root.userData.pid = pid;
      root.position.copy(old.position);
      if (old.userData.wall !== (CATEGORIES[item.category]?.mount === 'wall')) root.position.y = defaultY(item);
      root.rotation.copy(old.rotation);
      this.scene.add(root);
      this.scene.remove(old);
      disposeItemObject(old);
      this.objects.set(pid, root);
      this.applyFlags(root);
      if (this.selected === old) { this.selected = null; this.select(root); }
    }
    if (this.preview) this.frameAll();
    this.checkConflicts();
  }

  removeSelected() {
    const root = this.selected;
    if (!root) return;
    this.select(null);
    this.tween(220, k => root.scale.setScalar(1 - 0.15 * k), {
      done: () => { this.scene.remove(root); disposeItemObject(root); },
    });
    this.objects.delete(root.userData.pid);
    this.checkConflicts();
    this.onChange();
  }

  async duplicateSelected() {
    const s = this.selected;
    if (!s) return;
    const p = this.placementOf(s);
    const off = M(s.userData.item.dims.w) + 0.1;
    const dx = Math.cos(s.rotation.y) * off, dz = -Math.sin(s.rotation.y) * off;
    const root = await this.addItem(s.userData.item, { ...p, pid: undefined, x: p.x + dx, z: p.z + dz }, { select: true });
    if (!root) return;
    this.clampToRoom(root);
    this.onChange();
  }

  rotateSelected(deg) {
    const s = this.selected;
    if (!s) return;
    const from = s.rotation.y;
    const to = Math.round((from + THREE.MathUtils.degToRad(deg)) / (Math.PI / 12)) * (Math.PI / 12);
    this.tween(260, k => { s.rotation.y = from + (to - from) * k; }, { done: () => { this.clampToRoom(s); this.checkConflicts(); this.onChange(); } });
  }

  placementOf(root) {
    return { pid: root.userData.pid, itemId: root.userData.item.id, x: +root.position.x.toFixed(3), y: +root.position.y.toFixed(3), z: +root.position.z.toFixed(3), rot: +root.rotation.y.toFixed(4) };
  }
  placements() { return [...this.objects.values()].map(r => this.placementOf(r)); }
  items() { return [...this.objects.values()].map(r => r.userData.item); }

  clear() {
    this.select(null);
    for (const root of this.objects.values()) { this.scene.remove(root); disposeItemObject(root); }
    this.objects.clear();
    this.checkConflicts();
  }

  select(root) {
    if (this.selected === root) return;
    const prev = this.selected;
    this.selected = root;
    if (prev) { setSelected(prev, false); this.applyFlags(prev); }
    if (root) { setSelected(root, true); this.applyFlags(root); }
    this.placePerson();
    this.onSelect(root);
  }

  setFlag(name, on) {
    this.flags[name] = on;
    for (const root of this.objects.values()) this.applyFlags(root);
    this.placePerson();
  }

  applyFlags(root) {
    const u = root.userData;
    const sel = root === this.selected;
    if (u.dims) u.dims.visible = this.flags.dims || sel || (this.preview && this.previewDims);
    if (u.clearance) u.clearance.visible = this.flags.clearance;
  }

  /** A 175cm person stands next to the selected item (or the middle of the room) for scale. */
  placePerson() {
    const p = this.person;
    p.visible = this.flags.person;
    if (!p.visible) return;
    const s = this.selected || [...this.objects.values()][0];
    if (s && !s.userData.wall) {
      const off = M(s.userData.item.dims.w) / 2 + 0.35;
      p.position.set(s.position.x + Math.cos(s.rotation.y) * off, 0, s.position.z - Math.sin(s.rotation.y) * off);
    } else p.position.set(0.8, 0, 0.8);
    p.lookAt(this.camera.position.x, 0, this.camera.position.z);
  }

  /** Puts a new item where it doesn't bump into others: tries rings around the centre. */
  findFreeSpot(root) {
    if (root.userData.wall) {
      if (this.room) { root.position.set(0, root.position.y, -this.room.l / 2); root.rotation.y = 0; }
      else root.position.z = -1;
      return;
    }
    if (!isSolid(root)) return;
    const others = [...this.objects.values()].filter(isSolid).map(footprint);
    for (let ring = 0; ring < 8; ring++) {
      const steps = ring === 0 ? 1 : ring * 8;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        root.position.x = Math.cos(a) * ring * 0.45;
        root.position.z = Math.sin(a) * ring * 0.45;
        this.clampToRoom(root);
        const fp = footprint(root);
        if (!others.some(o => polygonsOverlap(fp, o))) return;
      }
    }
    root.position.set(0, root.position.y, 0);
  }

  clampToRoom(root) {
    if (!this.room) return;
    const { w, l } = this.room;
    if (root.userData.wall) return;
    const fp = footprint(root);
    let dx = 0, dz = 0;
    const xs = fp.map(p => p[0]), zs = fp.map(p => p[1]);
    if (Math.min(...xs) < -w / 2) dx = -w / 2 - Math.min(...xs);
    if (Math.max(...xs) > w / 2) dx = w / 2 - Math.max(...xs);
    if (Math.min(...zs) < -l / 2) dz = -l / 2 - Math.min(...zs);
    if (Math.max(...zs) > l / 2) dz = l / 2 - Math.max(...zs);
    root.position.x += dx; root.position.z += dz;
  }

  /** Marks items that overlap each other in red and reports the pairs. */
  checkConflicts() {
    const solids = [...this.objects.values()].filter(isSolid);
    const fps = solids.map(footprint);
    const bad = new Set();
    const pairs = [];
    for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) {
      if (polygonsOverlap(fps[i], fps[j], 0.015)) { bad.add(solids[i]); bad.add(solids[j]); pairs.push([solids[i].userData.item, solids[j].userData.item]); }
    }
    for (const root of this.objects.values()) {
      const ring = root.userData.ring;
      if (!ring) continue;
      const isBad = bad.has(root);
      ring.material.color.set(isBad ? '#E5484D' : ACCENT);
      ring.visible = isBad || root === this.selected;
    }
    this.onConflicts(pairs);
  }

  // ---------- camera ----------
  frameAll(animate = false) {
    const box = new THREE.Box3();
    for (const r of this.objects.values()) box.expandByObject(r.userData.model);
    if (this.room && !this.preview) box.union(new THREE.Box3(new THREE.Vector3(-this.room.w / 2, 0, -this.room.l / 2), new THREE.Vector3(this.room.w / 2, 2.6, this.room.l / 2)));
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(0.35, size.length() / 2);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = (radius / Math.sin(fov / 2)) * (this.preview ? 0.92 : 0.95);
    const dir = new THREE.Vector3(0.62, this.preview ? 0.42 : 0.62, 1).normalize();
    const toPos = center.clone().add(dir.multiplyScalar(dist));
    const toTarget = center.clone().setY(this.preview ? size.y * 0.45 : Math.min(center.y, 0.6));
    if (!animate || reduceMotion()) {
      this.camera.position.copy(toPos);
      this.controls.target.copy(toTarget);
      return;
    }
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
    this.tween(700, k => { this.camera.position.lerpVectors(p0, toPos, k); this.controls.target.lerpVectors(t0, toTarget, k); });
  }

  /** 0 = morning, 0.5 = midday, 1 = night. */
  setDaylight(t) {
    const { sun, hemi } = this.lights;
    const night = Math.max(0, (t - 0.7) / 0.3);
    const a = Math.PI * (0.15 + 0.7 * Math.min(t, 0.85) / 0.85);
    sun.position.set(Math.cos(a) * 5, 1 + Math.sin(a) * 5 * (1 - night * 0.7), 3);
    sun.color.set(new THREE.Color('#fff4e5').lerp(new THREE.Color('#ffb36b'), Math.abs(t - 0.45) * 1.4).lerp(new THREE.Color('#7f93c9'), night));
    sun.intensity = 2.2 * (1 - night * 0.85);
    hemi.intensity = 0.9 * (1 - night * 0.65);
    this.scene.environmentIntensity = 0.55 * (1 - night * 0.6);
    for (const root of this.objects.values()) root.traverse(o => {
      if (o.isPointLight) o.intensity = 0.6 + night * 2.4;
      if (o.material?.emissiveIntensity != null && o.material.emissive?.getHex() === 0xffd9a0) o.material.emissiveIntensity = 0.35 + night * 1.2;
    });
  }

  snapshot() {
    const s = this.selected;
    if (s) setSelected(s, false);
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/jpeg', 0.9);
    if (s) setSelected(s, true);
    return url;
  }

  // ---------- pointer: select, drag on the floor, two-finger twist ----------
  bindPointer() {
    const el = this.canvas;
    // removed in dispose(): the canvas is reused by the next planner
    this.listeners = new AbortController();
    const o = { signal: this.listeners.signal };
    el.addEventListener('pointerdown', e => this.down(e), o);
    el.addEventListener('pointermove', e => this.move(e), o);
    el.addEventListener('pointerup', e => this.up(e), o);
    el.addEventListener('pointercancel', e => this.up(e), o);
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') this.up(e); }, o);
  }
  ray(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster;
  }
  hitItem(e) {
    const rc = this.ray(e);
    const models = [...this.objects.values()].map(r => r.userData.model);
    const hits = rc.intersectObjects(models, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.pid) o = o.parent;
    return o || null;
  }
  floorPoint(e, y = 0) {
    const rc = this.ray(e);
    this.floorPlane.constant = -y;
    const p = new THREE.Vector3();
    return rc.ray.intersectPlane(this.floorPlane, p) ? p : null;
  }
  down(e) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2 && this.selected) {
      const [a, b] = [...this.pointers.values()];
      this.twist = { angle: Math.atan2(b.y - a.y, b.x - a.x), rot: this.selected.rotation.y };
      this.drag = null;
      this.controls.enabled = false;
      return;
    }
    if (this.pointers.size > 1) return;
    const hit = this.hitItem(e);
    this.downAt = { x: e.clientX, y: e.clientY, hit, t: performance.now() };
    if (hit) {
      this.select(hit);
      const fp = this.floorPoint(e, hit.userData.wall ? hit.position.y : 0);
      if (fp) {
        this.drag = { root: hit, offset: hit.position.clone().sub(fp), moved: false };
        this.controls.enabled = false;
        this.canvas.setPointerCapture?.(e.pointerId);
      }
    }
  }
  move(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.twist && this.pointers.size === 2 && this.selected) {
      const [a, b] = [...this.pointers.values()];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      this.selected.rotation.y = this.twist.rot - (ang - this.twist.angle);
      return;
    }
    if (!this.drag) {
      if (e.pointerType === 'mouse' && !e.buttons) this.canvas.style.cursor = this.hitItem(e) ? 'grab' : '';
      return;
    }
    const { root, offset } = this.drag;
    const fp = this.floorPoint(e, root.userData.wall ? root.position.y : 0);
    if (!fp) return;
    this.canvas.style.cursor = 'grabbing';
    this.drag.moved = true;
    const next = fp.add(offset);
    if (root.userData.wall && this.walls) this.snapToWall(root, next);
    else { root.position.x = next.x; root.position.z = next.z; this.clampToRoom(root); }
    this.placePerson();
    this.checkConflicts();
  }
  up(e) {
    this.pointers.delete(e.pointerId);
    if (this.twist) {
      if (this.pointers.size < 2) { this.twist = null; this.controls.enabled = true; this.clampToRoom(this.selected); this.checkConflicts(); this.onChange(); }
      return;
    }
    const d = this.downAt;
    if (d && !d.hit && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && performance.now() - d.t < 400) this.select(null);
    if (this.drag) { if (this.drag.moved) this.onChange(); this.drag = null; }
    this.downAt = null;
    this.controls.enabled = true;
    this.canvas.style.cursor = '';
  }

  /** Wall items slide along the nearest wall, facing into the room. */
  snapToWall(root, p) {
    const { w, l } = this.room;
    const d = [
      { name: 'back', dist: Math.abs(p.z + l / 2) },
      { name: 'front', dist: Math.abs(p.z - l / 2) },
      { name: 'left', dist: Math.abs(p.x + w / 2) },
      { name: 'right', dist: Math.abs(p.x - w / 2) },
    ].sort((a, b) => a.dist - b.dist)[0].name;
    const half = M(root.userData.item.dims.w) / 2;
    const cx = THREE.MathUtils.clamp(p.x, -w / 2 + half, w / 2 - half);
    const cz = THREE.MathUtils.clamp(p.z, -l / 2 + half, l / 2 - half);
    if (d === 'back') { root.position.set(cx, root.position.y, -l / 2); root.rotation.y = 0; }
    if (d === 'front') { root.position.set(cx, root.position.y, l / 2); root.rotation.y = Math.PI; }
    if (d === 'left') { root.position.set(-w / 2, root.position.y, cz); root.rotation.y = Math.PI / 2; }
    if (d === 'right') { root.position.set(w / 2, root.position.y, cz); root.rotation.y = -Math.PI / 2; }
  }
}

function makePerson() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.8, transparent: true, opacity: 0.85 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.62, 6, 16), mat);
  body.position.y = 1.0; body.scale.z = 0.62;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 16), mat);
  head.position.y = 1.64;
  const legsG = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.62, 4, 12), mat);
  for (const s of [-1, 1]) { const l = legsG.clone(); l.position.set(s * 0.085, 0.38, 0); g.add(l); }
  g.add(body, head);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.helper = true;
  return g;
}
