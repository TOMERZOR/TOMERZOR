// Solo games, the GeoGuessr single-player set: Classic, Daily Challenge,
// Streak, Time Attack, and Challenge a Friend (a shareable link that replays
// the same rounds).

import { $, html, esc, countUp, confetti, haptic, toast, sleep, reducedMotion, isDesktop } from "./ui.js";
import { t, word, placeName, fmtNum, fmtTimeHtml, fmtKmHtml, fmtValue, getLang, tripArrow, iso } from "./i18n.js";
import { icon, MODE_COLORS } from "./icons.js";
import { artCanvas, paintArt } from "./art.js";
import { createPicker } from "./wheel.js";
import { getRounds } from "./net.js";
import { roundScore, verdict, relError, MAX_ROUND, STREAK_PASS } from "../core/scoring.js";
import { MAPS } from "../core/places.js";
import { randomSeed, dayKey } from "../core/rng.js";
import * as gmap from "./map.js";
import * as audio from "./audio.js";
import { openStage, closeStage, stageUi, inspector, mapPad, tripCard, askText, timerRing, numberLine, sourceLine, altLine, overlay, closeOverlay, loadingPanel, rankFor, scoreEmoji } from "./stage.js";

const sfx = audio.sfx;
const DAILY_MAPS = ["israel", "world", "walks", "israel", "flights", "world", "random"];
export const TIMED_MS = 30_000;

export function dailyInfo(date = new Date()) {
  const day = dayKey(date);
  const idx = Math.floor(Date.parse(day + "T00:00:00Z") / 86400000) % DAILY_MAPS.length;
  return { day, map: DAILY_MAPS[idx], seed: `daily-${day}` };
}

let session = null;

export async function playSolo(opts, app) {
  const kind = opts.kind;
  const measure = opts.measure || "time";
  let map = opts.map || "israel";
  let seed = opts.seed || randomSeed();
  if (kind === "daily") {
    const d = dailyInfo();
    map = d.map;
    seed = d.seed;
  }
  const me = { aborted: false };
  session = me;

  overlay(loadingPanel(t("planning"), t("planningSub"), MAPS[map]?.emoji || "🧭"));
  audio.sfx.whoosh();
  let rounds;
  const t0 = performance.now();
  try {
    rounds = await getRounds({ seed, map, count: kind === "streak" ? 6 : 5 });
  } catch {
    rounds = null;
  }
  if (me.aborted) return;
  if (!rounds?.length) {
    closeOverlay();
    toast(t("errGeneric"));
    return;
  }
  // let the loader breathe a moment so it doesn't flash
  const wait = 700 - (performance.now() - t0);
  if (wait > 0) await sleep(wait);
  closeOverlay();
  openStage("game");

  const results = [];
  let total = 0;
  let streak = 0;
  let i = 0;
  // The Daily Challenge is one try: rounds already played stay played.
  if (kind === "daily") {
    const saved = app.dailyProgress();
    for (const r of saved?.partial ? saved.results : []) {
      if (!rounds[i]) break;
      results.push({ ...r, round: rounds[i] });
      total += r.score;
      i++;
    }
  }
  const count = kind === "streak" ? Infinity : rounds.length;
  while (i < count && !me.aborted) {
    if (kind === "streak" && i >= rounds.length - 2) {
      getRounds({ seed, map, count: 5, from: rounds.length }).then((more) => rounds.push(...more)).catch(() => {});
    }
    if (i >= rounds.length) {
      // still loading the next batch
      for (let k = 0; k < 40 && i >= rounds.length && !me.aborted; k++) await sleep(150);
      if (i >= rounds.length) break;
    }
    const round = rounds[i];
    const res = await playRound(round, { i, kind, measure, total, streak, count: rounds.length, me, map });

    if (me.aborted || !res) return;
    results.push(res);
    total += res.score;
    if (kind === "daily") app.saveDailyProgress(results);
    if (kind === "streak") {
      if (res.score >= STREAK_PASS) {
        streak++;
        sfx.streak(streak);
        haptic("lock");
      } else break;
    }
    i++;
    if (kind !== "streak" && i >= rounds.length) break;
    if (kind === "streak" && res.score < STREAK_PASS) break;
  }
  if (me.aborted) return;
  app.recordSolo({ kind, map, measure, total, results, streak, seed });
  showSummary({ kind, map, measure, seed, total, results, streak, challenge: opts.challenge, app, rounds });
}

