/**
 * ECHO — the screen and the input.
 *
 * `logic.js` decides everything; this file draws it, listens to thumbs and
 * keys, and talks to the save room. When the game runs on the Higgsfield
 * platform the room is a WebSocket (`/ws/p-<id>` for the player's own save,
 * `/ws/daily` for the shared board). Inside the iPhone app, or anywhere the
 * socket is unreachable, the same rules run locally against localStorage, so
 * the game is playable offline and syncs nothing it cannot verify.
 *
 * Rendering is a small 2.5D painter: a cached floor layer with baked ambient
 * occlusion, additive light pools under everything that glows, then walls,
 * doors and actors sorted by their base line so the room has depth.
 */
import * as L from "./logic.js";

// ── strings ────────────────────────────────────────────────────────────────

const STR = {
  he: {
    tagline: "10 שניות. ואז אתה משחק לצד עצמך.",
    play: "שחק", daily: "אתגר יומי", daily_s: "יומי", shop: "חנות", editor: "עורך שלבים", editor_s: "עורך", clubs: "מועדונים", settings: "הגדרות",
    worlds: "עולמות", world1: "המעבדה", world2: "המצפה", world3: "מעבדת המראות",
    world_locked: "נפתח עם {n} כוכבים", loop: "סיבוב", level: "שלב", hint: "רמז",
    echoes_used: "הדים", seconds: "שניות", coins: "מטבעות", replay: "שידור חוזר", share: "שיתוף", retry: "שוב",
    next: "השלב הבא", done_title: "שלב הושלם", perfect: "מושלם", first_clear: "בונוס סיום ראשון +50",
    free_coins: "מטבעות חינם", watch_ad: "צפה בסרטון +30", ads_left: "נותרו {n} סרטונים היום", ads_none: "נגמרו הסרטונים להיום. חזור מחר.",
    echo_skins: "סקינים להדים", skins_sub: "ההדים שלך לובשים אותו בכל שלב, אז כולם רואים אותו בשידורים החוזרים שלך.",
    season_pass: "כרטיס עונה", claim: "קבל", pass_sub: "שלבים 1–2 חינם. הכרטיס פותח את שאר המסלול.",
    store: "חנות", store_note: "אב־טיפוס: הרכישות מדומות ולא מחויב כסף.",
    daily_sub: "חדר אחד לכל השחקנים בעולם. הכי מעט הדים מנצח; הזמן שובר שוויון.",
    play_daily: "שחק את החדר של היום", leaderboard: "טבלת מובילים", board_empty: "עדיין אין תוצאות היום. תהיה הראשון.",
    editor_sub: "צייר חדר, בדוק אותו ושתף את הקוד שלו. חדר צריך התחלה אחת ויציאה אחת; דלת נפתחת כל עוד הלוחית שלה לחוצה.",
    mirror: "הדים במראה", par: "פאר", add_drone: "+ רחפן", clear_drones: "נקה רחפנים", test: "בדיקה", get_code: "קוד שיתוף", load_code: "טען קוד",
    language: "שפה", music: "מוזיקה", sfx: "אפקטים", shake: "רעידת מסך", name: "שם שחקן",
    loop_saved: "הד #{n} נשמר", loop_sub: "עכשיו שחק לצידו", caught: "נתפסת", caught_sub: "רק הסיבוב הזה מתחיל מחדש",
    out_of_echoes: "נגמרו ההדים", out_sub: "השלב מתחיל מחדש", loop_n: "סיבוב {n}",
    hint_move: "הזז את האגודל כדי לזוז. הגע ליציאה הזהובה.", hint_plate: "דלת נפתחת רק כשמישהו עומד על הלוחית. תן להד שלך לעמוד עליה.",
    hint_drone: "רחפנים תופסים רק אותך, לא את ההדים.", hint_mirror: "בעולם הזה ההדים זזים הפוך: ימין שלך הוא שמאל שלהם.",
    hint_generic: "בסוף 10 שניות הסיבוב נשמר כהד. אתה לא חייב להצליח בסיבוב הראשון.",
    bought: "נקנה!", equipped: "מצויד", not_enough: "אין מספיק {c}", owned: "בבעלותך", equip: "צייד", buy: "קנה",
    starter: "חבילת פתיחה", starter_d: "120 יהלומים + 500 מטבעות + סקין זהב", gems_small: "100 יהלומים", gems_big: "600 יהלומים",
    noads: "הסרת פרסומות", noads_d: "בלי סרטונים. רמזים נשארים חינם.", pass: "כרטיס עונה", pass_d: "פותח את כל 10 השלבים",
    purchase_title: "אישור רכישה (דמו)", purchase_sub: "בגרסה האמיתית כאן נפתח App Store. כאן זה רק מדומה.", confirm: "אשר", cancel: "ביטול",
    ad_title: "פרסומת לדוגמה", ad_sub: "סרטון ממומן היה מתנגן כאן ({n})", ad_done: "קיבלת +30 מטבעות", hint_title: "רמז",
    clubs_title: "מועדונים", clubs_sub: "אתגרים קבוצתיים שבועיים: 20 שחקנים, חדר משותף, הכי מעט הדים ביחד. בקרוב.", close: "סגור",
    streak: "רצף {n} ימים", bonus_today: "בונוס יומי +{n}", online: "מחובר", offline: "לא מקוון · שמירה במכשיר",
    copied: "הועתק!", share_text: "סיימתי את {lvl} ב-ECHO עם {e} הדים ב-{t} שניות ⭐{s}", custom: "חדר מותאם", daily_name: "יומי #{d}",
    level_locked: "השלב נעול", bad_code: "הקוד לא תקין", tier_locked: "צריך כרטיס עונה", need_xp: "צריך עוד XP",
    about: "ECHO · אב־טיפוס · הגרפיקה והסאונד נוצרו ב-Higgsfield", you: "אתה", unnamed: "שחקן", menu: "תפריט", par_label: "פאר",
  },
  en: {
    tagline: "Ten seconds. Then you play beside yourself.",
    play: "Play", daily: "Daily challenge", daily_s: "Daily", shop: "Shop", editor: "Level editor", editor_s: "Editor", clubs: "Clubs", settings: "Settings",
    worlds: "Worlds", world1: "The Lab", world2: "The Observatory", world3: "The Mirror Lab",
    world_locked: "Opens at {n} stars", loop: "Loop", level: "Level", hint: "Hint",
    echoes_used: "echoes", seconds: "seconds", coins: "coins", replay: "Replay", share: "Share", retry: "Retry",
    next: "Next level", done_title: "Level clear", perfect: "Perfect", first_clear: "First clear bonus +50",
    free_coins: "Free coins", watch_ad: "Watch ad +30", ads_left: "{n} videos left today", ads_none: "No more videos today. Come back tomorrow.",
    echo_skins: "Echo skins", skins_sub: "Your echoes wear it on every level, so everyone sees it in your replays.",
    season_pass: "Season pass", claim: "Claim", pass_sub: "Tiers 1–2 are free. The pass opens the rest of the track.",
    store: "Store", store_note: "Prototype: purchases are simulated and nothing is charged.",
    daily_sub: "One room for every player in the world. Fewest echoes wins; time breaks ties.",
    play_daily: "Play today's room", leaderboard: "Leaderboard", board_empty: "No results yet today. Be the first.",
    editor_sub: "Paint a room, test it, then share its code. Rooms need one start and one exit; a door opens while its plate is held.",
    mirror: "Mirror echoes", par: "Par", add_drone: "+ Drone", clear_drones: "Clear drones", test: "Test", get_code: "Share code", load_code: "Load code",
    language: "Language", music: "Music", sfx: "Sound effects", shake: "Screen shake", name: "Player name",
    loop_saved: "Echo #{n} saved", loop_sub: "Now play beside it", caught: "Caught", caught_sub: "Only this loop restarts",
    out_of_echoes: "Out of echoes", out_sub: "The level restarts", loop_n: "Loop {n}",
    hint_move: "Move your thumb to move. Reach the golden exit.", hint_plate: "A door only opens while someone stands on its plate. Let your echo hold it.",
    hint_drone: "Drones catch only you, never your echoes.", hint_mirror: "In this world echoes move mirrored: your right is their left.",
    hint_generic: "When the 10 seconds end, the loop is saved as an echo. You don't have to succeed on the first run.",
    bought: "Bought!", equipped: "Equipped", not_enough: "Not enough {c}", owned: "Owned", equip: "Equip", buy: "Buy",
    starter: "Starter pack", starter_d: "120 gems + 500 coins + gold skin", gems_small: "100 gems", gems_big: "600 gems",
    noads: "Remove ads", noads_d: "No videos. Hints stay free.", pass: "Season pass", pass_d: "Opens all 10 tiers",
    purchase_title: "Confirm purchase (demo)", purchase_sub: "The real build opens the App Store here. This one only pretends.", confirm: "Confirm", cancel: "Cancel",
    ad_title: "Sample ad", ad_sub: "A sponsored video would play here ({n})", ad_done: "You got +30 coins", hint_title: "Hint",
    clubs_title: "Clubs", clubs_sub: "Weekly team challenges: 20 players, one shared room, fewest echoes together. Coming soon.", close: "Close",
    streak: "{n}-day streak", bonus_today: "Daily bonus +{n}", online: "Online", offline: "Offline · saved on device",
    copied: "Copied!", share_text: "I cleared {lvl} in ECHO with {e} echoes in {t}s ⭐{s}", custom: "Custom room", daily_name: "Daily #{d}",
    level_locked: "Level locked", bad_code: "That code is not valid", tier_locked: "Needs the season pass", need_xp: "Needs more XP",
    about: "ECHO · prototype · art and sound made with Higgsfield", you: "you", unnamed: "Player", menu: "Menu", par_label: "Par",
  },
};
let lang = "en";
const T = (k, v) => (STR[lang][k] || STR.en[k] || k).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] !== undefined ? v[n] : ""));

