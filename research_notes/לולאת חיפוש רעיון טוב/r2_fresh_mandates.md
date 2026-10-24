# סבב 2, עדשה: חובות רגולטוריות חדשות לגמרי (2026–2027), גלובלי

> נכון ל-2026-10-24. **מאומת** = נמצא במקור שצוטט בחיפוש הזה. **מוסק** = הסקה שלי או ידע קודם שלא אומת כאן.
> שיטה: כ-30 חיפושים ושליפות. רוב המקורות הם סיכומים של משרדי עו"ד וספקים, ולא נוסח החוק עצמו. ציון X/9 = מספר הקריטריונים (מתוך 9 בפרומט v3) שהמועמד עובר בבירור. חצי נקודה = "כנראה".
> מסקנת-על מוקדמת: **הטריות לא מגינה.** בכל חובה שבדקתי, כולל כאלה שנכנסו לתוקף לפני 1–4 חודשים, כבר יש 3–7 כלים ייעודיים, פיצ'ר אצל האינקומבנטים או כלי חינמי של המדינה. פירוט בשאלה האחרונה.

---

## מועמד 1: "דסק דיווח CRA" למיקרו-יצרנים של מוצרים מחוברים ואפליקציות (EU Cyber Resilience Act, סעיף 14)

### Takeaway
החובה חדשה, רציפה (ניטור 24/7 ודיווח תוך 24 שעות) וחלה על אלפי יצרנים קטנים. אבל כבר יש סטארטאפים ממומנים, כלים חינמיים של ENISA וכלי קוד פתוח, ולעסקים מיקרו וקטנים יש פטור מקנס על איחור בהתראה של 24 השעות. **ציון: 5/9.** הכי טוב בעדשה, אבל לא עובר.

