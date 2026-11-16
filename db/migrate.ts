import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { AUTHORITATIVE_STORIES } from '../server/catalog';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resolveMigrationsDir(): Promise<string> {
  const candidates = [
    path.join(__dirname, 'migrations'),
    path.join(__dirname, '..', 'db', 'migrations'),
    path.resolve(process.cwd(), 'db', 'migrations')
  ];
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // try next candidate
    }
  }
  throw new Error('Could not locate db/migrations directory.');
}

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.log('DATABASE_URL is not configured; skipping PostgreSQL migrations.');
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 3,
    connectionTimeoutMillis: 15000
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = await resolveMigrationsDir();
    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const existing = await pool.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        console.log(`Migration already applied: ${version}`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      console.log(`Applying migration: ${version}`);
      await pool.query('BEGIN');
      try {
        await pool.query(sql);
        await pool.query(
          'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
          [version]
        );
        await pool.query('COMMIT');
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }
    }

    // Idempotently seed approved initial catalog if not already imported
    for (const story of AUTHORITATIVE_STORIES) {
      await pool.query(
        `INSERT INTO stories (
          id, slug, title, subtitle, author, author_bio, genre, tags,
          cover_image, synopsis, prologue_lore, status, publication_status,
          access_tier, price_ngn, free_chapters_count, featured, spotlight_order, updated_at_label
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (id) DO NOTHING`,
        [
          story.id,
          story.slug,
          story.title,
          story.subtitle,
          story.author,
          story.authorBio,
          story.genre,
          JSON.stringify(story.tags),
          story.coverImage,
          story.synopsis,
          story.prologueLore,
          story.status,
          story.publicationStatus || 'published',
          story.accessTier,
          story.priceNgn,
          story.freeChaptersCount,
          story.featured,
          story.spotlightOrder ?? null,
          story.updatedAt
        ]
      );

      for (const ch of story.chapters) {
        await pool.query(
          `INSERT INTO chapters (
            id, story_id, chapter_number, title, slug, release_date_label,
            word_count, read_time_minutes, is_free, excerpt, content, ambient_soundscape
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
          ON CONFLICT (id) DO NOTHING`,
          [
            ch.id,
            story.id,
            ch.chapterNumber,
            ch.title,
            ch.slug,
            ch.releaseDate,
            ch.wordCount,
            ch.readTimeMinutes,
            ch.isFree,
            ch.excerpt,
            JSON.stringify(ch.content),
            ch.ambientSoundscape ?? null
          ]
        );
      }
    }

    console.log('Migrations and approved catalog seed check complete.');
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
