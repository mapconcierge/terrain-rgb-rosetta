import './style.css';
import {
  SCHEMES, SCHEME_IDS, GSI_NODATA, U24,
  rgbToX, xToRgb, decodeX, encodeH, bitWeight, earthSpan,
} from './codec.js';
import { fmtNum, fmtInt, fmtH, plain, bin8, MINUS } from './format.js';
import { runSelfCheck } from './selfcheck.js';
import { initTips, refreshTip, toast } from './tip.js';
import { createChart } from './charts.js';
import { buildCompare, buildSweep } from './compare.js';
import { sampleRgb } from './dem.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const CH = ['R', 'G', 'B'];
const CH_JA = { R: '赤', G: '緑', B: '青' };
const START_H = 3776;

const S = {
  active: 'terrarium',
  align: true,
  step: 0.01,
  h: START_H,
  x: {},
  info: {},
};
for (const id of SCHEME_IDS) {
  S.info[id] = { clamped: null, adjacent: false };
}

/* ---------- state transitions ---------- */

function applyH(h, ids = S.align ? SCHEME_IDS : [S.active]) {
  if (!Number.isFinite(h)) return;
  S.h = h;
  const hit = [];
  for (const id of ids) {
    const e = encodeH(id, h);
    S.x[id] = e.x;
    S.info[id] = { clamped: e.clamped, adjacent: e.adjacent };
    if (e.clamped) hit.push(id);
  }
  render();
  hit.forEach(flash);
}

function setX(id, x) {
  S.x[id] = x;
  S.info[id] = { clamped: null, adjacent: false };
  const d = decodeX(id, x);
  const hit = [];
  if (d.valid) {
    S.h = d.h;
    if (S.align) {
      for (const other of SCHEME_IDS) {
        if (other === id) continue;
        const e = encodeH(other, d.h);
        S.x[other] = e.x;
        S.info[other] = { clamped: e.clamped, adjacent: e.adjacent };
        if (e.clamped) hit.push(other);
      }
    }
  }
  render();
  hit.forEach(flash);
}

function activate(id) {
  S.active = id;
  if (!S.align) {
    const d = decodeX(id, S.x[id]);
    if (d.valid) S.h = d.h;
  }
  render();
}

function pickH(id, h) {
  S.active = id;
  applyH(h, S.align ? SCHEME_IDS : [id]);
}

