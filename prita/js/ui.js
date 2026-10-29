// Interactive pieces: playable strings, the tempo knob, progress rings and haptics.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function haptic(ms = 8) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not supported */ }
}

// A progress ring. pct 0..100
function ring(pct, { size = 48, stroke = 4.5, cls = "", label = "" } = {}) {
  const r = (size - stroke) / 2;
  return `<span class="ring ${cls}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}"/>
    ${pct > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fill" stroke-width="${stroke}" pathLength="100" style="--p:${100 - clamp(pct, 0, 100)}"/>` : ""}
  </svg>${label ? `<b>${label}</b>` : ""}</span>`;
}

// Six strings you can strum with a finger. notes(i) returns the MIDI note of string i (0 = low E) or null when muted.
function StringsPad(canvas, { notes, onStrum, labels = true, height = 150 } = {}) {
  const ctx2d = canvas.getContext("2d");
  const st = Array.from({ length: 6 }, (_, i) => ({ amp: 0, t0: 0, f: 7 + i * 1.6, dead: false }));
  let W = 0, H = height, dpr = 1, raf = 0, last = null, plucked = 0;
  const ys = () => { const m = 18, g = (H - m * 2) / 5; return st.map((_, i) => m + (5 - i) * g); };
  const resize = () => {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight || height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    draw(performance.now());
  };
  function draw(now) {
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, W, H);
    const y0 = ys();
    let alive = false;
    st.forEach((s, i) => {
      const t = (now - s.t0) / 1000;
      const a = s.amp * Math.exp(-t * (s.dead ? 14 : 2.2));
      if (a > 0.05) alive = true;
      const thick = 3.4 - i * 0.42;
      const grad = ctx2d.createLinearGradient(0, y0[i] - thick, 0, y0[i] + thick);
      const hot = Math.min(1, a / 5);
      grad.addColorStop(0, `rgba(255,${226 - hot * 40},${170 - hot * 90},1)`);
      grad.addColorStop(0.5, i < 3 ? "#cdb38c" : "#e9e2d8");
      grad.addColorStop(1, "#5a4a3a");
      ctx2d.strokeStyle = grad;
      ctx2d.lineWidth = thick;
      ctx2d.shadowColor = `rgba(255,181,71,${hot * 0.9})`;
      ctx2d.shadowBlur = hot * 14;
      ctx2d.beginPath();
      const left = labels ? 26 : 0;
      for (let x = left; x <= W; x += 6) {
        const u = (x - left) / (W - left);
        const y = y0[i] + a * Math.sin(Math.PI * u) * Math.cos(2 * Math.PI * s.f * t + i);
        x === left ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
      }
      ctx2d.stroke();
      ctx2d.shadowBlur = 0;
      if (labels) {
        const n = notes(i);
        ctx2d.fillStyle = n == null ? "rgba(246,238,227,.28)" : a > 0.3 ? "#ffb547" : "rgba(246,238,227,.7)";
        ctx2d.font = "600 12px Heebo, sans-serif";
        ctx2d.textAlign = "center";
        ctx2d.fillText(n == null ? "×" : Sound.noteName(n), 11, y0[i] + 4);
      }
    });
    if (alive && !reduceMotion) raf = requestAnimationFrame(draw);
    else raf = 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const pluck = (i, strength = 1) => {
    const n = notes(i);
    const s = st[i];
    s.t0 = performance.now();
    s.dead = n == null;
    s.amp = (n == null ? 2 : 5.5) * strength;
    if (n != null) Sound.pluck(n, 0, 0.42 * strength, 2.2);
    plucked++;
    kick();
  };
  const crossed = (ya, yb) => {
    const y0 = ys();
    const hit = [];
    y0.forEach((y, i) => { if ((ya - y) * (yb - y) <= 0 && ya !== yb) hit.push(i); });
    if (yb < ya) hit.reverse();
    return hit;
  };
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const r = canvas.getBoundingClientRect();
    last = e.clientY - r.top;
    const y0 = ys();
    const near = y0.findIndex((y) => Math.abs(y - last) < 9);
    if (near >= 0) { pluck(near, 0.8); haptic(6); }
    plucked = 0;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (last == null) return;
    const r = canvas.getBoundingClientRect();
    const y = e.clientY - r.top;
    const hit = crossed(last, y);
    if (hit.length) {
      const speed = clamp(Math.abs(y - last) / 18, 0.55, 1.15);
      hit.forEach((i) => pluck(i, speed));
      haptic(4);
    }
    last = y;
  });
  const end = () => {
    if (last != null && plucked >= 3 && onStrum) onStrum(plucked);
    last = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.style.touchAction = "none";
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  return {
    strum(dir = "D") {
      const order = dir === "D" ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
      order.forEach((i, k) => setTimeout(() => pluck(i, 0.9), k * 22));
    },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); },
  };
}

// Rotary tempo knob. Drag around it, scroll on it, or use the arrow keys.
function Knob(el, { min = 30, max = 240, value = 80, onChange, onTap } = {}) {
  const size = 236, c = size / 2, R = 96, sweep = 270;
  const angOf = (v) => -sweep / 2 + ((v - min) / (max - min)) * sweep;
  const pt = (deg, r) => [c + r * Math.sin((deg * Math.PI) / 180), c - r * Math.cos((deg * Math.PI) / 180)];
  const arc = (a0, a1, r) => {
    const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
    return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  let ticks = "";
  for (let v = min; v <= max; v += 10) {
    const a = angOf(v), major = v % 50 === 0;
    const [x0, y0] = pt(a, R + 12), [x1, y1] = pt(a, R + (major ? 22 : 17));
    ticks += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" class="${major ? "maj" : ""}"/>`;
  }
  el.classList.add("knob");
  el.setAttribute("role", "slider");
  el.setAttribute("tabindex", "0");
  el.setAttribute("aria-label", "קצב בפעימות לדקה");
  el.setAttribute("aria-valuemin", min);
  el.setAttribute("aria-valuemax", max);
  el.innerHTML = `<svg viewBox="0 0 ${size} ${size}" dir="ltr">
    <defs><linearGradient id="kg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ff8a3d"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
    <radialGradient id="kc" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#3a2f27"/><stop offset="1" stop-color="#15110e"/></radialGradient></defs>
    <g class="ticks">${ticks}</g>
    <path d="${arc(-sweep / 2, sweep / 2, R)}" class="k-track"/>
    <path class="k-fill" stroke="url(#kg)"/>
    <circle cx="${c}" cy="${c}" r="${R - 16}" fill="url(#kc)" class="k-cap"/>
    <circle class="k-pulse" cx="${c}" cy="${c}" r="${R - 16}"/>
    <circle class="k-thumb" r="9"/>
  </svg><div class="k-read"><b></b><small></small></div>`;
  const fill = el.querySelector(".k-fill"), thumb = el.querySelector(".k-thumb"), num = el.querySelector(".k-read b"), sub = el.querySelector(".k-read small");
  let v = value, dragging = false, moved = false, lastHaptic = v;
  const paint = () => {
    const a = angOf(v);
    fill.setAttribute("d", arc(-sweep / 2, Math.max(-sweep / 2 + 0.01, a), R));
    const [x, y] = pt(a, R);
    thumb.setAttribute("cx", x);
    thumb.setAttribute("cy", y);
    num.textContent = v;
    sub.textContent = `BPM · ${tempoName(v)}`;
    el.setAttribute("aria-valuenow", v);
  };
  const set = (nv, fromUser) => {
    nv = clamp(Math.round(nv), min, max);
    if (nv === v) return;
    v = nv;
    paint();
    if (fromUser) {
      if (Math.abs(v - lastHaptic) >= 5) { haptic(3); lastHaptic = v; }
      if (onChange) onChange(v);
    }
  };
  const fromPointer = (e) => {
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    let deg = (Math.atan2(x, -y) * 180) / Math.PI;
    if (Math.abs(deg) > sweep / 2 + 20) return;
    deg = clamp(deg, -sweep / 2, sweep / 2);
    set(min + ((deg + sweep / 2) / sweep) * (max - min), true);
  };
  el.addEventListener("pointerdown", (e) => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
    const dist = Math.hypot(dx, dy) / (r.width / size);
    if (dist < R - 22) { moved = false; dragging = "center"; el.setPointerCapture(e.pointerId); return; }
    dragging = true;
    el.setPointerCapture(e.pointerId);
    el.classList.add("grab");
    fromPointer(e);
  });
  el.addEventListener("pointermove", (e) => {
    if (dragging === true) fromPointer(e);
    else if (dragging === "center") moved = true;
  });
  const up = () => {
    if (dragging === "center" && !moved && onTap) onTap();
    dragging = false;
    el.classList.remove("grab");
  };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("wheel", (e) => { e.preventDefault(); set(v + (e.deltaY < 0 ? 1 : -1), true); }, { passive: false });
  el.addEventListener("keydown", (e) => {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (d) { e.preventDefault(); set(v + d, true); }
  });
  paint();
  return {
    set: (nv) => set(nv, false),
    get: () => v,
    pulse(accent) {
      el.classList.remove("beat", "accent");
      void el.offsetWidth;
      el.classList.add("beat");
      if (accent) el.classList.add("accent");
    },
  };
}

// Drag a number sideways to change it (used for BPM inside exercises).
function scrubber(el, get, set, perPx = 0.25) {
  let x0 = null, v0 = 0;
  el.style.touchAction = "none";
  el.addEventListener("pointerdown", (e) => { x0 = e.clientX; v0 = get(); el.setPointerCapture(e.pointerId); el.classList.add("scrub"); });
  el.addEventListener("pointermove", (e) => {
    if (x0 == null) return;
    const nv = Math.round(v0 + (e.clientX - x0) * perPx);
    if (nv !== get()) { set(nv); if (nv % 5 === 0) haptic(3); }
  });
  const up = () => { x0 = null; el.classList.remove("scrub"); };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}
