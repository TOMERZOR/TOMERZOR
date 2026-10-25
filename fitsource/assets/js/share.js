// "Fit receipt": a story-sized image listing every piece, made on a canvas
// so people can post it. Nothing is uploaded. Laid out right to left.
import { html, icon, money, STATUS_TEXT, LOCALE } from "./ui.js";

const W = 1080;
const H = 1920;
const M = 64;

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "...").width > maxWidth) t = t.slice(0, -1);
  return t.trimEnd() + "...";
}

// Hebrew text runs right to left; a Latin product name like "1951 Raw Selvedge" keeps its own order.
const dirOf = (text) => (/[\u0590-\u05FF]/.test(text) ? "rtl" : "ltr");
function fillDir(ctx, text, x, y) {
  const prev = ctx.direction;
  ctx.direction = dirOf(text);
  ctx.fillText(text, x, y);
  ctx.direction = prev;
}

const font = (weight, size, family = "Archivo") => `${weight} ${size}px "${family}", "Heebo", system-ui, sans-serif`;

export async function drawReceipt({ title, by, photo, items }) {
  await Promise.all([document.fonts.load(font(800, 60)), document.fonts.load(font(600, 34)), document.fonts.load(font(500, 26, "Geist Mono")), document.fonts.load(font(700, 34, "Heebo"), "אבג")]).catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const ink = "#121214", paper = "#f1f1ee", grey = "#66666d", volt = "#c9f23a", red = "#bf3319";

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  ctx.direction = "rtl";

  // header: mark + wordmark on the right, receipt label on the left
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  const s = 52, mx = W - M - s, my = 60;
  ctx.beginPath();
  ctx.moveTo(mx, my + 16); ctx.lineTo(mx, my); ctx.lineTo(mx + 16, my);
  ctx.moveTo(mx + s - 16, my); ctx.lineTo(mx + s, my); ctx.lineTo(mx + s, my + 16);
  ctx.moveTo(mx + s, my + s - 16); ctx.lineTo(mx + s, my + s); ctx.lineTo(mx + s - 16, my + s);
  ctx.moveTo(mx + 16, my + s); ctx.lineTo(mx, my + s); ctx.lineTo(mx, my + s - 16);
  ctx.stroke();
  ctx.fillStyle = volt;
  ctx.beginPath();
  ctx.arc(mx + s / 2, my + s / 2, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  if ("fontStretch" in ctx) ctx.fontStretch = "ultra-expanded";
  ctx.fillStyle = ink;
  ctx.font = font(850, 44);
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.direction = "ltr";
  ctx.fillText("FITSOURCE", mx - 20, my + s / 2 + 2);
  ctx.direction = "rtl";
  if ("fontStretch" in ctx) ctx.fontStretch = "normal";
  ctx.font = font(700, 26, "Geist Mono");
  ctx.textAlign = "left";
  ctx.fillText("קבלה ללוק", M, my + 14);
  ctx.fillStyle = grey;
  ctx.font = font(600, 24, "Geist Mono");
  ctx.fillText(new Date().toLocaleDateString(LOCALE, { day: "2-digit", month: "short", year: "numeric" }), M, my + 44);
  ctx.textAlign = "right";

  // photo, fitted whole inside the frame so every dot is visible
  const fx = M, fy = 150, fw = W - 2 * M, fh = 960;
  const img = await loadImg(photo);
  const scale = Math.min(fw / img.naturalWidth, fh / img.naturalHeight);
  const pw = Math.round(img.naturalWidth * scale), ph = Math.round(img.naturalHeight * scale);
  const px = fx + Math.round((fw - pw) / 2), py = fy + Math.round((fh - ph) / 2);
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 28);
  ctx.clip();
  ctx.drawImage(img, px, py, pw, ph);
  ctx.restore();
  const shown = items.slice(0, 6);
  shown.forEach((it, i) => {
    if (it.x == null) return;
    const ix = px + (it.x / 100) * pw;
    const iy = py + (it.y / 100) * ph;
    ctx.beginPath();
    ctx.arc(ix, iy, 26, 0, Math.PI * 2);
    ctx.fillStyle = it.status === "sold_out" ? red : volt;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = it.status === "sold_out" ? "#fff" : ink;
    ctx.stroke();
    ctx.fillStyle = it.status === "sold_out" ? "#fff" : ink;
    ctx.font = font(700, 24, "Geist Mono");
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), ix, iy + 1);
    ctx.textAlign = "right";
  });

  // title
  let y = fy + fh + 70;
  if ("fontStretch" in ctx) ctx.fontStretch = "ultra-expanded";
  ctx.fillStyle = ink;
  ctx.font = font(850, 54);
  fillDir(ctx, fit(ctx, (title || "הלוק שלי").toUpperCase(), W - 2 * M), W - M, y);
  if ("fontStretch" in ctx) ctx.fontStretch = "normal";
  y += 48;
  ctx.fillStyle = grey;
  ctx.font = font(500, 26, "Geist Mono");
  fillDir(ctx, fit(ctx, by || "", W - 2 * M), W - M, y);

  // item lines
  y += 46;
  const dash = () => {
    ctx.strokeStyle = "#c4c4be";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 9]);
    ctx.beginPath();
    ctx.moveTo(M, y);
    ctx.lineTo(W - M, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  dash();
  const rowH = Math.min(96, Math.floor((H - 250 - y) / Math.max(1, shown.length)));
  const totals = {};
  shown.forEach((it, i) => {
    const cy = y + rowH / 2 + 2;
    ctx.fillStyle = grey;
    ctx.font = font(600, 24, "Geist Mono");
    ctx.fillText(String(i + 1).padStart(2, "0"), W - M, cy - 14);
    const priceText = it.price != null ? money(it.price, it.currency || "ILS").replace(/\u200f/g, "") : "";
    const statusText = it.status ? STATUS_TEXT[it.status] || "" : "";
    ctx.font = font(600, 28, "Geist Mono");
    const rightW = Math.max(ctx.measureText(priceText).width, 160);
    ctx.fillStyle = ink;
    ctx.font = font(650, 33);
    fillDir(ctx, fit(ctx, it.name, W - 2 * M - 70 - rightW - 24), W - M - 70, cy - 14);
    ctx.fillStyle = grey;
    ctx.font = font(500, 23, "Geist Mono");
    fillDir(ctx, fit(ctx, (it.brand || "").toUpperCase(), W - 2 * M - 70 - rightW - 24), W - M - 70, cy + 22);
    ctx.textAlign = "left";
    ctx.fillStyle = ink;
    ctx.font = font(600, 30, "Geist Mono");
    ctx.fillText(priceText, M, cy - 14);
    if (statusText) {
      ctx.font = font(700, 20, "Geist Mono");
      ctx.fillStyle = it.status === "sold_out" ? red : it.status === "low_stock" ? "#a05f00" : grey;
      ctx.fillText(statusText, M, cy + 22);
    }
    ctx.textAlign = "right";
    if (it.price != null) totals[it.currency || "ILS"] = (totals[it.currency || "ILS"] || 0) + it.price;
    y += rowH;
  });
  if (items.length > shown.length) {
    ctx.fillStyle = grey;
    ctx.font = font(500, 24, "Geist Mono");
    ctx.fillText(`ועוד ${items.length - shown.length}`, W - M - 70, y + 10);
    y += 34;
  }
  dash();
  if (Object.keys(totals).length) {
    y += 52;
    ctx.fillStyle = ink;
    ctx.font = font(750, 32);
    ctx.fillText("סה״כ", W - M, y);
    ctx.textAlign = "left";
    ctx.font = font(650, 34, "Geist Mono");
    ctx.fillText(Object.entries(totals).map(([c, v]) => money(v, c).replace(/\u200f/g, "")).join(" + "), M, y);
    ctx.textAlign = "right";
  }

  // footer: barcode on the right, where to scan on the left
  const by0 = H - 150;
  let bx = W - M;
  const seed = [...(title || "fit")].reduce((a, c) => a + c.charCodeAt(0), 7);
  for (let k = 0; bx > W - M - 360; k++) {
    const w = 3 + ((seed * (k + 3)) % 7);
    ctx.fillStyle = k % 2 ? paper : ink;
    ctx.fillRect(bx - w, by0, w, 70);
    bx -= w;
  }
  ctx.fillStyle = ink;
  ctx.font = font(700, 28, "Geist Mono");
  ctx.textAlign = "left";
  ctx.fillText("סרקו כל לוק", M, by0 + 22);
  ctx.fillStyle = grey;
  ctx.font = font(500, 24, "Geist Mono");
  ctx.direction = "ltr";
  ctx.fillText(fit(ctx, (location.host + location.pathname).replace(/index\.html$/, "").replace(/\/$/, ""), 560), M, by0 + 58);
  ctx.direction = "rtl";

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}

