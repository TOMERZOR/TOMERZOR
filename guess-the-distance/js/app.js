// Guess The Distance: the app shell. Three screens (Play, 1v1, Profile), the
// first-run screen, invite and challenge links, and the glue between the
// solo games, duels, sound and storage.

import { $, $$, html, esc, toast, segmented, switchHtml, setHaptics, tapHaptics, isDesktop, onDesktopChange } from "./ui.js";
import { t, setLang, getLang, word, fmtNum } from "./i18n.js";
import { icon, coin, img3d, avatarArt, mapArt } from "./icons.js";
import { candy, iconBtn, toggleBtn, chip, modeCard, sparkles, medal } from "./kit.js";
import * as juice from "./juice.js";
import { load, save, store, AVATARS } from "./store.js";
import { MAPS, MAP_IDS } from "../core/places.js";
import * as audio from "./audio.js";
import { DuelNet, detectServer } from "./net.js";
import { DuelUI } from "./duelui.js";
import { playSolo, dailyInfo, shareOrCopy } from "./solo.js";
import { scoreEmoji, displayGrid } from "./stage.js";
import { prepareMap as gmapPrepare, relabel as gmapRelabel, mapStatus as gmapStatus } from "./map.js";

load();
setLang(store.settings.lang);
setHaptics(store.settings.haptics);
audio.setMusic(store.settings.music);
audio.setSfx(store.settings.sfx);
const sfx = audio.sfx;

// Mode cards: no two neighbors share a color; sky and turquoise, the closest
// pair, sit on the diagonal.
const MODES = [
  { id: "classic", art: "trophy", tone: "sky", tilt: -1.5 },
  { id: "streak", art: "fire", tone: "flame", tilt: 1.5 },
  { id: "timed", art: "stopwatch", tone: "sun", tilt: 1.2 },
  { id: "challenge", art: "link", tone: "turq", tilt: -1.2 },
];
// The three bot levels as three characters.
const BOT_LEVELS = [["easy", "🐨"], ["normal", "🦉"], ["hard", "🦖"]];

const TABS = [
  ["play", "play", "tabPlay"],
  ["duel", "swords", "tabDuel"],
  ["me", "person", "tabMe"],
];

let tab = "play";
let server = null; // { url, online } once known
let challenge = null; // from a ?c= link
let tick = null; // the Daily Challenge countdown
const net = new DuelNet(() => store.profile);
const duels = new DuelUI(net, null);

const app = {
  refresh: (back) => {
    render({ enter: !!back });
    if (back) {
      juice.resetAttention();
      // back from a game: keyboard focus returns to the screen, not to nowhere
      const v = $(`#v-${tab}`);
      v?.setAttribute("tabindex", "-1");
      v?.focus({ preventScroll: true });
    }
  },
  profile: () => store.profile,
  settings: () => store.settings,
  recordSolo,
  recordDuel,
  dailyProgress: () => store.daily[dailyInfo().day],
  saveDailyProgress(results) {
    const day = dailyInfo().day;
    if (store.daily[day] && !store.daily[day].partial) return;
    store.daily[day] = { partial: true, results: results.map((r) => ({ score: r.score, guess: r.guess, actual: r.actual })) };
    save();
  },
};
duels.app = app;
window.__gtdApp = app;

// ---------- the night sidebar (desktop) ----------
function renderSidebar() {
  const sb = $("#sidebar");
  if (!sb) return;
  const p = store.profile, st = store.stats, s = store.settings;
  sb.innerHTML = `
    <div class="sb-brand"><img src="img/icon.svg" alt="" width="46" height="46"><span class="sb-name">Guess The<br><em>Distance</em></span></div>
    <nav class="sb-nav" role="tablist" aria-label="Guess The Distance">
      ${TABS.map(([id, ic, label]) => `<button class="sb-item ${id === tab ? "on" : ""}" role="tab" aria-selected="${id === tab}" data-tab="${id}" data-juice="ghost" id="sb-${id}">${icon(ic)}<span>${esc(t(label))}</span>${id === "duel" ? onlineBadge() : ""}</button>`).join("")}
    </nav>
    <div class="sb-foot">
      <button class="sb-me" data-tab="me" data-juice="ghost">${coin(p.avatar, { size: 46 })}<span class="sb-who"><b>${esc(p.name || "—")}</b><small class="num">${esc(t("wins"))} ${fmtNum(st.wins)} · ${esc(t("games"))} ${fmtNum(st.games)}</small></span></button>
      <div class="sb-toggles">
        ${toggleBtn({ ico: "music", label: t("music"), on: s.music, id: "sb-music" })}
        ${toggleBtn({ ico: "speaker", label: t("sfx"), on: s.sfx, id: "sb-sfx" })}
      </div>
    </div>`;
  sb.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
  $("#sb-music", sb).addEventListener("click", () => setPref("music", !store.settings.music));
  $("#sb-sfx", sb).addEventListener("click", () => setPref("sfx", !store.settings.sfx));
}

