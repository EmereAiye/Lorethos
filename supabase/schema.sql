-- Lorethos Digital Storytelling Platform — Supabase PostgreSQL Schema & RLS Policies
-- Run this SQL in your Supabase Dashboard -> SQL Editor.

-- 1. Profiles table (id, username, role: 'reader' | 'writer' | 'admin')
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  name text not null default 'Lorethos Reader',
  nickname text,
  email text,
  avatar_url text,
  bio text,
  role text not null default 'reader',
  subscription jsonb not null default '{"plan":"free","status":"none","amountNgn":0}'::jsonb,
  unlocked_story_ids text[] not null default '{}',
  bookmarked_chapter_ids text[] not null default '{}',
  reading_progress jsonb not null default '{}'::jsonb,
  reading_goal jsonb not null default '{}'::jsonb,
  preferred_genres text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Ensure columns & role constraints exist cleanly even on upgraded databases
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists role text not null default 'reader';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('reader', 'writer', 'admin', 'owner'));

-- Automatically create a 'reader' profile when a new user registers via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_username text;
begin
  derived_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'LorethosReader'
  );

  insert into public.profiles (id, username, name, email, role)
  values (
    new.id,
    derived_username,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), derived_username),
    coalesce(new.email, ''),
    'reader'
  )
  on conflict (id) do update
    set username = coalesce(public.profiles.username, excluded.username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Stories table (id, author_id, title, summary, body, audio_url, status, likes_count, created_at)
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  summary text not null,
  body text not null,
  audio_url text,
  status text not null default 'published' check (status in ('draft', 'published')),
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.stories add column if not exists author_id uuid references public.profiles(id) on delete cascade;
alter table public.stories add column if not exists title text;
alter table public.stories add column if not exists summary text;
alter table public.stories add column if not exists body text;
alter table public.stories add column if not exists audio_url text;
alter table public.stories add column if not exists status text not null default 'published';
alter table public.stories add column if not exists likes_count integer not null default 0;
alter table public.stories add column if not exists created_at timestamptz not null default now();

create index if not exists idx_stories_status_created_at
  on public.stories (status, created_at desc);

create index if not exists idx_stories_author_id
  on public.stories (author_id, created_at desc);

-- 2b. Story Likes table (story_id, user_id) with trigger syncing stories.likes_count
create table if not exists public.story_likes (
  id uuid primary key default gen_random_uuid(),
  story_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint story_likes_story_user_unique unique (story_id, user_id)
);

create index if not exists idx_story_likes_story_id
  on public.story_likes (story_id);

create index if not exists idx_story_likes_user_id
  on public.story_likes (user_id);

create or replace function public.sync_story_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.stories
    set likes_count = coalesce(likes_count, 0) + 1
    where id::text = new.story_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.stories
    set likes_count = greatest(0, coalesce(likes_count, 0) - 1)
    where id::text = old.story_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_story_like_changed on public.story_likes;
create trigger on_story_like_changed
  after insert or delete on public.story_likes
  for each row execute function public.sync_story_likes_count();

-- 2c. Chapter Comments table for ReaderView feedback on specific chapters
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  story_id text not null,
  chapter_id text not null,
  chapter_number integer not null default 1,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  tag text not null default 'Reaction' check (tag in ('Reaction', 'Lore', 'Theory')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_story_chapter_created
  on public.comments (story_id, chapter_id, created_at desc);

create index if not exists idx_comments_user_id
  on public.comments (user_id);

-- 3. Additional reader companion tables (highlights, comments, inquiries)
create table if not exists public.highlights (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id text not null,
  story_title text not null,
  story_slug text not null,
  chapter_id text not null,
  chapter_number integer not null,
  chapter_title text not null,
  paragraph_index integer not null,
  excerpt text not null,
  color text not null check (color in ('terracotta', 'gold', 'sage')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.chapter_comments (
  id text primary key,
  story_id text not null,
  chapter_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  tag text not null default 'Reaction' check (tag in ('Theory', 'Lore', 'Reaction')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_inquiries (
  id text primary key,
  reference_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  inquiry_type text not null,
  subject text not null,
  message text not null,
  submitted_at timestamptz not null default now()
);

-- 4. Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.story_likes enable row level security;
alter table public.comments enable row level security;
alter table public.highlights enable row level security;
alter table public.chapter_comments enable row level security;
alter table public.community_inquiries enable row level security;

-- Helper function to check active user's role safely without RLS recursion
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

-- Profiles RLS Policies
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Profiles usernames are publicly readable" on public.profiles;
create policy "Profiles usernames are publicly readable"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id and role = 'reader');

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = coalesce(public.current_user_role(), 'reader')
  );

-- Stories RLS Policies
drop policy if exists "Stories are publicly readable" on public.stories;
drop policy if exists "Published stories are publicly readable" on public.stories;
create policy "Published stories are publicly readable"
  on public.stories for select
  using (
    status = 'published'
    or auth.uid() = author_id
    or public.current_user_role() in ('admin', 'owner')
  );

drop policy if exists "Owner can manage stories" on public.stories;
drop policy if exists "Approved writers and admins can insert stories" on public.stories;
create policy "Approved writers and admins can insert stories"
  on public.stories for insert
  with check (
    auth.uid() = author_id
    and public.current_user_role() in ('writer', 'admin', 'owner')
  );

drop policy if exists "Writers can update own stories and admins can update all" on public.stories;
create policy "Writers can update own stories and admins can update all"
  on public.stories for update
  using (
    (auth.uid() = author_id and public.current_user_role() in ('writer', 'admin', 'owner'))
    or public.current_user_role() in ('admin', 'owner')
  )
  with check (
    (auth.uid() = author_id and public.current_user_role() in ('writer', 'admin', 'owner'))
    or public.current_user_role() in ('admin', 'owner')
  );

drop policy if exists "Writers can delete own stories and admins can delete all" on public.stories;
create policy "Writers can delete own stories and admins can delete all"
  on public.stories for delete
  using (
    (auth.uid() = author_id and public.current_user_role() in ('writer', 'admin', 'owner'))
    or public.current_user_role() in ('admin', 'owner')
  );

-- Story Likes RLS Policies
drop policy if exists "Story likes are publicly readable" on public.story_likes;
create policy "Story likes are publicly readable"
  on public.story_likes for select
  using (true);

drop policy if exists "Authenticated users can like stories" on public.story_likes;
create policy "Authenticated users can like stories"
  on public.story_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own story likes" on public.story_likes;
create policy "Users can remove their own story likes"
  on public.story_likes for delete
  using (auth.uid() = user_id);

-- ReaderView Chapter Comments RLS Policies
drop policy if exists "Story comments are publicly readable" on public.comments;
create policy "Story comments are publicly readable"
  on public.comments for select
  using (true);

drop policy if exists "Authenticated readers can post story comments" on public.comments;
create policy "Authenticated readers can post story comments"
  on public.comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Comment authors or admins can delete story comments" on public.comments;
create policy "Comment authors or admins can delete story comments"
  on public.comments for delete
  using (
    auth.uid() = user_id
    or public.current_user_role() in ('admin', 'owner')
  );

-- Highlights RLS Policies
drop policy if exists "Users can view own highlights" on public.highlights;
create policy "Users can view own highlights"
  on public.highlights for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own highlights" on public.highlights;
create policy "Users can insert own highlights"
  on public.highlights for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own highlights" on public.highlights;
create policy "Users can update own highlights"
  on public.highlights for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own highlights" on public.highlights;
create policy "Users can delete own highlights"
  on public.highlights for delete
  using (auth.uid() = user_id);

-- Chapter comments RLS Policies
drop policy if exists "Comments are publicly readable" on public.chapter_comments;
create policy "Comments are publicly readable"
  on public.chapter_comments for select
  using (true);

drop policy if exists "Authenticated users can post comments" on public.chapter_comments;
create policy "Authenticated users can post comments"
  on public.chapter_comments for insert
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

drop policy if exists "Authors or owner can delete comments" on public.chapter_comments;
create policy "Authors or owner can delete comments"
  on public.chapter_comments for delete
  using (
    auth.uid() = user_id
    or public.current_user_role() in ('admin', 'owner')
  );

-- Community inquiries RLS Policies
drop policy if exists "Anyone can submit editorial inquiry" on public.community_inquiries;
create policy "Anyone can submit editorial inquiry"
  on public.community_inquiries for insert
  with check (true);

drop policy if exists "Owner or sender can read inquiries" on public.community_inquiries;
create policy "Owner or sender can read inquiries"
  on public.community_inquiries for select
  using (
    auth.uid() = user_id
    or public.current_user_role() in ('admin', 'owner')
  );

-- 5. Storage Bucket for Trailer Audio ('trailers')
insert into storage.buckets (id, name, public)
values ('trailers', 'trailers', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can listen to trailer audio" on storage.objects;
create policy "Public can listen to trailer audio"
  on storage.objects for select
  using (bucket_id = 'trailers');

drop policy if exists "Writers and admins can upload trailer audio" on storage.objects;
create policy "Writers and admins can upload trailer audio"
  on storage.objects for insert
  with check (
    bucket_id = 'trailers'
    and public.current_user_role() in ('writer', 'admin', 'owner')
  );

drop policy if exists "Writers and admins can update trailer audio" on storage.objects;
create policy "Writers and admins can update trailer audio"
  on storage.objects for update
  using (
    bucket_id = 'trailers'
    and (
      owner = auth.uid()
      or public.current_user_role() in ('admin', 'owner')
    )
  );

drop policy if exists "Writers and admins can delete trailer audio" on storage.objects;
create policy "Writers and admins can delete trailer audio"
  on storage.objects for delete
  using (
    bucket_id = 'trailers'
    and (
      owner = auth.uid()
      or public.current_user_role() in ('admin', 'owner')
    )
  );
