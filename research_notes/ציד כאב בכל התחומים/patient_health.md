# ציד כאב: צד המטופל ובני המשפחה בבריאות (לא back-office של ספקים)

> הקשר: מייסד ישראלי סולו או צוות קטן שבונה אפליקציות web ומובייל, ופתוח לשווקים גלובליים. סבב קודם פסל את צד הספקים (prior auth, eligibility, ניהול דחיות לספקים) כשוק צפוף, ולכן הוא לא חוזר כאן. תאריך המחקר: 2026-10-24.
> הערה מתודולוגית: כלי החיפוש לא מאנדקס היטב את Reddit, ולכן ציטוטים מילוליים מ-r/ChronicIllness, r/ADHD ודומיהם כמעט לא נאספו. רוב הציטוטים כאן מגיעים מסקרים ומכתבות. בנוסף, ניסיון לקרוא את כתבת North Carolina Health News על "AI vs AI" נכשל (שגיאת DNS).

---

## שאלה 1: אילו 8–12 כאבי מטופלים קונקרטיים קיימים, מה הראיות, מה הפתרונות הקיימים, מי ישלם ומה פסק הדין?

### Takeaway
הכאבים החזקים והמתועדים ביותר בצד המטופל הם בירוקרטיה כספית (חשבונות שגויים ודחיות), עומס התיאום על מטפלים משפחתיים, מסעות אבחון ארוכים (מחלות נדירות, אנדומטריוזיס) והמתנה לטיפול נפשי בישראל. הכאבים "הגנריים" (אגרגציה של רשומות, AI front door, מעקב סימפטומים) נבלעים עכשיו בידי OpenAI, b.well, Apple ו-CMS, או שמגיעים עם מחיר כמעט אפסי. מה ששורד הוא נישות שבהן משלם ברור (פארמה, מעסיק, הצלחה כספית מדידה) או זווית ישראלית מקומית.

### Cited Findings

