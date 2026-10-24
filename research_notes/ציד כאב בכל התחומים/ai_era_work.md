# כאבים חדשים/מוחרפים בגל ה-AI (2024–2026) — אנשים פרטיים ועובדי ידע

> הערת מתודולוגיה: כל הממצאים נאספו דרך WebSearch (מצב standard/extended). WebFetch נכשל בכל ניסיון (שגיאת DNS: ENOTFOUND עבור stackoverflow.blog, greenhouse.com, prnewswire.com, venturebeat.com), ולכן לא הצלחתי לקרוא את הדוחות המקוריים במלואם. חלק מהמספרים מגיעים מתקצירי חיפוש של מקורות משניים, וסימנתי סתירות במפורש. תאריך הייחוס: 2026-10-24.

## שאלה 0: רשימת הכאבים ופסק דין לכל אחד (תקציר מנהלים)

### Takeaway
מתוך 12 כאבים שנבדקו, רובם אמיתיים ומתועדים היטב, אבל רובם כבר צפופים מאוד (סקירת קוד AI, observability/evals, כלי auto-apply) או שהפלטפורמות הגדולות כבר בולעות אותם (Cloudflare בסריקת תוכן, Cursor/GitHub בסקירת קוד). 3 כאבים שורדים, ושלושתם בתנאים: (א) שכבת אמון/אימות מועמדים לגיוס מרחוק בחברות קטנות ובינוניות ובסוכנויות, (ב) אימות פלט AI בתחום ורטיקלי מסוים (ציטוטים ומקורות במסמכים מקצועיים), (ג) טריאז' ל"AI slop" אצל מתחזקי קוד פתוח ופרויקטים קטנים. גם ב-(ג) נכונות התשלום נמוכה.

### Cited Findings
טבלת סיכום. הראיות המלאות מופיעות בשאלות 1–5.

