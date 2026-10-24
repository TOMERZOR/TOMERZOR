// What Claude is asked to do on every scan, and the shape it must answer in.

export const SYSTEM_PROMPT = `You are the sourcing engine behind FitSource, an Israeli site. Shoppers in Israel upload a photo of an outfit (a "fit") they saw online, and you find where each piece comes from and whether they can still buy it.

How to work:
- Look at the photo first. List the clearly visible clothing items and accessories, most important first. Skip anything you can only guess at (hidden layers, blurry details). Three to six items is typical.
- For each item, look for real evidence of what it is: logos, labels, tags, prints, signature design details, hardware, stitching. Name a brand or product only when that evidence supports it. When it does not, leave brand and product_name null and treat the item as a style to match.
- Use web_search to find the original product page, ideally the brand's own store, plus other stores that sell the same product. Always report the original source, even when it doesn't ship to Israel.
- Then favour places an Israeli shopper can actually buy from: the brand's Israeli store or Israeli distributor, Israeli retailers (Terminal X, Factory 54, Castro, Fox, Renuar, Golf, Adika, Next Israel, Zara Israel, H&M Israel, Nike Israel, Foot Locker Israel and similar), and international stores that ship to Israel (ASOS, AliExpress, Shein, brand stores with Israeli shipping). Search in English and in Hebrew; Israeli stores often name products in Hebrew.
- For unbranded basics, find two or three close matches at different price points, Israeli stores first.
- Use web_fetch on the most promising product pages to read the current price and stock. Report the price in the currency the page shows; prefer a store's Israeli page (prices in ILS) when it has one. A page that says sold out, out of stock, unavailable or "notify me" means sold_out. If only some sizes are left, list them and use low_stock when few remain.
- When the original is sold out, also look for resale listings (Yad2, Facebook Marketplace in Israel, eBay, Depop, Grailed, Vestiaire) and one in-stock alternative that can be bought in Israel.
- If a store doesn't ship to Israel, say so in the match's note.
- Only use URLs that appeared in your search results or pages you fetched. Never construct or guess a URL. Prefer product pages over search or category pages.
- Spend searches where they matter: the statement pieces first, basics last.

Language: the site is in Hebrew. Write vibe, summary, label, color, note and search_query in natural, everyday Israeli Hebrew (e.g. label "ז'קט בומבר קצר מעור", color "שחור"). Keep brand, product_name, and each match's title and shop exactly as the store writes them. search_query_en is the same search in English, for stores with English catalogues.

Bounding boxes use a 0 to 1000 scale on both axes, origin at the top left of the image: x and y are the box's top-left corner, w and h its size. They only need to be approximately right.

When you are done, call submit_results once with everything you found. Do not write a separate text answer.`;

export function userInstruction({ focus, hint }) {
  const parts = ["Source this fit for a shopper in Israel."];
  if (focus) {
    parts.push(
      `The user only cares about the item inside this region (0 to 1000 scale): x=${focus.x}, y=${focus.y}, w=${focus.w}, h=${focus.h}. Return just that item.`,
    );
  }
  if (hint) parts.push(`The user added this note: "${hint}"`);
  return parts.join(" ");
}

export const CATEGORIES = [
  "outerwear",
  "top",
  "bottom",
  "dress",
  "footwear",
  "bag",
  "headwear",
  "eyewear",
  "jewelry",
  "accessory",
];

export const MATCH_KINDS = ["original", "exact", "close", "similar", "resale"];

const nullableString = { type: ["string", "null"] };

export const SUBMIT_TOOL = {
  name: "submit_results",
  description:
    "Submit the finished sourcing results for the fit. Call this exactly once, after searching, with every item you identified and the shops you found for each.",
  strict: true,
  eager_input_streaming: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["vibe", "summary", "items"],
    properties: {
      vibe: { type: "string", description: "Two to four Hebrew words naming the style, e.g. 'סקייט שנות ה־90' or 'יוקרה שקטה'." },
      summary: { type: "string", description: "One Hebrew sentence describing the fit." },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "category", "color", "brand", "product_name", "confidence", "box", "search_query", "search_query_en", "matches"],
          properties: {
            label: { type: "string", description: "Short shopper-friendly Hebrew name, e.g. 'ז'קט בומבר קצר מעור'." },
            category: { type: "string", enum: CATEGORIES },
            color: { type: "string", description: "The main colour in Hebrew, e.g. 'שחור' or 'ג'ינס בהיר'." },
            brand: { ...nullableString, description: "Brand, only when the photo gives real evidence." },
            product_name: { ...nullableString, description: "Exact product or model name, when identified." },
            confidence: {
              type: "string",
              enum: ["exact", "likely", "similar"],
              description: "exact: the specific product is identified. likely: strong guess. similar: only lookalikes found.",
            },
            box: {
              type: "object",
              additionalProperties: false,
              required: ["x", "y", "w", "h"],
              properties: {
                x: { type: "integer" },
                y: { type: "integer" },
                w: { type: "integer" },
                h: { type: "integer" },
              },
            },
            search_query: { type: "string", description: "The Hebrew query an Israeli shopper should use to find this item." },
            search_query_en: { type: "string", description: "The same query in English." },
            matches: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "brand", "shop", "url", "price", "currency", "availability", "sizes_in_stock", "match", "note"],
                properties: {
                  title: { type: "string" },
                  brand: nullableString,
                  shop: { type: "string", description: "Store name, e.g. 'Terminal X', 'SSENSE' or the brand's own store." },
                  url: { type: "string", description: "Product page URL taken from search results or a fetched page." },
                  price: { type: ["number", "null"] },
                  currency: { ...nullableString, description: "ISO 4217 code, e.g. ILS or USD." },
                  availability: { type: "string", enum: ["in_stock", "low_stock", "sold_out", "preorder", "unknown"] },
                  sizes_in_stock: { type: "array", items: { type: "string" } },
                  match: { type: "string", enum: MATCH_KINDS },
                  note: { ...nullableString, description: "Anything a shopper should know, in a few Hebrew words (e.g. 'לא שולח לישראל')." },
                },
              },
            },
          },
        },
      },
    },
  },
};
