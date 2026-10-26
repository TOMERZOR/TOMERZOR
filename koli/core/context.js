// Which campaign is this message about? A fast, explainable first pass that
// runs before Claude: the story the fan replied to, the words they used, and
// what the conversation was already about. Claude gets the ranking as a hint
// and makes the final call.

import { normalize, termSet, hasPhrase, contentWords } from "./text.js";

const BUY_WORDS = ["מחיר", "כמה עולה", "עולה", "קוד", "קופון", "הנחה", "לינק", "קישור", "איפה קונים", "איפה אפשר", "להזמין", "הזמנה", "משלוח", "מידה", "מידות", "צבע", "צבעים", "נשאר", "מלאי", "link", "code", "price"];

/** Campaigns that are switched on and running today. */
export function activeCampaigns(campaigns, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return (campaigns || []).filter((c) => c.active !== false && (!c.start || c.start <= today) && (!c.end || c.end >= today));
}

/** Find the campaign and story a story-reply points at. */
export function findStory(campaigns, storyId) {
  if (!storyId) return null;
  for (const c of campaigns || []) {
    for (const s of c.stories || []) {
      if ((s.storyId && String(s.storyId) === String(storyId)) || s.id === storyId) return { campaign: c, story: s };
    }
  }
  return null;
}

/**
 * Rank the active campaigns for one incoming message.
 * @param {object} p
 * @param {object[]} p.campaigns       all campaigns (inactive ones are ignored)
 * @param {string}   p.text            the fan's message
 * @param {string}   [p.storyId]       the story the fan replied to: its Instagram id, or its id in Koli
 * @param {string}   [p.lastCampaignId] what the conversation was about so far
 * @param {Date}     [p.now]
 * @returns {{campaignId: string|null, confidence: number, reasons: string[], ranking: {id: string, score: number, reasons: string[]}[]}}
 */
export function detectCampaign({ campaigns, text, storyId, lastCampaignId, now }) {
  const active = activeCampaigns(campaigns, now);
  const norm = normalize(text);
  const terms = termSet(text);
  const buying = BUY_WORDS.some((w) => hasPhrase(terms, norm, w));
  const storyHit = findStory(active, storyId);

  const ranking = active.map((c) => {
    let score = 0;
    const reasons = [];
    if (storyHit && storyHit.campaign.id === c.id) {
      score += 100;
      reasons.push("הגיבו לסטורי של הקמפיין");
    }
    for (const [field, weight, label] of [["product", 8, "שם המוצר"], ["brand", 6, "שם המותג"], ["name", 5, "שם הקמפיין"]]) {
      if (c[field] && hasPhrase(terms, norm, c[field])) {
        score += weight;
        reasons.push(`${label}: ${c[field]}`);
      }
    }
    for (const k of c.keywords || []) {
      if (hasPhrase(terms, norm, k)) {
        score += 6;
        reasons.push(`מילת מפתח: ${k}`);
      }
    }
    if (c.coupon && hasPhrase(terms, norm, c.coupon)) {
      score += 8;
      reasons.push(`קוד הקופון: ${c.coupon}`);
    }
    // Overlap with what the stories and facts say, capped so long briefs don't win by size.
    const briefWords = contentWords([...(c.stories || []).map((s) => s.text), c.facts].join(" "));
    const overlap = briefWords.filter((w) => terms.has(w));
    if (overlap.length) {
      score += Math.min(overlap.length, 4);
      reasons.push(`מילים מהבריף: ${overlap.slice(0, 4).join(", ")}`);
    }
    if (lastCampaignId === c.id) {
      score += 3;
      reasons.push("השיחה כבר עסקה בקמפיין הזה");
    }
    if (buying && active.length === 1) {
      score += 2;
      reasons.push("שאלת קנייה כשיש רק קמפיין פעיל אחד");
    }
    return { id: c.id, score, reasons };
  });

  ranking.sort((a, b) => b.score - a.score);
  const [top, second] = ranking;
  if (!top || top.score === 0) return { campaignId: null, confidence: 0, reasons: [], ranking, buying, story: storyHit?.story || null };

  let confidence = top.score >= 100 ? 0.98 : top.score >= 8 ? 0.9 : top.score >= 5 ? 0.75 : top.score >= 3 ? 0.55 : 0.35;
  if (second && top.score < 100 && top.score - second.score < 2) confidence -= 0.2;
  return { campaignId: top.id, confidence: Math.max(0.1, +confidence.toFixed(2)), reasons: top.reasons, ranking, buying, story: storyHit?.story || null };
}

/** The campaign link with tracking parameters, so the brand can count sales from DMs. */
export function trackedLink(campaign) {
  if (!campaign?.link) return "";
  try {
    const url = new URL(campaign.link);
    if (!url.searchParams.has("utm_source")) {
      url.searchParams.set("utm_source", "instagram");
      url.searchParams.set("utm_medium", "dm");
      url.searchParams.set("utm_campaign", `koli_${campaign.id}`);
    }
    return url.toString();
  } catch {
    return campaign.link;
  }
}
