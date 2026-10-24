// The feed. Sample content: the people in these photos and the brands below
// are invented (photos are AI-generated), except "Created By God", which is a
// real Dream Studios fit linking to the real store. Replace or extend with real
// creator posts: each item needs a product URL for the Shop button to go
// straight to the shop; without one it opens a search for similar pieces.
//
// x / y place the item's dot on the photo, in percent from the top left.
// query is the Hebrew search for Israeli shops, queryEn the English one for
// shops that search in English (ASOS, AliExpress, eBay...).
// status: in_stock | low_stock | sold_out | preorder

const S = (list, out = []) => list.map((s) => ({ s, ok: !out.includes(s) }));
const LETTERS = ["XS", "S", "M", "L", "XL"];

export const FITS = [
  {
    id: "created-by-god",
    title: "Created By God",
    handle: "dreamstudios",
    verified: true,
    vibe: "סטריט",
    img: "created-by-god",
    likes: 18420,
    scans: 2310,
    posted: "2d",
    real: true,
    items: [
      { id: "ds-tee", name: "Circle Logo Tee Navy", brand: "Dream Studios", shop: "Dream Studios", price: 189, currency: "ILS", status: "in_stock", category: "top", color: "washed navy", img: "ds-circle-tee", x: 58, y: 25, sizes: S(["XS", "S", "M", "L", "XL", "XXL"]), url: "../product.html#circle-logo-tee", query: "חולצת טי אוברסייז כחולה עם לוגו", queryEn: "navy oversized logo t-shirt" },
      { id: "ds-shorts", name: "Created By God Denim Shorts", brand: "Dream Studios", shop: "Dream Studios", price: 349, currency: "ILS", status: "low_stock", category: "bottom", color: "vintage wash", img: "ds-cbg-shorts", x: 55, y: 56, sizes: S(["28", "30", "32", "34", "36"], ["28", "34", "36"]), url: "../product.html#created-by-god-shorts", query: "ג'ורטס ג'ינס רחב בשטיפה וינטג'", queryEn: "baggy vintage wash denim jorts" },
      { id: "ds-socks", name: "גרבי קרו מצולעות", brand: null, shop: null, price: null, currency: "ILS", status: "in_stock", category: "accessory", color: "white", img: "ds-socks", x: 37, y: 79, sizes: [], url: null, query: "גרביים לבנות מצולעות גבוהות", queryEn: "white ribbed crew socks" },
      { id: "ds-shoes", name: "נעלי דרבי מעור", brand: null, shop: null, price: null, currency: "ILS", status: "in_stock", category: "footwear", color: "black", img: "ds-shoes", x: 40, y: 89, sizes: [], url: null, query: "נעלי דרבי שחורות מעור סוליה עבה", queryEn: "black leather derby shoes chunky sole" },
    ],
  },
  {
    id: "night-shift",
    title: "משמרת לילה",
    handle: "noa.wears",
    vibe: "סטריט",
    img: "night-shift",
    likes: 41200,
    scans: 6120,
    posted: "5h",
    items: [
      { id: "ns-1", name: "ז'קט בומבר קצר מעור", brand: "Halden", shop: "Halden", price: 1069, currency: "ILS", status: "sold_out", category: "outerwear", color: "black", img: "p101", x: 24, y: 22, sizes: S(LETTERS, LETTERS), resale: 699, query: "ז'קט בומבר קצר מעור שחור", queryEn: "cropped black leather bomber jacket" },
      { id: "ns-2", name: "גופיית ריב", brand: "Mono Rib", shop: "Mono Rib", price: 89, currency: "ILS", status: "in_stock", category: "top", color: "white", img: "p102", x: 50, y: 28, sizes: S(LETTERS), query: "גופייה לבנה מצולעת", queryEn: "white ribbed tank top" },
      { id: "ns-3", name: "ג'ינס Arc רחב", brand: "Kiyo Denim", shop: "Kiyo Denim", price: 359, currency: "ILS", status: "low_stock", category: "bottom", color: "light wash", img: "p103", x: 44, y: 62, sizes: S(["24", "25", "26", "27", "28", "30"], ["24", "25", "27", "28"]), query: "ג'ינס רחב בהיר", queryEn: "light wash baggy wide leg jeans" },
      { id: "ns-4", name: "סניקרס V-90 Chunk", brand: "Volta", shop: "Volta", price: 499, currency: "ILS", status: "in_stock", category: "footwear", color: "white", img: "p104", x: 50, y: 95, sizes: S(["36", "37", "38", "39", "40", "41"]), query: "סניקרס לבנות עבות", queryEn: "chunky white sneakers" },
    ],
  },
  {
    id: "trail-mix",
    title: "שביל ישראל",
    handle: "itay.outside",
    vibe: "גורפקור",
    img: "trail-mix",
    likes: 22870,
    scans: 3410,
    posted: "1d",
    items: [
      { id: "tm-1", name: "מעיל Ridge של 3 שכבות", brand: "Northpine", shop: "Northpine", price: 1259, currency: "ILS", status: "in_stock", category: "outerwear", color: "olive", img: "p201", x: 27, y: 38, sizes: S(["S", "M", "L", "XL"]), query: "מעיל גשם ירוק זית", queryEn: "olive green waterproof shell jacket" },
      { id: "tm-2", name: "מכנסי דגמ\"ח Trail", brand: "Northpine", shop: "Northpine", price: 439, currency: "ILS", status: "sold_out", category: "bottom", color: "stone", img: "p202", x: 44, y: 68, sizes: S(["S", "M", "L", "XL"], ["S", "M", "L", "XL"]), resale: 309, query: "מכנסי דגמ\"ח ניילון בז'", queryEn: "beige nylon cargo pants cuffed" },
      { id: "tm-3", name: "נעלי שטח Skree", brand: "Ascend Lab", shop: "Ascend Lab", price: 609, currency: "ILS", status: "low_stock", category: "footwear", color: "grey / orange", img: "p203", x: 46, y: 92, sizes: S(["41", "42", "43", "44", "45"], ["41", "44", "45"]), query: "נעלי ריצת שטח אפור כתום", queryEn: "grey orange trail running shoes" },
      { id: "tm-4", name: "תיק צד מיני", brand: "Fieldsack", shop: "Fieldsack", price: 179, currency: "ILS", status: "in_stock", category: "bag", color: "black", img: "p204", x: 35, y: 47, sizes: [], query: "תיק צד קטן שחור מניילון", queryEn: "small black nylon crossbody bag" },
    ],
  },
  {
    id: "quiet-money",
    title: "כסף שקט",
    handle: "michal.atelier",
    vibe: "יוקרה שקטה",
    img: "quiet-money",
    likes: 35640,
    scans: 5280,
    posted: "1d",
    items: [
      { id: "qm-1", name: "מעיל ארוך בעל דש כפול", brand: "Maison Arlo", shop: "Maison Arlo", price: 2549, currency: "ILS", status: "low_stock", category: "outerwear", color: "camel", img: "p301", x: 76, y: 42, sizes: S(LETTERS, ["XS", "M", "XL"]), query: "מעיל צמר ארוך בצבע קאמל", queryEn: "long camel wool double breasted coat" },
      { id: "qm-2", name: "סוודר צמה", brand: "Maison Arlo", shop: "Maison Arlo", price: 959, currency: "ILS", status: "in_stock", category: "top", color: "cream", img: "p302", x: 50, y: 20, sizes: S(LETTERS), query: "סוודר סריג צמות שמנת", queryEn: "cream cable knit crewneck sweater" },
      { id: "qm-3", name: "מכנסיים רחבים עם קפלים", brand: "Atelier Sève", shop: "Atelier Sève", price: 779, currency: "ILS", status: "in_stock", category: "bottom", color: "ecru", img: "p303", x: 50, y: 64, sizes: S(["34", "36", "38", "40", "42"]), query: "מכנסיים רחבים עם קפלים אקרו", queryEn: "ecru pleated wide leg trousers" },
      { id: "qm-4", name: "תיק טוט מעור רך", brand: "Atelier Sève", shop: "Atelier Sève", price: 1549, currency: "ILS", status: "sold_out", category: "bag", color: "black", img: "p304", x: 32, y: 68, sizes: [], resale: 1109, query: "תיק טוט שחור מעור", queryEn: "black leather tote bag minimal" },
    ],
  },
  {
    id: "mall-rat",
    title: "ילדת קניון",
    handle: "shira.y2k",
    vibe: "Y2K",
    img: "mall-rat",
    likes: 52310,
    scans: 8840,
    posted: "3h",
    items: [
      { id: "mr-1", name: "בייבי טי", brand: "Peachy Club", shop: "Peachy Club", price: 99, currency: "ILS", status: "in_stock", category: "top", color: "pink", img: "p401", x: 55, y: 25, sizes: S(LETTERS), query: "חולצת בייבי טי ורודה", queryEn: "pink fitted baby tee" },
      { id: "mr-2", name: "ג'ינס מתרחב בגזרה נמוכה", brand: "Peachy Club", shop: "Peachy Club", price: 289, currency: "ILS", status: "in_stock", category: "bottom", color: "mid blue", img: "p402", x: 55, y: 66, sizes: S(["24", "25", "26", "27", "28", "29"]), query: "ג'ינס מתרחב גזרה נמוכה", queryEn: "low rise flared jeans mid blue" },
      { id: "mr-3", name: "תיק באגט כסוף", brand: "Glint", shop: "Glint", price: 239, currency: "ILS", status: "sold_out", category: "bag", color: "silver", img: "p403", x: 61, y: 32, sizes: [], resale: 179, query: "תיק כתף באגט כסוף", queryEn: "silver metallic baguette shoulder bag" },
      { id: "mr-4", name: "משקפי שמש אובליים", brand: "Glint", shop: "Glint", price: 139, currency: "ILS", status: "in_stock", category: "eyewear", color: "clear", img: "p404", x: 50, y: 13, sizes: [], query: "משקפי שמש אובליים מסגרת שקופה", queryEn: "oval tinted sunglasses clear frame" },
    ],
  },
  {
    id: "shop-floor",
    title: "יום בסדנה",
    handle: "dan.workshop",
    vibe: "וורקוור",
    img: "shop-floor",
    likes: 19980,
    scans: 2970,
    posted: "2d",
    items: [
      { id: "sf-1", name: "ז'קט עבודה מקנבס", brand: "Harrow Supply", shop: "Harrow Supply", price: 659, currency: "ILS", status: "in_stock", category: "outerwear", color: "brown", img: "p501", x: 30, y: 36, sizes: S(["S", "M", "L", "XL"]), query: "ז'קט עבודה חום מקנבס", queryEn: "brown duck canvas chore jacket corduroy collar" },
      { id: "sf-2", name: "ג'ינס 1951 Raw Selvedge", brand: "Harrow Supply", shop: "Harrow Supply", price: 589, currency: "ILS", status: "low_stock", category: "bottom", color: "raw indigo", img: "p502", x: 47, y: 70, sizes: S(["30", "31", "32", "33", "34", "36"], ["30", "31", "33", "36"]), query: "ג'ינס סלבג' כהה ישר", queryEn: "raw indigo selvedge straight jeans" },
      { id: "sf-3", name: "מגפי סרוויס", brand: "Brakk", shop: "Brakk", price: 1089, currency: "ILS", status: "in_stock", category: "footwear", color: "black", img: "p503", x: 45, y: 93, sizes: S(["41", "42", "43", "44", "45"]), query: "מגפי עור שחורים", queryEn: "black leather service boots" },
      { id: "sf-4", name: "כובע גרב", brand: "Harrow Supply", shop: "Harrow Supply", price: 119, currency: "ILS", status: "in_stock", category: "headwear", color: "grey", img: "p504", x: 50, y: 6, sizes: [], query: "כובע גרב אפור סרוג", queryEn: "grey ribbed knit beanie" },
    ],
  },
  {
    id: "linen-season",
    title: "עונת הפשתן",
    handle: "yael.linen",
    vibe: "חוף",
    img: "linen-season",
    likes: 28760,
    scans: 4105,
    posted: "6h",
    items: [
      { id: "ls-1", name: "חולצת פשתן אוברסייז", brand: "Saltmarsh", shop: "Saltmarsh", price: 429, currency: "ILS", status: "in_stock", category: "top", color: "white", img: "p601", x: 52, y: 28, sizes: S(LETTERS), query: "חולצת פשתן לבנה אוברסייז", queryEn: "oversized white linen shirt" },
      { id: "ls-2", name: "מכנסי פשתן עם שרוך", brand: "Saltmarsh", shop: "Saltmarsh", price: 359, currency: "ILS", status: "sold_out", category: "bottom", color: "oat", img: "p602", x: 46, y: 70, sizes: S(LETTERS, LETTERS), resale: 259, query: "מכנסי פשתן רחבים בצבע שיבולת שועל", queryEn: "oatmeal linen wide leg drawstring pants" },
      { id: "ls-3", name: "סל שוק", brand: "Ruel", shop: "Ruel", price: 269, currency: "ILS", status: "in_stock", category: "bag", color: "natural straw", img: "p603", x: 63, y: 70, sizes: [], query: "תיק קש קלוע עם ידיות עור", queryEn: "woven straw tote bag leather handles" },
      { id: "ls-4", name: "כפכפי אצבע מעור", brand: "Ruel", shop: "Ruel", price: 329, currency: "ILS", status: "low_stock", category: "footwear", color: "tan", img: "p604", x: 45, y: 95, sizes: S(["36", "37", "38", "39", "40"], ["36", "39", "40"]), query: "סנדלי אצבע שטוחים מעור חום", queryEn: "tan leather flat thong sandals" },
    ],
  },
  {
    id: "null-signal",
    title: "אין קליטה",
    handle: "null.tlv",
    vibe: "טקוור",
    img: "null-signal",
    likes: 31450,
    scans: 4890,
    posted: "12h",
    items: [
      { id: "nl-1", name: "מעיל הארדשל עם קפוצ'ון", brand: "Unit Null", shop: "Unit Null", price: 1549, currency: "ILS", status: "sold_out", category: "outerwear", color: "black", img: "p701", x: 31, y: 32, sizes: S(["S", "M", "L", "XL"], ["S", "M", "L", "XL"]), resale: 1149, query: "מעיל עמיד למים שחור עם קפוצ'ון", queryEn: "black hooded waterproof hardshell jacket techwear" },
      { id: "nl-2", name: "מכנסי דגמ\"ח עם רצועות", brand: "Unit Null", shop: "Unit Null", price: 849, currency: "ILS", status: "in_stock", category: "bottom", color: "black", img: "p702", x: 50, y: 64, sizes: S(["S", "M", "L", "XL"]), query: "מכנסי דגמ\"ח שחורים טקוור", queryEn: "black tapered techwear cargo pants straps" },
      { id: "nl-3", name: "תיק חזה", brand: "Unit Null", shop: "Unit Null", price: 309, currency: "ILS", status: "in_stock", category: "bag", color: "black", img: "p703", x: 43, y: 22, sizes: [], query: "תיק חזה שחור מניילון", queryEn: "black nylon chest sling bag" },
      { id: "nl-4", name: "נעלי Mesh Trail Mid", brand: "Ascend Lab", shop: "Ascend Lab", price: 699, currency: "ILS", status: "in_stock", category: "footwear", color: "black", img: "p704", x: 40, y: 93, sizes: S(["41", "42", "43", "44", "45"]), query: "סניקרס שטח שחורות מרשת", queryEn: "all black mesh trail sneakers" },
    ],
  },
  {
    id: "varsity-rewind",
    title: "חזרה לקולג'",
    handle: "maya.campus",
    vibe: "פרפי",
    img: "varsity-rewind",
    likes: 26330,
    scans: 3720,
    posted: "1d",
    items: [
      { id: "vr-1", name: "ז'קט קולג' מצמר", brand: "Elmhurst Athletic", shop: "Elmhurst Athletic", price: 909, currency: "ILS", status: "low_stock", category: "outerwear", color: "forest green", img: "p801", x: 55, y: 25, sizes: S(LETTERS, ["XS", "L", "XL"]), query: "ז'קט קולג' ירוק עם שרוולי עור", queryEn: "green wool varsity jacket cream leather sleeves" },
      { id: "vr-2", name: "קפוצ'ון כבד", brand: "Elmhurst Athletic", shop: "Elmhurst Athletic", price: 309, currency: "ILS", status: "in_stock", category: "top", color: "heather grey", img: "p802", x: 45, y: 6, sizes: S(LETTERS), query: "קפוצ'ון אפור עבה", queryEn: "heather grey heavyweight hoodie" },
      { id: "vr-3", name: "ג'ינס ישר קצר", brand: "Kiyo Denim", shop: "Kiyo Denim", price: 339, currency: "ILS", status: "in_stock", category: "bottom", color: "light blue", img: "p803", x: 40, y: 60, sizes: S(["24", "25", "26", "27", "28", "30"]), query: "ג'ינס ישר קצר תכלת", queryEn: "light blue straight leg cropped jeans" },
      { id: "vr-4", name: "סניקרס Terrace 74", brand: "Volta", shop: "Volta", price: 409, currency: "ILS", status: "sold_out", category: "footwear", color: "white / green", img: "p804", x: 61, y: 85, sizes: S(["36", "37", "38", "39", "40"], ["36", "37", "38", "39", "40"]), resale: 349, query: "סניקרס רטרו לבן ירוק", queryEn: "white green retro terrace sneakers suede toe" },
    ],
  },
  {
    id: "soft-tailoring",
    title: "חייטות רכה",
    handle: "omer.cuts",
    vibe: "מחויט",
    img: "soft-tailoring",
    likes: 17650,
    scans: 2480,
    posted: "3d",
    items: [
      { id: "st-1", name: "בלייזר כפול רך", brand: "Oddline", shop: "Oddline", price: 1409, currency: "ILS", status: "in_stock", category: "outerwear", color: "charcoal", img: "p901", x: 28, y: 26, sizes: S(["46", "48", "50", "52", "54"]), query: "בלייזר כפול אוברסייז אפור פחם", queryEn: "oversized charcoal double breasted blazer unstructured" },
      { id: "st-2", name: "טי עבה", brand: "Oddline", shop: "Oddline", price: 169, currency: "ILS", status: "in_stock", category: "top", color: "off-white", img: "p902", x: 50, y: 14, sizes: S(LETTERS), query: "חולצת טי עבה אוף וייט", queryEn: "off white heavyweight crewneck t-shirt" },
      { id: "st-3", name: "מכנסיים רחבים עם קפלים", brand: "Oddline", shop: "Oddline", price: 809, currency: "ILS", status: "low_stock", category: "bottom", color: "black", img: "p903", x: 45, y: 60, sizes: S(["46", "48", "50", "52", "54"], ["46", "52", "54"]), query: "מכנסי צמר רחבים שחורים עם קפלים", queryEn: "black pleated wide leg wool trousers" },
      { id: "st-4", name: "נעלי פני לופר", brand: "Brakk", shop: "Brakk", price: 959, currency: "ILS", status: "in_stock", category: "footwear", color: "black", img: "p904", x: 65, y: 94, sizes: S(["41", "42", "43", "44", "45"]), query: "נעלי לופר שחורות מעור", queryEn: "black polished leather penny loafers" },
    ],
  },
  {
    id: "slab-day",
    title: "יום בסקייטפארק",
    handle: "ido.slabs",
    vibe: "סקייט",
    img: "slab-day",
    likes: 38920,
    scans: 5930,
    posted: "8h",
    items: [
      { id: "sd-1", name: "חולצת Melt", brand: "Slab Skate", shop: "Slab Skate", price: 179, currency: "ILS", status: "sold_out", category: "top", color: "washed black", img: "p1001", x: 45, y: 35, sizes: S(LETTERS, LETTERS), resale: 219, query: "חולצת טי גרפית שחורה אוברסייז", queryEn: "washed black oversized graphic t-shirt abstract print" },
      { id: "sd-2", name: "ג'ורטס רחב", brand: "Slab Skate", shop: "Slab Skate", price: 259, currency: "ILS", status: "in_stock", category: "bottom", color: "light wash", img: "p1002", x: 41, y: 66, sizes: S(["28", "30", "32", "34", "36"]), query: "ג'ורטס ג'ינס רחב בהיר", queryEn: "baggy light wash denim jorts" },
      { id: "sd-3", name: "נעלי סקייט מזמש", brand: "Slab Skate", shop: "Slab Skate", price: 279, currency: "ILS", status: "in_stock", category: "footwear", color: "grey", img: "p1003", x: 46, y: 92, sizes: S(["40", "41", "42", "43", "44"]), query: "נעלי סקייט מזמש אפור", queryEn: "grey suede skate shoes gum sole" },
      { id: "sd-4", name: "כובע 6 פאנלים", brand: "Slab Skate", shop: "Slab Skate", price: 129, currency: "ILS", status: "in_stock", category: "headwear", color: "navy", img: "p1004", x: 49, y: 3, sizes: [], query: "כובע מצחייה כחול כהה", queryEn: "navy six panel baseball cap" },
    ],
  },
  {
    id: "butter-hour",
    title: "שעת חמאה",
    handle: "liel.butter",
    vibe: "סופט גירל",
    img: "butter-hour",
    likes: 44180,
    scans: 7260,
    posted: "4h",
    items: [
      { id: "bh-1", name: "קרדיגן קצר עם צווארון", brand: "Lumen Row", shop: "Lumen Row", price: 469, currency: "ILS", status: "low_stock", category: "top", color: "butter yellow", img: "p1101", x: 45, y: 22, sizes: S(LETTERS, ["XS", "L", "XL"]), query: "קרדיגן קצר צהוב חמאה", queryEn: "butter yellow cropped knit cardigan collar" },
      { id: "bh-2", name: "חצאית סאטן", brand: "Lumen Row", shop: "Lumen Row", price: 409, currency: "ILS", status: "in_stock", category: "bottom", color: "white", img: "p1102", x: 48, y: 56, sizes: S(LETTERS), query: "חצאית סאטן מידי לבנה", queryEn: "white satin midi slip skirt" },
      { id: "bh-3", name: "בובות מרי ג'יין", brand: "Petra", shop: "Petra", price: 519, currency: "ILS", status: "sold_out", category: "footwear", color: "black", img: "p1103", x: 51, y: 92, sizes: S(["36", "37", "38", "39", "40"], ["36", "37", "38", "39", "40"]), resale: 389, query: "נעלי בובה מרי ג'יין שחורות", queryEn: "black mary jane ballet flats" },
      { id: "bh-4", name: "תיק כתף מיני", brand: "Petra", shop: "Petra", price: 609, currency: "ILS", status: "in_stock", category: "bag", color: "black", img: "p1104", x: 33, y: 20, sizes: [], query: "תיק כתף קטן שחור מעור", queryEn: "small black leather shoulder bag" },
    ],
  },
];

export const ALL = "הכל";
export const VIBES = [ALL, ...Array.from(new Set(FITS.map((f) => f.vibe)))];

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
