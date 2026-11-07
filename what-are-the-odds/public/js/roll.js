// The odds roll in like a slowing wheel. The number runs continuously from the
// bottom to the answer with a strong ease-out (quartic): it races at first, then
// crawls, passing through every 0.1% (or every whole "1 in N") on the way. Each new
// value ticks, the ticks climb in pitch, and the exact number settles with a chime.

import { describe, bigNumber } from "./core/format.js";
import { tick, land } from "./sound.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t) => 1 - (1 - t) ** 4;

// How the roll runs for p: where it starts and ends, and how each value reads.
export function plan(p, lang) {
  const oneIn = lang === "he" ? "1 מתוך" : "1 in";
  const fin = finalStep(p, lang);
  if (p === 0) return { pre: "", from: 5, to: 0, label: (v) => `${v.toFixed(1)}%` };
  if (fin.pre === "") {
    // percent: end on the value that will be shown (51% rolls 50.9, 51.0, then reads 51%)
    const shown = fin.num.startsWith(">") ? 99.9 : parseFloat(fin.num);
    return { pre: "", from: 0, to: shown, label: (v) => `${(Math.round(v * 10) / 10).toFixed(1)}%` };
  }
  const n = Math.round(1 / p);
  if (n <= 1e12) {
    // every whole number, with thousands separators: ..., 7,498, 7,499, 7,500
    return { pre: oneIn, from: 2, to: n, label: (v) => Math.round(v).toLocaleString("en-US") };
  }
  // astronomically small: climb through the powers of ten instead
  const L = Math.log10(1 / p);
  return {
    pre: oneIn, from: Math.log10(2), to: L,
    label: (v) => {
      const b = bigNumber(Number((10 ** v).toPrecision(2)), lang);
      return b.exp != null ? `${b.text}×10^${b.exp}` : b.text;
    },
  };
}

// The labels the roll passes through, sampled (for tests and checks).
export function steps(p, lang, samples = 400) {
  const pl = plan(p, lang);
  const out = [];
  for (let i = 0; i <= samples; i++) {
    const num = pl.label(pl.from + (pl.to - pl.from) * ease(i / samples));
    if (!out.length || out[out.length - 1].num !== num) out.push({ pre: pl.pre, num });
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
export function roll(els, p, lang, { duration = 3000, silent = false } = {}) {
  if (running) running.cancel();
  const fin = finalStep(p, lang);
  els.alt.textContent = fin.alt;
  els.alt.classList.remove("is-in");
  els.num.style.filter = "";

  if (reduced() || duration <= 0) {
    paint(els, fin, true);
    els.alt.classList.add("is-in");
    if (!silent) land();
    return Promise.resolve();
  }

  const pl = plan(p, lang);
  let raf = 0;
  let last = null;
  let lastChange = 0;
  let lastTick = -1e9;
  // The sound is a wheel with notches, not one tick per number: the notches pass
  // quickly at first and further and further apart, so you hear it slow down even
  // when a big number is still changing every frame. Then the last few visible
  // steps (each 0.1, each whole number) tick on their own.
  const NOTCHES = 46;
  const wheel = (t) => 1 - (1 - t) ** 1.6;
  let notch = 0;
  const MIN_TICK_GAP = 34;

  return new Promise((resolve) => {
    const finish = () => {
      els.num.style.filter = "";
      paint(els, fin, true);
      // it settles, no overshoot
      els.num.animate(
        [{ transform: "scale(0.97)", opacity: 0.75 }, { transform: "scale(1)", opacity: 1 }],
        { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      els.alt.classList.add("is-in");
      land();
      running = null;
      resolve();
    };
    running = { cancel() { cancelAnimationFrame(raf); els.num.style.filter = ""; running = null; resolve(); } };
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = ease(t);
      const label = pl.label(pl.from + (pl.to - pl.from) * e);
      if (label !== last) {
        const gap = now - lastChange;
        last = label;
        lastChange = now;
        paint(els, { pre: pl.pre, num: label }, false);
        // fast changes get a touch of motion blur; slow ones settle in from below
        els.num.style.filter = gap < 40 ? "blur(1px)" : "";
        if (gap >= 70) {
          els.num.animate(
            [{ transform: "translateY(0.08em)", opacity: 0.6 }, { transform: "none", opacity: 1 }],
            { duration: Math.min(160, gap * 0.6), easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          );
        }
        if (gap >= 110 && notch >= NOTCHES - 1 && now - lastTick >= 80) {
          lastTick = now;
          tick(1 + Math.min(0.15, (t - 0.85) * 0.8));
        }
      }
      const n = Math.floor(NOTCHES * wheel(t));
      if (n > notch && n < NOTCHES && now - lastTick >= MIN_TICK_GAP) {
        notch = n;
        lastTick = now;
        tick(n / NOTCHES);
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else finish();
    };
    raf = requestAnimationFrame(frame);
  });
}

export function stopRoll() {
  if (running) running.cancel();
  running = null;
}
