// Garment vocabulary for the on-device scan. `label` is what the model is
// shown ("a photo of <label>"); `name` is what people see. Text embeddings for
// every label are precomputed by tools/build-embeddings.mjs into embeddings.json,
// so if you edit this list, run that script again.

export const GROUPS = {
  outerwear: [
    ["leather jacket", "Leather jacket"],
    ["bomber jacket", "Bomber jacket"],
    ["denim jacket", "Denim jacket"],
    ["puffer jacket", "Puffer jacket"],
    ["technical rain shell jacket", "Shell jacket"],
    ["varsity jacket", "Varsity jacket"],
    ["blazer", "Blazer"],
    ["trench coat", "Trench coat"],
    ["long wool overcoat", "Wool overcoat"],
    ["canvas work jacket", "Chore jacket"],
    ["fleece jacket", "Fleece jacket"],
  ],
  top: [
    ["t-shirt", "T-shirt"],
    ["graphic t-shirt", "Graphic tee"],
    ["tank top", "Tank top"],
    ["button-up shirt", "Button-up shirt"],
    ["linen shirt", "Linen shirt"],
    ["polo shirt", "Polo shirt"],
    ["hoodie", "Hoodie"],
    ["sweatshirt", "Sweatshirt"],
    ["knit sweater", "Knit sweater"],
    ["cardigan", "Cardigan"],
    ["crop top", "Crop top"],
    ["blouse", "Blouse"],
  ],
  bottom: [
    ["jeans", "Jeans"],
    ["baggy jeans", "Baggy jeans"],
    ["flared jeans", "Flared jeans"],
    ["cargo pants", "Cargo pants"],
    ["tailored trousers", "Tailored trousers"],
    ["wide-leg trousers", "Wide-leg trousers"],
    ["sweatpants", "Sweatpants"],
    ["shorts", "Shorts"],
    ["denim shorts", "Denim shorts"],
    ["midi skirt", "Midi skirt"],
    ["mini skirt", "Mini skirt"],
    ["leggings", "Leggings"],
  ],
  dress: [
    ["dress", "Dress"],
    ["slip dress", "Slip dress"],
    ["jumpsuit", "Jumpsuit"],
  ],
  footwear: [
    ["sneakers", "Sneakers"],
    ["chunky sneakers", "Chunky sneakers"],
    ["running shoes", "Running shoes"],
    ["boots", "Boots"],
    ["work boots", "Work boots"],
    ["loafers", "Loafers"],
    ["sandals", "Sandals"],
    ["ballet flats", "Ballet flats"],
    ["high heels", "Heels"],
    ["skate shoes", "Skate shoes"],
  ],
  bag: [
    ["tote bag", "Tote bag"],
    ["shoulder bag", "Shoulder bag"],
    ["crossbody bag", "Crossbody bag"],
    ["backpack", "Backpack"],
  ],
  headwear: [
    ["baseball cap", "Cap"],
    ["beanie", "Beanie"],
    ["bucket hat", "Bucket hat"],
  ],
  eyewear: [["sunglasses", "Sunglasses"]],
};

// Things that are in every street photo but are not clothes. They soak up
// probability so a patch of pavement does not get called "cargo pants".
export const NEGATIVES = ["a street", "a brick wall", "a person's face", "the sky", "a building", "the pavement", "bare skin", "hair", "grass", "a car"];

export const PROMPT = (label) => `a photo of ${label}`;

/** Flat list in the exact order the embeddings are stored. */
export function allLabels() {
  const out = [];
  for (const [group, list] of Object.entries(GROUPS)) for (const [label, name] of list) out.push({ label, name, group });
  for (const label of NEGATIVES) out.push({ label, name: label, group: "neg" });
  return out;
}

export const GROUP_ORDER = ["outerwear", "top", "dress", "bottom", "footwear", "bag", "headwear", "eyewear"];

// What people see, in Hebrew: the garment name and its grammatical gender and
// number (m, f, mp, fp), so a colour can agree with it ("חולצה שחורה",
// "מכנסיים שחורים"). Keyed by the English `name` above.
export const HE = {
  "Leather jacket": ["ז'קט עור", "m"],
  "Bomber jacket": ["ז'קט בומבר", "m"],
  "Denim jacket": ["ז'קט ג'ינס", "m"],
  "Puffer jacket": ["מעיל פוך", "m"],
  "Shell jacket": ["מעיל גשם", "m"],
  "Varsity jacket": ["ז'קט קולג'", "m"],
  Blazer: ["בלייזר", "m"],
  "Trench coat": ["מעיל טרנץ'", "m"],
  "Wool overcoat": ["מעיל צמר", "m"],
  "Chore jacket": ["ז'קט עבודה", "m"],
  "Fleece jacket": ["ז'קט פליז", "m"],
  "T-shirt": ["חולצת טי", "f"],
  "Graphic tee": ["חולצת טי מודפסת", "f"],
  "Tank top": ["גופייה", "f"],
  "Button-up shirt": ["חולצה מכופתרת", "f"],
  "Linen shirt": ["חולצת פשתן", "f"],
  "Polo shirt": ["חולצת פולו", "f"],
  Hoodie: ["קפוצ'ון", "m"],
  Sweatshirt: ["סווטשירט", "m"],
  "Knit sweater": ["סוודר סריג", "m"],
  Cardigan: ["קרדיגן", "m"],
  "Crop top": ["טופ קרופ", "m"],
  Blouse: ["בלוזה", "f"],
  Jeans: ["ג'ינס", "m"],
  "Baggy jeans": ["ג'ינס רחב", "m"],
  "Flared jeans": ["ג'ינס מתרחב", "m"],
  "Cargo pants": ['מכנסי דגמ"ח', "mp"],
  "Tailored trousers": ["מכנסיים מחויטים", "mp"],
  "Wide-leg trousers": ["מכנסיים רחבים", "mp"],
  Sweatpants: ["מכנסי טרנינג", "mp"],
  Shorts: ["מכנסיים קצרים", "mp"],
  "Denim shorts": ["מכנסי ג'ינס קצרים", "mp"],
  "Midi skirt": ["חצאית מידי", "f"],
  "Mini skirt": ["חצאית מיני", "f"],
  Leggings: ["טייץ", "m"],
  Dress: ["שמלה", "f"],
  "Slip dress": ["שמלת סליפ", "f"],
  Jumpsuit: ["אוברול", "m"],
  Sneakers: ["סניקרס", "fp"],
  "Chunky sneakers": ["סניקרס עבות", "fp"],
  "Running shoes": ["נעלי ריצה", "fp"],
  Boots: ["מגפיים", "mp"],
  "Work boots": ["מגפי עבודה", "mp"],
  Loafers: ["נעלי לופר", "fp"],
  Sandals: ["סנדלים", "mp"],
  "Ballet flats": ["נעלי בובה", "fp"],
  Heels: ["נעלי עקב", "fp"],
  "Skate shoes": ["נעלי סקייט", "fp"],
  "Tote bag": ["תיק טוט", "m"],
  "Shoulder bag": ["תיק כתף", "m"],
  "Crossbody bag": ["תיק צד", "m"],
  Backpack: ["תיק גב", "m"],
  Cap: ["כובע מצחייה", "m"],
  Beanie: ["כובע גרב", "m"],
  "Bucket hat": ["כובע באקט", "m"],
  Sunglasses: ["משקפי שמש", "mp"],
};