export function abortSolo() {
  if (session) {
    session.aborted = true;
    session.cancel?.();
  }
  session = null;
}

function topbar({ kind, i, count, total, streak, onClose }) {
  const roundLabel = kind === "streak"
    ? `<span aria-hidden="true">🔥</span><span class="num" id="hud-round">${streak}</span>`
    : `<small>${esc(t("round"))}</small><span class="num" id="hud-round">${i + 1}/${count}</span>`;
  const el = html(`
    <div class="topbar">
      <button class="icon-btn glass" id="btn-exit" aria-label="${esc(t("home"))}">${icon("close")}</button>
      <div class="capsule glass">${roundLabel}</div>
      <div class="spacer"></div>
      <div class="capsule glass"><small>${esc(t("score"))}</small><span class="num" id="hud-score" data-v="${total}">${fmtNum(total)}</span></div>
    </div>`);
  el.querySelector("#btn-exit").addEventListener("click", () => {
    sfx.tap();
    onClose();
  });
  return el;
}

function exitSolo(app) {
  abortSolo();
  closeOverlay();
  closeStage();
  app.refresh();
}

async function playRound(round, ctx) {
  const { i, kind, measure, total, streak, count, me } = ctx;
  const app = window.__gtdApp;
  const ui = stageUi();
  ui.innerHTML = "";
  ui.append(topbar({ kind, i, count, total, streak, onClose: () => exitSolo(app) }));
  const side = inspector();
  side.append(tripCard(round, { measure }));
  const ask = askText(round, measure);
  const sheet = html(`
    <div class="sheet glass down" role="region" aria-label="${esc(ask.title)}">
      <div class="grabber"></div>
      <h2>${esc(ask.title)}</h2>
      <p class="sub">${esc(ask.sub)}</p>
      <div class="picker-host"></div>
      <div class="guess-row">
        ${kind === "timed" ? '<div class="ring-host" aria-hidden="true"></div>' : ""}
        <button class="btn btn-ink" id="btn-guess">${esc(t("guess"))}<kbd class="kbd" aria-hidden="true">↵</kbd></button>
      </div>
    </div>`);
  side.append(sheet);
  const picker = createPicker(sheet.querySelector(".picker-host"), {
    measure,
    value: measure === "time" ? 30 : 10,
    onTick: () => sfx.tick(),
  });
  if (isDesktop()) requestAnimationFrame(() => picker.focus());
  requestAnimationFrame(() => sheet.classList.remove("down"));
  sfx.whoosh();
  gmap.showTrip(round, mapPad());

  const guess = await new Promise((resolve) => {
    let ring = null;
    const btn = sheet.querySelector("#btn-guess");
    const submit = (value) => {
      ring?.stop();
      btn.disabled = true;
      resolve(value);
    };
    btn.addEventListener("click", () => submit(picker.value));
    if (kind === "timed") {
      ring = timerRing(sheet.querySelector(".ring-host"), TIMED_MS, {
        onHurry: () => { sfx.hurry(); haptic("tap"); },
        onEnd: () => {
          toast(t("timeUp"));
          submit(picker.touched ? picker.value : null);
        },
      });
    }
    me.cancel = () => {
      ring?.stop();
      resolve(undefined);
    };
  });
  if (me.aborted || guess === undefined) return null;
  sfx.lock();
  haptic("lock");
  picker.disable(true);

  const { route } = round;
  const actual = measure === "time" ? route.min : route.km;
  const score = roundScore(guess, actual, measure);
  await reveal({ sheet, round, route, actual, guess, score, measure, kind, last: kind !== "streak" ? i + 1 >= count : score < STREAK_PASS, me });
  if (me.aborted) return null;
  return { score, guess, actual, round };
}

