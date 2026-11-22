-- Track per-user email verification status
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

INSERT INTO schema_migrations (version) VALUES ('005_email_verification')
ON CONFLICT (version) DO NOTHING;