function flash(id) {
  const el = cardEls[id].root;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

/* ---------- card markup ---------- */

const CH_WEIGHT = {
  terrarium: ['256 m', '1 m', '1/256 m'],
  terrainrgb: ['6553.6 m', '25.6 m', '0.1 m'],
  gsi: ['655.36 m', '2.56 m', '0.01 m'],
};

const STUDENT = {
  terrarium: '赤は256m刻み、緑は1m刻み、青は1mを256分割した余り。最後に32768mを引くので、海の底も表せる。',
  terrainrgb: '赤は6553.6m刻み、緑は25.6m刻み、青は0.1m刻み。3つを合わせた数に0.1mを掛けて、最後に10000mを引く。',
  gsi: '赤は655.36m刻み、緑は2.56m刻み、青は0.01m刻み。合計 x が 2²³ より大きいと、2²⁴ を引いてマイナスに折り返す。ちょうど 2²³ は「データなし」。',
};

const WHY = {
  terrarium: '24bit の整数は 0 以上しか表せません。そこで読むときに 32768 m を引き、負の標高を表します。そのため 0 m は RGB(128, 0, 0) になります。青は「1 m を 256 分割した端数」なので、細かい変化はほぼ青だけが担当します。',
  terrainrgb: '−10000 m を 0 として、0.1 m 刻みで何番目かを数えています。0 m は 100000 番目なので RGB(1, 134, 160)、−10000 m は RGB(0, 0, 0)。式が一次式なので、グラフは直線です。',
  gsi: 'x が 2²³ 未満なら x × 0.01 m。2²³ を超えると x から 2²⁴ を引くので負になります（2 の補数と同じ考え方）。x = 2²³ ちょうどは「データなし」で RGB(128, 0, 0)。0 m のすぐ下の −0.01 m は RGB(255, 255, 255)、0 m は RGB(0, 0, 0) なので、0 をまたぐと白と黒が入れ替わります。',
};

function cardHTML(id) {
  const sc = SCHEMES[id];
  const groups = CH.map((ch, gi) => {
    const cells = [];
    for (let k = 7; k >= 0; k--) {
      const bit = 16 - gi * 8 + k;
      cells.push(`<button type="button" class="bit${id === 'gsi' && bit === 23 ? ' sign' : ''}" data-bit="${bit}" data-k="${k}">0</button>`);
    }
    return `<div class="bgroup" data-ch="${ch}">
      <div class="bg-h"><b>${ch} <span class="chv">0</span></b><span class="bw">×${CH_WEIGHT[id][gi]}</span></div>
      <div class="bcells">${cells.join('')}</div></div>`;
  }).join('');

  return `<article class="card" data-id="${id}" style="--accent:${sc.accent}">
    <div class="card-h">
      <i class="dot"></i><h2>${sc.label}</h2><span class="sub">${sc.sub}</span>
      <span class="spacer"></span>
      <span class="chip" data-tip="x が 1 増えたときの標高の変化（DN 1つぶん）">分解能 ${sc.resolutionText}</span>
      <span class="chip">範囲 ${sc.rangeText}</span>
      <span class="badge">操作中</span>
    </div>
    <div class="card-b">
      <button type="button" class="face" aria-label="${sc.label} を選ぶ">
        <span class="f-top">標高 h</span>
        <span class="f-h"></span>
        <span class="f-bot"></span>
      </button>
      <div class="mid">
        ${id === 'gsi' ? '<div class="fold-flag">2²³ の位置：ここから符号が折り返す</div>' : ''}
        <div class="bits">${groups}</div>
        <div class="formula">
          <div class="f-student"><p class="sent">${STUDENT[id]}</p><div class="contrib"></div></div>
          <div class="f-full"></div>
        </div>
        ${id === 'gsi' ? '<p class="warnbox">地理院だけ途中で符号が折り返すので、色の明るさ＝標高の高さ、にはならない</p>' : ''}
        <div class="status"><span class="st-text"></span>${id === 'gsi' ? '<button type="button" class="btn mini" data-act="nodata">データなしにする</button>' : ''}</div>
        <details class="why"><summary>なぜ？</summary><p>${WHY[id]}</p></details>
      </div>
    </div>
  </article>`;
}

const cardEls = {};
function buildCards() {
  const root = $('#cards');
  root.innerHTML = SCHEME_IDS.map(cardHTML).join('');
  for (const id of SCHEME_IDS) {
    const r = $(`.card[data-id="${id}"]`, root);
    cardEls[id] = {
      root: r,
      face: $('.face', r),
      fh: $('.f-h', r),
      fbot: $('.f-bot', r),
      bits: $$('.bit', r),
      chv: $$('.chv', r),
      contrib: $('.contrib', r),
      full: $('.f-full', r),
      status: $('.status', r),
      stText: $('.st-text', r),
    };
  }
  root.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    const bit = e.target.closest('.bit');
    if (bit) {
      S.active = id;
      setX(id, S.x[id] ^ (1 << Number(bit.dataset.bit)));
      refreshTip();
      return;
    }
    if (e.target.closest('[data-act="nodata"]')) {
      S.active = id;
      setX(id, GSI_NODATA);
      return;
    }
    if (e.target.closest('details')) return;
    if (S.active !== id) activate(id);
  });
  root.addEventListener('mouseover', (e) => {
    const t = e.target.closest('.t[data-hl]');
    const card = e.target.closest('.card');
    if (card) card.dataset.hl = t ? t.dataset.hl : '';
  });
  root.addEventListener('mouseleave', () => $$('.card', root).forEach((c) => { c.dataset.hl = ''; }));
}

/* ---------- formulas ---------- */

function term(ch, text, zero) {
  return `<span class="t ${ch.toLowerCase()}${zero ? ' zero' : ''}" data-hl="${ch}">${text}</span>`;
}
const sgn = (v) => (v < 0 ? MINUS : '+');
const mag = (v, dec = 8) => fmtNum(Math.abs(v), dec);
const m = (s) => `<span class="res-v">${s} m</span>`;