// ── settings & identity ────────────────────────────────────────────────────

const store = {
  get(k, d) { try { const v = localStorage.getItem("echo:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("echo:" + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const opts = Object.assign({ music: true, sfx: true, shake: true, lang: "en" }, store.get("opts", {}));
lang = opts.lang;
const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function playerId() {
  let id = store.get("pid", null);
  if (!id) { id = Math.random().toString(36).slice(2, 10); store.set("pid", id); }
  return id;
}
const PID = playerId();
const today = () => Math.floor(Date.now() / 86400000);

// ── save room: socket when reachable, local rules otherwise ────────────────

const PING = "__ping", PONG = "__pong";

class Room {
  constructor(name, onView) {
    this.name = name; this.onView = onView; this.socket = null; this.online = false;
    this.local = store.get("room:" + name, null) || L.setup([PID]);
    this.pending = [];
    this.retry = 0;
    // Show the cached save at once; the room corrects it when it answers.
    this.emitLocal();
    if ((window.ECHO_SERVER || location.protocol.startsWith("http")) && !window.ECHO_FORCE_LOCAL) this.connect();
  }
  connect() {
    const proto = window.ECHO_SERVER || location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.ECHO_SERVER || location.host;
    let ws;
    try { ws = new WebSocket(`${proto}//${host}/ws/${this.name}`); } catch { return; }
    this.socket = ws;
    const timer = setTimeout(() => { if (!this.online) { try { ws.close(); } catch { /* */ } } }, 4000);
    ws.addEventListener("open", () => {
      clearTimeout(timer); this.retry = 0; this.online = true;
      ws.send(JSON.stringify({ type: "join", playerId: PID }));
      for (const a of this.pending) ws.send(JSON.stringify({ type: "action", action: a }));
      this.pending = [];
      setNet();
    });
    ws.addEventListener("message", (e) => {
      if (e.data === PONG) return;
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === "state" && m.view) this.onView(m.view, true);
      else if (m.type === "error") console.warn("room:", m.error);
    });
    ws.addEventListener("close", () => {
      this.online = false; setNet();
      this.retry = Math.min(this.retry + 1, 6);
      setTimeout(() => this.connect(), 1000 * 2 ** this.retry);
    });
    ws.addEventListener("error", () => { /* close follows */ });
  }
  emitLocal() { this.onView(L.viewFor(this.local, PID), false); }
  act(action) {
    // Local first, so the UI answers instantly; the room confirms or corrects.
    const v = L.validateAction(this.local, PID, action);
    if (!v.ok) return v;
    this.local = L.applyAction(this.local, PID, action);
    store.set("room:" + this.name, this.local);
    if (this.online && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "action", action }));
    else if (this.name !== "daily") this.pending.push(action);
    this.emitLocal();
    return v;
  }
}

let profile = L.newProfile(PID);
let dailyView = { day: 0, board: [] };
let saveRoom = null, dailyRoom = null;

function openRooms() {
  saveRoom = new Room("p-" + PID, (view, fromNet) => {
    // The server copy wins when it is ahead; the local copy is only a cache.
    if (!fromNet || view.profile.clears >= profile.clears) profile = view.profile;
    if (fromNet) { saveRoom.local = { ...saveRoom.local, players: { ...saveRoom.local.players, [PID]: profile } }; }
    refreshCurrencies();
  });
  dailyRoom = new Room("daily", (view) => { dailyView = view.daily; if (!screenEl("s-daily").hidden) renderDaily(); });
  setInterval(() => { for (const r of [saveRoom, dailyRoom]) if (r.online) r.socket.send(PING); }, 30000);
}

function setNet() {
  if (!saveRoom) return;
  const el = document.getElementById("netstate");
  el.textContent = saveRoom.online ? T("online") : T("offline");
  el.style.color = saveRoom.online ? "var(--good)" : "var(--dim)";
}

// ── assets ─────────────────────────────────────────────────────────────────

const IMG = {};
for (const n of ["hero", "echo", "plate", "door", "exit", "coin", "drone", "gem", "floor"]) { const i = new Image(); i.src = `assets/${n}.png`; IMG[n] = i; }
const BG = {};
for (const n of ["bg_lab", "bg_obs", "bg_mirror"]) { const i = new Image(); i.src = `assets/${n}.jpg`; BG[n] = i; }
const ready = (img) => img && img.complete && img.naturalWidth > 0;

const SND = {};
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ } }
  return actx;
}
/** One-shot effect; the pitch wobbles a little so repeats never sound stamped. */
function sfx(name, vol = 0.8) {
  if (!opts.sfx) return;
  let a = SND[name];
  if (!a) { a = new Audio(`assets/sfx_${name}.mp3`); SND[name] = a; }
  try { const c = a.cloneNode(); c.volume = vol; c.playbackRate = 0.94 + Math.random() * 0.12; c.play().catch(() => {}); } catch { /* */ }
}
let music = null;
function musicOn(on) {
  if (!music) { music = new Audio("assets/music.mp3"); music.loop = true; music.volume = 0.32; }
  if (on && opts.music) music.play().catch(() => {}); else music.pause();
}
/** A short synth tone; its pitch climbs with every echo that joins the room. */
function tone(step, dur = 0.18) {
  if (!opts.sfx) return;
  const c = audio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = "triangle"; o.frequency.value = 330 * Math.pow(2, step / 6);
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.22, c.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
}

// ── DOM helpers ────────────────────────────────────────────────────────────

const $ = (s) => document.querySelector(s);
const screenEl = (id) => document.getElementById(id);
const SCREENS = ["s-title", "s-levels", "s-result", "s-shop", "s-daily", "s-editor", "s-settings", "s-sheet"];
let current = "s-title";
/** One sheet at a time over the canvas; "none" is the bare playfield + HUD. */
function show(id) {
  current = id;
  for (const s of SCREENS) screenEl(s).hidden = s !== id;
  $("#hud").hidden = id !== "none";
  if (id !== "none") { $("#hintbar").classList.remove("show"); $("#banner").classList.remove("show"); }
  if (id === "s-title") titleFx(true); else titleFx(false);
}
function openSheet() { screenEl("s-sheet").hidden = false; $("#hud").hidden = true; }
function closeSheet() { screenEl("s-sheet").hidden = true; $("#hud").hidden = current !== "none"; }
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove("show"), 1800);
}
function applyLang() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = T(el.dataset.i18n); });
  document.querySelectorAll("[data-lang]").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));
  $("#about").textContent = T("about");
  refreshCurrencies();
}
function refreshCurrencies() {
  document.querySelectorAll("#t-coins, .t-coins").forEach((e) => { e.textContent = profile.coins; });
  document.querySelectorAll("#t-gems, .t-gems").forEach((e) => { e.textContent = profile.gems; });
  document.querySelectorAll("#t-stars, .t-stars").forEach((e) => { e.textContent = L.totalStars(profile); });
  const st = $("#t-streak"); st.innerHTML = "";
  if (profile.streak) { st.innerHTML = `<svg class="ic"><use href="#i-flame"/></svg>`; st.append(document.createTextNode(T("streak", { n: profile.streak }))); }
  if (!screenEl("s-levels").hidden) renderLevels();
  if (!screenEl("s-shop").hidden) renderShop();
}

// ── game state ─────────────────────────────────────────────────────────────

const game = {
  level: null, levelKey: null, logs: [], run: null, recording: "", playing: false, replay: null,
  acc: 0, last: 0, timeScale: 1, shake: 0, particles: [], flies: [], flash: 0, doorAnim: {},
  keys: new Set(), gen: 0, loopT: 0, freeze: 0, rewind: 0, cam: { zoom: 1, fx: 0, fy: 0, tz: 1, tfx: 0, tfy: 0 }, result: null,
};
const canvas = $("#game");
const ctx = canvas.getContext("2d");
let view = { ox: 0, oy: 0, cs: 40, w: 0, h: 0 };
const WALL_H = 0.26;
let bgCache = { key: "", canvas: null };
let floorCache = { key: "", canvas: null };

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  view.w = window.innerWidth; view.h = window.innerHeight;
  canvas.width = Math.round(view.w * dpr); canvas.height = Math.round(view.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = 118, bottom = view.h > view.w ? 128 : 86;
  const cs = Math.floor(Math.min((view.w - 24) / L.COLS, (view.h - top - bottom) / (L.ROWS + WALL_H)));
  view.cs = cs; view.ox = Math.round((view.w - cs * L.COLS) / 2);
  view.oy = Math.round(top + (view.h - top - bottom - cs * (L.ROWS + WALL_H)) / 2 + cs * WALL_H);
  bgCache.key = ""; floorCache.key = "";
}
window.addEventListener("resize", resize);
resize();

function levelName(key) {
  if (key === "daily") return T("daily_name", { d: today() % 1000 });
  if (key.startsWith("custom")) return T("custom");
  return `${T("world" + key.split("-")[0])} · ${key.split("-")[1]}`;
}

