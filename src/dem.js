export const TILE_URL = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
export const MAX_ZOOM = 17;

const cache = new Map();
let scratch;

function loadTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (!cache.has(key)) {
    const url = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    const p = fetch(url, { mode: 'cors' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
      .then((bmp) => {
        scratch ??= document.createElement('canvas');
        scratch.width = bmp.width;
        scratch.height = bmp.height;
        const ctx = scratch.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, bmp.width, bmp.height);
        ctx.drawImage(bmp, 0, 0);
        return { size: bmp.width, data: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
      });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    if (cache.size > 24) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}

export async function sampleRgb(lng, lat, zoom) {
  let z = Math.max(0, Math.min(MAX_ZOOM, Math.floor(zoom)));
  let lastErr;
  for (let i = 0; i < 6 && z >= 0; i++, z--) {
    try {
      const n = 2 ** z;
      const fx = ((lng + 180) / 360) * n;
      const fy = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
      const tx = ((Math.floor(fx) % n) + n) % n;
      const ty = Math.floor(fy);
      if (ty < 0 || ty >= n) throw new Error('out of range');
      const tile = await loadTile(z, tx, ty);
      const px = Math.min(tile.size - 1, Math.floor((fx - Math.floor(fx)) * tile.size));
      const py = Math.min(tile.size - 1, Math.floor((fy - Math.floor(fy)) * tile.size));
      const o = (py * tile.size + px) * 4;
      return { r: tile.data[o], g: tile.data[o + 1], b: tile.data[o + 2], z };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
