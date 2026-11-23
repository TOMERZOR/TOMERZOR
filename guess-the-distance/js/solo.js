// Solo games, the GeoGuessr single-player set: Classic, Daily Challenge,
// Streak, Time Attack, and Challenge a Friend (a shareable link that replays
// the same rounds).

import { $, html, esc, countUp, confetti, haptic, toast, sleep, reducedMotion, isDesktop } from "./ui.js";
import { t, word, placeName, fmtNum, fmtValue, tripArrow, iso } from "./i18n.js";
import { icon, img3d, mapArt, MODE_3D, MODE_TONE } from "./icons.js";
import { candy, iconBtn, sparkles } from "./kit.js";
import * as juice from "./juice.js";
import { createPicker } from "./wheel.js";
import { getRounds } from "./net.js";
import { roundScore, relError, MAX_ROUND, STREAK_PASS } from "../core/scoring.js";
import { randomSeed, dayKey } from "../core/rng.js";
import * as gmap from "./map.js";
import * as audio from "./audio.js";
import { openStage, closeStage, stageUi, inspector, zoomTools, mapPad, tripCard, askText, timerRing, numberLine, sourceLine, altLine, overlay, closeOverlay, loadingPanel, rankFor, scoreEmoji, verdictSticker, showVerdict, meter10, runMeter, answerHtml, bigNumHtml } from "./stage.js";

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

  overlay(loadingPanel(t("planning"), t("planningSub"), `<div class="bigart">${mapArt(map, 66)}</div>`), { look: "night" });
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
    toast(t("errGeneric"), 3000, { tone: "coral" });
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
    const res = await playRound(round, { i, kind, measure, total, streak, count: rounds.length, me, map, app });

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
    ? `${img3d("fire", { size: 26, lazy: false })}<b class="num" id="hud-round">${streak}</b>`
    : `<small>${esc(t("round"))}</small><b class="num" id="hud-round">${i + 1}/${count}</b>`;
  const el = html(`
    <div class="topbar">
      ${iconBtn({ ico: "close", label: t("home"), hud: true, id: "btn-exit" })}
      <div class="pill-hud glass-solid">${roundLabel}</div>
      <div class="spacer"></div>
      <div class="pill-hud glass-solid score" aria-label="${esc(t("score"))}"><b class="num" id="hud-score" data-v="${total}">${fmtNum(total)}</b></div>
    </div>`);
  el.querySelector("#btn-exit").addEventListener("click", onClose);
  return el;
}

function exitSolo(app) {
  abortSolo();
  closeOverlay();
  closeStage();
  app.refresh(true);
}

