-- Add paragraph & section bookmarks per user and chapter paragraph

CREATE TABLE IF NOT EXISTS paragraph_bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL CHECK (paragraph_index >= 0),
  label TEXT,
  excerpt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chapter_id, paragraph_index)
);

CREATE INDEX IF NOT EXISTS idx_paragraph_bookmarks_user_id ON paragraph_bookmarks(user_id);

INSERT INTO schema_migrations (version) VALUES ('002_paragraph_bookmarks')
ON CONFLICT (version) DO NOTHING;
