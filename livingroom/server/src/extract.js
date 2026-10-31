// Reads a product page without AI: structured data (JSON-LD, Open Graph), 3D model links,
// and dimensions written in the text ("W 200 x D 90 x H 85 cm", "רוחב: 200 ס"מ", ...).

const decode = s => String(s || '')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

export function absolutize(url, base) {
  try { return new URL(decode(url).trim(), base).href; } catch { return null; }
}

function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key.replace(/[:.]/g, '\\$&')}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return decode(tag.match(/content=["']([^"']*)["']/i)?.[1] || '') || null;
}

function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      const walk = v => {
        if (!v || typeof v !== 'object') return;
        if (Array.isArray(v)) return v.forEach(walk);
        out.push(v);
        if (v['@graph']) walk(v['@graph']);
      };
      walk(data);
    } catch { /* some sites ship broken JSON-LD */ }
  }
  return out;
}

const isType = (o, t) => [].concat(o['@type'] || []).some(x => String(x).toLowerCase() === t);

/** A length in cm from a schema.org QuantitativeValue or a plain string. */
export function toCm(v, unitHint) {
  if (v == null) return null;
  if (typeof v === 'object') return toCm(v.value ?? v['@value'], v.unitCode || v.unitText || unitHint);
  const n = parseFloat(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = String(unitHint || String(v).replace(/[\d.,\s]/g, '') || 'cm').toLowerCase();
  if (/^(mm|mmt|millimet)/.test(u) || u === 'מ"מ') return n / 10;
  if (/^(m|mtr|met)$/.test(u) || u === 'מ' || u === "מטר") return n * 100;
  if (/^(in|inh|inch|"|″)/.test(u)) return n * 2.54;
  if (/^(ft|fot|feet|foot)/.test(u)) return n * 30.48;
  return n;
}

const UNIT = String.raw`(cm|ס["״']?מ|סמ|סנטימטר|mm|מ["״']?מ|m\b|מטר|in(?:ch(?:es)?)?\b|["″]|ft)`;
const NUM = String.raw`(\d{1,4}(?:[.,]\d{1,2})?)`;

/** Finds dimensions in page text. Returns { w, d, h } in cm (any may be missing) and the matched text. */
export function dimsFromText(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const out = {};
  const labels = [
    ['w', String.raw`(?:width|wide|רוחב|W)`],
    ['d', String.raw`(?:depth|deep|length|עומק|אורך|D|L)`],
    ['h', String.raw`(?:height|high|tall|גובה|H)`],
  ];
  // labelled values: "רוחב: 200 ס"מ", "Width 78.7"", "W200cm"
  for (const [k, lab] of labels) {
    const re = new RegExp(String.raw`(?:^|[^\p{L}])${lab}\s*[:：=]?\s*${NUM}\s*${UNIT}?`, 'iu');
    const m = t.match(re);
    if (m && !out[k]) {
      const cm = toCm(m[1], m[2] || 'cm');
      if (cm && cm < 2000) out[k] = Math.round(cm * 10) / 10;
    }
  }
  // "200 x 90 x 85 cm" (with optional W/D/H letters)
  const triple = new RegExp(String.raw`(?:([WDHL])\s*)?${NUM}\s*${UNIT}?\s*[x×X*]\s*(?:([WDHL])\s*)?${NUM}\s*${UNIT}?\s*[x×X*]\s*(?:([WDHL])\s*)?${NUM}\s*${UNIT}`, 'iu');
  const m = t.match(triple);
  if (m) {
    const unit = m[9] || m[6] || m[3] || 'cm';
    const vals = [m[2], m[5], m[8]].map(v => toCm(v, unit));
    const letters = [m[1], m[4], m[7]].map(l => (l || '').toUpperCase());
    if (vals.every(v => v && v < 2000)) {
      if (letters.every(Boolean)) {
        letters.forEach((l, i) => { const k = l === 'W' ? 'w' : l === 'H' ? 'h' : 'd'; out[k] ??= vals[i]; });
      } else {
        // order is usually width x depth x height
        out.w ??= vals[0]; out.d ??= vals[1]; out.h ??= vals[2];
      }
      out.match = m[0];
    }
  }
  return out;
}

/** Text near words like "dimensions" / "מידות", where sizes are written. */
export function dimensionSnippets(text, max = 6) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const out = [];
  const re = /(dimension|measurement|size|width|height|depth|מידות|גודל|רוחב|גובה|עומק|אורך)/giu;
  let m;
  while ((m = re.exec(t)) && out.length < max * 3) {
    const s = Math.max(0, m.index - 80);
    out.push(t.slice(s, m.index + 260));
    re.lastIndex = m.index + 200;
  }
  return [...new Set(out)].slice(0, max);
}

export function textOf(html) {
  return decode(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|td|th|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .trim();
}

/** Everything useful the page itself says about the product. */
export function extractProduct(html, pageUrl) {
  const ld = jsonLd(html);
  const product = ld.find(o => isType(o, 'product')) || null;
  const offer = product && [].concat(product.offers || [])[0];
  const offerObj = offer && (offer.offers ? [].concat(offer.offers)[0] : offer);
  const images = [];
  const pushImg = v => { for (const x of [].concat(v || [])) { const u = typeof x === 'string' ? x : x?.url || x?.contentUrl; const a = u && absolutize(u, pageUrl); if (a && !images.includes(a)) images.push(a); } };
  if (product) pushImg(product.image);
  pushImg(meta(html, 'og:image'));
  pushImg(meta(html, 'og:image:secure_url'));
  pushImg(meta(html, 'twitter:image'));

  const models = [];
  for (const m of html.matchAll(/["'(=]\s*((?:https?:)?\/\/[^"'()\s<>]+?\.(?:glb|gltf|usdz))(?:\?[^"'()\s<>]*)?["')\s]/gi)) {
    const a = absolutize(m[1], pageUrl);
    if (a && !models.includes(a)) models.push(a);
  }
  for (const m of html.matchAll(/<model-viewer[^>]+src=["']([^"']+)["']/gi)) {
    const a = absolutize(m[1], pageUrl);
    if (a && !models.includes(a)) models.unshift(a);
  }

  const text = textOf(html);
  const fromLd = {};
  if (product) {
    for (const [k, key] of [['w', 'width'], ['d', 'depth'], ['h', 'height']]) { const v = toCm(product[key]); if (v) fromLd[k] = v; }
    if (!fromLd.d && product.length) fromLd.d = toCm(product.length);
    for (const p of [].concat(product.additionalProperty || [])) {
      const name = String(p?.name || '').toLowerCase();
      const v = toCm(p?.value, p?.unitCode || p?.unitText);
      if (!v) continue;
      if (/width|רוחב/.test(name)) fromLd.w ??= v;
      else if (/depth|עומק|length|אורך/.test(name)) fromLd.d ??= v;
      else if (/height|גובה/.test(name)) fromLd.h ??= v;
    }
  }
  const fromText = dimsFromText([product?.description, text].filter(Boolean).join('\n'));
  const dims = { w: fromLd.w ?? fromText.w ?? null, d: fromLd.d ?? fromText.d ?? null, h: fromLd.h ?? fromText.h ?? null };

  const price = offerObj?.price ?? offerObj?.lowPrice ?? meta(html, 'product:price:amount') ?? meta(html, 'og:price:amount');
  const currency = offerObj?.priceCurrency ?? meta(html, 'product:price:currency') ?? meta(html, 'og:price:currency');
  const name = decode(product?.name || meta(html, 'og:title') || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const brand = typeof product?.brand === 'string' ? product.brand : product?.brand?.name;
  const site = meta(html, 'og:site_name') || (() => { try { return new URL(pageUrl).hostname.replace(/^www\./, ''); } catch { return null; } })();
  const color = typeof product?.color === 'string' ? product.color : null;

  return {
    name: name.slice(0, 160) || null,
    brand: brand || null,
    store: site,
    description: decode(product?.description || meta(html, 'og:description') || meta(html, 'description') || '').slice(0, 600) || null,
    images: images.slice(0, 8),
    models: models.slice(0, 4),
    price: price != null && !Number.isNaN(parseFloat(price)) ? parseFloat(String(price).replace(/,/g, '')) : null,
    currency: currency || null,
    color,
    dims,
    dimsFound: Boolean(dims.w || dims.d || dims.h),
    snippets: dimensionSnippets(text),
    text: text.slice(0, 20000),
    jsonLd: product ? JSON.stringify(product).slice(0, 4000) : null,
  };
}
