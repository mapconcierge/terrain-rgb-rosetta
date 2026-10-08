import { SCHEMES, SCHEME_IDS, encodeH, xToRgb } from './codec.js';
import { fmtNum } from './format.js';

export const PRESETS = [0, 100, 3776, -100, -10000];
export const SWEEPS = [
  { label: '−11000〜9000 m', lo: -11000, hi: 9000 },
  { label: '−100〜100 m', lo: -100, hi: 100 },
  { label: '−2〜2 m', lo: -2, hi: 2 },
];

const rgbStr = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

export function buildCompare(root, onPick) {
  const head = ['<div></div>'];
  for (const h of PRESETS) {
    head.push(`<div class="cmp-h">${fmtNum(h, 0)} m<small>標高</small></div>`);
  }
  const rows = SCHEME_IDS.map((id) => {
    const sc = SCHEMES[id];
    const cells = PRESETS.map((h) => {
      const e = encodeH(id, h);
      const rgb = xToRgb(e.x);
      return `<button type="button" class="cmp-cell" data-id="${id}" data-h="${h}" aria-label="${sc.label} ${h} m を読み込む">
        <span class="sw" style="background:${rgbStr(rgb)}"></span>
        <span class="t2">(${rgb.join(', ')})</span></button>`;
    }).join('');
    return `<div class="cmp-l" style="--c:${sc.accent}"><i></i>${sc.label}</div>${cells}`;
  });
  root.innerHTML = head.join('') + rows.join('');
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.cmp-cell');
    if (b) onPick(b.dataset.id, Number(b.dataset.h));
  });
}

export function buildSweep(root, segRoot, onPickH) {
  let range = SWEEPS[1];
  const canvases = {};
  const cursors = [];
  const zeros = [];

  segRoot.innerHTML = SWEEPS.map((r, i) => `<button type="button" data-i="${i}" aria-pressed="${r === range}">${r.label}</button>`).join('');
  segRoot.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    range = SWEEPS[Number(b.dataset.i)];
    segRoot.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    layoutAxis();
    drawAll();
  });

  root.innerHTML = SCHEME_IDS.map((id) => {
    const sc = SCHEMES[id];
    return `<div class="cmp-l" style="--c:${sc.accent}"><i></i>${sc.label}</div>
      <div class="sw-canvas"><canvas data-id="${id}" aria-label="${sc.label} の色の変化"></canvas><div class="zero"></div><div class="cursor"></div></div>`;
  }).join('') + '<div class="axis" id="sweepAxis"></div>';
  root.querySelectorAll('.cursor').forEach((c) => cursors.push(c));
  root.querySelectorAll('.zero').forEach((c) => zeros.push(c));
  root.querySelectorAll('canvas').forEach((c) => { canvases[c.dataset.id] = c; });
  const axis = root.querySelector('#sweepAxis');

  function layoutAxis() {
    const { lo, hi } = range;
    const items = [[lo, 0], [hi, 1]];
    if (lo < 0 && hi > 0) items.push([0, -lo / (hi - lo)]);
    axis.innerHTML = items.map(([v, f]) => `<em style="left:${f * 100}%">${v === 0 ? '0' : fmtNum(v, 0)} m</em>`).join('');
    const z = lo < 0 && hi > 0 ? `${(-lo / (hi - lo)) * 100}%` : null;
    zeros.forEach((el) => { el.style.display = z ? 'block' : 'none'; if (z) el.style.left = z; });
  }

  function drawAll() {
    const dpr = window.devicePixelRatio || 1;
    for (const id of SCHEME_IDS) {
      const cv = canvases[id];
      const w = Math.max(1, Math.round(cv.clientWidth * dpr));
      const hgt = Math.max(1, Math.round(cv.clientHeight * dpr));
      cv.width = w;
      cv.height = hgt;
      const ctx = cv.getContext('2d');
      for (let i = 0; i < w; i++) {
        const h = range.lo + ((i + 0.5) / w) * (range.hi - range.lo);
        const e = encodeH(id, h);
        if (e.nodata) ctx.fillStyle = '#000';
        else ctx.fillStyle = rgbStr(xToRgb(e.x));
        ctx.fillRect(i, 0, 1, hgt);
      }
    }
  }

  let dragging = false;
  const pick = (e, cv) => {
    const r = cv.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const h = range.lo + f * (range.hi - range.lo);
    onPickH(cv.dataset.id, Number(h.toFixed(3)));
  };
  root.addEventListener('pointerdown', (e) => {
    const cv = e.target.closest('canvas');
    if (!cv) return;
    dragging = cv;
    cv.setPointerCapture(e.pointerId);
    pick(e, cv);
  });
  root.addEventListener('pointermove', (e) => { if (dragging) pick(e, dragging); });
  root.addEventListener('pointerup', () => { dragging = false; });
  root.addEventListener('pointercancel', () => { dragging = false; });

  new ResizeObserver(drawAll).observe(root);
  layoutAxis();

  return {
    setCursor(h) {
      const f = (h - range.lo) / (range.hi - range.lo);
      const show = f >= 0 && f <= 1;
      cursors.forEach((c) => { c.style.display = show ? 'block' : 'none'; if (show) c.style.left = `${f * 100}%`; });
    },
  };
}

