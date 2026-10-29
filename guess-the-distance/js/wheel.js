// iOS-style wheel pickers: hours and minutes for time, an odometer of digit
// wheels for distance. Native scroll-snap does the physics; we add the 3D
// curve, a tick per notch, and keyboard support.

import { t } from "./i18n.js";
import { haptic } from "./ui.js";

const ITEM = 42;

class Wheel {
  constructor({ values, value = 0, label, cls = "", format = (v) => String(v), onChange }) {
    this.values = values;
    this.format = format;
    this.onChange = onChange;
    this.index = Math.max(0, values.indexOf(value));
    const el = document.createElement("div");
    el.className = `wheel ${cls}`;
    el.tabIndex = 0;
    el.setAttribute("role", "spinbutton");
    el.setAttribute("aria-label", label);
    el.setAttribute("aria-valuemin", values[0]);
    el.setAttribute("aria-valuemax", values[values.length - 1]);
    el.innerHTML = `<div class="pad"></div>${values.map((v) => `<div class="it">${format(v)}</div>`).join("")}<div class="pad"></div>`;
    this.el = el;
    this.items = [...el.querySelectorAll(".it")];
    this.raf = 0;
    el.addEventListener("scroll", () => {
      if (!this.raf) this.raf = requestAnimationFrame(() => this.update());
    }, { passive: true });
    el.addEventListener("keydown", (e) => this.key(e));
    el.addEventListener("click", (e) => {
      const it = e.target.closest(".it");
      if (it) this.set(this.items.indexOf(it), true);
    });
  }

  mount() {
    this.el.scrollTop = this.index * ITEM;
    this.update(true);
  }

  update(silent = false) {
    this.raf = 0;
    const top = this.el.scrollTop;
    const center = top / ITEM;
    const lo = Math.max(0, Math.floor(center) - 4), hi = Math.min(this.items.length - 1, Math.ceil(center) + 4);
    for (let i = lo; i <= hi; i++) {
      const off = i - center;
      const a = Math.max(-1, Math.min(1, off / 3.2));
      this.items[i].style.transform = `rotateX(${-a * 62}deg) scale(${1 - Math.abs(a) * 0.1})`;
      this.items[i].style.opacity = String(1 - Math.abs(a) * 0.55);
    }
    const idx = Math.max(0, Math.min(this.values.length - 1, Math.round(center)));
    if (idx !== this.index) {
      this.index = idx;
      this.aria();
      if (!silent) {
        haptic(4);
        this.onChange?.(this.value, true);
      }
    }
  }

  aria() {
    this.el.setAttribute("aria-valuenow", this.value);
    this.el.setAttribute("aria-valuetext", this.format(this.value));
  }

  get value() {
    return this.values[this.index];
  }

  set(i, smooth = false) {
    i = Math.max(0, Math.min(this.values.length - 1, i));
    this.el.scrollTo({ top: i * ITEM, behavior: smooth ? "smooth" : "auto" });
    if (!smooth) {
      this.index = i;
      this.update(true);
      this.aria();
    }
  }

  key(e) {
    const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
    if (step) {
      e.preventDefault();
      this.set(this.index + step, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      this.set(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      this.set(this.values.length - 1, true);
    }
  }
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// A picker that edits one number. measure: "time" (minutes) | "distance" (km)
export function createPicker(container, { measure, value, onTick, onChange }) {
  container.innerHTML = "";
  const box = document.createElement("div");
  box.className = "picker";
  box.innerHTML = `<div class="band"></div>`;
  container.append(box);
  const readout = document.createElement("div");
  readout.className = "picker-readout num";
  readout.setAttribute("aria-hidden", "true");
  container.append(readout);
  let touched = false;
  const wheels = [];
  const changed = (_, user) => {
    if (user) {
      touched = true;
      onTick?.();
    }
    onChange?.(api.value);
  };

  if (measure === "time") {
    const h = Math.floor(value / 60), m = value % 60;
    const hw = new Wheel({ values: range(0, 60), value: h, cls: "hours", label: t("hours"), onChange: changed });
    const mw = new Wheel({ values: range(0, 59), value: m, cls: "mins", label: t("mins"), format: (v) => String(v).padStart(2, "0"), onChange: changed });
    wheels.push(hw, mw);
    box.append(hw.el, unit(t("hours")), mw.el, unit(t("mins")));
  } else {
    const v = Math.round(value * 10);
    const digits = [Math.floor(v / 10000) % 10, Math.floor(v / 1000) % 10, Math.floor(v / 100) % 10, Math.floor(v / 10) % 10, v % 10];
    digits.forEach((d, i) => {
      const w = new Wheel({ values: range(0, 9), value: d, cls: "digit", label: `${t("km")} ${i + 1}`, onChange: changed });
      wheels.push(w);
      if (i === 4) {
        const dot = document.createElement("div");
        dot.className = "dotsep";
        dot.textContent = ".";
        box.append(dot);
      }
      box.append(w.el);
    });
    box.append(unit(t("km")));
    box.classList.add("digits");
  }

  const api = {
    get value() {
      if (measure === "time") return wheels[0].value * 60 + wheels[1].value;
      const [a, b, c, d, e] = wheels.map((w) => w.value);
      return a * 1000 + b * 100 + c * 10 + d + e / 10;
    },
    get touched() {
      return touched;
    },
    disable(on) {
      wheels.forEach((w) => {
        w.el.style.pointerEvents = on ? "none" : "";
        w.el.tabIndex = on ? -1 : 0;
      });
      box.style.opacity = on ? 0.55 : "";
    },
    focus() {
      wheels[0].el.focus({ preventScroll: true });
    },
  };
  requestAnimationFrame(() => {
    wheels.forEach((w) => w.mount());
    onChange?.(api.value);
  });
  return api;
}

function unit(text) {
  const u = document.createElement("div");
  u.className = "unit";
  u.textContent = text;
  return u;
}