function describe(id, x) {
  const [r, g, b] = xToRgb(x);
  const d = decodeX(id, x);
  const hs = d.valid ? fmtH(id, d.h) : null;
  let full;
  let text;
  let contrib;

  if (id === 'terrarium') {
    full = `<div class="ln on"><span class="tag">式</span>h = (${term('R', `${r} × 256`, r === 0)} + ${term('G', `${g}`, g === 0)} + ${term('B', `${b} / 256`, b === 0)}) − 32768</div>
      <div class="ln on"><span class="tag">計算</span>= ${r * 256} + ${g} + ${fmtNum(b / 256, 6)} − 32768 = ${m(hs)}</div>`;
    text = `h = (${r}*256 + ${g} + ${b}/256) - 32768 = ${hs} m`;
    contrib = [
      ['r', r === 0, `赤 ${r * 256} m`], ['g', g === 0, `緑 ${g} m`], ['b', b === 0, `青 ${fmtNum(b / 256, 6)} m`],
      ['o', false, `基準 ${MINUS}32768 m`], ['sum', false, `= ${hs} m`],
    ];
  } else if (id === 'terrainrgb') {
    full = `<div class="ln on"><span class="tag">式</span>h = −10000 + (${term('R', `${r} × 65536`, r === 0)} + ${term('G', `${g} × 256`, g === 0)} + ${term('B', `${b}`, b === 0)}) × 0.1</div>
      <div class="ln on"><span class="tag">計算</span>= −10000 + ${fmtInt(x)} × 0.1 = ${m(hs)}</div>`;
    text = `h = -10000 + (${r}*65536 + ${g}*256 + ${b}) * 0.1 = ${hs} m`;
    contrib = [
      ['r', r === 0, `赤 ${fmtNum(r * 6553.6, 1)} m`], ['g', g === 0, `緑 ${fmtNum(g * 25.6, 1)} m`], ['b', b === 0, `青 ${fmtNum(b * 0.1, 1)} m`],
      ['o', false, `基準 ${MINUS}10000 m`], ['sum', false, `= ${hs} m`],
    ];
  } else {
    const lo = x < GSI_NODATA;
    const eq = x === GSI_NODATA;
    const hi = x > GSI_NODATA;
    const line1 = `<div class="ln on"><span class="tag">DN</span>x = ${term('R', `${r} × 65536`, r === 0)} + ${term('G', `${g} × 256`, g === 0)} + ${term('B', `${b}`, b === 0)} = ${fmtInt(x)}</div>`;
    const l = `<div class="ln ${lo ? 'on' : 'dim'}"><span class="tag">x &lt; 2²³</span>h = x × 0.01${lo ? ` = ${m(hs)}` : ''}</div>`;
    const e = `<div class="ln ${eq ? 'on' : 'dim'}"><span class="tag">x = 2²³</span>無効（データなし）　RGB(128, 0, 0)</div>`;
    const u = `<div class="ln ${hi ? 'on' : 'dim'}"><span class="tag">x &gt; 2²³</span>h = (x − 2²⁴) × 0.01${hi ? ` = (${fmtInt(x)} − ${fmtInt(U24)}) × 0.01 = ${m(hs)}` : ''}</div>`;
    full = line1 + l + e + u;
    text = `x = ${r}*65536 + ${g}*256 + ${b} = ${x}; ` + (eq ? 'x = 2^23 -> NODATA' : lo ? `h = x*0.01 = ${hs} m` : `h = (x - 2^24)*0.01 = ${hs} m`);
    contrib = eq
      ? [['sum', false, 'データなし（標高は決まらない）']]
      : [
        ['r', r === 0, `赤 ${fmtNum(r * 655.36, 2)} m`], ['g', g === 0, `緑 ${fmtNum(g * 2.56, 2)} m`], ['b', b === 0, `青 ${fmtNum(b * 0.01, 2)} m`],
        ...(hi ? [['o', false, `折り返し ${MINUS}167772.16 m`]] : []),
        ['sum', false, `= ${hs} m`],
      ];
  }
  return { full, text, contrib };
}

/* ---------- rendering ---------- */

function textColorFor(r, g, b) {
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 150 ? 'light' : 'dark';
}

