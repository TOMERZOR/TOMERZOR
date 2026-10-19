// Loads the 3D models and textures generated with Higgsfield before the game starts.
// Anything that fails to load is skipped and the game falls back to simple shapes.
const Assets = {
  models: {},
  anims: {},
  images: {},
  MODELS: ['launcher', 'tower', 'truck', 'container', 'pickup', 'palm', 'soldier', 'radar', 'generator', 'burger', 'cranetruck'],
  IMAGES: ['sand', 'wall', 'asphalt', 'grass', 'shekem', 'bibi', 'babasali'],

  load(onProgress = () => {}) {
    const total = this.MODELS.length + this.IMAGES.length;
    let done = 0;
    const tick = () => onProgress(++done / total);
    const loader = THREE.GLTFLoader ? new THREE.GLTFLoader() : null;
    const models = this.MODELS.map(name => new Promise(resolve => {
      if (!loader) return resolve();
      loader.load(`assets/models/${name}.json`, (g) => {
        // glTF defaults to fully metallic, which renders near-black without an environment map.
        g.scene.traverse(o => { if (o.isMesh) { o.material.metalness = 0; o.material.roughness = 0.85; } });
        this.models[name] = g.scene;
        this.anims[name] = g.animations || [];
        if (name === 'soldier') this.prepareSoldier(g.scene, g.animations || []);
        tick();
        resolve();
      }, undefined, () => { tick(); resolve(); });
    }));
    const images = this.IMAGES.map(name => new Promise(resolve => {
      const img = new Image();
      img.onload = () => { this.images[name] = img; tick(); resolve(); };
      img.onerror = () => { tick(); resolve(); };
      img.src = `assets/tex/${name}.jpg`;
    }));
    const anims = fetch('assets/models/anims.json').then(r => (r.ok ? r.json() : null)).then(a => { this.animLib = a; }).catch(() => {});
    const timeout = new Promise(resolve => setTimeout(resolve, 25000));
    return Promise.race([Promise.all([...models, ...images, anims]), timeout]);
  },

  has(name) { return !!this.models[name]; },

  // The rigged soldier: measure it once, and pin the walk cycle in place
  // (the clip moves the hips forward; the game moves the character itself).
  prepareSoldier(scene, clips) {
    this.soldierFit = this.measure(scene, 1.75);
    this.walkClip = clips[0] || null;
    if (!this.walkClip) return;
    for (const tr of this.walkClip.tracks) {
      if (!tr.name.endsWith('.position')) continue;
      const v = tr.values;
      for (let i = 0; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
    }
    // Standing pose: the frame of the walk where the feet are closest together.
    const mixer = new THREE.AnimationMixer(scene);
    const action = mixer.clipAction(this.walkClip);
    action.play();
    const feet = [this.bone(scene, [/^leftfoot$/i]), this.bone(scene, [/^rightfoot$/i])];
    // The stride passes a feet-together pose twice per cycle; find both, so a soldier who
    // stops can finish the step they are in instead of snapping.
    this.idleTime = 0;
    this.idleTimes = [0];
    if (feet[0] && feet[1]) {
      const best = [Infinity, Infinity], at = [0, 0];
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      const D = this.walkClip.duration;
      for (let i = 0; i < 60; i++) {
        const t = D * i / 60;
        action.time = t;
        mixer.update(0);
        scene.updateMatrixWorld(true);
        const d = feet[0].getWorldPosition(a).distanceTo(feet[1].getWorldPosition(b));
        const h = t < D / 2 ? 0 : 1;
        if (d < best[h]) { best[h] = d; at[h] = t; }
      }
      this.idleTime = best[0] <= best[1] ? at[0] : at[1];
      this.idleTimes = at;
    }
    action.time = this.idleTime;
    mixer.update(0);
    // The standing pose per bone: running exaggerates the walk relative to it.
    this.idlePose = {};
    scene.traverse(o => { if (o.isBone) this.idlePose[o.name] = o.quaternion.clone(); });
    mixer.stopAllAction();
  },

  // Measure the skinned geometry itself: the armature's centimetre scale is undone by
  // the bind matrices, so a world-space box of the scene would be 100x too small.
  measure(scene, height) {
    let geo = null, hips = null;
    scene.traverse(o => { if (o.isSkinnedMesh && !geo) geo = o.geometry; if (o.isBone && o.name === 'Hips' && !hips) hips = o; });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    return { scale: height / (bb.max.y - bb.min.y), minY: bb.min.y, hipsY: hips ? hips.position.y : 0 };
  },

  // ---------- the platoon's own characters ----------
  // Each real cast member has a rigged model of their own, encrypted like their name
  // (tools/encrypt-roster.js). They load in the background once the roster is unlocked;
  // until then (or without the key) everyone uses the shared soldier.
  people: {},
  peopleErr: {},
  loadPeople() {
    const ids = Object.keys(ROSTER.models || {});
    if (!ids.length || !Lobby.cryptoKey || !window.DecompressionStream || !THREE.GLTFLoader || !this.walkClip) return Promise.resolve();
    const loader = new THREE.GLTFLoader();
    // Whoever you'd see first goes next: the local player, then whoever is on this site,
    // nearest first. Asked again before every model, since loading starts on the title screen
    // and a slow phone is still at it when the game begins.
    const rank = (id) => {
      if (G.profile && G.profile.as === id) return -1;
      const n = G.npcs && G.player && G.npcs.find(n => n.id === id);
      return n ? Math.hypot(n.x - G.player.x, n.y - G.player.y) : 1e9;
    };
    const failed = [];
    const next = (left, retry) => {
      if (!left.length) return Promise.resolve();
      left.sort((a, b) => rank(a) - rank(b));
      const id = left.shift();
      return this.loadPerson(loader, id)
        .then(() => { delete this.peopleErr[id]; })
        .catch((e) => { this.peopleErr[id] = String((e && e.message) || e); if (!retry) failed.push(id); console.warn('person model', id, e); })
        .then(() => next(left, retry));
    };
    // A model that failed (a dropped connection, usually) gets one more try at the end.
    return next(ids.slice(), false).then(() => failed.length && new Promise(r => setTimeout(r, 2000)).then(() => next(failed, true)));
  },
  // For the menu: how many of the cast's own models are in, and which failed.
  peopleStatus() {
    const all = Object.keys(ROSTER.models || {});
    if (!all.length || !Lobby.cryptoKey) return '';
    const bad = Object.keys(this.peopleErr).map(id => (Cast.get(id) || {}).short || id);
    return `👥 דמויות: ${all.filter(id => this.people[id]).length}/${all.length}` + (bad.length ? ` · לא נטענו: ${bad.join(', ')}` : '');
  },
  async loadPerson(loader, id) {
    const file = String(ROSTER.models[id]).replace(/[^a-f0-9]/g, '');
    const res = await fetch(`assets/people/${file}.bin`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = new Uint8Array(await res.arrayBuffer());
    const zipped = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, Lobby.cryptoKey, buf.slice(12));
    const glb = await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    await this.addPerson(loader, id, glb);
  },
  // Made-up characters (the curious civilians) have plain public models, loaded when needed.
  publicPeople: { cur_shmulik: 'assets/models/cur_shmulik.json', cur_ortal: 'assets/models/cur_ortal.json', cur_victor: 'assets/models/cur_victor.json' },
  loadPublicPerson(id) {
    if (this.people[id] || !this.publicPeople[id] || !this.walkClip) return Promise.resolve();
    this.publicLoading = this.publicLoading || {};
    if (!this.publicLoading[id]) {
      this.publicLoading[id] = fetch(this.publicPeople[id])
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(gltf => this.addPerson(new THREE.GLTFLoader(), id, gltf, 'assets/models/'))
        .catch(e => { console.warn('public model', id, e); delete this.publicLoading[id]; });
    }
    return this.publicLoading[id];
  },
  // glb: a binary .glb, or a .json glTF whose textures sit next to it in `path`.
  async addPerson(loader, id, glb, path = '') {
    const g = await new Promise((ok, no) => loader.parse(glb, path, ok, no));
    g.scene.traverse(o => { if (o.isMesh) { o.material.metalness = 0; o.material.roughness = 0.85; } });
    const person = Cast.get(id) || {};
    const fit = this.measure(g.scene, person.female ? 1.68 : 1.76);
    // The shared walk cycle, with the hips at this skeleton's own height.
    const walk = this.walkClip.clone();
    for (const tr of walk.tracks) {
      if (tr.name !== 'Hips.position') continue;
      const dy = fit.hipsY - this.soldierFit.hipsY;
      for (let i = 1; i < tr.values.length; i += 3) tr.values[i] += dy;
    }
    this.people[id] = { scene: g.scene, fit, walk };
    if (typeof Scene3D !== 'undefined' && Scene3D.personReady) Scene3D.personReady(id);
  },
  // Cutscene art of the real cast, encrypted the same way (ROSTER.scenes). Small, so it all
  // loads up front; until it's in (or without the key) the slide just has no picture.
  scenes: {},
  loadScenes() {
    const all = ROSTER.scenes || {};
    if (!Lobby.cryptoKey) return Promise.resolve();
    return Promise.all(Object.keys(all).map(async (name) => {
      try {
        const res = await fetch(`assets/people/${String(all[name]).replace(/[^a-f0-9]/g, '')}.bin`);
        if (!res.ok) return;
        const buf = new Uint8Array(await res.arrayBuffer());
        const jpg = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, Lobby.cryptoKey, buf.slice(12));
        this.scenes[name] = URL.createObjectURL(new Blob([jpg], { type: 'image/jpeg' }));
      } catch (e) { console.warn('scene', name, e); }
    })).then(() => { if (typeof Scene3D !== 'undefined' && Scene3D.idoLogoReady) Scene3D.idoLogoReady(); });
  },
  scene(name) { return this.scenes[name] || ''; },
  walkFor(id) { return (id && this.people[id] && this.people[id].walk) || this.walkClip; },

  // ---------- animation retargeting ----------
  // The walk, run and idle clips (assets/models/anims.json) were recorded on one skeleton.
  // Every rig has the same bones, but each bone rests at a slightly different angle, so a
  // clip copied as-is bends knees and arms the wrong way. Instead each bone's rotation away
  // from the source's rest pose is carried over in world space, onto the target's own rest.
  clipsFor(scene, key) {
    this.clipCache = this.clipCache || {};
    if (this.clipCache[key]) return this.clipCache[key];
    const lib = this.animLib;
    if (!lib) return null;
    const bones = {};
    scene.traverse(o => { if (o.isBone) bones[o.name] = o; });
    if (!bones.Hips) return null;
    const Q = (a) => new THREE.Quaternion(a[0], a[1], a[2], a[3]);
    const order = lib.bones.filter(b => bones[b]);
    // World rest rotations of the target (the armature above the hips is shared).
    const wrT = {};
    for (const b of order) {
      const p = lib.parent[b];
      wrT[b] = (p && wrT[p] ? wrT[p].clone() : new THREE.Quaternion()).multiply(bones[b].quaternion);
    }
    const hipsT = bones.Hips.position;
    const out = {};
    for (const name in lib.clips) {
      const c = lib.clips[name], n = c.times.length;
      // ...and of the skeleton this clip was recorded on.
      const rest = c.rest || lib.rest, wrS = {}, invS = {};
      for (const b of order) {
        const p = lib.parent[b];
        wrS[b] = (p && wrS[p] ? wrS[p].clone() : new THREE.Quaternion()).multiply(Q(rest[b]));
        invS[b] = wrS[b].clone().invert();
      }
      const scaleY = hipsT.y / (c.hipsY || lib.hipsY);
      const vals = {}; for (const b of order) vals[b] = new Float32Array(n * 4);
      const hips = new Float32Array(n * 3);
      const waS = {}, waT = {}, tmp = new THREE.Quaternion(), loc = new THREE.Quaternion();
      for (let f = 0; f < n; f++) {
        for (const b of order) {
          const p = lib.parent[b];
          const q = c.q[b] ? tmp.fromArray(c.q[b], f * 4) : Q(rest[b]);
          waS[b] = (p && waS[p] ? waS[p].clone() : new THREE.Quaternion()).multiply(q);
          // D = world anim * inverse(world rest), applied to the target's world rest.
          waT[b] = waS[b].clone().multiply(invS[b]).multiply(wrT[b]);
          loc.copy(p && waT[p] ? waT[p] : new THREE.Quaternion()).invert().multiply(waT[b]);
          loc.toArray(vals[b], f * 4);
        }
        // The hips bob at the target's height; the game moves the character itself.
        hips[f * 3] = hipsT.x;
        hips[f * 3 + 1] = (c.hips ? c.hips[f * 3 + 1] : (c.hipsY || lib.hipsY)) * scaleY;
        hips[f * 3 + 2] = hipsT.z;
      }
      const tracks = order.map(b => new THREE.QuaternionKeyframeTrack(b + '.quaternion', c.times, vals[b]));
      tracks.push(new THREE.VectorKeyframeTrack('Hips.position', c.times, hips));
      out[name] = new THREE.AnimationClip(name, c.duration, tracks);
    }
    this.clipCache[key] = out;
    return out;
  },

  // A fresh copy of the rigged soldier facing +x, 1.75 m tall, with its own skeleton
  // (a cast member's own model when it has loaded).
  soldier(id) {
    const person = id && this.people[id];
    const src = person ? person.scene : this.models.soldier;
    if (!src || !THREE.SkeletonUtils) return null;
    const inner = THREE.SkeletonUtils.clone(src);
    const f = person ? person.fit : this.soldierFit;
    inner.scale.setScalar(f.scale);
    inner.position.y = -f.minY * f.scale;
    const facing = new THREE.Group();
    facing.rotation.y = Math.PI / 2; // the model faces +z; the game's soldiers face +x
    facing.add(inner);
    inner.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
    return { object: facing, inner };
  },

  // First bone whose name matches one of the patterns, in order of preference.
  bone(root, patterns) {
    const bones = [];
    root.traverse(o => { if (o.isBone) bones.push(o); });
    for (const re of patterns) {
      const b = bones.find(x => re.test(x.name));
      if (b) return b;
    }
    return null;
  },

  // A scaled copy of a model, standing on y = 0 and centred on x/z.
  // fit: { rotY, length (along x after rotation) | depth (along z) | height, size: [x, y, z] to stretch, tint }
  model(name, fit = {}) {
    const src = this.models[name];
    if (!src) return null;
    const inner = src.clone(true);
    inner.rotation.y = fit.rotY || 0;
    const holder = new THREE.Group();
    holder.add(inner);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const size = box.getSize(new THREE.Vector3());
    let sx, sy, sz;
    if (fit.size) { [sx, sy, sz] = [fit.size[0] / size.x, fit.size[1] / size.y, fit.size[2] / size.z]; }
    else {
      const k = fit.length ? fit.length / size.x : fit.depth ? fit.depth / size.z : (fit.height || 1) / size.y;
      sx = sy = sz = k;
    }
    holder.scale.set(sx, sy, sz);
    const c = box.getCenter(new THREE.Vector3());
    // The box was measured in the holder's space (rotation included), so this centres it.
    inner.position.set(-c.x, -box.min.y, -c.z);
    const outer = new THREE.Group();
    outer.add(holder);
    holder.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (fit.tint) {
        o.material = o.material.clone();
        o.material.color = new THREE.Color(fit.tint);
      }
    });
    return outer;
  },
};