async function playRound(round, ctx) {
  const { i, kind, measure, total, streak, count, me, app } = ctx;
  const ui = stageUi();
  ui.innerHTML = "";
  ui.append(topbar({ kind, i, count, total, streak, onClose: () => exitSolo(app) }));
  zoomTools();
  const side = inspector();
  side.append(tripCard(round, { measure }));
  const ask = askText(round, measure);
  const sheet = html(`
    <div class="sheet glass down" role="region" aria-label="${esc(ask.title)}">
      <div class="grabber"></div>
      <h2 class="ask">${esc(ask.title)}</h2>
      <p class="sub">${esc(ask.sub)}</p>
      <div class="picker-host"></div>
      <div class="guess-row">
        ${kind === "timed" ? '<div class="ring-host" aria-hidden="true"></div>' : ""}
        ${candy({ text: t("guess"), tone: "lime", id: "btn-guess", kbd: true })}
      </div>
    </div>`);
  side.append(sheet);
  const picker = createPicker(sheet.querySelector(".picker-host"), {
    measure,
    value: measure === "time" ? 30 : 10,
    onTick: () => sfx.tick(),
  });
  // (not if the game was left in the meantime: focus stays on the screen)
  if (isDesktop()) requestAnimationFrame(() => !me.aborted && picker.focus());
  requestAnimationFrame(() => sheet.classList.remove("down"));
  sfx.whoosh();
  gmap.showTrip(round, mapPad());

  const btn = sheet.querySelector("#btn-guess");
  const guess = await new Promise((resolve) => {
    let ring = null;
    const submit = (value) => {
      ring?.stop();
      btn.setAttribute("aria-disabled", "true");
      resolve(value);
    };
    btn.addEventListener("click", () => submit(picker.value));
    if (kind === "timed") {
      ring = timerRing(sheet.querySelector(".ring-host"), TIMED_MS, {
        onHurry: () => { sfx.hurry(); haptic("tap"); },
        onEnd: () => {
          toast(t("timeUp"), 2400, { tone: "coral" });
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
  // locked in: mint, a check that writes itself, sparks, the lock sound
  juice.success(btn, t("lockedWord"));
  picker.disable(true);
  await sleep(150);

  const { route } = round;
  const actual = measure === "time" ? route.min : route.km;
  const score = roundScore(guess, actual, measure);
  await reveal({ sheet, round, route, actual, guess, score, measure, kind, last: kind !== "streak" ? i + 1 >= count : score < STREAK_PASS, me, app });
  if (me.aborted) return null;
  return { score, guess, actual, round };
}

async function reveal({ sheet, round, route, actual, guess, score, measure, kind, last, me, app }) {
  const err = relError(guess, actual);
  const errText = guess == null ? t("noGuess") : score >= MAX_ROUND ? t("exact") : err > 0 ? t("over", { p: Math.round(err * 100) }) : t("under", { p: Math.round(-err * 100) });
  sheet.innerHTML = `
    <div class="grabber"></div>
    <div class="rv-top">
      <div class="rv-answer">
        <div class="answer-label">${esc(measure === "time" ? t("actualTime") : t("actualDistance"))}</div>
        <div class="answer" id="answer" aria-live="polite"></div>
        <div class="answer-alt">${esc(altLine(route, measure))}</div>
      </div>
      ${verdictSticker(score, esc(errText))}
    </div>
    <div class="line-host"></div>
    <div class="points">
      <div class="points-row"><b class="num" id="pts">0</b><span>${esc(t("ofPoints", { max: fmtNum(MAX_ROUND) }))}</span></div>
      ${meter10()}
    </div>
    ${sourceLine(route)}
    ${candy({ html: `<span>${esc(last ? t("finish") : t("next"))}</span>${icon("arrow")}`, tone: "lime", id: "btn-next", cls: "block", kbd: true })}`;
  sheet.querySelector(".line-host").append(numberLine({ actual, you: guess, measure, youAvatar: app.profile().avatar }));
  sfx.reveal();
  audio.duck(0.4, 2600);
  const nextBtn = sheet.querySelector("#btn-next");
  const next = new Promise((resolve) => {
    nextBtn.addEventListener("click", () => resolve());
    me.cancel = resolve;
  });
  const routeDone = gmap.drawRoute(round, route, mapPad(), reducedMotion() ? 0 : 2200);
  await countUp(sheet.querySelector("#answer"), actual, { ms: 1500, html: true, format: (x) => answerHtml(x, measure) });
  if (me.aborted) return;
  showVerdict(sheet.querySelector("#verdict"));
  sfx.verdict(score);
  if (score < MAX_ROUND) haptic(score >= 3800 ? "lock" : score < 1500 ? "warning" : "tap");
  runMeter(sheet.querySelector("#meter"), score, 1400);
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

const RANK_TONE = { rank4: "sun", rank3: "lime", rank2: "mint", rank1: "sky", rank0: "coral" };

function roundRows(list, measure) {
  return list.map((r, k) => {
    const rd = r.round;
    return `<div class="rr" style="--tilt:${k % 2 ? 0.6 : -0.6}deg">
      <div class="mi c-${MODE_TONE[rd.mode] || "lime"}">${img3d(MODE_3D[rd.mode] || "car", { size: 32 })}</div>
      <div><div class="tt">${esc(placeName(rd.from))} ${tripArrow()} ${esc(placeName(rd.to))}</div>
      <div class="dd num">${esc(iso(fmtValue(r.actual, measure)))} · ${esc(t("youGuessed"))} ${r.guess == null ? "—" : esc(iso(fmtValue(r.guess, measure)))}</div></div>
      <div class="sc num">${fmtNum(r.score)}<small>${scoreEmoji(r.score)}</small></div>
    </div>`;
  }).join("");
}

function showSummary({ kind, map, measure, seed, total, results, streak, challenge, app }) {
  const max = results.length * MAX_ROUND;
  const isStreak = kind === "streak";
  const rank = rankFor(total, max || 1);
  const title = isStreak ? t("streakOver") : t(rank);
  const tone = isStreak ? "flame" : RANK_TONE[rank];
  const grid = results.map((r) => scoreEmoji(r.score)).join("");
  let compare = "";
  if (challenge && !isStreak) {
    const key = total > challenge.score ? "beat" : total < challenge.score ? "lostTo" : "tieWith";
    compare = `<div class="sticker compare c-sun"><h3>${esc(t(key, { name: challenge.name }))}</h3><p class="num">${fmtNum(total)} · ${fmtNum(challenge.score)}</p></div>`;
  }
  const good = isStreak ? streak >= 5 : total / (max || 1) >= 0.75;
  const again = kind === "daily" ? "" : candy({ text: t("playAgain"), tone: "lime", ico: "again", id: "sum-again" });
  const chall = kind !== "streak" && kind !== "daily" ? candy({ text: t("challenge"), tone: "sun", ico: "link", id: "sum-challenge" }) : "";
  const panel = overlay(`
    <div class="sticker result c-${tone}">
      ${good ? sparkles(9, `sum-${seed}`, { colors: ["#0E1116"], area: [4, 6, 96, 94], size: [8, 16] }) : ""}
      <div class="ribbon">${esc(title)}</div>
      ${isStreak ? img3d("fire", { size: 120, cls: "r-art", lazy: false }) : ""}
      <div class="total num" id="sum-total" dir="ltr">0</div>
      <div class="of">${isStreak ? esc(t("streakCount", { n: streak })) : esc(t("outOf", { max: fmtNum(max) }))}</div>
    </div>
    ${compare}
    <div class="rounds-list">${roundRows(results, measure)}</div>
    <div class="actions two">
      ${kind === "daily" ? candy({ text: t("share"), tone: "lime", ico: "share", id: "sum-share" }) : again}
      ${chall}
      ${kind === "daily" ? "" : candy({ text: t("share"), tone: "cloud", ico: "share", id: "sum-share" })}
      ${candy({ text: t("home"), tone: "cloud", ico: "home", id: "sum-home" })}
    </div>`, { cls: "summary" });
  const totalEl = panel.querySelector("#sum-total");
  setTimeout(() => {
    countUp(totalEl, isStreak ? streak : total, { ms: 1600, html: true, format: bigNumHtml, onTick: (p) => { sfx.count(p); haptic("tick"); } }).then(() => {
      if (good) {
        sfx.win();
        haptic("success");
        confetti({ count: 180 });
      } else sfx.verdict(isStreak ? (streak >= 2 ? 3000 : 0) : (total / (max || 1)) * MAX_ROUND);
    });
  }, 350);

  const home = () => {
    closeOverlay();
    closeStage();
    app.refresh(true);
  };
  panel.querySelector("#sum-home").addEventListener("click", home);
  panel.querySelector("#sum-again")?.addEventListener("click", () => {
    closeOverlay();
    playSolo({ kind: kind === "challenge" ? "classic" : kind, map, measure }, app);
  });
  panel.querySelector("#sum-challenge")?.addEventListener("click", async (e) => {
    const b = e.currentTarget;
    const p = app.profile();
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("c", `${seed}.${map}.${measure}`);
    url.searchParams.set("s", String(total));
    url.searchParams.set("n", p.name || "?");
    const how = await shareOrCopy(`${t("challengedBy", { name: p.name })} · ${fmtNum(total)}`, url.toString(), t("challengeMade"));
    if (how === "copied") juice.success(b, t("copied"), { revert: 1800 });
  });
  panel.querySelector("#sum-share").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    const label = kind === "daily" ? `${t("daily")} ${dailyInfo().day}` : `${word("mapsWord", map)} · ${t(kind === "timed" ? "timed" : kind === "streak" ? "streak" : "classic")}`;
    const scoreText = isStreak ? `🔥 ${streak}` : `${fmtNum(total)} / ${fmtNum(max)}`;
    const text = t("shareText", { title: label, score: scoreText, grid });
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    const how = await shareOrCopy(text, url.toString(), t("copied"));
    if (how === "copied") juice.success(b, t("copied"), { revert: 1800 });
  });
}

// Share with the system sheet on a phone, or copy. Returns how it went:
// "shared", "copied" or "shown" (the link in a toast when nothing else works).
export async function shareOrCopy(text, url, copiedMsg) {
  text = text.replace(/[⁦-⁩]/g, ""); // isolates are for the screen, not for messages
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ text, url, title: "Guess The Distance" });
      return "shared";
    } catch {}
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast(copiedMsg);
    return "copied";
  } catch {
    toast(url, 5000);
    return "shown";
  }
}