function bitTip(id, bit, on) {
  const ci = 2 - Math.floor(bit / 8);
  const ch = CH[ci];
  const k = bit % 8;
  const head = `bit ${bit}（${ch} の ${k} 桁目）＝ ${on}`;
  let body;
  if (id === 'gsi' && bit === 23) {
    body = 'このビットは −83886.08 m に相当（符号ビット）\n1 のとき x ≥ 2²³。x から 2²⁴ を引いて負に折り返す。';
  } else {
    const w = bitWeight(id, bit);
    body = `このビットは +${fmtNum(w, 8)} m に相当`;
    if (id === 'terrarium' && bit === 23) body += '\n（読むときに 32768 m を引く前の量）';
    if (id === 'terrainrgb') body += '\n（−10000 m から数え上げた量）';
  }
  return `${head}\n${body}\nクリックで反転`;
}

function renderCard(id) {
  const c = cardEls[id];
  const x = S.x[id];
  const [r, g, b] = xToRgb(x);
  const d = decodeX(id, x);
  const sc = SCHEMES[id];

  c.root.classList.toggle('active', S.active === id);
  c.face.style.background = `rgb(${r}, ${g}, ${b})`;
  c.face.className = `face ${textColorFor(r, g, b)}${d.valid ? '' : ' nodata'}`;
  const hs = d.valid ? fmtH(id, d.h) : 'データなし';
  c.fh.innerHTML = d.valid ? `${hs}<small>m</small>` : 'データなし';
  const len = hs.length;
  c.fh.style.fontSize = d.valid ? `${len > 11 ? 21 : len > 9 ? 25 : len > 7 ? 29 : 34}px` : '';
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  c.fbot.innerHTML = `RGB(${r}, ${g}, ${b})<br>${hex}　x=${fmtInt(x)}`;

  c.bits.forEach((el) => {
    const bit = Number(el.dataset.bit);
    const on = (x >> bit) & 1;
    el.classList.toggle('on', !!on);
    if (el.textContent !== String(on)) el.textContent = String(on);
    el.dataset.tip = bitTip(id, bit, on);
    el.setAttribute('aria-label', `bit ${bit} は ${on}。クリックで反転`);
    el.setAttribute('aria-pressed', String(!!on));
  });
  [r, g, b].forEach((v, i) => { c.chv[i].textContent = v; });

  const desc = describe(id, x);
  c.full.innerHTML = desc.full;
  c.contrib.innerHTML = desc.contrib.map(([cls, zero, t]) => `<span class="${cls}${zero ? ' z' : ''}">${t}</span>`).join('');
  c.root._formulaText = desc.text;

  const info = S.info[id];
  let msg = '';
  let warn = false;
  if (info.clamped) {
    const edge = info.clamped === 'max' ? '上限' : '下限';
    const val = info.clamped === 'max' ? sc.max : sc.min;
    msg = `この方式では表せないので端に寄せた（${edge} ${fmtNum(val, 3)} m）`;
    warn = true;
  } else if (info.adjacent) {
    msg = 'この標高は x がちょうど 2²³ になり、無効（データなし）と同じ色になる。';
    warn = true;
  } else if (!d.valid) {
    msg = 'x = 2²³：データなし。ほかの方式は通常どおり表示しています。';
  } else if (S.align && Math.abs(S.h - d.h) > 1e-9) {
    const diff = d.h - S.h;
    msg = `入力 ${fmtNum(S.h, 6)} m との差 ${sgn(diff)}${fmtNum(Math.abs(diff), 6)} m（分解能 ${sc.resolutionText} の粒に丸めた）`;
  }
  c.stText.textContent = msg;
  c.status.classList.toggle('warn', warn);
}

const graphs = {};
const graphCaps = {};

function renderGraphs() {
  for (const id of SCHEME_IDS) {
    const x = S.x[id];
    const d = decodeX(id, x);
    graphs[id].setTarget(x, d.valid);
    const g = graphCaps[id];
    g.root.classList.toggle('active', S.active === id);
    g.live.innerHTML = d.valid
      ? `x = <b>${fmtInt(x)}</b> → h = <b>${fmtH(id, d.h)} m</b>`
      : `x = <b>${fmtInt(x)}</b>（2²³）→ <b>データなし</b>`;
  }
}

