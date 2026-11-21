// Service worker: keeps a copy of the app for offline use and receives photos shared from the Android gallery.
// Online, the app's files always come from the network (see networkFirst), so updates show on the next open.
const VERSION = 'v13';
const SHELL = `shell-${VERSION}`;
const SHARED = 'shared-files';
const FILES = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/main.js', 'js/config.js', 'js/store.js', 'js/images.js', 'js/ui.js', 'js/dates.js', 'js/state.js',
  'js/views/home.js', 'js/views/timeline.js', 'js/views/add.js', 'js/views/viewer.js', 'js/views/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Photos shared from the Android Share menu arrive as a POST.
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const form = await req.formData();
      const files = form.getAll('photos').filter((f) => f && f.size);
      const cache = await caches.open(SHARED);
      for (const k of await cache.keys()) await cache.delete(k);
      let i = 0;
      for (const f of files) {
        await cache.put(`shared/${i++}`, new Response(f, { headers: { 'Content-Type': f.type || 'image/jpeg', 'X-Name': encodeURIComponent(f.name || 'photo.jpg'), 'X-Modified': String(f.lastModified || Date.now()) } }));
      }
      return Response.redirect('./?shared=' + files.length, 303);
    })());
    return;
  }

  if (req.method !== 'GET') return;
  // Never cache API or private photo requests.
  if (url.origin !== location.origin && !url.hostname.endsWith('esm.sh')) return;

  // The app's own files: network first, so every open gets the latest version.
  // The saved copy is used only offline, or when the network takes longer than 4 seconds.
  if (url.origin === location.origin) {
    e.respondWith(networkFirst(req, e));
    return;
  }

  // The sign-in library from esm.sh: saved copy first (it rarely changes), refreshed in the background.
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const hit = await cache.match(req);
    const net = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  })());
});

async function networkFirst(req, e) {
  const cache = await caches.open(SHELL);
  const net = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  const slow = new Promise((resolve) => setTimeout(resolve, 4000, 'slow'));
  try {
    const first = await Promise.race([net, slow]);
    if (first !== 'slow') return first;
    // Slow network: show the saved copy if there is one, otherwise keep waiting.
    return (await cache.match(req, { ignoreSearch: true })) || (await net);
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
