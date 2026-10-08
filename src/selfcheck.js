import { SCHEME_IDS, SCHEMES, decodeX, encodeH, rgbToX, xToRgb, GSI_NODATA, MAX_X } from './codec.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

export function runSelfCheck() {
  const out = [];
  const add = (name, ok) => out.push({ name, ok: !!ok });

  const roundTrip = (id, h, rgb, back, tol = 1e-9) => {
    const e = encodeH(id, h);
    const d = decodeX(id, e.x);
    return same(xToRgb(e.x), rgb) && d.valid && near(d.h, back, tol);
  };

  add('Terrarium 2523.266 m → RGB(137, 219, 68) → 2523.265625 m', roundTrip('terrarium', 2523.266, [137, 219, 68], 2523.265625));
  add('Terrain-RGB 0 m → RGB(1, 134, 160) → 0 m', roundTrip('terrainrgb', 0, [1, 134, 160], 0));
  add('3776 m  Terrarium → RGB(142, 192, 0)', roundTrip('terrarium', 3776, [142, 192, 0], 3776));
  add('3776 m  Terrain-RGB → RGB(2, 26, 32)', roundTrip('terrainrgb', 3776, [2, 26, 32], 3776, 1e-6));
  add('3776 m  地理院 → RGB(5, 195, 0)', roundTrip('gsi', 3776, [5, 195, 0], 3776));
  add('地理院 −100 m → RGB(255, 216, 240) → −100 m', roundTrip('gsi', -100, [255, 216, 240], -100));
  add('海面 0 m  Terrarium → RGB(128, 0, 0)', roundTrip('terrarium', 0, [128, 0, 0], 0));
  add('海面 0 m  地理院 → RGB(0, 0, 0)', roundTrip('gsi', 0, [0, 0, 0], 0));
  add('地理院 RGB(128, 0, 0) は無効', decodeX('gsi', rgbToX(128, 0, 0)).valid === false && rgbToX(128, 0, 0) === GSI_NODATA);
  add('地理院 x=2²³−1 は +83886.07 m、x=2²³+1 は −83886.07 m',
    near(decodeX('gsi', GSI_NODATA - 1).h, 83886.07) && near(decodeX('gsi', GSI_NODATA + 1).h, -83886.07));
  add('地理院 −83886.08 m は無効に隣接', encodeH('gsi', -83886.08).nodata === true);
  add('範囲外はクランプされる', encodeH('terrarium', 1e6).clamped === 'max' && encodeH('terrainrgb', -20000).clamped === 'min' && encodeH('gsi', 1e6).clamped === 'max');

  let sweep = true;
  for (const id of SCHEME_IDS) {
    for (let i = 0; i < 4000; i++) {
      const x = Math.floor((i / 3999) * MAX_X);
      const d = decodeX(id, x);
      if (!d.valid) continue;
      if (encodeH(id, d.h).x !== x) { sweep = false; break; }
    }
  }
  add('3方式 × 4000点で x → 標高 → x が一致', sweep);

  let mono = true;
  let prev = -Infinity;
  for (let x = 0; x < GSI_NODATA; x += 9973) {
    const h = decodeX('gsi', x).h;
    if (h < prev) mono = false;
    prev = h;
  }
  add('地理院は 2²³ の手前まで単調、その先は負へ折り返す', mono && decodeX('gsi', GSI_NODATA + 1).h < 0);

  return { ok: out.every((r) => r.ok), passed: out.filter((r) => r.ok).length, total: out.length, results: out };
}