function onlineBadge() {
  return net.state === "open" ? `<em class="sb-badge num" id="sb-online"><i></i>${fmtNum(Math.max(1, net.online))}</em>` : "";
}

// ---------- the tab bar (phone): outlined circles on a white pill ----------
function renderTabbar() {
  const bar = $("#tabbar");
  bar.innerHTML = TABS.map(([id, ic, label]) => `
    <button class="tab ${id === tab ? "on" : ""}" role="tab" aria-selected="${id === tab}" data-tab="${id}" data-juice="tab" id="tab-${id}">
      <span class="tab-disc"><i class="disc"></i>${icon(ic)}</span><span class="tab-lbl">${esc(t(label))}</span>
    </button>`).join("");
  bar.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
}

function markTabs() {
  for (const [id] of TABS) {
    for (const el of [$(`#tab-${id}`), $(`#sb-${id}`)]) {
      if (!el) continue;
      el.classList.toggle("on", id === tab);
      el.setAttribute("aria-selected", String(id === tab));
    }
  }
}

function go(next) {
  if (next === tab) {
    $(`#v-${tab}`).scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const order = TABS.map((x) => x[0]);
  const dir = order.indexOf(next) > order.indexOf(tab) ? 1 : -1;
  document.documentElement.style.setProperty("--dirx", String(getLang() === "he" ? -dir : dir));
  tab = next;
  markTabs();
  juice.navHop($(`#tab-${tab}`));
  if (tab === "duel") net.connect();
  juice.resetAttention();
  renderView({ enter: true });
}

// ---------- views ----------
function render({ enter = false } = {}) {
  renderTabbar();
  renderSidebar();
  renderView({ enter });
}

function renderView({ enter = false } = {}) {
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `v-${tab}`));
  clearInterval(tick);
  if (tab === "play") renderPlay(enter);
  if (tab === "duel") renderDuel(enter);
  if (tab === "me") renderMe(enter);
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return t(h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : "evening");
}

function topBar() {
  const p = store.profile;
  return `
    <div class="top">
      <button class="who" id="go-me-${tab}" data-go-me data-juice="ghost" aria-label="${esc(t("tabMe"))}">${coin(p.avatar, { size: 56 })}<span class="who-text"><small>${esc(greeting())}</small><b>${esc(p.name || "👋")}</b></span></button>
      <div class="top-tools">${toggleBtn({ ico: "music", label: t("music"), on: store.settings.music, id: `top-music-${tab}`, cls: "pref-music" })}</div>
    </div>`;
}

function bindTop(v) {
  $("[data-go-me]", v)?.addEventListener("click", () => go("me"));
  $(".pref-music", v)?.addEventListener("click", () => setPref("music", !store.settings.music));
}

function mapChips(current, group) {
  return `<div class="chips" role="radiogroup" aria-label="${esc(t("maps"))}">${MAP_IDS.map((id) => chip({ map: id, label: word("mapsWord", id), on: id === current, group })).join("")}</div>`;
}

function bindChips(root, key) {
  const list = root.querySelectorAll(`.chip[data-group="${key}"]`);
  list.forEach((c) => c.addEventListener("click", () => {
    if (c.classList.contains("on")) return;
    sfx.toggle();
    store.settings[key] = c.dataset.map;
    save();
    list.forEach((x) => {
      const on = x === c;
      x.classList.toggle("on", on);
      x.setAttribute("aria-checked", String(on));
    });
    juice.select(c);
    c.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    if (key === "map") refreshBests(root);
  }));
}

// Time left until the next Daily Challenge (midnight in Israel).
function untilMidnight() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const g = (k) => Number(parts.find((p) => p.type === k)?.value || 0);
  const left = Math.max(0, 86400 - (g("hour") * 3600 + g("minute") * 60 + g("second")));
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
}

function bestFor(kind) {
  const s = store.settings;
  return kind === "streak" ? store.best.streak : store.best[kind]?.[`${s.map}|${s.measure}`];
}

