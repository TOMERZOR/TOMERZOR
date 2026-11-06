// Zakai — the 2D mascot. Plain SVG built from separate parts so each one can move:
// eyes (blink / squint / look), brows (raise), jaw + mouth (lip-sync), sidelocks (sway), head (bob/tilt).

const C = {
  brick: '#8A3B1F', brickDeep: '#6F2C15', gypsum: '#FBF3E4', beardShade: '#E7D8BF',
  ink: '#2A1A12', amber: '#F0A030', glassR: '#C8372D', glassB: '#2E6DA4',
  skin: '#C98A5A', skinDeep: '#A86A3F', nose: '#B87648', blush: '#D9705A', mouth: '#4A160A', tongue: '#B0453A',
};

export const MASCOT_SVG = `
<svg class="mascot" viewBox="0 0 400 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="זכאי, סבא תימני מצויר">
  <defs>
    <clipPath id="archClip"><path d="M58 440 V190 A142 142 0 0 1 342 190 V440 Z"/></clipPath>
  </defs>

  <!-- Sana'a window -->
  <path fill="${C.gypsum}" d="M40 440 V190 A160 160 0 0 1 360 190 V440 Z"/>
  <path fill="${C.brick}" d="M58 440 V190 A142 142 0 0 1 342 190 V440 Z"/>
  <g clip-path="url(#archClip)" class="rays" opacity=".22">
    ${Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI + (i + 0.5) * Math.PI / 9, r = 170;
      return `<path d="M200 190 L${(200 + r * Math.cos(a - 0.09)).toFixed(1)} ${(190 + r * Math.sin(a - 0.09)).toFixed(1)} L${(200 + r * Math.cos(a + 0.09)).toFixed(1)} ${(190 + r * Math.sin(a + 0.09)).toFixed(1)} Z" fill="${[C.amber, C.glassR, C.glassB][i % 3]}"/>`;
    }).join('')}
  </g>

  <g class="char" clip-path="url(#archClip)">
    <!-- body: dark vest over a white shirt -->
    <path fill="${C.ink}" d="M66 440 C76 384 128 352 200 352 C272 352 324 384 334 440 Z"/>
    <path fill="${C.gypsum}" d="M168 354 L200 410 L232 354 Z"/>

    <g class="head">
      <!-- ears -->
      <ellipse cx="118" cy="218" rx="14" ry="22" fill="${C.skinDeep}"/>
      <ellipse cx="282" cy="218" rx="14" ry="22" fill="${C.skinDeep}"/>
      <!-- face -->
      <ellipse cx="200" cy="214" rx="83" ry="96" fill="${C.skin}"/>
      <!-- forehead wrinkles -->
      <path d="M166 170 Q200 160 234 170 M174 180 Q200 172 226 180" fill="none" stroke="${C.skinDeep}" stroke-width="3" stroke-linecap="round" opacity=".7"/>
      <!-- cheeks -->
      <circle cx="152" cy="244" r="15" fill="${C.blush}" opacity=".35"/>
      <circle cx="248" cy="244" r="15" fill="${C.blush}" opacity=".35"/>

      <!-- eyes -->
      <g class="eyes">
        <g class="eye eye-l"><ellipse cx="167" cy="213" rx="8.5" ry="10.5" fill="${C.ink}"/><circle cx="170" cy="209" r="2.8" fill="#fff"/></g>
        <g class="eye eye-r"><ellipse cx="233" cy="213" rx="8.5" ry="10.5" fill="${C.ink}"/><circle cx="236" cy="209" r="2.8" fill="#fff"/></g>
      </g>
      <!-- crow's feet -->
      <path d="M140 206 l-10 -5 M140 214 l-11 1 M260 206 l10 -5 M260 214 l11 1" stroke="${C.skinDeep}" stroke-width="2.6" stroke-linecap="round"/>
      <!-- brows -->
      <g class="brows">
        <path d="M146 194 Q164 180 186 190" fill="none" stroke="${C.gypsum}" stroke-width="10" stroke-linecap="round"/>
        <path d="M254 194 Q236 180 214 190" fill="none" stroke="${C.gypsum}" stroke-width="10" stroke-linecap="round"/>
      </g>
      <!-- nose -->
      <path fill="${C.nose}" d="M200 206 C192 230 184 249 190 259 C196 266 210 265 215 256 C218 247 207 229 200 206 Z"/>

      <!-- sidelocks (simanim) -->
      <g class="lock lock-l"><path d="M124 158 C110 198 128 226 112 262 C98 294 116 318 136 306 C150 296 138 278 124 286" fill="none" stroke="${C.gypsum}" stroke-width="11" stroke-linecap="round"/></g>
      <g class="lock lock-r"><path d="M276 158 C290 198 272 226 288 262 C302 294 284 318 264 306 C250 296 262 278 276 286" fill="none" stroke="${C.gypsum}" stroke-width="11" stroke-linecap="round"/></g>

      <!-- beard + mouth move together as the jaw -->
      <g class="jaw">
        <path fill="${C.gypsum}" stroke="${C.beardShade}" stroke-width="3" d="M120 236 C122 300 142 350 176 372 L160 412 L202 380 C262 376 290 318 280 236 C266 264 238 274 200 272 C162 274 134 264 120 236 Z"/>
        <path d="M150 300 Q160 322 172 334 M250 300 Q240 322 228 334 M200 330 L200 352" fill="none" stroke="${C.beardShade}" stroke-width="3" stroke-linecap="round"/>
        <g class="mouth">
          <ellipse class="mouth-hole" cx="200" cy="290" rx="17" ry="4" fill="${C.mouth}"/>
          <ellipse class="mouth-tongue" cx="200" cy="296" rx="9" ry="0" fill="${C.tongue}"/>
        </g>
      </g>
      <!-- mustache sits on top of the mouth -->
      <path class="stache" fill="${C.gypsum}" stroke="${C.beardShade}" stroke-width="2.5" d="M156 280 C170 262 190 264 200 274 C210 264 230 262 244 280 C230 289 214 286 200 282 C186 286 170 289 156 280 Z"/>

      <!-- cap: the qamariya colours -->
      <path fill="${C.amber}" d="M116 162 Q116 92 200 92 Q284 92 284 162 Z"/>
      <circle cx="166" cy="128" r="9" fill="${C.glassR}"/><circle cx="200" cy="124" r="9" fill="${C.glassB}"/><circle cx="234" cy="128" r="9" fill="${C.glassR}"/>
      <rect x="110" y="156" width="180" height="13" rx="4" fill="${C.gypsum}"/>
    </g>
  </g>
</svg>`;

