// שכונה ד׳ — entry point.
import { Game } from './game/game.js';

const game = new Game();
game.boot().catch((e) => {
  console.error(e);
  const tip = document.getElementById('boot-tip');
  if (tip) tip.textContent = 'הטעינה נכשלה: ' + (e && e.message ? e.message : e);
});
