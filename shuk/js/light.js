// Sunlight that behaves like sunlight.
//
// 1. A baked sun shadow map of the whole street: one tile per chunk in a 4x2 depth atlas, rendered from that
//    chunk's sun direction only when the chunk is (re)placed. Every stall, awning, balcony, arch and building then
//    shades everything around it at any distance, for one texture lookup per pixel instead of a shadow pass of
//    the whole street every frame. The per-frame shadow map is left to the things that move.
// 2. Street-canyon sky occlusion: ambient light falls off toward the bottom of the street, under the awnings and
//    on walls facing a tall opposite wall, the way the sky actually reaches into a narrow market street.
// 3. Warm bounce light from the sunlit stone, mostly on surfaces turned away from the sun.
//
// Materials opt in with shukLit(material); the uniforms below are shared by all of them.
import * as THREE from 'three';

export const STATIC_LAYER = 1;
const TILES = 7, COLS = 4, ROWS = 2;
const TILE_ASPECT = 1.5;        // tiles are taller than wide: the chunk's length runs up the tile

export const SHUK = {
  shukShadowMap: { value: null },
  shukShadowMat: { value: Array.from({ length: TILES }, () => new THREE.Matrix4()) },
  shukShadowP: { value: new THREE.Vector4(0, 1 / 2048, 1 / 1536, 0.04) }, // x: 0 off, 1 one tap, 2 four taps; yz texel; w normal offset (m)
  shukRunD: { value: 0 },
  shukTile: { value: 30 },
  shukAO: { value: new THREE.Vector4(13.5, 0.5, 1, 0.45) },              // canyon height, ambient floor, -, awning shade
  shukSunDir: { value: new THREE.Vector3(0, 1, 0) },
  shukBounce: { value: new THREE.Color(0, 0, 0) },
  shukSignShade: { value: 0.45 },
};

const DECL_V = /* glsl */`
varying vec3 vShukWP;
`;
const WP_V = /* glsl */`
	{
		vec4 shukWP = vec4( transformed, 1.0 );
		#ifdef USE_BATCHING
			shukWP = batchingMatrix * shukWP;
		#endif
		#ifdef USE_INSTANCING
			shukWP = instanceMatrix * shukWP;
		#endif
		vShukWP = ( modelMatrix * shukWP ).xyz;
	}
`;

const DECL_F = /* glsl */`
uniform sampler2DShadow shukShadowMap;
uniform mat4 shukShadowMat[ ${TILES} ];
uniform vec4 shukShadowP;
uniform float shukRunD;
uniform float shukTile;
uniform vec4 shukAO;
uniform vec3 shukSunDir;
uniform vec3 shukBounce;
uniform float shukSignShade;
varying vec3 vShukWP;

// How much of the sun reaches this point past the street's static geometry (1 lit, 0 shaded).
float shukSun( vec3 wp, vec3 wn ) {
	if ( shukShadowP.x < 0.5 ) return 1.0;
	// normal offset grows on surfaces the light grazes, where depth changes fastest across a texel
	float ndl = abs( dot( wn, shukSunDir ) );
	vec3 p = wp + wn * shukShadowP.w * ( 1.0 + 2.0 * ( 1.0 - ndl ) );
	p.z -= shukRunD;                                    // world -> track space (the street scrolls, the map does not)
	float k = floor( - p.z / shukTile );
	float t = k - ${TILES}.0 * floor( k / ${TILES}.0 );
	vec4 sc = shukShadowMat[ int( t + 0.5 ) ] * vec4( p, 1.0 );
	if ( sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0 ) return 1.0;
	vec2 cell = vec2( mod( t, ${COLS}.0 ), floor( t / ${COLS}.0 ) );
	vec2 m = shukShadowP.yz * vec2( ${COLS}.0, ${ROWS}.0 ) * 1.5;  // keep the taps inside this tile
	vec2 uv = ( cell + clamp( sc.xy, m, 1.0 - m ) ) / vec2( ${COLS}.0, ${ROWS}.0 );
	if ( shukShadowP.x < 1.5 ) return texture( shukShadowMap, vec3( uv, sc.z ) );
	vec2 o = shukShadowP.yz;
	return 0.25 * (
		texture( shukShadowMap, vec3( uv + vec2( -0.4, -1.1 ) * o, sc.z ) ) +
		texture( shukShadowMap, vec3( uv + vec2( 1.1, -0.4 ) * o, sc.z ) ) +
		texture( shukShadowMap, vec3( uv + vec2( 0.4, 1.1 ) * o, sc.z ) ) +
		texture( shukShadowMap, vec3( uv + vec2( -1.1, 0.4 ) * o, sc.z ) ) );
}

// Sky visible from this point of the street canyon (walls at |x| ~ 7.2, roofline shukAO.x), mapped to an
// ambient multiplier. Cosines of the wall-top elevations, no trigonometry needed.
float shukSky( vec3 wp, vec3 wn ) {
	float hy = max( shukAO.x - wp.y, 0.0 );
	float dR = max( 7.2 - wp.x, 0.4 ), dL = max( 7.2 + wp.x, 0.4 );
	float iR = inversesqrt( hy * hy + dR * dR ), iL = inversesqrt( hy * hy + dL * dL );
	float up = 0.5 * ( dR * iR + dL * iL );
	float across = wn.x < 0.0 ? 1.0 - hy * iL : 1.0 - hy * iR;
	vec3 a = abs( wn ); a /= a.x + a.y + a.z + 1e-4;
	float v = up * a.y + across * a.x + ( 0.5 + 0.5 * up ) * a.z;
	// the stall awnings hide most of the sky from what is under them
	float under = ( 1.0 - smoothstep( 2.4, 3.1, wp.y ) ) * smoothstep( 3.8, 4.6, abs( wp.x ) );
	v *= 1.0 - shukAO.w * under;
	return mix( shukAO.y, 1.0, v );
}

// Light thrown back by the sunlit stone and paving: strongest low down and on faces turned from the sun.
vec3 shukBounceLight( vec3 wp, vec3 wn ) {
	vec2 s = normalize( shukSunDir.xz + vec2( 1e-4 ) );
	float face = 0.35 + 0.65 * max( dot( wn.xz, - s ), 0.0 );
	float low = 1.0 - 0.7 * smoothstep( 0.0, 11.0, wp.y );
	return shukBounce * face * low * ( 1.0 - max( wn.y, 0.0 ) );
}
`;

