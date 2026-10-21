/** Hand-written types for ../../echo/logic.js, which stays plain JavaScript so the server can share it. */
export interface Drone { x: number; y: number; dx: number; dy: number; n: number; phase: number; px: number; py: number }
export interface Level { id: string; world: number; par: number; map: string[]; drones?: Omit<Drone, "px" | "py">[]; mirror?: boolean }
export interface Actor { x: number; y: number; dir: number; moved: boolean; alive: boolean; done: boolean; hero: boolean; log: string }
export interface Coin { x: number; y: number; taken: boolean }
export type Ev = { t: "plate"; k: string } | { t: "open" | "close"; k: string } | { t: "coin"; x: number; y: number; hero: boolean } | { t: "dead"; x: number; y: number } | { t: "exit"; x: number; y: number };
export interface Run {
  level: Level; tick: number; actors: Actor[]; coins: Coin[]; taken: number;
  doors: Record<string, boolean>; plates: Record<string, boolean>; drones: Drone[];
  exit: { x: number; y: number }; events: Ev[]; finished: boolean; exitTick: number; dead: boolean; deadTick: number;
}
export interface Best { echoes: number; ticks: number; coins: number }
export interface Profile {
  pid: string; name: string; coins: number; gems: number; stars: Record<string, number>; best: Record<string, Best>;
  skin: string; skins: string[]; streak: number; lastDay: number; adsDay: number; adsToday: number; passXp: number;
  pass: boolean; noads: boolean; claimedTiers: number; owned: string[]; clears: number; lastReward?: number; lastBonus?: number;
}
export interface Tier { xp: number; coins?: number; gems?: number; skin?: string }
export interface Skin { coins?: number; gems?: number; color: string; sprite: string; tier: number }
export interface Sku { price: string; gems?: number; coins?: number; skin?: string; noads?: boolean; pass?: boolean; once?: boolean }
export interface BoardEntry { pid: string; name: string; echoes: number; ticks: number; coins: number }
export interface View { profile: Profile; daily: { day: number; board: BoardEntry[] } }
export type Result = { ok: true } | { ok: false; error: string };

export interface Logic {
  LOOP_TICKS: number; MAX_ECHOES: number; COLS: number; ROWS: number; DIRS: number[][];
  WORLDS: { id: number; key: string; bg: string; mirror?: boolean }[]; LEVELS: Level[];
  SKINS: Record<string, Skin>; IAP: Record<"starter" | "gems_small" | "gems_big" | "noads" | "pass", Sku>; PASS_TIERS: Tier[]; AD_COINS: number; ADS_PER_DAY: number;
  levelById(id: string): Level | null; dailyLevel(day: number): Level; encodeLevel(l: Level): string; decodeLevel(code: string): Level | null;
  createRun(level: Level, logs: string[]): Run; stepRun(run: Run, dir: number): Run; dronePos(d: Omit<Drone, "px" | "py">, tick: number): { px: number; py: number };
  simulate(level: Level, logs: string[]): { ok: boolean; exitTick: number; coins: number; dead: boolean; echoes: number }; verifyLogs(level: Level, logs: string[]): boolean;
  starsFor(level: Level, echoes: number): number; skinId(id: string): string; newProfile(pid: string): Profile; totalStars(p: Profile): number; worldUnlocked(p: Profile, world: number): boolean;
  setup(players: string[]): unknown; validateAction(s: unknown, pid: string, a: unknown): Result; applyAction(s: unknown, pid: string, a: unknown): unknown; viewFor(s: unknown, pid: string): View;
}
export interface Solutions { SOLUTIONS: Record<string, unknown[]>; logsFor(sol: unknown[]): string[] }
