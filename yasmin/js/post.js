// Post-processing: bloom on the tubes, then a horror grade in display space:
// film grain, vignette, chromatic aberration, fear pulse, VHS tearing and flashes.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const HorrorShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    res: { value: new THREE.Vector2(1, 1) },
    grain: { value: 0.07 },
    vignette: { value: 1.0 },
    ca: { value: 0.0015 },
    fear: { value: 0 },
    vhs: { value: 0 },
    flash: { value: 0 },
    flashColor: { value: new THREE.Color(1, 1, 1) },
    fade: { value: 0 },
    desat: { value: 0.25 },
    warp: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, grain, vignette, ca, fear, vhs, flash, fade, desat, warp;
    uniform vec2 res; uniform vec3 flashColor;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      // fear: slow breathing warp at the edges; jumpscare: hard warp
      uv += c * r2 * (fear * 0.06 * sin(time * 2.2) + warp * 0.5);
      // VHS line tearing
      if (vhs > 0.0) {
        float line = floor(uv.y * 240.0);
        float j = step(1.0 - vhs * 0.35, h(vec2(line, floor(time * 24.0))));
        uv.x += (h(vec2(line, time)) - 0.5) * 0.06 * j * vhs;
        uv.y += sin(time * 3.0) * 0.002 * vhs;
      }
      float a = ca * (1.0 + fear * 3.0 + vhs * 4.0 + warp * 20.0);
      vec2 off = c * a * 8.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
      // grade: slightly desaturated, cold shadows, sickly highlights
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(l), desat + fear * 0.15);
      col *= mix(vec3(0.92, 1.0, 1.02), vec3(1.04, 1.02, 0.94), smoothstep(0.2, 0.8, l));
      // vignette, tightening with fear
      float v = smoothstep(0.85, 0.18 - fear * 0.12, length(c * vec2(1.0, 0.85)) * (1.0 + fear * 0.35));
      col *= mix(1.0, v, vignette);
      col = mix(col, col * vec3(1.15, 0.75, 0.75), fear * 0.25 * (0.6 + 0.4 * sin(time * 6.0)));
      // grain (stronger in the dark) and scanlines when VHS
      float n = h(uv * res + fract(time * 13.0)) - 0.5;
      col += n * grain * (1.4 - l);
      col *= 1.0 - vhs * 0.18 * (0.5 + 0.5 * sin(uv.y * res.y * 1.7));
      col += vhs * 0.05 * h(vec2(time, uv.y));
      col = mix(col, flashColor, flash);
      col *= 1.0 - fade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality === 'low' ? 0 : 4 }));
    this.composer.addPass(new RenderPass(scene, camera));
    if (quality !== 'low') {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.25, 0.15, 2.5);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.horror = new ShaderPass(HorrorShader);
    this.composer.addPass(this.horror);
    this.u = this.horror.uniforms;
  }
  setSize(w, h, pr) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.u.res.value.set(w * pr, h * pr);
    if (this.bloom) this.bloom.resolution.set(w * pr / 2, h * pr / 2);
  }
  render(t) { this.u.time.value = t; this.composer.render(); }
}
