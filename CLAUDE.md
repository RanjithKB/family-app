# Family Memories (placeholder name; owner will rename later)

Private memories app for exactly two people (a married couple). Android-only PWA, viewed on phones, no app store, free tier only.

## Product
- Timeline, strictly in date order top to bottom (dates decide above/below the wedding, not chapters): two lanes (each person on their side, shared meetups/engagement memories in the middle, chapter labels at their first date) -> merge at wedding (big swipeable carousel by event, events by date) -> one shared line (married life, "Baby arrives" at the baby date) -> room for future.
- Photos and caption-only notes (with emojis), optional captions, reactions (heart etc.) on both, author-only edit/delete, age-at-photo tag, crop at upload (thumb cropped 4:5, full photo kept).
- Own chapters: chapters table + memories.custom_chapter (memory keeps its built-in chapter as fallback). Shown as chapter cards placed by the date of their first memory. Managed in Settings (rename, delete, "Choose memories" picker); Edit details can move one memory. Only the author can move a memory (RLS).
- Home: celebration banner on birthdays (both, baby) and the wedding anniversary, "Coming up" card (next 30 days), wording depends on who is signed in (js/special.js). Optional baby_name setting. Push notifications not built yet.
- Lots of animation but smooth on 4 GB mid-range phones: CSS only, opacity/transform, motion modes smooth/light/off.

## Tech
- No build step. Vanilla ES modules in js/, CSS in css/app.css, service worker sw.js (add new files to its FILES list), manifest with Web Share Target.
- Backend: Supabase (Google sign-in, Postgres + RLS via members table, private storage bucket, signed URLs). Schema in supabase/schema.sql; member emails go in supabase/members.sql (git-ignored, copied from members.example.sql). js/config.js has DEMO_MODE (sample data in memory).
- Hosting: Cloudflare Workers Builds from GitHub (wrangler.jsonc, static assets + worker/index.js). The Worker only rewrites js/config.js from the SUPABASE_URL / SUPABASE_ANON_KEY / APP_NAME variables set in the dashboard (keep_vars); it fetches the asset without conditional headers and serves no-store, else a cached demo copy gets a 304. .assetsignore keeps repo-only files from being served. sw.js is network-first for all same-origin files (4 s timeout, cache offline), stale-while-revalidate only for esm.sh. Settings > Refresh app and the Worker's /reset page clear the saved copy (keep localStorage). No R2 (needs a payment card; owner declined).
- Public template repo (MIT). Never commit real config.js values or emails; scripts/check-secrets.sh blocks it, run by .githooks/pre-commit (enable: git config core.hooksPath .githooks) and by the secret-scan GitHub Action. main is protected: changes go through a PR reviewed by the owner (CODEOWNERS). Bump sw.js VERSION when shipping changes.
- Check JS syntax with: node --input-type=module --check < file.js

## Next (v2 ideas)
- Cloudflare R2 for storage (10 GB free) + Worker for presigned uploads, keep originals
- Video, voice notes, offline upload queue, full backup zip
- App name + logo, install prompt polish
- Not yet tested on a real phone: fix anything that breaks first.
