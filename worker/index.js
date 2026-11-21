// Cloudflare Worker in front of the static app.
// It only touches js/config.js: if the Supabase settings are set in Cloudflare
// (Settings > Variables and Secrets), it serves config.js with them filled in and demo mode off.
// The file in the repo stays in demo mode, so no keys are ever committed.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/js/config.js') return config(request, env);
    if (url.pathname === '/reset') return reset();
    return env.ASSETS.fetch(request);
  }
};

// Emergency refresh for a phone stuck on an old saved copy of the app. No old version has this
// page saved, so it always comes from here. It removes the saved copy and reopens the app.
// Sign-in and settings (kept in the browser's local storage) are not touched.
function reset() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Refreshing…</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#F8F7F4;color:#1D2540;text-align:center;padding:24px}a{color:#1F5F6E}</style></head>
<body><div><h1 style="font-size:22px">Refreshing the app…</h1><p id="m">This takes a second.</p><p><a href="/">Open the app</a></p></div>
<script>
(async () => {
  try { const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map((x) => x.unregister())); } catch (e) {}
  try { const k = await caches.keys(); await Promise.all(k.filter((n) => n !== 'shared-files').map((n) => caches.delete(n))); } catch (e) {}
  location.replace('/?fresh=' + Date.now());
})();
</script></body></html>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

async function config(request, env) {
  const supaUrl = (env.SUPABASE_URL || '').trim();
  const anonKey = (env.SUPABASE_ANON_KEY || '').trim();
  if (!supaUrl || !anonKey) return env.ASSETS.fetch(request); // not set up yet: demo mode
  // Ask for a clean copy, without the browser's "only if changed" headers. Otherwise a browser
  // that still has the demo file gets "304 not modified" (the file itself didn't change) and keeps demo mode.
  const res = await env.ASSETS.fetch(new Request(new URL(request.url), { method: 'GET' }));
  if (!res.ok) return res;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supaUrl)) {
    return new Response('// SUPABASE_URL in Cloudflare should look like https://xxxx.supabase.co\n', { status: 500, headers: { 'content-type': 'text/javascript; charset=utf-8' } });
  }
  let src = await res.text();
  src = src
    .replace(/DEMO_MODE:\s*true/, 'DEMO_MODE: false')
    .replace(/SUPABASE_URL:\s*'[^']*'/, `SUPABASE_URL: ${JSON.stringify(supaUrl.replace(/\/$/, ''))}`)
    .replace(/SUPABASE_ANON_KEY:\s*'[^']*'/, `SUPABASE_ANON_KEY: ${JSON.stringify(anonKey)}`);
  if (env.APP_NAME) src = src.replace(/APP_NAME:\s*'[^']*'/, `APP_NAME: ${JSON.stringify(String(env.APP_NAME).slice(0, 40))}`);
  return new Response(src, {
    headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}
