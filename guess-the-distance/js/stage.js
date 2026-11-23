// The game screen pieces shared by solo games and duels: the stage over the
// night map, the trip card, the timer ring, the reveal (score sticker,
// number line, the ten-segment points bar) and the overlays.

import { $, html, esc, sleep, isDesktop, reducedMotion } from "./ui.js";
import { t, word, placeName, fmtValue, fmtNum, fmtKm, iso, splitMin, getLang } from "./i18n.js";
import { icon, img3d, coin, MODE_3D, MODE_TONE } from "./icons.js";
import { iconBtn } from "./kit.js";
import * as gmap from "./map.js";
import * as audio from "./audio.js";
import { haversineKm } from "../core/geo.js";
import { verdict, MAX_ROUND } from "../core/scoring.js";

export const stageUi = () => $("#stage-ui");

// Into a round: the lobby steps back (smaller, blurred) and the night map
// comes up under it. closeStage() runs it the other way.
export function openStage(moodName = "game") {
  document.body.classList.add("in-round");
  $("#tabbar").classList.add("away");
  const st = $("#stage");
  st.classList.add("on");
  st.setAttribute("aria-hidden", "false");
  document.querySelectorAll(".view, #sidebar").forEach((v) => v.setAttribute("inert", ""));
  gmap.initMap($("#map"));
  gmap.retryRealMap();
  requestAnimationFrame(() => gmap.invalidate());
  audio.setMood(moodName);
}

export function closeStage() {
  const st = $("#stage");
  st.classList.remove("on");
  st.setAttribute("aria-hidden", "true");
  document.body.classList.remove("in-round");
  $("#tabbar").classList.remove("away");
  document.querySelectorAll(".view, #sidebar").forEach((v) => v.removeAttribute("inert"));
  setTimeout(() => {
    if (!st.classList.contains("on")) {
      stageUi().innerHTML = "";
      gmap.clear();
    }
  }, 500);
  audio.setMood("menu");
}

// The column that holds the trip card and the guess sheet. On a phone it is
// invisible (display: contents) and they float over the map; on a desktop it
// is a glass side panel next to the map.
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

// Zoom buttons for a mouse (desktop only, by CSS).
export function zoomTools() {
  const ui = stageUi();
  if (ui.querySelector(".zoom-tools")) return;
  const el = html(`<div class="zoom-tools">${iconBtn({ ico: "plus", label: t("zoomIn"), hud: true, id: "zoom-in" })}${iconBtn({ ico: "minus", label: t("zoomOut"), hud: true, id: "zoom-out" })}</div>`);
  el.querySelector("#zoom-in").addEventListener("click", () => gmap.zoomBy(1));
  el.querySelector("#zoom-out").addEventListener("click", () => gmap.zoomBy(-1));
  ui.append(el);
}

// Room the map should leave for the floating UI, so both pins stay in sight.
export function mapPad() {
  const ui = stageUi();
  const trip = ui.querySelector(".trip");
  const sheet = ui.querySelector(".sheet");
  const col = ui.querySelector(".inspector");
  const rtl = document.dir === "rtl";
  const pad = { top: 80, bottom: 40, left: 40, right: 40 };
  if (isDesktop() && col) {
    document.documentElement.style.setProperty("--attr-lift", "0px");
    const w = col.offsetWidth + 70;
    if (rtl) pad.right = w;
    else pad.left = w;
    pad.top = 120;
    pad.bottom = 70;
    return pad;
  }
  // Sizes come from layout, not getBoundingClientRect, so a sheet that is
  // still sliding in counts at its final place.
  if (trip) pad.top = trip.offsetTop + trip.offsetHeight + 34;
  if (sheet) pad.bottom = sheet.offsetHeight + 40;
  if (innerHeight - pad.top - pad.bottom < 120) pad.bottom = Math.max(40, innerHeight - pad.top - 120);
  pad.left = pad.right = 34;
  document.documentElement.style.setProperty("--attr-lift", `${sheet ? sheet.offsetHeight : 0}px`);
  return pad;
}

// The 3D picture of the way of travel on a tile of its color.
export function modeBadge(mode, size = 44) {
  const tone = MODE_TONE[mode] || "lime";
  return `<span class="mode-badge c-${tone}" aria-hidden="true">${img3d(MODE_3D[mode] || "car", { size, lazy: false })}</span>`;
}

