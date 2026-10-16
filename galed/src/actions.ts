// Everything a screen can change goes through here. In demo mode the change
// stays in the browser (and a few replies are simulated so the flows feel
// alive); in live mode it is applied to the screen first and then saved to
// Supabase.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { isLive } from "./backend/config";
import * as live from "./backend/live";
import { people as seedPeople, posts as seedPosts, threads as seedThreads, type Post, type Thread } from "./data/seed";
import { filterMessage, friendlyError, hasBannedTerm } from "./filter";
import { haptic } from "./native";

// "חזרתי" pressed without signal is kept here and sent when the phone is back online.
const PENDING_KEY = "galed:pending-checkins";
type Pending = { postId: string; status: "returned" | "cancelled" };
const readPending = (): Pending[] => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]");
  } catch {
    return [];
  }
};
const writePending = (list: Pending[]) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
};
import { trailById } from "./data/trails";
import { carLabel, clock, GRACE_MIN, rangeLabel } from "./lib";
import { useNav } from "./nav";
import { findPerson, myCheckin, useStore, type Checkin, type RequestStatus, type State } from "./store";

const first = (name: string) => name.split(" ")[0];

// Canned replies for the demo. A real conversation replaces this.
function demoReply(text: string, g: "f" | "m" | "x"): string {
  const bring = g === "f" ? "מביאה" : "מביא";
  if (text.includes("קצב")) return "בערך 4-4.5 קמ״ש בשטח פתוח, יותר לאט בירידות. עוצרים כל שעה וחצי.";
  if (text.includes("רכב")) return "יש לי רכב. אם גם לך יש, נשאיר אחד בסוף ונחסוך טרמפ.";
  if (text.includes("מים")) return `אין מים בדרך. 3-4 ליטר לאדם, ואני ${bring} עוד 2 ברכב.`;
  if (text.includes("כלב")) return "בשמחה, רק שיהיה עם מים משלו ורצועה בקטעים עם מטפסים.";
  if (text.includes("סגור") || text.includes("בא")) return "מעולה! הוספתי אותך לתוכנית. נתראה בנקודת המפגש 🙌";
  return "נשמע טוב. בוא/י נסגור את הפרטים בכרטיס התוכנית למעלה.";
}

