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
    tagline: "20 מהלכים. ואז אתה משחק לצד עצמך.",
    play: "שחק", daily: "אתגר יומי", daily_s: "יומי", shop: "חנות", editor: "עורך שלבים", editor_s: "עורך", clubs: "מועדונים", settings: "הגדרות",
    worlds: "עולמות", world1: "המעבדה", world2: "המצפה", world3: "מעבדת המראות", world_n: "עולם {n}", new_best: "שיא חדש", up_next: "הבא",
    world_locked: "נפתח עם {n} כוכבים", redo: "שוב", restart: "מחדש", end_loop: "סיים סיבוב", hint: "רמז", haptics: "רטט",
    purchase_q: "לקנות {item} ב-{price}?", buy_for: "קנה ב-{price}", purchase_note: "אב־טיפוס: התשלום מדומה ולא מחויב כסף.",
    gems: "יהלומים", gems_n: "{n} יהלומים", skin_name: "סקין {n}",
    echoes_used: "הדים", seconds: "מהלכים", coins: "מטבעות", replay: "שידור חוזר", share: "שיתוף", retry: "שוב",
    next: "השלב הבא", done_title: "שלב הושלם", perfect: "מושלם", first_clear: "בונוס סיום ראשון +50",
    free_coins: "מטבעות חינם", watch_ad: "צפה בסרטון +30", ads_left: "נותרו {n} סרטונים היום", ads_none: "נגמרו הסרטונים להיום. חזור מחר.",
    echo_skins: "סקינים להדים", skins_sub: "ההדים שלך לובשים אותו בכל שלב, אז כולם רואים אותו בשידורים החוזרים שלך.",
    season_pass: "כרטיס עונה", claim: "קבל", pass_sub: "שלבים 1–2 חינם. הכרטיס פותח את שאר המסלול.",
    store: "חנות", store_note: "אב־טיפוס: הרכישות מדומות ולא מחויב כסף.",
    daily_sub: "חדר אחד לכל השחקנים בעולם. הכי מעט הדים מנצח; הזמן שובר שוויון.",
    play_daily: "שחק את החדר של היום", leaderboard: "טבלת מובילים", board_empty: "עדיין אין תוצאות היום. תהיה הראשון.",
    editor_sub: "צייר חדר, בדוק אותו ושתף את הקוד שלו. חדר צריך התחלה אחת ויציאה אחת; דלת נפתחת כל עוד הלוחית שלה לחוצה.",
    mirror: "הדים במראה", par: "פאר", drone_tool: "◉ = רחפן: הקש על תא כדי להציב, שוב כדי להסיר", drone_nowhere: "לרחפן אין לאן לטוס מכאן", clear_drones: "נקה רחפנים", daily_you: "הכוכבים שלך היום: {n}", test: "בדיקה", get_code: "קוד שיתוף", load_code: "טען קוד",
    language: "שפה", music: "מוזיקה", sfx: "אפקטים", shake: "רעידת מסך", name: "שם שחקן",
    loop_saved: "הד #{n} נשמר", loop_sub: "עכשיו שחק לצידו", caught: "נתפסת", caught_sub: "רק הסיבוב הזה מתחיל מחדש",
    out_of_echoes: "נגמרו ההדים", out_sub: "השלב מתחיל מחדש", loop_n: "סיבוב {n}",
    hint_move: "החלק כדי לצעוד, הקש כדי לחכות צעד. הגע ליציאה הזהובה.", hint_plate: "דלת נפתחת רק כשמישהו עומד על הלוחית. תן להד שלך לעמוד עליה.",
    hint_drone: "רחפנים תופסים רק אותך, לא את ההדים.", hint_mirror: "בעולם הזה ההדים זזים הפוך: ימין שלך הוא שמאל שלהם.", hint_mirror_t: "בעולם הזה ההדים זזים הפוך: למעלה שלך הוא למטה שלהם.",
    hint_generic: "אחרי 20 מהלכים הסיבוב נשמר כהד, וההד חוזר על כל צעד שלך. לא חייבים להצליח בסיבוב הראשון.",
    bought: "נקנה!", equipped: "מצויד", not_enough: "אין מספיק {c}", owned: "בבעלותך", equip: "צייד", buy: "קנה",
    starter: "חבילת פתיחה", starter_d: "120 יהלומים + 500 מטבעות + סקין זהב", gems_small: "100 יהלומים", gems_big: "600 יהלומים",
    noads: "הסרת פרסומות", noads_d: "בלי סרטונים. רמזים נשארים חינם.", pass: "כרטיס עונה", pass_d: "פותח את כל 10 השלבים",
    purchase_title: "אישור רכישה", confirm: "אשר", cancel: "ביטול",
    ad_title: "פרסומת לדוגמה", ad_sub: "סרטון ממומן היה מתנגן כאן ({n})", ad_done: "קיבלת +30 מטבעות", hint_title: "רמז",
    clubs_title: "מועדונים", clubs_sub: "אתגרים קבוצתיים שבועיים: 20 שחקנים, חדר משותף, הכי מעט הדים ביחד. בקרוב.", close: "סגור",
    streak: "רצף {n} ימים", bonus_today: "בונוס יומי +{n}", online: "מחובר", offline: "לא מקוון · שמירה במכשיר",
    copied: "הועתק!", share_text: "סיימתי את {lvl} ב-ECHO עם {e} הדים ב-{t} מהלכים ⭐{s}", custom: "חדר מותאם", daily_name: "יומי #{d}",
    level_locked: "השלב נעול", bad_code: "הקוד לא תקין", tier_locked: "צריך כרטיס עונה", need_xp: "צריך עוד XP",
    about: "ECHO · אב־טיפוס · הגרפיקה והסאונד נוצרו ב-Higgsfield", you: "אתה", unnamed: "שחקן", menu: "תפריט", par_label: "פאר",
  },
  en: {
    tagline: "Twenty moves. Then you play beside yourself.",
    play: "Play", daily: "Daily challenge", daily_s: "Daily", shop: "Shop", editor: "Level editor", editor_s: "Editor", clubs: "Clubs", settings: "Settings",
    worlds: "Worlds", world1: "The Lab", world2: "The Observatory", world3: "The Mirror Lab", world_n: "World {n}", new_best: "New best", up_next: "Up next",
    world_locked: "Opens at {n} stars", redo: "Redo", restart: "Restart", end_loop: "End loop", hint: "Hint", haptics: "Haptic feedback",
    purchase_q: "Buy {item} for {price}?", buy_for: "Buy for {price}", purchase_note: "Prototype: payments are simulated and nothing is charged.",
    gems: "gems", gems_n: "{n} gems", skin_name: "the {n} skin",
    echoes_used: "echoes", seconds: "moves", coins: "coins", replay: "Replay", share: "Share", retry: "Retry",
    next: "Next level", done_title: "Level clear", perfect: "Perfect", first_clear: "First clear bonus +50",
    free_coins: "Free coins", watch_ad: "Watch ad +30", ads_left: "{n} videos left today", ads_none: "No more videos today. Come back tomorrow.",
    echo_skins: "Echo skins", skins_sub: "Your echoes wear it on every level, so everyone sees it in your replays.",
    season_pass: "Season pass", claim: "Claim", pass_sub: "Tiers 1–2 are free. The pass opens the rest of the track.",
    store: "Store", store_note: "Prototype: purchases are simulated and nothing is charged.",
    daily_sub: "One room for every player in the world. Fewest echoes wins; time breaks ties.",
    play_daily: "Play today's room", leaderboard: "Leaderboard", board_empty: "No results yet today. Be the first.",
    editor_sub: "Paint a room, test it, then share its code. Rooms need one start and one exit; a door opens while its plate is held.",
    mirror: "Mirror echoes", par: "Par", drone_tool: "◉ = drone: tap a cell to place one, tap again to remove", drone_nowhere: "No room for a patrol there", clear_drones: "Clear drones", daily_you: "Your stars today: {n}", test: "Test", get_code: "Share code", load_code: "Load code",
    language: "Language", music: "Music", sfx: "Sound effects", shake: "Screen shake", name: "Player name",
    loop_saved: "Echo #{n} saved", loop_sub: "Now play beside it", caught: "Caught", caught_sub: "Only this loop restarts",
    out_of_echoes: "Out of echoes", out_sub: "The level restarts", loop_n: "Loop {n}",
    hint_move: "Swipe to step, tap to wait a beat. Reach the golden exit.", hint_plate: "A door only opens while someone stands on its plate. Let your echo hold it.",
    hint_drone: "Drones catch only you, never your echoes.", hint_mirror: "In this world echoes move mirrored: your right is their left.", hint_mirror_t: "In this world echoes move mirrored: your up is their down.",
    hint_generic: "After 20 moves the loop is saved as an echo that repeats your every step. You don't have to make it on the first run.",
    bought: "Bought!", equipped: "Equipped", not_enough: "Not enough {c}", owned: "Owned", equip: "Equip", buy: "Buy",
    starter: "Starter pack", starter_d: "120 gems + 500 coins + gold skin", gems_small: "100 gems", gems_big: "600 gems",
    noads: "Remove ads", noads_d: "No videos. Hints stay free.", pass: "Season pass", pass_d: "Opens all 10 tiers",
    purchase_title: "Confirm purchase", confirm: "Confirm", cancel: "Cancel",
    ad_title: "Sample ad", ad_sub: "A sponsored video would play here ({n})", ad_done: "You got +30 coins", hint_title: "Hint",
    clubs_title: "Clubs", clubs_sub: "Weekly team challenges: 20 players, one shared room, fewest echoes together. Coming soon.", close: "Close",
    streak: "{n}-day streak", bonus_today: "Daily bonus +{n}", online: "Online", offline: "Offline · saved on device",
    copied: "Copied!", share_text: "I cleared {lvl} in ECHO with {e} echoes in {t} moves ⭐{s}", custom: "Custom room", daily_name: "Daily #{d}",
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
const opts = Object.assign({ music: true, sfx: true, shake: true, haptics: true, lang: "en" }, store.get("opts", {}));
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
for (const n of ["hero", "echo", "plate", "door", "exit", "coin", "drone", "gem"]) { const i = new Image(); i.src = `assets/${n}.png`; IMG[n] = i; }
const BG = {};
for (const n of ["bg_lab", "bg_obs", "bg_mirror"]) { const i = new Image(); i.src = `assets/${n}.jpg`; BG[n] = i; }
const ready = (img) => img && img.complete && img.naturalWidth > 0;

/*
 * Audio runs entirely through Web Audio; nothing goes through an <audio>
 * element. On iOS a media element registers the game as a media player (Now
 * Playing controls in the Dynamic Island and on the lock screen) and pauses
 * whatever the player was listening to; buffer sources do neither, and they
 * start without the element's latency.
 */
const SOUNDS = { chime: "assets/sfx_chime.mp3", plate: "assets/sfx_plate.mp3", door: "assets/sfx_door.mp3", win: "assets/sfx_win.mp3", fail: "assets/sfx_fail.mp3", music: "assets/music.mp3" };
const buffers = {}, loading = {};
let actx = null, busMusic = null, busSfx = null, musicSrc = null;
function audio() {
  if (actx) return actx;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    busMusic = actx.createGain(); busMusic.gain.value = 0.32; busMusic.connect(actx.destination);
    busSfx = actx.createGain(); busSfx.connect(actx.destination);
  } catch { actx = null; }
  return actx;
}
function loadSound(name) {
  const c = audio();
  if (!c) return Promise.resolve(null);
  if (buffers[name]) return Promise.resolve(buffers[name]);
  if (!loading[name]) {
    loading[name] = fetch(SOUNDS[name]).then((r) => r.arrayBuffer())
      .then((ab) => new Promise((ok, err) => c.decodeAudioData(ab, ok, err)))
      .then((buf) => { buffers[name] = buf; return buf; })
      .catch(() => { delete loading[name]; return null; });
  }
  return loading[name];
}
function preloadAudio() { for (const n in SOUNDS) loadSound(n); }
/** One-shot effect; the pitch wobbles a little so repeats never sound stamped. */
function sfx(name, vol = 0.8) {
  if (!opts.sfx) return;
  const c = audio(); if (!c) return;
  const buf = buffers[name];
  if (!buf) { loadSound(name); return; }
  const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = 0.94 + Math.random() * 0.12;
  const g = c.createGain(); g.gain.value = vol;
  s.connect(g).connect(busSfx); s.start();
}
async function musicOn(on) {
  const c = audio(); if (!c) return;
  if (!on || !opts.music) {
    if (musicSrc) { try { musicSrc.stop(); } catch { /* already stopped */ } musicSrc = null; }
    return;
  }
  if (musicSrc) return;
  const buf = await loadSound("music");
  // The level may have ended while the track was still decoding.
  if (!buf || musicSrc || !opts.music || !game.playing) return;
  const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(busMusic); s.start();
  musicSrc = s;
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
  o.connect(g).connect(busSfx); o.start(); o.stop(c.currentTime + dur + 0.02);
}
// iOS suspends the context when the app leaves the foreground; pick it back up.
document.addEventListener("visibilitychange", () => {
  if (!actx) return;
  (document.hidden ? actx.suspend() : actx.resume()).catch(() => {});
});

