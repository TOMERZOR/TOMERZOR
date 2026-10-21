/**
 * ECHO — the screen and the input.
 *
 * `logic.js` decides everything; this file draws it, listens to thumbs and
 * keys, and talks to the save room. When the game runs on the Higgsfield
 * platform the room is a WebSocket (`/ws/p-<id>` for the player's own save,
 * `/ws/daily` for the shared board). Inside the iPhone app, or anywhere the
 * socket is unreachable, the same rules run locally against localStorage, so
 * the game is playable offline and syncs nothing it cannot verify.
 */
import * as L from "./logic.js";

// ── strings ────────────────────────────────────────────────────────────────

const STR = {
  he: {
    tagline: "10 שניות. ואז אתה משחק לצד עצמך.",
    play: "שחק", daily: "אתגר יומי", shop: "חנות", editor: "עורך שלבים", clubs: "מועדונים", settings: "הגדרות",
    worlds: "עולמות", world1: "המעבדה", world2: "המצפה", world3: "מעבדת המראות",
    world_locked: "נפתח עם {n} כוכבים", redo_loop: "↺ סיבוב", restart_level: "⟲ שלב", hint_ad: "💡 רמז",
    echoes_used: "הדים", seconds: "שניות", coins: "מטבעות", replay: "▶ שידור חוזר", share: "שיתוף", try_fewer: "פחות הדים",
    next: "השלב הבא", done_title: "שלב הושלם!", perfect: "מושלם!", first_clear: "בונוס סיום ראשון +50",
    free_coins: "מטבעות חינם", watch_ad: "צפה בסרטון +30", ads_left: "נותרו {n} סרטונים היום", ads_none: "נגמרו הסרטונים להיום. חזור מחר.",
    echo_skins: "סקינים להדים", skins_sub: "ההדים שלך לובשים אותו בכל שלב, אז כולם רואים אותו בשידורים החוזרים שלך.",
    season_pass: "כרטיס עונה", claim: "קבל", pass_sub: "שלבים 1–2 חינם. הכרטיס פותח את שאר המסלול.",
    store: "חנות", store_note: "אב־טיפוס: הרכישות מדומות ולא מחויב כסף.",
    daily_sub: "חדר אחד לכל השחקנים בעולם. הכי מעט הדים מנצח; הזמן שובר שוויון.",
    play_daily: "שחק את החדר של היום", leaderboard: "טבלת מובילים", board_empty: "עדיין אין תוצאות היום. תהיה הראשון.",
    editor_sub: "צייר חדר, בדוק אותו ושתף את הקוד שלו. חדר צריך התחלה אחת ויציאה אחת; דלת נפתחת כל עוד הלוחית שלה לחוצה.",
    mirror: "הדים במראה", par: "פאר", add_drone: "+ רחפן", clear_drones: "נקה רחפנים", test: "בדיקה", get_code: "קוד שיתוף", load_code: "טען קוד",
    language: "שפה", music: "מוזיקה", sfx: "אפקטים", shake: "רעידת מסך", name: "שם שחקן",
    loop_saved: "הד #{n} נשמר", loop_sub: "עכשיו שחק לצידו", caught: "הרחפן תפס אותך", caught_sub: "רק הסיבוב הזה מתחיל מחדש",
    out_of_echoes: "נגמרו ההדים", out_sub: "השלב מתחיל מחדש", go: "קדימה!", loop_n: "סיבוב {n}",
    hint_move: "הזז את האגודל כדי לזוז. הגע ליציאה הזהובה.", hint_plate: "דלת נפתחת רק כשמישהו עומד על הלוחית. תן להד שלך לעמוד עליה.",
    hint_drone: "רחפנים תופסים רק אותך, לא את ההדים.", hint_mirror: "בעולם הזה ההדים זזים הפוך: ימין שלך הוא שמאל שלהם.",
    hint_generic: "בסוף 10 שניות הסיבוב נשמר כהד. אתה לא חייב להצליח בסיבוב הראשון.",
    bought: "נקנה!", equipped: "מצויד", not_enough: "אין מספיק {c}", owned: "בבעלותך", equip: "צייד", buy: "קנה",
    starter: "חבילת פתיחה", starter_d: "120 יהלומים + 500 מטבעות + סקין זהב", gems_small: "100 יהלומים", gems_big: "600 יהלומים",
    noads: "הסרת פרסומות", noads_d: "בלי סרטונים. רמזים נשארים חינם.", pass: "כרטיס עונה", pass_d: "פותח את כל 10 השלבים",
    purchase_title: "אישור רכישה (דמו)", purchase_sub: "בגרסה האמיתית כאן נפתח App Store. כאן זה רק מדומה.", confirm: "אשר", cancel: "ביטול",
    ad_title: "פרסומת לדוגמה", ad_sub: "סרטון ממומן היה מתנגן כאן ({n})", ad_done: "קיבלת +30 מטבעות", hint_title: "רמז",
    clubs_title: "מועדונים", clubs_sub: "אתגרים קבוצתיים שבועיים: 20 שחקנים, חדר משותף, הכי מעט הדים ביחד. בקרוב.", close: "סגור",
    streak: "🔥 רצף {n} ימים", bonus_today: "בונוס יומי +{n}", online: "מחובר", offline: "לא מקוון (שמירה במכשיר)",
    copied: "הועתק!", share_text: "סיימתי את {lvl} ב-ECHO עם {e} הדים ב-{t} שניות ⭐{s}", custom: "חדר מותאם", daily_name: "יומי #{d}",
    level_locked: "השלב נעול", bad_code: "הקוד לא תקין", tier_locked: "צריך כרטיס עונה", need_xp: "צריך עוד XP",
    about: "ECHO · אב־טיפוס · הגרפיקה והסאונד נוצרו ב-Higgsfield", you: "אתה", unnamed: "שחקן", menu: "תפריט",
  },
  en: {
    tagline: "10 seconds. Then you play beside yourself.",
    play: "Play", daily: "Daily challenge", shop: "Shop", editor: "Level editor", clubs: "Clubs", settings: "Settings",
    worlds: "Worlds", world1: "The Lab", world2: "The Observatory", world3: "The Mirror Lab",
    world_locked: "Opens at {n} stars", redo_loop: "↺ Loop", restart_level: "⟲ Level", hint_ad: "💡 Hint",
    echoes_used: "echoes", seconds: "seconds", coins: "coins", replay: "▶ Replay", share: "Share", try_fewer: "Fewer echoes",
    next: "Next level", done_title: "Level complete!", perfect: "Perfect!", first_clear: "First clear bonus +50",
    free_coins: "Free coins", watch_ad: "Watch ad +30", ads_left: "{n} videos left today", ads_none: "No more videos today. Come back tomorrow.",
    echo_skins: "Echo skins", skins_sub: "Your echoes wear it on every level, so everyone sees it in your replays.",
    season_pass: "Season pass", claim: "Claim", pass_sub: "Tiers 1–2 are free. The pass opens the rest of the track.",
    store: "Store", store_note: "Prototype: purchases are simulated and nothing is charged.",
    daily_sub: "One room for every player in the world. Fewest echoes wins; time breaks ties.",
    play_daily: "Play today's room", leaderboard: "Leaderboard", board_empty: "No results yet today. Be the first.",
    editor_sub: "Paint a room, test it, then share its code. Rooms need one start and one exit; a door opens while its plate is held.",
    mirror: "Mirror echoes", par: "Par", add_drone: "+ Drone", clear_drones: "Clear drones", test: "Test", get_code: "Share code", load_code: "Load code",
    language: "Language", music: "Music", sfx: "Sound effects", shake: "Screen shake", name: "Player name",
    loop_saved: "Echo #{n} saved", loop_sub: "Now play beside it", caught: "The drone got you", caught_sub: "Only this loop restarts",
    out_of_echoes: "Out of echoes", out_sub: "The level restarts", go: "Go!", loop_n: "Loop {n}",
    hint_move: "Move your thumb to move. Reach the golden exit.", hint_plate: "A door only opens while someone stands on its plate. Let your echo hold it.",
    hint_drone: "Drones catch only you, never your echoes.", hint_mirror: "In this world echoes move mirrored: your right is their left.",
    hint_generic: "When the 10 seconds end, the loop is saved as an echo. You don't have to succeed on the first run.",
    bought: "Bought!", equipped: "Equipped", not_enough: "Not enough {c}", owned: "Owned", equip: "Equip", buy: "Buy",
    starter: "Starter pack", starter_d: "120 gems + 500 coins + gold skin", gems_small: "100 gems", gems_big: "600 gems",
    noads: "Remove ads", noads_d: "No videos. Hints stay free.", pass: "Season pass", pass_d: "Opens all 10 tiers",
    purchase_title: "Confirm purchase (demo)", purchase_sub: "The real build opens the App Store here. This one only pretends.", confirm: "Confirm", cancel: "Cancel",
    ad_title: "Sample ad", ad_sub: "A sponsored video would play here ({n})", ad_done: "You got +30 coins", hint_title: "Hint",
    clubs_title: "Clubs", clubs_sub: "Weekly team challenges: 20 players, one shared room, fewest echoes together. Coming soon.", close: "Close",
    streak: "🔥 {n}-day streak", bonus_today: "Daily bonus +{n}", online: "Online", offline: "Offline (saved on device)",
    copied: "Copied!", share_text: "I cleared {lvl} in ECHO with {e} echoes in {t}s ⭐{s}", custom: "Custom room", daily_name: "Daily #{d}",
    level_locked: "Level locked", bad_code: "That code is not valid", tier_locked: "Needs the season pass", need_xp: "Needs more XP",
    about: "ECHO · prototype · art and sound made with Higgsfield", you: "you", unnamed: "Player", menu: "Menu",
  },
};
let lang = "he";
const T = (k, v) => (STR[lang][k] || STR.en[k] || k).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] !== undefined ? v[n] : ""));