### Cited Findings
- **החובה (מאומת):** מ-11 בספטמבר 2026 יצרנים חייבים לדווח על פגיעויות שמנוצלות באופן פעיל ועל אירועים חמורים שפוגעים באבטחת "מוצרים עם רכיבים דיגיטליים". הדיווח עובר בפלטפורמת Single Reporting Platform (SRP) של ENISA, ללא רישום מראש — [ENISA](https://www.enisa.europa.eu/news/the-cra-single-reporting-platform-is-launched); [McCann FitzGerald](https://www.mccannfitzgerald.com/knowledge/data-privacy-and-cyber-risk/cyber-resilience-act-reporting-obligations-apply-from-11-september-2026)
- **לוחות זמנים (מאומת ממקורות משניים):** התראה מוקדמת תוך 24 שעות, הודעה תוך 72 שעות, ודוח סופי תוך 14 יום מרגע שיש תיקון — [noze.it](https://www.noze.it/en/insights/cyber-resilience-act-sbom/); [pasqualepillitteri](https://pasqualepillitteri.it/en/news/15586/cyber-resilience-act-reporting-obligations-september-11)
- **שאר החובות (SBOM, דרישות מהותיות) חלות מ-11 בדצמבר 2027** — [McCann FitzGerald](https://www.mccannfitzgerald.com/knowledge/data-privacy-and-cyber-risk/cyber-resilience-act-reporting-obligations-apply-from-11-september-2026)
- הגשה במייל מתקבלת רק כש-ENISA מכריזה רשמית שה-SRP למטה — [NCSC Ireland](https://ncsc.gov.ie/cra/)
- **מי מכוסה (מאומת):** לפי ENISA, רוב היצרנים, המפיצים והיבואנים של מוצרים דיגיטליים באירופה הם SMEs. לא מצאתי מספר כולל של ישויות מכוסות — [ENISA SME survey](https://www.enisa.europa.eu/topics/awareness-and-cyber-hygiene/sme-cyber-resilience-act-survey)
- **מוכנות נמוכה (מאומת):** בסקר של ENISA (194 ארגונים, פברואר–מרץ 2026), 66% שמעו על ה-CRA. תגובה לאירועים וניהול מחזור חיי מוצר היו התחומים החלשים ביותר, במיוחד אצל הקטנים ביותר — [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-enisa-cra-sme-maturity-20260715-csa-styled/)
- **ערוץ אפשרי (מאומת שקיים):** Espressif (יצרנית שבב ה-ESP32 ובסיס מייקרים עצום) פרסמה מדריך על חובות ה-CRA ומועדיו למפתחי ESP32 — [Espressif blog](https://developer.espressif.com/blog/2026/09/esp32-cra-obligations-and-deadlines/)
- **מתחרים (מאומת):**
  - **CRACI** (הלסינקי, נוסדה 2025): גייסה 1.4 מיליון אירו pre-seed במאי 2026. מתחברת ל-CI/CD ומבצעת מעקב פגיעויות אוטומטי — [startuprise](https://startuprise.co.uk/craci-raises-e1-4m-led-by-lifeline-ventures-to-expand-cybersecurity-compliance-platform/); [techfundingnews](https://techfundingnews.com/craci-cyber-resilience-act-compliance/)
  - **Cemply** (ברלין): יצירת SBOM, ניטור פגיעויות, דיווח ל-ENISA ותיק טכני CE — [startuphub listing](https://www.startuphub.ai/startups/cemply.md) (לא נפתח, ידוע רק מתקציר החיפוש)
  - **CYBERFORT:** פלטפורמת קוד פתוח ל-SMEs במימון Digital Europe — [alphaxiv](https://alphaxiv.org/abs/2610.09918v1). **ATHENA:** פרויקט במימון האיחוד, כולל ל-micro/SMEs — [CORDIS](https://cordis.europa.eu/project/id/101225583)
  - **Keysight SBOM Manager** — [eeNews](https://www.eenewseurope.com/en/keysight-introduces-sbom-manager-for-cybersecurity-compliance/). **Bootlin sbom-cve-check** (חינמי) — [Bootlin](https://bootlin.com/blog/tag/cra/)
  - **חינם מהמדינה:** EUVD ו-EU KEV Catalogue של ENISA. עם זאת, לפי VulnCheck, ה-EUVD מציג פחות פגיעויות מ-CVE.org ומ-NVD ולכן אינו מספיק כמקור יחיד — [ENISA vulnerability services](https://www.enisa.europa.eu/topics/vulnerability-services); [CSA](https://labs.cloudsecurityalliance.org/research/csa-research-note-enisa-cve-root-dual-governance-20260518/)
- הנציבות פרסמה הנחיות CRA ב-27 ביולי 2026 עם התייחסות למיקרו-עסקים ו-SMEs — [noze.it](https://www.noze.it/en/insights/cra-commission-guidance/)

### Inferences
- **(מוסק, מנוסח החוק כפי שאני זוכר אותו, לא אומת כאן):**
  - קנסות לפי סעיף 64: עד 15 מיליון אירו או 2.5% מהמחזור על הפרת דרישות מהותיות וסעיפים 13–14.
  - **סעיף 64(10) פוטר מיקרו-עסקים ועסקים קטנים מקנס על איחור בהתראה של 24 השעות.** זה מחליש מאוד את הדחיפות דווקא בפלח הקטן.
  - חובת הדיווח חלה גם על מוצרים שהושקו לפני 2027.
  - SaaS טהור מוחרג.
- **המשימה החוזרת:** ניטור רציף של רכיבי ה-SBOM מול KEV/EUVD, החלטה אם פגיעות היא "actively exploited", ומילוי טופס SRP בתוך 24/72 שעות. זה טבעי למנוי חודשי.
- **הפער:** CRACI ו-Cemply מכוונים ליצרנים עם CI/CD וצוות. המיקרו (מייקרים, Kickstarter, יצרני IoT עם 1–20 עובדים, מפתחי אפליקציות דסקטופ/מובייל שמוכרים באיחוד) צריכים "שירות כוננות" ב-49–199 אירו לחודש: העלאת SBOM, התראות, טיוטת SRP ממולאת, מדיניות CVD ו-security.txt.
- **בדיקת הריגה (9 קריטריונים):**
  1. משלם עם מחיר שוק מתועד ✗ (לא מצאתי מחירי יועצים)
  2. תדירות ✓
  3. אין חלופה חינמית ✗ (Dependency-Track/Dependabot, EUVD ו-SRP חינמיים. אפשר לטעון שהחיבור ביניהם הוא הערך)
  4. פער מוסבר ✓ (גודל)
  5. ערוץ הפצה ½ (Espressif, EDIHs, קהילות מייקרים)
  6. גודל ✓ (מוסק: עשרות אלפי יצרנים)
  7. תלות נמוכה בפלטפורמה ✓
  8. מתאים למייסד ✓ (אקוסיסטם הסייבר הישראלי)
  9. שורד פרקליט שטן ✗ (פטור הקנס על 24 השעות לקטנים, ומתחרים ממומנים)

  = **5/9**

### Gaps
- מספר היצרנים המכוסים (ה-impact assessment של הנציבות) לא נמצא.
- לא מצאתי מחירי יועצי CRA ולא מחירים של Cemply/CRACI.
- נוסח סעיף 64(10) לא אומת בחיפוש הזה.

---

## מועמד 2: מנוע "שעות מובטחות" ותשלומי ביטול משמרות לעסקים קטנים בבריטניה (Employment Rights Act 2025, צפוי ב-2027)

### Takeaway
חובה חוזרת באמת: חישוב מתגלגל לכל עובד ושליחת הצעות כל תקופת ייחוס, ותשלום על כל ביטול משמרת בהתראה קצרה. היא נוגעת לכ-1.2 מיליון עובדים ולעשרות אלפי עסקי אירוח וקמעונאות. אבל התקנות עוד לא פורסמו, ואינקומבנטים של שיבוץ ושכר יוסיפו את זה כפיצ'ר. **ציון: 4.5/9.** מועמד למעקב, לא לבנייה עכשיו.

### Cited Findings
- **תזמון (מאומת):** שעות מובטחות, מבחן סבירות לגמישות ותוכניות פעולה לשוויון צפויים ב-2027 — [Employment Hero UK](https://employmenthero.com/uk/blog/employment-rights-act-2025-timeline/); [Mishcon](https://www.mishcon.com/employment-rights-act-hub)
- תאריכי תחילה של חקיקת עבודה הם בדרך כלל 6 באפריל או 1 באוקטובר — [DAC Beachcroft](https://www.dacbeachcroft.com/es/what-we-think/government-update-on-timeframe-for-implementation-of-employment-rights-bill)
- **מה החוק דורש (מאומת):**
  - תשלום על כל הזזה, ביטול או קיצור של משמרת בהתראה קצרה. הפרטים ייקבעו בחקיקת משנה.
  - הצעת שעות מובטחות לעובדים מזכים אחרי כל תקופת ייחוס. אורך התקופה וסף "שעות נמוכות" טרם נקבעו — [Mishcon](https://www.mishcon.com/employment-rights-act-hub)
- **מקורות סותרים:** גרסה אחת של Mishcon מדווחת על התייעצות שנפתחה ב-2 ביוני 2026 ונסגרה ב-25 באוגוסט 2026. גרסה ישנה יותר אומרת שלא נפתחה התייעצות — [Mishcon](https://mishcon.com/employment-rights-bill-hub?pageno=2)
- **היקף (מאומת):** כ-1.2 מיליון אנשים בחוזי אפס שעות (נובמבר 2025), מתוכם 508 אלף בגילי 16–24. תקופת הייחוס הצפויה היא 12 שבועות — [Work Foundation, Lancaster](https://www.lancaster.ac.uk/work-foundation/news/zero-hour-contracts-continue-to-rise-as-figure-hits-12-million); [ONS](https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/articles/contractswithnoguaranteedhours/latest)

### Inferences
- (מוסק) כלי השיבוץ והשכר שעסקים בריטיים כבר משלמים להם (Rota, Deputy, Planday, BrightHR, Employment Hero, Sage) יוסיפו את החישוב כפיצ'ר. Employment Hero כבר מפרסמת תוכן על לוח הזמנים. זה הלקח מ-Payday Super באוסטרליה (מועמד 10): הרגולציה נבלעה בתוכנת השכר.
- הפער היחיד: עסקים קטנים שמשבצים בוואטסאפ או באקסל (פאבים, מסעדות, טיפול ביתי) ולא ישלמו על חבילת HR מלאה. אבל "תורים בוואטסאפ" ו"שיבוץ משמרות" כבר נפסלו בסבבים קודמים, וזה קרוב מדי.
- **בדיקת הריגה:**
  1. משלם עם מחיר שוק ½ (עו"ד עבודה ו-HR outsourcing קיימים, לא תועד מחיר)
  2. תדירות ✓
  3. אין חלופה חינמית/מובנית ✗ (צפוי פיצ'ר אצל אינקומבנטים)
  4. פער מוסבר ½
  5. ערוץ הפצה ✗ (שוק בריטי, מייסד ישראלי)
  6. גודל ✓
  7. תלות נמוכה ✗ (תלוי בתוכן התקנות ובהחלטת ממשלה)
  8. מתאים למייסד ✓ (MVP אפשרי)
  9. שורד פרקליט שטן ✗

  = **~4.5/9**

### Gaps
- התקנות, אורך תקופת הייחוס ותאריך התחילה המדויק לא פורסמו (או שלא מצאתי).
- אין נתון על מספר המעסיקים (להבדיל ממספר העובדים) שמעסיקים בחוזי אפס שעות.

---

## מועמד 3: AML שוטף למשרדים קטנים באוסטרליה (AML/CTF Tranche 2, מ-1 ביולי 2026)

### Takeaway
החובה החדשה הכי "שמנה": כ-90 אלף מדווחים חדשים (עו"ד, רואי חשבון, מתווכים, conveyancers, TCSPs). העלות הממוצעת המוערכת היא כ-23 אלף דולר אוסטרלי לשנה, והעבודה חוזרת (CDD לכל לקוח, ניטור, דוחות). **אבל השוק הוצף בתוך חודשים.** **ציון: 4/9.**

### Cited Findings
- **מי מכוסה (מאומת):** מתווכי נדל"ן, עו"ד ו-conveyancers, רואי חשבון, נותני שירותי נאמנות וחברות, וסוחרי מתכות ואבנים יקרות הפכו ל"גופים מדווחים" ב-AUSTRAC. הכיסוי נקבע לפי השירות שניתן, לא לפי המקצוע — [AUSTRAC factsheet](https://www.austrac.gov.au/sites/default/files/2025-07/AMLCTF_obligations_factsheet_for_tranche_2_REs.pdf); [namescan](https://namescan.io/insights/tranche-2-now-in-force/)
- **היקף (מאומת, משני):** AUSTRAC פתחה הרשמה ב-31 במרץ 2026 לכ-90,000 גופים מדווחים חדשים — [Legl](https://legl.com/articles/tranche-2-enrolment-open-australian-law-firms-july-2026)
- **עלות (מאומת, משני):** ממוצע של כ-23,250 דולר לשנה לפי ה-RIS של משרד התובע הכללי. **AMLTranche** טוענת ש"יועצים עולים 15,000 דולר ומעלה" (שיווק) — [saashub/AMLTranche](https://www.saashub.com/amltranche); [Cooper Grace Ward guide](https://cgw.com.au/wp-content/uploads/2026/07/AML-CTF-Reforms-2026-Guide-for-Advisers-post-1-July-Cooper-Grace-Ward-3447-3531-7325.pdf)
- **מתחרים שכבר קיימים (מאומת):**
  - **Flagship AML:** מ-66.70 דולר אוסטרלי, ממוקדת במשרדים קטנים — [Capterra AU](https://www.capterra.com.au/software/1097498/Flagship-AML)
  - **easyAML:** "purpose built for Australian SMEs" — [easyaml.com](https://easyaml.com/tranche-2/)
  - **AMLTranche:** מ-59 דולר לחודש, לאנשי נדל"ן — [saashub](https://www.saashub.com/amltranche)
  - **Legl** — [Legl](https://legl.com/articles/tranche-2-enrolment-open-australian-law-firms-july-2026). **Didit** — [Didit](https://updates.didit.me/blog/austrac-tranche-2-tcsp-guide/). **NameScan** — [namescan](https://namescan.io/insights/tranche-2-now-in-force/)
- מ-1 ביולי 2026 גופי Tranche 2 משתמשים בטפסי TTR ו-SMR החדשים — [Didit](https://updates.didit.me/blog/austrac-transaction-reporting-changes-july-2026/)

### Inferences
- (מוסק) First AML מניו זילנד, שגדלה בדיוק מהמעבר של "phase 2" הניו זילנדי, ו-InfoTrack פעילות באוסטרליה. ייתכן ש-AUSTRAC מספקת "starter kits" חינמיים לתוכניות AML (לא אומת כאן).
- המשימה החוזרת אמיתית והמשלם מובהק (ההוכחה: כבר יש תמחור של 59–67 דולר לחודש). אבל בתוך 4 חודשים יש לפחות 6 כלים ייעודיים, וזה מחיר נמוך שמשאיר מעט מקום לנכנס חדש.
- **בדיקת הריגה:**
  1. משלם עם מחיר שוק ✓
  2. תדירות ✓
  3. אין חלופה חינמית ½
  4. פער מוסבר ✗ (אין פער מוסבר, כולם מכוונים ל-SME)
  5. ערוץ הפצה ✗ (מייסד ישראלי מול איגודים אוסטרליים)
  6. גודל ✓
  7. תלות נמוכה ✓
  8. מתאים למייסד ½
  9. שורד פרקליט שטן ✗

  = **~4/9** (5 בבדיקה מקלה)

### Gaps
- אין נתון רשמי על מספר הנרשמים בפועל.
- מחירי First AML ו-InfoTrack לא נבדקו.
- לא אומת אם AUSTRAC נותנת תבניות חינם.

---

## מועמד 4: שקיפות שכר ב-SMB (EU Pay Transparency Directive 2023/970), גרסה מקומית לפי מדינה

### Takeaway
החובה רחבה מאוד: טווח שכר במודעות ומענה לבקשות מידע חלים על כל מעסיק, בלי קשר לגודל. אבל ההטמעה הלאומית מאחרת (רוב המדינות החמיצו את 7 ביוני 2026), החלק החוזר דליל (הערכת משרות חד-פעמית, הודעה שנתית, מענה לבקשות), השוק מלא, ופולין בונה כלי חינמי. **ציון: 3.5/9.**

### Cited Findings
- **סטטוס הטמעה (מאומת):**
  - עד המועד הטמיעו רק איטליה, ליטא, מלטה וסלובקיה. יוון פרסמה חוק ב-6 ביולי 2026. אסטוניה וצ'כיה הטמיעו חלקית.
  - בפורטוגל טיוטה עברה להתייעצות באוגוסט 2026. בצרפת ההצבעה צפויה בתחילת 2027. באירלנד ההצעה לא תועדפה — [Ius Laboris via search](https://iuslaboris.com/insights/eu-pay-transparency-directive-which-countries-have-implemented/); [Lockton, Sept 2026](https://global.lockton.com/us/en/news-insights/eu-pay-transparency-directive-implementation-status)
  - בגרמניה החוק צפוי רק בתחילת 2027 — [flair](https://flair.hr/en/blog/pay-bands)
- **פולין (מאומת):**
  - מ-24 בדצמבר 2025 חלה חובת מידע על שכר התחלתי לפני ההעסקה, וחל איסור לשאול על שכר קודם.
  - עדיין חלוקים אם חובה לפרסם טווח במודעה עצמה. ב-Pracuj.pl רק כ-12 אלף מתוך יותר מ-39 אלף מודעות כללו טווח (ינואר 2026).
  - טיוטת UC127 טרם עברה — [hrappka](https://hrappka.pl/blog/jawnosc-wynagrodzen/); [bezprawnik](https://bezprawnik.pl/liczyliscie-na-jawnosc-wynagrodzen-w-ogloszeniach-o-prace-pracodawcy-wcale-nie-musza-ich-podawac/)
- **כלי חינמי של המדינה (מאומת, משני):** משרד העבודה הפולני (MRPiPS) מפתח יחד עם CIOP-PIB כלי להערכת משרות, "זמין לכל המעסיקים ללא תשלום", ופרסם מדריך — [wynagrodzenia.pl](https://wynagrodzenia.pl/artykul/kartezjusz-a-wartosciowanie-pracy-metoda-mop)
- **ספים (מאומת, עם סתירות):** חובות הליבה לא תלויות בגודל. לגבי דיווח פערי שכר:
  - PwC: 150+ עובדים, דוח ראשון עד 7 ביוני 2027 — [PwC](https://www.pwc.co.uk/services/human-resource-services/insights/eu-pay-transparency-directive.html)
  - Mayer Brown: 250+ עובדים, דיווח שנתי מ-2027 על נתוני 2026 — [Mayer Brown](https://www.mayerbrown.com/de/insights/publications/2026/07/eu-pay-transparency-directive-practical-briefing-for-international-employers)
  - Assessio — [Assessio](https://assessio.com/articles/eu-pay-transparency-directive-guide/)
- **מתחרים (מאומת):**
  - **SkillsTrust** (דבלין, ל-SMEs) — [WTTJ](https://app.welcometothejungle.com/companies/SkillsTrust-1)
  - **Indigo JET** (מלטה, standalone) — [Shireburn](https://www.shireburn.com/indigo/eu-pay-transparency-directive/)
  - **gradar** (QPM, שותף SAP) — [SAP](https://www.sap.com/products/hcm/partners/qpm-quality-personnel-management-gmbh-gradar.html)
  - **Ravio** (12 מיליון דולר, דוחות פערי שכר אוטומטיים) — [Ravio pricing](https://ravio.com/pricing); [tech.eu](https://tech.eu/2025/05/09/ravio-secures-12m-to-improve-the-quality-of-compensation-data/)
  - **Figures** — [CB Insights](https://www.cbinsights.com/compare/figures-vs-ravio)
  - **Personio** (פיצ'ר מובנה: מודעות, טווחי שכר, אנליטיקה) — [Personio](https://www.personio.com/resources/eu-pay-transparency-directive-guide/)
  - **Trusaic** — [Trusaic](https://trusaic.com/resources/achieving-pay-transparency-through-job-evaluation-and-pay-equity-analytics)

### Inferences
- עבור עסקים מתחת ל-100 עובדים העבודה בעיקרה חד-פעמית: מבנה משרות, טווחים והערכה ניטרלית. אחר כך נשארות פעולות נקודתיות (מודעה, בקשה). זה מנוי חלש.
- הפער היחיד הוא שפה ומדינה (צ'כית, סלובקית, ליטאית), אבל אלה שווקים קטנים, והמדינה (כמו בפולין) עשויה לתת כלי חינמי.
- **בדיקת הריגה:**
  1. משלם עם מחיר שוק ½
  2. תדירות ✗
  3. אין חלופה חינמית ✗ (Personio וכלי ממשלתי פולני)
  4. פער מוסבר ½
  5. ערוץ הפצה ½
  6. גודל ✓
  7. תלות נמוכה ✗ (תלוי בתזמון החקיקה הלאומית)
  8. מתאים למייסד ✓
  9. שורד פרקליט שטן ✗

  = **~3.5/9**

### Gaps
- לא נמצאו מחירים ל-SkillsTrust ול-Figures.
- לא אומת אם הכלי הפולני כבר זמין.
- הסתירה בספי הדיווח (150 מול 250) לא נפתרה. תלוי במדינה.

---

## מועמד 5: Data brokers מול California DROP (Delete Act, מ-1 באוגוסט 2026)

### Takeaway
חובה חוזרת מובהקת (כל 45 יום) עם קנס כבד. אבל היא חלה רק על כ-600 ישויות, ו-DataGrail ו-Ketch כבר מציעות אוטומציה מלאה. **ציון: 3/9.**

### Cited Findings
- **החובה (מאומת, מקור רשמי):** מ-1 באוגוסט 2026 כל data broker חייב, כל 45 יום, להוריד את רשימות המחיקה, למחוק רשומות תואמות ולדווח סטטוס ל-CalPrivacy — [privacy.ca.gov](https://privacy.ca.gov/data-brokers); [DROP for data brokers](https://privacy.ca.gov/drop-for-data-brokers/)
- **קנס (מאומת, משני):** 200 דולר לכל בקשה לכל יום אי-מחיקה. ביקורת צד ג' כל 3 שנים מ-2028 — [Fenwick](https://www.fenwick.com/insights/publication/dont-drop-ball-upcoming-changes-california-delete-act-five-key-steps-companies)
- **היקף (מאומת):** יותר מ-600 ברוקרים רשומים ויותר מ-300 אלף בקשות עד אביב 2026 — [Malwarebytes](https://www.malwarebytes.com/blog/news/2026/08/californians-can-tell-data-brokers-to-drop-their-information); [TrustArc](https://trustarc.com/resource/california-delete-act-drop-platform-data-brokers/)
- **מתחרים (מאומת):**
  - **DataGrail:** "Data Broker Compliance": הורדה אוטומטית, hash matching, מחיקה ודיווח — [DataGrail](https://www.datagrail.io/solutions/drop-compliance/)
  - **Ketch** — [Ketch](https://www.ketch.com/blog/posts/california-drop-platform-data-broker-compliance)
  - **Transcend** (וובינר) — [Transcend](https://transcend.io/partners/technology)

### Inferences
- 600 לקוחות × 5–20 אלף דולר נותן תקרה של כ-3–12 מיליון דולר. זה נכשל בקריטריון "כמה אלפי לקוחות". ייתכן הרחבה עתידית למדינות נוספות עם רישום ברוקרים (טקסס, ורמונט, אורגון), אבל לא אומת.
- **בדיקת הריגה:** 1✓ 2✓ 3✗ 4✗ 5✗ 6✗ 7½ 8✓ 9✗ = **~3/9**

### Gaps
- לא נבדק אם מדינות נוספות מתכננות מנגנון דומה ל-DROP.

---

## מועמד 6: סינון טענות ירוקות בשיווק (Directive (EU) 2024/825 "EmpCo", מ-27 בספטמבר 2026)

### Takeaway
חלה על כל עסק B2C שמוכר באיחוד ומשתמש בטענות סביבתיות, בלי grandfathering. אבל בתוך חודש כבר יש לפחות 6 כלים (חלקם חינמיים), ו-LLM כללי עושה את זה טוב. **ציון: 2.5/9.**

### Cited Findings
- **החובה (מאומת):**
  - חלה מ-27 בספטמבר 2026, בלי grandfathering.
  - אסורות טענות גנריות ("green", "eco", "natural") בלי ביצועים סביבתיים מוכרים, וטענות "climate neutral" שמבוססות על קיזוז.
  - תוויות קיימות חייבות להתבסס על הסמכה או להיות מטעם רשות ציבורית — [TLT](https://www.tlt.com/insights-and-events/insight/the-eu-is-empowering-consumers-for-the-green-transition-directive-what-your-business-needs-to-do-before-september-2026); [Anthesis](https://www.anthesisgroup.com/regulations/eu-empco-directive/)
- **מתחרים (מאומת):**
  - **EmpCo-Check** — [hunted.space](https://www.hunted.space/product/empco-check)
  - **Miltton Green Checker** (מנוי חודשי) — [Miltton](https://miltton.com/fix-your-green-claims-with-an-effective-ai-tool/)
  - **GreenClaims Scanner** (חינמי, ClimateBERT, שכבות בתשלום) — [Product Hunt](https://www.producthunt.com/products/greenclaims-scanner)
  - **EcoAppraise** — [G2](https://www.g2.com/products/ecoappraise/discuss)
  - **Clifford Chance AI Greenwashing Scanner** — [Clifford Chance](https://www.cliffordchance.com/content/dam/cliffordchance/briefings/2026/09/ai-greenwashing-scanner.pdf)
  - **Publicis** (כלי פנימי) — [markt-kom](https://www.markt-kom.com/en/?p=229541)

### Inferences
- הבעיה נפתרת בעיקר בסריקה חד-פעמית של האתר ובהנחיה לקופירייטרים. בדיקה שוטפת של טקסטים חדשים היא בדיוק מה ש-ChatGPT עושה עם פרומפט.
- **בדיקת הריגה:** 1½ 2½ 3✗ 4✗ 5½ 6✓ 7✓ 8✓ 9✗ = **~2.5–3/9** (מחמיר: 2.5)

### Gaps
- לא נבדקה אכיפה בפועל או קנסות לפי מדינה.

---

## מועמד 7: הצהרת תאימות ותיק טכני לאריזות (PPWR, Regulation (EU) 2025/40, מ-12 באוגוסט 2026)

### Takeaway
חובה חדשה ורחבה בלי פטור SME: הצהרת תאימות ותיעוד טכני לכל סוג אריזה. אבל היא צמודה לתחום ה-EPR שנפסל, וכבר יש לפחות 6 מחוללי הצהרות. **ציון: 3/9.**

### Cited Findings
- **החובה (מאומת):**
  - מ-12 באוגוסט 2026 מותר לשווק רק אריזה שעומדת ב-PPWR ושיש לה הצהרת תאימות.
  - נדרשים הערכת תאימות ותיעוד טכני לכל סוג אריזה, ומגבלות PFAS ומתכות כבדות.
  - קמעונאי אונליין שהמותג שלו על האריזה עשוי להיחשב "יצרן" — [SUUS](https://suus.com/en/resources-insights/blog/ppwr-new-obligations-for-companies-and-packaging-importers-from-august-12-2026); [Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2026/7/significant-new-obligations-for-manufacturers-placing-packaging-on-the-eu-market); [verpackungsregister](https://www.verpackungsregister.org/en/ppwr/mail-order-companies-online-retailers)
- **מתחרים (מאומת):**
  - **PackIntelX EasyDoC** (ל-SMB, 3 צעדים, 10 שפות) — [Packaging Europe](https://www.packagingeurope.com/new-digital-platform-generates-declaration-of-conformity-in-three-steps/)
  - **Tanso** — [Tanso](https://www.tanso.de/en/blog/ppwr-software-loesungen-im-vergleich)
  - **VERSO** — [verso.de](https://verso.de/en/ppwr-software-solution/)
  - **Delogue** — [Delogue](https://knowledge.delogue.com/ppwr-doc-generator)
  - **rev-log** — [rev-log](https://rev-log.com/ppwr-doc-declaration-of-conformity-requirements/)
  - **Packliance + cyclos-HTP** — [packaging-journal](https://packaging-journal.de/en/?p=115496)

### Inferences
- התדירות נמוכה: הצהרה לכל SKU חדש של אריזה, לא פעולה חודשית אצל רוב ה-SMB.
- **בדיקת הריגה:** 1½ 2✗ 3✗ 4✗ 5½ 6✓ 7✓ 8✓ 9✗ = **~3/9**

### Gaps
- לא נמצאו מחירים לכלים הקיימים.

---

## מועמד 8: הנגשת החשבון לבעלי עסק קטנים מול Making Tax Digital for Income Tax (בריטניה, מאפריל 2026, הרחבה באפריל 2027)

### Takeaway
החובה רבעונית וחלה על מאות אלפים (864 אלף מאפריל 2026, ועוד שכבה מאפריל 2027 מעל 30 אלף ליש"ט). אבל השוק עמוס בתוכנות שמוכרות על ידי HMRC, כולל bridging, וזה תחום קרוב ל"בק-אופיס הנה"ח" שנפסל. **ציון: 3/9.**

### Cited Findings
- **החובה (מאומת):**
  - שלב 1 מ-6 באפריל 2026 לעצמאים ובעלי נכסים עם הכנסה ברוטו מעל 50 אלף ליש"ט, כ-864 אלף נישומים.
  - מעל 30 אלף ליש"ט מאפריל 2027, ומעל 20 אלף מאפריל 2028.
  - העדכון הרבעוני הראשון היה ב-7 באוגוסט 2026 — [ICAEW Aug 2026](https://www.icaew.com/insights/tax-news/2026/aug-2026/hmrc-to-begin-signing-up-taxpayers-for-mtd-income-tax); [Which?](https://www.which.co.uk/money/tax/income-tax/making-tax-digital-mtd-for-income-tax-aboJ39E1tbWw)
- **אימוץ (מאומת):** 570 אלף נרשמו ו-436 אלף הגישו עדכון רבעוני עד אוגוסט 2026 — [ICAEW](https://www.icaew.com/insights/tax-news/2026/aug-2026/hmrc-to-begin-signing-up-taxpayers-for-mtd-income-tax). HMRC רושמת נישומים בעצמה מספטמבר (מקור משני) — [uktaxcalculators](https://www.uktaxcalculators.co.uk/tax-news/2026/08/17/hmrc-will-sign-you-up-for-mtd-regardless-of-whether-youre-ready/)
- תוכנות bridging ותוכנות מלאות כבר קיימות — [ICAS](https://icas.com/landing/tax/making-tax-digital-for-income-tax-time-to-get-ready); [SparkReceipt](https://sparkreceipt.com/en-gb/blog/making-tax-digital-self-employed/)

### Inferences
- (מוסק) Xero, QuickBooks, FreeAgent, Sage ועשרות כלי bridging וכלי בעלי בית כבר ברשימת HMRC. אין פער מבני.
- **בדיקת הריגה:** 1✓ 2✓ 3✗ 4✗ 5✗ 6✓ 7✗ 8½ 9✗ = **~3.5/9** (מעוגל ל-3 בגלל קרבה לתחום שנפסל)

### Gaps
- לא נספר כמה תוכנות יש ברשימה הרשמית של HMRC.

---

## מועמד 9: תיוג תוכן AI למפרסמים וסוכנויות (EU AI Act סעיף 50(4), מ-2 באוגוסט 2026)

### Takeaway
החובה של ה-deployer צרה (deepfakes וטקסט בנושאי עניין ציבורי בלי עריכה אנושית), קופי שיווקי רגיל בדרך כלל מחוץ לה, והתיוג עצמו טריוויאלי. **ציון: 2/9.**

### Cited Findings
- **החובה (מאומת):**
  - סעיף 50 חל מ-2 באוגוסט 2026, והנציבות הודיעה שתאכוף מאותו מועד.
  - deployers חייבים לתייג deepfakes וטקסט AI שמתפרסם כדי ליידע את הציבור בנושאי עניין ציבורי. טקסט שעבר בקרה עריכתית אנושית מוחרג — [Mondaq/advertising](https://www.mondaq.com/advertising-marketing-branding/1825476/the-new-ai-labelling-rules-for-deployers-in-the-advertising-supply-chain); [A&L Goodbody](https://www.algoodbody.com/files/uploads/news_insights_pub/Guide_to_Article_50_of_the_EU_AI_Act.pdf)
- קופי פרסומי רגיל בדרך כלל מחוץ לחובה, אלא אם יש בו טענות בריאות, בטיחות או קיימות — [Mondaq](https://www.mondaq.com/advertising-marketing-branding/1825476/the-new-ai-labelling-rules-for-deployers-in-the-advertising-supply-chain)
- **ה-Omnibus:** רק הסימון המכונה-קריא (50(2)) למערכות שהושקו לפני 2 באוגוסט 2026 נדחה ל-2 בדצמבר 2026. סעיפים 50(1), 50(3) ו-50(4) לא זזו. Code of Practice וולונטרי פורסם ביוני 2026 — [Ropes & Gray](https://www.ropesgray.com/en/insights/viewpoints/2026/08/102nfqm/you-talkin-to-me-operationalising-the-eu-ai-acts-transparency-obligations); [Stephenson Harwood](https://perspectives.stephensonharwood.com/post/102nfqh/eu-ai-act-update-european-commission-adopts-guidelines-on-article-50-transparenc)
- הסימון הטכני חל בעיקר על ספקי המודלים (ה-providers) — [DLA Piper](https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2026/deployer-obligations-under-the-ai-act-implications-for-employers-from-2-august-2026)

### Inferences
- הספקים הגדולים (OpenAI, Google, Adobe) והפלטפורמות (Meta, TikTok) מטמיעים סימון ותיוג. מה שנשאר ל-deployer זה תווית "נוצר ב-AI", ואין משהו למכור.
- **בדיקת הריגה:** 1✗ 2½ 3✗ 4✗ 5½ 6✓ 7✗ 8✓ 9✗ = **~2/9**

### Gaps
- לא נבדקו פסיקות או אכיפה ראשונה.

---

## מועמד 10: אימות זהות דירקטורים ב-Companies House ורישום ACSP (ECCTA, בריטניה)

### Takeaway
מיליוני אנשים מושפעים והמועד קרוב (אמצע נובמבר 2026), אבל המשימה **חד-פעמית** לכל אדם. רואי חשבון כבר מקבלים את זה מתוכנות המזכירות והאימות הקיימות. **ציון: 2/9.**

### Cited Findings
- **החובה (מאומת):** מ-18 בנובמבר 2025 חלה חובה על דירקטורים ו-PSCs חדשים. לקיימים יש תקופת מעבר של 12 חודשים שמסתיימת ב-17 או 18 בנובמבר 2026 (המקורות חלוקים) — [GOV.UK campaign](https://changestoukcompanylaw.campaign.gov.uk/identity-verification/); [Law Debenture](https://www.lawdebenture.com/news-insights/millions-of-directors-still-unverified-the-17-november-deadline-is-closer-than-it-looks)
- **התקדמות (מאומת, משני):**
  - עד סוף יוני 2026 אומתו 55% מהדירקטורים, 50% מחברי LLP ו-42% מה-PSCs.
  - לפי מקור אחר, כ-4 מיליון אנשים אומתו עד יוני 2026 — [Law Debenture](https://www.lawdebenture.com/news-insights/millions-of-directors-still-unverified-the-17-november-deadline-is-closer-than-it-looks); [Cogency Global](https://www.cogencyglobal.com/blog/directors-id-verification-in-the-uk-what-you-need-to-know/)
- **מתחרים (מאומת):**
  - **Inform Direct** (Bright): מעקב קודים אישיים ושירות אימות — [Bright](https://brightsg.com/blog/inform-direct-the-home-of-eccta-compliance/)
  - רישום ACSP אפשרי רק לגופים בפיקוח AML — [Wolters Kluwer](https://wolterskluwer.com/en-gb/expert-insights/what-is-the-eccta-and-what-do-the-id-verification-rules-mean-for-accountants)

### Inferences
- (מוסק) גם Credas, Thirdfort, SmartSearch, Yoti ו-GOV.UK One Login החינמי משרתים את התחום. אחרי נובמבר 2026 נשארים רק דירקטורים חדשים: זרם קטן, וכבר משורת.
- **בדיקת הריגה:** 1✓ 2✗ 3✗ 4✗ 5✗ 6✓ 7✗ 8½ 9✗ = **~2/9**

### Gaps
- סטטוס הרפורמה ב-filing agents (נדחתה לפחות לנובמבר 2026 לפי Irwin Mitchell) לא נבדק לעומק — [Irwin Mitchell](https://www.irwinmitchell.com/news-and-insights/expert-comment/post/102mngz/identity-verification-the-latest-position-and-practical-lessons-from-early-fili)

---

## נפסלו בבדיקה מהירה (לא הגיעו לרשימה)

### Takeaway
שמונה חובות "חדשות" נפסלו מיד: הן חד-פעמיות, נבלעו באינקומבנטים, בוטלו או נדחו.

### Cited Findings
- **כפתור ביטול עסקה (Widerrufsbutton, § 356a BGB / Directive 2023/2673, מ-19 ביוני 2026):** כל חנות B2C באיחוד חייבת אותו. כבר יש לפחות 4 אפליקציות Shopify ייעודיות, והפתרונות של Händlerbund ו-eRecht24. הטמעה חד-פעמית — [Shopify App: Widerrufs-Button für EU](https://apps.shopify.com/widerrufs-button-fur-eu); [Widerruf Manager](https://apps.shopify.com/widerruf-manager); [EU Widerrufsbutton & Retouren](https://apps.shopify.com/eu-withdrawal-button-returns); [Händlerbund](https://www.haendlerbund.de/de/leistungen/rechtssicherheit/agb-service/widerrufsbelehrung/widerrufsbutton-shopify); [eRecht24](https://www.e-recht24.de/ecommerce/13533-widerrufsbutton-shopify.html)
- **Payday Super, אוסטרליה (מ-1 ביולי 2026):** פנסיה בכל ריצת שכר, ו-SBSCH החינמי נסגר. ה-ATO מפנה לתוכנות השכר, לקופות ול-clearing houses מסחריים. נבלע באינקומבנטים — [ATO](https://www.ato.gov.au/businesses-and-organisations/small-business-newsroom/the-small-business-superannuation-clearing-house-is-closing); [Fair Work](https://www.fairwork.gov.au/newsroom/news/payday-super-new-rules-starting-1-july-2026)
- **FinCEN Residential Real Estate Rule:** נדחה ל-1 במרץ 2026 ו**בוטל בבית משפט פדרלי בטקסס ב-19 במרץ 2026** — [Gibson Dunn](https://www.gibsondunn.com/fincen-residential-real-estate-reporting-rule-vacated-nationwide/); [Orrick](https://infobytes.orrick.com/2026-03-27/district-court-vacates-fincens-residential-real-estate-reporting-rule/)
- **Colorado AI Act:** נדחה ל-30 ביוני 2026. המושל הודיע על מסגרת חלופית, והתובע הכללי לא יאכוף עד סוף הליך התקנות — [PYMNTS](https://www.pymnts.com/artificial-intelligence-2/2025/colorado-delays-ai-act-to-june-2026-businesses-get-breathing-room/); [JD Supra](https://www.jdsupra.com/legalnews/colorado-attorney-general-delays-9996262/)
- **Illinois HB 3773 (AI בהעסקה, מ-1 בינואר 2026):** התקנות על חובת ההודעה הוצעו ב-15 במאי 2026 ונמשכו ב-2 ביוני 2026 — [Seyfarth](https://www.seyfarth.com/news-insights/illinois-department-of-human-rights-temporarily-withdraws-proposed-rules-on-use-of-artificial-intelligence-in-employment.html)
- **תיקון 13 לחוק הגנת הפרטיות (ישראל, מ-14 באוגוסט 2025):** חובת DPO לגופים מסוימים. משרדי עו"ד כבר מוכרים "DPO במיקור חוץ". נישה ישראלית בלבד, ולפי לקח סבב 1 תפוסה — [שיבולת](https://www.shibolet.com/practices/סייבר-אבטחת-מידע-ופרטיות/שירותי-ממונה-על-הגנת-הפרטיו/); [RSM](https://www.rsm.global/israel/he/node/228)
- **EU Data Act access-by-design (מ-12 בספטמבר 2026):** חובת עיצוב חד-פעמית למוצרים חדשים, ורק "where technically feasible" — [Heuking](https://www.heuking.de/en/news-events/newsletter-articles/detail/data-act-access-by-design-becomes-mandatory-as-of-12-september-what-companies-need-to-know-now.html); [Matheson](https://www.matheson.com/insights/the-data-act-access-by-design-requirement-comes-into-force/)
- **Martyn's Law (בריטניה, אביב 2027):** משרד הפנים אומר במפורש שאין צורך ביועצים, ו-SIA לא ממליצה על מוצרים. המשימה בעיקר חד-פעמית — [Home Office factsheet](https://homeofficemedia.blog.gov.uk/2022/12/19/martyns-law-factsheet); [Travers Smith](https://www.traverssmith.com/knowledge/knowledge-container/martyns-law-prepare-now-for-implementation-in-spring-2027/)

### Inferences
- **נבדקו בקצרה מהידע הקיים, בלי חיפוש:**
  - CBAM (מוסק: עשרות כלי SaaS מאז 2023)
  - DAC8 ו-1099-DA (מאות ישויות בלבד, ספקים גדולים)
  - CMMC (רווי)
  - Ontario job posting rules (פיצ'ר ב-ATS)
  - UK Companies House: הגשת דוחות רק דרך תוכנה מ-2027. שנתי, ולכן נכשל בתדירות.

### Gaps
- לא נבדק אם FinCEN ערערה על הביטול.

---

## הטופ 3 והמסקנה של העדשה

### Takeaway
**אף מועמד לא עובר 9/9. הציון הגבוה ביותר הוא 5/9.** הטופ 3:
1. דסק דיווח CRA למיקרו-יצרנים (5/9)
2. מנוע שעות מובטחות לעסקים קטנים בבריטניה (4.5/9, מעקב לקראת פרסום התקנות)
3. AML שוטף ב-Tranche 2 באוסטרליה (4/9)

המסקנה החשובה: **עדשת "חובה חדשה" לא מייצרת חפיר.** ההנחה שהכלים "לא בשלים כי החובה חדשה מדי" הופרכה שוב ושוב.

### Cited Findings
- **ראיות שהשוק מתמלא בתוך 0–4 חודשים מכניסה לתוקף:**
  - Widerrufsbutton: לפחות 4 אפליקציות Shopify עד יוני 2026 — [Shopify](https://apps.shopify.com/widerruf-button-eu-356a)
  - EmpCo: לפחות 6 כלים עד ספטמבר 2026 — [Product Hunt](https://www.producthunt.com/products/greenclaims-scanner)
  - PPWR: לפחות 6 מחוללי הצהרות — [Tanso comparison](https://www.tanso.de/en/blog/ppwr-software-loesungen-im-vergleich)
  - Tranche 2: לפחות 6 כלים ב-59–67 דולר אוסטרלי לחודש — [Capterra](https://www.capterra.com.au/software/1097498/Flagship-AML)
  - DROP: פתרון מלא של DataGrail — [DataGrail](https://www.datagrail.io/solutions/drop-compliance/)
  - CRA: סטארטאפ שגייס 1.4 מיליון אירו לפני שהחובה נכנסה לתוקף — [startuprise](https://startuprise.co.uk/craci-raises-e1-4m-led-by-lifeline-ventures-to-expand-cybersecurity-compliance-platform/)
- **ממשלות מספקות כלים חינמיים:**
  - ENISA: SRP, EUVD ו-EU KEV — [ENISA](https://www.enisa.europa.eu/topics/vulnerability-services)
  - פולין: כלי הערכת משרות חינמי — [wynagrodzenia.pl](https://wynagrodzenia.pl/artykul/kartezjusz-a-wartosciowanie-pracy-metoda-mop)
  - בריטניה: משרד הפנים אומר שאין צורך ביועצים ל-Martyn's Law — [Home Office](https://homeofficemedia.blog.gov.uk/2022/12/19/martyns-law-factsheet)
- **חובות "חדשות" נדחות או מבוטלות** (סיכון פלטפורמה/רגולטור, קריטריון 7):
  - FinCEN RRE בוטל — [Gibson Dunn](https://www.gibsondunn.com/fincen-residential-real-estate-reporting-rule-vacated-nationwide/)
  - Colorado הוקפא — [JD Supra](https://www.jdsupra.com/legalnews/colorado-attorney-general-delays-9996262/)
  - Illinois: התקנות נמשכו — [Seyfarth](https://www.seyfarth.com/news-insights/illinois-department-of-human-rights-temporarily-withdraws-proposed-rules-on-use-of-artificial-intelligence-in-employment.html)
  - שקיפות שכר: רוב המדינות לא הטמיעו — [Lockton](https://global.lockton.com/us/en/news-insights/eu-pay-transparency-directive-implementation-status)

### Inferences
- **למה CRA ראשון:**
  - זו החובה היחידה שהיא חוזרת באמת (ניטור רציף ודיווח 24/72 שעות) ותלויה במומחיות סייבר, כך שקשה לחקות אותה עם LLM כללי.
  - זה תחום שבו למייסד ישראלי יש יתרון אקוסיסטם.
  - יש ערוץ ממשי: קהילות מייקרים ו-ESP32, ו-EDIHs.
  - **החולשה הקטלנית:** אם סעיף 64(10) אכן פוטר מיקרו וקטנים מקנס על איחור של 24 שעות, אין להם כאב כספי מיידי. לכן הפלח הנכון הוא דווקא בינוניים (50–250 עובדים), ושם CRACI ו-Cemply מתחרים ישירות.
  - **לבדיקת הריגה מעמיקה:** נוסח סעיף 64, מחירי Cemply ו-CRACI, ותמחור יועצי CRA.
- **למה שעות מובטחות שני:** החובה החוזרת הכי "חישובית", והכלים באמת עוד לא קיימים כי אין עדיין תקנות. אבל זה בדיוק ההימור שאינקומבנטים ינצחו. מתאים למעקב: לחזור כשהתקנות יפורסמו (צפוי 2027).
- **למה Tranche 2 שלישי:** המשלם והתדירות הכי מוכחים בעדשה (יש תמחור שוק וכ-90 אלף גופים). אבל הוא כבר רווי בכלים מקומיים זולים. הוא נכנס לרשימה רק כהוכחה לדפוס, לא כהמלצה.
- **המלצה לסבב הבא:** לנטוש את "טריות" כמקור חפיר. במקומה לחפש **חובות ותיקות שהכלים בהן גרועים או יקרים**, או **פלחים שהספקים הגדולים מזניחים מבנית** (שפה, מחיר, ערוץ). לבדוק דווקא שוק שבו יש תקציב ישן ומתועד (יועצים) ולא שוק שנולד לפני חודשיים.

### Gaps
- לא אומתו בחיפוש הזה:
  - מחירי יועצים מתועדים עבור CRA ושקיפות שכר (קריטריון 1)
  - מספר הישויות המכוסות ב-CRA
  - נוסח סעיף 64(10) ב-CRA
  - תאריך התחילה של סעיפי השעות המובטחות בבריטניה
