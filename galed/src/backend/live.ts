// Supabase adapter: loads rows, maps them to the app's types, and writes
// changes back. The current user's id is mapped to "me" on the way in and
// back on the way out, so screens never deal with raw ids for themselves.

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { Message, Person, Post, Thread } from "../data/seed";
import type { Level } from "../data/trails";
import type { Me } from "../lib";
import type { Checkin, CheckinStatus, JoinRequest, RequestStatus } from "../store";
import { supabaseKey, supabaseUrl } from "./config";

let client: SupabaseClient | null = null;
export const sb = () => (client ??= createClient(supabaseUrl!, supabaseKey!));
/** For tests: run the adapter against a client set up by the caller. */
export const setClient = (c: SupabaseClient) => {
  client = c;
};

// ── dates ───────────────────────────────────────────────────

const todayUTC = () => {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};
export const offsetFromISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - todayUTC()) / 86_400_000);
};
export const isoFromOffset = (offset: number) => new Date(todayUTC() + offset * 86_400_000).toISOString().slice(0, 10);

// ── row types ───────────────────────────────────────────────

interface ProfileRow {
  id: string;
  name: string;
  gender: "f" | "m" | "x";
  birth_year: number | null;
  city: string;
  pace: number | string;
  level: Level;
  langs: string[];
  has_car: boolean;
  bio: string;
  ink: Person["ink"];
  verified: boolean;
  free_days: string[];
}
interface PostRow {
  id: string;
  author_id: string;
  trail_id: string;
  start_date: string;
  days: number;
  flexible: boolean;
  start_time: string;
  direction: string | null;
  spots: number;
  pace: number | string;
  level: Level;
  car: Post["car"];
  tags: string[];
  note: string;
  meet: string;
  created_at: string;
}
interface RequestRow {
  post_id: string;
  user_id: string;
  status: RequestStatus;
  message: string;
  updated_at: string;
}
interface CheckinRow {
  id: string;
  user_id: string;
  post_id: string;
  return_by: string;
  status: CheckinStatus;
  returned_at: string | null;
  alerted_at: string | null;
}
interface MessageRow {
  id: string;
  thread_id?: string;
  sender_id: string;
  body: string;
  created_at: string;
}
interface ThreadRow {
  id: string;
  post_id: string | null;
  plan: Partial<Thread["plan"]>;
  thread_members: { user_id: string; last_read_at: string }[];
  messages: MessageRow[];
}

// ── mapping ─────────────────────────────────────────────────

const who = (id: string, me: string) => (id === me ? "me" : id);

const toPerson = (r: ProfileRow, hikes: number): Person => ({
  id: r.id,
  name: r.name || "מטייל/ת חדש/ה",
  g: r.gender,
  age: r.birth_year ? new Date().getFullYear() - r.birth_year : null,
  city: r.city,
  pace: Number(r.pace),
  level: r.level,
  hikes,
  showUp: null,
  langs: r.langs,
  car: r.has_car,
  bio: r.bio,
  ink: r.ink,
  verified: r.verified,
  references: [],
});

const toPost = (r: PostRow, me: string, joined: string[]): Post => ({
  id: r.id,
  authorId: who(r.author_id, me),
  trailId: r.trail_id,
  dayOffset: offsetFromISO(r.start_date),
  days: r.days,
  flexible: r.flexible,
  start: r.start_time.slice(0, 5),
  direction: r.direction ?? undefined,
  spots: r.spots,
  joined,
  pace: Number(r.pace),
  level: r.level,
  car: r.car,
  tags: r.tags,
  note: r.note,
  meet: r.meet,
  createdHoursAgo: Math.round((Date.now() - Date.parse(r.created_at)) / 3_600_000),
});

const toRequest = (r: RequestRow, me: string): JoinRequest => ({
  postId: r.post_id,
  userId: who(r.user_id, me),
  status: r.status,
  message: r.message,
  at: Date.parse(r.updated_at),
});

export const toMessage = (r: MessageRow, me: string): Message => ({
  id: r.id,
  from: who(r.sender_id, me),
  text: r.body,
  at: Date.parse(r.created_at),
});

export const toCheckin = (r: CheckinRow, me: string): Checkin => ({
  id: r.id,
  postId: r.post_id,
  userId: who(r.user_id, me),
  returnBy: Date.parse(r.return_by),
  status: r.status,
  returnedAt: r.returned_at ? Date.parse(r.returned_at) : undefined,
  wasAlerted: Boolean(r.alerted_at),
});

const emptyPlan: Thread["plan"] = { meet: "", time: "", cars: "", gear: [], shareWithEmergency: false };

const toThread = (r: ThreadRow, me: string): Thread => {
  const mine = r.thread_members.find((m) => m.user_id === me);
  const other = r.thread_members.find((m) => m.user_id !== me);
  const readAt = mine ? Date.parse(mine.last_read_at) : 0;
  const messages = [...r.messages].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((m) => toMessage(m, me));
  return {
    id: r.id,
    withId: other?.user_id ?? "",
    postId: r.post_id ?? "",
    unread: messages.filter((m) => m.from !== "me" && m.at > readAt).length,
    messages,
    plan: { ...emptyPlan, ...r.plan },
  };
};

