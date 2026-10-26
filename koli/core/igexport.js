// Reads Instagram's "Download your information" export (JSON format): the
// creator's own DMs, captions and comments become writing samples, and each
// fan message followed by the creator's answer becomes an example pair.

import { fixMojibake } from "./text.js";

const MESSAGE_FILE = /messages\/(inbox|message_requests)\/[^/]+\/message_\d+\.json$/;
const CONTENT_FILE = /content\/(posts_\d+|reels|stories|igtv_videos)\.json$/;
const COMMENT_FILE = /comments\/(post_comments_\d+|reels_comments)\.json$/;
const SYSTEM_TEXT = [
  /^.{0,80} (sent an attachment|liked a message|reacted .{1,8} to your message|shared a story|sent a voice message|unsent a message)\.?$/i,
  /^(liked a message|reacted .{1,8} to your message|you sent an attachment\.?)$/i,
  /^(שלח|שלחה|שלחת) (קובץ מצורף|הודעה קולית)/,
  /^https?:\/\/\S+$/,
];
const MAX_LEN = 500;
export const LIMITS = { samples: 800, pairs: 200 };

export function isMessageFile(path) {
  return MESSAGE_FILE.test(path);
}

export function isWantedFile(path) {
  return MESSAGE_FILE.test(path) || CONTENT_FILE.test(path) || COMMENT_FILE.test(path);
}

function clean(text) {
  const t = fixMojibake(text).trim();
  if (!t || SYSTEM_TEXT.some((r) => r.test(t))) return "";
  return t.length > MAX_LEN ? `${t.slice(0, MAX_LEN)}…` : t;
}

function collect(node, key, out) {
  if (Array.isArray(node)) for (const n of node) collect(n, key, out);
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === key && typeof v === "string") out.push(v);
      else if (k === key && v && typeof v.value === "string") out.push(v.value);
      else collect(v, key, out);
    }
  }
  return out;
}

/**
 * @param {{path: string, text: string}[]} files  JSON files from the export
 * @param {string} [ownerName]  the creator's display name, when known
 */
export function parseInstagramExport(files, ownerName) {
  const threads = [];
  const captions = [];
  const comments = [];
  for (const f of files) {
    let data;
    try {
      data = JSON.parse(f.text);
    } catch {
      continue;
    }
    if (MESSAGE_FILE.test(f.path)) {
      const messages = (data.messages || [])
        .map((m) => ({ sender: fixMojibake(m.sender_name || ""), text: clean(m.content || ""), at: m.timestamp_ms || 0 }))
        .filter((m) => m.sender && m.text)
        .sort((a, b) => a.at - b.at);
      if (messages.length) threads.push({ id: f.path.replace(/\/message_\d+\.json$/, ""), messages });
    } else if (CONTENT_FILE.test(f.path)) {
      captions.push(...collect(data, "title", []));
    } else if (COMMENT_FILE.test(f.path)) {
      comments.push(...collect(data, "Comment", []));
    }
  }

  // Merge message_1, message_2... of the same thread.
  const merged = new Map();
  for (const t of threads) {
    const prev = merged.get(t.id);
    if (prev) prev.messages.push(...t.messages);
    else merged.set(t.id, { ...t, messages: [...t.messages] });
  }
  const allThreads = [...merged.values()].map((t) => ({ ...t, messages: t.messages.sort((a, b) => a.at - b.at) }));

  // The creator is whoever sends messages in the most threads.
  const threadCount = new Map();
  for (const t of allThreads) for (const s of new Set(t.messages.map((m) => m.sender))) threadCount.set(s, (threadCount.get(s) || 0) + 1);
  const candidates = [...threadCount.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  const owner = ownerName || candidates[0]?.name || "";

  const samples = [];
  const pairs = [];
  for (const t of allThreads) {
    let fanRun = [];
    let ownerRun = [];
    const flush = () => {
      if (fanRun.length && ownerRun.length) pairs.push({ fan: fanRun.join(" / "), reply: ownerRun.join(" / "), source: "instagram" });
      if (ownerRun.length) fanRun = [];
      ownerRun = [];
    };
    for (const m of t.messages) {
      if (m.sender === owner) {
        ownerRun.push(m.text);
        samples.push({ text: m.text, source: "dm" });
      } else {
        if (ownerRun.length) flush();
        fanRun.push(m.text);
        if (fanRun.length > 3) fanRun.shift();
      }
    }
    flush();
  }
  for (const c of captions) {
    const t = clean(c);
    if (t) samples.push({ text: t, source: "caption" });
  }
  for (const c of comments) {
    const t = clean(c);
    if (t) samples.push({ text: t, source: "comment" });
  }

  return {
    owner,
    candidates: candidates.slice(0, 8),
    threads: allThreads.length,
    samples: samples.slice(-LIMITS.samples),
    pairs: pairs.slice(-LIMITS.pairs),
    counts: { dms: samples.filter((s) => s.source === "dm").length, captions: captions.length, comments: comments.length, pairs: pairs.length },
  };
}

/** Plain pasted text: one sample per paragraph, or per line for short lines. */
export function samplesFromText(text, source = "pasted") {
  const blocks = String(text || "")
    .split(/\n\s*\n/)
    .flatMap((b) => (b.split("\n").every((l) => l.length < 120) ? b.split("\n") : [b]))
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  return blocks.map((t) => ({ text: t.length > MAX_LEN ? `${t.slice(0, MAX_LEN)}…` : t, source }));
}
