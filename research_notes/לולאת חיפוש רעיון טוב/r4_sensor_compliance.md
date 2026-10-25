# סבב 4, עדשה: תוכנה + חומרה זולה ליומני רישום מחויבים (Sensor + Compliance Log)

> נכתב ב-2026-10-24. סימון: **[מאומת]** = נמצא במקור שנבדק בסבב הזה (לרוב תקציר תוצאת חיפוש או עמוד ספק); **[מוסק]** = הסקה שלי או ידע קודם בלי מקור שנבדק.
> מגבלות עבודה: כ-22 קריאות כלי. כלי החיפוש מוטה לארה"ב. דומיינים ישראליים (isratemp.co.il, agrinovo.io) **לא נטענו** ב-WebFetch (שגיאת DNS בפרוקסי), ולכן מה שנכתב עליהם מבוסס על תקצירי חיפוש בלבד. לא נמצא שום מחירון ציבורי של ספק ישראלי.
> **שורה תחתונה מראש:** העדשה נכשלת. החומרה "מהמדף" היא בדיוק מה שמונע ממנה להיות חפיר: כל אחד קונה אותה, ובכל ורטיקל שנבדק יש כבר 5–15 ספקים, כולל ישראלים, ורצפת מחיר של 5–6 אירו לחיישן לחודש, או אפליקציה חינמית עם חיישן ב-70–150$.

---

## שאלה 1: אילו חובות רישום קיימות באמת, באיזו תדירות ומי חייב?

