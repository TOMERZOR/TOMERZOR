/**
 * The privacy policy the App Store listing and the subscription screen link to, at /privacy.
 * Fill in CONTACT_EMAIL before publishing.
 */

const CONTACT_EMAIL = "your-email@example.com";

export function privacyPage(): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Old Friend – Privacy Policy</title>
<style>
  body { font: 18px/1.6 -apple-system, system-ui, sans-serif; color: #241B27; background: #fff; max-width: 680px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 28px; margin: 0 0 4px; } h2 { font-size: 21px; margin: 28px 0 6px; }
  .he { direction: rtl; text-align: right; border-top: 1px solid #EEE6EA; margin-top: 40px; padding-top: 8px; }
  a { color: #D6336F; }
  @media (prefers-color-scheme: dark) { body { background: #17131A; color: #F6EEF2; } a { color: #FF8DBA; } .he { border-color: #3A3140; } }
</style>
</head>
<body>
<h1>My Old Friend – Privacy Policy</h1>
<p>Last updated: October 2026</p>

<h2>What is sent, and to whom</h2>
<p>When you ask Moffy a question, your words and the camera picture inside the frame are sent to our server and passed on to <b>Claude</b>, an AI by Anthropic, so Moffy can answer. Moffy's answer is sent to <b>ElevenLabs</b> to be turned into speech. Nothing is sent until you ask a question.</p>

<h2>What we keep</h2>
<p>We do not store your photos or your questions. Our server keeps a random ID made by the app on your phone, the number of free questions used, a daily question count, and a copy of Moffy's spoken answers (the voice recordings, without your question or picture) so the same sentence is not made twice. If you subscribe, Apple handles the payment; we only receive Apple's subscription number to check that it is active.</p>

<h2>Our service providers</h2>
<p>Anthropic and ElevenLabs process the data only to answer and speak, under their own privacy terms. Our server runs on Cloudflare. Speech recognition runs through Apple on your iPhone.</p>

<h2>Your choices</h2>
<p>You can turn the camera off in the app's Settings, and Moffy will help from your words alone. To delete the data linked to your phone's ID, write to us.</p>

<h2>Contact</h2>
<p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>

<div class="he" lang="he">
<h1>החבר הוותיק שלי – מדיניות פרטיות</h1>
<h2>מה נשלח ולמי</h2>
<p>כששואלים את מופי שאלה, המילים ותמונת המצלמה שבתוך המסגרת נשלחות לשרת שלנו ומשם ל-<b>Claude</b>, בינה מלאכותית של Anthropic, כדי שמופי תוכל לענות. התשובה של מופי נשלחת ל-<b>ElevenLabs</b> כדי להפוך אותה לקול. שום דבר לא נשלח לפני ששואלים.</p>
<h2>מה אנחנו שומרים</h2>
<p>אנחנו לא שומרים את התמונות ואת השאלות. השרת שומר מספר אקראי שהאפליקציה יוצרת בטלפון, כמה שאלות חינם נוצלו, ספירת שאלות יומית, ועותק של התשובות המוקראות (רק הקול, בלי השאלה או התמונה) כדי לא ליצור את אותו משפט פעמיים. מי שמצטרף למנוי משלם דרך Apple; אנחנו מקבלים רק את מספר המנוי כדי לבדוק שהוא פעיל.</p>
<h2>נותני השירות שלנו</h2>
<p>Anthropic ו-ElevenLabs משתמשות במידע רק כדי לענות ולהקריא, לפי תנאי הפרטיות שלהן. השרת שלנו פועל ב-Cloudflare. זיהוי הדיבור נעשה דרך Apple באייפון.</p>
<h2>הבחירות שלכם</h2>
<p>אפשר לכבות את המצלמה בהגדרות של האפליקציה, ומופי תעזור רק לפי המילים. כדי למחוק את המידע שקשור למספר של הטלפון, כתבו לנו.</p>
<h2>יצירת קשר</h2>
<p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</div>
</body>
</html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

/** Apple's standard licence agreement, which the subscription screen links to as Terms of Use. */
export const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
