import { motion } from "framer-motion";
import { useState } from "react";
import { TicketCard } from "../components/cards";
import { IconMoon, IconShield, IconSun } from "../components/icons";
import { Avatar, Blaze, Cairn, Topo } from "../components/marks";
import { BackBar, CountUp, DayStrip, SectionTitle } from "../components/ui";
import { isLive } from "../backend/config";
import { trails } from "../data/trails";
import { useNav } from "../nav";
import { useActions } from "../actions";
import { findPerson, useStore } from "../store";

const doneTrails = ["eingedi", "arbel", "amud", "dolomites"];

export function Profile() {
  const { state, dispatch } = useStore();
  const { push, toast } = useNav();
  const actions = useActions();
  const { me } = state;
  const [contact, setContact] = useState(me.emergencyContact);
  const saved = state.posts.filter((p) => state.saved.includes(p.id));
  const mine = state.posts.filter((p) => p.authorId === "me");

  return (
    <div className="screen profile">
      <header className="me-head">
        <Topo seed={8.4} rings={12} cx={200} cy={150} gap={16} className="me-topo" />
        <div className="me-cairn">
          <Cairn count={Math.min(me.hikes, 9)} size={150} drop delay={0.1} />
        </div>
        <h1 className="display">{me.name}</h1>
        <p className="mono me-meta">
          {me.city} · {me.pace} קמ״ש · {me.level}
        </p>
        <p className="me-cairn-caption">
          <b>
            <CountUp to={me.hikes} />
          </b>{" "}
          אבנים בגלעד שלך: יציאה אחת עם שותף או שותפה, אבן אחת.
        </p>
      </header>

      <dl className="stats stats-3">
        <div>
          <dt>ק״מ השנה</dt>
          <dd className="mono">
            <CountUp to={186} />
          </dd>
        </div>
        <div>
          <dt>שותפים</dt>
          <dd className="mono">
            <CountUp to={9} />
          </dd>
        </div>
        <div>
          <dt>הגעה</dt>
          <dd className="mono">
            <CountUp to={100} />
            <small>%</small>
          </dd>
        </div>
      </dl>

      <SectionTitle kicker="מי שמחפש שותפים בימים האלה יראה אותך קודם">הימים הפנויים שלי</SectionTitle>
      <DayStrip selected={me.freeDays} onToggle={(d) => actions.toggleFreeDay(d)} />

      <SectionTitle kicker="פספורט שבילים">איפה כבר הלכתי</SectionTitle>
      <div className="passport">
        {trails
          .filter((t) => doneTrails.includes(t.id))
          .map((t, i) => (
            <motion.div
              key={t.id}
              className="pass-stamp"
              initial={{ scale: 1.6, opacity: 0, rotate: -12 }}
              whileInView={{ scale: 1, opacity: 1, rotate: [-6, 4, -3, 5][i % 4] }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 380, damping: 18, delay: i * 0.08 }}
            >
              <Blaze color={t.blaze} size={22} />
              <b>{t.name}</b>
              <span className="mono">{t.km} ק״מ</span>
            </motion.div>
          ))}
      </div>

      {mine.length > 0 && (
        <>
          <SectionTitle>יציאות שפרסמתי</SectionTitle>
          {mine.map((p, i) => (
            <TicketCard key={p.id} post={p} me={me} index={i} onOpen={() => push({ k: "post", id: p.id })} />
          ))}
        </>
      )}

      {saved.length > 0 && (
        <>
          <SectionTitle>שמורים</SectionTitle>
          {saved.map((p, i) => (
            <TicketCard key={p.id} post={p} me={me} index={i} onOpen={() => push({ k: "post", id: p.id })} />
          ))}
        </>
      )}

      <SectionTitle>בטיחות</SectionTitle>
      <form
        className="emergency"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await actions.saveEmergency(contact.trim())) toast("איש הקשר לחירום נשמר");
        }}
      >
        <IconShield />
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="טלפון של איש קשר לחירום" inputMode="tel" />
        <button className="btn btn-ink btn-sm" type="submit">
          שמירה
        </button>
      </form>

      <SectionTitle>תצוגה</SectionTitle>
      <div className="theme-pick">
        <button className={state.theme === "day" ? "on" : ""} onClick={() => dispatch({ type: "setTheme", theme: "day" })}>
          <IconSun /> נייר
        </button>
        <button className={state.theme === "night" ? "on" : ""} onClick={() => dispatch({ type: "setTheme", theme: "night" })}>
          <IconMoon /> לילה בשטח
        </button>
      </div>
      {isLive ? (
        <button className="linkbtn" onClick={() => actions.signOut()}>
          יציאה מהחשבון{state.session.email ? ` (${state.session.email})` : ""}
        </button>
      ) : (
        <button className="linkbtn" onClick={() => dispatch({ type: "reset" })}>
          איפוס נתוני הדגמה
        </button>
      )}
    </div>
  );
}

