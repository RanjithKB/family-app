// Tiny UI toolkit: element builder, icons, layers (with Android back-button support), toast, lazy images.
import { store } from './store.js';

// Newer emojis show as an empty box on older phones (🥹 needs Android 12+).
// If this phone can't draw one, show a close older emoji instead. Saved data is never changed.
const EMOJI_FALLBACK = { '🥹': '🥺' };
function canDraw(e) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.textBaseline = 'top';
    x.font = '18px sans-serif';
    x.fillStyle = '#000';
    x.fillText(e, 0, 0);
    const d = x.getImageData(0, 0, 24, 24).data;
    // A real emoji has colour; the empty-box glyph is drawn in plain black.
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 50 && (Math.abs(d[i] - d[i + 1]) > 30 || Math.abs(d[i + 1] - d[i + 2]) > 30)) return true;
    return false;
  } catch (_) { return true; }
}
const missing = Object.keys(EMOJI_FALLBACK).filter((e) => !canDraw(e));
const missingRe = missing.length ? new RegExp(missing.join('|'), 'gu') : null;
export const showEmoji = (s) => (missingRe ? s.replace(missingRe, (m) => EMOJI_FALLBACK[m]) : s);

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(c.nodeType ? c : document.createTextNode(showEmoji(String(c))));
  };
  kids.forEach(add);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

const svg = (d, extra = '') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICON = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  more: svg('<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>'),
  home: svg('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  timeline: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14.3 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 002 1.2l.4 2.6h4l.4-2.6a7 7 0 002-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>'),
  image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  pen: svg('<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>'),
  send: svg('<path d="M4 12l16-8-6 16-3-7z"/>'),
  heart: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>'),
  left: svg('<path d="M15 5l-7 7 7 7"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>')
};

// ---------------------------------------------------------------- motion mode
export function getMotion() {
  const saved = localStorage.getItem('motion');
  if (saved) return saved;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return 'light';
  return 'smooth';
}
export function setMotion(mode, save = true) {
  document.documentElement.dataset.motion = mode;
  if (save) localStorage.setItem('motion', mode);
}

// ---------------------------------------------------------------- toast
let toastTimer;
export function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

// ---------------------------------------------------------------- layers (sheets, viewers, forms)
const stack = [];
let suppress = 0;
const root = () => document.getElementById('layer');

export function openLayer(el, onClose) {
  const entry = { el, onClose };
  stack.push(entry);
  root().appendChild(el);
  history.pushState({ layer: stack.length }, '');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  const close = () => {
    const i = stack.indexOf(entry);
    if (i < 0) return;
    stack.splice(i, 1);
    el.classList.remove('in');
    setTimeout(() => el.remove(), 240);
    if (onClose) onClose();
    suppress++;
    history.back();
  };
  entry.close = close;
  return close;
}
export function closeAllLayers() {
  while (stack.length) stack[stack.length - 1].close();
}
window.addEventListener('popstate', () => {
  if (suppress > 0) { suppress--; return; }
  const top = stack.pop();
  if (!top) return;
  top.el.classList.remove('in');
  setTimeout(() => top.el.remove(), 240);
  if (top.onClose) top.onClose();
});

// Bottom sheet with a dimmed backdrop.
export function sheet(title, body, { tall = false } = {}) {
  let close;
  const el = h('div', { class: 'layer sheet-wrap' },
    h('div', { class: 'backdrop', onClick: () => close() }),
    h('div', { class: 'sheet' + (tall ? ' tall' : ''), role: 'dialog', 'aria-label': title },
      h('div', { class: 'grab' }),
      title ? h('h2', { class: 'sheet-title' }, title) : null,
      body));
  close = openLayer(el);
  return close;
}

// Full-screen page that slides up.
export function page(node) {
  const el = h('div', { class: 'layer page' }, node);
  return { el, close: openLayer(el) };
}

export function confirmBox(title, text, okLabel = 'Delete') {
  return new Promise((resolve) => {
    const done = (v) => { box.remove(); resolve(v); };
    const box = h('div', { class: 'dialog-wrap' },
      h('div', { class: 'backdrop on', onClick: () => done(false) }),
      h('div', { class: 'dialog', role: 'alertdialog', 'aria-label': title },
        h('h3', null, title),
        h('p', null, text),
        h('div', { class: 'row end' },
          h('button', { class: 'btn ghost', onClick: () => done(false) }, 'Cancel'),
          h('button', { class: 'btn danger', onClick: () => done(true) }, okLabel))));
    document.body.appendChild(box);
  });
}

// ---------------------------------------------------------------- lazy private images
const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    io.unobserve(e.target);
    load(e.target);
  }
}, { rootMargin: '700px 0px' }) : null;

async function load(img) {
  const url = await store.imageUrl(img.dataset.path);
  if (!url) { img.classList.add('missing'); return; }
  img.onload = () => img.classList.add('ld');
  img.src = url;
}

export function lazyImg(path, cls = '', alt = '') {
  const img = h('img', { class: 'lz ' + cls, alt, decoding: 'async', draggable: 'false' });
  img.dataset.path = path || '';
  if (!path) { img.classList.add('missing'); return img; }
  if (io) io.observe(img); else load(img);
  return img;
}

export function avatar(name, lane) {
  return h('span', { class: 'avatar l-' + lane, 'aria-hidden': 'true' }, (name || '?').trim().charAt(0).toUpperCase());
}

export const EMOJIS = ['🥹', '😂', '❤️', '🎉', '🙏', '👶', '🏡', '🌸', '😍', '🥰', '🎂', '✨'];
export const REACTIONS = ['❤️', '🥹', '😂', '🎉'];
