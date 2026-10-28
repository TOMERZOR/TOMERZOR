// Screens, the game loop and the glue between the simulation, the renderer,
// sound, controllers and the network.

import { createState, step, IN, MOVES, FIGHTERS, CONST } from "./sim.js";
import { Rollback } from "./rollback.js";
import { Net } from "./net.js";
import { Arena, Showcase, loadFighterModel, loadPack } from "./render.js";
import { CHARS, STAGES, comboText } from "./chars.js";
import { readInput, setupTouch, clearTouch } from "./input.js";
import { Bot } from "./ai.js";
import * as audio from "./audio.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
const params = new URLSearchParams(location.search);
const NO_DRAW = params.get("nodraw") === "1"; // tests: run the fight without 3D

const arena = new Arena($("#game"));
let showcase = null;

// ---------- screens ----------
let current = "";
function show(id) {
  for (const s of $$(".screen")) s.hidden = s.id !== "s-" + id;
  current = id;
  const fighting = id === "fight";
  $("#hud").hidden = !fighting;
  $("#touch").hidden = !(fighting && isTouch);
  document.body.classList.toggle("fighting", fighting || id === "versus");
  if (id === "select") requestAnimationFrame(() => showcase && showcase.resize());
}
function orient() { document.body.classList.toggle("portrait", innerHeight > innerWidth && isTouch); }
addEventListener("resize", orient); orient();

function message(title, text, then) {
  $(".msg-title").textContent = title;
  $(".msg-text").textContent = text;
  show("msg");
  $(".msg-ok").onclick = () => { audio.sfx("select"); then ? then() : show("menu"); };
}

// ---------- game state ----------
let mode = "";          // cpu | local | online
let match = null;       // the fight in progress
let net = null;
let me = 0;             // which side I play online
const picks = [0, 1];
let ladder = null;      // arcade progress
let paused = false;

// ---------- title ----------
$(".start").onclick = async () => {
  audio.unlock();
  audio.sfx("select");
  audio.voice("title");
  if (isTouch && document.documentElement.requestFullscreen && !document.fullscreenElement) {
    try { await document.documentElement.requestFullscreen({ navigationUI: "hide" }); await screen.orientation.lock("landscape"); } catch {}
  }
  audio.preloadVoices(["round1", "round2", "round3", "fight", "finish", "keter", "combo", "chairality"]);
  if (params.get("room")) { mode = "online"; show("online"); $(".code").value = params.get("room"); joinRoom(params.get("room")); }
  else show("menu");
};

// warm the cache while the title is up
(async () => {
  try {
    await loadPack();
    await Promise.all([0, 1].map((i) => loadFighterModel(CHARS[i].id)));
    $(".loading").textContent = "";
  } catch (e) { $(".loading").textContent = "שגיאה בטעינה, נסי לרענן"; }
})();

// ---------- menu ----------
function soundLabel() { $(".soundBtn").textContent = audio.isMuted() ? "🔇 צליל כבוי" : "🔊 צליל פועל"; }
soundLabel();
for (const b of $$(".menu button")) {
  b.onclick = () => {
    audio.unlock(); audio.sfx("select");
    const go = b.dataset.go;
    if (go === "sound") { audio.setMuted(!audio.isMuted()); soundLabel(); return; }
    if (go === "help") { show("help"); return; }
    mode = go;
    if (go === "online") { resetOnline(); show("online"); return; }
    if (go === "cpu") ladder = null;
    openSelect();
  };
}
for (const b of $$(".back")) b.onclick = () => {
  audio.sfx("select");
  if (current === "select" && mode === "online") { leaveOnline(); }
  if (current === "online") leaveOnline();
  show("menu");
};

// ---------- online lobby ----------
function resetOnline() {
  $(".online-choose").hidden = false;
  $(".online-wait").hidden = true;
  $(".online-status").textContent = "";
}
function leaveOnline() { if (net) { net.close(); net = null; } }

function setupNet() {
  net.on("msg", onNetMsg);
  net.on("lost", () => {
    if (!net) return;
    leaveOnline();
    stopMatch();
    message("החיבור נותק", "היריבה יצאה או שהחיבור שלה נפל.");
  });
  net.on("mode", () => updateNetInfo());
}

