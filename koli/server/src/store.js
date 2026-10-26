// Storage on Cloudflare KV, with an in-memory stand-in for local runs and
// tests. KV is eventually consistent, which is fine for one creator's inbox in
// a pilot; at scale this moves to a Durable Object per creator.

const memory = new Map();

export function kvFor(env) {
  if (env.KOLI_KV) return env.KOLI_KV;
  return {
    async get(key, type) {
      const v = memory.get(key);
      if (v === undefined) return null;
      return type === "json" ? JSON.parse(v) : v;
    },
    async put(key, value) {
      memory.set(key, value);
    },
    async delete(key) {
      memory.delete(key);
    },
  };
}

export function resetMemory() {
  memory.clear();
}

const MAX_MESSAGES = 60;
const MAX_INDEX = 300;

export class Store {
  constructor(env) {
    this.kv = kvFor(env);
  }

  async getConfig() {
    return await this.kv.get("config", "json");
  }

  async setConfig(state) {
    await this.kv.put("config", JSON.stringify(state));
  }

  async getConversation(id) {
    return (await this.kv.get(`conv:${id}`, "json")) || { id, fanName: "", username: "", messages: [], lastCampaignId: null, pausedUntil: 0, needsHuman: false, draft: null, updatedAt: 0 };
  }

  async saveConversation(conv) {
    conv.messages = conv.messages.slice(-MAX_MESSAGES);
    conv.updatedAt = Date.now();
    await this.kv.put(`conv:${conv.id}`, JSON.stringify(conv));
    const index = (await this.kv.get("index", "json")) || [];
    const last = conv.messages[conv.messages.length - 1];
    const row = { id: conv.id, fanName: conv.fanName, username: conv.username, updatedAt: conv.updatedAt, needsHuman: conv.needsHuman, hasDraft: Boolean(conv.draft), paused: conv.pausedUntil > Date.now(), last: last ? { from: last.from, text: last.text.slice(0, 120) } : null, campaignId: conv.lastCampaignId };
    const next = [row, ...index.filter((r) => r.id !== conv.id)].slice(0, MAX_INDEX);
    await this.kv.put("index", JSON.stringify(next));
  }

  async listConversations() {
    return (await this.kv.get("index", "json")) || [];
  }

  /** Remember ids of messages Koli sent, to tell its own echoes from the creator's. */
  async markSent(mid) {
    if (mid) await this.kv.put(`mid:${mid}`, "1", { expirationTtl: 60 * 60 * 24 * 7 });
  }

  async wasSent(mid) {
    return Boolean(mid && (await this.kv.get(`mid:${mid}`)));
  }

  async seen(mid) {
    if (!mid) return false;
    if (await this.kv.get(`seen:${mid}`)) return true;
    await this.kv.put(`seen:${mid}`, "1", { expirationTtl: 60 * 60 * 24 * 2 });
    return false;
  }

  async bump(counters) {
    const stats = (await this.kv.get("stats", "json")) || {};
    for (const [k, v] of Object.entries(counters)) stats[k] = (stats[k] || 0) + v;
    await this.kv.put("stats", JSON.stringify(stats));
  }

  async stats() {
    return (await this.kv.get("stats", "json")) || {};
  }
}
