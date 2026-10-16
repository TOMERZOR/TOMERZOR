// End-to-end test of src/backend/live.ts against a real PostgREST + Postgres
// (started by api.sh). Two users, Alice (organiser) and Bob, go through the
// whole flow: profile, publish, request, accept, chat, plan.

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { createServer, request } from "node:http";
import * as live from "../../src/backend/live";
import type { Post } from "../../src/data/seed";

const SECRET = process.env.JWT_SECRET!;
const REST = Number(process.env.PGRST_PORT);
const alice = "a0000000-0000-0000-0000-000000000001";
const bob = "b0000000-0000-0000-0000-000000000002";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(sub: string) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${head}.${body}.${createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url")}`;
}

// supabase-js talks to <url>/rest/v1; PostgREST serves at its root.
const proxy = createServer((req, res) => {
  const up = request(
    { host: "127.0.0.1", port: REST, path: req.url!.replace(/^\/rest\/v1/, ""), method: req.method, headers: req.headers },
    (r) => {
      res.writeHead(r.statusCode!, r.headers);
      r.pipe(res);
    },
  );
  req.pipe(up);
});
await new Promise<void>((r) => proxy.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${(proxy.address() as { port: number }).port}`;

const as = (sub: string) => live.setClient(createClient(url, "test-anon-key", { accessToken: async () => jwt(sub) }));

let failures = 0;
function expect(cond: unknown, what: string) {
  if (cond) console.log(`  ok  ${what}`);
  else {
    failures++;
    console.log(`  FAIL ${what}`);
  }
}

try {
  // ── profile ──
  as(alice);
  expect((await live.loadMe(alice)).needsProfile, "new user is asked to fill in a profile");
  await live.saveProfile(alice, { name: "אליס כהן", gender: "f", pace: 4.5, level: "קשה", has_car: true, birth_year: 1994 });
  await live.saveFreeDays(alice, [1, 2]);
  await live.saveEmergency(alice, "אמא", "050-1234567");
  const meA = await live.loadMe(alice);
  expect(!meA.needsProfile && meA.me.name === "אליס כהן", "profile saved");
  expect(meA.me.freeDays.join() === "1,2", "free days round-trip as day offsets");
  expect(meA.me.emergencyContact === "050-1234567" && meA.me.emergencyName === "אמא", "emergency contact saved privately");

  // ── publish ──
  const draft: Post = {
    id: "tmp",
    authorId: "me",
    trailId: "ramon",
    dayOffset: 3,
    days: 1,
    flexible: false,
    start: "05:30",
    spots: 2,
    joined: [],
    pace: 4.5,
    level: "קשה",
    car: "shuttle",
    tags: ["שאטל רכבים"],
    note: "מחפשת שותפים",
    meet: "מרכז המבקרים",
    createdHoursAgo: 0,
  };
  const post = await live.publishPost(draft, alice);
  expect(post.id !== "tmp" && post.authorId === "me" && post.dayOffset === 3 && post.start === "05:30", "post published and mapped back");

  // ── Bob finds it and asks to join ──
  as(bob);
  await live.saveProfile(bob, { name: "בוב לוי", gender: "m", pace: 4, level: "בינוני" });
  let bobView = await live.loadEverything(bob);
  const seen = bobView.posts.find((p) => p.id === post.id);
  expect(seen && seen.authorId === alice, "Bob sees Alice's post with her id");
  expect(bobView.people.some((p) => p.id === alice && p.name === "אליס כהן" && p.age !== null), "Bob sees Alice's profile");
  await live.requestToJoin(post.id, "אשמח להצטרף", bob);
  await live.setRequestStatus(post.id, bob, "withdrawn");
  await live.requestToJoin(post.id, "בכל זאת", bob);
  bobView = await live.loadEverything(bob);
  expect(bobView.requests.find((r) => r.postId === post.id)?.status === "pending", "a withdrawn request can be reopened");

  // ── Alice accepts ──
  as(alice);
  const aliceView = await live.loadEverything(alice);
  const incoming = aliceView.requests.find((r) => r.postId === post.id);
  expect(incoming?.userId === bob && incoming.status === "pending", "Alice sees Bob's pending request");
  await live.setRequestStatus(post.id, bob, "accepted");

  as(bob);
  bobView = await live.loadEverything(bob);
  expect(bobView.posts.find((p) => p.id === post.id)?.joined.includes("me"), "Bob is on the crew list as \"me\"");

  // ── safe trip ──
  const back = Date.now() + 5 * 3_600_000;
  let ck = await live.scheduleCheckin(post.id, back, bob);
  expect(ck.userId === "me" && ck.status === "scheduled" && Math.abs(ck.returnBy - back) < 1000, "Bob sets a return time");
  ck = await live.scheduleCheckin(post.id, back + 3_600_000, bob);
  expect(Math.abs(ck.returnBy - back - 3_600_000) < 1000, "moving the return time updates the same check-in");
  ck = await live.setCheckinStatus(post.id, "returned", bob);
  expect(ck.status === "returned" && ck.returnedAt !== undefined && !ck.wasAlerted, "Bob marks himself back");

  // ── chat ──
  const threadId = await live.startThread(alice, post.id);
  expect((await live.startThread(alice, post.id)) === threadId, "start_thread reuses the thread");
  const sent = await live.sendMessage(threadId, "נפגשים בחניון?", bob);
  expect(sent.from === "me" && sent.text === "נפגשים בחניון?", "message sent and mapped back");

  as(alice);
  let threads = await live.loadThreads(alice);
  let t = threads.find((x) => x.id === threadId);
  expect(t?.withId === bob && t.messages[0]?.from === bob, "Alice sees the thread with Bob");
  expect(t?.unread === 1, "Alice has one unread message");
  expect(t?.plan.meet === "מרכז המבקרים", "plan starts from the post");
  expect((await live.loadEverything(alice)).checkins.some((c) => c.userId === bob && c.status === "returned"), "Alice sees her partner is back");
  await live.markRead(threadId, alice);
  await live.savePlan(threadId, { ...t!.plan, cars: "הרכב של אליס בסוף", gear: [{ label: "גזייה", who: "אליס", done: true }] });
  threads = await live.loadThreads(alice);
  expect(threads.find((x) => x.id === threadId)?.unread === 0, "marking read clears unread");

  as(bob);
  t = (await live.loadThreads(bob)).find((x) => x.id === threadId);
  expect(t?.plan.cars === "הרכב של אליס בסוף" && t.plan.gear.length === 1, "Bob sees Alice's plan change");
} catch (e) {
  failures++;
  console.log("  FAIL threw:", e);
} finally {
  proxy.close();
}

if (failures) {
  console.log(`${failures} API test(s) failed`);
  process.exit(1);
}
console.log("all API tests passed");
