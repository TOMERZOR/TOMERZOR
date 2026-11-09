// Guess The Distance: the app shell. Three tabs (Play, 1v1, Profile), the
// first-run screen, invite and challenge links, and the glue between the
// solo games, duels, sound and storage.

import { $, $$, html, esc, toast, segmented, setHaptics, haptic, tapHaptics, isDesktop, onDesktopChange } from "./ui.js";
import { t, setLang, getLang, word, fmtNum } from "./i18n.js";
import { icon } from "./icons.js";
import { artCanvas, paintArt } from "./art.js";
import { load, save, store, AVATARS } from "./store.js";
import { MAPS, MAP_IDS } from "../core/places.js";
import { STREAK_PASS } from "../core/scoring.js";
import * as audio from "./audio.js";
import { DuelNet, detectServer } from "./net.js";
import { DuelUI } from "./duelui.js";
import { playSolo, dailyInfo } from "./solo.js";
import { overlay, closeOverlay } from "./stage.js";
import { prepareMap as gmapPrepare, relabel as gmapRelabel, mapStatus as gmapStatus } from "./map.js";

load();
setLang(store.settings.lang);
setHaptics(store.settings.haptics);
audio.setMusic(store.settings.music);
audio.setSfx(store.settings.sfx);
const sfx = audio.sfx;

const MODE_ART = {
  classic: ["#00b4ff", "#2346ff", "#7a2bff"],
  streak: ["#ffb340", "#ff3b6b", "#8f5bff"],
  timed: ["#34e0a1", "#00a3ff", "#3a5bff"],
  challenge: ["#ff6a3d", "#ff2d87", "#ffd23f"],
  quick: ["#ff2d87", "#8f5bff", "#2346ff"],
};

let tab = "play";
let server = null; // { url, online } once known
let challenge = null; // from a ?c= link
const net = new DuelNet(() => store.profile);
const duels = new DuelUI(net, null);

const app = {
  refresh: () => render(),
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


// ---------- desktop sidebar ----------
function renderSidebar() {
  const sb = $("#sidebar");
  if (!sb) return;
  const p = store.profile, st = store.stats, s = store.settings;
  sb.innerHTML = `
    <div class="sb-brand"><img src="img/icon.svg" alt="" width="40" height="40"><div><b>Guess The</b><b>Distance</b></div></div>
    <nav class="sb-nav" role="tablist" aria-label="Guess The Distance">
      ${TABS.map(([id, ic, label]) => `<button class="sb-item ${id === tab ? "on" : ""}" role="tab" aria-selected="${id === tab}" data-tab="${id}">${icon(ic)}<span>${esc(t(label))}</span>${id === "duel" && net.state === "open" ? `<em class="sb-badge num">${fmtNum(Math.max(1, net.online))}</em>` : ""}</button>`).join("")}
    </nav>
    <div class="sb-foot">
      <button class="sb-me" data-tab="me"><span class="sb-av">${esc(p.avatar)}</span><span class="sb-who"><b>${esc(p.name || "—")}</b><small class="num">${esc(t("wins"))} ${fmtNum(st.wins)} · ${esc(t("games"))} ${fmtNum(st.games)}</small></span></button>
      <div class="sb-toggles">
        <button class="icon-btn" id="sb-music" aria-pressed="${s.music}" aria-label="${esc(t("music"))}" title="${esc(t("music"))}">${icon("music")}</button>
        <button class="icon-btn" id="sb-sfx" aria-pressed="${s.sfx}" aria-label="${esc(t("sfx"))}" title="${esc(t("sfx"))}">${icon("speaker")}</button>
      </div>
    </div>`;
  sb.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
  $("#sb-music", sb).addEventListener("click", () => { setPref("music", !store.settings.music); sfx.toggle(); });
  $("#sb-sfx", sb).addEventListener("click", () => { setPref("sfx", !store.settings.sfx); sfx.toggle(); });
}

// ---------- tab bar ----------
const TABS = [
  ["play", "globe", "tabPlay"],
  ["duel", "swords", "tabDuel"],
  ["me", "person", "tabMe"],
];

function renderTabbar() {
  const bar = $("#tabbar");
  bar.innerHTML = `<span class="tab-thumb"></span>` + TABS.map(([id, ic, label]) =>
    `<button class="tab ${id === tab ? "on" : ""}" role="tab" aria-selected="${id === tab}" data-tab="${id}" id="tab-${id}">${icon(ic)}<span>${esc(t(label))}</span></button>`).join("");
  bar.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
  requestAnimationFrame(moveThumb);
}

function moveThumb() {
  const bar = $("#tabbar");
  const on = bar.querySelector(".tab.on");
  const thumb = bar.querySelector(".tab-thumb");
  if (!on || !thumb) return;
  const br = bar.getBoundingClientRect(), r = on.getBoundingClientRect();
  thumb.style.width = `${r.width}px`;
  thumb.style.insetInlineStart = getLang() === "he" ? `${br.right - r.right}px` : `${r.left - br.left}px`;
}

function go(next) {
  if (next === tab) {
    $(`#v-${tab}`).scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  sfx.tap();
  const order = TABS.map((x) => x[0]);
  const dir = order.indexOf(next) > order.indexOf(tab) ? 1 : -1;
  document.documentElement.style.setProperty("--dirx", String(getLang() === "he" ? -dir : dir));
  tab = next;
  if (tab === "duel") net.connect();
  render();
}

// ---------- views ----------
function render() {
  renderTabbar();
  renderSidebar();
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `v-${tab}`));
  if (tab === "play") renderPlay();
  if (tab === "duel") renderDuel();
  if (tab === "me") renderMe();
  paintArt(document);
}

