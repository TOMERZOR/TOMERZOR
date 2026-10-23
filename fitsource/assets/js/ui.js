// Small rendering helpers shared by every view.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
/** Mark a string as already-safe HTML. */
export const raw = (s) => new Raw(String(s ?? ""));

function flat(v) {
  if (v == null || v === false) return "";
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(flat).join("");
  return esc(v);
}

/** Tagged template: interpolations are escaped unless wrapped in raw() or nested html``. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += flat(values[i]) + strings[i + 1];
  return new Raw(out);
}

export const icon = (name, cls = "") => raw(`<svg class="i ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`);

export const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const CURRENCY_SYMBOL = { USD: "$", EUR: "€", GBP: "£", ILS: "₪", JPY: "¥", CAD: "CA$", AUD: "A$" };

export function money(amount, currency = "USD") {
  if (amount == null || !Number.isFinite(Number(amount))) return "";
  const n = Number(amount);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${CURRENCY_SYMBOL[currency] || ""}${n.toFixed(n % 1 ? 2 : 0)}`;
  }
}

export function compact(n) {
  try {
    return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(n);
  }
}

export const STATUS_TEXT = {
  in_stock: "In stock",
  low_stock: "Low stock",
  sold_out: "Sold out",
  preorder: "Pre-order",
  unknown: "Check stock",
};

/** Stock chip. Sold out renders as a rubber stamp. */
export function statusChip(status, extra = "") {
  const s = STATUS_TEXT[status] ? status : "unknown";
  return html`<span class="status status--${s.replace("_", "-")}">${STATUS_TEXT[s]}${extra ? html`<span class="status__extra">${extra}</span>` : ""}</span>`;
}

// ---------- toast ----------
let toastTimer = null;
export function toast(message, { action, onAction, tone } = {}) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.innerHTML = html`<span>${message}</span>${action ? html`<button type="button" class="toast__action">${action}</button>` : ""}`.s;
  el.dataset.tone = tone || "";
  if (action && onAction) el.querySelector(".toast__action").onclick = () => {
    onAction();
    el.classList.remove("is-on");
  };
  requestAnimationFrame(() => el.classList.add("is-on"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-on"), action ? 6000 : 3200);
}

// ---------- reveal on scroll ----------
let observer = null;
export function observeReveals(root = document) {
  const els = root.querySelectorAll("[data-reveal]:not(.is-in)");
  if (reduceMotion() || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-in"));
    return;
  }
  observer ||= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          observer.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  els.forEach((el) => observer.observe(el));
}

/** Count a number up when it scrolls into view (`data-count="1234"`). */
export function animateCounts(root = document) {
  root.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion() || !Number.isFinite(target)) {
      el.textContent = compact(target);
      return;
    }
    const start = performance.now();
    const dur = 900;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = compact(Math.round(target * eased));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    ta.remove();
  }
  return Promise.resolve();
}

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
