// Categories (how an item is drawn and where it goes) and a starter set of items to try right away.

export const CATEGORIES = {
  sofa:        { he: 'ספה',          icon: 'couch',        mount: 'floor', dims: { w: 220, d: 95, h: 82 },  clearance: 75 },
  armchair:    { he: 'כורסה',        icon: 'armchair',     mount: 'floor', dims: { w: 85, d: 88, h: 90 },   clearance: 60 },
  chair:       { he: 'כיסא',         icon: 'armchair',     mount: 'floor', dims: { w: 48, d: 54, h: 82 },   clearance: 45 },
  'coffee-table': { he: 'שולחן קפה', icon: 'table',        mount: 'floor', dims: { w: 110, d: 60, h: 42 },  clearance: 45 },
  table:       { he: 'שולחן',        icon: 'table',        mount: 'floor', dims: { w: 180, d: 90, h: 75 },  clearance: 90 },
  bed:         { he: 'מיטה',         icon: 'bed',          mount: 'floor', dims: { w: 170, d: 210, h: 105 }, clearance: 60 },
  shelf:       { he: 'ספרייה',       icon: 'books',        mount: 'floor', dims: { w: 80, d: 35, h: 200 },  clearance: 70 },
  cabinet:     { he: 'שידה / מזנון', icon: 'package',      mount: 'floor', dims: { w: 160, d: 42, h: 55 },  clearance: 70 },
  lamp:        { he: 'מנורה',        icon: 'lamp',         mount: 'floor', dims: { w: 40, d: 40, h: 160 },  clearance: 0 },
  plant:       { he: 'צמח',          icon: 'potted-plant', mount: 'floor', dims: { w: 55, d: 55, h: 120 },  clearance: 0 },
  rug:         { he: 'שטיח',         icon: 'rug',          mount: 'floor', dims: { w: 200, d: 290, h: 1 },  clearance: 0 },
  decor:       { he: 'אקססורי',      icon: 'shapes',       mount: 'floor', dims: { w: 25, d: 25, h: 40 },   clearance: 0 },
  art:         { he: 'תמונה / פוסטר', icon: 'picture-in-picture', mount: 'wall', dims: { w: 70, d: 3, h: 100 }, clearance: 0 },
  mirror:      { he: 'מראה',         icon: 'selection',    mount: 'wall',  dims: { w: 80, d: 3, h: 80 },    clearance: 0 },
  tv:          { he: 'טלוויזיה',     icon: 'picture-in-picture', mount: 'wall', dims: { w: 145, d: 6, h: 84 }, clearance: 0 },
  object:      { he: 'אחר',          icon: 'cube',         mount: 'floor', dims: { w: 60, d: 60, h: 60 },   clearance: 0 },
};

export const CATEGORY_ORDER = ['sofa', 'armchair', 'chair', 'coffee-table', 'table', 'bed', 'shelf', 'cabinet', 'lamp', 'plant', 'rug', 'art', 'mirror', 'tv', 'decor', 'object'];

/** Where the centre of a wall item hangs by default, in cm from the floor. */
export const HANG_CENTER = { art: 150, mirror: 150, tv: 120 };

export const SWATCHES = [
  { name: 'גרפיט', hex: '#3E4247' },
  { name: 'אבן', hex: '#A7A39C' },
  { name: 'שמנת', hex: '#E6E1D8' },
  { name: 'מרווה', hex: '#8F9E8B' },
  { name: 'ים', hex: '#5E7C93' },
  { name: 'חרדל', hex: '#C9962E' },
  { name: 'טרקוטה', hex: '#B65E45' },
  { name: 'אגוז', hex: '#6B4A35' },
  { name: 'אלון', hex: '#B48B62' },
  { name: 'שחור', hex: '#1E1F21' },
];