function modeCards() {
  return MODES.map((m) => {
    const best = m.id === "challenge" ? 0 : bestFor(m.id);
    const badge = best ? (m.id === "streak" ? `${fmtNum(best)}×` : fmtNum(best)) : "";
    return modeCard({
      mode: m.id, title: t(m.id), sub: t(`${m.id}Sub`), art: m.art, tone: m.tone, tilt: m.tilt, best: badge,
      label: `${t(m.id)}. ${t(`${m.id}Sub`)}${best ? `. ${t("best", { n: badge })}` : ""}`,
    });
  }).join("");
}

function refreshBests(root) {
  const grid = $(".modes", root);
  if (grid) grid.innerHTML = modeCards();
}

function renderPlay(enter) {
  const v = $("#v-play");
  const daily = dailyInfo();
  const entry = store.daily[daily.day];
  const done = entry && !entry.partial ? entry : null;
  const resumeAt = entry?.partial ? entry.results.length : 0;
  const s = store.settings;
  const dmap = `${MAPS[daily.map].emoji} ${word("mapsWord", daily.map)}`;
  const status = done ? t("dailyDone") : resumeAt ? t("dailyResume", { n: resumeAt + 1 }) : `5 ${t("roundsWord")}`;
  v.innerHTML = `<div class="view-inner">
    ${topBar()}
    <h1 class="display brand" id="t-play">Guess The <em>Distance</em></h1>
    <div class="d-top">
    <div class="d-main">
    ${challenge ? `
      <div class="sticker c-sun challenge-card" style="--tilt:1deg">
        <h3>${esc(t("challengedBy", { name: challenge.name }))}</h3>
        <p>${esc(t("challengedScore", { score: fmtNum(challenge.score), map: word("mapsWord", challenge.map) }))}</p>
        ${candy({ text: t("acceptChallenge"), tone: "cloud", ico: "play", id: "accept-ch", cls: "block" })}
      </div>` : ""}
    <div class="ticket" id="ticket">
      ${img3d(done ? "medal" : "calendar", { size: 120, cls: "tk-art art-hop", lazy: false })}
      <div class="tk-head">
        <h2 class="tk-title">${esc(t("daily"))}</h2>
        <div class="tk-sub">${esc(dmap)} · ${esc(status)}</div>
        ${done ? `<div class="tk-sub"><b class="tk-score num">${fmtNum(done.score)}</b><span class="tk-grid">${esc(displayGrid(done.grid))}</span></div>` : ""}
      </div>
      <div class="tk-perf" aria-hidden="true"><i class="notch s"></i><i class="notch e"></i></div>
      <div class="tk-foot">
        ${done ? candy({ text: t("share"), tone: "cloud", cls: "sm", ico: "share", id: "daily" }) : candy({ text: t("dailyPlay"), tone: "cloud", cls: "sm", icoEnd: "play", flip: true, id: "daily" })}
        <span class="tk-next">${esc(t("dailyNext"))}<b class="num" id="tk-next">${untilMidnight()}</b></span>
      </div>
    </div>
    </div>
    <aside class="d-side">
      <div class="label">${esc(t("maps"))}</div>
      ${mapChips(s.map, "map")}
      <div class="label">${esc(t("measure"))}</div>
      <div id="measure"></div>
    </aside>
    </div>
    <div class="label">${esc(t("modes"))}</div>
    <div class="modes">${modeCards()}</div>
  </div>`;
  bindTop(v);
  segmented($("#measure", v), [["time", t("mTime")], ["distance", t("mDistance")]], s.measure, (val) => {
    sfx.toggle();
    store.settings.measure = val;
    save();
    refreshBests(v);
  }, { label: t("measure") });
  bindChips(v, "map");
  const dailyBtn = $("#daily", v);
  if (!done) juice.attention(dailyBtn);
  $("#ticket", v).addEventListener("click", (e) => {
    if (!e.target.closest("button")) dailyBtn.click();
  });
  dailyBtn.addEventListener("click", async () => {
    if (done) {
      const url = new URL(location.href);
      url.search = "";
      const how = await shareOrCopy(`Guess The Distance · ${t("daily")} ${daily.day}\n${fmtNum(done.score)} / 25,000\n${displayGrid(done.grid)}`, url.toString(), t("copied"));
      if (how === "copied") juice.success(dailyBtn, t("copied"), { revert: 1800 });
      return;
    }
    playSolo({ kind: "daily", measure: "time" }, app);
  });
  v.querySelector(".modes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]");
    if (!b) return;
    playSolo({ kind: b.dataset.mode, map: store.settings.map, measure: store.settings.measure }, app);
  });
  $("#accept-ch", v)?.addEventListener("click", () => {
    const ch = challenge;
    playSolo({ kind: "challenge", map: ch.map, measure: ch.measure, seed: ch.seed, challenge: ch }, app);
  });
  tick = setInterval(() => {
    const el = $("#tk-next");
    if (el) el.textContent = untilMidnight();
  }, 1000);
  if (enter) juice.land($$(".modes .mode-card", v), { delay: 120 });
}

