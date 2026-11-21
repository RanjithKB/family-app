// Service worker: caches the app shell and receives photos shared from the Android gallery.
const VERSION = 'v3';
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

  // App shell and library: stale-while-revalidate.
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  })());
});
