"use strict";

const SOLO_ROUNDS = 10;
const ROUND_TIME = 20; // seconds per picture in solo
const SEEN_KEY = "shir-seen";

const $ = (s) => document.querySelector(s);
const songs = window.SONGS || [];
const imgSrc = (s) => `img/s/${s.id}.webp`;

const state = {
  mode: "solo",
  deck: [],
  i: 0,
  score: 0,
  streak: 0,
  hinted: false,
  answered: false,
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

// Songs not shown yet come first, so repeat players keep getting new pictures.
function buildDeck(n) {
  const seen = new Set(store(SEEN_KEY) || []);
  let fresh = songs.filter((s) => !seen.has(s.id));
  if (fresh.length < n) {
    store(SEEN_KEY, []);
    fresh = shuffle(fresh).concat(shuffle(songs.filter((s) => seen.has(s.id))));
    return fresh.slice(0, n);
  }
  return shuffle(fresh).slice(0, n);
}

function markSeen(song) {
  const seen = store(SEEN_KEY) || [];
  if (!seen.includes(song.id)) store(SEEN_KEY, seen.concat(song.id));
}

function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
}

function start(mode) {
  state.mode = mode;
  const n = mode === "solo" ? SOLO_ROUNDS : +$("#party-len").value;
  state.deck = buildDeck(Math.min(n, songs.length));
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
  state.hinted = false;
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
  $("#hint").hidden = true;

  if (state.mode === "solo") {
    $("#hint-btn").hidden = false;
    renderOptions(song);
    startTimer();
  } else {
    $("#party-hint-btn").hidden = false;
  }
}

function renderOptions(song) {
  const others = shuffle(songs.filter((s) => s.id !== song.id && s.title !== song.title)).slice(0, 3);
  const box = $("#options");
  box.innerHTML = "";
  for (const s of shuffle([song, ...others])) {
    const b = document.createElement("button");
    b.innerHTML = `<span></span><small></small>`;
    b.firstChild.textContent = s.title;
    b.lastChild.textContent = s.artist;
    b.onclick = () => answer(s === song, b);
    b.dataset.right = s === song ? "1" : "";
    box.append(b);
  }
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
    if (left <= 0) return answer(false, null);
    state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
}

function timeLeft() {
  return Math.max(0, 1 - (performance.now() - state.timerStart) / (ROUND_TIME * 1000));
}

function showHint() {
  const song = state.deck[state.i];
  const h = $("#hint");
  if (state.mode === "solo") {
    const words = song.line.split(/\s+/);
    h.textContent = `"${words.slice(0, Math.min(2, words.length - 1)).join(" ")}..."`;
    state.hinted = true;
    $("#hint-btn").hidden = true;
  } else {
    h.textContent = `🎙 ${song.artist}`;
    $("#party-hint-btn").hidden = true;
  }
  h.hidden = false;
}

function answer(ok, btn) {
  if (state.answered) return;
  state.answered = true;
  cancelAnimationFrame(state.raf);
  const song = state.deck[state.i];
  const box = $("#options");
  box.querySelectorAll("button").forEach((b) => {
    b.disabled = true;
    if (b.dataset.right) b.classList.add("right");
  });
  let pts = 0;
  if (ok) {
    state.streak++;
    pts = 100 + Math.round(100 * timeLeft());
    if (state.hinted) pts = Math.round(pts / 2);
    if (state.streak >= 3) pts += 50;
    state.score += pts;
    $("#score").classList.remove("bump");
    void $("#score").offsetWidth;
    $("#score").classList.add("bump");
    confetti();
  } else {
    state.streak = 0;
    if (btn) btn.classList.add("wrong");
    box.classList.remove("shake");
    void box.offsetWidth;
    box.classList.add("shake");
  }
  state.results.push({ song, ok, pts });
  markSeen(song);
  renderScore();
  const verdict = ok
    ? (state.streak >= 3 ? `🔥 ${state.streak} ברצף! +${pts}` : `נכון! +${pts}`)
    : (btn ? "לא הפעם" : "נגמר הזמן ⏰");
  setTimeout(() => openReveal(song, verdict, ok), 650);
}

function openReveal(song, verdict, ok) {
  const v = $("#verdict");
  v.textContent = verdict;
  v.className = "verdict " + (verdict ? (ok ? "good" : "bad") : "");
  $("#r-line").textContent = song.line;
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
    li.innerHTML = `<img alt=""><span><b></b><small></small></span><i></i>`;
    li.querySelector("img").src = imgSrc(r.song);
    li.querySelector("b").textContent = r.song.title;
    li.querySelector("small").textContent = `${r.song.artist} · "${r.song.line}"`;
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

$("#pool-count").textContent = songs.length;
document.querySelector('[data-mode="solo"]').onclick = () => start("solo");
document.querySelector('[data-mode="party"]').onclick = () => show("teams");
$("#party-go").onclick = () => start("party");
document.querySelectorAll("[data-home]").forEach((b) => (b.onclick = home));
$("#hint-btn").onclick = showHint;
$("#party-hint-btn").onclick = showHint;
$("#reveal-btn").onclick = () => openReveal(state.deck[state.i], "", false);
$("#next-btn").onclick = next;
$("#who").querySelectorAll("button").forEach((b) => {
  b.onclick = () => { b.classList.add("picked"); partyPick(+b.dataset.who); };
});
$("#again-btn").onclick = () => (state.mode === "solo" ? start("solo") : show("teams"));
$("#share-btn").onclick = share;
