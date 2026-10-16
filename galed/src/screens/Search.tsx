import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { TicketCard } from "../components/cards";
import { IconSearch } from "../components/icons";
import { Topo } from "../components/marks";
import { Chip, CountUp, DayStrip, Segmented, SectionTitle, Toggle } from "../components/ui";
import { intSections, trailById, type Level } from "../data/trails";
import { useNav } from "../nav";
import { useActions } from "../actions";
import { findPerson, useStore } from "../store";

const levels: Level[] = ["קל", "בינוני", "קשה", "מאתגר"];
type When = "any" | "weekend" | "week" | "month";

export function Search() {
  const { state } = useStore();
  const actions = useActions();
  const { push } = useNav();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<"all" | "il" | "abroad">("all");
  const [when, setWhen] = useState<When>("any");
  const [lv, setLv] = useState<Level[]>([]);
  const [paceNear, setPaceNear] = useState(false);
  const [onlyMyDays, setOnlyMyDays] = useState(false);
  const [shuttle, setShuttle] = useState(false);
  const [roomInCar, setRoomInCar] = useState(false);
  const [dogs, setDogs] = useState(false);
  const [verified, setVerified] = useState(false);
  const [section, setSection] = useState<number | null>(null);

  const perDay = useMemo(() => {
    const m: Record<number, number> = {};
    state.posts.forEach((p) => {
      for (let i = 0; i < p.days; i++) m[p.dayOffset + i] = (m[p.dayOffset + i] ?? 0) + 1;
    });
    return m;
  }, [state.posts]);

  const perSection = useMemo(() => {
    const m: Record<number, number> = {};
    state.posts.forEach((p) => {
      const s = trailById(p.trailId).intSection;
      if (s) m[s] = (m[s] ?? 0) + 1;
    });
    return m;
  }, [state.posts]);

  const results = useMemo(() => {
    const today = new Date().getDay(); // 5 = Friday
    const toWeekend = (5 - today + 7) % 7;
    return state.posts
      .filter((p) => {
        const t = trailById(p.trailId);
        const a = findPerson(state, p.authorId);
        const text = `${t.name} ${t.segment} ${t.area} ${t.country} ${a?.name ?? ""} ${p.tags.join(" ")}`;
        if (q && !text.includes(q.trim())) return false;
        if (region !== "all" && t.region !== region) return false;
        if (when === "weekend" && !(p.dayOffset >= toWeekend && p.dayOffset <= toWeekend + 1)) return false;
        if (when === "week" && p.dayOffset > 7) return false;
        if (when === "month" && p.dayOffset > 31) return false;
        if (lv.length && !lv.includes(p.level)) return false;
        if (paceNear && Math.abs(p.pace - state.me.pace) > 0.6) return false;
        if (onlyMyDays && !Array.from({ length: p.days }, (_, i) => p.dayOffset + i).some((d) => state.me.freeDays.includes(d)))
          return false;
        if (shuttle && p.car !== "shuttle") return false;
        if (roomInCar && p.car !== "has-car") return false;
        if (dogs && !p.tags.some((x) => x.includes("כלב"))) return false;
        if (verified && !a?.verified) return false;
        if (section && t.intSection !== section) return false;
        return true;
      })
      .sort((a, b) => a.dayOffset - b.dayOffset);
  }, [state.posts, state.me, q, region, when, lv, paceNear, onlyMyDays, shuttle, roomInCar, dogs, verified, section]);

  const totalKm = intSections.reduce((s, x) => s + x.km, 0);

  return (
    <div className="screen search">
      <header className="search-head">
        <Topo seed={5.1} rings={8} cx={80} cy={40} gap={18} className="feed-topo" />
        <h1 className="display riso">חיפוש שותפים</h1>
        <label className="searchbox">
          <IconSearch />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="מסלול, אזור, טרק או שם" />
        </label>
        <Segmented
          id="region"
          value={region}
          onChange={setRegion}
          options={[
            { v: "all", label: "הכל" },
            { v: "il", label: "בארץ" },
            { v: "abroad", label: "בחו״ל" },
          ]}
        />
      </header>

      <SectionTitle kicker="צפון ← דרום · לחיצה מסננת לפי קטע">שביל ישראל</SectionTitle>
      <div className="intstrip" role="group" aria-label="קטעי שביל ישראל">
        {intSections.map((s) => {
          const n = perSection[s.n] ?? 0;
          const on = section === s.n;
          return (
            <motion.button
              key={s.n}
              className={`int-seg ${on ? "on" : ""} ${n ? "busy" : ""}`}
              style={{ flexGrow: s.km / totalKm }}
              onClick={() => setSection(on ? null : s.n)}
              whileTap={{ scaleY: 0.9 }}
              aria-pressed={on}
              aria-label={`${s.name}, ${n} יציאות`}
            >
              <span className="int-bar" />
              <span className="mono int-n">{s.n}</span>
              {n > 0 && <span className="int-count">{n}</span>}
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence>
        {section && (
          <motion.p className="int-label" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            קטע {section}: {intSections[section - 1].name} · {intSections[section - 1].km} ק״מ
          </motion.p>
        )}
      </AnimatePresence>

      <SectionTitle kicker="נקודות = כמה יוצאים באותו יום">מתי?</SectionTitle>
      <div className="chips">
        {(
          [
            ["any", "כל מועד"],
            ["weekend", "סופ״ש הקרוב"],
            ["week", "7 ימים"],
            ["month", "החודש"],
          ] as const
        ).map(([v, l]) => (
          <Chip key={v} active={when === v} onClick={() => setWhen(v)} group="when">
            {l}
          </Chip>
        ))}
      </div>
      <DayStrip selected={state.me.freeDays} onToggle={(d) => actions.toggleFreeDay(d)} marks={perDay} />
      <p className="hint">סימנת {state.me.freeDays.length} ימים פנויים. יציאות בימים האלה עולות בהתאמה.</p>

      <SectionTitle>רמה וקצב</SectionTitle>
      <div className="chips">
        {levels.map((l) => (
          <Chip key={l} active={lv.includes(l)} onClick={() => setLv((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l]))}>
            {l}
          </Chip>
        ))}
      </div>
      <div className="toggles">
        <Toggle on={paceNear} onChange={() => setPaceNear(!paceNear)} label={`קצב קרוב לשלי (${state.me.pace} קמ״ש)`} hint="עד 0.6 קמ״ש הבדל" />
        <Toggle on={onlyMyDays} onChange={() => setOnlyMyDays(!onlyMyDays)} label="רק בימים הפנויים שלי" />
        <Toggle on={shuttle} onChange={() => setShuttle(!shuttle)} label="שאטל רכבים" hint="מסלול קווי, רכב אחד מחכה בסוף" />
        <Toggle on={roomInCar} onChange={() => setRoomInCar(!roomInCar)} label="יש מקום ברכב" />
        <Toggle on={dogs} onChange={() => setDogs(!dogs)} label="כלבים מוזמנים" />
        <Toggle on={verified} onChange={() => setVerified(!verified)} label="פרופילים מאומתים בלבד" />
      </div>

      <div className="results-head">
        <span className="results-n display">
          <CountUp key={results.length} to={results.length} />
        </span>
        <span>{results.length === 1 ? "יציאה מתאימה" : "יציאות מתאימות"}</span>
      </div>
      <AnimatePresence mode="popLayout">
        {results.map((p, i) => (
          <motion.div key={p.id} layout exit={{ opacity: 0, scale: 0.95 }}>
            <TicketCard post={p} me={state.me} index={i} onOpen={() => push({ k: "post", id: p.id })} />
          </motion.div>
        ))}
      </AnimatePresence>
      {results.length === 0 && (
        <div className="empty">
          <p>אין יציאות שעונות על הכל. אפשר לפרסם יציאה משלך ולתת לאחרים למצוא אותך.</p>
          <button className="btn btn-ink" onClick={() => push({ k: "compose" })}>
            פרסום יציאה
          </button>
        </div>
      )}
    </div>
  );
}