export function useActions() {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  // read the latest state inside timers and async callbacks
  const ref = useRef<State>(state);
  ref.current = state;
  const me = state.session.userId ?? "";

  const guard = useCallback(
    async (f: () => Promise<unknown>) => {
      try {
        await f();
        return true;
      } catch (e) {
        console.error(e);
        toast(friendlyError(e));
        return false;
      }
    },
    [toast],
  );

  return useMemo(() => {
    const api = {
      async publish(draft: Post): Promise<boolean> {
        if (hasBannedTerm(`${draft.note} ${draft.meet} ${draft.tags.join(" ")}`)) {
          toast(filterMessage);
          return false;
        }
        if (!isLive) {
          dispatch({ type: "publish", post: draft });
          const asker = ref.current.people.find((p) => p.id === "omer");
          if (asker)
            window.setTimeout(() => {
              dispatch({
                type: "upsertRequest",
                request: { postId: draft.id, userId: asker.id, status: "pending", message: "קצב שלי דומה, ויש לי ניסיון במסלולים קוויים. אשמח להצטרף!", at: Date.now() },
              });
              toast(`${first(asker.name)} ביקש להצטרף ל${trailById(draft.trailId).name}`);
            }, 7000);
          return true;
        }
        return guard(async () => dispatch({ type: "publish", post: await live.publishPost(draft, me) }));
      },

      async request(postId: string, message = "") {
        const post = ref.current.posts.find((p) => p.id === postId);
        const host = post && findPerson(ref.current, post.authorId);
        dispatch({ type: "upsertRequest", request: { postId, userId: "me", status: "pending", message, at: Date.now() } });
        haptic("success");
        if (!isLive) {
          toast(`הבקשה נשלחה ל${host ? first(host.name) : "מארגן/ת"}.`);
          window.setTimeout(() => {
            if (ref.current.requests.find((r) => r.postId === postId && r.userId === "me")?.status !== "pending") return;
            dispatch({ type: "upsertRequest", request: { postId, userId: "me", status: "accepted", message, at: Date.now() } });
            toast(`${host ? first(host.name) : "המארגן/ת"} ${host?.g === "f" ? "אישרה" : "אישר"} את הבקשה. אבן נוספה לגלעד.`);
          }, 5000);
          return;
        }
        const ok = await guard(() => live.requestToJoin(postId, message, me));
        if (ok) toast(`הבקשה נשלחה ל${host ? first(host.name) : "מארגן/ת"}.`);
        else dispatch({ type: "upsertRequest", request: { postId, userId: "me", status: "withdrawn", message, at: Date.now() } });
      },

      async withdraw(postId: string) {
        dispatch({ type: "upsertRequest", request: { postId, userId: "me", status: "withdrawn", message: "", at: Date.now() } });
        if (isLive) await guard(() => live.setRequestStatus(postId, me, "withdrawn"));
      },

      async answer(postId: string, userId: string, status: Extract<RequestStatus, "accepted" | "declined">) {
        const prev = ref.current.requests.find((r) => r.postId === postId && r.userId === userId);
        if (!prev) return;
        dispatch({ type: "upsertRequest", request: { ...prev, status, at: Date.now() } });
        if (isLive && !(await guard(() => live.setRequestStatus(postId, userId, status))))
          dispatch({ type: "upsertRequest", request: prev });
      },

      /** Finds or opens the conversation with a person about a hike; returns its id. */
      async openChat(otherId: string, postId: string): Promise<string | null> {
        const s = ref.current;
        const existing = s.threads.find((t) => t.withId === otherId && t.postId === postId) ?? s.threads.find((t) => t.withId === otherId);
        if (!isLive) {
          if (existing) return existing.id;
          const post = s.posts.find((p) => p.id === postId)!;
          const t = trailById(post.trailId);
          const thread: Thread = {
            id: `t-${otherId}-${postId}`,
            withId: otherId,
            postId,
            unread: 0,
            messages: [{ id: "sys", from: "system", kind: "system", text: `שיחה על ${t.name} · ${rangeLabel(post)}`, at: Date.now() }],
            plan: {
              meet: post.meet,
              time: `${rangeLabel(post)} · ${post.start}`,
              cars: carLabel[post.car],
              gear: [
                { label: "מים לכל אחד", who: "כולם", done: false },
                { label: "ערכת עזרה ראשונה", who: "?", done: false },
              ],
              shareWithEmergency: false,
            },
          };
          dispatch({ type: "openThread", thread });
          return thread.id;
        }
        let id: string | null = null;
        await guard(async () => {
          id = await live.startThread(otherId, postId);
          if (!ref.current.threads.some((t) => t.id === id)) dispatch({ type: "hydrate", data: { threads: await live.loadThreads(me) } });
        });
        return id;
      },

      /** Returns false when the text was not sent (empty or caught by the filter). */
      async send(threadId: string, text: string, onTyping?: (on: boolean) => void): Promise<boolean> {
        const body = text.trim();
        if (!body) return false;
        if (hasBannedTerm(body)) {
          toast(filterMessage);
          return false;
        }
        haptic("tap");
        const tempId = `tmp-${crypto.randomUUID()}`;
        dispatch({ type: "send", threadId, message: { id: tempId, from: "me", text: body, at: Date.now() } });
        if (!isLive) {
          const thread = ref.current.threads.find((t) => t.id === threadId);
          const other = thread && findPerson(ref.current, thread.withId);
          window.setTimeout(() => onTyping?.(true), 500);
          window.setTimeout(() => {
            onTyping?.(false);
            dispatch({ type: "send", threadId, message: { id: crypto.randomUUID(), from: thread?.withId ?? "", text: demoReply(body, other?.g ?? "x"), at: Date.now() } });
            dispatch({ type: "read", threadId });
          }, 1900);
          return true;
        }
        return guard(async () => dispatch({ type: "replaceMessage", threadId, tempId, message: await live.sendMessage(threadId, body, me) }));
      },

      async setPlan(threadId: string, plan: Thread["plan"]) {
        dispatch({ type: "setPlan", threadId, plan });
        if (isLive) await guard(() => live.savePlan(threadId, plan));
      },

      async markRead(threadId: string) {
        dispatch({ type: "read", threadId });
        if (isLive) await live.markRead(threadId, me).catch(console.error);
      },

      async toggleFreeDay(offset: number) {
        const f = ref.current.me.freeDays;
        const freeDays = f.includes(offset) ? f.filter((d) => d !== offset) : [...f, offset];
        dispatch({ type: "setMe", me: { freeDays } });
        if (isLive) await guard(() => live.saveFreeDays(me, freeDays));
      },

      async saveEmergency(name: string, phone: string) {
        dispatch({ type: "setMe", me: { emergencyContact: phone, emergencyName: name } });
        return isLive ? guard(() => live.saveEmergency(me, name, phone)) : true;
      },

      /** Sets or moves my return time for a hike. */
      async scheduleCheckin(postId: string, returnBy: number): Promise<boolean> {
        const prev = myCheckin(ref.current, postId);
        const local: Checkin = { id: prev?.id ?? `local-${postId}`, postId, userId: "me", returnBy, status: "scheduled", wasAlerted: false };
        dispatch({ type: "upsertCheckin", checkin: local });
        if (!isLive) return true;
        const ok = await guard(async () => dispatch({ type: "upsertCheckin", checkin: await live.scheduleCheckin(postId, returnBy, me) }));
        if (!ok) dispatch({ type: "upsertCheckin", checkin: prev ?? { ...local, status: "cancelled" } });
        return ok;
      },

      async extendCheckin(postId: string, minutes: number) {
        const c = myCheckin(ref.current, postId);
        if (!c) return false;
        return api.scheduleCheckin(postId, Math.max(c.returnBy, Date.now()) + minutes * 60_000);
      },

      async setCheckinStatus(postId: string, status: "returned" | "cancelled") {
        const prev = myCheckin(ref.current, postId);
        if (!prev) return;
        dispatch({
          type: "upsertCheckin",
          checkin: { ...prev, status, returnedAt: status === "returned" ? Date.now() : undefined, wasAlerted: prev.wasAlerted || prev.status === "alerted" },
        });
        if (status === "returned") {
          const name = ref.current.me.emergencyName || "איש הקשר";
          toast(prev.status === "alerted" ? `ברוכים השבים! ${name} יקבל/תקבל עדכון שהכל בסדר.` : "ברוכים השבים! אבן נוספה לגלעד.");
        }
        if (status === "returned") haptic("success");
        if (!isLive) return;
        try {
          dispatch({ type: "upsertCheckin", checkin: await live.setCheckinStatus(postId, status, me) });
        } catch (e) {
          if (!navigator.onLine) {
            writePending([...readPending().filter((x) => x.postId !== postId), { postId, status }]);
            toast("אין קליטה. נסמן ״חזרתי״ ברגע שהקליטה תחזור, גם אם האפליקציה סגורה ונפתחת שוב.");
          } else {
            console.error(e);
            toast(friendlyError(e));
            dispatch({ type: "upsertCheckin", checkin: prev });
          }
        }
      },

      async saveProfile(input: live.ProfileInput) {
        if (hasBannedTerm(`${input.name ?? ""} ${input.bio ?? ""} ${input.city ?? ""}`)) {
          toast(filterMessage);
          return false;
        }
        dispatch({
          type: "setMe",
          me: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.city !== undefined && { city: input.city }),
            ...(input.pace !== undefined && { pace: input.pace }),
            ...(input.level !== undefined && { level: input.level }),
          },
        });
        if (!isLive) return true;
        const ok = await guard(() => live.saveProfile(me, input));
        if (ok) dispatch({ type: "session", session: { ...ref.current.session, needsProfile: false } });
        return ok;
      },

      async signOut() {
        if (isLive) await live.signOut();
      },

      async block(userId: string) {
        const person = findPerson(ref.current, userId);
        if (isLive && !(await guard(() => live.block(userId)))) return false;
        haptic("warning");
        dispatch({ type: "block", userId, name: person?.name ?? "" });
        toast(`${person ? first(person.name) : "המשתמש/ת"} ${person?.g === "f" ? "חסומה" : "חסום"}. לא תראו יותר זה את זה בגלעד.`);
        return true;
      },

      async unblock(userId: string) {
        if (!isLive) {
          dispatch({ type: "unblock", userId });
          const s = ref.current;
          dispatch({
            type: "hydrate",
            data: {
              people: [...s.people, ...seedPeople.filter((p) => p.id === userId)],
              posts: [...s.posts, ...seedPosts.filter((p) => p.authorId === userId)],
              threads: [...s.threads, ...seedThreads.filter((t) => t.withId === userId)],
            },
          });
          return;
        }
        if (!(await guard(() => live.unblock(userId, me)))) return;
        dispatch({ type: "unblock", userId });
        dispatch({ type: "hydrate", data: await live.loadEverything(me) });
      },

      async report(r: { targetId: string; postId?: string; messageId?: string; reason: live.ReportReason; details: string; snapshot: string }) {
        const ok = isLive ? await guard(() => live.report(r)) : true;
        if (ok) toast("תודה. הדיווח התקבל ונבדק תוך 24 שעות.");
        return ok;
      },

      async deleteAccount() {
        if (!isLive) {
          try {
            localStorage.removeItem("galed:v2");
          } catch {
            /* ignore */
          }
          dispatch({ type: "reset", onboarded: false });
          toast("החשבון נמחק. בהדגמה זה מאפס את הנתונים.");
          return true;
        }
        const ok = await guard(() => live.deleteMyAccount());
        if (ok) toast("החשבון וכל הנתונים שלך נמחקו.");
        return ok;
      },
    };
    return api;
  }, [dispatch, toast, guard, me]);
}