/** Drives the mascot from app state and live audio levels. */
export class Mascot {
  constructor(root) {
    root.innerHTML = MASCOT_SVG;
    this.svg = root.querySelector('svg');
    this.q = s => this.svg.querySelector(s);
    this.head = this.q('.head');
    this.jaw = this.q('.jaw');
    this.mouth = this.q('.mouth-hole');
    this.tongue = this.q('.mouth-tongue');
    this.eyes = this.q('.eyes');
    this.brows = this.q('.brows');
    this.state = 'idle';
    this.level = 0;      // smoothed output level 0..1
    this.shape = 0.5;    // 0 = round ("u"), 1 = wide ("i")
    this.blinkUntil = 0;
    this.nextBlink = performance.now() + 1500;
    this.t0 = performance.now();
    requestAnimationFrame(this.tick);
  }

  setState(s) {
    this.state = s;
    this.svg.dataset.state = s;
  }

  /** Feed an audio level (0..1) and a rough brightness (0..1) every frame. */
  feed(level, brightness = 0.5) {
    const a = level > this.level ? 0.55 : 0.25; // fast attack, slower release
    this.level += (level - this.level) * a;
    this.shape += (brightness - this.shape) * 0.2;
  }

  tick = (now) => {
    const t = (now - this.t0) / 1000;
    const speaking = this.state === 'speaking';
    const lv = speaking ? Math.min(1, this.level) : 0;

    // jaw + mouth
    const open = lv * 15;
    this.mouth.setAttribute('ry', (3 + open).toFixed(2));
    this.mouth.setAttribute('rx', (17 + (this.shape - 0.5) * 8 * lv - lv * 2).toFixed(2));
    this.tongue.setAttribute('ry', Math.max(0, open * 0.35).toFixed(2));
    this.tongue.setAttribute('cy', (292 + open * 0.7).toFixed(2));
    this.jaw.setAttribute('transform', `translate(0 ${(lv * 7).toFixed(2)})`);

    // head: breathing, listening tilt, speaking bob
    let rot = Math.sin(t * 0.9) * 1.2, dy = Math.sin(t * 1.6) * 1.5;
    if (this.state === 'listening') rot = -4 + Math.sin(t * 1.3) * 0.8;
    if (this.state === 'thinking') rot = 3 + Math.sin(t * 0.8) * 0.6;
    if (speaking) { rot += Math.sin(t * 4.2) * 2.2 * (0.3 + lv); dy -= lv * 3; }
    this.head.setAttribute('transform', `translate(0 ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} 200 300)`);

    // brows
    const browUp = this.state === 'listening' ? -6 : this.state === 'thinking' ? -3 : speaking ? -lv * 6 : 0;
    this.brows.setAttribute('transform', `translate(0 ${browUp.toFixed(2)})`);

    // eyes: look direction, blink, squint while talking
    if (now > this.nextBlink) { this.blinkUntil = now + 130; this.nextBlink = now + 2500 + Math.random() * 3500; }
    const blinking = now < this.blinkUntil;
    let sy = blinking ? 0.1 : speaking ? 0.75 : 1;
    let lx = 0, ly = 0;
    if (this.state === 'thinking') { lx = 5; ly = -5; }
    if (this.state === 'listening') { ly = 1; }
    for (const [el, cx] of [[this.q('.eye-l'), 167], [this.q('.eye-r'), 233]]) {
      el.setAttribute('transform', `translate(${lx} ${ly}) translate(${cx} 213) scale(1 ${sy}) translate(${-cx} -213)`);
    }
    requestAnimationFrame(this.tick);
  };
}
