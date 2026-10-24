# בדיקת הריגה: אפליקציית HubSpot לסנכרון deals/quotes/companies למערכות הנה"ח אזוריות (סבב r2)

> חוקר: אנליסט ספקן (בדיקת הריגה). תאריך: 2026-10-24. בערך 30 קריאות כלים.
> **הערה מתודולוגית:** כל ניסיונות ה-fetch נכשלו ב-DNS (ecosystem.hubspot.com, knowledge.hubspot.com, apideck.com, cloudify.biz). לכן **כל הממצאים מבוססים על תקצירי מנוע החיפוש של העמודים המצוטטים**, ולא על קריאה מלאה. סימון בכל שורה:
> - **[מאומת-תקציר]**: הנתון מופיע בתקציר החיפוש של העמוד המצוטט.
> - **[ספק]**: הנתון מגיע מספק עם אינטרס מסחרי או ממקור משני.
> - **[הסקה]**: מסקנה שלי, לא ממקור.
>
> **פסק דין מראש: FAIL.** הרעיון נכשל בקריטריונים 3 (מתחרים), 6 (גודל, לפי מספרי התקנות בפועל), 7 (תלות כפולה בפלטפורמות) ו-9 (פרקליט שטן). חלקי בקריטריונים 1 ו-5. ההנחה של מסמך המקור, שלמערכות האזוריות "יש רק אפליקציות זעירות", נכונה. אבל הפרשנות הפוכה: **לכל מערכת משמעותית כבר יש אפליקציה ייעודית אחת לפחות, לרוב שתיים או שלוש, וכולן תקועות על עשרות עד מאות התקנות.** זה לא פער שמחכה למילוי. זו תקרת ביקוש. כבר יש שחקן רב-מערכתי (Cloudify) שמכסה Fortnox, e-conomic, Tripletex ו-Xero, ומגיע לכ-70–100 התקנות לכל מערכת. HubSpot עצמה בנתה Data Sync ל-Exact Online ול-Sage UK, והתחילה e-invoicing דרך Peppol בבלגיה ובגרמניה.

---

## שאלה 1: מתחרים ופתרונות קיימים (קריטריון 3, החשוד העיקרי כרוצח)

### Takeaway
לכל אחת מ-13 המערכות שנבדקו כמעט, חוץ מ-Moneybird, SnelStart, Fiken, PowerOffice, Dinero/Billy והמערכות הישראליות, כבר יש אפליקציה ייעודית ב-HubSpot Marketplace. לחלק מהן יש אפליקציה של HubSpot עצמה (Exact Online, Sage UK, Zoho Books) או של ספק ההנה"ח (sevDesk, Pennylane). מעליהן יש שכבה של שחקנים רב-מערכתיים (Cloudify, Commercient, APIcenter), iPaaS (Zapier, Make, Zoho Flow, Pipedream, SyncSpider) ו-unified APIs (Chift, Apideck) שמורידים את מחסום הכניסה לכל מתחרה חדש. **קריטריון 3: FAIL.**

### Cited Findings

**מפת מתחרים לפי מערכת (HubSpot Marketplace):**