function startLevel(level, key) {
  game.level = level; game.levelKey = key; game.logs = [];
  game.replay = null;
  show("none");
  $("#lvname").textContent = levelName(key);
  startLoop();
  hint(hintFor(level, key));
  musicOn(true);
  game.playing = true;
}
function hintFor(level, key) {
  if (key === "1-1") return T("hint_move");
  if (key === "1-2") return T("hint_plate");
  if (key === "2-1") return T("hint_drone");
  if (key === "3-1") return T("hint_mirror");
  return T("hint_generic");
}
function hint(text) {
  const h = $("#hintbar"); h.textContent = text; h.classList.add("show");
  clearTimeout(hint.tm); hint.tm = setTimeout(() => h.classList.remove("show"), 4500);
}
/** Run `fn` after `ms` unless another loop has started in the meantime. */
function later(ms, fn) {
  const g = game.gen;
  setTimeout(() => { if (game.playing && game.gen === g) fn(); }, ms);
}
function startLoop() {
  game.gen += 1;
  game.recording = "";
  game.run = L.createRun(game.level, [...game.logs, ""]);
  game.acc = 0; game.timeScale = 1; game.particles = []; game.flies = []; game.doorAnim = {}; game.loopT = 0; game.freeze = 0;
  game.cam.zoom = reduceMotion ? 1 : 1.07; game.cam.tz = 1; game.cam.fx = game.cam.fy = game.cam.tfx = game.cam.tfy = 0;
  banner(T("loop_n", { n: game.logs.length + 1 }), game.logs.length ? T("loop_sub") : "", 900);
  tone(game.logs.length, 0.25);
  renderEchoDots();
  $("#h-coins").textContent = "0";
}
function renderEchoDots() {
  const el = $("#echoes"); el.innerHTML = "";
  for (let i = 0; i <= L.MAX_ECHOES; i++) {
    const d = document.createElement("i");
    if (i < game.logs.length) d.className = "on"; else if (i === game.logs.length) d.className = "hero";
    el.appendChild(d);
  }
}
function banner(title, sub, ms) {
  const b = $("#banner"); b.innerHTML = ""; b.append(document.createTextNode(title));
  if (sub) { const s = document.createElement("small"); s.textContent = sub; b.appendChild(s); }
  b.classList.add("show"); clearTimeout(banner.tm); banner.tm = setTimeout(() => b.classList.remove("show"), ms);
}

/** The loop ended without an exit: it becomes an echo, or the level resets. */
function loopEnded() {
  game.rewind = 0.4;
  if (game.logs.length >= L.MAX_ECHOES) {
    banner(T("out_of_echoes"), T("out_sub"), 1400);
    sfx("fail"); shake(10);
    later(1300, () => { game.logs = []; startLoop(); });
    return;
  }
  game.logs.push(game.recording);
  banner(T("loop_saved", { n: game.logs.length }), T("loop_sub"), 1300);
  sfx("chime", 0.6);
  later(950, startLoop);
}
function loopFailed() {
  banner(T("caught"), T("caught_sub"), 1200);
  sfx("fail"); shake(14); game.flash = 0.5; game.freeze = 0.09;
  later(1000, startLoop);
}
function levelDone() {
  const logs = [...game.logs, game.recording];
  const res = L.simulate(game.level, logs);
  const stars = L.starsFor(game.level, res.echoes);
  const action = { t: "complete", level: game.levelKey, logs, day: today() };
  const before = profile.coins, firstClear = !profile.best[game.levelKey === "daily" ? `daily-${today()}` : game.levelKey];
  const v = saveRoom.act(action);
  if (game.levelKey === "daily") dailyRoom.act(action);
  const reward = v.ok ? profile.coins - before : 0;
  sfx("win"); game.timeScale = 0.22; shake(6);
  const h = game.run.actors[game.run.actors.length - 1];
  game.cam.tz = reduceMotion ? 1 : 1.14; game.cam.tfx = (h.x - L.COLS / 2) * view.cs * 0.6; game.cam.tfy = (h.y - L.ROWS / 2) * view.cs * 0.6;
  game.replay = { logs, level: game.level, live: true };
  game.result = { stars, res, reward, firstClear };
  setTimeout(() => {
    game.playing = false; musicOn(false);
    const title = stars === 3 ? T("perfect") : T("done_title");
    const rt = $("#r-title"); rt.textContent = title; rt.dataset.echo = title;
    const st = $("#r-stars"); st.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("class", "ic " + (i < stars ? "on" : "off")); s.style.animationDelay = `${0.15 + i * 0.22}s`;
      s.innerHTML = `<use href="#i-star"/>`; st.appendChild(s);
      if (i < stars) setTimeout(() => tone(4 + i * 2, 0.3), 150 + i * 220);
    }
    $("#r-echoes").textContent = res.echoes; $("#r-time").textContent = (res.exitTick / L.TPS).toFixed(1);
    countUp($("#r-coins"), reward);
    $("#r-sub").textContent = (firstClear ? T("first_clear") + " · " : "") + `${T("par_label")} ${game.level.par}`;
    $("#b-next").hidden = game.levelKey === "daily" || game.levelKey.startsWith("custom") || !nextLevelKey();
    show("s-result");
  }, 1150);
}
function countUp(el, n) {
  const t0 = performance.now();
  const step = () => { const k = Math.min(1, (performance.now() - t0) / 900); const e = 1 - Math.pow(1 - k, 3); el.textContent = "+" + Math.round(n * e); if (k < 1) requestAnimationFrame(step); };
  step();
}
function nextLevelKey() {
  const i = L.LEVELS.findIndex((l) => l.id === game.levelKey);
  const n = L.LEVELS[i + 1];
  return n && L.worldUnlocked(profile, n.world) ? n.id : null;
}
function shake(n) { if (opts.shake && !reduceMotion) game.shake = Math.max(game.shake, n); }
function quit() {
  game.playing = false; musicOn(false); game.replay = null;
  show(game.levelKey === "daily" ? "s-daily" : game.levelKey?.startsWith("custom") ? "s-editor" : "s-levels");
  if (current === "s-levels") renderLevels();
}

// ── input ──────────────────────────────────────────────────────────────────

const KEYS = { ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };
window.addEventListener("keydown", (e) => { if (KEYS[e.code]) { game.keys.add(KEYS[e.code]); e.preventDefault(); } if (e.code === "KeyR" && game.playing) startLoop(); });
window.addEventListener("keyup", (e) => { if (KEYS[e.code]) game.keys.delete(KEYS[e.code]); });
window.addEventListener("blur", () => game.keys.clear());
function keyDir() {
  const k = game.keys;
  const dx = (k.has("r") ? 1 : 0) - (k.has("l") ? 1 : 0), dy = (k.has("d") ? 1 : 0) - (k.has("u") ? 1 : 0);
  return vecDir(dx, dy);
}
function vecDir(dx, dy) {
  if (!dx && !dy) return 0;
  const a = Math.atan2(dy, dx);           // 0 = right, +π/2 = down (screen y)
  const idx = Math.round(a / (Math.PI / 4));  // -4 (left) .. 0 (right) .. 4 (left)
  return [7, 8, 1, 2, 3, 4, 5, 6, 7][idx + 4];
}
const stick = { id: null, x: 0, y: 0, dir: 0 };
const stickEl = $("#stick");
canvas.addEventListener("pointerdown", (e) => {
  if (!game.playing || stick.id !== null) return;
  audio()?.resume?.();
  stick.id = e.pointerId; stick.x = e.clientX; stick.y = e.clientY; stick.dir = 0;
  stickEl.style.display = "block"; stickEl.style.left = `${stick.x}px`; stickEl.style.top = `${stick.y}px`;
  stickEl.firstElementChild.style.transform = "";
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.x, dy = e.clientY - stick.y;
  const d = Math.hypot(dx, dy);
  stick.dir = d < 12 ? 0 : vecDir(dx, dy);
  const m = Math.min(d, 48); if (d) { dx = dx / d * m; dy = dy / d * m; }
  stickEl.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
});
const stickUp = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; stick.dir = 0; stickEl.style.display = "none"; };
canvas.addEventListener("pointerup", stickUp); canvas.addEventListener("pointercancel", stickUp);

// ── frame loop ─────────────────────────────────────────────────────────────

