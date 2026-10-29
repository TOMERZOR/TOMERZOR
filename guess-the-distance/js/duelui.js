// The 1v1 duel screens: searching, VS intro, rounds with health bars, the
// damage reveal, the end screen and rematches. All state comes from the
// server; this file only draws it.

import { $, html, esc, countUp, confetti, haptic, toast, sleep, reducedMotion } from "./ui.js";
import { t, word, fmtNum, fmtTimeHtml, fmtKmHtml, fmtValue, placeName, tripArrow, iso } from "./i18n.js";
import { icon, MODE_COLORS } from "./icons.js";
import { artCanvas } from "./art.js";
import { createPicker } from "./wheel.js";
import { MAPS } from "../core/places.js";
import { verdict, MAX_ROUND } from "../core/scoring.js";
import * as gmap from "./map.js";
import * as audio from "./audio.js";
import { openStage, closeStage, stageUi, mapPad, tripCard, askText, timerRing, numberLine, sourceLine, altLine, overlay, closeOverlay, overlayOpen, loadingPanel, brief, scoreEmoji } from "./stage.js";
import { shareOrCopy } from "./solo.js";

const sfx = audio.sfx;

export class DuelUI {
  constructor(net, app) {
    this.net = net;
    this.app = app;
    this.match = null;
    this.round = null;
    this.ring = null;
    this.picker = null;
    this.searchTimer = null;
    this.lockedN = 0;
    this.revealN = 0;
    this.ended = null;
    const on = (type, fn) => net.on(type, (m) => fn.call(this, m));
    on("queued", this.onQueued);
    on("room", this.onRoom);
    on("match", this.onMatch);
    on("round", this.onRound);
    on("locked", this.onLocked);
    on("oppLocked", this.onOppLocked);
    on("deadline", this.onDeadline);
    on("result", this.onResult);
    on("end", this.onEnd);
    on("sync", this.onSync);
    on("oppAway", () => this.match && toast(t("oppAway", { name: this.match.opponent.name }), 3500));
    on("oppBack", () => this.match && toast(t("oppBack", { name: this.match.opponent.name })));
    on("oppLeft", () => {
      if (this.ended) {
        const b = $("#end-rematch");
        if (b) b.disabled = true;
      }
    });
    on("rematchAsked", () => {
      if (!this.ended) return;
      toast(t("rematchAsked", { name: this.ended.opponent.name }), 4000);
      $("#end-rematch")?.classList.add("btn-tint");
      sfx.lock();
    });
    on("rematchWaiting", () => {
      const b = $("#end-rematch");
      if (b) {
        b.disabled = true;
        b.textContent = t("rematchWaiting");
      }
    });
    on("error", this.onError);
    on("dropped", () => {
      if (this.match) toast(t("reconnecting"), 4000);
    });
  }

  get active() {
    return !!this.match;
  }

  // ---------- lobby actions ----------
  async quick(map, measure) {
    await this.net.connect();
    if (this.net.isLocal) {
      toast(t("serverOffNote"), 4000);
      return;
    }
    this.net.send({ t: "queue", map, measure });
    this.showSearching(map, measure);
  }

  async createRoom(map, measure) {
    await this.net.connect();
    if (this.net.isLocal) return toast(t("serverOffNote"), 4000);
    this.net.send({ t: "room:create", map, measure });
  }

  async joinRoom(code) {
    await this.net.connect();
    if (this.net.isLocal) return toast(t("serverOffNote"), 4000);
    this.net.send({ t: "room:join", code });
  }

  async bot(map, measure, level) {
    await this.net.connect();
    this.net.send({ t: "bot", map, measure, level });
  }

