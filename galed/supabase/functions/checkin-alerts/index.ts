// Edge function: texts emergency contacts about overdue hikers, and sends
// an all-clear once a hiker marks themselves back after an alert.
// Run it every 5 minutes (see README: "חזרתי" section).
//
// Secrets: CRON_SECRET (the scheduler sends it as x-cron-secret),
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM.

import { createClient } from "jsr:@supabase/supabase-js@2.117.2";
import { alertText, toE164, type AlertRow } from "./message.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendSms(to: string, body: string) {
  const sid = env("TWILIO_ACCOUNT_SID");
  const base = env("TWILIO_API_BASE") || "https://api.twilio.com"; // overridden in tests
  const res = await fetch(`${base}/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${env("TWILIO_AUTH_TOKEN")}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: env("TWILIO_FROM"), Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (!sameSecret(req.headers.get("x-cron-secret") ?? "", env("CRON_SECRET"))) {
    return new Response("forbidden", { status: 403 });
  }
  if (!env("TWILIO_ACCOUNT_SID") || !env("TWILIO_AUTH_TOKEN") || !env("TWILIO_FROM")) {
    // claim nothing, so alerts go out once SMS is configured
    return Response.json({ error: "SMS is not configured" }, { status: 503 });
  }

  const { data, error } = await db.rpc("claim_overdue_checkins");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const result = { sent: 0, retry: 0, noPhone: [] as string[] };
  for (const row of (data ?? []) as AlertRow[]) {
    const to = toE164(row.contact_phone);
    if (!to) {
      // nothing to retry with; leave it claimed and report it
      result.noPhone.push(row.checkin_id);
      continue;
    }
    try {
      await sendSms(to, alertText(row));
      result.sent++;
    } catch (e) {
      console.error(row.checkin_id, e);
      await db.rpc("release_checkin_claim", { id: row.checkin_id, kind: row.kind });
      result.retry++;
    }
  }
  return Response.json(result);
});
