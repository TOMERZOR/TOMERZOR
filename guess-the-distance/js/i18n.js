// Hebrew first (the app is right-to-left by default), English as a toggle.

const STR = {
  he: {
    hello: "שלום, {name}",
    tabPlay: "משחק", tabDuel: "1 על 1", tabMe: "פרופיל",
    daily: "האתגר היומי", dailySub: "אותם 5 סיבובים לכולם, היום", dailyDone: "שיחקת היום", dailyPlay: "שחקו", roundsWord: "סיבובים", dailyResume: "ממשיכים מסיבוב {n}",
    modes: "מצבי משחק", maps: "מפה", measure: "מה מנחשים",
    classic: "קלאסי", classicSub: "5 סיבובים, בלי לחץ",
    streak: "רצף", streakSub: "ממשיכים כל עוד קולעים",
    timed: "נגד השעון", timedSub: "30 שניות לכל ניחוש",
    challenge: "אתגר חבר", challengeSub: "שלחו קישור עם אותם סיבובים",
    best: "שיא {n}",
    mTime: "זמן נסיעה", mDistance: "מרחק בכביש",
    duelTitle: "דו־קרב", duelLead: "1 על 1 בזמן אמת. מי שקרוב יותר פוגע בשני.",
    online: "מחוברים: {n}", offline: "השרת לא מחובר", connecting: "מתחבר…",
    quick: "משחק מהיר", quickSub: "יריב אקראי מכל העולם", find: "מצאו יריב",
    room: "חדר פרטי", roomSub: "שחקו נגד חבר עם קוד", createRoom: "פתחו חדר", join: "הצטרפו", codePh: "קוד",
    bot: "נגד בוט", botSub: "תרגול 1 על 1, בכל זמן", easy: "קל", normal: "רגיל", hard: "קשה", playBot: "שחקו נגד הבוט",
    rulesTitle: "איך זה עובד",
    rules: "לשניכם <b>6,000 חיים</b>. בכל סיבוב שניכם מנחשים, ומי שקיבל פחות נקודות מאבד את ההפרש. כשאחד ננעל על ניחוש, לשני נשארות <b>15 שניות</b>. מסיבוב 4 הנזק גדל: <b>×1.5, ×2, ×2.5…</b>",
    serverOffNote: "בלי שרת אפשר לשחק נגד הבוט. דו־קרב מול אנשים עובד כשהשרת מחובר.",
    stats: "סטטיסטיקה", games: "משחקים", bestClassic: "שיא קלאסי", bestStreak: "שיא רצף", wins: "ניצחונות", losses: "הפסדים", perfects: "ניחושים מושלמים",
    settings: "הגדרות", language: "שפה", music: "מוזיקה", sfx: "צלילים", haptics: "רטט", server: "שרת", serverOn: "מחובר", serverOff: "לא מחובר",
    name: "שם", namePh: "איך לקרוא לך?", pickAvatar: "בחרו דמות",
    about: "המסלולים מ־OpenStreetMap דרך OSRM, המפה מ־CARTO. זמני הנסיעה בלי פקקים; זמני טיסה לפי לוחות זמנים.",
    welcome: "כמה זמן לוקח להגיע?", welcomeSub: "נחשו זמני נסיעה אמיתיים בארץ ובעולם. ככל שתהיו קרובים יותר, עד הדקה, תקבלו יותר נקודות.",
    letsGo: "יאללה",
    round: "סיבוב", of: "מתוך", score: "ניקוד",
    askTime: "כמה זמן זה לוקח?", askDistance: "כמה קילומטרים בדרך?", askDistanceFlight: "כמה קילומטרים בטיסה?",
    askSubCar: "ברכב, בלי פקקים", askSubFoot: "ברגל", askSubBike: "באופניים", askSubFlight: "בטיסה ישירה",
    guess: "ניחוש", locked: "ננעל ✓", hours: "שע׳", mins: "דק׳", km: "ק״מ",
    crow: "{d} בקו אווירי", speed: "{n} קמ״ש", ofPoints: "מתוך {max}",
    actualTime: "זמן אמיתי", actualDistance: "מרחק אמיתי",
    youGuessed: "ניחשת", over: "גבוה ב־{p}%", under: "נמוך ב־{p}%", exact: "בול!",
    perfect: "מושלם!", amazing: "מדהים", great: "יפה מאוד", good: "לא רע", ok: "כמעט", miss: "רחוק",
    next: "לסיבוב הבא", finish: "לתוצאות", points: "נקודות",
    srcLive: "מסלול אמיתי · OpenStreetMap", srcRef: "נתוני ייחוס (הנתב לא זמין)", srcFlight: "מסלול טיסה · זמן לפי לוח טיסות",
    planning: "מתכננים מסלולים…", planningSub: "מחשבים דרכים אמיתיות על המפה",
    total: "סה״כ", outOf: "מתוך {max}", playAgain: "עוד משחק", home: "בית", share: "שיתוף",
    rank0: "תייר מתחיל", rank1: "נוסע מתמיד", rank2: "נווט", rank3: "מכיר כל כביש", rank4: "וייז אנושי",
    streakOver: "הרצף נגמר", streakCount: "רצף של {n}", streakNeed: "צריך {n}+ נקודות כדי להמשיך",
    timeUp: "נגמר הזמן",
    shareText: "Guess The Distance · {title}\n{score}\n{grid}",
    copied: "הועתק",
    challengeMade: "הקישור הועתק. שלחו לחבר!",
    challengedBy: "אתגר מ־{name}", challengedScore: "{score} נקודות במפה {map}. תצליחו לעקוף?", acceptChallenge: "קבלו את האתגר",
    beat: "עקפת את {name}! 🏆", lostTo: "{name} עדיין בראש", tieWith: "תיקו עם {name}",
    searching: "מחפשים יריב…", searchingSub: "מחוברים עכשיו: {n}", cancel: "ביטול", tryBot: "אין אף אחד? שחקו נגד בוט",
    waitingRoom: "מחכים לחבר", roomCode: "קוד החדר", shareRoom: "שלחו את הקישור", inviteText: "בואו לדו־קרב ב־Guess The Distance! קוד: {code}",
    vs: "VS", roundN: "סיבוב {n}", damageX: "נזק ×{m}",
    thinking: "מחכים ל־{name}…", oppLocked: "הניחוש של {name} ננעל!", hurry: "נשארו {s} שנ׳",
    oppAway: "החיבור של {name} נפל, מחכים…", oppBack: "{name} שוב במשחק",
    victory: "ניצחון!", defeat: "הפסד", draw: "תיקו",
    forfeitWin: "{name} כבר לא במשחק", rematch: "משחק חוזר", rematchWaiting: "מחכים ליריב…", rematchAsked: "{name} רוצה משחק חוזר!",
    leaveQ: "לצאת מהמשחק?", leaveDuel: "יציאה תיחשב כהפסד.", leave: "יציאה", stay: "נשארים",
    noRoom: "לא מצאנו חדר עם הקוד הזה", ownRoom: "זה החדר שלך 🙂", inMatch: "כבר יש לך משחק פעיל", errGeneric: "משהו השתבש, נסו שוב",
    reconnecting: "החיבור נפל, מתחברים מחדש…", reconnected: "חזרנו",
    dmg: "−{n}",
    you: "שלך", me: "אני",
    noGuess: "בלי ניחוש",
    mapsWord: { israel: "ישראל", world: "העולם", walks: "הליכות בעיר", flights: "טיסות", random: "מקומות רנדומליים", mixed: "הכול" },
    modeWord: { car: "רכב", foot: "הליכה", bike: "אופניים", flight: "טיסה" },
  },
  en: {
    hello: "Hello, {name}",
    tabPlay: "Play", tabDuel: "1v1", tabMe: "Profile",
    daily: "Daily Challenge", dailySub: "The same 5 rounds for everyone, today", dailyDone: "Played today", dailyPlay: "Play", roundsWord: "rounds", dailyResume: "Continue from round {n}",
    modes: "Modes", maps: "Map", measure: "What you guess",
    classic: "Classic", classicSub: "5 rounds, no rush",
    streak: "Streak", streakSub: "Keep going while you're close",
    timed: "Time Attack", timedSub: "30 seconds a guess",
    challenge: "Challenge a Friend", challengeSub: "Send a link with the same rounds",
    best: "Best {n}",
    mTime: "Travel time", mDistance: "Road distance",
    duelTitle: "Duels", duelLead: "Live 1v1. Whoever's closer hits the other.",
    online: "{n} online", offline: "Server not connected", connecting: "Connecting…",
    quick: "Quick Match", quickSub: "A random opponent from anywhere", find: "Find Opponent",
    room: "Private Room", roomSub: "Play a friend with a code", createRoom: "Create Room", join: "Join", codePh: "Code",
    bot: "Versus Bot", botSub: "1v1 practice, any time", easy: "Easy", normal: "Normal", hard: "Hard", playBot: "Play the Bot",
    rulesTitle: "How it works",
    rules: "You both start with <b>6,000 health</b>. Each round you both guess, and the lower score loses the difference. Once one player locks in, the other has <b>15 seconds</b>. From round 4 damage grows: <b>×1.5, ×2, ×2.5…</b>",
    serverOffNote: "Without the server you can play the bot. Duels against people work once the server is connected.",
    stats: "Stats", games: "Games", bestClassic: "Best Classic", bestStreak: "Best Streak", wins: "Wins", losses: "Losses", perfects: "Perfect Guesses",
    settings: "Settings", language: "Language", music: "Music", sfx: "Sound Effects", haptics: "Haptics", server: "Server", serverOn: "Connected", serverOff: "Not connected",
    name: "Name", namePh: "What should we call you?", pickAvatar: "Pick an avatar",
    about: "Routes from OpenStreetMap via OSRM, map by CARTO. Drive times are without traffic; flight times follow airline schedules.",
    welcome: "How long does it take?", welcomeSub: "Guess real travel times around Israel and the world. The closer you get, down to the minute, the more points you score.",
    letsGo: "Let's Go",
    round: "Round", of: "of", score: "Score",
    askTime: "How long does it take?", askDistance: "How far by road?", askDistanceFlight: "How far is the flight?",
    askSubCar: "By car, without traffic", askSubFoot: "On foot", askSubBike: "By bike", askSubFlight: "Nonstop flight",
    guess: "Guess", locked: "Locked ✓", hours: "h", mins: "min", km: "km",
    crow: "{d} as the crow flies", speed: "{n} km/h", ofPoints: "/ {max} points",
    actualTime: "Real time", actualDistance: "Real distance",
    youGuessed: "You guessed", over: "{p}% too high", under: "{p}% too low", exact: "Spot on!",
    perfect: "Perfect!", amazing: "Amazing", great: "Great", good: "Not bad", ok: "Close-ish", miss: "Way off",
    next: "Next Round", finish: "See Results", points: "points",
    srcLive: "Real route · OpenStreetMap", srcRef: "Reference data (router unavailable)", srcFlight: "Flight path · scheduled time",
    planning: "Planning routes…", planningSub: "Working out real roads on the map",
    total: "Total", outOf: "out of {max}", playAgain: "Play Again", home: "Home", share: "Share",
    rank0: "Tourist", rank1: "Frequent Traveler", rank2: "Navigator", rank3: "Road Scholar", rank4: "Human GPS",
    streakOver: "Streak over", streakCount: "Streak of {n}", streakNeed: "Score {n}+ to keep going",
    timeUp: "Time's up",
    shareText: "Guess The Distance · {title}\n{score}\n{grid}",
    copied: "Copied",
    challengeMade: "Link copied. Send it to a friend!",
    challengedBy: "{name} challenged you", challengedScore: "{score} points on {map}. Can you beat it?", acceptChallenge: "Accept Challenge",
    beat: "You beat {name}! 🏆", lostTo: "{name} is still ahead", tieWith: "A tie with {name}",
    searching: "Finding an opponent…", searchingSub: "{n} online now", cancel: "Cancel", tryBot: "Nobody around? Play a bot",
    waitingRoom: "Waiting for your friend", roomCode: "Room code", shareRoom: "Send the Link", inviteText: "Duel me in Guess The Distance! Code: {code}",
    vs: "VS", roundN: "Round {n}", damageX: "Damage ×{m}",
    thinking: "{name} is thinking…", oppLocked: "{name} locked in!", hurry: "{s}s left",
    oppAway: "{name} disconnected, waiting…", oppBack: "{name} is back",
    victory: "Victory!", defeat: "Defeat", draw: "Draw",
    forfeitWin: "{name} left the game", rematch: "Rematch", rematchWaiting: "Waiting for opponent…", rematchAsked: "{name} wants a rematch!",
    leaveQ: "Leave the game?", leaveDuel: "Leaving counts as a loss.", leave: "Leave", stay: "Stay",
    noRoom: "No room with that code", ownRoom: "That's your own room 🙂", inMatch: "You're already in a match", errGeneric: "Something went wrong, try again",
    reconnecting: "Connection lost, reconnecting…", reconnected: "Back online",
    dmg: "−{n}",
    you: "You", me: "You",
    noGuess: "No guess",
    mapsWord: { israel: "Israel", world: "The World", walks: "City Walks", flights: "Flights", random: "Random Places", mixed: "Everything" },
    modeWord: { car: "Car", foot: "Walk", bike: "Bike", flight: "Flight" },
  },
};

