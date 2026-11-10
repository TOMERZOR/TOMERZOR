// Windows shell for שכונה ד׳. It is only a window: the game itself is the live site, which keeps
// its own files on this computer (sw.js) and fetches whatever changed at each start. So this
// exe never needs replacing, and a save made here is still here tomorrow, because the address
// the game runs from is always the same.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const GAME = 'https://shchuna-d.moffy-app.workers.dev/';
const ORIGIN = new URL(GAME).origin;
let win = null;

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    win = new BrowserWindow({ width: 1600, height: 900, fullscreen: true, backgroundColor: '#0d0f12', autoHideMenuBar: true, title: 'שכונה ד׳',
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
    const offline = () => win.loadFile(path.join(__dirname, 'offline.html'));
    // with no network the stored copy still loads; this page only shows on a first start without one
    win.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => { if (isMainFrame && url.startsWith(ORIGIN)) offline(); });
    // the window shows the game and nothing else
    win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN) && !url.startsWith('file:')) e.preventDefault(); });
    win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
      if (input.key === 'F5') { win.loadURL(GAME); e.preventDefault(); }
    });
    win.loadURL(GAME);
  });
  app.on('window-all-closed', () => app.quit());
}