function header(titleHtml, { hello = true, avatar = true } = {}) {
  return `
    <div class="head">
      <div>
        ${hello ? `<p class="hello">${esc(t("hello", { name: store.profile.name || "👋" }))}</p>` : ""}
        <h1 class="large-title" id="t-${tab}">${titleHtml}</h1>
      </div>
      ${avatar ? `<button class="avatar-btn" id="go-me" aria-label="${esc(t("tabMe"))}">${esc(store.profile.avatar)}</button>` : ""}
    </div>`;
}

function mapChips(current, name) {
  return `<div class="chips" role="radiogroup" aria-label="${esc(t("maps"))}">${MAP_IDS.map((id) => `
    <button class="chip ${id === current ? "on" : ""}" role="radio" aria-checked="${id === current}" data-map="${id}" data-group="${name}">
      ${artCanvas(MAPS[id].colors, "chip-" + id, "h")}<span>${MAPS[id].emoji} ${esc(word("mapsWord", id))}</span>
    </button>`).join("")}</div>`;
}

function bindChips(root, key) {
  root.querySelectorAll(`.chip[data-group="${key}"]`).forEach((c) => c.addEventListener("click", () => {
    sfx.toggle();
    store.settings[key] = c.dataset.map;
    save();
    root.querySelectorAll(`.chip[data-group="${key}"]`).forEach((x) => {
      const on = x === c;
      x.classList.toggle("on", on);
      x.setAttribute("aria-checked", String(on));
    });
    c.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }));
}

