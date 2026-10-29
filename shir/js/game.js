"use strict";

const SOLO_ROUNDS = 10;
const ROUND_TIME = 60; // seconds per picture in solo
const LETTER_COST = 0.15; // share of the round's points each revealed letter costs
const ARTIST_COST = 0.4;
const MIN_SHARE = 0.2; // a right answer keeps at least this share, however many hints
const SEEN_KEY = "shir-seen";
const LANG_KEY = "shir-lang";

const KEYBOARDS = {
  he: ["קראטוןםפ", "שדגכעיחלךף", "זסבהנמצתץ"],
  en: ["qwertyuiop", "asdfghjkl", "zxcvbnm"],
};
// Final letters count as their regular form, so ם and מ are the same answer.
const FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

const $ = (s) => document.querySelector(s);
const allSongs = window.SONGS || [];
const imgSrc = (s) => `img/s/${s.id}.webp`;
const langOf = (s) => s.lang || "he";
// The keyboard follows the title's letters: "Kawaii" is on the Hebrew list but typed in English.
// What the player types: `answer` drops a long bracketed tail, e.g. "A Bar Song" for "A Bar Song (Tipsy)".
const answerOf = (s) => s.answer || s.title;
const typedIn = (s) => (/[\u0590-\u05FF]/.test(s.title) ? "he" : "en");
const fold = (ch) => FINALS[ch] || ch.toLowerCase();

const state = {
  mode: "solo",
  lang: "all", // which songs: "he", "en" or "all"
  deck: [],
  i: 0,
  score: 0,
  streak: 0,
  answered: false,
  slots: [], // the title, one entry per character: { ch, typable, locked, typed }
  newest: -1, // the slot revealed last, which pops in
  penalty: 0, // share of points lost to hints this round
  artistShown: false,
  results: [], // { song, ok, pts }
  teams: ["", ""],
  teamScore: [0, 0],
  timerStart: 0,
  raf: 0,
};

function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(val));
  } catch { return null; }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pool() {
  return state.lang === "all" ? allSongs : allSongs.filter((s) => langOf(s) === state.lang);
}

// Songs not shown yet come first, so repeat players keep getting new pictures.
function buildDeck(n) {
  const songs = pool();
  const seen = new Set(store(SEEN_KEY) || []);
  const fresh = shuffle(songs.filter((s) => !seen.has(s.id)));
  if (fresh.length >= n) return fresh.slice(0, n);
  const used = songs.filter((s) => seen.has(s.id));
  store(SEEN_KEY, [...seen].filter((id) => !used.some((s) => s.id === id)));
  return fresh.concat(shuffle(used)).slice(0, n);
}

function markSeen(song) {
  const seen = store(SEEN_KEY) || [];
  if (!seen.includes(song.id)) store(SEEN_KEY, seen.concat(song.id));
}

function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
}

function setLang(lang) {
  state.lang = lang;
  store(LANG_KEY, lang);
  document.querySelectorAll("[data-lang]").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));
  $("#pool-count").textContent = pool().length;
}

function start(mode) {
  if (!pool().length) return;
  state.mode = mode;
  const n = mode === "solo" ? SOLO_ROUNDS : +$("#party-len").value;
  state.deck = buildDeck(Math.min(n, pool().length));
  state.i = 0;
  state.score = 0;
  state.streak = 0;
  state.results = [];
  state.teamScore = [0, 0];
  state.teams = [$("#team0").value.trim() || "קבוצה 1", $("#team1").value.trim() || "קבוצה 2"];
  state.deck.forEach((s) => { new Image().src = imgSrc(s); });
  $("#play").classList.toggle("party", mode === "party");
  show("play");
  round();
}

function round() {
  const song = state.deck[state.i];
  const keys = KEYBOARDS[typedIn(song)].join("");
  state.slots = [...answerOf(song)].map((ch) => {
    const typable = keys.includes(fold(ch)) || keys.includes(ch);
    // Digits and punctuation are given; only letters on the keyboard are typed.
    return { ch, typable, locked: !typable, typed: "" };
  });
  state.newest = -1;
  state.penalty = 0;
  state.artistShown = false;
  state.answered = false;
  $("#round-n").textContent = `תמונה ${state.i + 1} מתוך ${state.deck.length}`;
  renderScore();

  const img = $("#pic-img");
  const pic = $("#pic");
  img.classList.remove("in");
  pic.classList.remove("missing");
  img.onload = () => img.classList.add("in");
  img.onerror = () => pic.classList.add("missing");
  img.src = imgSrc(song);

  renderKeyboard(typedIn(song));
  renderClues();
  if (state.mode === "solo") startTimer();
}

