-- Lorethos Initial Production Database Schema (PostgreSQL 16+)
-- Covers accounts, sessions, catalog stories/chapters, orders, webhooks,
-- entitlements, subscriptions, reading progress, bookmarks, highlights, comments, and inquiries.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'owner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  author TEXT NOT NULL,
  author_bio TEXT NOT NULL,
  genre TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  cover_image TEXT NOT NULL,
  synopsis TEXT NOT NULL,
  prologue_lore TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ongoing' CHECK (status IN ('Ongoing', 'Completed', 'Hiatus')),
  access_tier TEXT NOT NULL DEFAULT 'subscription' CHECK (access_tier IN ('free', 'subscription', 'purchase')),
  price_ngn INTEGER NOT NULL DEFAULT 0 CHECK (price_ngn >= 0),
  free_chapters_count INTEGER NOT NULL DEFAULT 3 CHECK (free_chapters_count >= 0),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  spotlight_order INTEGER,
  updated_at_label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL CHECK (chapter_number > 0),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  release_date_label TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  read_time_minutes INTEGER NOT NULL DEFAULT 1,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  excerpt TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  ambient_soundscape TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_chapters_story_id ON chapters(story_id);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('subscription', 'book_purchase')),
  plan_id TEXT CHECK (plan_id IN ('monthly', 'annual')),
  story_id TEXT REFERENCES stories(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  amount_ngn INTEGER NOT NULL CHECK (amount_ngn > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  channel TEXT NOT NULL DEFAULT 'hosted',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

CREATE TABLE IF NOT EXISTS payment_events (
  event_id TEXT PRIMARY KEY,
  order_reference TEXT REFERENCES orders(reference) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  source_order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, story_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('active', 'expired', 'none')),
  amount_ngn INTEGER NOT NULL DEFAULT 0,
  valid_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reading_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  progress_percent INTEGER NOT NULL CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, story_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  excerpt TEXT NOT NULL,
  color TEXT NOT NULL CHECK (color IN ('terracotta', 'gold', 'sage')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chapter_id, paragraph_index)
);

CREATE TABLE IF NOT EXISTS chapter_comments (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  tag TEXT NOT NULL CHECK (tag IN ('Reaction', 'Lore', 'Theory')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  reference_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  inquiry_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('001_initial_schema')
ON CONFLICT (version) DO NOTHING;
