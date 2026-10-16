import { motion, useReducedMotion } from "framer-motion";
import { Cairn } from "../components/marks";
import { useStore } from "../store";

const media = (n: string) => `${import.meta.env.BASE_URL}media/${n}`;

const steps = [
  { n: "01", t: "מפרסמים לאן ומתי", d: "מסלול, קטע בשביל או טרק בחו״ל, עם תאריכים וקצב." },
  { n: "02", t: "מוצאים מי הולך באותו קטע", d: "התאמה לפי קצב, רמה והימים הפנויים שלך." },
  { n: "03", t: "מתאמים בצ׳אט", d: "נקודת מפגש, רכבים לקווי, מי מביא גזייה." },
];

export function Onboarding() {
  const { dispatch } = useStore();
  const reduce = useReducedMotion();
  return (
    <div className="onb">
      {reduce ? (
        <img className="onb-media" src={media("hero.webp")} alt="" />
      ) : (
        <video className="onb-media" src={media("hero-loop.mp4")} poster={media("hero.webp")} autoPlay muted loop playsInline />
      )}
      <div className="onb-top">
        <motion.span
          className="mono onb-coords"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          31.0461°N · 34.8516°E
        </motion.span>
        <h1 className="onb-title" aria-label="גלעד">
          <motion.span
            className="riso-layer l-flame"
            initial={{ x: 18, y: -8, opacity: 0 }}
            animate={{ x: 2.5, y: 1.5, opacity: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden
          >
            גלעד
          </motion.span>
          <motion.span
            className="riso-layer l-ultra"
            initial={{ x: -18, y: 8, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden
          >
            גלעד
          </motion.span>
        </h1>
        <motion.p className="onb-sub" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          שותפים לשביל. בארץ ובעולם.
        </motion.p>
      </div>

      <motion.div
        className="onb-sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 22, delay: 0.9 }}
      >
        <div className="onb-sheet-head">
          <Cairn count={4} size={58} drop delay={1.3} />
          <p className="onb-story">
            <b>גַּלְעֵד</b> הוא גל אבנים שהקימו שניים כעדות לברית ביניהם (בראשית ל״א). עד היום, ערמת אבנים בצד השביל מסמנת
            את הדרך למי שבא אחריך.
          </p>
        </div>
        <ol className="onb-steps">
          {steps.map((s, i) => (
            <motion.li
              key={s.n}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4 + i * 0.12 }}
            >
              <span className="mono onb-n">{s.n}</span>
              <div>
                <b>{s.t}</b>
                <span>{s.d}</span>
              </div>
            </motion.li>
          ))}
        </ol>
        <motion.button
          className="btn btn-flame btn-wide"
          onClick={() => dispatch({ type: "onboard" })}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.85 }}
          whileTap={{ scale: 0.97 }}
        >
          יוצאים לדרך
        </motion.button>
      </motion.div>
    </div>
  );
}
