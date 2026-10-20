/**
 * Who may ask Moffy: every phone gets a few free questions, then needs the monthly subscription.
 * Counts live in a Workers KV namespace (USAGE). A subscription is checked with Apple's App Store
 * Server API and the answer is remembered for a while, so Apple is asked rarely.
 */

export interface AccessEnv {
  USAGE?: KVNamespace;
  /** Free questions per phone before the subscription is needed. Default 20. */
  TRIAL_QUESTIONS?: string;
  /** Fair-use cap per subscription per day. Default 40. */
  DAILY_LIMIT?: string;
  /** App Store Connect → Users and Access → Integrations → In-App Purchase key. */
  APPLE_ISSUER_ID?: string;
  APPLE_KEY_ID?: string;
  /** The whole .p8 file, including the BEGIN and END lines. */
  APPLE_PRIVATE_KEY?: string;
  BUNDLE_ID?: string;
  /** Development only: trust any subscription id, for buying with Xcode's StoreKit test file. */
  DEV_TRUST_SUBSCRIPTIONS?: string;
}

export const PRODUCT_ID = "com.tomerzor.myoldfriend.monthly";

export interface Access {
  subscribed: boolean;
  trialLeft: number;
}

export type AccessCheck =
  | { allowed: true; access: Access; /** Call after a successful answer. */ count: () => Promise<void> }
  | { allowed: false; error: "trial_over" | "daily_limit"; status: number; access: Access };

export async function checkAccess(request: Request, env: AccessEnv, installId: string): Promise<AccessCheck> {
  const trialLimit = number(env.TRIAL_QUESTIONS, 20);
  const usage = env.USAGE;
  // Before the KV namespace is set up (local development), there are no limits.
  if (!usage) return { allowed: true, access: { subscribed: false, trialLeft: trialLimit }, count: async () => {} };

  const trialKey = `trial:${installId}`;
  const trialUsed = number(await usage.get(trialKey), 0);
  const trialLeft = Math.max(trialLimit - trialUsed, 0);

  const subscription = request.headers.get("x-subscription")?.trim() ?? "";
  if (/^\d{1,30}$/.test(subscription) && (await isSubscribed(subscription, env, usage))) {
    const dayKey = `daily:${subscription}:${today()}`;
    const usedToday = number(await usage.get(dayKey), 0);
    const access = { subscribed: true, trialLeft };
    if (usedToday >= number(env.DAILY_LIMIT, 40)) {
      return { allowed: false, error: "daily_limit", status: 429, access };
    }
    return {
      allowed: true,
      access,
      count: () => usage.put(dayKey, String(usedToday + 1), { expirationTtl: 2 * 86_400 }),
    };
  }

  if (trialLeft <= 0) return { allowed: false, error: "trial_over", status: 402, access: { subscribed: false, trialLeft: 0 } };
  return {
    allowed: true,
    access: { subscribed: false, trialLeft: trialLeft - 1 },
    count: () => usage.put(trialKey, String(trialUsed + 1)),
  };
}

/** A free per-phone allowance of new voice clips a day, for the app's own fixed sentences. */
export async function allowNewClip(env: AccessEnv, installId: string, perDay = 30): Promise<{ ok: boolean; count: () => Promise<void> }> {
  const usage = env.USAGE;
  if (!usage) return { ok: true, count: async () => {} };
  const key = `speak:${installId}:${today()}`;
  const used = number(await usage.get(key), 0);
  return { ok: used < perDay, count: () => usage.put(key, String(used + 1), { expirationTtl: 2 * 86_400 }) };
}

// MARK: - Apple

async function isSubscribed(originalTransactionId: string, env: AccessEnv, usage: KVNamespace): Promise<boolean> {
  const cacheKey = `sub:${originalTransactionId}`;
  const cached = await usage.get(cacheKey);
  if (cached) return cached === "1";

  if (!env.APPLE_ISSUER_ID || !env.APPLE_KEY_ID || !env.APPLE_PRIVATE_KEY) {
    return env.DEV_TRUST_SUBSCRIPTIONS === "true";
  }

  let active: boolean;
  try {
    active = await askApple(originalTransactionId, env);
  } catch (error) {
    // Apple unreachable: let a paying person keep going, but don't remember the answer.
    console.error("App Store Server API failed", error);
    return true;
  }
  await usage.put(cacheKey, active ? "1" : "0", { expirationTtl: active ? 6 * 3_600 : 600 });
  return active;
}

interface StatusResponse {
  data?: { lastTransactions?: { status?: number; signedTransactionInfo?: string }[] }[];
}

/** Production first; TestFlight and Xcode sandbox purchases are only known to the sandbox. */
async function askApple(originalTransactionId: string, env: AccessEnv): Promise<boolean> {
  const token = await appleToken(env);
  for (const host of ["https://api.storekit.itunes.apple.com", "https://api.storekit-sandbox.itunes.apple.com"]) {
    const response = await fetch(`${host}/inApps/v1/subscriptions/${originalTransactionId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.status === 404) continue;
    if (response.status === 400) return false;
    if (!response.ok) throw new Error(`Apple ${response.status}: ${(await response.text()).slice(0, 200)}`);

    const body = (await response.json()) as StatusResponse;
    for (const group of body.data ?? []) {
      for (const transaction of group.lastTransactions ?? []) {
        // 1 = active, 4 = billing grace period (Apple is retrying the payment, keep helping).
        if (transaction.status !== 1 && transaction.status !== 4) continue;
        const info = decodePayload(transaction.signedTransactionInfo) as { productId?: string } | null;
        if (!info || info.productId === PRODUCT_ID) return true;
      }
    }
    return false;
  }
  return false;
}

/** A short-lived ES256 token for the App Store Server API, signed with the In-App Purchase key. */
async function appleToken(env: AccessEnv): Promise<string> {
  const pem = (env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const base64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: env.APPLE_KEY_ID, typ: "JWT" };
  const payload = {
    iss: env.APPLE_ISSUER_ID,
    iat: now,
    exp: now + 1_800,
    aud: "appstoreconnect-v1",
    bid: env.BUNDLE_ID || "com.tomerzor.myoldfriend",
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // WebCrypto returns the raw r‖s signature, which is exactly what JWS ES256 expects.
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

function decodePayload(jws: string | undefined): unknown {
  const part = jws?.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

// MARK: - Helpers

function base64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function number(value: string | null | undefined, fallback: number): number {
  const parsed = Number(value);
  return value != null && value !== "" && Number.isFinite(parsed) ? parsed : fallback;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