  showSearching(map, measure) {
    const startedAt = Date.now();
    const panel = overlay(`
      ${loadingPanel(t("searching"), t("searchingSub", { n: fmtNum(Math.max(1, this.net.online)) }), this.app.profile().avatar)}
      <div class="actions">
        <button class="btn btn-soft" id="q-bot" hidden>${icon("robot")}${esc(t("tryBot"))}</button>
        <button class="btn btn-ink" id="q-cancel">${esc(t("cancel"))}</button>
      </div>`, {
      onClose: () => clearInterval(this.searchTimer),
    });
    panel.querySelector("#q-cancel").addEventListener("click", () => {
      sfx.tap();
      this.net.send({ t: "cancel" });
      closeOverlay();
    });
    panel.querySelector("#q-bot").addEventListener("click", () => {
      sfx.tap();
      this.net.send({ t: "cancel" });
      this.bot(map, measure, this.app.settings().botLevel);
    });
    clearInterval(this.searchTimer);
    this.searchTimer = setInterval(() => {
      if (Date.now() - startedAt > 12000) panel.querySelector("#q-bot")?.removeAttribute("hidden");
      const p = panel.querySelector("p.muted");
      if (p) p.textContent = t("searchingSub", { n: fmtNum(Math.max(1, this.net.online)) });
    }, 1000);
  }

  onQueued(m) {
    const p = $("#overlay-panel p.muted");
    if (p && typeof m.online === "number") p.textContent = t("searchingSub", { n: fmtNum(Math.max(1, m.online)) });
  }

  onRoom(m) {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("room", m.code);
    const panel = overlay(`
      ${loadingPanel(t("waitingRoom"), `${t("roomCode")}`, "🔑")}
      <div class="big-title num" style="letter-spacing:.3em;font-size:48px;margin-top:4px">${esc(m.code)}</div>
      <p class="muted">${esc(word("mapsWord", m.map))} · ${esc(m.measure === "time" ? t("mTime") : t("mDistance"))}</p>
      <div class="actions">
        <button class="btn btn-tint" id="r-share">${icon("share")}${esc(t("shareRoom"))}</button>
        <button class="btn btn-soft" id="r-cancel">${esc(t("cancel"))}</button>
      </div>`);
    panel.querySelector("#r-share").addEventListener("click", () => {
      sfx.tap();
      shareOrCopy(t("inviteText", { code: m.code }), url.toString(), t("copied"));
    });
    panel.querySelector("#r-cancel").addEventListener("click", () => {
      sfx.tap();
      this.net.send({ t: "cancel" });
      closeOverlay();
    });
  }

  onError(m) {
    const map = { "room-not-found": "noRoom", "own-room": "ownRoom", "in-match": "inMatch", "need-server": "serverOffNote" };
    sfx.error();
    toast(t(map[m.code] || "errGeneric"), 3500);
  }

  // ---------- match ----------
  onMatch(m) {
    clearInterval(this.searchTimer);
    try { sessionStorage.setItem("gtd:match", String(Date.now())); } catch {}
    this.match = m;
    this.ended = null;
    this.round = null;
    this.lockedN = 0;
    this.revealN = 0;
    audio.setMood("duel");
    sfx.match();
    haptic("success");
    const colors = MAPS[m.map]?.colors || MAPS.israel.colors;
    const panel = overlay(`
      <div class="vs">
        <div class="side left"><div class="face">${esc(m.you.avatar)}</div><span><bdi>${esc(m.you.name)}</bdi></span></div>
        <div class="mid">${esc(t("vs"))}</div>
        <div class="side right"><div class="face">${esc(m.opponent.avatar)}</div><span><bdi>${esc(m.opponent.name)}</bdi>${m.opponent.bot ? " 🤖" : ""}</span></div>
      </div>
      <p class="muted">${esc(word("mapsWord", m.map))} · ${esc(m.measure === "time" ? t("mTime") : t("mDistance"))} · ${fmtNum(m.maxHp)} ❤️</p>
      <div class="countdown" id="cd"></div>`);
    openStage("duel");
    this.renderHud();
    // 3-2-1 that lands as round 1 starts
    const cd = panel.querySelector("#cd");
    const steps = [3, 2, 1];
    steps.forEach((n, k) => {
      setTimeout(() => {
        if (!cd.isConnected || this.round) return;
        cd.innerHTML = `<span>${n}</span>`;
        sfx.countdown(false);
        haptic("tap");
      }, 1200 + k * 950);
    });
    gmap.idle();
    void colors;
  }

