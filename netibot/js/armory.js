// The armory (נשקייה) at the HQ: a small container by the road with a counter, gun racks and a
// workbench, run by {@armorer}. E at the counter (or talking to him) opens the shop for the
// club shooter's guns (js/arcade/shooter.js, נתיבות הקטנה): your rifles, new ones to buy, and
// the attachments, fitted per rifle — the suppressor, the foregrip, the bipod, the holographic
// sight and the ACOG. Everything with the game's shekels and kept for good (G.state.shOwned,
// shGun, shFit; ShooterGame does the bookkeeping). The building is in js/data.js and its
// furniture in js/world.js (props armcounter / armrack / armbench / armsign); the models are
// drawn here, since the site's 3D (js/scene3d.js) doesn't know them.
const ARM_MODELS = ['arm_counter', 'arm_rack', 'arm_bench'];
const ARM_GUN_MODELS = ['gun_m16', 'gun_m4', 'gun_rifle', 'gun_negev', 'gun_sniper', 'sight_holo', 'att_supp', 'att_grip', 'att_bipod', 'att_acog'];
// Where he stands: behind the counter (tile), facing the door.
const ARM_SPOT = [10.0, 16.68];
// What he says. [m/f] is your gender.
const ARM_SAY = {
  intro: [
    { who: 'armorer', text: '[ברוך הבא/ברוכה הבאה] לנשקייה! אני {@@armorer}. פה כל ברג יודע את השם שלי, וכל רובה יודע מה הוא עשה בלילה.' },
    { who: 'armorer', text: 'יוצא חמשושים, [אחי/אחותי]. שם למדתי שנשק נקי זה נשק מאושר. ונשק מאושר — זה חייל שחוזר הביתה.' },
    { who: 'armorer', text: 'ראית את הרובה של {@p_shalev}? אני שיפצתי לו אותו בתחילת הפלג"צ. אנחנו מהבית, מגיל קטן. הוא עוד לא ידע לקשור שרוכים וכבר ביקש ממני משתיק.' },
    { who: 'armorer', text: 'וחוץ מנשק — ת"ש. יש בעיה בבית? כסף, דירה, אמא, סבתא? [בוא/בואי] אליי. ת"ש זה לא טופס. זה לב. ...וגם טופס. שלושה עותקים.' },
    { who: 'armorer', text: 'נו, מה [תרצה/תרצי]? רובים לנתיבות הקטנה, משתיקים, ידיות, דו־רגליות, כוונות. הכל בשקלים של המשחק, ושלך לתמיד.', choices: [{ label: '🔫 להראות לי את הסחורה', value: 1 }, { label: 'אחר כך', value: 0 }] },
  ],
  hello: ['ת"ש ונשק — שני הדברים שאני הכי אוהב. השלישי זה חומוס.', 'מה נשמע? יש בעיה בבית? לא? יופי. אז בוא[/י] נדבר על רובים.', '{@p_shalev} היה פה אתמול. ביקש שאשפץ לו את הכוונת. אמרתי לו: הכוונת בסדר, [אחי/אחותי], העיניים שלך לא.', 'בחמשושים היינו מנקים נשק שלוש פעמים ביום. פעם רביעית — בשביל הנשמה.'],
  gun: ['{it}? בחירה של [גבר/אישה] עם טעם. רק אל [תספר/תספרי] ל{@harasar} כמה זה עלה.', '{it} שלך! [תשמור/תשמרי] עליו כמו על הכומתה. אפילו יותר — כומתה לא יורה.', 'יצא מהארגז רק בשבילך. כמעט [בכיתי/בכיתי]. ...לא בכיתי. היה לי שמן בעין.'],
  supp: ['משתיק! עכשיו גם {@harasar} לא ישמע אותך [מגיע/מגיעה]. אל [תגיד/תגידי] לו שאני אמרתי.', 'שקט, [אחי/אחותי]. כמו חמשושניק בכניסה לבית בשלוש בלילה.'],
  grip: ['ידית הסתערות. כמו בחמשושים — תופסים חזק ולא משחררים.', 'עם הידית הזאת הרובה כבר לא קופץ. אם רק היה אפשר לשים ידית כזאת על {@p_shalev} בחדר אוכל.'],
  bipod: ['דו־רגלית! [עומד/עומדת] במקום, [נושם/נושמת], לוחץ[/ת]... לפחות במשחק מישהו פה נח.', 'שתי רגליים לרובה. יותר ממה שיש לי אחרי שמירה של שמונה שעות.'],
  acog: ['טריג\'יקון, פי ארבע. עכשיו [תראה/תראי] את הזבובים של {@p_nevo} מהצד השני של הכיכר.', 'כוונת של צלפים. רק אל [תשכח/תשכחי] — פי ארבע זה גם פי ארבע לראות כמה החטאת.'],
  holo: ['הולוגרפית. נקודה אדומה, חיים ורודים.', 'טבעת ונקודה. פשוט, מהיר, כמו ארוחת צהריים בחמ"ל.'],
  off: ['[מוריד/מורידה]? בסדר. שומר לך את זה במגירה, עם השם שלך. בטוש.', 'יורד. אבל זה נשאר שלך, אל [תדאג/תדאגי].'],
  poor: ['חסר כסף? ת"ש, [אחי/אחותי]! ...לא, ת"ש לא מממן רובים. [תשחק/תשחקי] קצת במועדון ו[תחזור/תחזרי].', 'אין מספיק. אבל יש לי זמן. ואת הרובה אני שומר לך מאחורי הדלפק.'],
  scope: 'לרובה הצלפים יש כוונת משלו. אל [תיגע/תיגעי] לי בה, כיילתי אותה שלושה ימים.',
  noGun: 'קודם [תקנה/תקני] את הרובה, אחר כך נלביש אותו. אני לא מרכיב משתיק על אוויר.',
  pick: ['ביד. שיהיה בהצלחה בנתיבות הקטנה.', 'קח[/י]. ותחזיר[/י] אותו נקי.'],
};

