// The shape of Koli's state, its defaults, and how each personality control
// reads in the prompt. Shared by the browser and the server.

export const STATE_VERSION = 1;

/** Personality sliders, 1 to 5. `levels` is what each value tells the model. */
export const SLIDERS = [
  {
    key: "warmth", label: "חום", low: "ענייני", high: "חם ומחבק",
    levels: ["Matter-of-fact and polite, no gushing.", "Friendly but brief.", "Warm and friendly.", "Very warm, personal and caring.", "Extremely warm and affectionate, like a big sister or best friend."],
  },
  {
    key: "humor", label: "הומור", low: "רציני", high: "מצחיק",
    levels: ["No jokes at all.", "A light touch of humor only when it fits naturally.", "Playful now and then.", "Often playful and witty.", "Cheeky and funny in most replies, while still answering."],
  },
  {
    key: "emoji", label: "אימוג׳ים", low: "בלי", high: "הרבה",
    levels: ["No emoji.", "At most one emoji, and only sometimes.", "About one emoji per message.", "Two or three emoji per message.", "Lots of emoji, the way some creators really text."],
  },
  {
    key: "length", label: "אורך", low: "קצר", high: "מפורט",
    levels: ["One very short line, a few words.", "One or two short lines.", "A short paragraph at most.", "A few lines with the useful details.", "Detailed and thorough when the question calls for it."],
  },
  {
    key: "formality", label: "רשמיות", low: "חברי", high: "רשמי",
    levels: ["Totally casual, like texting a friend.", "Casual.", "Neutral.", "Polite and tidy.", "Formal and correct."],
  },
  {
    key: "slang", label: "סלנג", low: "נקי", high: "הרבה סלנג",
    levels: ["Standard Hebrew, no slang.", "Very little slang.", "Natural everyday slang.", "Plenty of the creator's slang.", "Heavy slang, exactly like the creator's most casual messages."],
  },
  {
    key: "energy", label: "אנרגיה", low: "רגוע", high: "מתלהב",
    levels: ["Calm and understated.", "Relaxed.", "Upbeat.", "Enthusiastic!", "Very excited and hyped!!"],
  },
  {
    key: "salesPush", label: "מכירתיות", low: "רק עונה", high: "סוגר עסקה",
    levels: [
      "Only answer what was asked. Never push the product or the link unless asked.",
      "Answer, and offer the link only when the fan shows interest.",
      "Answer, and offer the link and coupon when it is relevant.",
      "Answer, recommend the product warmly and always give the link and coupon in campaign conversations.",
      "Actively close the sale: answer objections, create gentle urgency from real facts (end date, limited stock if stated), and always give the link and coupon.",
    ],
  },
];

export const ADDRESS_OPTIONS = [
  { value: "auto", label: "לפי השם וההודעה של המעריץ/ה" },
  { value: "female", label: "בלשון נקבה" },
  { value: "male", label: "בלשון זכר" },
  { value: "plural", label: "בלשון רבים (ניטרלי)" },
];

export const DISCLOSURE_OPTIONS = [
  { value: "first", label: "בהודעה הראשונה בכל שיחה (מומלץ)" },
  { value: "every", label: "בסוף כל תשובה" },
  { value: "off", label: "בלי גילוי (לא מומלץ: Meta ורגולציה דורשות שקיפות)" },
];

export const INTENTS = {
  price: "שאלה על מחיר",
  product: "שאלה על המוצר",
  purchase: "רוצה לקנות",
  coupon: "קוד קופון / לינק",
  compliment: "מחמאה",
  personal: "אישי",
  complaint: "תלונה",
  collaboration: "שיתוף פעולה",
  other: "אחר",
};

export function defaultControls() {
  return {
    warmth: 4, humor: 3, emoji: 3, length: 2, formality: 1, slang: 3, energy: 4, salesPush: 3,
    address: "auto",
    disclosure: "first",
    disclosureText: "",
    maxMessages: 2,
    avoidTopics: ["פוליטיקה", "מערכות יחסים ומשפחה", "כסף והכנסות"],
    handoffTopics: ["תלונה, החזר או מוצר פגום", "הצעה לשיתוף פעולה או פנייה עסקית", "שאלה רפואית או בריאותית", "הטרדה או תוכן פוגעני", "מצוקה רגשית"],
    customRules: "",
    mode: "approve",
  };
}

export function defaultPersona() {
  return { name: "", handle: "", gender: "female", about: "", samples: [], pairs: [], corrections: [], profile: null };
}

export function defaultState() {
  return { version: STATE_VERSION, persona: defaultPersona(), controls: defaultControls(), campaigns: [] };
}

/** Fill gaps in a saved or imported state so older saves keep working. */
export function normalizeState(raw) {
  const base = defaultState();
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    version: STATE_VERSION,
    persona: { ...base.persona, ...(s.persona || {}) },
    controls: { ...base.controls, ...(s.controls || {}) },
    campaigns: Array.isArray(s.campaigns) ? s.campaigns.map(normalizeCampaign) : [],
  };
}

export function normalizeCampaign(c) {
  return {
    id: c.id || `c${Math.random().toString(36).slice(2, 8)}`,
    name: "", brand: "", product: "", price: "", coupon: "", couponDetails: "", link: "",
    start: "", end: "", active: true, keywords: [], stories: [], facts: "", faq: "",
    ...c,
  };
}

/** The line that tells fans they're talking to an AI. */
export function disclosureLine(state) {
  const custom = state.controls.disclosureText?.trim();
  if (custom) return custom;
  const name = state.persona.name?.trim() || "היוצר/ת";
  return state.persona.gender === "male"
    ? `(עונה לך העוזר הדיגיטלי של ${name} 🤖 · ${name} קורא הכל)`
    : `(עונה לך העוזרת הדיגיטלית של ${name} 🤖 · ${name} קוראת הכל)`;
}
