// App entry: auth states, shell with bottom nav, routing between Home and Timeline.
import { CONFIG } from './config.js';
import { store } from './store.js';
import { h, clear, setMotion, getMotion, closeAllLayers, ICON, toast } from './ui.js';
import { S, reload, onChange } from './state.js';
import { renderHome } from './views/home.js';
import { renderTimeline } from './views/timeline.js';
import { openSettings } from './views/settings.js';
import { openAddChooser, takeSharedFiles, startPhotos } from './views/add.js';

const app = document.getElementById('app');
document.title = CONFIG.APP_NAME;
setMotion(getMotion(), false);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

function centerScreen(...kids) {
  clear(app);
  app.appendChild(h('div', { class: 'center' }, ...kids));
}

function signedOut() {
  centerScreen(
    h('img', { src: 'icons/icon-192.png', alt: '' }),
    h('h1', null, CONFIG.APP_NAME),
    h('p', { class: 'muted' }, 'Our private family story.'),
    h('button', { class: 'btn gold', type: 'button', onClick: () => store.signIn() }, 'Continue with Google'));
}

function notMember(email) {
  centerScreen(
    h('h1', null, 'This is a private app'),
    h('p', { class: 'muted' }, `${email || 'This account'} is not on the family list.`),
    h('button', { class: 'btn ghost', type: 'button', onClick: async () => { await store.signOut(); location.reload(); } }, 'Sign out'));
}

let tab = 'home';
let scrollTarget = null;
let content, nav;

function goTimeline(id) { scrollTarget = id || null; setTab('timeline'); }

function render() {
  if (!content) return;
  const y = window.scrollY;
  if (tab === 'home') renderHome(content, { goTimeline, openSettings });
  else renderTimeline(content, { scrollTo: scrollTarget });
  if (tab === 'home') window.scrollTo(0, y);
  scrollTarget = null;
  [...nav.querySelectorAll('.tab')].forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
}

function setTab(t) {
  closeAllLayers();
  tab = t;
  window.scrollTo(0, 0);
  render();
}

function shell() {
  clear(app);
  content = h('main', { id: 'content' });
  nav = h('nav', { class: 'nav', 'aria-label': 'Main' },
    h('button', { class: 'tab', type: 'button', 'data-tab': 'home', onClick: () => setTab('home') }, h('span', { html: ICON.home }), 'Home'),
    h('button', { class: 'fab', type: 'button', 'aria-label': 'Add a memory', html: ICON.plus, onClick: openAddChooser }),
    h('button', { class: 'tab', type: 'button', 'data-tab': 'timeline', onClick: () => setTab('timeline') }, h('span', { html: ICON.timeline }), 'Timeline'));
  app.append(content, nav);
  render();
}

async function ready() {
  centerScreen(h('div', { class: 'sk', style: 'width:96px;height:96px;border-radius:22px' }), h('p', { class: 'muted' }, 'Loading…'));
  try { await reload(); } catch (e) { centerScreen(h('p', null, 'Could not load. Check your connection.'), h('button', { class: 'btn', type: 'button', onClick: () => location.reload() }, 'Try again')); return; }
  shell();
  onChange(render);
  if (store.mode === 'demo') toast('Demo mode: sample data only. Anything you add is gone after a refresh.', 6000);

  const shared = new URLSearchParams(location.search).get('shared');
  if (shared) {
    history.replaceState(null, '', location.pathname);
    const files = await takeSharedFiles();
    if (files && files.length) startPhotos(files);
  }

  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000) reload().catch(() => {});
  });
}

(async () => {
  try {
    const r = await store.init();
    if (r.state === 'signed-out') signedOut();
    else if (r.state === 'not-member') notMember(r.email);
    else await ready();
  } catch (e) {
    centerScreen(h('p', null, 'Something went wrong starting the app.'), h('button', { class: 'btn', type: 'button', onClick: () => location.reload() }, 'Reload'));
  }
})();
