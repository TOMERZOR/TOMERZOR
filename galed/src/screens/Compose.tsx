import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { TicketCard } from "../components/cards";
import { Blaze } from "../components/marks";
import { BackBar, Chip, DayStrip, Segmented, Stepper } from "../components/ui";
import type { Post } from "../data/seed";
import { trails, type Level } from "../data/trails";
import { useNav } from "../nav";
import { useActions } from "../actions";
import { useStore } from "../store";

const steps = ["לאן", "מתי", "עם מי", "פרסום"];
const tagOptions = ["יציאה לפני זריחה", "קצב נינוח", "צילום", "מתאים לכלבים", "לינת שטח", "קפה בפסגה", "נשים בלבד", "שאטל רכבים"];
const times = ["05:00", "05:30", "06:00", "07:00", "08:00"];

export function Compose() {
  const { state } = useStore();
  const actions = useActions();
  const { pop, setTab, toast } = useNav();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [trailId, setTrailId] = useState<string | null>(null);
  const [day, setDay] = useState<number>(state.me.freeDays[0] ?? 3);
  const [days, setDays] = useState(1);
  const [start, setStart] = useState("06:00");
  const [flexible, setFlexible] = useState(false);
  const [spots, setSpots] = useState(2);
  const [level, setLevel] = useState<Level>(state.me.level);
  const [car, setCar] = useState<Post["car"]>("has-car");
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [meet, setMeet] = useState("");
  const [stamped, setStamped] = useState(false);

  const trail = trails.find((t) => t.id === trailId);
  const draft: Post | null = trail
    ? {
        id: `me-${Date.now()}`,
        authorId: "me",
        trailId: trail.id,
        dayOffset: day,
        days: trail.days ?? days,
        flexible,
        start,
        spots,
        joined: [],
        pace: state.me.pace,
        level,
        car,
        tags,
        note: note || "מחפש/ת שותפים לדרך.",
        meet: meet.trim() || "יתואם בצ׳אט",
        createdHoursAgo: 0,
      }
    : null;

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };
  const canNext = step === 0 ? !!trail : true;

  const publish = async () => {
    if (!draft) return;
    setStamped(true);
    const [ok] = await Promise.all([actions.publish(draft), new Promise((r) => window.setTimeout(r, 1300))]);
    if (!ok) return setStamped(false);
    toast("היציאה פורסמה. נעדכן כשמישהו יבקש להצטרף.");
    pop();
    setTab("feed");
  };

  return (
    <div className="compose">
      <BackBar onBack={step ? () => go(step - 1) : pop}>
        <span className="compose-title">יציאה חדשה</span>
      </BackBar>

      <div className="steps" aria-label={`שלב ${step + 1} מתוך ${steps.length}`}>
        <svg className="steps-line" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden>
          <path d="M0 6 H300" stroke="var(--line)" strokeWidth="2" strokeDasharray="4 5" />
          <motion.path
            d="M300 6 H0"
            stroke="var(--flame)"
            strokeWidth="3"
            fill="none"
            initial={false}
            animate={{ pathLength: step / (steps.length - 1) }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </svg>
        {steps.map((s, i) => (
          <button key={s} className={`step ${i <= step ? "done" : ""} ${i === step ? "now" : ""}`} onClick={() => (i < step ? go(i) : undefined)}>
            <span className="step-dot" />
            <span>{s}</span>
          </button>
        ))}
      </div>

      <div className="compose-body">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            className="compose-step"
            initial={{ opacity: 0, x: dir * -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * 60 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            {step === 0 && (
              <>
                <h2 className="display q">לאן הולכים?</h2>
                <div className="trail-grid">
                  {trails.map((t) => (
                    <motion.button
                      key={t.id}
                      className={`trail-pick ${trailId === t.id ? "on" : ""}`}
                      onClick={() => setTrailId(t.id)}
                      whileTap={{ scale: 0.95 }}
                    >
                      <img src={t.cover} alt="" />
                      <span className="trail-pick-label">
                        <Blaze color={t.blaze} size={16} />
                        <b>{t.name}</b>
                        <small className="mono">{t.km} ק״מ</small>
                      </span>
                      {trailId === t.id && <motion.span layoutId="pick-ring" className="pick-ring" />}
                    </motion.button>
                  ))}
                </div>
                <p className="hint">בגרסה המלאה: כל מסלול מסומן בארץ, כל קטע בשביל ישראל, וייבוא GPX.</p>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="display q">מתי?</h2>
                <DayStrip selected={[day]} onToggle={setDay} />
                {!trail?.days && (
                  <div className="field">
                    <label>כמה ימים</label>
                    <Stepper value={days} min={1} max={14} onChange={setDays} unit={days === 1 ? "יום" : "ימים"} />
                  </div>
                )}
                <div className="field">
                  <label>שעת יציאה</label>
                  <div className="chips">
                    {times.map((x) => (
                      <Chip key={x} active={start === x} onClick={() => setStart(x)} group="time">
                        <span className="mono">{x}</span>
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="meet">נקודת מפגש</label>
                  <input
                    id="meet"
                    className="textfield"
                    value={meet}
                    onChange={(e) => setMeet(e.target.value)}
                    placeholder={trail ? `למשל: חניון ההתחלה, ${trail.area}` : "חניון, צומת, תחנה"}
                    maxLength={200}
                  />
                </div>
                <div className="field">
                  <label>גמישות</label>
                  <Segmented
                    id="flex"
                    value={flexible ? "flex" : "fixed"}
                    onChange={(v) => setFlexible(v === "flex")}
                    options={[
                      { v: "fixed", label: "תאריך סגור" },
                      { v: "flex", label: "גמיש ± יומיים" },
                    ]}
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="display q">עם מי?</h2>
                <div className="field">
                  <label>כמה שותפים מחפשים</label>
                  <Stepper value={spots} min={1} max={8} onChange={setSpots} />
                </div>
                <div className="field">
                  <label>רמה</label>
                  <div className="chips">
                    {(["קל", "בינוני", "קשה", "מאתגר"] as Level[]).map((l) => (
                      <Chip key={l} active={level === l} onClick={() => setLevel(l)} group="level">
                        {l}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>רכבים</label>
                  <Segmented
                    id="car"
                    value={car}
                    onChange={setCar}
                    options={[
                      { v: "has-car", label: "יש לי רכב" },
                      { v: "needs-ride", label: "צריך טרמפ" },
                      { v: "shuttle", label: "שאטל" },
                    ]}
                  />
                </div>
                <div className="field">
                  <label>תגיות</label>
                  <div className="chips wrap">
                    {tagOptions.map((x) => (
                      <Chip key={x} active={tags.includes(x)} onClick={() => setTags((a) => (a.includes(x) ? a.filter((y) => y !== x) : [...a, x]))}>
                        {x}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="note">כמה מילים</label>
                  <textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="מה הקצב, מה התוכנית, את מי מחפשים"
                  />
                </div>
              </>
            )}

            {step === 3 && draft && (
              <>
                <h2 className="display q">ככה זה ייראה</h2>
                <div className="preview">
                  <TicketCard post={draft} me={state.me} onOpen={() => undefined} />
                  <AnimatePresence>
                    {stamped && (
                      <motion.div
                        className="big-stamp"
                        initial={{ scale: 2.6, opacity: 0, rotate: -24 }}
                        animate={{ scale: 1, opacity: 1, rotate: -9 }}
                        transition={{ type: "spring", stiffness: 520, damping: 16 }}
                      >
                        פורסם
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <p className="hint">אנשים שהקצב, הרמה והימים הפנויים שלהם מתאימים יקבלו התראה.</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="cta">
        {step < 3 ? (
          <button className="btn btn-ink btn-wide" disabled={!canNext} onClick={() => go(step + 1)}>
            {step === 0 && !trail ? "בחירת מסלול" : "המשך"}
          </button>
        ) : (
          <button className="btn btn-flame btn-wide" onClick={publish} disabled={stamped}>
            פרסום היציאה
          </button>
        )}
      </div>
    </div>
  );
}
