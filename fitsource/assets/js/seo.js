// What each page tells search engines and link previews: title, description,
// share image and breadcrumbs. The app sets these as you browse;
// tools/build-pages.mjs writes them into each page's HTML.
import { CONFIG } from "./config.js";
import { FITS, findFit } from "./data/fits.js";
import { pageFor } from "./router.js";

const SITE = "FitSource";

/** Absolute address of a page on the live site. */
export const canonicalUrl = (route) => new URL(pageFor(route), CONFIG.siteUrl).href;

/** Share image for a page (made by tools/build-pages.mjs). */
const shareImage = (route) => `assets/img/og/${pageFor(route) || "home"}.jpg`;

const HOME = { name: "דף הבית", route: "" };
const FEED = { name: "פיד", route: "feed" };

/**
 * { title, description, image, imageAlt, breadcrumbs: [{name, route}], index }
 * `index: false` keeps a page out of search results (personal or empty pages).
 */
export function pageMeta(route) {
  const [name, arg] = route.split("/");
  const base = { image: shareImage(""), imageAlt: "FitSource: מוצאים את החנות מאחורי כל לוק", breadcrumbs: [], index: false };
  switch (name) {
    case "":
      return {
        ...base,
        title: "FitSource: מוצאים את החנות מאחורי כל לוק",
        description: "מעלים צילום מסך של לוק מאינסטגרם או מטיקטוק, ו־FitSource מזהה כל פריט, מוצא איפה קונים אותו בישראל ומסמן מה אזל מהמלאי. בחינם.",
        index: true,
      };
    case "feed":
      return {
        ...base,
        title: "פיד לוקים עם מקור לכל פריט | FitSource",
        description: `${FITS.length} לוקים שסורקים עכשיו, עם החנות, המחיר והמלאי של כל פריט: סטריט, יוקרה שקטה, Y2K, וורקוור ועוד.`,
        image: shareImage(route),
        imageAlt: "לוקים מהפיד של FitSource",
        breadcrumbs: [HOME, FEED],
        index: true,
      };
    case "fit": {
      const fit = findFit(arg);
      if (!fit) return notFoundMeta();
      const pieces = fit.items.map((i) => i.name).join(", ");
      return {
        ...base,
        title: `${fit.title}: איפה קונים את הלוק | FitSource`,
        description: `${fit.title} של ‎@${fit.handle}: ${pieces}. מחיר, מלאי וחנות לכל פריט.`,
        image: shareImage(route),
        imageAlt: `${fit.title}: ${pieces}`,
        breadcrumbs: [HOME, FEED, { name: fit.title, route }],
        index: true,
      };
    }
    case "brands":
      return {
        ...base,
        title: "למותגים: הביקוש לפריטים שלכם | FitSource",
        description: "כל סריקה היא מישהו שמחפש את המוצר שלכם. מקור מאומת, נתוני ביקוש כשפריט אוזל, התאמה ליוצרים וחשיפה כפריט דומה.",
        image: shareImage(route),
        imageAlt: "FitSource למותגים",
        breadcrumbs: [HOME, { name: "למותגים", route }],
        index: true,
      };
    case "legal":
      return {
        ...base,
        title: "פרטיות, גילוי ונגישות | FitSource",
        description: "מה קורה לתמונות שלכם, איך FitSource מרוויח, והצהרת הנגישות של האתר.",
        breadcrumbs: [HOME, { name: "פרטיות ונגישות", route }],
        index: true,
      };
    case "closet":
      return { ...base, title: "הארון שלכם | FitSource", description: "פריטים שמורים, התראות מלאי וסריקות קודמות. הכל נשמר בדפדפן שלכם.", breadcrumbs: [HOME, { name: "הארון", route: "closet" }] };
    case "scan":
      return { ...base, title: "סריקה | FitSource", description: "הפריטים שנמצאו בתמונה, ואיפה קונים אותם." };
    default:
      return notFoundMeta();
  }
}

export function notFoundMeta() {
  return { title: "העמוד לא נמצא | FitSource", description: "העמוד הזה לא קיים.", image: shareImage(""), imageAlt: SITE, breadcrumbs: [], index: false, notFound: true };
}

/** Routes that get their own page file. */
export function pageRoutes() {
  return ["", "feed", ...FITS.map((f) => `fit/${f.id}`), "brands", "legal", "closet", "scan"];
}

/** Keep the head in step while browsing, for crawlers that run the app. */
export function applyMeta(meta, route) {
  document.title = meta.title;
  const set = (sel, attr, value) => {
    const el = document.head.querySelector(sel);
    if (el) el.setAttribute(attr, value);
  };
  set('meta[name="description"]', "content", meta.description);
  set('meta[property="og:title"]', "content", meta.title);
  set('meta[property="og:description"]', "content", meta.description);
  set('meta[property="og:url"]', "content", canonicalUrl(route));
  // only pages meant for search results name a canonical address
  let link = document.head.querySelector('link[rel="canonical"]');
  if (meta.index) {
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonicalUrl(route);
  } else if (link) link.remove();
  set('meta[name="robots"]', "content", meta.index ? "index, follow" : "noindex, follow");
}