const Armory = {
  open: false,
  sel: null,

  // ---------- hooks into the site (installed once, below) ----------
  hook() {
    if (this.hooked || typeof Story === 'undefined' || typeof Scene3D === 'undefined' || typeof Game === 'undefined') return;
    this.hooked = true;
    // The counter: E in front of it.
    const inter = Story.interactables;
    Story.interactables = function (...a) {
      const list = inter.apply(this, a);
      const c = World.id === 'hq' && World.objects.find(o => o.kind === 'armcounter');
      if (c && !Boss.active && !this.ctl && !(G.player && G.player.carry)) list.push({ x: c.x + c.w / 2, y: c.y + c.h + 0.55 * TS, label: '🔫 הנשקייה — {@armorer}', action: () => Armory.visit(), r: 44 });
      return list;
    };
    // Talking to him opens the armory too.
    const talk = Story.talkTo;
    Story.talkTo = function (n, ...a) { if (n && n.id === 'armorer' && !n.chasing) return Armory.visit(); return talk.call(this, n, ...a); };
    // He stands behind his counter.
    const reset = Game.resetNpcs;
    Game.resetNpcs = function (...a) { const r = reset.apply(this, a); Armory.place(); return r; };
    // The furniture's models.
    const add = Scene3D.addProp;
    Scene3D.addProp = function (o) { const rec = add.call(this, o); if (rec && /^arm/.test(o.kind)) Armory.drawProp(rec); return rec; };
  },
  place() {
    if (World.id !== 'hq' || !G.npcs) return;
    const n = G.npcs.find(q => q.id === 'armorer');
    if (!n) return;
    const p = { x: ARM_SPOT[0] * TS, y: ARM_SPOT[1] * TS };
    Object.assign(n, { x: p.x, y: p.y, spot: { ...p }, wander: null, path: [], angle: Math.PI / 2 });
  },
  // A prop of the armory in the 3D scene: its model (once loaded), or nothing until then.
  drawProp(rec) {
    const o = rec.o, g = rec.g, w = o.w * S3, d = o.h * S3;
    if (o.kind === 'armsign') { this.sign(g, w); return; }
    const name = { armcounter: 'arm_counter', armrack: 'arm_rack', armbench: 'arm_bench' }[o.kind];
    if (!name) return;
    const put = () => {
      if (rec.armDone || !Assets.models[name]) return false;
      rec.armDone = true;
      // (The counter's and the bench's length is along x, the rack's along z; fronts face +z, the door.)
      const along = w >= d;
      const fit = o.kind === 'armrack' ? { rotY: along ? Math.PI / 2 : 0, size: along ? [w, 2.0, d] : [w, 2.0, d] }
        : { rotY: along ? 0 : Math.PI / 2, size: [w, o.kind === 'armcounter' ? 1.0 : 0.95, d] };
      const m = Assets.model(name, fit);
      if (!m) return false;
      m.traverse(q => { if (q.isMesh) { q.castShadow = true; q.receiveShadow = true; q.material.color.setScalar(1.25); } });
      g.add(m);
      return true;
    };
    if (!put()) {
      (this.pending = this.pending || []).push(put);
      this.loadModels();
    }
  },
  loadModels() {
    if (this.loading || typeof Arcade === 'undefined' || !Arcade.loadModels) return this.loading;
    this.loading = Arcade.loadModels(ARM_MODELS).then(() => { for (const f of this.pending || []) f(); this.pending = []; });
    return this.loading;
  },
  // The sign over the door.
  sign(g, w) {
    const t = Scene3D.canvasTex(512, 128, (c) => {
      c.fillStyle = '#2a2f22'; c.fillRect(0, 0, 512, 128);
      c.strokeStyle = '#d8b04a'; c.lineWidth = 8; c.strokeRect(6, 6, 500, 116);
      c.fillStyle = '#f4e3b0'; c.font = '900 70px Rubik, Arial'; c.textAlign = 'center'; c.direction = 'rtl';
      c.fillText('🔫 נשקייה', 256, 92);
    });
    // (Up on the roof's edge, over the door's awning, on two short posts.)
    const board = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(2.4, w), 0.62), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 }));
    board.position.set(0, WALL_H + 0.42, -0.12);
    g.add(board);
    for (const sx of [-0.9, 0.9]) Scene3D.cyl(0.04, 0.04, 0.5, Scene3D.mat(0x3a3a34), sx, WALL_H + 0.2, -0.16, g, 6);
  },

  // ---------- the visit ----------
  async visit() {
    if (this.open) return;
    const S = G.state;
    if (!S.armoryMet) {
      S.armoryMet = true;
      const v = await UI.talk(ARM_SAY.intro);
      if (!v) return;
    } else await UI.talk([{ who: 'armorer', text: pick(ARM_SAY.hello) }]);
    this.show();
  },
  // The shop panel.
  show() {
    if (this.open) return;
    this.open = true;
    UI.busy = true;
    G.keys && G.keys.clear && G.keys.clear();
    this.sel = ShooterGame.myGun();
    const root = document.createElement('div');
    root.id = 'armory';
    root.innerHTML = `<div class="arm-box" role="dialog" aria-label="נשקייה">
      <header><h2>🔫 הנשקייה של ${esc(fmt('{@armorer}'))}</h2><span class="arm-wallet"></span><button class="arm-x" aria-label="סגירה">✕</button></header>
      <div class="arm-say"><img alt=""><p></p></div>
      <div class="arm-main">
        <section class="arm-view"><canvas></canvas><div class="arm-name"></div><div class="arm-stats"></div><div class="arm-act"></div></section>
        <section class="arm-side"><h3>הרובים</h3><div class="arm-guns"></div><h3>תוספות <small class="arm-for"></small></h3><div class="arm-atts"></div></section>
      </div></div>`;
    document.body.appendChild(root);
    this.root = root;
    const face = typeof faceUrl === 'function' ? faceUrl('armorer') : '';
    const img = root.querySelector('.arm-say img');
    if (face) img.src = face; else img.replaceWith(Object.assign(document.createElement('span'), { className: 'arm-emoji', textContent: (Cast.get('armorer') || {}).emoji || '🔧' }));
    root.querySelector('.arm-x').onclick = () => { Sound.click(); this.close(); };
    root.addEventListener('click', (e) => { if (e.target === root) this.close(); });
    this.onKey = (e) => { if (e.code === 'Escape' || (e.code === 'KeyE' && !e.repeat)) { e.preventDefault(); e.stopPropagation(); this.close(); } };
    setTimeout(() => this.open && document.addEventListener('keydown', this.onKey, true), 250);
    this.say(pick(ARM_SAY.hello));
    this.render();
    Promise.all([Arcade.loadModels(ARM_GUN_MODELS)]).then(() => { if (this.open) { ShooterGame.dressGuns && (ShooterGame.underCache = {}); this.preview(); } });
    this.startView();
  },
  close() {
    if (!this.open) return;
    this.open = false;
    document.removeEventListener('keydown', this.onKey, true);
    cancelAnimationFrame(this.raf);
    if (this.r3) { this.r3.dispose(); if (this.r3.forceContextLoss) this.r3.forceContextLoss(); this.r3 = null; }
    if (this.root) this.root.remove();
    this.root = null;
    UI.busy = false;
    Game.save();
  },
  say(text, extra = {}) {
    const p = this.root && this.root.querySelector('.arm-say p');
    if (!p) return;
    let t = text;
    for (const k in extra) t = t.split('{' + k + '}').join(extra[k]);
    p.textContent = fmtAs(Cast.get('armorer'), t);
    p.parentNode.classList.remove('pop'); void p.offsetWidth; p.parentNode.classList.add('pop');
  },

  // ---------- drawing the panel ----------
  render() {
    const R = this.root; if (!R) return;
    const own = ShooterGame.owned(), money = G.state.money || 0, inHand = ShooterGame.myGun(), sel = this.sel, W = SH_W[sel];
    R.querySelector('.arm-wallet').innerHTML = `💰 <b>${money}</b> ₪`;
    // The rifles.
    R.querySelector('.arm-guns').innerHTML = SH_GUNS.map(id => {
      const G1 = SH_W[id], mine = own.has(id);
      const chip = id === inHand ? '<em class="on">✔ ביד</em>' : mine ? '<em class="own">🔑 שלך</em>' : `<em class="price ${money < G1.price ? 'short' : ''}">${G1.price} ₪</em>`;
      return `<button class="arm-gun ${id === sel ? 'sel' : ''} ${mine ? '' : 'locked'}" data-g="${id}"><img src="${G1.img}" alt="">${chip}<b>${G1.name}</b><i>${ShooterGame.attIcons(ShooterGame.myAtt(id)) || '&nbsp;'}</i></button>`;
    }).join('');
    R.querySelectorAll('.arm-gun').forEach(b => b.onclick = () => { Sound.click(); this.sel = b.dataset.g; this.render(); this.preview(); });
    // The rifle shown: its numbers with what's fitted, and buy / take.
    const att = ShooterGame.myAtt(sel), Wf = ShooterGame.loadW(sel, att);
    R.querySelector('.arm-name').innerHTML = `<b>${W.name}</b> <span>${W.desc}</span>`;
    const bar = (label, v, tip) => `<div class="arm-stat" title="${tip || ''}"><span>${label}</span><s style="--v:${Math.round(Math.max(5, Math.min(100, v * 100)))}%"></s></div>`;
    R.querySelector('.arm-stats').innerHTML = [
      bar('נזק', (Wf.dmg - 12) / 30), bar('דיוק', (0.013 - Wf.spread) / 0.011 * 0.6 + (1 - Wf.ads.spread) * 0.4), bar('קצב', Wf.burst ? 0.45 : Wf.bolt ? 0.08 : (0.12 - Wf.rate) / 0.055),
      bar('שליטה', 1 - (Wf.kick - 0.006) / 0.02), bar('זום', (72 - Wf.ads.fov) / 58), bar('שקט', 1 - (Wf.hear - 6) / 22),
    ].join('');
    const act = R.querySelector('.arm-act');
    if (!own.has(sel)) act.innerHTML = `<button class="btn arm-buy" data-buy="${sel}">🔑 לקנות ב-${W.price} ₪</button>`;
    else if (sel !== inHand) act.innerHTML = `<button class="btn arm-take">✋ לקחת ביד</button>`;
    else act.innerHTML = `<p class="arm-inhand">✔ זה הרובה שלך בנתיבות הקטנה</p>`;
    const bb = act.querySelector('.arm-buy'); if (bb) bb.onclick = () => this.buy(sel);
    const tk = act.querySelector('.arm-take'); if (tk) tk.onclick = () => { Sound.click(); G.state.shGun = sel; G.state.shSight = ShooterGame.fitOf(sel).o === 'holo' ? 'holo' : null; this.say(pick(ARM_SAY.pick)); Game.save(); this.render(); };
    // The attachments, for the rifle shown.
    R.querySelector('.arm-for').textContent = `ל${W.name}`;
    const fit = ShooterGame.fitOf(sel);
    const slot = { holo: 'o', acog: 'o', supp: 's', grip: 'g', bipod: 'b' };
    const items = ['supp', 'grip', 'bipod', 'holo', 'acog'].map(id => ({ id, it: id === 'holo' ? { ...SH_HOLO, icon: '🔴' } : SH_ATT[id] }));
    R.querySelector('.arm-atts').innerHTML = items.map(({ id, it }) => {
      const mine = own.has(id), on = slot[id] === 'o' ? fit.o === id : !!fit[slot[id]];
      const na = W.scope && slot[id] === 'o';
      const chip = na ? '<em class="na">כוונת משלו</em>' : on ? '<em class="on">✔ מורכב</em>' : mine ? '<em class="own">🔑 שלך</em>' : `<em class="price ${money < it.price ? 'short' : ''}">${it.price} ₪</em>`;
      return `<button class="arm-att ${on ? 'sel' : ''} ${mine ? '' : 'locked'} ${na ? 'na' : ''}" data-a="${id}"><img src="${it.img}" alt="">${chip}<b>${it.icon} ${it.name}</b><i>${it.desc}</i></button>`;
    }).join('');
    R.querySelectorAll('.arm-att').forEach(b => b.onclick = () => this.attClick(b.dataset.a));
  },
  buy(id) {
    const it = ShooterGame.item(id), money = G.state.money || 0;
    if (!it) return;
    if (money < it.price) { Sound.bad(); this.say(pick(ARM_SAY.poor)); UI.toast(`💸 ${it.name} עולה ${it.price} ₪ ויש לך ${money} ₪. חסרים עוד <b>${it.price - money} ₪</b>`, 'bad'); return; }
    const gun = ShooterGame.owned().has(this.sel) ? this.sel : ShooterGame.myGun();
    if (!ShooterGame.buyItem(id, gun)) { Sound.bad(); return; }
    Sound.coin(); setTimeout(() => Sound.fanfare(), 180);
    UI.toast(`🔑 ${it.name} — שלך! שילמת ${it.price} ₪ · נשארו ${G.state.money} ₪`, 'ach');
    if (SH_GUNS.includes(id)) this.say(pick(ARM_SAY.gun), { it: it.name });
    else this.say(pick(ARM_SAY[id] || ARM_SAY.gun), { it: it.name });
    this.render(); this.preview();
  },
  // An attachment tapped: not yours → buy it (onto the rifle shown); yours → on / off that rifle.
  attClick(id) {
    const sel = this.sel, W = SH_W[sel], own = ShooterGame.owned();
    const optic = id === 'holo' || id === 'acog';
    if (W.scope && optic) { Sound.bad(); this.say(ARM_SAY.scope); return; }
    if (!own.has(id)) {
      if (!own.has(sel)) { Sound.bad(); this.say(ARM_SAY.noGun); return; }
      this.buy(id); return;
    }
    if (!own.has(sel)) { Sound.bad(); this.say(ARM_SAY.noGun); return; }
    Sound.click();
    const f = ShooterGame.fitOf(sel), k = { supp: 's', grip: 'g', bipod: 'b' }[id];
    let on;
    if (optic) { on = f.o !== id; f.o = on ? id : null; } else { on = !f[k]; f[k] = on; }
    ShooterGame.setFit(sel, f);
    Game.save();
    if (on) { Sound.synth.tone(900, 0.04, 'square', 0.04); Sound.synth.later(90, () => Sound.synth.tone(1500, 0.03, 'square', 0.035)); }
    this.say(on ? pick(ARM_SAY[id]) : pick(ARM_SAY.off));
    this.render(); this.preview();
  },

  // ---------- the turning rifle ----------
  startView() {
    const cv = this.root.querySelector('.arm-view canvas');
    try {
      this.r3 = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    } catch (e) { this.r3 = null; return; }
    this.r3.outputEncoding = THREE.sRGBEncoding;
    this.r3.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    const sc = this.vs = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xfff2dc, 0x404038, 1.15));
    const key = new THREE.DirectionalLight(0xffe0b0, 0.9); key.position.set(-1.5, 2, 1.5); sc.add(key);
    const rim = new THREE.DirectionalLight(0x9fb8ff, 0.4); rim.position.set(1.5, 0.5, -1.5); sc.add(rim);
    this.cam = new THREE.PerspectiveCamera(30, 2, 0.01, 20);
    this.spin = new THREE.Group(); sc.add(this.spin);
    this.preview();
    const t0 = performance.now();
    const loop = () => {
      if (!this.open || !this.r3) return;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w && h && (cv.width !== Math.round(w * this.r3.getPixelRatio()) || cv.height !== Math.round(h * this.r3.getPixelRatio()))) { this.r3.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
      const t = (performance.now() - t0) / 1000;
      this.spin.rotation.y = -Math.PI / 2 + Math.sin(t * 0.55) * 0.75;
      this.r3.render(sc, this.cam);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  },
  preview() {
    if (!this.spin) return;
    while (this.spin.children.length) this.spin.remove(this.spin.children[0]);
    const gun = this.sel, W = SH_W[gun];
    if (!Assets.models[W.model]) return;
    const g = ShooterGame.makeGun(gun, false, ShooterGame.myAtt(gun));
    // Unfold the bipod so you can see it.
    if (g.userData.bipod) g.userData.bipod.rotation.x = 0;
    const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    g.position.sub(c);
    this.spin.add(g);
    const L = Math.max(size.z, size.y * 1.8, 0.5);
    this.cam.position.set(0, L * 0.16, L * 1.55); this.cam.lookAt(0, 0, 0);
  },
};

Armory.hook();
if (!Armory.hooked) window.addEventListener('load', () => Armory.hook());