async function reveal({ sheet, round, route, actual, guess, score, measure, kind, last, me }) {
  const v = verdict(score);
  const err = relError(guess, actual);
  const errText = guess == null ? t("noGuess") : score >= MAX_ROUND ? t("exact") : err > 0 ? t("over", { p: Math.round(err * 100) }) : t("under", { p: Math.round(-err * 100) });
  sheet.innerHTML = `
    <div class="grabber"></div>
    <div class="reveal-top">
      <div>
        <div class="answer-label">${esc(measure === "time" ? t("actualTime") : t("actualDistance"))}</div>
        <div class="answer" id="answer"></div>
        <div class="answer-alt">${esc(altLine(route, measure))}</div>
      </div>
      <div class="verdict" id="verdict" style="opacity:0">
        <b>${esc(t(v))}</b>
        <span>${esc(errText)}</span>
      </div>
    </div>
    <div class="line-host"></div>
    <div class="points">
      <div class="points-row"><b class="num" id="pts">0</b><span>${esc(t("ofPoints", { max: fmtNum(MAX_ROUND) }))}</span></div>
      <div class="meter"><i id="meter"></i></div>
    </div>
    ${sourceLine(route)}
    <button class="btn btn-ink btn-block" id="btn-next">${esc(last ? t("finish") : t("next"))} ${icon("arrow")}<kbd class="kbd" aria-hidden="true">↵</kbd></button>`;
  sheet.querySelector(".line-host").append(numberLine({ actual, you: guess, measure }));
  const fmt = measure === "time" ? (x) => fmtTimeHtml(x) : (x) => fmtKmHtml(x);
  sfx.reveal();
  audio.duck(0.4, 2600);
  const nextBtn = sheet.querySelector("#btn-next");
  const next = new Promise((resolve) => {
    nextBtn.addEventListener("click", () => {
      sfx.tap();
      resolve();
    });
    me.cancel = resolve;
  });
  const routeDone = gmap.drawRoute(round, route, mapPad(), reducedMotion() ? 0 : 2200);
  await countUp(sheet.querySelector("#answer"), actual, { ms: 1500, html: true, format: fmt });
  if (me.aborted) return;
  sheet.querySelector("#verdict").style.cssText = "opacity:1;transition:opacity .3s, transform .5s var(--spring);";
  sfx.verdict(score);
  if (score < MAX_ROUND) haptic(score >= 3800 ? "lock" : score < 1500 ? "warning" : "tap");
  sheet.querySelector("#meter").style.width = `${(score / MAX_ROUND) * 100}%`;
  const hud = $("#hud-score");
  const before = Number(hud?.dataset.v || 0);
  setTimeout(() => countUp(sheet.querySelector("#pts"), score, { ms: 1100, onTick: (p) => { sfx.count(p * (score / MAX_ROUND)); haptic("tick"); } }), 260);
  if (hud) {
    hud.dataset.v = before + score;
    countUp(hud, before + score, { from: before, ms: 1100 });
  }
  if (score >= MAX_ROUND) {
    haptic("success");
    confetti();
  } else if (score >= 4500) {
    confetti({ count: 60 });
  }
  await Promise.race([routeDone, sleep(2600)]);
  await next;
}

