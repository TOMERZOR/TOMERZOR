// שכונה ד׳ — entry point.
import { Game } from './game/game.js';

// On the live site a service worker keeps the files on the device (see sw.js). It is given a
// moment to take the page over first, so even the first start is stored. The phone apps and a
// local dev server carry no manifest and skip it.
async function keepOffline() {
  const sw = navigator.serviceWorker;
  const asked = new URLSearchParams(location.search).has('sw');          // lets a local copy of the deployed folder try it
  if (!sw || window.Capacitor || (!asked && (location.protocol !== 'https:' || location.hostname === 'localhost'))) return;
  try {
    await sw.register('sw.js');
    if (!sw.controller) await Promise.race([new Promise((r) => sw.addEventListener('controllerchange', r, { once: true })), new Promise((r) => setTimeout(r, 2500))]);
  } catch (e) { /* private window, old browser: the game runs from the network */ }
}

const game = new Game();
keepOffline().then(() => game.boot()).catch((e) => {
  console.error(e);
  const tip = document.getElementById('boot-tip');
  if (tip) tip.textContent = 'הטעינה נכשלה: ' + (e && e.message ? e.message : e);
});
