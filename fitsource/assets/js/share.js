// "Fit receipt": a story-sized image listing every piece, made on a canvas
// so people can post it. Nothing is uploaded.
import { html, icon, money, STATUS_TEXT } from "./ui.js";

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

const font = (weight, size, family = "Archivo") => `${weight} ${size}px "${family}", system-ui, sans-serif`;

export async function drawReceipt({ title, by, photo, items }) {
  await Promise.all([document.fonts.load(font(800, 60)), document.fonts.load(font(600, 34)), document.fonts.load(font(500, 26, "Geist Mono"))]).catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const ink = "#121214", paper = "#f1f1ee", grey = "#66666d", volt = "#c9f23a", red = "#d63d22";

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);

  // header: mark + wordmark, receipt label
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  const mx = M, my = 60, s = 52;
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
  ctx.fillText("FITSOURCE", mx + s + 20, my + s / 2 + 2);
  if ("fontStretch" in ctx) ctx.fontStretch = "normal";
  ctx.font = font(600, 24, "Geist Mono");
  ctx.textAlign = "right";
  ctx.fillText("FIT RECEIPT", W - M, my + 14);
  ctx.fillStyle = grey;
  ctx.fillText(new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }).toUpperCase(), W - M, my + 44);
  ctx.textAlign = "left";

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
    ctx.textAlign = "left";
  });

  // title
  let y = fy + fh + 70;
  if ("fontStretch" in ctx) ctx.fontStretch = "ultra-expanded";
  ctx.fillStyle = ink;
  ctx.font = font(850, 54);
  ctx.fillText(fit(ctx, (title || "My fit").toUpperCase(), W - 2 * M), M, y);
  if ("fontStretch" in ctx) ctx.fontStretch = "normal";
  y += 48;
  ctx.fillStyle = grey;
  ctx.font = font(500, 26, "Geist Mono");
  ctx.fillText(fit(ctx, by || "", W - 2 * M), M, y);

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
    ctx.fillText(String(i + 1).padStart(2, "0"), M, cy - 14);
    const priceText = it.price != null ? money(it.price, it.currency || "USD") : "";
    const statusText = it.status ? STATUS_TEXT[it.status] || "" : "";
    ctx.font = font(600, 28, "Geist Mono");
    const rightW = Math.max(ctx.measureText(priceText).width, 160);
    ctx.fillStyle = ink;
    ctx.font = font(650, 33);
    ctx.fillText(fit(ctx, it.name, W - 2 * M - 70 - rightW - 24), M + 70, cy - 14);
    ctx.fillStyle = grey;
    ctx.font = font(500, 23, "Geist Mono");
    ctx.fillText(fit(ctx, (it.brand || "").toUpperCase(), W - 2 * M - 70 - rightW - 24), M + 70, cy + 22);
    ctx.textAlign = "right";
    ctx.fillStyle = ink;
    ctx.font = font(600, 30, "Geist Mono");
    ctx.fillText(priceText, W - M, cy - 14);
    if (statusText) {
      ctx.font = font(700, 20, "Geist Mono");
      ctx.fillStyle = it.status === "sold_out" ? red : it.status === "low_stock" ? "#a05f00" : grey;
      ctx.fillText(statusText.toUpperCase(), W - M, cy + 22);
    }
    ctx.textAlign = "left";
    if (it.price != null) totals[it.currency || "USD"] = (totals[it.currency || "USD"] || 0) + it.price;
    y += rowH;
  });
  if (items.length > shown.length) {
    ctx.fillStyle = grey;
    ctx.font = font(500, 24, "Geist Mono");
    ctx.fillText(`+ ${items.length - shown.length} more`, M + 70, y + 10);
    y += 34;
  }
  dash();
  if (Object.keys(totals).length) {
    y += 52;
    ctx.fillStyle = ink;
    ctx.font = font(750, 32);
    ctx.fillText("TOTAL", M, y);
    ctx.textAlign = "right";
    ctx.font = font(650, 34, "Geist Mono");
    ctx.fillText(Object.entries(totals).map(([c, v]) => money(v, c)).join(" + "), W - M, y);
    ctx.textAlign = "left";
  }

  // footer: barcode and where to scan
  const by0 = H - 150;
  let bx = M;
  const seed = [...(title || "fit")].reduce((a, c) => a + c.charCodeAt(0), 7);
  for (let k = 0; bx < M + 360; k++) {
    const w = 3 + ((seed * (k + 3)) % 7);
    ctx.fillStyle = k % 2 ? paper : ink;
    ctx.fillRect(bx, by0, w, 70);
    bx += w;
  }
  ctx.fillStyle = ink;
  ctx.font = font(600, 26, "Geist Mono");
  ctx.textAlign = "right";
  ctx.fillText("SCAN ANY FIT", W - M, by0 + 22);
  ctx.fillStyle = grey;
  ctx.font = font(500, 24, "Geist Mono");
  ctx.fillText(fit(ctx, (location.host + location.pathname).replace(/index\.html$/, "").replace(/\/$/, ""), 560), W - M, by0 + 58);
  ctx.textAlign = "left";

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
  modal.setAttribute("aria-label", "Fit receipt");
  modal.innerHTML = html`<div class="modal__card">
    <div class="modal__head"><h2 class="h3">Your fit receipt</h2><button type="button" class="iconbtn" data-close aria-label="Close">${icon("x")}</button></div>
    <img src="${url}" alt="Fit receipt listing every piece">
    <div class="modal__actions">
      <a class="btn" href="${url}" download="fitsource-receipt.png">${icon("download-simple")}Download</a>
      ${canShare ? html`<button type="button" class="btn btn--accent" data-share>${icon("share-network")}Share</button>` : ""}
    </div>
  </div>`.s;
  const prevFocus = document.activeElement;
  const close = () => {
    modal.remove();
    URL.revokeObjectURL(url);
    document.removeEventListener("keydown", onKey);
    prevFocus && prevFocus.focus && prevFocus.focus();
  };
  const onKey = (e) => e.key === "Escape" && close();
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(modal);
  modal.querySelector("[data-close]").focus();
  const shareBtn = modal.querySelector("[data-share]");
  shareBtn &&
    shareBtn.addEventListener("click", () => {
      navigator.share({ files: [file], title: "My fit, sourced", text: "Every piece and where to buy it, via FitSource" }).catch(() => {});
    });
}