### Takeaway
החובות החזקות והמתועדות ביותר הן לא במסעדות. הן בשרשרת הקירור של תרופות וחיסונים (VFC בארה"ב, נוהל 126 של משרד הבריאות בישראל) ובלגיונלה בבריטניה (בדיקה חודשית לפי L8/HSG274). במסעדות בישראל לא נמצא מקור רשמי שמחייב יומן טמפרטורה יומי או מערכת אוטומטית. באחד ממדריכי הספקים כתוב במפורש שאין חובה למערכת אוטומטית.

### Cited Findings
**מזון: ישראל**
- חוזר משרד הבריאות על הובלת מזון: מזון חם בטמפרטורה פנימית של 70°C לפחות, מזון קר עד 5°C, ושמירת רישום של מד החום 30 יום לפחות **[מאומת, תקציר החוזר]**. [gov.il bsv23052005](https://www.gov.il/BlobFolder/policy/bsv23052005/he/files_circulars_bsv_bsv23052005.pdf)
- לא מצאתי טקסט רשמי (תקנות תנאי תברואה לבתי אוכל או המפרט האחיד) שמחייב יומן טמפרטורות יומי במסעדה. שני חיפושים ייעודיים בעברית לא העלו מקור כזה **[מאומת כהיעדר תוצאה]**. [חיפוש 1: תוצאות בלי מקור רשמי](https://www.gov.il/BlobFolder/policy/bz02-2016/he/files_circulars_bz_bz02_2016.pdf)
- במדריך ספק ישראלי (Agrinovo, 2026) נכתב, לפי תקציר החיפוש, ש"אין דרישה ספציפית למערכת אוטומטית". המשפט נקטע בתקציר, והעמוד לא נטען **[מאומת חלקית]**. [Agrinovo](https://agrinovo.io/he/blog/temperature-monitoring-systems-complete-guide/)
- בישראל יש כ-14,000 מסעדות לפי נייר עמדה של התאחדות המלונות. זו הערכה של גוף בעל אינטרס, לא נתון של הלמ"ס **[מאומת כציטוט]**. [melonaim.org](https://melonaim.org/wp-content/uploads/נייר-עמדה-התאחדות-המלונות-רפורמה-בדרישות-רישוי-עסקים-בתי-אוכל.pdf)
- ב-2025 נסגרו כ-4.6% מהמסעדות בישראל, ופתיחת מסעדות חדשות ירדה ב-41% (D&B, דרך מעריב/וואלה). זה פלח בלחץ תקציבי **[מאומת, ממקור משני]**. [maariv](https://www.maariv.co.il/economy/israel/article-1350420)

**מזון: מקובל בעולם (לא חובה ישראלית)**
- "רוב המסעדות בודקות מדחומי מקרר ומקפיא לפחות 4 פעמים ביום". זו פרקטיקה אמריקאית נהוגה מבלוג של Toast, לא חובה חוקית **[מאומת כטענה מסחרית]**. [Toast](https://pos.toasttab.com/vi-us/blog/on-the-line/temperature-log-sheet)
- באיחוד האירופי ובבריטניה יש חובת מערכת מבוססת HACCP (תקנה 852/2004, סעיף 5), ובבריטניה עסקים קטנים משתמשים ביומן הנייר SFBB. לא שלפתי את הטקסט הרשמי **[מוסק]**.

**תרופות וחיסונים**
- בתוכנית VFC בארה"ב נדרש Digital Data Logger לכל יחידת אחסון של חיסונים במימון ציבורי. הדרישות: מרווח רישום של 30 דקות לכל היותר, תצוגת מינימום ומקסימום, אזעקה, ותעודת כיול שאינה ישנה משנתיים **[מאומת, מסמכי מדינות]**. [Alaska](https://health.alaska.gov/media/gevncpgc/temperature_monitoring_device_requirements.pdf), [Michigan](https://www.michigan.gov/documents/mdhhs/Temperature_Monitoring_644333_7.pdf), [Indiana](https://secure.in.gov/health/immunization/files/Policy-9-Storage-and-Handling-Temperature-Requirements-24.pdf)
- ישראל: בדוח ביקורת על בית מרקחת נכתב שהמקרר רושם טמפרטורה כל רבע שעה, והרוקח מוריד את הנתונים מדי יום לקלסר. המבקר המליץ על אחסון ממוחשב. בביקורת אחרת נדרש לשנות מרווח רישום של 25 דקות ל-15 דקות "לפי נוהל 126" **[מאומת, תקציר]**. [odata 1](https://www.odata.org.il/dataset/effdfa54-558e-4caa-80ef-dab4abb287a2/resource/17538723-2c7e-43c6-ac62-ede8786f26f5/download/-.doc), [odata 2](https://odata.org.il/dataset/1414996e-498f-4ea1-a1f1-abab77284870/resource/48096894-d814-45d8-9c31-c15074ff2974/download/-.doc)
- מסמך של מכבי מפרט מערכות ניטור עם רישום ואזעקה אוטומטית ותקנים כמו USP <1118> ו-EN 12830 **[מאומת, תקציר]**. [maccabi4u](https://www.maccabi4u.co.il/SIP_STORAGE/files/8/11428.pdf)

**לגיונלה**
- ישראל: חוזר משרד הבריאות 2/2016 עדכן את הנחיות 2011 (מים חמים לפחות 55°C, או 50°C אם מוסיפים מחסומים אחרים). החוזר חל על בתי חולים, מלונות, בתי הארחה ובתי אבות, והוא מסומן כלא בתוקף. לא נמצאה תדירות רישום מחייבת **[מאומת]**. [gov.il bz02-2016](https://www.gov.il/BlobFolder/policy/bz02-2016/he/files_circulars_bz_bz02_2016.pdf)
- בריטניה: לפי מקור תעשייתי, L8/HSG274 דורשים בדיקת טמפרטורה חודשית במים חמים וקרים, ו"רוב הבדיקות עדיין ידניות". מקור אחר טוען לבדיקה שבועית, כלומר יש סתירה בין המקורות **[מאומת, ממקור משני]**. [legionellacontrol](https://legionellacontrol.com/compliance/automated-temperature-monitoring-legionella-water/), [legionellarisks](https://legionellarisks.co.uk/about-legionella-temperature-monitoring/)

**בריכות, CO2 ורעש**
- בריכות בישראל: תקנות רישוי עסקים (תנאי תברואה נאותים לבריכות שחייה) 1994 ומפרט אחיד 2021. לבריכה ביתית ההנחיה היא לבדוק כלור ו-pH פעמיים ביום. לא נמצא טקסט על בקרה רציפה או על פורמט יומן חובה **[מאומת חלקית, OCR גרוע]**. [gov.il pools guide](https://www.gov.il/BlobFolder/guide/bathing_sites_guide/he/units_environmental_health_home-pools.pdf)
- CO2 בגנים ובכיתות: לא נמצאה דרישה ישראלית. בבריטניה משרד החינוך חילק מוני CO2 בחינם בתקופת הקורונה **[מאומת]**. [Nursery World](https://nurseryworld.co.uk/content/news/nurseries-and-pre-schools-will-receive-air-quality-monitors-next-term)
- רעש בברים בבריטניה: התנאים נקבעים ברישיון של כל מועצה, למשל "יותקן מגביל רעש" ו"יישמר יומן ניטור במקום". אין חובה למנוי ענן **[מאומת]**. [Torbay](https://www.torbay.gov.uk/DemocraticServices/documents/b40016/Item%208%20-%20Additional%20Conditions%20-%20proposed%20at%20the%20meeting%20by%20the%20Public%20Protection%20Officer%20Thursday.pdf?T=9), [Oadby & Wigston](https://moderngov.oadby-wigston.gov.uk/documents/s34552/Appendix%202%20-%20Envrironmental%20Health%20Representation.pdf)

### Inferences
- החובה ה"יומית" שהעדשה הניחה קיימת בפועל רק כפרקטיקה במסעדות. בישראל לא אימתתי חובה כזו. היכן שהחובה חזקה (חיסונים, תרופות, בתי חולים) הלקוחות מעטים ומוסדיים, והם כבר מצוידים.
- לגיונלה בבריטניה היא חובה חודשית ולא יומית. עדיין עוברת את קריטריון 2 (תדירות), אבל הערך שהסנסור מוסיף לבדיקה חודשית קטן יותר.

### Gaps
- הטקסט המלא של המפרט האחיד לבתי אוכל ושל תקנות תנאי תברואה לבתי אוכל לא נשלף, ולכן לא ידוע אם יש חובת יומן בפועל.
- נוסח נוהל 126 (אחסון תרופות) לא נשלף ישירות. מספר בתי המרקחת והמרפאות בישראל לא נבדק.
- לא נמצא נתון רשמי על מספר בתי האוכל ברישיון, על מספר הבריכות הציבוריות או על מספר המטבחים המוסדיים בישראל.

---

## שאלה 2: אילו פתרונות חיישן + תוכנה כבר קיימים, ובכמה?

### Takeaway
השוק רווי בכל רמות המחיר. בחלק העליון: Jolt ו-ComplianceMate (מאות דולרים לחודש לסניף). באמצע: SafetyCulture (84$ לחיישן לשנה). בתחתית: Octopus HACCP ו-Sencono (5–6 אירו לנקודת מדידה לחודש, כולל חומרה). בתחתית ממש: Temp Stick ו-MOCREO, חיישן ב-70–150$ בלי מנוי. בישראל לבדה נמצאו לפחות 7 ספקים מקומיים.

### Cited Findings
**בינלאומי**
- Octopus HACCP (צרפת): השכרת חיישן ב-6 אירו לחודש לפני מע"מ, ו-hub ב-12 אירו לחודש שמשרת עד 15 חיישנים **[מאומת, תקציר עמוד ספק]**. [octopus-haccp](https://octopus-haccp.com/?p=18130)
- Sencono (גרמניה): 4.95 אירו לנקודת מדידה לחודש, כולל חומרה. ארבעה מקררים עולים 19.80 אירו לחודש **[מאומת, ביקורת צד ג']**. [ki-syndikat](https://www.ki-syndikat.de/tools/sencono/)
- SafetyCulture: ערכת פתיחה בארה"ב (חיישן, gateway ומנוי לשנה) ב-399$. הפירוט: חיישן 75$, gateway 240$, מנוי 84$ לחיישן לשנה **[מאומת, חנות הספק]**. [shop.safetyculture](https://shop.safetyculture.com/products/temperature-sensor-alert-starter-pack-1x-sensor-gateway), [marketplace AU](https://marketplace.safetyculture.com/au/product/standard-temperature-humidity-sensor-lht65s-au915-)
- Jolt: לפי ביקורת צד ג', 296.79$ לחודש ו-549$ דמי הקמה לסניף אחד. מקור אחר מציין 116$ לחודש. החיישנים נמכרים דרך נציג **[מאומת, המקורות סותרים]**. [connecteam](https://connecteam.com/reviews/jolt/), [Jolt support](https://support.jolt.com/en/articles/15305627-how-can-i-order-sensors-for-jolt-and-what-are-the-requirements)
- ComplianceMate: לפי FitGap, מ-650$ לחודש **[מאומת, ממקור משני]**. [FitGap](https://us.fitgap.com/products/compliancemate)
- Checkit (בריטניה): המערכת בליסינג מתחת ל-100 ליש"ט לחודש. Kelsius FoodCheck מתחיל ב-25 ליש"ט לחודש בלי חיישנים **[מאומת, תקציר]**. [Cambridge Network](https://www.cambridgenetwork.co.uk/news/checkit-offers-mobile-monitoring-247-food-safety), [Hospitality Ireland](https://hospitalityireland.com/general-industry/digital-haccp-wireless-temperature-monitoring-176868)
- Temp Stick: אין דמי מנוי, הפורטל והאפליקציה חינמיים וההתראות ללא הגבלה. משתמש מדווח על התקנה בכמה חדרי קירור (walk-in). המחיר בקמעונאים סותר (69–149$) **[מאומת, ביקורות ומשווקים]**. [theweatherstationexperts](https://theweatherstationexperts.com/temp-stick-review/)
- ברמת הצרכן: מדחום WiFi עם גשוש (אפליקציית Tuya/Smart Life) וערכת MOCREO "ללא דמי מנוי, ייצוא רשומות נתונים" נמכרים באמזון **[מאומת]**. [Amazon MOCREO](https://www.amazon.com/-/he/MOCREO-%D7%90%D7%A4%D7%9C%D7%99%D7%A7%D7%A6%D7%99%D7%94-%D7%A8%D7%A9%D7%95%D7%9E%D7%95%D7%AA-%D7%98%D7%9E%D7%A4%D7%A8%D7%98%D7%95%D7%A8%D7%94-%D7%90%D7%9C%D7%97%D7%95%D7%98%D7%99%D7%99%D7%9D/dp/B09QM4P4VP)
- אפליקציות HACCP חינמיות: HACCP LE של ThermoWorks מייצאת PDF, ו-Alcomo HACCP חינמית עם אינטגרציית חיישנים **[מאומת, App Store]**. [Alcomo](https://apps.apple.com/my/app/app/id1428695646), [ThermoWorks HACCP LE](https://apps.appfollow.io/ios/haccp-le/1313350359?country=us)

**ישראל** (כולם מתקצירי חיפוש. העמודים עצמם לא נטענו, ולא נמצאו מחירים)
- BioAnalytics: ניטור אלחוטי על תקשורת סלולרית, התראות ב-SMS, וואטסאפ ושיחה קולית, כיול ISO 17025, אחסון בענן עד 7 שנים, ייצוא ל-Excel ול-PDF. הספק טוען שהמערכת עונה על "נוהל 126 ודרישות HACCP", ויש לו מוצר נפרד למזון **[מאומת, עמוד ספק]**. [bioanalytics agsense](https://www.bioanalytics.co.il/products/agsense-temperature-humidity-control-and-monitoring/), [bioanalytics food](https://www.bioanalytics.co.il/products/temperature-monitoring-system-for-food/)
- IsraTemp: מכוון לקייטרינג ולמטבחים מרכזיים, עם אחסון במכשיר ובענן **[מאומת, תקציר]**. [isratemp](https://isratemp.co.il/)
- WeMonitor: חיישני Bluetooth לרשתות מזון, מסעדות, מטבחים מסחריים ומלונות **[מאומת, תקציר]**. [wemonitor](https://wemonitor.co.il/)
- G1 Group, Polaris (My Sirius), SmartSignals ו-Agrinovo: מערכות ענן אלחוטיות לניטור טמפרטורה **[מאומת, תקציר]**. [G1](https://www.g1-group.com/temperature-control/), [Polaris](https://polariscom.co.il/?p=5226), [SmartSignals](https://www.smartsignals.io/), [Agrinovo](https://agrinovo.io/he/blog/how-to-choose-temperature-monitoring-system/)
- B.Z.-Com ו-IDP מוכרים בישראל בקרי WiFi עם התראות **[מאומת]**. [bz-com](https://www.bz-com.com/product/%D7%97%D7%99%D7%99%D7%A9%D7%9F-%D7%98%D7%9E%D7%A4%D7%A8%D7%98%D7%95%D7%A8%D7%94-%D7%AA%D7%A2%D7%A9%D7%99%D7%99%D7%AA%D7%99-%D7%9C%D7%A2%D7%A1%D7%A7%D7%99%D7%9D/), [idp](https://www.idp.co.il/doc/IDP-T3T)

**לגיונלה, בריטניה**
- Cistermiser LinkThru (Sigfox, נקודות sentinel, פורטל ענן), PTSG Water RTM ו-Invisible Systems (LoRaWAN, עד 4 גשושים, סוללה ל-3.25 שנים). Lancashire County Council פרסמה מכרז לניטור טמפרטורת מים, מחולק לשני חוזים **[מאומת]**. [Cistermiser](https://www.specifiedby.com/cistermiser/linkthru-tmu-real-time-monitoring-of-water-temperatures), [PTSG](https://www.ptsg.co.uk/wp-content/uploads/2026/02/PTSG-Water-RTM-Brochure.pdf), [Invisible Systems](https://www.invisible-systems.com/legionella-monitoring-google), [Find a Tender](https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-06e9ef)
- ClipR (SOCOTEC) בהולנד בליסינג, ו-Legionelladossier בשיתוף עם סכיפהול **[מאומת]**. [SOCOTEC](https://www.socotec.com/media/client-projects/clipr-sensors), [Legionelladossier](https://legionelladossier.com/en/?p=5015)

**רעש**
- dB Electronics מציעה מגבלי רעש עם פלטפורמת ענן ולוג רציף "כראיה משפטית" **[מאומת, טענת ספק]**. [bekafun](https://www.bekafun.com/en/producer/104924010/dB-electronics-limiters)

### Inferences
- החומרה (LoRaWAN, Tuya או BLE מהמדף) זמינה לכל מתחרה, ולכן היא לא חפיר. עלות המעבר של הלקוח נמוכה: ספק מתחרה מתקין 4 חיישנים בחצי שעה.
- החפיר האמיתי בתחום הוא ערוץ התקנה ושירות (טכנאים, כיול ISO 17025, חוזים מוסדיים), לא תוכנה. זה מנוגד לקריטריון 8, מייסד יחיד שבונה ווב ומובייל.
- רצפת המחיר באירופה (5–6 אירו לחיישן לחודש, כולל חומרה) משאירה למייסד יחיד מרווח זעום אחרי עלות החומרה, הסוללות, ההחלפות והתמיכה **[מוסק]**.

### Gaps
- מחירים של ספקים ישראליים (BioAnalytics, IsraTemp, WeMonitor) לא נמצאו, כי העמודים לא נטענו ואין מחירון פומבי.
- מספר הלקוחות של כל ספק ישראלי לא ידוע.
- לא נבדקו Monnit, Testo Saveris, ‏Trail, ‏Navitas ו-ComplianceMate לעומק, אבל זה לא ישנה את מסקנת הרוויה.

---

## שאלה 3: בדיקת הריגה מהירה לכל מועמד (9 קריטריונים)

### Takeaway
אף מועמד לא עובר יותר מ-4 מתוך 9. הכשלים החוזרים: קריטריון 3 (יש פתרון זול או חינמי), 4 (אין פער מוסבר, יש ספקים ישראליים), 9 (פרקליט השטן: החומרה לא חפיר) ולעיתים 2 (החובה לא יומית או לא קיימת).

### Cited Findings
(הציונים מבוססים על הממצאים בשאלות 1 ו-2. ✓ = עובר, ✗ = נכשל, ~ = גבולי)

| # | מועמד | 1 משלם | 2 תדירות | 3 אין חינמי | 4 פער | 5 ערוץ | 6 גודל | 7 פלטפורמה | 8 מייסד | 9 פרקליט שטן | ציון |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | HACCP חיישני מקרר למסעדות בישראל | ~ (ספקים קיימים גובים, מחיר לא ידוע) | ✓ פרקטיקה יומית | ✗ (Temp Stick, Tuya, MOCREO) | ✗ (7+ ספקים ישראליים) | ~ | ~ (כ-14,000 מסעדות, בלחץ) | ✓ | ✓ | ✗ | **3.5/9** |
| B | HACCP חיישנים למסעדות ובתי קפה באירופה ובבריטניה | ✓ (Checkit, Kelsius, Octopus) | ✓ | ✗ (Octopus ב-6 אירו, אפליקציות חינמיות) | ✗ | ✗ (ישראלי מול שוק זר פיזי) | ✓ | ✓ | ~ (התקנה פיזית בחו"ל) | ✗ | **3.5/9** |
| C | מטבחים מוסדיים בישראל (קייטרינג, מעונות, בתי אבות): חיישנים ויומן ניקיון וקבלת סחורה | ~ | ✓ | ~ | ✗ (IsraTemp מכוונת בדיוק לקייטרינג; תוכנות לגנים כבר נפסלו) | ~ | ✗ (מאות עד אלפים בודדים, לא אומת) | ✓ | ✓ | ✗ | **3.5/9** |
| D | מקררי חיסונים ותרופות בבתי מרקחת ומרפאות בישראל (נוהל 126) | ✓ (חובת רישום כל 15 דקות, דוחות ביקורת) | ✓ | ~ | ✗ (BioAnalytics טוענת עמידה בנוהל 126, וקופות החולים מצוידות) | ✗ (קנייה מרוכזת דרך הקופות והרשתות) | ✗ (ככל הנראה אלפים בודדים של יחידות, לא אומת) | ~ (תלוי בנוהל ובקופות) | ~ (כיול ISO 17025 מחייב שותף) | ✗ | **3/9** |
| E | לגיונלה, בדיקת sentinel חודשית בבריטניה (HMO, חדרי כושר, מלונות קטנים) | ✓ (חוזים עם קבלני מים) | ✓ חודשי | ✓ | ✗ (Cistermiser, PTSG, Invisible Systems, ClipR, מכרזים מוסדיים) | ✗ (הערוץ עובר דרך קבלני water hygiene) | ✓ | ✓ | ✗ (גשושים על צנרת, התקנה פיזית) | ✗ | **4/9** |
| F | לגיונלה במלונות ובבתי אבות בישראל | ✗ (לא נמצאה חובת רישום בתדירות קבועה; החוזר מסומן כלא בתוקף) | ✗ | ~ | ~ | ~ | ✗ (כ-550 מלונות לפי התאחדות המלונות) | ✓ | ~ | ✗ | **2/9** |
| G | בריכות: חיישני כלור ו-pH ויומן אוטומטי בישראל | ~ | ✓ (לפי התקנות) | ✗ (בקרי מינון מסחריים כוללים רישום [מוסק]) | ✗ | ~ | ✗ (מאות עד אלף וקצת בריכות ציבוריות [מוסק]) | ✓ | ✗ (חיישני כלור דורשים כיול ותחזוקה) | ✗ | **2/9** |
| H | CO2 בגנים ובכיתות | ✗ (לא נמצאה חובה ישראלית; בבריטניה המדינה חילקה מונים חינם) | ✗ | ✗ | ✗ | ~ | ~ | ✗ (תלוי בהחלטת משרד) | ✓ | ✗ | **1.5/9** |
| I | מגבלי רעש ולוג לברים | ~ (תנאי רישיון לכל מועצה) | ✓ | ~ | ✗ (dB Electronics ועוד) | ✗ | ✗ (רק מקומות עם תנאי רישיון) | ✗ (המועצה מאשרת את סוג המגביל) | ✗ (חומרה מוסמכת) | ✗ | **1.5/9** |
| J | סיורי בטיחות אש עם NFC, בדיקת גנרטור שבועית | ~ | ✓ | ✗ (אפליקציות guard tour נפוצות [מוסק, לא נבדק]) | ✗ | ~ | ~ | ✓ | ✓ | ✗ | **3/9** |
| K | מוני משנה לחיוב שוכרים במבנים מסחריים בישראל | ✓ | ✓ | ~ | ✗ (שחקנים כמו Satec ו-Arad [מוסק, לא נבדק]) | ✗ | ~ | ✓ | ✗ (התקנת חשמל מוסמכת) | ✗ | **3/9**. לא חובת רישום אלא חיוב, ולכן מחוץ לעדשה |

**פרקליט השטן, הטיעון המנצח לכל העדשה:** אם החומרה מהמדף, היא לא חפיר. אם היא ייחודית, נדרשים פיתוח חומרה, אישורים, כיול ושרשרת אספקה, וזה לא מייסד יחיד ב-MVP של שבועיים. בתווך הזה יושבים כבר עשרות ספקים, ובישראל לבדה לפחות 7, שחלקם מתקינים ונותנים שירות. והלקוח (מסעדה בישראל) לא תמיד מחויב ביומן כזה.

### Inferences
- לקח מסבב 2 חוזר כאן: "מה שקל לבנות כבר נבנה". זה נכון גם לחומרה, כי חיישני LoRaWAN, BLE ו-Tuya הפכו למצרך (commodity).
- התחום היחיד שבו הכאב, החובה והתקציב מתיישרים יחד הוא תרופות וחיסונים, אבל הוא מוסדי, מרוכז ומצויד.

### Gaps
- לא אומתו מספרי מטבחים מוסדיים, בתי מרקחת ובריכות ציבוריות בישראל.
- סיורי אש עם NFC ומוני משנה לא נבדקו בחיפוש (המתחרים צוינו מהזיכרון), ולכן הציון שלהם פחות אמין.

---

## שאלה 4: שלושת הטובים ביותר (מהעדשה הזו) והמלצה

### Takeaway
אין כאן רעיון שעובר את 9 הקריטריונים. אלה שלושת המועמדים "הכי פחות גרועים", ואף אחד מהם לא מצדיק בדיקת הריגה מעמיקה. ההמלצה: לסגור את העדשה.

### Cited Findings
1. **E, ניטור לגיונלה חודשי בבריטניה (4/9).** החובה אמיתית וחוזרת, ורוב הבדיקות עדיין ידניות לפי [legionellacontrol](https://legionellacontrol.com/compliance/automated-temperature-monitoring-legionella-water/). אבל קבלנים ויצרנים כבר בשוק ([Cistermiser](https://www.specifiedby.com/cistermiser/linkthru-tmu-real-time-monitoring-of-water-temperatures), [PTSG](https://www.ptsg.co.uk/wp-content/uploads/2026/02/PTSG-Water-RTM-Brochure.pdf)), ההפצה עוברת דרך קבלני water hygiene, וההתקנה פיזית על צנרת בבריטניה.
2. **A/C, יומן בטיחות מזון דיגיטלי למטבחים בישראל (3.5/9).** הדרישות בעברית מוכרות לבודקים, אבל לפחות 7 ספקים ישראליים כבר מוכרים חיישנים עם ענן ([BioAnalytics](https://www.bioanalytics.co.il/products/temperature-monitoring-system-for-food/), [IsraTemp](https://isratemp.co.il/), [WeMonitor](https://wemonitor.co.il/)), ולא אומתה חובת יומן במסעדות.
3. **D, מקררי תרופות וחיסונים בבתי מרקחת פרטיים בישראל (3/9).** החובה החזקה ביותר שנמצאה (רישום כל 15 דקות לפי נוהל 126, [odata](https://odata.org.il/dataset/1414996e-498f-4ea1-a1f1-abab77284870/resource/48096894-d814-45d8-9c31-c15074ff2974/download/-.doc)), אבל BioAnalytics כבר טוענת עמידה בנוהל ([bioanalytics](https://www.bioanalytics.co.il/products/agsense-temperature-humidity-control-and-monitoring/)), השוק קטן ונדרש כיול מוסמך.

### Inferences
- **לקח חדש לפרומט:** "חומרה מהמדף + תוכנה" אינה חפיר. החפיר בתחומי IoT לציות נוצר משירות שטח, כיול מוסמך וחוזים מוסדיים, כלומר מעסק שירות ולא ממוצר של מייסד יחיד. כדאי להוסיף לרשימת הפסולים: ניטור טמפרטורה ו-HACCP במסעדות ובמטבחים, לגיונלה, ניטור מקררי תרופות, בריכות, CO2 בכיתות, מגבלי רעש.
- הכיוון היחיד שאולי שווה מחשבה נוספת: שכבת תוכנה בלבד מעל חיישנים צרכניים קיימים (Tuya, SwitchBot, Temp Stick) שמפיקה יומן בפורמט שהבודק המקומי מצפה לו. אבל זה הפוך מהחפיר שהעדשה חיפשה, וזה בדיוק "קל לבנות, כבר נבנה" (Alcomo ו-HACCP LE חינמיות) **[מוסק]**.

### Gaps
- לא נעשתה פנייה לספקים ישראליים לקבלת מחיר. ייתכן שמחיריהם גבוהים ויש פער מחיר בפלח המסעדות הקטנות. לא אומת.
- לא נבדק אם בודקי משרד הבריאות או הרשויות המקומיות דורשים בפועל יומני טמפרטורה בביקורת, למשל בראיון עם בעל מסעדה או מפקח תברואה. זו הבדיקה הזולה ביותר שיכולה להחיות את מועמד A, אם יתברר שזו דרישה נאכפת.
