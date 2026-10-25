// Game tuning and content tables. Player-facing text lives in i18n.js.
import { T } from './i18n.js';

export const LANE_X = [-2.4, 0, 2.4];
export const LANE_W = 2.4;

export const SPEED = {
  start: 13,
  max: 34,
  rampDist: 3200, // meters to reach ~63% of the way from start to max
};

export const PHYS = {
  gravity: 46,
  jumpHeight: 2.25,
  superJumpHeight: 4.4,
  rollTime: 0.62,
  laneTime: 0.16,
  fastFall: 34,
};

export const PLAYER_BOX = { halfW: 0.34, halfD: 0.3, height: 1.6, rollHeight: 0.85 };

// Playable characters. `model` is loaded lazily; all of them share models/anims.glb.
export const CHARACTERS = [
  { id: 'tzabar', price: 0, model: 'models/ch_tzabar.glb', color: '#3fa7a0' },
  { id: 'student', price: 15000, model: 'models/ch_student.glb', color: '#e2a93b' },
  { id: 'chef', price: 30000, model: 'models/ch_chef.glb', color: '#e0e6ea' },
  { id: 'savta', price: 50000, model: 'models/ch_savta.glb', color: '#7b3fa0' },
  { id: 'soldier', price: 75000, model: 'models/ch_soldier.glb', color: '#6b7b3a' },
  { id: 'tourist', price: 100000, model: 'models/ch_tourist.glb', color: '#f06b4f' },
  { id: 'ars', price: 150000, model: 'models/ch_ars.glb', color: '#d6b03c' },
  { id: 'dj', price: 220000, model: 'models/ch_dj.glb', color: '#9be12b' },
  { id: 'cat', price: 350000, model: 'models/ch_cat.glb', color: '#f08a24' },
];
for (const c of CHARACTERS) [c.name, c.title, c.bio] = T.chars[c.id];

// Obstacle people and objects. kind: wall (dodge), low (jump), high (roll), platform (climb on top).
// speed: walking speed toward the player in m/s.
export const NPC_TYPES = {
  grandpa:  { model: 'models/npc_grandpa.glb',  kind: 'wall', w: 0.95, d: 1.0, h: 1.7, speed: 1.3, bob: 'shuffle' },
  moroccan: { model: 'models/npc_moroccan.glb', kind: 'wall', w: 1.0, d: 0.7, h: 1.6, speed: 0.9, rig: 'walk' },
  breslov:  { model: 'models/npc_breslov.glb',  kind: 'wall', w: 1.0, d: 0.6, h: 1.8, speed: 0, rig: 'dance' },
  chabad:   { model: 'models/npc_chabad.glb',   kind: 'wall', w: 0.8, d: 0.8, h: 1.8, speed: 0, bob: 'sway' },
  vendor:   { model: 'models/npc_vendor.glb',   kind: 'wall', w: 1.1, d: 0.7, h: 1.8, speed: 0, bob: 'shout' },
  jack:     { model: 'models/npc_jack.glb',     kind: 'wall', w: 1.4, d: 1.9, h: 1.9, speed: 2.4, bob: 'push' },
  scooter:  { model: 'models/npc_scooter.glb',  kind: 'wall', w: 0.9, d: 1.7, h: 1.7, speed: 7.5, bob: 'ride' },
};

for (const [k, n] of Object.entries(NPC_TYPES)) n.say = T.say[k];
// Playable characters double as walking pedestrians (when not the one being played).
export const PEDESTRIAN_SAY = T.say.ped;

export const POWERUPS = {
  magnet:   { base: 9, step: 2.5, color: '#e63946' },
  x2:       { base: 10, step: 2.5, color: '#c47a2c' },
  sneakers: { base: 9, step: 2.5, color: '#2a9df4' },
  hamsa:    { base: 12, step: 3, color: '#1d6fd8' },
  carpet:   { base: 6, step: 1.2, color: '#c0392b' },
};
// height the magic carpet flies at: above every obstacle, under the bunting
export const FLY_Y = 3.2;
// prices are in shekels; every coin you pick up is worth ₪10
for (const [k, p] of Object.entries(POWERUPS)) [p.name, p.desc] = T.powers[k];
export const UPGRADE_COST = [5000, 12000, 25000, 50000, 90000];
export const MAX_UPGRADE = 5;

// Zones change look, obstacle mix and difficulty as the run goes on.
export const ZONES = [
  { id: 'open',    theme: 'day' },
  { id: 'covered', theme: 'covered' },
  { id: 'sunset',  theme: 'sunset' },
  { id: 'night',   theme: 'night' },
];
for (const z of ZONES) [z.name, z.sub] = T.zones[z.id];
export const ZONE_LENGTH = 900;

export const REVIVE_COST = [4000, 9000];
export const LEVEL_REWARD = 5000; // × the level you just finished

// Mission templates. `stat` names a per-run counter tracked by the game.
export const MISSIONS = [
  { stat: 'coins',     base: 120, grow: 1.22, max: 900, single: true },
  { stat: 'dist',      base: 600, grow: 1.18, max: 9000, single: true },
  { stat: 'jumps',     base: 25, grow: 1.22, max: 400 },
  { stat: 'rolls',     base: 20, grow: 1.22, max: 350 },
  { stat: 'score',     base: 5000, grow: 1.3, max: 400000, single: true },
  { stat: 'powerups',  base: 4, grow: 1.2, max: 40 },
  { stat: 'dodgeNpc',  base: 40, grow: 1.22, max: 600 },
  { stat: 'roofs',     base: 3, grow: 1.22, max: 40 },
  { stat: 'zones',     base: 2, grow: 1.0, single: true, cap: 4 },
  { stat: 'magnetCoins', base: 60, grow: 1.22, max: 800 },
  { stat: 'nearMiss',  base: 10, grow: 1.22, max: 120 },
  { stat: 'runs',      base: 3, grow: 1.15, max: 25 },
];
for (const m of MISSIONS) m.text = T.missionsText[m.stat];
export const MAX_MULT = 30;

export const STORE_KEY = 'shuk-rush-save-v1';