function renderPlay() {
  const v = $("#v-play");
  const daily = dailyInfo();
  const entry = store.daily[daily.day];
  const done = entry && !entry.partial ? entry : null;
  const resumeAt = entry?.partial ? entry.results.length : 0;
  const dColors = MAPS[daily.map].colors;
  const s = store.settings;
  const best = (kind) => store.best[kind]?.[`${s.map}|${s.measure}`];
  const bestTag = (n) => (n ? `<span class="best num">${esc(t("best", { n: fmtNum(n) }))}</span>` : "");
  const doneFill = done ? Math.round((done.score / 25000) * 100) : 0;
  v.innerHTML = `<div class="view-inner">
    ${header(`Guess The <br>Distance`)}
    <div class="d-top">
    <div class="d-main">
    ${challenge ? `
      <div class="card-plain challenge-banner">
        <h3>${esc(t("challengedBy", { name: challenge.name }))}</h3>
        <p>${esc(t("challengedScore", { score: fmtNum(challenge.score), map: word("mapsWord", challenge.map) }))}</p>
        <button class="btn btn-ink btn-block" id="accept-ch">${icon("play")}${esc(t("acceptChallenge"))}</button>
      </div>` : ""}
    <button class="art-card hero drift" id="daily" style="--c1:${dColors[0]};--c2:${dColors[1]};--c3:${dColors[2]}">
      ${artCanvas(dColors, "daily-" + daily.day)}
      <div class="art-body">
        <h2 class="art-title">${esc(t("daily"))}</h2>
        <div class="art-sub">${MAPS[daily.map].emoji} ${esc(word("mapsWord", daily.map))} · ${esc(done ? t("dailyDone") : resumeAt ? t("dailyResume", { n: resumeAt + 1 }) : t("dailySub"))}</div>
        <div class="hero-meta">
          <div class="pill-stat">
            <div class="bar" style="--fill:${done ? doneFill : resumeAt ? resumeAt * 20 : 8}%"><i></i></div>
            <div><b class="num">${done ? fmtNum(done.score) : resumeAt ? `${resumeAt}/5` : "5"}</b><span>${done ? esc(done.grid) : esc(t("roundsWord"))}</span></div>
          </div>
          <span class="round-btn" aria-hidden="true">${icon(done ? "share" : "play")}</span>
        </div>
      </div>
    </button>
    </div>
    <aside class="d-side">
      <div class="section-label">${esc(t("maps"))}</div>
      ${mapChips(s.map, "map")}
      <div class="section-label">${esc(t("measure"))}</div>
      <div id="measure"></div>
    </aside>
    </div>

    <div class="section-label">${esc(t("modes"))}</div>
    <div class="grid2 modes-grid">
      ${modeCard("classic", "trophy", t("classic"), t("classicSub"), bestTag(best("classic")))}
      ${modeCard("streak", "flame", t("streak"), t("streakSub"), bestTag(store.best.streak))}
      ${modeCard("timed", "timer", t("timed"), t("timedSub"), bestTag(best("timed")))}
      ${modeCard("challenge", "link", t("challenge"), t("challengeSub"), "")}
    </div>
  </div>`;
  segmented($("#measure", v), [["time", t("mTime")], ["distance", t("mDistance")]], s.measure, (val) => {
    sfx.toggle();
    store.settings.measure = val;
    save();
    renderPlay();
    paintArt(v);
  });
  bindChips(v, "map");
  $("#go-me", v)?.addEventListener("click", () => go("me"));
  $("#daily", v).addEventListener("click", () => {
    sfx.tap();
    if (done) {
      const url = new URL(location.href);
      url.search = "";
      navigator.clipboard?.writeText(`Guess The Distance · ${t("daily")} ${daily.day}\n${fmtNum(done.score)} / 25,000\n${done.grid}\n${url}`).then(() => toast(t("copied")), () => {});
      return;
    }
    playSolo({ kind: "daily", measure: "time" }, app);
  });
  v.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    sfx.tap();
    const kind = b.dataset.mode;
    playSolo({ kind, map: s.map, measure: s.measure }, app);
  }));
  $("#accept-ch", v)?.addEventListener("click", () => {
    sfx.tap();
    const ch = challenge;
    playSolo({ kind: "challenge", map: ch.map, measure: ch.measure, seed: ch.seed, challenge: ch }, app);
  });
}

