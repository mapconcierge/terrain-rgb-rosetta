let tip;
let current = null;

function place(el) {
  const r = el.getBoundingClientRect();
  const tr = tip.getBoundingClientRect();
  let left = r.left + r.width / 2 - tr.width / 2;
  left = Math.max(8, Math.min(left, innerWidth - tr.width - 8));
  let top = r.bottom + 8;
  if (top + tr.height > innerHeight - 8) top = r.top - tr.height - 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

function show(el) {
  const text = el.dataset.tip;
  if (!text) return;
  current = el;
  tip.textContent = text;
  tip.hidden = false;
  place(el);
}

function hide() {
  current = null;
  tip.hidden = true;
}

export function refreshTip() {
  if (current && document.contains(current) && current.dataset.tip) {
    tip.textContent = current.dataset.tip;
    place(current);
  }
}

export function initTips() {
  tip = document.getElementById('tip');
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el && el !== current) show(el);
    else if (!el) hide();
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el) show(el);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('scroll', hide, true);
}

let toastTimer = 0;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