  renderHud() {
    const m = this.match;
    if (!m) return;
    const ui = stageUi();
    ui.innerHTML = "";
    const hud = html(`
      <div class="hud">
        ${this.hpCard("you", m.you, m.hp.you)}
        <div class="hud-mid">
          <button class="icon-btn glass" id="d-exit" aria-label="${esc(t("leave"))}">${icon("close")}</button>
        </div>
        ${this.hpCard("opp", m.opponent, m.hp.opp)}
      </div>`);
    ui.append(hud);
    hud.querySelector("#d-exit").addEventListener("click", () => this.confirmLeave());
  }

  hpCard(side, p, hp) {
    const max = this.match.maxHp;
    const f = Math.max(0, hp / max);
    return `<div class="hp glass ${side} ${f < 0.3 ? "low" : ""}" id="hp-${side}">
      <div class="who"><span class="av">${esc(p.avatar)}</span><span class="nm">${esc(side === "you" ? t("me") : p.name)}</span></div>
      <div class="bar" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${hp}" aria-label="${esc(p.name)}"><i class="ghost" style="transform:scaleX(${f})"></i><i class="fill" style="transform:scaleX(${f})"></i></div>
      <div class="val num" id="hpv-${side}">${fmtNum(hp)}</div>
    </div>`;
  }

  setHp(side, hp, animate = true) {
    const card = $(`#hp-${side}`);
    if (!card) return;
    const max = this.match.maxHp;
    const f = Math.max(0, hp / max);
    const [ghost, fill] = card.querySelectorAll(".bar i");
    fill.style.transform = `scaleX(${f})`;
    ghost.style.transform = `scaleX(${f})`;
    card.querySelector(".bar").setAttribute("aria-valuenow", hp);
    card.classList.toggle("low", f < 0.3);
    const val = card.querySelector(".val");
    const from = Number(String(val.textContent).replace(/[^\d]/g, "")) || 0;
    if (animate) countUp(val, hp, { from, ms: 1000 });
    else val.textContent = fmtNum(hp);
  }

  confirmLeave() {
    sfx.tap();
    const panel = overlay(`
      <h2 class="big-title">${esc(t("leaveQ"))}</h2>
      <p class="muted">${esc(t("leaveDuel"))}</p>
      <div class="actions">
        <button class="btn btn-ink" id="l-stay">${esc(t("stay"))}</button>
        <button class="btn btn-soft" id="l-leave" style="color:var(--red)">${esc(t("leave"))}</button>
      </div>`);
    panel.querySelector("#l-stay").addEventListener("click", () => { sfx.tap(); closeOverlay(); });
    panel.querySelector("#l-leave").addEventListener("click", () => {
      sfx.tap();
      this.net.send({ t: "leave" });
      this.exit();
    });
  }

  exit() {
    try { sessionStorage.removeItem("gtd:match"); } catch {}
    this.ring?.stop();
    this.match = null;
    this.round = null;
    this.ended = null;
    closeOverlay();
    closeStage();
    this.app.refresh();
  }

  async onRound(m) {
    if (!this.match) return;
    this.round = m;
    this.match.hp = m.hp;
    const first = m.n === 1;
    if (overlayOpen()) closeOverlay();
    if (!$("#stage").classList.contains("on")) openStage("duel");
    if (!$(".hud")) this.renderHud();
    if (!first) {
      // a quick round card; the round timer is already running
      sfx.whoosh();
      const mult = m.multiplier > 1 ? `<div class="mult-big">${esc(t("damageX", { m: m.multiplier }))}</div>` : "";
      brief(`<div class="n">${esc(t("round"))}</div><div class="big num">${m.n}</div>${mult}`, m.multiplier > 1 ? 1300 : 900);
    } else {
      sfx.countdown(true);
      haptic("lock");
    }
    this.drawRound(m, { myGuess: null, oppLocked: false });
  }

