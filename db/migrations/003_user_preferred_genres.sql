-- Persist reader genre preferences directly on user profile

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_genres JSONB NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO schema_migrations (version) VALUES ('003_user_preferred_genres')
ON CONFLICT (version) DO NOTHING;
