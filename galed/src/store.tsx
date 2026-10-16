import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import { isLive } from "./backend/config";
import {
  people as seedPeople,
  posts as seedPosts,
  threads as seedThreads,
  type Message,
  type Person,
  type Post,
  type Thread,
} from "./data/seed";
import type { Me } from "./lib";

export type RequestStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface JoinRequest {
  postId: string;
  userId: string; // "me" for my own requests
  status: RequestStatus;
  message: string;
  at: number;
}

export type CheckinStatus = "scheduled" | "returned" | "cancelled" | "alerted";

export interface Checkin {
  id: string;
  postId: string;
  userId: string; // "me" for my own
  returnBy: number; // ms timestamp
  status: CheckinStatus;
  returnedAt?: number;
  wasAlerted?: boolean; // the contact was texted before I marked myself back
}

export interface Session {
  status: "unknown" | "out" | "in";
  needsProfile: boolean;
  userId?: string;
  email?: string;
}

export interface State {
  onboarded: boolean;
  me: Me;
  people: Person[];
  posts: Post[];
  threads: Thread[];
  requests: JoinRequest[];
  checkins: Checkin[];
  saved: string[];
  theme: "day" | "night";
  session: Session;
}

type Action =
  | { type: "onboard" }
  | { type: "hydrate"; data: Partial<Pick<State, "me" | "people" | "posts" | "threads" | "requests" | "checkins">> }
  | { type: "upsertCheckin"; checkin: Checkin }
  | { type: "session"; session: Session }
  | { type: "publish"; post: Post }
  | { type: "replacePost"; tempId: string; post: Post }
  | { type: "upsertRequest"; request: JoinRequest }
  | { type: "toggleSave"; postId: string }
  | { type: "send"; threadId: string; message: Message }
  | { type: "replaceMessage"; threadId: string; tempId: string; message: Message }
  | { type: "openThread"; thread: Thread }
  | { type: "read"; threadId: string }
  | { type: "setPlan"; threadId: string; plan: Thread["plan"] }
  | { type: "setMe"; me: Partial<Me> }
  | { type: "setTheme"; theme: State["theme"] }
  | { type: "reset" };

const KEY = "galed:v2";

export const demoMe: Me = {
  name: "תומר",
  city: "תל אביב",
  pace: 4.5,
  level: "קשה",
  hikes: 14,
  emergencyContact: "",
  emergencyName: "",
  freeDays: [1, 2, 8, 9, 15],
};

const blankMe: Me = { name: "", city: "", pace: 4, level: "בינוני", hikes: 0, emergencyContact: "", emergencyName: "", freeDays: [] };

const initial: State = isLive
  ? {
      onboarded: false,
      me: blankMe,
      people: [],
      posts: [],
      threads: [],
      requests: [],
      checkins: [],
      saved: [],
      theme: "day",
      session: { status: "unknown", needsProfile: false },
    }
  : {
      onboarded: false,
      me: demoMe,
      people: seedPeople,
      posts: seedPosts,
      threads: seedThreads,
      requests: [],
      checkins: [],
      saved: ["p3"],
      theme: "day",
      session: { status: "in", needsProfile: false },
    };

// In live mode the server is the source of truth; only per-device
// preferences are kept in the browser.
const persisted = (s: State) => (isLive ? { onboarded: s.onboarded, theme: s.theme, saved: s.saved } : { ...s, session: undefined });

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...initial, ...saved, me: { ...initial.me, ...saved.me }, checkins: saved.checkins ?? [], session: initial.session };
    }
  } catch {
    /* storage can be unavailable; the app still works in memory */
  }
  return initial;
}

const mapThread = (s: State, id: string, f: (t: Thread) => Thread) => ({
  ...s,
  threads: s.threads.map((t) => (t.id === id ? f(t) : t)),
});

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "onboard":
      return { ...s, onboarded: true };
    case "hydrate":
      return { ...s, ...a.data };
    case "session":
      return { ...s, session: a.session };
    case "publish":
      return { ...s, posts: [a.post, ...s.posts] };
    case "replacePost":
      return { ...s, posts: s.posts.map((p) => (p.id === a.tempId ? a.post : p)) };
    case "upsertRequest": {
      const r = a.request;
      const rest = s.requests.filter((x) => !(x.postId === r.postId && x.userId === r.userId));
      // keep the crew list on the post in step with accepted requests
      const posts = s.posts.map((p) => {
        if (p.id !== r.postId) return p;
        const without = p.joined.filter((id) => id !== r.userId);
        return { ...p, joined: r.status === "accepted" ? [...without, r.userId] : without };
      });
      return { ...s, posts, requests: [...rest, r] };
    }
    case "upsertCheckin": {
      const c = a.checkin;
      const rest = s.checkins.filter((x) => !(x.postId === c.postId && x.userId === c.userId));
      return { ...s, checkins: [...rest, c] };
    }
    case "toggleSave":
      return {
        ...s,
        saved: s.saved.includes(a.postId) ? s.saved.filter((x) => x !== a.postId) : [...s.saved, a.postId],
      };
    case "send":
      return mapThread(s, a.threadId, (t) =>
        t.messages.some((m) => m.id === a.message.id)
          ? t
          : { ...t, messages: [...t.messages, a.message], unread: a.message.from === "me" ? t.unread : t.unread + 1 },
      );
    case "replaceMessage":
      return mapThread(s, a.threadId, (t) => ({
        ...t,
        messages: t.messages.some((m) => m.id === a.message.id)
          ? t.messages.filter((m) => m.id !== a.tempId)
          : t.messages.map((m) => (m.id === a.tempId ? a.message : m)),
      }));
    case "openThread":
      return s.threads.some((t) => t.id === a.thread.id) ? s : { ...s, threads: [a.thread, ...s.threads] };
    case "read":
      return mapThread(s, a.threadId, (t) => ({ ...t, unread: 0 }));
    case "setPlan":
      return mapThread(s, a.threadId, (t) => ({ ...t, plan: a.plan }));
    case "setMe":
      return { ...s, me: { ...s.me, ...a.me } };
    case "setTheme":
      return { ...s, theme: a.theme };
    case "reset":
      return { ...initial, onboarded: true, session: s.session };
  }
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(persisted(state)));
    } catch {
      /* ignore */
    }
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export const useStore = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside provider");
  return c;
};

export const findPerson = (s: State, id: string) => s.people.find((p) => p.id === id);
export const myCheckin = (s: State, postId: string) => s.checkins.find((c) => c.postId === postId && c.userId === "me");
/** The organiser and accepted members, as ids ("me" for me). */
export const crewOf = (s: State, postId: string) => {
  const post = s.posts.find((p) => p.id === postId);
  return post ? [post.authorId, ...post.joined] : [];
};
export const myRequest = (s: State, postId: string) => s.requests.find((r) => r.postId === postId && r.userId === "me");
