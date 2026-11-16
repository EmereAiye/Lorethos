-- Lorethos Digital Storytelling Platform — Supabase PostgreSQL Schema & RLS Policies
-- Run this SQL in your Supabase Dashboard -> SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Lorethos Reader',
  email text not null,
  role text not null default 'reader' check (role in ('reader', 'owner')),
  subscription jsonb not null default '{"plan":"free","status":"none","amountNgn":0}'::jsonb,
  unlocked_story_ids text[] not null default '{}',
  bookmarked_chapter_ids text[] not null default '{}',
  reading_progress jsonb not null default '{}'::jsonb,
  reading_goal jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.stories (
  id text primary key,
  slug text unique not null,
  title text not null,
  subtitle text not null default '',
  author text not null,
  author_bio text not null default '',
  genre text not null,
  tags text[] not null default '{}',
  cover_image text not null,
  synopsis text not null,
  prologue_lore text not null default '',
  status text not null default 'Ongoing',
  access_tier text not null default 'subscription',
  price_ngn integer not null default 2500,
  rating numeric(3,2) not null default 5.0,
  ratings_count integer not null default 1,
  total_chapters integer not null default 1,
  total_reads integer not null default 0,
  free_chapters_count integer not null default 3,
  featured boolean not null default false,
  spotlight_order integer,
  updated_at text not null default 'Today',
  chapters jsonb not null default '[]'::jsonb
);

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

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.highlights enable row level security;
alter table public.chapter_comments enable row level security;
alter table public.community_inquiries enable row level security;

-- Profiles: users read and update only their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Stories: public catalog readable by everyone, editable by owner email
create policy "Stories are publicly readable"
  on public.stories for select
  using (true);

create policy "Owner can manage stories"
  on public.stories for all
  using ((auth.jwt() ->> 'email') = 'Emmymasterwise@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'Emmymasterwise@gmail.com');

-- Highlights: strictly private per reader
create policy "Users can view own highlights"
  on public.highlights for select
  using (auth.uid() = user_id);

create policy "Users can insert own highlights"
  on public.highlights for insert
  with check (auth.uid() = user_id);

create policy "Users can update own highlights"
  on public.highlights for update
  using (auth.uid() = user_id);

create policy "Users can delete own highlights"
  on public.highlights for delete
  using (auth.uid() = user_id);

-- Chapter comments: public read, signed-in create, author/owner delete
create policy "Comments are publicly readable"
  on public.chapter_comments for select
  using (true);

create policy "Authenticated users can post comments"
  on public.chapter_comments for insert
  with check (auth.uid() is not null and (user_id is null or auth.uid() = user_id));

create policy "Authors or owner can delete comments"
  on public.chapter_comments for delete
  using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'Emmymasterwise@gmail.com');

-- Community inquiries: anyone can submit, submitter or owner can view
create policy "Anyone can submit editorial inquiry"
  on public.community_inquiries for insert
  with check (true);

create policy "Owner or sender can read inquiries"
  on public.community_inquiries for select
  using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'Emmymasterwise@gmail.com');
