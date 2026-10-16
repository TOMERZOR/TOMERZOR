import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useActions } from "../actions";
import type { Post } from "../data/seed";
import { trailById } from "../data/trails";
import { clock, durationLabel, GRACE_MIN, minutesLeft, startsAt, suggestedReturn, tripPhase, whenLabel, type TripPhase } from "../lib";
import { useNav } from "../nav";
import { crewOf, findPerson, myCheckin, useStore } from "../store";
import { IconCheck, IconShield } from "./icons";
import { Avatar, Cairn } from "./marks";

/** Re-renders every `ms` so countdowns stay current. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/** Earliest return time the server accepts, with a little room. */
const earliest = () => Math.ceil((Date.now() + 15 * 60_000) / 60_000) * 60_000;

const maskPhone = (p: string) => (p.length > 4 ? `${"•".repeat(Math.max(0, p.length - 4))}${p.slice(-4)}` : p);

/** Return-time picker: moves in half hours, never earlier than 15 minutes from now. */
function TimePicker({ value, onChange }: { value: number; onChange: (ms: number) => void }) {
  const step = (d: number) => onChange(Math.max(value + d * 30 * 60_000, earliest()));
  return (
    <div className="tpick">
      <button type="button" dir="ltr" onClick={() => step(-1)} aria-label="חצי שעה מוקדם יותר">
        −30
      </button>
      <motion.output key={value} className="tpick-value" initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <small>{whenLabel(value).replace(clock(value), "").trim()}</small>
        <b className="mono">{clock(value)}</b>
      </motion.output>
      <button type="button" dir="ltr" onClick={() => step(1)} aria-label="חצי שעה מאוחר יותר">
        +30
      </button>
    </div>
  );
}