function renderDuel(enter) {
  const v = $("#v-duel");
  const s = store.settings;
  const dmap = s.duelMap || "israel";
  const dmeasure = s.duelMeasure || "time";
  const level = s.botLevel || "normal";
  v.innerHTML = `<div class="view-inner">
    ${topBar()}
    <div class="arena-head">
      <h1 class="display arena-title" id="t-duel">${esc(t("tabDuel"))}</h1>
      ${onlinePill()}
    </div>
    <p class="lead">${esc(t("duelLead"))}</p>
    <div class="d-duel-top">
    <div>
      <div class="quick-wrap"><span class="pulse-ring" aria-hidden="true"></span><span class="pulse-ring" aria-hidden="true"></span>${candy({ text: t("find"), tone: "lime", cls: "xl", ico: "swords", id: "quick" })}</div>
      <div class="quick-meta"><span>${esc(t("quick"))} · ${esc(t("quickSub"))}</span></div>
      <div class="quick-meta"><span>${esc(t("wins"))} <b class="num">${fmtNum(store.stats.wins)}</b></span><span>${esc(t("losses"))} <b class="num">${fmtNum(store.stats.losses)}</b></span></div>
      ${net.state === "local" ? `<p class="muted" style="font-size:14px;margin:14px 4px 0;text-align:center">${esc(t("serverOffNote"))}</p>` : ""}
    </div>
    <div>
      <div class="label">${esc(t("maps"))}</div>
      ${mapChips(dmap, "duelMap")}
      <div class="label">${esc(t("measure"))}</div>
      <div id="dmeasure"></div>
    </div>
    </div>

    <div class="d-cards">
    <div class="d-cell">
      <div class="label">${esc(t("room"))}</div>
      <div class="panel-card stack">
        <h3>${img3d("key", { size: 34 })}<span>${esc(t("roomSub"))}</span></h3>
        ${candy({ text: t("createRoom"), tone: "cloud", ico: "plus", id: "create-room", cls: "block" })}
        <p style="margin:6px 0 0">${esc(t("haveCode"))}</p>
        <div class="code-row">
          <div class="code-tiles" id="code-tiles" role="group" aria-label="${esc(t("roomCode"))}">${[1, 2, 3, 4].map((n) => `<input class="tile" maxlength="1" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="${esc(t("codeTile", { n }))}">`).join("")}</div>
          ${candy({ text: t("join"), tone: "lime", id: "join-room" })}
        </div>
      </div>
    </div>
    <div class="d-cell">
      <div class="label">${esc(t("bot"))}</div>
      <div class="panel-card">
        <h3>${img3d("robot", { size: 34 })}<span>${esc(t("botSub"))}</span></h3>
        <div class="bots" role="radiogroup" aria-label="${esc(t("bot"))}">
          ${BOT_LEVELS.map(([lv, av]) => `<button class="bot-pick" role="radio" aria-checked="${lv === level}" data-level="${lv}" data-juice="chip">${coin(av, { size: 62 })}<span>${esc(t(lv))}</span></button>`).join("")}
        </div>
        ${candy({ text: t("playBot"), tone: "sun", ico: "robot", id: "play-bot", cls: "block" })}
      </div>
    </div>
    <div class="d-cell">
      <div class="label"><span class="d-only">${esc(t("rulesTitle"))}</span></div>
      <details class="panel-card" ${isDesktop() ? "open" : ""}><summary>${esc(t("rulesTitle"))}</summary><p class="rules">${t("rules")}</p></details>
    </div>
    </div>
  </div>`;
  bindTop(v);
  bindChips(v, "duelMap");
  segmented($("#dmeasure", v), [["time", t("mTime")], ["distance", t("mDistance")]], dmeasure, (val) => {
    sfx.toggle();
    store.settings.duelMeasure = val;
    save();
  }, { label: t("measure") });
  const cur = () => [store.settings.duelMap || "israel", store.settings.duelMeasure || "time"];
  const quick = $("#quick", v);
  juice.attention(quick);
  quick.addEventListener("click", async () => {
    juice.loading(quick, true);
    const ok = await duels.quick(...cur());
    juice.loading(quick, false);
    if (!ok) juice.error(quick, { sound: false });
  });
  const create = $("#create-room", v);
  create.addEventListener("click", async () => {
    juice.loading(create, true);
    const ok = await duels.createRoom(...cur());
    setTimeout(() => juice.loading(create, false), ok ? 1500 : 0);
    if (!ok) juice.error(create, { sound: false });
  });
  // the code: four tiles, moving on by themselves, pasting fills them all
  const tiles = $$("#code-tiles .tile", v);
  const codeOf = () => tiles.map((x) => x.value).join("");
  tiles.forEach((tl, i) => {
    tl.addEventListener("input", () => {
      tl.value = tl.value.toUpperCase().replace(/[^A-Z]/g, "").slice(-1);
      tl.classList.toggle("filled", !!tl.value);
      if (tl.value) {
        juice.popIn(tl);
        sfx.tick();
        if (tiles[i + 1]) tiles[i + 1].focus();
      }
    });
    tl.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !tl.value && tiles[i - 1]) {
        tiles[i - 1].focus();
        tiles[i - 1].value = "";
        tiles[i - 1].classList.remove("filled");
      }
      if (e.key === "Enter") join();
    });
    tl.addEventListener("paste", (e) => {
      e.preventDefault();
      const txt = (e.clipboardData?.getData("text") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
      [...txt].forEach((ch, k) => {
        if (!tiles[k]) return;
        tiles[k].value = ch;
        tiles[k].classList.add("filled");
        juice.popIn(tiles[k], k * 60);
      });
      tiles[Math.min(3, txt.length)]?.focus();
    });
  });
  const joinBtn = $("#join-room", v);
  const join = async () => {
    const code = codeOf();
    if (code.length !== 4) {
      juice.error($("#code-tiles", v));
      tiles.find((x) => !x.value)?.focus();
      return;
    }
    juice.loading(joinBtn, true);
    const ok = await duels.joinRoom(code);
    setTimeout(() => juice.loading(joinBtn, false), ok ? 1200 : 0);
    if (!ok) juice.error(joinBtn, { sound: false });
  };
  joinBtn.addEventListener("click", join);
  v.querySelector(".bots").addEventListener("click", (e) => {
    const b = e.target.closest(".bot-pick");
    if (!b || b.getAttribute("aria-checked") === "true") return;
    sfx.toggle();
    store.settings.botLevel = b.dataset.level;
    save();
    $$(".bot-pick", v).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    juice.hop(b.querySelector(".coin"));
  });
  $("#play-bot", v).addEventListener("click", () => duels.bot(...cur(), store.settings.botLevel || "normal"));
  if (enter) juice.land([...$$(".panel-card", v)], { stagger: 70, delay: 100 });
}

