// The voice quiz: ten messages followers really send, each testing a
// different situation. The creator answers the way they would in DMs, and
// the answers become the examples Koli trusts most.

export const QUIZ = [
  { id: "price", topic: "מחיר ומכירה", f: "היי!! ראיתי בסטורי את הקרם, כמה הוא עולה?", m: "היי!! ראיתי בסטורי את הקרם, כמה הוא עולה?", why: "איך את/ה מדבר/ת על מוצר שאת/ה מקדם/ת" },
  { id: "compliment", topic: "מחמאה", f: "את פשוט השראה, תודה על מה שאת עושה 🥹", m: "אתה פשוט השראה, תודה על מה שאתה עושה 🥹", why: "כמה חום ורגש יש בתשובות שלך" },
  { id: "offtopic", topic: "שאלה שלא קשורה לקמפיין", f: "מאיפה החולצה שלבשת היום בסטורי?", m: "מאיפה החולצה שלבשת היום בסטורי?", why: "איך את/ה עונה בקצרה על דברים יומיומיים" },
  { id: "complaint", topic: "אכזבה וביקורת", f: "קניתי לפי ההמלצה שלך וזה ממש לא עבד לי 😕", m: "קניתי לפי ההמלצה שלך וזה ממש לא עבד לי 😕", why: "איך את/ה מגיב/ה כשמישהו לא מרוצה" },
  { id: "trust", topic: "אמינות", f: "את באמת משתמשת בזה או שזה רק בשביל הכסף?", m: "אתה באמת משתמש בזה או שזה רק בשביל הכסף?", why: "איך את/ה מדבר/ת על שיתופי פעולה ממומנים" },
  { id: "advice", topic: "בקשת עצה", f: "יש לך טיפ למישהי שרוצה להתחיל ליצור תוכן?", m: "יש לך טיפ למישהו שרוצה להתחיל ליצור תוכן?", why: "כמה את/ה מפרט/ת כשמבקשים ממך עזרה" },
  { id: "boundary", topic: "גבולות", f: "אפשר לפגוש אותך?? אני מתה עלייך!!", m: "אפשר לפגוש אותך?? אני מת עליך!!", why: "איך את/ה אומר/ת לא בנעימות" },
  { id: "coupon", topic: "קוד הנחה", f: "יש קוד הנחה? 🙏", m: "יש קוד הנחה? 🙏", why: "תשובה קצרה ומכירתית" },
  { id: "hurt", topic: "עוקבת שנעלבה", f: "למה לא ענית לי אתמול? 😢", m: "למה לא ענית לי אתמול? 😢", why: "איך את/ה מרכך/ת מצב רגיש" },
  { id: "sensitive", topic: "נושא רגיש", f: "מה דעתך על מה שקורה בחדשות?", m: "מה דעתך על מה שקורה בחדשות?", why: "איך את/ה מתחמק/ת מנושאים שלא בא לך לגעת בהם" },
];

/** The question as it reads to this creator (Hebrew addresses men and women differently). */
export function quizQuestion(q, gender) {
  return gender === "male" ? q.m : q.f;
}

/** Answered questions as example pairs, in quiz order. */
export function quizPairs(persona) {
  const answers = persona.quiz?.answers || {};
  return QUIZ.filter((q) => answers[q.id]?.trim()).map((q) => ({ fan: quizQuestion(q, persona.gender), reply: answers[q.id].trim(), source: "quiz" }));
}

export function quizProgress(persona) {
  return quizPairs(persona).length;
}