function modeCard(id, ic, title, sub, extra) {
  const c = MODE_ART[id];
  return `<button class="art-card mode-card" data-mode="${id}" style="--c1:${c[0]};--c2:${c[1]};--c3:${c[2]}">
    ${artCanvas(c, "mode-" + id)}
    <div class="art-body"><span class="ico">${icon(ic)}</span><h3 class="art-title">${esc(title)}</h3><div class="art-sub">${esc(sub)}</div></div>
    ${extra}
  </button>`;
}

function renderDuel() {
  const v = $("#v-duel");
  const s = store.settings;
  const dmap = s.duelMap || "israel";
  const dmeasure = s.duelMeasure || "time";
  const st = net.state;
  const statusHtml = st === "open" ? `<span class="online-dot" id="online"><i></i>${esc(t("online", { n: fmtNum(Math.max(1, net.online)) }))}</span>`
    : st === "local" ? `<span class="online-dot off" id="online"><i></i>${esc(t("offline"))}</span>`
    : `<span class="online-dot off" id="online"><i></i>${esc(t("connecting"))}</span>`;
  const c = MODE_ART.quick;
  v.innerHTML = `<div class="view-inner">
    ${header(esc(t("duelTitle")), { hello: false })}
    <p class="muted lead">${esc(t("duelLead"))}<br>${statusHtml}</p>
    <div class="d-top">
    <div class="d-main">
    <button class="art-card hero drift" id="quick" style="--c1:${c[0]};--c2:${c[1]};--c3:${c[2]}">
      ${artCanvas(c, "quick")}
      <div class="art-body">
        <h2 class="art-title">${esc(t("quick"))}</h2>
        <div class="art-sub">${esc(t("quickSub"))}</div>
        <div class="hero-meta">
          <div class="pill-stat">
            <div class="bar" style="--fill:${Math.round((store.stats.wins / Math.max(1, store.stats.wins + store.stats.losses)) * 100) || 8}%"><i></i></div>
            <div><b class="num">${fmtNum(store.stats.wins)}–${fmtNum(store.stats.losses)}</b><span>${esc(t("wins"))} · ${esc(t("losses"))}</span></div>
          </div>
          <span class="round-btn" aria-hidden="true">${icon("swords")}</span>
        </div>
      </div>
    </button>
    ${st === "local" ? `<p class="muted" style="font-size:14px;margin:12px 4px 0">${esc(t("serverOffNote"))}</p>` : ""}
    </div>
    <aside class="d-side">
      <div class="section-label">${esc(t("maps"))}</div>
      ${mapChips(dmap, "duelMap")}
      <div class="section-label">${esc(t("measure"))}</div>
      <div id="dmeasure"></div>
    </aside>
    </div>

    <div class="d-cards">
    <div class="d-cell">
    <div class="section-label">${esc(t("room"))}</div>
    <div class="card-plain stack">
      <p style="margin:0">${esc(t("roomSub"))}</p>
      <button class="btn btn-ink btn-block" id="create-room">${icon("plus")}${esc(t("createRoom"))}</button>
      <div class="row-2">
        <input class="field code-field" id="code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(t("codePh"))}" aria-label="${esc(t("roomCode"))}">
        <button class="btn btn-soft" id="join-room">${esc(t("join"))}</button>
      </div>
    </div>
    </div>

    <div class="d-cell">
    <div class="section-label">${esc(t("bot"))}</div>
    <div class="card-plain stack">
      <p style="margin:0">${esc(t("botSub"))}</p>
      <div id="bot-level"></div>
      <button class="btn btn-soft btn-block" id="play-bot">${icon("robot")}${esc(t("playBot"))}</button>
    </div>
    </div>

    <div class="d-cell">
    <div class="section-label"><span class="d-only">${esc(t("rulesTitle"))}</span></div>
    <details class="card-plain" ${isDesktop() ? "open" : ""}><summary>${esc(t("rulesTitle"))}</summary><p class="rules" style="margin:12px 0 0">${t("rules")}</p></details>
    </div>
    </div>
  </div>`;
  bindChips(v, "duelMap");
  segmented($("#dmeasure", v), [["time", t("mTime")], ["distance", t("mDistance")]], dmeasure, (val) => {
    sfx.toggle();
    store.settings.duelMeasure = val;
    save();
  });
  segmented($("#bot-level", v), [["easy", t("easy")], ["normal", t("normal")], ["hard", t("hard")]], s.botLevel || "normal", (val) => {
    sfx.toggle();
    store.settings.botLevel = val;
    save();
  });
  $("#go-me", v)?.addEventListener("click", () => go("me"));
  const cur = () => [store.settings.duelMap || "israel", store.settings.duelMeasure || "time"];
  $("#quick", v).addEventListener("click", () => { sfx.tap(); duels.quick(...cur()); });
  $("#create-room", v).addEventListener("click", () => { sfx.tap(); duels.createRoom(...cur()); });
  const code = $("#code", v);
  code.addEventListener("input", () => (code.value = code.value.toUpperCase().replace(/[^A-Z]/g, "")));
  const join = () => {
    if (code.value.length !== 4) {
      sfx.error();
      code.focus();
      return;
    }
    sfx.tap();
    duels.joinRoom(code.value);
  };
  $("#join-room", v).addEventListener("click", join);
  code.addEventListener("keydown", (e) => e.key === "Enter" && join());
  $("#play-bot", v).addEventListener("click", () => { sfx.tap(); duels.bot(...cur(), store.settings.botLevel || "normal"); });
}

