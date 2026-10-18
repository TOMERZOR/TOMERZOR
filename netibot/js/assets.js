// Loads the 3D models and textures generated with Higgsfield before the game starts.
// Anything that fails to load is skipped and the game falls back to simple shapes.
const Assets = {
  models: {},
  anims: {},
  images: {},
  MODELS: ['launcher', 'tower', 'truck', 'container', 'pickup', 'palm', 'soldier', 'radar', 'generator', 'burger'],
  IMAGES: ['sand', 'wall', 'asphalt', 'grass'],

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
    const timeout = new Promise(resolve => setTimeout(resolve, 25000));
    return Promise.race([Promise.all([...models, ...images]), timeout]);
  },

  has(name) { return !!this.models[name]; },

  // The rigged soldier: measure it once, and pin the walk cycle in place
  // (the clip moves the hips forward; the game moves the character itself).
  prepareSoldier(scene, clips) {
    // Measure the skinned geometry itself: the armature's centimetre scale is undone by
    // the bind matrices, so a world-space box of the scene would be 100x too small.
    let geo = null;
    scene.traverse(o => { if (o.isSkinnedMesh && !geo) geo = o.geometry; });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    this.soldierFit = { scale: 1.75 / (bb.max.y - bb.min.y), minY: bb.min.y };
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
    this.idleTime = 0;
    if (feet[0] && feet[1]) {
      let best = Infinity;
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      for (let i = 0; i < 40; i++) {
        const t = this.walkClip.duration * i / 40;
        action.time = t;
        mixer.update(0);
        scene.updateMatrixWorld(true);
        const d = feet[0].getWorldPosition(a).distanceTo(feet[1].getWorldPosition(b));
        if (d < best) { best = d; this.idleTime = t; }
      }
    }
    action.time = this.idleTime;
    mixer.update(0);
    mixer.stopAllAction();
  },

  // A fresh copy of the rigged soldier facing +x, 1.75 m tall, with its own skeleton.
  soldier() {
    const src = this.models.soldier;
    if (!src || !THREE.SkeletonUtils) return null;
    const inner = THREE.SkeletonUtils.clone(src);
    const f = this.soldierFit;
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
