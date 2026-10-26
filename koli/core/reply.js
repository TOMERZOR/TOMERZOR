// One fan message in, one reply out. The same pipeline runs in the
// simulator and on the Instagram webhook; only `ask` (how Claude is reached)
// differs.

import { detectCampaign } from "./context.js";
import { buildSystemPrompt, buildTurnPrompt, parseReply, applyDisclosure, REPLY_SCHEMA } from "./prompt.js";

/**
 * @param {object} p
 * @param {object} p.state       normalized Koli state
 * @param {{from: string, text: string}[]} p.history  earlier messages, oldest first
 * @param {string} p.text        the fan's new message
 * @param {string} [p.fanName]
 * @param {string} [p.storyId]   the story the fan replied to (Instagram id or Koli id)
 * @param {string} [p.lastCampaignId]
 * @param {(req: {system: string, turn: string, schema: object}) => Promise<object|string>} p.ask
 * @param {Date} [p.now]
 */
export async function generateReply({ state, history = [], text, fanName, storyId, lastCampaignId, ask, now = new Date() }) {
  const detection = detectCampaign({ campaigns: state.campaigns, text, storyId, lastCampaignId, now });
  const system = buildSystemPrompt(state, now);
  const turn = buildTurnPrompt({ history, text, fanName, story: detection.story, detection });
  const raw = await ask({ system, turn, schema: REPLY_SCHEMA });
  const reply = applyDisclosure(parseReply(raw, state, now), state, history);
  return { ...reply, detection: { campaignId: detection.campaignId, confidence: detection.confidence, reasons: detection.reasons } };
}