function onlinePill() {
  const st = net.state;
  const text = st === "open" ? t("online", { n: fmtNum(Math.max(1, net.online)) }) : st === "local" ? t("offline") : t("connecting");
  return `<span class="online ${st === "open" ? "" : "off"}" id="online"><i></i><span>${esc(text)}</span></span>`;
}

function renderMe(enter) {
  const v = $("#v-me");
  const s = store.settings, st = store.stats;
  const p = store.profile;
  const bestClassic = Math.max(0, ...Object.values(store.best.classic || {}));
  const row = (tone, ic, labelId, label, control) => `<div class="row"><span class="ri c-${tone}">${icon(ic)}</span><span class="rl" id="${labelId}">${esc(label)}</span>${control}</div>`;
  v.innerHTML = `<div class="view-inner">
    <h1 class="sr-only" id="t-me">${esc(t("tabMe"))}</h1>
    <div class="d-cols">
    <div class="d-col">
      <div class="sticker c-sky player-card">
        <div class="pc-art art-hop">${avatarArt(p.avatar, { size: 150, lazy: false })}</div>
        <h2 class="display pc-name">${esc(p.name || "—")}</h2>
        <div class="pc-chips">
          <span class="pc-chip">${img3d("party", { size: 26 })}<b class="num">${fmtNum(st.games)}</b>${esc(t("games"))}</span>
          <span class="pc-chip">${img3d("trophy", { size: 26 })}<b class="num">${fmtNum(st.wins)}</b>${esc(t("wins"))}</span>
          <span class="pc-chip">${img3d("collision", { size: 26 })}<b class="num">${fmtNum(st.losses)}</b>${esc(t("losses"))}</span>
        </div>
        <div class="medals">
          ${medal({ art: "fire", value: fmtNum(store.best.streak || 0), label: t("bestStreak"), tone: "flame" })}
          ${medal({ art: "crown", value: fmtNum(bestClassic), label: t("bestClassic"), tone: "sun" })}
          ${medal({ art: "star", value: fmtNum(st.perfects), label: t("perfects"), tone: "mint" })}
        </div>
      </div>
      <div class="label">${esc(t("meAndName"))}</div>
      <input class="field" id="name" maxlength="18" value="${esc(p.name)}" placeholder="${esc(t("namePh"))}" aria-label="${esc(t("name"))}" autocomplete="nickname">
      <div class="avatars" id="avatars" role="radiogroup" aria-label="${esc(t("pickAvatar"))}" style="margin-top:14px">${AVATARS.map((a) => `<button class="av-pick" role="radio" aria-checked="${a === p.avatar}" data-a="${a}" data-juice="chip" aria-label="${a}">${coin(a, { size: 52 })}</button>`).join("")}</div>
    </div>
    <div class="d-col">
      <div class="label">${esc(t("settings"))}</div>
      <div class="list">
        ${row("sky", "globe", "lang-l", t("language"), `<div id="lang"></div>`)}
        ${row("lime", "music", "sw-music-l", t("music"), switchHtml("sw-music", s.music, "sw-music-l"))}
        ${row("sun", "speaker", "sw-sfx-l", t("sfx"), switchHtml("sw-sfx", s.sfx, "sw-sfx-l"))}
        ${row("mint", "vibrate", "sw-hap-l", t("haptics"), switchHtml("sw-hap", s.haptics, "sw-hap-l"))}
        ${row("turq", "server", "srv-l", t("server"), `<span class="rv" id="srv">${esc(server ? t("serverOn") : t("serverOff"))}</span>`)}
        ${row("flame", "pin", "map-l", t("mapRow"), `<span class="rv" id="map-src">${esc(word("mapSrc", gmapStatus()))}</span>`)}
      </div>
      <p class="about">${esc(t("about"))}</p>
      <p class="about" style="margin-top:8px">${esc(t("credits"))}</p>
    </div>
    </div>
  </div>`;
  segmented($("#lang", v), [["he", "עברית"], ["en", "English"]], s.lang, (val) => {
    store.settings.lang = val;
    save();
    setLang(val);
    gmapRelabel();
    sfx.toggle();
    render();
  }, { label: t("language") });
  const sw = (id, key) => $(id, v).addEventListener("click", () => setPref(key, !store.settings[key]));
  sw("#sw-music", "music");
  sw("#sw-sfx", "sfx");
  sw("#sw-hap", "haptics");
  const name = $("#name", v);
  name.addEventListener("change", () => {
    const n = name.value.trim().slice(0, 18);
    if (!n) {
      juice.error(name);
      name.value = store.profile.name;
      return;
    }
    store.profile.name = n;
    save();
    $(".pc-name", v).textContent = n;
    renderSidebar();
    net.state !== "idle" && net.hello();
  });
  $("#avatars", v).addEventListener("click", (e) => {
    const b = e.target.closest(".av-pick");
    if (!b || b.getAttribute("aria-checked") === "true") return;
    sfx.toggle();
    store.profile.avatar = b.dataset.a;
    save();
    $$("#avatars .av-pick", v).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    juice.hop(b.querySelector(".coin"));
    const art = $(".pc-art", v);
    art.innerHTML = avatarArt(b.dataset.a, { size: 150, lazy: false });
    juice.hop(art);
    renderSidebar();
    net.state !== "idle" && net.hello();
  });
  if (enter) juice.land([$(".player-card", v)], { delay: 80 });
}