// ── settings & identity ────────────────────────────────────────────────────

const store = {
  get(k, d) { try { const v = localStorage.getItem("echo:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("echo:" + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const opts = Object.assign({ music: true, sfx: true, shake: true, lang: "he" }, store.get("opts", {}));
lang = opts.lang;
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
    try { ws = new WebSocket(`${proto}//${host}/ws/${this.name}`); } catch { this.emitLocal(); return; }
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
for (const n of ["hero", "echo", "plate", "door", "exit", "coin", "drone", "gem"]) { const i = new Image(); i.src = `assets/${n}.png`; IMG[n] = i; }
const BG = {};
for (const n of ["bg_lab", "bg_obs"]) { const i = new Image(); i.src = `assets/${n}.jpg`; BG[n] = i; }

const SND = {};
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ } }
  return actx;
}
function sfx(name, vol = 0.8) {
  if (!opts.sfx) return;
  let a = SND[name];
  if (!a) { a = new Audio(`assets/sfx_${name}.mp3`); SND[name] = a; }
  try { const c = a.cloneNode(); c.volume = vol; c.play().catch(() => {}); } catch { /* */ }
}
let music = null;
function musicOn(on) {
  if (!music) { music = new Audio("assets/music.mp3"); music.loop = true; music.volume = 0.35; }
  if (on && opts.music) music.play().catch(() => {}); else music.pause();
}
/** A short synth tone; its pitch climbs with every echo that joins the room. */
function tone(step, dur = 0.18) {
  if (!opts.sfx) return;
  const c = audio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = "triangle"; o.frequency.value = 330 * Math.pow(2, step / 6);
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + 0.02);
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
  $("#h-coins").textContent = profile.coins;
  $("#t-streak").textContent = profile.streak ? T("streak", { n: profile.streak }) : "";
  if (!screenEl("s-levels").hidden) renderLevels();
  if (!screenEl("s-shop").hidden) renderShop();
}