  drawRound(m, { myGuess, oppLocked }) {
    const ui = stageUi();
    ui.querySelectorAll(".trip, .sheet").forEach((n) => n.remove());
    this.setHp("you", m.hp.you, false);
    this.setHp("opp", m.hp.opp, false);
    const measure = this.match.measure;
    const opp = this.match.opponent;
    const roundTag = `<span class="tag num" style="color:var(--label)">${esc(t("roundN", { n: m.n }))}</span>${m.multiplier > 1 ? `<span class="mult">×${m.multiplier}</span>` : ""}`;
    const trip = tripCard(m.round, { measure, extraTag: `${roundTag}<span class="tag opp ${oppLocked ? "locked" : ""}" id="opp-tag">${esc(opp.avatar)} ${esc(oppLocked ? t("oppLocked", { name: opp.name }) : t("thinking", { name: opp.name }))}</span>` });
    trip.style.top = "calc(var(--safe-top) + 108px)";
    ui.append(trip);
    const ask = askText(m.round, measure);
    const sheet = html(`
      <div class="sheet glass down">
        <div class="grabber"></div>
        <h2>${esc(ask.title)}</h2>
        <p class="sub">${esc(ask.sub)}</p>
        <div class="picker-host"></div>
        <div class="guess-row">
          <div class="ring-host" aria-hidden="true"></div>
          <button class="btn btn-ink" id="btn-guess">${esc(t("guess"))}</button>
        </div>
      </div>`);
    ui.append(sheet);
    this.picker = createPicker(sheet.querySelector(".picker-host"), { measure, value: myGuess ?? (measure === "time" ? 30 : 10), onTick: () => sfx.tick() });
    requestAnimationFrame(() => sheet.classList.remove("down"));
    this.ring?.stop();
    this.ring = timerRing(sheet.querySelector(".ring-host"), m.timeLeft, { onHurry: () => { sfx.hurry(); haptic("tap"); } });
    const btn = sheet.querySelector("#btn-guess");
    btn.addEventListener("click", () => {
      if (this.lockedN === m.n) return;
      this.lockedN = m.n;
      btn.disabled = true;
      this.net.send({ t: "guess", n: m.n, value: this.picker.value });
    });
    if (myGuess != null) this.showLocked(myGuess);
    gmap.showTrip(m.round, mapPad());
  }

  showLocked() {
    const btn = $("#btn-guess");
    if (btn) {
      btn.disabled = true;
      btn.textContent = t("locked");
    }
    this.picker?.disable(true);
  }

  onLocked(m) {
    if (!this.round || m.n !== this.round.n) return;
    this.lockedN = m.n;
    sfx.lock();
    haptic("lock");
    this.showLocked(m.value);
  }

  onOppLocked(m) {
    if (!this.round || m.n !== this.round.n) return;
    const tag = $("#opp-tag");
    if (tag) {
      tag.classList.add("locked");
      tag.textContent = `${this.match.opponent.avatar} ${t("oppLocked", { name: this.match.opponent.name })}`;
    }
    this.ring?.set(m.timeLeft);
    sfx.hurry();
    haptic("warning");
  }

  onDeadline(m) {
    if (!this.round || m.n !== this.round.n) return;
    this.ring?.set(m.timeLeft);
  }

