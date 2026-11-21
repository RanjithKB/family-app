# Family Memories (placeholder name; owner will rename later)

Private memories app for exactly two people (a married couple). Android-only PWA, viewed on phones, no app store, free tier only.

## Product
- Timeline: two lanes (each person's childhood + parents/siblings) -> unofficial meetups -> engagement -> merge at wedding (main junction, big swipeable carousel by event) -> one shared line (married life) -> baby -> room for future.
- Photos and caption-only notes (with emojis), optional captions, reactions (heart etc.) on both, author-only edit/delete, age-at-photo tag, crop at upload (thumb cropped 4:5, full photo kept).
- Own chapters: chapters table + memories.custom_chapter (memory keeps its built-in chapter as fallback). Shown as chapter cards placed by the built-in chapter of their first memory, in date order. Managed in Settings (rename, delete, "Choose memories" picker); Edit details can move one memory. Only the author can move a memory (RLS).
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