// ── haptics: the Taptic Engine through Capacitor, vibration where a browser has it ──

const Haptics = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.registerPlugin("Haptics") : null;
/** kind: light | medium | heavy | success | warning | error */
function buzz(kind = "light") {
  if (!opts.haptics) return;
  try {
    if (Haptics) {
      if (kind === "success" || kind === "warning" || kind === "error") Haptics.notification({ type: kind.toUpperCase() });
      else Haptics.impact({ style: kind.toUpperCase() });
    } else if (navigator.vibrate) {
      navigator.vibrate(kind === "heavy" || kind === "error" ? 40 : kind === "medium" || kind === "success" ? 18 : 8);
    }
  } catch { /* no haptics here */ }
}
document.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) buzz("light"); });

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
  if (id !== "none") $("#banner").classList.remove("show");
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
  setNet();
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
  gen: 0, loopT: 0, levelT: 0, freeze: 0, rewind: 0, cam: { zoom: 1, fx: 0, fy: 0, tz: 1, tfx: 0, tfy: 0 }, result: null,
  // Beats: when the last one landed, how long its hop takes, where everyone
  // stood before it (for the tween), and an input that arrived mid-hop.
  beatT0: -1e9, beatMs: 150, prev: null, queued: null,
};
const REPEAT_MS = 175;                 // a held swipe or key keeps stepping at this pace
const REPLAY_MS = 260;
const canvas = $("#game");
const ctx = canvas.getContext("2d");
let view = { ox: 0, oy: 0, cs: 40, w: 0, h: 0 };
const WALL_H = 0.26;
/** How much of the outer wall ring stays off screen: the room is a window onto
 *  the level, so the floor gets the space instead of a thick border. */
const CROP = 0.5;
const FRAME_R = 16;
let bgCache = { key: "", canvas: null };
let floorCache = { key: "", canvas: null };

const probe = document.getElementById("safe-probe");
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  view.w = window.innerWidth; view.h = window.innerHeight;
  canvas.width = Math.round(view.w * dpr); canvas.height = Math.round(view.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Rooms are authored portrait (7 wide, 11 tall); a wide screen gets them
  // transposed so they lie across it. The HUD reserves clear the notch and the
  // home indicator, read from the safe-area probe element.
  view.t = view.w > view.h;
  view.cols = view.t ? L.ROWS : L.COLS; view.rows = view.t ? L.COLS : L.ROWS;
  const sat = probe ? probe.offsetHeight : 0, sab = probe ? probe.offsetWidth : 0;
  const top = sat + (view.t ? 72 : 116), bottom = sab + (view.t ? 94 : 112);
  const vc = view.cols - 2 * CROP, vr = view.rows - 2 * CROP;
  const cs = Math.floor(Math.min((view.w - 12) / vc, (view.h - top - bottom) / vr));
  view.cs = cs; view.ox = Math.round((view.w - cs * view.cols) / 2);
  view.oy = Math.round(top + (view.h - top - bottom - cs * vr) / 2 - cs * CROP);
  bgCache.key = ""; floorCache.key = "";
}
window.addEventListener("resize", resize);
resize();

