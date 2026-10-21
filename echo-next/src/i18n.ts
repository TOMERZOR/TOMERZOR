/** Strings. The same table as the shipped client, plus keys the new screens need. */
import { state } from "./state";

type Table = Record<string, string>;
export const STR: Record<string, Table> = {
  he: {
    tagline: "20 מהלכים. ואז אתה משחק לצד עצמך.",
    play: "שחק", daily: "אתגר יומי", daily_s: "יומי", shop: "חנות", editor: "עורך שלבים", editor_s: "עורך", clubs: "מועדונים", settings: "הגדרות",
    worlds: "עולמות", world1: "המעבדה", world2: "המצפה", world3: "מעבדת המראות", world_n: "עולם {n}", new_best: "שיא חדש", up_next: "הבא",
    world_locked: "נפתח עם {n} כוכבים", redo: "שוב", undo: "בטל צעד", restart: "מחדש", end_loop: "סיים סיבוב", hint: "רמז", haptics: "רטט", assist: "סימוני סכנה",
    daily_open: "עוד לא שיחקת היום", all_claimed: "כל הפרסים נאספו", all_clear: "הכל נוקה",
    tip: "טיפ", tip_plate: "עומד על לוחית? סיים את הסיבוב עכשיו, וההד שלך ימשיך להחזיק אותה.", tip_free: "הרחפנים זזים רק כשאתה זז. הצל הבהיר מראה לאן הרחפן ינחת בצעד הבא; תא אדום = תיתפס שם.",
    help_title: "רוצה דחיפה קטנה?", help_sub: "המשחק ישחק בשבילך את הסיבוב הראשון, ואתה תמשיך משם. בלי קנס.", help_yes: "הראה לי את הסיבוב הראשון", help_no: "אני אסתדר", help_play: "הסיבוב הראשון משוחק בשבילך",
    purchase_q: "לקנות {item} ב-{price}?", buy_for: "קנה ב-{price}", purchase_note: "אב־טיפוס: התשלום מדומה ולא מחויב כסף.",
    gems: "יהלומים", gems_n: "{n} יהלומים", skin_name: "סקין {n}",
    echoes_used: "הדים", seconds: "מהלכים", coins: "מטבעות", replay: "שידור חוזר", share: "שיתוף", retry: "שוב",
    next: "השלב הבא", done_title: "שלב הושלם", perfect: "מושלם", first_clear: "בונוס סיום ראשון +50",
    free_coins: "מטבעות חינם", watch_ad: "צפה בסרטון +30", ads_left: "נותרו {n} סרטונים היום", ads_none: "נגמרו הסרטונים להיום. חזור מחר.",
    robots: "רובוטים", robots_sub: "בחר במי אתה משחק. ההדים שלך הם הולוגרמות של אותו רובוט.", your_robot: "הרובוט שלך",
    tier1: "רגיל", tier2: "נדיר", tier3: "אפי", sk_scout: "סקאוט", sk_knight: "אביר", sk_astro: "אסטרו", sk_mecha: "מכה", sk_ninja: "נינג'ה", sk_pirate: "פיראט", sk_samurai: "סמוראי", sk_wizard: "קוסם", sk_royal: "מלכותי",
    fl_scout: "הדגם המקורי. סקרן, מהיר, לעולם לא מתלונן.", fl_knight: "שריון מצוחצח ואומץ שעובד בהילוך חוזר.", fl_astro: "חלומות על הירח, פסים על החליפה.", fl_mecha: "כבד, שקט, פותח דלתות בכתף.", fl_ninja: "שומעים אותו רק כשההד שלו צועד.", fl_pirate: "יש לו מפה. היא של החדר הזה.", fl_samurai: "צעד אחד, פעם אחת, בדיוק.", fl_wizard: "טוען שההדים הם כישוף. לא מוכיח.", fl_royal: "גם ההדים שלו מצדיעים.",
    pass_track: "כל הפרסים", pass_owned: "הכרטיס פעיל", pass_get: "קנה כרטיס {p}", tier_n: "שלב {n}", xp_to_go: "עוד {n} XP", needs_pass: "דורש כרטיס", claimed: "נאסף", free_lane: "חינם",
    reward_coins: "+{n} מטבעות", reward_gems: "+{n} יהלומים", reward_robot: "רובוט {n}", season_name: "עונה 1 · המעבדה נפתחת", pass_how: "XP מגיע מסיום חדרים: 10 לכל כוכב ו-2 לכל מטבע.", next_reward: "הפרס הבא",
    echo_skins: "רובוטים", skins_sub: "בחר במי אתה משחק. ההדים שלך הם הולוגרמות של אותו רובוט.",
    season_pass: "כרטיס עונה", claim: "קבל", pass_sub: "שלבים 1–2 חינם. הכרטיס פותח את שאר המסלול.",
    store: "חנות", store_note: "אב־טיפוס: הרכישות מדומות ולא מחויב כסף.",
    daily_sub: "חדר אחד לכל השחקנים בעולם. הכי מעט הדים מנצח; הזמן שובר שוויון.",
    play_daily: "שחק את החדר של היום", leaderboard: "טבלת מובילים", board_empty: "עדיין אין תוצאות היום. תהיה הראשון.",
    editor_sub: "צייר חדר, בדוק אותו ושתף את הקוד שלו. חדר צריך התחלה אחת ויציאה אחת; דלת נפתחת כל עוד הלוחית שלה לחוצה.",
    mirror: "הדים במראה", par: "פאר", drone_tool: "◉ = רחפן: הקש על תא כדי להציב, שוב כדי להסיר", drone_nowhere: "לרחפן אין לאן לטוס מכאן", clear_drones: "נקה רחפנים", daily_you: "הכוכבים שלך היום: {n}", test: "בדיקה", get_code: "קוד שיתוף", load_code: "טען קוד",
    language: "שפה", music: "מוזיקה", sfx: "אפקטים", shake: "רעידת מסך", name: "שם שחקן",
    loop_saved: "הד #{n} נשמר", loop_sub: "עכשיו שחק לצידו", caught: "נתפסת", caught_sub: "חזרנו צעד אחד אחורה",
    out_of_echoes: "נגמרו ההדים", out_sub: "השלב מתחיל מחדש", loop_n: "סיבוב {n}",
    hint_move: "החלק כדי לצעוד, הקש כדי לחכות צעד. הגע ליציאה הזהובה.", hint_plate: "דלת נפתחת רק כשמישהו עומד על הלוחית. תן להד שלך לעמוד עליה.",
    hint_drone: "רחפנים זזים צעד רק כשאתה זז, ותופסים רק אותך. הצל הבהיר מראה לאן הרחפן ינחת בצעד הבא.", hint_mirror: "בעולם הזה ההדים זזים הפוך: ימין שלך הוא שמאל שלהם.", hint_mirror_t: "בעולם הזה ההדים זזים הפוך: למעלה שלך הוא למטה שלהם.",
    hint_generic: "אחרי 20 מהלכים הסיבוב נשמר כהד, וההד חוזר על כל צעד שלך. לא חייבים להצליח בסיבוב הראשון.",
    bought: "נקנה!", equipped: "מצויד", not_enough: "אין מספיק {c}", owned: "בבעלותך", equip: "צייד", buy: "קנה",
    starter: "חבילת פתיחה", starter_d: "120 יהלומים + 500 מטבעות + הרובוט המלכותי", gems_small: "100 יהלומים", gems_big: "600 יהלומים",
    noads: "הסרת פרסומות", noads_d: "בלי סרטונים. רמזים נשארים חינם.", pass: "כרטיס עונה", pass_d: "פותח את כל 10 השלבים",
    purchase_title: "אישור רכישה", confirm: "אשר", cancel: "ביטול",
    ad_title: "פרסומת לדוגמה", ad_sub: "סרטון ממומן היה מתנגן כאן ({n})", ad_done: "קיבלת +30 מטבעות", hint_title: "רמז",
    clubs_title: "מועדונים", clubs_sub: "אתגרים קבוצתיים שבועיים: 20 שחקנים, חדר משותף, הכי מעט הדים ביחד. בקרוב.", close: "סגור",
    streak: "רצף {n} ימים", bonus_today: "בונוס יומי +{n}", online: "מחובר", offline: "לא מקוון · שמירה במכשיר",
    copied: "הועתק!", share_text: "סיימתי את {lvl} ב-ECHO עם {e} הדים ב-{t} מהלכים ⭐{s}", custom: "חדר מותאם", daily_name: "יומי #{d}",
    level_locked: "השלב נעול", bad_code: "הקוד לא תקין", tier_locked: "צריך כרטיס עונה", need_xp: "צריך עוד XP",
    about: "ECHO · אב־טיפוס · הגרפיקה והסאונד נוצרו ב-Higgsfield", you: "אתה", unnamed: "שחקן", menu: "תפריט", par_label: "פאר",
  },
  en: {
    tagline: "Twenty moves. Then you play beside yourself.",
    play: "Play", daily: "Daily challenge", daily_s: "Daily", shop: "Shop", editor: "Level editor", editor_s: "Editor", clubs: "Clubs", settings: "Settings",
    worlds: "Worlds", world1: "The Lab", world2: "The Observatory", world3: "The Mirror Lab", world_n: "World {n}", new_best: "New best", up_next: "Up next",
    world_locked: "Opens at {n} stars", redo: "Redo", undo: "Undo", restart: "Restart", end_loop: "End loop", hint: "Hint", haptics: "Haptic feedback", assist: "Danger hints",
    daily_open: "Not played yet today", all_claimed: "All rewards claimed", all_clear: "All clear",
    tip: "Tip", tip_plate: "Standing on a plate? End the loop now and your echo keeps holding it.", tip_free: "Drones step only when you do. The faint drone shows where it lands next; a red cell means you would be caught there.",
    help_title: "Want a nudge?", help_sub: "The game plays the first loop for you and you take it from there. No penalty.", help_yes: "Show me the first loop", help_no: "I've got this", help_play: "Playing the first loop for you",
    purchase_q: "Buy {item} for {price}?", buy_for: "Buy for {price}", purchase_note: "Prototype: payments are simulated and nothing is charged.",
    gems: "gems", gems_n: "{n} gems", skin_name: "the {n} skin",
    echoes_used: "echoes", seconds: "moves", coins: "coins", replay: "Replay", share: "Share", retry: "Retry",
    next: "Next level", done_title: "Level clear", perfect: "Perfect", first_clear: "First clear bonus +50",
    free_coins: "Free coins", watch_ad: "Watch ad +30", ads_left: "{n} videos left today", ads_none: "No more videos today. Come back tomorrow.",
    robots: "Robots", robots_sub: "Pick who you play as. Your echoes are holograms of the same robot.", your_robot: "Your robot",
    tier1: "Common", tier2: "Rare", tier3: "Epic", sk_scout: "Scout", sk_knight: "Knight", sk_astro: "Astro", sk_mecha: "Mecha", sk_ninja: "Ninja", sk_pirate: "Pirate", sk_samurai: "Samurai", sk_wizard: "Wizard", sk_royal: "Royal",
    fl_scout: "The original. Curious, quick, never complains.", fl_knight: "Polished armour and courage that replays.", fl_astro: "Moon dreams, stripes on the suit.", fl_mecha: "Heavy, quiet, opens doors with a shoulder.", fl_ninja: "You only hear it when its echo steps.", fl_pirate: "Has a map. It is of this room.", fl_samurai: "One step, once, exactly.", fl_wizard: "Claims the echoes are a spell. Offers no proof.", fl_royal: "Even its echoes salute.",
    pass_track: "All rewards", pass_owned: "Pass active", pass_get: "Get the pass {p}", tier_n: "Tier {n}", xp_to_go: "{n} XP to go", needs_pass: "Needs the pass", claimed: "Claimed", free_lane: "Free",
    reward_coins: "+{n} coins", reward_gems: "+{n} gems", reward_robot: "{n} robot", season_name: "Season 1 · The Lab Opens", pass_how: "XP comes from clearing rooms: 10 per star and 2 per coin.", next_reward: "Next reward",
    echo_skins: "Robots", skins_sub: "Pick who you play as. Your echoes are holograms of the same robot.",
    season_pass: "Season pass", claim: "Claim", pass_sub: "Tiers 1–2 are free. The pass opens the rest of the track.",
    store: "Store", store_note: "Prototype: purchases are simulated and nothing is charged.",
    daily_sub: "One room for every player in the world. Fewest echoes wins; time breaks ties.",
    play_daily: "Play today's room", leaderboard: "Leaderboard", board_empty: "No results yet today. Be the first.",
    editor_sub: "Paint a room, test it, then share its code. Rooms need one start and one exit; a door opens while its plate is held.",
    mirror: "Mirror echoes", par: "Par", drone_tool: "◉ = drone: tap a cell to place one, tap again to remove", drone_nowhere: "No room for a patrol there", clear_drones: "Clear drones", daily_you: "Your stars today: {n}", test: "Test", get_code: "Share code", load_code: "Load code",
    language: "Language", music: "Music", sfx: "Sound effects", shake: "Screen shake", name: "Player name",
    loop_saved: "Echo #{n} saved", loop_sub: "Now play beside it", caught: "Caught", caught_sub: "Rewound one move",
    out_of_echoes: "Out of echoes", out_sub: "The level restarts", loop_n: "Loop {n}",
    hint_move: "Swipe to step, tap to wait a beat. Reach the golden exit.", hint_plate: "A door only opens while someone stands on its plate. Let your echo hold it.",
    hint_drone: "Drones step only when you do, and catch only you. The faint drone shows where it lands next.", hint_mirror: "In this world echoes move mirrored: your right is their left.", hint_mirror_t: "In this world echoes move mirrored: your up is their down.",
    hint_generic: "After 20 moves the loop is saved as an echo that repeats your every step. You don't have to make it on the first run.",
    bought: "Bought!", equipped: "Equipped", not_enough: "Not enough {c}", owned: "Owned", equip: "Equip", buy: "Buy",
    starter: "Starter pack", starter_d: "120 gems + 500 coins + the Royal robot", gems_small: "100 gems", gems_big: "600 gems",
    noads: "Remove ads", noads_d: "No videos. Hints stay free.", pass: "Season pass", pass_d: "Opens all 10 tiers",
    purchase_title: "Confirm purchase", confirm: "Confirm", cancel: "Cancel",
    ad_title: "Sample ad", ad_sub: "A sponsored video would play here ({n})", ad_done: "You got +30 coins", hint_title: "Hint",
    clubs_title: "Clubs", clubs_sub: "Weekly team challenges: 20 players, one shared room, fewest echoes together. Coming soon.", close: "Close",
    streak: "{n}-day streak", bonus_today: "Daily bonus +{n}", online: "Online", offline: "Offline · saved on device",
    copied: "Copied!", share_text: "I cleared {lvl} in ECHO with {e} echoes in {t} moves ⭐{s}", custom: "Custom room", daily_name: "Daily #{d}",
    level_locked: "Level locked", bad_code: "That code is not valid", tier_locked: "Needs the season pass", need_xp: "Needs more XP",
    about: "ECHO · prototype · art and sound made with Higgsfield", you: "you", unnamed: "Player", menu: "Menu", par_label: "Par",
  },
};

