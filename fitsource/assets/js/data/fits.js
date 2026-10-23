// The feed. Sample content: the people in these photos and the brands below
// are invented (photos are AI-generated), except "Created By God", which is a
// real Dream Studios fit linking to the real store. Replace or extend with real
// creator posts: each item needs a product URL for the Shop button to go
// straight to the shop; without one it opens a search for similar pieces.
//
// x / y place the item's dot on the photo, in percent from the top left.
// status: in_stock | low_stock | sold_out | preorder

const S = (list, out = []) => list.map((s) => ({ s, ok: !out.includes(s) }));
const LETTERS = ["XS", "S", "M", "L", "XL"];

export const FITS = [
  {
    id: "created-by-god",
    title: "Created By God",
    handle: "dreamstudios",
    verified: true,
    vibe: "Streetwear",
    img: "created-by-god",
    likes: 18420,
    scans: 2310,
    posted: "2d",
    real: true,
    items: [
      { id: "ds-tee", name: "Circle Logo Tee Navy", brand: "Dream Studios", shop: "Dream Studios", price: 189, currency: "ILS", status: "in_stock", category: "top", color: "washed navy", img: "ds-circle-tee", x: 58, y: 25, sizes: S(["XS", "S", "M", "L", "XL", "XXL"]), url: "../product.html#circle-logo-tee", query: "navy oversized logo t-shirt" },
      { id: "ds-shorts", name: "Created By God Denim Shorts", brand: "Dream Studios", shop: "Dream Studios", price: 349, currency: "ILS", status: "low_stock", category: "bottom", color: "vintage wash", img: "ds-cbg-shorts", x: 55, y: 56, sizes: S(["28", "30", "32", "34", "36"], ["28", "34", "36"]), url: "../product.html#created-by-god-shorts", query: "baggy vintage wash denim jorts" },
      { id: "ds-socks", name: "Ribbed crew socks", brand: null, shop: null, price: null, currency: "ILS", status: "in_stock", category: "accessory", color: "white", img: "ds-socks", x: 37, y: 79, sizes: [], url: null, query: "white ribbed crew socks" },
      { id: "ds-shoes", name: "Leather derby shoes", brand: null, shop: null, price: null, currency: "ILS", status: "in_stock", category: "footwear", color: "black", img: "ds-shoes", x: 40, y: 89, sizes: [], url: null, query: "black leather derby shoes chunky sole" },
    ],
  },
  {
    id: "night-shift",
    title: "Night Shift",
    handle: "mei.wears",
    vibe: "Streetwear",
    img: "night-shift",
    likes: 41200,
    scans: 6120,
    posted: "5h",
    items: [
      { id: "ns-1", name: "Cropped Leather Bomber", brand: "Halden", shop: "Halden", price: 289, currency: "USD", status: "sold_out", category: "outerwear", color: "black", img: "p101", x: 24, y: 22, sizes: S(LETTERS, LETTERS), resale: 190, query: "cropped black leather bomber jacket" },
      { id: "ns-2", name: "Rib Tank", brand: "Mono Rib", shop: "Mono Rib", price: 24, currency: "USD", status: "in_stock", category: "top", color: "white", img: "p102", x: 50, y: 28, sizes: S(LETTERS), query: "white ribbed tank top" },
      { id: "ns-3", name: "Arc Baggy Jean", brand: "Kiyo Denim", shop: "Kiyo Denim", price: 98, currency: "USD", status: "low_stock", category: "bottom", color: "light wash", img: "p103", x: 44, y: 62, sizes: S(["24", "25", "26", "27", "28", "30"], ["24", "25", "27", "28"]), query: "light wash baggy wide leg jeans" },
      { id: "ns-4", name: "V-90 Chunk Runner", brand: "Volta", shop: "Volta", price: 135, currency: "USD", status: "in_stock", category: "footwear", color: "white", img: "p104", x: 50, y: 95, sizes: S(["36", "37", "38", "39", "40", "41"]), query: "chunky white sneakers" },
    ],
  },
  {
    id: "trail-mix",
    title: "Trail Mix",
    handle: "kofi.outside",
    vibe: "Gorpcore",
    img: "trail-mix",
    likes: 22870,
    scans: 3410,
    posted: "1d",
    items: [
      { id: "tm-1", name: "Ridge 3L Shell", brand: "Northpine", shop: "Northpine", price: 340, currency: "USD", status: "in_stock", category: "outerwear", color: "olive", img: "p201", x: 27, y: 38, sizes: S(["S", "M", "L", "XL"]), query: "olive green waterproof shell jacket" },
      { id: "tm-2", name: "Trail Cargo Pant", brand: "Northpine", shop: "Northpine", price: 120, currency: "USD", status: "sold_out", category: "bottom", color: "stone", img: "p202", x: 44, y: 68, sizes: S(["S", "M", "L", "XL"], ["S", "M", "L", "XL"]), resale: 85, query: "beige nylon cargo pants cuffed" },
      { id: "tm-3", name: "Skree Trail Runner", brand: "Ascend Lab", shop: "Ascend Lab", price: 165, currency: "USD", status: "low_stock", category: "footwear", color: "grey / orange", img: "p203", x: 46, y: 92, sizes: S(["41", "42", "43", "44", "45"], ["41", "44", "45"]), query: "grey orange trail running shoes" },
      { id: "tm-4", name: "Mini Crossbody 3L", brand: "Fieldsack", shop: "Fieldsack", price: 48, currency: "USD", status: "in_stock", category: "bag", color: "black", img: "p204", x: 35, y: 47, sizes: [], query: "small black nylon crossbody bag" },
    ],
  },
  {
    id: "quiet-money",
    title: "Quiet Money",
    handle: "claire.ateliers",
    vibe: "Quiet luxury",
    img: "quiet-money",
    likes: 35640,
    scans: 5280,
    posted: "1d",
    items: [
      { id: "qm-1", name: "Long Double-Breasted Coat", brand: "Maison Arlo", shop: "Maison Arlo", price: 690, currency: "USD", status: "low_stock", category: "outerwear", color: "camel", img: "p301", x: 76, y: 42, sizes: S(LETTERS, ["XS", "M", "XL"]), query: "long camel wool double breasted coat" },
      { id: "qm-2", name: "Cable Crew", brand: "Maison Arlo", shop: "Maison Arlo", price: 260, currency: "USD", status: "in_stock", category: "top", color: "cream", img: "p302", x: 50, y: 20, sizes: S(LETTERS), query: "cream cable knit crewneck sweater" },
      { id: "qm-3", name: "Pleated Wide Trouser", brand: "Atelier Sève", shop: "Atelier Sève", price: 210, currency: "USD", status: "in_stock", category: "bottom", color: "ecru", img: "p303", x: 50, y: 64, sizes: S(["34", "36", "38", "40", "42"]), query: "ecru pleated wide leg trousers" },
      { id: "qm-4", name: "Soft Leather Tote", brand: "Atelier Sève", shop: "Atelier Sève", price: 420, currency: "USD", status: "sold_out", category: "bag", color: "black", img: "p304", x: 32, y: 68, sizes: [], resale: 300, query: "black leather tote bag minimal" },
    ],
  },
  {
    id: "mall-rat",
    title: "Mall Rat",
    handle: "vale.y2k",
    vibe: "Y2K",
    img: "mall-rat",
    likes: 52310,
    scans: 8840,
    posted: "3h",
    items: [
      { id: "mr-1", name: "Baby Tee", brand: "Peachy Club", shop: "Peachy Club", price: 28, currency: "USD", status: "in_stock", category: "top", color: "pink", img: "p401", x: 55, y: 25, sizes: S(LETTERS), query: "pink fitted baby tee" },
      { id: "mr-2", name: "Low Rise Flare", brand: "Peachy Club", shop: "Peachy Club", price: 79, currency: "USD", status: "in_stock", category: "bottom", color: "mid blue", img: "p402", x: 55, y: 66, sizes: S(["24", "25", "26", "27", "28", "29"]), query: "low rise flared jeans mid blue" },
      { id: "mr-3", name: "Silver Baguette", brand: "Glint", shop: "Glint", price: 65, currency: "USD", status: "sold_out", category: "bag", color: "silver", img: "p403", x: 61, y: 32, sizes: [], resale: 48, query: "silver metallic baguette shoulder bag" },
      { id: "mr-4", name: "Oval Shades", brand: "Glint", shop: "Glint", price: 38, currency: "USD", status: "in_stock", category: "eyewear", color: "clear", img: "p404", x: 50, y: 13, sizes: [], query: "oval tinted sunglasses clear frame" },
    ],
  },
  {
    id: "shop-floor",
    title: "Shop Floor",
    handle: "dan.harrow",
    vibe: "Workwear",
    img: "shop-floor",
    likes: 19980,
    scans: 2970,
    posted: "2d",
    items: [
      { id: "sf-1", name: "Duck Canvas Chore Jacket", brand: "Harrow Supply", shop: "Harrow Supply", price: 178, currency: "USD", status: "in_stock", category: "outerwear", color: "brown", img: "p501", x: 30, y: 36, sizes: S(["S", "M", "L", "XL"]), query: "brown duck canvas chore jacket corduroy collar" },
      { id: "sf-2", name: "1951 Raw Selvedge", brand: "Harrow Supply", shop: "Harrow Supply", price: 160, currency: "USD", status: "low_stock", category: "bottom", color: "raw indigo", img: "p502", x: 47, y: 70, sizes: S(["30", "31", "32", "33", "34", "36"], ["30", "31", "33", "36"]), query: "raw indigo selvedge straight jeans" },
      { id: "sf-3", name: "Service Boot", brand: "Brakk", shop: "Brakk", price: 295, currency: "USD", status: "in_stock", category: "footwear", color: "black", img: "p503", x: 45, y: 93, sizes: S(["41", "42", "43", "44", "45"]), query: "black leather service boots" },
      { id: "sf-4", name: "Watch Beanie", brand: "Harrow Supply", shop: "Harrow Supply", price: 32, currency: "USD", status: "in_stock", category: "headwear", color: "grey", img: "p504", x: 50, y: 6, sizes: [], query: "grey ribbed knit beanie" },
    ],
  },
  {
    id: "linen-season",
    title: "Linen Season",
    handle: "nilu.linen",
    vibe: "Coastal",
    img: "linen-season",
    likes: 28760,
    scans: 4105,
    posted: "6h",
    items: [
      { id: "ls-1", name: "Oversized Linen Shirt", brand: "Saltmarsh", shop: "Saltmarsh", price: 115, currency: "USD", status: "in_stock", category: "top", color: "white", img: "p601", x: 52, y: 28, sizes: S(LETTERS), query: "oversized white linen shirt" },
      { id: "ls-2", name: "Drawstring Linen Pant", brand: "Saltmarsh", shop: "Saltmarsh", price: 98, currency: "USD", status: "sold_out", category: "bottom", color: "oat", img: "p602", x: 46, y: 70, sizes: S(LETTERS, LETTERS), resale: 70, query: "oatmeal linen wide leg drawstring pants" },
      { id: "ls-3", name: "Market Tote", brand: "Ruel", shop: "Ruel", price: 72, currency: "USD", status: "in_stock", category: "bag", color: "natural straw", img: "p603", x: 63, y: 70, sizes: [], query: "woven straw tote bag leather handles" },
      { id: "ls-4", name: "Thong Sandal", brand: "Ruel", shop: "Ruel", price: 89, currency: "USD", status: "low_stock", category: "footwear", color: "tan", img: "p604", x: 45, y: 95, sizes: S(["36", "37", "38", "39", "40"], ["36", "39", "40"]), query: "tan leather flat thong sandals" },
    ],
  },
  {
    id: "null-signal",
    title: "Null Signal",
    handle: "null.dex",
    vibe: "Techwear",
    img: "null-signal",
    likes: 31450,
    scans: 4890,
    posted: "12h",
    items: [
      { id: "nl-1", name: "Hardshell Hooded Jacket", brand: "Unit Null", shop: "Unit Null", price: 420, currency: "USD", status: "sold_out", category: "outerwear", color: "black", img: "p701", x: 31, y: 32, sizes: S(["S", "M", "L", "XL"], ["S", "M", "L", "XL"]), resale: 310, query: "black hooded waterproof hardshell jacket techwear" },
      { id: "nl-2", name: "Strap Cargo", brand: "Unit Null", shop: "Unit Null", price: 230, currency: "USD", status: "in_stock", category: "bottom", color: "black", img: "p702", x: 50, y: 64, sizes: S(["S", "M", "L", "XL"]), query: "black tapered techwear cargo pants straps" },
      { id: "nl-3", name: "Chest Sling", brand: "Unit Null", shop: "Unit Null", price: 85, currency: "USD", status: "in_stock", category: "bag", color: "black", img: "p703", x: 43, y: 22, sizes: [], query: "black nylon chest sling bag" },
      { id: "nl-4", name: "Mesh Trail Mid", brand: "Ascend Lab", shop: "Ascend Lab", price: 190, currency: "USD", status: "in_stock", category: "footwear", color: "black", img: "p704", x: 40, y: 93, sizes: S(["41", "42", "43", "44", "45"]), query: "all black mesh trail sneakers" },
    ],
  },
  {
    id: "varsity-rewind",
    title: "Varsity Rewind",
    handle: "ivy.campus",
    vibe: "Preppy",
    img: "varsity-rewind",
    likes: 26330,
    scans: 3720,
    posted: "1d",
    items: [
      { id: "vr-1", name: "Wool Varsity Jacket", brand: "Elmhurst Athletic", shop: "Elmhurst Athletic", price: 245, currency: "USD", status: "low_stock", category: "outerwear", color: "forest green", img: "p801", x: 55, y: 25, sizes: S(LETTERS, ["XS", "L", "XL"]), query: "green wool varsity jacket cream leather sleeves" },
      { id: "vr-2", name: "Heavy Hoodie", brand: "Elmhurst Athletic", shop: "Elmhurst Athletic", price: 85, currency: "USD", status: "in_stock", category: "top", color: "heather grey", img: "p802", x: 45, y: 6, sizes: S(LETTERS), query: "heather grey heavyweight hoodie" },
      { id: "vr-3", name: "Straight Crop Jean", brand: "Kiyo Denim", shop: "Kiyo Denim", price: 92, currency: "USD", status: "in_stock", category: "bottom", color: "light blue", img: "p803", x: 40, y: 60, sizes: S(["24", "25", "26", "27", "28", "30"]), query: "light blue straight leg cropped jeans" },
      { id: "vr-4", name: "Terrace 74", brand: "Volta", shop: "Volta", price: 110, currency: "USD", status: "sold_out", category: "footwear", color: "white / green", img: "p804", x: 61, y: 85, sizes: S(["36", "37", "38", "39", "40"], ["36", "37", "38", "39", "40"]), resale: 95, query: "white green retro terrace sneakers suede toe" },
    ],
  },
  {
    id: "soft-tailoring",
    title: "Soft Tailoring",
    handle: "omar.cuts",
    vibe: "Tailored",
    img: "soft-tailoring",
    likes: 17650,
    scans: 2480,
    posted: "3d",
    items: [
      { id: "st-1", name: "Unstructured DB Blazer", brand: "Oddline", shop: "Oddline", price: 380, currency: "USD", status: "in_stock", category: "outerwear", color: "charcoal", img: "p901", x: 28, y: 26, sizes: S(["46", "48", "50", "52", "54"]), query: "oversized charcoal double breasted blazer unstructured" },
      { id: "st-2", name: "Heavyweight Tee", brand: "Oddline", shop: "Oddline", price: 45, currency: "USD", status: "in_stock", category: "top", color: "off-white", img: "p902", x: 50, y: 14, sizes: S(LETTERS), query: "off white heavyweight crewneck t-shirt" },
      { id: "st-3", name: "Pleated Wide Trouser", brand: "Oddline", shop: "Oddline", price: 220, currency: "USD", status: "low_stock", category: "bottom", color: "black", img: "p903", x: 45, y: 60, sizes: S(["46", "48", "50", "52", "54"], ["46", "52", "54"]), query: "black pleated wide leg wool trousers" },
      { id: "st-4", name: "Penny Loafer", brand: "Brakk", shop: "Brakk", price: 260, currency: "USD", status: "in_stock", category: "footwear", color: "black", img: "p904", x: 65, y: 94, sizes: S(["41", "42", "43", "44", "45"]), query: "black polished leather penny loafers" },
    ],
  },
  {
    id: "slab-day",
    title: "Slab Day",
    handle: "kai.slabs",
    vibe: "Skate",
    img: "slab-day",
    likes: 38920,
    scans: 5930,
    posted: "8h",
    items: [
      { id: "sd-1", name: "Melt Tee", brand: "Slab Skate", shop: "Slab Skate", price: 48, currency: "USD", status: "sold_out", category: "top", color: "washed black", img: "p1001", x: 45, y: 35, sizes: S(LETTERS, LETTERS), resale: 60, query: "washed black oversized graphic t-shirt abstract print" },
      { id: "sd-2", name: "Big Jort", brand: "Slab Skate", shop: "Slab Skate", price: 70, currency: "USD", status: "in_stock", category: "bottom", color: "light wash", img: "p1002", x: 41, y: 66, sizes: S(["28", "30", "32", "34", "36"]), query: "baggy light wash denim jorts" },
      { id: "sd-3", name: "Suede Low", brand: "Slab Skate", shop: "Slab Skate", price: 75, currency: "USD", status: "in_stock", category: "footwear", color: "grey", img: "p1003", x: 46, y: 92, sizes: S(["40", "41", "42", "43", "44"]), query: "grey suede skate shoes gum sole" },
      { id: "sd-4", name: "6-Panel Cap", brand: "Slab Skate", shop: "Slab Skate", price: 34, currency: "USD", status: "in_stock", category: "headwear", color: "navy", img: "p1004", x: 49, y: 3, sizes: [], query: "navy six panel baseball cap" },
    ],
  },
  {
    id: "butter-hour",
    title: "Butter Hour",
    handle: "frida.butter",
    vibe: "Soft girl",
    img: "butter-hour",
    likes: 44180,
    scans: 7260,
    posted: "4h",
    items: [
      { id: "bh-1", name: "Cropped Polo Cardigan", brand: "Lumen Row", shop: "Lumen Row", price: 128, currency: "USD", status: "low_stock", category: "top", color: "butter yellow", img: "p1101", x: 45, y: 22, sizes: S(LETTERS, ["XS", "L", "XL"]), query: "butter yellow cropped knit cardigan collar" },
      { id: "bh-2", name: "Satin Slip Skirt", brand: "Lumen Row", shop: "Lumen Row", price: 110, currency: "USD", status: "in_stock", category: "bottom", color: "white", img: "p1102", x: 48, y: 56, sizes: S(LETTERS), query: "white satin midi slip skirt" },
      { id: "bh-3", name: "Mary Jane Flat", brand: "Petra", shop: "Petra", price: 140, currency: "USD", status: "sold_out", category: "footwear", color: "black", img: "p1103", x: 51, y: 92, sizes: S(["36", "37", "38", "39", "40"], ["36", "37", "38", "39", "40"]), resale: 105, query: "black mary jane ballet flats" },
      { id: "bh-4", name: "Mini Shoulder Bag", brand: "Petra", shop: "Petra", price: 165, currency: "USD", status: "in_stock", category: "bag", color: "black", img: "p1104", x: 33, y: 20, sizes: [], query: "small black leather shoulder bag" },
    ],
  },
];

export const VIBES = ["All", ...Array.from(new Set(FITS.map((f) => f.vibe)))];

export function findFit(id) {
  return FITS.find((f) => f.id === id) || null;
}

export function findItem(itemId) {
  for (const fit of FITS) {
    const item = fit.items.find((i) => i.id === itemId);
    if (item) return { fit, item };
  }
  return null;
}
