// One stroke icon family, 24×24, 1.8 stroke, round joins.
const ICONS = {
  practice: '<path d="M12 3c4.2 0 7 2.2 7 5.6 0 4.6-4.4 9.6-7 12.4-2.6-2.8-7-7.8-7-12.4C5 5.2 7.8 3 12 3Z"/><path d="M10.2 8.6v5.2l4.3-2.6z" fill="currentColor" stroke="none"/>',
  path: '<path d="M5 20c0-3 3-3.5 5.5-4.2S15 14 15 11s-4-3-4-6"/><circle cx="11" cy="4" r="1.6"/><circle cx="5" cy="20" r="1.6"/><path d="M17.5 17.5l2 2M19.5 17.5l-2 2"/>',
  chords: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M5 8h14M5 12.5h14M5 17h14M9.7 3.5v17M14.3 3.5v17"/><circle cx="9.7" cy="10.2" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.3" cy="14.8" r="1.5" fill="currentColor" stroke="none"/>',
  train: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  tools: '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M12 15l3.5-5"/><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none"/><path d="M4 19h16"/>',
  back: '<path d="M9 5l7 7-7 7"/>',
  chevron: '<path d="M15 6l-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  tuner: '<path d="M3.5 16a8.5 8.5 0 0 1 17 0"/><path d="M12 16l-3-6"/><path d="M6 12.5l-1-.8M18 12.5l1-.8M12 7.5V6.3"/>',
  metro: '<path d="M8.5 3.5h7l3.5 17H5z"/><path d="M12 15.5l4.5-8.5"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>',
  jam: '<ellipse cx="12" cy="8" rx="8" ry="3"/><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8"/><path d="M4 12c2 1.5 14 1.5 16 0"/>',
  notes: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/><circle cx="9" cy="10" r="2.2" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="2.2" fill="currentColor" stroke="none"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 3.8-3 7a3 3 0 0 1-5.5 1.6"/><path d="M10 9a2 2 0 0 1 4 0c0 1.2-1 1.6-1.6 2.4"/>',
  scale: '<path d="M4 18l4-4 3 2 4-6 5 3"/><circle cx="4" cy="18" r="1.4" fill="currentColor"/><circle cx="8" cy="14" r="1.4" fill="currentColor"/><circle cx="11" cy="16" r="1.4" fill="currentColor"/><circle cx="15" cy="10" r="1.4" fill="currentColor"/><circle cx="20" cy="13" r="1.4" fill="currentColor"/>',
  speed: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/><circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none"/><path d="M7.5 9.8l.8.8M12 7.2v1.2M16.5 9.8l-.8.8"/>',
  strum: '<path d="M8 4v16M8 20l-3-3M8 20l3-3M16 20V4M16 4l-3 3M16 4l3 3"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.4 3.6-7.6.4 1.6 1.3 2.6 2.4 3 0-2.8 1.2-5.3 3.4-7.2-.2 3.3 3.6 5.6 3.6 10.6C18.5 18.6 15.9 21 12 21Z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  speaker: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.4 6.5-6 6.5-2.6 0-4-1.4-5.4-3.6L4 13.6a1.5 1.5 0 0 1 2.4-1.8L8 13.5"/>',
  loop: '<path d="M17 4l3 3-3 3"/><path d="M4 12V10a3 3 0 0 1 3-3h13M7 20l-3-3 3-3"/><path d="M20 12v2a3 3 0 0 1-3 3H4"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v3.5M8.5 20h7M9.5 20l.7-3.5h3.6l.7 3.5"/>',
  timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M10 3h4"/>',
  tap: '<circle cx="12" cy="9" r="3"/><path d="M12 3v1.5M6.5 9H5M19 9h-1.5M7.8 4.8l1 1M16.2 4.8l-1 1"/><path d="M10.5 13.5V20M13.5 13.5V20"/>',
  shuffle: '<path d="M4 7h3.5c4.5 0 5.5 10 10 10H20M4 17h3.5c1.6 0 2.7-1.2 3.6-2.8M14 9.8C14.8 8.3 15.9 7 17.5 7H20M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5"/>',
};

function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}