function buildGraphs() {
  const root = $('#graphs');
  root.innerHTML = SCHEME_IDS.map((id) => {
    const sc = SCHEMES[id];
    const share = earthSpan(id).reduce((a, [lo, hi]) => a + (hi - lo + 1), 0) / U24;
    const pct = share < 0.1 ? share * 100 : Math.round(share * 100);
    const extra = id === 'gsi'
      ? '2²³ を境に右半分は負の標高。0 m は x = 0、−0.01 m は x = 16777215。'
      : id === 'terrainrgb' ? '縦軸は −10000〜1,667,721.5 m。地球の標高は左端に寄ります。' : '縦軸は −32768〜32768 m の一直線。';
    return `<div class="gcard" data-id="${id}">
      <h3><i></i>${sc.label}</h3>
      <canvas aria-label="${sc.label} の x と標高のグラフ"></canvas>
      <div class="cap"><div class="live mono"></div>
        <div>${extra}　−11000〜9000 m が使うのは x 全体の約 <b>${fmtNum(pct, share < 0.1 ? 1 : 0)}%</b>（色つきの帯）。</div></div>
    </div>`;
  }).join('');
  for (const id of SCHEME_IDS) {
    const r = $(`.gcard[data-id="${id}"]`, root);
    graphCaps[id] = { root: r, live: $('.live', r) };
    graphs[id] = createChart($('canvas', r), id, (gid, x) => { S.active = gid; setX(gid, x); });
  }
}

let sweep;
const ctl = {};

function renderControls() {
  const id = S.active;
  const sc = SCHEMES[id];
  const d = decodeX(id, S.x[id]);
  const panel = $('#controls');
  panel.style.setProperty('--accent', sc.accent);
  $('#activeName').textContent = sc.label;
  $('#hSub').textContent = S.align ? '3方式をそろえて動かす' : `${sc.label} だけを動かす`;
  const valid = d.valid;
  ctl.hRead.textContent = valid ? `${fmtNum(S.h, 6, 2)} m` : 'データなし';
  ctl.hSlider.disabled = false;
  ctl.hSlider.value = String(clamp(S.h, -11000, 9000));
  if (document.activeElement !== ctl.hNum) ctl.hNum.value = plain(S.h);
  const [r, g, b] = xToRgb(S.x[id]);
  [r, g, b].forEach((v, i) => {
    const row = ctl.rows[i];
    if (document.activeElement !== row.slider) row.slider.value = v;
    if (document.activeElement !== row.num) row.num.value = v;
  });
  const rgb = [r, g, b];
  ctl.rows.forEach((row, i) => {
    const lo = rgb.slice(); const hi = rgb.slice();
    lo[i] = 0; hi[i] = 255;
    row.slider.style.setProperty('--track', `linear-gradient(90deg, rgb(${lo}), rgb(${hi}))`);
  });
  const x = S.x[id];
  ctl.xRead.innerHTML = `x（DN＝画素に入っている数）<br>= <b>${fmtInt(x)}</b><br>${bin8(r)} ${bin8(g)} ${bin8(b)}`;
  ctl.step.forEach((b2) => b2.setAttribute('aria-pressed', String(Number(b2.dataset.step) === S.step)));
  ctl.hSlider.step = String(S.step);
  ctl.align.checked = S.align;
  sweep?.setCursor(S.h);
}

function render() {
  SCHEME_IDS.forEach(renderCard);
  renderControls();
  renderGraphs();
}

/* ---------- controls wiring ---------- */