function frame(now) {
  const dt = Math.min(0.2, (now - game.last) / 1000); game.last = now;
  if (game.playing) {
    if (game.freeze > 0) game.freeze -= dt;            // hit-stop: the world holds its breath
    else {
      game.acc += dt * game.timeScale;
      const step = 1 / L.TPS;
      while (game.acc >= step) {
        game.acc -= step;
        if (game.replay && !game.replay.live) tickReplay(); else tick();
      }
    }
    game.loopT += dt;
    if (game.timeScale < 1 && !game.run.finished) game.timeScale = Math.min(1, game.timeScale + dt * 1.5);
  }
  const c = game.cam, k = Math.min(1, dt * 5);
  c.zoom += (c.tz - c.zoom) * k; c.fx += (c.tfx - c.fx) * k; c.fy += (c.tfy - c.fy) * k;
  if (game.rewind > 0) game.rewind -= dt;
  draw(dt);
  requestAnimationFrame(frame);
}
function tick() {
  const run = game.run;
  if (run.finished || run.dead || run.tick >= L.LOOP_TICKS) return;
  const dir = stick.dir || keyDir();
  game.recording += String(dir);
  L.stepRun(run, dir);
  handleEvents(run);
  updateTimer(run);
  if (run.finished) { levelDone(); return; }
  if (run.dead) { loopFailed(); return; }
  if (run.tick >= L.LOOP_TICKS) loopEnded();
}
function tickReplay() {
  const run = game.run;
  if (run.finished || run.dead || run.tick >= L.LOOP_TICKS) { game.replay.live = true; return; }
  const c = game.replay.logs[game.replay.logs.length - 1].charCodeAt(run.tick) - 48;
  L.stepRun(run, c >= 0 && c <= 8 ? c : 0);
  handleEvents(run); updateTimer(run);
  if (run.finished) { game.timeScale = 0.3; setTimeout(() => { game.playing = false; show("s-result"); }, 1500); }
}
function updateTimer(run) {
  const left = Math.max(0, (L.LOOP_TICKS - run.tick) / L.TPS);
  $("#t-num").textContent = Math.ceil(left);
  const arc = $("#timer .arc"); const r = 31, c = 2 * Math.PI * r;
  arc.style.strokeDasharray = `${c * (left / 10)} ${c}`; arc.classList.toggle("hot", left < 3 && left > 0);
}
function handleEvents(run) {
  for (const e of run.events) {
    if (e.t === "coin") {
      sfx("chime", 0.5); burst(e.x, e.y, "#ffc93c", 14);
      if (e.hero) flyCoin(e.x, e.y); else bumpCoins();
    } else if (e.t === "plate") { sfx("plate", 0.7); game.flash = Math.max(game.flash, 0.1); ring(e); }
    else if (e.t === "open") { sfx("door", 0.6); game.doorAnim[e.k] = { t: 0, open: true }; }
    else if (e.t === "close") { game.doorAnim[e.k] = { t: 0, open: false }; }
    else if (e.t === "dead") burst(e.x, e.y, "#ff4fd8", 26);
    else if (e.t === "exit") { burst(e.x, e.y, "#ffd9a8", 40); burst(e.x, e.y, "#39e6ff", 24); game.flash = 0.45; }
  }
}
function ring(e) {
  // A plate ripple: one expanding ring particle.
  game.particles.push({ x: 0, y: 0, ring: true, life: 0.5, max: 0.5, color: "#ff4fd8", k: e.k });
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4;
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, color, r: 2 + Math.random() * 4 });
  }
}
function dust(a) {
  if (reduceMotion) return;
  const [dx, dy] = L.DIRS[a.dir];
  game.particles.push({ x: a.x - dx * 0.15 + (Math.random() - 0.5) * 0.2, y: a.y + 0.28, vx: -dx * 0.6 + (Math.random() - 0.5) * 0.4, vy: -0.3 - Math.random() * 0.4 - dy * 0.3, life: 0.35, color: "rgba(170,180,230,.45)", r: 2.5 + Math.random() * 2, dust: true });
}
function flyCoin(x, y) {
  const r = $("#hud-coins").getBoundingClientRect();
  game.flies.push({ x: cx(x), y: cy(y), tx: r.left + r.width / 2, ty: r.top + r.height / 2, t: 0 });
}
function bumpCoins() {
  const chip = $("#hud-coins"); $("#h-coins").textContent = game.run.taken;
  chip.classList.remove("pop"); void chip.offsetWidth; chip.classList.add("pop");
}

// ── rendering ──────────────────────────────────────────────────────────────

const cx = (x) => view.ox + x * view.cs, cy = (y) => view.oy + y * view.cs;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);

/** The world painting, pre-rendered once per screen size: covered, dimmed and
 *  softened so the room reads crisply on top. */
function backdrop(name) {
  const img = BG[name];
  if (!ready(img)) return null;
  const key = `${name}:${view.w}x${view.h}`;
  if (bgCache.key === key) return bgCache.canvas;
  const W = Math.round(view.w * 1.04), H = Math.round(view.h * 1.04);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const bw = img.naturalWidth * s, bh = img.naturalHeight * s;
  const by = Math.min(0, Math.max(H - bh, cy(L.ROWS / 2) - bh / 2));
  g.filter = "blur(2px) saturate(.9)"; g.globalAlpha = 0.82; g.drawImage(img, (W - bw) / 2, by, bw, bh);
  g.filter = "none"; g.globalAlpha = 1;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(7,10,24,.6)"); grad.addColorStop(0.4, "rgba(7,10,24,.22)"); grad.addColorStop(1, "rgba(7,10,24,.9)");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // A cool overhead light that pools around the room, so it sits in the hall
  // instead of floating on a black field.
  const lx = cx(L.COLS / 2) + W * 0.02, ly = cy(L.ROWS / 2) + H * 0.02, lr = Math.max(W, H) * 0.55;
  const lg = g.createRadialGradient(lx, ly - lr * 0.15, 0, lx, ly, lr);
  lg.addColorStop(0, "rgba(140,180,255,.16)"); lg.addColorStop(0.5, "rgba(120,160,255,.05)"); lg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  bgCache = { key, canvas: c };
  return c;
}

/**
 * The floor, baked once per room and screen size: tiled slate, per-cell wear,
 * ambient occlusion where floor meets wall, and the walls' drop shadows. Baking
 * keeps the per-frame cost at one drawImage.
 */
function floorLayer(level) {
  const key = `${level.map.join("")}:${view.w}x${view.h}:${ready(IMG.floor)}`;
  if (floorCache.key === key) return floorCache.canvas;
  const c = document.createElement("canvas"); c.width = view.w; c.height = view.h;
  const g = c.getContext("2d");
  const cs = view.cs;
  const isWall = (x, y) => x < 0 || y < 0 || x >= L.COLS || y >= L.ROWS || level.map[y][x] === "#";
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
    if (isWall(x, y)) continue;
    const px = view.ox + x * cs, py = view.oy + y * cs;
    if (ready(IMG.floor)) g.drawImage(IMG.floor, px, py, cs, cs);
    else { g.fillStyle = "#222a52"; g.fillRect(px, py, cs, cs); }
    g.fillStyle = `rgba(10,14,32,${0.12 + rnd() * 0.16})`; g.fillRect(px, py, cs, cs);
    g.strokeStyle = "rgba(5,7,18,.45)"; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, cs - 1, cs - 1);
    // Ambient occlusion: a soft darkening along every edge that meets a wall.
    const ao = cs * 0.34;
    const edges = [[isWall(x, y - 1), px, py, px, py + ao], [isWall(x, y + 1), px, py + cs, px, py + cs - ao], [isWall(x - 1, y), px, py, px + ao, py], [isWall(x + 1, y), px + cs, py, px + cs - ao, py]];
    for (const [w, x0, y0, x1, y1] of edges) {
      if (!w) continue;
      const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "rgba(3,5,14,.55)"); gr.addColorStop(1, "rgba(3,5,14,0)");
      g.fillStyle = gr; g.fillRect(px, py, cs, cs);
    }
  }
  // Wall drop shadows onto the floor (light from the upper left).
  g.save(); g.filter = `blur(${Math.max(3, cs * 0.12)}px)`; g.fillStyle = "rgba(3,5,14,.55)";
  for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
    if (!isWall(x, y)) continue;
    g.fillRect(view.ox + (x + 0.12) * cs, view.oy + (y + 0.18) * cs, cs, cs);
  }
  g.restore();
  // Vignette over the room so the centre reads brightest.
  const vx = view.ox + cs * L.COLS / 2, vy = view.oy + cs * L.ROWS / 2;
  const vg = g.createRadialGradient(vx, vy, cs * 2, vx, vy, cs * 7.5);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.42)");
  g.fillStyle = vg; g.fillRect(0, 0, view.w, view.h);
  floorCache = { key, canvas: c };
  return c;
}

const skinCache = {};
function skinColor(skin) { const c = L.SKINS[skin]?.color || "#39e6ff"; return c === "rainbow" ? "#b06cff" : c; }
function echoSprite(skin) {
  if (skinCache[skin]) return skinCache[skin];
  const img = IMG.echo; if (!ready(img)) return img;
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const col = L.SKINS[skin]?.color || "#39e6ff";
  if (col !== "#39e6ff") {
    g.globalCompositeOperation = "source-atop";
    if (col === "rainbow") { const gr = g.createLinearGradient(0, 0, c.width, c.height); ["#ff4fd8", "#ffc93c", "#6cf0a6", "#39e6ff", "#b06cff"].forEach((h, i) => gr.addColorStop(i / 4, h)); g.fillStyle = gr; }
    else g.fillStyle = col;
    g.globalAlpha = 0.55; g.fillRect(0, 0, c.width, c.height);
  }
  skinCache[skin] = c; return c;
}

function light(x, y, r, color, alpha, sx = 1, sy = 1) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save(); ctx.translate(cx(x), cy(y)); ctx.scale(sx, sy); ctx.globalAlpha = alpha; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.restore();
}
function shadow(x, y, w, alpha = 0.4) {
  ctx.save(); ctx.translate(cx(x), cy(y)); ctx.scale(1, 0.42); ctx.fillStyle = `rgba(3,5,14,${alpha})`;
  ctx.beginPath(); ctx.arc(0, 0, view.cs * w, 0, 7); ctx.fill(); ctx.restore();
}
function sprite(img, x, y, size, alpha = 1, opt = {}) {
  const s = view.cs * size;
  if (!img || (img instanceof HTMLImageElement && !ready(img))) {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = "#ff9a3c"; ctx.beginPath(); ctx.arc(cx(x), cy(y), s * 0.3, 0, 7); ctx.fill(); ctx.restore(); return;
  }
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(cx(x), cy(y));
  if (opt.rot) ctx.rotate(opt.rot);
  ctx.scale((opt.flip ? -1 : 1) * (opt.sx || 1), opt.sy || 1);
  ctx.drawImage(img, -s / 2, -s / 2 - (opt.lift || 0) * view.cs, s, s); ctx.restore();
}