const EXTRA: Record<string, Table> = {
  en: { home: "Home", levels: "Levels", profile: "Profile", events: "Events", heroes: "Heroes", end_loop: "End loop", loop: "Loop", of: "of", stars_total: "{n} stars", tier: "Tier", season_ends: "Season ends in {n} days", tap_to_continue: "Tap to continue", moves: "moves", level: "Level", select_world: "Choose a world", get_pass: "Get the pass", pass_price: "$4.99", free: "Free", premium: "Premium", locked_pass: "Pass", you_are_here: "You are here", nudge: "Need a nudge?", rank: "Rank", player: "Player", best_today: "Best today", no_name: "Robot", version: "ECHO 2.0 · built with Higgsfield", reset_save: "Reset save", reset_q: "Erase all progress on this device?", moves_left: "{n} moves left", world_intro1: "Plates, gates and your first echo.", world_intro2: "Drones patrol. They step only when you do.", world_intro3: "Your echoes move mirrored here." },
  he: { home: "בית", levels: "שלבים", profile: "פרופיל", events: "אירועים", heroes: "גיבורים", end_loop: "סיים סיבוב", loop: "סיבוב", of: "מתוך", stars_total: "{n} כוכבים", tier: "שלב", season_ends: "העונה נגמרת בעוד {n} ימים", tap_to_continue: "הקש להמשך", moves: "מהלכים", level: "שלב", select_world: "בחר עולם", get_pass: "קנה כרטיס", pass_price: "$4.99", free: "חינם", premium: "פרימיום", locked_pass: "כרטיס", you_are_here: "אתה כאן", nudge: "צריך דחיפה?", rank: "דירוג", player: "שחקן", best_today: "הכי טוב היום", no_name: "רובוט", version: "ECHO 2.0 · נבנה עם Higgsfield", reset_save: "אפס שמירה", reset_q: "למחוק את כל ההתקדמות במכשיר הזה?", moves_left: "נותרו {n} מהלכים", world_intro1: "לוחיות, שערים וההד הראשון שלך.", world_intro2: "רחפנים מסיירים. הם זזים רק כשאתה זז.", world_intro3: "ההדים שלך זזים כאן במראה." },
};
for (const k in EXTRA) Object.assign(STR[k]!, EXTRA[k]);

export const lang = () => (state.opts.lang === "he" ? "he" : "en");
export const rtl = () => lang() === "he";
/** Translate a key, filling {name} slots from vars. Falls back to English, then the key. */
export function t(key: string, vars?: Record<string, string | number>) {
  const s = STR[lang()]?.[key] ?? STR.en![key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, n: string) => (vars && vars[n] !== undefined ? String(vars[n]) : ""));
}
