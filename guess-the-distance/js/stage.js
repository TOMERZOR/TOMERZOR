// The game screen pieces shared by solo games and duels: the stage over the
// map, the trip card, the timer ring, the number line and overlays.

import { $, html, esc, sleep, isDesktop } from "./ui.js";
import { t, word, placeName, fmtValue, fmtNum, fmtKm, tripArrow, iso } from "./i18n.js";
import { icon, MODE_COLORS } from "./icons.js";
import { artCanvas, paintArt } from "./art.js";
import * as gmap from "./map.js";
import * as audio from "./audio.js";
import { haversineKm } from "../core/geo.js";

export const stageUi = () => $("#stage-ui");

export function openStage(moodName = "game") {
  $("#tabbar").classList.add("away");
  const st = $("#stage");
  st.classList.add("on");
  st.setAttribute("aria-hidden", "false");
  document.querySelectorAll(".view").forEach((v) => v.setAttribute("inert", ""));
  gmap.initMap($("#map"));
  gmap.retryRealMap();
  requestAnimationFrame(() => gmap.invalidate());
  audio.setMood(moodName);
}

export function closeStage() {
  const st = $("#stage");
  st.classList.remove("on");
  st.setAttribute("aria-hidden", "true");
  $("#tabbar").classList.remove("away");
  document.querySelectorAll(".view").forEach((v) => v.removeAttribute("inert"));
  setTimeout(() => {
    if (!st.classList.contains("on")) {
      stageUi().innerHTML = "";
      gmap.clear();
    }
  }, 500);
  audio.setMood("menu");
}

// Room the map should leave for the floating UI.
// The column that holds the trip card and the guess sheet. On a phone it
// is invisible (display: contents) and they float over the map as before;
// on a desktop it is a side panel, like the sidebar in Apple Maps.
export function inspector() {
  const ui = stageUi();
  let col = ui.querySelector(".inspector");
  if (!col) {
    col = document.createElement("div");
    col.className = "inspector";
    ui.append(col);
  }
  return col;
}

// Room the map should leave for the floating UI.
export function mapPad() {
  const ui = stageUi();
  const trip = ui.querySelector(".trip");
  const sheet = ui.querySelector(".sheet");
  const col = ui.querySelector(".inspector");
  const rtl = document.dir === "rtl";
  const pad = { top: 70, bottom: 40, left: 40, right: 40 };
  if (isDesktop() && col) {
    // the side panel covers the start side; the top bar sits over the map
    const w = col.offsetWidth + 60;
    if (rtl) pad.right = w;
    else pad.left = w;
    pad.top = 110;
    pad.bottom = 60;
    return pad;
  }
  // Sizes come from layout, not getBoundingClientRect, so a sheet that is
  // still sliding in counts at its final place.
  if (trip) pad.top = trip.offsetTop + trip.offsetHeight + 24;
  if (sheet) pad.bottom = sheet.offsetHeight + 44;
  if (innerHeight - pad.top - pad.bottom < 120) pad.bottom = Math.max(40, innerHeight - pad.top - 120);
  return pad;
}

export function modeBadge(mode) {
  return `<div class="mode-badge" aria-hidden="true">${artCanvas(MODE_COLORS[mode] || MODE_COLORS.car, "badge-" + mode)}${icon(mode)}</div>`;
}

export function tripCard(round, { measure, extraTag = "" }) {
  const from = { ...round.from, street: round.from.street || round.route?.fromName };
  const to = { ...round.to, street: round.to.street || round.route?.toName };
  if (!round.from.near) from.street = round.from.street;
  if (!round.to.near) to.street = round.to.street;
  if (round.crowKm == null) round.crowKm = Math.round(haversineKm(from, to) * 10) / 10;
  const crow = measure === "time" && round.crowKm ? `<span class="tag">${icon("pin")}${esc(t("crow", { d: fmtKm(round.crowKm) }))}</span>` : "";
  const el = html(`
    <div class="trip glass enter" role="group" aria-label="${esc(placeName(from))} ${tripArrow()} ${esc(placeName(to))}">
      ${modeBadge(round.mode)}
      <div class="trip-places">
        <div class="trip-line"><span class="dot a"></span><span class="nm">${esc(placeName(from))}</span>${from.street ? `<span class="st">· ${esc(from.street)}</span>` : ""}</div>
        <div class="trip-line"><span class="dot b"></span><span class="nm">${esc(placeName(to))}</span>${to.street ? `<span class="st">· ${esc(to.street)}</span>` : ""}</div>
      </div>
      <div class="trip-meta"><span class="tag">${icon(round.mode)}${esc(word("modeWord", round.mode))}</span>${crow}${extraTag}</div>
    </div>`);
  requestAnimationFrame(() => paintArt(el));
  return el;
}

export function askText(round, measure) {
  const sub = { car: "askSubCar", foot: "askSubFoot", bike: "askSubBike", flight: "askSubFlight" }[round.mode];
  return { title: measure === "time" ? t("askTime") : round.mode === "flight" ? t("askDistanceFlight") : t("askDistance"), sub: t(sub) };
}