/** "חזרתי": set a return time for a hike you are on, and mark yourself back. */
export function SafeTripCard({ post }: { post: Post }) {
  const { state } = useStore();
  const actions = useActions();
  const now = useNow();
  const c = myCheckin(state, post.id);
  const phase = tripPhase(c, post, now);
  const [editing, setEditing] = useState(false);
  const [returnBy, setReturnBy] = useState(() => Math.max(c?.returnBy ?? suggestedReturn(post), earliest()));
  const [name, setName] = useState(state.me.emergencyName);
  const [phone, setPhone] = useState(state.me.emergencyContact);
  const [busy, setBusy] = useState(false);
  const hasContact = Boolean(state.me.emergencyContact.trim());
  const contactName = state.me.emergencyName || "איש הקשר שלך";
  const phoneOk = phone.replace(/\D/g, "").length >= 9;

  const showForm = phase === "none" || editing;

  const arm = async () => {
    setBusy(true);
    if (!hasContact && !(await actions.saveEmergency(name.trim(), phone.trim()))) return setBusy(false);
    const at = Math.max(returnBy, earliest());
    setReturnBy(at);
    if (await actions.scheduleCheckin(post.id, at)) setEditing(false);
    setBusy(false);
  };

  const crew = crewOf(state, post.id);
  const crewStatus = crew.map((id) => {
    const ck = state.checkins.find((x) => x.postId === post.id && x.userId === id);
    const person = id === "me" ? { name: state.me.name || "אני", ink: "flame" as const } : findPerson(state, id);
    return { id, person, phase: tripPhase(ck, post, now) };
  });
  const everyoneBack = crewStatus.length > 1 && crewStatus.every((x) => x.phase === "returned");

  return (
    <section className={`trip trip-${phase}`} aria-live="polite">
      <header className="trip-head">
        <IconShield />
        <h3>יציאה בטוחה</h3>
        <span className="trip-phase mono">{phaseLabel(phase)}</span>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {showForm ? (
          <motion.div key="form" className="trip-body" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p>
              מתי {post.days > 1 ? "חוזרים מהטרק" : "חוזרים לרכב"}? אם לא תסמנו ״חזרתי״ עד {GRACE_MIN} דק׳ אחרי השעה הזאת,{" "}
              {hasContact ? <b>{contactName}</b> : "איש הקשר לחירום"} יקבל/תקבל SMS עם המסלול, נקודת המפגש והשותפים.
            </p>
            <TimePicker value={returnBy} onChange={setReturnBy} />
            {!hasContact && (
              <div className="trip-contact">
                <input className="textfield" id="ec-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם איש הקשר" maxLength={60} />
                <input
                  className="textfield"
                  id="ec-phone"
                  dir="ltr"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="050-0000000"
                  maxLength={30}
                  aria-label="טלפון איש הקשר"
                />
              </div>
            )}
            <div className="trip-actions">
              <button type="button" className="btn btn-ink btn-sm" onClick={arm} disabled={busy || (!hasContact && (!name.trim() || !phoneOk))}>
                {phase === "none" ? "הפעלה" : "שמירת השעה"}
              </button>
              {editing && (
                <button type="button" className="linkbtn inline" onClick={() => setEditing(false)}>
                  ביטול
                </button>
              )}
            </div>
          </motion.div>
        ) : phase === "returned" ? (
          <motion.div key="back" className="trip-body trip-back" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <Cairn count={3} size={52} drop />
            <p>
              {c?.returnedAt ? `חזרת ב-${clock(c.returnedAt)}. ` : "חזרת. "}
              {c?.wasAlerted ? `${contactName} יקבל/תקבל SMS שהכל בסדר.` : `${contactName} לא קיבל/ה שום הודעה.`}
            </p>
          </motion.div>
        ) : (
          <motion.div key="armed" className="trip-body" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <TripStatus phase={phase} returnBy={c!.returnBy} now={now} contact={contactName} phone={state.me.emergencyContact} />
            <div className="trip-actions">
              {phase !== "upcoming" && (
                <motion.button type="button" className="btn btn-done trip-back-btn" whileTap={{ scale: 0.95 }} onClick={() => actions.setCheckinStatus(post.id, "returned")}>
                  <IconCheck size={18} /> חזרתי
                </motion.button>
              )}
              {phase !== "alerted" && (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.extendCheckin(post.id, 60)}>
                    +שעה
                  </button>
                  {phase === "upcoming" && (
                    <button
                      type="button"
                      className="linkbtn inline"
                      onClick={() => {
                        setReturnBy(Math.max(c!.returnBy, earliest()));
                        setEditing(true);
                      }}
                    >
                      שינוי שעה
                    </button>
                  )}
                  {phase === "upcoming" && (
                    <button type="button" className="linkbtn inline muted" onClick={() => actions.setCheckinStatus(post.id, "cancelled")}>
                      כיבוי
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {crewStatus.length > 1 && (
        <div className="trip-crew">
          {crewStatus.map(({ id, person, phase: ph }) =>
            person ? (
              <span key={id} className={`trip-member ph-${ph}`} title={phaseLabel(ph)}>
                <Avatar name={person.name} ink={person.ink} size={30} />
                <i />
              </span>
            ) : null,
          )}
          <span className="trip-crew-label">{everyoneBack ? "כולם חזרו" : `${crewStatus.filter((x) => x.phase === "returned").length}/${crewStatus.length} חזרו`}</span>
        </div>
      )}
    </section>
  );
}

function phaseLabel(p: TripPhase) {
  return { none: "כבוי", upcoming: "מוכן", field: "בשטח", overdue: "באיחור", alerted: "נשלחה הודעה", returned: "חזרו" }[p];
}

function TripStatus({ phase, returnBy, now, contact, phone }: { phase: TripPhase; returnBy: number; now: number; contact: string; phone: string }) {
  const left = minutesLeft(returnBy, now);
  if (phase === "overdue") {
    const toAlert = left + GRACE_MIN;
    return (
      <p className="trip-status">
        עברה שעת החזרה ({clock(returnBy)}). {toAlert > 0 ? `בעוד ${durationLabel(toAlert)} ${contact} יקבל/תקבל SMS.` : `${contact} מקבל/ת SMS בדקות הקרובות.`} הכל בסדר? סמנו ״חזרתי״
        או הוסיפו שעה.
      </p>
    );
  }
  if (phase === "alerted")
    return (
      <p className="trip-status">
        נשלחה הודעה ל{contact} <span className="mono" dir="ltr">({maskPhone(phone)})</span>. כשאתם בסדר, סמנו ״חזרתי״ והוא/היא יקבל/תקבל עדכון.
      </p>
    );
  return (
    <p className="trip-status">
      <b className="mono trip-when">חזרה עד {whenLabel(returnBy)}</b>
      {phase === "field" ? ` · עוד ${durationLabel(left)}` : ""}
      <br />
      <small>
        אם לא תסמנו ״חזרתי״, {contact} <span className="mono" dir="ltr">({maskPhone(phone)})</span> יקבל/תקבל SMS {GRACE_MIN} דק׳ אחרי.
      </small>
    </p>
  );
}

/** Pinned above the tab bar while I am on a hike with an active check-in. */
export function FieldBanner() {
  const { state } = useStore();
  const { push } = useNav();
  const actions = useActions();
  const now = useNow(30_000);
  const active = state.checkins
    .filter((c) => c.userId === "me")
    .map((c) => ({ c, post: state.posts.find((p) => p.id === c.postId) }))
    .filter((x): x is { c: typeof x.c; post: Post } => Boolean(x.post))
    .map((x) => ({ ...x, phase: tripPhase(x.c, x.post, now) }))
    .filter((x) => x.phase === "field" || x.phase === "overdue" || x.phase === "alerted")
    .sort((a, b) => a.c.returnBy - b.c.returnBy)[0];

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className={`field-banner fb-${active.phase}`}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          <button type="button" className="fb-main" onClick={() => push({ k: "post", id: active.post.id })}>
            <span className="fb-dot" />
            <span>
              <b>{active.phase === "field" ? "בשטח" : active.phase === "overdue" ? "עברה שעת החזרה" : "נשלחה הודעה"}</b> ·{" "}
              {trailById(active.post.trailId).name}
              <small className="mono">
                {active.phase === "field" ? ` · חזרה עד ${clock(active.c.returnBy)}` : startsAt(active.post) > now ? "" : ` · ${clock(active.c.returnBy)}`}
              </small>
            </span>
          </button>
          <motion.button type="button" className="fb-back" whileTap={{ scale: 0.92 }} onClick={() => actions.setCheckinStatus(active.post.id, "returned")}>
            חזרתי
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
