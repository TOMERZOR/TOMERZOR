import { motion } from "framer-motion";
import { useState } from "react";
import { useActions } from "../actions";
import { reviewEmail } from "../backend/config";
import { sendSignInCode, signInWithPassword, verifySignInCode } from "../backend/live";
import { LegalSheet } from "../components/safety";
import { Cairn, Topo } from "../components/marks";
import { Chip, Segmented, Toggle } from "../components/ui";
import type { Level } from "../data/trails";
import { useStore } from "../store";

export function Loading() {
  return (
    <div className="auth auth-center" aria-busy="true">
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}>
        <Cairn count={4} size={72} drop />
      </motion.div>
    </div>
  );
}

export function SignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState<"terms" | "privacy" | null>(null);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (reviewEmail && email.trim().toLowerCase() === reviewEmail) {
      setStep("password");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendSignInCode(email.trim());
      setStep("code");
      setCode("");
    } catch (err) {
      setError(err instanceof Error && /rate|seconds/i.test(err.message) ? "נשלחו יותר מדי קודים. נסו שוב בעוד דקה." : "לא הצלחנו לשלוח קוד. בדקו את הכתובת ונסו שוב.");
    }
    setBusy(false);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // on success the auth listener in useLiveSync takes over
      await verifySignInCode(email.trim(), code.trim());
    } catch {
      setError("הקוד לא נכון או שפג תוקפו. אפשר לבקש קוד חדש.");
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <Topo seed={3.3} rings={12} cx={200} cy={120} gap={18} className="auth-topo" />
      <div className="auth-head">
        <Cairn count={4} size={64} />
        <h1 className="display riso">כניסה לגלעד</h1>
        <p>נשלח קוד כניסה למייל. בלי סיסמה.</p>
      </div>
      {step === "email" ? (
        <form className="auth-card" onSubmit={sendCode}>
          <label htmlFor="email">מייל</label>
          <input
            id="email"
            className="textfield"
            type="email"
            dir="ltr"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-flame btn-wide" disabled={busy}>
            {busy ? "שולחים…" : "שליחת קוד"}
          </button>
          <p className="auth-legal">
            בכניסה את/ה מאשר/ת את{" "}
            <button type="button" className="linkbtn inline" onClick={() => setDoc("terms")}>
              תנאי השימוש
            </button>{" "}
            ואת{" "}
            <button type="button" className="linkbtn inline" onClick={() => setDoc("privacy")}>
              מדיניות הפרטיות
            </button>
            .
          </p>
        </form>
      ) : step === "password" ? (
        <form
          className="auth-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await signInWithPassword(email.trim(), password);
            } catch {
              setError("הסיסמה לא נכונה.");
              setBusy(false);
            }
          }}
        >
          <label htmlFor="password">סיסמה</label>
          <input id="password" className="textfield" type="password" dir="ltr" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-flame btn-wide" disabled={busy || !password}>
            כניסה
          </button>
        </form>
      ) : (
        <motion.form className="auth-card" onSubmit={verify} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h2>הקוד בדרך</h2>
          <p>
            שלחנו קוד אל <b dir="ltr">{email}</b>.
          </p>
          <label htmlFor="code">קוד כניסה</label>
          <input
            id="code"
            className="textfield code-input mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={10}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
            autoFocus
          />
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-flame btn-wide" disabled={busy || code.length < 6}>
            {busy ? "בודקים…" : "כניסה"}
          </button>
          <div className="auth-row-links">
            <button type="button" className="linkbtn inline" onClick={() => sendCode()} disabled={busy}>
              שליחה מחדש
            </button>
            <button type="button" className="linkbtn inline muted" onClick={() => setStep("email")}>
              כתובת אחרת
            </button>
          </div>
        </motion.form>
      )}
      <LegalSheet which={doc} onClose={() => setDoc(null)} />
    </div>
  );
}

const levels: Level[] = ["קל", "בינוני", "קשה", "מאתגר"];
const paces = [3, 3.5, 4, 4.5, 5, 5.5];

