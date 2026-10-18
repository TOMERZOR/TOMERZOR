// Loads the 3D models and textures generated with Higgsfield before the game starts.
// Anything that fails to load is skipped and the game falls back to simple shapes.
const Assets = {
  models: {},
  images: {},
  MODELS: ['launcher', 'tower', 'truck', 'container', 'pickup', 'palm'],
  IMAGES: ['sand', 'wall', 'asphalt'],

  load(onProgress = () => {}) {
    const total = this.MODELS.length + this.IMAGES.length;
    let done = 0;
    const tick = () => onProgress(++done / total);
    const loader = THREE.GLTFLoader ? new THREE.GLTFLoader() : null;
    const models = this.MODELS.map(name => new Promise(resolve => {
      if (!loader) return resolve();
      loader.load(`assets/models/${name}.glb`, (g) => {
        // glTF defaults to fully metallic, which renders near-black without an environment map.
        g.scene.traverse(o => { if (o.isMesh) { o.material.metalness = 0; o.material.roughness = 0.85; } });
        this.models[name] = g.scene;
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