$(".host").onclick = async () => {
  audio.sfx("select");
  leaveOnline();
  net = new Net(); setupNet();
  $(".online-status").innerHTML = '<span class="dots">מתחברת לשרת</span>';
  try {
    const code = await net.host();
    me = 0;
    $(".online-choose").hidden = true;
    $(".online-wait").hidden = false;
    $(".roomcode").textContent = code;
    $(".online-status").textContent = "";
    $(".online-wait .status").innerHTML = '<span class="dots">מחכה שחברה תצטרף</span>';
    net.on("peer", () => { audio.sfx("bell"); openSelect(); });
  } catch (e) {
    $(".online-status").textContent = "לא הצלחתי להתחבר לשרת. בדקי את האינטרנט ונסי שוב.";
  }
};
$(".share").onclick = async () => {
  const code = $(".roomcode").textContent;
  const url = location.origin + location.pathname + "?room=" + code;
  const text = `בואי לקרב באורטל קומבט! קוד החדר: ${code}`;
  try {
    if (navigator.share) await navigator.share({ title: "אורטל קומבט", text, url });
    else { await navigator.clipboard.writeText(text + "\n" + url); $(".online-wait .status").textContent = "הקישור הועתק!"; }
  } catch {}
};
$(".joinBtn").onclick = () => { audio.sfx("select"); joinRoom($(".code").value); };
$(".code").addEventListener("keydown", (e) => { if (e.key === "Enter") joinRoom($(".code").value); });

async function joinRoom(code) {
  code = String(code || "").replace(/\D/g, "");
  if (code.length !== 5) { $(".online-status").textContent = "הקוד צריך להיות 5 ספרות"; return; }
  leaveOnline();
  net = new Net(); setupNet();
  $(".online-status").innerHTML = '<span class="dots">מחפשת את החדר</span>';
  try {
    await net.join(code);
    me = 1;
    audio.sfx("bell");
    openSelect();
  } catch (e) {
    leaveOnline();
    $(".online-status").textContent = e.message === "no host" ? "לא מצאתי חדר עם הקוד הזה. בדקי שהחברה פתחה חדר." : "לא הצלחתי להתחבר. בדקי את האינטרנט ונסי שוב.";
  }
}

// online state during select / rematch
let online = null;
function onNetMsg(m) {
  if (m.t === "i" || m.t === "c" || m.t === "sync") { if (match && match.rb) match.rb.receive(m); return; }
  if (!online) return;
  if (m.t === "pick") {
    online.theirPick = m.ch; online.theirReady = !!m.ready;
    picks[1 - me] = m.ch;
    renderSelect();
    maybeStartOnline();
  } else if (m.t === "start" && me === 1) {
    if (online.started) { net.sendImportant({ t: "go" }); return; }
    online.started = true;
    picks[0] = m.c0; picks[1] = m.c1;
    net.sendImportant({ t: "go" });
    beginVersus(m.st);
  } else if (m.t === "go" && me === 0) {
    online.go = true;
  } else if (m.t === "again") {
    online.theyAgain = true;
    if (online.meAgain) { audio.sfx("bell"); openSelect(); } else $(".res-sub").textContent = "היא רוצה עוד קרב!";
  }
}
function maybeStartOnline() {
  if (me !== 0 || !online || online.started) return;
  if (!(online.myReady && online.theirReady)) return;
  online.started = true;
  const st = Math.floor(Math.random() * STAGES.length);
  const msg = { t: "start", c0: picks[0], c1: picks[1], st };
  const send = () => { if (!online || online.go || !net) return; net.sendImportant({ ...msg }); setTimeout(send, 500); };
  send();
  beginVersus(st);
}
function updateNetInfo() {
  if (!net || mode !== "online") { $("#netinfo").textContent = ""; return; }
  const kind = net.mode === "p2p" ? "חיבור ישיר" : "דרך שרת";
  $("#netinfo").textContent = `${kind} · ${Math.round(net.rtt)}ms`;
}
setInterval(updateNetInfo, 1000);

