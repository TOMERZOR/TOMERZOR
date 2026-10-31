// Augmented reality: places items in the real room at their real size.
//  - Android (Chrome): WebXR with hit-testing on the floor and walls, drag to move, two-finger twist,
//    a tape measure, live overlap warnings and the room's own light (when the phone reports it).
//  - iPhone / iPad: AR Quick Look with a USDZ file built on the device (real scale locked).
import * as THREE from 'three';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { XREstimatedLight } from 'three/addons/webxr/XREstimatedLight.js';
import { createItemObject, setSelected, footprint, polygonsOverlap, isSolid, labelSprite, setLabel, ACCENT, defaultY, disposeItemObject } from './scene-kit.js';
import { CATEGORIES } from './catalog.js';
import { icon } from './icons.js';
import { len } from './units.js';

const M = v => v / 100;

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let supportP = null;
/** 'webxr' | 'quicklook' | null */
/** Inside the iPhone app (livingroom-ios), AR Quick Look is opened by a native plugin. */
const nativeIOS = () => Boolean(window.Capacitor?.isNativePlatform?.()) && window.Capacitor.getPlatform?.() === 'ios';
function nativeAR(method, options) {
  const C = window.Capacitor;
  const plugin = C.Plugins?.ARQuickLook;
  return plugin?.[method] ? plugin[method](options) : C.nativePromise('ARQuickLook', method, options);
}

export function arSupport() {
  supportP ||= (async () => {
    if (nativeIOS()) {
      try { return (await nativeAR('isAvailable', {})).available ? 'quicklook' : null; } catch { return 'quicklook'; }
    }
    try { if (navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')) return 'webxr'; } catch { /* not available */ }
    if (isIOS() && document.createElement('a').relList.supports('ar')) return 'quicklook';
    return null;
  })();
  return supportP;
}

// ---------- iPhone: AR Quick Look ----------
function stripHelpers(obj) {
  const drop = [];
  obj.traverse(o => { if (o.userData.helper || o.isLight || o.isSprite || o.isLine) drop.push(o); });
  drop.forEach(o => o.parent?.remove(o));
  return obj;
}

/** Builds a USDZ of the given items (with their placements) and opens it in AR Quick Look. */
export async function openQuickLook(entries) {
  const scene = new THREE.Scene();
  const allWall = entries.every(e => CATEGORIES[e.item.category]?.mount === 'wall');
  // place everything relative to the group's centre so it appears in front of the viewer
  const pts = entries.map(e => e.placement || { x: 0, z: 0 });
  const cx = pts.reduce((s, p) => s + (p.x || 0), 0) / pts.length;
  const cz = pts.reduce((s, p) => s + (p.z || 0), 0) / pts.length;
  for (const { item, placement } of entries) {
    const root = await createItemObject(item);
    const model = stripHelpers(root.userData.model);
    const holder = new THREE.Group();
    holder.add(model);
    holder.position.set((placement?.x || 0) - cx, allWall ? 0 : (placement?.y ?? defaultY(item)), (placement?.z || 0) - cz);
    holder.rotation.y = placement?.rot || 0;
    scene.add(holder);
  }
  const exporter = new USDZExporter();
  const data = await exporter.parseAsync(scene, {
    quickLookCompatible: true,
    maxTextureSize: 1024,
    ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: allWall ? 'vertical' : 'horizontal' } },
  });
  if (nativeIOS()) {
    let bin = '';
    for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
    await nativeAR('present', { data: btoa(bin) });
    return;
  }
  const blob = new Blob([data], { type: 'model/vnd.usdz+zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('rel', 'ar');
  // real size only: the viewer can't pinch-scale the item
  a.href = `${url}#allowsContentScaling=0`;
  a.appendChild(document.createElement('img'));
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60000);
}

// ---------- Android: WebXR ----------
function makeReticle() {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthTest: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.085, 0.1, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.014, 24), new THREE.MeshBasicMaterial({ color: ACCENT, depthTest: false }));
  dot.rotation.x = -Math.PI / 2;
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthTest: false }));
  halo.rotation.x = -Math.PI / 2;
  g.add(halo, ring, dot);
  g.traverse(o => { o.renderOrder = 20; });
  g.matrixAutoUpdate = false;
  g.visible = false;
  g.userData = { ring, halo };
  return g;
}