function buildControls() {
  ctl.hRead = $('#hRead');
  ctl.hSlider = $('#hSlider');
  ctl.hNum = $('#hNum');
  ctl.xRead = $('#xRead');
  ctl.align = $('#align');
  ctl.step = $$('#stepSeg button');
  ctl.rows = $$('.rgb-row').map((row) => ({ slider: $('input[type=range]', row), num: $('input[type=number]', row) }));

  ctl.hSlider.addEventListener('input', () => { applyH(Number(ctl.hSlider.value)); });
  ctl.hNum.addEventListener('input', () => {
    const v = ctl.hNum.valueAsNumber;
    if (Number.isFinite(v)) applyH(v);
  });
  ctl.hNum.addEventListener('blur', () => { ctl.hNum.value = plain(S.h); });
  ctl.step.forEach((b) => b.addEventListener('click', () => { S.step = Number(b.dataset.step); renderControls(); }));
  ctl.align.addEventListener('change', () => {
    S.align = ctl.align.checked;
    if (S.align) {
      const d = decodeX(S.active, S.x[S.active]);
      applyH(d.valid ? d.h : S.h);
    } else render();
  });

  const onRgb = (i, v) => {
    if (!Number.isFinite(v)) return;
    const rgb = xToRgb(S.x[S.active]);
    rgb[i] = clamp(Math.round(v), 0, 255);
    setX(S.active, rgbToX(...rgb));
  };
  ctl.rows.forEach((row, i) => {
    row.slider.addEventListener('input', () => onRgb(i, Number(row.slider.value)));
    row.num.addEventListener('input', () => onRgb(i, row.num.valueAsNumber));
    row.num.addEventListener('blur', () => { row.num.value = xToRgb(S.x[S.active])[i]; });
  });

  $('#copyColor').addEventListener('click', () => {
    const [r, g, b] = xToRgb(S.x[S.active]);
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    copy(`rgb(${r}, ${g}, ${b})  ${hex}  x=${S.x[S.active]}`, '色をコピーしました');
  });
  $('#copyFormula').addEventListener('click', () => copy(cardEls[S.active].root._formulaText, '数式をコピーしました'));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type !== 'range') return;
    if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
    if (t instanceof HTMLInputElement && t.closest('.rgb-row')) return;
    e.preventDefault();
    const id = S.active;
    const d = decodeX(id, S.x[id]);
    const h0 = d.valid ? d.h : S.h;
    const step = e.shiftKey ? 1 : SCHEMES[id].resolution;
    applyH(h0 + (e.key === 'ArrowRight' ? step : -step));
  });
}

async function copy(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* noop */ }
    ta.remove();
  }
  toast(msg);
}

/* ---------- examples ---------- */

const EXAMPLES = [
  { label: 'Terrarium：2523.266 m', c: SCHEMES.terrarium.accent, run: () => { S.active = 'terrarium'; applyH(2523.266, SCHEME_IDS); } },
  { label: 'Terrain-RGB：0 m → RGB(1, 134, 160)', c: SCHEMES.terrainrgb.accent, run: () => { S.active = 'terrainrgb'; applyH(0, SCHEME_IDS); } },
  { label: '富士山 3776 m を3方式で並べる', multi: true, run: () => applyH(3776, SCHEME_IDS) },
  { label: '地理院の無効 (128, 0, 0)', c: SCHEMES.gsi.accent, run: () => { S.active = 'gsi'; setX('gsi', GSI_NODATA); } },
  { label: '地理院の負の例：水深 −100 m', c: SCHEMES.gsi.accent, run: () => { S.active = 'gsi'; applyH(-100, SCHEME_IDS); } },
  { label: '海面 0 m を3方式で並べる', multi: true, run: () => applyH(0, SCHEME_IDS) },
];

function buildExamples() {
  const root = $('#examples');
  root.innerHTML = EXAMPLES.map((ex, i) => `<button type="button" class="ex" data-i="${i}"><i class="${ex.multi ? 'multi' : ''}" style="--c:${ex.c ?? 'none'}"></i><span>${ex.label}</span></button>`).join('');
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.ex');
    if (!b) return;
    const ex = EXAMPLES[Number(b.dataset.i)];
    S.align = true;
    ex.run();
    toast(`読み込みました：${ex.label}`);
  });
}

/* ---------- self check ---------- */

function buildCheck() {
  const res = runSelfCheck();
  const btn = $('#checkBtn');
  const pop = $('#checkPop');
  btn.classList.add(res.ok ? 'ok' : 'ng');
  $('#checkText').textContent = res.ok ? `検算OK ${res.passed}/${res.total}` : `検算NG ${res.total - res.passed}件`;
  pop.innerHTML = `<strong>${res.ok ? '検算OK' : '検算NG'}（${res.passed}/${res.total}）</strong>
    <p class="muted" style="font-size:12px">例の値と、3方式の往復変換（x → 標高 → x）をこの画面を開いたときに確かめています。</p>
    <ul>${res.results.map((r) => `<li class="${r.ok ? 'ok' : 'ng'}"><span>${r.name}</span></li>`).join('')}</ul>`;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    btn.setAttribute('aria-expanded', String(!pop.hidden));
  });
  document.addEventListener('click', (e) => {
    if (!pop.hidden && !pop.contains(e.target)) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pop.hidden = true; });
}

