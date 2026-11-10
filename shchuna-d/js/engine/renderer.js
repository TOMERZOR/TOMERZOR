// Renderer, quality tiers and the post-processing chain.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const QUALITY = {
  low:    { label: 'נמוכה',  dpr: 1.0,  shadow: 0,    post: false, bloom: false, far: 420, peds: 14, cars: 8,  env: false, aniso: 2, lamps: 0, ao: false },
  medium: { label: 'בינונית', dpr: 1.25, shadow: 1024, post: true,  bloom: false, far: 560, peds: 22, cars: 12, env: true,  aniso: 4, lamps: 3, ao: false },
  high:   { label: 'גבוהה',  dpr: 1.5,  shadow: 2048, post: true,  bloom: true,  far: 720, peds: 30, cars: 16, env: true,  aniso: 8, lamps: 5, ao: true },
  ultra:  { label: 'אולטרה', dpr: 2.0,  shadow: 4096, post: true,  bloom: true,  far: 900, peds: 38, cars: 20, env: true,  aniso: 16, lamps: 8, ao: true },
};

// Final grade in display space: FXAA, gentle split-toning, vignette, film grain.
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(1, 1) }, time: { value: 0 },
    vignette: { value: 0.3 }, grain: { value: 0.018 }, saturation: { value: 1.12 }, hurt: { value: 0 },
    tint: { value: new THREE.Vector3(1, 1, 1) }, fxaa: { value: 1 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float time, vignette, grain, saturation, hurt, fxaa; uniform vec3 tint;
    varying vec2 vUv;
    float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    vec3 aa(vec2 uv){
      vec2 px = 1.0 / resolution;
      vec3 m = texture2D(tDiffuse, uv).rgb;
      if (fxaa < 0.5) return m;
      float lM = luma(m);
      float lN = luma(texture2D(tDiffuse, uv + vec2(0.0, -px.y)).rgb), lS = luma(texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb);
      float lW = luma(texture2D(tDiffuse, uv + vec2(-px.x, 0.0)).rgb), lE = luma(texture2D(tDiffuse, uv + vec2(px.x, 0.0)).rgb);
      float mx = max(lM, max(max(lN, lS), max(lW, lE))), mn = min(lM, min(min(lN, lS), min(lW, lE)));
      float range = mx - mn;
      if (range < max(0.0312, mx * 0.125)) return m;
      vec2 dir = vec2(-((lN) - (lS)), (lW) - (lE));
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + 0.0001);
      dir = clamp(dir * rcp, -2.0, 2.0) * px;
      vec3 a = 0.5 * (texture2D(tDiffuse, uv + dir * (1.0/3.0 - 0.5)).rgb + texture2D(tDiffuse, uv + dir * (2.0/3.0 - 0.5)).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture2D(tDiffuse, uv + dir * -0.5).rgb + texture2D(tDiffuse, uv + dir * 0.5).rgb);
      float lB = luma(b);
      return (lB < mn || lB > mx) ? a : b;
    }
    void main(){
      vec3 c = aa(vUv);
      float l = luma(c);
      c = mix(vec3(l), c, saturation);
      c = clamp((c - 0.5) * 1.1 + 0.5, 0.0, 1.0);          // a little more bite after the filmic curve
      // warm highlights, cool shadows
      c += (vec3(0.018, 0.008, -0.02) * smoothstep(0.45, 1.0, l)) + (vec3(-0.012, 0.004, 0.02) * (1.0 - smoothstep(0.0, 0.4, l)));
      c *= tint;
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.25, 0.95, dot(d, d) * 2.2);
      c *= 1.0 - v * vignette;
      c = mix(c, vec3(0.55, 0.03, 0.02), v * hurt);
      c += (hash(vUv * resolution + fract(time) * 91.7) - 0.5) * grain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class Gfx {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.info.autoReset = true;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.12, 900);
    this.scene.add(this.camera);
    this.maxAniso = r.capabilities.getMaxAnisotropy();
    this.q = QUALITY.high; this.qName = 'high';
    this.composer = null; this.final = null; this.bloom = null;
    this.time = 0; this.hurt = 0;
    this._size = new THREE.Vector2();
    window.addEventListener('resize', () => this.resize());
  }

  static autoQuality() {
    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
    const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
    // Safari does not report memory; a six-core iPhone is recent enough for shadows and post-processing
    if (mobile) return ((mem >= 6 && cores >= 8) || (/iPhone|iPad/.test(ua) && cores >= 6)) ? 'medium' : 'low';
    return cores >= 8 ? 'high' : 'medium';
  }

  setQuality(name) {
    if (!QUALITY[name]) name = 'medium';
    this.qName = name; this.q = QUALITY[name];
    const r = this.renderer, q = this.q;
    r.shadowMap.enabled = q.shadow > 0;
    this.camera.far = q.far; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.dispose(); this.composer = null; }
    if (q.post) {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 0 });
      const c = this.composer = new EffectComposer(r, rt);
      c.addPass(new RenderPass(this.scene, this.camera));
      if (q.ao) {
        // contact shadows under balconies, cars and people: what glues objects to the ground
        this.ao = new GTAOPass(this.scene, this.camera, 256, 256);
        this.ao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12, screenSpaceRadius: false });
        this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 });
        this.ao.blendIntensity = 0.9;
        c.addPass(this.ao);
      } else this.ao = null;
      if (q.bloom) {
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.25, 0.55, 0.97);
        c.addPass(this.bloom);
      } else this.bloom = null;
      c.addPass(new OutputPass());
      this.final = new ShaderPass(FinalShader);
      c.addPass(this.final);
    } else { this.final = null; this.bloom = null; }
    this.resize();
    return q;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.q.dpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(dpr); this.composer.setSize(w, h);
      this.renderer.getDrawingBufferSize(this._size);
      this.final.uniforms.resolution.value.copy(this._size);
    }
  }

  render(dt) {
    this.time += dt;
    if (this.composer) {
      const u = this.final.uniforms;
      u.time.value = this.time; u.hurt.value = this.hurt;
      this.composer.render(dt);
    } else this.renderer.render(this.scene, this.camera);
  }
}
