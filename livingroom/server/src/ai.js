// Uses Claude to turn a product page (or, when the store blocks us, a web search) into a clean item:
// name, category and the real outer dimensions in centimetres.
import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-opus-5-5';
// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

export const CATEGORIES = ['sofa', 'armchair', 'chair', 'coffee-table', 'table', 'bed', 'shelf', 'cabinet', 'lamp', 'plant', 'rug', 'art', 'mirror', 'tv', 'decor', 'object'];

export const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'category', 'width_cm', 'depth_cm', 'height_cm', 'dims_source', 'color_hex', 'price', 'currency', 'image_url', 'note'],
  properties: {
    name: { type: 'string', description: 'Short product name, in the language of the page, at most 60 characters' },
    category: { type: 'string', enum: CATEGORIES },
    width_cm: { type: 'number', description: 'Outer width (side to side, facing the front)' },
    depth_cm: { type: 'number', description: 'Outer depth (front to back). For a rug, its other side.' },
    height_cm: { type: 'number', description: 'Outer height (floor to top). For a rug use 1.' },
    dims_source: { type: 'string', enum: ['page', 'search', 'estimate'] },
    color_hex: { type: 'string', description: 'Main colour of the product as #rrggbb' },
    price: { type: 'number', description: 'Price as a number, 0 if unknown' },
    currency: { type: 'string', description: 'ISO 4217 code, empty if unknown' },
    image_url: { type: 'string', description: 'The best product-only photo from the candidates (plain background preferred), empty if none' },
    note: { type: 'string', description: 'One short sentence in Hebrew about the dimensions: which variant was taken, or that they are an estimate. Empty if nothing to say.' },
  },
};

export const SYSTEM_PROMPT = `You read online store pages for Living Room, an app that shows furniture and decor in the user's home in augmented reality at true size. The dimensions you return are used to draw the product at real scale, so they must be the product's real outer dimensions in centimetres.

How to measure, as the product stands in a room facing you:
- width: side to side; depth: front to back; height: floor to the highest point.
- Rugs: width and depth are the two sides (width the shorter one), height 1.
- Wall art, posters, mirrors and TVs: width and height of the visible piece (frame included), depth its thickness.
- Sofas and beds: overall size including arms and headboard, not the seat or mattress size.
- Convert inches and millimetres to centimetres.

When the page lists several sizes or variants, take the one selected in the URL, otherwise the default or first one, and say which in the note.
When the page gives no dimensions, use a web search for the exact product if you can; if you still can't find them, estimate typical dimensions for that kind of product and set dims_source to "estimate". Never leave a dimension at 0.

Choose image_url from the candidate photo URLs given (never invent one): the clearest photo of the product alone, preferably on a plain white or grey background, not a room scene.

Category guide: sofa (sofas, sectionals, loveseats), armchair, chair (dining chairs, stools, office chairs), coffee-table (coffee and side tables), table (dining tables, desks), bed, shelf (bookcases, shelving), cabinet (sideboards, dressers, TV units, wardrobes), lamp, plant, rug, art (posters, prints, paintings), mirror, tv, decor (vases, sculptures, small objects), object (anything else).`;

function pageMessage(url, page) {
  if (!page) return `The store blocked the page, so look the product up on the web.\nProduct page URL: ${url}`;
  const parts = [`Product page URL: ${url}`];
  if (page.name) parts.push(`Title: ${page.name}`);
  if (page.brand) parts.push(`Brand: ${page.brand}`);
  if (page.store) parts.push(`Store: ${page.store}`);
  if (page.price != null) parts.push(`Price on page: ${page.price} ${page.currency || ''}`);
  if (page.color) parts.push(`Colour on page: ${page.color}`);
  if (page.dimsFound) parts.push(`Dimensions found by a simple parser (may be wrong or partial, in cm): ${JSON.stringify(page.dims)}`);
  if (page.images?.length) parts.push(`Candidate photo URLs:\n${page.images.map(u => `- ${u}`).join('\n')}`);
  if (page.jsonLd) parts.push(`Structured data (JSON-LD):\n${page.jsonLd}`);
  if (page.snippets?.length) parts.push(`Text near size words:\n${page.snippets.map(s => `> ${s}`).join('\n')}`);
  if (page.description) parts.push(`Description: ${page.description}`);
  parts.push(`Page text (start):\n${(page.text || '').slice(0, 9000)}`);
  return parts.join('\n\n');
}

/** Returns the parsed item object, or { refused: true } / null. */
export async function aiExtract({ url, page, env }) {
  const model = env.LIVINGROOM_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
    maxRetries: 1,
    timeout: 80_000,
  });
  // Look the product up on the web when the page gave us nothing to work with.
  const needWeb = !page || (!page.dimsFound && !(page.snippets || []).length);
  const tools = needWeb && env.LIVINGROOM_WEB !== 'off'
    ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }, { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 2 }]
    : undefined;
  const messages = [{ role: 'user', content: pageMessage(url, page) }];
  let msg;
  for (let turn = 0; turn < 4; turn++) {
    msg = await client.beta.messages.create({
      model,
      max_tokens: 6000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages,
      ...(tools ? { tools } : {}),
      output_config: { effort: env.LIVINGROOM_EFFORT || (tools ? 'medium' : 'low'), format: { type: 'json_schema', schema: ITEM_SCHEMA } },
      ...(FALLBACK_MODELS.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    });
    // long web lookups pause; send the turn back to let them finish
    if (msg.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: msg.content });
  }
  console.log(JSON.stringify({ event: 'ai_extract', model: msg.model, web: Boolean(tools), stop: msg.stop_reason, usage: msg.usage }));
  if (msg.stop_reason === 'refusal') return { refused: true };
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}
