import { motion } from "framer-motion";
import { useId, useMemo } from "react";
import type { BlazeColor } from "../data/trails";
import { initials } from "../lib";

/* ── Trail blaze ─────────────────────────────────────────────
   The painted three-stripe mark Israeli trails use on rocks:
   white · colour · white. The National Trail is orange · white · blue. */

const blazeFill: Record<BlazeColor, string> = {
  red: "var(--blaze-red)",
  blue: "var(--ultra)",
  green: "var(--moss)",
  black: "#161a35",
  int: "",
};

export const blazeName: Record<BlazeColor, string> = {
  red: "סימון אדום",
  blue: "סימון כחול",
  green: "סימון ירוק",
  black: "סימון שחור",
  int: "שביל ישראל",
};

export function Blaze({ color, size = 22, title }: { color: BlazeColor; size?: number; title?: string }) {
  const stripes =
    color === "int" ? ["var(--flame)", "#F7F2E6", "var(--ultra)"] : ["#F7F2E6", blazeFill[color], "#F7F2E6"];
  const h = size * 0.72;
  return (
    <svg
      className="blaze"
      width={size}
      height={h}
      viewBox="0 0 30 22"
      role="img"
      aria-label={title ?? blazeName[color]}
    >
      <g filter="url(#paint)">
        {stripes.map((c, i) => (
          <rect key={i} x="1" y={1 + i * 6.7} width="28" height="6.7" fill={c} />
        ))}
      </g>
      <rect x="1" y="1" width="28" height="20" fill="none" stroke="var(--ink)" strokeOpacity=".18" strokeWidth=".8" />
    </svg>
  );
}

/* ── Contour lines ──────────────────────────────────────────
   Wobbly concentric rings, like a hill on a 1:50,000 map. */

function ring(cx: number, cy: number, r: number, seed: number) {
  const pts: string[] = [];
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k =
      1 +
      0.13 * Math.sin(3 * a + seed) +
      0.07 * Math.sin(5 * a + seed * 1.7) +
      0.035 * Math.sin(9 * a + seed * 2.3) +
      0.02 * Math.sin(r * 0.05 + a * 2);
    const x = cx + Math.cos(a) * r * k * 1.25;
    const y = cy + Math.sin(a) * r * k * 0.8;
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join("") + "Z";
}

export function Topo({
  seed = 1,
  rings = 9,
  cx = 200,
  cy = 160,
  gap = 22,
  draw = true,
  className = "",
}: {
  seed?: number;
  rings?: number;
  cx?: number;
  cy?: number;
  gap?: number;
  draw?: boolean;
  className?: string;
}) {
  const paths = useMemo(
    () => Array.from({ length: rings }, (_, i) => ring(cx, cy, 14 + i * gap, seed + i * 0.35)),
    [seed, rings, cx, cy, gap],
  );
  return (
    <svg className={`topo ${className}`} viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {paths.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={i % 4 === 3 ? 1.3 : 0.7}
          initial={draw ? { pathLength: 0, opacity: 0 } : false}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </svg>
  );
}

/* ── Cairn ──────────────────────────────────────────────────
   גלעד: a pile of stones set down as a covenant between two people.
   Every hike done with a partner adds one stone. */

function stone(w: number, h: number, seed: number) {
  const pts: string[] = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.06 * Math.sin(3 * a + seed) + 0.04 * Math.sin(5 * a + seed * 2);
    const flat = Math.sin(a) > 0 ? 0.82 : 1; // flatter underside so it sits
    pts.push(`${i ? "L" : "M"}${(Math.cos(a) * (w / 2) * k).toFixed(1)},${(Math.sin(a) * (h / 2) * k * flat).toFixed(1)}`);
  }
  return pts.join("") + "Z";
}

export function Cairn({
  count = 4,
  size = 48,
  drop = false,
  delay = 0,
  max = 9,
}: {
  count?: number;
  size?: number;
  drop?: boolean;
  delay?: number;
  max?: number;
}) {
  const n = Math.min(count, max);
  const stones = useMemo(() => {
    const out: { d: string; y: number; fill: string; tilt: number }[] = [];
    let y = 96;
    for (let i = 0; i < n; i++) {
      const w = 74 - i * (46 / Math.max(n, 4));
      const h = 15 - i * 0.6;
      y -= i === 0 ? h / 2 : h * 0.86;
      out.push({ d: stone(w, h, i * 1.9 + 0.4), y, fill: i % 2 ? "var(--flame)" : "var(--ultra)", tilt: (i % 3) - 1 });
    }
    return out;
  }, [n]);
  return (
    <svg className="cairn" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {stones.map((s, i) => (
        <motion.g
          key={i}
          initial={drop ? { y: -90, opacity: 0, rotate: s.tilt * 8 } : false}
          animate={{ y: 0, opacity: 1, rotate: s.tilt * 1.5 }}
          transition={{ type: "spring", stiffness: 420, damping: 17, delay: delay + i * 0.11 }}
          style={{ originX: "50px", originY: `${s.y}px` }}
        >
          <path d={s.d} transform={`translate(50 ${s.y})`} fill={s.fill} className="stone" />
        </motion.g>
      ))}
    </svg>
  );
}

/* ── Avatar ─────────────────────────────────────────────── */

export function Avatar({
  name,
  ink,
  size = 40,
  verified,
}: {
  name: string;
  ink: "ultra" | "flame" | "moss" | "brick";
  size?: number;
  verified?: boolean;
}) {
  return (
    <span className={`avatar ink-${ink}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      <span className="avatar-letters">{initials(name)}</span>
      {verified && size >= 40 && (
        <span className="avatar-badge" title="פרופיל מאומת">
          <svg viewBox="0 0 12 12" width="11" height="11">
            <path d="M3 6.2l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </span>
  );
}

/* ── Elevation profile ─────────────────────────────────── */

export function Elevation({ data, height = 96 }: { data: number[]; height?: number }) {
  const id = useId().replace(/:/g, "");
  const W = 320;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, 8 + (1 - (v - min) / span) * (height - 24)] as const);
  // Catmull-Rom → Bézier for a hand-drawn smooth line
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = `${d} L${W},${height} L0,${height} Z`;
  const peak = pts[data.indexOf(max)];
  return (
    <div className="elev">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden>
        <defs>
          <pattern id={`dots${id}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <circle cx="1.5" cy="1.5" r="1.05" fill="var(--flame)" />
          </pattern>
          <clipPath id={`clip${id}`}>
            <motion.rect
              x="0"
              y="0"
              height={height}
              initial={{ width: 0 }}
              whileInView={{ width: W }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
            />
          </clipPath>
        </defs>
        <g clipPath={`url(#clip${id})`}>
          <path d={area} fill={`url(#dots${id})`} opacity=".75" />
          <path d={d} fill="none" stroke="var(--ultra)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
        </g>
        <motion.circle
          cx={peak[0]}
          cy={peak[1]}
          r="3.5"
          fill="var(--paper)"
          stroke="var(--ink)"
          strokeWidth="1.5"
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.2, type: "spring", stiffness: 500, damping: 14 }}
        />
      </svg>
      <div className="elev-scale mono">
        <span>{max} מ׳</span>
        <span>{min} מ׳</span>
      </div>
    </div>
  );
}

/* ── Global SVG defs (paint roughness for blazes) ──────── */

export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="paint" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="1.6" />
        </filter>
      </defs>
    </svg>
  );
}
