// Swipes (touch and mouse drag) and keyboard, turned into game actions.
// A swipe fires as soon as the finger has moved far enough, like the classic runners,
// so the response doesn't wait for the finger to lift.

export function createInput(target, onAction) {
  let sx = 0, sy = 0, st = 0, fired = false, active = false, pid = null;
  const threshold = () => Math.max(22, Math.min(window.innerWidth, window.innerHeight) * 0.045);

  function begin(x, y, id) { sx = x; sy = y; st = performance.now(); fired = false; active = true; pid = id; }
  function move(x, y) {
    if (!active || fired) return;
    const dx = x - sx, dy = y - sy, th = threshold();
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    fired = true;
    if (Math.abs(dx) > Math.abs(dy)) onAction(dx > 0 ? 'right' : 'left');
    else onAction(dy > 0 ? 'down' : 'up');
  }
  function end() {
    if (active && !fired && performance.now() - st < 260) onAction('tap');
    active = false; pid = null;
  }

  const opts = { passive: false };
  target.addEventListener('touchstart', e => {
    const t = e.changedTouches[0]; begin(t.clientX, t.clientY, t.identifier);
    if (e.cancelable) e.preventDefault();
  }, opts);
  target.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) if (t.identifier === pid) move(t.clientX, t.clientY);
    if (e.cancelable) e.preventDefault();
  }, opts);
  target.addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === pid) end(); }, opts);
  target.addEventListener('touchcancel', () => { active = false; }, opts);

  target.addEventListener('mousedown', e => { if (e.button === 0) begin(e.clientX, e.clientY, 'm'); });
  window.addEventListener('mousemove', e => { if (pid === 'm') move(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (pid === 'm') end(); });

  const keys = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down',
    Escape: 'pause', KeyP: 'pause', Enter: 'tap',
  };
  window.addEventListener('keydown', e => {
    const a = keys[e.code];
    if (!a) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (a !== 'tap' || !(e.target instanceof HTMLButtonElement)) e.preventDefault();
    if (e.repeat && a !== 'left' && a !== 'right') return;
    onAction(a, true);
  });
}
