// Turns a pasted list into soldiers: a WhatsApp message or a few copied messages, a column from
// Excel, or a contact card (.vcf). Finds the name, a phone number and a personal number on each line.

const MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
// "[5.11.2026, 10:22:13] תומר:" (iPhone) or "5.11.2026, 10:22 - תומר:" (Android)
const WA_PREFIX = /^\[?\d{1,2}[./-]\d{1,2}[./-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?\]?\s*(?:-\s*)?(?:[^:\n]{1,40}:\s+)?/;
const LABELS = /(?:^|\s)(?:טל(?:פון)?|נייד|פלאפון|פל|מ\.?\s?א\.?|מס(?:פר)?\s?אישי|מספר|שם)\s*[:.-]?(?=\s|$)/g;
const WA_SKIP = /(הצטרפ|צירפ|הוסיפ|עזב\/ה|יצר\/ה את הקבוצה|יצר את הקבוצה|הודעות ושיחות|הושמט|<מדיה|Messages and calls|omitted|joined using|left$)/;

function cleanName(s) {
  return s
    .replace(LABELS, ' ')
    .replace(/[^\p{L}\s'"׳״\-.]/gu, ' ')     // emoji, symbols, digits
    .replace(/(^|\s)[-.'"]+|[-.'"]+(?=\s|$)/g, ' ') // stray punctuation at word edges
    .replace(/\s+/g, ' ')
    .trim();
}

function classify(digits) {
  const d = digits.replace(/[^\d+]/g, '').replace(/^\+?972/, '0');
  if (/^0\d{8,9}$/.test(d)) return { phone: d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3)}` : d };
  if (/^\d{7,8}$/.test(d)) return { pn: d };
  return {};
}

function parseLine(raw) {
  let line = raw.replace(MARKS, '').replace(WA_PREFIX, '').trim();
  if (!line || WA_SKIP.test(line)) return [];
  line = line.replace(/^\s*(?:\d{1,3}\s*[.)\-:]|[•·*\-–—▪►✔✅☑️]+)\s*/u, '');   // "12." "3)" bullets
  if (!/\p{L}/u.test(line)) return [];
  if (/[:：]\s*$/.test(line)) return [];                                       // a heading, like "רשימה:"

  // Several names on one line, separated by commas, and no numbers: "משה, דוד, יוסי"
  const parts = line.split(/\s*[,;|\t]\s*/).filter(Boolean);
  if (parts.length > 1 && parts.every(p => !/\d/.test(p) && cleanName(p).split(' ').length <= 3)) {
    return parts.map(p => ({ name: cleanName(p), phone: '', pn: '' })).filter(x => x.name);
  }

  const out = { name: '', phone: '', pn: '' };
  // numbers: phones may be written with spaces or dashes ("052-123 4567", "+972 52-123-4567")
  const nums = line.match(/\+?\d[\d\s\-()]{5,}\d/g) || [];
  let rest = line;
  for (const n of nums) {
    const c = classify(n);
    if (c.phone && !out.phone) { out.phone = c.phone; rest = rest.replace(n, ' '); }
    else if (c.pn && !out.pn) { out.pn = c.pn; rest = rest.replace(n, ' '); }
  }
  out.name = cleanName(rest);
  const words = out.name.split(' ').filter(Boolean);
  if (!out.name || words.length > 4) return [];
  if (out.name.length < 2) return [];
  return [out];
}

function parseVcf(text) {
  const out = [];
  for (const card of text.split(/BEGIN:VCARD/i).slice(1)) {
    const unfolded = card.replace(/\r?\n[ \t]/g, '');
    const fn = unfolded.match(/^FN(?:;[^:]*)?:(.*)$/im)?.[1];
    const n = unfolded.match(/^N(?:;[^:]*)?:(.*)$/im)?.[1];
    const tel = unfolded.match(/^(?:item\d+\.)?TEL(?:;[^:]*)?:(.*)$/im)?.[1] || '';
    const name = cleanName((fn || (n ? n.split(';').slice(0, 2).reverse().join(' ') : '')).replace(/\\,/g, ','));
    if (name) out.push({ name, phone: classify(tel).phone || tel.trim(), pn: '' });
  }
  return out;
}

export function parseList(text) {
  if (!text) return [];
  const all = /BEGIN:VCARD/i.test(text) ? parseVcf(text) : text.split(/\r?\n/).flatMap(parseLine);
  const seen = new Set();
  return all.filter(x => {
    const k = x.name.replace(/\s+/g, ' ');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
