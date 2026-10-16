import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { IconCar, IconCheck, IconClock, IconPin, IconSend, IconShield } from "../components/icons";
import { Avatar, Blaze } from "../components/marks";
import { BackBar } from "../components/ui";
import { personById } from "../data/seed";
import { trailById } from "../data/trails";
import { clock } from "../lib";
import { useNav } from "../nav";
import { useStore } from "../store";

const quick = ["איזה קצב נוח לך?", "יש לך רכב?", "מה עם מים בדרך?", "אפשר להביא כלב?", "סגור, אני בא/ה"];

// Canned replies so the prototype feels alive. A real backend replaces this.
function replyTo(text: string, g: "f" | "m" | "x"): string {
  const bring = g === "f" ? "מביאה" : "מביא";
  if (text.includes("קצב")) return "בערך 4-4.5 קמ״ש בשטח פתוח, יותר לאט בירידות. עוצרים כל שעה וחצי.";
  if (text.includes("רכב")) return "יש לי רכב. אם גם לך יש, נשאיר אחד בסוף ונחסוך טרמפ.";
  if (text.includes("מים")) return `אין מים בדרך. 3-4 ליטר לאדם, ואני ${bring} עוד 2 ברכב.`;
  if (text.includes("כלב")) return "בשמחה, רק שיהיה עם מים משלו ורצועה בקטעים עם מטפסים.";
  if (text.includes("סגור") || text.includes("בא")) return "מעולה! הוספתי אותך לתוכנית. נתראה בנקודת המפגש 🙌";
  return "נשמע טוב. בוא/י נסגור את הפרטים בכרטיס התוכנית למעלה.";
}

export function Chat({ id }: { id: string }) {
  const { state, dispatch } = useStore();
  const { pop, push } = useNav();
  const thread = state.threads.find((t) => t.id === id);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thread?.unread) dispatch({ type: "read", threadId: id });
  }, [thread?.unread, id, dispatch]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread?.messages.length, typing]);

  if (!thread) return null;
  const who = personById(thread.withId)!;
  const post = state.posts.find((p) => p.id === thread.postId);
  const trail = post ? trailById(post.trailId) : null;
  const done = thread.plan.gear.filter((g) => g.done).length;

  const send = (body: string) => {
    const msg = body.trim();
    if (!msg) return;
    dispatch({ type: "send", threadId: id, message: { id: crypto.randomUUID(), from: "me", text: msg, at: Date.now() } });
    setText("");
    window.setTimeout(() => setTyping(true), 500);
    window.setTimeout(() => {
      setTyping(false);
      dispatch({
        type: "send",
        threadId: id,
        message: { id: crypto.randomUUID(), from: who.id, text: replyTo(msg, who.g), at: Date.now() },
      });
    }, 1900);
  };

  return (
    <div className="chat">
      <BackBar onBack={pop}>
        <button className="chat-who" onClick={() => push({ k: "person", id: who.id })}>
          <Avatar name={who.name} ink={who.ink} size={34} verified={who.verified} />
          <span>
            <b>{who.name}</b>
            {trail && (
              <small>
                <Blaze color={trail.blaze} size={14} /> {trail.name}
              </small>
            )}
          </span>
        </button>
      </BackBar>

      <motion.section className={`plan ${planOpen ? "open" : ""}`} layout transition={{ type: "spring", stiffness: 300, damping: 32 }}>
        <motion.button layout="position" className="plan-head" onClick={() => setPlanOpen(!planOpen)} aria-expanded={planOpen}>
          <span className="plan-label mono">תוכנית</span>
          <span className="plan-summary">
            {thread.plan.time} · {thread.plan.meet}
          </span>
          <span className="plan-progress mono">
            {done}/{thread.plan.gear.length}
          </span>
        </motion.button>
        <AnimatePresence initial={false}>
          {planOpen && (
            <motion.div
              className="plan-body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="plan-line">
                <IconPin size={18} />
                {thread.plan.meet}
              </div>
              <div className="plan-line">
                <IconClock size={18} />
                {thread.plan.time}
              </div>
              <div className="plan-line">
                <IconCar size={18} />
                {thread.plan.cars}
              </div>
              <h4>ציוד משותף</h4>
              <ul className="gear">
                {thread.plan.gear.map((g, i) => (
                  <li key={g.label}>
                    <button className={g.done ? "done" : ""} onClick={() => dispatch({ type: "toggleGear", threadId: id, index: i })}>
                      <span className="box">{g.done && <IconCheck size={14} />}</span>
                      <span className="gear-label">{g.label}</span>
                      <span className="mono gear-who">{g.who}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className={`share ${thread.plan.shareWithEmergency ? "on" : ""}`}
                onClick={() => dispatch({ type: "toggleShare", threadId: id })}
                aria-pressed={thread.plan.shareWithEmergency}
              >
                <IconShield size={18} />
                <span>{thread.plan.shareWithEmergency ? "המסלול משותף עם איש הקשר לחירום" : "שיתוף המסלול עם איש קשר לחירום"}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      <div className="msgs">
        {thread.messages.map((m, i) => {
          if (m.kind === "system")
            return (
              <div key={m.id} className="msg-system mono">
                {m.text}
              </div>
            );
          const mine = m.from === "me";
          const prev = thread.messages[i - 1];
          const grouped = prev && prev.from === m.from && m.at - prev.at < 5 * 60_000;
          return (
            <motion.div
              key={m.id}
              className={`msg ${mine ? "mine" : "theirs"} ${grouped ? "grouped" : ""}`}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
            >
              <p>{m.text}</p>
              <time className="mono">{clock(m.at)}</time>
            </motion.div>
          );
        })}
        <AnimatePresence>
          {typing && (
            <motion.div className="msg theirs typing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {[0, 1, 2].map((i) => (
                <motion.i
                  key={i}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.14, ease: "easeInOut" }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={end} />
      </div>

      <div className="composer">
        <div className="quick">
          {quick.map((q) => (
            <button key={q} className="chip" onClick={() => send(q)}>
              <span className="chip-text">{q}</span>
            </button>
          ))}
        </div>
        <form
          className="composer-row"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`הודעה ל${who.name.split(" ")[0]}`} aria-label="הודעה" />
          <motion.button className="send" type="submit" whileTap={{ scale: 0.85, rotate: -20 }} aria-label="שליחה" disabled={!text.trim()}>
            <IconSend />
          </motion.button>
        </form>
      </div>
    </div>
  );
}
