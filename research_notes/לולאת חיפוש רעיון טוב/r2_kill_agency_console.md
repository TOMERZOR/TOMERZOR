# בדיקת הריגה: קונסולת תפעול לסוכנויות ופרילנסרים של אוטומציית AI (צי n8n ואחר כך Make, Zapier, Vapi ו-Retell)

> תאריך: 2026-10-24. **מגבלה מתודולוגית:** WebFetch נכשל בשגיאת DNS, ו-curl נחסם ב-proxy (403) על כל הדומיינים שניסיתי (community.n8n.io, nordflux.de). לכן **כל הממצאים מבוססים על תקצירי WebSearch** ולא על קריאה מלאה של הדפים.
> **סימון:** **[מאומת]** = מקור ראשי (תיעוד רשמי, דף מוצר, פוסט של המייסד או החברה) כפי שהופיע בתקציר. **[צד ג']** = בלוג, אגרגטור או ספק מתחרה. **[הסקה]** = מסקנה שלי.
> מקור הרעיון: מועמדים 2 ו-3 ב-r2_ai_builders.md (קונסולת צי n8n ופורטל ROI). שם הם קיבלו 5/9, והומלץ למזג אותם.

## קריטריון 3: האם יש פתרון חינמי, מובנה או מתחרה? (Flotilla, n8ops, Getflowetic, Crossnode, מארחים מנוהלים ו-n8n עצמו)

### Takeaway
**נכשל.** מצאתי לפחות 14 מוצרים שנוגעים בדיוק בבעיה, רובם הושקו ב-2026. ארבעה מהם חינמיים או קוד פתוח: AgeniusDesk CE, FlowEngine, תבניות n8n ו-Pulse. מארחים מנוהלים, ובראשם Elestio עם דף ייעודי לסוכנויות, כבר פותרים טלאים, גיבויים וניטור לכל לקוח מדשבורד אחד. מעבר לכך, ה-FAQ של רישיון n8n מפנה מפורשות את "ניהול n8n בכמה סביבות לקוח" לתוכנית שותפים של n8n.

### Cited Findings
**ניהול צי ו-multi-instance:**
- **Flotilla** [מאומת, פוסט המייסד]: דוחף "golden workflow" לכל instance ומזריק לכל לקוח את ה-credentials והמשתנים שלו. מזהה drift בעזרת hash קנוני, מתריע על כשלים ושולח "the report that defends the retainer". יש free tier לשני instances. מחיר בתשלום לא נמצא. הפוסט בן כ-134 יום, ואין ביקורות עצמאיות. למעשה Flotilla כבר מכסה כמעט את כל הרעיון (צי, drift, התראות ודוח שמצדיק retainer) — [n8n community](https://community.n8n.io/t/built-a-fleet-manager-for-agencies-running-n8n-across-many-client-instances/299179)
- **AgeniusDesk CE** [מאומת, הכרזת היוצר]: control plane חינמי בקוד פתוח (MIT) לניהול מספר בלתי מוגבל של instances של n8n לפי URL ו-API key. כולל פיד שגיאות חוצה-instances ו-deploy ב-Docker בלחיצה — [n8n community](https://community.n8n.io/t/ageniusdesk-ce-a-free-open-source-control-plane-for-running-multiple-n8n-instances/301089), [Skool AI Automation Society](https://www.skool.com/ai-automation-society/one-dashboard-to-rule-every-n8n-instance-you-run-free-open-source)
- **Administrate (administrate.dev)** [מאומת, בלוג החברה ו-SDK]: "a single dashboard for your entire n8n fleet, organised by client". כולל ניטור multi-instance, מעקב שגיאות, מעקב עלויות LLM ודוחות ROI ו-"time saved" ללקוח. white-label מופיע תחת "What's Coming Next". המוצר יצא מסוכנות Osher (אוסטרליה). מחיר לא נמצא — [administrate.dev](https://administrate.dev/), [osher blog](https://osher.com.au/blog/ai-agency-software), [packagist SDK](https://root.packagist.org/packages/administrate/sdk)
- **FlowEngine** [מאומת, דף התבנית]: פורטל לקוח self-hosted לסוכנויות n8n (MIT + Commons Clause). כולל ניהול instances, הזמנת לקוחות, הגבלת מה שהם רואים, חיוב ב-Stripe, דחיפת תבניות ללקוחות וסקירת executions בכל ה-instances — [Railway template](https://railway.com/deploy/flowengine--dark-cool), [LinkedIn](https://linkedin.com/company/flowenginecloud)
- **Nodera** (אפליקציית מובייל): ניהול כמה instances של n8n, התראות בזמן אמת ו-retry לריצות שנכשלו [צד ג', דף חנות] — [mwm.ai](https://mwm.ai/apps/nodera/6758625563)
- MCP server בקוד פתוח לניטור n8n עם תמיכה multi-tenant (instance לפי header) והתראות על failure rate [צד ג'] — [glama](https://glama.ai/mcp/servers/lx4zq8dm48)

**ניטור כשלים, כולל כשלים שקטים:**
- **n8ops** [מאומת, Product Hunt]: המייסד ניהל סוכנות עם 20 לקוחות n8n קבועים ובנה את הכלי כי גילה כשלים רק כשלקוחות התלוננו — [Product Hunt](https://www.producthunt.com/products/n8ops), [village.ai](https://village.ai/company/n8ops)
- **OpsVeritas** [צד ג', hunted.space]: מנטר n8n, Make, Zapier, GitHub Actions ו-AWS Step Functions. מזהה כשל תוך 3 דקות, מספק אבחון AI, מזהה ריצות ריקות ו"stale", עוקב אחרי MTTR ושולח digest שבועי. free plan של 10 workflows — [hunted.space](https://www.hunted.space/product/opsveritas), [n8n community](https://community.n8n.io/t/opsveritas-monitors-your-n8n-workflows-and-alerts-you-when-they-fail-silently/296590?tl=es)
- **Flowlert** [צד ג']: n8n, Make ו-Zapier, כולל כשלים שקטים. חינם עד 5 workflows — [hunted.space](https://hunted.space/product/flowlert)
- **RootBrief** [צד ג']: n8n, Zapier ו-Make. free tier, ו-**Pro מ-$19 לחודש** — [Product Hunt](https://www.producthunt.com/p/rootbrief)
- **Pulse** [מאומת, פוסט היוצר]: דשבורד ניטור ל-n8n שמזהה ריצות "מוצלחות" עם 0 תוצאות ותזמונים שהוחמצו — [n8n community](https://community.n8n.io/t/built-pulse-a-real-time-monitoring-dashboard-for-n8n-workflows-with-ai-powered-error-explanations/300894?tl=en)
- תבנית חינמית של n8n: polling ל-API כל דקה, סיווג שגיאות, לוג ל-Google Sheets והתראה ב-Slack — [n8n.io template 14964](https://n8n.io/workflows/14964-monitor-workflow-errors-with-n8n-api-log-to-google-sheets-and-alert-via-slack/)

**פורטל לקוח ודוחות ROI:**
- **Getflowetic** [מאומת, G2]: פורטל white-label לסוכנויות שמחבר Vapi, Retell, Make ו-n8n, כולל Stripe Connect. אפס ביקורות ב-G2 — [G2](https://www.g2.com/sellers/getflowetic)
- **Crossnode** [מאומת, פוסט בקהילה]: פורטלים white-label, חיוב, ניהול credentials ו-deploy לכמה לקוחות. בבטא, בלי מחיר — [n8n community](https://community.n8n.io/t/turn-your-n8n-workflows-into-client-facing-products-ai-powered/244169), [completeaitraining](https://completeaitraining.com/ai-tools/crossnode/)
- **Vapify ו-VoiceAIWrapper** (שכבת הקול): Vapify הוא שותף רשמי של Retell עם דשבורד לקוח לסוכנים, שימוש וחיוב. לפי ספקים מתחרים, טווח המחירים של עטיפות כאלה הוא $29–$499 לחודש — [Retell partner page](https://www.retellai.com/partner/vapify), [trillet](https://www.trillet.ai/blogs/vapi-alternative-for-agencies) [צד ג', מתחרה]
- AgencyAnalytics ו-Zoho Analytics מציעים דוחות white-label כלליים לסוכנויות [צד ג'] — [monetizebot / search summary](https://monetizebot.ai/blogs/ai-automation-agency-roi-reporting-2026)

**מארחים מנוהלים (טלאים וגיבויים):**
- **Elestio for Agencies** [מאומת, דף החברה]: סביבה מבודדת לכל לקוח על VM ייעודי, הכול מדשבורד אחד, "white-label friendly". כולל SSL, גיבויים, עדכונים וניטור אוטומטיים, ו-n8n מופיע ברשימה. לפי דף הפלטפורמה, עדכוני תוכנה ומערכת הפעלה מוחלים אוטומטית עם rollback, ויש גיבוי יומי ושחזור בלחיצה. מחיר מ-$11 לחודש — [elest.io/for-agencies](https://elest.io/for-agencies), [elest.io managed devops](https://elest.io/managed-devops-platform), [elest.io n8n](https://elest.io/open-source/n8n)
- **Hostinger Managed n8n** [מאומת, מרכז העזרה]: "automatic software updates", גיבויים עם שחזור והורדה לפי תאריך ושעה, ותצוגה של גרסת n8n המותקנת — [Hostinger support](https://www.hostinger.com/support/hostinger-managed-n8n-overview-and-setup/), [Hostinger manage](https://www.hostinger.com/support/hostinger-managed-n8n-how-to-manage-your-application-on-hpanel/)
- Sliplane: אירוח מ-€9 לחודש עם ניטור ולוגים [צד ג'] — [sliplane](https://sliplane-frontend.sliplane.app/n8n-hosting)
- גיבוי ל-Git: יש תבניות n8n חינמיות רבות שמגבות workflows ל-GitHub, ותבנית Railway שמגבה workflows ו-credentials ל-Git לפי cron — [n8n template 14925](https://n8n.io/workflows/14925-sync-self-hosted-workflow-backups-to-github-for-version-control/), [n8n template 4064](https://n8n.io/workflows/4064-automated-daily-workflow-backup-to-github/), [Railway](https://railway.com/deploy/n8n-git-backups.md)

**n8n עצמו:**
- Insights: באנר של 7 ימים בכל התוכניות. הדשבורד המלא רק ב-Pro, Business ו-Enterprise. "Time saved" מוגדר per-workflow, וקיים גם Time Saved node — [n8n docs insights](https://docs.n8n.io/insights) [מאומת], [createwith](https://www.createwith.com/tool/n8n/updates/n8n-introduces-time-saved-node) [צד ג']
- Log streaming (webhook, syslog, sentry) זמין מ-v2.19.0, ולפי מראה קוד דורש רישיון — [n8n docs log streaming](https://docs.n8n.io/log-streaming/) [מאומת]
- Git source control רק ב-Business ומעלה — [getorchestra](https://www.getorchestra.io/guides/n8n-marketing-agency) [צד ג']
- **ה-FAQ של רישיון n8n:** מי שרוצה לנהל n8n בכמה סביבות לקוח צריך לפנות ל-license@n8n.io, ושם מוזכרת **תוכנית שותפים שמכסה multi-instance management** (המשפט נחתך בתקציר) — [n8n license FAQ](https://docs.n8n.io/n8n-community-license/community-license/license-faq) [מאומת, חלקי]
- בקהילה יש בקשה ל"agency tier" (instance-אם, workspaces ללקוחות ומחיר בסיס + per-client). זו הצעה של משתמש ולא תוכנית רשמית — [n8n community](https://community.n8n.io/t/new-pricing-plan-for-agencies/247356?tl=en)

### Inferences
- [הסקה] בתוך כ-12 חודשים קמו לפחות 14 כלים בקטגוריה. **אף אחד מהם לא הראה traction ציבורי**: אין ביקורות, אין מחיר בתשלום מפורסם מעבר ל-$19, ואין MRR. זה הדפוס של "קל לבנות, קשה למכור". הבעיה אמיתית, אבל הכלים זמינים כמעט בחינם, כי כל מפתח בסוכנות יכול לבנות כזה בסוף שבוע.
- [הסקה] רכיב הטלאים והגיבויים, שהוא המבדל הכי "כבד", כבר נמכר בחבילה עם האירוח (Elestio מ-$11 לכל instance, Hostinger). סוכנות שמשלמת לאירוח מנוהל לא צריכה קונסולה בשביל טלאים.
- [הסקה] לפי הלקח של v3 ("רגולציה או אירוע חדש מייצרים קודם כלי חינמי ופיצ'ר אצל האינקומבנט"), כאן זה כבר קרה: CVE → אירוח מנוהל + תבניות חינמיות + AgeniusDesk CE.

### Gaps
- לא נמצאו מחירים בתשלום של Flotilla, n8ops, Administrate, OpsVeritas, Getflowetic ו-Crossnode, וגם לא מספרי לקוחות משלמים.
- לא הצלחתי לקרוא את המשך ה-FAQ של n8n על תוכנית השותפים ל-multi-instance (WebFetch נכשל).
- לא נבדק בעברית. כנראה פחות רלוונטי, כי השוק גלובלי.

## קריטריון 1: משלם מזוהה שכבר משלם (WTP)

### Takeaway
**חלקי, נוטה לכישלון.** הסוכנות היא משלם ברור עם retainer מלקוחות, אבל אין ראיה שסוכנויות משלמות על כלי תפעול מסוג זה מעבר ל-$0–19. הכסף שהן כן מוציאות הולך לאירוח מנוהל, שכבר כולל טלאים וגיבויים, ולעטיפות קוליות ($29–499).

### Cited Findings
- retainers של סוכנויות אוטומציה: $500 עד $20,000+ לחודש, ובמקור אחר $1,000–$12,000. ה-$5K ללקוח הוא הקצה העליון [צד ג', תוכן שיווקי של קורסים וספקים] — [Medium automation.labs](https://medium.com/@automation.labs/ai-automation-agencies-charge-5k-a-client-few-get-five-f0e9ad0b5dde), [taskip](https://taskip.net/ai-automation-agency-pricing.md), [codewave](https://codewave.com/feeds/blog/ai-automation-agency-pricing)
- מרווחי retainer של 70–90% לפי ספקים, כשעלות הבסיס היא בעיקר עבודה ו"a few subscriptions". הצוואר הוא מכירה, לא בנייה [צד ג'] — [betonai](https://betonai.net/the-ai-automation-retainer-playbook-2026-how-solo-operators-lock-in-1500-10000-month-clients/), [Medium](https://medium.com/@automation.labs/ai-automation-agencies-charge-5k-a-client-few-get-five-f0e9ad0b5dde)
- מחירי כלים מתחרים שנמצאו: RootBrief Pro מ-$19 לחודש. OpsVeritas, Flowlert ו-Flotilla בחינם עד 10, 5 ו-2 יחידות. אין מחיר בתשלום מפורסם אחר — [Product Hunt RootBrief](https://www.producthunt.com/p/rootbrief), [hunted.space OpsVeritas](https://www.hunted.space/product/opsveritas), [hunted.space Flowlert](https://hunted.space/product/flowlert)
- עלות עוקפים קיימים: Elestio מ-$11 לחודש כולל טלאים, גיבוי וניטור. VPS ב-€4–12 לחודש. n8n Business ב-€667 לחודש בשביל Git — [elest.io](https://elest.io/managed-devops-platform), [sliplane](https://sliplane.io/blog/self-hosted-managed-cloud-n8n-comparison), [activepieces](https://www.activepieces.com/blog/n8n-pricing-2026-plans-free-tier-costs-explained.md)
- עטיפות white-label לקול (Vapi/Retell): $29–$499 לחודש. כאן יש WTP מוכח יותר, כי Vapi ו-Retell לא מציעים white-label [צד ג', ספק מתחרה] — [trillet](https://trillet.ai/blogs/build-on-vapi-retell-vs-buy-white-label)

### Inferences
- [הסקה] מחיר המטרה של $49–299 לחודש לסוכנות גבוה פי 2.5–15 מהמחיר היחיד שמצאתי בקטגוריה ($19), ונמוך מעלות שעת עבודה של מפתח בסוכנות. רוב המתחרים מתמחרים בחינם כדי לאסוף משתמשים. זה סימן שאין עדיין WTP מוכח.
- [הסקה] היחיד שמשלם בפועל הוא בשכבת הקול. אבל זה שוק אחר, רווי עטיפות (Vapify, VoiceAIWrapper, ChatDash, Trillet), שמתחרה על העברת חיוב ולא על תפעול.

### Gaps
- אין נתון על הוצאה ממוצעת של סוכנות אוטומציה על tooling.
- לא נמצא אף כלי בקטגוריה עם MRR ציבורי (נבדק גם TrustMRR, בלי תוצאה רלוונטית).

## קריטריון 2: תדירות

### Takeaway
**עובר.** ניטור ודוח ללקוח הם צורך רציף, חודשי ומעלה. טלאי אבטחה הם אפיזודיים: CVE גדול כמה פעמים בשנה.

### Cited Findings
- כשלים שקטים הם בעיה רציפה: "silent workflow failures that we'd only discover when clients complained" [מאומת, מייסד n8ops] — [Product Hunt](https://www.producthunt.com/products/n8ops)
- בקהילת Make: תרחיש יכול להיכשל בלילה או בסוף שבוע בלי שאף אחד יקבל התראה [צד ג', פורום] — [Make community](https://community.make.com/t/how-to-best-manage-organise-multiple-clients-in-make/108163)
- שישה CVE ב-n8n ברבעון 1 של 2026 [צד ג'] — [canadianwebhosting](https://blog.canadianwebhosting.com/n8n-critical-cves-q1-2026-security-hardening/), [CSA](https://labs.cloudsecurityalliance.org/wp-content/uploads/2026/03/CSA_research_note_n8n_rce_ai_pipeline_attack_surface_20260312-csa-styled.pdf)

### Inferences
- [הסקה] התדירות מתאימה למנוי, אבל הדחיפות (טלאים) אפיזודית ולא מספיקה כדי לשמור לקוח בחודשים שקטים.

### Gaps
- אין.

## קריטריון 4: פער מוסבר (למה המתחרים לא משרתים את הפלח?)

### Takeaway
**נכשל.** אין פער: הפלח משורת-יתר. n8n מתמקד ב-enterprise, וזה נשמע כמו פער, אבל המקום התמלא תוך שנה בכלים קטנים, וחלקם חינמיים. בנוסף, n8n מסמן את ניהול ה-multi-instance לסוכנויות כשטח שלו דרך תוכנית שותפים.

### Cited Findings
- יותר מ-14 כלים בקטגוריה (ראו קריטריון 3), כולל כלים חוצי-פלטפורמות (OpsVeritas, Flowlert ו-RootBrief מכסים n8n, Make ו-Zapier) — [hunted.space](https://www.hunted.space/product/opsveritas), [hunted.space](https://hunted.space/product/flowlert)
- n8n מפנה "multi client environments" לתוכנית שותפים [מאומת, חלקי] — [n8n license FAQ](https://docs.n8n.io/n8n-community-license/community-license/license-faq)
- n8n מגייס Head of Agency Partnerships, ויש לו backlog של יותר מ-2,000 בקשות של סוכנויות. החברה משקיעה בפלח הסוכנויות באופן אקטיבי [מאומת, משרה] — [workingnomads](https://www.workingnomads.com/jobs/head-of-agency-partnerships-n8n), [redpoint careers](https://careers.redpoint.com/companies/n8n-2-91d84904-994a-4de3-95e6-b6147df914fe/jobs/62297375-head-of-agency-partnerships-remote-europe)
- Elestio מכוון במפורש לסוכנויות עם n8n — [elest.io/for-agencies](https://elest.io/for-agencies)

### Inferences
- [הסקה] היתרון המוצהר, "חוצה-פלטפורמות" (n8n + Make + Zapier + Vapi), כבר קיים אצל OpsVeritas, Flowlert ו-RootBrief בצד הניטור, ואצל Getflowetic בצד הפורטל. אין עוגן ייחודי.

### Gaps
- לא ידוע אם תוכנית השותפים של n8n כוללת כבר כלי ניהול multi-instance בפועל, או רק רישוי.

## קריטריון 5: ערוץ הפצה למייסד יחיד

### Takeaway
**עובר.** הקהילות ענקיות ונגישות: פורום n8n, Skool וקטגוריית "Built with n8n". אבל אותו ערוץ פתוח לכל 14 המתחרים, שכבר מפרסמים שם. הערוץ קל, הבידול קשה.

### Cited Findings
- AI Automation Society (Skool): כ-360K חברים. AAA Hub: כ-311K–325K [צד ג', מתוך r2_ai_builders] — [Skool post](https://www.skool.com/fastest-growing-skool-4887/why-ai-automation-society-is-the-fastest-growing-skool-community-right-now-2), [aifunnelinsider](https://aifunnelinsider.com/ai-automation-agency-hub-review-2026/)
- פורום n8n: 30K+ חברים [צד ג', לא מאומת] — [inferencebysequoia](https://inferencebysequoia.substack.com/p/best-content-and-community-resources)
- n8n מפתח creator program ו-marketplace תבניות ("ongoing project") [מאומת] — [n8n docs contribute](https://docs.n8n.io/contributing/)
- המתחרים משיקים בדיוק בערוצים האלה: Flotilla, AgeniusDesk, OpsVeritas, Pulse ו-Crossnode בפורום n8n, ו-AgeniusDesk גם ב-Skool — [n8n community](https://community.n8n.io/t/ageniusdesk-ce-a-free-open-source-control-plane-for-running-multiple-n8n-instances/301089), [Skool](https://www.skool.com/ai-automation-society/one-dashboard-to-rule-every-n8n-instance-you-run-free-open-source)

### Inferences
- [הסקה] אפשר להגיע ל-10 משתמשי free tier בחודש. השאלה היא אם אפשר להגיע ל-10 **משלמים**, כשמוצר MIT חינמי מתפרסם באותו פיד.

### Gaps
- אין נתון על שיעור המרה ממשתמש חינמי לתשלום אצל אף מתחרה.

## קריטריון 6: גודל (כמה סוכנויות עם לקוחות משלמים ועם צי instances)

### Takeaway
**לא ידוע, נוטה לקטן.** האוכלוסייה הרחבה גדולה: כ-230K כתובות IP עם n8n וקהילות של 300K+. אבל הפלח הרלוונטי, סוכנויות עם 5+ לקוחות שמריצים self-hosted ושלא משתמשות באירוח מנוהל, כנראה באלפים בודדים לכל היותר. מספר השותפים הרשמי של n8n הוא כ-170.

### Cited Findings
- Shadowserver, 9.1.2026: נסרקו 230,562 כתובות IP עם n8n, מתוכן 105,753 פגיעות (כ-46%) — [gbhackers](https://gbhackers.com/over-100000-internet-exposed-n8n-instances/amp/) [צד ג' שמצטט את Shadowserver]
- הירידה במספר ה-instances הלא מעודכנים: כ-59.5K באמצע ינואר, ו-24.7K בתחילת פברואר 2026. Censys ספרה כ-26.5K — [techradar](https://www.techradar.com/pro/security/thousands-of-n8n-instances-under-threat-from-top-security-issue), [Censys](https://censys.com/advisory/cve-2026-21858), [cybersecuritydive](https://www.cybersecuritydive.com/news/critical-vulnerability-n8n-automation-platform/809360/)
- n8n: יותר מ-170 system integrators וסוכנויות בתוכנית Experts Partner, ו-backlog של יותר מ-2,000 בקשות [מאומת, משרות; התאריך לא ברור] — [growthtalent](https://www.growthtalent.org/emplois/partnerships/n8n/senior-partner-marketing-manager-n8n), [workingnomads](https://www.workingnomads.com/jobs/head-of-agency-partnerships-n8n)
- n8n: כ-$40M ARR (Sacra, יולי 2025), 230K+ משתמשים פעילים, ושווי $5.2B ב-secondary של SAP במאי 2026. אין נתון רשמי ל-ARR של 2026 — [Sacra](https://sacra.com/c/n8n/), [multiples.vc](https://multiples.vc/private-comps/n8n), [valueaddvc](https://valueaddvc.com/blog/n8n-valuation-2026-5-2b-40m-arr-and-how-it-compares-to-zapier-and-make)
- Upwork: "AI Integration & Automation" צמח ביותר מ-90% ב-2025, אבל אין נתון ספציפי ל-n8n [צד ג'] — [gigradar](https://gigradar.io/blog/upwork-market-report-2026)
- Make: שלוש דרגות שותפים (Silver, Gold, Platinum), בלי מספר רשמי של סוכנויות — [make.com partners](https://www.make.com/en/partners), [Make community](https://community.make.com/t/gold-silver-partner/15433)

### Inferences
- [הסקה] חשבון גס: 230K IP כוללים הרבה instances של hobbyists, חברות פנימיות ו-dev. גם אם 5–10% מהם מנוהלים על ידי סוכנויות, ובממוצע 5–10 instances לסוכנות, יוצאות כ-1,000–5,000 סוכנויות עם צי self-hosted. ב-$100 לחודש ובחדירה של 10% זה $1.2M–6M ARR. מדובר בתקרה של lifestyle business, ובשוק שיש בו 14 מתחרים.
- [הסקה] הירידה מ-105K ל-24.7K instances פגיעים תוך פחות מחודש מראה שרוב המפעילים עדכנו בלי קונסולה. כאב הטלאים נפתר מהר גם בלי כלי.
- [הסקה] רוב חברי Skool הם "שואפים" ולא סוכנויות עם לקוחות. הכותרת "כמה מעטים מגיעים לחמישה לקוחות" (Medium) מחזקת את זה.

### Gaps
- אין נתון על חלוקת משתמשי n8n בין self-hosted ל-Cloud.
- אין ספירה רשמית של חברות ב-experts.n8n.io (הדף לא נקרא).
- אין נתון על מספר סוכנויות האוטומציה הפעילות בעולם.

## קריטריון 7: תלות בפלטפורמה (רישוי n8n, API, n8n יבנה בעצמו)

### Takeaway
**נכשל.** המוצר יושב על שלוש נקודות שבשליטת n8n: (1) הרישוי, כי ניהול instances של לקוחות הוא "אזור אפור", ו-n8n מפנה אותו לתוכנית שותפים; (2) ה-API הציבורי, שאין בו endpoint להרצת workflow והוא משכתב workflows בשמירה; (3) פיצ'רים שאפשר "להוריד" לתוכניות זולות (Insights, Git, Log streaming).

### Cited Findings
- **Sustainable Use License:** מותר להשתמש לצרכים פנימיים ולייעוץ, ולבנות workflows ללקוחות ולגבות על כך. אסור לעשות white-label ל-n8n או לארח n8n ולמכור גישה. instance משותף לכמה לקוחות דורש לפי מקורות רישיון Enterprise או Embed [צד ג', nordflux ו-SSD Nodes] — [nordflux](https://nordflux.de/en/guides/may-my-agency-host-n8n-for-customers-fair-code-resale-gray-area-customer-access), [ssdnodes](https://www.ssdnodes.com/learn/n8n-sustainable-use-license-explained)
- ה-FAQ הרשמי: יועץ יכול להריץ instance משותף עם credentials של הלקוח, **רק אם הלקוחות לא יכולים לבנות או לשנות workflows**. ניהול בכמה סביבות לקוח עובר דרך license@n8n.io ותוכנית שותפים [מאומת, חלקי] — [n8n license FAQ](https://docs.n8n.io/n8n-community-license/community-license/license-faq)
- תשובה של צוות n8n בפורום: בניית workflows ללקוחות וגבייה עליהם מותרת בלי רישיון נפרד. instances ב-Cloud מיועדים לשימוש פנימי — [n8n community](https://community.n8n.io/t/can-i-use-n8n-cloud-to-manage-workflows-for-multiple-consulting-clients/236130?tl=en), [n8n community licensing](https://community.n8n.io/t/question-about-licensing/13025)
- רישיון Embed: כ-$50K לשנה (מקור יחיד) — [goodspeed](https://goodspeed.studio/blog/n8n-pricing)
- מגבלות API לפי מייסד Flotilla: n8n משכתב workflows בשמירה, צומתי webhook צריכים webhook ID שה-API לא מוסיף, ו-"the public API has no 'run workflow' endpoint". לפי תבנית גיבוי, "the API isn't officially supported" לחלק מהשימושים — [n8n community Flotilla](https://community.n8n.io/t/built-a-fleet-manager-for-agencies-running-n8n-across-many-client-instances/299179), [n8n template 14925](https://n8n.io/workflows/14925-sync-self-hosted-workflow-backups-to-github-for-version-control/)
- Insights API: לפי תשובה בפורום, נדרש "minimum Pro subscription" — [n8n community](https://community.n8n.io/t/n8n-metrics/305330)

### Inferences
- [הסקה] אם n8n משיק "Agency plan" עם workspaces ללקוחות ואת Insights, הוא מוחק את רוב הערך ביום אחד. ההצעה כבר עלתה בפורום, ו-n8n מגייס ראש שותפויות סוכנויות.
- [הסקה] ההרחבה ל-Make, Zapier ו-Vapi מפזרת את הסיכון אבל מכפילה את עבודת האינטגרציה. בנוסף, Make ו-Zapier מאפשרים לסוכנויות להפריד לקוחות ב-Teams או ב-Organizations, כך שהכאב שם קטן יותר — [Make community](https://community.make.com/t/how-to-best-manage-organise-multiple-clients-in-make/108163)

### Gaps
- לא נקרא נוסח הרישיון המלא ולא הסעיף על תוכנית השותפים.

## קריטריון 8: התאמה למייסד

### Takeaway
**עובר, ודווקא זו בעיה.** MVP בשבועיים אפשרי: polling ל-API של n8n, דשבורד, התראות ו-PDF. אותה קלות הולידה 14 מתחרים ומוצרי MIT חינמיים.

### Cited Findings
- AgeniusDesk ו-FlowEngine נבנו כקוד פתוח על ידי מפתחים יחידים או צוותים קטנים. Administrate יצא מתוך סוכנות שה"גיליון שלה נשבר" — [n8n community AgeniusDesk](https://community.n8n.io/t/ageniusdesk-ce-a-free-open-source-control-plane-for-running-multiple-n8n-instances/301089), [osher](https://osher.com.au/blog/ai-agency-software)

### Inferences
- [הסקה] אין חפיר טכני. כל יתרון יהיה הפצה או מותג, ובשניהם אין למייסד ישראלי יחיד יתרון מובנה מול מייסדים מתוך הקהילה, כמו n8ops שהגיע מסוכנות עם 20 לקוחות.

### Gaps
- אין.

## קריטריון 9: פרקליט שטן

### Takeaway
**נכשל.** שלושה מארבעת טיעוני הנגד מנצחים: (א) קומודיטי עם 14 מתחרים וכלים חינמיים; (ב) n8n ומארחים מנוהלים בולעים את הערך; (ג) הסוכנויות קטנות והשוק שלהן לא בשל. הטיעון שהגל הוא "אופנה" לא מוכרע.

### Cited Findings
- "סוכנויות קטנות ונוטשות": הצוואר של הסוכנויות הוא מכירה. מעטות מגיעות לחמישה לקוחות. נטישת לקוחות מוערכת ב-25% בחודשים 1–3, נתון בלי מקור [צד ג'] — [Medium](https://medium.com/@automation.labs/ai-automation-agencies-charge-5k-a-client-few-get-five-f0e9ad0b5dde), [betonai](https://betonai.net/the-ai-automation-retainer-playbook-2026-how-solo-operators-lock-in-1500-10000-month-clients/)
- "הגל הוא אופנה": סיכומים של Reddit אומרים "AAA is saturated with noise". שוק הקורסים רווי, אבל שוק המסירה האמיתית לא רווי [צד ג', בלוגים של ספקים] — [ciela](https://ciela.ai/blogs/smma-vs-ai-automation-agency-reddit), [ertas](https://www.ertas.ai/blog/start-ai-agency)
- "רובן ב-n8n Cloud או באירוח מנוהל": Hostinger ו-Elestio מנהלים עדכונים וגיבויים, ו-n8n Cloud מתעדכן אוטומטית — [Hostinger](https://www.hostinger.com/support/hostinger-managed-n8n-overview-and-setup/), [elest.io](https://elest.io/for-agencies), [growwstacks n8n 2.0](https://growwstacks.com/blog/n8n-2-update-breaking-changes)
- "n8n יבנה את זה": הפניה לתוכנית שותפים ל-multi-instance, גיוס ראש שותפויות סוכנויות, ובקשת "agency tier" בפורום — [n8n license FAQ](https://docs.n8n.io/n8n-community-license/community-license/license-faq), [workingnomads](https://www.workingnomads.com/jobs/head-of-agency-partnerships-n8n), [n8n community](https://community.n8n.io/t/new-pricing-plan-for-agencies/247356?tl=en)
- טיעון בעד: הכאב אמיתי ומתועד אצל מפעילים. "the same workflow change redone on every instance", ובעיית גרסאות שונות כשמשתמשים ב-:latest — [n8n community multi-tenant](https://community.n8n.io/t/how-i-handle-multi-tenant-n8n-for-agency-clients-isolated-instance-per-client-shared-updates/301614)

### Inferences
- [הסקה] הטיעון החזק ביותר נגד הוא לא "n8n יבנה את זה", אלא ש**הקטגוריה כבר קיימת ולא מייצרת כסף**: 14 כלים, אפס ביקורות ואפס MRR ציבורי. כשמוצר שכבר עשה את כל מה שבפיץ' (Flotilla) נותן free tier ולא מפרסם מחיר, זה סימן ל-WTP חלש.

### Gaps
- לא ידוע אם Flotilla, n8ops או Administrate מרוויחים בשקט. אולי יש להם עשרות לקוחות משלמים שלא פורסמו.

## הכרעה: PASS / FAIL / CONDITIONAL

### Takeaway
**FAIL (3.5–4/9).** ציון: 1~ | 2✓ | 3✗ | 4✗ | 5✓ | 6~ | 7✗ | 8✓ | 9✗. הרעיון מת בגלל קריטריונים 3 ו-4: הקטגוריה התמלאה ב-2026 בכ-14 כלים, חלקם חינמיים, ואירוח מנוהל כבר פותר טלאים וגיבויים. קריטריון 7 מחזק את המסקנה, כי n8n מסמן ניהול multi-instance לסוכנויות כשטח של תוכנית השותפים שלו.

### Cited Findings
- כל המקורות בסעיפים למעלה. העיקריים: [Flotilla](https://community.n8n.io/t/built-a-fleet-manager-for-agencies-running-n8n-across-many-client-instances/299179), [AgeniusDesk CE](https://community.n8n.io/t/ageniusdesk-ce-a-free-open-source-control-plane-for-running-multiple-n8n-instances/301089), [Administrate](https://administrate.dev/), [Elestio for agencies](https://elest.io/for-agencies), [n8n license FAQ](https://docs.n8n.io/n8n-community-license/community-license/license-faq), [RootBrief $19](https://www.producthunt.com/p/rootbrief)

### Inferences
- [הסקה] **אם בכל זאת רוצים להמשיך (CONDITIONAL), יש נעלם אחד:** האם סוכנויות ישלמו $99+ לחודש על כלי כזה כשיש חלופות חינמיות? **הבדיקה הזולה ביותר (שבוע אחד, $0):** (1) לפנות ישירות למייסדים של Flotilla, n8ops ו-Administrate ולשאול כמה לקוחות משלמים יש להם ובאיזה מחיר; אם אף אחד לא עבר 20 לקוחות משלמים, הרעיון מת סופית. (2) במקביל לפרסם בפורום n8n וב-Skool AI Automation Society דף מכירה מוקדמת ב-$99 לחודש, עם תשלום מראש לחודש הראשון, ממוקד בדוח ROI white-label + התראות לסוכנויות עם 5+ לקוחות. סף הצלחה: 10 תשלומים מראש תוך 14 יום. פחות מ-3 = FAIL סופי.
- [הסקה] הזווית היחידה שאולי לא נסגרה היא **דוח ה-ROI ללקוח הסופי** ("כמה הסוכן חסך החודש") כחוצה-פלטפורמות לסוכנויות קול (Vapi/Retell). שם ה-WTP מוכח יותר ($29–499 לעטיפות). אבל זו קטגוריה אחרת (עטיפות white-label לקול), עם Vapify, VoiceAIWrapper, Trillet ו-ChatDash. לא בדקתי אותה לעומק, ואני לא ממליץ עליה בלי בדיקת הריגה נפרדת.
- [הסקה] לקח לסבב הבא: "כלי ל-builders של פלטפורמה פופולרית" הוא קטגוריה שמתמלאת תוך חודשים, כי קהל היעד עצמו מורכב מבונים שבונים את הכלים בעצמם ומפרסמים אותם בחינם בקהילה. כדאי להוסיף את זה ללקחים ב-v3.

### Gaps
- לא נבדקו מספרי לקוחות משלמים בפועל של המתחרים. זו הבדיקה המכרעת.
- לא נקרא נוסח הרישיון המלא של n8n ותנאי תוכנית השותפים.
- כל הממצאים נשענים על תקצירי חיפוש, כי WebFetch נכשל.