let lang = "he";

export function setLang(l) {
  lang = STR[l] ? l : "he";
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
}

export function getLang() {
  return lang;
}

// Wrap a piece of text in Unicode isolates so a Latin name or a number keeps
// its place inside a Hebrew sentence (and the other way round).
export function iso(s) {
  return `\u2068${s}\u2069`;
}

export function t(key, vars) {
  let s = STR[lang][key] ?? STR.en[key] ?? key;
  if (vars && typeof s === "string") s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : iso(vars[k])));
  return s;
}

export function word(group, key) {
  return STR[lang][group]?.[key] ?? STR.en[group]?.[key] ?? key;
}

export function placeName(p) {
  return (lang === "he" ? p.he : p.en) || p.en || p.he || "";
}

const nf = () => new Intl.NumberFormat(lang === "he" ? "he-IL" : "en-US");
export function fmtNum(n) {
  return nf().format(Math.round(n));
}

// 65 -> { h: 1, m: 5 }
export function splitMin(min) {
  const m = Math.round(min);
  return { h: Math.floor(m / 60), m: m % 60 };
}

export function fmtTime(min) {
  const { h, m } = splitMin(min);
  const H = t("hours"), M = t("mins");
  if (!h) return `${m} ${M}`;
  if (!m) return `${h} ${H}`;
  return `${h} ${H} ${m} ${M}`;
}

// HTML for the big answer: numbers big, units small.
export function fmtTimeHtml(min) {
  const { h, m } = splitMin(min);
  const H = t("hours"), M = t("mins");
  if (!h) return `<span class="num">${m}</span><small>${M}</small>`;
  if (!m) return `<span class="num">${h}</span><small>${H}</small>`;
  return `<span class="num">${h}</span><small>${H}</small><span class="num">${m}</span><small>${M}</small>`;
}

export function fmtKm(km) {
  const v = km < 20 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${nf().format(v)} ${t("km")}`;
}

export function fmtKmHtml(km) {
  const v = km < 20 ? Math.round(km * 10) / 10 : Math.round(km);
  return `<span class="num">${nf().format(v)}</span><small>${t("km")}</small>`;
}

// "A → B" in English, "A ← B" in Hebrew, so the arrow always points onward.
export function tripArrow() {
  return lang === "he" ? "←" : "→";
}

export function fmtValue(v, measure) {
  return measure === "time" ? fmtTime(v) : fmtKm(v);
}