// ---------- character select ----------
let selecting = 0;   // which side is picking (local: 0 then 1)
let lockedP1 = false;
function openSelect() {
  if (!showcase) showcase = new Showcase($(".showcase"));
  const grid = $(".sel-grid");
  if (!grid.children.length) {
    CHARS.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "card";
      b.innerHTML = `<img src="img/p_${c.id}.webp" alt=""><span>${c.name}</span>`;
      b.onclick = () => choose(i);
      grid.appendChild(b);
    });
  }
  selecting = mode === "online" ? me : 0;
  lockedP1 = false;
  if (mode === "online") {
    online = { myReady: false, theirReady: false, started: false, go: false, meAgain: false, theyAgain: false, theirPick: picks[1 - me] };
    net.sendImportant({ t: "pick", ch: picks[me], ready: false });
  }
  $(".ready").disabled = false;
  show("select");
  audio.voice("choose");
  renderSelect();
}
function choose(i) {
  if (mode === "online" && online && online.myReady) return;
  audio.sfx("move");
  picks[selecting] = i;
  if (mode === "online") net.sendImportant({ t: "pick", ch: i, ready: false });
  renderSelect();
}
function renderSelect() {
  const cards = $$(".card");
  cards.forEach((c, i) => {
    c.classList.toggle("sel", picks[mode === "online" ? me : selecting] === i);
    const showOther = mode === "online" || (mode === "local" && lockedP1);
    const other = mode === "online" ? picks[1 - me] : picks[0];
    c.classList.toggle("sel2", showOther && other === i && !(mode === "local" && selecting === 0));
    c.querySelectorAll(".tagp").forEach((t) => t.remove());
  });
  const ch = picks[mode === "online" ? me : selecting];
  const c = CHARS[ch];
  $(".nm").textContent = c.name;
  $(".nm").style.color = c.color;
  $(".tg").textContent = c.tag;
  $(".bio").textContent = c.bio;
  $(".moves").innerHTML = `
    <li><b>${c.itemIcon} זריקה:</b> ${c.item}</li>
    <li><b>⭐ קדימה+זריקה:</b> ${c.sig} – ${c.sigDesc}</li>
    <li><b>💥 הקומבו "${c.combo}":</b> ${comboText(FIGHTERS[ch].str)}</li>
    <li><b>🪑 כוח כתר מלא:</b> זריקת כיסא כתר</li>`;
  showcase.show(ch);
  const msg = $(".sel-msg");
  if (mode === "local") msg.textContent = selecting === 0 ? "שחקנית 1 בוחרת" : `שחקנית 2 בוחרת (שחקנית 1: ${CHARS[picks[0]].name})`;
  else if (mode === "online") {
    const theirs = online ? CHARS[picks[1 - me]].name : "";
    msg.textContent = online && online.myReady ? (online.theirReady ? "מתחילות!" : `מחכה שהיא תבחר… (כרגע: ${theirs})`) : `היריבה על: ${theirs}${online && online.theirReady ? " ✔ מוכנה" : ""}`;
  } else msg.textContent = "";
  $(".ready").textContent = mode === "local" && selecting === 0 ? "בחרתי, תורה של שחקנית 2" : online && online.myReady ? "מחכה…" : "אני מוכנה!";
}
$(".ready").onclick = () => {
  audio.unlock();
  audio.sfx("select");
  if (mode === "local" && selecting === 0) {
    lockedP1 = true; selecting = 1;
    if (picks[1] === picks[0]) picks[1] = (picks[0] + 1) % CHARS.length;
    renderSelect();
    return;
  }
  if (mode === "online") {
    if (online.myReady) return;
    online.myReady = true;
    net.sendImportant({ t: "pick", ch: picks[me], ready: true });
    renderSelect();
    maybeStartOnline();
    return;
  }
  if (mode === "cpu") startLadder();
  else beginVersus(Math.floor(Math.random() * STAGES.length));
};
addEventListener("keydown", (e) => {
  if (current === "select") {
    const i = picks[mode === "online" ? me : selecting];
    if (e.code === "ArrowLeft" || e.code === "KeyA") choose((i + 1) % 8);
    else if (e.code === "ArrowRight" || e.code === "KeyD") choose((i + 7) % 8);
    else if (e.code === "ArrowDown" || e.code === "KeyS") choose((i + 4) % 8);
    else if (e.code === "ArrowUp" || e.code === "KeyW") choose((i + 4) % 8);
    else if (e.code === "Enter" || e.code === "KeyJ") $(".ready").click();
  } else if (current === "title" && (e.code === "Enter" || e.code === "Space")) $(".start").click();
  else if (current === "fight" && e.code === "Escape" && mode !== "online") togglePause();
});

// ---------- arcade ladder ----------
function startLadder() {
  const others = CHARS.map((_, i) => i).filter((i) => i !== picks[0]);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  ladder = { order: others, idx: 0 };
  nextLadderFight();
}
function nextLadderFight() {
  picks[1] = ladder.order[ladder.idx];
  beginVersus(ladder.idx % STAGES.length);
}