  async onResult(m) {
    if (!this.match || this.revealN === m.n) return;
    this.revealN = m.n;
    this.ring?.stop();
    this.picker?.disable(true);
    const tag = $("#opp-tag");
    if (tag && this.match) {
      const o = this.match.opponent;
      tag.classList.toggle("locked", m.guesses.opp != null);
      tag.textContent = `${o.avatar} ${iso(o.name)} · ${iso(m.guesses.opp == null ? t("noGuess") : fmtValue(m.guesses.opp, this.match.measure))}`;
    }
    const round = this.round?.round;
    const measure = this.match.measure;
    const sheet = stageUi().querySelector(".sheet");
    if (!sheet || !round) return;
    const actual = m.actual.value;
    const route = { min: m.actual.min, km: m.actual.km, geometry: m.actual.geometry, source: m.actual.source };
    const opp = this.match.opponent;
    const youWin = m.scores.you > m.scores.opp;
    const tie = m.scores.you === m.scores.opp;
    sheet.innerHTML = `
      <div class="grabber"></div>
      <div class="reveal-top">
        <div>
          <div class="answer-label">${esc(measure === "time" ? t("actualTime") : t("actualDistance"))}</div>
          <div class="answer" id="answer"></div>
          <div class="answer-alt">${esc(altLine(route, measure))}</div>
        </div>
        <div class="verdict" id="verdict" style="opacity:0"><b>${esc(t(verdict(m.scores.you)))}</b><span>${m.damage.amount ? esc(`${m.damage.to === "you" ? "💥" : "⚔️"} ${fmtNum(m.damage.amount)}`) : "🤝"}</span></div>
      </div>
      <div class="line-host"></div>
      <div class="points">
        <div class="points-row"><b class="num" id="pts-you">0</b><span>${esc(t("you"))} · ${esc(iso(opp.name))}</span><b class="num" id="pts-opp">0</b></div>
        <div class="meter"><i id="meter"></i></div>
      </div>
      ${sourceLine(route)}
      <button class="btn btn-ink btn-block" id="btn-next">${esc(m.last ? t("finish") : t("next"))} ${icon("arrow")}</button>`;
    sheet.querySelector(".line-host").append(numberLine({ actual, you: m.guesses.you, opp: m.guesses.opp, measure, oppName: opp.name }));
    const nextBtn = sheet.querySelector("#btn-next");
    nextBtn.addEventListener("click", () => {
      sfx.tap();
      nextBtn.disabled = true;
      this.net.send({ t: "ready", n: m.n });
    });
    sfx.reveal();
    audio.duck(0.4, 2800);
    const routeDone = gmap.drawRoute(round, route, mapPad(), reducedMotion() ? 0 : 2000);
    const fmt = measure === "time" ? (x) => fmtTimeHtml(x) : (x) => fmtKmHtml(x);
    await countUp(sheet.querySelector("#answer"), actual, { ms: 1400, html: true, format: fmt });
    if (!this.match) return;
    const v = sheet.querySelector("#verdict");
    if (v) v.style.cssText = "opacity:1;transition:opacity .3s;";
    sfx.verdict(m.scores.you);
    haptic(m.scores.you >= MAX_ROUND ? "success" : m.scores.you >= 3800 ? "lock" : m.scores.you < 1500 ? "warning" : "tap");
    const meter = sheet.querySelector("#meter");
    if (meter) meter.style.width = `${(m.scores.you / MAX_ROUND) * 100}%`;
    countUp(sheet.querySelector("#pts-you"), m.scores.you, { ms: 1000, onTick: (p) => { sfx.count(p * (m.scores.you / MAX_ROUND)); haptic("tick"); } });
    countUp(sheet.querySelector("#pts-opp"), m.scores.opp, { ms: 1000 });
    if (m.scores.you >= MAX_ROUND) confetti({ count: 90 });
    await sleep(1150);
    if (!this.match) return;
    // the hit
    if (m.damage.to) {
      const side = m.damage.to;
      const card = $(`#hp-${side}`);
      if (side === "you") {
        sfx.damage();
        haptic("heavy");
        document.body.append(html('<div class="flash-red"></div>'));
        setTimeout(() => $(".flash-red")?.remove(), 900);
      } else {
        sfx.hit();
        haptic("lock");
      }
      if (card) {
        card.classList.remove("hit");
        void card.offsetWidth;
        card.classList.add("hit");
        const r = card.getBoundingClientRect();
        const f = html(`<div class="dmg-float num">−${fmtNum(m.damage.amount)}</div>`);
        f.style.left = `${r.left + r.width / 2 - 40}px`;
        f.style.top = `${r.bottom + 4}px`;
        document.body.append(f);
        setTimeout(() => f.remove(), 1600);
      }
      this.setHp(side, m.hp[side]);
    }
    this.match.hp = m.hp;
    void youWin;
    void tie;
    await routeDone;
  }