| מערכת | אפליקציות קיימות ב-HubSpot | התקנות / דירוג | מקור |
|---|---|---|---|
| Fortnox (SE) | Fortnox by Resultify (סנכרון דו-כיווני של לקוחות, דורש רכישה גם ב-Fortnox marketplace ותוכנית Full) | 60+ התקנות, 5★ מביקורת אחת | [מאומת-תקציר] [HubSpot: Fortnox by Resultify](https://ecosystem.hubspot.com/marketplace/apps/fortnox-by-resultify-1552654) |
| Fortnox (SE) | Fortnox Sync by **Cloudify** (deal ← חשבונית/הזמנה, מוצרים, נתונים פיננסיים, פעולה ב-Workflows) | 100+ התקנות, 4.7★ משלוש ביקורות | [מאומת-תקציר] [HubSpot: Fortnox Sync](https://ecosystem.hubspot.com/marketplace/apps/fortnox-sync-1659090); [Fortnox marketplace: Cloudify](https://www.fortnox.se/integrationer/integration/cloudify-aps/hubspot) |
| Visma e-conomic (DK) | **Cloudify** (חשבוניות/הזמנות/הצעות מחיר מ-deals, replay לסנכרונים שנכשלו, HubSpot Certified App, ניסיון חינם עם 15 קרדיטים) | 100+ התקנות | [מאומת-תקציר] [HubSpot: hubspot-to-economic](https://ecosystem.hubspot.com/marketplace/apps/hubspot-to-economic-622089) |
| Visma e-conomic (DK) | MCB A/S ("האינטגרציה הראשונה"), 99$ לחודש ו-399$ חד-פעמי להתקנה | 40+ התקנות, ביקורת אחת של 1★ על onboarding איטי | [מאומת-תקציר] [HubSpot: visma-e-conomic](https://ecosystem.hubspot.com/marketplace/apps/visma-e-conomic-418661); [MCB](https://mcb.dk/en/hubspot-economic-app) |
| Exact Online (NL/BE) | **Data Sync by HubSpot**, שנבנה על ידי HubSpot עצמה, HubSpot Certified, דו-כיווני, Sales Invoices ↔ Invoices | 400+ התקנות, 2★ מארבע ביקורות ("חשבוניות ששולמו מיובאות כ-open") | [מאומת-תקציר] [HubSpot: exact-data-sync](https://ecosystem.hubspot.com/marketplace/listing/exact-data-sync) |
| Exact Online | KoppelHet (deal ← חשבונית מכירה או הזדמנות, טריגר לפי deal stage, התאמת SKU) | לא ידוע | [מאומת-תקציר] [HubSpot: exact-online](https://ecosystem.hubspot.com/marketplace/listing/exact-online); [Exact App Store](https://www.exact.com/app-store/hubspot-koppeling-koppelhet) |
| Exact / Twinfield / Yuki / Exact Globe | APIcenter (iPaaS הולנדי), "Sales order flow" מ-34.98€ לחודש | לא ידוע | [מאומת-תקציר] [HubSpot: APIcenter](https://ecosystem.hubspot.com/marketplace/apps/apicenter-982168) |
| Lexware Office / lexoffice (DE) | Pipey (חשבונית מ-deal stage, dunning), Regular ב-25€ לחודש | 20+ התקנות, 5★ מביקורת אחת | [מאומת-תקציר] [HubSpot: Pipey](https://ecosystem.hubspot.com/marketplace/apps/pipey-hubspot-lexware-office-invoice-integration-1624383) |
| sevDesk (DE) | **אפליקציה רשמית של sevDesk** (Business ב-19.90€ לחודש). ביקורת 1★ מנובמבר 2024: רק אנשי קשר, בלי חשבוניות. sevDesk השיבה "בפיתוח" | לא ידוע | [מאומת-תקציר] [HubSpot: sevdesk](https://ecosystem.hubspot.com/marketplace/listing/sevdesk); [sevdesk.de](https://sevdesk.de/integrationen/hubspot/) |
| DATEV (DE) | DATEV Unternehmen Online של Maesn GmbH (סנכרון חשבוניות) | כ-20 התקנות | [מאומת-תקציר] [HubSpot accounting category](https://ecosystem.hubspot.com/marketplace/apps/accounting) |
| Holded (ES) | Tiralíneas (מסים והנחות דו-כיווני, הצעות מחיר/חשבוניות/פרופורמה/תעודות משלוח מול deals) | 100+ עד 200+ (משתנה לפי שפה) | [מאומת-תקציר] [HubSpot: holded](https://ecosystem.hubspot.com/marketplace/listing/holded) |
| Pennylane (FR) | **אינטגרציה native של Pennylane** (מדצמבר 2023): חשבוניות ומנויים מ-quotes של HubSpot, וסטטוס תשלום חוזר ל-HubSpot | לא ידוע | [מאומת-תקציר] [Pennylane: HubSpot](https://www.pennylane.com/fr/integrations/hubspot); [Pennylane blog](https://www.pennylane.com/fr/blog/produit/inte-hubspot) |
| Sage Business Cloud (UK/IE) | **Data Sync by HubSpot**, ובנוסף Dotsquares ו-Commercient (Sage 50–X3) | ביקורת מדצמבר 2025: לא מסנכרן שורות פריטים ולא הצעות מחיר | [מאומת-תקציר] [HubSpot: sageaccounting-data-sync](https://ecosystem.hubspot.com/marketplace/listing/sageaccounting-data-sync); [Dotsquares](https://dotsquares.com/press-and-events/sync-hubspot-sage-integration) |
| MYOB (AU) | MYOB SYNC by Commercient | פחות מ-10 התקנות, 1★ | [מאומת-תקציר] [HubSpot: myob-data-sync-commercient](https://ecosystem.hubspot.com/marketplace/apps/myob-data-sync-commercient) |
| Tripletex (NO) | Tripletex Sync by **Cloudify** (deal ← חשבונית, הכנסות לקוח) | 70+ התקנות, 2★ מביקורת אחת | [מאומת-תקציר] [HubSpot: tripletex-sync-cloudify](https://ecosystem.hubspot.com/pt/marketplace/apps/tripletex-sync-cloudify) |
| Visma.net (Nordics) | Confect AB (99€ לחודש ו-995€ להתקנה); Spring Agency/Amesto (250$ לחודש ו-4,000$ להתקנה) | 10+ ופחות מ-10 התקנות | [מאומת-תקציר] [HubSpot: visma-net-integration](https://ecosystem.hubspot.com/marketplace/apps/visma-net-integration); [Spring Agency](https://ecosystem.hubspot.com/marketplace/listing/visma-net-hubspot-sync-by-spring-agency-as-1454302) |
| Zoho Books | Data Sync by HubSpot | כ-1K התקנות | [מאומת-תקציר] [HubSpot accounting](https://ecosystem.hubspot.com/marketplace/apps/finance/accounting) |
| Moneybird (NL) | **לא נמצאה אפליקציה ייעודית**. יש Zapier (גם הצעת מחיר מ-deal), Pabbly ו-Zoho Flow | — | [מאומת-תקציר] [Zapier HubSpot↔Moneybird](https://zapier.com/apps/hubspot/integrations/moneybird) |
| SnelStart (NL), Fiken / PowerOffice (NO), Dinero / Billy (DK), Morning/חשבונית ירוקה (IL) | **לא נמצאה אפליקציה ייעודית** בחיפוש. ל-Billy יש תבנית Zoho Flow ("חשבונית מ-deal סגור") | — | [מאומת-תקציר] [Zoho Flow Billy↔HubSpot](https://www.zohoflow.com/apps/billy/integrations/hubspot-crm/) |

**שכבות מתחרים נוספות:**
- **Cloudify (דנמרק) הוא בדיוק הרעיון הזה, כבר בפועל:** אפליקציות ל-Fortnox, e-conomic, Tripletex ו-Xero ב-HubSpot. גם הוא תקוע על 70–100+ התקנות לכל מערכת. [מאומת-תקציר] — [Fortnox Sync](https://ecosystem.hubspot.com/marketplace/apps/fortnox-sync-1659090); [Tripletex Sync](https://ecosystem.hubspot.com/pt/marketplace/apps/tripletex-sync-cloudify); [CMSWire: Cloudify e-conomic launch](https://www.cmswire.com/the-wire/cloudify-announces-launch-of-visma-e-conomic-integration-app-on-hubspot-marketplace-for-streamlined-accounting)
- **Commercient** טוען ל-150 עד 200+ אינטגרציות ERP (Sage, MYOB, Xero, QuickBooks), אבל ההתקנות שלו מתחת ל-10 לכל אפליקציה. [מאומת-תקציר] — [HubSpot: Commercient listings](https://ecosystem.hubspot.com/marketplace/listing/sage-200-sync-commercient)
- **HubSpot עצמה נכנסת לאירופה:** e-invoicing דרך Peppol לעסקים בבלגיה ובגרמניה (בטא, דורש Stripe ומספר VAT). עמוד העזרה עודכן ב-16 בספטמבר 2026. [מאומת-תקציר] — [HubSpot KB: Send e-invoices](https://knowledge.hubspot.com/payment-processing/send-e-invoices-through-hubspot). מס אוטומטי בחשבוניות היה זמין ב-2025 רק בארה"ב ובקנדה, ו-VAT דני "ב-roadmap". [מאומת-תקציר, ישן] — [HubSpot Community](https://community.hubspot.com/t5/HubSpot-Ideas/Automated-US-Sales-Tax/idi-p/700699/page/2)
- **Unified APIs:** Chift מציע Unified Invoicing & CRM API שכולל HubSpot, ו-Accounting API שכולל Sage, Cegid ו-Pennylane. [ספק] — [Chift: HubSpot](https://chift.eu/tools/hubspot); [TechCrunch on Chift](https://techcrunch.com/2024/06/25/chift-lets-saas-companies-integrate-with-dozens-of-financial-tools-with-a-unified-api). Apideck טוען ל-36+ פלטפורמות הנה"ח אירופיות ב-16 מדינות. [ספק] — [Apideck Europe coverage](https://www.apideck.com/integrations/accounting-coverage/europe.md)
- **iPaaS:** Zapier, Make, Latenode (תוכנית חינם, 31 טריגרים ו-37 פעולות ל-HubSpot↔lexoffice), SyncSpider, Pipedream, Mazaal (כולל "צור חשבונית" ב-sevDesk) ו-Zoho Flow (חשבונית sevDesk מ-deal סגור). [מאומת-תקציר] — [Latenode](https://latenode.com/de/integrations/hubspot/lexware-office); [Mazaal](https://mazaal.ai/apps/hubspot/integrations/sevdesk); [Zoho Flow sevDesk](https://www.zohoflow.com/apps/sevdesk/integrations/hubspot-crm/)
- **סוכנויות ויועצים:** SpotDev (בריטניה) מוכרת build מותאם ל-Exact Online. סוכנות דנית מחברת HubSpot ל-Business Central, e-conomic ו-Uniconta כשירות. Kolonell (צרפת) מצטטת 4,000–12,000€ לפיתוח מותאם, לעומת 20–300€ לחודש לחבר no-code. [ספק] — [SpotDev Exact Online](https://www.spotdev.co.uk/integrations/library/exact-online); [Kolonell](https://kolonell.com/fr/blog/connecter-hubspot-pennylane-crm-facturation-nantes-2026)

### Inferences
- [הסקה] הפער האמיתי הוא לא "אין אפליקציה" אלא "האפליקציות הקיימות בינוניות" (2★ ל-Exact של HubSpot, 2★ ל-Tripletex של Cloudify, ו-sevDesk בלי חשבוניות). זו טענת "אני אבנה טוב יותר" מול מתחרה קיים בשוק זעיר, לא פער מבני.
- [הסקה] המערכות שעדיין לא מכוסות (Moneybird, SnelStart, Fiken, PowerOffice, Dinero, Billy) משרתות בעיקר עסקים זעירים ופרילנסרים. זה פלח שבדרך כלל לא משלם על HubSpot Sales Hub Pro, ולכן חוסר האפליקציה הוא ככל הנראה סימפטום של חוסר ביקוש ולא של הזנחה.
- [הסקה] יש סיכון ספיגה כפול: HubSpot מרחיבה את Commerce Hub (invoices, Peppol, מס), וספקי ההנה"ח בונים בעצמם (Pennylane, sevDesk).

### Gaps
- לא נבדקו המערכות היווניות, הפולניות, האיטלקיות (Fatture in Cloud) והפורטוגזיות. ייתכן שיש שם חורים, אבל [הסקה] חדירת HubSpot שם נמוכה עוד יותר.
- לא נמצא מחיר רשמי של Cloudify (אתר לא נגיש). לא ידוע אם HubSpot הרחיבה את Peppol למדינות נוספות מעבר ל-BE/DE.
- לא נמצאה אפליקציה ישראלית (Morning/חשבונית ירוקה, iCount, Rivhit) ל-HubSpot, אבל גם לא נבדק עומק הביקוש.

---

## שאלה 2: ביקוש וגודל שוק (קריטריון 6)

### Takeaway
ל-HubSpot יש כ-289 אלף לקוחות, וכ-32% מההכנסות מאירופה. אבל **הראיה הישירה היא מספר ההתקנות בפועל:** האפליקציה המובילה לכל מערכת אזורית נמצאת על 20–400 התקנות, אחרי שנים בחנות, גם כשמאחוריה HubSpot עצמה (Exact, 400+). סך ההתקנות בכל המערכות האזוריות יחד מוערך באלפים בודדים. **קריטריון 6: FAIL** (לכל היותר "גבולי" אם סופרים את כל המערכות יחד ולוקחים נתח גדול מהמתחרים).

### Cited Findings
- ל-HubSpot היו 288,706 לקוחות ב-135+ מדינות ב-31 בדצמבר 2025. [מאומת-תקציר] — [HubSpot 10-K FY2025](https://www.sec.gov/Archives/edgar/data/1404655/000119312526046646/hubs-20251231.htm)
- כ-48% מההכנסות ב-2025 הגיעו מחוץ לארה"ב. אירופה: כ-1.01 מיליארד דולר מתוך כ-3.13 מיליארד דולר. [מאומת-תקציר, דרך מראה צד-שלישי של ה-10-K] — [HubSpot 10-K](https://www.sec.gov/Archives/edgar/data/1404655/000119312526046646/hubs-20251231.htm); [edgar.tools segments](https://app.edgar.tools/companies/HUBS/disclosures/segments)
- ל-Fortnox היו 572 אלף לקוחות מנוי ברבעון השני של 2024, והיעד ל-2025 היה 700K+. [מאומת-תקציר] — [Aktiespararna](https://www.aktiespararna.se/nyheter/fortnox-rapport-andra-kvartalet-juli-2024); [Placera](https://www.placera.se/telegram/trygg-med-kundmal-2025-aven-om-det-ar-aggressivt-vd-2024-05-24). **למרות זאת, שתי אפליקציות Fortnox↔HubSpot מגיעות יחד לכ-160+ התקנות.** [מאומת-תקציר] — [Resultify](https://ecosystem.hubspot.com/marketplace/apps/fortnox-by-resultify-1552654); [Cloudify](https://ecosystem.hubspot.com/marketplace/apps/fortnox-sync-1659090)
- ל-Tripletex היו 150 אלף לקוחות בנובמבר 2025. [מאומת-תקציר, נתון של Visma] — [Visma/MFN](https://mfn.se/all/a/visma/tripletex-reaches-150-000-customers-f2288527). אפליקציית Cloudify ל-Tripletex: 70+ התקנות. [מאומת-תקציר] — [HubSpot](https://ecosystem.hubspot.com/pt/marketplace/apps/tripletex-sync-cloudify)
- Xero Data Sync של HubSpot: כ-5–6 אלף התקנות (מתוך מסמך המקור). [מאומת-תקציר] — [HubSpot Xero Data Sync](https://ecosystem.hubspot.com/marketplace/listing/xero-data-sync)
- Exact Online Data Sync (של HubSpot): 400+ התקנות. Zoho Books Data Sync: כ-1K. NetSuite: כ-2K. [מאומת-תקציר] — [exact-data-sync](https://ecosystem.hubspot.com/marketplace/listing/exact-data-sync); [accounting category](https://ecosystem.hubspot.com/marketplace/apps/finance/accounting)
- הערכה לא רשמית: ב-2024 היו ב-HubSpot Marketplace כ-1,251 מוצרים בתשלום. [ספק, הערכה] — [Indie Hackers](https://www.indiehackers.com/post/indies-are-making-280k-arr-on-hubspot-in-2024-608dc3fab2)

### Inferences
- [הסקה] חישוב תקרה: אם מסכמים את ההתקנות הידועות לכל המערכות האזוריות (Fortnox כ-160, e-conomic כ-140, Exact כ-400+ ועוד, Tripletex כ-70, Holded כ-100–200, lexoffice כ-20, DATEV כ-20, Visma.net כ-20, MYOB פחות מ-10), מגיעים לסדר גודל של **1,000–2,000 התקנות בכל השוק**. גם אם מכפילים פי 3 בשביל משתמשי Zapier/סוכנויות, ואם 30% משלמים 50$ לחודש, התקרה היא בערך 0.5–1.5 מיליון דולר ARR **לכל הקטגוריה**, מחולקת בין 15+ מערכות שונות שכל אחת דורשת בנייה ותחזוקה נפרדות. זה רחוק מ"כמה אלפי לקוחות משלמים".
- [הסקה] יחס ההתקנות לבסיס הלקוחות של מערכת ההנה"ח (Fortnox: כ-160 מתוך כ-600K, כלומר כ-0.03%) מעיד שהחפיפה בין HubSpot (בתוכנית שיש בה deals/quotes/invoices) לבין מערכת אזורית ספציפית קטנה מאוד.
- [הסקה] חלק ממשתמשי HubSpot באירופה מנהלים חשבוניות ב-ERP או במערכת ההנה"ח, ומשתמשים ב-HubSpot רק לשיווק. הם לא צריכים סנכרון order-to-cash בכלל.

### Gaps
- אין נתון רשמי על מספר לקוחות HubSpot לפי מדינה. ה-10-K מפרט הכנסות לפי אזור בלבד.
- מספרי ההתקנות ב-HubSpot מעוגלים ("100+"), ולא נמצאו נתוני הכנסה של Cloudify או של אחרים.
- אין נתון על מספר לקוחות Moneybird או SnelStart (TheirStack לא אמין: 205 חברות).

---

## שאלה 3: נכונות לשלם (קריטריון 1)

### Takeaway
יש מחיר שוק מתועד: 19.90–99€ לחודש לאפליקציות ייעודיות, 250$ לחודש בקצה הגבוה, דמי התקנה של 399–4,000$, ו-4,000–12,000€ לפיתוח מותאם בסוכנות. כלומר משלם מזוהה קיים. **קריטריון 1: עובר חלקית.** המחירים נמוכים, הקהל זעיר, ורוב הלקוחות כבר משלמים לאחד המתחרים.

### Cited Findings
- Resultify ל-Fortnox: 399 SEK לחודש בתוכנית מלאה (ממסמך המקור). [מאומת-תקציר] — [HubSpot](https://ecosystem.hubspot.com/marketplace/apps/fortnox-by-resultify-1552654)
- MCB ל-e-conomic: 99$ לחודש ו-399$ להתקנה. [מאומת-תקציר] — [HubSpot](https://ecosystem.hubspot.com/marketplace/listing/visma-e-conomic-418661)
- Confect ל-Visma.net: 99€ לחודש ו-995€ להתקנה. Spring Agency: 250$ לחודש ו-4,000$ להתקנה. [מאומת-תקציר] — [Confect](https://ecosystem.hubspot.com/marketplace/apps/visma-net-integration); [Spring](https://ecosystem.hubspot.com/marketplace/listing/visma-net-hubspot-sync-by-spring-agency-as-1454302)
- Pipey ל-lexoffice: 25€ לחודש. sevDesk: 19.90€ לחודש (מחיר תוכנית sevDesk). APIcenter: מ-34.98€ לחודש. Exact Data Sync: "45$ לחודש" (ייתכן שזה מחיר תוכנית Exact ולא של האפליקציה; לא ברור). [מאומת-תקציר] — [Pipey](https://ecosystem.hubspot.com/marketplace/apps/pipey-hubspot-lexware-office-invoice-integration-1624383); [sevDesk](https://ecosystem.hubspot.com/marketplace/listing/sevdesk); [APIcenter](https://ecosystem.hubspot.com/nl/marketplace/listing/apicenter-982168); [Exact Data Sync](https://ecosystem.hubspot.com/marketplace/listing/exact-data-sync)
- פיתוח מותאם: 4,000–12,000€ HT. חבר no-code: 20–300€ לחודש. [ספק] — [Kolonell](https://kolonell.com/fr/blog/connecteur-hubspot-logiciel-facturation-pme-nantes-2026)
- ב-Pipedrive Community משתמש כותב שהוא "מוכן לשלם" על אינטגרציה ל-Tripletex. [מאומת-תקציר] — [Pipedrive Community](https://community.pipedrive.com/discussion/8100/integration-with-tripletex)

### Inferences
- [הסקה] טווח ה-29–199$ לחודש שהרעיון מציע תואם את השוק. החלק העליון (199$) יידרש רק ללקוחות mid-market, והם נוטים ל-ERP (Visma.net, Business Central) ולסוכנויות.
- [הסקה] קיומם של דמי התקנה (399–4,000$) אצל המתחרים מרמז שהמוצר דורש התאמה ידנית ולא self-serve. זה סותר את "סקיילבילי למייסד יחיד".

### Gaps
- אין נתוני churn או המרה לאפליקציות האלו.

---

## שאלה 4: תלות בפלטפורמה (קריטריון 7)

### Takeaway
התלות כפולה, ולכל מערכת הנה"ח נוספת היא נכפלת שוב: HubSpot (שמרחיבה את Commerce Hub ובונה Data Syncs בעצמה) ועוד 10–15 ספקי הנה"ח, שלכל אחד מהם תנאי API, עמלות ותהליך הסמכה משלו. **קריטריון 7: FAIL.**

### Cited Findings
- **Xero:** ב-2 במרץ 2026 בוטל מודל חלוקת ההכנסות של 15% והוחלף בחמש שכבות תמחור (0–1,445$ לחודש) בתוספת egress, והוא חל על כל בסיס הלקוחות הקיים. [מאומת-תקציר, ממסמך המקור] — [Apideck](https://apideck.com/blog/xero-api-pricing-and-the-app-partner-program); [Financial Accountant](https://financialaccountant.co.uk/features/xero-api-fees-anger-developers/)
- **Fortnox:** שני מודלי תמחור לאינטגרציות. מכירה דרך Fortnox כרוכה בעמלה (השיעור לא מפורסם), ואחרי פרסום אי אפשר לשנות את המודל. [מאומת-תקציר] — [Fortnox Developer: Pricing models](https://www.fortnox.se/developer/guides-and-good-to-know/pricing-models). הרישום דורש מספר זיהוי שבדי (אישי או של חברה), וזה **חוסם ישיר למייסד ישראלי** בלי ישות שבדית. [מאומת-תקציר, ספק] — [Apideck: Fortnox API guide](https://www.apideck.com/blog/how-to-integrate-with-the-fortnox-api). הלקוח משלם ל-Fortnox כ-59 SEK לחודש להפעלת אינטגרציות. [ספק] — [Picolinie Capital](https://picoliniecapital.substack.com/p/fortnox-an-smb-s-best-friend)
- **Exact Online:** דורש "developer subscription" בתשלום. **SnelStart:** מפתח production קבוע רק אחרי הסמכה. 14 פלטפורמות הנה"ח דורשות אישור או הסמכה לפני עלייה לאוויר. [ספק] — [Apideck Accounting API Pricing Guide, checked 11 Oct 2026](https://www.apideck.com/accounting-api-pricing)
- **HubSpot:** לא גובה עמלה ולא מנהלת billing לאפליקציות בתשלום, והמפתח מנהל מנויים בעצמו. [מאומת-תקציר, פורום] — [HubSpot Community](https://community.hubspot.com/t5/APIs-Integrations/Hubspot-App-Billing-amp-Licensing/td-p/1234404). מנגד, HubSpot מתחרה ישירות: Data Sync ל-Exact ול-Sage, ו-Peppol ב-BE/DE. [מאומת-תקציר] — [exact-data-sync](https://ecosystem.hubspot.com/marketplace/listing/exact-data-sync); [HubSpot KB e-invoices](https://knowledge.hubspot.com/payment-processing/send-e-invoices-through-hubspot)
- מיפוי שדות מותאמים ב-Data Sync של HubSpot דורש Data Hub Starter. כלומר HubSpot משתמשת בסנכרון כמנוף אפסייל, ויש לה אינטרס להחזיק את הקטגוריה. [מאומת-תקציר] — [Sage Data Sync](https://ecosystem.hubspot.com/marketplace/listing/sageaccounting-data-sync)

### Inferences
- [הסקה] כל החלטה של ספק הנה"ח אחד (מקרה Xero) יכולה למחוק את כלכלת היחידה בזוג הזה. ככל שמרחיבים לעוד מערכות כדי לפתור את בעיית הגודל, מוסיפים עוד נקודות כשל.
- [הסקה] אם HubSpot תרחיב את Peppol ואת המס האוטומטי למדינות נוספות ב-2027 (במקביל לחובות e-invoicing ב-EU, כמו ViDA), חלק מהצורך "חשבונית תקנית מ-HubSpot" ייספג.

### Gaps
- שיעור העמלה של Fortnox ומחיר ה-developer subscription של Exact לא נמצאו. גם לא נמצאו תנאי ה-API של Visma e-conomic, Tripletex ו-Moneybird.

---

## שאלה 5: ערוץ הפצה (קריטריון 5)

### Takeaway
יש שני ערוצים מובנים: HubSpot Marketplace (קטגוריית Accounting) וחנויות ההנה"ח (Fortnox Integrationer, Exact App Store). אבל הערוץ כבר מאוכלס במתחרים עם ביקורות, ונפח החיפוש לכל זוג זעיר. 10 לקוחות בחודש הראשון לזוג אחד לא סבירים, כי המובילים צברו 70–160 התקנות לאורך שנים. **קריטריון 5: חלקי.**

### Cited Findings
- Fortnox מרכזת את כל האינטגרציות במרקטפלייס, ושם כבר רשומות Resultify ו-Cloudify ל-HubSpot. [מאומת-תקציר] — [Fortnox: Resultify/HubSpot](https://www.fortnox.se/integrationer/integration/resultify/hubspot); [Fortnox: Cloudify/HubSpot](https://www.fortnox.se/integrationer/integration/cloudify-aps/hubspot)
- Exact App Store מציג את KoppelHet כ"HubSpot koppeling". [מאומת-תקציר] — [Exact App Store](https://www.exact.com/app-store/hubspot-koppeling-koppelhet)
- בקשות פיצ'ר ב-HubSpot Ideas (Fortnox, Tripletex) הן מקור לידים, אבל ספקים כבר עונים בהן. [מאומת-תקציר] — [HubSpot Ideas: Tripletex](https://community.hubspot.com/t5/HubSpot-Ideas/Integrations-with-Tripletex/idi-p/429327); [HubSpot Ideas: Fortnox](https://community.hubspot.com/t5/HubSpot-Ideas/Integration-Fortnox/idi-p/446540)

### Inferences
- [הסקה] בשוק כזה, הערוץ האמיתי הוא סוכנויות HubSpot מקומיות, שמוכרות התקנה ומחזיקות את הלקוח. מייסד ישראלי בלי שפה מקומית (שבדית, הולנדית, גרמנית) ובלי ישות מקומית מתקשה לבנות את הקשרים האלה מהר.

### Gaps
- אין נתוני נפח חיפוש לכל זוג.

---

## שאלה 6: מורכבות ותחזוקה (קריטריון 8)

### Takeaway
MVP לזוג אחד (deal ← חשבונית) אפשרי בשבועיים. אבל המוצר שהלקוח משלם עליו, כלומר סנכרון נכון של מע"מ, מטבעות, תשלומים חלקיים, זיכויים, שורות פריטים, נתונים היסטוריים ו-e-invoicing, הוא בדיוק המקום שבו גם HubSpot נכשלת (2★). עומס התמיכה כבד, ומחייב ידע חשבונאי מקומי. **קריטריון 8: חלקי.**

### Cited Findings
- התלונות על האפליקציות הקיימות הן תמיד בקצוות: חשבוניות ששולמו מיובאות כ-open (Exact) [מאומת-תקציר] — [exact-data-sync](https://ecosystem.hubspot.com/marketplace/listing/exact-data-sync); אין שורות פריטים ואין הצעות מחיר (Sage) [מאומת-תקציר] — [Sage Data Sync](https://ecosystem.hubspot.com/marketplace/listing/sageaccounting-data-sync); כפילויות וחוסר תאימות למס שאינו אמריקאי (QBO) [מאומת-תקציר, ממסמך המקור] — [QBO Data Sync](https://ecosystem.hubspot.com/marketplace/listing/quickbooks-data-sync)
- המתחרים גובים דמי התקנה ומבצעים קונפיגורציה ידנית (MCB: "הצוות ייצור קשר להגדרה"). [מאומת-תקציר] — [MCB installation guide](https://www.mcb.dk/teknologier/hubspot/integration-economic/installation-guide)
- Fortnox ביטלה את אימות ה-fixed access token ב-30 באפריל 2025, כלומר יש שינויי API שכופים תחזוקה. [ספק] — [Apideck Fortnox guide](https://www.apideck.com/blog/how-to-integrate-with-the-fortnox-api)

### Inferences
- [הסקה] כל מערכת נוספת היא פרויקט אינטגרציה ותמיכה חדש, עם שפה, כללי מע"מ ותהליך הסמכה משלה. "רב-מערכתי" בשביל גודל ו"מייסד יחיד" סותרים זה את זה. מעבר לכך, unified API (Chift/Apideck) לא פותר כתיבת חשבוניות עם מע"מ מקומי ברמת הדיוק שהלקוח דורש, ומוסיף עלות.

### Gaps
- לא נבדקה איכות ה-API של כל מערכת (למשל webhooks ותמיכה בחשבוניות זיכוי).

---

## שאלה 7: פרקליט שטן (קריטריון 9) וציון סופי

### Takeaway
הטיעון נגד מנצח: **השוק כבר נוסה על ידי כמה שחקנים (כולל HubSpot עצמה ו-Cloudify הרב-מערכתי), וכולם תקועים על עשרות עד מאות התקנות.** הבעיה אינה חוסר בפתרון, אלא שהקהל זעיר ומפוצל ל-15 תתי-שווקים לשוניים ורגולטוריים. **פסק דין: FAIL.**

### Cited Findings
- (ראו בשאלות 1–2) Cloudify: Fortnox 100+, e-conomic 100+, Tripletex 70+. Exact של HubSpot: 400+. lexoffice של Pipey: 20+. DATEV של Maesn: כ-20. Commercient: פחות מ-10. [מאומת-תקציר] — [Fortnox Sync](https://ecosystem.hubspot.com/marketplace/apps/fortnox-sync-1659090); [Tripletex Sync](https://ecosystem.hubspot.com/pt/marketplace/apps/tripletex-sync-cloudify); [exact-data-sync](https://ecosystem.hubspot.com/marketplace/listing/exact-data-sync)

### Inferences
**טבלת ציון (הסקה, על בסיס הממצאים שלמעלה):**

| # | קריטריון | ציון | נימוק |
|---|---|---|---|
| 1 | משלם מזוהה | ~ חלקי | יש מחירי שוק (20–250€ לחודש, דמי התקנה, 4–12K€ לסוכנויות), אבל הקהל קטן ורובו כבר משלם למתחרה |
| 2 | תדירות | ✓ | מנוי חודשי, סנכרון שוטף |
| 3 | אין פתרון חינמי/מובנה | ✗ | אפליקציה ייעודית לכמעט כל מערכת, Data Sync של HubSpot (Exact, Sage, Zoho), אפליקציות רשמיות של ספקים (sevDesk, Pennylane), Peppol של HubSpot, Zapier/Make/Zoho Flow |
| 4 | פער מוסבר | ✗/~ | הפער הגיאוגרפי מוסבר, אבל כבר מולא. מה שנשאר הוא "איכות בינונית" ומערכות זעירות |
| 5 | ערוץ | ~ | שני מרקטפלייסים, אבל מאוכלסים ובנפח נמוך |
| 6 | גודל | ✗ | כל הקטגוריה מוערכת ב-1,000–2,000 התקנות ([הסקה]), מפוצלות ל-15 מערכות |
| 7 | תלות בפלטפורמה | ✗ | תלות ב-HubSpot וגם ב-N ספקי הנה"ח (מקרה Xero, עמלת Fortnox, מנוי Exact, דרישת ישות שבדית) |
| 8 | מתאים למייסד | ~ | MVP מהיר, אבל תמיכה, מע"מ ושפות מקומיות כבדים |
| 9 | פרקליט שטן | ✗ | שוק שנוסה ותקוע. HubSpot וספקי ההנה"ח סופגים אותו |

**ציון: 2/9 מלאים (רק 2 ו-חלקית 1/5/8). FAIL.**

- [הסקה] **אם בכל זאת רוצים "CONDITIONAL" (לא מומלץ):** ראש הגשר הטוב ביותר הוא **Moneybird (הולנד)**: אין לה אפליקציה ייעודית ל-HubSpot (רק Zapier), ה-API שלה ידוע כפתוח, והיא לא נמצאה ברשימת הפלטפורמות עם עמלות קבועות. הנעלם המכריע: **האם יש לפחות 300–500 עסקים הולנדיים שמשתמשים גם ב-HubSpot (בתוכנית עם deals/quotes) וגם ב-Moneybird?** הבדיקה הזולה ביותר: שאילתה ב-BuiltWith/TheirStack על החיתוך HubSpot∩Moneybird, ופוסט ב-HubSpot Community הולנדית או בקבוצות LinkedIn של סוכנויות HubSpot בהולנד, עם דף נחיתה ורשימת המתנה ל-14 יום. פחות מ-20 נרשמים = מוות סופי. **אזהרה:** Tripletex (150K לקוחות), שנראה מועמד טבעי, כבר תפוס על ידי Cloudify, ו-Fortnox דורשת ישות שבדית.
- [הסקה] **לקח לרשימת הלקחים:** "אפליקציה של הפלטפורמה עם דירוג נמוך" (לקח מסמך המקור) אינה מספיקה. צריך לבדוק גם את **מספר ההתקנות של המתחרים הקטנים בנישה**. כשכולם, כולל הפלטפורמה, תקועים על עשרות עד מאות התקנות לאורך שנים, זו תקרת ביקוש ולא פער.

### Gaps
- לא אומת ישירות (בגלל DNS) מספר ההתקנות המדויק או תאריכי העדכון של אף listing.
- לא נבדק החיתוך בפועל HubSpot∩Moneybird. זה הנתון היחיד שיכול להחזיר את הרעיון לחיים, בצורה מצומצמת מאוד.
