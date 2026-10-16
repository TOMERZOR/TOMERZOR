import { AnimatePresence, motion } from "framer-motion";
import { useActions } from "../actions";
import { Avatar, Blaze, Cairn } from "../components/marks";
import { SectionTitle } from "../components/ui";
import { trailById } from "../data/trails";
import { rangeLabel, spotsLeft, timeAgo } from "../lib";
import { useNav } from "../nav";
import { findPerson, useStore, type RequestStatus } from "../store";

const statusLabel: Record<RequestStatus, string> = {
  pending: "ממתין",
  accepted: "אושר",
  declined: "לא הפעם",
  withdrawn: "בוטל",
};

export function Inbox() {
  const { state } = useStore();
  const { push } = useNav();
  const actions = useActions();
  const threads = [...state.threads].sort((a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0));

  const myPostIds = new Set(state.posts.filter((p) => p.authorId === "me").map((p) => p.id));
  const incoming = state.requests.filter((r) => myPostIds.has(r.postId) && r.status === "pending").sort((a, b) => b.at - a.at);
  const mine = state.requests.filter((r) => r.userId === "me" && r.status !== "withdrawn").sort((a, b) => b.at - a.at);

  const message = async (userId: string, postId: string) => {
    const id = await actions.openChat(userId, postId);
    if (id) push({ k: "chat", id });
  };

  return (
    <div className="screen inbox">
      <header className="plain-head">
        <h1 className="display riso">הודעות</h1>
      </header>

      {incoming.length > 0 && (
        <>
          <SectionTitle kicker="אנשים שרוצים להצטרף ליציאות שלך">בקשות להצטרף</SectionTitle>
          <div className="incoming">
            <AnimatePresence initial={false}>
              {incoming.map((r) => {
                const p = findPerson(state, r.userId);
                const post = state.posts.find((x) => x.id === r.postId);
                if (!p || !post) return null;
                const t = trailById(post.trailId);
                const full = spotsLeft(post) === 0;
                return (
                  <motion.article
                    key={`${r.postId}-${r.userId}`}
                    className="incoming-card"
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 80, transition: { duration: 0.25 } }}
                  >
                    <button className="incoming-who" onClick={() => push({ k: "person", id: p.id })}>
                      <Avatar name={p.name} ink={p.ink} size={46} verified={p.verified} />
                      <span>
                        <b>{p.name}</b>
                        <small className="mono">
                          {p.pace} קמ״ש · {p.level} · {p.hikes} יציאות
                        </small>
                      </span>
                    </button>
                    <p className="incoming-trail">
                      <Blaze color={t.blaze} size={14} /> {t.name} · <span className="mono">{rangeLabel(post)}</span>
                    </p>
                    {r.message && <blockquote>{r.message}</blockquote>}
                    <div className="incoming-actions">
                      <button className="btn btn-sm btn-flame" disabled={full} onClick={() => actions.answer(r.postId, r.userId, "accepted")}>
                        {full ? "הקבוצה מלאה" : "אישור"}
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => actions.answer(r.postId, r.userId, "declined")}>
                        לא הפעם
                      </button>
                      <button className="linkbtn inline" onClick={() => message(r.userId, r.postId)}>
                        הודעה
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}

      {mine.length > 0 && (
        <>
          <SectionTitle kicker="יציאות שביקשת להצטרף אליהן">הבקשות שלי</SectionTitle>
          <div className="requests">
            {mine.map((r) => {
              const post = state.posts.find((p) => p.id === r.postId);
              if (!post) return null;
              const t = trailById(post.trailId);
              return (
                <motion.button key={r.postId} className="request" onClick={() => push({ k: "post", id: post.id })} whileTap={{ scale: 0.97 }}>
                  <img src={t.cover} alt="" />
                  <span>
                    <b>{t.name}</b>
                    <small className="mono">{rangeLabel(post)}</small>
                  </span>
                  <span className={`status status-${r.status}`}>{statusLabel[r.status]}</span>
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
          const p = findPerson(state, th.withId);
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
