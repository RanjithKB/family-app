# Family Memories (placeholder name)

A private two-person family timeline PWA for Android. No build step: it is plain files.

## 1. Try it first (2 minutes)
`js/config.js` ships with `DEMO_MODE: true` (sample data, no sign-in, nothing saved).
Drag this folder onto Cloudflare Pages (Workers & Pages > Create > Pages > Upload assets), open the URL on your phone in Chrome.

## 2. Make it real
1. Create a free project at supabase.com.
2. SQL Editor: open `supabase/schema.sql`, change the two emails near the bottom to yours and your spouse's Google emails, run it.
3. Google sign-in: Google Cloud Console > APIs & Services > Credentials > OAuth client (Web). Authorised redirect URI = `https://<your-project>.supabase.co/auth/v1/callback`. Paste the client ID and secret into Supabase > Authentication > Providers > Google.
4. Supabase > Authentication > URL Configuration: set Site URL and a Redirect URL to your Cloudflare Pages address.
5. In `js/config.js` set `DEMO_MODE: false`, paste `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Project settings > API). The anon key is safe to ship; row-level security restricts everything to the two member emails.
6. Re-upload the folder to Cloudflare Pages. Open on both phones, sign in, then Chrome menu > Install app.
7. Turn on Google 2-step verification for both accounts. It is the real lock on your photos.

## Good to know (v1 limits)
- Only a display copy (max 1600px) and a cropped thumbnail are stored, not the original files. Supabase free storage is 1 GB, which is thousands of such photos.
- No video, voice notes, offline upload queue or full photo backup zip yet (Settings exports notes/details as JSON).
- supabase-js loads from the esm.sh CDN, so first load needs internet.
- After editing config.js, reload twice (the service worker may serve the old file once).
- Free Supabase projects pause after about a week of no use; open the app weekly or resume it from the dashboard.
- Share target: after installing, you can share photos from the Android gallery straight into the app.

## Later (v2)
Cloudflare R2 storage (10 GB free) with originals kept, videos, voice notes, offline queue, backup zip, app name and logo.
