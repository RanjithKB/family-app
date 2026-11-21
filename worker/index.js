// Cloudflare Worker in front of the static app.
// It only touches js/config.js: if the Supabase settings are set in Cloudflare
// (Settings > Variables and Secrets), it serves config.js with them filled in and demo mode off.
// The file in the repo stays in demo mode, so no keys are ever committed.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/js/config.js') return config(request, env);
    return env.ASSETS.fetch(request);
  }
};

async function config(request, env) {
  const res = await env.ASSETS.fetch(request);
  const supaUrl = (env.SUPABASE_URL || '').trim();
  const anonKey = (env.SUPABASE_ANON_KEY || '').trim();
  if (!res.ok || !supaUrl || !anonKey) return res; // not set up yet: demo mode
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
    headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' }
  });
}