const check = <T>(res: { data: T; error: { message: string } | null }) => {
  if (res.error) throw new Error(res.error.message);
  return res.data;
};

// ── auth ────────────────────────────────────────────────────

export async function currentUser() {
  const { data } = await sb().auth.getSession();
  return data.session?.user ?? null;
}

export const onAuthChange = (f: (userId: string | null, email?: string) => void) =>
  sb().auth.onAuthStateChange((_e, session) => f(session?.user.id ?? null, session?.user.email));

/** Emails a one-time sign-in code (the template must include {{ .Token }}; see README). */
export async function sendSignInCode(email: string) {
  const { error } = await sb().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export async function verifySignInCode(email: string, token: string) {
  const { error } = await sb().auth.verifyOtp({ email, token, type: "email" });
  if (error) throw new Error(error.message);
}

export const signOut = () => sb().auth.signOut();

// ── loading ─────────────────────────────────────────────────

export async function loadMe(me: string): Promise<{ me: Me; needsProfile: boolean }> {
  const [profile, priv, stats] = await Promise.all([
    sb().from("profiles").select("*").eq("id", me).single(),
    sb().from("private_settings").select("emergency_name, emergency_phone").eq("user_id", me).maybeSingle(),
    sb().from("profile_stats").select("hikes").eq("id", me).maybeSingle(),
  ]);
  const p = check(profile) as ProfileRow & { terms_accepted_at: string | null };
  return {
    needsProfile: !p.name.trim() || !p.terms_accepted_at,
    me: {
      name: p.name,
      city: p.city,
      pace: Number(p.pace),
      level: p.level,
      hikes: Number((stats.data as { hikes: number } | null)?.hikes ?? 0),
      emergencyContact: (priv.data as { emergency_phone: string } | null)?.emergency_phone ?? "",
      emergencyName: (priv.data as { emergency_name: string } | null)?.emergency_name ?? "",
      freeDays: p.free_days.map(offsetFromISO).filter((d) => d >= 0 && d < 21),
    },
  };
}

export async function loadEverything(me: string) {
  const since = isoFromOffset(-1);
  const [profiles, stats, posts, requests, threads, checkins] = await Promise.all([
    sb().from("profiles").select("*").neq("id", me).neq("name", ""),
    sb().from("profile_stats").select("id, hikes"),
    sb().from("posts").select("*").eq("cancelled", false).gte("start_date", since).order("start_date").limit(300),
    sb().from("join_requests").select("post_id, user_id, status, message, updated_at"),
    loadThreads(me),
    sb().from("checkins").select("id, user_id, post_id, return_by, status, returned_at, alerted_at"),
  ]);
  const hikes = new Map((check(stats) as { id: string; hikes: number }[]).map((s) => [s.id, Number(s.hikes)]));
  const reqRows = check(requests) as RequestRow[];
  const crew = (postId: string) =>
    reqRows.filter((r) => r.post_id === postId && r.status === "accepted").map((r) => who(r.user_id, me));
  return {
    people: (check(profiles) as ProfileRow[]).map((r) => toPerson(r, hikes.get(r.id) ?? 0)),
    posts: (check(posts) as PostRow[]).map((r) => toPost(r, me, crew(r.id))),
    requests: reqRows.map((r) => toRequest(r, me)),
    threads,
    checkins: (check(checkins) as CheckinRow[]).map((r) => toCheckin(r, me)),
  };
}

export async function loadThreads(me: string): Promise<Thread[]> {
  const rows = check(
    await sb()
      .from("threads")
      .select("id, post_id, plan, thread_members(user_id, last_read_at), messages(id, sender_id, body, created_at)")
      .order("created_at", { ascending: false }),
  ) as ThreadRow[];
  return rows.map((r) => toThread(r, me));
}

// ── writes ──────────────────────────────────────────────────

export async function publishPost(p: Post, me: string): Promise<Post> {
  const row = check(
    await sb()
      .from("posts")
      .insert({
        trail_id: p.trailId,
        start_date: isoFromOffset(p.dayOffset),
        days: p.days,
        flexible: p.flexible,
        start_time: p.start,
        direction: p.direction ?? null,
        spots: p.spots,
        pace: p.pace,
        level: p.level,
        car: p.car,
        tags: p.tags,
        note: p.note,
        meet: p.meet,
      })
      .select()
      .single(),
  ) as PostRow;
  return toPost(row, me, []);
}

export async function requestToJoin(postId: string, message: string, me: string) {
  const res = await sb().from("join_requests").insert({ post_id: postId, message });
  // a request withdrawn earlier already has a row; ask again by reopening it
  if (res.error?.code === "23505") {
    check(await sb().from("join_requests").update({ status: "pending" }).eq("post_id", postId).eq("user_id", me));
  } else check(res);
}

export async function setRequestStatus(postId: string, userId: string, status: RequestStatus) {
  check(await sb().from("join_requests").update({ status }).eq("post_id", postId).eq("user_id", userId));
}

export async function startThread(otherId: string, postId: string): Promise<string> {
  return check(await sb().rpc("start_thread", { other: otherId, about: postId })) as string;
}

export async function sendMessage(threadId: string, body: string, me: string): Promise<Message> {
  const row = check(await sb().from("messages").insert({ thread_id: threadId, body }).select().single()) as MessageRow;
  return toMessage(row, me);
}

export async function savePlan(threadId: string, plan: Thread["plan"]) {
  check(await sb().from("threads").update({ plan }).eq("id", threadId));
}

export async function markRead(threadId: string, me: string) {
  check(
    await sb().from("thread_members").update({ last_read_at: new Date().toISOString() }).eq("thread_id", threadId).eq("user_id", me),
  );
}

export interface ProfileInput {
  name?: string;
  gender?: "f" | "m" | "x";
  birth_year?: number | null;
  city?: string;
  pace?: number;
  level?: Level;
  has_car?: boolean;
  bio?: string;
  terms_accepted_at?: string;
}

export async function saveProfile(me: string, fields: ProfileInput) {
  check(await sb().from("profiles").update(fields).eq("id", me));
}

export async function saveFreeDays(me: string, offsets: number[]) {
  check(await sb().from("profiles").update({ free_days: offsets.map(isoFromOffset) }).eq("id", me));
}

export async function saveEmergency(me: string, name: string, phone: string) {
  check(await sb().from("private_settings").update({ emergency_name: name, emergency_phone: phone }).eq("user_id", me));
}

const checkinCols = "id, user_id, post_id, return_by, status, returned_at, alerted_at";

/** Sets (or moves) my return time for a hike and re-arms the check-in. */
export async function scheduleCheckin(postId: string, returnBy: number, me: string): Promise<Checkin> {
  const return_by = new Date(returnBy).toISOString();
  const ins = await sb().from("checkins").insert({ post_id: postId, return_by }).select(checkinCols).single();
  if (ins.error?.code !== "23505") return toCheckin(check(ins) as CheckinRow, me);
  const row = check(
    await sb().from("checkins").update({ return_by, status: "scheduled" }).eq("post_id", postId).eq("user_id", me).select(checkinCols).single(),
  ) as CheckinRow;
  return toCheckin(row, me);
}

export async function setCheckinStatus(postId: string, status: Exclude<CheckinStatus, "alerted">, me: string): Promise<Checkin> {
  const row = check(
    await sb().from("checkins").update({ status }).eq("post_id", postId).eq("user_id", me).select(checkinCols).single(),
  ) as CheckinRow;
  return toCheckin(row, me);
}

// ── safety ──────────────────────────────────────────────────

export async function loadBlocked(): Promise<{ id: string; name: string }[]> {
  return (check(await sb().from("blocks").select("blocked_id, blocked_name")) as { blocked_id: string; blocked_name: string }[]).map((r) => ({
    id: r.blocked_id,
    name: r.blocked_name,
  }));
}

export async function block(userId: string) {
  const res = await sb().from("blocks").insert({ blocked_id: userId });
  if (res.error?.code !== "23505") check(res);
}

export async function unblock(userId: string, me: string) {
  check(await sb().from("blocks").delete().eq("blocker_id", me).eq("blocked_id", userId));
}

export type ReportReason = "harassment" | "inappropriate" | "spam" | "fake" | "unsafe" | "other";

export async function report(r: { targetId: string; postId?: string; messageId?: string; reason: ReportReason; details: string; snapshot: string }) {
  check(
    await sb().from("reports").insert({
      target_id: r.targetId,
      post_id: r.postId ?? null,
      message_id: r.messageId ?? null,
      reason: r.reason,
      details: r.details,
      snapshot: r.snapshot.slice(0, 2000),
    }),
  );
}

export async function deleteMyAccount() {
  check(await sb().rpc("delete_my_account"));
  try {
    await sb().auth.signOut();
  } catch {
    /* the account is gone either way; signing out only clears this device */
  }
}

// ── realtime ────────────────────────────────────────────────

export type LiveEvent =
  | { kind: "message"; threadId: string; row: MessageRow }
  | { kind: "request"; row: RequestRow }
  | { kind: "plan"; threadId: string; plan: Thread["plan"] }
  | { kind: "checkin"; row: CheckinRow }
  | { kind: "post" };

/** Row-level security limits each event to rows this user may read. */
export function subscribe(onEvent: (e: LiveEvent) => void): () => void {
  const channel: RealtimeChannel = sb()
    .channel("galed-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) =>
      onEvent({ kind: "message", threadId: (p.new as MessageRow).thread_id!, row: p.new as MessageRow }),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "join_requests" }, (p) =>
      onEvent({ kind: "request", row: p.new as RequestRow }),
    )
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "threads" }, (p) =>
      onEvent({ kind: "plan", threadId: (p.new as ThreadRow).id, plan: { ...emptyPlan, ...(p.new as ThreadRow).plan } }),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "checkins" }, (p) =>
      onEvent({ kind: "checkin", row: p.new as CheckinRow }),
    )
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => onEvent({ kind: "post" }))
    .subscribe();
  return () => {
    void sb().removeChannel(channel);
  };
}

export { toRequest };
