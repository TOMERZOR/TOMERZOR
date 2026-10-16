import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import { posts as seedPosts, threads as seedThreads, type Post, type Thread, type Message } from "./data/seed";
import type { Me } from "./lib";

export interface State {
  onboarded: boolean;
  me: Me;
  posts: Post[];
  threads: Thread[];
  requested: string[];
  saved: string[];
  theme: "day" | "night";
}

type Action =
  | { type: "onboard" }
  | { type: "publish"; post: Post }
  | { type: "request"; postId: string }
  | { type: "toggleSave"; postId: string }
  | { type: "send"; threadId: string; message: Message }
  | { type: "openThread"; thread: Thread }
  | { type: "read"; threadId: string }
  | { type: "toggleGear"; threadId: string; index: number }
  | { type: "toggleShare"; threadId: string }
  | { type: "toggleFreeDay"; offset: number }
  | { type: "setTheme"; theme: State["theme"] }
  | { type: "reset" };

const KEY = "galed:v1";

const initial: State = {
  onboarded: false,
  me: {
    name: "תומר",
    city: "תל אביב",
    pace: 4.5,
    level: "קשה",
    hikes: 14,
    emergencyContact: "",
    freeDays: [1, 2, 8, 9, 15],
  },
  posts: seedPosts,
  threads: seedThreads,
  requested: [],
  saved: ["p3"],
  theme: "day",
};

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initial, ...JSON.parse(raw) };
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
    case "publish":
      return { ...s, posts: [a.post, ...s.posts] };
    case "request":
      return s.requested.includes(a.postId) ? s : { ...s, requested: [...s.requested, a.postId] };
    case "toggleSave":
      return {
        ...s,
        saved: s.saved.includes(a.postId) ? s.saved.filter((x) => x !== a.postId) : [...s.saved, a.postId],
      };
    case "send":
      return mapThread(s, a.threadId, (t) => ({ ...t, messages: [...t.messages, a.message] }));
    case "openThread":
      return s.threads.some((t) => t.id === a.thread.id) ? s : { ...s, threads: [a.thread, ...s.threads] };
    case "read":
      return mapThread(s, a.threadId, (t) => ({ ...t, unread: 0 }));
    case "toggleGear":
      return mapThread(s, a.threadId, (t) => ({
        ...t,
        plan: { ...t.plan, gear: t.plan.gear.map((g, i) => (i === a.index ? { ...g, done: !g.done } : g)) },
      }));
    case "toggleShare":
      return mapThread(s, a.threadId, (t) => ({
        ...t,
        plan: { ...t.plan, shareWithEmergency: !t.plan.shareWithEmergency },
      }));
    case "toggleFreeDay": {
      const f = s.me.freeDays;
      return {
        ...s,
        me: { ...s.me, freeDays: f.includes(a.offset) ? f.filter((d) => d !== a.offset) : [...f, a.offset] },
      };
    }
    case "setTheme":
      return { ...s, theme: a.theme };
    case "reset":
      return { ...initial, onboarded: true };
  }
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
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
