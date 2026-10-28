// Boot: fonts, world, title screen, main loop.
import * as THREE from 'three';
import { World } from './world.js';
import { UI } from './ui.js';
import { Game, careerSummary } from './game.js';
import { PROS, PRO_ORDER } from './data.js';
import { unlock, startMusic, sfx } from './audio.js';

const TS = +new URLSearchParams(location.search).get('ts') || 1; // time scale, for testing
const hex = n => '#' + n.toString(16).padStart(6, '0');

async function boot() {
  try {
    await Promise.race([
      Promise.all(['700 50px Fredoka', '500 30px Fredoka', '800 70px Rubik'].map(f => document.fonts.load(f, 'אבג'))),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch {}

  const world = new World(document.getElementById('game'));
  const ui = new UI(world);
  const game = new Game(world, ui);
  window.__mk = { world, ui, game }; // handy for debugging from the console

  const title = document.getElementById('title');
  const showTitle = () => {
    game.cleanup();
    ui.hud(false); ui.enabled = false; ui.ribbon(null);
    document.getElementById('excuseBtn').hidden = true;
    const saves = careerSummary().careers || {};
    const box = document.getElementById('pros'); box.innerHTML = '';
    PRO_ORDER.forEach((id, i) => {
      const p = PROS[id], s = saves[id];
      const b = document.createElement('button');
      b.className = 'pro'; b.style.animationDelay = `${0.15 + i * 0.06}s`;
      b.innerHTML = `<div class="em" style="background:${hex(p.hatColor === 0xffffff ? p.shirt : p.hatColor)}">${p.emoji}</div><div class="nm">${p.name}</div><div class="tg">${p.tagline}</div>${s ? `<div class="sv">רמה ${s.level} · יום ${s.day}</div>` : ''}`;
      b.addEventListener('click', () => {
        unlock(); startMusic(); sfx.upgrade();
        title.classList.add('out');
        setTimeout(() => { title.hidden = true; title.classList.remove('out'); game.start(id); }, 380);
      });
      box.appendChild(b);
    });
    title.hidden = false;
  };
  game.onSwitch = showTitle;
  showTitle();

  addEventListener('resize', () => world.resize());
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.save?.(); });

  const clock = new THREE.Clock();
  let t = 0;
  const orbit = new THREE.Vector3();
  const loop = () => {
    const dt = Math.min(0.05, clock.getDelta()) * TS;
    t += dt;
    if (game.running) {
      game.update(dt, t);
      world.update(dt, t, game.player.position);
      world.followCam(game.player.position, dt);
    } else {
      world.update(dt, t, null);
      // slow drift across the neighbourhood behind the title
      orbit.set(Math.sin(t * 0.08) * 9, 0, Math.cos(t * 0.06) * 6 - 2);
      world.followCam(orbit, dt);
      world.setDayTime(0.35);
    }
    ui.updateTracked();
    world.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
boot();
