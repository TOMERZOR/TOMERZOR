# כאבים מהפורומים: בעיות תפעוליות חוזרות שמעלים עסקים קטנים ובינוניים ואנשי מקצוע (2024–2026)

> **איך המידע נאסף, ומה מגבלותיו (לקרוא קודם).** בסביבת המחקר הזו Reddit (reddit.com, old.reddit.com, ה-API של Reddit ב-JSON, pullpush) היה **חסום**, גם באינדקס החיפוש וגם בגישה ישירה. גם דפי Hacker News וממשקי ה-API של HN Algolia/Firebase לא נטענו ישירות, וכך גם רוב דפי הפורומים (כשלי DNS ב-WebFetch). לכן כל ציטוט שלהלן מגיע מ**קטעי תקציר של מנועי חיפוש** מדפים בפורומים מקצועיים: TheTruckersReport, BiggerPockets, ContractorTalk, ElectricianTalk, HVAC-Talk, Dentaltown, allnurses, AccountingWEB, Shopify Community, Indie Hackers ו-news.ycombinator.com. טקסט במירכאות הוא הקטע כפי שכלי החיפוש החזיר אותו. סביר מאוד שהוא מילה במילה, אבל לא יכולתי לבדוק אותו מול הדף המלא. טענות "מ-Reddit" רבות ברשת מגיעות אלינו רק דרך בלוגים של ספקים. במקרים כאלה הן מסומנות **יד שנייה/ספק**. **אין ברשימות האלה ציטוטים ממקור ראשון מ-Reddit.** כותב הדוח לא צריך להציג שום ממצא כ"מ-Reddit" אלא אם בלוג של ספק מייחס אותו לשם, וגם אז חובה לסמן אותו כיד שנייה.

## שאלת מפתח 1: על אילו בעיות תפעוליות אנשים במקצועות האלה מתלוננים שוב ושוב, ובאילו פתרונות עוקפים הם משתמשים (גיליונות אלקטרוניים, WhatsApp, נייר, גיוס אדם)?

### השורה התחתונה
הכאבים החוזרים ביותר בקרב בעלי מקצוע בענפי הבנייה והשירותים הטכניים, נדל"ן, הובלות, רפואת שיניים/פיזיותרפיה, ראיית חשבון ומסחר מקוון חולקים מבנה אחד: **רדיפה אחרי צד שלישי לקבלת מסמך או הוכחה, ואחר כך מעקב אחרי פקיעת התוקף שלו**. דוגמאות: אישורי ביטוח (COI) של קבלני משנה, ויתורי שעבוד (lien waivers), קבלות ודפי בנק של לקוחות, חותמות זמן של המתנה (detention), תמונות כניסה/יציאה מדירה, אישורים מוקדמים (prior authorizations) ורישיונות. הפתרונות העוקפים הנפוצים הם גיליון אלקטרוני, תיקייה משותפת ב-Drive, תזכורות ביומן, קבוצות WhatsApp ו"הרבה נדנודים". אשכול שני הוא **הקלדה חוזרת של אותם נתונים לפורטלים רבים**: פורטלים של חברות ביטוח, פורטלים של מבטחי שיניים ולוחות בקרה של פלטפורמות משלוחים.

### ממצאים עם מקורות

