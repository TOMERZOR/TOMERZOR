// The garden on the home screen: one flower per level reached, plus a bud for the next level that
// grows with your XP. Seeing it fill up is the long-term reason to come back.
const TAU = Math.PI * 2;

export function drawGarden(cv, flowers, progress, now) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const c = cv.getContext('2d');
  const W = r.width, H = r.height;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);

  // a soft glow behind the flowers, then two rolling hills
  const glow = c.createRadialGradient(W / 2, H * 0.9, 0, W / 2, H * 0.9, W * 0.6);
  glow.addColorStop(0, 'rgba(255,170,130,0.22)'); glow.addColorStop(1, 'rgba(255,170,130,0)');
  c.fillStyle = glow; c.fillRect(0, 0, W, H);
  const ground = H * 0.8;
  const hill = (y0, amp, freq, phase, top, bottom) => {
    const g = c.createLinearGradient(0, y0 - amp, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) c.lineTo(x, y0 + Math.sin(x / freq + phase) * amp);
    c.lineTo(W, H); c.fill();
  };
  hill(ground - 4, 6, 70, 0.5, 'rgba(110,231,183,0.35)', 'rgba(16,185,129,0.15)');
  hill(ground + 8, 4, 50, 2, 'rgba(52,211,153,0.55)', 'rgba(5,150,105,0.35)');

  const list = flowers.slice(-14);
  const slots = list.length + 1;
  const gap = Math.min(54, (W - 40) / slots);
  const x0 = W / 2 - ((slots - 1) * gap) / 2;
  list.forEach((f, i) => drawFlower(c, x0 + i * gap, ground + 6, f, H, now, 1));
  drawFlower(c, x0 + list.length * gap, ground + 6, { hue: 20, petals: 5, height: 0.5, kind: 0 }, H, now, progress, true);
}

function drawFlower(c, x, y, f, H, now, grow, bud = false) {
  const h = (H * 0.5) * f.height * (bud ? 0.3 + 0.7 * grow : 1);
  const sway = Math.sin(now / 1000 + x * 0.05) * 3;
  const tx = x + sway, ty = y - h;
  c.strokeStyle = 'rgba(52,211,153,0.9)'; c.lineWidth = 2.5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x, y - h * 0.5, tx, ty); c.stroke();
  c.fillStyle = 'rgba(110,231,183,0.9)';
  c.beginPath(); c.ellipse(x + 6, y - h * 0.38, 7, 3, -0.6, 0, TAU); c.fill();
  if (bud && grow < 0.999) {
    // the next flower: a bud with a ring that fills with XP
    c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(tx, ty, 11, 0, TAU); c.stroke();
    c.strokeStyle = '#ffb38a';
    c.beginPath(); c.arc(tx, ty, 11, -Math.PI / 2, -Math.PI / 2 + TAU * grow); c.stroke();
    const g = c.createRadialGradient(tx - 2, ty - 3, 0, tx, ty, 7);
    g.addColorStop(0, '#bbf7d0'); g.addColorStop(1, '#22c55e');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(tx, ty, 4 + grow * 2.5, 6 + grow * 2.5, 0, 0, TAU); c.fill();
    return;
  }
  const pr = 9 + f.height * 6;
  for (let i = 0; i < f.petals; i++) {
    const a = (i / f.petals) * TAU + now / 5000;
    c.save(); c.translate(tx, ty); c.rotate(a);
    const g = c.createLinearGradient(0, 0, pr * 1.2, 0);
    g.addColorStop(0, `hsl(${f.hue} 85% 62%)`); g.addColorStop(1, `hsl(${f.hue} 95% 82%)`);
    c.fillStyle = g;
    c.beginPath();
    if (f.kind === 1) c.ellipse(pr * 0.62, 0, pr * 0.66, pr * 0.3, 0, 0, TAU);
    else if (f.kind === 2) { c.moveTo(0, 0); c.quadraticCurveTo(pr, -pr * 0.6, pr * 1.2, 0); c.quadraticCurveTo(pr, pr * 0.6, 0, 0); }
    else c.arc(pr * 0.58, 0, pr * 0.42, 0, TAU);
    c.fill(); c.restore();
  }
  c.fillStyle = '#fde68a';
  c.beginPath(); c.arc(tx, ty, pr * 0.3, 0, TAU); c.fill();
}
