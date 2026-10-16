import { motion } from "framer-motion";
import type { Post } from "../data/seed";
import { personById } from "../data/seed";
import { trailById } from "../data/trails";
import { matchScore, rangeLabel, shortDay, spotsLeft, type Me } from "../lib";
import { Avatar, Blaze } from "./marks";

const seeks = (g: "f" | "m" | "x") => (g === "f" ? "מחפשת" : g === "m" ? "מחפש" : "מחפש/ת");

export function Spots({ post }: { post: Post }) {
  return (
    <span className="spots" aria-label={`${spotsLeft(post)} מקומות פנויים מתוך ${post.spots}`}>
      {Array.from({ length: post.spots }, (_, i) => (
        <i key={i} className={i < post.joined.length ? "taken" : ""} />
      ))}
    </span>
  );
}

export function MatchStamp({ score, big }: { score: number; big?: boolean }) {
  return (
    <span className={`stamp ${big ? "stamp-big" : ""} ${score >= 80 ? "stamp-hot" : ""}`} aria-label={`התאמה ${score}%`}>
      <b>{score}</b>
      <small>% התאמה</small>
    </span>
  );
}

const authorOf = (post: Post, me: Me) =>
  post.authorId === "me" ? { name: `${me.name} (אני)`, ink: "flame" as const, verified: false, g: "x" as const } : personById(post.authorId);

export function TicketCard({ post, me, onOpen, index = 0 }: { post: Post; me: Me; onOpen: () => void; index?: number }) {
  const t = trailById(post.trailId);
  const a = authorOf(post, me);
  const d = shortDay(post.dayOffset);
  const left = spotsLeft(post);
  return (
    <motion.button
      className="ticket"
      onClick={onOpen}
      layout
      initial={{ opacity: 0, y: 28, rotate: index % 2 ? 0.6 : -0.6 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay: Math.min(index, 6) * 0.06 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="ticket-cover">
        <img src={t.cover} alt="" loading="lazy" />
        <MatchStamp score={matchScore(post, me)} />
      </div>
      <div className="ticket-body">
        <div className="ticket-kicker">
          <Blaze color={t.blaze} size={20} />
          <span className="mono">{t.area}</span>
          {t.region === "abroad" && <span className="tag-abroad">חו״ל</span>}
        </div>
        <h3 className="ticket-title">{t.name}</h3>
        <p className="ticket-seg">{t.segment}</p>
        <p className="ticket-stats mono">
          {t.km} ק״מ <span>·</span> <bdi dir="ltr">↑{t.ascent.toLocaleString()}</bdi> <span>·</span> {t.level}
        </p>
        {a && (
          <div className="ticket-foot">
            <Avatar name={a.name} ink={a.ink} size={26} verified={a.verified} />
            <span className="ticket-who">
              {a.name.split(" ")[0]} {left ? `${seeks(a.g)} ${left === 1 ? "שותף אחד" : `${left} שותפים`}` : "· הקבוצה מלאה"}
            </span>
            <Spots post={post} />
          </div>
        )}
      </div>
      <div className="ticket-stub" aria-label={rangeLabel(post)}>
        <span className="mono stub-dow">{d.dow}</span>
        <b className="stub-day">{d.day}</b>
        <span className="mono stub-month">{d.month}</span>
        {post.days > 1 && <span className="stub-days mono">{post.days} ימים</span>}
        <span className="mono stub-time">{post.start}</span>
      </div>
    </motion.button>
  );
}

export function PosterCard({ post, me, onOpen, index }: { post: Post; me: Me; onOpen: () => void; index: number }) {
  const t = trailById(post.trailId);
  const a = personById(post.authorId);
  return (
    <motion.button
      className="poster"
      onClick={onOpen}
      initial={{ opacity: 0, x: -40, rotate: -2 }}
      animate={{ opacity: 1, x: 0, rotate: index % 2 ? 1.2 : -1.2 }}
      whileHover={{ rotate: 0, y: -4 }}
      whileTap={{ scale: 0.97, rotate: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.15 + index * 0.08 }}
    >
      <img src={t.cover} alt="" />
      <MatchStamp score={matchScore(post, me)} big />
      <div className="poster-label">
        <div className="poster-row">
          <Blaze color={t.blaze} size={18} />
          <span className="mono">{rangeLabel(post)}</span>
        </div>
        <h3>{t.name}</h3>
        {a && (
          <span className="poster-who">
            עם {a.name.split(" ")[0]} · {a.pace} קמ״ש
          </span>
        )}
      </div>
    </motion.button>
  );
}