// ---------- versus + loading ----------
async function beginVersus(stage) {
  show("versus");
  const [a, b] = [CHARS[picks[0]], CHARS[picks[1]]];
  $(".v0 img").src = `img/p_${a.id}.webp`; $(".v0 h3").textContent = a.name; $(".v0 p").textContent = "“" + a.intro + "”";
  $(".v1 img").src = `img/p_${b.id}.webp`; $(".v1 h3").textContent = b.name; $(".v1 p").textContent = "“" + b.intro + "”";
  $(".vs-stage").textContent = (ladder ? `קרב ${ladder.idx + 1} מתוך 7 · ` : "") + STAGES[stage].name;
  for (const el of $$("#s-versus .vs-side, #s-versus .vs")) { el.style.animation = "none"; el.offsetHeight; el.style.animation = ""; }
  audio.music(false);
  const t0 = performance.now();
  const loading = Promise.all([arena.setStage(stage), arena.setFighters(picks[0], picks[1])]);
  if (mode !== "online") {
    audio.voice("intro_" + a.id, { cut: true });
    await wait(2300);
    audio.voice("intro_" + b.id, { cut: true });
    await wait(2300);
  } else {
    await wait(2600);
  }
  try { await loading; } catch (e) { message("שגיאה", "לא הצלחתי לטעון את הלוחמות. נסי לרענן את הדף."); return; }
  if (mode === "online" && me === 0) {
    // wait for her to confirm she got the start message
    const until = performance.now() + 15000;
    while (online && !online.go && performance.now() < until) await wait(100);
    if (!online || !online.go) { leaveOnline(); message("החיבור נותק", "היריבה לא ענתה."); return; }
  }
  startMatch(stage);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the fight ----------
function startMatch(stage) {
  const [c0, c1] = picks;
  match = { running: true, stage, slow: 0, played: new Map(), over: false, comboT: [0, 0], lastHp: [1000, 1000] };
  if (mode === "online") {
    const sendNet = (msg, important) => {
      if (!net) return;
      // over the brokers, inputs go every other frame (each packet repeats the recent ones)
      if (msg.t === "i" && net.mode !== "p2p" && match.rb && match.rb.frame % 2 === 1) return;
      if (important) net.sendImportant(msg); else net.send(msg);
    };
    match.rb = new Rollback({ me, ch0: c0, ch1: c1, send: sendNet });
    match.rb.onEvents = (ev, f) => handleEvents(ev, f);
  } else {
    match.state = createState(c0, c1);
    if (mode === "cpu") {
      const lvl = ladder ? (ladder.idx < 2 ? 0 : ladder.idx < 5 ? 1 : 2) : 1;
      match.bot = new Bot(1, lvl);
    }
  }
  clearTouch();
  paused = false;
  $("#pauseBtn").hidden = mode === "online";
  setupHudNames();
  show("fight");
  audio.music(true, 2);
  acc = 0;
}
function stopMatch() {
  if (match) match.running = false;
  match = null;
  audio.music(false);
}
function simState() { return match ? (match.rb ? match.rb.state : match.state) : null; }

function tick() {
  if (match.rb) { match.rb.tick(readInput("solo")); return; }
  const s = match.state;
  const in0 = readInput(mode === "local" ? "p1" : "solo");
  const in1 = mode === "local" ? readInput("p2") : match.bot.think(s);
  step(s, in0, in1);
  handleEvents(s.ev, s.f);
}

// ---------- events from the sim -> sound, sparks, words ----------
const SPARK = [[1, 0.95, 0.7], [1, 0.75, 0.3], [1, 1, 1]];
const GLITTER = [[1, 0.4, 0.75], [1, 0.85, 0.3], [0.7, 0.85, 1], [1, 1, 1]];
const BLOOD = [[0.6, 0.02, 0.04], [0.45, 0.0, 0.02], [0.75, 0.05, 0.08]];
function handleEvents(evs, f) {
  if (!match) return;
  for (const ev of evs) {
    const key = `${f}|${ev.k}|${ev.p}|${ev.src || ev.mv || ev.t || ""}`;
    if (match.played.has(key)) continue;
    match.played.set(key, f);
    onEvent(ev);
  }
  if (match.played.size > 3000) for (const [k, fr] of match.played) if (fr < f - 600) match.played.delete(k);
}
function onEvent(ev) {
  const s = simState();
  const P = (i) => s.p[i];
  switch (ev.k) {
    case "hit": {
      const x = ev.x / 1000, y = ev.y / 1000;
      const dir = P(1 - ev.p).face;
      const src = ev.src;
      if (src === "chair") { audio.sfx("chair"); arena.dropDebris("chair", x, y, dir); arena.addShake(1.4); flash("on"); }
      else if (src === "phone") { audio.sfx("phone"); arena.dropDebris("phone", x, y, dir); }
      else if (src === "bag" || src === "slide" || src === "heel") { audio.sfx("bag"); arena.dropDebris(src, x, y, dir); }
      else if (src === "move" && (P(1 - ev.p).mv === "jab" || P(1 - ev.p).mv === "jab2" || P(1 - ev.p).mv === "flash")) audio.sfx("slap");
      else audio.sfx("hit", { big: ev.big });
      if (src === "blush") audio.sfx("puff");
      arena.particles.burst(x, y, 0.2, ev.big ? 26 : 14, { colors: SPARK, life: 0.3, size: 0.09, speed: ev.big ? 5 : 3.4, dir, grav: 4 });
      arena.particles.burst(x, y, 0.2, ev.big ? 16 : 8, { colors: GLITTER, life: 0.8, size: 0.05, speed: 2.5, dir, grav: 2 });
      arena.particles.burst(x, y, 0.15, ev.big ? 14 : 6, { colors: BLOOD, life: 1.1, size: 0.06, speed: 2.8, dir, grav: 9, glow: false, drag: 0.6 });
      arena.hit(ev.p, ev.big);
      if (ev.big) arena.addShake(0.8);
      if (ev.combo >= 2) showCombo(1 - ev.p, `${ev.combo} מכות!`);
      if (ev.combo === 4) audio.voice("combo");
      break;
    }
    case "block":
      audio.sfx("block");
      arena.particles.burst(ev.x / 1000, ev.y / 1000, 0.25, 10, { colors: [[0.5, 0.8, 1], [1, 1, 1]], life: 0.25, size: 0.07, speed: 2.5, grav: 0 });
      break;
    case "clash":
      audio.sfx("block");
      arena.particles.burst(ev.x / 1000, ev.y / 1000, 0.2, 20, { colors: SPARK, life: 0.4, size: 0.08, speed: 4, grav: 3 });
      break;
    case "move": {
      const heavy = ["round", "hook", "upper", "spin", "fly", "nails", "whip", "sweep", "grab"];
      if (heavy.includes(ev.mv)) audio.sfx("whoosh");
      if (ev.mv === "flash") { setTimeout(() => { flash("on"); audio.sfx("flash"); }, 170); }
      if (ev.mv === "scream" || ev.mv === "vape" || ev.mv === "tiktok") audio.voice("shout_" + CHARS[P(ev.p).ch].id);
      break;
    }
    case "throw":
      audio.sfx(ev.t === "cloud" ? "puff" : "throw");
      if (ev.t !== "chair" && Math.random() < 0.35) audio.voice("shout_" + CHARS[P(ev.p).ch].id);
      break;
    case "super":
      audio.sfx("super");
      audio.voice("keter", { cut: true });
      flash("dark on");
      arena.zoomTarget = { x: P(ev.p).x / 1000, y: 1.1, k: 0.55 };
      setTimeout(() => { arena.zoomTarget = null; }, 900);
      showBanner(`🪑 ${CHARS[P(ev.p).ch].name}: כיסא כתר!`);
      break;
    case "string":
      showBanner(`💥 ${CHARS[P(ev.p).ch].combo}! קומבו מלא`);
      audio.voice("combo");
      break;
    case "jump": audio.sfx("jump"); break;
    case "land": audio.sfx("land", { hard: ev.hard }); if (ev.hard) arena.particles.burst(P(ev.p).x / 1000, 0.1, 0, 12, { colors: [[0.6, 0.55, 0.5]], life: 0.6, size: 0.18, speed: 1.2, grav: -0.5, glow: false, grow: 0.4 }); break;
    case "announce":
      audio.voice(ev.n >= 3 ? "round3" : "round" + ev.n, { cut: true });
      announce(ev.n >= 3 ? "סיבוב אחרון" : `סיבוב ${ev.n === 1 ? "ראשון" : "שני"}`);
      break;
    case "fight":
      audio.voice("fight", { cut: true });
      announce("תילחמי!");
      break;
    case "ko":
      audio.sfx("ko");
      arena.addShake(1.5);
      flash("on");
      if (mode !== "online") match.slow = 45;
      announce("נוק אאוט!", { red: true });
      break;
    case "timeup":
      audio.voice("timeup", { cut: true });
      announce("נגמר הזמן");
      break;
    case "roundwin": {
      setTimeout(() => {
        if (!match) return;
        if (ev.p < 0) { audio.voice("draw", { cut: true }); announce("תיקו"); return; }
        const w = CHARS[P(ev.p).ch];
        audio.voice(P(ev.p).hp === 1000 ? "flawless" : "win_" + w.id, { cut: true });
        announce(P(ev.p).hp === 1000 ? "ניצחון מושלם" : `${w.name} ניצחה`);
      }, 700);
      break;
    }
    case "finish":
      audio.voice("finish", { cut: true });
      announce("תגמרי אותה!", { red: true, hold: true });
      if (s.winner === myIndex() || mode === "local") showBanner("🪑 לחצי כיסא כתר!");
      break;
    case "fatality": {
      const l = P(1 - ev.p);
      audio.voice("chairality", { cut: true });
      hideAnnounce();
      setTimeout(() => { arena.rainChairs(l.x / 1000); audio.sfx("super"); }, 300);
      setTimeout(() => { audio.sfx("chair"); arena.addShake(2); flash("red on"); }, 1300);
      setTimeout(() => announce("כיסאליטי!", { red: true }), 600);
      arena.zoomTarget = { x: l.x / 1000, y: 0.9, k: 0.4 };
      setTimeout(() => { arena.zoomTarget = null; }, 4500);
      break;
    }
    case "matchover":
      hideAnnounce();
      setTimeout(() => endMatch(ev.p, ev.fatality), ev.fatality ? 600 : 2200);
      if (ev.p >= 0 && !ev.fatality) { const w = CHARS[P(ev.p).ch]; audio.voice("win_" + w.id, { cut: true }); announce(`${w.name} ניצחה`); }
      break;
  }
}
function myIndex() { return mode === "online" ? me : 0; }

function endMatch(winner, fatality) {
  if (!match || match.over) return;
  match.over = true;
  const s = simState();
  stopMatch();
  const w = winner >= 0 ? CHARS[s.p[winner].ch] : null;
  $(".res-img").src = w ? `img/p_${w.id}.webp` : `img/p_${CHARS[s.p[0].ch].id}.webp`;
  $(".res-sub").textContent = "";
  let title, line = w ? "“" + w.win + "”" : "";
  if (!w) title = "תיקו!";
  else if (mode === "online") title = winner === me ? "ניצחת! 👑" : `${w.name} ניצחה`;
  else if (mode === "cpu") title = winner === 0 ? "ניצחת! 👑" : `${w.name} ניצחה`;
  else title = `${w.name} ניצחה! (שחקנית ${winner + 1})`;
  if (fatality) title += " · כיסאליטי";
  $(".res-title").textContent = title;
  $(".res-line").textContent = line;
  const again = $(".again");
  again.textContent = "עוד קרב";
  if (mode === "cpu" && ladder) {
    if (winner === 0) {
      ladder.idx += 1;
      if (ladder.idx >= ladder.order.length) {
        $(".res-title").textContent = "👑 אלופת אורטל קומבט! 👑";
        $(".res-sub").textContent = `${CHARS[picks[0]].name} ניצחה את כולן. הכתר שלך.`;
        again.textContent = "מההתחלה";
        ladder = null;
      } else {
        $(".res-sub").textContent = `הבאה בתור: ${CHARS[ladder.order[ladder.idx]].name} (${ladder.idx + 1}/7)`;
        again.textContent = "לקרב הבא";
      }
    } else {
      $(".res-sub").textContent = "לא נורא, עוד ניסיון?";
      again.textContent = "שוב!";
    }
  }
  if (mode === "online" && online) { online.meAgain = false; online.theyAgain = false; }
  show("result");
  if (w) setTimeout(() => audio.voice("win2_" + w.id), 400);
}
$(".again").onclick = () => {
  audio.sfx("select");
  if (mode === "cpu") { if (ladder) nextLadderFight(); else openSelect(); return; }
  if (mode === "online") {
    if (!net) { show("menu"); return; }
    online.meAgain = true;
    net.sendImportant({ t: "again" });
    if (online.theyAgain) openSelect(); else $(".res-sub").textContent = "מחכה שגם היא תרצה…";
    return;
  }
  beginVersus(Math.floor(Math.random() * STAGES.length));
};
$(".menuBtn").onclick = () => { audio.sfx("select"); leaveOnline(); show("menu"); };

// ---------- pause ----------
function togglePause() {
  if (!match || mode === "online") return;
  paused = !paused;
  match.running = !paused;
  if (paused) { show("pause"); $("#hud").hidden = false; } else { show("fight"); }
}
$("#pauseBtn").onclick = togglePause;
$(".resume").onclick = togglePause;
$(".quit").onclick = () => { stopMatch(); show("menu"); };
document.addEventListener("visibilitychange", () => { if (document.hidden && match && mode !== "online" && !paused) togglePause(); });

// ---------- HUD ----------
function setupHudNames() {
  for (let i = 0; i < 2; i++) $(`.s${i} .n`).textContent = CHARS[picks[i]].name;
  const myCh = CHARS[picks[myIndex()]];
  $(".b-item .ico").textContent = myCh.itemIcon;
  for (const c of $$(".combo")) c.classList.remove("on");
  hideAnnounce();
}
function updateHud(s) {
  for (let i = 0; i < 2; i++) {
    const p = s.p[i];
    const side = $(`.s${i}`);
    side.querySelector(".fill").style.width = p.hp / 10 + "%";
    side.querySelector(".trail").style.width = p.hp / 10 + "%";
    side.querySelector(".hp").classList.toggle("low", p.hp < 250);
    side.querySelector(".pips").textContent = "👑".repeat(p.wins);
    const m = $(`.m${i}`);
    m.querySelector("i").style.width = (p.meter / CONST.METER_MAX) * 100 + "%";
    m.classList.toggle("full", p.meter >= CONST.METER_MAX);
  }
  $(".timer").textContent = Math.max(0, Math.ceil(s.timer / 60));
  const mine = s.p[myIndex()];
  $(".b-chair").classList.toggle("ready", mine.meter >= CONST.METER_MAX || (s.phase === "finish" && s.winner === myIndex()));
  for (let i = 0; i < 2; i++) if (match.comboT[i] && performance.now() > match.comboT[i]) { $(`.c${i}`).classList.remove("on"); match.comboT[i] = 0; }
}
function showCombo(i, text) {
  const el = $(`.c${i}`);
  el.textContent = text;
  el.classList.remove("on"); el.offsetWidth; el.classList.add("on");
  if (match) match.comboT[i] = performance.now() + 1100;
}
function announce(text, { red = false, hold = false } = {}) {
  const el = $("#announce");
  el.textContent = text;
  el.className = "";
  el.offsetWidth;
  el.className = (hold ? "hold" : "on") + (red ? " red" : "");
}
function hideAnnounce() { $("#announce").className = ""; }
function showBanner(text) {
  const el = $("#banner");
  el.textContent = text;
  el.classList.remove("on"); el.offsetWidth; el.classList.add("on");
}
function flash(cls) {
  const el = $("#flash");
  el.className = "";
  el.offsetWidth;
  el.className = cls;
}

// ---------- the loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (match && match.running) {
    const rate = match.slow > 0 ? 0.35 : 1;
    acc += dt * rate;
    let n = 0;
    while (acc >= 1 / 60 && n < 6) {
      tick();
      acc -= 1 / 60; n++;
      if (match && match.slow > 0) match.slow--;
      if (!match) break;
    }
    if (n >= 6) acc = 0;
    const s = simState();
    if (s) { if (!NO_DRAW) arena.draw(s, dt); updateHud(s); }
  } else if (current === "select" && showcase) {
    showcase.draw(dt);
  } else if (current === "pause" && match) {
    arena.draw(simState(), 0);
  }
}
requestAnimationFrame(frame);

setupTouch($("#touch"));
show("title");

// testing hooks
window.__ok = { arena, get state() { return simState(); }, get match() { return match; }, get net() { return net; }, picks, show, startMatchDirect: (a, b, m = "cpu", st = 0) => { mode = m; picks[0] = a; picks[1] = b; return Promise.all([arena.setStage(st), arena.setFighters(a, b)]).then(() => startMatch(st)); } };
