import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useActions } from "../actions";
import { MatchStamp } from "../components/cards";
import { IconBack, IconBookmark, IconCar, IconClock, IconPin, IconShield } from "../components/icons";
import { Avatar, Blaze, Cairn, Elevation, blazeName } from "../components/marks";
import { CountUp } from "../components/ui";
import { trailById } from "../data/trails";
import { carLabel, matchScore, rangeLabel, spotsLeft } from "../lib";
import { useNav } from "../nav";
import { findPerson, myRequest, useStore } from "../store";

export function PostDetail({ id }: { id: string }) {
  const { state, dispatch } = useStore();
  const { pop, push, setTab } = useNav();
  const actions = useActions();
  const scroller = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scroller });
  const imgY = useTransform(scrollY, [0, 400], [0, 140]);
  const imgScale = useTransform(scrollY, [-200, 0], [1.25, 1]);
  const barBg = useTransform(scrollY, [220, 300], [0, 1]);

  const post = state.posts.find((p) => p.id === id);
  if (!post) return null;
  const t = trailById(post.trailId);
  const host = findPerson(state, post.authorId);
  const mine = post.authorId === "me";
  const status = myRequest(state, post.id)?.status;
  const pending = state.requests.filter((r) => r.postId === post.id && r.status === "pending").length;
  const saved = state.saved.includes(post.id);
  const left = spotsLeft(post);
  const score = matchScore(post, state.me);

  const openChat = async () => {
    if (!host) return;
    const threadId = await actions.openChat(host.id, post.id);
    if (threadId) push({ k: "chat", id: threadId });
  };

  return (
    <div className="detail">
      <motion.div className="detail-bar" style={{ "--bar": barBg } as never}>
        <button className="iconbtn glass" onClick={pop} aria-label="חזרה">
          <IconBack />
        </button>
        <motion.span className="detail-bar-title" style={{ opacity: barBg }}>
          {t.name}
        </motion.span>
        <button
          className={`iconbtn glass ${saved ? "saved" : ""}`}
          onClick={() => dispatch({ type: "toggleSave", postId: post.id })}
          aria-label={saved ? "הסרה מהשמורים" : "שמירה"}
          aria-pressed={saved}
        >
          <motion.span key={String(saved)} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 15 }}>
            <IconBookmark filled={saved} />
          </motion.span>
        </button>
      </motion.div>

      <div className="detail-scroll" ref={scroller}>
        <div className="detail-cover">
          <motion.img src={t.cover} alt="" style={{ y: imgY, scale: imgScale }} />
          <MatchStamp score={score} big />
        </div>

        <article className="detail-sheet">
          <div className="detail-kicker">
            <Blaze color={t.blaze} size={26} />
            <span>{blazeName[t.blaze]}</span>
            <span className="mono">{t.coords}</span>
          </div>
          <h1 className="display detail-title">{t.name}</h1>
          <p className="detail-seg">
            {t.segment} · {t.area}, {t.country}
          </p>

          <dl className="stats">
            <div>
              <dt>מרחק</dt>
              <dd className="mono">
                <CountUp to={t.km} decimals={t.km % 1 ? 1 : 0} />
                <small>ק״מ</small>
              </dd>
            </div>
            <div>
              <dt>עלייה</dt>
              <dd className="mono">
                <CountUp to={t.ascent} />
                <small>מ׳</small>
              </dd>
            </div>
            <div>
              <dt>זמן</dt>
              <dd className="mono">
                {t.days ? t.days : t.hours}
                <small>{t.days ? "ימים" : "שעות"}</small>
              </dd>
            </div>
            <div>
              <dt>רמה</dt>
              <dd>{t.level}</dd>
            </div>
          </dl>

          <Elevation data={t.profile} />

          <section className="logi">
            <div>
              <IconClock />
              <span>
                <b>{rangeLabel(post)}</b> · יציאה {post.start}
                {post.flexible && <em className="flex-tag">גמיש</em>}
              </span>
            </div>
            <div>
              <IconPin />
              <span>
                {post.meet}
                {post.direction && <small> · בכיוון {post.direction}</small>}
              </span>
            </div>
            <div>
              <IconCar />
              <span>
                {carLabel[post.car]}
                {t.linear && post.car !== "shuttle" && <small> · מסלול קווי, כדאי לתאם שאטל</small>}
              </span>
            </div>
          </section>

          {host && (
            <motion.button className="host" onClick={() => push({ k: "person", id: host.id })} whileTap={{ scale: 0.98 }}>
              <Avatar name={host.name} ink={host.ink} size={54} verified={host.verified} />
              <div className="host-main">
                <span className="host-name">
                  {host.name}{" "}
                  <small>
                    · {host.age ? `${host.age}, ` : ""}
                    {host.city}
                  </small>
                </span>
                <span className="mono host-meta">
                  {host.hikes} יציאות · {host.showUp === null ? "חדש/ה בגלעד" : `${host.showUp}% הגיעו`} · {host.pace} קמ״ש
                </span>
              </div>
              <IconBack className="host-chev" />
            </motion.button>
          )}

          {post.note && <blockquote className="note">{post.note}</blockquote>}

          <div className="tags">
            {post.tags.map((x) => (
              <span key={x} className="tag">
                {x}
              </span>
            ))}
          </div>

          <section className="crew">
            <h3>
              מי בא <span className="mono">{post.joined.length + 1}/{post.spots + 1}</span>
            </h3>
            <div className="crew-row">
              {mine ? <Avatar name={state.me.name || "אני"} ink="flame" size={44} /> : host && <Avatar name={host.name} ink={host.ink} size={44} />}
              {post.joined.map((pid) => {
                if (pid === "me") return <Avatar key={pid} name={state.me.name || "אני"} ink="flame" size={44} />;
                const p = findPerson(state, pid);
                return p ? <Avatar key={pid} name={p.name} ink={p.ink} size={44} /> : null;
              })}
              {Array.from({ length: left }, (_, i) => {
                const waiting = i === 0 && status === "pending";
                return (
                  <span key={i} className={`crew-empty ${waiting ? "pending" : ""}`}>
                    {waiting ? <Cairn count={2} size={30} drop /> : i === 0 && !mine ? "את/ה?" : ""}
                  </span>
                );
              })}
            </div>
          </section>

          <aside className="safety">
            <IconShield />
            <p>
              לפני כל יציאה אפשר לשתף את המסלול, השעה והשותפים עם איש קשר לחירום. אם לא סימנת ״חזרתי״ עד שעה שתבחר/י, הוא
              מקבל הודעה.
            </p>
          </aside>
          <div className="detail-pad" />
        </article>
      </div>

      <motion.div className="cta" initial={{ y: 100 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.25 }}>
        {mine ? (
          <button
            className="btn btn-ink btn-wide"
            onClick={() => {
              setTab("inbox");
            }}
          >
            {pending ? `${pending} בקשות ממתינות לתשובה` : "היציאה שלך · עוד אין בקשות"}
          </button>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={openChat}>
              הודעה
            </button>
            <AnimatePresence mode="wait" initial={false}>
              {status === "accepted" ? (
                <motion.span key="ok" className="btn btn-done" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  ✓ אושר · נתראה בשביל
                </motion.span>
              ) : status === "pending" ? (
                <motion.button
                  key="wait"
                  className="btn btn-pending"
                  onClick={() => actions.withdraw(post.id)}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  aria-label="ממתין לאישור. לחיצה מבטלת את הבקשה"
                >
                  ממתין לאישור <small>· ביטול</small>
                </motion.button>
              ) : status === "declined" ? (
                <motion.span key="no" className="btn btn-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  הפעם זה לא הסתדר
                </motion.span>
              ) : (
                <motion.button
                  key="req"
                  className="btn btn-flame"
                  onClick={() => actions.request(post.id)}
                  disabled={left === 0}
                  exit={{ scale: 0.8, opacity: 0 }}
                  whileTap={{ scale: 0.96 }}
                >
                  {left === 0 ? "הקבוצה מלאה" : "בקשה להצטרף"}
                </motion.button>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </div>
  );
}
