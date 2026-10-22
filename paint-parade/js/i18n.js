// UI strings. English is the default; Hebrew ships too (right-to-left).
const S = {
  en: {
    level: 'Level', hard: 'HARD', super: 'SUPER HARD', play: 'Play', next: 'Next',
    tapBucket: 'Tap a bucket!', tipPaints: 'Buckets splash every matching pixel they can see!',
    tipSpots: 'Paint left over? The bucket waits here. Tap it to send it again!',
    tipMystery: 'Mystery bucket! Its color shows when it reaches the front.',
    tipCoat: 'Striped pixels need two coats of paint.',
    tipTwins: 'Twin buckets march together. Both must be at the front.',
    tipFull: 'Keep an eye on your waiting spots. When they are full, the level is lost!',
    beltFull: 'Belt full!', twinWait: 'Twin not ready',
    winTitle: 'Masterpiece!', winSub: 'added to your gallery', claim: 'Claim', x2: 'x2 Coins',
    failTitle: 'Out of space!', failSub: 'Every waiting spot is full.', revive: '+2 Spots', reviveAd: 'Free', giveUp: 'Give up',
    keepGoing: 'Keep painting?', loseLife: 'You will lose a life.', retry: 'Try again', home: 'Home',
    paused: 'Paused', resume: 'Resume', restart: 'Restart', settings: 'Settings',
    sound: 'Sound', music: 'Music', haptics: 'Vibration', language: 'Language',
    shop: 'Shop', gallery: 'Gallery', daily: 'Daily Canvas', dailySub: 'A new painting every day',
    dailyDone: 'Done for today! Come back tomorrow.', streakDays: 'day streak',
    coins: 'coins', coinsTitle: 'Coins', free: 'Free', watch: 'Watch', buy: 'Buy', restore: 'Restore purchases',
    noAds: 'No Ads', noAdsSub: 'Remove forced ads forever', bestValue: 'Best value', starter: 'Starter Pack', starterSub: 'One-time offer',
    freeCoins: 'Free coins', freeCoinsLeft: 'left today', boosters: 'Boosters',
    bSlot: '+Spot', bSlotD: 'One extra waiting spot for this level',
    bGrab: 'Grabber', bGrabD: 'Pick any bucket from a lane',
    bRainbow: 'Rainbow', bRainbowD: 'A rainbow bucket that paints any color',
    unlocked: 'New booster!', tryIt: 'Try it', gotIt: 'Got it',
    outOfLives: 'Out of lives', nextLife: 'Next life in', refill: 'Refill', plusLife: '+1 Life',
    full: 'Full', unlimited: 'Unlimited', album: 'Album', complete: 'Complete!', openChest: 'Open chest',
    locked: 'Locked', hotStreak: 'Hot Brush!', hotStreakD: 'Win streak bonus: +1 waiting spot',
    needCoins: 'Not enough coins', getMore: 'Get more', privacy: 'Privacy Policy', terms: 'Terms of Use', privacyChoices: 'Privacy choices',
    thanks: 'Thank you!', purchased: 'Purchase complete', grabTap: 'Tap any bucket in a lane',
    lv: 'Lv', of: 'of', remaining: 'left', version: 'Version', support: 'Support', newArt: 'New artwork!',
    tapToPlay: 'Tap to play', halfway: 'Halfway!', hourUnlimited: '∞ 60 min', tag20: '+20%', tag60: '+60%', tagPopular: 'Popular', ends: 'Ends in', painting: 'Painting', progress: 'Progress', cancel: 'Cancel',
    reward: 'Reward', dailyReward: 'Daily reward', streakBonus: 'Streak bonus',
  },
  he: {
    level: 'שלב', hard: 'קשה', super: 'קשה מאוד', play: 'שחק', next: 'הבא',
    tapBucket: 'הקש על דלי!', tipPaints: 'הדליים מתיזים צבע על כל פיקסל תואם שהם רואים!',
    tipSpots: 'נשאר צבע? הדלי מחכה כאן. הקש עליו כדי לשלוח אותו שוב!',
    tipMystery: 'דלי מסתורין! הצבע שלו מתגלה כשהוא מגיע לקדמת הטור.',
    tipCoat: 'פיקסלים מפוספסים צריכים שתי שכבות צבע.',
    tipTwins: 'דליים תאומים צועדים יחד. שניהם צריכים להיות בקדמה.',
    tipFull: 'שים עין על מקומות ההמתנה. כשהם מתמלאים, השלב אבוד!',
    beltFull: 'המסוע מלא!', twinWait: 'התאום לא מוכן',
    winTitle: 'יצירת מופת!', winSub: 'נוספה לגלריה שלך', claim: 'קבל', x2: 'מטבעות x2',
    failTitle: 'אין מקום!', failSub: 'כל מקומות ההמתנה מלאים.', revive: '+2 מקומות', reviveAd: 'חינם', giveUp: 'וותר',
    keepGoing: 'להמשיך לצבוע?', loseLife: 'תאבד לב אחד.', retry: 'נסה שוב', home: 'בית',
    paused: 'השהיה', resume: 'המשך', restart: 'התחל מחדש', settings: 'הגדרות',
    sound: 'צלילים', music: 'מוזיקה', haptics: 'רטט', language: 'שפה',
    shop: 'חנות', gallery: 'גלריה', daily: 'הציור היומי', dailySub: 'ציור חדש בכל יום',
    dailyDone: 'סיימת להיום! חזור מחר.', streakDays: 'ימים ברצף',
    coins: 'מטבעות', coinsTitle: 'מטבעות', free: 'חינם', watch: 'צפה', buy: 'קנה', restore: 'שחזור רכישות',
    noAds: 'בלי פרסומות', noAdsSub: 'מסיר פרסומות כפויות לתמיד', bestValue: 'הכי משתלם', starter: 'חבילת פתיחה', starterSub: 'הצעה חד-פעמית',
    freeCoins: 'מטבעות חינם', freeCoinsLeft: 'נשארו היום', boosters: 'בוסטרים',
    bSlot: '+מקום', bSlotD: 'מקום המתנה נוסף לשלב הזה',
    bGrab: 'תפסן', bGrabD: 'בחר כל דלי מכל טור',
    bRainbow: 'קשת', bRainbowD: 'דלי קשת שצובע כל צבע',
    unlocked: 'בוסטר חדש!', tryIt: 'נסה', gotIt: 'הבנתי',
    outOfLives: 'נגמרו הלבבות', nextLife: 'לב הבא בעוד', refill: 'מלא', plusLife: '+1 לב',
    full: 'מלא', unlimited: 'ללא הגבלה', album: 'אלבום', complete: 'הושלם!', openChest: 'פתח תיבה',
    locked: 'נעול', hotStreak: 'מכחול לוהט!', hotStreakD: 'בונוס רצף ניצחונות: +1 מקום המתנה',
    needCoins: 'אין מספיק מטבעות', getMore: 'השג עוד', privacy: 'מדיניות פרטיות', terms: 'תנאי שימוש', privacyChoices: 'הגדרות פרטיות',
    thanks: 'תודה!', purchased: 'הרכישה הושלמה', grabTap: 'הקש על כל דלי בטורים',
    lv: 'שלב', of: 'מתוך', remaining: 'נשארו', version: 'גרסה', support: 'תמיכה', newArt: 'יצירה חדשה!',
    tapToPlay: 'הקש לשחק', halfway: 'חצי דרך!', hourUnlimited: 'שעה ∞', tag20: '+20%', tag60: '+60%', tagPopular: 'פופולרי', ends: 'מסתיים בעוד', painting: 'צובעים', progress: 'התקדמות', cancel: 'ביטול',
    reward: 'פרס', dailyReward: 'פרס יומי', streakBonus: 'בונוס רצף',
  },
};

