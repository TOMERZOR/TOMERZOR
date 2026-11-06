// The odds roll in like a slowing wheel: discrete steps, each one later than the
// last (an ease-out in time), each with a tick that climbs in pitch, then the
// exact number lands with a small pop and a chime.

import { describe, bigNumber } from "./core/format.js";
import { tick, land } from "./sound.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function pctLabel(v, P) {
  return P >= 10 ? `${Math.round(v)}%` : `${v.toFixed(1).replace(/\.0$/, "")}%`;
}

// The labels the roll passes through, ending with the real one.
export function steps(p, lang) {
  const out = [];
  const push = (pre, num) => {
    const last = out[out.length - 1];
    if (!last || last.num !== num || last.pre !== pre) out.push({ pre, num });
  };
  const oneIn = lang === "he" ? "1 מתוך" : "1 in";
  if (p >= 0.01 || p === 0) {
    const P = p * 100;
    const from = p === 0 ? 50 : 0;
    const K = p === 0 ? 24 : Math.max(14, Math.min(40, Math.round(P >= 10 ? P / 1.3 : P * 4)));
    for (let k = 0; k < K; k++) push("", pctLabel(from + (P - from) * (k / K), Math.max(P, from)));
  } else {
    const L = Math.log10(1 / p);
    const start = Math.log10(2);
    const K = Math.max(20, Math.min(44, Math.round(18 + 3.5 * L)));
    for (let k = 0; k < K; k++) {
      const n = 10 ** (start + (L - start) * (k / K));
      const b = bigNumber(Number(n.toPrecision(2)), lang);
      push(oneIn, b.exp != null ? `${b.text}×10^${b.exp}` : b.text);
    }
  }
  return out;
}

function paint(els, step, final) {
  els.pre.textContent = step.pre;
  els.pre.hidden = !step.pre;
  const m = step.num.match(/^(.*)×10\^(\d+)$/);
  els.num.replaceChildren();
  if (m) {
    const x = document.createElement("span");
    x.className = "x";
    x.textContent = "×";
    const sup = document.createElement("sup");
    sup.textContent = m[2];
    els.num.append(m[1], x, "10", sup);
    els.num.dir = "ltr";
  } else {
    els.num.textContent = step.num;
    els.num.dir = "auto";
  }
  els.num.classList.toggle("is-words", /[^\d.,%\s×^]/.test(step.num));
  els.num.classList.toggle("is-final", Boolean(final));
}

function finalStep(p, lang) {
  const d = describe(p, lang);
  const oneIn = lang === "he" ? "1 מתוך" : "1 in";
  if (d.main.kind === "oneIn") return { pre: oneIn, num: d.main.exp != null ? `${d.main.text}×10^${d.main.exp}` : d.main.text, alt: d.alt };
  return { pre: "", num: d.main.text, alt: d.alt };
}

let running = null;

/**
 * Roll els.num (and els.pre, els.alt) to probability p.
 * Resolves when the number has landed.
 */
export function roll(els, p, lang, { duration = 2600, silent = false } = {}) {
  if (running) running.cancel();
  const fin = finalStep(p, lang);
  els.alt.textContent = fin.alt;
  els.alt.classList.remove("is-in");

  if (reduced() || duration <= 0) {
    paint(els, fin, true);
    els.alt.classList.add("is-in");
    if (!silent) land();
    return Promise.resolve();
  }

  const list = steps(p, lang);
  const K = list.length;
  const power = 3; // value(t) = 1 - (1 - t)^3: races up, then crawls into the answer
  const times = list.map((_, k) => duration * (1 - (1 - k / K) ** (1 / power)));
  const timers = [];
  let cancelled = false;

  return new Promise((resolve) => {
    running = { cancel() { cancelled = true; timers.forEach(clearTimeout); resolve(); } };
    list.forEach((step, k) => {
      timers.push(setTimeout(() => {
        if (cancelled) return;
        paint(els, step, false);
        const gap = (times[k + 1] ?? duration) - times[k];
        els.num.animate(
          [{ transform: "translateY(0.12em)", opacity: 0.35, filter: "blur(2px)" }, { transform: "none", opacity: 1, filter: "blur(0)" }],
          { duration: Math.max(40, Math.min(180, gap * 0.85)), easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
        tick(k / K);
      }, times[k]));
    });
    timers.push(setTimeout(() => {
      if (cancelled) return;
      paint(els, fin, true);
      // it settles, no overshoot
      els.num.animate(
        [{ transform: "scale(0.97)", opacity: 0.7 }, { transform: "scale(1)", opacity: 1 }],
        { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      els.alt.classList.add("is-in");
      land();
      running = null;
      resolve();
    }, duration));
  });
}

export function stopRoll() {
  if (running) running.cancel();
  running = null;
}
