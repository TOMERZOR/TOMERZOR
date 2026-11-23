// The 1v1 duel screens: searching, the waiting room, the VS intro, rounds
// with health bars, the hit, the end screen and rematches. All state comes
// from the server; this file only draws it.

import { $, html, esc, countUp, confetti, haptic, toast, sleep, reducedMotion, isDesktop } from "./ui.js";
import { t, word, fmtNum, fmtValue, placeName, tripArrow, iso } from "./i18n.js";
import { icon, img3d, coin, MODE_3D, MODE_TONE } from "./icons.js";
import { candy, ghost, iconBtn, sparkles } from "./kit.js";
import * as juice from "./juice.js";
import { createPicker } from "./wheel.js";
import { MAX_ROUND } from "../core/scoring.js";
import * as gmap from "./map.js";
import * as audio from "./audio.js";
import { openStage, closeStage, stageUi, inspector, zoomTools, mapPad, tripCard, askText, timerRing, numberLine, sourceLine, altLine, overlay, closeOverlay, overlayOpen, loadingPanel, brief, scoreEmoji, verdictSticker, showVerdict, meter10, runMeter, answerHtml } from "./stage.js";
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
    on("oppAway", () => this.match && toast(t("oppAway", { name: this.match.opponent.name }), 3500, { tone: "sun" }));
    on("oppBack", () => this.match && toast(t("oppBack", { name: this.match.opponent.name }), 2400, { tone: "mint" }));
    on("oppLeft", () => {
      if (this.ended) {
        const b = $("#end-rematch");
        if (b) b.disabled = true;
      }
    });
    on("rematchAsked", () => {
      if (!this.ended) return;
      toast(t("rematchAsked", { name: this.ended.opponent.name }), 4000, { tone: "lime" });
      const b = $("#end-rematch");
      if (b) juice.bounce(b);
      sfx.lock();
    });
    on("rematchWaiting", () => {
      const b = $("#end-rematch");
      if (b) {
        juice.loading(b, true);
        b.setAttribute("aria-label", t("rematchWaiting"));
      }
    });
    on("error", this.onError);
    on("dropped", () => {
      if (this.match) toast(t("reconnecting"), 4000, { tone: "sun" });
    });
  }

  get active() {
    return !!this.match;
  }

  // ---------- lobby actions ----------
  async quick(map, measure) {
    await this.net.connect();
    if (this.net.isLocal) {
      toast(t("serverOffNote"), 4000, { tone: "sun" });
      return false;
    }
    this.net.send({ t: "queue", map, measure });
    this.showSearching(map, measure);
    return true;
  }

  async createRoom(map, measure) {
    await this.net.connect();
    if (this.net.isLocal) {
      toast(t("serverOffNote"), 4000, { tone: "sun" });
      return false;
    }
    this.net.send({ t: "room:create", map, measure });
    return true;
  }

  async joinRoom(code) {
    await this.net.connect();
    if (this.net.isLocal) {
      toast(t("serverOffNote"), 4000, { tone: "sun" });
      return false;
    }
    this.net.send({ t: "room:join", code });
    return true;
  }

  async bot(map, measure, level) {
    await this.net.connect();
    this.net.send({ t: "bot", map, measure, level });
  }

  showSearching(map, measure) {
    const startedAt = Date.now();
    const panel = overlay(`
      ${loadingPanel(t("searching"), t("searchingSub", { n: fmtNum(Math.max(1, this.net.online)) }), coin(this.app.profile().avatar, { size: 92 }))}
      <div class="actions">
        ${candy({ text: t("tryBot"), tone: "sun", ico: "robot", id: "q-bot", attrs: "hidden" })}
        ${ghost({ text: t("cancel"), id: "q-cancel" })}
      </div>`, {
      look: "night",
      onClose: () => clearInterval(this.searchTimer),
    });
    panel.querySelector("#q-cancel").addEventListener("click", () => {
      this.net.send({ t: "cancel" });
      closeOverlay();
    });
    const botBtn = panel.querySelector("#q-bot");
    botBtn.addEventListener("click", () => {
      this.net.send({ t: "cancel" });
      this.bot(map, measure, this.app.settings().botLevel || "normal");
    });
    clearInterval(this.searchTimer);
    this.searchTimer = setInterval(() => {
      if (Date.now() - startedAt > 12000 && botBtn.hidden) {
        botBtn.hidden = false;
        juice.popIn(botBtn);
        sfx.toggle();
      }
      const p = panel.querySelector("#radar-sub");
      if (p) p.textContent = t("searchingSub", { n: fmtNum(Math.max(1, this.net.online)) });
    }, 1000);
  }

  onQueued(m) {
    const p = $("#radar-sub");
    if (p && typeof m.online === "number") p.textContent = t("searchingSub", { n: fmtNum(Math.max(1, m.online)) });
  }

  onRoom(m) {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("room", m.code);
    const panel = overlay(`
      <div class="radar" aria-hidden="true" style="width:150px;height:150px;margin-bottom:14px"><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="core">${img3d("key", { size: 84, lazy: false })}</div></div>
      <h2 class="big-title">${esc(t("waitingRoom"))}</h2>
      <p class="muted">${esc(t("roomCode"))}</p>
      <div class="room-code" aria-label="${esc(t("roomCode"))}: ${esc(m.code.split("").join(" "))}">${m.code.split("").map((c, i) => `<span class="tile flip" style="animation-delay:${0.15 + i * 0.14}s">${esc(c)}</span>`).join("")}</div>
      <p class="muted">${esc(word("mapsWord", m.map))} · ${esc(m.measure === "time" ? t("mTime") : t("mDistance"))}</p>
      <div class="actions">
        ${candy({ text: t("shareRoom"), tone: "lime", ico: "share", id: "r-share" })}
        ${ghost({ text: t("cancel"), id: "r-cancel" })}
      </div>`, { look: "night" });
    const share = panel.querySelector("#r-share");
    share.addEventListener("click", async () => {
      const how = await shareOrCopy(t("inviteText", { code: m.code }), url.toString(), t("copied"));
      if (how === "copied") juice.success(share, t("copied"), { revert: 1800 });
    });
    panel.querySelector("#r-cancel").addEventListener("click", () => {
      this.net.send({ t: "cancel" });
      closeOverlay();
    });
  }

  onError(m) {
    const map = { "room-not-found": "noRoom", "own-room": "ownRoom", "in-match": "inMatch", "need-server": "serverOffNote" };
    const tiles = $("#code-tiles");
    if (m.code === "room-not-found" && tiles?.offsetParent) juice.error(tiles);
    else sfx.error();
    toast(t(map[m.code] || "errGeneric"), 3500, { tone: "coral" });
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
    const panel = overlay(`
      <div class="vs">
        <div class="halves" aria-hidden="true"><div class="half me"></div><div class="half them"></div><div class="seam"></div></div>
        <div class="sides">
          <div class="side me">${coin(m.you.avatar, { size: null })}<span class="nm"><bdi>${esc(m.you.name)}</bdi></span></div>
          <div class="side them">${coin(m.opponent.avatar, { size: null })}<span class="nm"><bdi>${esc(m.opponent.name)}</bdi>${m.opponent.bot ? " 🤖" : ""}</span></div>
        </div>
        <div class="vs-word" aria-hidden="true">${esc(t("vs"))}</div>
        <div class="vs-cd"><div class="countdown" id="cd" aria-live="assertive"></div></div>
        <div class="vs-info">
          <div class="meta"><span>${esc(word("mapsWord", m.map))}</span>·<span>${esc(m.measure === "time" ? t("mTime") : t("mDistance"))}</span>·<span class="num">${fmtNum(m.maxHp)} ❤️</span></div>
        </div>
      </div>`, { look: "vs-screen", cls: "vs-panel" });
    openStage("duel");
    this.renderHud();
    // 3-2-1 that lands as round 1 starts
    const cd = panel.querySelector("#cd");
    [3, 2, 1].forEach((n, k) => {
      setTimeout(() => {
        if (!cd.isConnected || this.round) return;
        cd.innerHTML = `<span>${n}</span>`;
        sfx.countdown(false);
        haptic("tap");
      }, 1200 + k * 950);
    });
    gmap.idle();
  }

  renderHud() {
    const m = this.match;
    if (!m) return;
    const ui = stageUi();
    ui.innerHTML = "";
    const hud = html(`
      <div class="hud">
        ${this.hpCard("you", m.you, m.hp.you)}
        <div class="hud-mid">${iconBtn({ ico: "close", label: t("leave"), hud: true, id: "d-exit" })}<span id="mult-slot"></span></div>
        ${this.hpCard("opp", m.opponent, m.hp.opp)}
      </div>`);
    ui.append(hud);
    zoomTools();
    hud.querySelector("#d-exit").addEventListener("click", () => this.confirmLeave());
  }

  // A thick health card: an avatar coin and a bar cut into ten blocks, like a
  // health bar in a game. Yours is lime, theirs is flame (as on the VS screen).
  hpCard(side, p, hp) {
    const max = this.match.maxHp;
    const f = Math.max(0, hp / max);
    return `<div class="hp glass ${side} ${f < 0.3 ? "low" : ""}" id="hp-${side}">
      <div class="who">${coin(p.avatar, { size: 34 })}<span class="nm">${esc(side === "you" ? t("me") : p.name)}</span></div>
      <div class="bar-row">
        <div class="bar" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${hp}" aria-label="${esc(p.name)}"><i class="ghost" style="transform:scaleX(${f})"></i><i class="fill" style="transform:scaleX(${f})"></i><span class="ticks"></span></div>
        <span class="val num" id="hpv-${side}">${fmtNum(hp)}</span>
      </div>
    </div>`;
  }

  setHp(side, hp, animate = true) {
    const card = $(`#hp-${side}`);
    if (!card) return;
    const max = this.match.maxHp;
    const f = Math.max(0, hp / max);
    const [ghostBar, fill] = card.querySelectorAll(".bar i");
    fill.style.transform = `scaleX(${f})`;
    ghostBar.style.transform = `scaleX(${f})`;
    card.querySelector(".bar").setAttribute("aria-valuenow", hp);
    card.classList.toggle("low", f < 0.3);
    const val = card.querySelector(".val");
    const from = Number(String(val.textContent).replace(/[^\d]/g, "")) || 0;
    if (animate) countUp(val, hp, { from, ms: 1000 });
    else val.textContent = fmtNum(hp);
  }

  setMultiplier(mult) {
    const slot = $("#mult-slot");
    if (slot) slot.innerHTML = mult > 1 ? `<span class="mult-tag">${img3d("fire", { size: 18, lazy: false })}<span class="num">×${mult}</span></span>` : "";
  }

  confirmLeave() {
    const panel = overlay(`
      <div class="sticker c-cloud window on-light">
        <h2 class="display w-title">${esc(t("leaveQ"))}</h2>
        <p>${esc(t("leaveDuel"))}</p>
        <div class="actions two">
          ${candy({ text: t("stay"), tone: "lime", id: "l-stay" })}
          ${candy({ text: t("leave"), tone: "coral", id: "l-leave" })}
        </div>
      </div>`, { look: "dim" });
    panel.querySelector("#l-stay").addEventListener("click", () => closeOverlay());
    panel.querySelector("#l-leave").addEventListener("click", () => {
      this.net.send({ t: "leave" });
      this.exit();
    });
    requestAnimationFrame(() => panel.querySelector("#l-stay")?.focus({ preventScroll: true }));
  }

  exit() {
    try { sessionStorage.removeItem("gtd:match"); } catch {}
    this.ring?.stop();
    this.match = null;
    this.round = null;
    this.ended = null;
    closeOverlay();
    closeStage();
    this.app.refresh(true);
  }

  async onRound(m) {
    if (!this.match) return;
    this.round = m;
    this.match.hp = m.hp;
    const first = m.n === 1;
    if (overlayOpen()) closeOverlay();
    if (!$("#stage").classList.contains("on")) openStage("duel");
    if (!$(".hud")) this.renderHud();
    this.setMultiplier(m.multiplier);
    if (!first) {
      // a quick round card; the round timer is already running
      sfx.whoosh();
      const mult = m.multiplier > 1 ? `<div class="mult-big">${img3d("fire", { size: 34, lazy: false })}<span>${esc(t("damageX", { m: m.multiplier }))}</span></div>` : "";
      brief(`<div class="n">${esc(t("round"))}</div><div class="big">${m.n}</div>${mult}`, m.multiplier > 1 ? 1300 : 900);
    } else {
      sfx.countdown(true);
      haptic("lock");
    }
    this.drawRound(m, { myGuess: null, oppLocked: false });
  }

  drawRound(m, { myGuess, oppLocked }) {
    const side = inspector();
    side.innerHTML = "";
    this.setHp("you", m.hp.you, false);
    this.setHp("opp", m.hp.opp, false);
    const measure = this.match.measure;
    const opp = this.match.opponent;
    const roundTag = `<span class="tag round num">${esc(t("roundN", { n: m.n }))}</span>`;
    const trip = tripCard(m.round, { measure, extraTag: `${roundTag}<span class="tag opp ${oppLocked ? "locked" : ""}" id="opp-tag">${esc(oppLocked ? t("oppLocked", { name: opp.name }) : t("thinking", { name: opp.name }))}</span>` });
    trip.style.top = "calc(var(--safe-top) + 112px)";
    side.append(trip);
    const ask = askText(m.round, measure);
    const sheet = html(`
      <div class="sheet glass down" role="region" aria-label="${esc(ask.title)}">
        <div class="grabber"></div>
        <h2 class="ask">${esc(ask.title)}</h2>
        <p class="sub">${esc(ask.sub)}</p>
        <div class="picker-host"></div>
        <div class="guess-row">
          <div class="ring-host" aria-hidden="true"></div>
          ${candy({ text: t("guess"), tone: "lime", id: "btn-guess", kbd: true })}
        </div>
      </div>`);
    side.append(sheet);
    this.picker = createPicker(sheet.querySelector(".picker-host"), { measure, value: myGuess ?? (measure === "time" ? 30 : 10), onTick: () => sfx.tick() });
    if (isDesktop() && myGuess == null) requestAnimationFrame(() => this.match && this.picker?.focus());
    requestAnimationFrame(() => sheet.classList.remove("down"));
    this.ring?.stop();
    this.ring = timerRing(sheet.querySelector(".ring-host"), m.timeLeft, { onHurry: () => { sfx.hurry(); haptic("tap"); } });
    const btn = sheet.querySelector("#btn-guess");
    btn.addEventListener("click", () => {
      if (this.lockedN === m.n) return;
      this.lockedN = m.n;
      juice.loading(btn, true);
      this.net.send({ t: "guess", n: m.n, value: this.picker.value });
    });
    if (myGuess != null) this.showLocked(false);
    gmap.showTrip(m.round, mapPad());
  }

  // Locked in: the button turns mint with a check, and stays put.
  showLocked(sound = true) {
    const btn = $("#btn-guess");
    if (btn) {
      juice.loading(btn, false);
      btn.setAttribute("aria-disabled", "true");
      juice.success(btn, t("lockedWord"), { sound });
    }
    this.picker?.disable(true);
  }

  onLocked(m) {
    if (!this.round || m.n !== this.round.n) return;
    this.lockedN = m.n;
    this.showLocked(true);
  }

  onOppLocked(m) {
    if (!this.round || m.n !== this.round.n) return;
    const tag = $("#opp-tag");
    if (tag) {
      tag.classList.add("locked");
      tag.textContent = t("oppLocked", { name: this.match.opponent.name });
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
    const o = this.match.opponent;
    const tag = $("#opp-tag");
    if (tag) {
      tag.classList.toggle("locked", m.guesses.opp != null);
      tag.textContent = `${iso(o.name)} · ${iso(m.guesses.opp == null ? t("noGuess") : fmtValue(m.guesses.opp, this.match.measure))}`;
    }
    const round = this.round?.round;
    const measure = this.match.measure;
    const sheet = stageUi().querySelector(".sheet");
    if (!sheet || !round) return;
    const actual = m.actual.value;
    const route = { min: m.actual.min, km: m.actual.km, geometry: m.actual.geometry, source: m.actual.source };
    const dmgLine = m.damage.amount ? `${m.damage.to === "you" ? "💥" : "⚔️"} ${iso(`${m.damage.to === "you" ? "−" : ""}${fmtNum(m.damage.amount)}`)}` : "🤝";
    sheet.innerHTML = `
      <div class="grabber"></div>
      <div class="rv-top">
        <div class="rv-answer">
          <div class="answer-label">${esc(measure === "time" ? t("actualTime") : t("actualDistance"))}</div>
          <div class="answer" id="answer" aria-live="polite"></div>
          <div class="answer-alt">${esc(altLine(route, measure))}</div>
        </div>
        ${verdictSticker(m.scores.you, esc(dmgLine))}
      </div>
      <div class="line-host"></div>
      <div class="points">
        <div class="points-row"><b class="num" id="pts-you">0</b><span class="vs-sep">${esc(t("you"))} · <bdi>${esc(o.name)}</bdi></span><b class="num" id="pts-opp">0</b></div>
        ${meter10()}
      </div>
      ${sourceLine(route)}
      ${candy({ html: `<span>${esc(m.last ? t("finish") : t("next"))}</span>${icon("arrow")}`, tone: "lime", id: "btn-next", cls: "block", kbd: true })}`;
    sheet.querySelector(".line-host").append(numberLine({ actual, you: m.guesses.you, opp: m.guesses.opp, measure, oppName: o.name, youAvatar: this.match.you.avatar, oppAvatar: o.avatar }));
    const nextBtn = sheet.querySelector("#btn-next");
    nextBtn.addEventListener("click", () => {
      if (nextBtn.getAttribute("aria-disabled") === "true") return;
      nextBtn.setAttribute("aria-disabled", "true");
      juice.loading(nextBtn, true);
      this.net.send({ t: "ready", n: m.n });
    });
    sfx.reveal();
    audio.duck(0.4, 2800);
    const routeDone = gmap.drawRoute(round, route, mapPad(), reducedMotion() ? 0 : 2000);
    await countUp(sheet.querySelector("#answer"), actual, { ms: 1400, html: true, format: (x) => answerHtml(x, measure) });
    if (!this.match) return;
    showVerdict(sheet.querySelector("#verdict"));
    sfx.verdict(m.scores.you);
    haptic(m.scores.you >= MAX_ROUND ? "success" : m.scores.you >= 3800 ? "lock" : m.scores.you < 1500 ? "warning" : "tap");
    runMeter(sheet.querySelector("#meter"), m.scores.you, 1400);
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
        f.style.left = `${r.left + r.width / 2 - 44}px`;
        f.style.top = `${r.bottom + 4}px`;
        document.body.append(f);
        setTimeout(() => f.remove(), 1600);
      }
      this.setHp(side, m.hp[side]);
    }
    this.match.hp = m.hp;
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
    const title = win ? t("victory") : draw ? t("draw") : t("defeat");
    const sub = m.reason === "forfeit" && m.quitter === "opp"
      ? `<span>${esc(t("forfeitWin", { name: match.opponent.name }))}</span>`
      : `<span class="hpv">${coin(match.you.avatar, { size: 36 })}<span>${fmtNum(m.hp.you)} ❤️</span></span><span class="hpv">${coin(match.opponent.avatar, { size: 36 })}<span>${fmtNum(m.hp.opp)} ❤️</span></span>`;
    const rows = m.rounds.map((r, k) => `
      <div class="rr" style="--tilt:${k % 2 ? 0.6 : -0.6}deg">
        <div class="mi c-${MODE_TONE[r.mode] || "lime"}">${img3d(MODE_3D[r.mode] || "car", { size: 32 })}</div>
        <div><div class="tt">${esc(placeName(r.from))} ${tripArrow()} ${esc(placeName(r.to))}</div>
        <div class="dd num">${esc(iso(fmtValue(r.actual, match.measure)))} · ${esc(t("you"))} ${r.you == null ? "—" : esc(iso(fmtValue(r.you, match.measure)))} · ${esc(iso(match.opponent.name))} ${r.opp == null ? "—" : esc(iso(fmtValue(r.opp, match.measure)))}</div></div>
        <div class="sc num">${fmtNum(r.scores.you)}<small>${scoreEmoji(r.scores.you)} ${r.loser === "you" ? "💥" : r.loser === "opp" ? "⚔️" : ""}</small></div>
      </div>`).join("");
    const art = win ? "trophy" : draw ? "medal" : "hourglass";
    setTimeout(() => {
      if (this.ended !== match) return;
      const panel = overlay(`
        <div class="end-body ${rows ? "" : "solo"}">
          <div class="end-left">
            <div class="end-hero">${win ? '<div class="rays" aria-hidden="true"></div>' : ""}${img3d(art, { size: 170, lazy: false })}</div>
            <h2 class="display end-title ${win ? "win" : ""}">${esc(title)}</h2>
            <p class="end-sub">${sub}</p>
            ${win ? `<div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none">${sparkles(10, "win-" + match.matchId, { area: [5, 2, 95, 60] })}</div>` : ""}
          </div>
          <div>
            ${rows ? `<div class="rounds-list">${rows}</div>` : ""}
            <div class="actions two">
              ${candy({ text: t("rematch"), tone: "lime", ico: "swords", id: "end-rematch" })}
              ${candy({ text: t("home"), tone: "cloud", ico: "home", id: "end-home" })}
            </div>
          </div>
        </div>`, { cls: "end-panel", look: win ? "screen" : draw ? "screen" : "lose" });
      panel.querySelector("#end-rematch").addEventListener("click", (e) => {
        const b = e.currentTarget;
        if (b.getAttribute("aria-disabled") === "true") return;
        b.setAttribute("aria-disabled", "true");
        juice.loading(b, true);
        this.net.send({ t: "rematch" });
      });
      panel.querySelector("#end-home").addEventListener("click", () => {
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
    toast(t("reconnected"), 2400, { tone: "mint" });
    if (m.phase === "guessing" && m.round) {
      this.round = { n: m.n, round: m.round, multiplier: m.multiplier, timeLeft: m.timeLeft, hp: m.hp };
      this.lockedN = m.myGuess != null ? m.n : 0;
      this.revealN = 0;
      this.setMultiplier(m.multiplier);
      this.drawRound(this.round, { myGuess: m.myGuess, oppLocked: m.oppLocked });
    } else if (m.phase === "reveal" && m.round && m.result) {
      this.round = { n: m.n, round: m.round, multiplier: m.result.multiplier, timeLeft: 0, hp: m.hp };
      this.setMultiplier(m.result.multiplier);
      this.drawRound(this.round, { myGuess: m.result.guesses.you, oppLocked: true });
      this.revealN = 0;
      this.onResult(m.result);
    }
  }
}
