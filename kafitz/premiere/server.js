// Local server for the Premiere panel. Runs in the panel's Node context (CEP) and serves:
//   - the extension's own files, so the panel runs on an http://127.0.0.1 origin (module workers, Cache API);
//   - the clips' media files, for transcription and the preview;
//   - writes of the rendered caption frames.
// It listens on 127.0.0.1 only. Media reads and all writes need a random per-session token,
// and writes are only allowed inside a folder named "Kafitz Captions".
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
  '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
  '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.mxf': 'application/mxf',
};
const OUT_DIR = 'Kafitz Captions';

function sendFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end(); return; }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      let start = range[1] ? +range[1] : st.size - +range[2];
      let end = range[1] && range[2] ? +range[2] : st.size - 1;
      if (!range[1]) end = st.size - 1;
      start = Math.max(0, start); end = Math.min(end, st.size - 1);
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
      res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(file).pipe(res);
    }
  });
}

const insideOutDir = (p) => path.resolve(p).split(path.sep).includes(OUT_DIR);

function readBody(req, cb) {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => cb(Buffer.concat(chunks)));
}

function createServer(root, token) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const authed = req.headers['x-kafitz-token'] === token || url.searchParams.get('t') === token;
    const p = url.searchParams.get('p');
    try {
      if (url.pathname === '/api/info' && authed) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ home: os.homedir(), sep: path.sep, platform: process.platform, outDir: OUT_DIR }));
      } else if (url.pathname === '/api/media' && authed && p) {
        sendFile(req, res, p);
      } else if (url.pathname === '/api/write' && req.method === 'PUT' && req.headers['x-kafitz-token'] === token && p && insideOutDir(p)) {
        readBody(req, (buf) => {
          fs.mkdirSync(path.dirname(p), { recursive: true });
          fs.writeFile(p, buf, (err) => { res.writeHead(err ? 500 : 204); res.end(err ? String(err) : undefined); });
        });
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        // The extension's own files.
        const file = path.join(root, decodeURIComponent(url.pathname));
        if (!path.resolve(file).startsWith(path.resolve(root))) { res.writeHead(403); res.end(); return; }
        sendFile(req, res, file);
      } else {
        res.writeHead(403); res.end();
      }
    } catch (err) {
      res.writeHead(500); res.end(String(err));
    }
  });
}

// Starts on the first free port from 48219. A stable port keeps the browser's model cache between sessions.
exports.start = function start(root, cb) {
  const token = crypto.randomBytes(16).toString('hex');
  const server = createServer(root, token);
  let port = 48219;
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < 48239) { port++; server.listen(port, '127.0.0.1'); }
    else cb(err);
  });
  server.on('listening', () => cb(null, { port, token, server }));
  server.listen(port, '127.0.0.1');
};
