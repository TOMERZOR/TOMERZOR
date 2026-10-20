import Anthropic from "@anthropic-ai/sdk";
import { REPLY_SCHEMA, SYSTEM_PROMPT, languageNote, noPhotoNote, type Language } from "./prompt";

/**
 * The server behind the My Old Friend app. The app sends a question (and a camera photo) and gets
 * Moffy's answer; it sends the answer's words and gets them back in Moffy's voice. The Claude and
 * ElevenLabs keys live here, so people who install the app never set anything up.
 *
 *   POST /v1/ask    { question, language, history?, photo? }  ->  { reply }
 *   POST /v1/speak  { text, language }                        ->  audio/mpeg
 *   GET  /health                                              ->  "ok"
 */

interface Env {
  ANTHROPIC_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  /** Shared with the app; requests without it are refused. */
  APP_TOKEN?: string;
  /** Optional R2 bucket that keeps every voice clip, shared by all users. */
  VOICE_CACHE?: R2Bucket;
}

const MODEL = "claude-opus-5-5";

// Hebrew: "Yael – Gentle, Confident Ad". English: "Emily – Trustworthy, Warm, Conversational".
const VOICES: Record<Language, string> = {
  he: "d4eLZ8u5dfBCsjp4YPyz",
  en: "zHGX9VSXpW8cGSDRCqy0",
};
const VOICE_MODEL = "eleven_v3";

const MAX_QUESTION = 2_000;
const MAX_SPEAK = 1_500;
const MAX_PHOTO_BASE64 = 2_500_000; // ~1.8 MB JPEG; the app sends ~1280 px, well under this
const MAX_HISTORY = 12;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return new Response("ok");
    if (request.method !== "POST") return json({ error: "not_found" }, 404);
    if (env.APP_TOKEN && request.headers.get("x-app-token") !== env.APP_TOKEN) {
      return json({ error: "unauthorized" }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "bad_request" }, 400);
    }

    switch (url.pathname) {
      case "/v1/ask":
        return ask(body, env);
      case "/v1/speak":
        return speak(body, env, ctx);
      default:
        return json({ error: "not_found" }, 404);
    }
  },
} satisfies ExportedHandler<Env>;

// MARK: - Moffy's answer

interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

async function ask(body: Record<string, unknown>, env: Env): Promise<Response> {
  const language = readLanguage(body.language);
  const question = typeof body.question === "string" ? body.question.trim().slice(0, MAX_QUESTION) : "";
  const photo = typeof body.photo === "string" ? body.photo : undefined;
  if (!question) return json({ error: "bad_request" }, 400);
  if (photo && photo.length > MAX_PHOTO_BASE64) return json({ error: "photo_too_large" }, 413);

  // Earlier turns go back as plain text only, so each question stays cheap.
  const history = readHistory(body.history);
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((turn) => ({
    role: turn.role,
    content: turn.text,
  }));

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (photo) {
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: photo } });
  }
  let text = languageNote(language);
  if (!photo) text += " " + noPhotoNote(language);
  content.push({ type: "text", text: `${text}\n\n${question}` });
  messages.push({ role: "user", content });

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages,
      // Low effort keeps answers quick; Moffy's replies are short.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: REPLY_SCHEMA as unknown as Record<string, unknown> },
      },
      // If a safety check declines a request, the API retries it on a suitable other model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (response.stop_reason === "refusal") return json({ error: "refused" }, 422);
    const answer = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    const reply = parseReply(answer);
    if (!reply) return json({ error: "unreadable" }, 502);
    return json({ reply, raw: answer });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 503);
    if (error instanceof Anthropic.InternalServerError) return json({ error: "busy" }, 503);
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic key rejected");
      return json({ error: "server_setup" }, 500);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic error ${error.status}: ${error.message}`);
      return json({ error: "failed" }, 502);
    }
    console.error("Unexpected error", error);
    return json({ error: "failed" }, 502);
  }
}

interface Reply {
  say: string;
  caption: string;
  mood: "happy" | "explaining" | "thinking" | "worried";
  step: number;
  finished: boolean;
  point: { visible: boolean; x: number; y: number; label: string };
}

function parseReply(text: string): Reply | null {
  try {
    const data = JSON.parse(text) as Partial<Reply>;
    if (typeof data.say !== "string" || typeof data.caption !== "string" || !data.point) return null;
    const point = data.point;
    return {
      say: data.say,
      caption: data.caption,
      mood: (["happy", "explaining", "thinking", "worried"] as const).includes(data.mood as Reply["mood"])
        ? (data.mood as Reply["mood"])
        : "explaining",
      step: Math.max(0, Math.round(Number(data.step) || 0)),
      finished: Boolean(data.finished),
      point: {
        visible: Boolean(point.visible),
        x: clamp(Number(point.x) || 0),
        y: clamp(Number(point.y) || 0),
        label: typeof point.label === "string" ? point.label : "",
      },
    };
  } catch {
    return null;
  }
}

// MARK: - Moffy's voice

async function speak(body: Record<string, unknown>, env: Env, ctx: ExecutionContext): Promise<Response> {
  const language = readLanguage(body.language);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_SPEAK) return json({ error: "bad_request" }, 400);

  const voice = VOICES[language];
  const key = `${voice}/${VOICE_MODEL}/${await sha256(text)}.mp3`;

  // The same sentence is made once for everyone: first this data center's cache, then the bucket.
  const cache = caches.default;
  const cacheRequest = new Request(`https://voice-cache.internal/${key}`);
  const cached = await cache.match(cacheRequest);
  if (cached) return cached;

  const stored = await env.VOICE_CACHE?.get(key);
  if (stored) {
    const audio = await stored.arrayBuffer();
    const response = audioResponse(audio);
    ctx.waitUntil(cache.put(cacheRequest, response.clone()));
    return response;
  }

  let generated: Response;
  try {
    generated = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: VOICE_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 0.92 },
      }),
    });
  } catch (error) {
    // The app falls back to the phone's own voice.
    console.error("ElevenLabs unreachable", error);
    return json({ error: "voice_failed" }, 502);
  }
  if (!generated.ok) {
    console.error(`ElevenLabs error ${generated.status}: ${(await generated.text()).slice(0, 300)}`);
    return json({ error: generated.status === 429 ? "busy" : "voice_failed" }, generated.status === 429 ? 503 : 502);
  }

  const audio = await generated.arrayBuffer();
  const response = audioResponse(audio);
  ctx.waitUntil(cache.put(cacheRequest, response.clone()));
  if (env.VOICE_CACHE) {
    ctx.waitUntil(env.VOICE_CACHE.put(key, audio, { httpMetadata: { contentType: "audio/mpeg" } }));
  }
  return response;
}

// MARK: - Helpers

function readLanguage(value: unknown): Language {
  return value === "he" ? "he" : "en";
}

function readHistory(value: unknown): HistoryTurn[] {
  if (!Array.isArray(value)) return [];
  const turns = value
    .filter(
      (turn): turn is HistoryTurn =>
        !!turn &&
        typeof turn === "object" &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.text === "string" &&
        turn.text.length > 0,
    )
    .map((turn) => ({ role: turn.role, text: turn.text.slice(0, 4_000) }))
    .slice(-MAX_HISTORY);
  // The conversation must start with the person.
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

function audioResponse(audio: ArrayBuffer): Response {
  return new Response(audio, {
    headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=31536000, immutable" },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
