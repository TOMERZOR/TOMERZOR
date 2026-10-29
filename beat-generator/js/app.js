"use strict";

// Page logic: keywords in, beat out, freestyle words on the bar, recording over the beat.
(function () {
  const $ = (id) => document.getElementById(id);

  // Phosphor icons (MIT), copied from @phosphor-icons/core 2.1.1.
  const ICONS = {
    play: '<path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"/>',
    stop: '<path d="M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z"/>',
    shuffle: '<path d="M240.49,175.51a12,12,0,0,1,0,17l-24,24a12,12,0,0,1-17-17L203,196h-2.09a76.17,76.17,0,0,1-61.85-31.83L97.38,105.78A52.1,52.1,0,0,0,55.06,84H32a12,12,0,0,1,0-24H55.06a76.17,76.17,0,0,1,61.85,31.83l41.71,58.39A52.1,52.1,0,0,0,200.94,172H203l-3.52-3.51a12,12,0,0,1,17-17Zm-95.62-72.62a12,12,0,0,0,16.93-1.13A52,52,0,0,1,200.94,84H203l-3.52,3.51a12,12,0,0,0,17,17l24-24a12,12,0,0,0,0-17l-24-24a12,12,0,0,0-17,17L203,60h-2.09a76,76,0,0,0-57.2,26A12,12,0,0,0,144.87,102.89Zm-33.74,50.22a12,12,0,0,0-16.93,1.13A52,52,0,0,1,55.06,172H32a12,12,0,0,0,0,24H55.06a76,76,0,0,0,57.2-26A12,12,0,0,0,111.13,153.11Z"/>',
    mic: '<path d="M80,128V64a48,48,0,0,1,96,0v64a48,48,0,0,1-96,0Zm128,0a8,8,0,0,0-16,0,64,64,0,0,1-128,0,8,8,0,0,0-16,0,80.11,80.11,0,0,0,72,79.6V240a8,8,0,0,0,16,0V207.6A80.11,80.11,0,0,0,208,128Z"/>',
    download: '<path d="M228,144v64a12,12,0,0,1-12,12H40a12,12,0,0,1-12-12V144a12,12,0,0,1,24,0v52H204V144a12,12,0,0,1,24,0Zm-108.49,8.49a12,12,0,0,0,17,0l40-40a12,12,0,0,0-17-17L140,115V32a12,12,0,0,0-24,0v83L96.49,95.51a12,12,0,0,0-17,17Z"/>',
    link: '<path d="M117.18,188.74a12,12,0,0,1,0,17l-5.12,5.12A58.26,58.26,0,0,1,70.6,228h0A58.62,58.62,0,0,1,29.14,127.92L63.89,93.17a58.64,58.64,0,0,1,98.56,28.11,12,12,0,1,1-23.37,5.44,34.65,34.65,0,0,0-58.22-16.58L46.11,144.89A34.62,34.62,0,0,0,70.57,204h0a34.41,34.41,0,0,0,24.49-10.14l5.11-5.12A12,12,0,0,1,117.18,188.74ZM226.83,45.17a58.65,58.65,0,0,0-82.93,0l-5.11,5.11a12,12,0,0,0,17,17l5.12-5.12a34.63,34.63,0,1,1,49,49L175.1,145.86A34.39,34.39,0,0,1,150.61,156h0a34.63,34.63,0,0,1-33.69-26.72,12,12,0,0,0-23.38,5.44A58.64,58.64,0,0,0,150.56,180h.05a58.28,58.28,0,0,0,41.47-17.17l34.75-34.75a58.62,58.62,0,0,0,0-82.91Z"/>',
    minus: '<path d="M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128Z"/>',
    plus: '<path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z"/>',
    skip: '<path d="M244,56v48a12,12,0,0,1-12,12H184a12,12,0,1,1,0-24H201.1l-19-17.38c-.13-.12-.26-.24-.38-.37A76,76,0,1,0,127,204h1a75.53,75.53,0,0,0,52.15-20.72,12,12,0,0,1,16.49,17.45A99.45,99.45,0,0,1,128,228h-1.37A100,100,0,1,1,198.51,57.06L220,76.72V56a12,12,0,0,1,24,0Z"/>',
    trash: '<path d="M216,48H180V36A28,28,0,0,0,152,8H104A28,28,0,0,0,76,36V48H40a12,12,0,0,0,0,24h4V208a20,20,0,0,0,20,20H192a20,20,0,0,0,20-20V72h4a12,12,0,0,0,0-24ZM100,36a4,4,0,0,1,4-4h48a4,4,0,0,1,4,4V48H100Zm88,168H68V72H188ZM116,104v64a12,12,0,0,1-24,0V104a12,12,0,0,1,24,0Zm48,0v64a12,12,0,0,1-24,0V104a12,12,0,0,1,24,0Z"/>'
  };
  const icon = (name) => `<svg class="ico" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${ICONS[name]}</svg>`;
  const setIcon = (el, name) => { el.innerHTML = icon(name); };
  document.querySelectorAll("[data-icon]").forEach((el) => setIcon(el, el.dataset.icon));

  const CHIP_GROUPS = [
    ["סגנון", ["טראפ", "דריל", "בום באפ", "לו-פיי", "רגאטון"]],
    ["וייב", ["אפל", "עצוב", "שמח", "אגרסיבי", "צ'יל", "אפי", "חלומי", "מזרחי"]],
    ["אווירה", ["לילה", "גשם", "קיץ", "ויניל", "מהיר", "איטי"]]
  ];
  const ROWS = [
    { id: "kick", label: "קיק", edit: "kick" },
    { id: "snare", label: "סנר", edit: "snare" },
    { id: "hat", label: "היי-האט", edit: "hat" },
    { id: "bass", label: "בס" },
    { id: "chords", label: "אקורדים" },
    { id: "melody", label: "מלודיה" }
  ];

  const state = {
    text: "",
    variation: 0,
    recipe: null,
    player: null,
    shownBar: -1,
    headStep: -1,
    every: 2,
    tab: "beat",
    recorder: null
  };
  const free = new BG.Freestyle();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const input = $("kw");
  const status = (msg, err = false) => { $("status").textContent = msg || ""; $("status").classList.toggle("err", err); };

  // Show any failure on the page, so it can be reported from a phone.
  const showError = (msg) => {
    status("תקלה: " + msg, true);
    $("go").disabled = false;
  };
  BG.onError = showError;
  window.addEventListener("error", (e) => showError(e.message || "error"));
  window.addEventListener("unhandledrejection", (e) => showError((e.reason && e.reason.message) || String(e.reason)));

  /* Keyword chips */
  const norm = (s) => " " + s.toLowerCase().replace(/[,،.;!?]/g, " ").replace(/\s+/g, " ").trim() + " ";
  const chipEls = [];
  for (const [title, words] of CHIP_GROUPS) {
    const group = document.createElement("div");
    group.className = "chip-group";
    group.innerHTML = `<span>${title}</span><div class="chip-row"></div>`;
    for (const w of words) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = w;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => toggleWord(w));
      group.lastChild.appendChild(b);
      chipEls.push(b);
    }
    $("chips").appendChild(group);
  }
  function syncChips() {
    const text = norm(input.value);
    chipEls.forEach((b) => b.setAttribute("aria-pressed", String(text.includes(norm(b.textContent)))));
  }
  function toggleWord(w) {
    const parts = input.value.split(/[,،]/).map((p) => p.trim()).filter(Boolean);
    const idx = parts.findIndex((p) => norm(p) === norm(w));
    if (idx >= 0) {
      parts.splice(idx, 1);
      input.value = parts.join(", ");
    } else if (norm(input.value).includes(norm(w))) {
      input.value = norm(input.value).replace(norm(w), " ").trim();
    } else {
      parts.push(w);
      input.value = parts.join(", ");
    }
    syncChips();
  }
  input.addEventListener("input", syncChips);

  /* Step sequencer */
  const cellEls = {};
  for (const row of ROWS) {
    const el = document.createElement("div");
    el.className = "row";
    el.dataset.row = row.id;
    const name = document.createElement("button");
    name.className = "row-name";
    name.textContent = row.label;
    name.setAttribute("aria-pressed", "false");
    name.title = "השתקה";
    name.addEventListener("click", () => toggleMute(row.id, name));
    const cells = document.createElement("div");
    cells.className = "cells";
    cellEls[row.id] = [];
    for (let s = 0; s < BG.STEPS; s++) {
      const c = document.createElement(row.edit ? "button" : "div");
      c.className = "cell";
      if (row.edit) {
        c.type = "button";
        c.setAttribute("aria-label", `${row.label}, צעד ${s + 1}`);
        c.addEventListener("click", () => editStep(row.edit, s));
      }
      cells.appendChild(c);
      cellEls[row.id].push(c);
    }
    el.append(name, cells);
    $("seq").appendChild(el);
  }

  function cellValue(rowId, bar, s) {
    const P = state.recipe.patterns;
    if (rowId === "kick") return { v: P.kick[bar][s] };
    if (rowId === "snare") return { v: Math.max(P.snare[bar][s], P.clap[bar][s], P.ghost[bar][s] * 0.45) };
    if (rowId === "hat") {
      const h = P.hat[bar][s];
      return { v: Math.max(h >= 2 ? 1 : h, P.open[bar][s]), roll: h >= 2 };
    }
    if (rowId === "bass") return { v: P.bass[bar][s] ? 1 : 0 };
    if (rowId === "chords") return { v: P.chord[bar][s] ? 1 : 0 };
    return { v: P.melody[bar][s] ? 0.9 : 0 };
  }

  function renderBar(bar, fresh = false) {
    state.shownBar = bar;
    let i = 0;
    for (const row of ROWS) {
      cellEls[row.id].forEach((c, s) => {
        const { v, roll } = cellValue(row.id, bar, s);
        c.classList.toggle("on", v > 0 && !roll);
        c.classList.toggle("roll", !!roll);
        c.style.setProperty("--v", (0.45 + 0.55 * v).toFixed(2));
        c.style.setProperty("--i", i++);
        if (row.edit) c.setAttribute("aria-pressed", String(v > 0));
      });
    }
    document.querySelectorAll("#bars li").forEach((li, b) => li.classList.toggle("on", b === bar));
    const seq = $("seq");
    if (fresh && !reduceMotion) {
      seq.classList.remove("fresh");
      void seq.offsetWidth;
      seq.classList.add("fresh");
    }
  }

  function moveHead(s) {
    if (state.headStep >= 0) for (const row of ROWS) cellEls[row.id][state.headStep].classList.remove("head");
    state.headStep = s;
    if (s >= 0) for (const row of ROWS) cellEls[row.id][s].classList.add("head");
  }

  function editStep(track, s) {
    if (!state.recipe) return;
    $("seq").classList.remove("fresh");
    const P = state.recipe.patterns;
    const bar = Math.max(0, state.shownBar);
    const turnOn = !P[track][bar][s];
    for (let b = 0; b < BG.BARS; b++) {
      P[track][b][s] = turnOn ? (track === "hat" ? 0.8 : 1) : 0;
      if (track === "snare" && !turnOn) { P.clap[b][s] = 0; P.ghost[b][s] = 0; }
      if (track === "hat" && !turnOn) P.open[b][s] = 0;
      // Keep the bass locked to the kick.
      if (track === "kick" && state.recipe.sound.style !== "dembow") {
        const root = P.bass[b].find((n) => n) || 0;
        if (turnOn && root) P.bass[b][s] = root;
        if (!turnOn && s > 0) { P.bass[b][s] = 0; P.slide[b][s] = 0; }
      }
    }
    renderBar(bar);
  }

  function toggleMute(id, btn) {
    if (!state.player || !state.player.rig) return;
    const mute = state.player.rig.mute;
    mute[id] = !mute[id];
    btn.setAttribute("aria-pressed", String(mute[id]));
    btn.closest(".row").classList.toggle("muted", mute[id]);
  }

  /* Freestyle stage */
  function buildCountdown(bars = state.every) {
    const box = $("countdown");
    box.innerHTML = "";
    for (let b = 0; b < bars; b++) {
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.innerHTML = "<i></i><i></i><i></i><i></i>";
      box.appendChild(bar);
    }
  }
  function showWord(word) {
    const el = $("word");
    el.textContent = word;
    $("next-word").textContent = free.next || "...";
    if (!reduceMotion) { el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap"); }
  }
  // During the intro the stage counts down 4, 3, 2, 1, then the words start with the beat.
  function tickCountdown(step) {
    const abs = Math.floor(step / BG.STEPS);
    const s = step % BG.STEPS;
    const intro = abs < BG.INTRO_BARS;
    const barIndex = intro ? abs : abs - BG.INTRO_BARS;
    const span = intro ? BG.INTRO_BARS : state.every;
    if (s === 0) {
      if (intro) {
        if (!free.next) free.next = free.draw();
        $("word").textContent = String(BG.INTRO_BARS - abs);
        $("next-word").textContent = free.next;
      } else if (barIndex % state.every === 0) {
        showWord(free.advance());
      }
    }
    if ($("countdown").children.length !== span) buildCountdown(span);
    const pos = (barIndex % span) * 4 + Math.floor(s / 4);
    $("countdown").querySelectorAll("i").forEach((el, i) => {
      el.classList.toggle("done", i < pos);
      el.classList.toggle("now", i === pos);
    });
  }
  document.querySelectorAll("[data-every]").forEach((b) => b.addEventListener("click", () => {
    state.every = Number(b.dataset.every);
    document.querySelectorAll("[data-every]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    buildCountdown();
  }));
  $("use-mine").addEventListener("change", (e) => { free.useExtra = e.target.checked; free.deck = []; });
  $("skip").addEventListener("click", () => showWord(free.advance()));
  buildCountdown();

  /* Tabs */
  const tabs = [$("tab-beat"), $("tab-free")];
  function selectTab(name) {
    state.tab = name;
    tabs.forEach((t) => {
      const on = t.id === "tab-" + name;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    $("panel-beat").hidden = name !== "beat";
    $("panel-free").hidden = name !== "free";
    if (name === "free" && !free.current) { free.advance(); showWord(free.current); }
    revealDeck();
  }
  // On phones the deck sits under the form, so bring it into view when it changes.
  function revealDeck() {
    if (!matchMedia("(max-width: 900px)").matches) return;
    const deck = document.querySelector(".deck");
    if (deck.getBoundingClientRect().top > window.innerHeight * 0.5) deck.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
  tabs.forEach((t) => {
    t.addEventListener("click", () => selectTab(t.id === "tab-beat" ? "beat" : "free"));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const other = tabs.find((x) => x !== t);
      other.focus();
      other.click();
    });
  });

  /* Beat */
  // Shows which part of the song is playing and dims the tracks that rest in it.
  function showSection(sec) {
    if (sec === state.section) return;
    state.section = sec;
    $("section").textContent = sec === "intro" ? "פתיחה" : sec === "break" ? "ברייק" : "";
    const heavy = state.recipe && (state.recipe.style === "trap" || state.recipe.style === "drill");
    const resting = sec === "intro" ? ["kick", "snare", "hat", "bass"] : sec === "break" ? (heavy ? ["kick", "snare", "bass"] : ["hat"]) : [];
    document.querySelectorAll(".row").forEach((row) => row.classList.toggle("resting", resting.includes(row.dataset.row)));
  }

  function ensurePlayer() {
    if (!state.player) {
      state.player = new BG.Player();
      state.player.onStep = (step) => {
        const bar = Math.floor(step / BG.STEPS) % BG.BARS;
        if (bar !== state.shownBar) renderBar(bar);
        moveHead(step % BG.STEPS);
        showSection(BG.section(Math.floor(step / BG.STEPS)));
        tickCountdown(step);
      };
    }
    return state.player;
  }

  function setAudioSession(type) {
    try { if (navigator.audioSession) navigator.audioSession.type = type; } catch (e) { /* not supported */ }
  }

  function updateReadout(parsed) {
    const r = state.recipe;
    $("readout").hidden = false;
    $("r-bpm").textContent = r.bpm;
    $("bpm-out").textContent = r.bpm;
    $("r-style").textContent = r.styleLabel;
    $("r-key").textContent = r.keyLabel;
    $("r-moods").textContent = r.moods.length ? r.moods.map((m) => BG.MOODS[m].label).join(", ") : "ללא";
    const note = $("r-note");
    note.textContent = "";
    if (!parsed.text) note.textContent = "בלי מילים? קיבלתם ביט אקראי.";
    else if (!parsed.styles.length && !parsed.moods.length) note.textContent = "המכונה לא זיהתה סגנון או וייב, אז הביט הוגרל לפי המילים.";
    if (parsed.unknown.length) {
      const label = document.createElement("span");
      label.textContent = (note.textContent ? " " : "") + "נכנסו לבנק הפריסטייל: ";
      const words = document.createElement("b");
      words.textContent = parsed.unknown.join(", ");
      note.append(label, words);
    }
  }

  function setControls(enabled) {
    ["play", "slower", "faster", "again", "rec", "dl", "share"].forEach((id) => ($(id).disabled = !enabled));
  }

  function setPlayIcon() {
    const playing = state.player && state.player.playing;
    setIcon($("play"), playing ? "stop" : "play");
    $("play").setAttribute("aria-label", playing ? "עצור" : "נגן");
  }

  async function generate({ autoplay = true } = {}) {
    $("go").disabled = true;
    $("again").disabled = true;
    status("מכין סאונד...");
    let parsed, recipe;
    try {
      const player = ensurePlayer();
      parsed = BG.parseKeywords(state.text);
      recipe = BG.makeRecipe(parsed, state.variation);
      free.setExtra(parsed.unknown);
      await player.load(recipe, (stage, done, total) => {
        status(stage === "samples" ? `טוען סאונדים ${done}/${total}...` : "מכין כלים...");
      });
    } catch (e) {
      console.error(e);
      status("משהו נתקע בהכנת הסאונד. נסו שוב. (" + ((e && e.message) || e) + ")", true);
      $("go").disabled = false;
      if (state.recipe) $("again").disabled = false;
      return;
    }
    const player = state.player;
    state.recipe = recipe;
    document.body.classList.add("ready");
    setControls(true);
    $("go").disabled = false;
    updateReadout(parsed);
    renderBar(player.playing ? Math.max(0, state.shownBar) : 0, true);
    if (autoplay && !player.playing) player.start();
    if (autoplay) revealDeck();
    setPlayIcon();
    if (!$("status").classList.contains("err")) status(autoplay || player.playing ? "" : "הביט מוכן. לחצו על נגן.");
    writeHash();
  }

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    Tone.start();
    setAudioSession("playback");
    state.text = input.value.trim();
    const link = state.linked && state.linked.text === state.text ? state.linked : null;
    state.linked = null;
    state.variation = link ? link.variation : 0;
    await generate();
    if (link && link.bpm && state.recipe) nudgeBpm(link.bpm - state.recipe.bpm);
  });

  $("again").addEventListener("click", () => {
    Tone.start();
    state.variation++;
    generate();
  });

  $("play").addEventListener("click", togglePlay);
  async function togglePlay() {
    if (!state.recipe) return;
    await Tone.start();
    const p = state.player;
    if (p.playing) {
      if (state.recorder) stopRecording();
      p.stop();
      moveHead(-1);
      showSection(null);
    } else {
      p.start();
    }
    setPlayIcon();
  }

  function nudgeBpm(delta) {
    if (!state.recipe) return;
    const bpm = Math.max(60, Math.min(170, state.recipe.bpm + delta));
    state.player.setBpm(bpm);
    $("bpm-out").textContent = bpm;
    $("r-bpm").textContent = bpm;
    writeHash();
  }
  $("slower").addEventListener("click", () => nudgeBpm(-2));
  $("faster").addEventListener("click", () => nudgeBpm(2));

  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || !state.recipe) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "BUTTON" || tag === "AUDIO") return;
    e.preventDefault();
    togglePlay();
  });

  /* Download the beat as WAV */
  const fileBase = () => `beat-${state.recipe.style}-${state.recipe.bpm}bpm`;
  function saveBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  $("dl").addEventListener("click", async () => {
    if (!state.recipe) return;
    const btn = $("dl");
    btn.disabled = true;
    $("go").disabled = true;
    $("again").disabled = true;
    $("dl-label").textContent = "מכין קובץ...";
    status("מכין ביט של שתי דקות, עם פתיחה וברייק...");
    try {
      const buffer = await BG.renderSong(JSON.parse(JSON.stringify(state.recipe)), 120);
      saveBlob(BG.encodeWav(buffer), fileBase() + ".wav");
      status("הקובץ ירד.");
    } catch (e) {
      console.error(e);
      status("ההורדה נכשלה. נסו שוב.", true);
    }
    $("dl-label").textContent = "הורדה";
    btn.disabled = false;
    $("go").disabled = false;
    $("again").disabled = false;
  });

  /* Share link */
  function writeHash() {
    const params = new URLSearchParams();
    if (state.text) params.set("k", state.text);
    if (state.variation) params.set("v", state.variation);
    if (state.recipe && state.recipe.bpm !== BG.makeRecipe(BG.parseKeywords(state.text), state.variation).bpm) params.set("bpm", state.recipe.bpm);
    history.replaceState(null, "", "#" + params.toString());
  }
  $("share").addEventListener("click", async () => {
    const url = location.href;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: "Beat Generator", text: state.text || "ביט לפריסטייל", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      status("הקישור הועתק. מי שיפתח אותו יקבל את אותו ביט.");
    } catch (e) {
      if (e.name !== "AbortError") status("לא הצלחתי להעתיק. אפשר להעתיק את הכתובת מהדפדפן.", true);
    }
  });

  /* Recording: voice and beat together */
  let micStream = null;
  let takeCount = 0;
  $("rec").addEventListener("click", () => (state.recorder ? stopRecording() : startRecording()));

  async function startRecording() {
    if (!window.MediaRecorder || !navigator.mediaDevices) {
      status("הדפדפן הזה לא תומך בהקלטה. נסו כרום או ספארי עדכני.", true);
      return;
    }
    await Tone.start();
    try {
      if (!micStream) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      }
    } catch (e) {
      status("אין גישה למיקרופון. אפשרו אותה בהגדרות הדפדפן ונסו שוב.", true);
      return;
    }
    setAudioSession("play-and-record");
    const raw = Tone.getContext().rawContext;
    const dest = raw.createMediaStreamDestination();
    const mic = raw.createMediaStreamSource(micStream);
    mic.connect(dest);
    // You hear the beat late and the mic hears you late, so delay the beat in the mix by the same amount.
    const track = micStream.getAudioTracks()[0];
    const lag = (raw.outputLatency || 0) + (raw.baseLatency || 0) + ((track.getSettings && track.getSettings().latency) || 0.01);
    const delay = raw.createDelay(1);
    delay.delayTime.value = Math.min(0.5, lag);
    state.player.out.connect(delay);
    delay.connect(dest);

    const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const rec = new MediaRecorder(dest.stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const started = Date.now();
    const meta = { style: state.recipe.styleLabel, bpm: state.recipe.bpm };
    rec.onstop = () => {
      state.player.out.disconnect(delay);
      mic.disconnect();
      setAudioSession("playback");
      addTake(new Blob(chunks, { type: rec.mimeType || type || "audio/webm" }), meta, (Date.now() - started) / 1000);
    };
    rec.start(250);
    state.recorder = { rec, started, timer: setInterval(() => ($("rec-label").textContent = clock((Date.now() - started) / 1000)), 250) };
    $("rec").classList.add("live");
    setIcon($("rec").querySelector("[data-icon]"), "stop");
    $("rec").setAttribute("aria-label", "עצור הקלטה");
    $("rec-label").textContent = "0:00";
    status("מקליט. עם אוזניות הקול יוצא נקי יותר.");
    if (!state.player.playing) { state.player.start(); setPlayIcon(); }
  }

  function stopRecording() {
    const r = state.recorder;
    if (!r) return;
    clearInterval(r.timer);
    r.rec.stop();
    state.recorder = null;
    $("rec").classList.remove("live");
    setIcon($("rec").querySelector("[data-icon]"), "mic");
    $("rec").removeAttribute("aria-label");
    $("rec-label").textContent = "הקלטה";
    status("");
  }

  const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

  function addTake(blob, meta, seconds) {
    takeCount++;
    const url = URL.createObjectURL(blob);
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const li = document.createElement("li");
    li.className = "take";
    const name = document.createElement("span");
    name.className = "take-name";
    name.textContent = `טייק ${takeCount}`;
    const m = document.createElement("span");
    m.className = "take-meta";
    m.textContent = `${meta.style}, ${meta.bpm} BPM, ${clock(seconds)}`;
    name.appendChild(m);
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = url;
    const dl = document.createElement("a");
    dl.className = "btn btn-icon";
    dl.href = url;
    dl.download = `freestyle-${takeCount}.${ext}`;
    dl.setAttribute("aria-label", `הורדת טייק ${takeCount}`);
    dl.innerHTML = icon("download");
    const del = document.createElement("button");
    del.className = "btn btn-icon";
    del.setAttribute("aria-label", `מחיקת טייק ${takeCount}`);
    del.innerHTML = icon("trash");
    del.addEventListener("click", () => {
      li.remove();
      URL.revokeObjectURL(url);
      if (!$("take-list").children.length) $("takes").hidden = true;
    });
    li.append(name, audio, dl, del);
    $("take-list").prepend(li);
    $("takes").hidden = false;
  }

  /* Open a shared link. Only the words are filled in: browsers (iPhones above all) block audio until a tap,
     and loading samples before it can hang, so the beat is built on the first tap of the button. */
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.has("k") || params.has("v")) {
    input.value = params.get("k") || "";
    syncChips();
    const bpm = Number(params.get("bpm"));
    state.linked = { text: input.value.trim(), variation: Number(params.get("v")) || 0, bpm: bpm >= 60 && bpm <= 170 ? bpm : 0 };
    status("לחצו על צור ביט כדי לשמוע את הביט מהקישור.");
  }
})();
