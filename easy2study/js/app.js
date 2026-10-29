// Easy2Study: the whole app. Vanilla JS, no build step. Everything the learner
// tells us stays in this browser (localStorage); the AI tutor only gets the
// learning profile (never the name) when it writes or explains a lesson.
(() => {
  "use strict";

  const KEY = "easy2study:v1";
  const SPRITE = "icons/sprite.svg";
  const SUBJECTS = window.E2S_SUBJECTS;
  const BUILTIN = window.E2S_LESSONS;
  const Tutor = window.E2STutor;
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- State ----------
  function defaults() {
    return {
      profile: null,
      settings: { size: "m", comfort: false, theme: "auto", motion: "auto", read: false, sound: true },
      lessons: {},
      courses: {},
      log: [],
      days: [],
    };
  }
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      const d = defaults();
      return { ...d, ...raw, settings: { ...d.settings, ...(raw.settings || {}) } };
    } catch {
      return defaults();
    }
  }
  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode: keep going in memory */ }
  }

  // ---------- Helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (name, cls = "") => `<svg class="icon ${cls}" aria-hidden="true"><use href="${SPRITE}#i-${name}"/></svg>`;
  let draftGender = null;
  const gender = () => (S.profile && S.profile.gender) || draftGender || "m";
  // Masculine or feminine wording, from the profile.
  const g = (m, f) => (gender() === "f" ? f : m);
  const gfill = (s) => String(s ?? "").replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m, f) => g(m, f));
  const reduceMotion = () => S.settings.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const today = () => new Date().toISOString().slice(0, 10);

  // Latin runs (English in a Hebrew sentence) are isolated so punctuation lands right.
  // English and formulas inside Hebrew: each run of Latin text (with the digits,
  // subscripts and math signs around it: O=O, H₂SO₄, 2H₂ + O₂ → 2H₂O) is isolated
  // so the browser can't flip its parts. Punctuation that ends the run belongs
  // to the Hebrew sentence, so it stays outside.
  const HEB = /[\u0590-\u05FF]/;
  const LATIN = /[0-9]*[A-Za-z_][A-Za-z0-9_\u00B2\u00B3\u00B9\u2070-\u209F'’"\-+=*/^%<>≈≠≤≥°×÷·→←↔⇌().,?!:;\[\]\s]*/g;
  function latinRun(raw) {
    // A whole English sentence ("I play football every day.") keeps its own period.
    const sentence = /^[A-Z]/.test(raw) && (raw.match(/[A-Za-z]{2,}/g) || []).length >= 3;
    let run = sentence ? raw.replace(/\s+$/, "").replace(/[,:;(\["'’\-]+$/, "") : raw.replace(/[\s.,?!:;(\["'’\-]+$/, "");
    const unclosed = (o, c) => run.endsWith(c) && run.split(o).length < run.split(c).length;
    while (unclosed("(", ")") || unclosed("[", "]")) run = run.slice(0, -1).replace(/[\s.,?!:;]+$/, "");
    return run;
  }
  function plain(t) {
    let out = "", last = 0;
    for (const m of t.matchAll(LATIN)) {
      const run = latinRun(m[0]);
      out += esc(t.slice(last, m.index)) + `<bdi>${esc(run)}</bdi>`;
      last = m.index + run.length;
    }
    return out + esc(t.slice(last));
  }
  const frac = (a, b) => `<span class="frac" role="img" aria-label="${esc(a)} חלקי ${esc(b)}"><span>${esc(a)}</span><i></i><span>${esc(b)}</span></span>`;
  function inline(line) {
    const re = /\*\*(.+?)\*\*|\[\[(\d+)\/(\d+)\]\]/g;
    let out = "", last = 0, m;
    while ((m = re.exec(line))) {
      out += plain(line.slice(last, m.index));
      out += m[1] ? `<button type="button" class="term" data-term="${esc(m[1])}">${plain(m[1])}</button>` : frac(m[2], m[3]);
      last = re.lastIndex;
    }
    return out + plain(line.slice(last));
  }
  // Lesson text: **term**, [[a/b]], {m|f}, one line per sentence group.
  function rich(src, { lines = true } = {}) {
    const text = gfill(src).trim();
    // A line with no Hebrew at all (an English sentence, an equation) reads left to right.
    const ltr = (l) => !HEB.test(l) && /[A-Za-z0-9]/.test(l);
    if (!lines) {
      const one = text.replace(/\n+/g, " ");
      return ltr(one) ? `<bdi dir="ltr">${inline(one)}</bdi>` : inline(one);
    }
    return text.split(/\n+/).map((l, i) => `<span class="line" style="--i:${i}"${ltr(l) ? ' dir="ltr"' : ""}>${inline(l)}</span>`).join("");
  }
  const spoken = (src) => gfill(src).replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[\[(\d+)\/(\d+)\]\]/g, "$1 חלקי $2");

  function toast(msg) {
    $$(".toast").forEach((t) => t.remove());
    const t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function burst(el) {
    if (reduceMotion() || !el) return;
    const r = el.getBoundingClientRect();
    const b = document.createElement("div");
    b.className = "burst";
    b.style.left = r.left + r.width * 0.5 + "px";
    b.style.top = r.top + r.height * 0.5 + "px";
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
      const d = 60 + Math.random() * 70;
      const p = document.createElement("i");
      p.style.setProperty("--x", Math.cos(a) * d + "px");
      p.style.setProperty("--y", Math.sin(a) * d - 20 + "px");
      p.style.setProperty("--r", Math.round(Math.random() * 360) + "deg");
      p.style.animationDelay = Math.random() * 60 + "ms";
      b.appendChild(p);
    }
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 900);
  }

  function vibrate(ms) {
    try { if (!reduceMotion() && navigator.vibrate) navigator.vibrate(ms); } catch { /* not supported */ }
  }

  // Small synthesized sounds (no audio files): a soft tick for every "got it",
  // a two-note chime for a right answer, a short rising tune at the finish.
  const Sound = (() => {
    let ctx = null;
    function audio() {
      if (!ctx) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A) return null;
        ctx = new A();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function tone(freq, at, dur, { type = "sine", gain = 0.05, to } = {}) {
      const c = audio();
      if (!c) return;
      const t = c.currentTime + at;
      const o = c.createOscillator();
      const v = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      v.gain.setValueAtTime(0.0001, t);
      v.gain.exponentialRampToValueAtTime(gain, t + 0.015);
      v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(v).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.03);
    }
    const on = () => S.settings.sound !== false;
    const play = (fn) => { try { if (on()) fn(); } catch { /* audio blocked */ } };
    return {
      tick: () => play(() => tone(620, 0, 0.11, { to: 930, gain: 0.045 })),
      step: () => play(() => tone(540, 0, 0.09, { type: "triangle", gain: 0.05 })),
      right: () => play(() => { tone(784, 0, 0.18, { type: "triangle", gain: 0.07 }); tone(1175, 0.1, 0.3, { type: "triangle", gain: 0.06 }); }),
      soft: () => play(() => tone(440, 0, 0.2, { gain: 0.035 })),
      win: () => play(() => [523, 659, 784, 1047].forEach((f, k) => tone(f, k * 0.1, 0.36, { type: "triangle", gain: 0.055 }))),
    };
  })();

  // ---------- Settings applied to the page ----------
  function applySettings() {
    const st = S.settings;
    root.dataset.size = st.size;
    root.dataset.comfort = st.comfort ? "on" : "off";
    if (st.theme === "auto") delete root.dataset.theme; else root.dataset.theme = st.theme;
    root.dataset.motion = st.motion;
    const dark = st.theme === "dark" || (st.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    $('meta[name="theme-color"]').setAttribute("content", dark ? "#0e1412" : "#f4f7f5");
  }

  // ---------- Profile ----------
  const GRADES = [
    ["1", "א׳"], ["2", "ב׳"], ["3", "ג׳"], ["4", "ד׳"], ["5", "ה׳"], ["6", "ו׳"],
    ["7", "ז׳"], ["8", "ח׳"], ["9", "ט׳"], ["10", "י׳"], ["11", "י״א"], ["12", "י״ב"],
    ["post", "אחרי תיכון"], ["none", "לא בבית ספר"],
  ];
  const LAZY = () => [
    { label: "מכונת למידה", desc: g("תן לי את כל החומר, אני על זה", "תני לי את כל החומר, אני על זה") },
    { label: g("חרוץ רוב הזמן", "חרוצה רוב הזמן"), desc: g("לומד כשצריך, בלי דרמות", "לומדת כשצריך, בלי דרמות") },
    { label: "תלוי במצב הרוח", desc: "יש ימים כאלה ויש ימים אחרים" },
    { label: "רק אם זה קצר", desc: "חתיכות קטנות, בבקשה" },
    { label: "הספה ואני זה סיפור אהבה", desc: "הכי קל שיש, ובלי להתאמץ" },
  ];
  const FOCUS = [
    { v: 5, label: "בערך 5 דקות", sub: "ואז הראש כבר במקום אחר" },
    { v: 10, label: "בערך 10 דקות" },
    { v: 20, label: "בערך 20 דקות" },
    { v: 30, label: "חצי שעה ויותר" },
  ];
  const STYLES = [
    { id: "examples", label: "דוגמאות מהחיים", icon: "lightbulb" },
    { id: "visual", label: "ציורים ותרשימים", icon: "image" },
    { id: "listen", label: "לשמוע בקול", icon: "speaker-high" },
    { id: "practice", label: "לתרגל שאלות", icon: "list-checks" },
    { id: "stories", label: "סיפורים", icon: "book-open-text" },
    { id: "short", label: "רשימות קצרות", icon: "cards" },
  ];
  const NEEDS = () => [
    { id: "adhd", label: "קשב וריכוז", sub: "הראש בורח מהר" },
    { id: "dyslexia", label: "קשה לי לקרוא הרבה טקסט", sub: "למשל דיסלקציה" },
    { id: "dyscalculia", label: "קשה לי עם מספרים", sub: "למשל דיסקלקוליה" },
    { id: "anxiety", label: "לחץ לפני מבחנים" },
    { id: "starting", label: "קשה לי להתחיל" },
    { id: "language", label: "עברית היא לא השפה הראשונה שלי" },
    { id: "none", label: "אין משהו מיוחד" },
  ];
  const INTERESTS = ["כדורגל", "כדורסל", "גיימינג", "מוזיקה", "טיקטוק ויוטיוב", "חיות", "אוכל ובישול", "ציור ויצירה", "אופנה", "מדע וחלל", "ריקוד", "מכוניות", "סדרות וסרטים", "טבע וטיולים"];
  const TONES = () => [
    { id: "friend", label: g("כמו חבר", "כמו חברה"), sub: "בגובה העיניים, עם קצת הומור" },
    { id: "calm", label: "רגוע ועדין", sub: "לאט, בסבלנות, בלי לחץ" },
    { id: "short", label: "קצר ולעניין", sub: "בלי חפירות" },
  ];

  function derive(p = S.profile || {}) {
    const lazy = p.lazy || 3;
    const needs = new Set(p.needs || []);
    const styles = new Set(p.styles || []);
    let sentences = [4, 3, 3, 2, 2][lazy - 1];
    if (needs.has("adhd")) sentences = Math.min(sentences, 2);
    let focus = p.focus || 10;
    if (needs.has("adhd")) focus = Math.min(focus, 10);
    return {
      sentences,
      focus,
      read: needs.has("dyslexia") || styles.has("listen"),
      comfort: needs.has("dyslexia"),
      large: needs.has("dyslexia") || (p.age && p.age <= 8),
      calm: needs.has("anxiety"),
      small: needs.has("starting") || lazy >= 4,
    };
  }

  // What the AI tutor gets. No name.
  function profileForAI() {
    const p = S.profile || {};
    const grade = GRADES.find(([v]) => v === p.grade);
    return {
      age: p.age || null,
      grade: grade ? grade[1] : null,
      gender: p.gender || "m",
      laziness: p.lazy || 3,
      focus_minutes: derive(p).focus,
      max_sentences: derive(p).sentences,
      styles: (p.styles || []).map((id) => (STYLES.find((s) => s.id === id) || {}).label).filter(Boolean),
      needs: (p.needs || []).filter((n) => n !== "none"),
      interests: p.interests || [],
      tone: p.tone || "friend",
    };
  }

  // ---------- Screens ----------
  let current = { name: null };
  function mount(html, cls = "") {
    stopSpeaking();
    closeSheet(true);
    const app = $("#app");
    const old = $(".screen:not(.screen--leave)", app);
    const el = document.createElement("main");
    el.className = `screen ${cls} screen--enter`;
    el.innerHTML = html;
    if (old) {
      old.classList.remove("screen--enter");
      old.classList.add("screen--leave");
      setTimeout(() => old.remove(), 200);
    }
    app.appendChild(el);
    window.scrollTo(0, 0);
    el.addEventListener("animationend", (e) => { if (e.target === el) el.classList.remove("screen--enter"); });
    const f = $("[data-autofocus]", el);
    if (f) f.focus({ preventScroll: true });
    return el;
  }

  // Welcome ---------------------------------------------------------------
  function welcome() {
    current = { name: "welcome" };
    const el = mount(`
      <div class="topbar"><span class="brand" aria-label="Easy2Study">Easy<b>2</b>Study</span></div>
      <div class="welcome__art" aria-hidden="true">
        <div class="bites-art">
          <div class="bite-art"><div class="bite-art__line bite-art__line--accent"></div><div class="bite-art__line"></div></div>
          <div class="bite-art"><div class="bite-art__line bite-art__line--accent"></div><div class="bite-art__line"></div><div class="bite-art__line" style="width:70%"></div></div>
          <div class="bite-art"><span class="bite-art__q">${icon("question")}</span><div class="bite-art__line bite-art__line--accent"></div><div class="bite-art__line"></div><div class="bite-art__line" style="width:62%"></div><div class="bite-art__row"><div class="bite-art__pill"></div><div class="bite-art__pill bite-art__pill--accent"></div></div></div>
        </div>
      </div>
      <div class="welcome__copy stagger">
        <h1 class="h1" style="--i:0" tabindex="-1" data-autofocus>ללמוד למבחן, בקצב שלך.</h1>
        <p class="lead" style="--i:1">הסברים קצרים במילים פשוטות, חתיכה אחרי חתיכה. ותמיד אפשר להגיד "לא הבנתי".</p>
      </div>
      <div class="welcome__actions">
        <button class="btn btn--primary btn--block" data-go>מתחילים ${icon("arrow-left")}</button>
        <p class="small muted" style="text-align:center;margin:8px 0 0">לוקח פחות מדקה. בלי הרשמה.</p>
      </div>`, "welcome");
    $("[data-go]", el).onclick = () => onboarding(0, {});
  }

  // Onboarding ------------------------------------------------------------
  const STEPS = ["name", "age", "grade", "lazy", "focus", "styles", "needs", "interests", "tone"];

  function onboarding(i, draft) {
    current = { name: "onboarding", i };
    if (draft.gender) draftGender = draft.gender;
    const step = STEPS[i];
    const segs = STEPS.map((_, k) => `<span class="ob__seg" ${k <= i ? "data-on" : ""}></span>`).join("");
    const optionalSteps = new Set(["styles", "needs", "interests"]);
    const el = mount(`
      <div class="topbar">
        <button class="icon-btn" data-back aria-label="חזרה">${icon("arrow-right")}</button>
        <div class="ob__progress" aria-hidden="true">${segs}</div>
        <span class="small muted" style="white-space:nowrap">${i + 1} מתוך ${STEPS.length}</span>
      </div>
      <div class="ob__body stagger">${obStep(step, draft)}</div>
      <div class="ob__foot">
        <button class="btn btn--primary btn--block" data-next>${i === STEPS.length - 1 ? "סיימנו" : "הבא"} ${icon("arrow-left")}</button>
        ${optionalSteps.has(step) ? `<button class="btn btn--ghost" data-skip>אפשר לדלג</button>` : ""}
      </div>`, "ob");
    $$(".ob__body > *", el).forEach((c, k) => c.style.setProperty("--i", k));
    const next = $("[data-next]", el);
    const valid = () => {
      if (step === "name") return Boolean(draft.gender);
      if (step === "grade") return Boolean(draft.grade);
      return true;
    };
    const refresh = () => { next.disabled = !valid(); };
    obBind(step, el, draft, refresh);
    refresh();
    $("[data-back]", el).onclick = () => (i === 0 ? (S.profile ? home() : welcome()) : onboarding(i - 1, draft));
    next.onclick = () => (i === STEPS.length - 1 ? finishOnboarding(draft) : onboarding(i + 1, draft));
    const skip = $("[data-skip]", el);
    if (skip) skip.onclick = () => (i === STEPS.length - 1 ? finishOnboarding(draft) : onboarding(i + 1, draft));
  }

  const choiceRow = (attrs, label, sub, multi) => `
    <button type="button" class="choice" role="${multi ? "checkbox" : "radio"}" ${multi ? "data-multi" : ""} ${attrs}>
      <span class="choice__mark">${icon("check")}</span>
      <span class="choice__text">${esc(label)}${sub ? `<span class="choice__sub">${esc(sub)}</span>` : ""}</span>
    </button>`;

  function obStep(step, d) {
    switch (step) {
      case "name":
        return `
          <div class="ob__q"><h1 class="h2" tabindex="-1" data-autofocus>היי! איך קוראים לך?</h1></div>
          <div class="field"><label class="sr-only" for="ob-name">שם</label>
            <input id="ob-name" class="input" autocomplete="given-name" maxlength="24" placeholder="השם שלך" value="${esc(d.name || "")}"></div>
          <div class="ob__q"><h2 class="h3">איך לפנות אליך?</h2></div>
          <div class="choices" role="radiogroup" aria-label="איך לפנות אליך">
            ${choiceRow(`data-gender="m" aria-checked="${d.gender === "m"}"`, "בלשון זכר", "אתה")}
            ${choiceRow(`data-gender="f" aria-checked="${d.gender === "f"}"`, "בלשון נקבה", "את")}
          </div>`;
      case "age":
        if (!d.age) d.age = 13;
        return `
          <div class="ob__q"><h1 class="h2" tabindex="-1" data-autofocus>${g("בן", "בת")} כמה ${g("אתה", "את")}?</h1>
          <p class="lead">ככה נדע באיזה מילים להסביר.</p></div>
          <div class="stepper">
            <button type="button" class="stepper__btn" data-age="1" aria-label="להוסיף שנה">+</button>
            <output class="stepper__value" aria-live="polite">${d.age}</output>
            <button type="button" class="stepper__btn" data-age="-1" aria-label="להוריד שנה">−</button>
          </div>`;
      case "grade":
        if (!d.grade && d.age) {
          const k = d.age - 6;
          d.grade = d.age >= 19 ? "post" : k >= 1 && k <= 12 ? String(k) : null;
        }
        return `
          <div class="ob__q"><h1 class="h2" tabindex="-1" data-autofocus>באיזו כיתה?</h1></div>
          <div class="grade-grid" role="radiogroup" aria-label="כיתה">
            ${GRADES.map(([v, l]) => `<button type="button" role="radio" class="chip ${v.length > 2 ? "chip--wide" : ""}" data-grade="${v}" aria-checked="${d.grade === v}">${l}</button>`).join("")}
          </div>`;
      case "lazy": {
        if (!d.lazy) d.lazy = 3;
        const L = LAZY()[d.lazy - 1];
        return `
          <div class="ob__q"><h1 class="h2" tabindex="-1" data-autofocus>כמה עצלנות יש בך?</h1>
          <p class="lead">בכנות. אף אחד לא שופט, וזה רק כדי שנדע כמה לחתוך.</p></div>
          <div class="lazy">
            <div class="lazy__face"><div class="lazy__text"><div class="lazy__label">${esc(L.label)}</div><div class="lazy__desc">${esc(L.desc)}</div></div><span class="lazy__meter" style="transform:scaleX(${d.lazy / 5})"></span></div>
            <input class="range" type="range" min="1" max="5" step="1" value="${d.lazy}" aria-label="רמת עצלנות, 1 עד 5" aria-valuetext="${esc(L.label)}">
            <div class="range__ends" aria-hidden="true"><span>אש בעיניים</span><span>מצב ספה</span></div>
          </div>`;
      }
      case "focus":
        if (!d.focus) d.focus = 10;
        return `
          <div class="ob__q"><h1 class="h2" tabindex="-1" data-autofocus>כמה זמן ${g("אתה מצליח", "את מצליחה")} להתרכז ברצף?</h1>
          <p class="lead">לפי זה נציע הפסקות קטנות בזמן הנכון.</p></div>
          <div class="choices" role="radiogroup" aria-label="זמן ריכוז">
            ${FOCUS.map((f) => choiceRow(`data-focus="${f.v}" aria-checked="${d.focus === f.v}"`, f.label, f.sub)).join("")}
          </div>`;
      case "styles":
        d.styles = d.styles || [];
        return `
          <div class="ob__q"><h1 class="h2" tabindex="-1" data-autofocus>מה הכי עוזר לך להבין?</h1>
          <p class="lead">אפשר לבחור כמה.</p></div>
          <div class="chips">
            ${STYLES.map((s) => `<button type="button" class="chip" data-style="${s.id}" aria-pressed="${d.styles.includes(s.id)}">${icon(s.icon)}${s.label}</button>`).join("")}
          </div>`;
      case "needs":
        d.needs = d.needs || [];
        return `
          <div class="ob__q"><h1 class="h2" tabindex="-1" data-autofocus>יש משהו שיעזור לנו להתאים את עצמנו אליך?</h1></div>
          <div class="ob__note">${icon("heart", "icon--sm")}<span>לא חובה. זה נשמר רק אצלך במכשיר, ומשמש רק כדי להסביר לך טוב יותר.</span></div>
          <div class="choices">
            ${NEEDS().map((n) => choiceRow(`data-need="${n.id}" aria-checked="${d.needs.includes(n.id)}"`, n.label, n.sub, true)).join("")}
          </div>`;
      case "interests":
        d.interests = d.interests || [];
        return `
          <div class="ob__q"><h1 class="h2" tabindex="-1" data-autofocus>מה ${g("אתה אוהב", "את אוהבת")}?</h1>
          <p class="lead">נביא דוגמאות מהעולם שלך. אפשר לבחור כמה.</p></div>
          <div class="chips">
            ${INTERESTS.map((x) => `<button type="button" class="chip" data-interest="${esc(x)}" aria-pressed="${d.interests.includes(x)}">${esc(x)}</button>`).join("")}
          </div>`;
      case "tone":
        if (!d.tone) d.tone = "friend";
        return `
          <div class="ob__q"><h1 class="h2" tabindex="-1" data-autofocus>ואיך לדבר איתך?</h1></div>
          <div class="choices" role="radiogroup" aria-label="סגנון דיבור">
            ${TONES().map((t) => choiceRow(`data-tone="${t.id}" aria-checked="${d.tone === t.id}"`, t.label, t.sub)).join("")}
          </div>`;
    }
    return "";
  }

  function radio(el, attr, onPick) {
    $$(`[${attr}]`, el).forEach((b) => {
      b.onclick = () => {
        $$(`[${attr}]`, el).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        onPick(b.getAttribute(attr));
      };
    });
  }
  function toggles(el, attr, list, { exclusive, prop = "aria-pressed" } = {}) {
    $$(`[${attr}]`, el).forEach((b) => {
      b.onclick = () => {
        const v = b.getAttribute(attr);
        const at = list.indexOf(v);
        if (at >= 0) list.splice(at, 1);
        else {
          if (exclusive && v === exclusive) list.splice(0, list.length);
          else if (exclusive) { const x = list.indexOf(exclusive); if (x >= 0) list.splice(x, 1); }
          list.push(v);
        }
        $$(`[${attr}]`, el).forEach((x) => x.setAttribute(prop, String(list.includes(x.getAttribute(attr)))));
      };
    });
  }

  function obBind(step, el, d, changed) {
    switch (step) {
      case "name": {
        const inp = $("#ob-name", el);
        inp.oninput = () => { d.name = inp.value.trim(); };
        inp.onkeydown = (e) => { if (e.key === "Enter") inp.blur(); };
        radio(el, "data-gender", (v) => {
          d.gender = v;
          draftGender = v;
          changed();
        });
        break;
      }
      case "age": {
        const out = $(".stepper__value", el);
        $$("[data-age]", el).forEach((b) => {
          b.onclick = () => {
            d.age = Math.max(5, Math.min(99, d.age + Number(b.dataset.age)));
            out.textContent = d.age;
            d.grade = null;
            out.classList.remove("bump");
            void out.offsetWidth;
            out.classList.add("bump");
          };
        });
        break;
      }
      case "grade":
        radio(el, "data-grade", (v) => { d.grade = v; changed(); });
        break;
      case "lazy": {
        const r = $(".range", el);
        const text = $(".lazy__text", el);
        const meter = $(".lazy__meter", el);
        r.oninput = () => {
          d.lazy = Number(r.value);
          const L = LAZY()[d.lazy - 1];
          meter.style.transform = `scaleX(${d.lazy / 5})`;
          r.setAttribute("aria-valuetext", L.label);
          text.classList.add("swap");
          clearTimeout(r._t);
          r._t = setTimeout(() => {
            $(".lazy__label", text).textContent = L.label;
            $(".lazy__desc", text).textContent = L.desc;
            text.classList.remove("swap");
          }, 140);
        };
        break;
      }
      case "focus":
        radio(el, "data-focus", (v) => { d.focus = Number(v); });
        break;
      case "styles":
        toggles(el, "data-style", d.styles);
        break;
      case "needs":
        toggles(el, "data-need", d.needs, { exclusive: "none", prop: "aria-checked" });
        break;
      case "interests":
        toggles(el, "data-interest", d.interests);
        break;
      case "tone":
        radio(el, "data-tone", (v) => { d.tone = v; });
        break;
    }
  }

  function finishOnboarding(d) {
    const first = !S.profile;
    S.profile = { name: d.name || "", gender: d.gender || "m", age: d.age || null, grade: d.grade || null, lazy: d.lazy || 3, focus: d.focus || 10, styles: d.styles || [], needs: d.needs || [], interests: d.interests || [], tone: d.tone || "friend" };
    const a = derive();
    if (first) {
      if (a.large) S.settings.size = "l";
      if (a.comfort) S.settings.comfort = true;
      if (a.read) S.settings.read = true;
    }
    save();
    applySettings();
    ready();
  }

  function ready() {
    current = { name: "ready" };
    const p = S.profile;
    const a = derive();
    const rows = [
      ["cards", `הסברים קצרים: עד ${a.sentences} משפטים בכל פעם`],
      ["question", `כפתור "לא הבנתי" תמיד פה, בלי בושה`],
      ["coffee", `הפסקה קטנה בערך כל ${a.focus} דקות`],
    ];
    if (S.settings.read) rows.push(["speaker-high", "אקריא לך כל הסבר בקול"]);
    if (S.settings.comfort) rows.push(["text-aa", "טקסט גדול ומרווח, נוח לקריאה"]);
    if (a.calm) rows.push(["wind", "תרגול בלי ציונים, ותרגיל נשימה כשצריך"]);
    if (p.interests.length) rows.push(["heart", `דוגמאות מ${p.interests.slice(0, 2).join(" ומ")}`]);
    const el = mount(`
      <div class="topbar"><span class="brand">Easy<b>2</b>Study</span></div>
      <div class="ob__body stagger" style="padding-top:12px">
        <div class="ob__q">
          <h1 class="h1" tabindex="-1" data-autofocus>${p.name ? `${esc(p.name)}, ` : ""}הכל מוכן.</h1>
          <p class="lead">ככה נלמד ביחד:</p>
        </div>
        <div class="adapt">
          ${rows.map(([ic, t]) => `<div class="adapt__row"><span class="adapt__ic">${icon(ic)}</span><span>${esc(t)}</span></div>`).join("")}
        </div>
        <p class="small muted" style="margin:0">אפשר לשנות הכל בכל רגע מההגדרות.</p>
      </div>
      <div class="ob__foot"><button class="btn btn--primary btn--block" data-go>${g("יאללה, בוא", "יאללה, בואי")} ${icon("arrow-left")}</button></div>`);
    $$(".ob__body > *", el).forEach((c, k) => c.style.setProperty("--i", k));
    $("[data-go]", el).onclick = home;
  }

  // Home ------------------------------------------------------------------
  function streak() {
    const days = new Set(S.days);
    let n = 0;
    const d = new Date();
    if (!days.has(today())) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function markStudied() {
    const t = today();
    if (!S.days.includes(t)) { S.days.push(t); S.days = S.days.slice(-90); save(); }
  }
  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return "לילה טוב";
    if (h < 12) return "בוקר טוב";
    if (h < 17) return "צהריים טובים";
    if (h < 21) return "ערב טוב";
    return "לילה טוב";
  }
  const subjectOf = (id) => SUBJECTS.find((s) => s.id === id) || SUBJECTS[SUBJECTS.length - 1];
  function getLesson(id) {
    const rec = S.lessons[id];
    if (rec && rec.lesson) return rec.lesson;
    return BUILTIN.find((l) => l.id === id) || null;
  }
  function stepsOf(lesson) {
    const steps = [];
    lesson.bites.forEach((b, i) => {
      steps.push({ t: "bite", i });
      if (b.check && b.check.question) steps.push({ t: "check", i });
    });
    return steps;
  }

  // What the learner did, for "this week" and the parents' summary.
  function logEvent(k, t) {
    S.log = (S.log || []).concat({ d: today(), k, t: t || "" }).slice(-800);
    save();
  }
  function weekStats() {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    const since = from.toISOString().slice(0, 10);
    const week = (S.log || []).filter((e) => e.d >= since);
    return {
      bites: week.filter((e) => e.k === "bite").length,
      right: week.filter((e) => e.k === "right").length,
      days: new Set(week.map((e) => e.d)).size,
      topics: [...new Set(week.filter((e) => e.k === "lesson").map((e) => e.t))],
    };
  }
  async function shareWeek() {
    const p = S.profile || {};
    const w = weekStats();
    const who = p.name || g("הוא", "היא");
    const text = [
      `Easy2Study: מה ${who} ${g("למד", "למדה")} השבוע`,
      `✓ ${w.bites} דברים חדשים ש${g("הבין", "הבינה")}`,
      `✓ ${w.right} תשובות נכונות`,
      `✓ ${w.days} ימי למידה`,
      w.topics.length ? `נושאים: ${w.topics.slice(0, 8).join(", ")}` : "",
    ].filter(Boolean).join("\n");
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("הסיכום הועתק. אפשר להדביק בוואטסאפ.");
    } catch {
      toast("לא הצלחתי לשתף מהדפדפן הזה.");
    }
  }

  const SUGGEST = ["למה השמיים כחולים?", "חורים שחורים", "שברים", "מלחמת העצמאות", "מה זה אינפלציה?", "איך המוח זוכר?", "פוטוסינתזה", "Present Simple"];

  function courseProgress(c) {
    const done = c.chapters.filter((x) => x.done).length;
    return { done, total: c.chapters.length, next: c.chapters.findIndex((x) => !x.done) };
  }

  // Rows shared by the home screen and the menu pages.
  function allCourses() {
    return Object.entries(S.courses || {}).map(([id, c]) => ({ id, ...c, prog: courseProgress(c) }))
      .sort((x, y) => (x.prog.next < 0) - (y.prog.next < 0) || y.updated - x.updated);
  }
  function lessonRecs() {
    return Object.entries(S.lessons).map(([id, r]) => ({ id, ...r, lesson: getLesson(id) })).filter((r) => r.lesson);
  }
  function courseRow(c) {
    const pct = Math.round((c.prog.done / c.prog.total) * 100);
    const line = c.prog.next < 0 ? `${g("סיימת", "סיימת")} את כל ${c.prog.total} השלבים` : `שלב ${c.prog.next + 1} מתוך ${c.prog.total}: ${c.chapters[c.prog.next].title}`;
    return `<button class="resume" data-course="${esc(c.id)}">
      <span class="ring" style="--p:${pct}"><span>${c.prog.next < 0 ? icon("check", "icon--sm") : `${c.prog.done}/${c.prog.total}`}</span></span>
      <span class="resume__text"><span class="resume__title">${plain(c.title)}</span><span class="small muted resume__title" style="font-weight:400">${plain(line)}</span></span>
      ${icon("caret-left", "icon--sm")}
    </button>`;
  }
  function lessonRow(r) {
    const pct = Math.round(((r.pos || 0) / stepsOf(r.lesson).length) * 100);
    return `<button class="resume" data-open="${esc(r.id)}">
      <span class="ring" style="--p:${pct}"><span>${pct}%</span></span>
      <span class="resume__text"><span class="resume__title">${plain(r.lesson.title)}</span><span class="small muted resume__title" style="font-weight:400">${esc(subjectOf(r.lesson.subject).name)}</span></span>
      ${icon("caret-left", "icon--sm")}
    </button>`;
  }
  function bindRows(el) {
    $$("[data-open]", el).forEach((b) => (b.onclick = () => openLesson(b.dataset.open)));
    $$("[data-course]", el).forEach((b) => (b.onclick = () => coursePath(b.dataset.course)));
    $$("[data-review]", el).forEach((b) => (b.onclick = () => review(b.dataset.review)));
  }

  // Home: only what it takes to start learning. Everything else is in the menu.
  function home() {
    current = { name: "home" };
    const p = S.profile;
    const a = derive();
    const ai = Tutor.available();
    // The one thing to continue: the most recent unfinished path or lesson.
    const next = [
      ...allCourses().filter((c) => c.prog.next >= 0).map((c) => ({ t: c.updated, html: courseRow(c) })),
      ...lessonRecs().filter((r) => !r.done && !r.courseId).map((r) => ({ t: r.updated, html: lessonRow(r) })),
    ].sort((x, y) => y.t - x.t)[0];
    const chips = ai ? SUGGEST : BUILTIN.map((l) => l.title);
    const sub = a.small ? "כל נושא בעולם. מתחילים ב-2 דקות, ואם בא לך עוד, ממשיכים." : "כל נושא בעולם. נבנה לך מסלול קצר, צעד אחר צעד.";
    const el = mount(`
      <div class="topbar">
        <button class="icon-btn" data-menu aria-label="תפריט" aria-haspopup="dialog">${icon("list")}</button>
        <span class="brand">Easy<b>2</b>Study</span>
      </div>
      <div class="home__hello stagger">
        <h1 class="h1" style="--i:0" tabindex="-1" data-autofocus>${greeting()}${p.name ? `, ${esc(p.name)}` : ""}</h1>
      </div>
      <section class="start stagger" aria-labelledby="start-t" style="--i:1">
        <h2 class="start__title" id="start-t">מה בא לך להבין?</h2>
        <p class="start__sub">${esc(sub)}</p>
        <form class="quest" data-quest>
          <label class="sr-only" for="quest">נושא</label>
          <input id="quest" class="quest__input" maxlength="140" autocomplete="off" enterkeyhint="go" placeholder="${ai ? "למשל: למה יש עונות?" : "למשל: שברים"}">
          <button class="quest__go" aria-label="יאללה">${icon("arrow-left")}</button>
        </form>
        <div class="chips chips--scroll hero-chips" aria-label="רעיונות">
          ${chips.map((t) => `<button type="button" class="chip" data-suggest="${esc(t)}">${plain(t)}</button>`).join("")}
        </div>
      </section>
      <button class="exam-btn stagger" style="--i:2" data-new>
        <span class="review__ic">${icon("clipboard-text")}</span>
        <span class="resume__text"><span class="resume__title">יש לי מבחן</span><span class="small muted resume__title" style="font-weight:400">צילום, PDF או סיכום מהמורה</span></span>
        ${icon("caret-left", "icon--sm")}
      </button>
      ${next ? `
      <section class="section stagger" aria-labelledby="cont-t" style="--i:3">
        <h2 class="h3" id="cont-t">להמשיך מאיפה ${g("שעצרת", "שעצרת")}</h2>
        ${next.html}
      </section>` : ""}`, "home");
    $("[data-menu]", el).onclick = menu;
    $("[data-new]", el).onclick = () => newLesson();
    const quest = $("#quest", el);
    const go = (topic) => {
      topic = topic.trim();
      if (!topic) return quest.focus();
      if (!ai) {
        const match = findBuiltin(topic);
        if (match) return openLesson(match.id);
        return toast("כרגע אפשר ללמוד רק את השיעורים המוכנים.");
      }
      startPath({ topic, goal: "curious" });
    };
    $("[data-quest]", el).onsubmit = (e) => { e.preventDefault(); go(quest.value); };
    $$("[data-suggest]", el).forEach((b) => (b.onclick = () => go(b.dataset.suggest)));
    bindRows(el);
  }

  // Menu ------------------------------------------------------------------
  function menu() {
    const p = S.profile || {};
    const st = streak();
    const w = weekStats();
    const courses = allCourses();
    const reviews = lessonRecs().filter((r) => r.done).length;
    const item = (go, ic, label, badge) => `<button class="menu__item" data-go="${go}" ${current.name === go ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span>${badge ? `<span class="menu__badge">${badge}</span>` : ""}</button>`;
    const s = sheet(`
      <div class="menu__head">
        <span class="menu__avatar" aria-hidden="true">${esc((p.name || "E").trim().charAt(0))}</span>
        <span class="menu__who">
          <b>${esc(p.name || "Easy2Study")}</b>
          <span class="small muted">${st >= 2 ? `${icon("flame", "icon--sm")} ${st} ימים ברצף` : w.bites ? `השבוע ${g("הבנת", "הבנת")} ${w.bites} דברים` : "מוכנים להתחיל?"}</span>
        </span>
        <button class="icon-btn" data-sheet-close aria-label="סגירת התפריט">${icon("x")}</button>
      </div>
      <nav class="menu__list" aria-label="תפריט">
        ${item("home", "house", "בית")}
        ${item("paths", "path", "המסלולים שלי", courses.length || "")}
        ${item("reviews", "arrow-counter-clockwise", "חזרה מהירה", reviews || "")}
        ${item("ready", "books", "שיעורים מוכנים")}
        ${item("progress", "chart-line-up", "ההתקדמות שלי")}
        ${item("new", "clipboard-text", "יש לי מבחן")}
      </nav>
      <nav class="menu__list menu__list--quiet" aria-label="עוד">
        ${item("settings", "gear-six", "הגדרות")}
        ${item("about", "info", "איך זה עובד")}
      </nav>
    `, "תפריט", null, "drawer");
    const routes = { home, paths: pathsPage, reviews: reviewsPage, ready: readyPage, progress: progressPage, new: newLesson, about: aboutPage };
    $$("[data-go]", s).forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.go;
        if (k === "settings") { closeSheet(true); return settingsSheet(); }
        if (k === current.name) return closeSheet();
        closeSheet(true);
        routes[k]();
      };
    });
  }

  // A plain page opened from the menu: back to home, menu at hand.
  function page(name, title, body, sub) {
    current = { name };
    const el = mount(`
      <div class="topbar">
        <button class="icon-btn" data-back aria-label="חזרה">${icon("arrow-right")}</button>
        <span class="topbar__spacer"></span>
        <button class="icon-btn" data-menu aria-label="תפריט" aria-haspopup="dialog">${icon("list")}</button>
      </div>
      <div class="page__head stagger">
        <h1 class="h1" style="--i:0" tabindex="-1" data-autofocus>${title}</h1>
        ${sub ? `<p class="lead" style="--i:1">${sub}</p>` : ""}
      </div>
      <div class="page__body">${body}</div>`, "page");
    $("[data-back]", el).onclick = home;
    $("[data-menu]", el).onclick = menu;
    bindRows(el);
    return el;
  }
  const emptyState = (text, cta) => `<div class="empty">${esc(text)}${cta ? `<br><button class="btn btn--soft" data-start style="margin-top:14px;min-height:48px">${icon("sparkle")}${cta}</button>` : ""}</div>`;
  function bindStart(el) {
    const b = $("[data-start]", el);
    if (b) b.onclick = () => { home(); setTimeout(() => { const q = $("#quest"); if (q) q.focus(); }, 60); };
  }

  function pathsPage() {
    const list = allCourses();
    const el = page("paths", "המסלולים שלי", list.length
      ? `<div class="stack">${list.map(courseRow).join("")}</div>`
      : emptyState("עוד אין מסלולים. כותבים נושא במסך הבית, ומקבלים מסלול צעד אחר צעד.", "להתחיל מסלול"),
      list.length ? `${list.filter((c) => c.prog.next < 0).length} מתוך ${list.length} הושלמו` : "");
    bindStart(el);
  }

  function reviewsPage() {
    const done = lessonRecs().filter((r) => r.done).sort((x, y) => (y.feel === "lost") - (x.feel === "lost") || y.updated - x.updated);
    const el = page("reviews", "חזרה מהירה", done.length
      ? `<div class="review">${done.map((r) => `<button class="review__row" data-review="${esc(r.id)}">
          <span class="review__ic">${icon(subjectOf(r.lesson.subject).icon)}</span>
          <span class="review__text"><b style="font-weight:600">${plain(r.lesson.title)}</b><br><span class="small muted">${r.feel === "lost" ? "כדאי לעבור על זה שוב" : r.feel === "ok" ? "עוד סיבוב קטן ויהיה מושלם" : "רק לרענן"}</span></span>
          <span class="review__go">${icon("arrow-counter-clockwise")}</span>
        </button>`).join("")}</div>`
      : emptyState("כאן יופיעו שיעורים שסיימת, עם השאלות שכדאי לחזור עליהן ראשונות."),
      done.length ? "השאלות שהיו קשות מופיעות ראשונות." : "");
    bindStart(el);
  }

  function readyPage() {
    page("ready", "שיעורים מוכנים", `<div class="tile-grid">${BUILTIN.map((l) => `<button class="tile" data-open="${l.id}">
        <span class="tile__ic">${icon(subjectOf(l.subject).icon)}</span>
        <span><span class="tile__title">${plain(l.title)}</span><span class="tile__meta" style="display:block">${esc(l.subtitle)}</span></span>
      </button>`).join("")}</div>`, "עובדים גם בלי אינטרנט.");
  }

  function progressPage() {
    const w = weekStats();
    const st = streak();
    const log = S.log || [];
    const total = { bites: log.filter((e) => e.k === "bite").length, lessons: log.filter((e) => e.k === "lesson").length };
    const days = new Set(S.days);
    const week = Array.from({ length: 7 }, (_, k) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - k));
      return { on: days.has(d.toISOString().slice(0, 10)), label: "אבגדהוש"[d.getDay()] };
    });
    const el = page("progress", "ההתקדמות שלי", `
      <div class="week">
        <div class="week__num" aria-hidden="true">${w.bites}</div>
        <div class="week__text">
          <h2 class="h3">השבוע ${g("הבנת", "הבנת")} ${w.bites === 1 ? "דבר חדש אחד" : `${w.bites} דברים חדשים`}</h2>
          <span class="small muted">${w.right} תשובות נכונות${w.topics.length ? `, ${w.topics.length === 1 ? "נושא אחד" : `${w.topics.length} נושאים`}` : ""}</span>
        </div>
        <div class="days" role="img" aria-label="ימי למידה השבוע: ${week.filter((d) => d.on).length} מתוך 7">
          ${week.map((d) => `<span class="days__d" ${d.on ? "data-on" : ""}><i>${d.on ? icon("check", "icon--sm") : ""}</i>${d.label}׳</span>`).join("")}
        </div>
        <button class="btn btn--primary week__share" data-share>${icon("paper-plane-tilt")}לשתף את ההורים</button>
      </div>
      <div class="totals">
        <div class="totals__n"><b>${st}</b>${st === 1 ? "יום ברצף" : "ימים ברצף"}</div>
        <div class="totals__n"><b>${total.bites}</b>דברים שהבנת</div>
        <div class="totals__n"><b>${total.lessons}</b>שלבים ושיעורים</div>
      </div>`, "בלי ציונים. רק כמה למדת.");
    $("[data-share]", el).onclick = shareWeek;
  }

  function aboutPage() {
    const steps = [
      ["sparkle", "כותבים מה רוצים להבין", "כל נושא בעולם, או חומר למבחן: צילום, PDF או סיכום."],
      ["path", "מקבלים מסלול קצר", "כמה שלבים, מהבסיס ועד המטרה. כל שלב לוקח כמה דקות."],
      ["cards", "לומדים בחתיכות קטנות", "משפט או שניים בכל פעם, ותהליכים צעד אחר צעד."],
      ["question", "לא הבנת? אומרים", "הסבר פשוט יותר, דוגמה, מילה שלא ברורה, או שאלה משלך."],
      ["list-checks", "בודקים בלי ציונים", "שאלה קטנה כל כמה חתיכות, וחזרה מהירה בסוף."],
    ];
    page("about", "איך זה עובד", `
      <ol class="how">${steps.map(([ic, t, d]) => `<li><span class="adapt__ic">${icon(ic)}</span><span><b>${t}</b><span class="small muted" style="display:block">${d}</span></span></li>`).join("")}</ol>
      <p class="small muted" style="margin:18px 0 0">כל הפרטים נשמרים רק בדפדפן הזה. המורה החכם מקבל את הגיל, הכיתה וסגנון הלמידה, בלי השם.</p>`);
  }

  function findBuiltin(topic) {
    const t = topic.trim().toLowerCase();
    return BUILTIN.find((l) => l.title.toLowerCase() === t || l.keywords.some((k) => t.includes(k.toLowerCase()) || (t.length > 2 && k.toLowerCase().includes(t))));
  }

  // New lesson ------------------------------------------------------------
  function newLesson() {
    current = { name: "new" };
    const ai = Tutor.available();
    const d = { subject: null, topic: "", material: "", images: [], pdf: null, when: null, paste: false };
    const WHEN = [["today", "היום"], ["tomorrow", "מחר"], ["week", "השבוע"], ["later", "בעוד יותר משבוע"], ["unknown", g("לא יודע", "לא יודעת")]];
    const el = mount(`
      <div class="topbar">
        <button class="icon-btn" data-back aria-label="חזרה">${icon("arrow-right")}</button>
      </div>
      <div class="new__body stagger">
        <h1 class="h2" tabindex="-1" data-autofocus>על מה המבחן?</h1>
        <div class="field">
          <span class="label" id="subj-l">מקצוע</span>
          <div class="chips chips--scroll" role="radiogroup" aria-labelledby="subj-l">
            ${SUBJECTS.map((s) => `<button type="button" role="radio" class="chip" data-subject="${s.id}" aria-checked="false">${icon(s.icon)}${s.name}</button>`).join("")}
          </div>
        </div>
        <div class="field">
          <label class="label" for="topic">הנושא</label>
          <input id="topic" class="input" maxlength="140" placeholder="למשל: שברים, מחזור המים">
          <span class="help">אפשר לכתוב במילים שלך. גם "מה שהמורה אמרה בשיעור האחרון" זה בסדר.</span>
        </div>
        ${ai ? `
        <div class="field">
          <span class="label">יש לך חומר מהמורה? <span class="muted" style="font-weight:400">(לא חובה)</span></span>
          <div class="attach">
            <button type="button" class="attach__btn" data-pick="camera">${icon("camera", "icon--lg")}<span>לצלם<small>דף מהספר</small></span></button>
            <button type="button" class="attach__btn" data-pick="gallery">${icon("image", "icon--lg")}<span>תמונה<small>מהגלריה</small></span></button>
            <button type="button" class="attach__btn" data-pick="pdf" aria-pressed="false">${icon("file-pdf", "icon--lg")}<span>קובץ PDF<small>עד 10MB</small></span></button>
            <button type="button" class="attach__btn" data-paste aria-pressed="false">${icon("clipboard-text", "icon--lg")}<span>טקסט<small>להדביק</small></span></button>
          </div>
          <input type="file" accept="image/*" capture="environment" hidden data-file="camera">
          <input type="file" accept="image/*" multiple hidden data-file="gallery">
          <input type="file" accept="application/pdf,.pdf" hidden data-file="pdf">
          <div data-pdf></div>
          <div class="photos" data-photos aria-live="polite"></div>
          <div data-paste-box hidden><label class="sr-only" for="material">החומר</label><textarea id="material" class="textarea" maxlength="8000" placeholder="להדביק כאן את החומר"></textarea></div>
        </div>` : ""}
        <div class="field">
          <span class="label" id="when-l">מתי המבחן?</span>
          <div class="chips" role="radiogroup" aria-labelledby="when-l">
            ${WHEN.map(([v, l]) => `<button type="button" role="radio" class="chip" data-when="${v}" aria-checked="false">${l}</button>`).join("")}
          </div>
        </div>
        ${ai ? "" : `<div class="notice">${icon("sparkle", "icon--sm")}<span>המורה החכם (AI) עוד לא מחובר, אז כרגע אפשר ללמוד את השיעורים המוכנים: שברים, מחזור המים, Present Simple והמהפכה התעשייתית. אחרי החיבור, כל נושא יעבוד.</span></div>`}
        <p class="small muted" data-err role="alert" style="margin:0"></p>
      </div>
      <div class="sticky-foot"><button class="btn btn--primary btn--block" data-make disabled>${icon("sparkle")}להכין לי שיעור</button></div>`, "new");

    const make = $("[data-make]", el);
    const topic = $("#topic", el);
    const err = $("[data-err]", el);
    const refresh = () => { make.disabled = !(d.topic.trim() || d.images.length || d.pdf || d.material.trim()); err.textContent = ""; };
    $("[data-back]", el).onclick = home;
    radio(el, "data-subject", (v) => { d.subject = v; });
    radio(el, "data-when", (v) => { d.when = v; });
    topic.oninput = () => { d.topic = topic.value; refresh(); };
    topic.onkeydown = (e) => { if (e.key === "Enter" && !make.disabled) make.click(); };
    if (ai) {
      const MAX = 4;
      const photos = $("[data-photos]", el);
      const pasteBtn = $("[data-paste]", el);
      const box = $("[data-paste-box]", el);
      const mat = $("#material", el);
      // Up to 4 pages: each one a thumbnail with its number and a remove button.
      const drawPhotos = () => {
        photos.innerHTML = d.images.map((im, k) => `
          <figure class="photo">
            <img alt="עמוד ${k + 1}" src="data:${im.media_type};base64,${im.data}">
            <figcaption>${k + 1}</figcaption>
            <button type="button" class="photo__rm" data-rm="${k}" aria-label="להסיר את עמוד ${k + 1}">${icon("x", "icon--sm")}</button>
          </figure>`).join("") + (d.images.length && d.images.length < MAX
          ? `<button type="button" class="photo photo--add" data-more aria-label="להוסיף עוד עמוד">${icon("plus")}<span>עוד עמוד</span></button>` : "");
        $$("[data-rm]", photos).forEach((x) => (x.onclick = () => { d.images.splice(Number(x.dataset.rm), 1); drawPhotos(); refresh(); }));
        const more = $("[data-more]", photos);
        if (more) more.onclick = () => $('[data-file="gallery"]', el).click();
        refresh();
      };
      // One PDF: a tile with its name and size, and a remove button.
      const pdfBox = $("[data-pdf]", el);
      const pdfBtn = $('[data-pick="pdf"]', el);
      const drawPdf = () => {
        pdfBtn.setAttribute("aria-pressed", String(Boolean(d.pdf)));
        pdfBox.innerHTML = d.pdf ? `
          <div class="file">
            <span class="file__ic">${icon("file-pdf")}</span>
            <span class="file__text"><bdi class="file__name">${esc(d.pdf.name.replace(/\.pdf$/i, ""))}</bdi><span class="small muted">${fileSize(d.pdf.size)}</span></span>
            <button type="button" class="icon-btn" data-rm-pdf aria-label="להסיר את הקובץ">${icon("x")}</button>
          </div>` : "";
        const rm = $("[data-rm-pdf]", pdfBox);
        if (rm) rm.onclick = () => { d.pdf = null; drawPdf(); };
        refresh();
      };
      $('[data-file="pdf"]', el).onchange = async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!f) return;
        if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return toast("זה לא נראה כמו קובץ PDF.");
        if (f.size > PDF_MAX) return toast("הקובץ גדול מ-10MB. אפשר לשלוח רק את הפרק שצריך?");
        try {
          d.pdf = { name: f.name, size: f.size, data: await toBase64(f) };
        } catch {
          return toast("לא הצלחתי לפתוח את הקובץ. אפשר לנסות שוב?");
        }
        drawPdf();
        pdfBox.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest" });
      };
      $$("[data-pick]", el).forEach((b) => {
        b.onclick = () => {
          if (b.dataset.pick === "pdf") {
            if (d.pdf) toast("אפשר קובץ PDF אחד. הקובץ החדש יחליף את הקודם.");
            return $('[data-file="pdf"]', el).click();
          }
          if (d.images.length >= MAX) return toast(`אפשר עד ${MAX} עמודים בפעם אחת.`);
          $(`[data-file="${b.dataset.pick}"]`, el).click();
        };
      });
      $$('[data-file]:not([data-file="pdf"])', el).forEach((input) => {
        input.onchange = async () => {
          const files = [...(input.files || [])];
          input.value = "";
          if (!files.length) return;
          const room = MAX - d.images.length;
          if (files.length > room) toast(`אפשר עד ${MAX} עמודים, אז לקחתי את ${room === 1 ? "הראשון" : `${room} הראשונים`}.`);
          for (const f of files.slice(0, room)) {
            try {
              d.images.push(await shrinkImage(f));
            } catch {
              toast("לא הצלחתי לפתוח אחת התמונות. אפשר לנסות שוב?");
            }
          }
          drawPhotos();
          photos.lastElementChild && photos.lastElementChild.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest" });
        };
      });
      pasteBtn.onclick = () => {
        d.paste = !d.paste;
        box.hidden = !d.paste;
        pasteBtn.setAttribute("aria-pressed", String(d.paste));
        if (d.paste) mat.focus(); else { d.material = ""; mat.value = ""; refresh(); }
      };
      mat.oninput = () => { d.material = mat.value; refresh(); };
    }
    make.onclick = () => {
      if (!ai) {
        const match = findBuiltin(d.topic);
        if (match) return openLesson(match.id);
        err.textContent = "את הנושא הזה אפשר יהיה ללמוד כשהמורה החכם יחובר. בינתיים אפשר לבחור שיעור מוכן מהמסך הראשי.";
        return;
      }
      startPath({ ...d, goal: "exam" });
    };
  }

  const PDF_MAX = 10 * 1024 * 1024;
  const fileSize = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  // Phone photos are big: resize to at most 1600px and send as JPEG.
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const data = c.toDataURL("image/jpeg", 0.82).split(",")[1];
        resolve({ media_type: "image/jpeg", data });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
      img.src = url;
    });
  }

  // Loading ---------------------------------------------------------------
  // A calm waiting screen with rotating lines. Returns {alive(), stop()}.
  function loadingScreen(lines, onCancel) {
    current = { name: "loading" };
    const el = mount(`
      <div class="topbar"><button class="icon-btn" data-back aria-label="ביטול">${icon("x")}</button></div>
      <div class="loading">
        <div class="skeleton" aria-hidden="true"><div class="sk sk--title"></div><div style="height:4px"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>
        <p class="loading__line" role="status" aria-live="polite">${esc(lines[0])}</p>
      </div>`);
    let k = 0, alive = true;
    const line = $(".loading__line", el);
    const rot = setInterval(() => {
      k = Math.min(k + 1, lines.length - 1);
      line.style.opacity = 0;
      setTimeout(() => { line.textContent = lines[k]; line.style.opacity = 1; }, 240);
    }, 3600);
    const stop = () => { alive = false; clearInterval(rot); };
    $("[data-back]", el).onclick = () => { stop(); onCancel(); };
    return { alive: () => alive && current.name === "loading", stop };
  }

  const ERRORS = {
    daily_limit: "הגעת למכסה של היום. מחר יש עוד! בינתיים אפשר לחזור על מה שכבר למדת.",
    refused: "לא הצלחתי להכין שיעור מזה. אפשר לנסח את הנושא קצת אחרת?",
    too_long: "החומר ארוך מדי בשביל פעם אחת. אפשר לשלוח חלק ממנו?",
    image_too_large: "התמונות גדולות מדי. אפשר לנסות עם פחות עמודים?",
    too_many_images: "אפשר עד 4 עמודים בפעם אחת.",
    pdf_too_large: "הקובץ גדול מדי. אפשר לשלוח רק את הפרק שצריך?",
    bad_pdf: "לא הצלחתי לקרוא את הקובץ. זה בטוח קובץ PDF?",
    network: "נראה שאין חיבור לאינטרנט כרגע.",
    timeout: "זה לקח יותר מדי זמן. אפשר לנסות שוב?",
  };
  function failed(code, retry, back) {
    current = { name: "error" };
    const el = mount(`
      <div class="topbar"><button class="icon-btn" data-back aria-label="חזרה">${icon("arrow-right")}</button></div>
      <div class="loading" style="text-align:center;justify-items:center">
        <span class="adapt__ic" style="width:64px;height:64px;border-radius:22px">${icon("smiley-nervous", "icon--lg")}</span>
        <h1 class="h2" tabindex="-1" data-autofocus>אופס.</h1>
        <p class="lead">${esc(ERRORS[code] || "משהו השתבש אצלי, לא אצלך. אפשר לנסות שוב?")}</p>
        <div style="display:grid;gap:8px;width:100%;margin-top:8px">
          <button class="btn btn--primary btn--block" data-retry>${icon("arrow-counter-clockwise")}לנסות שוב</button>
          <button class="btn btn--ghost" data-home>למסך הראשי</button>
        </div>
      </div>`);
    $("[data-back]", el).onclick = back || home;
    $("[data-retry]", el).onclick = retry;
    $("[data-home]", el).onclick = home;
  }

  // Paths -----------------------------------------------------------------
  // Any topic becomes a path of short chapters. Each chapter is a lesson,
  // written when the learner gets near it (the next one is prepared while
  // they learn the current one).
  const pending = {}; // "courseId:index" -> promise of a lesson id
  const photos = {}; // courseId -> {images, pdf}, kept for this visit only

  function startPath(d) {
    const p = S.profile || {};
    const fav = (p.interests || [])[0];
    const lines = [
      d.pdf ? "קורא את הקובץ ששלחת..." : (d.images || []).length ? `קורא את ${d.images.length === 1 ? "הדף" : "הדפים"} ששלחת...` : "חושב מאיפה הכי כדאי להתחיל...",
      "מחלק את הנושא לשלבים קטנים...",
      fav ? `מחפש דוגמאות מ${fav}...` : "מחפש דוגמאות מהחיים...",
      "בונה לך מסלול, צעד אחר צעד...",
      "כמעט מוכן...",
    ];
    const ld = loadingScreen(lines, d.goal === "exam" ? newLesson : home);
    Tutor.plan({
      profile: profileForAI(),
      subject: d.subject ? subjectOf(d.subject).name : null,
      topic: (d.topic || "").trim(),
      material: (d.material || "").trim() || null,
      images: d.images || [],
      pdf: d.pdf ? { data: d.pdf.data } : null,
      goal: d.goal,
      when: d.when || null,
    }).then((res) => {
      if (!ld.alive()) return;
      ld.stop();
      const plan = res.plan || {};
      const str = (v) => (typeof v === "string" ? v.trim() : "");
      const chapters = (Array.isArray(plan.chapters) ? plan.chapters : [])
        .map((c) => ({ title: str(c && c.title), goal: str(c && c.goal), lessonId: null, done: false }))
        .filter((c) => c.title).slice(0, 8);
      if (!chapters.length) return failed("no_plan", () => startPath(d));
      const id = "c-" + Date.now().toString(36);
      const notes = str(plan.notes) || (d.material || "").trim();
      S.courses = S.courses || {};
      S.courses[id] = {
        title: str(plan.title) || d.topic || "המסלול שלי",
        subtitle: str(plan.subtitle),
        topic: (d.topic || "").trim() || str(plan.title),
        subject: d.subject || "other",
        goal: d.goal,
        when: d.when || null,
        notes: notes.slice(0, 12000),
        chapters,
        created: Date.now(),
        updated: Date.now(),
      };
      if (((d.images || []).length || d.pdf) && !str(plan.notes)) photos[id] = { images: d.images || [], pdf: d.pdf ? { data: d.pdf.data } : null };
      save();
      prepare(id, 0);
      coursePath(id);
    }).catch((e) => {
      if (!ld.alive()) return;
      ld.stop();
      failed(e.code, () => startPath(d), d.goal === "exam" ? newLesson : home);
    });
  }

  // Writes chapter i (once) and resolves to its lesson id.
  function prepare(courseId, i) {
    const c = S.courses[courseId];
    if (!c || !c.chapters[i]) return Promise.reject(Object.assign(new Error("no chapter"), { code: "no_chapter" }));
    const ch = c.chapters[i];
    if (ch.lessonId && getLesson(ch.lessonId)) return Promise.resolve(ch.lessonId);
    const key = courseId + ":" + i;
    if (pending[key]) return pending[key];
    const learned = c.chapters.slice(0, i).flatMap((x) => {
      const l = x.lessonId && getLesson(x.lessonId);
      return l && l.summary.length ? l.summary : [x.goal || x.title];
    }).slice(-16);
    pending[key] = Tutor.lesson({
      profile: profileForAI(),
      subject: c.subject ? subjectOf(c.subject).name : null,
      topic: c.topic,
      material: c.notes || null,
      images: (photos[courseId] || {}).images || [],
      pdf: (photos[courseId] || {}).pdf || null,
      goal: c.goal,
      when: c.when,
      course: { title: c.title, chapters: c.chapters.map((x) => x.title), index: i, goal: ch.goal, learned },
    }).then((res) => {
      const lesson = normalizeLesson(res.lesson, c.subject);
      if (!lesson) throw Object.assign(new Error("bad lesson"), { code: "bad_lesson" });
      lesson.title = ch.title;
      const id = `${courseId}-${i}`;
      S.lessons[id] = { lesson, pos: 0, done: false, updated: Date.now(), courseId, chapter: i };
      ch.lessonId = id;
      save();
      return id;
    }).finally(() => { delete pending[key]; });
    return pending[key];
  }

  function openChapter(courseId, i) {
    const c = S.courses[courseId];
    const ch = c.chapters[i];
    const ready = ch.lessonId && getLesson(ch.lessonId);
    if (ready) return openLesson(ch.lessonId);
    const ld = loadingScreen([`מכין את שלב ${i + 1}: ${ch.title}`, "מפרק לחתיכות קטנות...", "מכין שאלות קטנות, בלי ציונים...", "כמעט מוכן..."], () => coursePath(courseId));
    prepare(courseId, i).then((id) => {
      if (!ld.alive()) return;
      ld.stop();
      openLesson(id);
    }).catch((e) => {
      if (!ld.alive()) return;
      ld.stop();
      failed(e.code, () => openChapter(courseId, i), () => coursePath(courseId));
    });
  }

  function coursePath(courseId, { justDone = -1 } = {}) {
    current = { name: "path" };
    const c = S.courses[courseId];
    if (!c) return home();
    c.updated = Date.now();
    save();
    const prog = courseProgress(c);
    const all = prog.next < 0;
    // The chapter just finished is drawn as "now" first, then fills in.
    const stateOf = (k) => {
      if (k === justDone) return "now";
      if (justDone >= 0 && k === justDone + 1) return "todo";
      return c.chapters[k].done ? "done" : k === prog.next ? "now" : "todo";
    };
    const nextCh = all ? null : c.chapters[prog.next];
    const el = mount(`
      <div class="topbar">
        <button class="icon-btn" data-back aria-label="למסך הראשי">${icon("arrow-right")}</button>
        <span class="topbar__spacer"></span>
        <span class="small muted" data-count>${prog.done} מתוך ${prog.total} שלבים</span>
      </div>
      ${all ? `
      <div class="done__hero" style="padding-top:12px">
        <span class="done__badge pop" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path class="draw" d="M12 25l8 8 16-17"/></svg></span>
        <h1 class="h1" tabindex="-1" data-autofocus>${g("סיימת", "סיימת")} את כל המסלול!</h1>
        <p class="lead">${plain(c.title.replace(/[.!?]+$/, ""))}: ${g("עכשיו אתה מבין", "עכשיו את מבינה")} את זה, צעד אחר צעד.</p>
      </div>` : `
      <div class="path__head stagger">
        <h1 class="h1" style="--i:0" tabindex="-1" data-autofocus>${plain(c.title)}</h1>
        ${c.subtitle ? `<p class="lead" style="--i:1">${plain(c.subtitle)}</p>` : ""}
      </div>`}
      <ol class="path" aria-label="השלבים">
        ${c.chapters.map((ch, k) => `
        <li class="path__step" data-k="${k}" data-state="${stateOf(k)}">
          <span class="path__node" aria-hidden="true"><span class="path__num">${k + 1}</span>${icon("check", "path__check")}</span>
          <button class="path__body" data-ch="${k}" ${!ch.done && k !== prog.next && justDone < 0 ? `aria-disabled="true"` : ""}>
            <span class="path__title">${plain(ch.title)}</span>
            ${ch.goal ? `<span class="path__goal">${plain(ch.goal)}</span>` : ""}
            <span class="sr-only">${ch.done ? "הושלם" : k === prog.next ? "השלב הבא" : "עוד לא"}</span>
          </button>
        </li>`).join("")}
      </ol>
      <div class="sticky-foot" style="display:grid;gap:8px">
        ${all
          ? `<button class="btn btn--primary btn--block" data-share>${icon("paper-plane-tilt")}לשתף את ההורים</button>
             <button class="btn btn--soft btn--block" data-deeper>${icon("sparkle")}להעמיק עוד בנושא</button>`
          : `<button class="btn btn--primary btn--block" data-go><span class="btn__ell">${prog.done ? "להמשיך" : "מתחילים"}: ${esc(nextCh.title)}</span>${icon("arrow-left")}</button>`}
      </div>`, "path-screen");
    $("[data-back]", el).onclick = home;
    $$("[data-ch]", el).forEach((b) => {
      b.onclick = () => {
        const k = Number(b.dataset.ch);
        const ch = c.chapters[k];
        if (ch.done && ch.lessonId) return openLesson(ch.lessonId, { restart: true });
        if (k === prog.next) return openChapter(courseId, k);
        toast("קודם השלבים שלפני. ככה זה נבנה, צעד אחר צעד.");
      };
    });
    const go = $("[data-go]", el);
    if (go) go.onclick = () => openChapter(courseId, prog.next);
    const sh = $("[data-share]", el);
    if (sh) sh.onclick = shareWeek;
    const deeper = $("[data-deeper]", el);
    if (deeper) deeper.onclick = () => startPath({
      topic: `${c.topic}: השלב הבא`,
      material: `כבר ${g("למדתי", "למדתי")} במסלול הקודם: ${c.chapters.map((x) => x.title).join(", ")}. עכשיו אני רוצה להעמיק ולהמשיך מאיפה שזה נגמר.`,
      subject: c.subject,
      goal: c.goal,
    });
    if (!all) prepare(courseId, prog.next).catch(() => { /* retried when the learner taps */ });
    if (justDone >= 0) {
      setTimeout(() => {
        const li = $(`.path__step[data-k="${justDone}"]`, el);
        if (!li) return;
        li.dataset.state = "done";
        li.classList.add("path__step--fill");
        Sound.step();
        vibrate(12);
        setTimeout(() => {
          const nx = $(`.path__step[data-k="${justDone + 1}"]`, el);
          if (nx) { nx.dataset.state = "now"; nx.classList.add("path__step--arrive"); }
          if (all) { Sound.win(); burst($(".done__badge", el)); }
        }, 420);
      }, reduceMotion() ? 0 : 520);
    } else if (all) {
      setTimeout(() => burst($(".done__badge", el)), 420);
    }
  }

  // Whatever comes back from the tutor, keep only what the app can show.
  function normalizeLesson(raw, subject) {
    if (!raw || !Array.isArray(raw.bites)) return null;
    const str = (v) => (typeof v === "string" ? v.trim() : "");
    const bites = raw.bites.map((b) => {
      const bite = { title: str(b.title), text: str(b.text), simpler: str(b.simpler), example: str(b.example) };
      const steps = Array.isArray(b.steps) ? b.steps.map(str).filter(Boolean).slice(0, 8) : [];
      if (steps.length >= 2) bite.steps = steps;
      const c = b.check || {};
      const options = Array.isArray(c.options) ? c.options.map(str).filter(Boolean).slice(0, 4) : [];
      if (str(c.question) && options.length >= 2 && Number.isInteger(c.answer) && c.answer >= 0 && c.answer < options.length) {
        bite.check = { question: str(c.question), options, answer: c.answer, why: str(c.why) };
      }
      return bite;
    }).filter((b) => b.title && b.text).slice(0, 10);
    if (!bites.length) return null;
    const glossary = {};
    (raw.terms || []).forEach((t) => { if (t && str(t.word) && str(t.meaning)) glossary[str(t.word)] = str(t.meaning); });
    return {
      title: str(raw.title) || "השיעור שלי",
      subtitle: str(raw.subtitle),
      subject: subject || "other",
      glossary,
      bites,
      summary: Array.isArray(raw.summary) ? raw.summary.map(str).filter(Boolean).slice(0, 6) : [],
      ai: true,
    };
  }

  // Lesson ----------------------------------------------------------------
  let L = null; // the open lesson: {id, lesson, steps, pos, extras, simple, ...}
  let breakTimer = null;

  function openLesson(id, { simple = false, restart = false } = {}) {
    const lesson = getLesson(id);
    if (!lesson) return home();
    const rec = S.lessons[id] || (S.lessons[id] = { pos: 0, done: false });
    if (restart || rec.done) rec.pos = 0;
    rec.done = false;
    rec.updated = Date.now();
    save();
    const steps = stepsOf(lesson);
    L = { id, lesson, steps, pos: Math.min(rec.pos || 0, steps.length - 1), extras: {}, answered: {}, shown: {}, got: 0, counted: {}, simple, lost: 0, activeMs: 0, lastTick: Date.now(), nextBreak: derive().focus * 60000, firstCheck: true };
    // Prepare the next chapter of the path while this one is learned.
    if (rec.courseId && S.courses[rec.courseId] && S.courses[rec.courseId].chapters[rec.chapter + 1]) {
      prepare(rec.courseId, rec.chapter + 1).catch(() => { /* retried when the learner gets there */ });
    }
    clearInterval(breakTimer);
    breakTimer = setInterval(tickBreak, 15000);
    renderStep();
  }

  function tickBreak() {
    if (!L || current.name !== "lesson") return;
    const now = Date.now();
    if (!document.hidden) L.activeMs += Math.min(now - L.lastTick, 30000);
    L.lastTick = now;
    if (L.activeMs >= L.nextBreak && !$(".sheet-wrap")) {
      L.nextBreak = L.activeMs + derive().focus * 60000;
      breakSheet();
    }
  }

  function progressBar() {
    return `<div class="progress" role="progressbar" aria-label="התקדמות בשיעור" aria-valuemin="0" aria-valuemax="${L.steps.length}" aria-valuenow="${L.pos}">
      ${L.steps.map((_, k) => `<span class="progress__seg" data-state="${k < L.pos ? "done" : k === L.pos ? "now" : "todo"}"></span>`).join("")}
    </div>`;
  }

  function lessonTop() {
    return `<div class="topbar">
      <button class="icon-btn" data-close aria-label="לצאת מהשיעור">${icon("x")}</button>
      ${progressBar()}
      <span class="got" data-got aria-label="${g("הבנת", "הבנת")} ${L.got} דברים">${icon("check", "icon--sm")}<b>${L.got}</b></span>
      <button class="icon-btn" data-read aria-label="הקראה בקול" aria-pressed="${S.settings.read}">${icon("speaker-high")}</button>
    </div>`;
  }

  function bindLessonTop(el, readFn) {
    $("[data-close]", el).onclick = () => { stopSpeaking(); clearInterval(breakTimer); home(); };
    const rb = $("[data-read]", el);
    rb.onclick = () => {
      S.settings.read = !S.settings.read;
      save();
      rb.setAttribute("aria-pressed", String(S.settings.read));
      if (S.settings.read) readFn(); else stopSpeaking();
      toast(S.settings.read ? "הקראה בקול: פועלת" : "הקראה בקול: כבויה");
    };
  }

  function renderStep() {
    current = { name: "lesson" };
    const step = L.steps[L.pos];
    const rec = S.lessons[L.id];
    rec.pos = L.pos;
    rec.updated = Date.now();
    save();
    if (step.t === "check") return renderCheck(step.i);
    renderBite(step.i);
  }

  function visualHtml(v) {
    if (!v) return "";
    const pie = (n, k, cap, sm) => `<div><div class="pie ${sm ? "pie--sm" : ""}" style="--n:${n};--k:${k}"><span class="pie__cuts"></span></div>${cap ? `<div class="visual__cap">${frac(...cap.split("/"))}</div>` : ""}</div>`;
    if (v.type === "pie") return `<div class="visual" aria-hidden="true">${pie(v.n, v.k, v.cap)}</div>`;
    if (v.type === "pies") return `<div class="visual" aria-hidden="true">${v.items.map((x) => pie(x.n, x.k, x.cap, true)).join("")}</div>`;
    if (v.type === "cycle") {
      const names = [["sun", "התאדות"], ["wind", "התעבות"], ["arrow-counter-clockwise", "משקעים"], ["globe-hemisphere-west", "איסוף"]];
      return `<div class="visual" aria-hidden="true"><div class="cycle">${names.map(([ic, n], k) => `<div class="cycle__step" ${v.on === k || v.on === -1 ? "data-on" : ""}>${icon(ic)}${n}</div>`).join("")}</div></div>`;
    }
    return "";
  }

  function extraHtml(x) {
    const label = { example: ["lightbulb", "דוגמה"], simpler: ["feather", "במילים פשוטות יותר"], again: ["arrow-counter-clockwise", "הסבר אחר"], answer: ["chat-circle-text", "תשובה לשאלה שלך"], word: ["book-open-text", x.word ? `מה זה "${x.word}"?` : "מילה"] }[x.kind] || ["sparkle", ""];
    const you = x.q ? `<div class="extra extra--you"><span class="extra__label">${icon("chat-circle-text")}${g("שאלת", "שאלת")}</span><p>${esc(x.q)}</p></div>` : "";
    const body = x.loading ? `<span class="typing" aria-label="חושב"><i></i><i></i><i></i></span>` : `<p>${rich(x.text, { lines: false })}</p>${x.example ? `<p class="muted" style="margin-top:6px">${rich(x.example, { lines: false })}</p>` : ""}`;
    return `${you}<div class="extra" data-extra="${x.key}"><span class="extra__label">${icon(label[0])}${esc(label[1])}</span>${body}</div>`;
  }

  const biteText = (b) => (b.steps ? `${b.text}\n${b.steps.map((x, k) => `${k + 1}. ${x}`).join("\n")}` : b.text);
  const stepHtml = (x, k, now) => `<li class="step" ${now ? "data-now" : ""}><span class="step__n" aria-hidden="true">${k + 1}</span><span class="step__t">${rich(x, { lines: false })}</span></li>`;

  // One more thing understood: tick, a little buzz, the counter goes up.
  function gotIt(i) {
    Sound.tick();
    vibrate(8);
    if (L.counted[i]) return;
    L.counted[i] = true;
    L.got++;
    logEvent("bite", L.lesson.title);
    const pill = $(".screen:not(.screen--leave) [data-got]");
    if (pill) {
      $("b", pill).textContent = L.got;
      pill.classList.remove("bump");
      void pill.offsetWidth;
      pill.classList.add("bump");
    }
  }

  function renderBite(i) {
    const b = L.lesson.bites[i];
    const n = L.lesson.bites.length;
    const extras = L.extras[i] || (L.extras[i] = []);
    if (L.simple && b.simpler && !extras.some((x) => x.kind === "simpler")) {
      extras.push({ kind: "simpler", text: b.simpler, key: "s" + i });
      if (b.example) extras.push({ kind: "example", text: b.example, key: "e" + i });
    }
    const isLast = L.pos === L.steps.length - 1;
    const steps = b.steps || [];
    let shown = steps.length ? (L.simple ? steps.length : L.shown[i] || 1) : 0;
    L.shown[i] = shown;
    const el = mount(`
      ${lessonTop()}
      <div class="lesson__stage">
        <span class="lesson__kicker">${esc(L.lesson.title)} · ${i + 1} מתוך ${n}</span>
        <article class="bite bite--enter" aria-live="polite">
          <h1 class="bite__title" tabindex="-1" data-autofocus>${rich(b.title, { lines: false })}</h1>
          ${visualHtml(b.visual)}
          <div class="bite__text">${rich(b.text)}</div>
          ${steps.length ? `<ol class="steps" aria-label="צעד אחר צעד">${steps.slice(0, shown).map((x, k) => stepHtml(x, k, k === shown - 1 && shown < steps.length)).join("")}</ol>` : ""}
          <div data-extras>${extras.map(extraHtml).join("")}</div>
        </article>
        <div class="tools" role="group" aria-label="עזרה">
          <button type="button" class="chip" data-tool="example">${icon("lightbulb")}דוגמה</button>
          <button type="button" class="chip" data-tool="simpler">${icon("feather")}יותר פשוט</button>
          <button type="button" class="chip" data-tool="ask">${icon("chat-circle-text")}שאלה משלי</button>
        </div>
      </div>
      <div class="lesson__bar">
        <button class="btn btn--lost" data-lost>${icon("question")}לא הבנתי</button>
        <button class="btn btn--primary" data-next></button>
      </div>`, "lesson");
    const next = $("[data-next]", el);
    const label = () => {
      next.innerHTML = shown < steps.length
        ? `הצעד הבא <span class="btn__count">${shown + 1}/${steps.length}</span> ${icon("arrow-left")}`
        : `${isLast ? "סיימתי" : "הבנתי"} ${icon(isLast ? "check" : "arrow-left")}`;
    };
    label();
    const read = () => speak(`${spoken(b.title)}. ${spoken(b.text)}. ${steps.slice(0, shown).map(spoken).join(". ")}`);
    bindLessonTop(el, read);
    if (S.settings.read) setTimeout(read, 350);
    bindTerms(el);
    next.onclick = () => {
      markStudied();
      if (shown < steps.length) {
        // Step by step: the main button reveals the next step.
        const ol = $(".steps", el);
        $$(".step", ol).forEach((li) => li.removeAttribute("data-now"));
        shown++;
        L.shown[i] = shown;
        ol.insertAdjacentHTML("beforeend", stepHtml(steps[shown - 1], shown - 1, shown < steps.length));
        bindTerms(ol);
        Sound.step();
        vibrate(6);
        label();
        ol.lastElementChild.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest" });
        if (S.settings.read) speak(spoken(steps[shown - 1]));
        return;
      }
      gotIt(i);
      advance();
    };
    $("[data-lost]", el).onclick = () => lostSheet(i);
    $$("[data-tool]", el).forEach((t) => {
      t.onclick = () => {
        const k = t.dataset.tool;
        if (k === "ask") return askSheet(i);
        addHelp(i, k);
      };
    });
  }

  function bindTerms(el) {
    $$(".term", el).forEach((t) => (t.onclick = () => termSheet(t.dataset.term)));
  }

  function advance() {
    if (L.pos >= L.steps.length - 1) return finishLesson();
    L.pos++;
    renderStep();
  }

  // Adds an explanation under the bite: example, simpler, again (from scratch), word, answer.
  function addHelp(i, kind, { word, question } = {}) {
    const b = L.lesson.bites[i];
    const extras = L.extras[i] || (L.extras[i] = []);
    const key = kind + "-" + Date.now();
    const box = $("[data-extras]");
    const offline = () => {
      if (kind === "example") return b.example ? { text: b.example } : null;
      if (kind === "simpler") return b.simpler ? { text: b.simpler } : null;
      if (kind === "again") return b.simpler ? { text: b.simpler, example: b.example } : null;
      if (kind === "word") {
        const m = lookup(word);
        return m ? { text: m } : null;
      }
      return null;
    };
    // Built-in help first for the simple asks: instant and free.
    const local = offline();
    const useAI = Tutor.available() && (L.lesson.ai || kind === "answer" || !local || extras.some((x) => x.kind === kind));
    if (!useAI) {
      if (!local) return toast(kind === "answer" ? "שאלות חופשיות יעבדו כשהמורה החכם יחובר." : "אין לי עוד הסבר כזה לחלק הזה.");
      if (extras.some((x) => x.kind === kind && x.text === local.text)) return scrollToExtra(extras.find((x) => x.kind === kind && x.text === local.text).key);
      const x = { kind, key, word, ...local };
      extras.push(x);
      box.insertAdjacentHTML("beforeend", extraHtml(x));
      afterExtra(key);
      return;
    }
    const x = { kind, key, word, q: question, loading: true };
    extras.push(x);
    box.insertAdjacentHTML("beforeend", extraHtml(x));
    scrollToExtra(key);
    Tutor.help({
      profile: profileForAI(),
      lesson: { title: L.lesson.title, subject: subjectOf(L.lesson.subject).name },
      bite: { title: spoken(b.title), text: spoken(biteText(b)) },
      kind,
      word: word || null,
      question: question || null,
      previous: extras.filter((e) => e.text).map((e) => spoken(e.text)).slice(-3),
    }).then((res) => {
      Object.assign(x, { loading: false, text: res.text, example: res.example || "" });
    }).catch(() => {
      const f = local || { text: "לא הצלחתי לענות עכשיו. אפשר לנסות שוב עוד רגע?" };
      Object.assign(x, { loading: false, ...f });
    }).finally(() => {
      const node = $(`[data-extra="${key}"]`);
      if (!node) return;
      const prev = node.previousElementSibling && node.previousElementSibling.classList.contains("extra--you") ? node.previousElementSibling : null;
      if (prev) prev.remove();
      node.outerHTML = extraHtml(x);
      afterExtra(key);
    });
  }

  function afterExtra(key) {
    const node = $(`[data-extra="${key}"]`);
    if (!node) return;
    bindTerms(node.parentElement);
    scrollToExtra(key);
    if (S.settings.read) speak(node.textContent.replace(/^\s*\S.*?\n/, ""));
  }
  function scrollToExtra(key) {
    const node = $(`[data-extra="${key}"]`);
    if (node) node.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
  }

  function lookup(word) {
    const gl = (L && L.lesson.glossary) || {};
    if (gl[word]) return gl[word];
    const k = Object.keys(gl).find((w) => w.includes(word) || word.includes(w));
    return k ? gl[k] : null;
  }

  // Sheets ----------------------------------------------------------------
  let sheetState = null;
  function sheet(html, label, onClose, variant) {
    closeSheet(true);
    const wrap = document.createElement("div");
    wrap.className = `sheet-wrap${variant ? ` sheet-wrap--${variant}` : ""}`;
    wrap.innerHTML = `<div class="sheet-scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="sheet__grip" aria-hidden="true"></div>${html}</div>`;
    document.body.appendChild(wrap);
    sheetState = { wrap, onClose, back: document.activeElement };
    $(".sheet-scrim", wrap).onclick = () => closeSheet();
    $$("[data-sheet-close]", wrap).forEach((b) => (b.onclick = () => closeSheet()));
    const f = $("[data-autofocus]", wrap) || $("button", wrap);
    if (f) f.focus({ preventScroll: true });
    return $(".sheet", wrap);
  }
  function closeSheet(instant) {
    if (!sheetState) return;
    const { wrap, onClose, back } = sheetState;
    sheetState = null;
    if (instant || reduceMotion()) wrap.remove();
    else { wrap.classList.add("sheet--closing"); setTimeout(() => wrap.remove(), 220); }
    if (onClose) onClose();
    if (back && back.isConnected && !instant) back.focus({ preventScroll: true });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sheetState) closeSheet();
    if (e.key === "Tab" && sheetState) {
      const f = $$("button, input, textarea, [tabindex]:not([tabindex='-1'])", sheetState.wrap).filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  function lostSheet(i) {
    L.lost++;
    const b = L.lesson.bites[i];
    const hasTerms = /\*\*(.+?)\*\*/.test(biteText(b));
    const lines = ["זה בסדר גמור. ככה לומדים.", "שאלה טובה זה חצי תשובה.", "כולם נתקעים לפעמים. גם המורים."];
    const s = sheet(`
      <div class="sheet__head">
        <div><h2 class="h2" tabindex="-1" data-autofocus>מה לא ברור?</h2><p class="lead small" style="margin-top:4px">${lines[(L.lost - 1) % lines.length]}</p></div>
        <button class="icon-btn" data-sheet-close aria-label="סגירה">${icon("x")}</button>
      </div>
      <div class="help-list">
        <button class="help-opt" data-h="simpler"><span class="help-opt__ic">${icon("feather")}</span><span><b>להסביר יותר פשוט</b><small>במילים קלות יותר</small></span></button>
        <button class="help-opt" data-h="example"><span class="help-opt__ic">${icon("lightbulb")}</span><span><b>דוגמה מהחיים</b><small>משהו שמכירים</small></span></button>
        ${hasTerms ? `<button class="help-opt" data-h="word"><span class="help-opt__ic">${icon("book-open-text")}</span><span><b>מילה שלא הבנתי</b><small>המילים הצבועות בהסבר</small></span></button>` : ""}
        <button class="help-opt" data-h="again"><span class="help-opt__ic">${icon("arrow-counter-clockwise")}</span><span><b>לא הבנתי כלום</b><small>נסביר מההתחלה, בדרך אחרת</small></span></button>
      </div>
      ${Tutor.available() ? `
      <div class="field"><label class="label small" for="lost-q">או ${g("כתוב", "כתבי")} במילים שלך מה לא ברור</label>
        <form class="ask" data-ask><textarea id="lost-q" class="textarea" maxlength="400" rows="1" placeholder="למשל: למה המכנה לא משתנה?"></textarea><button class="icon-btn" aria-label="שליחה">${icon("paper-plane-tilt")}</button></form></div>` : ""}
      ${L.lost >= 3 ? `<button class="btn btn--ghost" data-break>${icon("coffee")}אולי הפסקה קטנה? הראש צריך מנוחה לפעמים</button>` : ""}
    `, "מה לא ברור");
    $$("[data-h]", s).forEach((btn) => {
      btn.onclick = () => {
        const k = btn.dataset.h;
        if (k === "word") {
          const words = [...new Set([...biteText(b).matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]))];
          closeSheet(true);
          return wordPick(words);
        }
        closeSheet();
        addHelp(i, k);
      };
    });
    const form = $("[data-ask]", s);
    if (form) bindAsk(form, i);
    const br = $("[data-break]", s);
    if (br) br.onclick = () => { closeSheet(true); breakSheet(); };
  }

  function bindAsk(form, i) {
    const ta = $("textarea", form);
    ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
    form.onsubmit = (e) => {
      e.preventDefault();
      const q = ta.value.trim();
      if (!q) return ta.focus();
      closeSheet();
      addHelp(i, "answer", { question: q });
    };
  }

  function askSheet(i) {
    if (!Tutor.available()) return toast("שאלות חופשיות יעבדו כשהמורה החכם יחובר.");
    const s = sheet(`
      <div class="sheet__head"><h2 class="h2">מה ${g("תרצה", "תרצי")} לשאול?</h2><button class="icon-btn" data-sheet-close aria-label="סגירה">${icon("x")}</button></div>
      <p class="lead small" style="margin-top:-6px">אין שאלה טיפשית. באמת.</p>
      <form class="ask" data-ask><label class="sr-only" for="ask-q">השאלה שלך</label><textarea id="ask-q" class="textarea" maxlength="400" rows="1" placeholder="השאלה שלך" data-autofocus></textarea><button class="icon-btn" aria-label="שליחה">${icon("paper-plane-tilt")}</button></form>
    `, "שאלה משלי");
    bindAsk($("[data-ask]", s), i);
  }

  function wordPick(words) {
    const s = sheet(`
      <div class="sheet__head"><h2 class="h2" tabindex="-1" data-autofocus>איזו מילה?</h2><button class="icon-btn" data-sheet-close aria-label="סגירה">${icon("x")}</button></div>
      <div class="chips">${words.map((w) => `<button class="chip" data-w="${esc(w)}">${plain(w)}</button>`).join("")}</div>
      <p class="small muted" style="margin:0">טיפ: אפשר תמיד ללחוץ על מילה צבועה בהסבר.</p>
    `, "איזו מילה");
    $$("[data-w]", s).forEach((b) => (b.onclick = () => termSheet(b.dataset.w)));
  }

  function termSheet(word) {
    const meaning = lookup(word);
    const s = sheet(`
      <div class="sheet__head"><span class="small muted">מה זה אומר?</span><button class="icon-btn" data-sheet-close aria-label="סגירה">${icon("x")}</button></div>
      <div class="word-card"><div class="word-card__w">${plain(word)}</div><p class="reading" style="margin:0" data-meaning>${meaning ? rich(meaning, { lines: false }) : `<span class="typing" aria-label="חושב"><i></i><i></i><i></i></span>`}</p></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn--soft" data-say style="flex:1">${icon("speaker-high")}להקריא</button>
        <button class="btn btn--primary" data-sheet-close style="flex:1">הבנתי</button>
      </div>
    `, `מה זה ${word}`);
    const say = () => speak(`${word}. ${spoken($("[data-meaning]", s).textContent)}`);
    $("[data-say]", s).onclick = say;
    if (!meaning) {
      const step = L && L.steps[L.pos];
      const b = step ? L.lesson.bites[step.i] : null;
      if (!Tutor.available() || !b) { $("[data-meaning]", s).textContent = "אין לי עדיין הסבר למילה הזו."; return; }
      Tutor.help({ profile: profileForAI(), lesson: { title: L.lesson.title, subject: subjectOf(L.lesson.subject).name }, bite: { title: spoken(b.title), text: spoken(biteText(b)) }, kind: "word", word })
        .then((r) => { L.lesson.glossary = { ...(L.lesson.glossary || {}), [word]: r.text }; save(); const m = $("[data-meaning]", s); if (m) m.innerHTML = rich(r.text, { lines: false }); })
        .catch(() => { const m = $("[data-meaning]", s); if (m) m.textContent = "לא הצלחתי להביא הסבר עכשיו."; });
    } else if (S.settings.read) setTimeout(say, 250);
  }

  function breakSheet() {
    const mins = Math.max(1, Math.round((L ? L.activeMs : 0) / 60000));
    const s = sheet(`
      <div class="sheet__head"><div><h2 class="h2" tabindex="-1" data-autofocus>${g("עבדת", "עבדת")} יפה${L && L.activeMs > 60000 ? ` ${mins} דקות` : ""}.</h2><p class="lead small" style="margin-top:4px">הראש לומד גם בהפסקות. ממש.</p></div><button class="icon-btn" data-sheet-close aria-label="סגירה">${icon("x")}</button></div>
      <div class="help-list">
        <button class="help-opt" data-b="breathe"><span class="help-opt__ic">${icon("wind")}</span><span><b>נשימה של דקה</b><small>להירגע ולחזור עם ראש נקי</small></span></button>
        <button class="help-opt" data-b="go"><span class="help-opt__ic">${icon("arrow-left")}</span><span><b>להמשיך ללמוד</b><small>אני בפוקוס</small></span></button>
        <button class="help-opt" data-b="stop"><span class="help-opt__ic">${icon("house")}</span><span><b>מספיק להיום</b><small>ההתקדמות נשמרת</small></span></button>
      </div>`, "הפסקה");
    $$("[data-b]", s).forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.b;
        if (k === "breathe") return breathe();
        closeSheet();
        if (k === "stop") { clearInterval(breakTimer); home(); }
      };
    });
  }

  function breathe() {
    const s = sheet(`
      <div class="sheet__head"><h2 class="h2">נושמים ביחד</h2><button class="icon-btn" data-sheet-close aria-label="סגירה">${icon("x")}</button></div>
      <div class="breath"><div class="breath__ring ${reduceMotion() ? "" : "run"}"><span data-say role="status" aria-live="polite">שאיפה...</span></div>
      <p class="small muted" style="margin:0" data-count>3 נשימות</p></div>
      <button class="btn btn--primary btn--block" data-sheet-close>${g("אני מוכן, ממשיכים", "אני מוכנה, ממשיכים")}</button>
    `, "נשימה", () => clearInterval(t));
    const say = $("[data-say]", s);
    const cnt = $("[data-count]", s);
    const phases = ["שאיפה...", "להחזיק...", "נשיפה..."];
    let k = 0, rounds = 3;
    const t = setInterval(() => {
      k++;
      say.textContent = phases[k % 3];
      if (k % 3 === 0) {
        rounds--;
        cnt.textContent = rounds > 0 ? `עוד ${rounds === 1 ? "נשימה אחת" : `${rounds} נשימות`}` : "כל הכבוד";
        if (rounds <= 0) { clearInterval(t); say.textContent = "מצוין"; }
      }
    }, 4000);
  }

  // Quick check -----------------------------------------------------------
  const KEYS = ["א", "ב", "ג", "ד"];
  function checkHtml(c, { kicker }) {
    return `
      <span class="lesson__kicker">${esc(kicker)}</span>
      <article class="bite bite--enter check">
        <h1 class="check__q" tabindex="-1" data-autofocus>${rich(c.question, { lines: false })}</h1>
        <div class="choices" role="group" aria-label="תשובות">
          ${c.options.map((o, k) => `<button class="answer" data-a="${k}"><span class="answer__key" aria-hidden="true">${KEYS[k]}</span><span>${rich(o, { lines: false })}</span></button>`).join("")}
          <button class="answer answer--unsure" data-a="-1"><span class="answer__key" aria-hidden="true">${icon("question", "icon--sm")}</span><span>${g("לא בטוח", "לא בטוחה")}</span></button>
        </div>
        <div data-fb aria-live="polite"></div>
      </article>`;
  }

  // Wires up a check. onDone(right) is called when the learner moves on.
  function bindCheck(el, c, onAnswer) {
    let locked = false;
    $$("[data-a]", el).forEach((btn) => {
      btn.onclick = () => {
        if (locked) return;
        locked = true;
        const a = Number(btn.dataset.a);
        const right = a === c.answer;
        const rightBtn = $(`[data-a="${c.answer}"]`, el);
        $$("[data-a]", el).forEach((x) => { if (x !== rightBtn && x !== btn) x.dataset.state = "faded"; x.setAttribute("aria-disabled", "true"); });
        rightBtn.dataset.state = "right";
        if (!right && a >= 0) btn.dataset.state = "almost";
        if (a < 0) btn.dataset.state = "faded";
        const fb = $("[data-fb]", el);
        const why = c.why ? `<p>${rich(c.why, { lines: false })}</p>` : "";
        if (right) {
          const praise = ["נכון!", "בדיוק!", "יש!", "מעולה!"][Math.floor(Math.random() * 4)];
          fb.innerHTML = `<div class="feedback feedback--yes"><span class="feedback__ic">${icon("check")}</span><div><b>${praise}</b>${why}</div></div>`;
          burst(rightBtn);
          vibrate(18);
          Sound.right();
          logEvent("right", L ? L.lesson.title : "");
        } else if (a < 0) {
          fb.innerHTML = `<div class="feedback"><span class="feedback__ic">${icon("lightbulb")}</span><div><b>זה בסדר לא לדעת. עכשיו ${g("אתה יודע", "את יודעת")}:</b>${why}</div></div>`;
          Sound.soft();
        } else {
          fb.innerHTML = `<div class="feedback"><span class="feedback__ic">${icon("lightbulb")}</span><div><b>כמעט! ככה זה עובד:</b>${why}</div></div>`;
          Sound.soft();
        }
        bindTerms(fb);
        if (S.settings.read) speak(fb.textContent);
        onAnswer(right, a);
      };
    });
  }

  function renderCheck(i) {
    const c = L.lesson.bites[i].check;
    const a = derive();
    const calmLine = a.calm && L.firstCheck ? "רק תרגול. אף אחד לא בודק, ואין ציון." : "בדיקה קטנה, בלי ציון";
    L.firstCheck = false;
    const isLast = L.pos === L.steps.length - 1;
    const el = mount(`
      ${lessonTop()}
      <div class="lesson__stage">${checkHtml(c, { kicker: calmLine })}</div>
      <div class="lesson__bar" style="grid-template-columns:1fr">
        <button class="btn btn--primary" data-next disabled>${isLast ? "סיימתי" : "ממשיכים"} ${icon(isLast ? "check" : "arrow-left")}</button>
      </div>`, "lesson");
    bindLessonTop(el, () => speak(`${spoken(c.question)}. ${c.options.map((o, k) => `${KEYS[k]}: ${spoken(o)}`).join(". ")}`));
    if (S.settings.read) setTimeout(() => speak(`${spoken(c.question)}. ${c.options.map((o, k) => `${KEYS[k]}: ${spoken(o)}`).join(". ")}`), 350);
    const next = $("[data-next]", el);
    bindCheck(el, c, (right) => {
      L.answered[i] = right;
      const rec = S.lessons[L.id];
      rec.misses = rec.misses || [];
      if (!right && !rec.misses.includes(i)) rec.misses.push(i);
      if (right) rec.misses = rec.misses.filter((x) => x !== i);
      save();
      markStudied();
      next.disabled = false;
      next.focus({ preventScroll: true });
      next.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest" });
    });
    next.onclick = advance;
  }

  // Done ------------------------------------------------------------------
  function finishLesson() {
    clearInterval(breakTimer);
    stopSpeaking();
    const rec = S.lessons[L.id];
    rec.done = true;
    rec.pos = 0;
    rec.updated = Date.now();
    const c = rec.courseId && S.courses[rec.courseId];
    if (c && c.chapters[rec.chapter]) { c.chapters[rec.chapter].done = true; c.updated = Date.now(); }
    save();
    markStudied();
    logEvent("lesson", c ? c.title : L.lesson.title);
    done(L.id);
  }

  function done(id) {
    current = { name: "done" };
    const lesson = getLesson(id);
    const rec = S.lessons[id];
    const right = Object.values(L ? L.answered : {}).filter(Boolean).length;
    const total = Object.keys(L ? L.answered : {}).length;
    const got = L ? L.got : 0;
    const c = rec.courseId && S.courses[rec.courseId];
    const nextCh = c ? c.chapters[rec.chapter + 1] : null;
    const el = mount(`
      <div class="topbar"><span class="topbar__spacer"></span><button class="icon-btn" data-home aria-label="למסך הראשי">${icon("x")}</button></div>
      <div class="done__hero">
        <span class="done__badge pop" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path class="draw" d="M12 25l8 8 16-17"/></svg></span>
        <h1 class="h1" tabindex="-1" data-autofocus>${c ? `שלב ${rec.chapter + 1} מאחוריך!` : `${g("סיימת", "סיימת")}!`}</h1>
        <p class="lead">${plain(lesson.title)}${total ? `. ${right} מתוך ${total} שאלות נכונות${right < total ? ", והשאר כבר ברורות יותר." : "."}` : "."}</p>
        ${got ? `<div class="done__stats"><span class="done__stat"><b>${got}</b>${got === 1 ? "דבר חדש" : "דברים חדשים"}</span>${total ? `<span class="done__stat"><b>${right}</b>${right === 1 ? "תשובה נכונה" : "תשובות נכונות"}</span>` : ""}</div>` : ""}
      </div>
      ${lesson.summary && lesson.summary.length ? `
      <section class="section" style="margin-top:0" aria-labelledby="sum-t">
        <h2 class="h3" id="sum-t">מה למדנו, בקצרה</h2>
        <div class="summary"><ol>${lesson.summary.map((s) => `<li><span>${rich(s, { lines: false })}</span></li>`).join("")}</ol></div>
      </section>` : ""}
      <section class="section" aria-labelledby="feel-t">
        <h2 class="h3" id="feel-t">איך ${g("אתה מרגיש", "את מרגישה")} עם החומר?</h2>
        <div class="feel" role="radiogroup" aria-labelledby="feel-t">
          <button class="choice" role="radio" data-feel="good" aria-checked="${rec.feel === "good"}">${icon("smiley")}<span>${g("מבין", "מבינה")} לגמרי</span></button>
          <button class="choice" role="radio" data-feel="ok" aria-checked="${rec.feel === "ok"}">${icon("smiley-meh")}<span>בערך</span></button>
          <button class="choice" role="radio" data-feel="lost" aria-checked="${rec.feel === "lost"}">${icon("smiley-nervous")}<span>עדיין ${g("מבולבל", "מבולבלת")}</span></button>
        </div>
        <div data-feel-out></div>
      </section>
      <div class="sticky-foot" style="display:grid;gap:8px">
        ${c ? `<button class="btn btn--primary btn--block" data-path><span class="btn__ell">${nextCh ? `לשלב הבא: ${esc(nextCh.title)}` : "לסיים את המסלול"}</span>${icon("arrow-left")}</button>` : ""}
        <button class="btn ${c ? "btn--soft" : "btn--primary"} btn--block" data-home2>${icon("house")}למסך הראשי</button>
        ${stepsOf(lesson).some((s) => s.t === "check") ? `<button class="btn btn--ghost" data-review>${icon("list-checks")}תרגול מהיר</button>` : ""}
      </div>`, "done");
    bindTerms(el);
    Sound.win();
    $("[data-home]", el).onclick = home;
    $("[data-home2]", el).onclick = home;
    const pb = $("[data-path]", el);
    if (pb) pb.onclick = () => coursePath(rec.courseId, { justDone: rec.chapter });
    const rv = $("[data-review]", el);
    if (rv) rv.onclick = () => review(id);
    const out = $("[data-feel-out]", el);
    radio(el, "data-feel", (v) => {
      rec.feel = v;
      save();
      out.innerHTML = v === "lost"
        ? `<div class="feedback" style="margin-top:12px"><span class="feedback__ic">${icon("heart")}</span><div><b>הכל טוב, נעבור על זה שוב.</b><p>הפעם עם ההסבר הכי פשוט ודוגמה בכל שלב.</p><button class="btn btn--soft" data-simple style="margin-top:12px;min-height:48px">${icon("feather")}לעבור שוב, הכי פשוט</button></div></div>`
        : v === "ok" ? `<p class="small muted" style="margin:12px 0 0">שמרתי לך את זה בחזרה המהירה במסך הראשי.</p>` : `<p class="small muted" style="margin:12px 0 0">אלוף${g("", "ה")}. ${g("אתה", "את")} ${g("מוכן", "מוכנה")} לזה.</p>`;
      const sb = $("[data-simple]", out);
      if (sb) sb.onclick = () => openLesson(id, { simple: true, restart: true });
    });
    if (!reduceMotion()) setTimeout(() => burst($(".done__badge", el)), 420);
  }

  // Review: all the checks of a lesson, the missed ones first ------------
  function review(id) {
    const lesson = getLesson(id);
    const rec = S.lessons[id] || {};
    const misses = new Set(rec.misses || []);
    const qs = lesson.bites.map((b, i) => ({ i, c: b.check })).filter((x) => x.c);
    qs.sort((x, y) => misses.has(y.i) - misses.has(x.i));
    if (!qs.length) return openLesson(id, { restart: true });
    let k = 0, right = 0;
    const show = () => {
      current = { name: "review" };
      const q = qs[k];
      const el = mount(`
        <div class="topbar">
          <button class="icon-btn" data-close aria-label="יציאה">${icon("x")}</button>
          <div class="progress" aria-hidden="true">${qs.map((_, j) => `<span class="progress__seg" data-state="${j < k ? "done" : j === k ? "now" : "todo"}"></span>`).join("")}</div>
          <span style="width:46px"></span>
        </div>
        <div class="lesson__stage">${checkHtml(q.c, { kicker: `חזרה מהירה: ${lesson.title}` })}</div>
        <div class="lesson__bar" style="grid-template-columns:1fr"><button class="btn btn--primary" data-next disabled>${k === qs.length - 1 ? "סיימתי" : "הבאה"} ${icon("arrow-left")}</button></div>`, "lesson");
      L = L && L.id === id ? L : { id, lesson, steps: stepsOf(lesson), pos: 0, extras: {}, answered: {} };
      $("[data-close]", el).onclick = home;
      const next = $("[data-next]", el);
      bindCheck(el, q.c, (ok) => {
        if (ok) right++;
        rec.misses = (rec.misses || []).filter((x) => x !== q.i);
        if (!ok) rec.misses.push(q.i);
        S.lessons[id] = rec;
        save();
        markStudied();
        next.disabled = false;
        next.focus({ preventScroll: true });
      });
      next.onclick = () => {
        if (k < qs.length - 1) { k++; show(); return; }
        if (right === qs.length) { rec.feel = "good"; save(); }
        reviewDone(id, right, qs.length);
      };
    };
    show();
  }

  function reviewDone(id, right, total) {
    const lesson = getLesson(id);
    const all = right === total;
    const el = mount(`
      <div class="done__hero" style="padding-top:60px">
        <span class="done__badge pop" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path class="draw" d="M12 25l8 8 16-17"/></svg></span>
        <h1 class="h1" tabindex="-1" data-autofocus>${right} מתוך ${total}</h1>
        <p class="lead">${all ? `${esc(lesson.title)}: ${g("אתה", "את")} ${g("שולט", "שולטת")} בזה.` : "כל טעות עכשיו היא טעות שלא תהיה במבחן."}</p>
      </div>
      <div class="sticky-foot" style="display:grid;gap:8px;margin-top:auto">
        ${all ? "" : `<button class="btn btn--soft btn--block" data-again>${icon("feather")}לעבור על השיעור שוב, הכי פשוט</button>`}
        <button class="btn btn--primary btn--block" data-home>${icon("house")}למסך הראשי</button>
      </div>`, "done");
    $("[data-home]", el).onclick = home;
    const ag = $("[data-again]", el);
    if (ag) ag.onclick = () => openLesson(id, { simple: true, restart: true });
    if (all) setTimeout(() => burst($(".done__badge", el)), 420);
  }

  // Settings --------------------------------------------------------------
  function settingsSheet() {
    const st = S.settings;
    const seg = (key, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, l, a]) => `<button role="radio" data-set="${key}" data-v="${v}" aria-checked="${st[key] === v}" ${a ? `aria-label="${a}"` : ""}>${l}</button>`).join("")}</div>`;
    const sw = (key, on) => `<button class="switch" role="switch" data-sw="${key}" aria-checked="${on}" aria-label="${key}"></button>`;
    const s = sheet(`
      <div class="sheet__head"><h2 class="h2" tabindex="-1" data-autofocus>הגדרות</h2><button class="icon-btn" data-sheet-close aria-label="סגירה">${icon("x")}</button></div>
      <div class="set-group">
        <div class="set-row"><span class="set-row__l">${icon("text-aa")}גודל טקסט</span>${seg("size", [["m", "א", "רגיל"], ["l", "א+", "גדול"], ["xl", "א++", "גדול מאוד"]])}</div>
        <div class="set-row"><span class="set-row__l" id="sw-c">${icon("book-open-text")}ריווח נוח לקריאה</span>${sw("comfort", st.comfort)}</div>
        <div class="set-row"><span class="set-row__l" id="sw-r">${icon("speaker-high")}הקראה בקול</span>${sw("read", st.read)}</div>
        <div class="set-row"><span class="set-row__l" id="sw-s">${icon("smiley")}צלילים קטנים</span>${sw("sound", st.sound !== false)}</div>
      </div>
      <div class="set-group">
        <div class="set-row"><span class="set-row__l">${icon("moon")}מראה</span>${seg("theme", [["auto", "אוטומטי"], ["light", "בהיר"], ["dark", "כהה"]])}</div>
        <div class="set-row"><span class="set-row__l" id="sw-m">${icon("sparkle")}פחות אנימציות</span>${sw("motion", st.motion === "off")}</div>
      </div>
      <div class="set-group">
        <button class="set-row" data-edit style="width:100%"><span class="set-row__l">${icon("sliders-horizontal")}לעדכן את הפרטים שלי</span>${icon("caret-left", "icon--sm")}</button>
        <button class="set-row" data-wipe style="width:100%"><span class="set-row__l">${icon("trash")}למחוק הכל ולהתחיל מחדש</span></button>
      </div>
      <p class="small muted" style="margin:0">כל המידע נשמר רק בדפדפן הזה.${Tutor.available() ? " כשהמורה החכם מכין שיעור, הוא מקבל את הגיל, הכיתה וסגנון הלמידה (בלי השם) ואת החומר ששלחת." : ""}</p>
    `, "הגדרות");
    $("[data-sw='comfort']", s).setAttribute("aria-labelledby", "sw-c");
    $("[data-sw='read']", s).setAttribute("aria-labelledby", "sw-r");
    $("[data-sw='motion']", s).setAttribute("aria-labelledby", "sw-m");
    $("[data-sw='sound']", s).setAttribute("aria-labelledby", "sw-s");
    $$("[data-set]", s).forEach((b) => {
      b.onclick = () => {
        st[b.dataset.set] = b.dataset.v;
        $$(`[data-set="${b.dataset.set}"]`, s).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        save();
        applySettings();
      };
    });
    $$("[data-sw]", s).forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.sw;
        if (k === "motion") st.motion = st.motion === "off" ? "auto" : "off";
        else if (k === "sound") st.sound = st.sound === false;
        else st[k] = !st[k];
        b.setAttribute("aria-checked", String(k === "motion" ? st.motion === "off" : k === "sound" ? st.sound !== false : st[k]));
        if (k === "sound") Sound.tick();
        if (k === "read" && !st.read) stopSpeaking();
        if (k === "read" && st.read && !canSpeak()) toast("בדפדפן הזה אין הקראה בעברית, אבל ננסה.");
        save();
        applySettings();
      };
    });
    $("[data-edit]", s).onclick = () => { closeSheet(true); onboarding(0, JSON.parse(JSON.stringify(S.profile))); };
    $("[data-wipe]", s).onclick = () => {
      if (!confirm("למחוק את כל הפרטים והשיעורים מהמכשיר הזה?")) return;
      try { localStorage.removeItem(KEY); } catch { /* nothing to remove */ }
      S = defaults();
      draftGender = null;
      applySettings();
      welcome();
    };
  }

  // ---------- Speech ----------
  let voice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find((v) => /^he|^iw/i.test(v.lang)) || null;
  }
  const canSpeak = () => "speechSynthesis" in window && Boolean(voice);
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/\s+/g, " ").trim());
      u.lang = "he-IL";
      if (voice) u.voice = voice;
      u.rate = 0.92;
      speechSynthesis.speak(u);
    } catch { /* speech not available */ }
  }
  function stopSpeaking() {
    try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch { /* nothing to stop */ }
  }

  // ---------- Start ----------
  applySettings();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySettings);
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  document.addEventListener("visibilitychange", () => { if (L) L.lastTick = Date.now(); });
  if (S.profile) home(); else welcome();
})();