| # | כאב | חומרה (ראיה עיקרית) | מי משלם | עד כמה צפוף | פסק דין |
|---|-----|------|--------|--------|------|
| 1 | גייסים מוצפים במועמדויות שנכתבו ב-AI | 244 מועמדויות למשרה ב-2025, לעומת 115 ב-2022. עומס הגייס עלה ב-412% ([Greenhouse benchmark Mar 2026](https://cdn.prod.website-files.com/6668a687e71e2722fccb8357/69c6a67c710b821d52b0d5d3_Greenhouse_Benchmark_Report_March2026_NorthAmerica.pdf)) | מעסיקים | צפוף מאוד: כל ATS מוסיף סינון AI | DROPPED |
| 2 | מחפשי עבודה: "חור שחור", ghost jobs | 30% מהמשרות הפתוחות ביוני 2025 לא הסתיימו בגיוס ([CPA Practice Advisor/MyPerfectResume](https://www.cpapracticeadvisor.com/2025/11/12/ghost-jobs-up-to-1-in-3-job-listings-dont-result-in-hires/173044/)) | מחפשי עבודה (משלמים מעט ומתחלפים מהר) | צפוף מאוד (Teal, Simplify, Jobright, LazyApply, AIApply) | DROPPED |
| 3 | מועמדים מזויפים, deepfake, תעודות זהות מזויפות | Gartner: אחד מכל 4 פרופילים יהיה מזויף עד 2028 ([HR Dive](https://www.hrdive.com/news/fake-job-candidates-ai/757126/)). 31% מהמראיינים נתקלו בחשד ל-deepfake ([Greenhouse via search](https://hrtechedge.com/greenhouse-report-exposes-a-hiring-system-in-crisis-ai-hacks-fraud-fears-ghost-jobs-and-collapsing-trust/)) | מעסיקים, סוכנויות, פלטפורמות EOR | בינוני: ב-enterprise יש Persona, Deel+Clarity ו-Proof. ב-SMB ובסוכנויות דליל | SURVIVES (בתנאי) |
| 4 | פרילנסרים: מחיר הדאמפינג של AI בעבודות commodity | פרויקטי כתיבה ב-Upwork ירדו ב-32% בשנה (מקור משני) ([skillscouter](https://skillscouter.com/freelance-statistics/)) | הפרילנסר עצמו | — (אין כלי שמחזיר ביקוש) | DROPPED |
| 5 | פרילנסרים: תשלומים מאוחרים | 29% מהחשבוניות שולמו באיחור ([Bonsai](https://www.hellobonsai.com/blog/late-freelance-payment)) | פרילנסר | צפוף (Bonsai, HoneyBook, Plutio ועוד). כאב ישן, ה-AI לא החמיר אותו | DROPPED |
| 6 | יוצרים/מו"לים: סריקת תוכן ע"י AI ללא תנועה חוזרת | יחס סריקה להפניה: Anthropic כ-70,900:1, OpenAI כ-1,600:1 ([eWeek](https://www.eweek.com/de/news/cloudflare-expands-ai-crawler-control/)) | מו"לים | Cloudflare בולעת את התחום (pay-per-crawl, חסימה כברירת מחדל) | DROPPED |
| 7 | מפתחים: עומס סקירת PR-ים שנכתבו ב-AI | לפי Faros: 98% יותר PR-ים, 154% גדולים יותר, זמן סקירה +91% (משני) ([DEV](https://dev.to/max_quimby/four-horsemen-of-agent-prs-and-how-to-stop-them-bgk)) | חברות | צפוף מאוד: CodeRabbit ($60M), Greptile ($25M), Graphite נרכשה ע"י Cursor, Bugbot | DROPPED |
| 8 | מתחזקי קוד פתוח: הצפה ב-AI slop (PR-ים ודיווחי באגים) | curl סגרה את תוכנית ה-bug bounty. שיעור הדיווחים המאושרים ירד מכ-15% לפחות מ-5% ([BleepingComputer](https://bleepingcomputer.com/news/security/curl-ending-bug-bounty-program-after-flood-of-ai-slop-reports/)) | כמעט אף אחד (אולי קרנות או GitHub) | דליל, אבל GitHub שוקלת פיצ'רים משלה | SURVIVES כ-wedge בלבד / ספק כעסק |
| 9 | אבטחת קוד שנוצר ב-AI ושרתי MCP | 45% מהמשימות הניבו קוד פגיע ([Veracode](https://www.veracode.com/press-release/ai-generated-code-poses-major-security-risks-in-nearly-half-of-all-development-tasks-veracode-research-reveals/)). 5,832 מתוך 9,695 שרתי MCP פגיעים ([threatcluster](https://threatcluster.io/cluster/critical-vulnerabilities-found-in-thousands-of-mcp-servers-488d6a32)) | חברות (CISO) | צפוף: ספקי AppSec מבוססים כמו Veracode ו-Endor Labs | DROPPED לסולו פאונדר |
| 10 | Observability, evals ועלויות LLM | 36 סטארטאפים במעקב, עם $1.1B מימון ([NeuronFeed](https://neuronfeed.com/category/ai-observability)) | חברות | צפוף מאוד ובשלב קונסולידציה | DROPPED |
| 11 | "Workslop" ואימות פלט AI בעבודה (הזיות, ציטוטים) | 40% קיבלו workslop בחודש האחרון, כ-2 שעות לכל מקרה, $186 לעובד בחודש ([the-decoder](https://the-decoder.com/ai-generated-workslop-is-costing-companies-millions-and-hurting-team-morale-study-finds/)). כ-1,633 תיקי בית משפט עם הזיות ([UNC/MSBA via search](https://library.law.unc.edu/2026/06/handling-hallucinations-a-reflection/)) | חברות, משרדי עורכי דין | אופקית: המודלים עצמם בולעים את זה. ורטיקלית: דליל עד בינוני (CiteSentinel) | SURVIVES (ורטיקלי בלבד) |
| 12 | צוותים קטנים טובעים בריבוי כלי AI | 77.5% "אדישים או רגועים" אם חצי מכלי ה-AI ייעלמו (סקר ספק) ([ClickUp](https://clickup.com/blog/?p=494777)) | SMB | ראיות חלשות. ClickUp ו-Notion עצמן מוכרות קונסולידציה | DROPPED |

### Inferences
- הדפוס החוזר: איפה שה-AI מייצר נפח (מועמדויות, PR-ים, דיווחי באגים, מסמכים), צוואר הבקבוק עובר לתשומת לב אנושית ולאמון. הכלים ש"מייצרים יותר" צפופים. הכלים ש"מסננים" צפופים ב-enterprise. ההזדמנות שנשארת לסולו פאונדר היא אמון ואימות בנישה ורטיקלית או ב-SMB, שם ה-enterprise vendors לא מגיעים.
- כאבים של צרכנים פרטיים (מחפשי עבודה ופרילנסרים) הם חזקים רגשית אבל עם נכונות תשלום נמוכה ו-churn גבוה, כי מי שמוצא עבודה מבטל את המנוי. לכן הם פחות מתאימים למודל SaaS.

### Gaps
- לא נמצאו נתוני הכנסות או ARR אמינים לרוב כלי הצד של המועמד.
- לא בוצעה ספירה שיטתית של חברות YC לפי קטגוריה. ההערכה "צפוף" מבוססת על סבבי מימון ורשימות מעקב, לא על רשימות batch.

## שאלה 1: גיוס — שני הצדדים סובלים. האם השוק שבור באופן שעדיין לא נפתר?

### Takeaway
כן, השוק במצב "doom loop" מתועד: מועמדים משתמשים ב-AI כדי להציף, ומעסיקים משתמשים ב-AI כדי לסנן. האמון קרס (8% מהמועמדים חושבים שהתהליך הוגן). כלי הצד של המועמד והסינון בצד המעסיק צפופים מאוד. הפער הכי פחות פתור והכי "AI-native" הוא הונאת מועמדים (זהות מזויפת, deepfake, proxy interviews), ובעיקר בשוק ה-SMB והסוכנויות.

### Cited Findings
**היקף ההצפה (צד המעסיק)**
- לפי Greenhouse benchmark (מרץ 2026): המועמדויות למשרה עלו מכ-115 ב-2022 לכ-244 ב-2025, ומספר המועמדויות השנתי לגייס עלה בכ-412% (מ-146 ל-746) — [Greenhouse Benchmark Report March 2026 (PDF)](https://cdn.prod.website-files.com/6668a687e71e2722fccb8357/69c6a67c710b821d52b0d5d3_Greenhouse_Benchmark_Report_March2026_NorthAmerica.pdf). דיווח שמבוסס על Fortune מביא ממוצע של 254 מועמדים למשרה — [Fortune](https://fortune.com/2025/11/18/hiring-job-seekers-recruiters-talent-acquisition-ai-doom-loop-application-technology). בלוג משני מביא 242 — [The Interview Guys](https://blog.theinterviewguys.com/the-average-job-opening-now-gets-242-applications/). (הנתונים קרובים אבל לא זהים.)
- דוח Greenhouse 2025 AI in Hiring (נובמבר 2025): סקר של יותר מ-4,100 מועמדים, גייסים ומנהלים בארה"ב, בריטניה, אירלנד וגרמניה. כותרת: 70% מהמנהלים סומכים על AI, רק 8% מהמועמדים חושבים שהוא הוגן. לפי הדוח, מועמדים "hacking AI filters with prompt injections" — [Greenhouse newsroom](https://www.greenhouse.com/newsroom/an-ai-trust-crisis-70-of-hiring-managers-trust-ai-to-make-faster-and-better-hiring-decisions-only-8-of-job-seekers-call-it-fair); [HRTechEdge](https://hrtechedge.com/greenhouse-report-exposes-a-hiring-system-in-crisis-ai-hacks-fraud-fears-ghost-jobs-and-collapsing-trust/)
- המנכ"ל Daniel Chait תיאר מעגל שבו מועמדים משתמשים ב-AI כדי להציף, ומעסיקים משתמשים ב-AI כדי לסנן ("doom loop") — [Entrepreneur](https://www.entrepreneur.com/business-news/ai-is-making-it-easier-to-apply-for-and-harder-to-find-a-job-than-ever); [Fortune](https://fortune.com/2025/11/18/hiring-job-seekers-recruiters-talent-acquisition-ai-doom-loop-application-technology)
- נתונים משניים שלא אומתו מול Greenhouse: 49% הגישו יותר מועמדויות מהשנה הקודמת כדי לעבור פילטרים, ו-22% הודו בשימוש בבוטים להגשה אוטומטית — [HeroHunt](https://www.herohunt.ai/blog/surviving-the-ai-application-flood-2026-playbook/)

**Ghost jobs וחור שחור (צד המועמד)**
- Resume Builder: 40% מהמעסיקים פרסמו ב-2024 משרות בלי כוונה לאייש אותן. בסקר אחר (Newsweek): 3 מכל 10 משרות. גודל המדגם שונה בין המקורות (1,641 מול כ-650) — [Resume Builder](https://www.resumebuilder.com/ghost-jobs/); [Newsweek](https://www.newsweek.com/ghost-jobs-rise-1924351)
- ניתוח JOLTS (בהזמנת MyPerfectResume): ביוני 2025, 30% מהמשרות הפתוחות (יותר מ-2.2 מיליון) לא הסתיימו בגיוס. בממשלה כמעט 60% — [CPA Practice Advisor](https://www.cpapracticeadvisor.com/2025/11/12/ghost-jobs-up-to-1-in-3-job-listings-dont-result-in-hires/173044/)
- ניתוח של Greenhouse מצוטט ב-18%–22% ghost jobs מכלל המודעות (משני) — [jobstrack.io](https://jobstrack.io/blog/ghost-jobs-2026)

**הונאת מועמדים, deepfake וצפון קוריאה**
- Gartner (31 ביולי 2025): עד 2028, אחד מכל 4 פרופילי מועמדים בעולם יהיה מזויף. בסקר של 3,000 מועמדים, 6% הודו שהשתתפו בהונאת ראיון — [HR Dive](https://www.hrdive.com/news/fake-job-candidates-ai/757126/)
- Greenhouse: 31% מתוך 4,136 מנהלים ראיינו מועמד שחשדו, או שאישרו, שהשתמש ב-deepfake — [Greenhouse (de) guidance](https://www.greenhouse.com/de/guidance/mitigate-rising-candidate-fraud-through-identity-verification)
- CNBC/NBC: "Fake job seekers are flooding U.S. companies that are hiring for remote positions". במקרה של Pindrop, הגייס הבחין שהבעות הפנים של "Ivan" לא היו מסונכרנות עם הדיבור. מתחזים שמגויסים עלולים להתקין נוזקה, לגנוב נתונים, או "simply collecting a salary" — [NBC News](https://www.nbcnews.com/tech/security/fake-job-seekers-are-flooding-us-companies-are-hiring-remote-positions-rcna200199)
- פתרונות קיימים:
  - Deel רכשה את Clarity, חברה מתל אביב (נוסדה 2022, גייסה $16M) שמזהה deepfake ומאמתת זהות בזמן אמת. הדיווחים על המחיר סותרים: "עד $50M" מול "לא נחשף" — [The Next Web](https://thenextweb.com/news/deel-acquires-clarity-deepfake-detection); [Reworked](https://www.reworked.co/employee-experience/deel-buys-clarity-to-fight-deepfake-hiring-fraud/); [IDTechWire](https://idtechwire.com/deel-acquires-clarity-to-add-deepfake-detection-across-hiring-and-workforce-identity/)
  - Persona הרחיבה את ה-workforce screening לזיהוי מועמדים מזויפים, ודיווחה שחסמה יותר מ-75 מיליון ניסיונות face spoofing ב-2024 — [CO/AI](https://getcoai.com/news/persona-blocks-75m-deepfake-attempts-as-ai-hiring-fraud-targets-us-companies/)
  - HireID השיקה Interview Integrity Platform ב-17 באוגוסט 2026 (ניטור Zoom, Meet ו-Teams). Employ הוסיפה ID.me, ול-Glider יש ID Verify — [newsfilecorp](https://www.newsfilecorp.com/release/309790)
  - Proof טוענת ש"the interview isn't where candidate fraud gets caught" — [Proof](https://proof.com/blog/your-interviewers-cant-catch-deepfakes-thats-not-their-fault)

**כלי צד המועמד (צפוף)**
- LazyApply: תשלום חד-פעמי, $99/$149/$249. תלונות על מילוי טפסים שגוי ועל תמיכה שקשה להשיג. ב-Trustpilot יש תלונות על החזרים — [Scoutify](https://scoutify.com/blog/lazyapply-review); [aitoolsatlas](https://aitoolsatlas.ai/tools/lazyapply/pricing); [FastApply](https://blog.fastapply.co/2) (שימו לב: מקורות של מתחרים)
- Simplify: autofill ולא auto-apply, נתקע בטפסים של Workday. מחיר: חינם / $39.99 לחודש — [toolworthy](https://www.toolworthy.ai/blog/best-ai-job-application-tools)
- Jobright: "copilot" שמוצא משרות, מתאים קו"ח ומגיש. התמחור לא מפורסם בבירור — [Jobright blog](https://jobright.ai/blog/2025s-best-auto-apply-tools-for-tech-job-seekers/); [toolworthy](https://www.toolworthy.ai/blog/best-ai-job-application-tools)
- לפי בלוגים של ספקים, גייסים מזהים הגשות המוניות ומדלגים עליהן. אין מחקר שיטתי שתומך בזה — [scale.jobs](https://scale.jobs/blog/ai-job-apply-tools-promise-vs-job-seekers-experience)

**מראייני AI**
- Mercor: סבב B של $100M לפי שווי $2B (CNBC), ובהמשך שווי של $10B ב-2025 (לפי ה-Verge דרך אגרגטור). המועמדים עוברים ראיון וידאו חד-כיווני של כ-20 דקות מול מראיין AI — [NBC NY/CNBC](https://www.nbcnewyork.com/news/business/money-report/ai-hiring-startup-mercor-now-valued-at-2-billion-after-strong-recent-growth/6157317/?amp=1); [Ben's Bites](https://news.bensbites.co/posts/60378-how-ai-training-company-mercor-valued-at-10b-in-2025-uses-ai-interviewer-melvin-and-invasive-monitoring-software-insightful-to-manage-its-30k-workforce)
- תלונות (טענות לא מאומתות): Mercor מפרסמת משרות שלא קיימות כדי לאסוף הקלטות ראיונות לאימון AI. רוב ההכנסות מגיעות מקבלני משנה למעבדות AI — [Tech Rundown](https://tech-rundown.beehiiv.com/p/mercor-under-scrutiny-job-postings-called-into-question); [eesel](https://www.eesel.ai/blog/mercor-ai-review)

### Inferences
- **כאב 1 (הצפת הגייסים): DROPPED.** הכאב אמיתי וגדול (‎+412%), אבל הפתרון הטבעי הוא סינון בתוך ה-ATS, ו-Greenhouse, Ashby, Workday ו-Paradox כבר שם. סולו פאונדר לא ינצח את ה-ATS בתוך ה-ATS.
- **כאב 2 (צד המועמד): DROPPED.** הכלים צפופים מאוד, וחלק מהם (auto-apply) מחמירים את הבעיה ונכנסים למרוץ חימוש מול הסינון. המשתמש משלם מעט ועוזב כשהוא מוצא עבודה. רעיון משנה ששווה בדיקה קטנה: ציון "אמינות משרה" (ghost-job score) כתוסף דפדפן. גם כאן קשה למנף כסף, ולינקדאין יכולה לבלוע את זה.
- **כאב 3 (הונאת מועמדים): SURVIVES בתנאי.** זה כאב חדש לגמרי שנוצר ע"י AI, יש לו ראיות חזקות (Gartner, Greenhouse 31%, CNBC), המעסיק משלם, ויש exit ישראלי מוכח (Clarity ל-Deel). צפוף ב-enterprise (Persona, Proof, Socure-ish, HireID). הנישה שנשארה: סוכנויות גיוס ו-staffing קטנות, חברות של 10–200 עובדים שמגייסות מרחוק, ושוקי פרילנס, דרך תוסף פשוט ל-Zoom/Meet ולינק אימות שנשלח למועמד. הסיכון: Deel, Rippling ו-Greenhouse יכללו את זה כפיצ'ר. Greenhouse כבר מפרסמת guidance על identity verification.

### Gaps
- לא נמצא אישור ראשוני לרכישת Paradox ע"י Workday. החיפוש לא החזיר תוצאות, ולכן לא אציין זאת כעובדה.
- לא נמצאו נתונים ספציפיים בחיפוש על עובדי IT מצפון קוריאה (מקרי DOJ). ידוע מהתקשורת, אבל לא אומת כאן.
- ניסיון לשלוף ציטוטים מילוליים מ-r/recruitinghell ו-r/recruiting לא בוצע (WebFetch לא עבד).

## שאלה 2: יוצרים ופרילנסרים — כאבים, כלים ופערים

### Takeaway
הכאב הגדול הוא מבני: הביקוש לעבודות commodity (כתיבה, תרגום, עיצוב בסיסי) יורד, ואין מוצר שמחזיר ביקוש. תשלומים מאוחרים הם כאב ישן ומשורת היטב. סריקת תוכן היא כאב אמיתי, אבל Cloudflare בולעת אותו ברמת התשתית. אין כאן הזדמנות טובה לסולו פאונדר.

### Cited Findings
- Upwork: פרויקטי כתיבה ירדו ב-32% בשנה ב-2025, הירידה החדה ביותר בפלטפורמה (מקור משני, לא אומת מול Upwork) — [skillscouter](https://skillscouter.com/freelance-statistics/); [bestwriting](https://bestwriting.com/freelance-writing-statistics)
- דוח In-Demand Skills 2026 של Upwork: הביקוש לכישורי AI עלה ב-109% בשנה. משרות AI משלמות פרמיה (44% לשעה לפי מקור אחד, כ-22% לפי מקור אחר) — [skillscouter](https://skillscouter.com/freelance-statistics/); [ruul](https://ruul.io/blog/will-ai-replace-freelancers)
- מחקר Brookings (כפי שצוטט בבלוג, לא אומת): ירידה של כ-5% בהכנסה החודשית של פרילנסרים במקצועות חשופים ל-AI — [jobbers.io](https://www.jobbers.io/?p=65909)
- MBO Partners: שיעור העצמאים שמשתמשים ב-GenAI עלה ל-74% ב-2025, לעומת 65% — [skillscouter](https://skillscouter.com/freelance-statistics/)
- תשלומים מאוחרים:
  - Bonsai (יותר מ-100,000 פרילנסרים): 29% מהחשבוניות שולמו אחרי מועד התשלום — [Bonsai](https://www.hellobonsai.com/blog/late-freelance-payment)
  - 85% חווים איחורים, ו-21% מקבלים תשלום באיחור או לא מקבלים בכלל ביותר ממחצית המקרים. הייחוס סותר: Remote מול Freelancers Union/Plutio — [agiled](https://agiled.app/statistics/late-payment-statistics)
  - סקר Authors Guild בניו יורק: 62% מהפרילנסרים איבדו שכר בגלל אי-תשלום — [Authors Guild](https://authorsguild.org/news/survey-finds-62-percent-of-ny-freelance-workers-have-lost-wages-due-to-nonpayment)
  - בבריטניה (Ormsby Street, 1,002 משיבים): רק 19% אומרים שרוב החשבוניות משולמות בזמן. ממוצע האיחור כ-18.5 ימים — [startups.co.uk](https://startups.co.uk/?p=86134)
- סריקת תוכן:
  - יחסי crawl-to-referral באמצע 2025: Google כ-14:1, OpenAI כ-1,700:1, Anthropic כ-73,000:1 — [Let's Data Science](https://letsdatascience.com/news/cloudflare-gives-publishers-control-over-ai-crawlers-3f1384fa). דיווח אחר: Google 9.4:1, OpenAI כ-1,600:1, Anthropic כ-70,900:1 — [eWeek](https://www.eweek.com/de/news/cloudflare-expands-ai-crawler-control/)
  - Cloudflare: pay-per-crawl עם HTTP 402, חסימת בוטי AI כברירת מחדל בדומיינים חדשים, וחסימת mixed-use crawlers בדפים עם פרסומות החל מ-15 בספטמבר 2026. המוצר עדיין ב-private beta, והתשלומים עוברים דרך Stripe — [eWeek](https://www.eweek.com/de/news/cloudflare-expands-ai-crawler-control/); [dev.to](https://dev.to/simon_paxton/cloudflare-is-blocking-many-ai-crawlers-by-default-on-ad-supported-pages-not-charging-them-4hcm); [Tech Policy Press](https://techpolicy.press/cloudflare-wades-into-the-battle-over-ai-consent-and-compensation)
  - Condé Nast, TIME ו-The Atlantic מצטרפים לתוכנית, בגלל ירידה בתנועת ההפניה — [iQOO community summary](https://community.iqoo.com/in/thread/99605) (מקור חלש)

### Inferences
- **כאב 4 (דאמפינג ע"י AI): DROPPED.** אי אפשר למכור מוצר שמחזיר ביקוש. הכיוון ההפוך ("כלי שעוזר לפרילנסר לעבור לעבודות AI") הוא קורסים וקהילות, לא SaaS.
- **כאב 5 (תשלומים מאוחרים): DROPPED.** הכאב לא נוצר ע"י AI, והוא משורת ע"י Bonsai, HoneyBook, Plutio ו-Stripe invoicing. הפרילנסר משלם מעט.
- **כאב 6 (סריקת תוכן): DROPPED לסולו.** Cloudflare שולטת בשכבת התשתית, והיוצרים הקטנים (מאיירים וכותבים) לא משלמים. הכלים החינמיים לאמנים (Glaze/Nightshade) לא נבדקו כאן.

### Gaps
- לא נמצאו נתונים ראשוניים מ-Fiverr או Upwork עצמן. הכול משני.
- לא נבדקו שינויי אלגוריתם ב-YouTube/TikTok (כמו מדיניות "inauthentic/AI content" ו-demonetization) בגלל מגבלת קריאות.

## שאלה 3: מפתחים — תלונות עיקריות ב-2025–2026, פערים, ומה כבר צפוף

### Takeaway
התלונה המרכזית היא "almost right": 66% מבזבזים זמן על קוד AI שכמעט נכון, והאמון ירד ל-29%–33%. עומס הסקירה עבר מהכותב לבודק. אבל כמעט כל פער ברשימה (סקירת PR, observability, evals, עלויות, אבטחה) כבר מאוכלס בסטארטאפים ממומנים היטב או בפלטפורמות. נשארת נישה אחת לא ממומנת: טריאז' ל-AI slop בקוד פתוח, ושם כמעט אין מי שמשלם.

### Cited Findings
**סקרים**
- Stack Overflow 2025 (פורסם ב-29 ביולי 2025): 84% משתמשים או מתכננים להשתמש בכלי AI (לעומת 76% ב-2024). 46% לא סומכים על דיוק הפלט (לעומת 31%). 66% אומרים שה-AI נותן פתרונות "almost right, but not quite". ה-favorability ירד ל-60% (מ-72%) — [Stack Overflow press release](https://stackoverflow.co/company/press/archive/stack-overflow-2025-developer-survey/); [ShiftMag](https://shiftmag.dev/stack-overflow-survey-2025-ai-5653/); [InfoWorld](https://infoworld.com/article/4031673/ai-use-among-software-developers-grows-but-trust-remains-an-issue-stack-overflow-survey.html)
- סתירה במספרי האמון: הבלוג של SO מביא "trust in accuracy fell from 40% to 29%". VentureBeat מביא 33%. מקור אחר מביא כ-3% שסומכים מאוד — [SO blog](https://stackoverflow.blog/2025/07/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/); [VentureBeat](https://venturebeat.com/ai/stack-overflow-data-reveals-the-hidden-productivity-tax-of-almost-right-ai-code); [byteiota](https://byteiota.com/stack-overflow-2025-survey-ai-adoption-84-trust-drops-to-33/)
- 45% אומרים שדיבוג קוד AI לוקח יותר זמן. 75% עדיין יפנו לאדם כשהם לא סומכים על ה-AI. רק 38% ממשתמשי האייג'נטים אומרים שהם שיפרו את איכות הקוד — [InfoWorld](https://infoworld.com/article/4031673/ai-use-among-software-developers-grows-but-trust-remains-an-issue-stack-overflow-survey.html); [Admin Magazine](https://www.admin-magazine.com/News/Stack-Overflow-Survey-66-of-Developers-Frustrated-by-AI-Inaccuracy)
- METR (RCT, 16 מפתחי קוד פתוח מנוסים, 246 משימות): עם AI הם היו איטיים ב-19%, אבל העריכו שהם מהירים ב-20% (מקור משני, לא אומת מול המאמר) — [philippdubach](https://philippdubach.com/posts/93-of-developers-use-ai-coding-tools.-productivity-hasnt-moved.)

**עומס סקירה**
- Faros AI (משני): אימוץ AI מתואם עם 98% יותר PR-ים, PR-ים גדולים ב-154%, וזמן סקירה ארוך ב-91% — [DEV Community](https://dev.to/max_quimby/four-horsemen-of-agent-prs-and-how-to-stop-them-bgk)
- HN: "It's similarly insulting to read your AI-generated pull request" — [HN 45723057](https://news.ycombinator.com/item?id=45723057). כותרת של שרשור אחר: "If you are asking for human attention, demonstrate human effort" — [HN 48497609](https://news.ycombinator.com/item?id=48497609). ו-"AI coding agents generate more code, but not more software" — [HN 50059523](https://news.ycombinator.com/item?id=50059523)
- הערכה ויראלית שלא אומתה: PR שנכתב ב-vibe coding עולה כ-7 דקות לתורם וכ-84 דקות לסוקר — [remio](https://www.remio.ai/post/hacker-news-put-code-review-on-trial-ai-made-the-bottleneck-impossible-to-ignore)

**קוד פתוח ו-slop**
- curl סיימה את תוכנית ה-bug bounty ב-HackerOne בסוף ינואר 2026. Daniel Stenberg אמר שהוא מקווה שזה "remove the incentive for people to submit crap and non-well researched reports". שיעור הדיווחים המאושרים ירד לפחות מ-5%, לעומת יותר מ-15% בעבר — [BleepingComputer](https://bleepingcomputer.com/news/security/curl-ending-bug-bounty-program-after-flood-of-ai-slop-reports/); [The Register](https://www.theregister.com/2026/01/21/curl_ends_bug_bounty/)
- GitHub שוקלת "kill switch" ל-PR-ים: כיבוי מלא, הגבלה ל-collaborators מהימנים, או כלי טריאז' AI. מפתח ב-Genkit: "1 out of 10 PRs created with AI is legitimate". מתחזקי Godot: "draining and demoralizing" — [OpenSourceForU](https://www.opensourceforu.com/2026/02/github-weighs-pull-request-kill-switch-as-ai-slop-floods-open-source/); [DevClass](https://www.devclass.com/ai-ml/2026/02/19/github-itself-to-blame-for-ai-slop-prs-say-devs/4091420)
- לפי בלוג משני, תוכנית Internet Bug Bounty של HackerOne השהתה הגשות חדשות ב-27 במרץ 2026 (לא אומת) — [pinggy](https://pinggy.io/blog/curl_ai_slop_summer_of_bliss/)

**אבטחה ו-MCP**
- Veracode (30 ביולי 2025): 80 משימות ויותר מ-100 מודלים. 45% מהמקרים הכילו פגיעות. ב-Java שיעור הכישלון עלה על 70%. מודלים גדולים לא היו טובים משמעותית מקטנים — [Veracode press release](https://www.veracode.com/press-release/ai-generated-code-poses-major-security-risks-in-nearly-half-of-all-development-tasks-veracode-research-reveals/)
- MCP: 5,832 מתוך 9,695 שרתים פגיעים לליקויים קריטיים, והפופולריות לא מתואמת עם רמת האבטחה — [threatcluster](https://threatcluster.io/cluster/critical-vulnerabilities-found-in-thousands-of-mcp-servers-488d6a32). Endor Labs (משני): ב-2,614 מימושים, 82% עם פעולות קבצים שחשופות ל-path traversal ו-34% חשופים ל-command injection — [heyuan110](https://heyuan110.com/posts/ai/2026-03-10-mcp-security-2026). מאמר אקדמי: 370 שרתים ו-1,062 כלים רלוונטיים לתקיפות הזרקה — [arXiv 2509.06572](https://arxiv.org/pdf/2509.06572)

**כמה זה צפוף**
- סקירת קוד AI:
  - CodeRabbit: סבב B של $60M (ספטמבר 2025), סך הכול $88M, שווי מדווח $550M, יותר מ-8,000 עסקים — [Pulse2](https://pulse2.com/coderabbit-60-million-series-b-raised-for-ai-code-review-platform)
  - Greptile: סבב A של $25M בהובלת Benchmark — [SiliconANGLE](https://siliconangle.com/2025/09/23/greptile-bags-25m-funding-take-coderabbit-graphite-ai-code-validation/)
  - Graphite: סבב B של $52M (מרץ 2025) — [TechCrunch](https://techcrunch.com/2025/03/18/anthropic-backed-ai-powered-code-review-platform-graphite-raises-cash/). ב-19 בדצמבר 2025 נרכשה ע"י Cursor, לפי Axios "way over" שווי של $290M. ל-Cursor יש גם Bugbot. Michael Truell אמר שה-AI האיץ את כתיבת הקוד, בעוד תהליך הסקירה "remained largely unchanged" — [TechCrunch](https://techcrunch.com/2025/12/19/cursor-continues-acquisition-spree-with-graphite-deal); [SiliconANGLE](https://siliconangle.com/2025/12/19/cursor-acquires-ai-code-review-startup-graphite/)
- Observability ו-evals: NeuronFeed עוקב אחרי 36 סטארטאפים עם מימון כולל של $1.1B. Braintrust: סבב B של $80M, ולפי מקור אחר $120M מצטבר ושווי $800M (סותר). Langfuse נרכשה לכאורה ע"י ClickHouse בינואר 2026 (מקור יחיד). מתחרים נוספים: Arize, Galileo, LangSmith, Helicone, AgentOps ועוד — [NeuronFeed](https://neuronfeed.com/category/ai-observability); [Presenc](https://presenc.ai/research/ai-agent-observability-startups-2026); [Citi Ventures](https://www.citi.com/ventures/perspectives/opinion/llm-observability-next-major-play.html)

### Inferences
- **כאב 7 (סקירת PR ב-AI בתוך חברות): DROPPED.** הכאב הכי מתועד, וגם הכי צפוף. יש שלושה סטארטאפים ממומנים, רכישה של Cursor, ו-GitHub Copilot review (לא אומת בחיפוש, אבל ידוע).
- **כאב 8 (AI slop בקוד פתוח): SURVIVES כ-wedge בלבד.** הכאב אקוטי, חדש ומתועד (curl, Godot, GitHub). אבל מתחזקים לא משלמים, ו-GitHub צפויה לבנות פיצ'ר. כעסק אפשרי רק דרך מודל B2B, למשל לחברות שמנהלות פרויקטי open-core או לתוכניות bug bounty (HackerOne/Bugcrowd) שצריכות סינון דיווחים.
- **כאב 9 (אבטחת קוד AI ו-MCP): DROPPED לסולו.** הכאב אמיתי (45%, ‏5,832 שרתים), אבל הקונה הוא CISO, נדרשים אמון ומכירה ל-enterprise, וספקי AppSec קיימים (Veracode, Endor Labs, Snyk) מוסיפים יכולות.
- **כאב 10 (observability, evals ועלויות): DROPPED.** 36 חברות ו-$1.1B, כבר בשלב קונסולידציה.

### Gaps
- לא נמצאו נתוני JetBrains State of Developer Ecosystem 2025 בחיפושים שבוצעו.
- לא נבדקו רשימות batch של YC באופן ישיר. הצפיפות הוסקה ממימון ומרשימות מעקב.
- לא אומת המצב העדכני של GitHub Copilot code review בחיפוש.

## שאלה 4: אמון ב-AI — אימות פלט, ציטוטים והזיות. מי פותר?

### Takeaway
"Workslop" והזיות הם כאב רוחבי ומכומת: $186 לעובד בחודש, ו-1,600+ מקרים בבתי משפט. באופן אופקי, המודלים והפלטפורמות עצמם מתקנים (grounding, citations), ולכן קשה לבנות עסק אופקי. באופן ורטיקלי (משפט, ובפוטנציה דוחות ייעוץ, מחקר אקדמי, תוכן רגולטורי) יש מעט מוצרים ייעודיים, והעלות של טעות גבוהה ומוחשית (סנקציות).

### Cited Findings
- Stanford Social Media Lab ו-BetterUp Labs: מתוך 1,150 עובדים במשרה מלאה בארה"ב, 40% קיבלו workslop בחודש האחרון. כל מקרה עולה כ-2 שעות, כלומר כ-$186 לעובד בחודש, או יותר מ-$9M בשנה לחברה של 10,000 עובדים. 42% סומכים פחות על עמיתים ששולחים workslop. ההגדרה: "low-quality, AI-created work that's good enough to pass cursory checks but fails to meaningfully move a task forward" — [The Decoder](https://the-decoder.com/ai-generated-workslop-is-costing-companies-millions-and-hurting-team-morale-study-finds/); [Quartz](https://qz.com/workslop-ai-stanford-study-office-headache-wasting-workers-time); [Yahoo Finance](https://finance.yahoo.com/news/9-million-problem-ai-generated-223107291.html)
- סקר המשך (ספטמבר 2025 עד מרץ 2026): כמעט 2,300 עובדים ומנהלים בארה"ב, קנדה ובריטניה — [BetterUp](https://www.betterup.com/blog/workslop-canada)
- מאגר Charlotin של הזיות בבתי משפט: כ-1,633 מקרים בסוף יוני 2026 (כ-700 בינואר), או 1,667 לפי מקור אחר. בארה"ב 1,058 נכון לתחילת יוני 2026. חלוקה של כ-60% מתדיינים בלי עו"ד ו-40% עורכי דין. בתמונת מצב ממרץ 2026: 394 עורכי דין ו-11 שופטים. בשנת 2025: 524 מקרים, 97 סנקציות כספיות ו-59 הפניות משמעתיות — [UNC Law Library](https://library.law.unc.edu/2026/06/handling-hallucinations-a-reflection/); [MSBA](https://www.msba.org/site/content/News-and-Publications/News/General-News/Confronting_the_Hard%20Numbers_Behind_Lawyers_AI_and_Phantom_Precedents.aspx); [tinyapps](https://tinyapps.org/blog/ai-hallucinations-in-court.html)
- קצב: כ-5–6 מקרים חדשים ביום — [MSBA](https://www.msba.org/site/content/News-and-Publications/News/General-News/Confronting_the_Hard%20Numbers_Behind_Lawyers_AI_and_Phantom_Precedents.aspx)
- Stanford RegLab 2025 (כפי שצוטט): כלי AI משפטיים ייעודיים הוזים ב-17%–33% מהשאילתות — [Fast.io](https://fast.io/resources/best-ai-for-legal-research-2026/)
- פתרונות: CiteSentinel (BrentWorks) הושק במאי או יוני 2026 (התאריכים סותרים) כ-"among the first platforms built specifically to detect and prevent AI hallucinations in legal citations". אין תמחור מפורסם — [CU Insight](https://www.cuinsight.com/press-release/tech-startup-launches-tool-built-to-catch-ai-hallucinations-in-legal-citations/). ל-ABA Journal יש טור על בחירת citation checkers, אבל לא נקרא — [ABA Journal](https://www.abajournal.com/columns/article/fighting-hallucinations-choosing-the-right-ai-citation-checkers)
- טווח מחירים בכלי מחקר משפטי: מ-$10 לחודש לסולו ועד $1,200 לחודש ל-enterprise — [Fast.io](https://fast.io/resources/best-ai-for-legal-research-2026/)

### Inferences
- **כאב 11 (אימות פלט AI): SURVIVES, אבל רק ורטיקלית.** הנימוקים: (1) עלות הטעות מוחשית (סנקציות, אובדן לקוח). (2) מי שמשלם מזוהה: משרדי עורכי דין קטנים, יועצים, צוותי רגולציה. (3) הכלים הייעודיים מעטים. הסיכונים: Thomson Reuters ו-LexisNexis (לא נבדקו כאן) יכללו בדיקת ציטוטים בתוך המוצר, והמודלים משתפרים. לישראלי עם יכולת web/mobile, נישות אפשריות הן בדיקת ציטוטים ומקורות לכותבים אקדמיים, דוחות ESG ורגולציה, או מסמכי רפואה ופארמה. לפני שמתחילים צריך ראיונות לקוח כדי לבדוק נכונות תשלום.
- נתוני workslop מראים כאב רוחבי, אבל "workslop detector" אופקי בתוך Slack או Docs עלול להיתפס כמעקב אחרי עובדים, וקשה למכור אותו.

### Gaps
- לא נמצאה רשימה מלאה של מתחרים ב-citation checking (למשל Clearbrief, ו-Westlaw/Lexis features) עם תמחור מאומת.
- אין נתוני WTP (נכונות לשלם) ממקורות ראשוניים.

## שאלה 5: עובדים שעבודתם משתנה, צוותים קטנים עם tool sprawl, "למה עכשיו" ו-devil's advocate

### Takeaway
"למה עכשיו" חזק: נפח התוכן שה-AI מייצר קפץ ב-2024–2026 בכל ערוץ (מועמדויות פי 2, PR-ים +98%, דיווחי באגים, מסמכים). אבל ה-devil's advocate חזק לא פחות: הפלטפורמות (Cursor/GitHub, Cloudflare, Deel, Greenhouse/LinkedIn, ספקי המודלים) כבר רוכשות או בונות את הפתרונות לכאבים הבולטים. tool sprawl בצוותים קטנים לא מגובה בראיות חזקות.

### Cited Findings
- Tool sprawl:
  - סקר ClickUp (כ-1,000 עובדים, ספק עם אינטרס): 53.6% יהיו אדישים ו-23.9% ירגישו הקלה אם חצי מכלי ה-AI שלהם יוסרו. רק 15% יתעצבנו — [ClickUp](https://clickup.com/blog/?p=494777)
  - Bango (דרך MEAN CEO): משתמשים משלמים מחזיקים כ-4 כלים בכ-$66 לחודש. נתוני Bank of America: חציון של $20 למשק בית משלם — [MEAN CEO](https://blog.mean.ceo/?p=11248)
  - "חציון של 5 כלי AI לעסק קטן" ו-"$3,000–$6,000 בחודש": מספרים שלא אותרו לסקר מקור — [beancount](https://beancount.io/blog/2026/07/09/ai-tool-subscription-sprawl-small-business-guide)
- דוגמאות לבליעה ע"י פלטפורמות:
  - Cursor רכשה את Graphite — [TechCrunch](https://techcrunch.com/2025/12/19/cursor-continues-acquisition-spree-with-graphite-deal)
  - Deel רכשה את Clarity — [The Next Web](https://thenextweb.com/news/deel-acquires-clarity-deepfake-detection)
  - Cloudflare עם pay-per-crawl וחסימה כברירת מחדל — [eWeek](https://www.eweek.com/de/news/cloudflare-expands-ai-crawler-control/)
  - ClickHouse רכשה את Langfuse לכאורה (מקור יחיד) — [Presenc](https://presenc.ai/research/ai-agent-observability-startups-2026)
  - GitHub שוקלת כלים נגד slop PR-ים — [OpenSourceForU](https://www.opensourceforu.com/2026/02/github-weighs-pull-request-kill-switch-as-ai-slop-floods-open-source/)
- תשואה מ-AI: שני ציטוטים סותרים מ-McKinsey (37% רואים השפעה על הרווחים, מול 95% בלי ROI מדיד). לא אומת — [Shibumi](https://shibumi.com/blog/ai-fatigue-statistics-2026/)

### Inferences
- **כאב 12 (tool sprawl): DROPPED.** הראיות חלשות ומגיעות מספקים. המוכרים הטבעיים (ClickUp, Notion, Zapier, וחבילות Google ו-Microsoft) כבר מוכרים קונסולידציה. גם "SaaS spend management" לצוותים קטנים קיים (לא נבדק כאן).
- עובדים שעבודתם משתנה (reskilling): לא נמצא כאב ממוקד שמתאים למוצר web/mobile של סולו פאונדר. זה שוק של קורסים ופלטפורמות למידה, והראיות בחיפושים לא תמכו בפער מוגדר.
- **Devil's advocate לכל אחד מהשורדים:**
  - (3) אימות מועמדים: Deel, Rippling, Greenhouse, LinkedIn verification ו-Persona עלולים להפוך את זה לפיצ'ר חינמי. ההגנה: להתמקד בסוכנויות ובשוקי פרילנס, ובהפצה דרך אינטגרציות ל-Zoom/Meet ול-ATS קטנים.
  - (11) אימות ורטיקלי: Thomson Reuters, LexisNexis, ו-OpenAI/Anthropic עם citations. ההגנה: ורטיקל צר עם מאגר מקורות ייעודי (למשל פסיקה ישראלית בעברית, שבה הגדולים חלשים יותר. זו הסקה, לא נבדק).
  - (8) slop בקוד פתוח: GitHub תבנה את זה, ומתחזקים לא משלמים. מתאים יותר כפרויקט קוד פתוח שבונה מוניטין מאשר כעסק.

### Gaps
- לא נמצא סקר SMB רציני על מספר כלי ה-AI וההוצאה עליהם.
- לא נבדקו נתוני LinkedIn Economic Graph על שינויי תפקידים, וגם לא נתונים ספציפיים לישראל.
- WebFetch לא עבד לאורך כל המחקר, ולכן ציטוטים מילוליים מ-Reddit ומדוחות ראשוניים (Greenhouse, SO) לא נשלפו ישירות. מומלץ לאמת לפני פרסום.