/** Keywords (Hebrew and English) that point to a category, for names typed by hand or read from a page. */
export const CATEGORY_WORDS = [
  ['coffee-table', ['coffee table', 'side table', 'שולחן קפה', 'שולחן סלון', 'שולחן צד', 'שולחן לסלון']],
  ['sofa', ['sofa', 'couch', 'sectional', 'loveseat', 'ספה', 'ספת', 'כורסא זוגית']],
  ['armchair', ['armchair', 'lounge chair', 'accent chair', 'recliner', 'כורסה', 'כורסא', 'ריקליינר']],
  ['chair', ['chair', 'stool', 'כיסא', 'כסא', 'שרפרף', 'כסאות']],
  ['bed', ['bed', 'מיטה', 'מיטת']],
  ['table', ['dining table', 'desk', 'table', 'שולחן', 'שולחן אוכל', 'שולחן עבודה', 'שולחן כתיבה']],
  ['shelf', ['bookcase', 'bookshelf', 'shelf', 'shelving', 'ספרייה', 'ספריה', 'מדף', 'כוורת']],
  ['cabinet', ['sideboard', 'dresser', 'cabinet', 'tv stand', 'tv unit', 'chest', 'wardrobe', 'שידה', 'מזנון', 'ארון', 'קומודה']],
  ['lamp', ['lamp', 'light', 'lighting', 'מנורה', 'מנורת', 'גוף תאורה', 'אהיל']],
  ['plant', ['plant', 'tree', 'monstera', 'ficus', 'צמח', 'עציץ', 'מונסטרה', 'פיקוס']],
  ['rug', ['rug', 'carpet', 'mat', 'שטיח']],
  ['mirror', ['mirror', 'מראה']],
  ['tv', [' tv', 'television', 'oled', 'qled', 'טלוויזיה', 'מסך']],
  ['art', ['poster', 'print', 'painting', 'canvas', 'wall art', 'frame', 'תמונה', 'פוסטר', 'הדפס', 'ציור', 'קנבס', 'מסגרת']],
  ['decor', ['vase', 'candle', 'sculpture', 'decor', 'אגרטל', 'פסל', 'נר', 'קישוט']],
];

export function guessCategory(text = '') {
  const t = ` ${String(text).toLowerCase()} `;
  for (const [cat, words] of CATEGORY_WORDS) if (words.some(w => t.includes(w))) return cat;
  return 'object';
}

/** Ready-made items: drawn by the app (no download), so the first try works offline. */
export const STARTERS = [
  { key: 'sofa-oslo', name: 'ספה תלת-מושבית', category: 'sofa', dims: { w: 222, d: 96, h: 80 }, color: '#5E7C93', price: 4890 },
  { key: 'arm-boucle', name: 'כורסת בוקלה', category: 'armchair', dims: { w: 82, d: 86, h: 78 }, color: '#E6E1D8', price: 1690 },
  { key: 'coffee-round', name: 'שולחן קפה עגול', category: 'coffee-table', dims: { w: 90, d: 90, h: 38 }, color: '#6B4A35', price: 990, shape: 'round' },
  { key: 'lamp-arc', name: 'מנורת עמידה', category: 'lamp', dims: { w: 38, d: 38, h: 158 }, color: '#E6E1D8', price: 420 },
  { key: 'plant-monstera', name: 'מונסטרה בעציץ', category: 'plant', dims: { w: 62, d: 62, h: 125 }, color: '#4F6B4A', price: 260 },
  { key: 'rug-wool', name: 'שטיח צמר', category: 'rug', dims: { w: 200, d: 290, h: 1 }, color: '#A7A39C', price: 1350 },
  { key: 'shelf-oak', name: 'ספריית אלון', category: 'shelf', dims: { w: 80, d: 34, h: 196 }, color: '#B48B62', price: 1190 },
  { key: 'sideboard', name: 'מזנון נמוך', category: 'cabinet', dims: { w: 180, d: 40, h: 52 }, color: '#B48B62', price: 2290 },
  { key: 'bed-linen', name: 'מיטה זוגית מרופדת', category: 'bed', dims: { w: 176, d: 212, h: 108 }, color: '#A7A39C', price: 3990 },
  { key: 'dining-oak', name: 'שולחן אוכל', category: 'table', dims: { w: 180, d: 90, h: 75 }, color: '#B48B62', price: 2790 },
  { key: 'chair-wood', name: 'כיסא עץ', category: 'chair', dims: { w: 47, d: 52, h: 80 }, color: '#6B4A35', price: 390 },
  { key: 'art-abstract', name: 'הדפס מופשט', category: 'art', dims: { w: 70, d: 3, h: 100 }, color: '#B65E45', price: 320 },
  { key: 'mirror-round', name: 'מראה עגולה', category: 'mirror', dims: { w: 80, d: 3, h: 80 }, color: '#C9962E', price: 590, shape: 'round' },
  { key: 'tv-65', name: 'טלוויזיה 65 אינץ׳', category: 'tv', dims: { w: 145, d: 3, h: 83 }, color: '#1E1F21', price: 4200 },
];

export function starterToItem(s) {
  return {
    id: `starter_${s.key}`,
    starter: true,
    name: s.name,
    category: s.category,
    dims: { ...s.dims },
    color: s.color,
    shape: s.shape || null,
    model: { kind: 'shape' },
    source: { price: s.price, currency: 'ILS' },
    createdAt: 0,
  };
}
