-- Add editorial publication workflow statuses and persistent reading goals

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published'
  CHECK (publication_status IN ('draft', 'review', 'published'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reading_goal JSONB;

INSERT INTO schema_migrations (version) VALUES ('002_workflow_and_goals')
ON CONFLICT (version) DO NOTHING;
