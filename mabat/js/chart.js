// The price chart: a line in the style of the Stocks app, with the moving averages, volume, and the
// entry, stop and target lines. Touch and drag to read any day.

const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
export const MA_COLORS = { sma20: '#40C8E0', sma50: '#FF9F0A', sma200: '#BF5AF2' };

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function niceStep(range, count) {
  const raw = range / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

const fmtPrice = v => (v >= 1000 ? v.toFixed(0) : v >= 100 ? v.toFixed(1) : v.toFixed(2));

export class Chart {
  constructor(canvas, { onScrub } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onScrub = onScrub;
    this.data = null;
    this.scrub = null;
    this.resize = new ResizeObserver(() => this.draw());
    this.resize.observe(canvas);
    const at = e => {
      const rect = canvas.getBoundingClientRect();
      return this.indexAt(e.clientX - rect.left);
    };
    const move = e => {
      if (!this.data) return;
      const i = at(e);
      if (i === this.scrub) return;
      this.scrub = i;
      this.draw();
      this.onScrub?.(i == null ? null : this.view[i], i == null ? null : this.view[i - 1] || null);
    };
    const end = () => {
      if (this.scrub == null) return;
      this.scrub = null;
      this.draw();
      this.onScrub?.(null);
    };
    canvas.addEventListener('pointerdown', move);
    canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons || e.pressure) move(e); });
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', end);
  }

  destroy() { this.resize.disconnect(); }

  // data: { bars: [{t,o,h,l,c,v}], series: {sma20,...}, levels, days, show: {sma20, sma50, sma200} }
  set(data) {
    this.data = data;
    this.scrub = null;
    this.draw();
  }

  layout() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return { w, h, left: 2, right: w - 46, top: 10, bottom: h - 22, volTop: h - 22 - Math.round((h - 32) * 0.17) };
  }

  indexAt(x) {
    if (!this.view?.length) return null;
    const L = this.layout();
    const f = (x - L.left) / (L.right - L.left);
    return Math.max(0, Math.min(this.view.length - 1, Math.round(f * (this.view.length - 1))));
  }

  draw() {
    const { canvas, ctx } = this;
    const dpr = window.devicePixelRatio || 1;
    const L = this.layout();
    if (!L.w || !L.h) return;
    if (canvas.width !== Math.round(L.w * dpr) || canvas.height !== Math.round(L.h * dpr)) {
      canvas.width = Math.round(L.w * dpr);
      canvas.height = Math.round(L.h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L.w, L.h);
    if (!this.data?.bars?.length) return;

    const { bars, series = {}, levels, days = 126, show = {} } = this.data;
    const start = Math.max(0, bars.length - days);
    const view = bars.slice(start);
    this.view = view;
    const ma = Object.fromEntries(Object.entries(series).filter(([k]) => show[k]).map(([k, s]) => [k, s.slice(start)]));

    const values = view.map(b => b.c);
    for (const s of Object.values(ma)) for (const v of s) if (v != null) values.push(v);
    const lv = levels ? [levels.entry, levels.stop, levels.t1, levels.t2, levels.trigger].filter(v => v != null) : [];
    values.push(...lv);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const pad = (hi - lo || hi * 0.02) * 0.08;
    lo -= pad;
    hi += pad;
    const priceBottom = L.volTop - 6;
    const x = i => L.left + (i / Math.max(1, view.length - 1)) * (L.right - L.left);
    const y = v => L.top + (1 - (v - lo) / (hi - lo)) * (priceBottom - L.top);

    const up = view[view.length - 1].c >= view[0].c;
    const color = up ? css('--green-ink') : css('--red-ink');
    const muted = css('--label-3');
    const grid = css('--separator');
    ctx.font = '500 11px -apple-system, "SF Pro Text", Heebo, system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    // grid and price labels
    const step = niceStep(hi - lo, 4);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = muted;
    ctx.textAlign = 'left';
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      const yy = Math.round(y(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(L.left, yy);
      ctx.lineTo(L.right, yy);
      ctx.stroke();
      ctx.fillText(fmtPrice(v), L.right + 6, yy);
    }

    // month labels
    ctx.textAlign = 'center';
    let lastLabel = -Infinity;
    for (let i = 1; i < view.length; i++) {
      const a = new Date(view[i - 1].t * 1000);
      const b = new Date(view[i].t * 1000);
      const monthly = days > 40;
      const boundary = monthly ? a.getUTCMonth() !== b.getUTCMonth() : b.getUTCDay() < a.getUTCDay();
      if (!boundary || x(i) - lastLabel < 34) continue;
      lastLabel = x(i);
      ctx.fillText(monthly ? MONTHS[b.getUTCMonth()] : `${b.getUTCDate()}.${b.getUTCMonth() + 1}`, x(i), L.h - 9);
    }

    // volume
    const vmax = Math.max(...view.map(b => b.v || 0)) || 1;
    const bw = Math.max(1, ((L.right - L.left) / view.length) * 0.62);
    for (let i = 0; i < view.length; i++) {
      const b = view[i];
      const hgt = ((b.v || 0) / vmax) * (L.bottom - L.volTop);
      ctx.fillStyle = (b.c >= (view[i - 1]?.c ?? b.o) ? css('--green') : css('--red')) + '55';
      ctx.fillRect(x(i) - bw / 2, L.bottom - hgt, bw, hgt);
    }

    // baseline at the first close of the range
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = muted;
    ctx.beginPath();
    ctx.moveTo(L.left, y(view[0].c));
    ctx.lineTo(L.right, y(view[0].c));
    ctx.stroke();
    ctx.setLineDash([]);

    // moving averages
    for (const [k, s] of Object.entries(ma)) {
      ctx.strokeStyle = MA_COLORS[k];
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      let moved = false;
      s.forEach((v, i) => {
        if (v == null) return;
        if (!moved) { ctx.moveTo(x(i), y(v)); moved = true; } else ctx.lineTo(x(i), y(v));
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // price line with a soft fill
    const grad = ctx.createLinearGradient(0, L.top, 0, priceBottom);
    grad.addColorStop(0, color + '38');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    view.forEach((b, i) => (i ? ctx.lineTo(x(i), y(b.c)) : ctx.moveTo(x(i), y(b.c))));
    ctx.lineTo(x(view.length - 1), priceBottom);
    ctx.lineTo(x(0), priceBottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    view.forEach((b, i) => (i ? ctx.lineTo(x(i), y(b.c)) : ctx.moveTo(x(i), y(b.c))));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // entry / stop / target / trigger lines with a tag on the price axis
    if (levels) {
      const tags = [
        ['t2', 'יעד 2', css('--green-ink')],
        ['t1', 'יעד 1', css('--green-ink')],
        ['entry', 'כניסה', css('--blue')],
        ['trigger', 'טריגר', css('--orange')],
        ['stop', 'סטופ', css('--red-ink')],
      ].filter(([k]) => levels[k] != null && !(k === 'entry' && levels.pending)).map(([k, label, c]) => ({ k, label, c, y: Math.round(y(levels[k])) + 0.5 }));
      // tags on the price axis are pushed apart so they never overlap
      tags.sort((a, b) => a.y - b.y);
      for (let k = 0; k < tags.length; k++) tags[k].ty = k ? Math.max(tags[k].y, tags[k - 1].ty + 20) : tags[k].y;
      for (const tg of tags) {
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = tg.c;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(L.left, tg.y);
        ctx.lineTo(L.right, tg.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const text = fmtPrice(levels[tg.k]);
        const tw = ctx.measureText(text).width + 10;
        ctx.fillStyle = tg.c;
        roundRect(ctx, L.right + 2, tg.ty - 9, Math.max(tw, 42), 18, 5);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(text, L.right + 7, tg.ty + 0.5);
      }
      // names next to the lines, above or below so they don't collide
      ctx.font = '600 10.5px -apple-system, "SF Pro Text", Heebo, system-ui, sans-serif';
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      tags.forEach((tg, k) => {
        const gapAbove = k > 0 ? tg.y - tags[k - 1].y : Infinity;
        const gapBelow = k < tags.length - 1 ? tags[k + 1].y - tg.y : Infinity;
        if (gapAbove < 13 && gapBelow < 13) return; // squeezed between two lines: the tag on the axis is enough
        const below = gapAbove < 16;
        if (below && gapBelow < 16) return;
        ctx.fillStyle = tg.c;
        ctx.fillText(tg.label, L.right - 4, below ? tg.y + 9 : tg.y - 9);
      });
      ctx.direction = 'ltr';
      ctx.font = '500 11px -apple-system, "SF Pro Text", Heebo, system-ui, sans-serif';
    }

    // the last point
    const lx = x(view.length - 1);
    const ly = y(view[view.length - 1].c);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // scrubbing
    if (this.scrub != null && view[this.scrub]) {
      const sx = x(this.scrub);
      const sy = y(view[this.scrub].c);
      ctx.strokeStyle = css('--label-2');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, L.top - 4);
      ctx.lineTo(sx, L.bottom);
      ctx.stroke();
      ctx.fillStyle = css('--card');
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A small sparkline as inline SVG.
export function sparkline(values, { width = 72, height = 30, up } = {}) {
  if (!values?.length) return '';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - lo) / span) * (height - 4)).toFixed(1)}`).join(' ');
  const isUp = up ?? values[values.length - 1] >= values[0];
  return `<svg class="spark ${isUp ? 'is-up' : 'is-down'}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