function showSummary({ kind, map, measure, seed, total, results, streak, challenge, app, rounds }) {
  const max = results.length * MAX_ROUND;
  const isStreak = kind === "streak";
  const title = isStreak ? t("streakOver") : t(rankFor(total, max || 1));
  const colors = MAPS[map]?.colors || MAPS.israel.colors;
  const grid = results.map((r) => scoreEmoji(r.score)).join("");
  let compare = "";
  if (challenge && !isStreak) {
    const key = total > challenge.score ? "beat" : total < challenge.score ? "lostTo" : "tieWith";
    compare = `<div class="card-plain challenge-banner"><h3>${esc(t(key, { name: challenge.name }))}</h3><p class="num">${fmtNum(total)} · ${fmtNum(challenge.score)}</p></div>`;
  }
  const rows = results.map((r, k) => {
    const rd = r.round;
    return `<div class="rr">
      <div class="mi" style="background:${(MODE_COLORS[rd.mode] || MODE_COLORS.car)[1]}">${icon(rd.mode)}</div>
      <div><div class="tt">${esc(placeName(rd.from))} ${tripArrow()} ${esc(placeName(rd.to))}</div>
      <div class="dd num">${esc(iso(fmtValue(r.actual, measure)))} · ${esc(t("youGuessed"))} ${r.guess == null ? "—" : esc(iso(fmtValue(r.guess, measure)))}</div></div>
      <div class="sc num">${fmtNum(r.score)}<small>${scoreEmoji(r.score)}</small></div>
    </div>`;
  }).join("");
  const panel = overlay(`
    <div class="art-card result-hero drift" style="--c1:${colors[0]};--c2:${colors[1]};--c3:${colors[2]}">
      ${artCanvas(colors, "res-" + seed)}
      <div class="art-body">
        <div class="rank">${esc(title)}</div>
        <div class="total num" id="sum-total">0</div>
        <div class="of">${isStreak ? esc(t("streakCount", { n: streak })) : esc(t("outOf", { max: fmtNum(max) }))}</div>
      </div>
    </div>
    ${compare}
    <div class="rounds-list">${rows}</div>
    <div class="actions">
      ${kind === "daily" ? "" : `<button class="btn btn-ink" id="sum-again">${icon("play")}${esc(t("playAgain"))}</button>`}
      ${kind !== "streak" && kind !== "daily" ? `<button class="btn btn-tint" id="sum-challenge">${icon("link")}${esc(t("challenge"))}</button>` : ""}
      <button class="btn btn-soft" id="sum-share">${icon("share")}${esc(t("share"))}</button>
      <button class="btn btn-soft" id="sum-home">${esc(t("home"))}</button>
    </div>`, { cls: "summary" });
  const totalEl = panel.querySelector("#sum-total");
  setTimeout(() => {
    countUp(totalEl, isStreak ? streak : total, { ms: 1600, onTick: (p) => { sfx.count(p); haptic("tick"); } }).then(() => {
      if (isStreak ? streak >= 5 : total / (max || 1) >= 0.75) {
        sfx.win();
        haptic("success");
        confetti({ count: 180 });
      } else sfx.verdict(isStreak ? (streak >= 2 ? 3000 : 0) : (total / (max || 1)) * MAX_ROUND);
    });
  }, 350);

  const home = () => {
    closeOverlay();
    closeStage();
    app.refresh();
  };
  panel.querySelector("#sum-home").addEventListener("click", () => { sfx.tap(); home(); });
  panel.querySelector("#sum-again")?.addEventListener("click", () => {
    sfx.tap();
    closeOverlay();
    playSolo({ kind: kind === "challenge" ? "classic" : kind, map, measure }, app);
  });
  panel.querySelector("#sum-challenge")?.addEventListener("click", async () => {
    sfx.tap();
    const p = app.profile();
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("c", `${seed}.${map}.${measure}`);
    url.searchParams.set("s", String(total));
    url.searchParams.set("n", p.name || "?");
    await shareOrCopy(`${t("challengedBy", { name: p.name })} · ${fmtNum(total)}`, url.toString(), t("challengeMade"));
  });
  panel.querySelector("#sum-share").addEventListener("click", async () => {
    sfx.tap();
    const label = kind === "daily" ? `${t("daily")} ${dailyInfo().day}` : `${word("mapsWord", map)} · ${t(kind === "timed" ? "timed" : kind === "streak" ? "streak" : "classic")}`;
    const scoreText = isStreak ? `🔥 ${streak}` : `${fmtNum(total)} / ${fmtNum(max)}`;
    const text = t("shareText", { title: label, score: scoreText, grid });
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    await shareOrCopy(text, url.toString(), t("copied"));
  });
}

export async function shareOrCopy(text, url, copiedMsg) {
  text = text.replace(/[\u2066-\u2069]/g, ""); // isolates are for the screen, not for messages
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ text, url, title: "Guess The Distance" });
      return;
    } catch {}
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast(copiedMsg);
  } catch {
    toast(url, 5000);
  }
}
