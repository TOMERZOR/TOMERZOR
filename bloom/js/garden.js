// The garden on the home screen: one flower per level reached, plus a bud for the next level that
// grows with your XP. Seeing it fill up is the long-term reason to come back.
const TAU = Math.PI * 2;

export function drawGarden(cv, flowers, progress, now) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const c = cv.getContext('2d');
  const W = r.width, H = r.height;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);

  // hills
  const ground = H * 0.78;
  c.fillStyle = '#2f8f5b';
  c.beginPath(); c.moveTo(0, ground + 6);
  for (let x = 0; x <= W; x += 10) c.lineTo(x, ground + Math.sin(x / 60) * 5);
  c.lineTo(W, H); c.lineTo(0, H); c.fill();
  c.fillStyle = '#3fb86f';
  c.beginPath(); c.moveTo(0, ground + 14);
  for (let x = 0; x <= W; x += 10) c.lineTo(x, ground + 12 + Math.sin(x / 45 + 1) * 4);
  c.lineTo(W, H); c.lineTo(0, H); c.fill();

  const list = flowers.slice(-14);
  const slots = list.length + 1;
  const gap = Math.min(52, (W - 30) / slots);
  const x0 = W / 2 + ((slots - 1) * gap) / 2; // right to left, like the page
  list.forEach((f, i) => drawFlower(c, x0 - i * gap, ground + 4, f, H, now, 1));
  // the next flower: a bud that rises and opens with XP
  drawFlower(c, x0 - list.length * gap, ground + 4, { hue: 50, petals: 5, height: 0.5, kind: 0 }, H, now, progress, true);
}

function drawFlower(c, x, y, f, H, now, grow, bud = false) {
  const h = (H * 0.55) * f.height * (bud ? 0.3 + 0.7 * grow : 1);
  const sway = Math.sin(now / 900 + x) * 4;
  const tx = x + sway, ty = y - h;
  c.strokeStyle = '#1f7a45'; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x, y - h * 0.5, tx, ty); c.stroke();
  c.fillStyle = '#2fae5e';
  c.beginPath(); c.ellipse(x + 7, y - h * 0.35, 8, 3.5, -0.6, 0, TAU); c.fill();
  if (bud && grow < 0.999) {
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath(); c.arc(tx, ty, 9, 0, TAU); c.fill();
    c.fillStyle = '#7ad67a';
    c.beginPath(); c.ellipse(tx, ty, 5 + grow * 3, 8 + grow * 3, 0, 0, TAU); c.fill();
    c.fillStyle = '#ffd23d';
    c.font = '800 11px Fredoka, sans-serif'; c.textAlign = 'center';
    c.fillText(`${Math.floor(grow * 100)}%`, tx, ty - 16);
    return;
  }
  const pr = 9 + f.height * 6;
  const color = `hsl(${f.hue} 90% 66%)`, dark = `hsl(${f.hue} 80% 50%)`;
  for (let i = 0; i < f.petals; i++) {
    const a = (i / f.petals) * TAU + now / 4000;
    c.save(); c.translate(tx, ty); c.rotate(a);
    c.fillStyle = i % 2 ? color : dark;
    c.beginPath();
    if (f.kind === 1) c.ellipse(pr * 0.65, 0, pr * 0.7, pr * 0.32, 0, 0, TAU);
    else if (f.kind === 2) { c.moveTo(0, 0); c.quadraticCurveTo(pr, -pr * 0.6, pr * 1.2, 0); c.quadraticCurveTo(pr, pr * 0.6, 0, 0); }
    else c.arc(pr * 0.6, 0, pr * 0.45, 0, TAU);
    c.fill(); c.restore();
  }
  c.fillStyle = '#ffd23d';
  c.beginPath(); c.arc(tx, ty, pr * 0.35, 0, TAU); c.fill();
  c.fillStyle = '#ff9f1c';
  c.beginPath(); c.arc(tx + 1, ty + 1, pr * 0.18, 0, TAU); c.fill();
}
