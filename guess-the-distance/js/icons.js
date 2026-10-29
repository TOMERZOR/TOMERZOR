// SF Symbols-style line icons, drawn on a 24px grid.

const P = {
  car: '<path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11"/><rect x="3" y="11" width="18" height="6" rx="2"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  foot: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2.5-6 2.5 2.5V21"/><path d="M8 12.5l2.5-4.5 3.5 1.5 2 3.5"/><path d="M10.5 8l-1 5.5 3 1.5"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l3.5 7H6M14 6h2.5"/>',
  flight: '<path d="M21 15.5v-1.8l-7.5-4.6V4.5a1.5 1.5 0 0 0-3 0v4.6L3 13.7v1.8l7.5-2.3v4.6l-2 1.5v1.4l3.5-1 3.5 1v-1.4l-2-1.5v-4.6z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M8 5.5v13l10-6.5z" fill="currentColor"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  swords: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  flame: '<path d="M12 21c-3.9 0-7-2.7-7-6.5 0-3.4 2.4-5.6 4-7.5.4 2 1.5 3.3 2.8 3.8C12 7.5 13 5 15.5 3c-.3 3 3.5 6 3.5 11.5 0 3.8-3.1 6.5-7 6.5z"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M10 2.5h4M18.5 6.5l1.5-1.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  share: '<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M6 11H5a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 5 21h14a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 19 11h-1"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  vibrate: '<rect x="7.5" y="3.5" width="9" height="17" rx="2"/><path d="M4 8v8M20 8v8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
  server: '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>',
  robot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/><circle cx="12" cy="3.5" r="1"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  door: '<path d="M14 4h4.5v16H14M10 8l-4 4 4 4M6 12h10"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
};

export function icon(name, cls = "") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}

export const MODE_COLORS = {
  car: ["#00b4ff", "#2346ff", "#7a2bff"],
  foot: ["#34e0a1", "#00a3ff", "#3a5bff"],
  bike: ["#ffd23f", "#ff9500", "#ff2d87"],
  flight: ["#7cc6ff", "#5b6bff", "#c04bff"],
};

export const MODE_EMOJI = { car: "🚗", foot: "🚶", bike: "🚲", flight: "✈️" };
