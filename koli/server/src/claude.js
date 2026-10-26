// Calls Claude with structured output, so every reply comes back as JSON
// that matches the schema the caller passes.

import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-opus-5-5";

export class KoliError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Returns `ask({system, turn, schema})` for the shared reply pipeline.
 * Replies run at low effort (short chat answers, fast); voice analysis passes
 * a higher one. The system prompt is cached: it is the same for every fan.
 */
export function makeAsk(env, { effort, maxTokens = 8000, client } = {}) {
  const anthropic =
    client ||
    new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
    });
  const model = env.KOLI_MODEL || DEFAULT_MODEL;
  // Haiku has no server-side fallback model to hand a refusal to.
  const fallback = !model.includes("haiku");
  return async ({ system, turn, schema }) => {
    let response;
    try {
      response = await anthropic.beta.messages.create({
        model,
        max_tokens: maxTokens,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: turn }],
        output_config: { effort: effort || env.KOLI_EFFORT || "low", format: { type: "json_schema", schema } },
        ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
      });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new KoliError("bad_key", "מפתח ה-API של Anthropic לא תקין.", 503);
      if (err instanceof Anthropic.RateLimitError) throw new KoliError("rate_limited", "יותר מדי בקשות ל-Claude כרגע. נסו שוב בעוד דקה.", 429);
      if (err instanceof Anthropic.BadRequestError) throw new KoliError("bad_request", `Claude דחה את הבקשה: ${err.message}`, 502);
      if (err instanceof Anthropic.APIError) throw new KoliError("claude_error", `שגיאה מ-Claude (${err.status ?? "רשת"}).`, 502);
      throw err;
    }
    if (response.stop_reason === "refusal") throw new KoliError("refused", "Claude סירב לענות על ההודעה הזו. כדאי לענות עליה בעצמך.", 422);
    if (response.stop_reason === "max_tokens") throw new KoliError("too_long", "התשובה נחתכה באמצע.", 502);
    return response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
  };
}
