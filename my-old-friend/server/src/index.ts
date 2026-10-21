import Anthropic from "@anthropic-ai/sdk";
import { allowNewClip, checkAccess, type AccessEnv } from "./access";
import { TERMS_URL, landingPage, privacyPage } from "./pages";
import { REPLY_SCHEMA, SYSTEM_PROMPT, languageNote, liveNote, noPhotoNote, photosNote, type Language } from "./prompt";

/**
 * The server behind the My Old Friend app. The app sends a question (and a camera photo) and gets
 * Moffy's answer; it sends the answer's words and gets them back in Moffy's voice. The Claude and
 * ElevenLabs keys live here, so people who install the app never set anything up.
 *
 *   POST /v1/ask    { question, language, history?, photo?, source?, goal? }  ->  { reply, raw, access }
 *   POST /v1/speak  { text, language }                        ->  audio/mpeg
 *   GET  /privacy                                             ->  the privacy policy
 *   GET  /terms                                               ->  Apple's standard licence agreement
 *   GET  /go                                                  ->  where printed QR codes point (App Store, or a short page)
 *   GET  /health                                              ->  "ok"
 *
 * Both POST routes need the phone's install ID (header x-install-id). Each phone gets a few free
 * questions; after that the monthly subscription (header x-subscription) is checked with Apple.
 */

interface Env extends AccessEnv {
  /** The app's App Store page, once it is live. /go (the QR code in printed ads) redirects there. */
  APP_STORE_URL?: string;
  ANTHROPIC_API_KEY: string;
  /** Only for an organization-wide Anthropic key: the workspace to bill (wrkspc_…). A key created inside
   * a workspace doesn't need it. */
  ANTHROPIC_WORKSPACE_ID?: string;
  ELEVENLABS_API_KEY: string;
  /** Shared with the app; requests without it are refused. */
  APP_TOKEN?: string;
  /** Optional R2 bucket that keeps every voice clip, shared by all users. */
  VOICE_CACHE?: R2Bucket;
}

// Haiku thinking at medium effort matched Opus on every case of our test set, at a small fraction
// of the cost. Opus answers only the rare question Haiku's safety checks decline.
const MODEL = "claude-haiku-5-5";
const MODEL_EFFORT = "medium";
const REFUSAL_MODEL = "claude-opus-5-5";

// Hebrew: "Yael – Gentle, Confident Ad". English: "Emily – Trustworthy, Warm, Conversational".
const VOICES: Record<Language, string> = {
  he: "d4eLZ8u5dfBCsjp4YPyz",
  en: "zHGX9VSXpW8cGSDRCqy0",
};
const VOICE_MODEL = "eleven_v4";

const MAX_QUESTION = 2_000;
const MAX_SPEAK = 1_500;
const MAX_PHOTO_BASE64 = 2_500_000; // ~1.8 MB JPEG; the app sends ~1280 px, well under this
const MAX_HISTORY = 8;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET") {
      if (url.pathname === "/health") return new Response("ok");
      if (url.pathname === "/privacy") return privacyPage();
      if (url.pathname === "/terms") return Response.redirect(TERMS_URL, 302);
      if (url.pathname === "/go") return env.APP_STORE_URL ? Response.redirect(env.APP_STORE_URL, 302) : landingPage();
      return json({ error: "not_found" }, 404);
    }
    if (request.method !== "POST") return json({ error: "not_found" }, 404);
    if (env.APP_TOKEN && request.headers.get("x-app-token") !== env.APP_TOKEN) {
      return json({ error: "unauthorized" }, 401);
    }
    const installId = request.headers.get("x-install-id")?.toLowerCase() ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(installId)) {
      return json({ error: "bad_request" }, 400);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "bad_request" }, 400);
    }

    switch (url.pathname) {
      case "/v1/ask":
        return ask(body, env, ctx, request, installId);
      case "/v1/speak":
        return speak(body, env, ctx, installId);
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

async function ask(
  body: Record<string, unknown>,
  env: Env,
  ctx: ExecutionContext,
  request: Request,
  installId: string,
): Promise<Response> {
  const language = readLanguage(body.language);
  const question = typeof body.question === "string" ? body.question.trim().slice(0, MAX_QUESTION) : "";
  const photo = typeof body.photo === "string" ? body.photo : undefined;
  if (!question) return json({ error: "bad_request" }, 400);
  if (photo && photo.length > MAX_PHOTO_BASE64) return json({ error: "photo_too_large" }, 413);

  const check = await checkAccess(request, env, installId);
  if (!check.allowed) return json({ error: check.error, access: check.access }, check.status);

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
  else if (body.source === "live" || body.live === true) {
    text += " " + liveNote(language, typeof body.goal === "string" ? body.goal : question);
  } else if (body.source === "photos") text += " " + photosNote(language);
  content.push({ type: "text", text: `${text}\n\n${question}` });
  messages.push({ role: "user", content });

  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    defaultHeaders: env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID } : undefined,
  });
  const format = { type: "json_schema", schema: REPLY_SCHEMA as unknown as Record<string, unknown> };
  try {
    let response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages,
      output_config: { effort: MODEL_EFFORT, format },
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);

    // Haiku has no server-side fallback, so a question its safety checks decline gets one more try
    // on Opus, which can fall back further on its own.
    if (response.stop_reason === "refusal") {
      response = await client.beta.messages.create({
        model: REFUSAL_MODEL,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages,
        output_config: { effort: "low", format },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
    }
    if (response.stop_reason === "refusal") return json({ error: "refused" }, 422);
    const answer = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    const reply = parseReply(answer);
    if (!reply) return json({ error: "unreadable" }, 502);

    // Only answers count against the free questions, and only Moffy's own answers get a new voice clip.
    await check.count();
    if (env.USAGE) {
      const said = `said:${await sha256(`${VOICES[language]}|${VOICE_MODEL}|${reply.say.trim()}`)}`;
      ctx.waitUntil(env.USAGE.put(said, "1", { expirationTtl: 7 * 86_400 }));
    }
    return json({ reply, raw: answer, access: check.access });
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

async function speak(body: Record<string, unknown>, env: Env, ctx: ExecutionContext, installId: string): Promise<Response> {
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

  // New clips are made for Moffy's recent answers; anything else (the app's fixed sentences) has a
  // small daily allowance per phone, so the voice can't be used as a free text-to-speech service.
  let countClip = async () => {};
  if (env.USAGE) {
    const said = await env.USAGE.get(`said:${await sha256(`${voice}|${VOICE_MODEL}|${text}`)}`);
    if (!said) {
      const allowance = await allowNewClip(env, installId);
      if (!allowance.ok) return json({ error: "daily_limit" }, 429);
      countClip = allowance.count;
    }
  }

  const generate = (settings: boolean) =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: VOICE_MODEL,
        ...(settings ? { language_code: language, voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 0.92 } } : {}),
      }),
    });

  let generated: Response;
  try {
    // Naming the language keeps Hebrew pronunciation right, and a slightly slower pace suits older
    // listeners. If the voice model ever refuses these settings, the clip is made with its defaults.
    generated = await generate(true);
    if (generated.status === 400 || generated.status === 422) {
      await generated.body?.cancel();
      generated = await generate(false);
    }
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
  ctx.waitUntil(countClip());
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
