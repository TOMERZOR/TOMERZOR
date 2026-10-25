// DOM side: screens, HUD, objectives, subtitles, notes and the touch controls.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.screens = ['loading', 'menu', 'howto', 'settings', 'card', 'note', 'pause', 'over', 'end'];
    this.subT = 0; this.toastT = 0;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  }
  show(id, on = true) { $(id).classList.toggle('show', on); }
  only(id) { for (const s of this.screens) this.show(s, s === id); }
  hud(on) { $('hud').classList.toggle('show', on); $('touch').classList.toggle('hidden', !(on && this.isTouch)); $('touch').classList.toggle('show', on && this.isTouch); }

  progress(p, tip) { $('load-bar').style.width = (p * 100).toFixed(0) + '%'; if (tip) $('load-tip').textContent = tip; }

  objectives(title, list) {
    $('obj-night').textContent = title;
    const ul = $('obj-list');
    const old = new Map([...ul.children].map(li => [li.dataset.id, li]));
    ul.innerHTML = '';
    for (const o of list) {
      if (o.hidden) continue;
      const li = document.createElement('li');
      li.dataset.id = o.id;
      li.textContent = o.text + (o.count ? ` (${o.have}/${o.count})` : '');
      if (o.done) li.classList.add('done');
      if (!old.has(o.id)) li.classList.add('new');
      ul.appendChild(li);
    }
    $('pause-obj').innerHTML = list.filter(o => !o.done && !o.hidden).map(o => `<li>• ${o.text}</li>`).join('');
  }
  clock(min) {
    const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
    $('clock').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  prompt(text, key = 'E', hold = 0) {
    const p = $('prompt');
    if (!text) { p.innerHTML = ''; $('dot').classList.remove('active'); return; }
    const k = this.isTouch ? '' : `<kbd>${key}</kbd>`;
    p.innerHTML = `${k}${text}${hold > 0 ? `<span class="bar2"><i style="width:${(hold * 100).toFixed(0)}%"></i></span>` : ''}`;
    $('dot').classList.add('active');
  }
  sub(text, dur = 3) {
    $('subs').innerHTML = `<span>${text}</span>`; $('subs').style.opacity = 1; this.subT = dur;
  }
  toast(text, dur = 2.5) { const t = $('toast'); t.textContent = text; t.style.opacity = 1; this.toastT = dur; }
  meters(stamina, battery, showBattery) {
    $('stamina').style.width = (stamina * 100) + '%';
    $('stamina').parentElement.parentElement.style.opacity = stamina < 0.99 ? 1 : 0.25;
    $('battery').style.width = (battery * 100) + '%';
    $('battery').style.background = battery < 0.2 ? '#c33' : '#cfc6a8';
    $('battery-m').style.display = showBattery ? '' : 'none';
  }
  eye(aw, chase) {
    const e = $('eye');
    e.style.opacity = chase ? 1 : Math.min(1, aw * 1.4);
    e.classList.toggle('chase', !!chase);
  }
  update(dt) {
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) $('subs').style.opacity = 0; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').style.opacity = 0; }
  }
  note(html) { $('note-body').innerHTML = html; this.show('note', true); $('note').scrollTop = 0; }
  card(n, title, text) {
    this.only('card');
    $('card-n').textContent = n; $('card-t').textContent = title;
    const x = $('card-x'); x.textContent = '';
    // typewriter
    let i = 0; clearInterval(this._tw);
    this._tw = setInterval(() => { x.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(this._tw); }, 28);
    // restart the fade-in animations
    for (const id of ['card-n', 'card-t']) { const el = $(id); el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; }
  }
  lockHint(on) { $('hint-lock').classList.toggle('hidden', !on); }
  lockerView(on) { $('locker-view').classList.toggle('on', on); }
  scare(src, opacity) { const s = $('scare'); if (src && s.dataset.src !== src) { s.src = src; s.dataset.src = src; } s.style.opacity = opacity; }
  blackout(v, fast) { const b = $('blackout'); b.style.transition = fast ? 'none' : 'opacity 0.6s'; b.style.opacity = v; }

  // Touch: a virtual stick on the left, drag-to-look on the right, buttons.
  bindTouch(player, actions) {
    const stick = $('stick'), knob = stick.querySelector('i');
    let sid = null, sx = 0, sy = 0;
    stick.addEventListener('pointerdown', e => { sid = e.pointerId; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; stick.setPointerCapture(sid); move(e); });
    const move = (e) => {
      if (e.pointerId !== sid) return;
      let dx = e.clientX - sx, dy = e.clientY - sy;
      const l = Math.hypot(dx, dy), m = 55;
      if (l > m) { dx *= m / l; dy *= m / l; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      player.touch.mx = dx / m; player.touch.my = -dy / m;
      player.touch.run = l > m * 1.6 || actions.runToggle();
    };
    stick.addEventListener('pointermove', move);
    const end = (e) => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ''; player.touch.mx = player.touch.my = 0; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    const pad = $('lookpad');
    const last = new Map();
    pad.addEventListener('pointerdown', e => { last.set(e.pointerId, [e.clientX, e.clientY]); pad.setPointerCapture(e.pointerId); });
    pad.addEventListener('pointermove', e => {
      const l = last.get(e.pointerId); if (!l) return;
      player.touch.lookDX += e.clientX - l[0]; player.touch.lookDY += e.clientY - l[1];
      last.set(e.pointerId, [e.clientX, e.clientY]);
    });
    const pend = e => last.delete(e.pointerId);
    pad.addEventListener('pointerup', pend); pad.addEventListener('pointercancel', pend);
    const btn = (id, down, up) => {
      const b = $(id);
      b.addEventListener('pointerdown', e => { e.preventDefault(); down(b); });
      if (up) { b.addEventListener('pointerup', () => up(b)); b.addEventListener('pointercancel', () => up(b)); }
    };
    btn('t-use', () => actions.useDown(), () => actions.useUp());
    btn('t-run', b => { const on = !b.classList.contains('on'); b.classList.toggle('on', on); actions.setRun(on); });
    btn('t-crouch', b => { const on = !b.classList.contains('on'); b.classList.toggle('on', on); player.touch.crouch = on; });
    btn('t-light', () => actions.light());
    btn('t-pause', () => actions.pause());
  }
}
