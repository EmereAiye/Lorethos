import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Story,
  Chapter,
  AccessTier,
  PublicationStatus,
  UserProfile,
  PaymentTransaction,
  TextHighlight,
  ParagraphBookmark,
  ChapterComment,
  CommunityInquiry,
  ReadingGoal,
  StoryBookshelf,
  BookshelfVisibility,
  WriterRole,
  AdminUserDirectoryEntry,
  LeaderboardPeriod,
  LeaderboardEntry,
  LeaderboardViewerStanding,
  LeaderboardResponse,
  CachedChapterTranslation
} from '../src/types/index.js';
import { AUTHORITATIVE_STORIES, withOfficialTrailerMetadata } from './catalog.js';
import { getDisplayName, getTierForCompletedChapters } from '../src/utils/readerProfile.js';
import {
  DEFAULT_WRITER_COVER_IMAGE,
  MAX_WORDS_PER_CHAPTER,
  countWords,
  normalizePortableCoverUrl,
  splitProseIntoParagraphs,
} from '../src/utils/coverImage.js';

export class DuplicateEmailError extends Error {
  public readonly code = '23505';
  constructor(message = 'An account with this email already exists. Please sign in.') {
    super(message);
    this.name = 'DuplicateEmailError';
  }
}

function getConfiguredSupabaseDbClient(): SupabaseClient | null {
  const clean = (val: string | undefined) => (val || '').trim().replace(/^["']|["']$/g, '');
  const rawUrl = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const rawKey = clean(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY
  );
  if (
    !rawUrl ||
    !rawKey ||
    rawUrl.includes('YOUR_PROJECT_ID') ||
    rawKey.includes('YOUR_SUPABASE')
  ) {
    return null;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return createClient(parsed.origin, rawKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch {
    return null;
  }
}

export interface StoredUserRecord {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: string;
  emailVerificationAttempts?: number;
  avatar?: string;
  bio?: string;
  passwordHash: string;
  role: WriterRole;
  subscription: UserProfile['subscription'];
  unlockedStoryIds: string[];
  bookmarkedChapterIds: string[];
  readingProgress: UserProfile['readingProgress'];
  readingGoal: ReadingGoal;
  createdAt: string;
}

export interface ServerOrder {
  id: string;
  reference: string;
  userId: string;
  customerEmail: string;
  itemType: 'subscription' | 'book_purchase';
  planId?: 'monthly' | 'annual';
  storyId?: string;
  itemName: string;
  amountNgn: number;
  currency: 'NGN';
  channel: 'card' | 'bank_transfer' | 'ussd' | 'hosted';
  status: 'pending' | 'success' | 'failed';
  createdAt: string;
  fulfilledAt?: string;
}

interface PersistedSnapshot {
  users: StoredUserRecord[];
  stories: Story[];
  orders: ServerOrder[];
  processedEventIds: string[];
  highlights: Record<string, TextHighlight[]>;
  paragraphBookmarks: Record<string, ParagraphBookmark[]>;
  comments: ChapterComment[];
  inquiries: CommunityInquiry[];
  storyLikes?: Record<string, string[]>;
  bookshelves?: StoryBookshelf[];
  chapterTranslations?: Record<string, CachedChapterTranslation>;
}

export const PLAN_PRICES_NGN: Record<'monthly' | 'annual', { amountNgn: number; label: string }> = {
  monthly: { amountNgn: 3500, label: 'Patron Monthly Subscription' },
  annual: { amountNgn: 32000, label: 'Patron Annual Subscription (12 Months)' }
};

function getOwnerEmail(): string {
  return (process.env.OWNER_EMAIL || 'Emmymasterwise@gmail.com').trim().toLowerCase();
}

export function isOwnerUser(user: Pick<StoredUserRecord, 'role' | 'email'> | undefined | null): boolean {
  if (!user) return false;
  return user.role === 'owner' || user.email.trim().toLowerCase() === getOwnerEmail();
}

function normalizeServerRole(rawRole: unknown, email: string): WriterRole {
  if (email.trim().toLowerCase() === getOwnerEmail()) return 'owner';
  const val = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
  if (val === 'owner') return 'owner';
  if (val === 'writer') return 'writer';
  if (val === 'admin') return 'admin';
  return 'reader';
}

function getStateFilePath(): string {
  return process.env.LORETHOS_DATA_FILE || '/tmp/lorethos-server-state.json';
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function buildDefaultReadingGoal(): ReadingGoal {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return {
    frequency: 'daily',
    targetChapters: 2,
    currentProgress: 0,
    streakDays: 0,
    bestStreakDays: 0,
    lastUpdatedDate: iso(now),
    completedChapterIds: [],
    completedAtByChapter: {},
    history: Array.from({ length: 14 }, (_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (13 - idx));
      return {
        dayName: dayNames[d.getDay()],
        dateStr: `${monthNames[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`,
        dateIso: iso(d),
        chaptersRead: 0,
        metTarget: false
      };
    })
  };
}

class LorethosRepository {
  private pool: Pool | null = null;
  private state: PersistedSnapshot;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const connStr = process.env.DATABASE_URL?.trim();
    if (connStr) {
      const isLocalDb = /localhost|127\.0\.0\.1|@db:|@postgres:/i.test(connStr);
      const needsSsl =
        !isLocalDb &&
        (connStr.includes('sslmode=require') ||
          connStr.includes('supabase.') ||
          connStr.includes('neon.') ||
          Boolean(process.env.VERCEL));
      this.pool = new Pool({
        connectionString: connStr,
        max: 10,
        connectionTimeoutMillis: 10000,
        ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {})
      });
      this.pool.on('error', (err) => {
        console.error('PostgreSQL pool error:', err);
      });
    }

    this.state = this.loadInitialSnapshot();
  }

  private loadInitialSnapshot(): PersistedSnapshot {
    const stateFile = getStateFilePath();
    try {
      if (fs.existsSync(stateFile)) {
        const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as PersistedSnapshot;
        if (Array.isArray(parsed.stories) && parsed.stories.length > 0) {
          return {
            users: (parsed.users || []).map((u) => ({
              ...u,
              role: normalizeServerRole(u.role, String(u.email || '')),
            })),
            stories: parsed.stories.map((s) =>
              withOfficialTrailerMetadata({
                ...s,
                publicationStatus: s.publicationStatus || 'published',
                totalChapters: s.chapters.length
              })
            ),
            orders: parsed.orders || [],
            processedEventIds: parsed.processedEventIds || [],
            highlights: parsed.highlights || {},
            paragraphBookmarks: parsed.paragraphBookmarks || {},
            comments: parsed.comments || [],
            inquiries: parsed.inquiries || [],
            storyLikes: parsed.storyLikes || {},
            bookshelves: Array.isArray(parsed.bookshelves) ? parsed.bookshelves : [],
            chapterTranslations:
              parsed.chapterTranslations && typeof parsed.chapterTranslations === 'object'
                ? parsed.chapterTranslations
                : {},
          };
        }
      }
    } catch {
      // Fallback cleanly to fresh seeded snapshot
    }

    return {
      users: [],
      stories: AUTHORITATIVE_STORIES.map((s) => ({
        ...s,
        publicationStatus: s.publicationStatus || 'published',
        totalChapters: s.chapters.length
      })),
      orders: [],
      processedEventIds: [],
      highlights: {},
      paragraphBookmarks: {},
      comments: [],
      inquiries: [],
      storyLikes: {},
      bookshelves: [],
      chapterTranslations: {},
    };
  }

  private persistSnapshot(): void {
    const stateFile = getStateFilePath();
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(this.state, null, 2));
    } catch {
      // Ignore write failures in read-only runtimes
    }
  }

  private mirrorToPostgres(task: (pool: Pool) => Promise<void>): void {
    if (!this.pool) return;
    const pool = this.pool;
    void task(pool).catch((err) => {
      console.error('PostgreSQL persistence mirror warning:', err instanceof Error ? err.message : err);
    });
  }

  private async ensurePostgresSchema(pool: Pool): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'reader',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reading_goal JSONB;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('reader', 'writer', 'admin', 'owner'));
    `).catch((err) => {
      console.warn('Optional users column migration warning:', err instanceof Error ? err.message : err);
    });

    await pool.query(`
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
        publication_status TEXT NOT NULL DEFAULT 'published' CHECK (publication_status IN ('draft', 'review', 'published')),
        access_tier TEXT NOT NULL DEFAULT 'subscription' CHECK (access_tier IN ('free', 'subscription', 'purchase')),
        price_ngn INTEGER NOT NULL DEFAULT 0 CHECK (price_ngn >= 0),
        writer_requires_purchase BOOLEAN NOT NULL DEFAULT FALSE,
        free_chapters_count INTEGER NOT NULL DEFAULT 3 CHECK (free_chapters_count >= 0),
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        spotlight_order INTEGER,
        updated_at_label TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE stories ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published';
      ALTER TABLE stories ADD COLUMN IF NOT EXISTS writer_requires_purchase BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE stories ADD COLUMN IF NOT EXISTS author_id TEXT;
      ALTER TABLE stories ADD COLUMN IF NOT EXISTS audio_url TEXT;
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
        selected_text TEXT,
        start_offset INTEGER,
        end_offset INTEGER,
        color TEXT NOT NULL CHECK (color IN ('terracotta', 'gold', 'sage')),
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE highlights ADD COLUMN IF NOT EXISTS selected_text TEXT;
      ALTER TABLE highlights ADD COLUMN IF NOT EXISTS start_offset INTEGER;
      ALTER TABLE highlights ADD COLUMN IF NOT EXISTS end_offset INTEGER;
      ALTER TABLE highlights ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE highlights DROP CONSTRAINT IF EXISTS highlights_user_id_chapter_id_paragraph_index_key;
      CREATE INDEX IF NOT EXISTS idx_highlights_user_chapter ON highlights(user_id, chapter_id);
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
      CREATE TABLE IF NOT EXISTS story_likes (
        story_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (story_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS story_bookshelves (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        owner_name TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
        story_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_story_bookshelves_owner ON story_bookshelves(owner_id);
      CREATE INDEX IF NOT EXISTS idx_story_bookshelves_visibility ON story_bookshelves(visibility);
      CREATE TABLE IF NOT EXISTS chapter_translations (
        cache_key TEXT PRIMARY KEY,
        story_id TEXT NOT NULL,
        story_slug TEXT NOT NULL,
        chapter_number INTEGER NOT NULL,
        language_key TEXT NOT NULL,
        language_label TEXT NOT NULL,
        translated_title TEXT,
        translated_paragraphs JSONB,
        translated_text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE chapter_translations ADD COLUMN IF NOT EXISTS translated_title TEXT;
      ALTER TABLE chapter_translations ADD COLUMN IF NOT EXISTS translated_paragraphs JSONB;
    `);

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
  }

  public async initDatabase(): Promise<void> {
    if (!this.pool) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        if (!this.pool) return;
        await this.ensurePostgresSchema(this.pool);
      await this.pool.query('SELECT 1 FROM stories LIMIT 1');

      const [
        storiesRes,
        chaptersRes,
        usersRes,
        subsRes,
        entRes,
        bmRes,
        pbmRes,
        progRes,
        hlRes,
        cmtRes,
        ordRes,
        evRes,
        inqRes,
        likesRes,
        shelvesRes,
        translationsRes
      ] = await Promise.all([
        this.pool.query('SELECT * FROM stories ORDER BY spotlight_order ASC NULLS LAST, created_at DESC'),
        this.pool.query('SELECT * FROM chapters ORDER BY chapter_number ASC'),
        this.pool.query('SELECT * FROM users'),
        this.pool.query('SELECT * FROM subscriptions'),
        this.pool.query('SELECT * FROM entitlements'),
        this.pool.query('SELECT * FROM bookmarks'),
        this.pool.query('SELECT * FROM paragraph_bookmarks ORDER BY created_at DESC'),
        this.pool.query('SELECT * FROM reading_progress'),
        this.pool.query('SELECT * FROM highlights ORDER BY created_at DESC'),
        this.pool.query('SELECT * FROM chapter_comments ORDER BY created_at DESC'),
        this.pool.query('SELECT * FROM orders ORDER BY created_at DESC'),
        this.pool.query('SELECT event_id FROM payment_events'),
        this.pool.query('SELECT * FROM contacts ORDER BY submitted_at DESC'),
        this.pool.query('SELECT story_id, user_id FROM story_likes'),
        this.pool.query('SELECT * FROM story_bookshelves ORDER BY updated_at DESC'),
        this.pool.query('SELECT * FROM chapter_translations')
      ]);

      if (storiesRes.rows.length > 0) {
        const chaptersByStory = new Map<string, Chapter[]>();
        for (const row of chaptersRes.rows) {
          const list = chaptersByStory.get(row.story_id) || [];
          list.push({
            id: row.id,
            storyId: row.story_id,
            chapterNumber: Number(row.chapter_number),
            title: row.title,
            slug: row.slug,
            releaseDate: row.release_date_label,
            wordCount: Number(row.word_count),
            readTimeMinutes: Number(row.read_time_minutes),
            isFree: Boolean(row.is_free),
            excerpt: row.excerpt,
            content: Array.isArray(row.content) ? row.content : [],
            ambientSoundscape: row.ambient_soundscape || undefined
          });
          chaptersByStory.set(row.story_id, list);
        }

        this.state.stories = storiesRes.rows.map((row) => {
          const chs = chaptersByStory.get(row.id) || [];
          return withOfficialTrailerMetadata({
            id: row.id,
            slug: row.slug,
            title: row.title,
            subtitle: row.subtitle,
            authorId: row.author_id || undefined,
            author: row.author,
            authorBio: row.author_bio,
            genre: row.genre,
            tags: Array.isArray(row.tags) ? row.tags : [],
            coverImage: row.cover_image,
            synopsis: row.synopsis,
            prologueLore: row.prologue_lore,
            status: row.status,
            publicationStatus: row.publication_status || 'published',
            accessTier: row.access_tier,
            priceNgn: Number(row.price_ngn),
            writerRequiresPurchase: Boolean(row.writer_requires_purchase),
            rating: 0,
            ratingsCount: 0,
            totalChapters: chs.length,
            totalReads: 0,
            freeChaptersCount: Number(row.free_chapters_count),
            featured: Boolean(row.featured),
            spotlightOrder: row.spotlight_order !== null ? Number(row.spotlight_order) : undefined,
            updatedAt: row.updated_at_label,
            audioUrl: row.audio_url || undefined,
            chapters: chs
          });
        });
      }

      const subByUser = new Map<string, UserProfile['subscription']>();
      for (const s of subsRes.rows) {
        subByUser.set(s.user_id, {
          plan: s.plan,
          status: s.status,
          amountNgn: Number(s.amount_ngn),
          validUntil: s.valid_until ? new Date(s.valid_until).toISOString() : undefined,
          renewsAt: s.valid_until
            ? new Date(s.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : undefined
        });
      }

      const entitlementsByUser = new Map<string, string[]>();
      for (const e of entRes.rows) {
        const list = entitlementsByUser.get(e.user_id) || [];
        list.push(e.story_id);
        entitlementsByUser.set(e.user_id, list);
      }

      const bookmarksByUser = new Map<string, string[]>();
      for (const b of bmRes.rows) {
        const list = bookmarksByUser.get(b.user_id) || [];
        list.push(b.chapter_id);
        bookmarksByUser.set(b.user_id, list);
      }

      const progressByUser = new Map<string, UserProfile['readingProgress']>();
      for (const p of progRes.rows) {
        const map = progressByUser.get(p.user_id) || {};
        map[p.story_id] = {
          chapterId: p.chapter_id,
          chapterNumber: Number(p.chapter_number),
          progressPercent: Number(p.progress_percent),
          lastReadAt: new Date(p.last_read_at).toISOString()
        };
        progressByUser.set(p.user_id, map);
      }

      this.state.users = usersRes.rows.map((u) => ({
        id: String(u.id),
        name: String(u.name || ''),
        nickname: u.nickname || undefined,
        email: String(u.email).trim().toLowerCase(),
        emailVerified: Boolean(u.email_verified),
        emailVerifiedAt: u.email_verified_at ? new Date(u.email_verified_at).toISOString() : undefined,
        avatar: u.avatar || undefined,
        bio: u.bio || undefined,
        passwordHash: u.password_hash,
        role: normalizeServerRole(u.role, String(u.email)),
        subscription: subByUser.get(u.id) || { plan: 'free', status: 'none', amountNgn: 0 },
        unlockedStoryIds: entitlementsByUser.get(u.id) || [],
        bookmarkedChapterIds: bookmarksByUser.get(u.id) || [],
        readingProgress: progressByUser.get(u.id) || {},
        readingGoal: u.reading_goal || buildDefaultReadingGoal(),
        createdAt: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString()
      }));

      this.state.highlights = {};
      const storyLookup = new Map(this.state.stories.map((s) => [s.id, s]));
      for (const h of hlRes.rows) {
        const st = storyLookup.get(h.story_id);
        const ch = st?.chapters.find((c) => c.id === h.chapter_id);
        const list = this.state.highlights[h.user_id] || [];
        list.push({
          id: h.id,
          storyId: h.story_id,
          storyTitle: st?.title || '',
          storySlug: st?.slug || '',
          chapterId: h.chapter_id,
          chapterNumber: ch?.chapterNumber || 1,
          chapterTitle: ch?.title || '',
          paragraphIndex: Number(h.paragraph_index),
          excerpt: h.excerpt,
          selectedText: h.selected_text || undefined,
          startOffset: h.start_offset !== null && h.start_offset !== undefined ? Number(h.start_offset) : undefined,
          endOffset: h.end_offset !== null && h.end_offset !== undefined ? Number(h.end_offset) : undefined,
          color: h.color,
          note: h.note || undefined,
          createdAt: new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          updatedAt: h.updated_at ? new Date(h.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined
        });
        this.state.highlights[h.user_id] = list;
      }

      this.state.paragraphBookmarks = {};
      for (const pb of pbmRes.rows) {
        const st = storyLookup.get(pb.story_id);
        const ch = st?.chapters.find((c) => c.id === pb.chapter_id);
        const list = this.state.paragraphBookmarks[pb.user_id] || [];
        list.push({
          id: pb.id,
          storyId: pb.story_id,
          storyTitle: st?.title || '',
          storySlug: st?.slug || '',
          chapterId: pb.chapter_id,
          chapterNumber: ch?.chapterNumber || 1,
          chapterTitle: ch?.title || '',
          paragraphIndex: Number(pb.paragraph_index),
          label: pb.label || undefined,
          excerpt: pb.excerpt,
          createdAt: new Date(pb.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });
        this.state.paragraphBookmarks[pb.user_id] = list;
      }

      this.state.comments = cmtRes.rows.map((c) => ({
        id: c.id,
        storyId: c.story_id,
        chapterId: c.chapter_id,
        authorName: c.author_name,
        tag: c.tag,
        body: c.body,
        createdAt: new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));

      this.state.orders = ordRes.rows.map((o) => ({
        id: o.id,
        reference: o.reference,
        userId: o.user_id,
        customerEmail: o.customer_email,
        itemType: o.item_type,
        planId: o.plan_id || undefined,
        storyId: o.story_id || undefined,
        itemName: o.item_name,
        amountNgn: Number(o.amount_ngn),
        currency: 'NGN',
        channel: o.channel,
        status: o.status,
        createdAt: new Date(o.created_at).toISOString(),
        fulfilledAt: o.fulfilled_at ? new Date(o.fulfilled_at).toISOString() : undefined
      }));

      this.state.processedEventIds = evRes.rows.map((e) => e.event_id);

      this.state.inquiries = inqRes.rows.map((i) => ({
        id: i.id,
        referenceId: i.reference_id,
        name: i.name,
        email: i.email,
        inquiryType: i.inquiry_type,
        subject: i.subject,
        message: i.message,
        submittedAt: new Date(i.submitted_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      }));

      this.state.storyLikes = {};
      for (const row of likesRes.rows) {
        const list = this.state.storyLikes[row.story_id] || [];
        if (!list.includes(row.user_id)) {
          list.push(row.user_id);
        }
        this.state.storyLikes[row.story_id] = list;
      }

      this.state.bookshelves = shelvesRes.rows.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        ownerName: row.owner_name,
        name: row.name,
        description: row.description || undefined,
        visibility: row.visibility === 'public' ? 'public' : 'private',
        storyIds: Array.isArray(row.story_ids) ? row.story_ids.filter((id: unknown): id is string => typeof id === 'string') : [],
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString()
      }));

      this.state.chapterTranslations = {};
      for (const row of translationsRes.rows) {
        const key = String(row.cache_key || '');
        if (!key) continue;
        const parsedParagraphs = Array.isArray(row.translated_paragraphs)
          ? row.translated_paragraphs.filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0)
          : undefined;
        this.state.chapterTranslations[key] = {
          key,
          storyId: String(row.story_id || ''),
          storySlug: String(row.story_slug || ''),
          chapterNumber: Number(row.chapter_number || 1),
          languageKey: String(row.language_key || ''),
          languageLabel: String(row.language_label || ''),
          translatedTitle: typeof row.translated_title === 'string' ? row.translated_title : undefined,
          translatedParagraphs: parsedParagraphs,
          translatedText: String(row.translated_text || ''),
          contentHash: String(row.content_hash || ''),
          model: String(row.model || 'gemini-2.5-flash'),
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        };
      }
      } catch (err) {
        console.warn(
          'PostgreSQL hydration skipped (schema may not be migrated yet); running with local snapshot:',
          err instanceof Error ? err.message : err
        );
      }
    })();
    return this.initPromise;
  }

  public isPostgresEnabled(): boolean {
    return this.pool !== null;
  }

  public async checkDatabaseHealth(): Promise<'postgres' | 'local-store'> {
    if (!this.pool) return 'local-store';
    try {
      await this.pool.query('SELECT 1');
      return 'postgres';
    } catch {
      return 'local-store';
    }
  }

  public toPublicProfile(user: StoredUserRecord): UserProfile {
    return {
      id: user.id,
      name: user.name,
      nickname: user.nickname || undefined,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
      emailVerifiedAt: user.emailVerifiedAt || undefined,
      avatar: normalizeServerAvatarUrl(user.avatar),
      bio: user.bio || undefined,
      role: normalizeServerRole(user.role, user.email),
      subscription: user.subscription,
      unlockedStoryIds: user.unlockedStoryIds,
      bookmarkedChapterIds: user.bookmarkedChapterIds,
      readingProgress: user.readingProgress,
      readingGoal: user.readingGoal
    };
  }

  public getUserById(userId: string): StoredUserRecord | undefined {
    const found = this.state.users.find((u) => u.id === userId);
    if (found) {
      found.role = normalizeServerRole(found.role, found.email);
    }
    return found;
  }

  public getUserByEmail(email: string): StoredUserRecord | undefined {
    const normalized = email.trim().toLowerCase();
    const found = this.state.users.find((u) => u.email.toLowerCase() === normalized);
    if (found) {
      found.role = normalizeServerRole(found.role, found.email);
    }
    return found;
  }

  private evictCachedUsersByEmail(normalizedEmail: string): void {
    const before = this.state.users.length;
    this.state.users = this.state.users.filter((u) => u.email.trim().toLowerCase() !== normalizedEmail);
    if (this.state.users.length !== before) {
      this.persistSnapshot();
    }
  }

  private hydrateRawDbUserRow(
    u: Record<string, unknown>,
    subscription: UserProfile['subscription'] = { plan: 'free', status: 'none', amountNgn: 0 },
    unlockedStoryIds: string[] = [],
    bookmarkedChapterIds: string[] = [],
    readingProgress: UserProfile['readingProgress'] = {}
  ): StoredUserRecord {
    const normalizedEmail = String(u.email || '').trim().toLowerCase();
    const avatarRaw =
      typeof u.avatar === 'string'
        ? u.avatar
        : typeof u.avatar_url === 'string'
        ? u.avatar_url
        : undefined;
    const hydrated: StoredUserRecord = {
      id: String(u.id),
      name: String(u.name || u.username || normalizedEmail.split('@')[0] || 'Reader'),
      nickname: typeof u.nickname === 'string' && u.nickname ? u.nickname : undefined,
      email: normalizedEmail,
      emailVerified: Boolean(u.email_verified),
      emailVerifiedAt: u.email_verified_at ? new Date(String(u.email_verified_at)).toISOString() : undefined,
      avatar: normalizeServerAvatarUrl(avatarRaw),
      bio: typeof u.bio === 'string' && u.bio ? u.bio : undefined,
      passwordHash: String(u.password_hash || ''),
      role: normalizeServerRole(u.role, normalizedEmail),
      subscription,
      unlockedStoryIds,
      bookmarkedChapterIds,
      readingProgress,
      readingGoal: (u.reading_goal as ReadingGoal) || buildDefaultReadingGoal(),
      createdAt: u.created_at ? new Date(String(u.created_at)).toISOString() : new Date().toISOString(),
    };
    const existingIdx = this.state.users.findIndex(
      (x) => x.id === hydrated.id || x.email.trim().toLowerCase() === hydrated.email
    );
    if (existingIdx >= 0) {
      this.state.users[existingIdx] = hydrated;
    } else {
      this.state.users.push(hydrated);
    }
    this.persistSnapshot();
    return hydrated;
  }

  private async hydrateSingleUserFromPostgres(
    whereClause: string,
    param: string,
    options: { throwOnError?: boolean } = {}
  ): Promise<StoredUserRecord | undefined> {
    if (!this.pool) return undefined;
    try {
      const userRes = await this.pool.query(
        `SELECT * FROM users WHERE ${whereClause} LIMIT 1`,
        [param]
      );
      if (!userRes.rows || userRes.rows.length === 0) return undefined;
      const u = userRes.rows[0];
      const [subRes, entRes, bmRes, progRes] = await Promise.all([
        this.pool.query('SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1', [u.id]).catch(() => ({ rows: [] })),
        this.pool.query('SELECT story_id FROM entitlements WHERE user_id = $1', [u.id]).catch(() => ({ rows: [] })),
        this.pool.query('SELECT chapter_id FROM bookmarks WHERE user_id = $1', [u.id]).catch(() => ({ rows: [] })),
        this.pool.query('SELECT * FROM reading_progress WHERE user_id = $1', [u.id]).catch(() => ({ rows: [] })),
      ]);
      const subRow = subRes.rows[0];
      const subscription: UserProfile['subscription'] = subRow
        ? {
            plan: subRow.plan,
            status: subRow.status,
            amountNgn: Number(subRow.amount_ngn),
            validUntil: subRow.valid_until ? new Date(subRow.valid_until).toISOString() : undefined,
            renewsAt: subRow.valid_until
              ? new Date(subRow.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : undefined,
          }
        : { plan: 'free', status: 'none', amountNgn: 0 };
      const readingProgress: UserProfile['readingProgress'] = {};
      for (const p of progRes.rows) {
        readingProgress[p.story_id] = {
          chapterId: p.chapter_id,
          chapterNumber: Number(p.chapter_number),
          progressPercent: Number(p.progress_percent),
          lastReadAt: new Date(p.last_read_at).toISOString(),
        };
      }
      return this.hydrateRawDbUserRow(
        u,
        subscription,
        entRes.rows.map((r) => r.story_id),
        bmRes.rows.map((r) => r.chapter_id),
        readingProgress
      );
    } catch (err) {
      if (options.throwOnError) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      return undefined;
    }
  }

  private async hydrateSingleUserFromSupabase(
    field: 'id' | 'email',
    value: string,
    options: { throwOnError?: boolean } = {}
  ): Promise<StoredUserRecord | undefined> {
    const sb = getConfiguredSupabaseDbClient();
    if (!sb) return undefined;

    const query = sb.from('users').select('*');
    const res =
      field === 'email'
        ? await query.ilike('email', value).limit(1)
        : await query.eq('id', value).limit(1);

    if (res.error) {
      if (options.throwOnError) {
        throw new Error(res.error.message || 'Failed to query public.users in Supabase.');
      }
      return undefined;
    }

    if (!Array.isArray(res.data) || res.data.length === 0 || !res.data[0]) {
      return undefined;
    }

    const row = res.data[0] as Record<string, unknown>;
    if (!row.id || !row.email) {
      return undefined;
    }
    return this.hydrateRawDbUserRow(row);
  }

  /**
   * Authoritative duplicate-email check for registration.
   * Only returns `{ exists: true }` when an actual matching user record is returned,
   * never on `[]` or a failed query, and evicts stale local cache entries if the DB has 0 rows.
   */
  public async checkExistingUserByEmail(email: string): Promise<{ exists: boolean; user?: StoredUserRecord }> {
    const normalized = email.trim().toLowerCase();

    if (this.pool) {
      const existing = await this.hydrateSingleUserFromPostgres('LOWER(email) = $1', normalized, {
        throwOnError: true,
      });
      if (existing && existing.email === normalized) {
        return { exists: true, user: existing };
      }
      this.evictCachedUsersByEmail(normalized);
      return { exists: false };
    }

    const sb = getConfiguredSupabaseDbClient();
    if (sb) {
      const { data, error } = await sb
        .from('users')
        .select('id, name, email, role')
        .ilike('email', normalized)
        .limit(1);

      if (error) {
        throw new Error(error.message || 'Unable to verify email availability in Supabase.');
      }

      if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0].email === 'string') {
        const hydrated = await this.hydrateSingleUserFromSupabase('email', normalized).catch(() => undefined);
        return { exists: true, user: hydrated };
      }

      this.evictCachedUsersByEmail(normalized);
      return { exists: false };
    }

    const cached = this.getUserByEmail(normalized);
    return cached ? { exists: true, user: cached } : { exists: false };
  }

  public async findUserById(userId: string): Promise<StoredUserRecord | undefined> {
    if (this.pool) {
      const fromPg = await this.hydrateSingleUserFromPostgres('id = $1', userId);
      if (fromPg) return fromPg;
    }
    const cached = this.getUserById(userId);
    if (cached) return cached;
    return this.hydrateSingleUserFromSupabase('id', userId);
  }

  public async findUserByEmail(email: string): Promise<StoredUserRecord | undefined> {
    const normalized = email.trim().toLowerCase();
    if (this.pool) {
      const fromPg = await this.hydrateSingleUserFromPostgres('LOWER(email) = $1', normalized);
      if (fromPg) return fromPg;
      this.evictCachedUsersByEmail(normalized);
      return undefined;
    }
    const sb = getConfiguredSupabaseDbClient();
    if (sb) {
      const fromSb = await this.hydrateSingleUserFromSupabase('email', normalized);
      if (fromSb) return fromSb;
      this.evictCachedUsersByEmail(normalized);
      return undefined;
    }
    return this.getUserByEmail(normalized);
  }

  public async createUser(name: string, email: string, password: string, nickname?: string): Promise<StoredUserRecord> {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedNickname = nickname?.trim() || undefined;
    const isOwner = normalizedEmail === getOwnerEmail();
    const record: StoredUserRecord = {
      id: crypto.randomUUID(),
      name: name.trim(),
      nickname: trimmedNickname,
      email: normalizedEmail,
      emailVerified: false,
      passwordHash: hashPassword(password),
      role: isOwner ? 'owner' : 'reader',
      subscription: { plan: 'free', status: 'none', amountNgn: 0 },
      unlockedStoryIds: [],
      bookmarkedChapterIds: [],
      readingProgress: {},
      readingGoal: buildDefaultReadingGoal(),
      createdAt: new Date().toISOString()
    };

    if (this.pool) {
      let inserted = false;
      try {
        await this.pool.query(
          `INSERT INTO users (id, name, nickname, email, password_hash, role, reading_goal, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
          [record.id, record.name, record.nickname || null, record.email, record.passwordHash, record.role, JSON.stringify(record.readingGoal)]
        );
        inserted = true;
      } catch (err: unknown) {
        const pgErr = err as { code?: string; message?: string };
        if (pgErr?.code === '23505') {
          throw new DuplicateEmailError('An account with this email already exists. Please sign in.');
        }
        if (pgErr?.code === '42703') {
          // Fallback to base public.users schema: (id, name, email, password_hash, role)
          try {
            await this.pool.query(
              `INSERT INTO users (id, name, email, password_hash, role)
               VALUES ($1, $2, $3, $4, $5)`,
              [record.id, record.name, record.email, record.passwordHash, record.role]
            );
            inserted = true;
          } catch (coreErr: unknown) {
            const corePgErr = coreErr as { code?: string; message?: string };
            if (corePgErr?.code === '23505') {
              throw new DuplicateEmailError('An account with this email already exists. Please sign in.');
            }
            throw new Error(corePgErr?.message || 'Database error while inserting user into public.users.');
          }
        } else {
          throw new Error(pgErr?.message || 'Database error while inserting user into public.users.');
        }
      }

      if (inserted) {
        await this.pool
          .query(
            `INSERT INTO subscriptions (id, user_id, plan, status, amount_ngn)
             VALUES ($1, $2, 'free', 'none', 0) ON CONFLICT (user_id) DO NOTHING`,
            [`sub_${record.id}`, record.id]
          )
          .catch(() => {});
      }
    } else {
      const sb = getConfiguredSupabaseDbClient();
      if (sb) {
        const { data: insertedRow, error: insertErr } = await sb
          .from('users')
          .insert({
            id: record.id,
            name: record.name,
            email: record.email,
            password_hash: record.passwordHash,
            role: record.role,
          })
          .select('id, name, email, role')
          .maybeSingle();

        if (insertErr) {
          if (insertErr.code === '23505') {
            throw new DuplicateEmailError('An account with this email already exists. Please sign in.');
          }
          throw new Error(insertErr.message || 'Supabase error while creating user account.');
        }

        if (!insertedRow) {
          throw new Error('Supabase insert did not return the new public.users row.');
        }
      }
    }

    this.evictCachedUsersByEmail(normalizedEmail);
    this.state.users.push(record);
    this.persistSnapshot();

    return record;
  }

  public updateUserProfile(
    userId: string,
    patch: {
      name?: string;
      nickname?: string | null;
      avatar?: string | null;
      bio?: string | null;
    }
  ): StoredUserRecord | null {
    const user = this.getUserById(userId);
    if (!user) return null;

    if (patch.name !== undefined) {
      user.name = patch.name.trim();
    }
    if (patch.nickname !== undefined) {
      user.nickname = patch.nickname === null ? undefined : patch.nickname.trim() || undefined;
    }
    if (patch.avatar !== undefined) {
      user.avatar = patch.avatar === null ? undefined : normalizeServerAvatarUrl(patch.avatar);
    }
    if (patch.bio !== undefined) {
      user.bio = patch.bio === null ? undefined : patch.bio.trim() || undefined;
    }

    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `UPDATE users
         SET name = $2,
             nickname = $3,
             avatar = $4,
             bio = $5,
             updated_at = NOW()
         WHERE id = $1`,
        [
          userId,
          user.name,
          user.nickname ?? null,
          user.avatar ?? null,
          user.bio ?? null,
        ]
      );
    });

    return user;
  }

  public issueEmailVerificationCode(userId: string, tokenHash: string, expiresAtIso: string): StoredUserRecord | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationExpiresAt = expiresAtIso;
    user.emailVerificationAttempts = 0;
    this.persistSnapshot();
    return user;
  }

  public incrementEmailVerificationAttempt(userId: string): number {
    const user = this.getUserById(userId);
    if (!user) return 0;
    const nextAttempts = (user.emailVerificationAttempts || 0) + 1;
    user.emailVerificationAttempts = nextAttempts;
    if (nextAttempts >= 5) {
      user.emailVerificationTokenHash = undefined;
      user.emailVerificationExpiresAt = undefined;
    }
    this.persistSnapshot();
    return nextAttempts;
  }

  public markEmailVerified(userId: string, verifiedAtIso?: string): StoredUserRecord | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    const confirmedAt = verifiedAtIso || new Date().toISOString();
    user.emailVerified = true;
    user.emailVerifiedAt = confirmedAt;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    user.emailVerificationAttempts = 0;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
         ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`
      );
      await pool.query(
        `UPDATE users
         SET email_verified = TRUE,
             email_verified_at = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [userId, confirmedAt]
      );
    });

    return user;
  }

  public getStories(options?: { includeUnpublished?: boolean }): Story[] {
    const includeUnpublished = Boolean(options?.includeUnpublished);
    return this.state.stories
      .filter((s) => includeUnpublished || (s.publicationStatus || 'published') === 'published')
      .map((s) => ({
        ...s,
        publicationStatus: s.publicationStatus || 'published',
        totalChapters: s.chapters.length
      }));
  }

  public getStoryBySlug(slug: string, options?: { includeUnpublished?: boolean }): Story | undefined {
    const story = this.state.stories.find((s) => s.slug === slug);
    if (!story) return undefined;
    const status = story.publicationStatus || 'published';
    if (!options?.includeUnpublished && status !== 'published') return undefined;
    return { ...story, publicationStatus: status, totalChapters: story.chapters.length };
  }

  public getStoryById(storyId: string): Story | undefined {
    const story = this.state.stories.find((s) => s.id === storyId);
    return story
      ? { ...story, publicationStatus: story.publicationStatus || 'published', totalChapters: story.chapters.length }
      : undefined;
  }

  public hasAccessToChapter(user: StoredUserRecord | undefined, story: Story, chapter: Chapter): boolean {
    const isOwner = Boolean(
      user && (user.role === 'owner' || user.email.trim().toLowerCase() === getOwnerEmail())
    );
    if (isOwner) return true;

    const pubStatus = story.publicationStatus || 'published';
    if (pubStatus !== 'published') {
      return false;
    }
    if (chapter.isFree || story.accessTier === 'free') return true;
    if (!user) return false;
    if (user.unlockedStoryIds.includes(story.id)) return true;

    // Writers and editorial admins read all published books complimentary unless Owner requires purchase
    if (user.role === 'writer' || user.role === 'admin') {
      return !Boolean(story.writerRequiresPurchase);
    }

    if (user.subscription.status === 'active' && story.accessTier === 'subscription') return true;
    return false;
  }

  public addStory(input: Omit<Story, 'id' | 'chapters'>): Story {
    const baseSlug =
      input.slug ||
      input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
      'story';
    const slug = this.state.stories.some((s) => s.slug === baseSlug)
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    const id = `story-${Date.now()}`;
    const initialChapterId = `ch-${Date.now()}-1`;
    const initialChapter: Chapter = {
      id: initialChapterId,
      storyId: id,
      chapterNumber: 1,
      title: 'Chapter 1: Opening',
      slug: 'chapter-1-opening',
      releaseDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      wordCount: 350,
      readTimeMinutes: 2,
      isFree: true,
      excerpt: 'Opening chapter draft.',
      content: ['Begin writing this series in the chapter studio.']
    };

    const newStory: Story = {
      ...input,
      id,
      slug,
      publicationStatus: input.publicationStatus || 'draft',
      writerRequiresPurchase: Boolean(input.writerRequiresPurchase),
      rating: 0,
      ratingsCount: 0,
      totalReads: 0,
      totalChapters: 1,
      chapters: [initialChapter]
    };

    this.state.stories.unshift(newStory);
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO stories (
          id, slug, title, subtitle, author, author_bio, genre, tags, cover_image,
          synopsis, prologue_lore, status, publication_status, access_tier, price_ngn,
          writer_requires_purchase, free_chapters_count, featured, updated_at_label
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          newStory.id,
          newStory.slug,
          newStory.title,
          newStory.subtitle,
          newStory.author,
          newStory.authorBio,
          newStory.genre,
          JSON.stringify(newStory.tags),
          newStory.coverImage,
          newStory.synopsis,
          newStory.prologueLore,
          newStory.status,
          newStory.publicationStatus,
          newStory.accessTier,
          newStory.priceNgn,
          Boolean(newStory.writerRequiresPurchase),
          newStory.freeChaptersCount,
          newStory.featured,
          newStory.updatedAt
        ]
      );
      await pool.query(
        `INSERT INTO chapters (
          id, story_id, chapter_number, title, slug, release_date_label,
          word_count, read_time_minutes, is_free, excerpt, content
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          initialChapter.id,
          newStory.id,
          initialChapter.chapterNumber,
          initialChapter.title,
          initialChapter.slug,
          initialChapter.releaseDate,
          initialChapter.wordCount,
          initialChapter.readTimeMinutes,
          initialChapter.isFree,
          initialChapter.excerpt,
          JSON.stringify(initialChapter.content)
        ]
      );
    });

    return newStory;
  }

  public addChapterToStory(storyId: string, chapterData: Omit<Chapter, 'id' | 'storyId'>): Chapter | null {
    const story = this.state.stories.find((s) => s.id === storyId);
    if (!story) return null;

    const newChapter: Chapter = {
      ...chapterData,
      id: `ch-${Date.now()}`,
      storyId
    };
    story.chapters.push(newChapter);
    story.totalChapters = story.chapters.length;
    story.updatedAt = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO chapters (
          id, story_id, chapter_number, title, slug, release_date_label,
          word_count, read_time_minutes, is_free, excerpt, content
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          newChapter.id,
          storyId,
          newChapter.chapterNumber,
          newChapter.title,
          newChapter.slug,
          newChapter.releaseDate,
          newChapter.wordCount,
          newChapter.readTimeMinutes,
          newChapter.isFree,
          newChapter.excerpt,
          JSON.stringify(newChapter.content)
        ]
      );
      await pool.query('UPDATE stories SET updated_at_label = $1, updated_at = NOW() WHERE id = $2', [
        story.updatedAt,
        storyId
      ]);
    });

    return newChapter;
  }

  public updateStoryPricing(
    storyId: string,
    tier: AccessTier,
    priceNgn: number,
    freeChaptersCount: number,
    writerRequiresPurchase?: boolean
  ): Story | null {
    const story = this.state.stories.find((s) => s.id === storyId);
    if (!story) return null;
    story.accessTier = tier;
    story.priceNgn = Math.max(0, Math.round(priceNgn));
    story.freeChaptersCount = Math.max(0, Math.round(freeChaptersCount));
    if (typeof writerRequiresPurchase === 'boolean') {
      story.writerRequiresPurchase = writerRequiresPurchase;
    }
    story.chapters = story.chapters.map((ch, idx) => ({
      ...ch,
      isFree: tier === 'free' ? true : idx < story.freeChaptersCount
    }));
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        'UPDATE stories SET access_tier = $1, price_ngn = $2, free_chapters_count = $3, writer_requires_purchase = $4, updated_at = NOW() WHERE id = $5',
        [
          story.accessTier,
          story.priceNgn,
          story.freeChaptersCount,
          Boolean(story.writerRequiresPurchase),
          storyId
        ]
      );
      for (const ch of story.chapters) {
        await pool.query('UPDATE chapters SET is_free = $1 WHERE id = $2', [ch.isFree, ch.id]);
      }
    });

    return story;
  }

  public updateStoryWorkflow(storyId: string, publicationStatus: PublicationStatus): Story | null {
    const story = this.state.stories.find((s) => s.id === storyId);
    if (!story) return null;
    story.publicationStatus = publicationStatus;
    story.updatedAt = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        'UPDATE stories SET publication_status = $1, updated_at_label = $2, updated_at = NOW() WHERE id = $3',
        [publicationStatus, story.updatedAt, storyId]
      );
    });

    return story;
  }

  private userCanManageStory(user: StoredUserRecord, story: Story): boolean {
    if (isOwnerUser(user) || user.role === 'admin') return true;
    if (story.authorId && story.authorId === user.id) return true;
    const aliases = new Set(
      [user.name, user.nickname, user.email.split('@')[0]]
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim().toLowerCase())
    );
    return aliases.has(story.author.trim().toLowerCase());
  }

  private buildValidatedChapters(
    storyId: string,
    rawChapters: Array<{ title?: unknown; body?: unknown }>,
    accessTier: AccessTier,
    freeChaptersCount: number
  ): { ok: true; chapters: Chapter[] } | { ok: false; status: 400; error: string } {
    if (!Array.isArray(rawChapters) || rawChapters.length === 0) {
      return { ok: false, status: 400, error: 'Please include at least one chapter.' };
    }

    const releaseDate = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });

    const chapters: Chapter[] = [];
    for (let idx = 0; idx < rawChapters.length; idx += 1) {
      const chNum = idx + 1;
      const item = rawChapters[idx] || {};
      const chTitle =
        typeof item.title === 'string' && item.title.trim()
          ? item.title.trim().slice(0, 160)
          : `Chapter ${chNum}`;
      const bodyStr = typeof item.body === 'string' ? item.body : '';
      const words = countWords(bodyStr);

      if (words === 0) {
        return {
          ok: false,
          status: 400,
          error: `Chapter ${chNum} ("${chTitle}") cannot be empty. Write or paste prose for every chapter.`,
        };
      }
      if (words > MAX_WORDS_PER_CHAPTER) {
        return {
          ok: false,
          status: 400,
          error: `Chapter ${chNum} ("${chTitle}") has ${words.toLocaleString()} words, exceeding the ${MAX_WORDS_PER_CHAPTER.toLocaleString()}-word limit per chapter. Split the continuation into the next chapter.`,
        };
      }

      const paragraphs = splitProseIntoParagraphs(bodyStr);
      const excerptSource = paragraphs[0] || bodyStr.trim();
      const excerpt =
        excerptSource.length > 220
          ? `${excerptSource.slice(0, 217).replace(/\s+\S*$/, '')}...`
          : excerptSource;
      const baseSlug =
        chTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `chapter-${chNum}`;

      chapters.push({
        id: `ch-${storyId}-${chNum}-${crypto.randomBytes(3).toString('hex')}`,
        storyId,
        chapterNumber: chNum,
        title: chTitle,
        slug: `${baseSlug}-${chNum}`,
        releaseDate,
        wordCount: words,
        readTimeMinutes: Math.max(1, Math.round(words / 250)),
        isFree: accessTier === 'free' ? true : idx < freeChaptersCount,
        excerpt,
        content: paragraphs,
      });
    }

    return { ok: true, chapters };
  }

  public getManageableWriterStories(user: StoredUserRecord): Story[] {
    if (isOwnerUser(user) || user.role === 'admin') {
      return this.state.stories.map((s) => ({
        ...s,
        publicationStatus: s.publicationStatus || 'published',
        totalChapters: s.chapters.length,
      }));
    }
    return this.state.stories
      .filter((s) => this.userCanManageStory(user, s))
      .map((s) => ({
        ...s,
        publicationStatus: s.publicationStatus || 'published',
        totalChapters: s.chapters.length,
      }));
  }

  public publishWriterStory(
    user: StoredUserRecord,
    input: {
      title: string;
      subtitle?: string;
      author: string;
      genre: string;
      coverImage?: string;
      synopsis: string;
      prologueLore?: string;
      status?: Story['status'];
      publicationStatus?: PublicationStatus;
      accessTier?: AccessTier;
      priceNgn?: number;
      freeChaptersCount?: number;
      audioUrl?: string | null;
      chapters: Array<{ title?: unknown; body?: unknown }>;
    }
  ): { ok: true; story: Story } | { ok: false; status: 400; error: string } {
    const cleanTitle = input.title.trim().slice(0, 160);
    const cleanAuthor = (input.author || user.nickname || user.name || 'Lorethos Writer')
      .trim()
      .slice(0, 120);
    const cleanGenre = (input.genre || 'Epic Fantasy').trim().slice(0, 80);
    const cleanSynopsis = input.synopsis.trim().slice(0, 1800);

    if (cleanTitle.length < 2) {
      return { ok: false, status: 400, error: 'Story title must be at least 2 characters.' };
    }
    if (cleanAuthor.length < 2) {
      return { ok: false, status: 400, error: 'Please enter the author name.' };
    }
    if (cleanGenre.length < 2) {
      return { ok: false, status: 400, error: 'Please select or enter a story genre.' };
    }
    if (cleanSynopsis.length < 10) {
      return {
        ok: false,
        status: 400,
        error: 'Please enter a synopsis / trailer blurb of at least 10 characters.',
      };
    }

    const accessTier: AccessTier =
      input.accessTier === 'free' || input.accessTier === 'purchase' || input.accessTier === 'subscription'
        ? input.accessTier
        : 'free';
    const freeChaptersCount =
      accessTier === 'free'
        ? input.chapters.length
        : Math.max(1, Math.round(Number(input.freeChaptersCount ?? 1)));
    const priceNgn = accessTier === 'free' ? 0 : Math.max(0, Math.round(Number(input.priceNgn ?? 1500)));

    const id = `story-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const validatedChapters = this.buildValidatedChapters(
      id,
      input.chapters,
      accessTier,
      freeChaptersCount
    );
    if (!validatedChapters.ok) {
      return validatedChapters;
    }

    const baseSlug =
      cleanTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'lorethos-story';
    const slug = this.state.stories.some((s) => s.slug === baseSlug)
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    const resolvedCover =
      normalizePortableCoverUrl(input.coverImage) || DEFAULT_WRITER_COVER_IMAGE;
    const pubStatus: PublicationStatus =
      input.publicationStatus === 'draft' || input.publicationStatus === 'review'
        ? input.publicationStatus
        : 'published';
    const storyStatus: Story['status'] =
      input.status === 'Completed' || input.status === 'Hiatus' ? input.status : 'Ongoing';
    const safeAudioUrl =
      typeof input.audioUrl === 'string' && /^https?:\/\//i.test(input.audioUrl.trim())
        ? input.audioUrl.trim()
        : undefined;

    const newStory: Story = {
      id,
      slug,
      title: cleanTitle,
      subtitle:
        (input.subtitle || '').trim().slice(0, 220) ||
        `An original ${cleanGenre} serial by ${cleanAuthor}`,
      authorId: user.id,
      author: cleanAuthor,
      authorBio: user.bio?.trim() || `${cleanAuthor} publishes original fiction on Lorethos.`,
      genre: cleanGenre,
      tags: Array.from(new Set([cleanGenre, 'Writer Original', storyStatus])),
      coverImage: resolvedCover,
      synopsis: cleanSynopsis,
      prologueLore:
        (input.prologueLore || '').trim().slice(0, 600) ||
        `Published from the Lorethos Writer Studio by ${cleanAuthor}.`,
      status: storyStatus,
      publicationStatus: pubStatus,
      accessTier,
      priceNgn,
      writerRequiresPurchase: false,
      rating: 0,
      ratingsCount: 0,
      totalChapters: validatedChapters.chapters.length,
      totalReads: 0,
      freeChaptersCount,
      featured: false,
      updatedAt: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      audioUrl: safeAudioUrl,
      chapters: validatedChapters.chapters,
    };

    this.state.stories.unshift(newStory);
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO stories (
          id, slug, title, subtitle, author_id, author, author_bio, genre, tags, cover_image,
          synopsis, prologue_lore, status, publication_status, access_tier, price_ngn,
          writer_requires_purchase, free_chapters_count, featured, updated_at_label, audio_url
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [
          newStory.id,
          newStory.slug,
          newStory.title,
          newStory.subtitle,
          newStory.authorId ?? null,
          newStory.author,
          newStory.authorBio,
          newStory.genre,
          JSON.stringify(newStory.tags),
          newStory.coverImage,
          newStory.synopsis,
          newStory.prologueLore,
          newStory.status,
          newStory.publicationStatus,
          newStory.accessTier,
          newStory.priceNgn,
          Boolean(newStory.writerRequiresPurchase),
          newStory.freeChaptersCount,
          newStory.featured,
          newStory.updatedAt,
          newStory.audioUrl ?? null,
        ]
      );
      for (const ch of newStory.chapters) {
        await pool.query(
          `INSERT INTO chapters (
            id, story_id, chapter_number, title, slug, release_date_label,
            word_count, read_time_minutes, is_free, excerpt, content
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
          [
            ch.id,
            newStory.id,
            ch.chapterNumber,
            ch.title,
            ch.slug,
            ch.releaseDate,
            ch.wordCount,
            ch.readTimeMinutes,
            ch.isFree,
            ch.excerpt,
            JSON.stringify(ch.content),
          ]
        );
      }
    });

    return { ok: true, story: newStory };
  }

  public updateWriterStoryCatalog(
    user: StoredUserRecord,
    storyId: string,
    input: {
      title: string;
      subtitle?: string;
      author: string;
      genre: string;
      coverImage?: string;
      synopsis: string;
      prologueLore?: string;
      status?: Story['status'];
      publicationStatus?: PublicationStatus;
      accessTier?: AccessTier;
      priceNgn?: number;
      freeChaptersCount?: number;
      audioUrl?: string | null;
      chapters: Array<{ title?: unknown; body?: unknown }>;
    }
  ): { ok: true; story: Story } | { ok: false; status: 400 | 403 | 404; error: string } {
    const idx = this.state.stories.findIndex((s) => s.id === storyId);
    if (idx < 0) {
      return { ok: false, status: 404, error: 'Story not found.' };
    }
    const existing = this.state.stories[idx];
    if (!this.userCanManageStory(user, existing)) {
      return { ok: false, status: 403, error: 'You do not have permission to edit this story.' };
    }

    const cleanTitle = input.title.trim().slice(0, 160);
    const cleanAuthor = (input.author || existing.author).trim().slice(0, 120);
    const cleanGenre = (input.genre || existing.genre).trim().slice(0, 80);
    const cleanSynopsis = input.synopsis.trim().slice(0, 1800);

    if (cleanTitle.length < 2) {
      return { ok: false, status: 400, error: 'Story title must be at least 2 characters.' };
    }
    if (cleanAuthor.length < 2) {
      return { ok: false, status: 400, error: 'Please enter the author name.' };
    }
    if (cleanGenre.length < 2) {
      return { ok: false, status: 400, error: 'Please select or enter a story genre.' };
    }
    if (cleanSynopsis.length < 10) {
      return {
        ok: false,
        status: 400,
        error: 'Please enter a synopsis / trailer blurb of at least 10 characters.',
      };
    }

    const accessTier: AccessTier =
      input.accessTier === 'free' || input.accessTier === 'purchase' || input.accessTier === 'subscription'
        ? input.accessTier
        : existing.accessTier;
    const freeChaptersCount =
      accessTier === 'free'
        ? input.chapters.length
        : Math.max(1, Math.round(Number(input.freeChaptersCount ?? existing.freeChaptersCount ?? 1)));
    const priceNgn =
      accessTier === 'free' ? 0 : Math.max(0, Math.round(Number(input.priceNgn ?? existing.priceNgn ?? 1500)));

    const validatedChapters = this.buildValidatedChapters(
      existing.id,
      input.chapters,
      accessTier,
      freeChaptersCount
    );
    if (!validatedChapters.ok) {
      return validatedChapters;
    }

    const pubStatus: PublicationStatus =
      input.publicationStatus === 'draft' ||
      input.publicationStatus === 'review' ||
      input.publicationStatus === 'published'
        ? input.publicationStatus
        : existing.publicationStatus || 'published';
    const storyStatus: Story['status'] =
      input.status === 'Completed' || input.status === 'Hiatus' || input.status === 'Ongoing'
        ? input.status
        : existing.status;

    const resolvedCover =
      normalizePortableCoverUrl(input.coverImage) || existing.coverImage || DEFAULT_WRITER_COVER_IMAGE;
    const safeAudioUrl =
      input.audioUrl === null
        ? undefined
        : typeof input.audioUrl === 'string' && /^https?:\/\//i.test(input.audioUrl.trim())
        ? input.audioUrl.trim()
        : existing.audioUrl;

    const updatedStory: Story = {
      ...existing,
      title: cleanTitle,
      subtitle:
        input.subtitle !== undefined
          ? input.subtitle.trim().slice(0, 220) || `An original ${cleanGenre} serial by ${cleanAuthor}`
          : existing.subtitle,
      authorId: existing.authorId || user.id,
      author: cleanAuthor,
      genre: cleanGenre,
      tags: Array.from(new Set([cleanGenre, 'Writer Original', storyStatus])),
      coverImage: resolvedCover,
      synopsis: cleanSynopsis,
      prologueLore:
        input.prologueLore !== undefined && input.prologueLore.trim()
          ? input.prologueLore.trim().slice(0, 600)
          : existing.prologueLore,
      status: storyStatus,
      publicationStatus: pubStatus,
      accessTier,
      priceNgn,
      freeChaptersCount,
      totalChapters: validatedChapters.chapters.length,
      updatedAt: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      audioUrl: safeAudioUrl,
      chapters: validatedChapters.chapters,
    };

    this.state.stories[idx] = updatedStory;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `UPDATE stories
         SET title = $2,
             subtitle = $3,
             author_id = $4,
             author = $5,
             genre = $6,
             tags = $7::jsonb,
             cover_image = $8,
             synopsis = $9,
             prologue_lore = $10,
             status = $11,
             publication_status = $12,
             access_tier = $13,
             price_ngn = $14,
             free_chapters_count = $15,
             updated_at_label = $16,
             audio_url = $17,
             updated_at = NOW()
         WHERE id = $1`,
        [
          updatedStory.id,
          updatedStory.title,
          updatedStory.subtitle,
          updatedStory.authorId ?? null,
          updatedStory.author,
          updatedStory.genre,
          JSON.stringify(updatedStory.tags),
          updatedStory.coverImage,
          updatedStory.synopsis,
          updatedStory.prologueLore,
          updatedStory.status,
          updatedStory.publicationStatus,
          updatedStory.accessTier,
          updatedStory.priceNgn,
          updatedStory.freeChaptersCount,
          updatedStory.updatedAt,
          updatedStory.audioUrl ?? null,
        ]
      );
      await pool.query('DELETE FROM chapters WHERE story_id = $1', [updatedStory.id]);
      for (const ch of updatedStory.chapters) {
        await pool.query(
          `INSERT INTO chapters (
            id, story_id, chapter_number, title, slug, release_date_label,
            word_count, read_time_minutes, is_free, excerpt, content
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
          [
            ch.id,
            updatedStory.id,
            ch.chapterNumber,
            ch.title,
            ch.slug,
            ch.releaseDate,
            ch.wordCount,
            ch.readTimeMinutes,
            ch.isFree,
            ch.excerpt,
            JSON.stringify(ch.content),
          ]
        );
      }
    });

    return { ok: true, story: updatedStory };
  }

  public deleteWriterStoryCatalog(
    user: StoredUserRecord,
    storyId: string
  ): { ok: true } | { ok: false; status: 403 | 404; error: string } {
    const existing = this.state.stories.find((s) => s.id === storyId);
    if (!existing) {
      return { ok: false, status: 404, error: 'Story not found.' };
    }
    if (!this.userCanManageStory(user, existing)) {
      return { ok: false, status: 403, error: 'You do not have permission to delete this story.' };
    }

    this.state.stories = this.state.stories.filter((s) => s.id !== storyId);
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query('DELETE FROM stories WHERE id = $1', [storyId]);
    });

    return { ok: true };
  }

  public toggleBookmark(userId: string, chapterId: string): string[] | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    const exists = user.bookmarkedChapterIds.includes(chapterId);
    user.bookmarkedChapterIds = exists
      ? user.bookmarkedChapterIds.filter((id) => id !== chapterId)
      : [...user.bookmarkedChapterIds, chapterId];
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      if (exists) {
        await pool.query('DELETE FROM bookmarks WHERE user_id = $1 AND chapter_id = $2', [userId, chapterId]);
      } else {
        await pool.query(
          'INSERT INTO bookmarks (user_id, chapter_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, chapterId]
        );
      }
    });

    return user.bookmarkedChapterIds;
  }

  public recordProgress(
    userId: string,
    storyId: string,
    chapterId: string,
    chapterNumber: number,
    progressPercent: number
  ): UserProfile['readingProgress'] | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    const clamped = Math.min(100, Math.max(0, Math.round(progressPercent)));
    const nowIso = new Date().toISOString();
    const todayDateStr = nowIso.slice(0, 10);

    user.readingProgress[storyId] = {
      chapterId,
      chapterNumber,
      progressPercent: clamped,
      lastReadAt: nowIso
    };

    let goalUpdated = false;
    if (clamped >= 95 && chapterId) {
      const existingCompleted = Array.isArray(user.readingGoal?.completedChapterIds)
        ? [...user.readingGoal.completedChapterIds]
        : [];
      const existingDates = {
        ...(user.readingGoal?.completedAtByChapter || {})
      };
      if (!existingCompleted.includes(chapterId)) {
        existingCompleted.push(chapterId);
        goalUpdated = true;
      }
      if (!existingDates[chapterId]) {
        existingDates[chapterId] = todayDateStr;
        goalUpdated = true;
      }
      if (goalUpdated) {
        user.readingGoal = {
          ...(user.readingGoal || buildDefaultReadingGoal()),
          completedChapterIds: existingCompleted,
          completedAtByChapter: existingDates
        };
      }
    }

    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO reading_progress (user_id, story_id, chapter_id, chapter_number, progress_percent, last_read_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, story_id) DO UPDATE SET
           chapter_id = EXCLUDED.chapter_id,
           chapter_number = EXCLUDED.chapter_number,
           progress_percent = EXCLUDED.progress_percent,
           last_read_at = NOW()`,
        [userId, storyId, chapterId, chapterNumber, clamped]
      );
      if (goalUpdated) {
        await pool.query('UPDATE users SET reading_goal = $1::jsonb, updated_at = NOW() WHERE id = $2', [
          JSON.stringify(user.readingGoal),
          userId
        ]);
      }
    });

    return user.readingProgress;
  }

  public updateReadingGoal(userId: string, goal: ReadingGoal): ReadingGoal | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    const todayIso = new Date().toISOString().slice(0, 10);
    const mergedDates: Record<string, string> = {};

    const normalizeDateKey = (val: unknown): string | null => {
      if (typeof val !== 'string') return null;
      const trimmed = val.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
      }
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.toISOString().slice(0, 10);
    };

    const existingDates = user.readingGoal?.completedAtByChapter || {};
    for (const [chId, rawDate] of Object.entries(existingDates)) {
      const normalized = normalizeDateKey(rawDate);
      if (chId && normalized) {
        mergedDates[chId] = normalized;
      }
    }
    if (goal.completedAtByChapter && typeof goal.completedAtByChapter === 'object') {
      for (const [chId, rawDate] of Object.entries(goal.completedAtByChapter)) {
        const cleanId = typeof chId === 'string' ? chId.trim().slice(0, 120) : '';
        const normalized = normalizeDateKey(rawDate);
        if (cleanId && normalized) {
          mergedDates[cleanId] = normalized;
        }
      }
    }

    const completedSet = new Set<string>(
      Array.isArray(user.readingGoal?.completedChapterIds) ? user.readingGoal.completedChapterIds : []
    );
    if (Array.isArray(goal.completedChapterIds)) {
      for (const chId of goal.completedChapterIds) {
        if (typeof chId === 'string' && chId.trim()) {
          const clean = chId.trim().slice(0, 120);
          completedSet.add(clean);
          if (!mergedDates[clean]) {
            mergedDates[clean] = todayIso;
          }
        }
      }
    }

    const sanitizedGoal: ReadingGoal = {
      ...goal,
      completedChapterIds: Array.from(completedSet),
      completedAtByChapter: mergedDates
    };

    user.readingGoal = sanitizedGoal;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query('UPDATE users SET reading_goal = $1::jsonb, updated_at = NOW() WHERE id = $2', [
        JSON.stringify(sanitizedGoal),
        userId
      ]);
    });

    return user.readingGoal;
  }

  public cancelSubscription(userId: string): UserProfile['subscription'] | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.subscription = {
      ...user.subscription,
      status: 'expired'
    };
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );
    });

    return user.subscription;
  }

  public createOrder(params: {
    userId: string;
    customerEmail: string;
    itemType: 'subscription' | 'book_purchase';
    planId?: 'monthly' | 'annual';
    storyId?: string;
    itemName: string;
    amountNgn: number;
  }): ServerOrder {
    const reference = `lor_${crypto.randomBytes(6).toString('hex')}`;
    const order: ServerOrder = {
      id: `ord_${crypto.randomUUID()}`,
      reference,
      userId: params.userId,
      customerEmail: params.customerEmail,
      itemType: params.itemType,
      planId: params.planId,
      storyId: params.storyId,
      itemName: params.itemName,
      amountNgn: params.amountNgn,
      currency: 'NGN',
      channel: 'hosted',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.state.orders.unshift(order);
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO orders (
          id, reference, user_id, customer_email, item_type, plan_id, story_id,
          item_name, amount_ngn, currency, channel, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          order.id,
          order.reference,
          order.userId,
          order.customerEmail,
          order.itemType,
          order.planId ?? null,
          order.storyId ?? null,
          order.itemName,
          order.amountNgn,
          order.currency,
          order.channel,
          order.status
        ]
      );
    });

    return order;
  }

  public getOrderByReference(reference: string): ServerOrder | undefined {
    return this.state.orders.find((o) => o.reference === reference);
  }

  public fulfillOrderIdempotently(
    reference: string,
    paidAmountKobo: number,
    currency: string,
    channel: 'card' | 'bank_transfer' | 'ussd',
    eventId?: string
  ): { ok: boolean; reason?: string; order?: ServerOrder } {
    if (eventId && this.state.processedEventIds.includes(eventId)) {
      const existing = this.getOrderByReference(reference);
      return { ok: true, order: existing };
    }

    const order = this.getOrderByReference(reference);
    if (!order) {
      return { ok: false, reason: 'Order reference not found.' };
    }

    if (currency.toUpperCase() !== order.currency || paidAmountKobo < order.amountNgn * 100) {
      order.status = 'failed';
      this.persistSnapshot();
      this.mirrorToPostgres(async (pool) => {
        await pool.query(`UPDATE orders SET status = 'failed' WHERE id = $1`, [order.id]);
      });
      return { ok: false, reason: 'Amount or currency mismatch.' };
    }

    if (order.status === 'success') {
      if (eventId) {
        this.state.processedEventIds.push(eventId);
        this.persistSnapshot();
      }
      return { ok: true, order };
    }

    const user = this.getUserById(order.userId);
    if (!user) {
      return { ok: false, reason: 'Order owner account missing.' };
    }

    let validUntilIso: string | null = null;
    if (order.itemType === 'subscription') {
      const validUntil = new Date();
      if (order.planId === 'annual') {
        validUntil.setFullYear(validUntil.getFullYear() + 1);
      } else {
        validUntil.setMonth(validUntil.getMonth() + 1);
      }
      validUntilIso = validUntil.toISOString();
      user.subscription = {
        plan: order.planId || 'monthly',
        status: 'active',
        amountNgn: order.amountNgn,
        validUntil: validUntilIso,
        renewsAt: validUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };
    } else if (order.itemType === 'book_purchase' && order.storyId) {
      if (!user.unlockedStoryIds.includes(order.storyId)) {
        user.unlockedStoryIds.push(order.storyId);
      }
    }

    order.status = 'success';
    order.channel = channel;
    order.fulfilledAt = new Date().toISOString();
    if (eventId) {
      this.state.processedEventIds.push(eventId);
    }
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE orders SET status = 'success', channel = $1, fulfilled_at = NOW() WHERE id = $2`,
          [channel, order.id]
        );
        if (eventId) {
          await client.query(
            `INSERT INTO payment_events (event_id, order_reference, event_type, payload)
             VALUES ($1, $2, 'charge.success', $3::jsonb)
             ON CONFLICT (event_id) DO NOTHING`,
            [eventId, order.reference, JSON.stringify({ paidAmountKobo, currency, channel })]
          );
        }
        if (order.itemType === 'subscription') {
          await client.query(
            `INSERT INTO subscriptions (id, user_id, plan, status, amount_ngn, valid_until, updated_at)
             VALUES ($1, $2, $3, 'active', $4, $5, NOW())
             ON CONFLICT (user_id) DO UPDATE SET
               plan = EXCLUDED.plan,
               status = 'active',
               amount_ngn = EXCLUDED.amount_ngn,
               valid_until = EXCLUDED.valid_until,
               updated_at = NOW()`,
            [`sub_${user.id}`, user.id, order.planId || 'monthly', order.amountNgn, validUntilIso]
          );
        } else if (order.itemType === 'book_purchase' && order.storyId) {
          await client.query(
            `INSERT INTO entitlements (id, user_id, story_id, source_order_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, story_id) DO NOTHING`,
            [`ent_${crypto.randomUUID()}`, user.id, order.storyId, order.id]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    });

    return { ok: true, order };
  }

  public getUserTransactions(userId: string): PaymentTransaction[] {
    return this.state.orders
      .filter((o) => o.userId === userId)
      .map((o) => ({
        id: o.id,
        reference: o.reference,
        customerEmail: o.customerEmail,
        amountNgn: o.amountNgn,
        itemType: o.itemType,
        itemName: o.itemName,
        itemId: o.storyId,
        channel: o.channel === 'hosted' ? 'card' : o.channel,
        status: o.status,
        date: o.createdAt
      }));
  }

  public toAdminDirectoryEntry(user: StoredUserRecord): AdminUserDirectoryEntry {
    const completedSet = new Set<string>(
      Array.isArray(user.readingGoal?.completedChapterIds)
        ? user.readingGoal.completedChapterIds
        : []
    );
    for (const progress of Object.values(user.readingProgress || {})) {
      if (progress && progress.progressPercent >= 95 && progress.chapterId) {
        completedSet.add(progress.chapterId);
      }
    }
    const bookshelvesCount = (this.state.bookshelves || []).filter(
      (s) => s.ownerId === user.id
    ).length;

    return {
      id: user.id,
      name: user.name,
      nickname: user.nickname || undefined,
      email: user.email,
      avatar: normalizeServerAvatarUrl(user.avatar),
      bio: user.bio || undefined,
      role: normalizeServerRole(user.role, user.email),
      subscription: user.subscription,
      completedChaptersCount: completedSet.size,
      bookshelvesCount,
      createdAt: user.createdAt,
      source: 'server'
    };
  }

  public getAllUsersForOwner(): AdminUserDirectoryEntry[] {
    const rolePriority: Record<WriterRole, number> = {
      owner: 0,
      admin: 1,
      writer: 2,
      reader: 3
    };
    return [...this.state.users]
      .map((u) => this.toAdminDirectoryEntry(u))
      .sort((a, b) => {
        const diff = rolePriority[a.role] - rolePriority[b.role];
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  public getReadingLeaderboard(
    viewerUserId?: string,
    period: LeaderboardPeriod = 'weekly'
  ): LeaderboardResponse {
    const now = new Date();
    const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const parseUtcDayMs = (raw: unknown): number | null => {
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (ymdMatch) {
        const y = Number(ymdMatch[1]);
        const m = Number(ymdMatch[2]);
        const d = Number(ymdMatch[3]);
        if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
          return Date.UTC(y, m - 1, d);
        }
      }
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) return null;
      return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
    };

    const isWithinDays = (dayMs: number | null, maxDays: number): boolean => {
      if (dayMs === null) return false;
      const diffDays = Math.floor((todayUtcMs - dayMs) / 86_400_000);
      return diffDays >= -1 && diffDays < maxDays;
    };

    const publishedStories = this.state.stories.filter(
      (s) => (s.publicationStatus || 'published') === 'published'
    );

    const baseRows = this.state.users.map((user) => {
      const allCompletedIds = new Set<string>(
        Array.isArray(user.readingGoal?.completedChapterIds)
          ? user.readingGoal.completedChapterIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          : []
      );
      const weeklyIds = new Set<string>();
      const monthlyIds = new Set<string>();

      const completionMap = user.readingGoal?.completedAtByChapter;
      if (completionMap && typeof completionMap === 'object') {
        for (const [chId, dateStr] of Object.entries(completionMap)) {
          if (!chId) continue;
          allCompletedIds.add(chId);
          const dayMs = parseUtcDayMs(dateStr);
          if (isWithinDays(dayMs, 30)) {
            monthlyIds.add(chId);
          }
          if (isWithinDays(dayMs, 7)) {
            weeklyIds.add(chId);
          }
        }
      }

      for (const prog of Object.values(user.readingProgress || {})) {
        if (prog && prog.progressPercent >= 95 && prog.chapterId) {
          allCompletedIds.add(prog.chapterId);
          const dayMs = parseUtcDayMs(prog.lastReadAt);
          if (isWithinDays(dayMs, 30)) {
            monthlyIds.add(prog.chapterId);
          }
          if (isWithinDays(dayMs, 7)) {
            weeklyIds.add(prog.chapterId);
          }
        }
      }

      let historyWeeklySum = 0;
      let historyMonthlySum = 0;
      for (const h of user.readingGoal?.history || []) {
        const count = typeof h?.chaptersRead === 'number' && Number.isFinite(h.chaptersRead) ? Math.max(0, Math.floor(h.chaptersRead)) : 0;
        if (count <= 0) continue;
        const dayMs = parseUtcDayMs(h.dateIso);
        if (isWithinDays(dayMs, 30)) {
          historyMonthlySum += count;
        }
        if (isWithinDays(dayMs, 7)) {
          historyWeeklySum += count;
        }
      }

      const weeklyChapters = Math.max(weeklyIds.size, historyWeeklySum);
      const monthlyChapters = Math.max(monthlyIds.size, weeklyChapters, historyMonthlySum);
      const allTimeChapters = Math.max(allCompletedIds.size, monthlyChapters);

      let completedStoriesCount = 0;
      for (const story of publishedStories) {
        const chs = story.chapters || [];
        if (chs.length === 0) continue;
        const allDone = chs.every((ch) => allCompletedIds.has(ch.id));
        const lastProg = user.readingProgress?.[story.id];
        const finishedLast =
          Boolean(lastProg) && lastProg.chapterNumber >= chs.length && lastProg.progressPercent >= 95;
        if (allDone || finishedLast) {
          completedStoriesCount += 1;
        }
      }

      const { currentTier } = getTierForCompletedChapters(allTimeChapters);
      const streakDays = Math.max(
        0,
        Number.isFinite(user.readingGoal?.streakDays) ? Math.floor(user.readingGoal.streakDays) : 0
      );

      return {
        userId: user.id,
        displayName: getDisplayName(user),
        avatar: normalizeServerAvatarUrl(user.avatar),
        tierTitle: currentTier.title,
        tierRoman: currentTier.roman,
        tierLevel: currentTier.level,
        weeklyChapters,
        monthlyChapters,
        allTimeChapters,
        completedStoriesCount,
        streakDays,
        isCurrentUser: Boolean(viewerUserId && user.id === viewerUserId),
      };
    });

    const sortForPeriod = (key: 'weeklyChapters' | 'monthlyChapters'): LeaderboardEntry[] =>
      [...baseRows]
        .sort((a, b) => {
          if (b[key] !== a[key]) return b[key] - a[key];
          if (b.completedStoriesCount !== a.completedStoriesCount) {
            return b.completedStoriesCount - a.completedStoriesCount;
          }
          if (b.allTimeChapters !== a.allTimeChapters) return b.allTimeChapters - a.allTimeChapters;
          if (b.streakDays !== a.streakDays) return b.streakDays - a.streakDays;
          return a.displayName.localeCompare(b.displayName);
        })
        .map((row, idx) => ({
          position: idx + 1,
          ...row,
        }));

    const weeklyRanked = sortForPeriod('weeklyChapters');
    const monthlyRanked = sortForPeriod('monthlyChapters');

    let viewerStanding: LeaderboardViewerStanding | null = null;
    if (viewerUserId) {
      const wIdx = weeklyRanked.findIndex((e) => e.userId === viewerUserId);
      const mIdx = monthlyRanked.findIndex((e) => e.userId === viewerUserId);
      const ref = wIdx >= 0 ? weeklyRanked[wIdx] : mIdx >= 0 ? monthlyRanked[mIdx] : null;
      if (ref) {
        viewerStanding = {
          weeklyPosition: wIdx >= 0 ? weeklyRanked[wIdx].position : null,
          monthlyPosition: mIdx >= 0 ? monthlyRanked[mIdx].position : null,
          weeklyChapters: ref.weeklyChapters,
          monthlyChapters: ref.monthlyChapters,
          allTimeChapters: ref.allTimeChapters,
          completedStoriesCount: ref.completedStoriesCount,
          streakDays: ref.streakDays,
          tierTitle: ref.tierTitle,
          tierRoman: ref.tierRoman,
          tierLevel: ref.tierLevel,
        };
      }
    }

    return {
      period,
      weekly: weeklyRanked.slice(0, 50),
      monthly: monthlyRanked.slice(0, 50),
      totalReaders: baseRows.length,
      viewerStanding,
      generatedAt: now.toISOString(),
    };
  }

  public updateUserRoleByOwner(
    targetUserId: string,
    nextRole: WriterRole
  ): { ok: true; user: AdminUserDirectoryEntry } | { ok: false; status: 400 | 403 | 404; error: string } {
    if (nextRole !== 'reader' && nextRole !== 'writer' && nextRole !== 'admin') {
      return { ok: false, status: 400, error: 'Role must be reader, writer, or admin.' };
    }
    const user = this.getUserById(targetUserId);
    if (!user) {
      return { ok: false, status: 404, error: 'User account not found.' };
    }
    if (user.role === 'owner' || user.email.trim().toLowerCase() === getOwnerEmail()) {
      return { ok: false, status: 403, error: 'Owner account role cannot be modified.' };
    }

    user.role = nextRole;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        'UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1',
        [user.id, nextRole]
      );
    });

    return { ok: true, user: this.toAdminDirectoryEntry(user) };
  }

  public getAdminOverview() {
    const paidOrders = this.state.orders.filter((o) => o.status === 'success');
    const grossRevenueNgn = paidOrders.reduce((sum, o) => sum + o.amountNgn, 0);
    const activeSubscribers = this.state.users.filter((u) => u.subscription.status === 'active').length;

    return {
      grossRevenueNgn,
      activeSubscribers,
      totalRegisteredUsers: this.state.users.length,
      publishedStoriesCount: this.state.stories.filter((s) => (s.publicationStatus || 'published') === 'published').length,
      publishedChaptersCount: this.state.stories.reduce((sum, s) => sum + s.chapters.length, 0),
      inquiries: this.state.inquiries,
      transactions: this.state.orders.map((o) => ({
        id: o.id,
        reference: o.reference,
        customerEmail: o.customerEmail,
        amountNgn: o.amountNgn,
        itemType: o.itemType,
        itemName: o.itemName,
        itemId: o.storyId,
        channel: o.channel === 'hosted' ? 'card' : o.channel,
        status: o.status,
        date: o.createdAt
      }))
    };
  }

  public getHighlights(userId: string): TextHighlight[] {
    return this.state.highlights[userId] || [];
  }

  public saveHighlight(userId: string, highlight: TextHighlight): TextHighlight[] {
    const existingList = [...(this.state.highlights[userId] || [])];
    const hasOffsets =
      typeof highlight.startOffset === 'number' && typeof highlight.endOffset === 'number';
    const idx = existingList.findIndex((h) => {
      if (h.id === highlight.id) return true;
      if (!hasOffsets && typeof h.startOffset !== 'number') {
        return h.chapterId === highlight.chapterId && h.paragraphIndex === highlight.paragraphIndex;
      }
      return false;
    });
    const savedRecord: TextHighlight = idx >= 0
      ? { ...highlight, id: existingList[idx].id, createdAt: existingList[idx].createdAt }
      : highlight;

    if (idx >= 0) {
      existingList[idx] = savedRecord;
    } else {
      existingList.unshift(savedRecord);
    }
    this.state.highlights[userId] = existingList;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO highlights (
           id, user_id, story_id, chapter_id, paragraph_index, excerpt,
           selected_text, start_offset, end_offset, color, note, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (id) DO UPDATE SET
           excerpt = EXCLUDED.excerpt,
           selected_text = EXCLUDED.selected_text,
           start_offset = EXCLUDED.start_offset,
           end_offset = EXCLUDED.end_offset,
           color = EXCLUDED.color,
           note = EXCLUDED.note,
           updated_at = NOW()`,
        [
          savedRecord.id,
          userId,
          savedRecord.storyId,
          savedRecord.chapterId,
          savedRecord.paragraphIndex,
          savedRecord.excerpt,
          savedRecord.selectedText ?? null,
          savedRecord.startOffset ?? null,
          savedRecord.endOffset ?? null,
          savedRecord.color,
          savedRecord.note ?? null
        ]
      );
    });

    return existingList;
  }

  public updateHighlight(
    userId: string,
    highlightId: string,
    patch: { color?: TextHighlight['color']; note?: string | null }
  ): TextHighlight[] | null {
    const existingList = [...(this.state.highlights[userId] || [])];
    const idx = existingList.findIndex((h) => h.id === highlightId);
    if (idx < 0) return null;

    const current = existingList[idx];
    const updated: TextHighlight = {
      ...current,
      color: patch.color ?? current.color,
      note: patch.note === null ? undefined : patch.note !== undefined ? patch.note : current.note,
      updatedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
    existingList[idx] = updated;
    this.state.highlights[userId] = existingList;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `UPDATE highlights
         SET color = $3,
             note = $4,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [highlightId, userId, updated.color, updated.note ?? null]
      );
    });

    return existingList;
  }

  public deleteHighlight(userId: string, highlightId: string): TextHighlight[] {
    const existingList = this.state.highlights[userId] || [];
    this.state.highlights[userId] = existingList.filter((h) => h.id !== highlightId);
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query('DELETE FROM highlights WHERE id = $1 AND user_id = $2', [highlightId, userId]);
    });

    return this.state.highlights[userId];
  }

  public getParagraphBookmarks(userId: string): ParagraphBookmark[] {
    return this.state.paragraphBookmarks[userId] || [];
  }

  public saveParagraphBookmark(userId: string, bookmark: ParagraphBookmark): ParagraphBookmark[] {
    const existingList = [...(this.state.paragraphBookmarks[userId] || [])];
    const idx = existingList.findIndex(
      (b) => b.chapterId === bookmark.chapterId && b.paragraphIndex === bookmark.paragraphIndex
    );
    const savedRecord: ParagraphBookmark = idx >= 0
      ? { ...bookmark, id: existingList[idx].id }
      : bookmark;

    if (idx >= 0) {
      existingList[idx] = savedRecord;
    } else {
      existingList.unshift(savedRecord);
    }
    this.state.paragraphBookmarks[userId] = existingList;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO paragraph_bookmarks (id, user_id, story_id, chapter_id, paragraph_index, label, excerpt)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, chapter_id, paragraph_index) DO UPDATE SET
           label = EXCLUDED.label,
           excerpt = EXCLUDED.excerpt`,
        [
          savedRecord.id,
          userId,
          savedRecord.storyId,
          savedRecord.chapterId,
          savedRecord.paragraphIndex,
          savedRecord.label ?? null,
          savedRecord.excerpt
        ]
      );
    });

    return existingList;
  }

  public deleteParagraphBookmark(userId: string, bookmarkId: string): ParagraphBookmark[] {
    const existingList = this.state.paragraphBookmarks[userId] || [];
    this.state.paragraphBookmarks[userId] = existingList.filter((b) => b.id !== bookmarkId);
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query('DELETE FROM paragraph_bookmarks WHERE id = $1 AND user_id = $2', [bookmarkId, userId]);
    });

    return this.state.paragraphBookmarks[userId];
  }

  public getComments(chapterId?: string): ChapterComment[] {
    if (!chapterId) return this.state.comments;
    return this.state.comments.filter((c) => c.chapterId === chapterId);
  }

  public addComment(comment: ChapterComment, userId?: string): ChapterComment {
    this.state.comments.unshift(comment);
    this.persistSnapshot();

    if (userId) {
      this.mirrorToPostgres(async (pool) => {
        await pool.query(
          `INSERT INTO chapter_comments (id, story_id, chapter_id, user_id, author_name, tag, body)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [comment.id, comment.storyId, comment.chapterId, userId, comment.authorName, comment.tag, comment.body]
        );
      });
    }

    return comment;
  }

  public deleteComment(commentId: string, authorNames: string | string[], isOwner: boolean): boolean {
    const target = this.state.comments.find((c) => c.id === commentId);
    if (!target) return false;
    const allowedNames = Array.isArray(authorNames) ? authorNames : [authorNames];
    if (!isOwner && !allowedNames.includes(target.authorName)) return false;
    this.state.comments = this.state.comments.filter((c) => c.id !== commentId);
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query('DELETE FROM chapter_comments WHERE id = $1', [commentId]);
    });

    return true;
  }

  public addInquiry(inquiry: CommunityInquiry): CommunityInquiry {
    this.state.inquiries.unshift(inquiry);
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO contacts (id, reference_id, name, email, inquiry_type, subject, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          inquiry.id,
          inquiry.referenceId,
          inquiry.name,
          inquiry.email,
          inquiry.inquiryType,
          inquiry.subject,
          inquiry.message
        ]
      );
    });

    return inquiry;
  }

  public getStoryLikes(
    storyIds?: string[],
    userId?: string
  ): { counts: Record<string, number>; likedStoryIds: string[] } {
    const map = this.state.storyLikes || {};
    const targetIds = storyIds && storyIds.length > 0 ? storyIds : Object.keys(map);
    const counts: Record<string, number> = {};
    const likedStoryIds: string[] = [];

    for (const id of targetIds) {
      const users = map[id] || [];
      counts[id] = users.length;
      if (userId && users.includes(userId)) {
        likedStoryIds.push(id);
      }
    }

    return { counts, likedStoryIds };
  }

  public toggleStoryLike(storyId: string, userId: string): { liked: boolean; count: number } {
    if (!this.state.storyLikes) {
      this.state.storyLikes = {};
    }
    const existing = this.state.storyLikes[storyId] || [];
    const alreadyLiked = existing.includes(userId);
    let updated: string[];
    let liked: boolean;

    if (alreadyLiked) {
      updated = existing.filter((uid) => uid !== userId);
      liked = false;
    } else {
      updated = [...existing, userId];
      liked = true;
    }

    this.state.storyLikes[storyId] = updated;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      if (liked) {
        await pool.query(
          `INSERT INTO story_likes (story_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (story_id, user_id) DO NOTHING`,
          [storyId, userId]
        );
      } else {
        await pool.query(
          `DELETE FROM story_likes WHERE story_id = $1 AND user_id = $2`,
          [storyId, userId]
        );
      }
    });

    return { liked, count: updated.length };
  }

  public getBookshelvesForViewer(viewerUserId?: string): {
    myBookshelves: StoryBookshelf[];
    publicBookshelves: StoryBookshelf[];
  } {
    const all = this.state.bookshelves || [];
    const myBookshelves = viewerUserId
      ? all.filter((s) => s.ownerId === viewerUserId)
      : [];
    const publicBookshelves = all.filter((s) => s.visibility === 'public');
    return {
      myBookshelves: myBookshelves.map((s) => ({ ...s, storyIds: [...s.storyIds] })),
      publicBookshelves: publicBookshelves.map((s) => ({ ...s, storyIds: [...s.storyIds] }))
    };
  }

  public createBookshelf(
    owner: StoredUserRecord,
    input: {
      name: string;
      description?: string;
      visibility: BookshelfVisibility;
      storyIds?: string[];
    }
  ): StoryBookshelf {
    if (!this.state.bookshelves) {
      this.state.bookshelves = [];
    }
    const allowedStoryIds = Array.from(
      new Set(
        (input.storyIds || []).filter((id) => {
          const st = this.getStoryById(id);
          if (!st) return false;
          if ((st.publicationStatus || 'published') !== 'published' && !isOwnerUser(owner)) {
            return false;
          }
          return true;
        })
      )
    );
    const nowIso = new Date().toISOString();
    const ownerDisplay = owner.nickname?.trim() || owner.name;
    const shelf: StoryBookshelf = {
      id: `shelf_${crypto.randomUUID()}`,
      ownerId: owner.id,
      ownerName: ownerDisplay,
      name: input.name,
      description: input.description || undefined,
      visibility: input.visibility === 'public' ? 'public' : 'private',
      storyIds: allowedStoryIds,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    this.state.bookshelves.unshift(shelf);
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO story_bookshelves (
          id, owner_id, owner_name, name, description, visibility, story_ids, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())`,
        [
          shelf.id,
          shelf.ownerId,
          shelf.ownerName,
          shelf.name,
          shelf.description ?? null,
          shelf.visibility,
          JSON.stringify(shelf.storyIds)
        ]
      );
    });

    return { ...shelf, storyIds: [...shelf.storyIds] };
  }

  public updateBookshelf(
    userId: string,
    shelfId: string,
    patch: {
      name?: string;
      description?: string | null;
      visibility?: BookshelfVisibility;
    }
  ): { ok: true; bookshelf: StoryBookshelf } | { ok: false; status: 403 | 404; error: string } {
    if (!this.state.bookshelves) {
      this.state.bookshelves = [];
    }
    const idx = this.state.bookshelves.findIndex((s) => s.id === shelfId);
    if (idx < 0) {
      return { ok: false, status: 404, error: 'Bookshelf not found.' };
    }
    const existing = this.state.bookshelves[idx];
    if (existing.ownerId !== userId) {
      return { ok: false, status: 403, error: 'Only the bookshelf creator can modify this list.' };
    }

    const updated: StoryBookshelf = {
      ...existing,
      name: patch.name !== undefined ? patch.name : existing.name,
      description:
        patch.description === null
          ? undefined
          : patch.description !== undefined
          ? patch.description || undefined
          : existing.description,
      visibility: patch.visibility ?? existing.visibility,
      updatedAt: new Date().toISOString()
    };

    this.state.bookshelves[idx] = updated;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `UPDATE story_bookshelves
         SET name = $3, description = $4, visibility = $5, updated_at = NOW()
         WHERE id = $1 AND owner_id = $2`,
        [shelfId, userId, updated.name, updated.description ?? null, updated.visibility]
      );
    });

    return { ok: true, bookshelf: { ...updated, storyIds: [...updated.storyIds] } };
  }

  public toggleStoryInBookshelf(
    user: StoredUserRecord,
    shelfId: string,
    storyId: string,
    action: 'add' | 'remove' | 'toggle' = 'toggle'
  ): { ok: true; bookshelf: StoryBookshelf; inShelf: boolean } | { ok: false; status: 403 | 404; error: string } {
    if (!this.state.bookshelves) {
      this.state.bookshelves = [];
    }
    const idx = this.state.bookshelves.findIndex((s) => s.id === shelfId);
    if (idx < 0) {
      return { ok: false, status: 404, error: 'Bookshelf not found.' };
    }
    const existing = this.state.bookshelves[idx];
    if (existing.ownerId !== user.id) {
      return { ok: false, status: 403, error: 'Only the bookshelf creator can organize stories in this list.' };
    }

    const story = this.getStoryById(storyId);
    if (!story || ((story.publicationStatus || 'published') !== 'published' && !isOwnerUser(user))) {
      return { ok: false, status: 404, error: 'Story not found in catalog.' };
    }

    const currentlyInShelf = existing.storyIds.includes(storyId);
    let nextStoryIds = [...existing.storyIds];
    let inShelf = currentlyInShelf;

    if (action === 'add' || (action === 'toggle' && !currentlyInShelf)) {
      if (!currentlyInShelf) {
        nextStoryIds.unshift(storyId);
      }
      inShelf = true;
    } else if (action === 'remove' || (action === 'toggle' && currentlyInShelf)) {
      nextStoryIds = nextStoryIds.filter((id) => id !== storyId);
      inShelf = false;
    }

    const updated: StoryBookshelf = {
      ...existing,
      storyIds: nextStoryIds,
      updatedAt: new Date().toISOString()
    };
    this.state.bookshelves[idx] = updated;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `UPDATE story_bookshelves
         SET story_ids = $3::jsonb, updated_at = NOW()
         WHERE id = $1 AND owner_id = $2`,
        [shelfId, user.id, JSON.stringify(updated.storyIds)]
      );
    });

    return { ok: true, bookshelf: { ...updated, storyIds: [...updated.storyIds] }, inShelf };
  }

  public deleteBookshelf(
    userId: string,
    shelfId: string
  ): { ok: true } | { ok: false; status: 403 | 404; error: string } {
    if (!this.state.bookshelves) {
      this.state.bookshelves = [];
    }
    const existing = this.state.bookshelves.find((s) => s.id === shelfId);
    if (!existing) {
      return { ok: false, status: 404, error: 'Bookshelf not found.' };
    }
    if (existing.ownerId !== userId) {
      return { ok: false, status: 403, error: 'Only the bookshelf creator can delete this list.' };
    }

    this.state.bookshelves = this.state.bookshelves.filter((s) => s.id !== shelfId);
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query('DELETE FROM story_bookshelves WHERE id = $1 AND owner_id = $2', [shelfId, userId]);
    });

    return { ok: true };
  }

  public getCachedChapterTranslation(
    storyId: string,
    chapterNumber: number,
    languageKey: string,
    contentHash: string
  ): CachedChapterTranslation | null {
    if (!this.state.chapterTranslations) {
      this.state.chapterTranslations = {};
    }
    const normalizedLang = languageKey.trim().toLowerCase();
    const key = `${storyId}::${chapterNumber}::${normalizedLang}`;
    const entry = this.state.chapterTranslations[key];
    if (!entry || entry.contentHash !== contentHash || !entry.translatedText.trim()) {
      return null;
    }
    return entry;
  }

  public saveCachedChapterTranslation(entry: CachedChapterTranslation): void {
    if (!entry.translatedText.trim()) return;
    if (!this.state.chapterTranslations) {
      this.state.chapterTranslations = {};
    }
    const normalizedLang = entry.languageKey.trim().toLowerCase();
    const key = `${entry.storyId}::${entry.chapterNumber}::${normalizedLang}`;
    const stored: CachedChapterTranslation = {
      ...entry,
      key,
      languageKey: normalizedLang,
    };
    this.state.chapterTranslations[key] = stored;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        `INSERT INTO chapter_translations (
          cache_key, story_id, story_slug, chapter_number, language_key, language_label,
          translated_title, translated_paragraphs, translated_text, content_hash, model
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)
        ON CONFLICT (cache_key) DO UPDATE SET
          language_label = EXCLUDED.language_label,
          translated_title = EXCLUDED.translated_title,
          translated_paragraphs = EXCLUDED.translated_paragraphs,
          translated_text = EXCLUDED.translated_text,
          content_hash = EXCLUDED.content_hash,
          model = EXCLUDED.model,
          created_at = NOW()`,
        [
          stored.key,
          stored.storyId,
          stored.storySlug,
          stored.chapterNumber,
          stored.languageKey,
          stored.languageLabel,
          stored.translatedTitle ?? null,
          stored.translatedParagraphs ? JSON.stringify(stored.translatedParagraphs) : null,
          stored.translatedText,
          stored.contentHash,
          stored.model,
        ]
      );
    });

    const sb = getConfiguredSupabaseDbClient();
    if (sb) {
      void Promise.resolve(
        sb
          .from('chapter_translations')
          .upsert(
            {
              cache_key: stored.key,
              story_id: stored.storyId,
              story_slug: stored.storySlug,
              chapter_number: stored.chapterNumber,
              language_key: stored.languageKey,
              language_label: stored.languageLabel,
              translated_text: stored.translatedText,
              content_hash: stored.contentHash,
              model: stored.model,
            },
            { onConflict: 'cache_key' }
          )
      ).catch(() => undefined);
    }
  }
}

const SERVER_PRESET_AVATAR_STEMS = [
  'avatar_bronze_scribe',
  'avatar_moonlit_reader',
  'avatar_celestial_astrolabe',
  'avatar_baobab_lantern',
  'avatar_crimson_mask',
  'avatar_sunlit_chronicler',
] as const;

export function normalizeServerAvatarUrl(raw: string | undefined | null): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const val = raw.trim();
  if (!val) return undefined;
  const lower = val.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:image/svg+xml')
  ) {
    return undefined;
  }
  for (const stem of SERVER_PRESET_AVATAR_STEMS) {
    if (lower.includes(stem)) {
      return `/assets/images/avatars/${stem}.jpg`;
    }
  }
  return val;
}

export const repo = new LorethosRepository();
