# Security

## Reporting a problem
Please don't open a public issue for security problems. Use **Security > Report a vulnerability** on this repo so the report stays private.

## Keeping your own copy safe
- Never commit your real `js/config.js` values or `supabase/members.sql`. A pre-commit hook (`git config core.hooksPath .githooks`) and a GitHub check both block this.
- The Supabase **anon / publishable** key is the only key the app needs. It is designed to be public, because row-level security in `supabase/schema.sql` limits all data and photos to the two member emails.
- Never put the Supabase **service_role / secret** key or the Google OAuth **client secret** anywhere in this app. The client secret belongs only in the Supabase dashboard.
- If a key was ever committed, rotate it in Supabase (Project settings > API). Deleting the commit does not make it safe again.
- Turn on Google 2-step verification for both member accounts.