// ── game state ─────────────────────────────────────────────────────────────

const game = {
  level: null, levelKey: null, logs: [], run: null, recording: "", playing: false, replay: null,
  acc: 0, last: 0, timeScale: 1, shake: 0, particles: [], flash: 0, banner: 0, doorAnim: {},
  inputDir: 0, keys: new Set(), nextTimer: null,
};
const canvas = $("#game");
const ctx = canvas.getContext("2d");
let view = { ox: 0, oy: 0, cs: 40, w: 0, h: 0 };

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  view.w = window.innerWidth; view.h = window.innerHeight;
  canvas.width = Math.round(view.w * dpr); canvas.height = Math.round(view.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = 86, bottom = view.h > view.w ? 170 : 70;
  const cs = Math.floor(Math.min((view.w - 24) / L.COLS, (view.h - top - bottom) / L.ROWS));
  view.cs = cs; view.ox = Math.round((view.w - cs * L.COLS) / 2);
  view.oy = Math.round(top + (view.h - top - bottom - cs * L.ROWS) / 2);
}
window.addEventListener("resize", resize);
resize();

function levelName(key) {
  if (key === "daily") return T("daily_name", { d: today() % 1000 });
  if (key.startsWith("custom")) return T("custom");
  return key;
}

function startLevel(level, key) {
  game.level = level; game.levelKey = key; game.logs = [];
  game.replay = null;
  startLoop();
  show("none");
  $("#lvname").textContent = levelName(key);
  $("#hint").textContent = hintFor(level, key);
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
/** Run `fn` after `ms` unless another loop has started in the meantime. */
function later(ms, fn) {
  const g = game.gen;
  setTimeout(() => { if (game.playing && game.gen === g) fn(); }, ms);
}
function startLoop() {
  game.gen = (game.gen || 0) + 1;
  game.recording = "";
  game.run = L.createRun(game.level, [...game.logs, ""]);
  game.acc = 0; game.timeScale = 1; game.particles = []; game.doorAnim = {};
  banner(T("loop_n", { n: game.logs.length + 1 }), game.logs.length ? T("loop_sub") : "", 900);
  tone(game.logs.length, 0.25);
  renderEchoDots();
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
  if (game.logs.length >= L.MAX_ECHOES) {
    banner(T("out_of_echoes"), T("out_sub"), 1400);
    sfx("fail"); shake(10);
    later(1200, () => { game.logs = []; startLoop(); });
    return;
  }
  game.logs.push(game.recording);
  banner(T("loop_saved", { n: game.logs.length }), T("loop_sub"), 1300);
  sfx("chime", 0.6);
  later(900, startLoop);
}
function loopFailed() {
  banner(T("caught"), T("caught_sub"), 1200);
  sfx("fail"); shake(14); game.flash = 0.6;
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
  sfx("win"); game.timeScale = 0.25; shake(6);
  game.replay = { logs, level: game.level, live: true };
  setTimeout(() => {
    game.playing = false; musicOn(false);
    $("#r-title").textContent = stars === 3 ? T("perfect") : T("done_title");
    const st = $("#r-stars"); st.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const s = document.createElement("span"); s.textContent = "★";
      s.className = i < stars ? "pop" : "off"; s.style.animationDelay = `${0.2 + i * 0.25}s`; st.appendChild(s);
      if (i < stars) setTimeout(() => tone(4 + i * 2, 0.3), 200 + i * 250);
    }
    $("#r-echoes").textContent = res.echoes; $("#r-time").textContent = (res.exitTick / L.TPS).toFixed(1);
    countUp($("#r-coins"), reward);
    $("#r-sub").textContent = (firstClear ? T("first_clear") + " · " : "") + `${T("par")} ${game.level.par}`;
    $("#b-next").hidden = game.levelKey === "daily" || game.levelKey.startsWith("custom") || !nextLevelKey();
    game.result = { stars, res };
    show("s-result");
  }, 1100);
}
function countUp(el, n) {
  const t0 = performance.now();
  const step = () => { const k = Math.min(1, (performance.now() - t0) / 900); el.textContent = "+" + Math.round(n * k); if (k < 1) requestAnimationFrame(step); };
  step();
}
function nextLevelKey() {
  const i = L.LEVELS.findIndex((l) => l.id === game.levelKey);
  const n = L.LEVELS[i + 1];
  return n && L.worldUnlocked(profile, n.world) ? n.id : null;
}
function shake(n) { if (opts.shake) game.shake = Math.max(game.shake, n); }
function quit() { game.playing = false; musicOn(false); game.replay = null; show(game.levelKey === "daily" ? "s-daily" : game.levelKey?.startsWith("custom") ? "s-editor" : "s-levels"); if (current === "s-levels") renderLevels(); }

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
  const dt = Math.min(0.1, (now - game.last) / 1000); game.last = now;
  if (game.playing) {
    game.acc += dt * game.timeScale;
    const step = 1 / L.TPS;
    while (game.acc >= step) {
      game.acc -= step;
      if (game.replay && !game.replay.live) tickReplay(); else tick();
    }
    if (game.timeScale < 1 && !game.run.finished) game.timeScale = Math.min(1, game.timeScale + dt * 1.5);
  }
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
  const arc = $("#timer .arc"); const r = 26, c = 2 * Math.PI * r;
  arc.style.strokeDasharray = `${c * (left / 10)} ${c}`; arc.classList.toggle("hot", left < 3);
}
function handleEvents(run) {
  for (const e of run.events) {
    if (e.t === "coin") { sfx("chime", 0.5); burst(e.x, e.y, "#ffc93c", 14); }
    else if (e.t === "plate") { sfx("plate", 0.7); game.flash = Math.max(game.flash, 0.12); }
    else if (e.t === "open") { sfx("door", 0.6); game.doorAnim[e.k] = { t: 0, open: true }; }
    else if (e.t === "close") { game.doorAnim[e.k] = { t: 0, open: false }; }
    else if (e.t === "dead") burst(e.x, e.y, "#ff4fd8", 26);
    else if (e.t === "exit") { burst(e.x, e.y, "#ffd9a8", 40); burst(e.x, e.y, "#39e6ff", 24); game.flash = 0.5; }
  }
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4;
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, color, r: 2 + Math.random() * 4 });
  }
}

