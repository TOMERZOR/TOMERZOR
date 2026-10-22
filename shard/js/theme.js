// Worlds, palettes and ball skins.
export const WORLDS = [
  { id: 'dawn', name: 'Dawn', sub: 'Glass & shelves', sky: ['#FBF5EE', '#F3D8C6'], floor: '#EAC6AF', floorEdge: '#F6E3D5', ink: '#3E3A4F', ink2: '#5B5670', accent: '#FF7A59', glass: [[150, 205, 255], [255, 190, 200], [190, 175, 255]], glassEdge: 'rgba(55,90,140,0.55)', text: '#3E3A4F', dark: false },
  { id: 'mint', name: 'Mint', sub: 'Stone & timber', sky: ['#EFF7F2', '#C9E4D6'], floor: '#B4D6C5', floorEdge: '#DDEFE5', ink: '#2E4A44', ink2: '#47665F', accent: '#20B486', glass: [[150, 220, 255], [190, 240, 200], [255, 225, 160]], glassEdge: 'rgba(40,95,110,0.55)', text: '#2E4A44', dark: false },
  { id: 'lilac', name: 'Lilac', sub: 'Bounce & bank', sky: ['#F3F0FA', '#D4CAEE'], floor: '#C3B7E6', floorEdge: '#E6E0F6', ink: '#383063', ink2: '#544A86', accent: '#7A5CFF', glass: [[160, 210, 255], [255, 190, 230], [175, 245, 230]], glassEdge: 'rgba(70,60,140,0.55)', text: '#383063', dark: false },
  { id: 'ember', name: 'Ember', sub: 'Things that go boom', sky: ['#FBF1EA', '#F0C2AA'], floor: '#E6AE93', floorEdge: '#F6DACB', ink: '#4A2D2A', ink2: '#6B4540', accent: '#FF4D3D', glass: [[150, 205, 255], [255, 220, 150], [255, 180, 190]], glassEdge: 'rgba(110,55,50,0.5)', text: '#4A2D2A', dark: false },
  { id: 'night', name: 'Night', sub: 'Swing & slide', sky: ['#161B2E', '#2C3657'], floor: '#232A45', floorEdge: '#39436A', ink: '#E7EAF6', ink2: '#B9C0DC', accent: '#78E0FF', glass: [[140, 220, 255], [200, 170, 255], [255, 170, 220]], glassEdge: 'rgba(200,235,255,0.75)', text: '#E7EAF6', dark: true },
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
