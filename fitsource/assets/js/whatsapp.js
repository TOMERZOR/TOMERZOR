// WhatsApp sharing: a fit, a scan, a wish list, or "should I buy it?" to
// friends. Uses wa.me links, which open the app on phones and WhatsApp Web on
// computers; the person picks who to send it to.
import { html, icon, money } from "./ui.js";
import { hashMode, href, siteRoot } from "./router.js";
import { canonicalUrl } from "./seo.js";
import { NEW_SHOPS } from "./shop.js";

const MAX = 1800; // keep messages comfortably short

export const waHref = (text) => `https://wa.me/?text=${encodeURIComponent(text.length > MAX ? text.slice(0, MAX - 1) + "…" : text)}`;

/** Address of a page to send to a friend: the live site's, wherever this copy runs. */
export function shareUrl(route = "") {
  if (hashMode()) return canonicalUrl(route); // the preview's own address isn't shareable
  return new URL(href(route), siteRoot()).href;
}

const priceText = (p, currency) => (p != null ? ` ${money(p, currency || "ILS").replace(/‏/g, "")}` : "");

/** "Look at this fit": every piece with its price, and the link. */
export function fitMessage(fit) {
  const lines = fit.items.map((it) => `• ${it.name}${it.brand ? ` (${it.brand})` : ""}${it.status === "sold_out" ? " · אזל" : priceText(it.price, it.currency)}`);
  return `${fit.title} 👀\n${lines.join("\n")}\n\nכל הפריטים ואיפה קונים, ב־FitSource:\n${shareUrl(`fit/${fit.id}`)}`;
}

/** "Should I buy it?" for a fit. */
export function askFitMessage(fit) {
  return `מה דעתכם, לקנות? 🤔\n${fit.title}: ${fit.items.map((it) => it.name).join(", ")}\n\n👍 כן   👎 לא\n${shareUrl(`fit/${fit.id}`)}`;
}

/**
 * A scan's pieces: each with the shop and link FitSource found, or a search
 * link when it only knows what the piece is. `pick(item)` returns the match.
 */
export function scanMessage(scan, pick) {
  const lines = scan.items.map((it, i) => {
    const m = pick(it);
    const name = `${i + 1}. ${it.productName || it.name}${it.color ? ` (${it.color})` : ""}`;
    if (m && m.url) return `${name}: ${m.shop || ""}${priceText(m.price, m.currency)}\n   ${m.url}`;
    return `${name}\n   ${NEW_SHOPS[0].url(it.query || it.name)}`;
  });
  return `מצאתי את הפריטים מהלוק עם FitSource 🔎\n\n${lines.join("\n")}\n\nסורקים לוקים בחינם: ${shareUrl("")}`;
}

/** "Should I buy it?" for a scan. */
export function askScanMessage(scan) {
  return `מה דעתכם על הלוק הזה? 🤔\n${scan.items.map((it) => it.productName || it.name).join(", ")}\n\n👍 לקנות   👎 לוותר\n(מצאתי אותו עם FitSource: ${shareUrl("")})`;
}

/** The closet as a wish list, e.g. as a birthday hint. */
export function wishlistMessage(items) {
  const lines = items.slice(0, 15).map((it) => `• ${it.name}${priceText(it.price, it.currency)}\n  ${it.url && /^https?:/.test(it.url) ? it.url : NEW_SHOPS[0].url(it.query || it.name)}`);
  const more = items.length > 15 ? `\n…ועוד ${items.length - 15}` : "";
  return `רשימת המשאלות שלי 🎁\n\n${lines.join("\n")}${more}\n\nמ־FitSource: ${shareUrl("")}`;
}

/** Row of WhatsApp buttons: send, and ask friends. */
export function waBar(sendText, askText, { sendLabel = "שליחת הלוק", askLabel = "שאלו חברים" } = {}) {
  return html`<div class="wa-bar">
    <a class="btn btn--sm btn--wa" href="${waHref(sendText)}" target="_blank" rel="noopener" data-wa="send">${icon("whatsapp-logo")}${sendLabel}</a>
    ${askText ? html`<a class="btn btn--sm btn--ghost" href="${waHref(askText)}" target="_blank" rel="noopener" data-wa="ask">${icon("chat-circle-dots")}${askLabel}</a>` : ""}
  </div>`;
}

