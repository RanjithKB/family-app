-- =====================================================================
--  Family Memories: database + storage setup
--  Run this whole file once in Supabase: SQL Editor > New query > Run.
--  It contains no personal data. After it, run your own members.sql
--  (see supabase/members.example.sql) to add your two Google accounts.
-- =====================================================================

-- People allowed in (exactly two). lane 'a' and 'b' are your two timeline lines.
create table if not exists public.members (
  email text primary key,
  name  text not null,
  lane  text not null unique check (lane in ('a', 'b'))
);

-- Family-wide settings: wedding_date, baby_date, birth_a, birth_b
create table if not exists public.settings (
  key   text primary key,
  value text
);

create table if not exists public.memories (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('photo', 'note')),
  lane         text not null check (lane in ('a', 'b', 'together')),
  chapter      text not null check (chapter in ('childhood','meetups','engagement','wedding','married','baby')),
  event        text,                       -- wedding sub-event: haldi / ceremony / reception / other
  caption      text,                       -- optional for photos, the text for notes
  note_emoji   text,
  note_color   text,
  taken_on     date not null,
  precision    text not null default 'day' check (precision in ('day','month','year','around')),
  people       text[] not null default '{}',
  thumb_path   text,
  display_path text,
  width        int,
  height       int,
  created_by   uuid not null default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now()
);
create index if not exists memories_taken_idx on public.memories (taken_on);

-- Your own chapters (e.g. "College", "First home"), on top of the built-in ones.
-- A memory keeps its built-in chapter too, so it falls back there if its own chapter is deleted.
create table if not exists public.chapters (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (char_length(label) between 1 and 40),
  lane       text not null check (lane in ('a', 'b', 'together')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.memories add column if not exists custom_chapter uuid references public.chapters(id) on delete set null;

create table if not exists public.reactions (
  memory_id uuid not null references public.memories(id) on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users(id),
  emoji     text not null,
  primary key (memory_id, user_id, emoji)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  memory_id  uuid not null references public.memories(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id),
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Security: only the two emails in `members` can read or write anything.
-- ---------------------------------------------------------------------
create or replace function public.is_member()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table public.members   enable row level security;
alter table public.settings  enable row level security;
alter table public.memories  enable row level security;
alter table public.reactions enable row level security;
alter table public.comments  enable row level security;
alter table public.chapters  enable row level security;

drop policy if exists members_read   on public.members;
drop policy if exists members_update on public.members;
create policy members_read   on public.members for select to authenticated using (public.is_member());
create policy members_update on public.members for update to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
-- people can rename themselves, but not change lane or email
revoke update on public.members from authenticated;
grant update (name) on public.members to authenticated;

drop policy if exists settings_all on public.settings;
create policy settings_all on public.settings for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- Memories: both can read. Only the author can edit or delete their own.
drop policy if exists memories_read   on public.memories;
drop policy if exists memories_insert on public.memories;
drop policy if exists memories_update on public.memories;
drop policy if exists memories_delete on public.memories;
create policy memories_read   on public.memories for select to authenticated using (public.is_member());
create policy memories_insert on public.memories for insert to authenticated
  with check (public.is_member() and created_by = auth.uid());
create policy memories_update on public.memories for update to authenticated
  using (public.is_member() and created_by = auth.uid())
  with check (public.is_member() and created_by = auth.uid());
create policy memories_delete on public.memories for delete to authenticated
  using (public.is_member() and created_by = auth.uid());

drop policy if exists reactions_read   on public.reactions;
drop policy if exists reactions_insert on public.reactions;
drop policy if exists reactions_delete on public.reactions;
create policy reactions_read   on public.reactions for select to authenticated using (public.is_member());
create policy reactions_insert on public.reactions for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());
create policy reactions_delete on public.reactions for delete to authenticated
  using (public.is_member() and user_id = auth.uid());

drop policy if exists comments_read   on public.comments;
drop policy if exists comments_insert on public.comments;
drop policy if exists comments_delete on public.comments;
create policy comments_read   on public.comments for select to authenticated using (public.is_member());
create policy comments_insert on public.comments for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (public.is_member() and user_id = auth.uid());

-- Chapters: both can read and add. Only the person who made one can rename or delete it.
drop policy if exists chapters_read   on public.chapters;
drop policy if exists chapters_insert on public.chapters;
drop policy if exists chapters_update on public.chapters;
drop policy if exists chapters_delete on public.chapters;
create policy chapters_read   on public.chapters for select to authenticated using (public.is_member());
create policy chapters_insert on public.chapters for insert to authenticated
  with check (public.is_member() and created_by = auth.uid());
create policy chapters_update on public.chapters for update to authenticated
  using (public.is_member() and created_by = auth.uid())
  with check (public.is_member() and created_by = auth.uid());
create policy chapters_delete on public.chapters for delete to authenticated
  using (public.is_member() and created_by = auth.uid());

-- ---------------------------------------------------------------------
--  Private photo storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists photos_read   on storage.objects;
drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_delete on storage.objects;
create policy photos_read   on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_member());
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member());
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_member());

-- Next: add your two Google accounts by running supabase/members.sql
-- (copy it from supabase/members.example.sql first).
