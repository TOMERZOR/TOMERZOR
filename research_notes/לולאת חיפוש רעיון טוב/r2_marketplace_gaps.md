# עדשה: "פערים בחנויות אפליקציות עם הפצה מובנית, גלובלי" (סבב r2)

> חוקר: עדשת פערים בחנויות אפליקציות (Shopify, HubSpot, Atlassian, monday.com, Zendesk, Webflow, Google Workspace, Xero). תאריך: 2026-10-24.
> **הערה מתודולוגית חשובה:** כ-37 קריאות כלים. כל ניסיונות ה-fetch לאתרי הפלטפורמות עצמן נכשלו ב-DNS: apps.shopify.com, community.shopify.com, ecosystem.hubspot.com, community.monday.com, community.developer.atlassian.com, us.seibert.group. לכן **כל הממצאים מבוססים על תקצירי מנוע החיפוש של העמודים המצוטטים, ואף עמוד לא נקרא במלואו.** סימון בכל שורה:
> - **[מאומת-תקציר]**: הנתון מופיע בתקציר החיפוש של העמוד המצוטט (דירוג, מספר ביקורות, תאריך וכו').
> - **[ספק]**: הנתון מגיע מבלוג של ספק עם אינטרס מסחרי, או ממקור משני.
> - **[הסקה]**: מסקנה שלי, לא ממקור.
>
> **שורה תחתונה מראש:** אף מועמד לא עובר את כל 9 הקריטריונים. העדשה סובלת מסתירה מובנית: חנות האפליקציות פותרת את קריטריון 5 (הפצה) **בדיוק על חשבון** קריטריון 7 (תלות בפלטפורמה), ובשנה האחרונה ראינו שלוש פלטפורמות שספגו או שינו כללים: Shopify (B2B לכל התוכניות, Stocky), Xero (מודל עמלות חדש) ו-Atlassian (סוף Connect וסוף Data Center). המועמד הטוב ביותר מגיע ל-6/9: סנכרון "הזמנה עד גבייה" (order-to-cash) בין HubSpot למערכות הנהלת חשבונות אזוריות ולא-אמריקאיות.

---

## שאלה 1: אילו קטגוריות מראות ביקוש גבוה לצד אי-שביעות רצון (דירוג נמוך, אפליקציות נטושות, בקשות חוזרות)? (קטלוג המועמדים עם בדיקת הריגה)

### Takeaway
הסימנים החזקים ביותר לאי-שביעות רצון נמצאו דווקא **באפליקציות שהפלטפורמה עצמה בנתה**: HubSpot QuickBooks Data Sync (2.1★, כ-100 דירוגים) ו-HubSpot Xero Data Sync (2.2★, כ-5–6 אלף התקנות), ו-Shopify Marketplace Connect (4.1★ אבל עם תלונות eBay טריות). שאר הקטגוריות שנבדקו נמצאות באחד משני מצבים: הפלטפורמה כבר ספגה את היכולת (B2B ב-Shopify, Quotes & Invoices ב-monday), או שמתחרים מילאו את הפער מהר אחרי אירוע נטישה (Stocky, Webflow User Accounts, Zendesk Sell).

### Cited Findings

#### מועמד 1: סנכרון order-to-cash בין HubSpot למערכות הנה"ח לא-אמריקאיות/אזוריות (QuickBooks מחוץ לארה"ב, Xero, Fortnox, e-conomic, Exact Online, Moneybird ועוד)
- **דירוג ה-QuickBooks Data Sync של HubSpot:** 2.1 מתוך 5 על סמך 101 דירוגים. דלי הכוכב האחד הגדול ביותר (41%). בצילום מאוחר יותר: 106 דירוגים, 42% כוכב אחד ו-32% שני כוכבים. [מאומת-תקציר] — [HubSpot Ecosystem: QuickBooks Data Sync](https://ecosystem.hubspot.com/marketplace/listing/quickbooks-data-sync)
- תקציר ה-AI של הדף עצמו מציין תלונות על כפילויות רשומות, שגיאות מיפוי נתוני B2B ו**חוסר תאימות לדרישות מס שאינן אמריקאיות**. ביקורת של 3 כוכבים: חשבוניות מסתנכרנות מ-HubSpot ל-QuickBooks רק אם הן שולמו, ורק בתאריך ושעה מסוימים. ביקורת של כוכב אחד: לא ניתן לסנכרן נתונים היסטוריים. [מאומת-תקציר] — [HubSpot Ecosystem: QuickBooks Data Sync](https://ecosystem.hubspot.com/marketplace/apps/quickbooks-data-sync)
- הדף עצמו מציין מגבלת API: QuickBooks Online תומך בעד 3 שדות מותאמים, ורק בחשבוניות. [מאומת-תקציר] — [same](https://ecosystem.hubspot.com/marketplace/listing/quickbooks-data-sync)
- **Xero Data Sync של HubSpot:** כ-6 אלף התקנות ודירוג 2.2 מ-40 ביקורות (בצילום אחר: כ-5 אלף התקנות, 2.4 מ-34 ביקורות; בצילום שלישי: 2.2 מ-44). ביקורת כוכב אחד טרייה: חשבוניות שנוצרו ב-HubSpot לא הסתנכרנו ל-Xero. הצעות מחיר (quotes) לא מסתנכרנות. מיפוי שדות מותאמים דורש Operations Hub Starter ומעלה. [מאומת-תקציר] — [HubSpot Ecosystem: Xero Data Sync](https://ecosystem.hubspot.com/marketplace/listing/xero-data-sync)
- מרכז העזרה של HubSpot: האינטגרציה המובנית מסנכרנת אנשי קשר, מוצרים וחשבוניות, ויש עריכות שלא ניתן לבצע ב-QuickBooks לחשבוניות שנוצרו ב-HubSpot. [מאומת-תקציר] — [HubSpot Knowledge Base](https://knowledge.hubspot.com/integrations/connect-hubspot-and-quickbooks-online?app=wp)
- משתמש בקהילת HubSpot: האפליקציה המובנית "לא מבטלת חלק מהשלבים ולא חלק מנקודות ההזנה הכפולה", ומשתמש אחר בוחן את SyncQ כחלופה. [מאומת-תקציר] — [HubSpot Community](https://community.hubspot.com/t5/Sales-Integrations/Seeking-the-Best-Quickbooks-Online-Integration-with-HS/m-p/398945/highlight/true)
- מדריך יועצים: חלופות היום הן CData Sync, Workato או API מותאם (דורשים מומחיות), או Zapier/Make לעסקים קטנים. [ספק] — [MPIRE Solutions](https://mpiresolutions.com/blog/does-hubspot-integrate-with-quickbooks/)
- **מערכות אזוריות:** Fortnox (שבדיה) מול HubSpot: אפליקציה של Resultify בתוכנית מלאה ב-399 SEK לחודש, ונדרשת גם רכישה ב-Fortnox marketplace. יש לה ביקורת אחת בלבד. אפליקציה נוספת של Cloudify עם 100+ התקנות ובלי ביקורות. Visma e-conomic (Cloudify): 100+ התקנות ובלי ביקורות. Exact Online לא הופיע בתוצאות כלל. [מאומת-תקציר] — [HubSpot: Fortnox by Resultify](https://ecosystem.hubspot.com/marketplace/apps/fortnox-by-resultify-1552654); [HubSpot accounting category](https://ecosystem.hubspot.com/marketplace/apps/accounting)
- סוכנות HubSpot (SpotDev) כותבת מדריך "order-to-cash" מ-deals לחשבוניות על פני Xero, QuickBooks, Sage ו-NetSuite. כלומר סוכנויות גובות כסף על הבעיה הזו. [ספק] — [SpotDev](https://www.spotdev.co.uk/blog/sync-hubspot-deals-to-invoices-accounting)
- **אנלוגיה שמוכיחה תשלום בקטגוריה:** ב-Shopify, אפליקציית Reconcilely (סנכרון ל-Xero ו-QuickBooks) גובה 9–99$ לחודש, עם 4.7★ מ-65 ביקורות. [מאומת-תקציר] — [Shopify App Store: Reconcilely](https://apps.shopify.com/reconcilely)
- **סיכון Xero:** ב-2 במרץ 2026 Xero ביטלה את מודל חלוקת ההכנסות של 15% והחליפה אותו בחמש שכבות תמחור לפי ארגונים מחוברים ותעבורת נתונים, מ-0$ ועד 1,445$ לחודש, בתוספת חיוב על egress (2.40 AUD לכל GB נוסף). העמלות חלות על כל בסיס הלקוחות הקיים, ולא רק על לקוחות חדשים. [מאומת-תקציר] — [Apideck](https://apideck.com/blog/xero-api-pricing-and-the-app-partner-program); [Accountants Daily](https://www.accountantsdaily.com.au/technology/21986-all-you-can-eat-xero-data-buffet-comes-to-abrupt-end); [Financial Accountant](https://financialaccountant.co.uk/features/xero-api-fees-anger-developers/)
- **בדיקת הריגה מהירה:**
  1. משלם קיים ✓ (סוכנויות, Workato/CData, Resultify ב-399 SEK לחודש, Reconcilely ב-Shopify)
  2. תדירות ✓ (סנכרון רציף, חיוב חודשי)
  3. אין פתרון חינמי/מובנה ~ (יש אינטגרציה חינמית של HubSpot, אבל מדורגת 2.1–2.4; Zapier/Make הם עוקף חלקי)
  4. פער מוסבר ✓ (HubSpot בונה רק ל-QBO ו-Xero ובדגש אמריקאי; מערכות אזוריות קטנות מדי עבור HubSpot, ומפתחים מקומיים בונים אפליקציה למערכת אחת)
  5. הפצה ✓ (קטגוריית Accounting ב-HubSpot Marketplace, וגם חנות האפליקציות של מערכת הנה"ח, כלומר שני ערוצים)
  6. גודל ~ (לא נמצא נתון על מספר לקוחות HubSpot לכל מערכת אזורית; [הסקה] כנראה אלפים בודדים לכל זוג, כלומר צריך כמה זוגות)
  7. תלות בפלטפורמה ✗/~ (תלות כפולה ב-HubSpot וגם במערכת הנה"ח; מקרה Xero מראה שמערכת הנה"ח יכולה לשנות את כלכלת ה-API בבת אחת)
  8. התאמה למייסד ✓ (MVP לזוג אחד, למשל HubSpot↔Exact או HubSpot↔Moneybird, בשבועיים)
  9. פרקליט שטן ~ (הטיעון נגד: iPaaS כלליים, סוכנויות HubSpot מקומיות, ושיפור של האינטגרציה המובנית)
- **ציון: 6/9** (3, 6 ו-7 חלקיים)

#### מועמד 2: בניית גרסאות Cloud (Forge) לאפליקציות Atlassian שקיימות רק ב-Data Center
- סוף החיים של Atlassian Data Center נקבע ל-28 במרץ 2029, ובתאריך זה פגים גם מנויי Marketplace הנלווים. מ-30 במרץ 2026 לקוחות חדשים לא יכולים לקנות DC. מ-30 במרץ 2028 גם לקוחות קיימים לא יכולים לקנות רישיונות או הרחבות. [מאומת-תקציר] — [Atlassian Cloud Migration](https://www.atlassian.com/cloud-migration); [Easy Agile DC EOL guide](https://www.easyagile.com/blog/atlassian-data-centre-eol-app-guide)
- מדריכי הגירה מציינים שחלק מהאפליקציות נבנו ספציפית ל-Server/DC ולא הועברו ל-Cloud מעולם, וממליצים למיין כל אפליקציה ל"זמינה ב-Cloud / יש חלופה / לא נמצא מקבילה". כלי ההגירה של Atlassian יכול להציג "no Cloud equivalent". [מאומת-תקציר] — [Atlassian Community: check app compatibility](https://community.atlassian.com/forums/discussion/1737338/how-to-guide-check-jira-app-compatibility-before-cloud-migration); [Seibert: custom development no cloud version](https://us.seibert.group/blog/jira-custom-development-no-cloud-version)
- ספקי אפליקציות (Calendar for Jira, Elements, Custom Content for Jira) מתעדים מסלולי הגירה מוגבלים או כאלה שעדיין בפיתוח. [מאומת-תקציר] — [Elements docs](https://doc.elements-apps.com/overview/migrating-from-server-dc); [Custom Content limitations](https://documentation.appsbytng.com/custom-content-for-jira/latest/Cloud/limitations)
- **Connect:** אפליקציות Connect חדשות נחסמו ב-Marketplace מ-17 בספטמבר 2025, ומאז מרץ 2026 אפליקציות עם Connect descriptor לא יכולות להתעדכן. סוף התמיכה הוארך ל-31 בינואר 2027. [מאומת-תקציר] — [Atlassian: Connect EOS timeline](https://www.atlassian.com/blog/developer/announcing-connect-end-of-support-timeline-and-next-steps); [Connect EOS extended](https://community.developer.atlassian.com/t/connect-end-of-support-extended-to-january-31-2027/102002)
- **נגד:** Atlassian מדווחת שיותר מ-95% ממושבי האפליקציות בתשלום כבר הועברו ל-Forge. כלומר זווית "אפליקציות Connect נטושות" כמעט נסגרה. [מאומת-תקציר] — [Atlassian: getting ready for Connect EOS](https://www.atlassian.com/blog/development/getting-ready-for-connect-end-of-support)
- **כלכלה:** אפליקציות Runs on Atlassian שומרות 100% מההכנסה עד מיליון דולר מצטבר ברמת השותף (הודעה מ-2025, יש לוודא שעדיין בתוקף). Atlassian מדווחת על יותר מ-5,600 אפליקציות ייחודיות ועל 1.5 מיליארד דולר בתשלומים למפתחים. [מאומת-תקציר] — [Atlassian: Runs on Atlassian 100% revenue](https://www.atlassian.com/blog/developer/runs-on-atlassian-apps-can-now-take-home-100-of-marketplace-revenue)
- **אזהרות הפצה:** מפתח יחיד דיווח על 4 התקנות ו-0 ביקורות אחרי 11 יום עם אפליקציית Gantt חינמית, והסיק שפוסטים בלינקדאין כמעט לא הביאו התקנות. בנוסף, לא ברור אם יחיד בלי חברה רשומה יכול למכור אפליקציות בתשלום: התיעוד הציבורי סותר את עצמו. [מאומת-תקציר] — [Atlassian dev community: first Forge app lessons](https://community.developer.atlassian.com/t/just-shipped-my-first-forge-app-10-lessons-after-11-days-on-the-marketplace/100742); [Turkey sole proprietor thread](https://community.developer.atlassian.com/t/can-an-individual-sole-proprietor-based-in-turkey-publish-and-sell-paid-marketplace-apps/102081)
- **בדיקת הריגה מהירה:** 1 ✓ (הלקוח כבר משלם על אפליקציית ה-DC) | 2 ✓ (מנוי) | 3 ✓ אם באמת אין מקבילה ב-Cloud (לא אומת לאף אפליקציה ספציפית) | 4 ✓ (הספק המקורי לא העביר בגלל מגבלות Forge או כלכלה) | 5 ~ (Marketplace ושותפי הגירה, אבל התחלה קרה, ראו 4 התקנות ב-11 יום) | 6 ✗/~ (כל אפליקציה כזו היא נישה של מאות עד אלפים בודדים של לקוחות; [הסקה]) | 7 ✗ (תלות מוחלטת ב-Atlassian, שבשנתיים האחרונות שינתה את Connect וגם את DC) | 8 ✓ | 9 ~ (הספק המקורי עלול להעביר בעצמו ברגע שתוכח דרישה)
- **ציון: 5/9.** תנאי לבדיקה עמוקה: סריקה שיטתית של אפליקציות DC עם הרבה התקנות ובלי listing ב-Cloud. הסריקה הזו לא בוצעה כי ה-Marketplace לא נטען.

#### מועמד 3: חשבוניות אלקטרוניות רב-מדינתיות ל-B2B ב-EU עבור סוחרי Shopify/WooCommerce
- בלגיה: חובת e-invoicing ב-B2B מקומי מ-1 בינואר 2026 (Peppol BIS 3.0). Sufio תומכת ב-Peppol לסוחרי Shopify בבלגיה מ-18 בדצמבר 2025. Invocourier: מ-19$ לחודש, Peppol, XRechnung ו-Factur-X, ובלי ביקורות. CommBilling: 4.9★ מ-419 ביקורות, עם פיצ'ר Peppol. [מאומת-תקציר] — [Sufio news](https://sufio.com/news/einvoicing-peppol-belgium-shopify/); [Invocourier](https://apps.shopify.com/invocourier); [CommBilling](https://apps.shopify.com/commbilling)
- שרשור בקהילת Shopify (2026) טוען שאין עדיין אפליקציה נייטיבית מקצה לקצה, ומציין פערים: איסוף מספר מע"מ/חברה בקופה, זיכויים ותיקונים, ופורמטים שונים בכל מדינה. זו דעה של משתמש בודד. [מאומת-תקציר] — [Shopify Community: Mandatory e-invoicing](https://community.shopify.com/t/mandatory-e-invoicing/410748)
- **פתרון חינמי בבלגיה:** פלטפורמת Hermes הממשלתית נסגרה ב-31 בדצמבר 2025, אבל עמותה מלימבורג השיקה את Let's Peppol, תיבת Peppol חינמית וללא הגבלה לעסקים קטנים. [ספק] (Banqup הוא מתחרה) — [Banqup](https://www.banqup.com/en-be/resources/blog/belgium-retires-the-hermes-platform-why-your-e-invoicing-strategy-must-change-before-2026); [ITdaily](https://itdaily.com/blogs/software/peppol-smes-time-savings/)
- פולין (KSeF): חובה לגדולים מ-1 בפברואר 2026 ולקטנים ובינוניים מ-1 באפריל 2026; קנסות מ-1 בינואר 2027. ב-WooCommerce כבר יש FakturFlow (ליבה חינמית ו-Pro בתשלום), תוסף KSeF ל-Flexible Invoices, ByteWave ו-B2Brouter. ב-Shopify בדרך כלל מחברים מערכת חשבוניות פולנית. [מאומת-תקציר] — [WordPress.org KSeF tag](https://cn.wordpress.org/plugins/tags/ksef/); [Kluczesoft](https://kluczesoft.pl/ksef-a-sklep-internetowy-allegro-shopify-prestashop-integracja-2026.htm)
- גרמניה: קבלה חובה מ-2025; הנפקה חובה מ-2027 למחזור מעל 800 אלף אירו ומ-2028 לכולם. רק B2B מקומי, בפורמט XRechnung/ZUGFeRD. [ספק] — [ClearTax DE](https://www.cleartax.com/de/en/e-invoicing-germany)
- צרפת: מ-1 בספטמבר 2026 כולם חייבים לקבל, וגדולים ובינוניים גם להנפיק; SME ומיקרו מ-1 בספטמבר 2027 (ייתכן דחייה ל-1 בדצמבר 2026 ול-1 בדצמבר 2027). מוכר שאינו מבוסס בצרפת מחוץ לחובת ה-B2B המקומית. [מאומת-תקציר] — [EY](https://www.ey.com/en_gl/technical/tax-alerts/france-revises-schedule-for-adopting-e-invoicing-reform); [Faire support](https://www.faire.com/support/articles/55178358487195)
- **בדיקת הריגה מהירה:** 1 ✓ (Sufio ו-Invocourier גובים כסף) | 2 ✓ | 3 ✗/~ (מערכות הנה"ח המקומיות, כמו Fakturownia או מערכות בלגיות, כבר מחוברות ל-Peppol/KSeF; Let's Peppol חינמי) | 4 ~ (פיצול בין מדינות מסביר את הפער, אבל Sufio כבר מכסה אותו) | 5 ✓ (Shopify App Store) | 6 ~ (רק סוחרים שמוכרים B2B מקומי ב-EU; רוב סוחרי Shopify הם B2C [הסקה]) | 7 ~ (Shopify, ספק Access Point וכללים של כל מדינה) | 8 ~ (רגולציה כבדה ורב-מדינתית; לא MVP של שבועיים) | 9 ✗ (Sufio, CommBilling ומערכות הנה"ח)
- **ציון: 4/9**

#### מועמד 4: חלופה ל-Shopify Marketplace Connect בדגש על אמינות סנכרון eBay
- 4.1–4.3★ על כ-1,900–2,127 ביקורות, ו-13%–15% כוכב אחד. תלונות מאוגוסט 2026: מלאי לא מתעדכן ב-eBay (סיכון למכירת יתר), תמונות לא מסתנכרנות, "לא אמין להפעלת חנות eBay". במרץ 2026: מחירים ומלאי שגויים ב-eBay, וריאציות כפולות וכמויות שמתאפסות ל-100. [מאומת-תקציר] — [Shopify Marketplace Connect reviews](https://apps.shopify.com/marketplace-connect/reviews)
- **בדיקת הריגה:** האפליקציה של Shopify חינמית בבסיס, ולכן 3 ✗. הקטגוריה רוויה (LitCommerce, CedCommerce ואחרים; [הסקה] לא אומת בחיפוש הזה). 7 ✗ (תלות ב-eBay וגם ב-Shopify). **ציון: 3/9 — נפסל.**

#### מועמד 5: תחליף ל-Stocky (הזמנות רכש, ספירות מלאי ותחזיות לסוחרי POS)
- Stocky הוסרה מה-App Store ב-2 בפברואר 2026 ונסגרה ב-31 באוגוסט 2026. תחזית min/max והעברות הוסרו כבר ביולי 2025. כלי ה-PO המובנים ב-Admin "חסרים נתוני עלות והתראות הזמנה מחדש" (לפי ציטוט פורום אצל ספק). [מאומת-תקציר]/[ספק] — [Ordoro](https://blog.ordoro.com/2026/02/25/shopify-sunsetting-stocky-2026/); [Finaloop](https://www.finaloop.com/blog/stocky-discontinued-in-2026-what-shopify-merchants-should-do); [Shopify Community thread](https://community.shopify.com/t/removing-stocky-is-a-material-retail-operations-risk/589102)
- כבר יש מתחרים רבים: Stockful, Stockroom (חינמי, כולל PO, ספירות ו-landed cost), Prediko, Finaloop InventoryIQ, Starshipit ו-Ordoro. [ספק] — [Charle Agency](https://www.charleagency.com/articles/best-alternatives-to-shopify-stocky/); [MyWorks](https://myworks.software/blog/stocky-discontinued.md)
- **בדיקת הריגה:** מועד הסגירה כבר עבר וגל ההגירה נקלט; יש חלופה חינמית (Stockroom) וגם פיצ'ר מובנה. 3 ✗, 4 ✗, 9 ✗. **ציון: 3/9 — נפסל.**

#### מועמד 6: B2B/סיטונאות לסוחרי Shopify שאינם Plus
- מ-2 באפריל 2026 פיצ'רי B2B (פרופילי חברה, קטלוגים, תמחור כמותי, תנאי תשלום Net 7–90) זמינים ב-Basic, Grow ו-Advanced בלי עלות נוספת, עם מגבלה של 3 קטלוגים פעילים. טפסי הרשמה, משלוח לפי שכבה ונעילת תוכן עדיין דורשים אפליקציה. [ספק] — [Wholesale Helper](https://wholesalehelper.io/blog/shopify-b2b-on-all-plans/); [Magebit](https://magebit.com/blog/shopify-b2b-on-every-plan-what-no-one-tells-you-about-costs-limits-scale)
- ב-Summer '26 Edition נוספו ל-B2B גם net terms ו-multi-currency payouts. [ספק] — [EasySell](https://easysellapp.com/blogs/wiki/shopify-summer-2026-edition-updates-that-matter)
- **בדיקת הריגה:** ספיגה פעילה בידי הפלטפורמה וקטגוריה רוויה. **ציון: 2/9 — נפסל.**

#### מועמד 7: תחליף ל-Webflow User Accounts (Memberships)
- Webflow סגרה את User Accounts (לפי ספק, ב-29 בינואר 2026), ו-Webflow עצמה ממליצה על Memberstack כ"שיטה העיקרית". Outseta ב-30$ לחודש בערך, ובנוסף Foxy ו-Assembly. [מאומת-תקציר] — [Webflow Wishlist](https://wishlist.webflow.com/ideas/WEBFLOW-I-33494); [Assembly](https://assembly.com/blog/webflow-user-accounts-alternative); [PandaCodeGen](https://www.pandacodegen.com/blog/webflow-user-accounts-sunset-date-2026)
- **בדיקת הריגה:** יש מנצח ש-Webflow עצמה ממליצה עליו. **ציון: 2/9 — נפסל.**

#### מועמד 8: הצעות מחיר, חשבוניות והפקת מסמכים ב-monday.com (כולל זווית ישראלית)
- ל-monday יש אפליקציית Quotes & Invoices מובנית. בשוק פועלים גם DocuGen, PandaDoc (20,000+ לקוחות, לפי הספק), PDF Maker, eQuotes (freemium, 10 הצעות בחודש), Eledo ו-Paysaro. [מאומת-תקציר]/[ספק] — [monday support](https://support.monday.com/hc/en-us/articles/360019033299/comments/11701526288402); [DocuGen](https://docugen.io/); [eQuotes](https://developer-community.monday.com/share-your-app-6/quoting-invoicing-have-never-been-easier-try-equotes-by-eligeo-4649)
- **בדיקת הריגה:** ספוג ורווי. הזווית הישראלית (חיבור ל-Morning/חשבונית ירוקה או iCount) היא נישה מקומית קטנה, בדיוק מה שהלקח של סבב 1 פוסל. **ציון: 3/9 — נפסל.**

#### מועמד 9: CRM בתוך Zendesk ל"פליטי" Zendesk Sell
- Zendesk Sell מגיע לסוף חייו ב-31 באוגוסט 2027 (לפי מקורות משניים). לפי מקור משני יחיד, Pipedrive הוא שותף ההגירה הרשמי. Copper, Nutshell, Zoho ו-Rework כבר מפרסמים מדריכי "חלופות ל-Zendesk Sell". [ספק] — [Zoho community](https://help.zoho.com/portal/en/community/topic/important-update-zendesk-sell-announced-end-of-life?page=1); [eesel](https://www.eesel.ai/blog/zendesk-saas-deprecation); [Copper](https://www.copper.com/resources/zendesk-sell-alternative)
- **בדיקת הריגה:** מתחרים ממומנים כבר נלחמים על הגירה חד-פעמית, ויש שותף רשמי. 4 ✗, 9 ✗. **ציון: 3/9 — נפסל.**

#### מועמד 10: אנשי קשר משותפים ב-Google Workspace (Shared Contacts)
- פער ותיק: לגוגל אין שיתוף אנשי קשר נוח לצוות, ובגלל זה יש מספר אפליקציות בתשלום. Shared Contacts Manager: 20$ לשנה ליחיד או 100$ לשנה לדומיין (מינואר 2023). SharedContacts.com: 2–3$ למשתמש לחודש. Shared Contacts for Gmail: 2.49$ למשתמש לחודש, עם 97 ביקורות ב-Capterra. ביקורת מינואר 2026 על אפליקציה מתחרה: "שכפלה את כל אנשי הקשר שלי". [מאומת-תקציר] — [Workspace Marketplace: Shared Contacts Manager](https://workspace.google.com/marketplace/app/shared_contacts_manager_for_g_suite/176603020899); [SharedContacts.com](https://workspace.google.com/marketplace/app/sharedcontactscom_contactos_compartidos/211122818894); [Capterra](https://www.capterra.com/p/162216/Shared-Contacts-for-Gmail/); [Share Google Contacts listing](https://workspace.google.com/marketplace/app/share_google_contacts_with_shared_contac/452164027617)
- **בדיקת הריגה:** 1 ✓, 2 ✓, 3 ~, 4 ✗ (כבר יש 4+ אפליקציות), 5 ✓, 6 ✓, 7 ✗ (אימות אבטחה של גוגל ו-CASA; גוגל יכולה לבנות את זה), 8 ✓, 9 ✗ (ARPU נמוך מאוד ותחרות מחירים). **ציון: 4/9 — חלש.**

#### (נבדק בקצרה ונפסל) נגישות EAA לחנויות Shopify
- ה-EAA נאכף מ-28 ביוני 2025 על חנויות שמוכרות לצרכנים ב-EU, ומיקרו-עסקים פטורים. הקטגוריה מלאה בספקים (TestParty, Fudge, Appify ועוד) שכותבים את רוב התוכן, ותוספי overlay שנויים במחלוקת. לא נמצאו נתוני אכיפה. [ספק] — [Fudge](https://www.fudge.ai/blog/european-accessibility-act-shopify/); [TestParty](https://testparty.ai/blog/european-accessibility-act-shopify)
- **ציון: 3/9 — נפסל** (רווי, ובלי פער מוסבר).

### Inferences
- [הסקה] הדפוס החוזר: **אפליקציה שהפלטפורמה בנתה בעצמה ומדורגת נמוך** (HubSpot QBO/Xero) היא אות טוב יותר מאפליקציה נטושה של צד שלישי. הסיבה: הפלטפורמה "מחזיקה" את הקטגוריה ולכן מתחרים ממומנים לא נכנסים אליה בכוח, אבל גם לא משקיעה בה (מספר כוכבים נמוך לאורך זמן).
- [הסקה] אירועי נטישה (Stocky, Webflow Memberships, Zendesk Sell, Connect) נסגרים מהר מאוד: תוך חודשים יש 5+ חלופות ומדריכי "best alternatives". עד שמייסד יחיד בונה, החלון נסגר. המסקנה היא לא לרדוף אחרי sunsets שכבר הוכרזו.
- [הסקה] בחלק ה-HubSpot, הפער הגיאוגרפי (מערכות הנה"ח אירופיות ואזוריות) עונה על לקח 3 של סבב 1: שוק גלובלי עם סיבה מבנית שהגדולים לא נכנסים. HubSpot לא תבנה אינטגרציה ל-Moneybird, והתמריץ של Moneybird לבנות ל-HubSpot חלש.

### Gaps
- לא הצלחתי לטעון את דפי החנויות עצמם (DNS), ולכן אין תאריכי "last updated", ספירות התקנות מדויקות או ציטוטים מלאים. צריך לאמת ידנית בדפדפן.
- לא נמצא נתון על מספר לקוחות HubSpot לפי מערכת הנה"ח או מדינה, וזה קריטי לקריטריון 6 של מועמד 1.
- לא נמצאה רשימה של אפליקציות Atlassian DC פופולריות בלי גרסת Cloud. נדרשת סריקה ידנית של ה-Marketplace.
- לא בוצעה סריקה של Wix App Market, Squarespace, Canva, Figma, Notion ו-Airtable. [הסקה] בחלקן (Figma, Canva, Notion) המונטיזציה דרך החנות חלשה או לא קיימת, ולכן הן פחות רלוונטיות לעדשה.

---

## שאלה 2: כמה מרוויחות אפליקציות בקטגוריות האלה? האם צוות קטן יכול להגיע ל-10K$+ MRR?

### Takeaway
כן, אבל הראיות הן בעיקר דיווח עצמי. ב-Shopify יש עדויות רבות לצוותים של 1–2 אנשים ב-25K$ עד 100K$+ MRR. ב-monday.com יש מקרה אחד שהפלטפורמה עצמה מפרסמת (30K$ MRR). ב-Atlassian יש נתוני מקרו (1.5 מיליארד דולר בתשלומים) אבל אין מספרי MRR של מפתחים יחידים. לא נמצאו נתוני הכנסה לאפליקציות סנכרון HubSpot↔הנה"ח.

### Cited Findings
- Shopify: 0% עמלה על המיליון הראשון של הכנסה ברוטו מאפליקציה (מצטבר לכל החיים) ו-15% מעליו; טווח "אמצעי מוצק" של 2K$ עד 20K$ MRR, עם התפלגות power law. [ספק] — [AdsX](https://adsx.com/blog/how-much-shopify-app-developers-make)
- מייסד Kaching Appz מתאר תיק אפליקציות Shopify עם MRR של שש ספרות וצוות ליבה של שני אנשים. [מאומת-תקציר, דיווח עצמי] — [Indie Hackers](https://www.indiehackers.com/post/qdReVAgLjz6EpW4OrJSI)
- אפליקציית WhatsApp chat button ב-Shopify: מעל 25K$ MRR עם שני אנשים (פוסט מ-2020, ישן). [מאומת-תקציר] — [Indie Hackers](https://www.indiehackers.com/product/whatsapp-chat-button/25-000-mrr--MBOpbU8jmM4hu0Nqgm2)
- Reconcilely (Shopify ל-Xero/QBO): תמחור 9–99$ לחודש, 4.7★ מ-65 ביקורות. זו הוכחה שקטגוריית "סנכרון להנה"ח" גובה כסף בחנות. [מאומת-תקציר] — [Shopify App Store](https://apps.shopify.com/reconcilely)
- monday.com: חלוקת הכנסות של 85/15 מתחילה רק אחרי 200K$ הכנסה מצטברת לאפליקציה (מספטמבר 2024). [מאומת-תקציר] — [monday developer changelog](https://developer.monday.com/apps/changelog/announcing-the-revshare-program)
- monday.com: 1.6 מיליון התקנות מה-Marketplace, ו-87% מחשבונות האנטרפרייז התקינו לפחות אפליקציה אחת (נתון עצמי). Pioneera מתוארת כמי שהגיעה ל-30K$ MRR (מקרה שיווקי). [ספק] — [monday app developers](https://monday.com/appsdeveloper)
- [הסקה] 1.6 מיליון התקנות מצטברות ב-monday הוא מספר קטן בסדרי גודל מ-Shopify, ולכן ההפצה ב-monday חלשה יותר. היתרון "הישראלי" של monday לא מתורגם לביקוש.
- Atlassian: יותר מ-5,600 אפליקציות ו-1.5 מיליארד דולר בתשלומים למפתחים; 100% הכנסה עד מיליון דולר מצטבר (Forge). [מאומת-תקציר] — [Atlassian blog](https://www.atlassian.com/blog/developer/runs-on-atlassian-apps-can-now-take-home-100-of-marketplace-revenue)
- Fortnox↔HubSpot (Resultify): 399 SEK לחודש לתוכנית מלאה. [מאומת-תקציר] — [HubSpot Ecosystem](https://ecosystem.hubspot.com/marketplace/apps/fortnox-by-resultify-1552654)
- הממוצע הכללי של indie hackers: חציון מתחת ל-1K$ MRR, ומעל 10K$ זה בערך הטופ 15%. [ספק] — [MEAN CEO](https://blog.mean.ceo/?p=11175)

### Inferences
- [הסקה] אפליקציה שגובה 50–100$ לחודש (טיפוסי לסנכרון B2B) צריכה 100–200 לקוחות כדי להגיע ל-10K$ MRR. זה סביר ב-HubSpot, שבה הלקוחות הם עסקים שכבר משלמים מאות דולרים בחודש על HubSpot.

### Gaps
- לא נמצאו נתוני StoreLeads או הערכות הכנסה לפי קטגוריה ב-Shopify, ולא נתוני הכנסה של אפליקציות HubSpot.
- אין נתוני MRR מאומתים של מפתחים יחידים ב-Atlassian או ב-monday.

---

## שאלה 3: מה סיכון הספיגה והשינוי מצד הפלטפורמה (קריטריון 7)?

### Takeaway
גבוה מאוד ב-Shopify ובולט בשנה האחרונה גם אצל Xero ו-Atlassian. ב-HubSpot הסיכון בינוני: HubSpot כבר בנתה את האינטגרציות לגדולים (QBO, Xero) ולא שיפרה אותן לאורך זמן, אבל בפועל מתנהלת כ"ספקית אינטגרציות" רק לשווקים הגדולים.

### Cited Findings
- Shopify Summer '26: פרוטוקול UCP לסוכני AI (פועל כברירת מחדל), Sidekick שמבצע משימות, "יכולות שפעם דרשו אפליקציות בתשלום מגיעות עכשיו מובנות", POS v10 ו-B2B עם net terms. [ספק] — [EasySell](https://easysellapp.com/blogs/wiki/shopify-summer-2026-edition-updates-that-matter); [Shopappy](https://shopappy.com/ecommerce/shopify-editions-summer-26-what-shopify-actually-announced); [Flatline](https://www.flatlineagency.com/blog/what-shopify-summer-26-editions-actually-changes-for-plus-brands-and-whats-just-recycled/)
- Shopify הוסיפה B2B לכל התוכניות מ-2 באפריל 2026 וסגרה את Stocky (אפליקציה שלה) ב-31 באוגוסט 2026. [ספק] — [Wholesale Helper](https://wholesalehelper.io/blog/shopify-b2b-on-all-plans/); [Ordoro](https://blog.ordoro.com/2026/02/25/shopify-sunsetting-stocky-2026/)
- Xero ביטלה את חלוקת ההכנסות של 15% והעבירה לתמחור לפי שכבות עד 1,445$ לחודש, על כל בסיס הלקוחות. חיוב דרך XASS מסתיים ב-30 ביוני 2026. מבקרים מתארים זאת כ"rug pull" לשותפים קטנים. [מאומת-תקציר] — [Financial Accountant](https://financialaccountant.co.uk/features/xero-api-fees-anger-developers/); [eCommerceNews AU](https://ecommercenews.com.au/story/xero-to-retire-app-store-billing-shift-to-api-tiers)
- Atlassian: סוף Connect (31 בינואר 2027) וסוף DC (28 במרץ 2029) מכריחים מפתחים לשכתב. [מאומת-תקציר] — [Atlassian](https://www.atlassian.com/blog/developer/announcing-connect-end-of-support-timeline-and-next-steps); [Atlassian Cloud Migration](https://www.atlassian.com/cloud-migration)
- monday.com: בקשת פיצ'ר בקהילה מבקשת שעוזר ה-AI של monday ימליץ על אפליקציות Marketplace כשהיכולות המובנות לא מספיקות. כרגע הוא נותן עוקפים ידניים. [מאומת-תקציר] — [monday community](https://community.monday.com/feature-requests/post/ai-assistant-should-proactively-surface-relevant-marketplace-apps-when-AUBccyyhyz9w9hO)

### Inferences
- [הסקה] ל-HubSpot אין תמריץ לבנות אינטגרציה לכל מערכת הנה"ח אזורית: יש עשרות כאלה, כל אחת קטנה. זו ההגנה המבנית הטובה ביותר שמצאתי בעדשה. הסיכון האמיתי עובר למערכת הנה"ח (מקרה Xero).
- [הסקה] ב-Shopify, כל קטגוריה שנוגעת ב-checkout, ב-B2B, ב-AI או במלאי נמצאת בסיכון ספיגה גבוה ב-2026.

### Gaps
- לא נמצאה עמדה רשמית של HubSpot לגבי מפת הדרכים של אינטגרציות ההנה"ח שלה, וגם לא מידע על תנאי חלוקת הכנסות או עמלות ב-HubSpot Marketplace.

---

## שאלה 4: אילו שלושה מועמדים מובילים, ולמה?

### Takeaway
1) **סנכרון order-to-cash בין HubSpot למערכות הנה"ח אזוריות (6/9)**; 2) **גרסאות Cloud לאפליקציות Atlassian DC-only (5/9)**; 3) **e-invoicing רב-מדינתי ל-B2B ב-EU על Shopify (4/9)**. אף אחד לא עובר את כל 9. רק הראשון מצדיק בדיקת הריגה עמוקה.

### Cited Findings
- (1) אי-שביעות רצון מתועדת ומתמשכת מהאינטגרציות של HubSpot עצמה: QBO 2.1★ על כ-100 דירוגים ו-Xero 2.2★ על כ-6 אלף התקנות, כולל תלונה מפורשת על דרישות מס שאינן אמריקאיות. למערכות האזוריות יש רק אפליקציות זעירות (100+ התקנות, 0–1 ביקורות) ובמחיר קיים (399 SEK לחודש). [מאומת-תקציר] — [QBO Data Sync](https://ecosystem.hubspot.com/marketplace/listing/quickbooks-data-sync); [Xero Data Sync](https://ecosystem.hubspot.com/marketplace/listing/xero-data-sync); [Fortnox by Resultify](https://ecosystem.hubspot.com/marketplace/apps/fortnox-by-resultify-1552654)
- (2) יש מועד כפוי (DC EOL ב-2029, ומכירות חדשות נעצרו במרץ 2026), והלקוח כבר משלם על אפליקציית ה-DC. מנגד, 95% מהמושבים בתשלום כבר על Forge, וההפצה למפתח חדש איטית. [מאומת-תקציר] — [Atlassian Cloud Migration](https://www.atlassian.com/cloud-migration); [Atlassian Connect EOS](https://www.atlassian.com/blog/development/getting-ready-for-connect-end-of-support); [first Forge app lessons](https://community.developer.atlassian.com/t/just-shipped-my-first-forge-app-10-lessons-after-11-days-on-the-marketplace/100742)
- (3) יש רגולציה חדשה ב-2026–2028 בארבע מדינות, אבל Sufio ו-CommBilling (419 ביקורות) כבר שם, ויש פתרון חינמי בבלגיה. [מאומת-תקציר] — [Sufio](https://sufio.com/news/einvoicing-peppol-belgium-shopify/); [CommBilling](https://apps.shopify.com/commbilling)

### Inferences
- [הסקה] **למה מועמד 1 מוביל:** הוא היחיד שמשלב (א) אות כאב מדיד וממושך בתוך החנות, (ב) סיבה מבנית שהגדולים לא נכנסים (פיצול גיאוגרפי של מערכות הנה"ח), (ג) לקוחות B2B שכבר משלמים מאות דולרים בחודש על HubSpot ולכן ARPU של 50–150$ סביר, ו-(ד) שני ערוצי הפצה: HubSpot Marketplace וחנות האפליקציות של מערכת הנה"ח. הדרך להוריד את הסיכון: לבחור 2–3 מערכות הנה"ח אירופיות בלי חיוב API עוין (למשל Exact Online, Moneybird, sevDesk או Holded; **לא אומת** מה מצב ה-API ועמלות השותפים שלהן) ולהתחיל מזוג אחד.
- [הסקה] **בדיקת ההריגה העמוקה למועמד 1 צריכה לענות על:** כמה לקוחות HubSpot יש בכל מדינה ומערכת (קריטריון 6); האם קיימים מחברים מקומיים שלא הופיעו בחיפוש (למשל בהולנדית ובגרמנית, בהתאם ללקח 2 של סבב 1); מה תנאי ה-API של כל מערכת הנה"ח; והאם iPaaS זולים (Make) כבר "מספיק טובים" ל-SMB.
- [הסקה] **למה מועמד 2 לא ראשון:** כל אפליקציה היא נישה קטנה (קריטריון 6), והתלות ב-Atlassian מוחלטת (קריטריון 7). הוא עשוי להתאים כ"עסק לייף-סטייל" ולא כרעיון שעובר את הרף.
- [הסקה] **לקח לעדשה עצמה (להוסיף לרשימת הלקחים):** "אירוע סגירה או sunset בפלטפורמה" הוא חלון של חודשים בודדים שמתמלא מהר בחלופות (Stocky, Webflow, Zendesk Sell). "אפליקציה של הפלטפורמה עם דירוג נמוך לאורך זמן" הוא אות טוב יותר.

### Gaps
- כל המועמדים מבוססים על תקצירי חיפוש. נדרש אימות ידני של דפי החנויות (דירוג, תאריך עדכון אחרון, התקנות) לפני בדיקת הריגה עמוקה.
- לא נבדק חיפוש מתחרים בשפות מקומיות (הולנדית, גרמנית, שבדית, ספרדית) עבור מחברי HubSpot↔הנה"ח. זה הצעד הבא החשוב ביותר, לפי לקח 2 של סבב 1.
