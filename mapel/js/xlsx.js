// A small .xlsx writer: sheets, colors, borders, merged cells, frozen panes, right-to-left.
// No library, so the app works offline. The file is a zip (stored, not compressed) of XML parts.
//
// sheet: { name, rtl, cols: [width...], rows: [{ height, cells: [cell...] }], freeze: { rows, cols }, merges: ['A1:D1'] }
// cell:  string | number | null | { v, s: { bold, size, color, fill, h, v, wrap, border } }

const enc = new TextEncoder();

const esc = s => String(s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2066-\u2069]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function colName(i) {
  let s = '';
  i++;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

const argb = hex => 'FF' + hex.replace('#', '').toUpperCase();

function styleBook() {
  const fonts = ['<font><sz val="11"/><name val="Arial"/><family val="2"/></font>'];
  const fontKey = new Map([['', 0]]);
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const fillKey = new Map();
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border>' + ['left', 'right', 'top', 'bottom'].map(k => `<${k} style="thin"><color rgb="FFD1D1D6"/></${k}>`).join('') + '<diagonal/></border>'];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const xfKey = new Map([['', 0]]);

  function id(s) {
    if (!s) return 0;
    const fk = `${s.bold ? 1 : 0}|${s.size || 11}|${s.color || ''}`;
    if (!fontKey.has(fk)) {
      fontKey.set(fk, fonts.length);
      fonts.push(`<font>${s.bold ? '<b/>' : ''}<sz val="${s.size || 11}"/>${s.color ? `<color rgb="${argb(s.color)}"/>` : ''}<name val="Arial"/><family val="2"/></font>`);
    }
    let fill = 0;
    if (s.fill) {
      if (!fillKey.has(s.fill)) {
        fillKey.set(s.fill, fills.length);
        fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${argb(s.fill)}"/><bgColor indexed="64"/></patternFill></fill>`);
      }
      fill = fillKey.get(s.fill);
    }
    const font = fontKey.get(fk), border = s.border ? 1 : 0;
    const h = s.h || '', v = s.v || 'center', wrap = s.wrap ? 1 : 0;
    const xk = `${font}|${fill}|${border}|${h}|${v}|${wrap}`;
    if (!xfKey.has(xk)) {
      xfKey.set(xk, xfs.length);
      xfs.push(`<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">` +
        `<alignment${h ? ` horizontal="${h}"` : ''} vertical="${v}"${wrap ? ' wrapText="1"' : ''} readingOrder="2"/></xf>`);
    }
    return xfKey.get(xk);
  }

  function xml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<fonts count="${fonts.length}">${fonts.join('')}</fonts>` +
      `<fills count="${fills.length}">${fills.join('')}</fills>` +
      `<borders count="${borders.length}">${borders.join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }
  return { id, xml };
}

function sheetXml(sh, styles) {
  const fr = sh.freeze || {};
  let pane = '';
  if (fr.rows || fr.cols) {
    const active = fr.rows && fr.cols ? 'bottomRight' : fr.rows ? 'bottomLeft' : 'topRight';
    pane = `<pane${fr.cols ? ` xSplit="${fr.cols}"` : ''}${fr.rows ? ` ySplit="${fr.rows}"` : ''} topLeftCell="${colName(Math.max(fr.cols || 0, sh.scrollTo || 0))}${(fr.rows || 0) + 1}" activePane="${active}" state="frozen"/>` +
      `<selection pane="${active}"/>`;
  }
  const cols = (sh.cols || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const rows = sh.rows.map((row, r) => {
    const cells = (row.cells || []).map((c, ci) => {
      if (c == null || c === '') return '';
      const ref = colName(ci) + (r + 1);
      const v = typeof c === 'object' ? c.v : c;
      const s = typeof c === 'object' ? styles.id(c.s) : 0;
      const sa = s ? ` s="${s}"` : '';
      if (v == null || v === '') return `<c r="${ref}"${sa}/>`;
      if (typeof v === 'number') return `<c r="${ref}"${sa}><v>${v}</v></c>`;
      return `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('');
    const ht = row.height ? ` ht="${row.height}" customHeight="1"` : '';
    return `<row r="${r + 1}"${ht}>${cells}</row>`;
  }).join('');
  const merges = sh.merges?.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<sheetViews><sheetView${sh.rtl ? ' rightToLeft="1"' : ''}${sh.scrollTo ? ` topLeftCell="${colName(sh.scrollTo)}1"` : ''} workbookViewId="0">${pane}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${rows}</sheetData>` +
    merges +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    '</worksheet>';
}

const safeName = (n, used) => {
  let s = String(n).replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Sheet';
  let k = 2, base = s;
  while (used.has(s)) s = `${base.slice(0, 28)} ${k++}`;
  used.add(s);
  return s;
};

// Right-to-left for phones. Excel and Google Sheets read the sheet's rightToLeft flag, but the
// iPhone preview (Quick Look), Numbers and others ignore it and show the first column on the
// left. So for phones the columns are written in reverse instead (the first column ends up last, on the
// right) and the sheet itself stays left-to-right: it reads right to left everywhere. Frozen columns
// can only be on the left, so only the header rows stay frozen, and the sheet opens scrolled to its
// right end, where the names are.
const parseRef = ref => {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  let c = 0;
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
  return { c: c - 1, r: +m[2] };
};
function mirror(sh) {
  const width = Math.max(sh.cols?.length || 0, ...sh.rows.map(r => (r.cells || []).length));
  const flip = i => width - 1 - i;
  const rows = sh.rows.map(r => {
    const cells = Array(width).fill(null);
    (r.cells || []).forEach((c, i) => { cells[flip(i)] = c; });
    return { ...r, cells };
  });
  const cols = Array.from({ length: width }, (_, i) => (sh.cols || [])[flip(i)] ?? 10);
  const merges = (sh.merges || []).map(m => {
    const [a, b] = m.split(':').map(parseRef);
    const left = flip(b.c), right = flip(a.c);
    // a merged range shows only its top-left cell, so the content moves there
    const cells = rows[a.r - 1].cells;
    const c = cells[right];
    if (c != null && left !== right) {
      cells[left] = c;
      cells[right] = typeof c === 'object' ? { v: '', s: c.s } : null;
    }
    return `${colName(left)}${a.r}:${colName(right)}${b.r}`;
  });
  let left = width, sum = 0;
  while (left > 0 && sum + cols[left - 1] <= 110) sum += cols[--left];
  return { ...sh, rtl: false, rows, cols, merges, freeze: sh.freeze?.rows ? { rows: sh.freeze.rows } : null, scrollTo: left };
}

// opts.mirror: write right-to-left sheets mirrored (for phones), instead of as Excel RTL sheets
export function buildXlsx(sheets, { mirror: mirrored = false } = {}) {
  const styles = styleBook();
  const used = new Set();
  const names = sheets.map(s => safeName(s.name, used));
  const files = [];
  sheets.forEach((sh, i) => files.push([`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh.rtl && mirrored ? mirror(sh) : sh, styles)]));
  files.unshift(
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView/></bookViews><sheets>' +
      names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      '</sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      '</Relationships>'],
  );
  files.push(['xl/styles.xml', styles.xml()]);
  return zip(files.map(([name, text]) => ({ name, data: enc.encode(text) })));
}

/* ---------- zip (stored) ---------- */

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function zip(files) {
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}