export function tripCard(round, { measure, extraTag = "" }) {
  const from = { ...round.from, street: round.from.street || round.route?.fromName };
  const to = { ...round.to, street: round.to.street || round.route?.toName };
  if (!round.from.near) from.street = round.from.street;
  if (!round.to.near) to.street = round.to.street;
  if (round.crowKm == null) round.crowKm = Math.round(haversineKm(from, to) * 10) / 10;
  const crow = measure === "time" && round.crowKm ? `<span class="tag">${icon("pin")}<span>${esc(t("crow", { d: fmtKm(round.crowKm) }))}</span></span>` : "";
  const el = html(`
    <div class="trip glass enter" role="group" aria-label="${esc(placeName(from))} ${tripArrowText()} ${esc(placeName(to))}">
      ${modeBadge(round.mode)}
      <div class="trip-places">
        <div class="trip-line"><i class="dot a" aria-hidden="true"></i><b class="nm">${esc(placeName(from))}</b>${from.street ? `<span class="st">· ${esc(from.street)}</span>` : ""}</div>
        <div class="trip-line"><i class="dot b" aria-hidden="true"></i><b class="nm">${esc(placeName(to))}</b>${to.street ? `<span class="st">· ${esc(to.street)}</span>` : ""}</div>
      </div>
      <div class="trip-meta"><span class="tag">${icon(round.mode)}<span>${esc(word("modeWord", round.mode))}</span></span>${crow}${extraTag}</div>
    </div>`);
  return el;
}

const tripArrowText = () => (document.dir === "rtl" ? "←" : "→");

export function askText(round, measure) {
  const sub = { car: "askSubCar", foot: "askSubFoot", bike: "askSubBike", flight: "askSubFlight" }[round.mode];
  return { title: measure === "time" ? t("askTime") : round.mode === "flight" ? t("askDistanceFlight") : t("askDistance"), sub: t(sub) };
}

