// The game screens: a menu, solo (a streak with 3 lives), two players on one phone,
// and two phones in a room on the server. All of them draw the same card.

import { Match, WIN_SCORE, SOLO_LIVES, rng, shuffledIds, makeThreshold, isCorrect, thresholdLabel, factFor } from "./core/game.js";
import { STR, fmt, esc } from "./i18n.js";
import { icon } from "./icons.js";
import { roll, stopRoll } from "./roll.js";
import * as sound from "./sound.js";
import * as motion from "./motion.js";

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

function pid() {
  let id = store.get("odds:pid");
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    store.set("odds:pid", id);
  }
  return id;
}

export function initGame(root, { apiBase = "", shareLink, lang = "he", onRoom = () => {} }) {
  let L = lang;
  let screen = "menu"; // menu | pass-setup | online-setup | lobby | play
  let mode = null; // solo | pass | online
  let match = null; // pass and play
  let solo = null;
  let net = null; // online connection
  let joinCode = "";
  let error = "";
  let anim = { key: null, done: true }; // the reveal roll for the current card
  let lastCardKey = null;
  let lastPhase = null;
  let lastTurn = null;
  let lastScores = null;
  let deferred = false;
  let tapPoint = null; // where the last choice was touched, for the colour mask

  const t = (k, v) => fmt(L, k, v);
  const s = () => STR[L];

  // ---------- solo ----------
  function newSolo() {
    const rand = rng((Math.random() * 2 ** 31) >>> 0);
    solo = { rand, deck: shuffledIds(rand), i: -1, lives: SOLO_LIVES, score: 0, best: Number(store.get("odds:best") || 0), round: 0 };
    nextSolo();
  }
  function nextSolo() {
    solo.i = (solo.i + 1) % solo.deck.length;
    const id = solo.deck[solo.i];
    solo.card = { id, t: makeThreshold(factFor(id).p, solo.rand) };
    solo.phase = "guess";
    solo.guess = null;
    solo.result = null;
    solo.round++;
  }

  // ---------- online ----------
  function connect(code, name) {
    const wsBase = (apiBase || location.origin).replace(/^http/, "ws");
    const url = `${wsBase}/api/room/${code}/ws`;
    let ws = null;
    let tries = 0;
    let closedByUs = false;
    let ping = null;
    net = {
      code, state: null, connected: false, offset: 0,
      send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); },
      close() { closedByUs = true; clearInterval(ping); try { ws && ws.close(); } catch { /* already closed */ } },
    };
    const me = net;
    function open() {
      try { ws = new WebSocket(url); } catch { error = s().noRoom; render(); return; }
      ws.onopen = () => {
        tries = 0;
        me.connected = true;
        ws.send(JSON.stringify({ t: "join", pid: pid(), name }));
        clearInterval(ping);
        ping = setInterval(() => me.send({ t: "ping" }), 20000);
        render();
      };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === "state") {
          me.state = m;
          me.offset = m.now - Date.now();
          if (m.match && screen === "lobby") screen = "play";
          render();
        } else if (m.t === "full") {
          error = s().full;
          leave();
        }
      };
      ws.onclose = () => {
        me.connected = false;
        clearInterval(ping);
        if (closedByUs || net !== me) return;
        tries++;
        if (tries > 6 && !me.state) { error = s().noRoom; leave(); return; }
        setTimeout(() => { if (net === me && !closedByUs) open(); }, Math.min(8000, 400 * 2 ** tries));
        render();
      };
    }
    open();
  }

  async function createRoom(name) {
    error = "";
    try {
      const res = await fetch(`${apiBase}/api/room`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { code } = await res.json();
      enterRoom(code, name);
    } catch {
      error = s().noRoom;
      render();
    }
  }

  function enterRoom(code, name) {
    store.set("odds:name", name);
    mode = "online";
    screen = "lobby";
    onRoom(code);
    connect(code, name);
    render();
  }

  function leave() {
    if (net) net.close();
    net = null;
    match = null;
    solo = null;
    mode = null;
    screen = "menu";
    stopRoll();
    anim = { key: null, done: true };
    lastCardKey = null;
    lastScores = null;
    onRoom(null);
    render();
  }

  // ---------- the current view, whatever the mode ----------
  function view() {
    if (mode === "pass" && match) return { ...match.view(), me: null };
    if (mode === "online" && net && net.state && net.state.match) {
      const v = net.state.match;
      const seats = net.state.seats || [];
      v.players.forEach((p, i) => { p.connected = seats[i] ? seats[i].connected : false; });
      return { ...v, me: net.state.you };
    }
    return null;
  }

  // ---------- rendering ----------
  function render() {
    if (!anim.done) { deferred = true; return; }
    root.lang = L;
    if (screen === "menu") return paintScreen(menuHtml());
    if (screen === "pass-setup") return paintScreen(passSetupHtml());
    if (screen === "online-setup") return paintScreen(onlineSetupHtml());
    if (screen === "lobby") return paintScreen(lobbyHtml());
    if (mode === "solo") return renderCard(soloModel());
    const v = view();
    if (!v) return paintScreen(lobbyHtml());
    renderCard(duoModel(v));
  }

  let lastScreenHtmlKey = null;
  function paintScreen(html) {
    const key = screen;
    root.innerHTML = html;
    lastCardKey = null;
    if (key !== lastScreenHtmlKey) {
      // rows of a new screen settle in, 30ms apart
      motion.stagger(root.querySelectorAll(".g-title, .g-sub, .g-option, .g-field, .g-form > .btn, .g-rules, .lobby > *, .g-back"));
    }
    lastScreenHtmlKey = key;
  }

  const headName = (act) => `style="view-transition-name: g-head-${act}"`;

  function menuHtml() {
    const opt = (act, ic, title, sub) => `
      <button class="g-option" type="button" data-act="${act}">${icon(ic)}<span><b ${act !== "solo" ? headName(act) : ""}>${title}</b><small>${sub}</small></span>${icon("arrow-right", "icon flip go")}</button>`;
    return `
      <h1 class="g-title">${s().gTitle}</h1>
      <p class="g-sub">${s().gSub}</p>
      <div class="g-options">
        ${opt("solo", "user", s().solo, s().soloSub)}
        ${opt("pass-setup", "device-mobile", s().pass, s().passSub)}
        ${opt("online-setup", "link", s().online, s().onlineSub)}
      </div>
      <p class="g-rules">${s().rules}</p>
      ${error ? `<p class="g-error">${esc(error)}</p>` : ""}`;
  }

  function passSetupHtml() {
    const [a, b] = JSON.parse(store.get("odds:names") || "[]");
    return `
      <h1 class="g-title" ${headName("pass-setup")}>${s().pass}</h1>
      <form class="g-form" data-form="pass">
        <div class="g-field"><label for="n1">${s().p1}</label><input class="g-input" id="n1" name="n1" maxlength="20" value="${esc(a || "")}" placeholder="${s().p1}"></div>
        <div class="g-field"><label for="n2">${s().p2}</label><input class="g-input" id="n2" name="n2" maxlength="20" value="${esc(b || "")}" placeholder="${s().p2}"></div>
        <button class="btn" type="submit">${s().start}</button>
      </form>
      <div class="g-back"><button class="textbtn" type="button" data-act="menu">${icon("arrow-left", "icon flip")}${s().back}</button></div>`;
  }

  function onlineSetupHtml() {
    const name = esc(store.get("odds:name") || "");
    const joining = Boolean(joinCode);
    return `
      <h1 class="g-title" ${headName("online-setup")}>${s().online}</h1>
      <form class="g-form" data-form="online">
        <div class="g-field"><label for="nm">${s().yourName}</label><input class="g-input" id="nm" name="nm" maxlength="20" value="${name}" required autocomplete="nickname"></div>
        ${joining ? "" : `<button class="btn" type="submit" name="act" value="create">${s().create}</button>`}
        <div class="g-field" style="margin-top:${joining ? 0 : 12}px">
          <label for="code">${joining ? s().code : s().haveCode}</label>
          <input class="g-input" id="code" name="code" maxlength="4" value="${esc(joinCode)}" placeholder="ABCD" autocapitalize="characters" autocomplete="off" spellcheck="false" style="direction:ltr" aria-describedby="code-hint">
          <span class="g-hint" id="code-hint">${s().badCode}</span>
        </div>
        <button class="btn ${joining ? "" : "btn--quiet"}" type="submit" name="act" value="join">${s().join}</button>
      </form>
      ${error ? `<p class="g-error">${esc(error)}</p>` : ""}
      <div class="g-back"><button class="textbtn" type="button" data-act="menu">${icon("arrow-left", "icon flip")}${s().back}</button></div>`;
  }

  function lobbyHtml() {
    const code = net ? net.code : "";
    return `
      <h1 class="g-title">${s().online}</h1>
      <div class="lobby">
        <p>${s().invite}</p>
        <div class="lobby__code">${esc(code)}</div>
        <button class="btn" type="button" data-act="invite">${icon("share-network")}<span>${s().shareLink}</span></button>
        <p class="thinking"><span>${s().waiting}</span><span class="thinking__dots" aria-hidden="true"><i></i><i></i><i></i></span></p>
      </div>
      ${error ? `<p class="g-error">${esc(error)}</p>` : ""}
      <div class="g-back"><button class="textbtn" type="button" data-act="exit">${icon("arrow-left", "icon flip")}${s().back}</button></div>`;
  }

  function soloModel() {
    return {
      kind: "solo", key: `solo:${solo.round}:${solo.card.id}`, card: solo.card, phase: solo.phase, guess: solo.guess,
      result: solo.result, canGuess: solo.phase === "guess", turnText: "", scores: [solo.score],
    };
  }

  function duoModel(v) {
    const names = v.players.map((p, i) => p.name || (i === 0 ? s().p1 : s().p2));
    const active = names[v.turn];
    const other = names[1 - v.turn];
    const online = v.me != null;
    let turnText;
    if (online) turnText = v.me === v.turn ? s().yourTurn : t("theirTurn", { name: esc(active) });
    else turnText = t("turnOf", { name: esc(active) });
    return {
      kind: online ? "online" : "pass", key: `duo:${v.round}:${v.card.id}`, v, names, active, other, online,
      card: v.card, phase: v.phase, guess: v.guess, result: v.result, turnText,
      canGuess: v.phase === "guess" && (!online || v.me === v.turn),
      canChallenge: v.phase === "challenge" && (!online || v.me !== v.turn),
      scores: v.players.map((p) => p.score),
    };
  }

  function scoreHtml(m) {
    if (m.kind === "solo") {
      const lives = Array.from({ length: SOLO_LIVES }, (_, i) => `<i class="${i < solo.lives ? "" : "lost"}"></i>`).join("");
      return `<div class="score"><span class="score__p is-turn"><span class="score__n" data-score="0">${solo.score}</span><span>${s().streak}</span></span><span class="lives" aria-label="${solo.lives}/${SOLO_LIVES}">${lives}</span></div>`;
    }
    const seat = (p, i) => {
      const off = m.online && p.connected === false ? `<span class="score__off">offline</span>` : "";
      return `<span class="score__p ${m.v.turn === i && m.phase !== "over" ? "is-turn" : ""}"><span class="score__name">${esc(m.names[i])}</span><span class="score__n" data-score="${i}">${p.score}</span>${off}</span>`;
    };
    return `<div class="score">${m.v.players.map(seat).join("")}</div>`;
  }

  function verdictHtml(m) {
    const r = m.result;
    if (m.kind === "solo") return `<p class="verdict ${r.correct ? "verdict--good" : "verdict--bad"}">${r.correct ? s().right : s().wrong}</p>`;
    const challenged = m.v.challenged;
    let text;
    if (r.correct) text = t(challenged ? "rightBeatChallenge" : "rightPoint", { name: esc(m.active) });
    else text = challenged ? t("stolen", { name: esc(m.other) }) : s().wrongNone;
    return `<p class="verdict ${r.correct || challenged ? "verdict--good" : "verdict--bad"}">${text}</p>`;
  }

  function overHtml(m) {
    if (m.kind === "solo") {
      const isBest = solo.score > 0 && solo.score >= solo.best;
      return `<div class="over">
        <h2>${s().soloOver}</h2>
        <div class="final">${t("soloScore", { n: solo.score })}</div>
        <p class="g-sub">${isBest ? s().newBest : t("best", { n: solo.best })}</p>
        <div class="g-next"><button class="btn" type="button" data-act="solo">${s().playAgain}</button><button class="btn btn--quiet" type="button" data-act="exit">${s().exit}</button></div>
      </div>`;
    }
    const v = m.v;
    const title = m.online ? (v.winner === v.me ? s().youWin : s().youLose) : t("wins", { name: esc(m.names[v.winner]) });
    return `<div class="over">
      <h2>${title}</h2>
      <div class="final">${v.players[0].score} : ${v.players[1].score}</div>
      <div class="g-next"><button class="btn" type="button" data-act="rematch">${s().rematch}</button><button class="btn btn--quiet" type="button" data-act="exit">${s().exit}</button></div>
    </div>`;
  }

  function cardHtml(m, fact, settled) {
    const revealing = m.phase === "reveal" || m.phase === "over";
    const picked = (dir) => (m.guess === dir ? "is-picked" : m.guess ? "is-dim" : "");
    const dis = m.canGuess ? "" : "disabled";
    const choice = (dir, ic, label) => `<button class="choice ${picked(dir)}" type="button" data-act="${dir}" ${dis}>${m.guess === dir ? `<span class="choice__fill"></span>` : ""}<span class="choice__label">${icon(ic)}${label}</span></button>`;

    let challenge = "";
    if (m.phase === "challenge") {
      const dirText = m.guess === "up" ? s().higher : s().lower;
      const other = m.v.players[1 - m.v.turn];
      const timer = m.online ? `<div class="timer" id="g-timer"></div>` : "";
      challenge = m.canChallenge
        ? `<div class="challenge" id="g-challenge">
            <p>${t("picked", { name: esc(m.active), dir: dirText })}. ${t("challengeAsk", { name: esc(m.other) })}</p>
            <div class="row"><button class="btn btn--accent" type="button" data-act="challenge">${t("challengeBtn", { n: other.tokens })}</button><button class="btn btn--quiet" type="button" data-act="no-challenge">${s().noChallenge}</button></div>
            ${timer}
          </div>`
        : `<div class="challenge" id="g-challenge"><p>${t("waitChallenge", { name: esc(m.other) })}</p>${timer}</div>`;
    }

    const reveal = revealing ? `
      <p class="odds" id="g-odds"><span class="odds__pre" id="g-pre"></span><span class="odds__num" id="g-num"></span></p>
      <p class="odds__alt" id="g-alt"></p>
      <div id="g-after" ${settled ? "" : "hidden"}>
        ${verdictHtml(m)}
        <p class="card__x">${esc(fact[L].x)}</p>
        <p class="card__src">${esc(s().source + fact.src)}</p>
        ${m.phase === "reveal" ? `<div class="g-next"><button class="btn" type="button" data-act="next">${s().next}</button></div>` : ""}
      </div>` : "";

    const q = L === "he" ? `${s().prefix}${fact[L].q}` : `${s().prefix} ${fact[L].q}`;
    return `
      <article class="card" id="g-card" lang="${L}">
        <p class="card__q">${esc(q)}?</p>
        <p class="card__t">${s().vs} <bdi>${esc(thresholdLabel(m.card.t, L))}</bdi></p>
        <div class="choices">
          ${choice("up", "arrow-up", s().higher)}
          ${choice("down", "arrow-down", s().lower)}
        </div>
        ${challenge}
        ${reveal}
      </article>`;
  }

  function renderCard(m) {
    const fact = factFor(m.card.id);
    const revealing = m.phase === "reveal" || m.phase === "over";
    const isNew = m.key !== lastCardKey;
    const needsRoll = revealing && anim.key !== m.key;
    const settled = revealing && !needsRoll;
    const phaseChanged = !isNew && m.phase !== lastPhase;

    const html = `
      ${scoreHtml(m)}
      <p class="turn" id="g-turn">${m.phase === "over" ? "" : m.turnText}</p>
      ${cardHtml(m, fact, settled)}
      ${m.phase === "over" && settled ? overHtml(m) : ""}
      <div class="g-back"><button class="textbtn" type="button" data-act="exit">${icon("arrow-left", "icon flip")}${s().exit}</button></div>`;

    const oldCard = root.querySelector("#g-card");
    if (isNew && oldCard && lastCardKey) {
      // the old card fades out on top while the new one comes in: the states overlap
      motion.overlapSwap(oldCard, () => { root.innerHTML = html; });
      motion.enterFrom(root.querySelector("#g-card"), { dy: 10 });
    } else {
      root.innerHTML = html;
      if (isNew) motion.stagger(root.querySelectorAll(".score, .turn, #g-card"));
    }
    lastScreenHtmlKey = "play";

    if (isNew && lastCardKey && m.kind !== "solo" && lastTurn !== m.v.turn) sound.turnChange();

    // the picked choice fills with colour from where it was touched
    if (phaseChanged && m.guess && (lastPhase === "guess")) {
      const fill = root.querySelector(".choice.is-picked .choice__fill");
      if (fill) motion.maskFrom(fill, tapPoint ? tapPoint.x : null, tapPoint ? tapPoint.y : null);
      tapPoint = null;
    }

    // the challenge question is a popover from the choices above it
    if (m.phase === "challenge" && (phaseChanged || isNew)) motion.popIn(root.querySelector("#g-challenge"), "top");

    lastCardKey = m.key;
    lastPhase = m.phase;
    if (m.v) lastTurn = m.v.turn;
    lastScores = m.scores.slice();

    // challenge countdown (online)
    const timer = root.querySelector("#g-timer");
    if (timer && net && net.state && net.state.challengeEndsAt) {
      const left = Math.max(0, net.state.challengeEndsAt - (Date.now() + net.offset));
      timer.animate([{ transform: `scaleX(${left / 9000})` }, { transform: "scaleX(0)" }], { duration: left, fill: "forwards", easing: "linear" });
    }

    if (!revealing) return;
    const els = { pre: root.querySelector("#g-pre"), num: root.querySelector("#g-num"), alt: root.querySelector("#g-alt") };
    if (settled) {
      roll(els, fact.p, L, { duration: 0, silent: true });
      return;
    }
    anim = { key: m.key, done: false };
    const key = m.key;
    motion.enterFrom(root.querySelector("#g-odds"), { dy: -8 });
    roll(els, fact.p, L, { duration: 2300 }).then(() => {
      if (anim.key !== key) return; // left the game while it rolled
      anim.done = true;
      const after = root.querySelector("#g-after");
      if (after) {
        after.hidden = false;
        // the verdict's colour is revealed by a mask, then the details settle 30ms apart
        motion.wipeIn(after.querySelector(".verdict"));
        motion.stagger([...after.children].slice(1), { delay: 60 });
      }
      let good;
      let scorer = null;
      if (m.kind === "solo") { good = m.result.correct; scorer = good ? 0 : null; }
      else {
        scorer = m.result.scorer;
        good = m.online ? scorer === m.v.me : scorer != null;
      }
      (good ? sound.correct : sound.wrong)();
      // a point travels on an arc from the answer to the score, which pulses to confirm
      if (scorer != null) {
        const target = root.querySelector(`[data-score="${scorer}"]`);
        const from = root.querySelector("#g-num");
        motion.arc(from, target).then(() => motion.pulse(target));
      }
      if (deferred || m.phase === "over") {
        deferred = false;
        render();
        const over = root.querySelector(".over");
        if (over) motion.stagger(over.children, { delay: 500 });
      }
      const next = root.querySelector('[data-act="next"], [data-act="rematch"], [data-act="solo"]');
      if (next) next.focus({ preventScroll: true });
    });
  }

  // a menu row grows into the heading of the screen it opens (shared element)
  function go(next, update) {
    motion.morph(() => { update(); render(); });
    void next;
  }

  // ---------- input ----------
  root.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".choice");
    if (b) tapPoint = { x: e.clientX, y: e.clientY };
  });

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    sound.unlock();
    const act = b.dataset.act;
    error = act === "menu" ? "" : error;
    if (act === "menu") { go("menu", () => { screen = "menu"; joinCode = ""; }); return; }
    if (act === "exit") { leave(); return; }
    if (act === "solo") { sound.tap(); mode = "solo"; screen = "play"; anim = { key: null, done: true }; lastCardKey = null; newSolo(); render(); return; }
    if (act === "pass-setup") { sound.tap(); go(act, () => { screen = "pass-setup"; }); return; }
    if (act === "online-setup") { sound.tap(); go(act, () => { error = ""; screen = "online-setup"; }); return; }
    if (act === "invite" && net) {
      const url = new URL(location.origin + location.pathname);
      url.searchParams.set("room", net.code);
      shareLink(url.href, `${s().inviteText} (${net.code})`, b);
      return;
    }
    if (act === "up" || act === "down") {
      sound.tap();
      if (!tapPoint) { const r = b.getBoundingClientRect(); tapPoint = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
      if (mode === "solo" && solo.phase === "guess") {
        solo.guess = act;
        const correct = isCorrect(factFor(solo.card.id).p, solo.card.t, act);
        solo.result = { correct };
        if (correct) solo.score++;
        else solo.lives--;
        if (solo.score > solo.best) { solo.best = solo.score; store.set("odds:best", String(solo.best)); }
        solo.phase = solo.lives <= 0 ? "over" : "reveal";
        render();
      } else if (mode === "pass" && match) {
        match.guessed(act);
        render();
      } else if (mode === "online" && net) {
        net.send({ t: "guess", dir: act });
      }
      return;
    }
    if (act === "challenge" || act === "no-challenge") {
      sound.tap();
      if (mode === "pass" && match) { match.challenge(act === "challenge"); render(); }
      else if (mode === "online" && net) net.send({ t: "challenge", yes: act === "challenge" });
      return;
    }
    if (act === "next") {
      sound.tap();
      if (mode === "solo") { nextSolo(); render(); }
      else if (mode === "pass" && match) { match.next(); render(); }
      else if (mode === "online" && net) net.send({ t: "next" });
      return;
    }
    if (act === "rematch") {
      sound.tap();
      if (mode === "pass" && match) { match.rematch(); anim = { key: null, done: true }; lastCardKey = null; render(); }
      else if (mode === "online" && net) net.send({ t: "rematch" });
    }
  });

  root.addEventListener("submit", (e) => {
    e.preventDefault();
    sound.unlock();
    const form = e.target;
    if (form.dataset.form === "pass") {
      const n1 = form.n1.value.trim().slice(0, 20) || s().p1;
      const n2 = form.n2.value.trim().slice(0, 20) || s().p2;
      store.set("odds:names", JSON.stringify([form.n1.value.trim(), form.n2.value.trim()]));
      match = new Match({ seed: (Math.random() * 2 ** 31) >>> 0, names: [n1, n2] });
      mode = "pass";
      screen = "play";
      anim = { key: null, done: true };
      lastCardKey = null;
      sound.tap();
      render();
      return;
    }
    if (form.dataset.form === "online") {
      const name = form.nm.value.trim().slice(0, 20);
      if (!name) { form.nm.focus(); motion.rubberNudge(form.nm, 4); return; }
      const act = e.submitter ? e.submitter.value : (joinCode ? "join" : "create");
      if (act === "create") { createRoom(name); return; }
      const code = form.code.value.trim().toUpperCase();
      if (!/^[A-Z]{4}$/.test(code)) { form.code.focus(); motion.rubberNudge(form.code, 4); return; }
      joinCode = "";
      enterRoom(code, name);
    }
  });

  render();

  return {
    setLang(l) { L = l; lastScreenHtmlKey = null; if (anim.done) render(); else deferred = true; },
    openRoom(code) {
      const c = String(code || "").toUpperCase();
      if (!/^[A-Z]{4}$/.test(c)) return;
      const name = store.get("odds:name");
      if (name) { enterRoom(c, name); return; }
      joinCode = c;
      screen = "online-setup";
      render();
    },
  };
}