function renderMe() {
  const v = $("#v-me");
  const s = store.settings, st = store.stats;
  const bestClassic = Math.max(0, ...Object.values(store.best.classic || {}));
  const sw = (id, on) => `<button class="switch" role="switch" aria-checked="${on}" id="${id}" aria-labelledby="${id}-l"></button>`;
  v.innerHTML = `<div class="view-inner">
    ${header(esc(store.profile.name || t("tabMe")), { hello: false })}
    <div class="d-cols">
    <div class="d-col">
    <div class="stats-grid">
      <div class="stat"><b class="num">${fmtNum(st.games)}</b><span>${esc(t("games"))}</span></div>
      <div class="stat"><b class="num">${fmtNum(bestClassic)}</b><span>${esc(t("bestClassic"))}</span></div>
      <div class="stat"><b class="num">${fmtNum(store.best.streak || 0)}</b><span>${esc(t("bestStreak"))}</span></div>
      <div class="stat"><b class="num">${fmtNum(st.wins)}</b><span>${esc(t("wins"))}</span></div>
      <div class="stat"><b class="num">${fmtNum(st.losses)}</b><span>${esc(t("losses"))}</span></div>
      <div class="stat"><b class="num">${fmtNum(st.perfects)}</b><span>${esc(t("perfects"))}</span></div>
    </div>
    <div class="section-label">${esc(t("name"))}</div>
    <input class="field" id="name" maxlength="18" value="${esc(store.profile.name)}" placeholder="${esc(t("namePh"))}" aria-label="${esc(t("name"))}">
    <div class="section-label">${esc(t("pickAvatar"))}</div>
    <div class="emoji-grid" id="avatars">${AVATARS.map((a) => `<button class="${a === store.profile.avatar ? "on" : ""}" data-a="${a}" aria-label="${a}">${a}</button>`).join("")}</div>
    </div>

    <div class="d-col">
    <div class="section-label">${esc(t("settings"))}</div>
    <div class="list">
      <div class="row"><span class="ri" style="background:#007aff">${icon("globe")}</span><span class="rl">${esc(t("language"))}</span><div id="lang" style="width:150px"></div></div>
      <div class="row"><span class="ri" style="background:#ff2d55">${icon("music")}</span><span class="rl" id="sw-music-l">${esc(t("music"))}</span>${sw("sw-music", s.music)}</div>
      <div class="row"><span class="ri" style="background:#ff9500">${icon("speaker")}</span><span class="rl" id="sw-sfx-l">${esc(t("sfx"))}</span>${sw("sw-sfx", s.sfx)}</div>
      <div class="row"><span class="ri" style="background:#34c759">${icon("vibrate")}</span><span class="rl" id="sw-hap-l">${esc(t("haptics"))}</span>${sw("sw-hap", s.haptics)}</div>
      <div class="row"><span class="ri" style="background:#5856d6">${icon("server")}</span><span class="rl">${esc(t("server"))}</span><span class="rv" id="srv">${esc(server ? t("serverOn") : t("serverOff"))}</span></div>
      <div class="row"><span class="ri" style="background:#30b0c7">${icon("pin")}</span><span class="rl">${esc(t("mapRow"))}</span><span class="rv" id="map-src">${esc(word("mapSrc", gmapStatus()))}</span></div>
    </div>
    <p class="muted" style="font-size:13px;margin:22px 4px 0">${esc(t("about"))}</p>
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
  });
  const toggle = (id, key) => $(id, v).addEventListener("click", () => {
    setPref(key, !store.settings[key]);
    sfx.toggle();
  });
  toggle("#sw-music", "music");
  toggle("#sw-sfx", "sfx");
  toggle("#sw-hap", "haptics");
  $("#name", v).addEventListener("change", (e) => {
    store.profile.name = e.target.value.trim().slice(0, 18);
    save();
    renderSidebar();
    net.state !== "idle" && net.hello();
  });
  $("#avatars", v).addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    sfx.toggle();
    store.profile.avatar = b.dataset.a;
    save();
    $$("#avatars button", v).forEach((x) => x.classList.toggle("on", x === b));
    renderSidebar();
    net.state !== "idle" && net.hello();
  });
}

// One place that changes a sound/feel setting, so Profile and the desktop
// sidebar always agree.
function setPref(key, on) {
  store.settings[key] = on;
  save();
  if (key === "music") {
    audio.setMusic(on);
    if (on) audio.unlock();
  }
  if (key === "sfx") audio.setSfx(on);
  if (key === "haptics") setHaptics(on);
  const sw = { music: "#sw-music", sfx: "#sw-sfx", haptics: "#sw-hap" }[key];
  $(sw)?.setAttribute("aria-checked", String(on));
  $(`#sb-${key}`)?.setAttribute("aria-pressed", String(on));
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
    const g = results.map((r) => (r.score >= 5000 ? "🟪" : r.score >= 4000 ? "🟩" : r.score >= 2800 ? "🟨" : r.score >= 1500 ? "🟧" : "🟥")).join("");
    store.daily[dailyInfo().day] = { score: total, grid: g };
    // keep the last 60 days
    const days = Object.keys(store.daily).sort();
    while (days.length > 60) delete store.daily[days.shift()];
  }
  save();
  void STREAK_PASS;
}