/** One gradient for the whole room, so adjacent blocks merge into one slab. */
let wallGrad = { key: "", top: null, front: null };
function wallPaint() {
  const key = `${view.ox},${view.oy},${view.cs}`;
  if (wallGrad.key === key) return wallGrad;
  const x0 = cx(0), y0 = cy(0), x1 = cx(L.COLS), y1 = cy(L.ROWS);
  const top = ctx.createLinearGradient(x0, y0, x1, y1);
  top.addColorStop(0, "#4b5796"); top.addColorStop(1, "#353f7a");
  const front = ctx.createLinearGradient(0, 0, 0, view.cs * WALL_H);
  front.addColorStop(0, "#2a3268"); front.addColorStop(1, "#141937");
  wallGrad = { key, top, front };
  return wallGrad;
}
function drawWall(level, x, y) {
  const cs = view.cs, H = WALL_H;
  const isWall = (ax, ay) => ax < 0 || ay < 0 || ax >= L.COLS || ay >= L.ROWS || level.map[ay][ax] === "#";
  const px = cx(x), py = cy(y);
  const paint = wallPaint();
  // Front face, only where the floor continues below.
  if (!isWall(x, y + 1)) {
    ctx.save(); ctx.translate(0, py + cs * (1 - H)); ctx.fillStyle = paint.front; ctx.fillRect(px, 0, cs, cs * H); ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(px, py + cs * (1 - H), cs, 1.5);
  }
  // Top face with a whisper of grain.
  ctx.fillStyle = paint.top; ctx.fillRect(px, py - cs * H, cs, cs);
  const n = ((x * 7919 + y * 104729) % 17) / 17;
  ctx.fillStyle = `rgba(255,255,255,${0.012 + n * 0.03})`; ctx.fillRect(px, py - cs * H, cs, cs);
  // Exposed edges catch the light; merged runs keep no seam.
  ctx.fillStyle = "rgba(255,255,255,.16)";
  if (!isWall(x, y - 1)) ctx.fillRect(px, py - cs * H, cs, 2);
  if (!isWall(x - 1, y)) ctx.fillRect(px, py - cs * H, 1.5, cs);
  ctx.fillStyle = "rgba(5,7,18,.35)";
  if (!isWall(x + 1, y)) ctx.fillRect(px + cs - 1.5, py - cs * H, 1.5, cs);
  if (!isWall(x, y + 1)) ctx.fillRect(px, py + cs * (1 - H) - 1.5, cs, 1.5);
}
function drawDoor(level, x, y, ch, dt) {
  const cs = view.cs, H = WALL_H;
  const an = game.doorAnim[ch]; let open = game.run.doors[ch] ? 1 : 0;
  if (an) { an.t = Math.min(1, an.t + dt * 3.2); const e = easeOut(an.t); open = an.open ? e : 1 - e; }
  const px = cx(x), py = cy(y);
  const now = performance.now() / 1000;
  const vis = 1 - open;                       // how much of the barrier is still up
  // The gate spans the gap in the wall: vertical bars when the wall runs up and
  // down, horizontal bars when it runs left and right. The walls are the posts;
  // the emitters sit on their faces.
  const isWall = (ax, ay) => ax < 0 || ay < 0 || ax >= L.COLS || ay >= L.ROWS || level.map[ay][ax] === "#";
  const vertical = isWall(x, y - 1) && isWall(x, y + 1);
  const lens = vis > 0.01 ? "#ff4fd8" : "#4a3f6b";
  ctx.fillStyle = lens;
  if (vertical) { ctx.fillRect(px + cs * 0.35, py - 3, cs * 0.3, 3); ctx.fillRect(px + cs * 0.35, py + cs - 3, cs * 0.3, 3); }
  else { ctx.fillRect(px, py + cs * 0.35, 3, cs * 0.3); ctx.fillRect(px + cs - 3, py + cs * 0.35, 3, cs * 0.3); }
  // Floor rail marking the threshold.
  ctx.fillStyle = "rgba(255,79,216,.22)";
  if (vertical) ctx.fillRect(px + cs / 2 - 1, py + 2, 2, cs - 4); else ctx.fillRect(px + 2, py + cs / 2 - 1, cs - 4, 2);
  if (vis > 0.01) {
    const span = (cs - 6) * easeOut(vis);
    // Glow is a wider, fainter pass under each bar: no shadowBlur in the frame loop.
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const off = cs * (0.22 + i * 0.28) + Math.sin(now * 9 + i * 2.1) * 1.2;
      const a = (0.55 + Math.sin(now * 17 + i) * 0.15) * vis;
      if (vertical) {
        const top = py + cs / 2 - span / 2;
        ctx.globalAlpha = a * 0.35; ctx.fillStyle = "#ff4fd8"; ctx.fillRect(px + off - 3, top, 9, span);
        ctx.globalAlpha = a; ctx.fillStyle = "#ffb3f0"; ctx.fillRect(px + off, top, 3, span);
      } else {
        const left = px + cs / 2 - span / 2;
        ctx.globalAlpha = a * 0.35; ctx.fillStyle = "#ff4fd8"; ctx.fillRect(left, py + off - 3, span, 9);
        ctx.globalAlpha = a; ctx.fillStyle = "#ffb3f0"; ctx.fillRect(left, py + off, span, 3);
      }
    }
    ctx.restore();
    ctx.globalCompositeOperation = "lighter";
    light(x + 0.5, y + 0.5, cs * 0.9, "rgba(255,79,216,.5)", 0.3 * vis, 1, 0.7);
    ctx.globalCompositeOperation = "source-over";
  }
  // The gate's letter on a small dark tag, clear of the bars.
  const tw = cs * 0.34, th = cs * 0.26, tx = px + cs / 2 - tw / 2, ty = vertical ? py + cs * 0.02 : py + cs * 0.04;
  ctx.fillStyle = "rgba(7,10,24,.8)"; ctx.beginPath();
  ctx.moveTo(tx + 4, ty); ctx.arcTo(tx + tw, ty, tx + tw, ty + th, 4); ctx.arcTo(tx + tw, ty + th, tx, ty + th, 4); ctx.arcTo(tx, ty + th, tx, ty, 4); ctx.arcTo(tx, ty, tx + tw, ty, 4); ctx.fill();
  ctx.font = `600 ${Math.round(cs * 0.22)}px Fredoka, Heebo, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillText(ch, px + cs / 2, ty + th / 2 + 0.5);
}

function draw(dt) {
  const { w, h, cs } = view;
  const run = game.run;
  ctx.clearRect(0, 0, w, h);
  if (!run || (current !== "none" && current !== "s-result")) { ctx.fillStyle = "#070a18"; ctx.fillRect(0, 0, w, h); return; }
  const lvl = run.level;
  const now = performance.now() / 1000;

  // Backdrop with a slow drift.
  const bgc = backdrop(L.WORLDS[(lvl.world || 1) - 1].bg);
  if (bgc) ctx.drawImage(bgc, -w * 0.02 + Math.sin(now * 0.12) * 5, -h * 0.02 + Math.cos(now * 0.09) * 4);
  else { ctx.fillStyle = "#0e1328"; ctx.fillRect(0, 0, w, h); }

  // Camera.
  ctx.save();
  const c = game.cam, mx = cx(L.COLS / 2), my = cy(L.ROWS / 2);
  let sx = 0, sy = 0;
  if (game.shake > 0) { sx = (Math.random() - 0.5) * game.shake; sy = (Math.random() - 0.5) * game.shake; game.shake = Math.max(0, game.shake - dt * 40); }
  ctx.translate(mx + sx, my + sy); ctx.scale(c.zoom, c.zoom); ctx.translate(-mx - c.fx, -my - c.fy);

  // Floor.
  ctx.drawImage(floorLayer(lvl), 0, 0);

  // Light pools, additive.
  ctx.globalCompositeOperation = "lighter";
  for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
    const ch = lvl.map[y][x];
    if (ch === "a" || ch === "b" || ch === "c") light(x + 0.5, y + 0.5, cs * 1.1, "rgba(255,79,216,.55)", run.plates[ch] ? 0.55 : 0.2);
    else if (ch === "E") light(x + 0.5, y + 0.5, cs * 1.4, "rgba(255,201,60,.6)", 0.35 + Math.sin(now * 2.2) * 0.08);
  }
  for (const co of run.coins) if (!co.taken) light(co.x, co.y, cs * 0.5, "rgba(255,201,60,.5)", 0.3);
  for (const d of run.drones) light(d.px, d.py + 0.15, cs * 0.95, "rgba(255,79,216,.55)", 0.3, 1, 0.55);
  const last = run.actors.length - 1;
  for (let i = 0; i < last; i++) { const a = run.actors[i]; if (!a.done) light(a.x, a.y + 0.3, cs * 0.8, "rgba(57,230,255,.5)", 0.22, 1, 0.45); }
  ctx.globalCompositeOperation = "source-over";

  // Floor decals: plates, open-door rails, exit, coins, drone paths.
  for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
    const ch = lvl.map[y][x];
    if (ch === "a" || ch === "b" || ch === "c") {
      const on = run.plates[ch];
      sprite(IMG.plate, x + 0.5, y + 0.5, on ? 0.8 : 0.86, on ? 1 : 0.85);
      ctx.font = `600 ${Math.round(cs * 0.3)}px Fredoka, Heebo, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = on ? "#fff" : "rgba(255,255,255,.7)"; ctx.fillText(ch.toUpperCase(), cx(x + 0.5), cy(y + 0.5));
    } else if (ch === "E") {
      const p = 1 + Math.sin(now * 2.2) * 0.04;
      sprite(IMG.exit, x + 0.5, y + 0.48, 0.9 * p, 1, { rot: now * 0.35 });
    }
  }
  for (const d of run.drones) {
    ctx.strokeStyle = "rgba(255,79,216,.18)"; ctx.lineWidth = 2; ctx.setLineDash([5, 9]);
    ctx.beginPath(); ctx.moveTo(cx(d.x + 0.5), cy(d.y + 0.5)); ctx.lineTo(cx(d.x + 0.5 + d.dx * d.n), cy(d.y + 0.5 + d.dy * d.n)); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const co of run.coins) {
    if (co.taken) continue;
    const bob = Math.sin(now * 3 + co.x * 2.1) * 0.05;
    shadow(co.x, co.y + 0.3, 0.16, 0.3);
    sprite(IMG.coin, co.x, co.y + bob - 0.1, 0.6, 1, { sx: Math.abs(Math.cos(now * 2.4 + co.x)) * 0.75 + 0.25 });
  }

  // Depth-sorted: walls, doors, drones, actors.
  const items = [];
  for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
    const ch = lvl.map[y][x];
    if (ch === "#") items.push({ z: y + 1, f: () => drawWall(lvl, x, y) });
    else if (ch === "A" || ch === "B" || ch === "C") items.push({ z: y + 1, f: () => drawDoor(lvl, x, y, ch, dt) });
  }
  const esp = echoSprite(profile.skin), ecol = skinColor(profile.skin);
  run.actors.forEach((a, i) => {
    if (a.done || (!a.alive && i === last)) return;
    const isEcho = i < last;
    const appear = reduceMotion ? 1 : easeOut((game.loopT - (isEcho ? 0.1 + i * 0.07 : 0)) / 0.35);
    items.push({ z: a.y + 0.3, f: () => drawActor(a, isEcho, appear, esp, ecol, now) });
  });
  for (const d of run.drones) items.push({ z: d.py + 0.35, f: () => drawDrone(d, now) });
  items.sort((p, q) => p.z - q.z);
  for (const it of items) it.f();

  // Particles.
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i]; p.life -= dt;
    if (p.life <= 0) { game.particles.splice(i, 1); continue; }
    if (p.ring) {
      const k = 1 - p.life / p.max;
      let px = 0, py = 0;
      for (let y = 0; y < L.ROWS && !px; y++) { const x = lvl.map[y].indexOf(p.k); if (x >= 0) { px = x + 0.5; py = y + 0.5; } }
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.translate(cx(px), cy(py)); ctx.scale(1, 0.55);
      ctx.beginPath(); ctx.arc(0, 0, cs * (0.3 + k * 1.1), 0, 7); ctx.stroke(); ctx.restore();
      continue;
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
    ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(cx(p.x), cy(p.y), p.r * (p.dust ? 1 + (0.35 - p.life) * 2 : 1), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Coins flying to the HUD (screen space).
  for (let i = game.flies.length - 1; i >= 0; i--) {
    const f = game.flies[i]; f.t += dt / 0.55;
    if (f.t >= 1) { game.flies.splice(i, 1); bumpCoins(); continue; }
    const e = f.t * f.t * (3 - 2 * f.t), lift = Math.sin(f.t * Math.PI) * 40;
    const x = f.x + (f.tx - f.x) * e, y = f.y + (f.ty - f.y) * e - lift;
    if (ready(IMG.coin)) ctx.drawImage(IMG.coin, x - 14, y - 14, 28, 28);
  }

  // Post: vignette, rewind scanlines, flash.
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.5)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  if (game.rewind > 0 && !reduceMotion) {
    const k = game.rewind / 0.4;
    ctx.fillStyle = `rgba(57,230,255,${0.08 * k})`;
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    for (let i = 0; i < 6; i++) {
      const by = Math.random() * h, bh = 6 + Math.random() * 30, off = (Math.random() - 0.5) * 24 * k;
      ctx.drawImage(canvas, 0, by * (canvas.height / h), canvas.width, bh * (canvas.height / h), off, by, w, bh);
    }
  }
  if (game.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${game.flash * 0.5})`; ctx.fillRect(0, 0, w, h); game.flash = Math.max(0, game.flash - dt * 2); }
}

function drawActor(a, isEcho, appear, esp, ecol, now) {
  const cs = view.cs;
  if (appear <= 0) return;
  const moving = a.dir !== 0;
  if (moving) a.face = a.dir >= 6 ? -1 : a.dir >= 2 && a.dir <= 4 ? 1 : a.face || 1;
  const flip = (a.face || 1) < 0;
  const bob = moving ? Math.abs(Math.sin(game.run.tick * 0.55)) * 0.06 : Math.sin(now * 2.4) * 0.012;
  const sx = moving ? 1 + Math.sin(game.run.tick * 0.55) * 0.04 : 1 - bob * 0.5;
  const sy = moving ? 1 - Math.sin(game.run.tick * 0.55) * 0.04 : 1 + bob;
  const lean = moving ? (flip ? -1 : 1) * 0.09 * (a.dir === 1 || a.dir === 5 ? 0 : 1) : 0;
  if (!isEcho && moving && game.run.tick % 5 === 0 && a.alive) dust(a);
  if (isEcho) {
    // Hologram: projector ring + cone + translucent, faintly flickering copy.
    const flick = 0.78 + Math.sin(now * 23 + a.x * 7) * 0.05 + Math.sin(now * 61) * 0.03;
    ctx.save(); ctx.translate(cx(a.x), cy(a.y + 0.32)); ctx.scale(1, 0.4); ctx.strokeStyle = ecol;
    ctx.globalAlpha = 0.25 * appear; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, cs * 0.34, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.9 * appear; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, cs * 0.34, 0, 7); ctx.stroke(); ctx.restore();
    const cone = ctx.createLinearGradient(0, cy(a.y + 0.32), 0, cy(a.y - 0.6));
    cone.addColorStop(0, hexA(ecol, 0.28 * appear)); cone.addColorStop(1, hexA(ecol, 0));
    ctx.fillStyle = cone; ctx.beginPath();
    ctx.moveTo(cx(a.x - 0.3), cy(a.y + 0.32)); ctx.lineTo(cx(a.x + 0.3), cy(a.y + 0.32)); ctx.lineTo(cx(a.x + 0.5), cy(a.y - 0.6)); ctx.lineTo(cx(a.x - 0.5), cy(a.y - 0.6)); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    sprite(esp, a.x, a.y - 0.14 - bob, 1.18 * 1.06, 0.22 * appear, { flip, sx, sy: sy * appear, rot: lean });
    ctx.globalCompositeOperation = "source-over";
    sprite(esp, a.x, a.y - 0.14 - bob, 1.18, flick * appear, { flip, sx, sy: sy * appear, rot: lean });
  } else {
    shadow(a.x, a.y + 0.33, 0.38 * (1 - bob * 2), 0.45);
    sprite(IMG.hero, a.x, a.y - 0.14 - bob, 1.2, 1, { flip, sx: sx * appear, sy: sy * appear, rot: lean });
  }
}
function drawDrone(d, now) {
  const bob = Math.sin(now * 4 + d.x) * 0.05;
  const tilt = d.dx ? Math.sin(now * 0.6) * 0.06 : 0;
  shadow(d.px, d.py + 0.38, 0.3, 0.35);
  sprite(IMG.drone, d.px, d.py - 0.12 + bob, 0.92, 1, { rot: tilt });
  // Scanning eye: a hard little flare.
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + Math.sin(now * 9) * 0.2;
  ctx.fillStyle = "#ff4fd8"; ctx.beginPath(); ctx.arc(cx(d.px), cy(d.py - 0.12 + bob), view.cs * 0.07, 0, 7); ctx.fill(); ctx.restore();
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ── title ambience: slow dust motes over the hall ──────────────────────────

const tfx = { on: false, raf: 0, motes: [] };
function titleFx(on) {
  tfx.on = on && !reduceMotion;
  if (!tfx.on) { cancelAnimationFrame(tfx.raf); return; }
  const c = $("#title-fx"), g = c.getContext("2d");
  const fit = () => { c.width = c.clientWidth; c.height = c.clientHeight; };
  fit();
  if (!tfx.motes.length) for (let i = 0; i < 46; i++) tfx.motes.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, v: 0.01 + Math.random() * 0.03, p: Math.random() * 7, warm: Math.random() < 0.3 });
  let last = performance.now();
  const loop = (t) => {
    if (!tfx.on) return;
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (c.width !== c.clientWidth || c.height !== c.clientHeight) fit();
    g.clearRect(0, 0, c.width, c.height);
    for (const m of tfx.motes) {
      m.y -= m.v * dt; m.p += dt; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
      const x = (m.x + Math.sin(m.p) * 0.01) * c.width, y = m.y * c.height, a = 0.25 + Math.sin(m.p * 1.7) * 0.2;
      g.fillStyle = m.warm ? `rgba(255,196,107,${a})` : `rgba(57,230,255,${a})`;
      g.beginPath(); g.arc(x, y, m.r, 0, 7); g.fill();
    }
    tfx.raf = requestAnimationFrame(loop);
  };
  tfx.raf = requestAnimationFrame(loop);
}

// ── screens: levels ────────────────────────────────────────────────────────

/** A tiny painted plan of the room: enough to recognise it at a glance. */
function drawMinimap(cv, level) {
  const W = 132, H = 84, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const u = W / L.COLS;
  g.fillStyle = "#0a0e20"; g.fillRect(0, 0, W, H);
  for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
    const ch = level.map[y][x], px = x * u, py = y * u;
    if (ch === "#") { g.fillStyle = "#4a5796"; g.fillRect(px, py, u, u); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(px, py, u, 1.5); continue; }
    g.fillStyle = (x + y) % 2 ? "#1a2148" : "#1d2550"; g.fillRect(px, py, u, u);
    g.beginPath();
    if ("abc".includes(ch)) { g.fillStyle = "#ff4fd8"; g.fillRect(px + 2.5, py + 2.5, u - 5, u - 5); }
    else if ("ABC".includes(ch)) { g.fillStyle = "#7a2a74"; g.fillRect(px + 1, py + u * 0.3, u - 2, u * 0.4); }
    else if (ch === "E") { g.fillStyle = "#ffc93c"; g.arc(px + u / 2, py + u / 2, u * 0.36, 0, 7); g.fill(); }
    else if (ch === "S") { g.fillStyle = "#ff9a3c"; g.arc(px + u / 2, py + u / 2, u * 0.32, 0, 7); g.fill(); }
    else if (ch === "o") { g.fillStyle = "#ffe08a"; g.arc(px + u / 2, py + u / 2, u * 0.16, 0, 7); g.fill(); }
  }
  for (const d of level.drones || []) {
    g.strokeStyle = "rgba(255,79,216,.6)"; g.lineWidth = 1.5; g.beginPath();
    g.moveTo((d.x + 0.5) * u, (d.y + 0.5) * u); g.lineTo((d.x + 0.5 + d.dx * d.n) * u, (d.y + 0.5 + d.dy * d.n) * u); g.stroke();
    g.fillStyle = "#ff4fd8"; g.beginPath(); g.arc((d.x + 0.5) * u, (d.y + 0.5) * u, u * 0.3, 0, 7); g.fill();
  }
}
function starIcons(n, size) {
  let s = "";
  for (let i = 0; i < 3; i++) s += `<svg class="ic ${i < n ? "" : "off"}" style="width:${size}px;height:${size}px"><use href="#i-star"/></svg>`;
  return s;
}
function renderLevels() {
  const root = $("#worlds"); root.innerHTML = "";
  for (const w of L.WORLDS) {
    const unlocked = L.worldUnlocked(profile, w.id);
    const sec = document.createElement("section"); sec.className = "world glass" + (unlocked ? "" : " locked");
    sec.style.setProperty("--art", `url(assets/${w.bg}.jpg)`);
    const levels = L.LEVELS.filter((l) => l.world === w.id);
    const got = levels.reduce((n, l) => n + (profile.stars[l.id] || 0), 0);
    const head = document.createElement("header");
    head.innerHTML = `<span class="num">${w.id}</span><h2>${T("world" + w.id)}</h2>` + (unlocked
      ? `<span class="chip"><svg class="ic" style="width:14px;height:14px;fill:var(--gold);stroke:none"><use href="#i-star"/></svg>${got}/${levels.length * 3}</span>`
      : `<span class="lockline"><svg class="ic" style="width:16px;height:16px"><use href="#i-lock"/></svg>${T("world_locked", { n: (w.id - 1) * 7 })}</span>`);
    sec.appendChild(head);
    const grid = document.createElement("div"); grid.className = "rooms";
    for (const lv of levels) {
      const b = document.createElement("button"); b.className = "room";
      const st = profile.stars[lv.id] || 0;
      if (st) b.classList.add("done");
      const cv = document.createElement("canvas"); drawMinimap(cv, lv);
      b.appendChild(cv);
      const num = document.createElement("span"); num.className = "num"; num.textContent = lv.id.split("-")[1]; b.appendChild(num);
      const stars = document.createElement("span"); stars.className = "stars"; stars.innerHTML = starIcons(st, 13); b.appendChild(stars);
      b.addEventListener("click", () => { if (!unlocked) { toast(T("level_locked")); return; } startLevel(lv, lv.id); });
      grid.appendChild(b);
    }
    sec.appendChild(grid); root.appendChild(sec);
  }
}

// ── screens: shop ──────────────────────────────────────────────────────────

function skinPreview(cv, id) {
  const S = 64, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = S * dpr; cv.height = S * dpr;
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const col = skinColor(id);
  g.save(); g.translate(S / 2, S * 0.86); g.scale(1, 0.4); g.strokeStyle = col; g.lineWidth = 2.5; g.shadowColor = col; g.shadowBlur = 10;
  g.beginPath(); g.arc(0, 0, S * 0.3, 0, 7); g.stroke(); g.restore();
  const img = echoSprite(id);
  if (ready(IMG.echo)) { g.globalAlpha = 0.9; g.drawImage(img, S * 0.1, S * 0.02, S * 0.8, S * 0.8); }
}
function renderShop() {
  const sk = $("#skins"); sk.innerHTML = "";
  for (const [id, s] of Object.entries(L.SKINS)) {
    const owned = profile.skins.includes(id), on = profile.skin === id;
    const d = document.createElement("div"); d.className = "skin glass" + (on ? " on" : "");
    const cv = document.createElement("canvas"); skinPreview(cv, id);
    const b = document.createElement("button"); b.className = "btn small" + (owned && !on ? " echo" : "");
    if (on) { b.textContent = T("equipped"); b.disabled = true; }
    else if (owned) { b.textContent = T("equip"); b.addEventListener("click", () => { saveRoom.act({ t: "equip", skin: id }); renderShop(); }); }
    else {
      b.innerHTML = s.gems ? `<img src="assets/gem.png" alt="" style="width:18px"> ${s.gems}` : `<img src="assets/coin.png" alt="" style="width:18px"> ${s.coins}`;
      b.addEventListener("click", () => { const v = saveRoom.act({ t: "buy", item: id }); if (v.ok) { toast(T("bought")); sfx("chime"); } else toast(T("not_enough", { c: s.gems ? "💎" : "🪙" })); renderShop(); });
    }
    const name = document.createElement("b"); name.textContent = id;
    d.append(cv, name, b); sk.appendChild(d);
  }
  const left = profile.adsDay === today() ? L.ADS_PER_DAY - profile.adsToday : L.ADS_PER_DAY;
  $("#ad-left").textContent = left > 0 ? T("ads_left", { n: left }) : T("ads_none");
  $("#b-ad").disabled = left <= 0;

  const tiers = $("#pass"); tiers.innerHTML = "";
  L.PASS_TIERS.forEach((t, i) => {
    const d = document.createElement("div");
    const ok = profile.passXp >= t.xp, claimed = i < profile.claimedTiers, locked = !profile.pass && i >= 2;
    d.className = "tier" + (claimed ? " claimed" : ok ? " ok" : "") + (locked ? " lock" : "");
    d.innerHTML = `<b>${i + 1}</b><span>${t.xp} XP</span><span>${t.coins ? "🪙" + t.coins : ""}${t.gems ? " 💎" + t.gems : ""}${t.skin ? " 🎨" : ""}</span>`;
    tiers.appendChild(d);
  });
  const next = L.PASS_TIERS[profile.claimedTiers];
  $("#pass-xp").textContent = `${profile.passXp} XP` + (next && profile.passXp < next.xp ? ` / ${next.xp}` : "");
  $("#xpfill").style.width = next ? `${Math.min(100, profile.passXp / Math.max(1, next.xp) * 100)}%` : "100%";
  $("#b-claim").disabled = !next || profile.passXp < next.xp || (!profile.pass && profile.claimedTiers >= 2);

  const pr = $("#products"); pr.innerHTML = "";
  for (const [sku, p] of Object.entries(L.IAP)) {
    const d = document.createElement("div"); d.className = "product glass" + (sku === "starter" ? " wide" : "");
    const owned = p.once && profile.owned.includes(sku);
    const desc = T(sku + "_d") === sku + "_d" ? "" : T(sku + "_d");
    d.innerHTML = `<b style="font:600 1.05rem var(--display)">${T(sku)}</b><span class="desc">${desc}</span><span class="price">${owned ? T("owned") : p.price}</span>`;
    const b = document.createElement("button"); b.className = "btn small primary"; b.textContent = T("buy"); b.disabled = owned;
    b.addEventListener("click", () => purchase(sku));
    d.appendChild(b); pr.appendChild(d);
  }
}
function sheet(html, buttons) {
  const s = $("#sheet"); s.innerHTML = html;
  const row = document.createElement("div"); row.className = "row"; row.style.justifyContent = "center";
  for (const [label, cls, fn] of buttons) { const b = document.createElement("button"); b.className = "btn " + cls; b.textContent = label; b.addEventListener("click", fn); row.appendChild(b); }
  s.appendChild(row); openSheet();
}
function purchase(sku) {
  const p = L.IAP[sku];
  sheet(`<h2>${T("purchase_title")}</h2><p>${T(sku)} · ${p.price}</p><p>${T("purchase_sub")}</p>`, [
    [T("cancel"), "ghost", closeSheet],
    [T("confirm"), "primary", () => { const v = saveRoom.act({ t: "iap", sku }); closeSheet(); if (v.ok) { toast(T("bought")); sfx("win", 0.6); } renderShop(); }],
  ]);
}
function watchAd(onDone) {
  if (profile.noads) { onDone(); return; }
  let n = 5;
  sheet(`<h2>${T("ad_title")}</h2><div class="adbox" id="adbox">${n}</div><p id="adsub">${T("ad_sub", { n })}</p>`, []);
  const iv = setInterval(() => {
    n--; const box = $("#adbox"); if (!box) { clearInterval(iv); return; }
    box.textContent = n; $("#adsub").textContent = T("ad_sub", { n });
    if (n <= 0) { clearInterval(iv); closeSheet(); onDone(); }
  }, 1000);
}

// ── screens: daily ─────────────────────────────────────────────────────────

function renderDaily() {
  $("#d-title").textContent = T("daily_name", { d: today() % 1000 });
  const b = $("#board"); b.innerHTML = "";
  const board = dailyView.day === today() ? dailyView.board : [];
  if (!board.length) { const p = document.createElement("p"); p.textContent = T("board_empty"); b.appendChild(p); return; }
  board.slice(0, 20).forEach((e, i) => {
    const d = document.createElement("div"); if (e.pid === PID) d.className = "me";
    d.innerHTML = `<span class="rank">${i + 1}</span><span class="grow">${esc(e.name || (e.pid === PID ? T("you") : T("unnamed")))}</span><span>${e.echoes} ${T("echoes_used")}</span><span>${(e.ticks / L.TPS).toFixed(1)}s</span>`;
    b.appendChild(d);
  });
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ── screens: editor ────────────────────────────────────────────────────────

const ed = { map: ["###########", "#S........#", "#.........#", "#.........#", "#.........#", "#........E#", "###########"].map((r) => r.split("")), tool: "#", drones: [] };
const TOOLS = [["#", "▇"], [".", "·"], ["S", "S"], ["E", "E"], ["a", "a"], ["A", "A"], ["b", "b"], ["B", "B"], ["c", "c"], ["C", "C"], ["o", "o"]];
function renderEditor() {
  const pal = $("#palette"); pal.innerHTML = "";
  for (const [ch, lab] of TOOLS) { const b = document.createElement("button"); b.textContent = lab; b.className = ed.tool === ch ? "on" : ""; b.addEventListener("click", () => { ed.tool = ch; renderEditor(); }); pal.appendChild(b); }
  const g = $("#edgrid"); g.innerHTML = "";
  for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
    const ch = ed.map[y][x]; const b = document.createElement("button");
    b.className = ch === "#" ? "w" : "abc".includes(ch) ? "p" : "ABC".includes(ch) ? "d" : ch === "S" ? "s" : ch === "E" ? "e" : ch === "o" ? "o" : "";
    b.textContent = ch === "#" || ch === "." ? "" : ch;
    if (ed.drones.some((d) => d.x === x && d.y === y)) b.textContent = "◉";
    const paint = () => {
      if (ed.tool === "S" || ed.tool === "E") for (const row of ed.map) for (let i = 0; i < row.length; i++) if (row[i] === ed.tool) row[i] = ".";
      ed.map[y][x] = ed.tool; renderEditor();
    };
    b.addEventListener("pointerdown", paint); b.addEventListener("pointerenter", (e) => { if (e.buttons) paint(); });
    g.appendChild(b);
  }
}
function editorLevel() {
  return { id: "custom", world: 1, par: Number($("#ed-par").value) || 3, mirror: $("#ed-mirror").checked, map: ed.map.map((r) => r.join("")), drones: ed.drones };
}

// ── wiring ─────────────────────────────────────────────────────────────────

$("#b-play").addEventListener("click", () => { renderLevels(); show("s-levels"); });
$("#b-daily").addEventListener("click", () => { renderDaily(); show("s-daily"); });
$("#b-shop").addEventListener("click", () => { renderShop(); show("s-shop"); });
$("#b-editor").addEventListener("click", () => { renderEditor(); show("s-editor"); });
$("#b-settings").addEventListener("click", () => { $("#opt-name").value = profile.name; show("s-settings"); });
$("#b-clubs").addEventListener("click", () => sheet(`<h2>${T("clubs_title")}</h2><p>${T("clubs_sub")}</p>`, [[T("close"), "ghost", closeSheet]]));
document.querySelectorAll(".b-back").forEach((b) => b.addEventListener("click", () => show("s-title")));
$("#b-quit").addEventListener("click", quit);
$("#b-redo").addEventListener("click", () => { if (game.playing) startLoop(); });
$("#b-restart").addEventListener("click", () => { if (game.playing) { game.logs = []; startLoop(); } });
$("#b-hintad").addEventListener("click", () => {
  const hintText = hintFor(game.level, game.levelKey) + " " + T("hint_generic");
  watchAd(() => sheet(`<h2>${T("hint_title")}</h2><p>${hintText}</p>`, [[T("close"), "ghost", closeSheet]]));
});
$("#b-ad").addEventListener("click", () => watchAd(() => { const v = saveRoom.act({ t: "ad", day: today() }); if (v.ok) { toast(T("ad_done")); sfx("chime"); } renderShop(); }));
$("#b-claim").addEventListener("click", () => { const v = saveRoom.act({ t: "claim_pass" }); if (v.ok) { toast(T("bought")); sfx("win", 0.5); } else toast(v.error === "pass required" ? T("tier_locked") : T("need_xp")); renderShop(); });
$("#b-playdaily").addEventListener("click", () => startLevel(L.dailyLevel(today()), "daily"));
$("#b-next").addEventListener("click", () => { const k = nextLevelKey(); if (k) startLevel(L.levelById(k), k); });
$("#b-again").addEventListener("click", () => startLevel(game.level, game.levelKey));
$("#b-replay").addEventListener("click", () => {
  if (!game.replay) return;
  game.run = L.createRun(game.replay.level, game.replay.logs); game.replay.live = false; game.acc = 0; game.timeScale = 1; game.loopT = 0;
  game.cam.tz = 1; game.cam.tfx = game.cam.tfy = 0;
  game.playing = true; show("none"); banner(T("replay"), "", 800);
});
$("#b-share").addEventListener("click", async () => {
  const r = game.result; if (!r) return;
  const text = T("share_text", { lvl: levelName(game.levelKey), e: r.res.echoes, t: (r.res.exitTick / L.TPS).toFixed(1), s: r.stars });
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch { /* cancelled */ }
  try { await navigator.clipboard.writeText(text); toast(T("copied")); } catch { toast(text); }
});
$("#b-menu").addEventListener("click", quit);
$("#b-test").addEventListener("click", () => {
  const lv = editorLevel(); const code = L.encodeLevel(lv);
  if (!L.decodeLevel(code)) { toast(T("bad_code")); return; }
  startLevel(L.decodeLevel(code), "custom:" + code);
});
$("#b-code").addEventListener("click", async () => {
  const code = L.encodeLevel(editorLevel()); $("#ed-code").value = code;
  try { await navigator.clipboard.writeText(code); toast(T("copied")); } catch { /* shown in the box */ }
});
$("#b-load").addEventListener("click", () => {
  const lv = L.decodeLevel($("#ed-code").value.trim());
  if (!lv) { toast(T("bad_code")); return; }
  ed.map = lv.map.map((r) => r.split("")); ed.drones = lv.drones || []; $("#ed-mirror").checked = !!lv.mirror; $("#ed-par").value = lv.par; renderEditor();
});
$("#b-adddrone").addEventListener("click", () => {
  if (ed.drones.length >= 4) return;
  const horiz = ed.drones.length % 2 === 0;
  ed.drones.push(horiz ? { x: 2 + ed.drones.length, y: 2, dx: 1, dy: 0, n: 4, phase: ed.drones.length * 2 } : { x: 5, y: 1, dx: 0, dy: 1, n: 4, phase: ed.drones.length * 2 });
  renderEditor();
});
$("#b-cleardrones").addEventListener("click", () => { ed.drones = []; renderEditor(); });
document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => { lang = opts.lang = b.dataset.lang; store.set("opts", opts); applyLang(); }));
for (const k of ["music", "sfx", "shake"]) {
  const el = $("#opt-" + k); el.checked = opts[k];
  el.addEventListener("change", () => { opts[k] = el.checked; store.set("opts", opts); if (k === "music") musicOn(game.playing); });
}
$("#opt-name").addEventListener("change", (e) => saveRoom.act({ t: "name", name: e.target.value.slice(0, 16) }));
document.addEventListener("pointerdown", () => audio()?.resume?.(), { once: true });
for (const img of Object.values(IMG)) img.addEventListener("load", () => { floorCache.key = ""; });

// ── boot ───────────────────────────────────────────────────────────────────

openRooms();
applyLang();
show("s-title");
setNet();
{
  // Daily streak: once per calendar day, with the bonus shown on arrival.
  const before = profile.coins;
  const v = saveRoom.act({ t: "day", day: today() });
  if (v.ok && profile.coins > before) setTimeout(() => toast(T("bonus_today", { n: profile.coins - before })), 600);
}
game.last = performance.now();
requestAnimationFrame(frame);