export function ProfileSetup() {
  const { state } = useStore();
  const actions = useActions();
  const [name, setName] = useState(state.me.name);
  const [gender, setGender] = useState<"f" | "m" | "x">("x");
  const [birthYear, setBirthYear] = useState("");
  const [city, setCity] = useState(state.me.city);
  const [pace, setPace] = useState(state.me.pace || 4);
  const [level, setLevel] = useState<Level>(state.me.level);
  const [car, setCar] = useState(false);
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [doc, setDoc] = useState<"terms" | "privacy" | null>(null);
  const year = Number(birthYear);
  const yearOk = birthYear.length === 4 && year >= 1930 && year <= new Date().getFullYear() - 18;
  const yearWrong = birthYear.length === 4 && !yearOk;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !yearOk || !agreed) return;
    setSaving(true);
    await actions.saveProfile({
      name: name.trim(),
      gender,
      birth_year: year,
      city: city.trim(),
      pace,
      level,
      has_car: car,
      bio: bio.trim(),
      terms_accepted_at: new Date().toISOString(),
    });
    setSaving(false);
  };

  return (
    <div className="auth auth-scroll">
      <div className="auth-head">
        <h1 className="display riso">נעים להכיר</h1>
        <p>זה מה ששותפים פוטנציאליים יראו לפני שהם כותבים לך.</p>
      </div>
      <form className="auth-card" onSubmit={save}>
        <label htmlFor="name">שם</label>
        <input id="name" className="textfield" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="שם פרטי ושם משפחה" />

        <label>איך לפנות אליך?</label>
        <Segmented
          id="gender"
          value={gender}
          onChange={setGender}
          options={[
            { v: "f", label: "בלשון נקבה" },
            { v: "m", label: "בלשון זכר" },
            { v: "x", label: "לא משנה" },
          ]}
        />

        <div className="auth-row">
          <div>
            <label htmlFor="city">עיר</label>
            <input id="city" className="textfield" maxLength={60} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label htmlFor="year">שנת לידה</label>
            <input
              id="year"
              className="textfield mono"
              inputMode="numeric"
              maxLength={4}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
              aria-invalid={yearWrong}
              required
            />
          </div>
        </div>
        {yearWrong && <p className="form-error">גלעד מיועד לגיל 18 ומעלה.</p>}

        <label>הקצב שלי בשטח פתוח (קמ״ש)</label>
        <div className="chips wrap">
          {paces.map((p) => (
            <Chip key={p} active={pace === p} onClick={() => setPace(p)} group="pace">
              <span className="mono">{p}</span>
            </Chip>
          ))}
        </div>

        <label>רמה</label>
        <div className="chips wrap">
          {levels.map((l) => (
            <Chip key={l} active={level === l} onClick={() => setLevel(l)} group="lvl">
              {l}
            </Chip>
          ))}
        </div>

        <div className="toggles">
          <Toggle on={car} onChange={() => setCar(!car)} label="יש לי רכב" hint="עוזר לתאם שאטל ומסלולים קוויים" />
        </div>

        <label htmlFor="bio">כמה מילים עליי</label>
        <textarea id="bio" className="textfield" rows={3} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="איפה הלכת, מה הקצב, מה חשוב לך בשביל" />

        <label className="agree">
          <input type="checkbox" id="agree" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            מלאו לי 18, ואני מסכים/ה ל
            <button type="button" className="linkbtn inline" onClick={() => setDoc("terms")}>
              תנאי השימוש
            </button>
            , כולל אפס סובלנות לתוכן פוגעני, ול
            <button type="button" className="linkbtn inline" onClick={() => setDoc("privacy")}>
              מדיניות הפרטיות
            </button>
            .
          </span>
        </label>

        <button className="btn btn-flame btn-wide" disabled={saving || !name.trim() || !yearOk || !agreed}>
          {saving ? "שומרים…" : "יוצאים לדרך"}
        </button>
      </form>
      <LegalSheet which={doc} onClose={() => setDoc(null)} />
    </div>
  );
}