// ── drawing ────────────────────────────────────────────────────────────────

const skinCache = {};
function echoSprite(skin) {
  if (skinCache[skin]) return skinCache[skin];
  const img = IMG.echo; if (!img.complete || !img.naturalWidth) return img;
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
const cx = (x) => view.ox + x * view.cs, cy = (y) => view.oy + y * view.cs;

/**
 * The world painting, pre-rendered once per screen size: covered, blurred and
 * dimmed, so the room reads crisply on top and the busy middle of the picture
 * turns into soft colour instead of competing with the sprites.
 */
let bgCache = { key: "", canvas: null };
function backdrop(name) {
  const img = BG[name];
  if (!img.complete || !img.naturalWidth) return null;
  const key = `${name}:${view.w}x${view.h}`;
  if (bgCache.key === key) return bgCache.canvas;
  const c = document.createElement("canvas"); c.width = view.w; c.height = view.h;
  const g = c.getContext("2d");
  const s = Math.max(view.w / img.naturalWidth, view.h / img.naturalHeight) * 1.08;
  const bw = img.naturalWidth * s, bh = img.naturalHeight * s;
  const by = Math.min(0, Math.max(view.h - bh, cy(L.ROWS / 2) - bh / 2));
  g.filter = "blur(5px)"; g.globalAlpha = 0.55; g.drawImage(img, (view.w - bw) / 2, by, bw, bh);
  g.filter = "none"; g.globalAlpha = 1;
  const grad = g.createLinearGradient(0, 0, 0, view.h);
  grad.addColorStop(0, "rgba(20,26,51,.6)"); grad.addColorStop(0.45, "rgba(20,26,51,.15)"); grad.addColorStop(1, "rgba(20,26,51,.85)");
  g.fillStyle = grad; g.fillRect(0, 0, view.w, view.h);
  bgCache = { key, canvas: c };
  return c;
}

function draw(dt) {
  const { w, h, cs } = view;
  ctx.clearRect(0, 0, w, h);
  const run = game.run;
  if (!run || (current !== "none" && current !== "s-result")) {
    ctx.fillStyle = "#141a33"; ctx.fillRect(0, 0, w, h); return;
  }
  const lvl = run.level;
  const bgc = backdrop(L.WORLDS[(lvl.world || 1) - 1].bg);
  if (bgc) ctx.drawImage(bgc, 0, 0, w, h);
  else { ctx.fillStyle = "#141a33"; ctx.fillRect(0, 0, w, h); }

  ctx.save();
  if (game.shake > 0) { ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake); game.shake = Math.max(0, game.shake - dt * 40); }

  // Floor plate under the room.
  ctx.fillStyle = "rgba(20,26,51,.78)";
  roundRect(cx(0) - 6, cy(0) - 6, cs * L.COLS + 12, cs * L.ROWS + 12, 14); ctx.fill();
  for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
    const ch = lvl.map[y][x];
    if (ch === "#") continue;
    ctx.fillStyle = (x + y) % 2 ? "#242c52" : "#28315a";
    ctx.fillRect(cx(x) + 1, cy(y) + 1, cs - 2, cs - 2);
  }
  // Walls as chunky slate blocks.
  for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
    if (lvl.map[y][x] !== "#") continue;
    ctx.fillStyle = "#3b4680"; roundRect(cx(x) + 1, cy(y) + 1, cs - 2, cs - 2, cs * 0.18); ctx.fill();
    ctx.fillStyle = "#4e5a9c"; roundRect(cx(x) + 3, cy(y) + 3, cs - 6, cs * 0.45, cs * 0.14); ctx.fill();
  }
  // Plates, doors, exit, coins.
  for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
    const ch = lvl.map[y][x];
    if (ch === "a" || ch === "b" || ch === "c") {
      const on = run.plates[ch];
      sprite(IMG.plate, x + 0.5, y + 0.5, 0.92, on ? 0.95 : 0.8);
      if (on) { ctx.fillStyle = "rgba(255,79,216,.35)"; ctx.beginPath(); ctx.arc(cx(x + 0.5), cy(y + 0.5), cs * 0.5, 0, 7); ctx.fill(); }
      label(ch.toUpperCase(), x + 0.5, y + 0.5);
    } else if (ch === "A" || ch === "B" || ch === "C") {
      const an = game.doorAnim[ch]; let open = run.doors[ch] ? 1 : 0;
      if (an) { an.t = Math.min(1, an.t + dt * 4); open = an.open ? an.t : 1 - an.t; }
      ctx.save(); ctx.beginPath(); ctx.rect(cx(x), cy(y), cs, cs); ctx.clip();
      sprite(IMG.door, x + 0.5, y + 0.5 - open * 0.95, 1.05, 1);
      ctx.restore();
      if (open < 1) { ctx.strokeStyle = `rgba(255,79,216,${0.6 * (1 - open)})`; ctx.lineWidth = 2; ctx.strokeRect(cx(x) + 2, cy(y) + 2, cs - 4, cs - 4); }
      label(ch, x + 0.5, y + 0.12, 0.3);
    } else if (ch === "E") {
      const p = 1 + Math.sin(performance.now() / 300) * 0.05;
      ctx.fillStyle = "rgba(255,201,60,.18)"; ctx.beginPath(); ctx.arc(cx(x + 0.5), cy(y + 0.5), cs * 0.6 * p, 0, 7); ctx.fill();
      sprite(IMG.exit, x + 0.5, y + 0.5, 0.95 * p, 1);
    }
  }
  for (const c of run.coins) {
    if (c.taken) continue;
    const bob = Math.sin(performance.now() / 250 + c.x * 3) * 0.05;
    sprite(IMG.coin, c.x, c.y + bob, 0.5, 1);
  }
  // Drone paths and drones.
  for (const d of run.drones) {
    ctx.strokeStyle = "rgba(255,79,216,.25)"; ctx.lineWidth = 3; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(cx(d.x + 0.5), cy(d.y + 0.5)); ctx.lineTo(cx(d.x + 0.5 + d.dx * d.n), cy(d.y + 0.5 + d.dy * d.n)); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const d of run.drones) {
    ctx.fillStyle = "rgba(255,79,216,.14)"; ctx.beginPath(); ctx.arc(cx(d.px), cy(d.py), cs * L.DRONE_RADIUS, 0, 7); ctx.fill();
    sprite(IMG.drone, d.px, d.py + Math.sin(performance.now() / 200) * 0.04, 0.9, 1);
  }
  // Echoes: trail, then ghost.
  const last = run.actors.length - 1;
  const esp = echoSprite(profile.skin);
  for (let i = 0; i < run.actors.length; i++) {
    const a = run.actors[i];
    if (i < last) {
      ctx.strokeStyle = L.SKINS[profile.skin]?.color === "rainbow" ? "#b06cff" : (L.SKINS[profile.skin]?.color || "#39e6ff");
      ctx.globalAlpha = 0.35; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
      for (let k = 0; k < a.trail.length; k += 2) { const px = cx(a.trail[k]), py = cy(a.trail[k + 1]); if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.lineTo(cx(a.x), cy(a.y)); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  for (let i = 0; i < run.actors.length; i++) {
    const a = run.actors[i];
    if (a.done) continue;
    const walk = a.dir ? Math.sin(run.tick * 0.9) * 0.04 : 0;
    const flip = a.dir >= 6;
    if (i < last) { ctx.globalAlpha = 0.75; sprite(esp, a.x, a.y - 0.08 + walk, 1.05, 1, flip); ctx.globalAlpha = 1; }
    else if (a.alive) sprite(IMG.hero, a.x, a.y - 0.08 + walk, 1.05, 1, flip);
  }
  // Particles.
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i]; p.life -= dt; if (p.life <= 0) { game.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
    ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(cx(p.x), cy(p.y), p.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (game.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${game.flash * 0.5})`; ctx.fillRect(0, 0, w, h); game.flash = Math.max(0, game.flash - dt * 2); }
}
function sprite(img, x, y, size, alpha, flip) {
  if (!img || (img instanceof HTMLImageElement && !(img.complete && img.naturalWidth))) {
    ctx.fillStyle = "#ff9a3c"; ctx.beginPath(); ctx.arc(cx(x), cy(y), view.cs * 0.3, 0, 7); ctx.fill(); return;
  }
  const s = view.cs * size;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(cx(x), cy(y)); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -s / 2, -s / 2, s, s); ctx.restore();
}
function label(t, x, y, size = 0.34) {
  ctx.font = `${Math.round(view.cs * size)}px "Secular One", Heebo, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillText(t, cx(x), cy(y));
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ── screens: levels ────────────────────────────────────────────────────────

function renderLevels() {
  const root = $("#worlds"); root.innerHTML = "";
  for (const w of L.WORLDS) {
    const unlocked = L.worldUnlocked(profile, w.id);
    const sec = document.createElement("div"); sec.className = "world";
    const h = document.createElement("h2"); h.textContent = `${w.id}. ${T("world" + w.id)}`;
    if (!unlocked) { const s = document.createElement("small"); s.textContent = T("world_locked", { n: (w.id - 1) * 7 }); h.appendChild(s); }
    sec.appendChild(h);
    const grid = document.createElement("div"); grid.className = "lvgrid";
    for (const lv of L.LEVELS.filter((l) => l.world === w.id)) {
      const b = document.createElement("button"); b.className = "lv";
      const st = profile.stars[lv.id] || 0;
      if (st) b.classList.add("done"); if (!unlocked) b.classList.add("locked");
      b.innerHTML = `<span>${lv.id.split("-")[1]}</span><span class="stars">${"★".repeat(st)}<span class="off">${"★".repeat(3 - st)}</span></span>`;
      b.addEventListener("click", () => { if (!unlocked) { toast(T("level_locked")); return; } startLevel(lv, lv.id); });
      grid.appendChild(b);
    }
    sec.appendChild(grid); root.appendChild(sec);
  }
}

// ── screens: shop ──────────────────────────────────────────────────────────

function renderShop() {
  const sk = $("#skins"); sk.innerHTML = "";
  for (const [id, s] of Object.entries(L.SKINS)) {
    const owned = profile.skins.includes(id), on = profile.skin === id;
    const d = document.createElement("div"); d.className = "skin" + (on ? " on" : "");
    const sw = document.createElement("div"); sw.className = "sw";
    sw.style.background = s.color === "rainbow" ? "conic-gradient(#ff4fd8,#ffc93c,#6cf0a6,#39e6ff,#b06cff,#ff4fd8)" : s.color; sw.style.color = s.color === "rainbow" ? "#b06cff" : s.color;
    const b = document.createElement("button"); b.className = "btn small" + (owned && !on ? " echo" : "");
    if (on) { b.textContent = T("equipped"); b.disabled = true; }
    else if (owned) { b.textContent = T("equip"); b.addEventListener("click", () => { saveRoom.act({ t: "equip", skin: id }); skinCache[id] = null; renderShop(); }); }
    else {
      b.innerHTML = s.gems ? `<img src="assets/gem.png" alt="" style="width:18px"> ${s.gems}` : `<img src="assets/coin.png" alt="" style="width:18px"> ${s.coins}`;
      b.addEventListener("click", () => { const v = saveRoom.act({ t: "buy", item: id }); if (v.ok) { toast(T("bought")); sfx("chime"); } else toast(T("not_enough", { c: s.gems ? "💎" : "🪙" })); renderShop(); });
    }
    const name = document.createElement("b"); name.textContent = id;
    d.append(sw, name, b); sk.appendChild(d);
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
  $("#pass-xp").textContent = `${profile.passXp} XP` + (next ? ` / ${next.xp}` : "");
  $("#xpfill").style.width = next ? `${Math.min(100, profile.passXp / next.xp * 100)}%` : "100%";
  $("#b-claim").disabled = !next || profile.passXp < next.xp || (!profile.pass && profile.claimedTiers >= 2);

  const pr = $("#products"); pr.innerHTML = "";
  for (const [sku, p] of Object.entries(L.IAP)) {
    const d = document.createElement("div"); d.className = "product" + (sku === "starter" ? " wide" : "");
    const owned = p.once && profile.owned.includes(sku);
    d.innerHTML = `<b>${T(sku)}</b><span style="color:var(--dim);font-size:.85rem">${T(sku + "_d") === sku + "_d" ? "" : T(sku + "_d")}</span><span class="price">${owned ? T("owned") : p.price}</span>`;
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
  game.run = L.createRun(game.replay.level, game.replay.logs); game.replay.live = false; game.acc = 0; game.timeScale = 1;
  game.playing = true; show("none"); banner(T("replay"), "", 800);
});
$("#b-share").addEventListener("click", async () => {
  const r = game.result; if (!r) return;
  const text = T("share_text", { lvl: levelName(game.levelKey), e: r.res.echoes, t: (r.res.exitTick / L.TPS).toFixed(1), s: r.stars });
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch { /* cancelled */ }
  try { await navigator.clipboard.writeText(text); toast(T("copied")); } catch { toast(text); }
});
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

$("#b-menu").addEventListener("click", quit);

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
if (!game.last) { game.last = performance.now(); requestAnimationFrame(frame); }
