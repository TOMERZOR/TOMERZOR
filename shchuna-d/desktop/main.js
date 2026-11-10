// Windows shell for שכונה ד׳. The game is plain ES modules and fetches its assets, which a
// file:// page may not do, so the shell serves its own www folder on a loopback port and opens
// that in a full-screen window.
const { app, BrowserWindow, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'www');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ktx2': 'image/ktx2' };

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  server.listen(0, '127.0.0.1', () => {
    const win = new BrowserWindow({ width: 1600, height: 900, fullscreen: true, backgroundColor: '#0d0f12', autoHideMenuBar: true, title: 'שכונה ד׳',
      webPreferences: { contextIsolation: true, nodeIntegration: false } });
    win.loadURL(`http://127.0.0.1:${server.address().port}/index.html`);
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    });
  });
});
app.on('window-all-closed', () => app.quit());