function buildMode() {
  const seg = $('#modeSeg');
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    document.body.dataset.mode = b.dataset.mode;
    $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  });
}

/* ---------- map ---------- */

function buildMapPanel() {
  const info = { coord: $('#miCoord'), sw: $('#miSw'), rgb: $('#miRgb'), h: $('#miH'), place: $('#miPlace'), load: $('#miLoad') };
  let last = null;
  let ctrl = null;
  let seq = 0;

  const show = (res, lng, lat, label) => {
    last = { ...res, lng, lat };
    info.place.textContent = label;
    info.coord.textContent = `${lat.toFixed(5)}°N  ${lng.toFixed(5)}°E`;
    info.sw.style.background = `rgb(${res.r}, ${res.g}, ${res.b})`;
    info.rgb.textContent = `RGB(${res.r}, ${res.g}, ${res.b})  z${res.z}`;
    info.h.textContent = `${fmtNum(decodeX('terrarium', rgbToX(res.r, res.g, res.b)).h, 3)} m`;
    info.load.disabled = false;
  };

  const sample = async (lng, lat, zoom, { apply, label }) => {
    const mine = ++seq;
    try {
      const res = await sampleRgb(lng, lat, zoom);
      if (mine !== seq) return;
      show(res, lng, lat, label);
      if (apply) loadSample();
    } catch (err) {
      if (mine !== seq) return;
      info.rgb.textContent = '標高タイルを取得できませんでした';
      info.h.textContent = '—';
      info.load.disabled = true;
      console.warn('tile sample failed', err);
    }
  };

  const loadSample = () => {
    if (!last) return;
    S.active = 'terrarium';
    setX('terrarium', rgbToX(last.r, last.g, last.b));
    toast('地図の画素を Terrarium として読み込みました');
  };
  info.load.addEventListener('click', loadSample);

  sample(138.7274, 35.3606, 13, { apply: false, label: '富士山の山頂付近' });

  const start = async () => {
    try {
      const mod = await import('./map.js');
      ctrl = mod.initMap({
        el: $('#map'),
        onSample: (lng, lat, zoom) => sample(lng, lat, zoom, { apply: true, label: '地図で選んだ地点' }),
      });
      $('#map').querySelector('.map-msg')?.remove();
      $('#miHome').addEventListener('click', () => {
        const p = ctrl.home();
        sample(p.lng, p.lat, p.zoom, { apply: false, label: '富士山の山頂付近' });
      });
      $('#mi3d').addEventListener('change', (e) => ctrl.setTerrain(e.target.checked));
    } catch (err) {
      console.warn('map failed', err);
      const msg = $('#map .map-msg');
      if (msg) msg.textContent = 'この環境では地図（WebGL）を表示できませんでした。';
    }
  };
  const mapEl = $('#map');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: '600px' });
    io.observe(mapEl);
  } else start();
}

/* ---------- compare ---------- */

const COMPARE_NOTE = '地理院は 0 m をまたぐ（−0.01 m → 0 m）と RGB が (255, 255, 255) から (0, 0, 0) に飛びます。Terrarium の 0 m は RGB(128, 0, 0) ですが、地理院ではこの色が「データなし」。同じ色でも、方式が違えば意味が変わります。';

/* ---------- boot ---------- */

function boot() {
  initTips();
  buildCards();
  buildGraphs();
  buildControls();
  buildExamples();
  buildMode();
  buildCheck();
  buildCompare($('#compare'), (id, h) => pickH(id, h));
  sweep = buildSweep($('#sweep'), $('#sweepSeg'), (id, h) => pickH(id, h));
  $('#compareNote').innerHTML = COMPARE_NOTE;
  applyH(START_H, SCHEME_IDS);
  SCHEME_IDS.forEach((id) => graphs[id].setTarget(S.x[id], true, true));
  buildMapPanel();
}

boot();