// A circular countdown. Returns { stop, set(msLeft) }.
export function timerRing(el, totalMs, { onEnd, onHurry } = {}) {
  el.classList.add("timer-ring");
  el.innerHTML = `<svg viewBox="0 0 56 56"><circle class="bg" cx="28" cy="28" r="25"/><circle class="fg" cx="28" cy="28" r="25"/></svg><span class="num"></span>`;
  const fg = el.querySelector(".fg");
  const label = el.querySelector("span");
  const C = 2 * Math.PI * 25;
  fg.style.strokeDasharray = `${C}`;
  let end = performance.now() + totalMs;
  let total = totalMs;
  let raf = 0, lastSec = -1, done = false;
  const frame = (now) => {
    const left = Math.max(0, end - now);
    fg.style.strokeDashoffset = String(C * (1 - left / total));
    const s = Math.ceil(left / 1000);
    if (s !== lastSec) {
      lastSec = s;
      label.textContent = s;
      el.classList.toggle("hurry", s <= 5);
      if (s <= 5 && s > 0) onHurry?.(s);
    }
    if (left <= 0) {
      if (!done) {
        done = true;
        onEnd?.();
      }
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    stop() { cancelAnimationFrame(raf); done = true; },
    set(msLeft, newTotal) {
      end = performance.now() + msLeft;
      if (newTotal) total = newTotal;
      done = false;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
  };
}

// The number line under a reveal: where the guesses landed vs the answer.
export function numberLine({ actual, you, opp, measure, oppName }) {
  const vals = [actual, you, opp].filter((v) => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const spread = hi - lo || hi * 0.3 || 1;
  const a = Math.max(0, lo - spread * 0.3), b = hi + spread * 0.3;
  // Mirrored in Hebrew, like every slider and progress bar: small on the right.
  const rtl = document.dir === "rtl";
  const pos = (v) => {
    const x = 6 + ((v - a) / (b - a)) * 88;
    return rtl ? 100 - x : x;
  };
  const tall = opp !== undefined;
  const el = html(`<div class="line ${tall ? "tall" : ""}" aria-hidden="true"><div class="axis"></div></div>`);
  const mk = (cls, v, label) => {
    const m = html(`<div class="mk ${cls}" style="left:50%;opacity:0"><span class="lb num" dir="${document.dir || "ltr"}">${esc(label)}</span><span class="pt"></span></div>`);
    el.append(m);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      m.style.left = pos(v) + "%";
      m.style.opacity = "1";
    }));
    return m;
  };
  if (you != null) {
    const gap = html(`<div class="gap"></div>`);
    const x1 = Math.min(pos(you), pos(actual)), x2 = Math.max(pos(you), pos(actual));
    gap.style.left = x1 + "%";
    gap.style.width = x2 - x1 + "%";
    gap.style.transform = "scaleX(0)";
    el.append(gap);
    setTimeout(() => (gap.style.transform = "scaleX(1)"), 500);
  }
  mk("actual", actual, fmtValue(actual, measure));
  if (you != null) mk("you low", you, `${t("you")} · ${iso(fmtValue(you, measure))}`);
  if (opp != null) {
    const near = you != null && Math.abs(pos(you) - pos(opp)) < 26;
    const nearActual = Math.abs(pos(actual) - pos(opp)) < 26;
    const m = mk(`opp ${near ? "" : "low"}`, opp, `${iso(oppName || "")} · ${iso(fmtValue(opp, measure))}`);
    if (near && nearActual) m.style.top = "70px";
  }
  return el;
}

export function sourceLine(route) {
  const key = route.source === "live" ? "srcLive" : route.source === "flight" ? "srcFlight" : "srcRef";
  return `<div class="src">${icon(route.source === "flight" ? "flight" : route.source === "live" ? "check" : "info")}<span>${esc(t(key))}</span></div>`;
}

// What the other measure says, under the big answer.
export function altLine(route, measure) {
  if (measure === "time") {
    const speed = route.km && route.min ? Math.round(route.km / (route.min / 60)) : null;
    return `${fmtKm(route.km)}${speed ? ` · ${t("speed", { n: fmtNum(speed) })}` : ""}`;
  }
  return fmtValue(route.min, "time");
}

// ---------- overlay ----------
let overlayClose = null;
export function overlay(content, { onClose, cls = "" } = {}) {
  const o = $("#overlay");
  const panel = $("#overlay-panel");
  panel.className = `panel ${cls}`;
  panel.innerHTML = "";
  if (typeof content === "string") panel.innerHTML = content;
  else panel.append(content);
  overlayClose = onClose || null;
  o.classList.remove("on");
  void o.offsetWidth;
  o.classList.add("on");
  paintArt(panel);
  return panel;
}

export function closeOverlay() {
  const o = $("#overlay");
  if (!o.classList.contains("on")) return;
  o.classList.remove("on");
  const fn = overlayClose;
  overlayClose = null;
  fn?.();
}

export function overlayOpen() {
  return $("#overlay").classList.contains("on");
}

export function loadingPanel(title, sub, emoji = "🧭") {
  return `
    <div class="loader-art">
      <div class="ring"></div><div class="ring"></div><div class="ring"></div>
      <div class="core">${emoji}</div>
    </div>
    <h2 class="big-title">${esc(title)}</h2>
    <p class="muted">${esc(sub)}</p>`;
}

export async function brief(contentHtml, ms = 1300) {
  overlay(contentHtml, { cls: "round-intro" });
  await sleep(ms);
  closeOverlay();
}

export function rankFor(total, max) {
  const p = total / max;
  return p >= 0.9 ? "rank4" : p >= 0.75 ? "rank3" : p >= 0.55 ? "rank2" : p >= 0.35 ? "rank1" : "rank0";
}

export function scoreEmoji(s) {
  return s >= 5000 ? "🟪" : s >= 4000 ? "🟩" : s >= 2800 ? "🟨" : s >= 1500 ? "🟧" : "🟥";
}