function renderScore() {
  if (state.mode === "solo") {
    $("#score").textContent = state.score;
  } else {
    $("#score").textContent = "";
    $("#party-score").innerHTML = state.teams
      .map((t, k) => `<div><b>${state.teamScore[k]}</b><span></span></div>`)
      .join("");
    $("#party-score").querySelectorAll("span").forEach((el, k) => { el.textContent = state.teams[k]; });
  }
}

function startTimer() {
  cancelAnimationFrame(state.raf);
  state.timerStart = performance.now();
  const bar = $("#timer i");
  const tick = (now) => {
    const left = Math.max(0, 1 - (now - state.timerStart) / (ROUND_TIME * 1000));
    bar.style.transform = `scaleX(${left})`;
    if (left <= 0) return answer(false, "time");
    state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
}

function timeLeft() {
  return Math.max(0, 1 - (performance.now() - state.timerStart) / (ROUND_TIME * 1000));
}

/* Typing */

function renderKeyboard(lang) {
  const kbd = $("#kbd");
  if (kbd.dataset.lang === lang) return;
  kbd.dataset.lang = lang;
  kbd.dir = lang === "he" ? "rtl" : "ltr";
  kbd.innerHTML = "";
  KEYBOARDS[lang].forEach((row, r) => {
    const line = document.createElement("div");
    for (const ch of row) {
      const b = document.createElement("button");
      b.textContent = ch;
      b.dataset.key = ch;
      line.append(b);
    }
    if (r === KEYBOARDS[lang].length - 1) {
      const del = document.createElement("button");
      del.className = "del";
      del.dataset.key = "Backspace";
      del.setAttribute("aria-label", "מחיקה");
      del.textContent = "⌫";
      line.append(del);
    }
    kbd.append(line);
  });
}

function typeKey(key) {
  if (state.mode !== "solo" || state.answered) return;
  if (key === "Backspace") {
    const last = state.slots.findLastIndex((s) => !s.locked && s.typed);
    if (last >= 0) state.slots[last].typed = "";
  } else {
    const next = state.slots.find((s) => !s.locked && !s.typed);
    if (!next) return;
    next.typed = key;
  }
  state.newest = -1;
  renderClues();
  const open = state.slots.filter((s) => !s.locked);
  if (open.length && open.every((s) => s.typed)) check();
}

function check() {
  const right = state.slots.every((s) => s.locked || fold(s.typed) === fold(s.ch));
  if (right) return answer(true);
  const tiles = $("#tiles");
  tiles.classList.remove("shake", "wrong");
  void tiles.offsetWidth;
  tiles.classList.add("shake", "wrong");
  setTimeout(() => {
    if (state.answered) return;
    state.slots.forEach((s) => { if (!s.locked) s.typed = ""; });
    tiles.classList.remove("wrong");
    renderClues();
  }, 600);
}

/* Hints */

function hiddenSlots() {
  return state.slots.flatMap((s, k) => (s.typable && !s.locked ? [k] : []));
}

// One more letter of the title, at random. The last letter always stays hidden.
function revealLetter() {
  const left = hiddenSlots();
  if (state.answered || left.length <= 1) return;
  state.newest = left[Math.floor(Math.random() * left.length)];
  const slot = state.slots[state.newest];
  slot.locked = true;
  slot.typed = "";
  state.penalty += LETTER_COST;
  renderClues();
  const open = state.slots.filter((s) => !s.locked);
  if (state.mode === "solo" && open.every((s) => s.typed)) check();
}

function revealArtist() {
  if (state.answered || state.artistShown) return;
  state.artistShown = true;
  state.penalty += ARTIST_COST;
  renderClues();
}

function renderClues() {
  const song = state.deck[state.i];
  $("#clue-artist").hidden = !state.artistShown;
  $("#clue-artist").textContent = `🎙 ${song.artist}`;
  const solo = state.mode === "solo";
  const anyShown = state.slots.some((s) => s.typable && s.locked);
  const tiles = $("#tiles");
  // In party mode the blanks appear once someone asks for a letter.
  tiles.hidden = !solo && !anyShown;
  tiles.dir = typedIn(song) === "he" ? "rtl" : "ltr";
  tiles.innerHTML = "";
  const cursor = solo ? state.slots.findIndex((s) => !s.locked && !s.typed) : -1;
  let word = null;
  state.slots.forEach((s, k) => {
    if (s.ch === " ") { word = null; return; }
    if (!word) {
      word = document.createElement("span");
      word.className = "word";
      tiles.append(word);
    }
    const t = document.createElement("i");
    if (!s.typable) { t.className = "mark"; t.textContent = s.ch; }
    else if (s.locked) { t.className = k === state.newest ? "on new" : "on"; t.textContent = s.ch; }
    else if (s.typed) { t.className = "typed"; t.textContent = s.typed; }
    else if (k === cursor) t.className = "cursor";
    word.append(t);
  });
  $("#letter-btn").disabled = hiddenSlots().length <= 1;
  $("#artist-btn").disabled = state.artistShown;
}

/* Rounds */

function answer(ok, why) {
  if (state.answered) return;
  state.answered = true;
  cancelAnimationFrame(state.raf);
  const song = state.deck[state.i];
  let pts = 0;
  if (ok) {
    state.streak++;
    pts = 100 + Math.round(100 * timeLeft());
    pts = Math.round(pts * Math.max(MIN_SHARE, 1 - state.penalty));
    if (state.streak >= 3) pts += 50;
    state.score += pts;
    $("#score").classList.remove("bump");
    void $("#score").offsetWidth;
    $("#score").classList.add("bump");
    $("#tiles").classList.add("right");
    confetti();
  } else {
    state.streak = 0;
  }
  state.results.push({ song, ok, pts });
  markSeen(song);
  renderScore();
  const verdict = ok
    ? (state.streak >= 3 ? `🔥 ${state.streak} ברצף! +${pts}` : `נכון! +${pts}`)
    : (why === "time" ? "נגמר הזמן ⏰" : "לא נורא, הבא בתור");
  setTimeout(() => openReveal(song, verdict, ok), ok ? 700 : 300);
}

function openReveal(song, verdict, ok) {
  const v = $("#verdict");
  v.textContent = verdict;
  v.className = "verdict " + (verdict ? (ok ? "good" : "bad") : "");
  $("#r-line").textContent = song.line || "";
  $("#r-line").hidden = !song.line;
  $("#r-title").textContent = song.title;
  $("#r-artist").textContent = song.artist;
  $("#r-yt").href = "https://www.youtube.com/results?search_query=" + encodeURIComponent(`${song.title} ${song.artist}`);
  const party = state.mode === "party";
  $("#who").hidden = !party;
  $("#next-btn").hidden = party;
  if (party) {
    const btns = $("#who").querySelectorAll("button");
    btns[0].textContent = state.teams[0];
    btns[1].textContent = state.teams[1];
    btns.forEach((b) => b.classList.remove("picked"));
  }
  $("#reveal").hidden = false;
}

function next() {
  $("#reveal").hidden = true;
  $("#tiles").classList.remove("right");
  state.i++;
  if (state.i >= state.deck.length) end();
  else round();
}

function partyPick(who) {
  const song = state.deck[state.i];
  if (who >= 0) {
    state.teamScore[who]++;
    confetti();
  }
  state.results.push({ song, ok: who >= 0, who });
  markSeen(song);
  renderScore();
  setTimeout(next, who >= 0 ? 450 : 0);
}

function rank(ratio) {
  if (ratio >= 1) return "מלכות המצעד 👑";
  if (ratio >= .8) return "גלגלצ מהלך";
  if (ratio >= .6) return "כוכב קריוקי";
  if (ratio >= .4) return "שר רק בחתונות";
  if (ratio >= .2) return "שומע רדיו רק במוניות";
  return "מישהו פה גר במערה?";
}

function end() {
  const hits = state.results.filter((r) => r.ok).length;
  const total = state.results.length;
  if (state.mode === "solo") {
    $("#end-title").textContent = rank(hits / total);
    $("#end-score").textContent = `${state.score} נקודות`;
    $("#end-sub").textContent = `זיהית ${hits} מתוך ${total} שירים`;
    const best = store("shir-best") || 0;
    if (state.score > best) {
      store("shir-best", state.score);
      if (best) $("#end-sub").textContent += " · שיא חדש!";
    } else {
      $("#end-sub").textContent += ` · השיא שלך: ${best}`;
    }
  } else {
    const [a, b] = state.teamScore;
    $("#end-title").textContent = a === b ? "תיקו!" : `${state.teams[a > b ? 0 : 1]} ניצחו!`;
    $("#end-score").textContent = `${state.teams[0]} ${a} : ${b} ${state.teams[1]}`;
    $("#end-sub").textContent = `${total} תמונות, ${total - hits} שאף אחד לא זיהה`;
  }
  const ol = $("#recap");
  ol.innerHTML = "";
  for (const r of state.results) {
    const li = document.createElement("li");
    li.innerHTML = `<img alt=""><span><b dir="auto"></b><small dir="auto"></small></span><i></i>`;
    li.querySelector("img").src = imgSrc(r.song);
    li.querySelector("b").textContent = r.song.title;
    li.querySelector("small").textContent = r.song.artist;
    li.querySelector("i").textContent = r.ok ? "✅" : "❌";
    ol.append(li);
  }
  show("end");
}

function share() {
  const url = "https://tomerzor.github.io/TOMERZOR/shir/";
  const text = state.mode === "solo"
    ? `זיהיתי ${state.results.filter((r) => r.ok).length}/${state.results.length} שירים מתוך תמונות (${state.score} נקודות) 🎤 בואו לנסות לנצח אותי:`
    : `${$("#end-title").textContent} ${$("#end-score").textContent} 🎤 נחש את השיר:`;
  if (navigator.share) {
    navigator.share({ title: "נחש את השיר", text, url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(`${text} ${url}`);
    $("#share-btn b").textContent = "הקישור הועתק";
  }
}

function confetti() {
  const bits = ["🎵", "🎶", "✨", "🎤", "⭐"];
  for (let k = 0; k < 14; k++) {
    const el = document.createElement("span");
    el.className = "confetti";
    el.textContent = bits[k % bits.length];
    el.style.left = Math.random() * 100 + "vw";
    el.style.animationDelay = Math.random() * .3 + "s";
    document.body.append(el);
    setTimeout(() => el.remove(), 1900);
  }
}

function home() {
  cancelAnimationFrame(state.raf);
  $("#reveal").hidden = true;
  $("#share-btn b").textContent = "לשתף";
  show("home");
}

setLang(store(LANG_KEY) || "all");
document.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => setLang(b.dataset.lang)));
document.querySelector('[data-mode="solo"]').onclick = () => start("solo");
document.querySelector('[data-mode="party"]').onclick = () => show("teams");
$("#party-go").onclick = () => start("party");
document.querySelectorAll("[data-home]").forEach((b) => (b.onclick = home));
$("#letter-btn").onclick = revealLetter;
$("#artist-btn").onclick = revealArtist;
$("#skip-btn").onclick = () => answer(false, "skip");
$("#kbd").onclick = (e) => { const k = e.target.closest("[data-key]"); if (k) typeKey(k.dataset.key); };
document.addEventListener("keydown", (e) => {
  if (!$("#play").classList.contains("active") || !$("#reveal").hidden || e.ctrlKey || e.metaKey) return;
  const song = state.deck[state.i];
  if (e.key === "Backspace") return typeKey("Backspace");
  if (song && KEYBOARDS[typedIn(song)].join("").includes(e.key.toLowerCase())) typeKey(e.key.toLowerCase());
});
$("#reveal-btn").onclick = () => openReveal(state.deck[state.i], "", false);
$("#next-btn").onclick = next;
$("#who").querySelectorAll("button").forEach((b) => {
  b.onclick = () => { b.classList.add("picked"); partyPick(+b.dataset.who); };
});
$("#again-btn").onclick = () => (state.mode === "solo" ? start("solo") : show("teams"));
$("#share-btn").onclick = share;
