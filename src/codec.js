export const U24 = 16777216;
export const MAX_X = U24 - 1;
export const GSI_NODATA = 8388608;

export const rgbToX = (r, g, b) => r * 65536 + g * 256 + b;
export const xToRgb = (x) => [(x >>> 16) & 255, (x >>> 8) & 255, x & 255];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const norm0 = (v) => (v === 0 ? 0 : v);

const TERRARIUM_MAX_V = 65536 - 1 / 256;

function encodeTerrarium(h) {
  let v = h + 32768;
  let clamped = null;
  if (v < 0) { v = 0; clamped = 'min'; }
  else if (v > TERRARIUM_MAX_V) { v = TERRARIUM_MAX_V; clamped = 'max'; }
  const r = Math.floor(v / 256);
  const g = Math.floor(v % 256);
  const b = Math.floor((v - Math.floor(v)) * 256);
  return { x: rgbToX(r, g, b), clamped, nodata: false, adjacent: false };
}

function encodeTerrainRgb(h) {
  const raw = Math.round((h + 10000) / 0.1);
  const x = clamp(raw, 0, MAX_X);
  const clamped = raw < 0 ? 'min' : raw > MAX_X ? 'max' : null;
  return { x, clamped, nodata: false, adjacent: false };
}

function encodeGsi(h) {
  const n = norm0(Math.round(h / 0.01));
  let clamped = null;
  let x;
  if (n >= 0) {
    if (n > GSI_NODATA - 1) { x = GSI_NODATA - 1; clamped = 'max'; }
    else x = n;
  } else {
    let m = n;
    if (m < -GSI_NODATA) { m = -(GSI_NODATA - 1); clamped = 'min'; }
    x = m + U24;
  }
  const nodata = x === GSI_NODATA;
  return { x, clamped, nodata, adjacent: nodata && clamped === null };
}

export const SCHEMES = {
  terrarium: {
    id: 'terrarium',
    label: 'Terrarium',
    sub: 'Mapzen / AWS Terrain Tiles',
    accent: '#2dd4bf',
    resolution: 1 / 256,
    resolutionText: '1/256 m ≈ 0.0039 m',
    rangeText: '−32768 〜 32767.996 m',
    min: -32768,
    max: 32768 - 1 / 256,
    unitPerX: 1 / 256,
    decode: (r, g, b) => ({ valid: true, h: r * 256 + g + b / 256 - 32768 }),
    encode: encodeTerrarium,
  },
  terrainrgb: {
    id: 'terrainrgb',
    label: 'Terrain-RGB',
    sub: 'Mapbox / MapTiler',
    accent: '#f5a524',
    resolution: 0.1,
    resolutionText: '0.1 m',
    rangeText: '−10000 〜 1,667,721.5 m',
    min: -10000,
    max: -10000 + MAX_X * 0.1,
    unitPerX: 0.1,
    decode: (r, g, b) => ({ valid: true, h: -10000 + rgbToX(r, g, b) / 10 }),
    encode: encodeTerrainRgb,
  },
  gsi: {
    id: 'gsi',
    label: '地理院標高タイル',
    sub: '国土地理院 PNG 標高タイル',
    accent: '#ff5a36',
    resolution: 0.01,
    resolutionText: '0.01 m',
    rangeText: '−83886.08 〜 83886.07 m（無効点を除く）',
    min: -(GSI_NODATA - 1) / 100,
    max: (GSI_NODATA - 1) / 100,
    unitPerX: 0.01,
    decode: (r, g, b) => {
      const x = rgbToX(r, g, b);
      if (x === GSI_NODATA) return { valid: false, h: null };
      return { valid: true, h: x < GSI_NODATA ? x / 100 : (x - U24) / 100 };
    },
    encode: encodeGsi,
  },
};

export const SCHEME_IDS = ['terrarium', 'terrainrgb', 'gsi'];

export const decodeX = (id, x) => SCHEMES[id].decode(...xToRgb(x));
export const encodeH = (id, h) => SCHEMES[id].encode(h);

export function bitWeight(id, bit) {
  if (id === 'terrarium') return 2 ** bit / 256;
  if (id === 'terrainrgb') return 2 ** bit / 10;
  return bit === 23 ? -(2 ** 23) / 100 : 2 ** bit / 100;
}

export function earthSpan(id, lo = -11000, hi = 9000) {
  const a = encodeH(id, lo).x;
  const b = encodeH(id, hi).x;
  if (id === 'gsi') return [[0, b], [a, MAX_X]];
  return [[a, b]];
}