// ── render space ───────────────────────────────────────────────────────────
// Every drawing routine works in render space (the grid as it lies on the
// screen) and converts level coordinates through R().
const R = (x, y) => (view.t ? { x: y, y: x } : { x, y });
const rmaps = new Map();
function rmapFor(level) {
  const k = level.map.join("") + (view.t ? "T" : "P");
  let m = rmaps.get(k);
  if (!m) {
    m = view.t ? Array.from({ length: L.COLS }, (_, r) => Array.from({ length: L.ROWS }, (_, c) => level.map[c][r]).join("")) : level.map;
    rmaps.set(k, m);
  }
  return m;
}
/** The on-screen direction (0-8) of a level direction. */
const sdirOf = (d) => (view.t ? [0, 7, 6, 5, 4, 3, 2, 1, 8][d] : d);
/** A screen-space input vector as a level direction. */
const levelDir = (sdx, sdy) => (view.t ? vecDir(sdy, sdx) : vecDir(sdx, sdy));

function levelName(key) {
  if (key === "daily") return T("daily_name", { d: today() % 1000 });
  if (key.startsWith("custom")) return T("custom");
  // The HUD has one line for this, so the article goes.
  return `${T("world" + key.split("-")[0]).replace(/^The /, "")} · ${key.split("-")[1]}`;
}

