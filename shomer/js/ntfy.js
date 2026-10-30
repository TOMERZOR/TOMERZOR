// Notifications go through ntfy (https://ntfy.sh): the camera publishes to a secret topic,
// and the phone listens to it in the ntfy app or on this site's receiver screen.
// Title and message go in the query string because headers can't carry Hebrew.

export const DEFAULT_SERVER = 'https://ntfy.sh';

export function newTopic() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return 'shomer-' + Array.from(bytes, b => abc[b % abc.length]).join('');
}

export function isValidTopic(t) {
  return /^[-_A-Za-z0-9]{1,64}$/.test(t);
}

function topicUrl(server, topic, params) {
  const url = new URL(`${server.replace(/\/+$/, '')}/${encodeURIComponent(topic)}`);
  for (const [k, v] of Object.entries(params || {})) if (v != null && v !== '') url.searchParams.set(k, v);
  return url.toString();
}

export async function publish(server, topic, { title, message, tags, priority, image }) {
  const params = { title, tags, priority };
  let body = message;
  if (image) {
    params.message = message;
    params.filename = 'shomer.jpg';
    body = image;
  }
  const res = await fetch(topicUrl(server, topic, params), { method: 'POST', body });
  if (!res.ok) throw new Error(`ntfy ${res.status}`);
  return res.json();
}

// Fire-and-forget, still delivered while the page is being hidden or closed.
export function beacon(server, topic, { title, message, tags, priority }) {
  try {
    return navigator.sendBeacon(topicUrl(server, topic, { title, tags, priority }), message);
  } catch {
    return false;
  }
}

export function sseUrl(server, topic) {
  return `${server.replace(/\/+$/, '')}/${encodeURIComponent(topic)}/sse`;
}

export async function history(server, topic, since = '12h') {
  const res = await fetch(`${server.replace(/\/+$/, '')}/${encodeURIComponent(topic)}/json?poll=1&since=${since}`);
  if (!res.ok) throw new Error(`ntfy ${res.status}`);
  const text = await res.text();
  return text.split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(m => m.event === 'message');
}