// A circular countdown: lime, then coral and pulsing for the last 5
// seconds. Returns { stop, set(msLeft) }.
export function timerRing(el, totalMs, { onEnd, onHurry } = {}) {
  el.classList.add("timer-ring");
  const R = 27;
  el.innerHTML = `<svg viewBox="0 0 62 62" aria-hidden="true"><circle class="bg" cx="31" cy="31" r="${R}"/><circle class="fg" cx="31" cy="31" r="${R}"/></svg><span class="num"></span>`;
  const fg = el.querySelector(".fg");
  const label = el.querySelector("span");
  const C = 2 * Math.PI * R;
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

// The score sticker, tilted -6 degrees, colored by how good the guess was.
const VERDICT_TONE = { perfect: "gold", amazing: "lime", great: "mint", good: "sky", ok: "sun", miss: "coral" };
export function verdictSticker(score, line) {
  const v = verdict(score);
  return `<div class="verdict c-${VERDICT_TONE[v]}" id="verdict">${v === "perfect" ? img3d("star", { size: 46, lazy: false }) : ""}<b>${esc(t(v))}</b>${line ? `<span>${line}</span>` : ""}</div>`;
}

export function showVerdict(el) {
  el?.classList.add("in");
}

// Ten segments that light up one after another as the points come in.
export function meter10(id = "meter") {
  return `<div class="meter10" id="${id}" role="meter" aria-valuemin="0" aria-valuemax="${MAX_ROUND}" aria-valuenow="0">${"<i></i>".repeat(10)}</div>`;
}

export function runMeter(el, score, ms = 1400) {
  if (!el) return;
  el.setAttribute("aria-valuenow", String(score));
  const segs = [...el.querySelectorAll("i")];
  const v = verdict(score);
  el.style.setProperty("--seg-c", `var(--${{ perfect: "sun", amazing: "lime", great: "mint", good: "sky", ok: "sun", miss: "coral" }[v]})`);
  const per = MAX_ROUND / 10;
  const full = Math.floor(score / per);
  const rest = (score % per) / per;
  const lit = full + (rest > 0.04 ? 1 : 0);
  const step = lit ? ms / lit : 0;
  segs.forEach((s, i) => {
    const on = () => {
      if (i < full) s.classList.add("on");
      else if (i === full && rest > 0.04) {
        s.style.setProperty("--p", `${Math.round(rest * 100)}%`);
        s.classList.add("part");
      }
    };
    if (reducedMotion()) on();
    else setTimeout(on, step * i);
  });
}

// The number line under a reveal: where the guesses landed vs the answer.
// Guesses are avatar coins, the answer is a flag.
export function numberLine({ actual, you, opp, measure, oppName, youAvatar, oppAvatar }) {
  const vals = [actual, you, opp].filter((v) => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const spread = hi - lo || hi * 0.3 || 1;
  const a = Math.max(0, lo - spread * 0.3), b = hi + spread * 0.3;
  // Mirrored in Hebrew, like every slider and progress bar: small on the right.
  const rtl = document.dir === "rtl";
  const pos = (v) => {
    const x = 7 + ((v - a) / (b - a)) * 86;
    return rtl ? 100 - x : x;
  };
  const tall = opp !== undefined;
  const el = html(`<div class="nline ${tall ? "tall" : ""}" aria-hidden="true"><div class="rail"></div></div>`);
  const mk = (cls, v, inner) => {
    const m = html(`<div class="mk ${cls}" style="left:50%;opacity:0">${inner}</div>`);
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
  const dir = document.dir || "ltr";
  mk("actual", actual, `<span class="lb num" dir="${dir}">${esc(fmtValue(actual, measure))}</span><span class="flag">${icon("flag")}</span>`);
  if (you != null) mk("you low", you, `${coin(youAvatar || "🙂", { size: 34 })}<span class="lb" dir="${dir}">${esc(t("you"))} · ${esc(iso(fmtValue(you, measure)))}</span>`);
  if (opp != null) {
    const near = you != null && Math.abs(pos(you) - pos(opp)) < 24;
    const m = mk(`opp ${near ? "" : "low"}`, opp, near
      ? `<span class="lb" dir="${dir}">${esc(iso(oppName || ""))} · ${esc(iso(fmtValue(opp, measure)))}</span>${coin(oppAvatar || "🙂", { size: 34 })}`
      : `${coin(oppAvatar || "🙂", { size: 34 })}<span class="lb" dir="${dir}">${esc(iso(oppName || ""))} · ${esc(iso(fmtValue(opp, measure)))}</span>`);
    const nearActual = Math.abs(pos(actual) - pos(opp)) < 24;
    if (near && nearActual) m.style.top = "74px";
  }
  return el;
}

// The big answer in Karantina: numbers big, units small and lime. Every
// digit sits in a fixed-width box, so the count-up doesn't make them dance.
const boxes = (s) => [...s].map((ch) => (/\d/.test(ch) ? `<i>${ch}</i>` : `<b>${ch}</b>`)).join("");
export function answerHtml(v, measure) {
  if (measure === "time") {
    const { h, m } = splitMin(v);
    const H = esc(t("hours")), M = esc(t("mins"));
    if (!h) return `<span class="num">${boxes(String(m))}</span><small>${M}</small>`;
    if (!m) return `<span class="num">${boxes(String(h))}</span><small>${H}</small>`;
    return `<span class="num">${boxes(String(h))}</span><small>${H}</small><span class="num">${boxes(String(m))}</span><small>${M}</small>`;
  }
  const val = v < 20 ? Math.round(v * 10) / 10 : Math.round(v);
  const nf = new Intl.NumberFormat(getLang() === "he" ? "he-IL" : "en-US");
  return `<span class="num">${boxes(nf.format(val))}</span><small>${esc(t("km"))}</small>`;
}

// A big Karantina number (the summary total), digits in fixed boxes.
export function bigNumHtml(v) {
  return boxes(fmtNum(v));
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
// look: "screen" (the lobby world, full screen on a phone), "dim" (a window
// over what's behind), "night" (the radar), "clear" (over the map), "vs".
let overlayClose = null;
export function overlay(content, { onClose, cls = "", look = "screen" } = {}) {
  const o = $("#overlay");
  const panel = $("#overlay-panel");
  o.className = `overlay ${look}`;
  panel.className = `panel ${cls}`;
  panel.innerHTML = "";
  if (typeof content === "string") panel.innerHTML = content;
  else panel.append(content);
  overlayClose = onClose || null;
  o.classList.remove("on");
  void o.offsetWidth;
  o.classList.add("on");
  o.scrollTop = 0;
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

// A lime radar on a night map. core: HTML for the middle (an avatar coin,
// a map's art).
export function loadingPanel(title, sub, core) {
  return `
    <div class="radar" aria-hidden="true"><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="grid"></div><div class="sweep"></div><div class="core">${core}</div></div>
    <h2 class="big-title">${esc(title)}</h2>
    <p class="muted" id="radar-sub">${esc(sub)}</p>`;
}

export async function brief(contentHtml, ms = 1300) {
  overlay(contentHtml, { cls: "round-intro", look: "clear" });
  await sleep(ms);
  closeOverlay();
}

export function rankFor(total, max) {
  const p = total / max;
  return p >= 0.9 ? "rank4" : p >= 0.75 ? "rank3" : p >= 0.55 ? "rank2" : p >= 0.35 ? "rank1" : "rank0";
}

// One square per round in the share grid. A perfect guess is a glowing
// star now, like the 3D star of the reveal.
export function scoreEmoji(s) {
  return s >= 5000 ? "🌟" : s >= 4000 ? "🟩" : s >= 2800 ? "🟨" : s >= 1500 ? "🟧" : "🟥";
}

// Grids saved before the redesign used a purple square for a perfect
// round. Show and share them with the star, without touching what's saved.
export function displayGrid(grid) {
  return String(grid || "").replaceAll("\u{1F7EA}", "🌟");
}
