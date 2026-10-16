import { AnimatePresence, animate, motion, useInView } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { shortDay } from "../lib";
import { IconBack } from "./icons";

export function Chip({
  active,
  onClick,
  children,
  group,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  group?: string;
}) {
  return (
    <button type="button" className={`chip ${active ? "on" : ""}`} onClick={onClick} aria-pressed={!!active}>
      {active && group && <motion.span layoutId={`chip-${group}`} className="chip-ink" transition={spring} />}
      {active && !group && <span className="chip-ink" />}
      <span className="chip-text">{children}</span>
    </button>
  );
}

export const spring = { type: "spring", stiffness: 420, damping: 34 } as const;

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
  id: string;
}) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button type="button" key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {value === o.v && <motion.span layoutId={`seg-${id}`} className="seg-ink" transition={spring} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <button type="button" className="toggle-row" role="switch" aria-checked={on} onClick={onChange}>
      <span className="toggle-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <span className={`toggle ${on ? "on" : ""}`}>
        <motion.span className="toggle-knob" layout transition={spring} />
      </span>
    </button>
  );
}

export function Stepper({ value, min, max, onChange, unit }: { value: number; min: number; max: number; onChange: (n: number) => void; unit?: string }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="פחות" disabled={value <= min}>
        −
      </button>
      <motion.b key={value} className="mono" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        {value}
        {unit && <small> {unit}</small>}
      </motion.b>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="יותר" disabled={value >= max}>
        +
      </button>
    </div>
  );
}

/** A strip of the next N days. Used to mark free days and to pick a hike date. */
export function DayStrip({
  selected,
  onToggle,
  days = 21,
  marks = {},
}: {
  selected: number[];
  onToggle: (offset: number) => void;
  days?: number;
  marks?: Record<number, number>;
}) {
  return (
    <div className="daystrip" role="group">
      {Array.from({ length: days }, (_, i) => {
        const d = shortDay(i);
        const on = selected.includes(i);
        const weekend = d.dow === "ו׳" || d.dow === "שבת";
        return (
          <motion.button
            key={i}
            type="button"
            className={`day ${on ? "on" : ""} ${weekend ? "weekend" : ""}`}
            onClick={() => onToggle(i)}
            whileTap={{ scale: 0.9 }}
            aria-pressed={on}
            aria-label={`${d.dow} ${d.dm}`}
          >
            <span className="mono day-dow">{i === 0 ? "היום" : d.dow}</span>
            <b>{d.day}</b>
            <span className="day-marks">
              {Array.from({ length: Math.min(3, marks[i] ?? 0) }, (_, k) => (
                <i key={k} />
              ))}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: setV });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{v.toLocaleString("he-IL", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</span>;
}

export function BackBar({ onBack, children, transparent, end }: { onBack: () => void; children?: ReactNode; transparent?: boolean; end?: ReactNode }) {
  return (
    <div className={`backbar ${transparent ? "clear" : ""}`}>
      <button className="iconbtn" onClick={onBack} aria-label="חזרה">
        <IconBack />
      </button>
      <div className="backbar-mid">{children}</div>
      {end}
    </div>
  );
}

export function SectionTitle({ kicker, children, action }: { kicker?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="sect">
      <div>
        {kicker && <span className="mono sect-kicker">{kicker}</span>}
        <h2>{children}</h2>
      </div>
      {action}
    </div>
  );
}

/** A "⋯" button with a short list of actions. */
export function MoreMenu({ items, label = "עוד פעולות", glass }: { items: { label: string; onClick: () => void; danger?: boolean }[]; label?: string; glass?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="more">
      <button type="button" className={`iconbtn ${glass ? "glass" : ""}`} aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="more-dots" aria-hidden>
          ⋯
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button type="button" className="more-scrim" aria-label="סגירה" onClick={() => setOpen(false)} />
            <motion.div className="more-menu" role="menu" initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}>
              {items.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  className={it.danger ? "danger" : ""}
                  onClick={() => {
                    setOpen(false);
                    it.onClick();
                  }}
                >
                  {it.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
