// Worlds, palettes and ball skins.
// Each world is a time of day: light is the beam and glow colour, beam its strength,
// motes the ambient particles drifting through it (dust, pollen, embers, starlight).
export const WORLDS = [
  { id: 'dawn', name: 'Dawn', sub: 'Glass & shelves', sky: ['#FFF8F1', '#F4D6C3'], floor: '#E9C2AA', floorEdge: '#F8E6D9', light: [255, 240, 222], beam: 0.95, motes: { n: 16, rgb: [255, 246, 232], rise: 0.02 }, shelf: ['#59546C', '#2C2938'], ink: '#3E3A4F', ink2: '#5B5670', accent: '#FF7A59', glass: [[150, 205, 255], [255, 190, 200], [190, 175, 255]], glassEdge: 'rgba(55,90,140,0.55)', text: '#3E3A4F', dark: false },
  { id: 'mint', name: 'Mint', sub: 'Stone & timber', sky: ['#F2FAF5', '#C5E3D3'], floor: '#AED3C0', floorEdge: '#E0F2E8', light: [248, 255, 240], beam: 0.9, motes: { n: 14, rgb: [250, 255, 240], rise: -0.03 }, shelf: ['#48665F', '#1F3530'], ink: '#2E4A44', ink2: '#47665F', accent: '#20B486', glass: [[150, 220, 255], [190, 240, 200], [255, 225, 160]], glassEdge: 'rgba(40,95,110,0.55)', text: '#2E4A44', dark: false },
  { id: 'lilac', name: 'Lilac', sub: 'Bounce & bank', sky: ['#F6F2FC', '#D2C6EE'], floor: '#BFB2E4', floorEdge: '#E9E3F8', light: [255, 244, 252], beam: 0.85, motes: { n: 16, rgb: [255, 244, 252], rise: 0.01 }, shelf: ['#534A82', '#252047'], ink: '#383063', ink2: '#544A86', accent: '#7A5CFF', glass: [[160, 210, 255], [255, 190, 230], [175, 245, 230]], glassEdge: 'rgba(70,60,140,0.55)', text: '#383063', dark: false },
  { id: 'ember', name: 'Ember', sub: 'Things that go boom', sky: ['#FFEBD3', '#F3AE90'], floor: '#E39A7E', floorEdge: '#F9DAC6', light: [255, 222, 160], beam: 0.95, motes: { n: 18, rgb: [255, 170, 90], rise: 0.35, ember: true }, shelf: ['#68433E', '#33201E'], ink: '#4A2D2A', ink2: '#6B4540', accent: '#FF4D3D', glass: [[150, 205, 255], [255, 220, 150], [255, 180, 190]], glassEdge: 'rgba(110,55,50,0.5)', text: '#4A2D2A', dark: false },
  { id: 'night', name: 'Night', sub: 'Swing & slide', sky: ['#141A2E', '#2B3558'], floor: '#20263F', floorEdge: '#3A456E', light: [160, 196, 255], beam: 0.3, motes: { n: 14, rgb: [190, 215, 255], rise: 0.01 }, shelf: ['#8E98C2', '#4A5378'], ink: '#E7EAF6', ink2: '#B9C0DC', accent: '#78E0FF', glass: [[140, 220, 255], [200, 170, 255], [255, 170, 220]], glassEdge: 'rgba(200,235,255,0.75)', text: '#E7EAF6', dark: true },
];

// base, light, dark, trail
export const SKINS = [
  { id: 'steel', name: 'Steel', price: 0, c: ['#4A4E5A', '#C9CED8', '#1C1E24'], trail: 'rgba(60,64,80,0.18)' },
  { id: 'chalk', name: 'Chalk', price: 300, c: ['#F4F1EC', '#FFFFFF', '#BDB6AA'], trail: 'rgba(255,255,255,0.4)' },
  { id: 'coral', name: 'Coral', price: 500, c: ['#FF6B57', '#FFC2B5', '#B23422'], trail: 'rgba(255,107,87,0.25)' },
  { id: 'jade', name: 'Jade', price: 700, c: ['#1FAF83', '#A7F0D6', '#0B5E45'], trail: 'rgba(31,175,131,0.25)' },
  { id: 'cobalt', name: 'Cobalt', price: 900, c: ['#3D5AFE', '#B3C1FF', '#1A2A99'], trail: 'rgba(61,90,254,0.25)' },
  { id: 'marble', name: 'Marble', price: 1200, c: ['#E9E6EF', '#FFFFFF', '#8E8A99'], trail: 'rgba(200,196,210,0.35)', veins: true },
  { id: 'gold', name: 'Gold', price: 2000, c: ['#E6B53C', '#FFF1B8', '#8E6510'], trail: 'rgba(230,181,60,0.35)', sparkle: true },
  { id: 'obsidian', name: 'Obsidian', price: 2500, c: ['#17151C', '#7B6F99', '#000000'], trail: 'rgba(120,100,170,0.25)' },
  { id: 'moon', name: 'Moon', stars: 60, c: ['#CFD3DC', '#FFFFFF', '#7E8494'], trail: 'rgba(220,225,235,0.35)', craters: true },
  { id: 'sunset', name: 'Sunset', stars: 150, c: ['#FF8A3D', '#FFE3A3', '#C2306A'], trail: 'rgba(255,138,61,0.3)', grad: ['#FFD36E', '#FF7A59', '#C2306A'] },
  { id: 'aurora', name: 'Aurora', iap: 'starter', c: ['#5CF2C8', '#E3FFF6', '#4B4BD6'], trail: 'rgba(92,242,200,0.35)', grad: ['#5CF2C8', '#5B8CFF', '#B45CFF'], sparkle: true },
  { id: 'prism', name: 'Prism', iap: 'prism', c: ['#FFFFFF', '#FFFFFF', '#9BA6FF'], trail: 'rgba(255,255,255,0.5)', prism: true, sparkle: true },
];
