// Page addresses. Every page is a real file next to index.html, so search
// engines and link previews see each one:
//   ""            index.html (home)       "feed"     feed.html
//   "fit/<id>"    fit-<id>.html           "brands"   brands.html
//   "closet/<tab>" closet.html?tab=<tab>  "legal"    legal.html
//   "scan/<id>"   scan.html?id=<id>       anything else: 404.html
// Hosts serve feed.html at /feed, so links leave out ".html". Where pages
// can't change the address bar (the sandboxed preview), CONFIG.hashRouting
// switches to "#/feed" addresses instead.
import { CONFIG } from "./config.js";

export const hashMode = () => Boolean(CONFIG.hashRouting) || location.protocol === "file:";

/** The site's root folder. On 404.html a <base> points it at the root. */
export const siteRoot = () => new URL(".", document.baseURI);

/** Page file name (no extension) for a route. */
export function pageFor(route) {
  const [name, arg] = route.split("/");
  if (!name) return "";
  if (name === "fit" && arg) return `fit-${arg}`;
  return name;
}

/** Link to a route, relative to the site root. */
export function href(route = "") {
  if (hashMode()) return `#/${route}`;
  const [name, arg] = route.split("/");
  if (name === "closet" && arg) return `closet?tab=${encodeURIComponent(arg)}`;
  if (name === "scan" && arg) return `scan?id=${encodeURIComponent(arg)}`;
  return pageFor(route) || "./";
}

/** Route for a URL on this site, or null when the URL is another page or file. */
export function routeOf(url) {
  const u = new URL(url, document.baseURI);
  if (u.hash.startsWith("#/")) return u.hash.slice(2).split("?")[0].replace(/\/+$/, "");
  if (hashMode()) return "";
  return pathRouteOf(u);
}

/** Route for a real page address (feed, fit-night-shift, closet?tab=...), or null. */
export function pathRouteOf(url) {
  const u = new URL(url, document.baseURI);
  const root = siteRoot();
  if (u.origin !== root.origin || !u.pathname.startsWith(root.pathname)) return null;
  const rest = decodeURIComponent(u.pathname.slice(root.pathname.length)).replace(/\.html$/, "");
  if (rest.includes("/") || /\.\w+$/.test(rest)) return null; // a deeper folder or an asset
  if (rest === "" || rest === "index") return "";
  if (rest.startsWith("fit-")) return `fit/${rest.slice(4)}`;
  if (rest === "closet") return u.searchParams.get("tab") ? `closet/${u.searchParams.get("tab")}` : "closet";
  if (rest === "scan") return u.searchParams.get("id") ? `scan/${u.searchParams.get("id")}` : "scan";
  return rest;
}

// An address that is no page of this site (a deeper folder, a missing file) reads as "404".
export const currentRoute = () => routeOf(location.href) ?? "404";

/** Go to a route without reloading the page. */
export function go(route, { replace = false } = {}) {
  if (hashMode()) {
    if (replace) location.replace(`#/${route}`);
    else location.hash = `#/${route}`;
    return;
  }
  const url = new URL(href(route), siteRoot()).href;
  history[replace ? "replaceState" : "pushState"](null, "", url);
  window.dispatchEvent(new Event("fs:navigate"));
}

/** Change the address to a route without rendering it again (e.g. scan to scan/<id>). */
export function setAddress(route) {
  const url = hashMode() ? `#/${route}` : new URL(href(route), siteRoot()).href;
  try {
    history.replaceState(null, "", url);
  } catch {
    // some sandboxed frames refuse it; the page still works
  }
}