const HINTS = {
  scanning: 'הזיזו את הטלפון לאט, מכוונים לרצפה',
  floor: 'כוונו למקום וגעו ב״הנח כאן״',
  wall: 'כוונו לקיר וגעו ב״הנח כאן״',
  needWall: 'כוונו את הטלפון לקיר',
  placed: 'גררו להזזה, סובבו בשתי אצבעות',
  measure: 'כוונו לנקודה הראשונה וגעו ב״+״',
  measure2: 'כוונו לנקודה השנייה וגעו ב״+״',
  overlap: 'שני פריטים חופפים',
};

export class ARView {
  /**
   * entries: [{ item, placement? }]. With placements (a saved room) everything is placed together,
   * keeping its layout; otherwise items wait in a tray and are placed one at a time.
   */
  constructor({ overlay, entries, asGroup = false, onExit }) {
    this.overlay = overlay;
    this.entries = entries;
    this.asGroup = asGroup;
    this.onExit = onExit || (() => {});
    this.placed = [];
    this.pending = null;
    this.selected = null;
    this.floorY = null;
    this.mode = 'place';
    this.measure = { points: [], objects: [] };
    this.tmp = { m: new THREE.Matrix4(), v: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
  }

  async start() {
    const overlay = this.overlay;
    this.buildOverlay();
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'light-estimation', 'local-floor'],
      domOverlay: { root: overlay },
    });
    this.session = session;
    overlay.hidden = false;
    document.documentElement.classList.add('in-ar');

    const canvas = document.createElement('canvas');
    const renderer = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);

    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera();
    const hemi = new THREE.HemisphereLight('#ffffff', '#a39b8e', 1.1);
    const sun = this.sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.1, far: 12 });
    sun.shadow.bias = -0.0005;
    scene.add(hemi, sun, sun.target);
    this.defaultLights = [hemi];

    // the room's light, when the phone shares it
    const xrLight = new XREstimatedLight(renderer);
    xrLight.addEventListener('estimationstart', () => {
      scene.add(xrLight);
      scene.remove(hemi);
      if (xrLight.environment) scene.environment = xrLight.environment;
    });
    xrLight.addEventListener('estimationend', () => { scene.remove(xrLight); scene.add(hemi); scene.environment = null; });

    // catches the items' shadows on the real floor
    const catcher = this.catcher = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.28 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.receiveShadow = true;
    catcher.visible = false;
    scene.add(catcher);

    this.reticle = makeReticle();
    scene.add(this.reticle);

    this.refSpace = renderer.xr.getReferenceSpace();
    const viewer = await session.requestReferenceSpace('viewer');
    this.hitSource = await session.requestHitTestSource({ space: viewer, entityTypes: ['plane', 'point'] }).catch(() => session.requestHitTestSource({ space: viewer }));

    session.addEventListener('selectstart', e => this.onSelectStart(e));
    session.addEventListener('selectend', e => this.onSelectEnd(e));
    session.addEventListener('end', () => this.cleanup());

    await this.loadNextPending();
    this.setHint('scanning');
    renderer.setAnimationLoop((t, frame) => this.frame(t, frame));
  }

  // ---------- overlay UI ----------
  buildOverlay() {
    const o = this.overlay;
    const tray = this.asGroup ? '' : this.entries.map((e, i) => `<button class="ar-chip" data-i="${i}" type="button"><span>${escape(e.item.name)}</span></button>`).join('');
    o.innerHTML = `
      <div class="ar-top">
        <button class="ar-btn glass" data-act="exit" type="button" aria-label="יציאה">${icon('x')}</button>
        <div class="ar-hint glass" role="status" aria-live="polite"><span class="ar-hint-text"></span></div>
        <button class="ar-btn glass" data-act="dims" type="button" aria-label="מידות" aria-pressed="false">${icon('arrows-horizontal')}</button>
      </div>
      <div class="ar-scan" aria-hidden="true"><div class="ar-phone">${icon('scan')}</div></div>
      <div class="ar-live glass" hidden></div>
      <div class="ar-bottom">
        <div class="ar-selected glass" hidden>
          <button type="button" data-act="rotl" aria-label="סיבוב שמאלה">${icon('arrow-counter-clockwise')}</button>
          <button type="button" data-act="rotr" aria-label="סיבוב ימינה">${icon('arrows-clockwise')}</button>
          <button type="button" data-act="move" aria-label="הזזה">${icon('arrows-out-cardinal')}</button>
          <button type="button" data-act="remove" aria-label="הסרה">${icon('trash')}</button>
        </div>
        ${tray ? `<div class="ar-tray">${tray}</div>` : ''}
        <div class="ar-main">
          <button class="ar-btn glass" data-act="measure" type="button" aria-label="סרגל מדידה" aria-pressed="false">${icon('ruler')}<span>מדידה</span></button>
          <button class="ar-place" data-act="place" type="button" disabled><span class="ar-place-label">הנח כאן</span></button>
          <button class="ar-btn glass" data-act="done" type="button" aria-label="סיום">${icon('check')}<span>סיום</span></button>
        </div>
      </div>`;
    // taps on the controls must not also count as taps in the 3D scene
    for (const el of o.querySelectorAll('button, .ar-tray, .ar-selected, .ar-hint')) el.addEventListener('beforexrselect', e => e.preventDefault());
    o.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.i != null) { this.pickFromTray(+b.dataset.i); return; }
      this.action(b.dataset.act);
    });
    // two-finger twist rotates the selected (or waiting) item
    let twist = null;
    o.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        const target = this.pending || this.selected;
        if (!target) return;
        twist = { a: angle(e.touches), rot: target.rotation.y, target };
      }
    }, { passive: true });
    o.addEventListener('touchmove', e => {
      if (twist && e.touches.length === 2) {
        twist.target.rotation.y = twist.rot - (angle(e.touches) - twist.a);
        this.dragging = null;
      }
    }, { passive: true });
    o.addEventListener('touchend', e => { if (e.touches.length < 2 && twist) { twist = null; this.checkOverlaps(); } }, { passive: true });
    this.ui = {
      hint: o.querySelector('.ar-hint-text'),
      scan: o.querySelector('.ar-scan'),
      place: o.querySelector('[data-act="place"]'),
      placeLabel: o.querySelector('.ar-place-label'),
      selected: o.querySelector('.ar-selected'),
      live: o.querySelector('.ar-live'),
      tray: o.querySelector('.ar-tray'),
      measureBtn: o.querySelector('[data-act="measure"]'),
      dimsBtn: o.querySelector('[data-act="dims"]'),
    };
    this.updateTray();
  }

  setHint(key, text) {
    if (this.hintKey === key && !text) return;
    this.hintKey = key;
    const el = this.ui.hint;
    el.parentElement.classList.remove('show');
    void el.offsetWidth;
    el.textContent = text || HINTS[key] || '';
    el.parentElement.classList.add('show');
    this.ui.scan.classList.toggle('on', key === 'scanning');
  }

  updateTray() {
    if (!this.ui?.tray) return;
    this.ui.tray.querySelectorAll('.ar-chip').forEach((b, i) => {
      b.classList.toggle('active', this.pendingIndex === i);
      b.classList.toggle('used', this.placed.some(p => p.userData.entryIndex === i));
    });
  }

  action(act) {
    const s = this.selected;
    switch (act) {
      case 'exit': case 'done': this.end(); break;
      case 'place': this.mode === 'measure' ? this.addMeasurePoint() : this.placePending(); break;
      case 'rotl': if (s) { s.rotation.y += Math.PI / 12; this.checkOverlaps(); } break;
      case 'rotr': if (s) { s.rotation.y -= Math.PI / 12; this.checkOverlaps(); } break;
      case 'move': if (s) this.pickUp(s); break;
      case 'remove': if (s) this.removeSelected(); break;
      case 'measure': this.toggleMeasure(); break;
      case 'dims': {
        this.showDims = !this.showDims;
        this.ui.dimsBtn.setAttribute('aria-pressed', String(this.showDims));
        for (const r of [...this.placed, this.pending].filter(Boolean)) r.userData.dims.visible = this.showDims || r === this.selected || r === this.pending;
        break;
      }
    }
    navigator.vibrate?.(8);
  }

  // ---------- placing ----------
  async loadNextPending(index) {
    if (this.asGroup) {
      if (this.placed.length) { this.setPending(null); return; }
      const group = new THREE.Group();
      const pts = this.entries.map(e => e.placement || { x: 0, z: 0 });
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
      for (const e of this.entries) {
        const r = await createItemObject(e.item);
        r.position.set((e.placement?.x || 0) - cx, e.placement?.y ?? defaultY(e.item), (e.placement?.z || 0) - cz);
        r.rotation.y = e.placement?.rot || 0;
        group.add(r);
      }
      group.userData = { isGroup: true, item: { name: 'החדר', category: 'object' }, dims: { visible: false } };
      this.setPending(group);
      return;
    }
    const i = index ?? this.entries.findIndex((_, k) => !this.placed.some(p => p.userData.entryIndex === k));
    if (i < 0) { this.setPending(null); return; }
    const root = await createItemObject(this.entries[i].item);
    root.userData.entryIndex = i;
    this.pendingIndex = i;
    this.setPending(root);
  }

  setPending(root) {
    if (this.pending) { this.scene.remove(this.pending); if (!this.placed.includes(this.pending)) disposeItemObject(this.pending); }
    this.pending = root;
    if (root) {
      root.visible = false;
      root.traverse(o => { if (o.isMesh) o.castShadow = true; });
      if (root.userData.dims) root.userData.dims.visible = true;
      this.scene.add(root);
    } else this.pendingIndex = null;
    this.ui.placeLabel.textContent = root ? 'הנח כאן' : 'הכול במקום';
    this.updateTray();
  }

  async pickFromTray(i) {
    if (this.pending && this.pendingIndex === i) return;
    const existing = this.placed.find(p => p.userData.entryIndex === i);
    if (existing) { this.select(existing); return; }
    await this.loadNextPending(i);
  }

  placePending() {
    const root = this.pending;
    if (!root || !this.lastHit || (this.isWall(root) && this.lastHit.kind !== 'wall')) return;
    this.pending = null;
    this.placed.push(root);
    root.userData.dims.visible = !!this.showDims;
    if (this.floorY == null && this.lastHit.kind === 'floor') this.setFloor(this.lastHit.position.y);
    // a short settle: drops 6cm into place
    const y = root.position.y;
    const t0 = performance.now();
    const anim = () => {
      const k = Math.min(1, (performance.now() - t0) / 380);
      const e = 1 - Math.pow(1 - k, 3);
      root.position.y = y + 0.06 * (1 - e);
      if (k < 1) requestAnimationFrame(anim);
    };
    root.position.y = y + 0.06;
    anim();
    navigator.vibrate?.([12, 40, 18]);
    this.select(root);
    this.setHint('placed');
    this.checkOverlaps();
    this.loadNextPending();
  }

  pickUp(root) {
    this.select(null);
    this.placed = this.placed.filter(p => p !== root);
    if (this.pending) { this.scene.remove(this.pending); disposeItemObject(this.pending); }
    this.pending = root;
    this.pendingIndex = root.userData.entryIndex ?? null;
    root.userData.dims.visible = true;
    this.ui.placeLabel.textContent = 'הנח כאן';
    this.updateTray();
  }

  removeSelected() {
    const s = this.selected;
    this.select(null);
    this.placed = this.placed.filter(p => p !== s);
    this.scene.remove(s);
    disposeItemObject(s);
    this.checkOverlaps();
    if (!this.pending) this.loadNextPending();
    this.updateTray();
  }

  select(root) {
    const flat = r => (r?.userData.isGroup ? r.children : r ? [r] : []);
    for (const r of flat(this.selected)) { setSelected(r, false); if (r.userData.dims) r.userData.dims.visible = !!this.showDims; }
    this.selected = root;
    for (const r of flat(root)) { setSelected(r, true); if (r.userData.dims) r.userData.dims.visible = true; }
    this.ui.selected.hidden = !root;
  }

  isWall(root) { return !root.userData.isGroup && CATEGORIES[root.userData.item.category]?.mount === 'wall'; }

  setFloor(y) {
    this.floorY = y;
    this.catcher.position.y = y + 0.001;
    this.catcher.visible = true;
  }

  checkOverlaps() {
    const roots = this.placed.flatMap(r => (r.userData.isGroup ? r.children : [r])).filter(isSolid);
    const fps = roots.map(footprint);
    const bad = new Set();
    for (let i = 0; i < roots.length; i++) for (let j = i + 1; j < roots.length; j++) if (polygonsOverlap(fps[i], fps[j], 0.02)) { bad.add(roots[i]); bad.add(roots[j]); }
    for (const r of roots) {
      r.userData.ring.material.color.set(bad.has(r) ? '#E5484D' : ACCENT);
      r.userData.ring.visible = bad.has(r) || r === this.selected;
    }
    if (bad.size) this.setHint('overlap');
    else if (this.hintKey === 'overlap') this.setHint('placed');
  }

  // ---------- tape measure ----------
  toggleMeasure() {
    this.mode = this.mode === 'measure' ? 'place' : 'measure';
    const on = this.mode === 'measure';
    this.ui.measureBtn.setAttribute('aria-pressed', String(on));
    this.overlay.classList.toggle('measuring', on);
    this.ui.placeLabel.textContent = on ? '+' : this.pending ? 'הנח כאן' : 'הכול במקום';
    if (this.pending) this.pending.visible = !on;
    if (on) { this.measure.points = []; this.setHint('measure'); }
    else { this.clearMeasure(); this.ui.live.hidden = true; this.setHint(this.placed.length ? 'placed' : 'floor'); }
  }

  addMeasurePoint() {
    if (!this.lastHit) return;
    const p = this.lastHit.position.clone();
    const m = this.measure;
    if (m.points.length >= 2) { this.clearMeasure(); }
    m.points.push(p);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), new THREE.MeshBasicMaterial({ color: ACCENT, depthTest: false }));
    dot.position.copy(p); dot.renderOrder = 21;
    this.scene.add(dot); m.objects.push(dot);
    if (m.points.length === 1) {
      const geo = new THREE.BufferGeometry().setFromPoints([p, p.clone()]);
      m.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffffff', depthTest: false }));
      m.line.renderOrder = 21;
      m.label = labelSprite('0', 0.05);
      this.scene.add(m.line, m.label);
      m.objects.push(m.line, m.label);
      this.setHint('measure2');
    } else {
      this.updateMeasure(p, true);
      navigator.vibrate?.(20);
      this.setHint('measure', `${len(m.points[0].distanceTo(p) * 100)} · געו ב״+״ למדידה חדשה`);
    }
  }

  updateMeasure(to, final = false) {
    const m = this.measure;
    if (m.points.length !== 1 && !final) return;
    const a = m.points[0];
    const pos = m.line.geometry.attributes.position;
    pos.setXYZ(1, to.x, to.y, to.z); pos.needsUpdate = true;
    const d = a.distanceTo(to) * 100;
    setLabel(m.label, len(d), {});
    m.label.position.copy(a).add(to).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.04, 0));
    this.ui.live.hidden = false;
    this.ui.live.textContent = len(d);
  }

  clearMeasure() {
    for (const o of this.measure.objects) { this.scene.remove(o); o.geometry?.dispose(); o.material?.dispose(); }
    this.measure = { points: [], objects: [] };
  }

  // ---------- touches in the scene ----------
  inputRay(source, frame) {
    const pose = frame.getPose(source.targetRaySpace, this.refSpace);
    if (!pose) return null;
    const m = this.tmp.m.fromArray(pose.transform.matrix);
    const origin = new THREE.Vector3().setFromMatrixPosition(m);
    const dir = new THREE.Vector3(0, 0, -1).transformDirection(m);
    return new THREE.Ray(origin, dir);
  }

  onSelectStart(e) {
    this.pendingSelect = e.inputSource;
  }
  onSelectEnd() {
    this.dragging = null;
    this.pendingSelect = null;
    this.checkOverlaps();
  }

  handleSelectStart(source, frame) {
    const ray = this.inputRay(source, frame);
    if (!ray) return;
    const rc = new THREE.Raycaster(ray.origin, ray.direction);
    const targets = this.placed.map(r => (r.userData.isGroup ? r : r.userData.model));
    const hit = rc.intersectObjects(targets, true)[0];
    if (hit) {
      let o = hit.object;
      while (o && !this.placed.includes(o)) o = o.parent;
      if (o) {
        this.select(o);
        if (!this.isWall(o) && this.floorY != null) {
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.floorY);
          const p = ray.intersectPlane(plane, new THREE.Vector3());
          if (p) this.dragging = { root: o, source, offset: o.position.clone().sub(p).setY(0) };
        }
        return;
      }
    }
    // without the on-screen controls (no DOM overlay), a tap places the waiting item
    if (!this.session.domOverlayState && this.pending) this.placePending();
    else if (this.selected && !this.pending) this.select(null);
  }

  // ---------- frame ----------
  frame(t, frame) {
    if (!frame) return;
    if (this.pendingSelect) { this.handleSelectStart(this.pendingSelect, frame); this.pendingSelect = null; }
    const hits = frame.getHitTestResults(this.hitSource);
    const r = this.reticle;
    this.lastHit = null;
    if (hits.length) {
      const pose = hits[0].getPose(this.refSpace);
      const m = this.tmp.m.fromArray(pose.transform.matrix);
      const normal = new THREE.Vector3(0, 1, 0).transformDirection(m);
      const position = new THREE.Vector3().setFromMatrixPosition(m);
      const kind = normal.y > 0.7 ? 'floor' : Math.abs(normal.y) < 0.35 ? 'wall' : 'other';
      this.lastHit = { position, normal, kind };
      r.visible = true;
      // the ring lies flat on the surface it found
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      r.matrix.compose(position, q, new THREE.Vector3(1, 1, 1));
      const pulse = 1 + 0.08 * Math.sin(t / 240);
      r.userData.halo.scale.setScalar(pulse);
    } else r.visible = false;

    const p = this.pending;
    if (p && this.mode !== 'measure') {
      const wantsWall = this.isWall(p);
      const h = this.lastHit;
      const ok = h && (wantsWall ? h.kind === 'wall' : h.kind === 'floor');
      p.visible = !!ok;
      this.ui.place.disabled = !ok;
      if (ok) {
        if (wantsWall) {
          const n = h.normal.clone().setY(0).normalize();
          const rot = Math.atan2(n.x, n.z);
          const target = h.position.clone().add(new THREE.Vector3(0, -M(p.userData.item.dims.h) / 2, 0));
          p.position.lerp(target, p.userData.seen ? 0.35 : 1);
          p.rotation.y = rot;
        } else {
          const target = h.position.clone();
          if (this.floorY != null && Math.abs(target.y - this.floorY) < 0.15) target.y = this.floorY;
          p.position.lerp(target, p.userData.seen ? 0.35 : 1);
        }
        p.userData.seen = true;
        if (this.hintKey === 'scanning' || this.hintKey === 'needWall' || (this.hintKey === 'floor' && wantsWall) || (this.hintKey === 'wall' && !wantsWall)) this.setHint(wantsWall ? 'wall' : 'floor');
      } else if (h && wantsWall && this.hintKey !== 'needWall' && this.hintKey !== 'scanning') this.setHint('needWall');
      r.visible = r.visible && !ok;
    } else if (this.mode === 'measure') {
      this.ui.place.disabled = !this.lastHit;
      if (this.lastHit && this.measure.points.length === 1) this.updateMeasure(this.lastHit.position);
    } else this.ui.place.disabled = true;

    if (this.dragging) {
      const ray = this.inputRay(this.dragging.source, frame);
      if (ray) {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.floorY);
        const pt = ray.intersectPlane(plane, new THREE.Vector3());
        if (pt) { const d = this.dragging.root; d.position.x = pt.x + this.dragging.offset.x; d.position.z = pt.z + this.dragging.offset.z; }
      }
    }
    if (this.selected?.userData.ring) this.selected.userData.ring.material.opacity = 0.7 + 0.3 * Math.sin(t / 260);

    // keep the shadow light above whatever is being looked at
    const focus = this.selected || this.pending || this.placed[0];
    if (focus) {
      const fp = focus.getWorldPosition(this.tmp.v);
      this.sun.position.set(fp.x + 1.2, fp.y + 3, fp.z + 0.8);
      this.sun.target.position.copy(fp);
    }
    this.renderer.render(this.scene, this.camera);
  }

  end() { this.session?.end().catch(() => this.cleanup()); }

  cleanup() {
    if (this.cleaned) return;
    this.cleaned = true;
    this.renderer?.setAnimationLoop(null);
    for (const r of this.placed) disposeItemObject(r);
    if (this.pending) disposeItemObject(this.pending);
    this.renderer?.dispose();
    this.overlay.hidden = true;
    this.overlay.innerHTML = '';
    this.overlay.classList.remove('measuring');
    document.documentElement.classList.remove('in-ar');
    this.onExit();
  }
}

function angle(touches) { return Math.atan2(touches[1].clientY - touches[0].clientY, touches[1].clientX - touches[0].clientX); }
function escape(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
