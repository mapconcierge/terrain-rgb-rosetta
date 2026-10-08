import { SCHEMES, U24, MAX_X, GSI_NODATA, earthSpan } from './codec.js';

const Y_RANGE = {
  terrarium: [-32768, 32768],
  terrainrgb: [-10000, 1667721.5],
  gsi: [-83886.08, 83886.08],
};
const TICKS = {
  terrarium: [[-32768, '−32768'], [0, '0'], [32768, '32768']],
  terrainrgb: [[-10000, '−10000'], [800000, '800k'], [1600000, '1.6M']],
  gsi: [[-83886, '−83886'], [0, '0'], [83886, '83886']],
};

export function hAt(id, x) {
  if (id === 'terrarium') return x / 256 - 32768;
  if (id === 'terrainrgb') return x / 10 - 10000;
  return x <= GSI_NODATA ? x / 100 : (x - U24) / 100;
}

const PAD = { l: 52, r: 12, t: 12, b: 26 };

export function createChart(canvas, id, onPick) {
  const accent = SCHEMES[id].accent;
  const [y0, y1] = Y_RANGE[id];
  const spans = earthSpan(id);
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let target = { x: 0, valid: true };
  let cur = 0;
  let raf = 0;
  let last = 0;

  const px = (x) => PAD.l + (x / U24) * (W - PAD.l - PAD.r);
  const py = (h) => PAD.t + (1 - (h - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function line(x1, y1x, x2, y2, style, w = 1, dash = []) {
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.lineWidth = w;
    ctx.strokeStyle = style;
    ctx.moveTo(x1, y1x);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = 'middle';
    const left = PAD.l;
    const right = W - PAD.r;
    const top = PAD.t;
    const bottom = H - PAD.b;

    for (const [v, label] of TICKS[id]) {
      const y = py(v);
      line(left, y, right, y, v === 0 ? '#323b49' : '#1f252e');
      ctx.fillStyle = '#7b8696';
      ctx.textAlign = 'right';
      ctx.fillText(label, left - 6, y);
    }
    ctx.textBaseline = 'alphabetic';
    for (const [x, label] of [[0, '0'], [U24 / 2, '2²³'], [U24, '2²⁴']]) {
      const xx = px(x);
      line(xx, top, xx, bottom, x === U24 / 2 && id !== 'gsi' ? '#262d38' : '#1f252e');
      ctx.fillStyle = '#7b8696';
      ctx.textAlign = x === 0 ? 'left' : x === U24 ? 'right' : 'center';
      ctx.fillText(label, xx, H - 8);
    }

    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.16;
    for (const [a, b] of spans) {
      const x1 = px(a);
      ctx.fillRect(x1, top, Math.max(2.5, px(b) - x1), bottom - top);
    }
    ctx.globalAlpha = 1;

    ctx.lineWidth = 2;
    ctx.strokeStyle = accent;
    ctx.lineCap = 'round';
    if (id === 'gsi') {
      const xm = px(GSI_NODATA);
      line(xm, top, xm, bottom, accent, 1, [4, 4]);
      ctx.beginPath();
      ctx.moveTo(px(0), py(0));
      ctx.lineTo(px(GSI_NODATA - 1), py(hAt(id, GSI_NODATA - 1)));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px(GSI_NODATA + 1), py(hAt(id, GSI_NODATA + 1)));
      ctx.lineTo(px(MAX_X), py(hAt(id, MAX_X)));
      ctx.stroke();
      ctx.fillStyle = '#12161c';
      for (const [xv, hv] of [[GSI_NODATA - 1, hAt(id, GSI_NODATA - 1)], [GSI_NODATA + 1, hAt(id, GSI_NODATA + 1)]]) {
        ctx.beginPath();
        ctx.arc(px(xv), py(hv), 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#ffb4a3';
      ctx.textAlign = 'left';
      ctx.fillText('x = 2²³ は無効', xm + 8, top + 12);
      ctx.fillText('この先は負へ折り返す', xm + 8, top + 25);
    } else {
      ctx.beginPath();
      ctx.moveTo(px(0), py(hAt(id, 0)));
      ctx.lineTo(px(MAX_X), py(hAt(id, MAX_X)));
      ctx.stroke();
    }

    const invalid = id === 'gsi' && !target.valid;
    const xv = invalid ? GSI_NODATA : cur;
    const hv = invalid ? 0 : hAt(id, xv);
    const dx = px(xv);
    const dy = py(hv);
    line(dx, dy, left, dy, accent + '80', 1, [3, 3]);
    line(dx, dy, dx, bottom, accent + '80', 1, [3, 3]);
    if (invalid) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(dx - 5, dy - 5); ctx.lineTo(dx + 5, dy + 5);
      ctx.moveTo(dx + 5, dy - 5); ctx.lineTo(dx - 5, dy + 5);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(dx, dy, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  }

  function tick(t) {
    const dt = Math.min(48, t - last);
    last = t;
    cur += (target.x - cur) * (1 - Math.exp(-dt / 55));
    const pxPerX = (W - PAD.l - PAD.r) / U24;
    if (Math.abs(target.x - cur) * pxPerX < 0.3) cur = target.x;
    draw();
    raf = cur === target.x ? 0 : requestAnimationFrame(tick);
  }

  function setTarget(x, valid, snap = false) {
    target = { x, valid };
    if (snap) { cur = x; draw(); return; }
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    const f = (e.clientX - r.left - PAD.l) / (r.width - PAD.l - PAD.r);
    onPick(id, Math.max(0, Math.min(MAX_X, Math.round(f * U24))));
  }
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    pick(e);
  });
  canvas.addEventListener('pointermove', (e) => { if (dragging) pick(e); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  new ResizeObserver(resize).observe(canvas);
  resize();
  return { setTarget };
}
