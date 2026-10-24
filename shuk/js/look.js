// The rendered "look": curved world, bloom, colour grade, vignette, speed lines, anti-aliasing.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// How strongly the street bends down toward the horizon (view-space y drop per z²).
export const BEND = 0.0011;
export const BEND_GLSL = `mvPosition.y -= ${BEND.toFixed(5)} * mvPosition.z * mvPosition.z;`;

// Bend every built-in material in view space, except the shadow-map depth pass
// (shadows are only drawn close to the runner, where the bend is negligible).
export function patchCurvedWorld() {
  const chunk = THREE.ShaderChunk.project_vertex;
  if (chunk.includes('CURVED_WORLD')) return;
  THREE.ShaderChunk.project_vertex = chunk.replace(
    'mvPosition = modelViewMatrix * mvPosition;',
    `mvPosition = modelViewMatrix * mvPosition;
#if !defined( DEPTH_PACKING ) && !defined( DISTANCE ) // CURVED_WORLD
	${BEND_GLSL}
#endif`);
  const sprite = THREE.ShaderLib.sprite;
  sprite.vertexShader = sprite.vertexShader.replace(
    'gl_Position = projectionMatrix * mvPosition;',
    `${BEND_GLSL}\n\tgl_Position = projectionMatrix * mvPosition;`);
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.18 },
    contrast: { value: 1.06 },
    warmth: { value: 0.03 },
    vignette: { value: 0.32 },
    speed: { value: 0 },
    time: { value: 0 },
    aspect: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float saturation, contrast, warmth, vignette, speed, time, aspect;
    varying vec2 vUv;
    float hash(float n){ return fract(sin(n) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      col += vec3(warmth, warmth * 0.35, -warmth * 0.6);
      // speed lines: thin radial streaks toward the screen edges
      if (speed > 0.01) {
        vec2 p = (vUv - vec2(0.5, 0.56)) * vec2(aspect, 1.0);
        float r = length(p);
        float a = atan(p.y, p.x);
        float k = floor(a * 38.0);
        float lane = hash(k + floor(time * 9.0) * 7.31);
        float streak = step(0.82, lane) * smoothstep(0.32, 0.75, r) * (0.5 + 0.5 * sin(r * 30.0 - time * 60.0 + k));
        col = mix(col, vec3(1.0), streak * speed * 0.33);
      }
      vec2 q = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, dot(q, q) * 2.2);
      col *= mix(1.0 - vignette, 1.0, v);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

export class Look {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.mode = 'high';
    this.composer = null;
  }

  // mode: 'high' (4x MSAA + bloom + grade), 'mid' (2x MSAA, or FXAA without WebGL2, + cheaper bloom + grade),
  // 'low' (direct render with the canvas' own antialiasing)
  setMode(mode, width, height, ratio) {
    this.mode = mode;
    if (this.composer) {
      // the composer only frees its own targets; every pass holds render targets and materials too
      for (const p of this.composer.passes) p.dispose?.();
      this.composer.dispose();
      this.composer = null; this.bloom = null; this.grade = null; this.fxaa = null;
    }
    if (mode === 'low') return;
    const isWebGL2 = this.renderer.capabilities.isWebGL2;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: isWebGL2 ? (mode === 'high' ? 4 : 2) : 0 });
    const c = new EffectComposer(this.renderer, rt);
    c.setPixelRatio(ratio);
    c.setSize(width, height);
    c.addPass(new RenderPass(this.scene, this.camera));
    this.bloomScale = mode === 'high' ? 0.5 : 0.35;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.42, 0.55, 0.82);
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    c.addPass(this.grade);
    if (!isWebGL2) {
      this.fxaa = new ShaderPass(FXAAShader);
      this.fxaa.material.uniforms.resolution.value.set(1 / (width * ratio), 1 / (height * ratio));
      c.addPass(this.fxaa);
    } else this.fxaa = null;
    this.composer = c;
    this.resize(width, height, ratio);
  }

  resize(width, height, ratio) {
    if (!this.composer) return;
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    // the composer sizes every pass to the full buffer; bloom runs cheaper at a fraction of it
    this.bloom.setSize(Math.round(width * ratio * this.bloomScale), Math.round(height * ratio * this.bloomScale));
    if (this.fxaa) this.fxaa.material.uniforms.resolution.value.set(1 / (width * ratio), 1 / (height * ratio));
    if (this.grade) this.grade.uniforms.aspect.value = width / height;
  }

  // per-zone tuning: bloom gets stronger at night
  setZone(glow) {
    if (!this.bloom) return;
    this.bloom.strength = 0.35 + glow * 0.45;
    this.bloom.threshold = 0.86 - glow * 0.2;
  }

  render(time, speedFx) {
    if (!this.composer) { this.renderer.render(this.scene, this.camera); return; }
    this.grade.uniforms.time.value = time;
    this.grade.uniforms.speed.value = speedFx;
    this.composer.render();
  }
}