// One place that changes a sound/feel setting, so Profile, the home screen
// and the desktop sidebar always agree.
function setPref(key, on) {
  store.settings[key] = on;
  save();
  if (key === "music") {
    audio.setMusic(on);
    if (on) audio.unlock();
  }
  if (key === "sfx") audio.setSfx(on);
  if (key === "haptics") setHaptics(on);
  sfx.toggle();
  const sw = { music: "#sw-music", sfx: "#sw-sfx", haptics: "#sw-hap" }[key];
  $(sw)?.setAttribute("aria-checked", String(on));
  $(`#sb-${key}`)?.setAttribute("aria-pressed", String(on));
  $$(`.pref-${key}`).forEach((b) => b.setAttribute("aria-pressed", String(on)));
}

// ---------- stats ----------
function recordSolo({ kind, map, measure, total, results, streak }) {
  const st = store.stats;
  st.games++;
  st.rounds += results.length;
  st.points += total;
  st.perfects += results.filter((r) => r.score >= 5000).length;
  const key = `${map}|${measure}`;
  if (kind === "classic" || kind === "challenge") store.best.classic[key] = Math.max(store.best.classic[key] || 0, total);
  if (kind === "timed") store.best.timed[key] = Math.max(store.best.timed[key] || 0, total);
  if (kind === "streak") store.best.streak = Math.max(store.best.streak || 0, streak);
  if (kind === "daily") {
    const g = results.map((r) => scoreEmoji(r.score)).join("");
    store.daily[dailyInfo().day] = { score: total, grid: g };
    // keep the last 60 days
    const days = Object.keys(store.daily).sort();
    while (days.length > 60) delete store.daily[days.shift()];
  }
  save();
}

