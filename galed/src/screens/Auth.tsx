import { motion } from "framer-motion";
import { useState } from "react";
import { useActions } from "../actions";
import { sendSignInLink } from "../backend/live";
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
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      await sendSignInLink(email.trim());
      setState("sent");
    } catch (err) {
      setError(err instanceof Error && /rate/i.test(err.message) ? "נשלחו יותר מדי קישורים. נסו שוב בעוד דקה." : "לא הצלחנו לשלוח את הקישור. בדקו את הכתובת ונסו שוב.");
      setState("error");
    }
  };

  return (
    <div className="auth">
      <Topo seed={3.3} rings={12} cx={200} cy={120} gap={18} className="auth-topo" />
      <div className="auth-head">
        <Cairn count={4} size={64} />
        <h1 className="display riso">כניסה לגלעד</h1>
        <p>נשלח קישור כניסה למייל. בלי סיסמה.</p>
      </div>
      {state === "sent" ? (
        <motion.div className="auth-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h2>בדקו את המייל</h2>
          <p>
            שלחנו קישור אל <b dir="ltr">{email}</b>. פתחו אותו במכשיר הזה, והכניסה תסתיים לבד.
          </p>
          <button className="linkbtn inline" onClick={() => setState("idle")}>
            כתובת אחרת
          </button>
        </motion.div>
      ) : (
        <form className="auth-card" onSubmit={submit}>
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
          {state === "error" && <p className="form-error">{error}</p>}
          <button className="btn btn-flame btn-wide" disabled={state === "sending"}>
            {state === "sending" ? "שולחים…" : "שליחת קישור כניסה"}
          </button>
        </form>
      )}
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
  const year = Number(birthYear);
  const yearOk = !birthYear || (year >= 1930 && year <= new Date().getFullYear() - 16);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !yearOk) return;
    setSaving(true);
    await actions.saveProfile({
      name: name.trim(),
      gender,
      birth_year: birthYear ? year : null,
      city: city.trim(),
      pace,
      level,
      has_car: car,
      bio: bio.trim(),
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
              aria-invalid={!yearOk}
            />
          </div>
        </div>
        {!yearOk && <p className="form-error">גלעד פתוח מגיל 16. בדקו את שנת הלידה.</p>}

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

        <button className="btn btn-flame btn-wide" disabled={saving || !name.trim() || !yearOk}>
          {saving ? "שומרים…" : "יוצאים לדרך"}
        </button>
      </form>
    </div>
  );
}
