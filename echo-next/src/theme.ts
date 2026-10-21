/** The style bible as numbers. Every colour in the app comes from here. */
export const C = {
  ink: 0x130e1b,
  night: 0x1e1729,
  wall: 0x3c3052,
  wallLight: 0x6e5d8c,
  plate: 0x2a2140,
  plateLight: 0x4d4068,
  lilac: 0xa99ac6,
  cream: 0xf7f2ff,
  orange: 0xff8a3d,
  orangeLight: 0xffb86b,
  orangeDark: 0xb85a1c,
  mint: 0x7ef0c6,
  mintDark: 0x2f9c78,
  violet: 0xc08cff,
  violetDark: 0x6e49a8,
  coral: 0xff5c7a,
  gold: 0xffcf5a,
  goldLight: 0xffe39a,
  goldDark: 0xb8842a,
  metal: 0x9a93a8,
  metalDark: 0x5d5669,
} as const;

/** Design resolution. Everything is laid out in these units and scaled to fit. */
export const W = 1080;
export const H = 1920;

export const FONT_DISPLAY = "Fredoka, Heebo, Arial Rounded MT Bold, sans-serif";
export const FONT_BODY = "Nunito, Heebo, system-ui, sans-serif";

export const EASE = {
  pop: "back.out(1.6)",
  move: "power3.out",
  reward: "elastic.out(1, .5)",
} as const;