function recordDuel(m) {
  if (m.result === "win") store.stats.wins++;
  else if (m.result === "lose") store.stats.losses++;
  store.stats.perfects += (m.rounds || []).filter((r) => r.scores.you >= 5000).length;
  save();
}

// ---------- first run ----------
function onboarding(prefill = {}) {
  return new Promise((resolve) => {
    let avatar = prefill.avatar || store.profile.avatar;
    const el = html(`
      <div class="onboard" role="dialog" aria-modal="true" aria-labelledby="ob-t">
        <div class="ob-hero">
          <div class="glow" aria-hidden="true"></div>
          <div aria-hidden="true" style="position:absolute;inset:0">${sparkles(12, "onboard", { area: [4, 6, 96, 70] })}</div>
          ${img3d("plane", { size: 96, cls: "ob-float", lazy: false, style: "top:calc(var(--safe-top) + 12px);inset-inline-end:7%;--z:84px;--r:6deg;--d:8.5s;--w:-2s" })}
          ${img3d("car", { size: 96, cls: "ob-float", lazy: false, style: "top:calc(var(--safe-top) + 70px);inset-inline-start:6%;--z:88px;--r:-6deg;--d:7s" })}
          ${img3d("globe", { size: 96, cls: "ob-float", lazy: false, style: "top:calc(var(--safe-top) + 22px);inset-inline-start:40%;--z:60px;--d:9s;--w:-4s" })}
          ${img3d("pushpin", { size: 96, cls: "ob-float", lazy: false, style: "top:calc(var(--safe-top) + 104px);inset-inline-end:33%;--z:50px;--r:12deg;--d:6.5s;--w:-1s" })}
          <p class="ob-kicker">${esc(t("welcome"))}</p>
          <h1 class="display ob-title" id="ob-t">Guess The <em>Distance</em></h1>
        </div>
        <div class="ob-form">
          <p class="muted">${esc(t("welcomeSub"))}</p>
          <div id="ob-lang"></div>
          <input class="field" id="ob-name" maxlength="18" placeholder="${esc(t("namePh"))}" aria-label="${esc(t("name"))}" autocomplete="nickname" value="${esc(prefill.name || "")}">
          <div class="avatars" id="ob-av" role="radiogroup" aria-label="${esc(t("pickAvatar"))}">${AVATARS.map((a) => `<button class="av-pick" role="radio" aria-checked="${a === avatar}" data-a="${a}" data-juice="chip" aria-label="${a}">${coin(a, { size: 52, lazy: false })}</button>`).join("")}</div>
          <div class="ob-go">${candy({ text: t("letsGo"), tone: "lime", cls: "lg block", icoEnd: "arrow", id: "ob-go" })}</div>
        </div>
      </div>`);
    document.body.append(el);
    const name = $("#ob-name", el);
    const go = $("#ob-go", el);
    juice.attention(go);
    juice.resetAttention();
    segmented($("#ob-lang", el), [["he", "עברית"], ["en", "English"]], store.settings.lang, (val) => {
      store.settings.lang = val;
      save();
      setLang(val);
      const keep = { name: name.value, avatar };
      el.remove();
      onboarding(keep).then(resolve);
    }, { label: "Language · שפה" });
    $("#ob-av", el).addEventListener("click", (e) => {
      const b = e.target.closest(".av-pick");
      if (!b) return;
      avatar = b.dataset.a;
      sfx.toggle();
      $$("#ob-av .av-pick", el).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      juice.hop(b.querySelector(".coin"));
    });
    name.addEventListener("keydown", (e) => e.key === "Enter" && go.click());
    go.addEventListener("click", () => {
      const n = name.value.trim();
      if (!n) {
        juice.error(name);
        name.focus();
        return;
      }
      store.profile.name = n.slice(0, 18);
      store.profile.avatar = avatar;
      save();
      audio.unlock();
      sfx.match();
      el.style.transition = "opacity .45s, transform .6s var(--spring)";
      el.style.opacity = "0";
      el.style.transform = "scale(1.04)";
      setTimeout(() => el.remove(), 500);
      resolve();
    });
  });
}

