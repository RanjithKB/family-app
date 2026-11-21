-- =====================================================================
--  Your two members. Copy this file to supabase/members.sql (git ignores
--  that name), put in your real Google emails, and run it in Supabase:
--  SQL Editor > New query > Run. Run schema.sql first.
--  'a' is the first timeline line, 'b' the second.
--  Never commit your real emails if your copy of the repo is public.
-- =====================================================================
insert into public.members (email, name, lane) values
  ('you@gmail.com',    'You',    'a'),
  ('spouse@gmail.com', 'Spouse', 'b')
on conflict (email) do nothing;
