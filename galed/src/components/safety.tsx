import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useActions } from "../actions";
import type { ReportReason } from "../backend/live";
import { privacy, terms, LEGAL_UPDATED, SUPPORT_EMAIL, type LegalDoc } from "../legal";
import { findPerson, useStore } from "../store";
import { Chip, Toggle } from "./ui";

/** Bottom sheet over the current screen. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  // render over the whole device frame, not inside whichever screen scrolls
  const host = typeof document !== "undefined" ? document.getElementById("sheet-root") : null;
  const sheet = (
    <AnimatePresence>
      {open && (
        <motion.div className="sheet-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" className="sheet-backdrop" aria-label="סגירה" onClick={onClose} />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
          >
            <div className="sheet-head">
              <h2 className="sheet-title">{title}</h2>
              <button type="button" className="sheet-close" onClick={onClose} aria-label="סגירה">
                ✕
              </button>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return host ? createPortal(sheet, host) : sheet;
}

const reasons: { v: ReportReason; label: string }[] = [
  { v: "harassment", label: "הטרדה או איום" },
  { v: "inappropriate", label: "תוכן לא הולם" },
  { v: "unsafe", label: "התנהגות מסוכנת בשטח" },
  { v: "fake", label: "פרופיל מזויף" },
  { v: "spam", label: "ספאם או פרסומת" },
  { v: "other", label: "משהו אחר" },
];

export interface ReportTarget {
  userId: string;
  postId?: string;
  messageId?: string;
  /** What is being reported, kept with the report in case it is deleted. */
  snapshot: string;
  what: "user" | "post" | "message";
}

export function ReportSheet({ target, onClose, onBlocked }: { target: ReportTarget | null; onClose: () => void; onBlocked?: () => void }) {
  const { state } = useStore();
  const actions = useActions();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const person = target ? findPerson(state, target.userId) : undefined;
  const first = person?.name.split(" ")[0] ?? "";

  useEffect(() => {
    setReason(null);
    setDetails("");
    setAlsoBlock(true);
  }, [target]);

  const submit = async () => {
    if (!target || !reason) return;
    setBusy(true);
    const ok = await actions.report({ targetId: target.userId, postId: target.postId, messageId: target.messageId, reason, details: details.trim(), snapshot: target.snapshot });
    if (ok && alsoBlock && (await actions.block(target.userId))) onBlocked?.();
    setBusy(false);
    if (ok) onClose();
  };

  const title = target?.what === "post" ? "דיווח על יציאה" : target?.what === "message" ? "דיווח על הודעה" : `דיווח על ${first}`;
  return (
    <Sheet open={Boolean(target)} onClose={onClose} title={title}>
      <p className="sheet-lede">הדיווח אנונימי. {first || "המשתמש/ת"} לא יודע/ת שדיווחת. אנחנו בודקים כל דיווח תוך 24 שעות.</p>
      <div className="chips wrap" role="radiogroup" aria-label="סיבה">
        {reasons.map((r) => (
          <Chip key={r.v} active={reason === r.v} onClick={() => setReason(r.v)} group="report-reason">
            {r.label}
          </Chip>
        ))}
      </div>
      <textarea
        id="report-details"
        className="textfield"
        rows={3}
        maxLength={1000}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="מה קרה? (לא חובה)"
        aria-label="פרטים"
      />
      <div className="toggles">
        <Toggle on={alsoBlock} onChange={() => setAlsoBlock(!alsoBlock)} label={`גם לחסום את ${first || "המשתמש/ת"}`} hint="לא תראו יותר זה את זה, ואי אפשר יהיה לשלוח הודעות" />
      </div>
      {reason === "unsafe" && <p className="sheet-note">אם מישהו בסכנה עכשיו, התקשרו למשטרה 100 או למד״א 101.</p>}
      <button type="button" className="btn btn-flame btn-wide" disabled={!reason || busy} onClick={submit}>
        {busy ? "שולחים…" : "שליחת דיווח"}
      </button>
    </Sheet>
  );
}

/** Asks before blocking. */
export function BlockSheet({ userId, onClose, onBlocked }: { userId: string | null; onClose: () => void; onBlocked?: () => void }) {
  const { state } = useStore();
  const actions = useActions();
  const person = userId ? findPerson(state, userId) : undefined;
  const first = person?.name.split(" ")[0] ?? "";
  return (
    <Sheet open={Boolean(userId)} onClose={onClose} title={`לחסום את ${first}?`}>
      <ul className="sheet-list">
        <li>לא תראו יותר את הפרופיל, היציאות וההודעות זה של זה.</li>
        <li>אי אפשר יהיה לשלוח הודעות או לבקש להצטרף.</li>
        <li>{first} לא יקבל/תקבל הודעה על החסימה.</li>
      </ul>
      <button
        type="button"
        className="btn btn-ink btn-wide"
        onClick={async () => {
          if (userId && (await actions.block(userId))) {
            onClose();
            onBlocked?.();
          }
        }}
      >
        חסימה
      </button>
    </Sheet>
  );
}

export function LegalBody({ doc }: { doc: LegalDoc }) {
  return (
    <article className="legal">
      <p className="legal-intro">{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h3>{s.h}</h3>
          {s.p.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}
      <p className="legal-meta mono">
        עודכן: {LEGAL_UPDATED} · <span dir="ltr">{SUPPORT_EMAIL}</span>
      </p>
    </article>
  );
}

export function LegalSheet({ which, onClose }: { which: "terms" | "privacy" | null; onClose: () => void }) {
  const doc = which === "privacy" ? privacy : terms;
  return (
    <Sheet open={Boolean(which)} onClose={onClose} title={doc.title}>
      <LegalBody doc={doc} />
    </Sheet>
  );
}

const CONFIRM_WORD = "מחיקה";

export function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const actions = useActions();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setTyped(""), [open]);
  return (
    <Sheet open={open} onClose={onClose} title="מחיקת החשבון">
      <p className="sheet-lede">זה סופי. יימחקו:</p>
      <ul className="sheet-list">
        <li>הפרופיל, הימים הפנויים ואיש הקשר לחירום</li>
        <li>היציאות שפרסמת והבקשות שלך</li>
        <li>ההודעות ששלחת ושעות החזרה</li>
      </ul>
      <label htmlFor="delete-confirm" className="sheet-label">
        כדי לאשר, כתבו <b>{CONFIRM_WORD}</b>
      </label>
      <input id="delete-confirm" className="textfield" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      <button
        type="button"
        className="btn btn-danger btn-wide"
        disabled={typed.trim() !== CONFIRM_WORD || busy}
        onClick={async () => {
          setBusy(true);
          const ok = await actions.deleteAccount();
          setBusy(false);
          if (ok) onClose();
        }}
      >
        {busy ? "מוחקים…" : "מחיקת החשבון לצמיתות"}
      </button>
    </Sheet>
  );
}