// ---------- links ----------
function readLinks() {
  const q = new URLSearchParams(location.search);
  const c = q.get("c");
  if (c) {
    const [seed, map, measure] = c.split(".");
    if (seed && MAPS[map]) challenge = { seed, map, measure: measure === "distance" ? "distance" : "time", score: Number(q.get("s")) || 0, name: (q.get("n") || "?").slice(0, 18) };
  }
  const room = (q.get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  if (q.has("c") || q.has("room")) history.replaceState(null, "", location.pathname);
  return { room };
}

// ---------- boot ----------
async function boot() {
  juice.initJuice();
  tapHaptics();
  const sky = $("#bg .sky");
  if (sky) sky.innerHTML = sparkles(14, "lobby", { area: [3, 3, 97, 92] });
  const unlockOnce = () => {
    audio.unlock();
    removeEventListener("pointerdown", unlockOnce);
    removeEventListener("keydown", unlockOnce);
  };
  addEventListener("pointerdown", unlockOnce);
  addEventListener("keydown", unlockOnce);
  addEventListener("keydown", onKey);

  const { room } = readLinks();
  // Back in the middle of a duel after a reload: reconnect and the server
  // puts us back in the match (and "home" afterwards is the 1v1 screen).
  let midMatch = false;
  try { midMatch = Date.now() - Number(sessionStorage.getItem("gtd:match") || 0) < 20 * 60_000; } catch {}
  if (room || midMatch) tab = "duel";
  render({ enter: true });
  if (!store.profile.name) await onboarding();
  render({ enter: true });
  juice.resetAttention();

  gmapPrepare().then(() => {
    const el = $("#map-src");
    if (el) el.textContent = word("mapSrc", gmapStatus());
  });
  detectServer().then((s) => {
    server = s;
    const el = $("#srv");
    if (el) el.textContent = server ? t("serverOn") : t("serverOff");
  });
  net.on("state", () => {
    refreshOnline();
    renderSidebarBadge();
    // re-draw the duel screen when the connection changes, unless someone is typing a code
    if (tab === "duel" && !duels.active && !$("#v-duel input:focus") && !$("#overlay").classList.contains("on")) renderDuel(false);
  });
  net.on("online", () => {
    refreshOnline();
    renderSidebarBadge();
  });
  onDesktopChange(() => render());
  if (tab === "duel" || midMatch) await net.connect();
  if (room) {
    await net.connect();
    duels.joinRoom(room);
  }
}

function renderSidebarBadge() {
  const item = $("#sb-duel");
  if (!item) return;
  item.querySelector(".sb-badge")?.remove();
  item.insertAdjacentHTML("beforeend", onlineBadge());
}

function refreshOnline() {
  const el = $("#online");
  if (!el) return;
  const st = net.state;
  el.className = `online ${st === "open" ? "" : "off"}`;
  el.innerHTML = `<i></i><span>${esc(st === "open" ? t("online", { n: fmtNum(Math.max(1, net.online)) }) : st === "local" ? t("offline") : t("connecting"))}</span>`;
}

// Keyboard: Enter guesses or moves on, Escape backs out, 1/2/3 switch screens.
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = e.target.closest?.("input, textarea, select");
  const overlayOn = $("#overlay").classList.contains("on");
  const inGame = $("#stage").classList.contains("on");
  const visible = (sel) => {
    const b = $(sel);
    return b && !b.disabled && b.getAttribute("aria-disabled") !== "true" && b.offsetParent !== null ? b : null;
  };
  if (e.key === "Escape") {
    const cancel = overlayOn && (visible("#q-cancel") || visible("#r-cancel") || visible("#l-stay"));
    if (cancel) return cancel.click();
    if (!overlayOn && inGame) (visible("#btn-exit") || visible("#d-exit"))?.click();
    return;
  }
  if (typing) return;
  if (e.key === "Enter" && !e.repeat) {
    // a focused button handles its own Enter
    const btn = e.target.closest?.("button, summary, a");
    if (btn && !["btn-guess", "btn-next"].includes(btn.id)) return;
    if (overlayOn) {
      const b = visible("#sum-again") || visible("#end-rematch") || visible("#accept-ch");
      if (b && e.target === document.body) {
        e.preventDefault();
        b.click();
      }
      return;
    }
    if (!inGame) return;
    const b = visible("#btn-guess") || visible("#btn-next");
    if (b) {
      e.preventDefault();
      b.click();
    }
    return;
  }
  if (!inGame && !overlayOn && !$(".onboard") && ["1", "2", "3"].includes(e.key)) go(TABS[Number(e.key) - 1][0]);
}

boot();