function startLevel(level, key) {
  game.level = level; game.levelKey = key; game.logs = [];
  game.replay = null; game.levelT = 0; motes.length = 0;
  show("none");
  $("#lvname").textContent = levelName(key);
  startLoop();
  // The room fills the screen now, so the hint rides the first loop banner
  // instead of a bar that would cover the floor.
  banner(T("loop_n", { n: 1 }), hintFor(level, key), 3800, true);
  musicOn(true);
  game.playing = true;
}
function hintFor(level, key) {
  if (key === "1-1") return T("hint_move");
  if (key === "1-2") return T("hint_plate");
  if (key === "2-1") return T("hint_drone");
  if (key === "3-1") return T(view.t ? "hint_mirror_t" : "hint_mirror");
  return T("hint_generic");
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
  game.acc = 0; game.timeScale = 1; game.particles = []; game.flies = []; game.doorAnim = {}; game.loopT = 0; game.freeze = 0; game.exitAnim = null;
  game.prev = null; game.queued = null; game.beatT0 = -1e9;
  game.cam.zoom = reduceMotion ? 1 : 1.07; game.cam.tz = 1; game.cam.fx = game.cam.fy = game.cam.tfx = game.cam.tfy = 0;
  banner(T("loop_n", { n: game.logs.length + 1 }), game.logs.length ? T("loop_sub") : "", 900);
  tone(game.logs.length, 0.25);
  renderEchoDots();
  updateTimer(game.run);
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
function banner(title, sub, ms, long = false) {
  const b = $("#banner"); b.innerHTML = ""; b.append(document.createTextNode(title));
  if (sub) { const s = document.createElement("small"); s.textContent = sub; s.className = long ? "long" : ""; b.appendChild(s); }
  b.classList.add("show"); clearTimeout(banner.tm); banner.tm = setTimeout(() => b.classList.remove("show"), ms);
}

/** The loop ended without an exit: it becomes an echo, or the level resets. */
function loopEnded() {
  game.rewind = 0.4;
  if (game.logs.length >= L.MAX_ECHOES) {
    banner(T("out_of_echoes"), T("out_sub"), 1400);
    sfx("fail"); shake(10); buzz("error");
    game.logs = []; renderEchoDots();                     // reset now, so Redo cannot skip it
    later(1300, startLoop);
    return;
  }
  game.logs.push(game.recording);
  banner(T("loop_saved", { n: game.logs.length }), T("loop_sub"), 1300);
  sfx("chime", 0.6); buzz("medium");
  later(950, startLoop);
}
/**
 * Finish the loop now instead of waiting out the clock: what was recorded so
 * far becomes the echo, and it simply stands still for the rest of every later
 * loop. A tap in the first half second is ignored so a stray touch cannot
 * spend an echo on nothing.
 */
function endLoopNow() {
  const run = game.run;
  if (!game.playing || !run || run.finished || run.dead || run.tick >= L.LOOP_TICKS) return;
  if (game.replay && !game.replay.live) return;
  if (run.tick < 1) return;
  run.tick = L.LOOP_TICKS;
  updateTimer(run);
  loopEnded();
}
function loopFailed() {
  banner(T("caught"), T("caught_sub"), 1200);
  sfx("fail"); shake(14); game.flash = 0.5; game.freeze = 0.09; buzz("error");
  later(1000, startLoop);
}
function levelDone() {
  const logs = [...game.logs, game.recording];
  const res = L.simulate(game.level, logs);
  const stars = L.starsFor(game.level, res.echoes);
  const action = { t: "complete", level: game.levelKey, logs, day: today(), name: profile.name || "" };
  const bestKey = game.levelKey === "daily" ? `daily-${today()}` : game.levelKey;
  const custom = game.levelKey.startsWith("custom");
  const prev = profile.best[bestKey];
  const before = profile.coins, firstClear = !prev && !custom;
  const newBest = !!prev && (res.echoes < prev.echoes || (res.echoes === prev.echoes && res.exitTick < prev.ticks));
  const v = saveRoom.act(action);
  if (game.levelKey === "daily") dailyRoom.act(action);
  const reward = v.ok ? profile.coins - before : 0;
  sfx("win"); game.timeScale = 0.22; shake(6); buzz("success");
  if (stars === 3 && !reduceMotion) {
    const colors = ["#ffc93c", "#39e6ff", "#ff4fd8", "#ffffff", "#ff9a3c"];
    for (let i = 0; i < 70; i++) game.particles.push({ x: Math.random() * view.cols, y: -0.5 - Math.random() * 2, vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 2, life: 2 + Math.random(), color: colors[i % colors.length], r: 3 + Math.random() * 3, conf: true });
  }
  const h = game.run.actors[game.run.actors.length - 1];
  const hp = R(h.x + 0.5, h.y + 0.5);
  game.cam.tz = reduceMotion ? 1 : 1.14; game.cam.tfx = (hp.x - view.cols / 2) * view.cs * 0.6; game.cam.tfy = (hp.y - view.rows / 2) * view.cs * 0.6;
  game.replay = { logs, level: game.level, live: true };
  game.result = { stars, res, reward, firstClear, newBest };
  const gen = game.gen;
  setTimeout(() => {
    if (!game.playing || game.gen !== gen) return;      // the player already left
    game.playing = false; musicOn(false);
    const title = stars === 3 ? T("perfect") : T("done_title");
    const rt = $("#r-title"); rt.textContent = title; rt.dataset.echo = title;
    const st = $("#r-stars"); st.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("class", "ic " + (i < stars ? "on" : "off")); s.style.animationDelay = `${0.15 + i * 0.22}s`;
      s.innerHTML = `<use href="#i-star"/>`; st.appendChild(s);
      if (i < stars) setTimeout(() => { tone(4 + i * 2, 0.3); buzz("light"); }, 150 + i * 220);
    }
    $("#r-echoes").textContent = res.echoes; $("#r-time").textContent = res.exitTick;
    countUp($("#r-coins"), reward);
    $("#r-sub").textContent = (firstClear ? T("first_clear") + " · " : custom ? T("custom") + " · " : "") + `${T("par_label")} ${game.level.par}`;
    $("#r-best").hidden = !newBest; $("#r-best").textContent = T("new_best");
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
  if (i < 0) return null;                                   // daily and editor rooms have no "next"
  const n = L.LEVELS[i + 1];
  return n && L.worldUnlocked(profile, n.world) ? n.id : null;
}
function shake(n) { if (opts.shake && !reduceMotion) game.shake = Math.max(game.shake, n); }
function quit() {
  game.playing = false; musicOn(false); game.replay = null;
  show(game.levelKey === "daily" ? "s-daily" : game.levelKey?.startsWith("custom") ? "s-editor" : "s-levels");
  if (current === "s-levels") renderLevels();
  if (current === "s-daily") renderDaily();
}

// ── input ──────────────────────────────────────────────────────────────────

const KEYS = { ArrowUp: 1, KeyW: 1, ArrowRight: 3, KeyD: 3, ArrowDown: 5, KeyS: 5, ArrowLeft: 7, KeyA: 7 };
const WAIT_KEYS = new Set(["Period", "KeyX", "KeyQ"]);
const SDIR = { 1: [0, -1], 3: [1, 0], 5: [0, 1], 7: [-1, 0] };
const typing = (e) => { const t = e.target; return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable); };
/** Loop controls work only while the hero is really in play: not during the
 *  exit celebration, a replay, or while a sheet covers the room. */
const canControl = () => game.playing && current === "none" && screenEl("s-sheet").hidden && !!game.run && !game.run.finished && !game.run.dead && !(game.replay && !game.replay.live);
/** A screen direction (1 up, 3 right, 5 down, 7 left) in level space. */
const screenToLevel = (sd) => { const [dx, dy] = SDIR[sd]; return levelDir(dx, dy); };
let heldKey = null;
window.addEventListener("keydown", (e) => {
  if (typing(e)) return;
  if (KEYS[e.code]) { e.preventDefault(); if (!e.repeat) { heldKey = e.code; beatInput(screenToLevel(KEYS[e.code])); } return; }
  if (WAIT_KEYS.has(e.code)) { if (!e.repeat) beatInput(0); return; }
  if (e.code === "KeyR" && canControl()) startLoop();
  if ((e.code === "Space" || e.code === "Enter" || e.code === "KeyE") && canControl()) { endLoopNow(); e.preventDefault(); }
});
window.addEventListener("keyup", (e) => { if (e.code === heldKey) heldKey = null; });
window.addEventListener("blur", () => { heldKey = null; touch.dir = 0; });
function vecDir(dx, dy) {
  if (!dx && !dy) return 0;
  const a = Math.atan2(dy, dx);           // 0 = right, +π/2 = down (screen y)
  const idx = Math.round(a / (Math.PI / 4));  // -4 (left) .. 0 (right) .. 4 (left)
  return [7, 8, 1, 2, 3, 4, 5, 6, 7][idx + 4];
}
/**
 * Touch: a swipe is one step, right away. Keeping the finger pushed in that
 * direction keeps stepping on the beat; sliding it elsewhere changes course;
 * a plain tap waits one beat. No joystick to aim, nothing to hold still.
 */
const SWIPE = 20;
const touch = { id: null, x0: 0, y0: 0, t0: 0, dir: 0, moved: false };
canvas.addEventListener("pointerdown", (e) => {
  if (!game.playing || touch.id !== null) return;
  audio()?.resume?.();
  touch.id = e.pointerId; touch.x0 = e.clientX; touch.y0 = e.clientY; touch.t0 = performance.now(); touch.dir = 0; touch.moved = false;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.x0, dy = e.clientY - touch.y0;
  if (Math.hypot(dx, dy) < SWIPE * 0.6) { touch.dir = 0; return; }
  if (Math.hypot(dx, dy) < SWIPE && !touch.moved) return;
  const dir = Math.abs(dx) > Math.abs(dy) ? levelDir(Math.sign(dx), 0) : levelDir(0, Math.sign(dy));
  if (dir !== touch.dir) { touch.dir = dir; touch.moved = true; beatInput(dir); }
});
const touchUp = (e) => {
  if (e.pointerId !== touch.id) return;
  if (!touch.moved && performance.now() - touch.t0 < 320) beatInput(0);
  touch.id = null; touch.dir = 0;
};
canvas.addEventListener("pointerup", touchUp); canvas.addEventListener("pointercancel", touchUp);

/** One input: played now, or queued until the current hop has mostly landed. */
function beatInput(dir) {
  if (!canControl()) return;
  if (performance.now() - game.beatT0 < game.beatMs * 0.55) { game.queued = dir; return; }
  doBeat(dir);
}
function snapshotPrev(run) {
  game.prev = { actors: run.actors.map((a) => ({ x: a.x, y: a.y })), drones: run.drones.map((d) => ({ x: d.px, y: d.py })) };
}
/** The whole world takes one step: the hero as told, echoes and drones as scripted. */
function doBeat(dir) {
  const run = game.run;
  if (!canControl() || run.tick >= L.LOOP_TICKS) return;
  snapshotPrev(run);
  game.recording += String(dir);
  L.stepRun(run, dir);
  game.beatT0 = performance.now(); game.queued = null;
  const hero = run.actors[run.actors.length - 1];
  if (hero.moved) tone(-6 + (run.tick % 4), 0.05); else if (dir) { shake(2); } else tone(-12, 0.04);
  handleEvents(run); updateTimer(run);
  if (run.finished) { levelDone(); return; }
  if (run.dead) { loopFailed(); return; }
  if (run.tick >= L.LOOP_TICKS) loopEnded();
}

// ── frame loop ─────────────────────────────────────────────────────────────

function frame(now) {
  const dt = Math.min(0.2, (now - game.last) / 1000); game.last = now;
  game.fps = (game.fps || 60) * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
  if (game.playing && screenEl("s-sheet").hidden) {
    if (game.freeze > 0) game.freeze -= dt;
    else if (game.replay && !game.replay.live) { if (now - game.beatT0 >= REPLAY_MS) tickReplay(); }
    else if (canControl()) {
      const since = now - game.beatT0;
      if (game.queued !== null && since >= game.beatMs * 0.55) doBeat(game.queued);
      else {
        const held = touch.dir || (heldKey && KEYS[heldKey] ? screenToLevel(KEYS[heldKey]) : 0);
        if (held && since >= REPEAT_MS) doBeat(held);
      }
    }
    game.loopT += dt; game.levelT += dt;
  }
  const c = game.cam, k = Math.min(1, dt * 5);
  c.zoom += (c.tz - c.zoom) * k; c.fx += (c.tfx - c.fx) * k; c.fy += (c.tfy - c.fy) * k;
  if (game.rewind > 0) game.rewind -= dt;
  draw(dt);
  requestAnimationFrame(frame);
}
function tickReplay() {
  const run = game.run;
  if (run.finished || run.dead || run.tick >= L.LOOP_TICKS) { game.replay.live = true; return; }
  snapshotPrev(run);
  const c = game.replay.logs[game.replay.logs.length - 1].charCodeAt(run.tick) - 48;
  L.stepRun(run, c >= 0 && c <= 8 ? c : 0);
  game.beatT0 = performance.now();
  handleEvents(run); updateTimer(run);
  if (run.finished) { later(1500, () => { game.playing = false; show("s-result"); }); }
}
function updateTimer(run) {
  const left = Math.max(0, L.LOOP_TICKS - run.tick);
  $("#t-num").textContent = left;
  const arc = $("#timer .arc"); const r = 31, c = 2 * Math.PI * r;
  arc.style.strokeDasharray = `${c * (left / L.LOOP_TICKS)} ${c}`; arc.classList.toggle("hot", left <= 3 && left > 0);
}
function handleEvents(run) {
  for (const e of run.events) {
    if (e.t === "coin") {
      sfx("chime", 0.5); burst(e.x + 0.5, e.y + 0.5, "#ffc93c", 14);
      if (e.hero) { flyCoin(e.x + 0.5, e.y + 0.5); buzz("light"); } else bumpCoins();
    } else if (e.t === "plate") { sfx("plate", 0.7); game.flash = Math.max(game.flash, 0.1); ring(e); buzz("medium"); }
    else if (e.t === "open") { sfx("door", 0.6); game.doorAnim[e.k] = { t: 0, open: true }; buzz("light"); }
    else if (e.t === "close") { game.doorAnim[e.k] = { t: 0, open: false }; }
    else if (e.t === "dead") burst(e.x + 0.5, e.y + 0.5, "#ff4fd8", 26);
    else if (e.t === "exit") { burst(e.x + 0.5, e.y + 0.5, "#ffd9a8", 40); burst(e.x + 0.5, e.y + 0.5, "#39e6ff", 24); game.flash = 0.45; game.exitAnim = { x: e.x + 0.5, y: e.y + 0.5, t: 0, face: game.run.actors[game.run.actors.length - 1].face || 1 }; }
  }
}
function ring(e) {
  // A plate ripple: one expanding ring particle.
  game.particles.push({ x: 0, y: 0, ring: true, life: 0.5, max: 0.5, color: "#ff4fd8", k: e.k });
}
function burst(lx, ly, color, n) {
  const { x, y } = R(lx, ly);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4;
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, color, r: 2 + Math.random() * 4 });
  }
}
function dust(a, p) {
  if (reduceMotion) return;
  const [dx, dy] = L.DIRS[sdirOf(a.dir)];
  game.particles.push({ x: p.x - dx * 0.15 + (Math.random() - 0.5) * 0.2, y: p.y + 0.28, vx: -dx * 0.6 + (Math.random() - 0.5) * 0.4, vy: -0.3 - Math.random() * 0.4 - dy * 0.3, life: 0.35, color: "rgba(170,180,230,.45)", r: 2.5 + Math.random() * 2, dust: true });
}
function flyCoin(lx, ly) {
  const r = $("#hud-coins").getBoundingClientRect();
  const p = R(lx, ly);
  game.flies.push({ x: cx(p.x), y: cy(p.y), tx: r.left + r.width / 2, ty: r.top + r.height / 2, t: 0 });
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
  const by = Math.min(0, Math.max(H - bh, cy(view.rows / 2) - bh / 2));
  g.filter = "blur(2px) saturate(.9)"; g.globalAlpha = 0.82; g.drawImage(img, (W - bw) / 2, by, bw, bh);
  g.filter = "none"; g.globalAlpha = 1;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(7,10,24,.6)"); grad.addColorStop(0.4, "rgba(7,10,24,.22)"); grad.addColorStop(1, "rgba(7,10,24,.9)");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // A cool overhead light that pools around the room, so it sits in the hall
  // instead of floating on a black field.
  const lx = cx(view.cols / 2) + W * 0.02, ly = cy(view.rows / 2) + H * 0.02, lr = Math.max(W, H) * 0.55;
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
  const rm = rmapFor(level);
  const key = `${rm.join("")}:${view.w}x${view.h}`;
  if (floorCache.key === key) return floorCache.canvas;
  const c = document.createElement("canvas"); c.width = view.w; c.height = view.h;
  const g = c.getContext("2d");
  const cs = view.cs, cols = view.cols, rows = view.rows;
  const isWall = (x, y) => x < 0 || y < 0 || x >= cols || y >= rows || rm[y][x] === "#";
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const x0 = view.ox, y0 = view.oy, x1 = view.ox + cs * cols, y1 = view.oy + cs * rows;
  // Lit slate tiles: a quiet checker, a hairline grout, a bevel on the lit
  // edges, and a wash of light that falls from the upper left.
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (isWall(x, y)) continue;
    const px = x0 + x * cs, py = y0 + y * cs;
    g.fillStyle = (x + y) % 2 ? "#2a3166" : "#272d5f"; g.fillRect(px, py, cs, cs);
    g.fillStyle = `rgba(10,14,32,${rnd() * 0.1})`; g.fillRect(px, py, cs, cs);
    g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(px + 1, py + 1, cs - 2, 1); g.fillRect(px + 1, py + 1, 1, cs - 2);
    g.fillStyle = "rgba(5,7,20,.5)"; g.fillRect(px, py, cs, 1); g.fillRect(px, py, 1, cs); g.fillRect(px, py + cs - 1, cs, 1); g.fillRect(px + cs - 1, py, 1, cs);
    // Ambient occlusion: a soft darkening along every edge that meets a wall.
    const ao = cs * 0.3;
    const edges = [[isWall(x, y - 1), px, py, px, py + ao], [isWall(x, y + 1), px, py + cs, px, py + cs - ao], [isWall(x - 1, y), px, py, px + ao, py], [isWall(x + 1, y), px + cs, py, px + cs - ao, py]];
    for (const [w, ax, ay, bx, by] of edges) {
      if (!w) continue;
      const gr = g.createLinearGradient(ax, ay, bx, by); gr.addColorStop(0, "rgba(3,5,14,.5)"); gr.addColorStop(1, "rgba(3,5,14,0)");
      g.fillStyle = gr; g.fillRect(px, py, cs, cs);
    }
  }
  // Wall drop shadows onto the floor (light from the upper left).
  g.save(); g.filter = `blur(${Math.max(3, cs * 0.12)}px)`; g.fillStyle = "rgba(3,5,14,.5)";
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!isWall(x, y)) continue;
    g.fillRect(x0 + (x + 0.1) * cs, y0 + (y + 0.16) * cs, cs, cs);
  }
  g.restore();
  // Directional wash and a soft vignette, so the floor reads lit, not flat.
  const lw = g.createLinearGradient(x0, y0, x1, y1);
  lw.addColorStop(0, "rgba(190,210,255,.11)"); lw.addColorStop(0.5, "rgba(190,210,255,0)"); lw.addColorStop(1, "rgba(0,0,0,.16)");
  g.fillStyle = lw; g.fillRect(x0, y0, cs * cols, cs * rows);
  const vx = (x0 + x1) / 2, vy = (y0 + y1) / 2;
  const vg = g.createRadialGradient(vx, vy, cs * 2.5, vx, vy, cs * Math.max(cols, rows) * 0.7);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.3)");
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

