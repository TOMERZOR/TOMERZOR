// The voice quiz card: one follower message at a time, the creator answers
// as they would in DMs. Answers are saved as they're typed.

import { h, toast, busy } from "../dom.js";
import { store } from "../store.js";
import { analyze, engine } from "../engine.js";
import { QUIZ, quizQuestion, quizProgress } from "../../core/quiz.js";

let step = null; // index of the open question, or "done"

function answers() {
  return store.state.persona.quiz?.answers || {};
}

function setAnswer(id, text) {
  store.update((s) => {
    s.persona.quiz = { answers: { ...(s.persona.quiz?.answers || {}), [id]: text } };
  });
}

export function quizCard(rerender) {
  const p = store.state.persona;
  const done = quizProgress(p);
  if (step === null) {
    const next = QUIZ.findIndex((q) => !answers()[q.id]?.trim());
    step = next === -1 ? "done" : next;
  }

  const count = h("span", { class: "mono quiz-count" }, `${done}/${QUIZ.length}`);
  const fill = h("span", { class: "fill", style: `transform: scaleX(${done / QUIZ.length})` });
  const dots = h(
    "div",
    { class: "quiz-dots", role: "list" },
    QUIZ.map((q, i) =>
      h("button", {
        type: "button",
        role: "listitem",
        class: `${answers()[q.id]?.trim() ? "answered" : ""}${step === i ? " current" : ""}`,
        "aria-label": `שאלה ${i + 1}: ${q.topic}`,
        title: q.topic,
        onclick: () => { step = i; rerender(); },
      }, String(i + 1)),
    ),
  );

  const card = h(
    "section",
    { class: "card quiz" },
    h("header", {}, h("h2", {}, "מבחן הקול"), count, h("p", {}, "10 הודעות שעוקבים באמת שולחים. ענו כמו שהייתם עונים בפרטי, באותן מילים ובאותם אימוג׳ים. התשובות האלה הן הדוגמאות שקולי סומכת עליהן הכי הרבה.")),
    h("div", { class: "quiz-progress", "aria-hidden": "true" }, fill),
    dots,
  );

  if (step === "done") {
    card.append(summary(rerender, done));
    return card;
  }

  const q = QUIZ[step];
  const box = h("textarea", { id: `quiz-${q.id}`, rows: 3, value: answers()[q.id] || "", placeholder: "איך היית עונה?", "aria-label": "התשובה שלך" });
  box.addEventListener("input", () => {
    setAnswer(q.id, box.value);
    const n = quizProgress(store.state.persona);
    count.textContent = `${n}/${QUIZ.length}`;
    fill.style.transform = `scaleX(${n / QUIZ.length})`;
    dots.children[step].classList.toggle("answered", Boolean(box.value.trim()));
  });
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) go(step + 1);
  });
  const last = step === QUIZ.length - 1;
  const go = (to) => {
    step = to >= QUIZ.length ? "done" : Math.max(0, to);
    rerender();
    requestAnimationFrame(() => document.querySelector(".quiz textarea")?.focus({ preventScroll: true }));
  };

  card.append(
    h(
      "div",
      { class: "quiz-q" },
      h("div", { class: "row" }, h("span", { class: "chip accent" }, `${step + 1}. ${q.topic}`), h("span", { class: "hint" }, `בודק: ${q.why}`)),
      h("div", { class: "msg fan new" }, quizQuestion(q, p.gender)),
      box,
      h(
        "div",
        { class: "row" },
        h("button", { type: "button", class: "btn", onclick: () => go(step + 1) }, last ? "סיום" : "הבא"),
        step > 0 && h("button", { type: "button", class: "btn quiet", onclick: () => go(step - 1) }, "הקודם"),
        h("span", { class: "spacer" }),
        !last && h("button", { type: "button", class: "btn quiet small", onclick: () => go(step + 1) }, "דילוג"),
      ),
    ),
  );
  return card;
}

function summary(rerender, done) {
  const analyzeBtn = h("button", { type: "button", class: "btn", disabled: engine.kind === "none" || done < 3 }, "ניתוח הקול עם התשובות");
  analyzeBtn.addEventListener("click", () =>
    busy(analyzeBtn, "מנתחת… (עד דקה)", async () => {
      const profile = await analyze(store.state.persona);
      store.update((s) => (s.persona.profile = profile));
      toast("פרופיל הקול עודכן לפי התשובות שלך");
      rerender();
    }),
  );
  const a = answers();
  return h(
    "div",
    { class: "quiz-q" },
    h("p", { class: "quiz-done" }, done === QUIZ.length ? "סיימת את המבחן. קולי תשתמש בתשובות האלה בכל שיחה." : `ענית על ${done} מתוך ${QUIZ.length}. כל תשובה עוזרת, ואפשר להשלים את השאר מתי שרוצים.`),
    h(
      "ul",
      { class: "list" },
      QUIZ.filter((q) => a[q.id]?.trim()).map((q) =>
        h("li", { class: "pair" }, h("div", {}, h("b", {}, `${q.topic}: `), quizQuestion(q, store.state.persona.gender), h("br"), h("b", {}, "את/ה: "), a[q.id])),
      ),
    ),
    h(
      "div",
      { class: "row" },
      analyzeBtn,
      h("button", { type: "button", class: "btn quiet", onclick: () => { step = QUIZ.findIndex((q) => !a[q.id]?.trim()); if (step === -1) step = 0; rerender(); } }, done === QUIZ.length ? "עריכת תשובות" : "להשלים את המבחן"),
    ),
  );
}
