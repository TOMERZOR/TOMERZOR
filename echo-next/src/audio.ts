/** Howler-backed audio: one-shot cues with optional pitch, and a looping bed. */
import { Howl, Howler } from "howler";
import { state } from "./state";

const NAMES = ["coin", "win", "star", "step", "plate", "open", "close", "saved", "caught", "out", "tap", "buy", "shimmer", "tick"] as const;
export type Cue = (typeof NAMES)[number];
const cues = new Map<Cue, Howl>();
let music: Howl | null = null;

export const audio = {
  preload() {
    for (const n of NAMES) if (!cues.has(n)) cues.set(n, new Howl({ src: [`assets/sfx_${n}.mp3`], preload: true, volume: 0.9 }));
  },
  play(name: Cue, vol = 0.8, rate = 1) {
    if (!state.opts.sfx) return;
    const h = cues.get(name); if (!h) return;
    const id = h.play(); h.volume(vol, id); h.rate(rate * (0.97 + Math.random() * 0.06), id);
  },
  musicOn(on: boolean) {
    if (!on || !state.opts.music) { music?.fade(music.volume(), 0, 400); setTimeout(() => music?.stop(), 420); return; }
    if (!music) music = new Howl({ src: ["assets/music.mp3"], loop: true, volume: 0 });
    if (!music.playing()) { music.play(); music.fade(0, 0.28, 800); }
  },
  unlock() { try { (Howler.ctx as AudioContext | undefined)?.resume?.(); } catch { /* no ctx yet */ } },
};

export { buzz } from "./haptics";