**P1. מעקב אחרי אישורי ביטוח (COI) של קבלני משנה (קבלנים ראשיים, מנהלי נכסים)**
- דיווח יד שנייה/ספק על שרשור ב-r/ConstructionManagers: רכזת פרויקטים שירשה גיליון ציות של קבלני משנה מבלה את היום ברדיפה אחרי קבלני המשנה לקבלת אישורים מחודשים. מנהלים ותיקים השיבו: "כן, ככה רוב החברות עושות את זה — וכן, זה סיוט." והוסיפו: "כשיש לך עשרה קבלני משנה, זה עובד. בשלושים או ארבעים, זה הופך לצוואר הבקבוק." — [imagetotable.ai (ספק, מצטט את השרשור)](https://imagetotable.ai/blog/construction-coi-tracking-email-spreadsheet-problem)
- ContractorTalk: שירותי ציות של צד שלישי כמו ISN ו-PICS "בודקים את האישורים ידנית באמצעות בני אדם", וה"תוכנה שלהם לא באמת עושה את מה שאתה מדבר עליו. העובדים שלהם עושים את הבדיקות ואתה משלם על מסד הנתונים המרכזי." פתרונות עשה-זאת-בעצמך שהוזכרו בשרשור: Google Drive/Dropbox יחד עם רשימת תיוג, ותזכורות ב-QuickBooks לפוליסות שעומדות לפקוע. — [שרשור ב-ContractorTalk](https://www.contractortalk.com/threads/software-for-managing-subcontractor-certs-of-insurance-associated-sub-data.264865/)
- תבניות Excel חינמיות למעקב אחרי COI מופצות באופן נרחב, מה שמראה שהגיליון האלקטרוני הוא פתרון ברירת המחדל. — [תבנית חינמית של Billy](https://billyforinsurance.com/certificate-of-insurance-tracking-template-excel/)

**P2. מנהלי חשבונות ורואי חשבון שרודפים אחרי לקוחות כל חודש לקבלת קבלות, דפי חשבון ומסמכים**
- AccountingWEB: אנשי מקצוע מספרים שהם "כמעט אף פעם לא מקבלים את המידע במהלך החודש, ובדרך כלל זה מגיע שבוע בערך אחרי סוף החודש"; "אין תוכנת קסם שתגרום ללקוחות לספק רשומות, רק חינוך והרבה נדנודים"; מנהלת חשבונות אחת מעריכה "3-4 שעות ללקוח, לשנה, ב'שאלות לקוח'" מעבר לרדיפה אחרי הרשומות. — [AccountingWEB: שעות של רדיפה אחרי מסמכים](https://www.accountingweb.co.uk/community/industry-insights/how-many-hours-did-your-firm-spend-last-month-chasing-documents); [AccountingWEB: עוסקים יחידים לכל מנהל חשבונות](https://www.accountingweb.co.uk/any-answers/how-many-sole-traders-can-a-bookkeeper-manage)
- בכיר ב-Receipt Bank (כיום Dext): "נקודת הכאב העיקרית של השותפים שלנו היא ההתכתבות הלוך ושוב במייל ברדיפה אחרי לקוחות." — [AccountingWEB](https://www.accountingweb.co.uk/node/232293)
- מייסד ב-Indie Hackers שבונה כלי לאיסוף מסמכים מדווח שרדיפה אחרי תשובות של לקוחות וקבלות חסרות היו התלונות המרכזיות בראיונות עם לקוחות. — [Indie Hackers](https://www.indiehackers.com/post/i-thought-bookkeeping-software-problems-were-accounting-problems-i-was-wrong-25854191c9)
- מייסד DocChase (ב-Product Hunt) מכנה את החלק הגרוע ביותר "הטקס החודשי של לשאול כל לקוח 'אתה יכול לשלוח לי את דף הבנק שלך?'" — [hunted.space / DocChase](https://www.hunted.space/dashboard/docchase)
- פוסט ב-r/Bookkeeping (יולי 2024, נצפה דרך אתר מראה) שואל איך אחרים מקבלים קבלות מלקוחות ומתאימים אותן, ומתאר זאת כגוזל זמן רב מאוד. — [מראה של r/Bookkeeping](https://pol1.lr.ggtyler.dev/r/Bookkeeping)

**P3. דלפק קבלה במרפאות שיניים שמאמת זכאות וכיסוי ביטוחי**
- טור ב-Dentaltown אומר שבדיקת זכאות לפני תורים "לוקחת בממוצע שעתיים ביום", ושהזכאות "כמעט תמיד תהיה אחרונה בתור, אבל היא גם אחת החשובות ביותר כי היא משפיעה מאוד על הגבייה שלך." — [Dentaltown](https://www.dentaltown.com/channel/post/7458/is-dental-insurance-eligibility-taking-too-much-time)
- הערכות של ספקים נעות בין 10–15 דקות למטופל בטלפון או בפורטל, ו-15–30 דקות כולל זמני המתנה. ב-25 מטופלים ליום, ספק אחד מעריך זאת בכ-4–5.5 שעות ביום, "כמעט משרה מלאה אחת" (ספק, להתייחס כהערכת כיוון). — [Solutionreach](https://www.solutionreach.com/blog/faster-verifications-fewer-denials-why-real-time-eligibility-is-a-2026-must-have); [Dentalbase](https://www.dentalbase.ai/blogs/practice-management/dental-insurance-verification-process-step-by-step-front-desk)
- פתרונות עוקפים: איש צוות ייעודי שאחראי על הנושא, בלוקי זמן מוגנים לטיפול מרוכז, ומיקור חוץ של האימות לחברות BPO. — [Dentaltown: הקבלה](https://www.dentaltown.com/channel/post/25995/front-office-systems-that-fix-chaos)

**P4. נהגי משאיות ומובילים קטנים שמפסידים תשלום על המתנה (detention) בגלל היעדר הוכחה**
- שרשור ב-TheTruckersReport נקרא "שוב הפסדתי תשלום המתנה כי הברוקר אמר 'אין הוכחה' — איך אתם מתעדים את זה". בשרשורים אחרים, נהג הפסיד תשלום המתנה כי ההוכחה היחידה הייתה הערה בכתב יד על שטר המטען (BOL), ו"חלק מהפקידים אצל השולחים והמקבלים לא מוכנים לחתום בראשי תיבות על שעות הכניסה והיציאה". פתרונות עוקפים: יומני טלפון, רישומי ELD, אפליקציות GPS, שליחת מייל לברוקר לפני שתם הזמן החופשי, תביעות קטנות. — [TheTruckersReport: "אין הוכחה"](https://thetruckersreport.com/truckingindustryforum/threads/lost-detention-pay-again-because-broker-said-no-proof-%E2%80%94-how-do-you-guys-document-it.2540236); [איך לגרום לברוקרים לשלם באמת על המתנה?](https://www.thetruckersreport.com/truckingindustryforum/threads/how-to-get-brokers-to-actually-pay-detention.2145331/page-2); [מה הייתם עושים אם ברוקר לא משלם על המתנה](https://www.thetruckersreport.com/truckingindustryforum/threads/what-would-you-do-if-a-broker-doesnt-pay-detention.1275590/)
- תבנית אישור תעריף (rate-con) של ברוקר: "תשלום על המתנה יבוצע אך ורק אם הברוקר קיבל הודעה שעה אחת לפני תחילת ההמתנה והשעות מסומנות בבירור על שטרי המטען." — [דוגמה ב-Scribd](https://www.scribd.com/document/613150220/semail)
- מסמך של ועדת המסחר של הסנאט מצטט הערכה של FMCSA שלפיה ההמתנה עולה לענף יותר מ-$3B. — [commerce.senate.gov](https://www.commerce.senate.gov/index.php/services/files/BAE24B91-2539-4DFA-B966-9E5491826733)

**P5. משכירים קטנים בקליפורניה מול ניירת רגולטורית חדשה: תמונות פיקדון לפי AB 2801 ותקרות שכר דירה לפי AB 1482**
- BiggerPockets, שרשורים מ-2025: AB 2801 מחייב תמונות לפני הכניסה לדירה, ביציאה לפני תיקונים, ואחרי התיקונים. לדברי אחד המשתתפים, "רוב המשכירים נתקעים כי הם לא מצליחים לקשר בין תמונות לשורות" בדוח המפורט. החמצת חלון 21 הימים "פירושה ויתור מוחלט על הניכויים". פתרונות עוקפים: "מוסכמת שמות פשוטה (מספר יחידה + חדר + תאריך) בתיקייה משותפת ב-Drive לכל נכס"; "רשומה ביומן ברגע שהשוכר יוצא, ולחסום את היום ה-18 כמועד האחרון הקשיח 'לכתוב את זה'"; סיורי וידאו עם קריינות. — [BiggerPockets: איך משכירים קטנים מתמודדים עם הניירת של AB 1482/AB 2801](https://www.biggerpockets.com/forums/899/topics/1288628-landlords-in-ca-how-are-small-landlords-handling-ab-1482-and-ab-2801-paperwork); [BiggerPockets: רשימת התיוג שלי ליציאה מדירה אחרי AB 2801](https://www.biggerpockets.com/forums/52/topics/1290993-my-move-out-checklist-after-ab-2801-what-california-landlords-need-to-document-now)
- לגבי AB 1482, משכירים עוקבים אחרי כל יחידה בגיליון אלקטרוני ובודקים את התקרה "לפני ששולחים את הודעת ההעלאה, לא אחרי". פקודות עזר מקומיות מתווספות מעל, תקרת ה-CPI משתנה בכל אוגוסט, ו"העלאה שגויה אחת יכולה להוביל להחזרת שכר הדירה לאחור ולקנסות." — [שרשור AB 1482/2801 ב-BiggerPockets](https://www.biggerpockets.com/forums/899/topics/1288628-landlords-in-ca-how-are-small-landlords-handling-ab-1482-and-ab-2801-paperwork)
- מחלוקות כלליות על פיקדונות: "שליחת עותקים של תמונות הכניסה והיציאה לשוכר מפחיתה מאוד את ההתנגדויות לחיובים מהפיקדון." — [שרשורי פיקדון ב-BiggerPockets](https://www.biggerpockets.com/forums/52/topics/1045109-move-out-condition-and-disposition-of-security-deposit)
- המקורות סותרים זה את זה לגבי מועדי התחולה של AB 2801 (ינואר 2025 לעומת שכירויות החל מ-1 ביולי 2025, עם תמונות לפני/אחרי תיקון החל מ-1 באפריל 2025). — [אותם שרשורים ב-BiggerPockets](https://www.biggerpockets.com/forums/109/topics/1212272-new-california-law-requires-photo-documentation-for-security-deposit-deductions)

**P6. סוכני ביטוח עצמאיים שמזינים מחדש את אותם נתונים לפורטלים של כמה חברות ביטוח**
- "סוכנים עצמאיים מבלים יותר משעתיים ביום בהזנת נתונים ידנית." 55% מהסוכנים מפיקים הצעות מחיר לביטוח עסקי דרך פורטלים של חברות הביטוח, אבל רק 32% מעדיפים לעשות זאת. הזנת אותם נתונים בפורטלים שונים הייתה "מתסכלת וגוזלת זמן לכל הצדדים." — [Insurance Business](https://www.insurancebusinessmag.com/us/news/technology/why-more-tools-are-making-independent-agents-less-productive-592341.aspx); [מקרה בוחן של IVANS](https://www.ivans.com/resources/reports-research/insurance-carrier-journey-digital-connectivity/); [Insurance Journal](https://www.insurancejournal.com/magazines/mag-features/2023/10/16/743907.htm)

**P7. התאמת עמלות בסוכנויות ביטוח**
- חברות הביטוח לא מתקננות את הדוחות שלהן. דוגמה אחת: קובץ ה-CSV של Progressive משתמש ב-"Pol #" וב-"Comm Amt", בעוד חברות אחרות משתמשות בכותרות שונות. הפתרון העוקף בגיליון הוא נוסחאות חיסור יחד עם צביעה בירוק/צהוב. "אם אף אחד לא משווה מול החודש הקודם, פוליסה שנעלמה נראית כמו שקט ולא כמו בעיה." — [המדריך של Commissions Wizard (ספק)](https://commissionswizard.com/blog/insurance-commission-reconciliation-guide); [המדריך של Commission Tracker (ספק)](https://commission-tracker.com/insurance-commission-reconciliation/)

**P8. מסעדות שמפסידות כסף על חיובי טעויות והתאמות של פלטפורמות משלוחים חיצוניות**
- בכנס Food On Demand (מאי 2024), בכיר ב-Freddy's כינה את החיובים החוזרים של פלטפורמות המשלוחים (DSP) "בעצם גניבה". השותפה של Freddy's, Loop AI, "עוזרת להחזיר יותר ממיליון דולר בשנה." — [Food On Demand](https://foodondemand.com/05172024/its-really-just-theft-freddys-exec-says-of-chargebacks-at-fodc/)
- חלונות זמן לערעור (טענת ספק): DoorDash כ-14 ימים, Uber Eats כ-30 ימים עם תקרות שבועיות. המדיניות הרשמית של Uber מתירה התאמות בתשלום "עד מלוא העלות של הפריטים שנפגעו, כולל מס." — [KoreFi (ספק)](https://www.korefi.ai/blog/uber-eats-fees-for-restaurants); [דף הסוחרים של Uber Eats](https://merchants.ubereats.com/gb/en/resources/learning-center/order-errors)

**P9. מסחר מקוון: סנכרון מלאי רב-ערוצי ומכירת יתר**
- Shopify Community: כלים מבוססי תשאול מסנכרנים "כל 10 עד 15 דקות", מה שפותח חלון למכירת יתר בשעות שיא. "Shopify לא מטפלת בחלק הזה באופן מובנה." — [Shopify Community: באיזו תדירות אתם מסנכרנים](https://community.shopify.com/t/how-often-do-you-sync-inventory-across-sales-channels/684825); [כלי סנכרון המלאי הטוב ביותר](https://community.shopify.com/t/best-inventory-sync-tool-for-shopify/672498)

**P10. מסחר מקוון: חיובים חוזרים (chargebacks) והונאה "ידידותית" שאובדים למרות הוכחת מסירה**
- כותרת של שרשור ב-Shopify Community: "סוחרי Shopify נענשים על ראיות לחיוב חוזר שאנחנו ממש לא יכולים לספק בשום מסלול חוץ מ-Plus". הטענה היא שסוחרים שאינם במסלול Plus לא יכולים להתאים את עמוד התשלום כדי לתעד הסכמה לתנאים. סוחרים אחרים הפסידו בערעורים גם כשהיה להם מעקב משלוח, כי מעקב עונה רק על קוד הסיבה "לא התקבל". — [שרשור ב-Shopify Community](https://community.shopify.com/t/shopify-merchants-are-being-penalised-for-chargeback-evidence-we-literally-cannot-provide-on-any-other-plan-other-than-plus/622590); [חיוב חוזר על פריט שנמסר עם מעקב](https://community.shopify.com/t/charge-back-on-an-item-successfully-delivered-with-tracking-evidence/347448)

**P11. פיזיותרפיסטים שמתעדים מחוץ לשעות העבודה**
- דוח WebPT 2024 State of Rehab Therapy מצוטט כמי שמצא ש-85% מהפיזיותרפיסטים לוקחים את התיעוד הביתה ו-36% מציינים אותו כגורם מוביל לשחיקה (מצוטט על ידי ספק, לא אומת ישירות מול WebPT). — [Physitrack (ספק)](https://www.physitrack.com/insights/documentation-burden-pt-ot-burnout)

**P12. מרפאות פיזיותרפיה/אמבולטוריות שמאבדות תביעות בגלל אישורים מוקדמים חסרים או שפג תוקפם ומגבלות ביקורים**
- "חברות ביטוח בדרך כלל לא שולחות תזכורות על פקיעת תוקף", ולכן המרפאות עוקבות אחרי התאריכים בעצמן. ספקים מצטטים שיעורי דחייה בפיזיותרפיה של כ-11% ו"אישור חסר גורם ל-25% מדחיות התביעות בפיזיותרפיה" (נתוני ספקים שסותרים זה את זה). — [rcmworkshop](https://rcmworkshop.com/insights/blogs/physical-therapy-prior-authorization-handling-visit-limits-and-payer-restrictions/); [SPRY](https://www.sprypt.com/blog/effective-strategies-to-reduce-claim-denials-for-your-pt-clinic)

**P13. מרפאות וטרינריות: כלי תקשורת ותזכורות ללקוחות שלא מסתנכרנים עם מערכת ניהול המרפאה (PIMS)**
- סקירות מרוכזות: Weave "יקרה, עם העלאות מחיר תכופות ותוספות בתשלום"; PetDesk "הסנכרון עם ה-PIMS הוא נקודת הכאב החוזרת... הזנה ידנית שהייתה אמורה להיעלם"; Vello "קיימת רק בתוך העולם של IDEXX". — [הסקירה של Tailwerks](https://tailwerks.com/best-veterinary-client-communication-software/); [Owner Exchange](https://ownerexchange.com/veterinary-client-communication-software/)

**P14. משרדי עורכי דין קטנים שמבצעים בדיקות ניגוד עניינים בגיליונות אלקטרוניים או במייל**
- המדריך של Clio עצמה מכנה בדיקות בגיליון "השיטה הנפוצה ביותר". ספק אחד אומר שכלי הבדיקה של Clio מחפש רק ברשומות של Clio, כך שנתונים ישנים מגיליונות מתפספסים. — [הבלוג של Clio](https://www.clio.com/au/blog/conflict-check-how-to/); [ustechautomations (ספק)](https://ustechautomations.com/resources/blog/legal-build-a-conflict-check-workflow-for-small-law-2026)

**P15. ויתורי שעבוד (lien waivers) לכל בקשת תשלום (קבלנים ראשיים וקבלני משנה)**
- גיליונות מעקב משתמשים ב"שורה אחת לכל קבלן משנה לכל מחזור בקשת תשלום" עם דגל של עיכוב תשלום. ספק אחד טוען שגיליונות עובדים "עד בערך חמישה פרויקטים פעילים". — [invoicedataextraction](https://invoicedataextraction.com/blog/subcontractor-lien-waiver-tracker-gc-ap); [LienDone](https://www.liendone.com/blog/lien-waiver-tracking-spreadsheet)

**P16. קבלני משנה שלא מקבלים תשלום על עבודה נוספת (פקודות שינוי וכרטיסי עבודה לפי זמן וחומרים (T&M) לא חתומים)**
- ContractorTalk/ElectricianTalk: קבלן משנה אחד ביצע עבודה נוספת בלי פקודת שינוי חתומה, ולכן הבעלים סירב לשלם ("הוא צדק, באמת עשינו את העבודה הנוספת בלי לקבל פקודת שינוי חתומה נוספת"). קבלן המשנה רשם שעבוד והוצע לו תשלום חלקי רק אם יסיר קודם את השעבוד. העצה בשרשור: להחתים כרטיסי T&M יומיים אצל מישהו בעל סמכות. — [ContractorTalk: האם לפצל פקודת שינוי על תוספות](https://www.contractortalk.com/threads/do-you-break-out-a-change-order-on-extras-on-small-jobs.344569/); [ElectricianTalk: פקודות שינוי](https://www.electriciantalk.com/threads/change-orders.13692/)
- חוק שיפוצי הבית של קליפורניה: פקודת שינוי "תהפוך לחלק מהחוזה רק אם היא בכתב ונחתמה על ידי הצדדים לפני תחילת כל עבודה". — (קטע שעלה באותו חיפוש; נוסח החוק לא נשלף)

**P17. תוכנות לניהול שירות שטח (FSM) יקרות מדי לעסקי שירות קטנים (מיזוג אוויר, חשמל, אינסטלציה)**
- סנטימנט ב-r/HVAC כפי שדווח על ידי ספקים: ServiceTitan עולה בערך $500–$700 לחודש ברף התחתון, ועוד $5k–$10k להטמעה, וכ-$3.5–4k לחודש עבור 10 טכנאים (יד שנייה, בלוגים של מתחרים). — [FieldProxy (ספק)](https://www.fieldproxy.ai/resources/blog/best-servicetitan-alternatives-for-small-hvac-companies-under-50-techs)
- HVAC-Talk: Jobber "לא יקרה במיוחד, קלה לשימוש ועושה מה שאנחנו צריכים". משתתף אחד רצה תוכנה שיכולה "לשייך הזמנת עבודה ישירות לפריט ציוד ספציפי וגם לעקוב אחרי הסכמי התחזוקה". — [HVAC-Talk: תוכנה לניהול העסק](https://www.hvac-talk.com/threads/hvac-software-to-run-business.2226005/); [HVAC-Talk: תוכנת תחזוקה מונעת](https://www.hvac-talk.com/threads/preventative-maintenance-software.1974241/)

**P18. צוותי שטח שמתאמים דרך קבוצות WhatsApp (תמונות והחלטות הולכות לאיבוד)**
- דיווחי ספקים: "40 תמונות התקדמות נקברות תחת 800 הודעות לא קשורות תוך יומיים"; "WhatsApp גם מסירה את רוב המטא-דאטה של התמונות בזמן הדחיסה"; כשעובדים עוזבים, ההיסטוריה עוזבת איתם. הצוותים ממשיכים להשתמש ב-WhatsApp כי היא "פשוטה, אוניברסלית ואמינה"; קלות השימוש היא המניע המרכזי לאימוץ (68%, סקר שמצוטט על ידי ספק). — [Banamind](https://banamind.ai/blog/why-construction-teams-use-whatsapp); [Valoon](https://valoon.chat/en/blog/whatsapp-groups-in-construction/); [SymTerra](https://www.symterra.co.uk/blog/construction-site-communication-app-uk); [Buildove](https://buildove.com/2025/09/13/the-whatsapp-trap-managing-construction-projects-on-whatsapp-is-costing-you-more-money/)

**P19. מחלקות סיעוד שעדיין מאיישות משמרות באמצעות "דפי חוסרים" מנייר**
- allnurses: מחלקות תולות דף "חוסרים" מנייר; מנהלת אחת שמרה דף ידני מחשש שאפליקציה תוריד את השכר; אחרים מצאו את API ואת ShiftWizard מתסכלות. רוב השרשורים בני כמה שנים. — [allnurses: Bid Shift](https://allnurses.com/anyone-using-bid-shift-filling-t191785/); [allnurses: באיזו מערכת שיבוץ אתם משתמשים](https://allnurses.com/what-kind-scheduling-use-work-t622583/)

**P20. פרילנסרים וסוכנויות שרודפים אחרי חשבוניות B2B שמשולמות באיחור**
- Ask HN, בערך אפריל 2026: "איך אתם מתמודדים עם לקוחות שלא משלמים בזמן?" הקונצנזוס הוא מקדמות, הפסקת עבודה ודמי איחור. מגיב אחד אומר ש"אין משאבים משפטיים ששווים משהו לפרילנסרים." — [Ask HN 47638685](https://news.ycombinator.com/item?id=47638685); [שרשור ב-Indie Hackers](https://www.indiehackers.com/post/freelancers-of-ih-how-do-you-actually-deal-with-a-client-paying-late-or-never-55972ef40e)

**P21. בעלי מקצוע: מעקב אחרי רישיונות והשתלמויות חובה (CE) של עובדים במדינות שונות**
- נמכרות תבניות גיליון למעקב אחרי רישיון, מדינה, גוף מסדיר ותאריך פקיעה, עם סימון צבעוני של 30/60/90 יום. מדריכים מודים ש"גיליון אלקטרוני מספיק לעסק שפועל במדינה אחת". — [LicensedTrades](https://licensedtrades.com/blog/how-to-track-contractor-license-renewals-multi-state); [ContractorComply](https://contractorcomply.us/resources/contractor-license-expiration-tracking)

**P22. ועדי בתים (HOA) בניהול עצמי שעוקבים אחרי דמי ועד בגיליונות אלקטרוניים**
- קיימים כלים רבים בחינם או בזול: KindHOA ב-$0/$29 קבוע, HomeHerald בחינם עד 50 בתים, AffordableHOA ב-$49 קבוע. — [KindHOA](https://kindhoa.com/alternatives/best-self-managed-hoa-software); [AffordableHOA](https://affordablehoa.com/hoa-management-software)

### מסקנות
- הדפוס החוזר החזק ביותר הוא **"תיעוד ראיה בתוספת מועד אחרון"**: פקיעת COI, חותמות זמן של המתנה, תמונות פיקדון שמקושרות לשורות ניכוי, כרטיסי T&M חתומים, פקיעת אישור מוקדם. הכסף אובד לא כי העבודה קשה, אלא כי ההוכחה לא נאספה ברגע שהדבר קרה, או שתאריך הוחמץ.
- הפתרונות העוקפים מתקבצים כך: גיליון אלקטרוני (COI, ויתורי שעבוד, עמלות, תקרות שכר דירה, רישיונות), Drive משותף יחד עם מוסכמות שמות (משכירים), תזכורות ביומן (משכירים, COI), WhatsApp (צוותי שטח), נייר (דפי חוסרים בסיעוד, הערות על BOL), ו**גיוס אדם או חברת BPO** (אימות זכאות בשיניים, בודקי COI אנושיים, מיקור חוץ של מחזור ההכנסות (RCM)). גיוס אדם הוא האות החזק ביותר לנכונות לשלם.

### פערים
- **לא ניתן היה לשלוף שום תוכן ממקור ראשון מ-Reddit** (חסום), ולכן תתי-הפורומים שנזכרו בתדריך (r/smallbusiness, r/sysadmin, r/Accounting, r/landlord, r/PropertyManagement, r/HVAC, r/electricians, r/Plumbing, r/nursing, r/physicaltherapy, r/dentistry, r/Teachers, r/freelance, r/ecommerce, r/restaurateur, r/Truckers, r/Insurance, r/LawFirm, r/paralegal, r/vet) **אינם מיוצגים ישירות**. אדם צריך לבצע בהם בדיקות מדגמיות ידנית.
- שני חיפושים על כאבים של מנהלי מערכות (הסרת גישה ל-SaaS בעזיבת עובדים, התפשטות רישיונות ב-Spiceworks) לא החזירו תוצאות. לא מצאתי דבר על מורים או על עוזרים משפטיים.
- לא יכולתי לפתוח דפי פורום מלאים, ולכן תאריכי הפרסום של כמה שרשורים אינם ידועים. חלק מהשרשורים ב-ContractorTalk/HVAC-Talk/allnurses ישנים בבירור מ-2024.

## שאלת מפתח 2: מה אומרים שרשורי "Ask HN: איזה כלי הייתם רוצים שיהיה קיים / על מה הייתם משלמים כדי לפתור" ב-Hacker News מהשנים 2024–2026?

### השורה התחתונה
מצאתי שרשורי HN רלוונטיים מ-2024–2026, אבל לא יכולתי לקרוא את תוכן התגובות בהם. היו זמינים רק קטעי תקציר מהחיפוש, ולכן HN תורם מעט כאב B2B שניתן לאמת. האות השימושי מ-HN מגיע מפוסטי "Who is hiring" של 2026, שבהם סטארטאפים שגייסו כסף מתארים ענפים ש"עדיין רצים על גיליונות אלקטרוניים ושיחות טלפון (ופקסים!)". זהו **אות רוויה**: צוותים בגיבוי הון סיכון כבר תוקפים את הנישות האלה.

### ממצאים עם מקורות
- השרשור "Ask HN: What work problems would your company pay to solve?" ("אילו בעיות בעבודה החברה שלכם הייתה משלמת כדי לפתור?") קיים. כותב הפוסט שואל על תהליכי עבודה ידניים, כאבי דיווח וטרחת ציות לרגולציה. מזהה הפריט מרמז על סוף 2025; התאריך לא אומת. לא ניתן היה לשלוף את תוכן התגובות. — [HN 46041165](https://news.ycombinator.com/item?id=46041165)
- קטעים משרשורי HN קשורים (תאריכים לא ברורים): מנהל מערכות אומר ששדרוג צי שרתים בסוף חייו הוא כואב ושווה תשלום כדי לפתור. קבוצת מסחר הייתה משלמת על שירות של העלאת פוזיציות וקבלת דוחות בטחונות (margin), כי המקדמים בכלי של CME משתנים במהלך היום. מגיב אחר אומר שחברות בסחר בינלאומי משלמות כדי להימנע מעיכובים במכס ולא כדי לקצץ בעלויות הציות. — [תקציר חיפוש ב-HN שמפנה ל-46041165 ולשרשורים קשורים](https://news.ycombinator.com/item?id=46041165)
- השרשורים "Ask HN: What Problem Would You Solve with Unlimited Time and Money? [Apr 2025]" ו-"[May 2025]" ("איזו בעיה הייתם פותרים עם זמן וכסף בלתי מוגבלים?") הם ברובם משאלות צרכניות ושאפתניות במיוחד. — [HN 43670167](https://news.ycombinator.com/item?id=43670167); [HN 43883335](https://news.ycombinator.com/item?id=43883335)
- "Ask HN: What are the 'boring' businesses for hackers these days?" ("מהם העסקים ה'משעממים' להאקרים בימינו?", ינואר 2024). העצה שם: לחפש "גיליון MS Excel שנשלח הלוך ושוב במייל ונערך" בענפי נישה לא טכנולוגיים, בתמחור של כ-$50–$250 לחודש. — [HN 38882314](https://news.ycombinator.com/item?id=38882314)
- פוסטי "Who is hiring" ב-HN מ-2026: רכש במלונאות הוא "ענף של $400B שעדיין רץ על גיליונות אלקטרוניים ושיחות טלפון (ופקסים!)" (פברואר 2026); קבלנים "עדיין מנהלים שכר, ציות ותמחיר עבודות על פני גיליונות אלקטרוניים ותוכנות מיושנות" (מרץ 2026); שרשראות אספקה של חומרה "רצות על גיליונות אלקטרוניים, מייל ו-PDF" (יוני 2026). — [פברואר 2026](https://news.ycombinator.com/item?id=46857488); [מרץ 2026](https://news.ycombinator.com/item?id=47219668); [יוני 2026](https://news.ycombinator.com/item?id=48357725)
- הפקס עדיין שורד בבריאות. מגיבים אומרים שרשומות של ספקים מחוץ לרשת עוברות בדרך כלל בפקס, ושפקס "אינו נחשב 'מדיה אלקטרונית' לפי HIPAA". — [Ask HN: מי עדיין משתמש בפקס (2022)](https://news.ycombinator.com/item?id=29517259)
- Ask HN (בערך אפריל 2026) על לקוחות שמשלמים באיחור. הקונצנזוס: מקדמות של 20–50%, הפסקת עבודה, דמי איחור של "5-10% בכל חודש". — [HN 47638685](https://news.ycombinator.com/item?id=47638685)

### מסקנות
- שרשורי המשאלות ב-HN נוטים לכיוון משאלות של מפתחים וצרכנים. ככלי לזיהוי כאב ורטיקלי ב-B2B הם חלשים יותר מפורומים מקצועיים.
- הראיות מ-"Who is hiring" מראות שבתחומי ציות בבנייה, רכש במלונאות ושרשראות אספקה כבר יש ב-2026 סטארטאפים ממומנים שמגייסים מהנדסים.

### פערים
- לא ניתן היה לקרוא תוכן ברמת התגובות מ-HN 46041165 (השרשור הרלוונטי ביותר). אדם צריך לקרוא אותו ישירות.
- לא ניתן היה להריץ שאילתות HN Algolia על שרשורי "Ask HN" מ-2024–2026 (השרת חסום).

## שאלת מפתח 3: לכל כאב — מי סובל, באיזו תדירות, כמה זה עולה, מי כבר משרת אותו (שמות, תמחור, מימון), למה אנשים עדיין מתלוננים, מה טיעון פרקליט השטן, ומה פסק הדין?

### השורה התחתונה
תחת בדיקה אגרסיבית, **כמעט לכל כאב כבר יש כמה מוצרים ממומנים או זולים**, ולעיתים קרובות תריסר או יותר כלי נישה מונעי SEO, מה שכשלעצמו מעיד על רוויה. **אף כאב לא עובר בצורה נקייה את המבחן "קריטי + לא מקבל מענה מספק".** שלושה שורדים רק בתנאים, כנקודות כניסה (wedges) צרות:
- **(A) תיעוד ראיות לעבודה נוספת של קבלני משנה (אישור T&M/פקודת שינוי) עבור קבלני משנה קטנים ומתמחים.** Clearstory משרתת את הקבלנים הראשיים הגדולים; קבלני משנה קטנים לא מקבלים מענה מספק.
- **(B) תיעוד ציות למשכירים קטנים בקליפורניה (קישור תמונה-לניכוי לפי AB 2801 בתוספת מעקב אחרי תקרת שכר דירה לפי AB 1482/פקודות מקומיות).** הוא חדש, מונע רגולציה, כרוך בקנסות, והכלים בתחום מפוצלים ולא בשלים.
- **(C) הוכחת המתנה וגבייה עבור נהגים-בעלי משאית (owner-operators).** כסף אמיתי אובד והכלים קטנטנים ומפוצלים, אבל שורש הבעיה הוא כוח מיקוח.

19 האחרים **נפסלו**.

### ממצאים עם מקורות

#### לוח תוצאות
| # | כאב | מי משלם | פסק דין |
|---|---|---|---|
| P1 | מעקב COI של קבלני משנה | קבלנים ראשיים, מנהלי נכסים | נפסל (צפוף, עד $39 לחודש) |
| P2 | רדיפה אחרי מסמכים אצל מנהלי חשבונות | מנהלי חשבונות/רואי חשבון | נפסל (צפוף; שורש התנהגותי) |
| P3 | אימות ביטוח שיניים | מרפאות שיניים | נפסל (בהלת AI ממומנת היטב) |
| P4 | הוכחת המתנה/גבייה | נהגים-בעלי משאית, ציים קטנים | שורד (בתנאים, חלש) |
| P5 | ציות ל-AB 2801/AB 1482 למשכירים בקליפורניה | משכירים בקליפורניה עם 1–50 יחידות | שורד (בתנאים, שוק כולל (TAM) קטן) |
| P6 | הזנה חוזרת בפורטלים של חברות ביטוח | סוכנויות עצמאיות | נפסל (מנועי השוואה/שחקנים ותיקים/RPA) |
| P7 | התאמת עמלות | סוכנויות | נפסל (מקבל מענה החל מ-$67 לחודש) |
| P8 | ערעורים מול פלטפורמות משלוחים | מסעדות | נפסל (Loop AI גייסה $20M, Voosh) |
| P9 | סנכרון מלאי רב-ערוצי | מוכרים במסחר מקוון | נפסל (רווי) |
| P10 | חיובים חוזרים | מסחר מקוון | נפסל (רווי; מוגבל בכללי רשתות הכרטיסים) |
| P11 | תיעוד בפיזיותרפיה | פיזיותרפיסטים/מרפאות | נפסל (מבול של כלי AI לתיעוד) |
| P12 | מעקב אישורים מוקדמים בפיזיותרפיה | מרפאות | נפסל (פיצ'ר של מערכות EMR; נטל של מערכת הבריאות האמריקאית) |
| P13 | תקשורת במרפאות וטרינריות/סנכרון PIMS | מרפאות וטרינריות | נפסל (נעילה ב-PIMS, שחקנים ותיקים) |
| P14 | בדיקות ניגוד עניינים במשפטים | משרדים קטנים | נפסל (קיים ב-Clio ודומיה) |
| P15 | ויתורי שעבוד | קבלנים ראשיים/קבלני משנה | נפסל (Levelset/Procore, Siteline) |
| P16 | עבודה נוספת לא חתומה / T&M | קבלני משנה מתמחים | שורד (בתנאים) |
| P17 | FSM יקר מדי | עסקי שירות קטנים | נפסל (Jobber/HCP ודומיהן) |
| P18 | צוותי WhatsApp מאבדים מידע | עסקי שטח קטנים | נפסל כמוצר עצמאי (כלים רבים מבוססי WhatsApp), אבל תובנת עיצוב מרכזית |
| P19 | דפי משמרות בסיעוד | בתי חולים | נפסל (רוכש ארגוני) |
| P20 | איחורי תשלום לפרילנסרים | פרילנסרים | נפסל (נכונות נמוכה לשלם, בעיה חוזית) |
| P21 | מעקב רישיונות/השתלמויות לבעלי מקצוע | קבלנים במספר מדינות | נפסל (קטן, מקבל מענה) |
| P22 | דמי ועד בית | ועדים מתנדבים | נפסל (כלים חינמיים) |

#### P1 מעקב COI של קבלני משנה: נפסל
- **מי/עלות:** רכזי פרויקטים ומחלקת תשלומים (AP) אצל הקבלן הראשי. הכאב גדל עם מספר קבלני המשנה ("בשלושים או ארבעים, זה הופך לצוואר הבקבוק"). — [imagetotable (יד שנייה)](https://imagetotable.ai/blog/construction-coi-tracking-email-spreadsheet-problem)
- **קיים:** myCOI (ללא מחיר פומבי, הערכה של $500–2,000+ לחודש, ארגוני); Billy (בסביבות $600 לחודש עבור 100–300 קבלני משנה לפי הערכה אחת); TrustLayer (מסלול Starter חינמי עד 50 ספקים, ‎+$10 לספק לחודש לפי מקור אחד); COI File ב-$39–$199 לחודש. — [subdoc.io](https://subdoc.io/blog/affordable-coi-tracking-software); [trackmyvendor](https://trackmyvendor.com/mycoi-alternatives); [coifile](https://coifile.com/coi-tracking/best-software-for-contractors/)
- **למה התלונות נמשכות:** תמחור ארגוני לקבלנים ראשיים קטנים, ושירותי בדיקה אנושיים (ISN/PICS) שלא מבצעים אוטומציה. — [ContractorTalk](https://www.contractortalk.com/threads/software-for-managing-subcontractor-certs-of-insurance-associated-sub-data.264865/)
- **פרקליט השטן:** מסלול חינמי (TrustLayer) ועוד תריסר מתחרים חדשים מבוססי חילוץ נתונים ב-AI (subdoc, coipulse, coifile, trackmyvendor, imagetotable, ו-Apify actor) כבר מתחרים על הקצה הזול. תוצאות החיפוש לשאילתה הזו נשלטות על ידיהם. — [Apify actor](https://apify.com/armourylabs/subcontractor-certificate-expiry-checker); [coipulse](https://coipulse.com/blog/mycoi-alternatives)

#### P2 רדיפה אחרי מסמכים אצל מנהלי חשבונות: נפסל
- **מי/עלות:** מנהלי חשבונות ומשרדי ראיית חשבון קטנים, מדי חודש. בסביבות 3–4 שעות ללקוח בשנה על שאלות ורדיפה אחרי מסמכים (הערכה של איש מקצוע אחד). — [AccountingWEB](https://www.accountingweb.co.uk/any-answers/how-many-sole-traders-can-a-bookkeeper-manage)
- **קיים:** Content Snare (החל מכ-$29–35 לחודש); TaxDome (כ-$800–1,200 למשתמש לשנה); Financial Cents, Karbon, Uku, DocChase, Dext/Hubdoc. — [Content Snare ב-Capterra](https://www.capterra.com/p/167019/Content-Snare/); [TaxDome ב-Capterra](https://www.capterra.com/p/186749/TaxDome/); [getuku](https://getuku.com/articles/taxdome-pricing/)
- **פרקליט השטן:** אנשי המקצוע עצמם אומרים ש"אין תוכנת קסם שתגרום ללקוחות לספק רשומות". צוואר הבקבוק הוא התנהגות הלקוח, וכלים זולים רבים כבר מבצעים אוטומציה של תזכורות. — [AccountingWEB](https://www.accountingweb.co.uk/any-answers/how-many-sole-traders-can-a-bookkeeper-manage)

#### P3 אימות ביטוח שיניים: נפסל
- **מי/עלות:** דלפק הקבלה, מדי יום, כשעתיים ביום (Dentaltown) ועד כמשרה מלאה אחת (הערכת ספק). מרפאות כבר משלמות לחברות BPO, מה שמראה נכונות לשלם. — [Dentaltown](https://www.dentaltown.com/channel/post/7458/is-dental-insurance-eligibility-taking-too-much-time)
- **קיים/מימון:** Patientdesk AI (‏$1M טרום-סיד, YC, פעילה ביותר מ-60 מרפאות, פברואר 2026); Toothy AI (‏YC W25, ‏$5.4M, ‏Accel); LightSpun (‏$13M סבב A, בערך ספטמבר 2025); Trust AI (‏$6M סיד, אוגוסט 2025); Zentist; וכן מסלקות מסוג Vyne/Onederful. — [Dealroom/Patientdesk](https://app.dealroom.co/news/feed/patientdesk-ai-raises-1m-pre-seed-from-y-combinator-to-automate-dental-front-desks-with-real-time-insurance-verification); [Dental Tribune/Trust AI](https://www.dental-tribune.com/news/trust-ai-the-chatgpt-for-dentists-raises-us6-million-in-seed-funding/); [מדריך החברות של vcbacked בתחום השיניים](https://www.vcbacked.co/directory/industries/dental)
- **פרקליט השטן:** כאב קריטי, אבל בהלת זהב צפופה של סוכני AI ב-2025–26. אינטגרציות עם משלמים אמריקאים ו-HIPAA מוסיפות עלות, וקשה למייסד יחיד שמבוסס בישראל למכור למרפאות שיניים בארה"ב.

#### P4 הוכחת המתנה וגבייה עבור נהגים-בעלי משאית: שורד (בתנאים, חלש)
- **מי/עלות:** נהגים-בעלי משאית וציים קטנים, בכל מטען שיש בו זמן שהייה. נתון של FMCSA מעמיד את העלות לענף על יותר מ-$3B. ספק אחד מייחס ל-ATRI (ספטמבר 2024) את הממצא שמובילים מגישים חשבונית על המתנה בכ-75% מהמקרים ומקבלים תשלום על כ-55% מהחשבוניות האלה (לא אומת מול ATRI). — [מסמך ועדת המסחר של הסנאט](https://www.commerce.senate.gov/index.php/services/files/BAE24B91-2539-4DFA-B966-9E5491826733); [dockclaim (ספק)](https://dockclaim.com/compare/detention-tracking-software)
- **קיים:** DockClaim ב-$49 לחודש; DockClock בחינם ועוד 10% מהתביעות שנגבו; Detention Defender ב-$20 לחודש (לפני השקה); Detention Source ו-Detention Gun (iOS); DetentionIQ (לציים, משתלב עם Samsara/Motive); מודולים במערכות TMS. — [dockclaim](https://dockclaim.com/compare/detention-tracking-software); [DockClock](https://dockclock.app/); [DetentionIQ](https://www.detentioniq.com/); [Detention Source](https://apps.apple.com/us/app/detention-source/id6444958697)
- **למה עדיין מתלוננים:** ההוכחה צריכה לעמוד בתנאי אישור התעריף (הודעה לפני תום הזמן החופשי, שעות כניסה/יציאה חתומות על ה-BOL), והמקבלים מסרבים לחתום על השעות. זו בעיה של תהליך עבודה ושל חוזה, לא רק של GPS. — [TheTruckersReport](https://www.thetruckersreport.com/truckingindustryforum/threads/how-to-get-brokers-to-actually-pay-detention.2145331/page-2)
- **פרקליט השטן:** ברוקרים משלמים לעיתים קרובות על המתנה רק אם הם גובים מהשולח, כך שהוכחה טובה יותר לא יוצרת כוח מיקוח. השוק כבר מלא באפליקציות קטנטנות, מה שמרמז על הכנסה נמוכה למשתמש (ARPU) ועל קהל מפוצל שניתן להגיע אליו רק דרך ערוצים של נהגי משאיות. ענקיות ה-ELD (Motive/Samsara) יכולות להוסיף את זה כפיצ'ר.

#### P5 ציות למשכירים קטנים בקליפורניה (AB 2801 + AB 1482 + פקודות מקומיות): שורד (בתנאים, TAM קטן)
- **מי/עלות:** משכירים פרטיים וקטנים בקליפורניה, בכל החלפת שוכר (פיקדון) ובכל העלאת שכר דירה. קנסות: אובדן הזכות לניכויים אחרי 21 הימים, והחזרת שכר הדירה לאחור יחד עם קנסות על העלאה מעל התקרה (לפי משתתפים בפורום). — [BiggerPockets](https://www.biggerpockets.com/forums/899/topics/1288628-landlords-in-ca-how-are-small-landlords-handling-ab-1482-and-ab-2801-paperwork)
- **קיים:** אפליקציות ביקורת נכסים RentCheck (כ-$1–1.25 ליחידה לחודש לפי Buildium) ו-zInspector (בחינם עד כ-5 יחידות, בתשלום החל מכ-$22 לחודש); כלים לתקרת שכר דירה כמו מחשבון ה-CPI של CAA (לחברים בלבד), LeaseBase (טוענת למעקב AB 1482 ברמת הנכס כולל פקודות מקומיות), RentGuard (מסלול חינמי ועוד תזכורות בתשלום על כלל 12 החודשים), RentCeiling ו-Keywise; וחבילות ניהול נכסים מלאות (Buildium/AppFolio) לבעלים גדולים יותר. — [הסקירה של Buildium](https://www.buildium.com/blog/best-property-management-inspection-software/); [CAA](https://caanet.org/caa-updates-cpi-calculator-for-rent-increases-under-ab-1482-2026/); [LeaseBase](https://leasebase.ai/ab1482-calculator/); [RentGuard](https://rentguardca.com/); [Keywise](https://www.keywise.app/blog/california-ab-1482-explained-2026)
- **למה עדיין מתלוננים:** הפער הספציפי שעולה הוא קישור כל שורת ניכוי לתמונות ולחשבוניות ספציפיות ועמידה במועד האחרון ("לא מצליחים לקשר בין תמונות לשורות"). המחשבונים אפילו חלוקים על המספרים: לוס אנג'לס ב-8.7% (LeaseBase) לעומת 6.0% מקומי (RentCeiling). — [BiggerPockets](https://www.biggerpockets.com/forums/899/topics/1288628-landlords-in-ca-how-are-small-landlords-handling-ab-1482-and-ab-2801-paperwork); [RentCeiling](https://rentceiling.com/california)
- **פרקליט השטן:** משכירים קטנים רגישים למחיר ומתנהגים כמעט כמו צרכנים. השוק הוא קליפורניה בלבד, וכמה מתחרים חדשים הופיעו בבת אחת ב-2025–26. TurboTenant/Avail/RentCheck יכולות להוסיף בזול פיצ'ר של "פירוט ניכויים לפי AB 2801". אחריות משפטית לציות בארה"ב היא מכשול נוסף, והמייסד צריך להגיע למשכירים אמריקאים מישראל.

#### P6 הזנה חוזרת בפורטלים של חברות ביטוח (סוכני ביטוח): נפסל
- **קיים:** מנועי השוואת הצעות (EZLynx, PL Rating ודומיהם), Bolt, Relay, ספקי אוטומציית דפדפן (Skyvern, Autonoly), ורשת הקישוריות של IVANS. — [Relay](https://relayins.com/blog/carrier-portal-automation); [Skyvern](https://www.skyvern.com/blog/automate-insurance-carrier-portal-workflows/); [FirstConnect](https://www.firstconnectinsurance.com/blog/insurance-quoting-software/)
- **פרקליט השטן:** זה תלוי בשיתוף פעולה של חברות הביטוח ובפורטלים ששוברים RPA, והשחקנים הוותיקים שולטים במערכת ניהול הסוכנות.

#### P7 התאמת עמלות: נפסל
- **קיים:** Commission Tracker (‏$67–72 לחודש קבוע ועוד דמי הרשמה של $120; עיבוד כשירות מלא ב-$187 לחודש); AgencyBloc (כ-$59–109 למשתמש לחודש ועוד מודול עמלות); AgencyComp; Commissions Wizard; Insurstein. — [התמחור של commission-tracker](https://commission-tracker.com/pricing/); [GetApp](https://www.getapp.com/sales-software/a/commission-tracker-for-insurance/); [AgencyComp](https://agencycomp.com/)
- **פרקליט השטן:** כבר מקבל מענה זול, וספקי AMS (‏Applied, ‏HawkSoft) כוללים את זה בחבילה.

#### P8 חיובי טעויות של פלטפורמות משלוחים (מסעדות): נפסל
- **קיים/מימון:** Loop AI (‏$6M ב-2024 בהובלת Base10, ואחר כך סבב A של $14M בפברואר 2026 בהובלת Nyca); Voosh (טוענת לשיעור הצלחה של 80–90% בערעורים); KoreFi. — [Restaurant Business](https://www.restaurantbusinessonline.com/technology/loopai-raises-6m-app-automates-third-party-delivery-bookkeeping); [Verdict Foodservice](https://www.verdictfoodservice.com/news/loop-ai-secures-funding-to/); [Food On Demand](https://foodondemand.com/05172024/its-really-just-theft-freddys-exec-says-of-chargebacks-at-fodc/)
- **פרקליט השטן:** קיימות מובילות ממומנות, והתחום תלוי בגישה לנתוני הפלטפורמות.

#### P9 סנכרון מלאי: נפסל
- **קיים:** Sellbrite, Trunk, Sumtracker, Linnworks, Cin7 Core ואחרים. — [Shopify Community](https://community.shopify.com/t/best-inventory-sync-tool-for-shopify/672498)

#### P10 חיובים חוזרים: נפסל
- **קיים:** ספקים רבים לאוטומציה של חיובים חוזרים. התוצאות נקבעות על ידי רשתות הכרטיסים והבנקים ("הבנק... מקבל את ההחלטה"). — [Shopify Community](https://community.shopify.com/t/chargebacks-friendly-fraud-and-arbitrations/339868)

#### P11 תיעוד בפיזיותרפיה: נפסל
- **קיים:** מבול של כלי תיעוד מבוססי AI (‏SPRY, ‏Chartnote, ‏EZPT, ‏Physitrack, פיצ'רים של WebPT). אפילו ספקים מודים ש"רשומות מהירות יותר לא מפחיתות אוטומטית את השחיקה". — [Physitrack](https://www.physitrack.com/insights/ai-documentation-pt-burnout); [EZPT](https://www.ezpttech.com/); [Chartnote](https://blog.chartnote.com/ai-documentation-for-physical-therapy-reclaiming-the-most-expensive-hour-of-the-day/)

#### P12 מעקב אישורים מוקדמים בפיזיותרפיה: נפסל
- **קיים:** מודולי מעקב אישורים במערכות EMR, ‏heno.io, ומיקור חוץ של RCM. — [heno.io](https://www.heno.io/prior-authorizations/); [rcmworkshop](https://rcmworkshop.com/insights/blogs/physical-therapy-prior-authorization-handling-visit-limits-and-payer-restrictions/)
- **פרקליט השטן:** זה פיצ'ר של מערכות EMR, ומכירתו פירושה עבודת HIPAA ומורכבות של משלמים אמריקאים.

#### P13 תקשורת במרפאות וטרינריות: נפסל
- **קיים:** Weave, PetDesk, Vello/IDEXX, Shepherd ואחרים. התלונה המרכזית היא האינטגרציה עם ה-PIMS, שבה שולטים ספקי ה-PIMS. — [Tailwerks](https://tailwerks.com/best-veterinary-client-communication-software/)

#### P14 בדיקות ניגוד עניינים במשפטים: נפסל
- **קיים:** Clio Grow ומודולי ניגוד העניינים ברוב חבילות ניהול המשרד. — [Clio Grow](https://www.clio.com/grow/); [הרשימה של Guideflow](https://www.guideflow.com/blog/conflict-check-software)

#### P15 ויתורי שעבוד: נפסל
- **קיים:** Levelset (‏Procore), ‏Siteline, ‏LienDone, והרשימה של Brixx עם 8 אפשרויות. — [Siteline](https://www.siteline.com/blog/best-lien-waiver-management-software-for-subcontractors); [Levelset](https://www.levelset.com/lien-waivers/lien-waiver-software/); [Brixx](https://brixxdigital.com/blog/lien-waiver-software)

#### P16 עבודה נוספת לא חתומה / כרטיסי T&M עבור קבלני משנה קטנים ומתמחים: שורד (בתנאים)
- **מי/עלות:** קבלני משנה לחשמל, אינסטלציה וגבס בפרויקטים של קבלנים ראשיים, בכל שינוי בהיקף העבודה. תוספות שלא שולמו מובילות לשעבודים ולפשרות חלקיות. — [ContractorTalk](https://www.contractortalk.com/threads/do-you-break-out-a-change-order-on-extras-on-small-jobs.344569/)
- **קיים:** Clearstory (סבב B של $16M ביוני 2024, כ-$35M בסך הכול). היא מכוונת לקבלנים ראשיים גדולים: 13 מתוך 25 הקבלנים הראשיים הגדולים בצפון אמריקה, ו-19,000 פקודות שינוי בשווי של יותר מ-$850M בחודש ברשת שלה. חבילות למגורים/FSM (‏Jobber, ‏Buildertrend, ‏JobTread) כוללות פקודות שינוי. Procore/Fieldwire/Raken מכסות T&M בצד הקבלן הראשי. — [BusinessWire/Clearstory](https://www.businesswire.com/news/home/20240627887251/en); [Commercial Observer](https://commercialobserver.com/2024/06/proptech-startup-clearstory-series-b/)
- **למה עדיין מתלוננים:** הכשל קורה בשטח. מנהל העבודה לא מקבל כרטיס חתום ומתומחר לפני תחילת העבודה, ומנהל העבודה של הקבלן הראשי מסרב לחתום. כלים שנמכרים לקבלן הראשי לא מתקנים את התמריץ של קבלן המשנה.
- **פרקליט השטן:** זו בעיה של כוח ושל חוזה; קבלנים ראשיים יכולים פשוט לסרב לחתום. Clearstory יכולה לרדת לשוק הנמוך. קבלני משנה כבר משתמשים באפליקציות כלליות (תמונות, חתימה אלקטרונית, DocuSign). מחזורי המכירה בבנייה ארוכים ודורשים היכרות מקומית עמוקה, מה שקשה יותר מישראל. לא ברור אם קבלני משנה קטנים ישלמו.

#### P17 FSM יקר מדי: נפסל
- **קיים:** Jobber (החל מכ-$39 לחודש), Housecall Pro, Workiz, Service Fusion, FieldEdge ואחרים. — [אזכור המחיר של Jobber ב-ContractorTalk](https://www.contractortalk.com/threads/need-recommendation-for-job-costing-software.457514/); [Jobber](https://getjobber.com/academy/servicetitan-competitors/)

#### P18 צוותי שטח שמנוהלים ב-WhatsApp: נפסל כמוצר עצמאי (תובנת העיצוב נשמרת)
- **קיים:** Valoon (צ'אט בנייה בסגנון WhatsApp), ‏Banamind (תיעוד מתוך WhatsApp), ‏Zenzap, ‏SymTerra, ‏Site Setu, ‏Convoe. — [Valoon](https://valoon.chat/en/blog/whatsapp-groups-in-construction/); [Zenzap](https://www.zenzap.co/blog-posts/5-best-work-chat-apps-for-construction/); [Banamind](https://banamind.ai/blog/whatsapp-groups-construction-teams-best-practices)
- **פרקליט השטן:** מתחרים חדשים רבים, והכללים והעלויות של ה-API של WhatsApp Business של Meta מגבילים את מה שאפשר לבנות.

#### P19–P22: נפסלו
- שיבוץ אחיות: רוכש ארגוני (בית חולים), עם שחקנים ותיקים (‏API, ‏ShiftWizard, ‏Bid Shift). — [allnurses](https://allnurses.com/what-kind-scheduling-use-work-t622583/)
- איחורי תשלום לפרילנסרים: נכונות נמוכה לשלם; הפתרון שבקונצנזוס ב-HN הוא חוזי (מקדמות, הפסקת עבודה). — [HN 47638685](https://news.ycombinator.com/item?id=47638685)
- מעקב רישיונות: מקבל מענה מ-ContractorComply, ‏TrackMyVendor, ‏AceWatt ומתבניות גיליון. — [TrackMyVendor](https://trackmyvendor.com/); [AceWatt](https://acewatt.com/blog/electrical-contractor-certification-tracking-software)
- ועדי בתים: כלים חינמיים ובתעריף קבוע. — [KindHOA](https://kindhoa.com/alternatives/best-self-managed-hoa-software)

### מסקנות
- **ממצא-על:** ב-2025–26, סטארטאפים של חילוץ נתונים וסוכני AI, יחד עם בלוגי "חלופות" מונעי SEO, הציפו כמעט כל נישה של "לרדוף אחרי מסמך / לעקוב אחרי פקיעת תוקף" (‏COI, ויתורי שעבוד, רישיונות, המתנה, תקרות שכר דירה). כאב לבדו כבר לא מבדיל בין הזדמנויות. **הפצה ונקודת כניסה ספציפית** (תת-פלח שהמובילים מתעלמים ממנו, רגולציה חדשה, גאוגרפיה שאינה ארה"ב) חשובות יותר.
- עבור מייסד ישראלי יחיד או צוות קטן, שלושת השורדים בתנאים כולם **ספציפיים לארה"ב** (חוק קליפורניה, הובלות בארה"ב, חוזי בנייה בארה"ב). אפשרות אחת שלא נבדקה היא להעתיק דפוס מוכח (למשל מעקב COI/ציות ספקים, פורטל רדיפת מסמכים למנהלי חשבונות, תיעוד שטח מבוסס WhatsApp) אל **ישראל/עברית או שווקים אחרים מחוץ לארה"ב**, שבהם ספקים כמו TrustLayer, ‏Content Snare או Clearstory אולי לא יבצעו לוקליזציה. זה לא נבדק: לא נאספו ראיות על פערים בשוק הישראלי.
- כאבים שבהם הקונים **כבר משלמים לאדם** (חברות BPO לאימות זכאות בשיניים, בודקי COI של ISN/PICS, מיקור חוץ של מעקב אישורים, שירותי עיבוד עמלות ב-$187 לחודש) מראים את הנכונות הברורה ביותר לשלם, אבל הם גם המקום שבו מתרכזים סטארטאפי AI ממומנים.

### פערים
- המימון של רבים מהספקים שהוזכרו (‏TrustLayer, ‏myCOI, ‏Billy, ‏Valoon, ‏DockClaim, ‏LeaseBase, ‏Voosh) לא אומת.
- נתון תשלומי ההמתנה של ATRI ונתוני סקר WebPT 2024 נצפו רק דרך ציטוטים של ספקים.
- מועדי התחולה של AB 2801 סותרים בין המקורות. החוק עצמו (Civ. Code §1950.5) לא נבדק.
- אין הערכת גודל כמותית לשורדים בתנאים (מספר המשכירים הקטנים בקליפורניה, הנהגים-בעלי משאית, קבלני המשנה המתמחים).
- גרסאות ישראליות/מקומיות של הכאבים האלה לא נחקרו; מחוץ להיקף כפי שנבדק.
