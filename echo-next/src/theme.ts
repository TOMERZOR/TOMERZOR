/**
 * The Sanctuary look: dark glass over a bright world. White marble, cyan light,
 * warm gold. Every colour in the app comes from here.
 */
export const C = {
  ink: 0x0b0f16,        // deepest background
  night: 0x121823,      // glass panel base
  wall: 0x1a2130,       // raised panel
  wallLight: 0x2a3447,  // ghost button
  plate: 0x151b26,      // sunken slot
  plateLight: 0x22304a,
  lilac: 0x9fb0c8,      // secondary text (cool grey)
  cream: 0xf4f7fb,      // primary text
  orange: 0xf5c76a,     // gold accent (kept name for callers)
  orangeLight: 0xffe3a3,
  orangeDark: 0xb98a2e,
  mint: 0x49d7ff,       // cyan light (kept name for callers)
  mintDark: 0x1d8fb3,
  violet: 0x7fb8ff,     // soft blue (secondary accent)
  violetDark: 0x3a6fb5,
  coral: 0xff6b5a,      // danger
  gold: 0xf5c76a,
  goldLight: 0xffe3a3,
  goldDark: 0xb98a2e,
  metal: 0x3a4456,
  metalDark: 0x1c2330,
  glass: 0x0e141d,
  line: 0x49d7ff,
} as const;

/** Design resolution. Everything is laid out in these units and scaled to fit. */
export const W = 1080;
export const H = 1920;

export const FONT_DISPLAY = "Rajdhani, Heebo, system-ui, sans-serif";
export const FONT_LOGO = "Michroma, Rajdhani, sans-serif";
export const FONT_BODY = "Inter, Heebo, system-ui, sans-serif";

export const EASE = {
  pop: "back.out(1.6)",
  move: "power3.out",
  reward: "elastic.out(1, .5)",
} as const;
