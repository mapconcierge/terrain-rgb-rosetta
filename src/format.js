export const MINUS = '−';

export function fmtNum(v, maxDec = 6, minDec = 0) {
  const neg = v < 0;
  let s = Math.abs(v).toFixed(maxDec);
  if (s.includes('.')) {
    s = s.replace(/0+$/, '');
    let [i, d = ''] = s.split('.');
    d = d.padEnd(minDec, '0');
    s = d ? `${i}.${d}` : i;
  }
  return (neg && Number(s) !== 0 ? MINUS : '') + s;
}

export const fmtInt = (n) => Math.round(n).toLocaleString('en-US');

export function fmtH(id, h) {
  if (id === 'terrarium') return fmtNum(h, 6, 2);
  if (id === 'terrainrgb') return fmtNum(h, 1, 1);
  return fmtNum(h, 2, 2);
}

export const plain = (v, dec = 6) => String(Number(v.toFixed(dec)));

export const bin8 = (n) => n.toString(2).padStart(8, '0');
