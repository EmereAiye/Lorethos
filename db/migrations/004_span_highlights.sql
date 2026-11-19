-- Support span-level text selection highlights & multiple annotated passages per paragraph
ALTER TABLE highlights
  ADD COLUMN IF NOT EXISTS selected_text TEXT,
  ADD COLUMN IF NOT EXISTS start_offset INTEGER,
  ADD COLUMN IF NOT EXISTS end_offset INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE highlights
  DROP CONSTRAINT IF EXISTS highlights_user_id_chapter_id_paragraph_index_key;

CREATE INDEX IF NOT EXISTS idx_highlights_user_chapter
  ON highlights(user_id, chapter_id);

INSERT INTO schema_migrations (version) VALUES ('004_span_highlights')
ON CONFLICT (version) DO NOTHING;
