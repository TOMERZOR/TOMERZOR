/**
 * Player state. The same rules as the server (`logic.js`) run locally
 * against localStorage, and the socket, when reachable, mirrors them.
 */
import * as LJ from "../../echo/logic.js";
import * as SJ from "../../echo/solutions.js";
import type { Logic, Profile, Solutions, View, Result } from "./logic-types";

const L = LJ as unknown as Logic;
export const S = SJ as unknown as Solutions;

const KEY = "echo2:";
const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(KEY + k); return v === null ? d : (JSON.parse(v) as T); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

function playerId() {
  let id = store.get<string | null>("pid", null);
  if (!id) { id = Math.random().toString(36).slice(2, 10); store.set("pid", id); }
  return id;
}

export const today = () => Math.floor(Date.now() / 86400000);

class Room {
  state: unknown;
  constructor(public name: string, public onView: (view: View) => void) {
    this.state = store.get<unknown>("room:" + name, null) || L.setup([state.pid]);
    this.onView(L.viewFor(this.state, state.pid));
  }
  act(action: Record<string, unknown>): Result {
    const v = L.validateAction(this.state, state.pid, action);
    if (!v.ok) return v;
    this.state = L.applyAction(this.state, state.pid, action);
    store.set("room:" + this.name, this.state);
    this.onView(L.viewFor(this.state, state.pid));
    return v;
  }
}

type Opts = { music: boolean; sfx: boolean; haptics: boolean; assist: boolean; lang: string };
export const state = {
  pid: "",
  profile: null as unknown as Profile,
  daily: { day: 0, board: [] } as View["daily"],
  opts: Object.assign({ music: true, sfx: true, haptics: true, assist: true, lang: "en" }, store.get("opts", {})) as Opts,
  save: null as unknown as Room,
  dailyRoom: null as unknown as Room,
  listeners: new Set<() => void>(),
  async load() {
    this.pid = playerId();
    this.save = new Room("p-" + this.pid, (v) => { this.profile = v.profile; this.emit(); });
    this.dailyRoom = new Room("daily", (v) => { this.daily = v.daily; this.emit(); });
    // Streak and daily bonus, once per calendar day.
    this.save.act({ t: "day", day: today() });
  },
  act(action: Record<string, unknown>) { return this.save.act(action); },
  setOpts(patch: Partial<Opts>) { Object.assign(this.opts, patch); store.set("opts", this.opts); this.emit(); },
  on(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { for (const fn of this.listeners) fn(); },
  skin() { return L.skinId(this.profile.skin); },
  nextLevel() { return L.LEVELS.find((l) => !this.profile.stars[l.id] && L.worldUnlocked(this.profile, l.world)) ?? null; },
};
export { L };
