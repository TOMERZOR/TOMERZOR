// The creator's settings and the simulator's conversations, kept in this
// browser. Everything is also exportable, and can be pushed to the Koli server.

import { normalizeState, defaultState } from "../core/defaults.js";
import { demoState } from "./demo.js";

const KEYS = { state: "koli.state", sims: "koli.sims", settings: "koli.settings", demo: "koli.demo" };

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const listeners = new Set();

export const store = {
  state: null,
  sims: [],
  settings: { apiBase: "", token: "" },
  isDemo: false,

  load() {
    const saved = read(KEYS.state);
    if (saved) {
      this.state = normalizeState(saved);
      this.isDemo = Boolean(read(KEYS.demo));
    } else {
      // First visit: open on a working example rather than an empty form.
      this.state = normalizeState(demoState());
      this.isDemo = true;
    }
    this.sims = read(KEYS.sims) || [];
    this.settings = { ...this.settings, ...(read(KEYS.settings) || {}) };
  },

  /** Change the state through `fn(state)` and save it. */
  update(fn) {
    fn(this.state);
    this.state = normalizeState(this.state);
    if (!write(KEYS.state, this.state)) this.warnFull?.();
    write(KEYS.demo, this.isDemo);
    for (const l of listeners) l();
  },

  saveSims() {
    write(KEYS.sims, this.sims.slice(0, 40));
  },

  saveSettings() {
    write(KEYS.settings, this.settings);
  },

  startFresh() {
    this.isDemo = false;
    this.sims = [];
    this.saveSims();
    this.update((s) => Object.assign(s, defaultState()));
  },

  loadDemo() {
    this.isDemo = true;
    this.sims = [];
    this.saveSims();
    this.update((s) => Object.assign(s, normalizeState(demoState())));
  },

  replace(state) {
    this.isDemo = false;
    this.update((s) => Object.assign(s, normalizeState(state)));
  },

  onChange(fn) {
    listeners.add(fn);
  },
};

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9);
}