const ART_HE = {
  heart: 'לב אוהב', cherry: 'דובדבנים', strawberry: 'תות', icecream: 'גלידה', donut: 'דונאט סוכריות', cupcake: 'קאפקייק',
  watermelon: 'אבטיח', lollipop: 'סוכרייה על מקל', cookie: 'עוגיית שוקולד', cake: 'עוגת יום הולדת', chick: 'אפרוח', cat: 'חתלתול',
  frog: 'צפרדע', pig: 'חזרזיר', fish: 'דג זהב', bunny: 'ארנבון', panda: 'פנדה', owl: 'ינשוף', bee: 'דבורה', puppy: 'כלבלב',
  tulip: 'צבעוני', mushroom: 'פטרייה', cactus: 'קקטוס', sunflower: 'חמנייה', tree: 'עץ תפוחים', clover: 'תלתן', pumpkin: 'דלעת',
  carrot: 'גזר', rose: 'ורד אדום', leaf: 'עלה סתיו', sun: 'יום שמשי', cloud: 'ענן גשם', moon: 'ירח וכוכבים', rocket: 'חללית',
  whale: 'לוויתן שמח', octopus: 'תמנון', crab: 'סרטן', boat: 'סירת מפרש', balloon: 'כדור פורח', umbrella: 'מטרייה', gift: 'מתנה',
  crown: 'כתר מלכותי', diamond: 'יהלום', gamepad: 'שלט משחק', house: 'בית חמים', car: 'מכונית מרוץ', note: 'תו מוזיקלי',
  ball: 'כדור חוף', robot: 'רובוט', teddy: 'דובי', ghost: 'רוח ידידותית', alien: 'חבר מהחלל', star: 'כוכב מזל', castle: 'טירה',
  planet: 'כוכב לכת', butterfly: 'פרפר', rainbow: 'קשת בענן', dino: 'דינוזאור', pizza: 'משולש פיצה', potion: 'שיקוי קסם',
  burger: 'המבורגר', fries: 'צ׳יפס שמח', taco: 'טאקו', sushi: 'סושי', coffee: 'קפה חמים', avocado: 'אבוקדו', egg: 'ביצת עין', milk: 'חבר חלב', popsicle: 'ארטיק', toast: 'טוסט',
  snowman: 'איש שלג', xmastree: 'עץ חג', candycane: 'מקל סוכר', snowflake: 'פתית שלג', partyhat: 'כובע מסיבה', firework: 'זיקוקים', bell: 'פעמון', mitten: 'כפפה', gingerbread: 'איש ג׳ינג׳ר', ornament: 'קישוט',
};
const ALBUM_HE = { sweets: 'מתוקים', critters: 'חיות חמודות', garden: 'הגן הסודי', sea: 'שמיים וים', toys: 'ארגז צעצועים', wonders: 'פלאים', snacks: 'מזנון', holidays: 'חגים' };

let lang = 'en';
export function setLang(l) {
  lang = S[l] ? l : 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
}
export function getLang() { return lang; }
export function detectLang() { const n = (navigator.language || 'en').toLowerCase(); return n.startsWith('he') || n.startsWith('iw') ? 'he' : 'en'; }
export function t(k) { return (S[lang] && S[lang][k]) || S.en[k] || k; }
export function artName(id, fallback) { return lang === 'he' ? ART_HE[id] || fallback : fallback; }
export function albumName(id, fallback) { return lang === 'he' ? ALBUM_HE[id] || fallback : fallback; }
export const LANGS = [{ id: 'en', name: 'English' }, { id: 'he', name: 'עברית' }];
