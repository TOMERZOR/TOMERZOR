// Shared test bench: a local server that wraps the page in the publish skeleton,
// stores mock uploads, and serves CDN libraries and fonts from local copies.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');
export const DIST = path.join(ROOT, 'dist');
export const VENDOR = process.env.TOKEF_VENDOR || '/tmp/claude-0/-home-user-TOMERZOR/3b943eb5-0d9d-564e-b71e-ee77e1810bd5/scratchpad/vendor';

const SKELETON_HEAD = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf', '.woff2': 'font/woff2' };

const blobs = new Map();
export function startServer(port) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p = decodeURIComponent(u.pathname);
    if (req.method === 'POST' && p === '/__upload') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => { blobs.set(u.searchParams.get('id'), { type: u.searchParams.get('type'), body: Buffer.concat(chunks) }); res.writeHead(200); res.end('ok'); });
      return;
    }
    if (p.startsWith('/_blob/')) {
      const b = blobs.get(p.slice(7));
      if (!b) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': b.type }); res.end(b.body); return;
    }
    let file;
    if (p === '/' || p === '/index.html') {
      const page = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(SKELETON_HEAD + page + '</body></html>');
      return;
    }
    if (p.startsWith('/__fonts/')) file = fontFile(p.slice(9));
    else if (p.startsWith('/__fixtures/')) file = path.join(HERE, 'fixtures', p.slice(12));
    else file = path.join(DIST, p);
    if (file && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    } else { res.writeHead(404); res.end(); }
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}

function fontFile(name) {
  const map = {
    'rubik-hebrew.woff2': 'fontsource-variable-rubik-5.1.1/package/files/rubik-hebrew-wght-normal.woff2',
    'rubik-latin.woff2': 'fontsource-variable-rubik-5.1.1/package/files/rubik-latin-wght-normal.woff2',
    'plex-400.woff2': 'fontsource-ibm-plex-mono-5.1.1/package/files/ibm-plex-mono-latin-400-normal.woff2',
    'plex-500.woff2': 'fontsource-ibm-plex-mono-5.1.1/package/files/ibm-plex-mono-latin-500-normal.woff2',
  };
  return map[name] ? path.join(VENDOR, map[name]) : null;
}

function fontCss(port) {
  const b = `http://127.0.0.1:${port}/__fonts/`;
  return `@font-face{font-family:'Rubik';font-style:normal;font-weight:300 900;font-display:swap;src:url(${b}rubik-hebrew.woff2) format('woff2');unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:'Rubik';font-style:normal;font-weight:300 900;font-display:swap;src:url(${b}rubik-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(${b}plex-400.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:500;font-display:swap;src:url(${b}plex-500.woff2) format('woff2')}`;
}

function cdnFile(url) {
  const m = /^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/]+\/)?[^@/]+)@([^/]+)\/(.+)$/.exec(url);
  if (!m) return null;
  const dir = m[1].replace('@', '').replace('/', '-') + '-' + m[2];
  return path.join(VENDOR, dir, 'package', m[3]);
}

export async function launch() {
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
}

/* A fresh context: CDN and font routes, the mock runtime, error capture. */
export async function newContext(browser, port, { mock = {}, viewport = { width: 1440, height: 900 }, scheme = 'light', mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  await ctx.route('https://cdn.jsdelivr.net/**', async (route) => {
    const f = cdnFile(route.request().url());
    if (f && fs.existsSync(f)) await route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) });
    else await route.fulfill({ status: 404, body: '' });
  });
  await ctx.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: fontCss(port) }));
  await ctx.route('https://fonts.gstatic.com/**', (route) => route.fulfill({ status: 404, body: '' }));
  const mockSrc = fs.readFileSync(path.join(HERE, 'mock.js'), 'utf8');
  const cfg = JSON.stringify(mock, (k, v) => (typeof v === 'function' ? '__fn__' + v.toString() : v));
  await ctx.addInitScript({ content: `window.__MOCK = JSON.parse(${JSON.stringify(cfg)}, (k, v) => typeof v === 'string' && v.startsWith('__fn__') ? eval('(' + v.slice(6) + ')') : v);\n${mockSrc}` });
  return ctx;
}

export function watch(page, bag) {
  page.on('pageerror', (e) => bag.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (/favicon|Failed to load resource: the server responded with a status of 404/.test(t)) return;
      bag.push('console: ' + t);
    }
  });
  page.on('requestfailed', (r) => { const u = r.url(); if (!/favicon|gstatic/.test(u)) bag.push('requestfailed: ' + u + ' ' + (r.failure() && r.failure().errorText)); });
}
