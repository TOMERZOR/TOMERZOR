import { motion } from "framer-motion";
import { Avatar, Blaze, Cairn } from "../components/marks";
import { SectionTitle } from "../components/ui";
import { personById } from "../data/seed";
import { trailById } from "../data/trails";
import { rangeLabel, timeAgo } from "../lib";
import { useNav } from "../nav";
import { useStore } from "../store";

export function Inbox() {
  const { state } = useStore();
  const { push } = useNav();
  const threads = [...state.threads].sort((a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0));
  const requests = state.posts.filter((p) => state.requested.includes(p.id));

  return (
    <div className="screen inbox">
      <header className="plain-head">
        <h1 className="display riso">הודעות</h1>
      </header>

      {requests.length > 0 && (
        <>
          <SectionTitle kicker="מחכות לתשובה מהמארגנים">בקשות שלי</SectionTitle>
          <div className="requests">
            {requests.map((p) => {
              const t = trailById(p.trailId);
              return (
                <motion.button key={p.id} className="request" onClick={() => push({ k: "post", id: p.id })} whileTap={{ scale: 0.97 }}>
                  <img src={t.cover} alt="" />
                  <span>
                    <b>{t.name}</b>
                    <small className="mono">{rangeLabel(p)}</small>
                  </span>
                  <span className="pending-dot" aria-label="ממתין" />
                </motion.button>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle>שיחות</SectionTitle>
      {threads.length === 0 && (
        <div className="empty">
          <Cairn count={2} size={64} drop />
          <p>עוד אין שיחות. מצאת יציאה שמעניינת? שלח/י הודעה למארגן/ת.</p>
        </div>
      )}
      <ul className="threads">
        {threads.map((th, i) => {
          const p = personById(th.withId);
          const post = state.posts.find((x) => x.id === th.postId);
          const t = post ? trailById(post.trailId) : null;
          const last = th.messages.at(-1);
          if (!p) return null;
          return (
            <motion.li
              key={th.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 28 }}
            >
              <button className={`thread ${th.unread ? "unread" : ""}`} onClick={() => push({ k: "chat", id: th.id })}>
                <Avatar name={p.name} ink={p.ink} size={50} verified={p.verified} />
                <span className="thread-main">
                  <span className="thread-top">
                    <b>{p.name}</b>
                    <time className="mono">{last ? timeAgo(last.at) : ""}</time>
                  </span>
                  {t && (
                    <span className="thread-trail">
                      <Blaze color={t.blaze} size={14} /> {t.name}
                    </span>
                  )}
                  <span className="thread-last">
                    {last?.from === "me" && "אני: "}
                    {last?.text}
                  </span>
                </span>
                {th.unread > 0 && <span className="badge mono">{th.unread}</span>}
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