const SUN_TERM = 'getDirectionalLightInfo( directionalLight, directLight );';

function patchLit(sh) {
  sh.vertexShader = DECL_V + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>' + WP_V);
  const begin = THREE.ShaderChunk.lights_fragment_begin.replace(SUN_TERM,
    // the sun is always directional light 0 (shadow casters sort first, and it is added before the rim light)
    `${SUN_TERM}\n\t\t#if UNROLLED_LOOP_INDEX == 0\n\t\tdirectLight.color *= shukVis;\n\t\t#endif`);
  sh.fragmentShader = DECL_F + sh.fragmentShader
    .replace('#include <lights_fragment_begin>', `
      vec3 shukN = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
      float shukVis = shukSun( vShukWP, shukN );
      float shukOcc = shukSky( vShukWP, shukN );
      ${begin}`)
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      reflectedLight.indirectDiffuse *= shukOcc;
      reflectedLight.indirectSpecular *= shukOcc;
      reflectedLight.indirectDiffuse += shukBounceLight( vShukWP, shukN ) * shukOcc * BRDF_Lambert( material.diffuseColor );`);
  Object.assign(sh.uniforms, SHUK);
}

// unlit materials (painted signs): just darken in the shade, a little less at night when they glow
function patchBasic(sh) {
  sh.vertexShader = DECL_V + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>' + WP_V);
  sh.fragmentShader = DECL_F + sh.fragmentShader.replace('#include <map_fragment>',
    '#include <map_fragment>\n\tdiffuseColor.rgb *= 1.0 - shukSignShade * ( 1.0 - shukSun( vShukWP, vec3( 0.0 ) ) );');
  Object.assign(sh.uniforms, SHUK);
}

const done = new WeakSet();
export function shukLit(material) {
  if (!material || done.has(material)) return material;
  const lit = material.isMeshLambertMaterial || material.isMeshStandardMaterial || material.isMeshPhongMaterial;
  if (!lit && !material.isMeshBasicMaterial) return material;
  done.add(material);
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey.call(material);
  const patch = lit ? patchLit : patchBasic;
  material.onBeforeCompile = function (sh, r) { prev.call(this, sh, r); patch(sh); };
  material.customProgramCacheKey = () => `shuk-${lit ? 'lit' : 'basic'}|${prevKey}`;
  material.needsUpdate = true;
  return material;
}
export function shukLitTree(root) {
  root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) shukLit(m); });
  return root;
}

// ---------- the baker ----------
const _L = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3(), _m = new THREE.Matrix4();
const BIAS = new THREE.Matrix4();

export class SunBake {
  constructor(renderer, chunk) {
    this.renderer = renderer;
    this.chunk = chunk;
    SHUK.shukTile.value = chunk;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 100);
    this.cam.layers.set(STATIC_LAYER);
    // second-depth shadow mapping: back faces only, so a lit surface never shadows itself (no acne)
    this.mat = new THREE.MeshDepthMaterial({ side: THREE.BackSide });
    this.rt = null;
    this.tileW = 0;
    this.queue = [];
    // a shadow sampler must always see a real depth texture, even with the bake off
    this.blank = this.target(COLS, ROWS);
    SHUK.shukShadowMap.value = this.blank.depthTexture;
  }

  // a depth atlas with hardware-filtered depth comparison, created on the GPU and cleared to "all lit"
  target(W, H) {
    const depth = new THREE.DepthTexture(W, H, THREE.UnsignedIntType);
    depth.compareFunction = THREE.LessEqualCompare;
    depth.minFilter = depth.magFilter = THREE.LinearFilter;
    const rt = new THREE.WebGLRenderTarget(W, H, { depthTexture: depth, depthBuffer: true, format: THREE.RedFormat, type: THREE.UnsignedByteType, generateMipmaps: false });
    const r = this.renderer, prev = r.getRenderTarget();
    r.initRenderTarget(rt);
    r.setRenderTarget(rt); r.clear(false, true, false); r.setRenderTarget(prev);
    return rt;
  }

  // tile width in texels (0 switches the baked shadows off)
  setSize(tileW) {
    if (tileW === this.tileW) return false;
    this.tileW = tileW;
    SHUK.shukShadowMap.value = this.blank.depthTexture;
    SHUK.shukShadowP.value.x = 0;
    if (this.rt) { this.rt.dispose(); this.rt = null; }
    if (!tileW) return true;
    const tileH = Math.round(tileW * TILE_ASPECT), W = tileW * COLS, H = tileH * ROWS;
    this.rt = this.target(W, H);
    // switched on by the first bake (an unbaked tile would read as fully lit anyway)
    SHUK.shukShadowP.value.set(0, 1 / W, 1 / H, 0.04);
    this.taps = tileW > 512 ? 2 : 1;              // four filtered taps on High, one (hardware 2x2 PCF) otherwise
    return true;
  }

  request(slot) { if (this.rt && !this.queue.includes(slot)) this.queue.push(slot); }
  clear() { this.queue.length = 0; }

  // bake queued tiles; the slots must already sit where they are drawn this frame
  process(scene, runD, sunDirOf, max = 1) {
    if (!this.rt) { this.queue.length = 0; return 0; }
    let n = 0;
    while (this.queue.length && n < max) {
      const slot = this.queue.shift();
      this.bake(scene, slot, runD, sunDirOf(slot));
      n++;
    }
    if (n && SHUK.shukShadowMap.value !== this.rt.depthTexture) {
      SHUK.shukShadowMap.value = this.rt.depthTexture;
      SHUK.shukShadowP.value.x = this.taps;
    }
    return n;
  }

  bake(scene, slot, runD, sunDir) {
    const { renderer: r, cam, chunk, rt } = this;
    const i = ((Math.round(slot.startD / chunk) % TILES) + TILES) % TILES;
    const tileW = this.tileW, tileH = Math.round(tileW * TILE_ASPECT);
    const zNear = runD - slot.startD;                          // world z of the chunk's near edge right now
    _L.fromArray(sunDir).normalize();
    _c.set(0, 7.5, zNear - chunk / 2);
    cam.position.copy(_c).addScaledVector(_L, 70);
    cam.up.set(0, 0, -1);
    if (Math.abs(_L.z) > 0.95) cam.up.set(1, 0, 0);
    cam.lookAt(_c);
    cam.updateMatrixWorld();
    // fit the frustum to the receivers of this chunk: street, stalls and building fronts
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, far = 0;
    for (const x of [-10, 10]) for (const y of [-0.5, 16.5]) for (const z of [zNear + 0.6, zNear - chunk - 0.6]) {
      _p.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
      x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); y0 = Math.min(y0, _p.y); y1 = Math.max(y1, _p.y); far = Math.max(far, -_p.z);
    }
    cam.left = x0; cam.right = x1; cam.top = y1; cam.bottom = y0; cam.near = 1; cam.far = far + 2;
    cam.updateProjectionMatrix();
    // track space -> [0,1] tile coordinates and depth, with a few centimetres of depth bias
    BIAS.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5 - 0.025 / (cam.far - cam.near), 0, 0, 0, 1);
    SHUK.shukShadowMat.value[i].copy(BIAS).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse)
      .multiply(_m.makeTranslation(0, 0, runD));

    const prevRT = r.getRenderTarget(), prevAuto = r.autoClear, prevSM = r.shadowMap.autoUpdate;
    rt.viewport.set((i % COLS) * tileW, Math.floor(i / COLS) * tileH, tileW, tileH);
    rt.scissor.copy(rt.viewport);
    rt.scissorTest = true;
    r.setRenderTarget(rt);
    r.autoClear = false;
    r.clear(false, true, false);
    r.shadowMap.autoUpdate = false;                            // don't redo the per-frame shadow map for this
    scene.overrideMaterial = this.mat;
    r.render(scene, cam);
    scene.overrideMaterial = null;
    r.shadowMap.autoUpdate = prevSM;
    r.autoClear = prevAuto;
    r.setRenderTarget(prevRT);
  }
}