function recordDuel(m) {
  if (m.result === "win") store.stats.wins++;
  else if (m.result === "lose") store.stats.losses++;
  store.stats.perfects += (m.rounds || []).filter((r) => r.scores.you >= 5000).length;
  save();
}

// ---------- first run ----------
function onboarding() {
  return new Promise((resolve) => {
    let avatar = store.profile.avatar;
    const c = MAPS.israel.colors;
    const el = html(`
      <div class="onboard" role="dialog" aria-modal="true" aria-labelledby="ob-t">
        <div class="art-card drift" style="--c1:${c[0]};--c2:${c[1]};--c3:${c[2]}">
          ${artCanvas(c, "onboard")}
          <div class="art-body">
            <div class="art-sub" style="font-weight:700;opacity:.95">${esc(t("welcome"))}</div>
            <h1 class="art-title" id="ob-t">Guess The<br>Distance</h1>
          </div>
        </div>
        <div class="form">
          <p class="muted" style="margin:0">${esc(t("welcomeSub"))}</p>
          <div id="ob-lang"></div>
          <input class="field" id="ob-name" maxlength="18" placeholder="${esc(t("namePh"))}" aria-label="${esc(t("name"))}" autocomplete="nickname">
          <div class="emoji-grid" id="ob-av">${AVATARS.map((a) => `<button class="${a === avatar ? "on" : ""}" data-a="${a}" aria-label="${a}">${a}</button>`).join("")}</div>
          <button class="btn btn-ink btn-block" id="ob-go" style="margin-top:auto">${esc(t("letsGo"))} ${icon("arrow")}</button>
        </div>
      </div>`);
    document.body.append(el);
    paintArt(el);
    segmented($("#ob-lang", el), [["he", "עברית"], ["en", "English"]], store.settings.lang, (val) => {
      store.settings.lang = val;
      save();
      setLang(val);
      el.remove();
      onboarding().then(resolve);
    });
    $("#ob-av", el).addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      avatar = b.dataset.a;
      sfx.toggle();
      $$("#ob-av button", el).forEach((x) => x.classList.toggle("on", x === b));
    });
    const name = $("#ob-name", el);
    $("#ob-go", el).addEventListener("click", () => {
      const n = name.value.trim();
      if (!n) {
        sfx.error();
        name.focus();
        name.animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(0)" }], { duration: 300 });
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
  tapHaptics();
  const unlockOnce = () => {
    audio.unlock();
    removeEventListener("pointerdown", unlockOnce);
    removeEventListener("keydown", unlockOnce);
  };
  addEventListener("pointerdown", unlockOnce);
  addEventListener("keydown", unlockOnce);
  addEventListener("resize", () => requestAnimationFrame(moveThumb));
  addEventListener("keydown", onKey);

  const { room } = readLinks();
  if (room) tab = "duel";
  render();
  if (!store.profile.name) await onboarding();
  render();

  gmapPrepare().then(() => {
    const el = $("#map-src");
    if (el) el.textContent = word("mapSrc", gmapStatus());
  });
  detectServer().then((s) => {
    server = s;
    if (tab === "me") renderMe();
  });
  net.on("state", () => {
    if (tab === "duel" && !duels.active && !$("#v-duel input:focus")) {
      renderDuel();
      paintArt($("#v-duel"));
    }
  });
  net.on("online", () => {
    if (tab === "duel") refreshOnline();
    renderSidebar();
  });
  net.on("state", () => renderSidebar());
  onDesktopChange(() => render());
  // Back in the middle of a duel after a reload: reconnect and the server
  // puts us back in the match.
  let midMatch = false;
  try { midMatch = Date.now() - Number(sessionStorage.getItem("gtd:match") || 0) < 20 * 60_000; } catch {}
  if (tab === "duel" || midMatch) await net.connect();
  if (room) {
    await net.connect();
    duels.joinRoom(room);
  }
}

// Keyboard: Enter guesses or moves on, Escape backs out, 1/2/3 switch screens.
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = e.target.closest?.("input, textarea, select");
  const overlayOn = $("#overlay").classList.contains("on");
  const inGame = $("#stage").classList.contains("on");
  const visible = (sel) => {
    const b = $(sel);
    return b && !b.disabled && b.offsetParent !== null ? b : null;
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
  if (!inGame && !overlayOn && ["1", "2", "3"].includes(e.key)) go(TABS[Number(e.key) - 1][0]);
}

function refreshOnline() {
  const el = $("#online");
  if (!el) return;
  const st = net.state;
  el.className = `online-dot ${st === "open" ? "" : "off"}`;
  el.innerHTML = `<i></i>${esc(st === "open" ? t("online", { n: fmtNum(Math.max(1, net.online)) }) : st === "local" ? t("offline") : t("connecting"))}`;
}

boot();
