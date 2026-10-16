import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { PosterCard, TicketCard } from "../components/cards";
import { Cairn, Topo } from "../components/marks";
import { Chip, SectionTitle } from "../components/ui";
import { trailById } from "../data/trails";
import { ddmm, matchScore, shortDay } from "../lib";
import { useNav } from "../nav";
import { useStore } from "../store";

type Filter = "all" | "il" | "abroad" | "week" | "int" | "saved";

const filters: { v: Filter; label: string }[] = [
  { v: "all", label: "הכל" },
  { v: "week", label: "השבוע" },
  { v: "il", label: "ישראל" },
  { v: "abroad", label: "חו״ל" },
  { v: "int", label: "שביל ישראל" },
  { v: "saved", label: "שמורים" },
];

export function Feed() {
  const { state } = useStore();
  const { push } = useNav();
  const [f, setF] = useState<Filter>("all");
  const today = shortDay(0);

  const best = useMemo(
    () =>
      [...state.posts]
        .filter((p) => p.dayOffset < 60 && p.authorId !== "me")
        .sort((a, b) => matchScore(b, state.me) - matchScore(a, state.me))
        .slice(0, 4),
    [state.posts, state.me],
  );

  const list = useMemo(() => {
    const keep = state.posts.filter((p) => {
      const t = trailById(p.trailId);
      if (f === "il") return t.region === "il";
      if (f === "abroad") return t.region === "abroad";
      if (f === "week") return p.dayOffset < 7;
      if (f === "int") return t.blaze === "int";
      if (f === "saved") return state.saved.includes(p.id);
      return true;
    });
    return keep.sort((a, b) => a.dayOffset - b.dayOffset);
  }, [state.posts, state.saved, f]);

  const groups = [
    { title: "השבוע", items: list.filter((p) => p.dayOffset < 7) },
    { title: "בחודש הקרוב", items: list.filter((p) => p.dayOffset >= 7 && p.dayOffset < 45) },
    { title: "מתכננים רחוק", items: list.filter((p) => p.dayOffset >= 45) },
  ].filter((g) => g.items.length);

  return (
    <div className="screen feed">
      <header className="feed-head">
        <Topo seed={2.2} rings={11} cx={300} cy={60} gap={20} className="feed-topo" />
        <div className="brandbar">
          <span className="brand">
            <Cairn count={4} size={30} />
            <b>גלעד</b>
          </span>
          <span className="mono brand-date">
            {today.dow} {ddmm(new Date())}
          </span>
        </div>
        <motion.h1 className="display riso" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          לאן הולכים
          <br />
          <em>השבוע?</em>
        </motion.h1>
        <p className="feed-lede">{state.posts.filter((p) => p.dayOffset < 7).length} יציאות בשבוע הקרוב מחפשות שותפים.</p>
      </header>

      <SectionTitle kicker="לפי הקצב, הרמה והימים שלך">הכי מתאים לך</SectionTitle>
      <div className="posters" role="list">
        {best.map((p, i) => (
          <PosterCard key={p.id} post={p} me={state.me} index={i} onOpen={() => push({ k: "post", id: p.id })} />
        ))}
      </div>

      <div className="chips sticky-chips" role="toolbar" aria-label="סינון">
        {filters.map((x) => (
          <Chip key={x.v} active={f === x.v} onClick={() => setF(x.v)} group="feed">
            {x.label}
          </Chip>
        ))}
      </div>

      <AnimatePresence mode="popLayout">
        {groups.length === 0 && (
          <motion.div key="empty" className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Cairn count={2} size={64} drop />
            <p>{f === "saved" ? "עוד לא שמרת אף יציאה." : "אין כאן יציאות כרגע."}</p>
          </motion.div>
        )}
        {groups.map((g) => (
          <motion.section key={g.title + f} className="group" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h3 className="group-title">
              <span>{g.title}</span>
              <i />
              <span className="mono">{g.items.length}</span>
            </h3>
            {g.items.map((p, i) => (
              <TicketCard key={p.id} post={p} me={state.me} index={i} onOpen={() => push({ k: "post", id: p.id })} />
            ))}
          </motion.section>
        ))}
      </AnimatePresence>
    </div>
  );
}