export function Person({ id }: { id: string }) {
  const { state } = useStore();
  const { pop, push } = useNav();
  const actions = useActions();
  const p = findPerson(state, id);
  if (!p) return null;
  const theirs = state.posts.filter((x) => x.authorId === id);
  const thread = state.threads.find((t) => t.withId === id);
  // a conversation is always about a hike: theirs, or one of mine they asked to join
  const about = thread?.postId ?? theirs[0]?.id ?? state.requests.find((r) => r.userId === id)?.postId;
  const openChat = async () => {
    const threadId = thread?.id ?? (about ? await actions.openChat(id, about) : null);
    if (threadId) push({ k: "chat", id: threadId });
  };
  return (
    <div className="person">
      <BackBar onBack={pop} />
      <div className="person-scroll">
        <header className="person-head">
          <Topo seed={p.age ?? p.hikes + 3} rings={9} cx={200} cy={110} gap={18} className="me-topo" />
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
            <Avatar name={p.name} ink={p.ink} size={104} verified={p.verified} />
          </motion.div>
          <h1 className="display">{p.name}</h1>
          <p className="mono me-meta">
            {[p.age, p.city, p.langs.join(" / ")].filter(Boolean).join(" · ")}
          </p>
          <p className="person-bio">{p.bio}</p>
        </header>
        <dl className="stats">
          <div>
            <dt>יציאות</dt>
            <dd className="mono">
              <CountUp to={p.hikes} />
            </dd>
          </div>
          <div>
            <dt>הגיעו</dt>
            <dd className="mono">
              {p.showUp === null ? (
                "—"
              ) : (
                <>
                  <CountUp to={p.showUp} />
                  <small>%</small>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>קצב</dt>
            <dd className="mono">
              {p.pace}
              <small>קמ״ש</small>
            </dd>
          </div>
          <div>
            <dt>רמה</dt>
            <dd>{p.level}</dd>
          </div>
        </dl>

        <SectionTitle kicker="נכתב רק אחרי יציאה משותפת">המלצות משותפים</SectionTitle>
        {p.references.length === 0 && <p className="hint">עוד אין המלצות. כל יציאה משותפת פותחת אפשרות להמליץ.</p>}
        <div className="refs">
          {p.references.map((r, i) => (
            <motion.figure
              key={i}
              className="ref"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <blockquote>{r.text}</blockquote>
              <figcaption className="mono">
                {r.from} · {r.trail}
              </figcaption>
            </motion.figure>
          ))}
        </div>

        {theirs.length > 0 && (
          <>
            <SectionTitle>{p.g === "f" ? "יוצאת" : "יוצא"} בקרוב</SectionTitle>
            {theirs.map((x, i) => (
              <TicketCard key={x.id} post={x} me={state.me} index={i} onOpen={() => push({ k: "post", id: x.id })} />
            ))}
          </>
        )}
        <div className="detail-pad" />
      </div>
      {about && (
        <div className="cta">
          <button className="btn btn-flame btn-wide" onClick={openChat}>
            לשיחה עם {p.name.split(" ")[0]}
          </button>
        </div>
      )}
    </div>
  );
}