/** Walls rise out of the floor over the first half second of a level. */
const wallH = () => WALL_H * (reduceMotion ? 1 : easeOut(game.levelT / 0.5));
/** One gradient for the whole room, so adjacent blocks merge into one slab. */
let wallGrad = { key: "", top: null, front: null };
function wallPaint() {
  const key = `${view.ox},${view.oy},${view.cs},${view.t}`;
  if (wallGrad.key === key) return wallGrad;
  const x0 = cx(0), y0 = cy(0), x1 = cx(view.cols), y1 = cy(view.rows);
  const top = ctx.createLinearGradient(x0, y0, x1, y1);
  top.addColorStop(0, "#5663a8"); top.addColorStop(1, "#3c4688");
  const front = ctx.createLinearGradient(0, 0, 0, view.cs * WALL_H);
  front.addColorStop(0, "#2a3270"); front.addColorStop(1, "#121736");
  wallGrad = { key, top, front };
  return wallGrad;
}
function drawWall(rm, x, y) {
  const cs = view.cs, H = wallH();
  const isWall = (ax, ay) => ax < 0 || ay < 0 || ax >= view.cols || ay >= view.rows || rm[ay][ax] === "#";
  const px = cx(x), py = cy(y);
  const paint = wallPaint();
  // Front face, only where the floor continues below.
  if (!isWall(x, y + 1)) {
    ctx.save(); ctx.translate(0, py + cs * (1 - H)); ctx.fillStyle = paint.front; ctx.fillRect(px, 0, cs, cs * H); ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(px, py + cs * (1 - H), cs, 1.5);
  }
  // Top face: one clean slab with a whisper of grain; the edges do the work.
  ctx.fillStyle = paint.top; ctx.fillRect(px, py - cs * H, cs, cs);
  const n = ((x * 7919 + y * 104729) % 17) / 17;
  ctx.fillStyle = `rgba(255,255,255,${0.01 + n * 0.028})`; ctx.fillRect(px, py - cs * H, cs, cs);
  if (!isWall(x, y + 1)) { ctx.fillStyle = "rgba(57,230,255,.22)"; ctx.fillRect(px, py + cs - 2, cs, 2); }
  // Exposed edges catch the light; merged runs keep no seam.
  ctx.fillStyle = "rgba(255,255,255,.2)";
  if (!isWall(x, y - 1)) ctx.fillRect(px, py - cs * H, cs, 2);
  if (!isWall(x - 1, y)) ctx.fillRect(px, py - cs * H, 2, cs);
  ctx.fillStyle = "rgba(5,7,18,.4)";
  if (!isWall(x + 1, y)) ctx.fillRect(px + cs - 2, py - cs * H, 2, cs);
  if (!isWall(x, y + 1)) ctx.fillRect(px, py + cs * (1 - H) - 2, cs, 2);
}
function drawDoor(rm, x, y, ch, dt) {
  const cs = view.cs;
  const an = game.doorAnim[ch]; let open = game.run.doors[ch] ? 1 : 0;
  if (an) { an.t = Math.min(1, an.t + dt * 3.2); const e = easeOut(an.t); open = an.open ? e : 1 - e; }
  const px = cx(x), py = cy(y);
  const now = performance.now() / 1000;
  const vis = 1 - open;                       // how much of the barrier is still up
  // The gate spans the gap in the wall: vertical bars when the wall runs up and
  // down, horizontal bars when it runs left and right. The walls are the posts;
  // the emitters sit on their faces.
  const isWall = (ax, ay) => ax < 0 || ay < 0 || ax >= view.cols || ay >= view.rows || rm[ay][ax] === "#";
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
  const lvl = run.level, rm = rmapFor(lvl), cols = view.cols, rows = view.rows;
  const now = performance.now() / 1000;

  // Backdrop with a slow drift.
  const bgc = backdrop(L.WORLDS[(lvl.world || 1) - 1].bg);
  if (bgc) ctx.drawImage(bgc, -w * 0.02 + Math.sin(now * 0.12) * 5, -h * 0.02 + Math.cos(now * 0.09) * 4);
  else { ctx.fillStyle = "#0e1328"; ctx.fillRect(0, 0, w, h); }

  // The room is a rounded window onto the level: the outer wall ring is
  // mostly off screen, and everything inside shakes and zooms behind the frame.
  const fx0 = cx(CROP), fy0 = cy(CROP), fw = cs * (cols - 2 * CROP), fh = cs * (rows - 2 * CROP);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(fx0, fy0, fw, fh, FRAME_R); ctx.clip();
  // Camera.
  ctx.save();
  const c = game.cam, mx = cx(cols / 2), my = cy(rows / 2);
  let sx = 0, sy = 0;
  if (game.shake > 0) { sx = (Math.random() - 0.5) * game.shake; sy = (Math.random() - 0.5) * game.shake; game.shake = Math.max(0, game.shake - dt * 40); }
  ctx.translate(mx + sx, my + sy); ctx.scale(c.zoom, c.zoom); ctx.translate(-mx - c.fx, -my - c.fy);

  // Floor.
  ctx.drawImage(floorLayer(lvl), 0, 0);

  // Light pools, additive.
  ctx.globalCompositeOperation = "lighter";
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const ch = rm[y][x];
    if (ch === "a" || ch === "b" || ch === "c") light(x + 0.5, y + 0.5, cs * 1.1, "rgba(255,79,216,.55)", run.plates[ch] ? 0.55 : 0.2);
    else if (ch === "E") light(x + 0.5, y + 0.5, cs * 1.4, "rgba(255,201,60,.6)", 0.35 + Math.sin(now * 2.2) * 0.08);
  }
  // Everyone hops from where they stood to where they stand over one beat.
  const bk = reduceMotion ? 1 : easeOut(clamp01((performance.now() - game.beatT0) / game.beatMs));
  const hop = Math.sin(bk * Math.PI);
  const tween = (prev, x, y) => (prev ? { x: prev.x + (x - prev.x) * bk + 0.5, y: prev.y + (y - prev.y) * bk + 0.5, moving: prev.x !== x || prev.y !== y } : { x: x + 0.5, y: y + 0.5, moving: false });
  const apos = run.actors.map((a, i) => tween(game.prev?.actors[i], a.x, a.y));
  const dpos = run.drones.map((d, i) => tween(game.prev?.drones[i], d.px, d.py));
  for (const co of run.coins) if (!co.taken) { const p = R(co.x + 0.5, co.y + 0.5); light(p.x, p.y, cs * 0.5, "rgba(255,201,60,.5)", 0.3); }
  dpos.forEach((q) => { const p = R(q.x, q.y); light(p.x, p.y + 0.15, cs * 0.95, "rgba(255,79,216,.55)", 0.3, 1, 0.55); });
  const last = run.actors.length - 1;
  for (let i = 0; i < last; i++) { const a = run.actors[i]; if (!a.done) { const p = R(apos[i].x, apos[i].y); light(p.x, p.y + 0.3, cs * 0.8, "rgba(57,230,255,.5)", 0.22, 1, 0.45); } }
  ctx.globalCompositeOperation = "source-over";

  // Floor decals: plates, exit, drone paths, coins.
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const ch = rm[y][x];
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
    const a = R(d.x + 0.5, d.y + 0.5), b = R(d.x + 0.5 + d.dx * d.n, d.y + 0.5 + d.dy * d.n);
    ctx.strokeStyle = "rgba(255,79,216,.18)"; ctx.lineWidth = 2; ctx.setLineDash([5, 9]);
    ctx.beginPath(); ctx.moveTo(cx(a.x), cy(a.y)); ctx.lineTo(cx(b.x), cy(b.y)); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const co of run.coins) {
    if (co.taken) continue;
    const p = R(co.x + 0.5, co.y + 0.5);
    const bob = Math.sin(now * 3 + p.x * 2.1) * 0.05;
    shadow(p.x, p.y + 0.3, 0.16, 0.3);
    sprite(IMG.coin, p.x, p.y + bob - 0.1, 0.6, 1, { sx: Math.abs(Math.cos(now * 2.4 + p.x)) * 0.75 + 0.25 });
  }

  // Depth-sorted: walls, doors, drones, actors.
  const items = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const ch = rm[y][x];
    if (ch === "#") items.push({ z: y + 1, f: () => drawWall(rm, x, y) });
    else if (ch === "A" || ch === "B" || ch === "C") items.push({ z: y + 0.2, f: () => drawDoor(rm, x, y, ch, dt) });
  }
  const esp = echoSprite(profile.skin), ecol = skinColor(profile.skin);
  run.actors.forEach((a, i) => {
    if (a.done || (!a.alive && i === last)) return;
    const isEcho = i < last;
    const appear = reduceMotion ? 1 : easeOut((game.loopT - (isEcho ? 0.1 + i * 0.07 : 0)) / 0.35);
    const q = apos[i], p = R(q.x, q.y);
    items.push({ z: p.y + 0.3, f: () => drawActor(a, p, isEcho, appear, esp, ecol, now, q.moving ? hop : 0, q.moving && bk < 1) });
  });
  run.drones.forEach((d, i) => { const q = dpos[i], p = R(q.x, q.y); items.push({ z: p.y + 0.35, f: () => drawDrone(d, p, now) }); });
  items.sort((p, q) => p.z - q.z);
  for (const it of items) it.f();

  // The hero spirals into the portal.
  if (game.exitAnim) {
    const ea = game.exitAnim; ea.t += dt;
    const k = clamp01(ea.t / 0.55), p = R(ea.x, ea.y);
    if (k >= 1) game.exitAnim = null;
    else sprite(IMG.hero, p.x, p.y - 0.14 * (1 - k), 1.2 * (1 - k * 0.92), 1 - k * k, { flip: ea.face < 0, rot: k * k * 7 });
  }
  // A scanline sweeps the room as the walls rise.
  if (!reduceMotion && game.levelT < 0.75) {
    const k = easeOut(game.levelT / 0.75), yy = cy(rows * k);
    const g = ctx.createLinearGradient(0, yy - cs * 1.6, 0, yy); g.addColorStop(0, "rgba(57,230,255,0)"); g.addColorStop(1, `rgba(57,230,255,${0.32 * (1 - k)})`);
    ctx.fillStyle = g; ctx.fillRect(cx(0), yy - cs * 1.6, cs * cols, cs * 1.6);
    ctx.fillStyle = `rgba(210,250,255,${0.85 * (1 - k)})`; ctx.fillRect(cx(0), yy - 1, cs * cols, 2);
  }

  drawMotes(dt, cols, rows);

  // Particles (already in render space).
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i]; p.life -= dt;
    if (p.life <= 0) { game.particles.splice(i, 1); continue; }
    if (p.ring) {
      const k = 1 - p.life / p.max;
      let px = 0, py = 0;
      for (let y = 0; y < rows && !px; y++) { const x = rm[y].indexOf(p.k); if (x >= 0) { px = x + 0.5; py = y + 0.5; } }
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.translate(cx(px), cy(py)); ctx.scale(1, 0.55);
      ctx.beginPath(); ctx.arc(0, 0, cs * (0.3 + k * 1.1), 0, 7); ctx.stroke(); ctx.restore();
      continue;
    }
    const damp = p.conf ? 1 : Math.pow(0.006, dt);          // the old per-frame 0.92, made frame-rate independent
    if (p.conf) p.vy += 4 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= damp; p.vy *= damp;
    ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color;
    if (p.conf) { ctx.save(); ctx.translate(cx(p.x), cy(p.y)); ctx.rotate(p.life * 9 + p.x); ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(cx(p.x), cy(p.y), p.r * (p.dust ? 1 + (0.35 - p.life) * 2 : 1), 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.restore();
  // Frame: a hairline rim and a soft shadow so the window sits in the hall.
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(fx0 - 3, fy0 - 3, fw + 6, fh + 6, FRAME_R + 3); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(fx0 + 0.5, fy0 + 0.5, fw - 1, fh - 1, FRAME_R); ctx.stroke();
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

/** Slow cyan motes drifting up through the room: the air of the lab. */
const motes = [];
function drawMotes(dt, cols, rows) {
  if (reduceMotion) return;
  if (!motes.length) for (let i = 0; i < 26; i++) motes.push({ x: Math.random() * cols, y: Math.random() * rows, v: 0.05 + Math.random() * 0.09, p: Math.random() * 7, r: 0.9 + Math.random() * 1.5 });
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const m of motes) {
    m.y -= m.v * dt; m.p += dt; if (m.y < 0) { m.y = rows; m.x = Math.random() * cols; }
    ctx.globalAlpha = 0.16 + Math.sin(m.p * 1.7) * 0.1; ctx.fillStyle = "#39e6ff";
    ctx.beginPath(); ctx.arc(cx(m.x + Math.sin(m.p) * 0.08), cy(m.y), m.r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawActor(a, p, isEcho, appear, esp, ecol, now, hop = 0, moving = false) {
  const cs = view.cs;
  if (appear <= 0) return;
  const sd = sdirOf(a.dir);
  if (a.dir) a.face = sd >= 6 ? -1 : sd >= 2 && sd <= 4 ? 1 : a.face || 1;
  const flip = (a.face || 1) < 0;
  // A step is a little hop: up and stretched on the way, squashed on landing.
  const bob = moving ? hop * 0.16 : Math.sin(now * 2.4) * 0.012;
  const sx = moving ? 1 - hop * 0.08 : 1 - bob * 0.5;
  const sy = moving ? 1 + hop * 0.1 : 1 + bob;
  const lean = moving ? (flip ? -1 : 1) * 0.1 * (sd === 1 || sd === 5 ? 0 : 1) : 0;
  if (!isEcho && moving && a.alive && a.dusted !== game.beatT0) { a.dusted = game.beatT0; dust(a, p); }
  if (isEcho) {
    // Hologram: projector ring + cone + translucent, faintly flickering copy.
    const flick = 0.78 + Math.sin(now * 23 + p.x * 7) * 0.05 + Math.sin(now * 61) * 0.03;
    ctx.save(); ctx.translate(cx(p.x), cy(p.y + 0.32)); ctx.scale(1, 0.4); ctx.strokeStyle = ecol;
    ctx.globalAlpha = 0.25 * appear; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, cs * 0.34, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.9 * appear; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, cs * 0.34, 0, 7); ctx.stroke(); ctx.restore();
    const cone = ctx.createLinearGradient(0, cy(p.y + 0.32), 0, cy(p.y - 0.6));
    cone.addColorStop(0, hexA(ecol, 0.28 * appear)); cone.addColorStop(1, hexA(ecol, 0));
    ctx.fillStyle = cone; ctx.beginPath();
    ctx.moveTo(cx(p.x - 0.3), cy(p.y + 0.32)); ctx.lineTo(cx(p.x + 0.3), cy(p.y + 0.32)); ctx.lineTo(cx(p.x + 0.5), cy(p.y - 0.6)); ctx.lineTo(cx(p.x - 0.5), cy(p.y - 0.6)); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    sprite(esp, p.x, p.y - 0.14 - bob, 1.18 * 1.06, 0.22 * appear, { flip, sx, sy: sy * appear, rot: lean });
    ctx.globalCompositeOperation = "source-over";
    sprite(esp, p.x, p.y - 0.14 - bob, 1.18, flick * appear, { flip, sx, sy: sy * appear, rot: lean });
  } else {
    shadow(p.x, p.y + 0.33, 0.38 * (1 - bob * 2), 0.45);
    sprite(IMG.hero, p.x, p.y - 0.14 - bob, 1.2, 1, { flip, sx: sx * appear, sy: sy * appear, rot: lean });
  }
}
function drawDrone(d, p, now) {
  const bob = Math.sin(now * 4 + d.x) * 0.05;
  const horizontal = view.t ? d.dy : d.dx;
  const tilt = horizontal ? Math.sin(now * 0.6) * 0.06 : 0;
  shadow(p.x, p.y + 0.38, 0.3, 0.35);
  sprite(IMG.drone, p.x, p.y - 0.12 + bob, 0.92, 1, { rot: tilt });
  // Scanning eye: a hard little flare.
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + Math.sin(now * 9) * 0.2;
  ctx.fillStyle = "#ff4fd8"; ctx.beginPath(); ctx.arc(cx(p.x), cy(p.y - 0.12 + bob), view.cs * 0.07, 0, 7); ctx.fill(); ctx.restore();
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

function starIcons(n, size) {
  let s = "";
  for (let i = 0; i < 3; i++) s += `<svg class="ic ${i < n ? "" : "off"}" style="width:${size}px;height:${size}px"><use href="#i-star"/></svg>`;
  return s;
}
const SVGNS = "http://www.w3.org/2000/svg";
const NODE_ROW = 96;
const NODE_X = [24, 72, 30, 76];
/**
 * The world map: a banner per world and a winding trail of level nodes under
 * it. The next room to play glows; cleared rooms turn gold and light the trail.
 */
function renderLevels() {
  const root = $("#worlds"); root.innerHTML = "";
  const nextKey = L.LEVELS.find((l) => !profile.stars[l.id] && L.worldUnlocked(profile, l.world))?.id;
  const star = (px) => `<svg class="ic" style="width:${px}px;height:${px}px;fill:var(--gold);stroke:none"><use href="#i-star"/></svg>`;
  for (const w of L.WORLDS) {
    const unlocked = L.worldUnlocked(profile, w.id);
    const levels = L.LEVELS.filter((l) => l.world === w.id);
    const got = levels.reduce((n, l) => n + (profile.stars[l.id] || 0), 0), max = levels.length * 3;
    const need = (w.id - 1) * 7, have = L.totalStars(profile);
    const sec = document.createElement("section"); sec.className = "wmap" + (unlocked ? "" : " locked");
    sec.style.setProperty("--art", `url(assets/${w.bg}.jpg)`);
    const prog = unlocked
      ? `<span class="chip">${star(14)}${got}/${max}</span><div class="bar"><i style="width:${(got / max) * 100}%"></i></div>`
      : `<span class="lockline"><svg class="ic" style="width:15px;height:15px"><use href="#i-lock"/></svg>${T("world_locked", { n: need })}</span><div class="bar"><i style="width:${Math.min(100, (have / need) * 100)}%"></i></div>`;
    sec.innerHTML = `<header class="wbanner"><span class="wnum">${w.id}</span><div class="wtitle"><span class="eyebrow">${T("world_n", { n: w.id })}</span><h2>${T("world" + w.id)}</h2></div><div class="wprog">${prog}</div></header>`;
    const path = document.createElement("div"); path.className = "path"; path.style.setProperty("--n", levels.length);
    const svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("class", "trail"); path.appendChild(svg);
    levels.forEach((lv, i) => {
      const st = profile.stars[lv.id] || 0, isNext = lv.id === nextKey;
      const b = document.createElement("button");
      b.className = "node" + (st ? " done" : "") + (isNext ? " next" : "") + (unlocked ? "" : " off");
      b.style.setProperty("--x", NODE_X[i % NODE_X.length] + "%"); b.style.setProperty("--row", i);
      b.innerHTML = `<span class="disc">${unlocked ? `<b>${i + 1}</b>` : `<svg class="ic"><use href="#i-lock"/></svg>`}</span><span class="stars">${starIcons(st, 13)}</span>`;
      if (isNext) b.insertAdjacentHTML("afterbegin", `<span class="tag">${T("up_next")}</span>`);
      b.addEventListener("click", () => { if (!unlocked) { toast(T("level_locked")); return; } startLevel(lv, lv.id); });
      path.appendChild(b);
    });
    sec.appendChild(path); root.appendChild(sec);
    const done = levels.map((l) => !!profile.stars[l.id]);
    requestAnimationFrame(() => drawTrail(svg, path, done));
  }
}
/** The dotted trail through the nodes; the stretch behind cleared rooms is lit. */
function drawTrail(svg, path, done) {
  const W = path.clientWidth, H = path.clientHeight; if (!W) return;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = "";
  const pt = (i) => [(NODE_X[i % NODE_X.length] / 100) * W, i * NODE_ROW + NODE_ROW / 2];
  const seg = (i) => { const [x0, y0] = pt(i), [x1, y1] = pt(i + 1), dy = (y1 - y0) * 0.55; return `M${x0},${y0}C${x0},${y0 + dy} ${x1},${y1 - dy} ${x1},${y1}`; };
  let lit = 0; while (lit < done.length - 1 && done[lit]) lit++;
  const add = (d, cls) => { if (!d) return; const e = document.createElementNS(SVGNS, "path"); e.setAttribute("d", d); e.setAttribute("class", cls); svg.appendChild(e); };
  add(Array.from({ length: done.length - 1 }, (_, i) => seg(i)).join(""), "dim");
  add(Array.from({ length: lit }, (_, i) => seg(i)).join(""), "lit");
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
      const buy = () => { const v = saveRoom.act({ t: "buy", item: id }); if (v.ok) { toast(T("bought")); sfx("chime"); buzz("success"); } else toast(T("not_enough", { c: s.gems ? T("gems") : T("coins") })); renderShop(); };
      // Premium currency asks first, like every store does; coins are instant.
      b.addEventListener("click", () => {
        if ((s.gems && profile.gems < s.gems) || (s.coins && profile.coins < s.coins)) { toast(T("not_enough", { c: s.gems ? T("gems") : T("coins") })); buzz("warning"); return; }
        if (s.gems) confirmBuy(T("skin_name", { n: id }), T("gems_n", { n: s.gems }), buy); else buy();
      });
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
/** The standard store question before anything is spent: what, for how much, and a way out. */
function confirmBuy(item, price, onYes) {
  sheet(`<div class="eyebrow">${T("purchase_title")}</div><h2>${T("purchase_q", { item, price })}</h2><p>${T("purchase_note")}</p>`, [
    [T("cancel"), "ghost", closeSheet],
    [T("buy_for", { price }), "primary", () => { closeSheet(); onYes(); }],
  ]);
}
function purchase(sku) {
  const p = L.IAP[sku];
  confirmBuy(T(sku), p.price, () => {
    const v = saveRoom.act({ t: "iap", sku });
    if (v.ok) { toast(T("bought")); sfx("win", 0.6); buzz("success"); }
    renderShop();
  });
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
  const mine = profile.stars[`daily-${today()}`] || 0;
  const you = $("#d-you"); you.hidden = !mine; you.innerHTML = mine ? starIcons(mine, 16) + " " + T("daily_you", { n: mine }) : "";
  const b = $("#board"); b.innerHTML = "";
  const board = dailyView.day === today() ? dailyView.board : [];
  if (!board.length) { const p = document.createElement("p"); p.textContent = T("board_empty"); b.appendChild(p); return; }
  board.slice(0, 20).forEach((e, i) => {
    const d = document.createElement("div"); if (e.pid === PID) d.className = "me";
    d.innerHTML = `<span class="rank">${i + 1}</span><span class="grow">${esc(e.name || (e.pid === PID ? T("you") : T("unnamed")))}</span><span>${e.echoes} ${T("echoes_used")}</span><span>${e.ticks} ${T("seconds")}</span>`;
    b.appendChild(d);
  });
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ── screens: editor ────────────────────────────────────────────────────────

const ed = { map: ["#######", "#S....#", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", "#....E#", "#######"].map((r) => r.split("")), tool: "#", drones: [] };
const TOOLS = [["#", "▇"], [".", "·"], ["S", "S"], ["E", "E"], ["a", "a"], ["A", "A"], ["b", "b"], ["B", "B"], ["c", "c"], ["C", "C"], ["o", "o"], ["@", "◉"]];
/** How far a patrol can run from (x,y) in direction (dx,dy) before a wall, at most 4. */
function droneSpan(map, x, y, dx, dy) {
  let n = 0;
  while (n < 4 && map[y + dy * (n + 1)]?.[x + dx * (n + 1)] && map[y + dy * (n + 1)][x + dx * (n + 1)] !== "#") n++;
  return n;
}
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
      if (ed.tool === "@") {
        // Tap a floor cell to start a patrol there (it runs along the longer
        // open stretch, right or down); tap it again to remove it.
        const i = ed.drones.findIndex((d) => d.x === x && d.y === y);
        if (i >= 0) ed.drones.splice(i, 1);
        else if (ed.map[y][x] !== "#" && ed.drones.length < 4) {
          const h = droneSpan(ed.map, x, y, 1, 0), v = droneSpan(ed.map, x, y, 0, 1);
          if (h || v) ed.drones.push(h >= v ? { x, y, dx: 1, dy: 0, n: h, phase: ed.drones.length * 2 } : { x, y, dx: 0, dy: 1, n: v, phase: ed.drones.length * 2 });
          else toast(T("drone_nowhere"));
        }
        renderEditor(); return;
      }
      if (ed.tool === "S" || ed.tool === "E") for (const row of ed.map) for (let i = 0; i < row.length; i++) if (row[i] === ed.tool) row[i] = ".";
      if (ed.tool === "#") ed.drones = ed.drones.filter((d) => !(d.x === x && d.y === y));
      ed.map[y][x] = ed.tool; renderEditor();
    };
    b.addEventListener("pointerdown", paint); b.addEventListener("pointerenter", (e) => { if (e.buttons) paint(); });
    g.appendChild(b);
  }
}
function editorLevel() {
  const par = Math.min(6, Math.max(1, Math.round(Number($("#ed-par").value) || 3)));
  $("#ed-par").value = par;
  // Patrols shrink to the floor that is still open, and vanish if walled in.
  const drones = ed.drones.map((d) => ({ ...d, n: Math.min(d.n, droneSpan(ed.map, d.x, d.y, d.dx, d.dy)) })).filter((d) => d.n > 0 && ed.map[d.y][d.x] !== "#");
  return { id: "custom", world: 1, par, mirror: $("#ed-mirror").checked, map: ed.map.map((r) => r.join("")), drones };
}

// ── wiring ─────────────────────────────────────────────────────────────────

$("#b-play").addEventListener("click", () => { renderLevels(); show("s-levels"); });
$("#b-daily").addEventListener("click", () => { renderDaily(); show("s-daily"); });
$("#b-shop").addEventListener("click", () => { renderShop(); show("s-shop"); });
$("#b-editor").addEventListener("click", () => { renderEditor(); show("s-editor"); });
$("#b-settings").addEventListener("click", () => { $("#opt-name").value = profile.name; show("s-settings"); });
$("#b-clubs").addEventListener("click", () => sheet(`<h2>${T("clubs_title")}</h2><p>${T("clubs_sub")}</p>`, [[T("close"), "ghost", closeSheet]]));
document.querySelectorAll(".b-back").forEach((b) => b.addEventListener("click", () => show("s-title")));
/**
 * HUD buttons fire on the touch itself. While the thumb steers on the canvas a
 * second finger's tap is a non-primary touch, and browsers synthesise no click
 * for those; so a touch pointerup on the button is the tap, and the click that
 * may follow a primary touch is swallowed instead of firing twice.
 */
function tap(el, fn) {
  let armed = false, fired = 0;
  el.addEventListener("pointerdown", (e) => { armed = e.pointerType === "touch"; });
  el.addEventListener("pointerleave", () => { armed = false; });
  el.addEventListener("pointercancel", () => { armed = false; });
  el.addEventListener("pointerup", (e) => { if (!armed || e.pointerType !== "touch") return; armed = false; fired = performance.now(); fn(e); });
  el.addEventListener("click", (e) => { if (performance.now() - fired < 500) return; fn(e); });
}
tap($("#b-quit"), quit);
tap($("#b-endloop"), endLoopNow);
$("#c-coins").addEventListener("click", () => { renderShop(); show("s-shop"); });
$("#c-gems").addEventListener("click", () => { renderShop(); show("s-shop"); });
$("#c-stars").addEventListener("click", () => { renderLevels(); show("s-levels"); });
tap($("#b-redo"), () => { if (canControl()) startLoop(); });
tap($("#b-restart"), () => { if (canControl()) { game.logs = []; startLoop(); } });
tap($("#b-hintad"), () => {
  const own = hintFor(game.level, game.levelKey);
  const hintText = own === T("hint_generic") ? own : own + " " + T("hint_generic");
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
  const text = T("share_text", { lvl: levelName(game.levelKey), e: r.res.echoes, t: r.res.exitTick, s: r.stars });
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
$("#b-cleardrones").addEventListener("click", () => { ed.drones = []; renderEditor(); });
document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => { lang = opts.lang = b.dataset.lang; store.set("opts", opts); applyLang(); }));
for (const k of ["music", "sfx", "shake", "haptics"]) {
  const el = $("#opt-" + k); el.checked = opts[k];
  el.addEventListener("change", () => { opts[k] = el.checked; store.set("opts", opts); if (k === "music") musicOn(game.playing); });
}
$("#opt-name").addEventListener("change", (e) => saveRoom.act({ t: "name", name: e.target.value.slice(0, 16) }));
// The first touch unlocks audio on iOS; decode every clip right then so the
// first coin and the first door already have their sound.
document.addEventListener("pointerdown", () => { audio()?.resume?.(); preloadAudio(); }, { once: true });
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
// Debug handle for automated checks and profiling; holds no secrets.
window.ECHO_DEBUG = game;
