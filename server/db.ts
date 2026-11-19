import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
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
  ReadingGoal
} from '../src/types/index.js';
import { AUTHORITATIVE_STORIES, withOfficialTrailerMetadata } from './catalog.js';

export interface StoredUserRecord {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  passwordHash: string;
  role: 'reader' | 'owner';
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
}

export const PLAN_PRICES_NGN: Record<'monthly' | 'annual', { amountNgn: number; label: string }> = {
  monthly: { amountNgn: 3500, label: 'Patron Monthly Subscription' },
  annual: { amountNgn: 32000, label: 'Patron Annual Subscription (12 Months)' }
};

function getOwnerEmail(): string {
  return (process.env.OWNER_EMAIL || 'Emmymasterwise@gmail.com').trim().toLowerCase();
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
            users: parsed.users || [],
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
            inquiries: parsed.inquiries || []
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
      inquiries: []
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
        nickname TEXT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'owner')),
        reading_goal JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reading_goal JSONB;
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
        free_chapters_count INTEGER NOT NULL DEFAULT 3 CHECK (free_chapters_count >= 0),
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        spotlight_order INTEGER,
        updated_at_label TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE stories ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published';
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
        inqRes
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
        this.pool.query('SELECT * FROM contacts ORDER BY submitted_at DESC')
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
            rating: 0,
            ratingsCount: 0,
            totalChapters: chs.length,
            totalReads: 0,
            freeChaptersCount: Number(row.free_chapters_count),
            featured: Boolean(row.featured),
            spotlightOrder: row.spotlight_order !== null ? Number(row.spotlight_order) : undefined,
            updatedAt: row.updated_at_label,
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
        id: u.id,
        name: u.name,
        nickname: u.nickname || undefined,
        email: u.email,
        passwordHash: u.password_hash,
        role: u.role,
        subscription: subByUser.get(u.id) || { plan: 'free', status: 'none', amountNgn: 0 },
        unlockedStoryIds: entitlementsByUser.get(u.id) || [],
        bookmarkedChapterIds: bookmarksByUser.get(u.id) || [],
        readingProgress: progressByUser.get(u.id) || {},
        readingGoal: u.reading_goal || buildDefaultReadingGoal(),
        createdAt: new Date(u.created_at).toISOString()
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
      role: user.role,
      subscription: user.subscription,
      unlockedStoryIds: user.unlockedStoryIds,
      bookmarkedChapterIds: user.bookmarkedChapterIds,
      readingProgress: user.readingProgress,
      readingGoal: user.readingGoal
    };
  }

  public getUserById(userId: string): StoredUserRecord | undefined {
    return this.state.users.find((u) => u.id === userId);
  }

  public getUserByEmail(email: string): StoredUserRecord | undefined {
    const normalized = email.trim().toLowerCase();
    return this.state.users.find((u) => u.email.toLowerCase() === normalized);
  }

  private async hydrateSingleUserFromPostgres(whereClause: string, param: string): Promise<StoredUserRecord | undefined> {
    if (!this.pool) return undefined;
    try {
      const userRes = await this.pool.query(
        `SELECT * FROM users WHERE ${whereClause} LIMIT 1`,
        [param]
      );
      if (userRes.rows.length === 0) return undefined;
      const u = userRes.rows[0];
      const [subRes, entRes, bmRes, progRes] = await Promise.all([
        this.pool.query('SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1', [u.id]),
        this.pool.query('SELECT story_id FROM entitlements WHERE user_id = $1', [u.id]),
        this.pool.query('SELECT chapter_id FROM bookmarks WHERE user_id = $1', [u.id]),
        this.pool.query('SELECT * FROM reading_progress WHERE user_id = $1', [u.id]),
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
      const hydrated: StoredUserRecord = {
        id: u.id,
        name: u.name,
        nickname: u.nickname || undefined,
        email: String(u.email).trim().toLowerCase(),
        passwordHash: u.password_hash,
        role: u.role === 'owner' || String(u.email).trim().toLowerCase() === getOwnerEmail() ? 'owner' : 'reader',
        subscription,
        unlockedStoryIds: entRes.rows.map((r) => r.story_id),
        bookmarkedChapterIds: bmRes.rows.map((r) => r.chapter_id),
        readingProgress,
        readingGoal: u.reading_goal || buildDefaultReadingGoal(),
        createdAt: new Date(u.created_at).toISOString(),
      };
      const existingIdx = this.state.users.findIndex((x) => x.id === hydrated.id || x.email.toLowerCase() === hydrated.email);
      if (existingIdx >= 0) {
        this.state.users[existingIdx] = hydrated;
      } else {
        this.state.users.push(hydrated);
      }
      this.persistSnapshot();
      return hydrated;
    } catch {
      return undefined;
    }
  }

  public async findUserById(userId: string): Promise<StoredUserRecord | undefined> {
    const cached = this.getUserById(userId);
    if (cached) return cached;
    return this.hydrateSingleUserFromPostgres('id = $1', userId);
  }

  public async findUserByEmail(email: string): Promise<StoredUserRecord | undefined> {
    const normalized = email.trim().toLowerCase();
    const cached = this.getUserByEmail(normalized);
    if (cached) return cached;
    return this.hydrateSingleUserFromPostgres('LOWER(email) = $1', normalized);
  }

  public async createUser(name: string, email: string, password: string, nickname?: string): Promise<StoredUserRecord> {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedNickname = nickname?.trim() || undefined;
    const isOwner = normalizedEmail === getOwnerEmail();
    const record: StoredUserRecord = {
      id: `usr_${crypto.randomUUID()}`,
      name: name.trim(),
      nickname: trimmedNickname,
      email: normalizedEmail,
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
      try {
        await this.pool.query(
          `INSERT INTO users (id, name, nickname, email, password_hash, role, reading_goal, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW()) ON CONFLICT (email) DO NOTHING`,
          [record.id, record.name, record.nickname || null, record.email, record.passwordHash, record.role, JSON.stringify(record.readingGoal)]
        );
        await this.pool.query(
          `INSERT INTO subscriptions (id, user_id, plan, status, amount_ngn)
           VALUES ($1, $2, 'free', 'none', 0) ON CONFLICT (user_id) DO NOTHING`,
          [`sub_${record.id}`, record.id]
        );
      } catch (err) {
        console.error('Failed to mirror user into PostgreSQL:', err);
      }
    }

    this.state.users.push(record);
    this.persistSnapshot();

    return record;
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
    const pubStatus = story.publicationStatus || 'published';
    if (pubStatus !== 'published' && user?.role !== 'owner') {
      return false;
    }
    if (chapter.isFree || story.accessTier === 'free') return true;
    if (!user) return false;
    if (user.role === 'owner') return true;
    if (user.subscription.status === 'active' && story.accessTier === 'subscription') return true;
    if (user.unlockedStoryIds.includes(story.id)) return true;
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
          free_chapters_count, featured, updated_at_label
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
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

  public updateStoryPricing(storyId: string, tier: AccessTier, priceNgn: number, freeChaptersCount: number): Story | null {
    const story = this.state.stories.find((s) => s.id === storyId);
    if (!story) return null;
    story.accessTier = tier;
    story.priceNgn = Math.max(0, Math.round(priceNgn));
    story.freeChaptersCount = Math.max(0, Math.round(freeChaptersCount));
    story.chapters = story.chapters.map((ch, idx) => ({
      ...ch,
      isFree: tier === 'free' ? true : idx < story.freeChaptersCount
    }));
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query(
        'UPDATE stories SET access_tier = $1, price_ngn = $2, free_chapters_count = $3, updated_at = NOW() WHERE id = $4',
        [story.accessTier, story.priceNgn, story.freeChaptersCount, storyId]
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
    user.readingProgress[storyId] = {
      chapterId,
      chapterNumber,
      progressPercent: clamped,
      lastReadAt: new Date().toISOString()
    };
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
    });

    return user.readingProgress;
  }

  public updateReadingGoal(userId: string, goal: ReadingGoal): ReadingGoal | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.readingGoal = goal;
    this.persistSnapshot();

    this.mirrorToPostgres(async (pool) => {
      await pool.query('UPDATE users SET reading_goal = $1::jsonb, updated_at = NOW() WHERE id = $2', [
        JSON.stringify(goal),
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
}

export const repo = new LorethosRepository();