  onEnd(m) {
    if (!this.match) return;
    this.ring?.stop();
    const match = this.match;
    this.ended = match;
    try { sessionStorage.removeItem("gtd:match"); } catch {}
    this.app.recordDuel(m);
    const win = m.result === "win", draw = m.result === "draw";
    const colors = win ? ["#ffd23f", "#ff9500", "#ff2d87"] : draw ? ["#7cc6ff", "#5b6bff", "#c04bff"] : ["#5b6bff", "#3a3a8c", "#1c1c3a"];
    const title = win ? t("victory") : draw ? t("draw") : t("defeat");
    const sub = m.reason === "forfeit" && m.quitter === "opp" ? t("forfeitWin", { name: match.opponent.name }) : `${match.you.avatar} ${iso(fmtNum(m.hp.you))} ❤️ · ${match.opponent.avatar} ${iso(fmtNum(m.hp.opp))} ❤️`;
    const rows = m.rounds.map((r) => `
      <div class="rr">
        <div class="mi" style="background:${(MODE_COLORS[r.mode] || MODE_COLORS.car)[1]}">${icon(r.mode)}</div>
        <div><div class="tt">${esc(placeName(r.from))} ${tripArrow()} ${esc(placeName(r.to))}</div>
        <div class="dd num">${esc(iso(fmtValue(r.actual, match.measure)))} · ${esc(t("you"))} ${r.you == null ? "—" : esc(iso(fmtValue(r.you, match.measure)))} · ${esc(iso(match.opponent.name))} ${r.opp == null ? "—" : esc(iso(fmtValue(r.opp, match.measure)))}</div></div>
        <div class="sc num">${fmtNum(r.scores.you)}<small>${scoreEmoji(r.scores.you)} ${r.loser === "you" ? "💥" : r.loser === "opp" ? "⚔️" : ""}</small></div>
      </div>`).join("");
    setTimeout(() => {
      if (this.ended !== match) return;
      const panel = overlay(`
        <div class="art-card result-hero drift" style="--c1:${colors[0]};--c2:${colors[1]};--c3:${colors[2]}">
          ${artCanvas(colors, "end-" + match.matchId)}
          <div class="art-body">
            <div class="rank">${esc(match.you.avatar)} vs ${esc(match.opponent.avatar)}</div>
            <div class="total win-title">${esc(title)}</div>
            <div class="of">${esc(sub)}</div>
          </div>
        </div>
        ${rows ? `<div class="rounds-list">${rows}</div>` : ""}
        <div class="actions">
          <button class="btn btn-ink" id="end-rematch">${icon("swords")}${esc(t("rematch"))}</button>
          <button class="btn btn-soft" id="end-home">${esc(t("home"))}</button>
        </div>`);
      panel.querySelector("#end-rematch").addEventListener("click", (e) => {
        sfx.tap();
        e.currentTarget.disabled = true;
        this.net.send({ t: "rematch" });
      });
      panel.querySelector("#end-home").addEventListener("click", () => {
        sfx.tap();
        this.net.send({ t: "leave" });
        this.exit();
      });
      if (win) {
        sfx.win();
        confetti({ count: 220 });
        haptic("success");
      } else if (draw) sfx.verdict(3000);
      else sfx.lose();
    }, m.reason === "forfeit" ? 0 : 400);
  }

  onSync(m) {
    // back after a dropped connection
    this.match = { matchId: m.matchId, map: m.map, measure: m.measure, you: m.you, opponent: m.opponent, hp: m.hp, maxHp: m.maxHp };
    this.ended = null;
    if (overlayOpen()) closeOverlay();
    openStage("duel");
    this.renderHud();
    toast(t("reconnected"));
    if (m.phase === "guessing" && m.round) {
      this.round = { n: m.n, round: m.round, multiplier: m.multiplier, timeLeft: m.timeLeft, hp: m.hp };
      this.lockedN = m.myGuess != null ? m.n : 0;
      this.revealN = 0;
      this.drawRound(this.round, { myGuess: m.myGuess, oppLocked: m.oppLocked });
    } else if (m.phase === "reveal" && m.round && m.result) {
      this.round = { n: m.n, round: m.round, multiplier: m.result.multiplier, timeLeft: 0, hp: m.hp };
      this.drawRound(this.round, { myGuess: m.result.guesses.you, oppLocked: true });
      this.revealN = 0;
      this.onResult(m.result);
    }
  }
}
