# Family Memories

A private photo timeline for a couple, built as an Android web app (PWA). Each of you gets your own line for childhood and family, the two lines meet through your meetups and engagement, merge at the wedding, and continue as one shared line through married life, a baby and beyond.

Free to run: Supabase free tier for sign-in, database and photos, Cloudflare Pages for hosting. No app store, no build step, no npm. It is plain HTML, CSS and JavaScript.

**Use it for your own family:** click **Use this template** on GitHub (or fork / clone), follow the setup below, and you have your own private copy. Nothing in this repo is tied to anyone's data.

## Features
- Two-lane timeline that merges at the wedding, with a swipeable carousel per wedding event
- Your own chapters (e.g. College, First home) next to the built-in ones, placed on the timeline by date
- Photos and caption-only notes (with emojis), optional captions, reactions
- Author-only edit/delete, "age at photo" tag, crop at upload (4:5 thumbnail, full photo kept for viewing)
- Share photos straight from the Android gallery into the app
- Smooth CSS-only animation tuned for mid-range phones, with smooth / light / off motion modes
- Only the two Google accounts you list can sign in or see anything

## 1. Try it first (2 minutes)
`js/config.js` ships with `DEMO_MODE: true` (sample data, no sign-in, nothing saved).
Drag the folder onto Cloudflare Pages (Workers & Pages > Create > Pages > Upload assets) and open the URL on your phone in Chrome.

## 2. Make it yours
1. **Name it.** Set `APP_NAME` in `js/config.js`, and `name` / `short_name` in `manifest.webmanifest` (the home-screen label).
2. **Supabase.** Create a free project at supabase.com. In the SQL Editor, run `supabase/schema.sql` (tables, security rules, private photo bucket).
3. **Members.** Copy `supabase/members.example.sql` to `supabase/members.sql`, put in your two Google emails, and run it. Lane `a` is the first timeline line, `b` the second. `members.sql` is git-ignored so your emails stay out of the repo.
4. **Google sign-in.** Google Cloud Console > APIs & Services > Credentials > OAuth client (Web). Authorised redirect URI = `https://<your-project>.supabase.co/auth/v1/callback`. Paste the client ID and secret into Supabase > Authentication > Providers > Google.
5. **Redirect URLs.** Supabase > Authentication > URL Configuration: set Site URL and a Redirect URL to your Cloudflare Pages address.
6. **Connect.** Two ways:
   - **Cloudflare deploys from GitHub (recommended):** connect your repo in Workers & Pages (it uses `wrangler.jsonc`). Then in your Worker > Settings > Variables and Secrets, add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Project settings > API in Supabase), and optionally `APP_NAME`. The Worker in `worker/index.js` fills them into `js/config.js` as it's served, so the repo stays in demo mode and no keys are committed.
   - **Drag-and-drop upload:** in your local copy of `js/config.js` set `DEMO_MODE: false` and paste the two values, then upload the folder. Don't commit that file.

   The anon key is designed to be public; row-level security limits everything to your two member emails.
7. **Install.** Open the site on both phones, sign in, then Chrome menu > Install app.
8. **Lock it down.** Turn on Google 2-step verification for both accounts. It is the real lock on your photos.

## Updating an existing setup
`supabase/schema.sql` is safe to run again: it only adds what's missing. After pulling a new version, run it once more in the Supabase SQL Editor (for example, to add the table for your own chapters).

## Updates on phones
The app keeps a copy of itself for offline use, but when online it always loads the latest files, so a new version shows on the next open. If a phone ever looks stuck on an old version: **Settings > Refresh app**, or open `<your site>/reset` (Worker setup only).

## Keeping your setup out of git
If your copy of the repo is public, don't commit your real `js/config.js` values, `supabase/members.sql` or any keys. `scripts/check-secrets.sh` blocks real Supabase URLs/keys, `DEMO_MODE: false`, service_role / secret keys, Google client secrets, private keys, GitHub tokens and real emails. It runs in two places:
- **On your PC before each commit.** Turn it on once per clone: `git config core.hooksPath .githooks`
- **On GitHub for every push and pull request** (`.github/workflows/secret-scan.yml`), so it can't be skipped with `--no-verify`.

Keep your real values only in the folder you upload. To undo a staged file: `git restore --staged js/config.js`. See `SECURITY.md` for which keys are safe and what to do if one leaks.

## Tech
- Vanilla ES modules in `js/` (`views/` holds one file per screen), one stylesheet `css/app.css`
- `js/store.js`: one data interface with a Supabase version and an in-memory demo version
- `js/images.js`: crops and resizes photos on the phone (WebP, JPEG fallback) before upload
- `sw.js`: caches the app shell and receives photos from the Android share menu. When you add a file, add it to `FILES`; when you ship changes, bump `VERSION`.
- `supabase/schema.sql`: Postgres tables + row-level security + private storage bucket; photos load through signed URLs
- Syntax check a file: `node --input-type=module --check < js/main.js`

## Good to know (v1 limits)
- Built for exactly two people (one lane each). Wider family access would need a v2 change.
- Only a display copy (max 1600px) and a cropped thumbnail are stored, not the original files. Supabase free storage is 1 GB, which holds thousands of such photos.
- No video, voice notes, offline upload queue or full photo backup zip yet (Settings exports notes/details as JSON).
- supabase-js loads from the esm.sh CDN, so first load needs internet.
- Free Supabase projects pause after about a week of no use; open the app weekly or resume it from the dashboard.
- Not yet tested on a real phone. See `docs/TESTING.md` for the phone test checklist. Issues and pull requests welcome.

## Roadmap (v2)
Cloudflare R2 storage (10 GB free) with originals kept, videos, voice notes, offline queue, backup zip, more family members with viewer/contributor roles.

## License
MIT. See `LICENSE`.