#### כאב 1: ערעור על דחיית תביעה בידי המטופל (ארה"ב)
- ב-2023 מבטחים ב-HealthCare.gov דחו כ-19% מהתביעות על שירותים in-network ו-37% מהתביעות out-of-network. הנתונים מבוססים על 425 מיליון תביעות של 175 מבטחים — [KFF](https://www.kff.org/private-insurance/issue-brief/claims-denials-and-appeals-in-aca-marketplace-plans-in-2023/)
- צרכנים ערערו על כ-1% בלבד מהתביעות שנדחו in-network, והמבטחים השאירו את הדחייה על כנה ב-56% מהערעורים. רק 40% מהצרכנים חושבים שיש להם זכות חוקית לערער לגורם ממשלתי או למומחה עצמאי — [KFF](https://www.kff.org/private-insurance/issue-brief/claims-denials-and-appeals-in-aca-marketplace-plans-in-2023/)
- ב-2025 נדחו 12% מבקשות prior authorization ב-Medicare Advantage, ‏14% ב-Medicaid managed care ו-18% ב-ACA Marketplace. כשכבר מערערים, כ-43% מהדחיות מתהפכות ב-ACA FFM — [MedCity News על KFF, 08/2026](https://medcitynews.com/2026/08/kff-insurers-denied-12-18-of-prior-authorization-requests-in-2025/)
- לפי סקר KFF לשנת 2023, ‏58% מהמבוטחים הבוגרים דיווחו על בעיה בשימוש בביטוח הבריאות, כולל תביעות שנדחו — [KFF](https://www.kff.org/private-insurance/issue-brief/claims-denials-and-appeals-in-aca-marketplace-plans-in-2023/)
- כ-17% מהמטופלים קיבלו דחייה לשירות שהרופא המליץ עליו. כמעט 60% מהם אמרו שהדחייה עיכבה את הטיפול, ו-47% דיווחו שהסימפטומים החמירו — [HealthDay על Commonwealth Fund 2024](https://www.healthday.com/health-news/general-health/common-medical-billing-errors-keep-many-americans-from-care-report)
- **פתרונות קיימים:**
  - **Counterforce Health:** חינמי למטופלים, ממומן במענקים, ומפיק מכתב ערעור תוך כשתי דקות. המייסד Neal Shah מדווח על "70% success rate", אבל זה נתון של החברה בלבד. בעתיד הוא שוקל לגבות ממרפאות — [Axios Raleigh](https://www.axios.com/local/raleigh/2025/08/20/using-ai-to-fight-back-against-insurance-denials-counteforce); [WECT](https://www.wect.com/2025/07/25/ai-tool-that-helps-patients-battle-insurance-claim-denials-got-its-start-wilmingon)
  - **Fight Health Insurance (Holden Karau):** "open source and free". שליחת הערעור בפקס עולה 5 דולר — [STAT](https://www.statnews.com/2024/12/16/how-to-fight-insurance-denials-luigi-mangione-unitedhealthcare-centene-medicaid-aca-outlook-healthcare-inc-newsletter/); [Business Insider](https://businessinsider.nl/shes-worked-at-nearly-every-faang-company-in-her-free-time-she-built-a-free-tool-to-appeal-health-insurance-denials/)
  - **Claimable:** ‏39.95 דולר לערעור ועוד משלוח, כ-50 דולר "all in". מכסה כ-75 תרופות. החברה מדווחת על הצלחה של 80% בפיילוט, ונתון של 75% צוטט ב-WABE — [Healthcare Brew](https://healthcare-brew.com/stories/2024/12/17/startup-appealing-insurance-denials-patients-behalf); [Innovation IA](https://innovationia.com/2025/08/14/startup-stories-claimable-fights-denied-medical-claims/); [WABE](https://www.wabe.org/?p=974629)
  - **Sheer Health:** סבב Series A של 13 מיליון דולר בדצמבר 2023, ו-16.5 מיליון בסך הכול לפי PitchBook. החברה טוענת שחבריה חסכו 5.7 מיליון דולר ב-2024 — [PitchBook](https://pitchbook.com/profiles/company/516159-55); [Sheer Health](https://www.sheerhealth.com/blog/sheer-health-2024-wrap-up)

#### כאב 2: חשבונות רפואיים שגויים וחוב רפואי (ארה"ב)
- 45% מהמבוגרים המבוטחים בגיל העבודה קיבלו בשנה האחרונה חשבון או copay על שירות שלדעתם הביטוח היה אמור לכסות. פחות ממחציתם ערערו, אבל בקרב מי שערער, ל-38% החשבון הופחת או בוטל — [HealthDay על Commonwealth Fund 2024](https://www.healthday.com/health-news/general-health/common-medical-billing-errors-keep-many-americans-from-care-report)
- 60% מהצעירים (גילאי 19–34) לא ידעו שאפשר לערער על חשבון — [HealthDay](https://www.healthday.com/health-news/general-health/common-medical-billing-errors-keep-many-americans-from-care-report)
- לפי Commonwealth Fund Affordability Survey 2025 (‏6,353 משיבים), שליש מהמבוטחים הפרטיים נושאים חוב רפואי. אצל 68% מבעלי החוב הוא גורם לדאגה או חרדה, ואצל כרבע הוא דווח ללשכת אשראי — [Healthcare Finance News](https://www.healthcarefinancenews.com/news/one-third-privately-insured-adults-carries-medical-debt)
- דוגמה לכישלון: Wellero, אפליקציה לתשלום חשבונות רפואיים של Cambia, נסגרה אחרי שהגיעה לכ-1,100 משתמשים בלבד. תאריך הכתבה לא אומת — [MedCity News](https://medcitynews.com/?p=71818)

#### כאב 3: רשומות רפואיות מפוזרות, "הקלסר" וחזרה על ההיסטוריה מול כל רופא חדש
- מטופלת כרונית סוחבת קלסר של "four-inch binder" בין השנים 2012–2014, כי "None of the specialists … communicated with each other or shared records", ובדיקות חזרו על עצמן — [CommonWell Alliance blog](https://www.commonwellalliance.org/author_post_blog/morgan-knochel/)
- הפתרון העוקף נמכר כמוצר: ב-Etsy יש תבניות "Chronic Illness Management Binder" ו-Google Sheets "medical binder" עם לשוניות לתרופות, סימפטומים ובדיקות. זה סימן לכאב, ומעיד גם על נכונות לשלם סכומים קטנים — [Etsy](https://www.etsy.com/listing/4472490438); [Payhip](https://payhip.com/b/3Q5SE)
- **PicnicHealth:** אוספת רשומות מלאות ממטופלים בהסכמתם, ומוכרת datasets ל-life sciences. גייסה Series C של 60 מיליון דולר, ומעל 100 מיליון בסך הכול. כלומר המודל העסקי הוא פארמה ולא המטופל — [PicnicHealth](https://picnichealth.com/blog/introducing-the-picnichealth-research-platform); [HealthExec](https://healthexec.com/topics/healthcare-management/healthcare-economics/patient-data-company-picnichealth-raises-60m)
- **Ciitizen:** נרכשה בידי Invitae תמורת כ-325 מיליון דולר, עם תזה של נתוני real-world בהסכמת המטופל לשימוש פארמה. דוגמה: AstraZeneca השתמשה בנתוני natural history שלה — [360Dx](https://www.360dx.com/business-news/invitae-acquire-consumer-health-tech-firm-ciitizen-325m); [HC Innovation Group](https://hcinnovationgroup.com/finance-revenue-cycle/mergers-acquisitions/news/21237543/invitae-to-purchase-patientcentric-medical-records-company-ciitizen)
- **ChatGPT Health** הושק ב-7 בינואר 2026, עם b.well כ-back end לחיבור רשומות רפואיות (ארה"ב בלבד) ו-Apple Health (רק ב-iOS). OpenAI מדווחת על יותר מ-230 מיליון אנשים בעולם ששואלים שאלות בריאות מדי שבוע (זה השימוש הכללי ב-ChatGPT, לא בפיצ'ר החדש). לפי OpenAI הוא "not intended for diagnosis or treatment" — [CNBC](https://www.cnbc.com/2026/01/07/openai-chatgpt-health-medical-records.html); [Fierce Healthcare](https://www.fiercehealthcare.com/ai-and-machine-learning/openai-launches-chatgpt-health-connect-data-health-apps-medical-records); [MobiHealthNews](https://www.mobihealthnews.com/news/openai-launches-chatgpt-health-partners-bwell)

#### כאב 4: מסע האבחון במחלות נדירות
- לפי סקר EURORDIS Rare Barometer, שנערך ב-2022 ופורסם ב-2024 (יותר מ-10,000 משיבים, 42 מדינות, 1,675 מחלות), עוברות בממוצע 4.7 שנים מהסימפטום הראשון ועד אבחנה. נשים מחכות 5.4 שנים לעומת 3.7 אצל גברים, ומתבגרים בני 10–20 מחכים 10.4 שנים — [EURORDIS](https://www.eurordis.org/survey-reveals-lengthy-diagnostic-delays)
- 25% מהמשיבים עברו 8 ייעוצים או יותר לפני האבחנה. 40% לא הופנו למרכז מומחיות, ומי שהופנה קיבל אבחנה מהר יותר (4.3 שנים לעומת 5.4). לגבי אבחנות שגויות המקורות סותרים: לפי ה-factsheet, ‏60% אובחנו קודם במחלה פיזית אחרת ו-25% באבחנה פסיכולוגית, ומקור אחר מדווח על 70% שאובחנו שגוי או "dismissed" — [EURORDIS](https://www.eurordis.org/survey-reveals-lengthy-diagnostic-delays); [Illumina](https://www.illumina.com/company/news-center/feature-articles/strength-in-numbers--how-the-rare-barometer-supports-the-rare-di.html); [Rare Voices Australia](https://rarevoices.org.au/wp-content/uploads/2026/03/Factsheet-Diagnosis_Australia.pdf)
- בעולם יש יותר מ-6,000 מחלות נדירות, שפוגעות בכ-300–400 מיליון איש — [IntuitionLabs](https://intuitionlabs.ai/articles/rare-disease-landscape-2025)

#### כאב 5: ניהול עצמי של מחלה כרונית ו-Long COVID (מעקב סימפטומים וטריגרים)
- ב-2022 כ-7.5% מהמבוגרים בארה"ב (1 מכל 13) דיווחו על סימפטומי Long COVID, וכ-19% ממי שחלה בקורונה — [CDC NCHS](https://www.cdc.gov/nchs/pressroom/releases/20220622.html). מחקר ב-BMC Public Health מ-2025 מצא שכיחות מתוקננת גיל של 7.2% (נכון ל-2022) — [BMC Public Health](https://biomedcentral-bmcpublichealth.publicaciones.saludcastillayleon.es/counter/pdf/10.1186/s12889-025-22987-8.pdf)
- כ-80% ממי שסבלו מ-Long COVID בזמן הסקר (אוגוסט–ספטמבר 2024) דיווחו על מגבלות בתפקוד — [Statista](https://www.statista.com/statistics/1401751/percentage-of-adults-who-reported-any-activity-limitations-from-long-covid-in-the-us)
- **Guava:** חינמית ב-App Store, ומכוונת ל-POTS, EDS, MCAS, ME/CFS ו-Long COVID. משלבת רשומות רפואיות ו-AI, ומצהירה שהיא "does not sell data or have ads". הדירוג 4.6 מתוך 19 ביקורות בלבד — [AppFollow](https://apps.appfollow.io/ios/guava-health-tracker/1622255863?country=de); [Trustpilot](https://at.trustpilot.com/review/guavahealth.com)
- **Bearable:** הבסיס חינמי. Premium עולה כ-6.99 דולר לחודש, או כ-16–40 דולר לשנה לפי אזור. המגבלה המרכזית היא שהיא מתאימה בעיקר למי ש-"do not mind regular manual check-ins" — [Adapty paywall library](https://adapty.io/paywall-library/bearable-symptom-tracker/); [Neura Health review](https://neura.health/insight/bearable-symptom-tracker-app-review)

#### כאב 6: מטפלים משפחתיים (caregivers): תיאום, טפסים וזכאויות
- 63 מיליון אמריקאים, כמעט 1 מכל 4 מבוגרים, טיפלו בשנה האחרונה בבן משפחה עם מצב רפואי מורכב או מוגבלות. זו עלייה של 20 מיליון מאז 2015 — [AARP press release 07/2025](https://www.aarp.org/press/releases/2025-07-24-new-report-reveals-crisis-point-for-americas-63-million-family-caregivers.html)
- מטפל משפחתי משקיע בממוצע 27 שעות בשבוע, ו-24% משקיעים 40 שעות או יותר. 25% רוצים עזרה עם "forms, paperwork, and eligibility", ו-26% אומרים שקשה לתאם בין ספקים. מדגם: 6,858 מטפלים — [Zen Caregiving על Caregiving in the US 2025](https://zencaregiving.org/caregiving-statistics-us-2025/); [AARP PRI](https://www.aarp.org/pri/topics/ltss/family-caregiving/family-caregiving-in-us-2025/)

#### כאב 7: מחסור בתרופות ADHD
- נכון ל-18 באוקטובר 2026, ה-FDA מגדיר מחסור ב-5 תרופות ADHD: Adderall IR גנרי, Vyvanse בכמוסות ובטבליות לעיסה, Concerta ומדבקת methylphenidate. רשימת ASHP מ-4 באוקטובר 2026 מוסיפה את Adderall XR, ‏Focalin XR וגנריות של Ritalin. המחסור תלוי ביצרן ובמינון, ולכן "one pharmacy may lack your dose while another has it" — [ChoosingTherapy](https://www.choosingtherapy.com/?p=110986)
- סטודנט נאלץ להתקשר ליותר מ-25 בתי מרקחת במשך חמישה שבועות כדי למצוא את התרופה. זה מקור משני ולא מאומת — [ISSUP 2025](https://www.issup.net/node/33183)
- ה-DEA העלה מכסות ייצור, אבל לפי Understood "it may not help shortages" — [Understood](https://www.understood.org/en/articles/dea-increases-adhd-stimulant-limits-effect-on-shortage)

#### כאב 8: המתנה לאבחון ADHD ואוטיזם במבוגרים (בריטניה)
- ב-Clinical Partners ההמתנה המשוערת לאבחון ADHD או אוטיזם במבוגרים היא 12–18 חודשים, להפניות שהתקבלו אחרי 17 בדצמבר 2025. ה-ICB של Bristol ביקש "to pause booking new autism and ADHD assessments" — [Clinical Partners](https://www.clinical-partners.co.uk/right-to-choose)
- ב-Psychiatry UK ההמתנה לאבחון ADHD במבוגרים היא 12–18 חודשים, והמסלול זמין רק בגיל 18 ומעלה ועם GP באנגליה — [Psychiatry UK](https://psychiatry-uk.com/right-to-choose/)
- ב-SLaM, מעבר לספק אחר עלול לסגור את המקום ברשימה המקומית, כי מותר להיות רק ברשימת המתנה אחת לכל מצב — [SLaM](https://slam.nhs.uk/nhs-right-to-choose-adhd-autism-assessments). ב-Devon, אחרי אבחון דרך Right to Choose השירות המקומי עשוי לא לקבל הפניות להמשך — [DPT](https://www.dpt.nhs.uk/our-services/adult-autism-and-adhd)

#### כאב 9: בריאות האישה: אנדומטריוזיס ומנופאוזה
- בסקר Endometriosis UK (‏3,075 משיבים, ספטמבר–אוקטובר 2025) זמן האבחון הממוצע עלה ל-9 שנים ו-4 חודשים, לעומת 8 שנים ב-2020. 83% אמרו שאיש מקצוע אמר להן שהן "making a fuss about nothing" או שהסימפטומים "normal". 55% הגיעו למיון, ו-46% מהן שוחררו בלי טיפול — [The Pharmacist](https://www.thepharmacist.co.uk/in-practice/endometriosis-diagnosis-takes-more-than-nine-years-survey-shows/); [Yorkshire Post](https://www.yorkshirepost.co.uk/health/endometriosis-patients-now-waiting-nearly-a-decade-to-get-a-diagnosis-5617194)
- **Midi Health (מנופאוזה):** גייסה Series D של 100 מיליון דולר בפברואר 2026, לפי שווי של יותר ממיליארד דולר. לפי המנכ"לית יש לה run-rate של 150 מיליון דולר (לעומת 60 מיליון בסוף 2024) ויותר מ-25,000 מטופלות בשבוע. היא עובדת עם ביטוח מסחרי (UHC, ‏Cigna, ‏Aetna) ולא עם Medicare או Medicaid — [FemTech Insider](https://femtechinsider.com/midi-health-raises-100-million-series-d-surpasses-1-billion-valuation/); [Sacra](https://sacra.com/research/midi-health)

#### כאב 10 (ישראל): המתנה לטיפול נפשי בקופות
- בסקר שכלל 361 פסיכולוגים, כ-68% מעריכים שההמתנה לטיפול פסיכולוגי בשירות הציבורי היא חצי שנה ומעלה, ויותר מחמישית מעריכים שהיא נמשכת שנה לפחות. במגזר הפרטי, ובעיקר במרכז, כמחצית מהמטופלים מגיעים לפסיכולוג תוך חודש — [ישראל היום](https://www.israelhayom.co.il/health/article/21084975)
- בדיקת עיתון: בפברואר ובבדיקה חוזרת ביולי "לא היה ניתן כלל להזמין תורים לטיפול אצל מטפלים בהסדר עם קופות החולים". החריג היחיד היה כללית במחוז ירושלים — [ישראל היום](https://www.israelhayom.co.il/health/article/21084975)
- מבקר המדינה (נתוני 2018) מצא המתנה ממוצעת של כ-150 יום לפסיכותרפיה, וכתב ש"קופות החולים אינן מעסיקות פסיכותרפיסטים בהיקף מספק", ולכן מטופלים פונים למטפלים פרטיים ומשלמים מכיסם — [מבקר המדינה 2020](https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2020/70b/2020-70b-206-Mental-Taktzir.pdf)

#### כאב 11 (ישראל): טופס 17, ועדת חריגים ומיצוי זכויות מול הקופה
- טופס 17 הוא "תנאי הכרחי למימון השירות הרפואי על ידי הקופה". מי שקיבל סירוב יכול לפנות לנציבות קבילות הציבור — [כל זכות](https://www.kolzchut.org.il/he/קבלת_טופס_התחייבות_(טופס_17)_מקופת_החולים)
- הקופה חייבת לענות תוך 4 ימי עבודה. אם היא מסרבת אפשר לפנות לנציבות הפניות בקופה, לנציבות קבילות הציבור במשרד הבריאות או לאגודה לזכויות החולה — [המכלול](https://www.hamichlol.org.il/%D7%98%D7%95%D7%A4%D7%A1_17)
- טיפול שאינו בסל עובר לוועדת חריגים, ואפשר להיעזר בעורך דין או במיופה כוח — [כל זכות: ערעור על אי קבלת שירות רפואי](https://www.kolzchut.org.il/he/ערעור_על_אי_קבלת_שירות_רפואי)
- מאז 1 בספטמבר 2023 הקופות חייבות לאפשר בחירה בין 4 ל-6 בתי חולים, וחלק מהטיפולים ניתנים בלי טופס 17. לא אימתתי אם זה עדיין בתוקף ב-2025–2026 — [ice](https://www.ice.co.il/health/news/article/965370)

#### כאב 12: "AI front door" או חוות דעת שנייה מבוססת AI
- Counsel Health גייסה Series A של 25 מיליון דולר (a16z ו-GV) באוקטובר 2025, אחרי סבב seed של 11 מיליון ב-2024. היא מציעה AI בפיקוח רופאים, ומדווחת על יותר מ-100,000 חברים דרך שותפויות — [BusinessWire](https://www.businesswire.com/news/home/20251016535098/en/Counsel-Health-Raises-$25M-to-Launch-Physician-Supervised-AI-Front-Door-for-Healthcare); [Built In NYC](https://www.builtinnyc.com/articles/counsel-health-raises-25-million-series-a-20251020)
- ChatGPT Health נכנס לאותו מרחב, עם יותר מ-230 מיליון שואלי שאלות בריאות בשבוע — [CNBC](https://www.cnbc.com/2026/01/07/openai-chatgpt-health-medical-records.html)

### Inferences

**פסק דין לכל כאב:**

| # | כאב | מי משלם | פסק דין | נימוק |
|---|---|---|---|---|
| 1 | ערעורי ביטוח מצד המטופל (ארה"ב) | המטופל (Claimable כ-40–50 דולר), מענקים (Counterforce) | **DROPPED** | הכאב אמיתי ועצום (19% דחיות, 1% ערעורים), אבל בשנתיים האחרונות הופיעו לפחות שלושה כלים חינמיים או זולים (Counterforce, ‏FHI, ‏Claimable), ו-LLM כללי כמו ChatGPT מנסח מכתב ערעור בעצמו. מכתב ערעור הפך למוצר מסחרי זול. בנוסף, מייסד ישראלי רחוק מניואנסים של ERISA ותוכניות מדינתיות. נישה אפשרית: תרופות יקרות מאוד שבהן ROI להצלחה גבוה, אבל Claimable כבר שם. |
| 2 | חשבונות שגויים וחוב רפואי (ארה"ב) | עמלת הצלחה מהמטופל, מעסיק כהטבה (Sheer) | **SURVIVES בתנאי** | ה-ROI מדיד: 38% ממי שמערער מקבל הפחתה, ורוב האנשים לא מערערים. מודל של עמלת הצלחה (אחוז מהחיסכון) פותר את בעיית ה-WTP הצרכני. סיכונים: Wellero נכשלה, ו-Sheer כבר גייסה כסף. דרוש אימות שמבצעים יכולים לשלם על CAC. |
| 3 | רשומות מפוזרות, "הקלסר" | פארמה (PicnicHealth, ‏Ciitizen), לא המטופל | **DROPPED כאגרגטור גנרי** | ChatGPT Health יחד עם b.well, ‏Apple, ‏Samsung, ו-CMS Kill the Clipboard הופכים את איסוף הרשומות לתשתית חינמית. השוק היחיד שהוכיח את עצמו כאן הוא מכירת נתונים לפארמה, וזה דורש היקף ותשתית רגולטורית. שורד רק כשכבה ורטיקלית (ראו כאבים 4 ו-6). |
| 4 | מסע אבחון במחלה נדירה | פארמה של מחלות נדירות (patient finding ונתוני natural history), עמותות מטופלים | **SURVIVES (נישה)** | מסע אבחון של 4.7 שנים, 25% עם 8 ייעוצים ומעלה. פארמה כבר הוכיחה שהיא משלמת על נתוני מטופלים (Ciitizen עם AstraZeneca, ו-PicnicHealth). מוצר אפשרי: כלי למשפחה שבונה ציר זמן מסודר מכל המסמכים עם LLM ומכין תיק להפניה למרכז מומחיות. סיכון: אם הכלי מציע אבחנות הוא עלול להיחשב SaMD. |
| 5 | מעקב סימפטומים כרוני ו-Long COVID | המטופל (כ-7 דולר לחודש) | **DROPPED** | השוק רווי (Guava חינמי, Bearable, ‏Flaredown), ה-WTP נמוך, ויש עייפות מרישום ידני. ההבחנה היחידה האפשרית, רישום פסיבי עם LLM, נבלעת בידי ChatGPT Health ו-Apple. |
| 6 | מטפלים משפחתיים: תיאום וטפסים | המטפל מכיסו, מעסיק (הטבת caregiving), Medicaid ו-LTSS | **SURVIVES (חזק)** | 63 מיליון מטפלים, 27 שעות בשבוע, ו-25% מבקשים במפורש עזרה בטפסים ובזכאויות. האחריות כאן בעיקר אדמיניסטרטיבית ולא קלינית, ולכן הסיכון הרגולטורי נמוך. LLM שקורא מכתבים, טפסים וזימונים ומנהל משימות משפחתיות הוא דבר שהתאפשר רק ב-2024–2026. **לא נחקרו כאן מתחרים ייעודיים (gap).** |
| 7 | מחסור בתרופות ADHD | המטופל (מיקרו-תשלום), אולי בתי מרקחת | **DROPPED (כסטארטאפ)** | הכאב חריף (25 בתי מרקחת בחמישה שבועות), אבל אין גישה לנתוני מלאי בזמן אמת, מדובר בחומרים מפוקחים (DEA), וכשהמחסור יסתיים גם הצורך ייעלם. מתאים לכל היותר לכלי צדדי. |
| 8 | המתנה לאבחון ADHD ואוטיזם במבוגרים (בריטניה) | NHS (Right to Choose), המטופל באבחון פרטי | **DROPPED** | צוואר הבקבוק הוא היצע הקלינאים ולא תוכנה. כלי ניווט ב-RTC קל להעתקה, והמדיניות משתנה (ICBs עוצרים הזמנות). |
| 9 | בריאות האישה: הכנה לביקור ותיעוד | המטופלת מכיסה, מעסיק, ביטוח (Midi) | **SURVIVES בתנאי** | Midi הוכיחה WTP עצום (run-rate של 150 מיליון דולר), אבל המודל שלה הוא מרפאה עם קלינאים. כלי תוכנה בלבד, יומן סימפטומים שמייצר "תיק ראיות" לביקור במקום "making a fuss about nothing", הוא feature קטן שקל להעתיק. עדיף ערוץ B2B2C דרך מרפאות או מעסיקים. |
| 10 | המתנה לטיפול נפשי (ישראל) | המטופל (פרטי, החזר מהשב"ן), ביטוחים משלימים ופרטיים | **SURVIVES (beachhead ישראלי)** | יש פער ברור: חצי שנה עד שנה בציבורי, חודש בפרטי. מוצר אפשרי: התאמה וניווט אל מטפל פרטי זמין, יחד עם אוטומציה של החזר מהשב"ן או מהביטוח. **לא נחקרו מתחרים ישראליים קיימים ותנאי ההחזר (gap).** |
| 11 | טופס 17, ועדת חריגים ומיצוי זכויות (ישראל) | המטופל (עמלת הצלחה), ביטוח פרטי | **SURVIVES (beachhead ישראלי)** | התהליך בירוקרטי, מתועד ב"כל זכות", ויש בו מסלולי ערר ברורים. סוכן AI בעברית שמנסח בקשות וערעורים ומנהל לוח זמנים (4 ימי עבודה) הוא משהו שמייסד ישראלי מבין טוב יותר ממתחרים זרים. השוק קטן, ולכן זה beachhead ולא יעד סופי. |
| 12 | AI front door וחוות דעת שנייה | ביטוחים ומעסיקים (Counsel), ‏OpenAI חינם | **DROPPED** | ענקיות ומשקיעי tier-1 כבר שם. אחריות קלינית ורגולציית SaMD גבוהות מדי לצוות קטן. |

- התבנית החוזרת היא שבכל מקום שבו מטופלים מוכנים לשלם בפועל (Midi, ‏Claimable), נמכר שירות עם תוצאה ברורה (טיפול, ביטול חיוב), ולא "כלי ארגון". כלי ארגון טהורים (Bearable, ‏Guava) נשארים חינמיים או זולים.

### Gaps
- לא נמצאו ציטוטים מילוליים מ-Reddit, כי כלי החיפוש לא מאנדקס אותו. כדאי לבצע חיפוש ידני ב-r/ChronicIllness, ‏r/healthinsurance, ‏r/endometriosis, ‏r/Menopause ו-r/LongCovid.
- לא נבדקו מתחרים ל-caregiver coordination (למשל Carefull, ‏Ianacare ואחרים), ולכן הם לא מצוטטים.
- לא נמצא נתון עדכני לשנים 2024–2026 על שכיחות Long COVID בארה"ב. הנתון האחרון הוא מ-2022.
- לא אומתו נתוני הצלחה עצמאיים לכלי הערעור (70%, 75% ו-80% הם נתוני החברות עצמן).
- לא נמצאו נתונים על מנופאוזה ו"dismissal" (מעבר ל-Midi), על פוריות, או על Medisafe, ‏Seqster ו-Waltz Health.

---

## שאלה 2: איפה מטופלים מתלוננים בקול רם, ומה הפתרונות העוקפים שלהם?

### Takeaway
הראיות החזקות לתלונות מגיעות מסקרי מטופלים גדולים (KFF, ‏Commonwealth, ‏EURORDIS, ‏Endometriosis UK, ‏AARP) ומתחקירי עיתונות בישראל. הפתרונות העוקפים המתועדים הם קלסרים פיזיים ותבניות Google Sheets שנמכרות ב-Etsy, שיחות לעשרות בתי מרקחת, ומעבר לטיפול פרטי בתשלום.

### Cited Findings
- הקלסר הפיזי: "four-inch binder", ובקשה של עותק נייר מכל ביקור — [CommonWell Alliance](https://www.commonwellalliance.org/author_post_blog/morgan-knochel/)
- שוק Etsy ו-Payhip לתבניות "medical binder", כולל "Symptom Tracker, Flare Journal, Appointment Prep" — [Etsy](https://www.etsy.com/listing/4472490438)
- ציטוט מסקר אנדומטריוזיס: "making a fuss about nothing" (‏83%) — [The Pharmacist](https://www.thepharmacist.co.uk/in-practice/endometriosis-diagnosis-takes-more-than-nine-years-survey-shows/)
- בישראל: מטופלים פונים לטיפול פרטי ומשלמים מכיסם, כי הקופות לא מעסיקות מספיק פסיכותרפיסטים — [מבקר המדינה](https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2020/70b/2020-70b-206-Mental-Taktzir.pdf)
- רוב המטופלים לא מערערים בכלל: 1% מהדחיות in-network ([KFF](https://www.kff.org/private-insurance/issue-brief/claims-denials-and-appeals-in-aca-marketplace-plans-in-2023/)), ופחות ממחצית מקבלי חשבונות שגויים ([HealthDay](https://www.healthday.com/health-news/general-health/common-medical-billing-errors-keep-many-americans-from-care-report))
- בישראל רק 23% ממי שהיה לו סיבה להתלונן הגיש תלונה בפועל. זה מחקר ישן — [University of Haifa](https://cris.haifa.ac.il/en/publications/patterns-of-client-complaints-in-israels-healthcare-system/)

### Inferences
- "הפתרון העוקף הוא לא לעשות כלום" (לא לערער, לא להתלונן) הוא האות החזק ביותר. מוצר שהופך את הפעולה לקלה מספיק מגיע לשוק עצום שלא נוצל, אבל זה גם מעיד שהמשתמש לא פעיל, ולכן ה-CAC עלול להיות גבוה.
- מכירת תבניות קלסר ב-Etsy מוכיחה WTP של כמה דולרים, לא של מנוי.

### Gaps
- לא נאספו ביקורות מ-App Store או Google Play של Medisafe, ‏Bearable ו-Guava (מעבר לדירוגים), ולא נאספו ציטוטים מקבוצות Facebook.

---

## שאלה 3: אילו כלים קיימים בצד המטופל, למה מטופלים עדיין סובלים, ואילו סטארטאפים נכשלו?

### Takeaway
החברות שהצליחו לגייס הון גדול בצד המטופל מונטיזו דרך מישהו אחר: פארמה (PicnicHealth, ‏Ciitizen), ביטוח (Midi, ‏Counsel), או מעסיקים (Sheer). כלים צרכניים טהורים נשארו חינמיים או זולים. הכישלונות נבעו מהוצאות על חומרה ותשתית, וממודל החזר שלא החזיק.

### Cited Findings
- **Forward Health** נסגרה בנובמבר 2024 אחרי גיוס של 100 מיליון דולר בסוף 2023. היא השיקה רק שלוש CarePods וסגרה מרפאות — [eMarketer](https://www.emarketer.com/content/primary-care-startup-forward-health-shuts-down-after-investing-too-much-tech--not-patient-care); [ICT&health](https://www.icthealth.org/news/does-forward-healths-failure-mark-the-winter-of-telehealth)
- **Miga Health** (טיפול קרדיולוגי וירטואלי) נכשלה ב-2025, כי לא עמדה בספי ההחזר של המבטחים. זה מקור חלש (בלוג post-mortem) — [IdeaProof](https://ideaproof.io/failure/miga-health)
- **Wellero** (תשלום חשבונות, Cambia) נסגרה עם כ-1,100 משתמשים — [MedCity News](https://medcitynews.com/?p=71818)
- **PicnicHealth** החליפה את הלקוח: היא מוכרת datasets ל-life sciences — [PicnicHealth](https://picnichealth.com/blog/introducing-the-picnichealth-research-platform)
- **Ciitizen** נרכשה תמורת 325 מיליון דולר בידי Invitae, עם תזת נתונים לצד שלישי — [360Dx](https://www.360dx.com/business-news/invitae-acquire-consumer-health-tech-firm-ciitizen-325m)
- כלי הערעור: Counterforce חינמי וממומן במענקים, ‏FHI חינמי ו-open source, ‏Claimable גובה 39.95 דולר — ראו את המקורות בכאב 1.
- Guava ו-Bearable ראו בכאב 5.

### Inferences
- מטופלים עדיין סובלים כי (א) הכלים דורשים מאמץ ממשתמש שכבר מותש וחולה, (ב) הכאב נמצא בצד השני של השיחה (המבטח או הקופה), וכלי ארגון לא משנה את התוצאה, ו-(ג) צריך תיאום בין גורמים שלא משתפים פעולה.
- הלקח מבעיית המונטיזציה הצרכנית: צריך לבחור משלם שאינו המטופל, או תוצאה כספית מדידה שאפשר לגבות ממנה עמלת הצלחה.

### Gaps
- לא אומת בסבב הזה גורלה של Invitae אחרי 2024, ולכן גם לא גורלה של Ciitizen. ידוע לי מזיכרון שהייתה פשיטת רגל ב-2024, אבל לא נמצא לכך מקור כאן.
- לא נבדקו נתוני Rock Health לשנים 2025–2026 על מימון קונסיומר-הלת'.

---

## שאלה 4: למה עכשיו? מה התאפשר ב-2024–2026?

### Takeaway
ב-2025–2026 קרו שלושה דברים במקביל: CMS הרים את Health Tech Ecosystem עם רשתות מיושרות ו-Kill the Clipboard, ‏OpenAI השיקה את ChatGPT Health עם חיבור רשומות דרך b.well, ו-LLMs נעשו מסוגלים לקרוא מכתבי דחייה ורשומות. זה פותח הזדמנויות, אבל גם הופך את שכבת הנתונים הגנרית לסחורה.

### Cited Findings
- ב-30 ביולי 2025, באירוע בבית הלבן, יותר מ-60 חברות התחייבו ל-Health Tech Ecosystem, ביניהן Apple, ‏Amazon, ‏Anthropic, ‏Google ו-OpenAI. היעדים: Kill the Clipboard, עוזרים שיחתיים, ו-"CMS Aligned Networks" עם זהות IAL2/AAL2 — [CMS press release](https://www.cms.gov/newsroom/press-releases/white-house-tech-leaders-commit-create-patient-centric-healthcare-ecosystem); [CMS Medicare App Library](https://www.cms.gov/initiatives/health-technology-ecosystem/overview/medicare-app-library); [MacTech](https://www.mactech.com/2025/07/30/apple-among-companies-teaming-up-for-next-generation-digital-health-ecosystem/amp/)
- ב-HIMSS26 הכריזו Samsung ו-b.well על שיתוף רשומות בקוד QR מ-Galaxy, כחלק מ-Kill the Clipboard — [Fierce Healthcare](https://www.fiercehealthcare.com/digital-health/samsung-bwell-connected-health-partner-kill-clipboard-key-cms)
- ChatGPT Health (ינואר 2026) מחבר רשומות דרך b.well (ארה"ב בלבד) ואת Apple Health — [CNBC](https://www.cnbc.com/2026/01/07/openai-chatgpt-health-medical-records.html)
- כלי ערעור מבוססי LLM מפיקים מכתב ערעור תוך כשתי דקות על בסיס פוליסות, ספרות והחלטות external review — [Axios](https://www.axios.com/local/raleigh/2025/08/20/using-ai-to-fight-back-against-insurance-denials-counteforce)

### Inferences
- "Why now" אמיתי לסטארטאפ קטן הוא לא גישה לנתונים, כי ענקים יקבלו אותה בחינם. הוא היכולת של LLM לבצע עבודה בירוקרטית (מילוי טפסים, ערעורים, תיאום) בשם המטופל. המשמעות: לבחור כאב שבו "פעולה" שווה כסף, ולא כאב שבו "הצגת מידע" מספיקה.
- EU EHDS ו-TEFCA לא נחקרו כאן לעומק (gap), אבל באירופה זה עשוי לפתוח חלון לפני שהענקים האמריקאים יגיעו לשם. החיבור לרשומות ב-ChatGPT Health מוגבל כרגע לארה"ב.

### Gaps
- לא נאספו מקורות על EU EHDS, ‏TEFCA ו-Apple Health Records בינלאומי, וגם לא על היקף השימוש בפועל ב-ChatGPT Health באוקטובר 2026.

---

## שאלה 5: מי באמת משלם על כלים בצד המטופל? ראיות ל-WTP

### Takeaway
ה-WTP הצרכני הישיר מוכח רק כשמדובר בטיפול או בתוצאה כספית: Midi עם run-rate של 150 מיליון דולר (דרך ביטוח), ‏Claimable עם 40–50 דולר לערעור. כלי ארגון ומעקב מגיעים לכ-7 דולר לחודש לכל היותר. פארמה משלמת על נתוני מטופלים במחלות נדירות וכרוניות.

### Cited Findings
- ‏Claimable: ‏39.95 דולר ועוד משלוח, כ-50 דולר "all in" — [Innovation IA](https://innovationia.com/2025/08/14/startup-stories-claimable-fights-denied-medical-claims/)
- ‏Bearable Premium: כ-6.99 דולר לחודש — [Adapty](https://adapty.io/paywall-library/bearable-symptom-tracker/)
- ‏Midi: ביטוח מסחרי, run-rate של 150 מיליון דולר — [FemTech Insider](https://femtechinsider.com/midi-health-raises-100-million-series-d-surpasses-1-billion-valuation/)
- פארמה: ‏PicnicHealth מוכרת datasets ל-life sciences, ו-AstraZeneca השתמשה בנתוני Ciitizen — [PicnicHealth](https://picnichealth.com/blog/introducing-the-picnichealth-research-platform); [360Dx](https://www.360dx.com/business-news/invitae-acquire-consumer-health-tech-firm-ciitizen-325m)
- ‏Counsel Health מונטזת דרך "existing partnerships", כלומר לא דרך המטופל — [BusinessWire](https://www.businesswire.com/news/home/20251016535098/en/Counsel-Health-Raises-$25M-to-Launch-Physician-Supervised-AI-Front-Door-for-Healthcare)
- ‏FHI ו-Counterforce: חינמיים, כש-FHI גובה 5 דולר על פקס ו-Counterforce ממומן במענקים — [Business Insider](https://businessinsider.nl/shes-worked-at-nearly-every-faang-company-in-her-free-time-she-built-a-free-tool-to-appeal-health-insurance-denials/); [WECT](https://www.wect.com/2025/07/25/ai-tool-that-helps-patients-battle-insurance-claim-denials-got-its-start-wilmingon)

### Inferences
- משלמים לפי סדר ההסתברות לסטארטאפ קטן: (1) עמלת הצלחה על כסף שהוחזר (חשבונות, החזרים, זכויות), (2) מעסיק כהטבה (caregiving, ניווט), (3) פארמה (מחלות נדירות), (4) מנוי צרכני (חלש).
- הנורמה של "חינם" בכלי הערעור (Counterforce, ‏FHI) מורידה את ה-WTP של כל הקטגוריה.

### Gaps
- לא נמצאו נתוני המרה (conversion) או churn לאפליקציות בריאות צרכניות.

---

## שאלה 6: הזווית הישראלית: קופות, זמני המתנה וכאבים ייחודיים

### Takeaway
בישראל הכאבים החריפים הם המתנה לטיפול נפשי (חצי שנה עד שנה בציבורי), ירידה בזמינות תורים למומחים, ובירוקרטיה של טופס 17 וועדות חריגים. מטופלים מעדיפים מאוד את אפליקציות הקופה לפעולות אדמיניסטרטיביות, ולכן כל מוצר יתחרה בהן או יצטרך להשתלב מעליהן.

### Cited Findings
- בסקר של 6,321 ישראלים (JMIR 2024, נאסף ב-2020–2021), ‏80.9% עד 88.2% העדיפו את אפליקציות הקופה לעניינים אדמיניסטרטיביים, אבל רק כמחצית העדיפו מפגש פנים אל פנים לאבחון ולטיפול — [JMIR](https://jmir.org/2024/1/e55350)
- בדירוג מדגם לשנת 2026 נרשמה "ירידה חדה במיוחד בזמינות התורים לרופאים מומחים" בקופות שאינן לאומית — לפי סיכום תוצאת החיפוש על [ישראל היום](https://www.israelhayom.co.il/health/article/21084975) ו-[mako](https://www.mako.co.il/news-specials/data_n12/Article-cd98fa9eda1cc81027.htm). לא אומת ישירות מאיזה עמוד הנתון.
- מבקר המדינה (נובמבר 2024) בדק את זמני ההמתנה לרפואה מומחית, ומצא שבשבעה יישובי פריפריה הקופות לא מספקות שירות פרונטלי בכל התחומים — [מבקר המדינה 2024](https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2024/2024.11-75A-PartB/2024.11-75A-PartB-601-Medical-Specialists-Taktzir.pdf)
- לפי משרד הבריאות ל-2025, חציון ההמתנה ל-MRI הוא 35 ימים והממוצע 55.1 ימים (מסיכום תוצאות החיפוש, בלי עמוד מקור ישיר) — [מעריב](https://www.maariv.co.il/news/health/article-944276)
- טיפול נפשי, טופס 17 וועדות חריגים: ראו כאבים 10 ו-11.

### Inferences
- ישראל מתאימה כ-beachhead לבדיקת מוצר (שפה, הבנת מערכת, גישה למשתמשים), אבל קשה לבנות בה עסק גדול. הקופות שולטות בערוץ, והשוק קטן. כדאי לבנות מוצר שהמנגנון שלו מתורגם לשווקים אחרים: מיצוי זכויות וערעור מקביל ל-appeals בארה"ב, וניווט לטיפול נפשי מקביל ל-NHS ולאירופה.
- ייתכן שסוכן AI בעברית לניווט בין קופה, שב"ן וביטוח פרטי (החזרים, טופס 17, ועדות חריגים) הוא נישה שהקופות עצמן לא ירצו לבנות, כי האינטרס שלהן מנוגד.

### Gaps
- לא נבדקו מתחרים ישראליים בתחום מיצוי הזכויות הרפואיות והחזרי הביטוח (חברות ייעוץ ומיצוי זכויות קיימות), ולא נבדקו נתוני דוח משרד הבריאות על זמני המתנה למומחים ב-2025.
- לא נמצאו נתונים על ביקוש לטיפול נפשי אחרי 7 באוקטובר.

---

## שאלה 7: פרקליט השטן לכל כאב (רגולציה, אחריות, מונטיזציה)

### Takeaway
הסיכון הרגולטורי נמוך בכאבים אדמיניסטרטיביים (חשבונות, טפסים, תיאום, זכויות) וגבוה בכאבים קליניים (אבחון, חוות דעת שנייה, הצעת אבחנות במחלות נדירות). מונטיזציה היא הסיכון המרכזי כמעט בכל הקטגוריות.

### Cited Findings
- OpenAI מציינת במפורש ש-ChatGPT Health "not intended for diagnosis or treatment", כלומר גם ענקית מתרחקת מאחריות קלינית — [Becker's](https://www.beckershospitalreview.com/healthcare-information-technology/ai/openai-launches-chatgpt-health/)
- נתוני ההצלחה של כלי הערעור הם של החברות עצמן בלבד, בלי ביקורת עצמאית — [Innovation IA](https://innovationia.com/2025/08/14/startup-stories-claimable-fights-denied-medical-claims/); [Axios](https://www.axios.com/local/raleigh/2025/08/20/using-ai-to-fight-back-against-insurance-denials-counteforce)
- Miga נכשלה על ספי החזר, ו-Forward על השקעה בטכנולוגיה במקום בטיפול — [IdeaProof](https://ideaproof.io/failure/miga-health); [eMarketer](https://www.emarketer.com/content/primary-care-startup-forward-health-shuts-down-after-investing-too-much-tech--not-patient-care)
- אפליקציות שמתחברות לרשתות CMS חייבות זהות IAL2/AAL2, וזו עלות compliance — [CMS](https://www.cms.gov/initiatives/health-technology-ecosystem/overview/medicare-app-library)

### Inferences
- **כאב 1 (ערעורים):** אם הכלי חינמי, אין הכנסה. ערעור כושל יכול להוביל לתביעת אחריות. HIPAA חל רק לפעמים (אפליקציה צרכנית אינה covered entity, אבל FTC Health Breach Notification Rule כן חל, וזה לא אומת כאן).
- **כאב 2 (חשבונות):** CAC גבוה, ואפשר לטעון שזה "practice of law" או ייצוג מול מבטח. שווה להגיע דרך מעסיק.
- **כאב 4 (נדירות):** הצעת אבחנות עלולה להיחשב SaMD מול FDA או MDR. מכירת נתונים לפארמה דורשת הסכמה ומבנה מחקרי.
- **כאב 6 (caregivers):** הסיכון הרגולטורי נמוך, אבל ה-WTP הצרכני לא מוכח. מכירה למעסיקים היא מחזור מכירה ארוך לצוות קטן.
- **כאב 9 (נשים):** כלי שאינו קליני הוא feature קטן. אם הופכים למרפאה, נדרשים קלינאים ורישוי.
- **כאבים 10 ו-11 (ישראל):** השוק קטן. מול הקופות יש תלות בערוץ וסיכון לחסימה. שירות של מיצוי זכויות עשוי להיכנס לתחום ייצוג משפטי (לא נבדק).

### Gaps
- לא נבדקו תקנות ספציפיות: FDA CDS guidance, ‏FTC HBNR, ‏EU AI Act והמשמעות של MDR לכלי AI צרכני, וגם לא מגבלות על ייצוג מטופלים מול קופות בישראל.
