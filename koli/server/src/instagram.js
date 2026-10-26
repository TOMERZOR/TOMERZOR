// Instagram Messaging API (Instagram API with Instagram Login): webhook
// verification, event parsing and sending replies. Docs:
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api

const TEXT_LIMIT = 1000; // Instagram's limit for one text message

function graphBase(env) {
  return `https://graph.instagram.com/${env.IG_GRAPH_VERSION || "v23.0"}`;
}

/** Meta signs each webhook body with the app secret (X-Hub-Signature-256: sha256=<hex>). */
export async function verifySignature(rawBody, header, secret) {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7).toLowerCase();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/**
 * Flatten a webhook payload into message events.
 * @returns {{accountId: string, fanId: string, mid: string, text: string, storyId: string|null, echo: boolean, at: number}[]}
 */
export function parseEvents(payload) {
  const out = [];
  if (payload?.object !== "instagram") return out;
  for (const entry of payload.entry || []) {
    for (const ev of entry.messaging || []) {
      const m = ev.message;
      if (!m || m.is_deleted || m.is_unsupported) continue;
      const echo = Boolean(m.is_echo);
      const mention = (m.attachments || []).find((a) => a.type === "story_mention");
      const text = m.text || (mention ? "[תייגו אותך בסטורי שלהם]" : "");
      if (!text) continue; // stickers, photos and voice notes without text
      out.push({
        accountId: String(entry.id),
        fanId: String(echo ? ev.recipient?.id : ev.sender?.id),
        mid: m.mid,
        text,
        storyId: m.reply_to?.story?.id ? String(m.reply_to.story.id) : null,
        echo,
        at: ev.timestamp || Date.now(),
      });
    }
  }
  return out;
}

/** Send one text DM. Returns the new message id. */
export async function sendText(env, recipientId, text, fetchImpl = fetch) {
  const res = await fetchImpl(`${graphBase(env)}/me/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.IG_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text: text.slice(0, TEXT_LIMIT) } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`instagram_send_failed: ${res.status} ${data?.error?.message || ""}`.trim());
  return data.message_id;
}

/** The fan's name and username, when Instagram shares them. */
export async function fanProfile(env, fanId, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${graphBase(env)}/${fanId}?fields=name,username`, { headers: { authorization: `Bearer ${env.IG_ACCESS_TOKEN}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return { name: data.name || "", username: data.username || "" };
  } catch {
    return null;
  }
}