/** Draw the receipt and show it with download / share buttons. */
export async function openReceipt(data) {
  const blob = await drawReceipt(data);
  const url = URL.createObjectURL(blob);
  const file = new File([blob], "fitsource-receipt.png", { type: "image/png" });
  const canShare = navigator.canShare && navigator.canShare({ files: [file] });
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "קבלה ללוק");
  modal.innerHTML = html`<div class="modal__card">
    <div class="modal__head"><h2 class="h3">הקבלה של הלוק</h2><button type="button" class="iconbtn" data-close aria-label="סגירה">${icon("x")}</button></div>
    <img src="${url}" alt="קבלה עם כל הפריטים בלוק">
    <div class="modal__actions">
      <a class="btn" href="${url}" download="fitsource-receipt.png">${icon("download-simple")}הורדה</a>
      ${canShare ? html`<button type="button" class="btn btn--accent" data-share>${icon("share-network")}שיתוף</button>` : ""}
    </div>
  </div>`.s;
  const prevFocus = document.activeElement;
  const close = () => {
    if (!modal.isConnected) return;
    modal.remove();
    URL.revokeObjectURL(url);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("hashchange", close);
    prevFocus && prevFocus.isConnected && prevFocus.focus && prevFocus.focus();
  };
  const onKey = (e) => e.key === "Escape" && close();
  window.addEventListener("hashchange", close); // Back button closes it too
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(modal);
  modal.querySelector("[data-close]").focus();
  const shareBtn = modal.querySelector("[data-share]");
  shareBtn &&
    shareBtn.addEventListener("click", () => {
      navigator.share({ files: [file], title: "הלוק שלי, עם מקור", text: "כל פריט ואיפה לקנות אותו, דרך FitSource" }).catch(() => {});
    });
}