/** Live mode only: follows the sign-in state, loads data, and listens for changes. */
export function useLiveSync() {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  const ref = useRef(state);
  ref.current = state;
  const userId = state.session.userId;

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    const enter = async (id: string | null, email?: string) => {
      if (!id) {
        dispatch({ type: "session", session: { status: "out", needsProfile: false } });
        return;
      }
      try {
        const [mine, all, blocked] = await Promise.all([live.loadMe(id), live.loadEverything(id), live.loadBlocked()]);
        if (cancelled) return;
        dispatch({ type: "hydrate", data: { me: mine.me, ...all, blocked } });
        dispatch({ type: "session", session: { status: "in", needsProfile: mine.needsProfile, userId: id, email } });
      } catch (e) {
        console.error(e);
        toast("לא הצלחנו לטעון את הנתונים. נסו לרענן.");
      }
    };
    void live.currentUser().then((u) => enter(u?.id ?? null, u?.email));
    const { data } = live.onAuthChange((id, email) => {
      if (id !== ref.current.session.userId) void enter(id, email);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [dispatch, toast]);

  useEffect(() => {
    if (!isLive || !userId) return;
    const flush = async () => {
      for (const p of readPending()) {
        try {
          dispatch({ type: "upsertCheckin", checkin: await live.setCheckinStatus(p.postId, p.status, userId) });
          writePending(readPending().filter((x) => x.postId !== p.postId));
          if (p.status === "returned") toast("הקליטה חזרה: סימנו ״חזרתי״.");
        } catch (e) {
          console.error(e);
        }
      }
    };
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [userId, dispatch, toast]);

  useEffect(() => {
    if (!isLive || !userId) return;
    return live.subscribe(async (e) => {
      const s = ref.current;
      if (e.kind === "message") {
        if (s.threads.some((t) => t.id === e.threadId)) dispatch({ type: "send", threadId: e.threadId, message: live.toMessage(e.row, userId) });
        else dispatch({ type: "hydrate", data: { threads: await live.loadThreads(userId) } });
      } else if (e.kind === "request") {
        const r = live.toRequest(e.row, userId);
        dispatch({ type: "upsertRequest", request: r });
        const post = s.posts.find((p) => p.id === r.postId);
        const person = findPerson(s, r.userId);
        if (post?.authorId === "me" && r.status === "pending" && person)
          toast(`${first(person.name)} ${person.g === "f" ? "ביקשה" : "ביקש"} להצטרף ל${trailById(post.trailId).name}`);
        if (r.userId === "me" && r.status === "accepted") toast("הבקשה שלך אושרה. אבן נוספה לגלעד.");
      } else if (e.kind === "checkin") {
        const c = live.toCheckin(e.row, userId);
        const before = s.checkins.find((x) => x.id === c.id);
        dispatch({ type: "upsertCheckin", checkin: c });
        const person = findPerson(s, c.userId);
        if (person && c.status === "returned" && before?.status !== "returned")
          toast(`${first(person.name)} ${person.g === "f" ? "חזרה" : "חזר"} מהמסלול בשלום`);
        if (c.userId === "me" && c.status === "alerted" && before?.status !== "alerted")
          toast(`עברה שעת החזרה. נשלחה הודעה ל${s.me.emergencyName || "איש הקשר שלך"}.`);
      } else if (e.kind === "plan") {
        dispatch({ type: "setPlan", threadId: e.threadId, plan: e.plan });
      } else {
        const all = await live.loadEverything(userId);
        dispatch({ type: "hydrate", data: { people: all.people, posts: all.posts, requests: all.requests } });
      }
    });
  }, [userId, dispatch, toast]);
}

/** Demo mode only: plays the alert job, so an overdue check-in turns "alerted" after the grace period. */
export function useDemoAlertJob() {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  const ref = useRef(state);
  ref.current = state;
  useEffect(() => {
    if (isLive) return;
    const tick = () => {
      for (const c of ref.current.checkins) {
        if (c.userId === "me" && c.status === "scheduled" && Date.now() > c.returnBy + GRACE_MIN * 60_000) {
          dispatch({ type: "upsertCheckin", checkin: { ...c, status: "alerted", wasAlerted: true } });
          const who = ref.current.me.emergencyName || "איש הקשר";
          toast(`עברה שעת החזרה (${clock(c.returnBy)}). בגרסה האמיתית ${who} מקבל/ת עכשיו SMS.`);
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [dispatch, toast]);
}
