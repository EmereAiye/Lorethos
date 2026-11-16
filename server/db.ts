import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import {
  Story,
  Chapter,
  AccessTier,
  UserProfile,
  PaymentTransaction,
  TextHighlight,
  ChapterComment,
  CommunityInquiry,
  ReadingGoal
} from '../src/types';
import { AUTHORITATIVE_STORIES } from './catalog';

export interface StoredUserRecord {
  id: string;
  name: string;
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
  comments: ChapterComment[];
  inquiries: CommunityInquiry[];
}

export const PLAN_PRICES_NGN: Record<'monthly' | 'annual', { amountNgn: number; label: string }> = {
  monthly: { amountNgn: 3500, label: 'Patron Monthly Subscription' },
  annual: { amountNgn: 32000, label: 'Patron Annual Subscription (12 Months)' }
};

const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'Emmymasterwise@gmail.com').trim().toLowerCase();
const STATE_FILE = process.env.LORETHOS_DATA_FILE || '/tmp/lorethos-server-state.json';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
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

  constructor() {
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis: 10000
      });
      this.pool.on('error', (err) => {
        console.error('PostgreSQL pool error:', err);
      });
    }

    this.state = this.loadInitialSnapshot();
  }

  private loadInitialSnapshot(): PersistedSnapshot {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as PersistedSnapshot;
        if (Array.isArray(parsed.stories) && parsed.stories.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback cleanly to fresh seeded snapshot
    }

    return {
      users: [],
      stories: AUTHORITATIVE_STORIES.map(s => ({ ...s, totalChapters: s.chapters.length })),
      orders: [],
      processedEventIds: [],
      highlights: {},
      comments: [],
      inquiries: []
    };
  }

  private persistSnapshot(): void {
    try {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch {
      // Ignore write failures in read-only runtimes
    }
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
    return this.state.users.find(u => u.id === userId);
  }

  public getUserByEmail(email: string): StoredUserRecord | undefined {
    const normalized = email.trim().toLowerCase();
    return this.state.users.find(u => u.email.toLowerCase() === normalized);
  }

  public async createUser(name: string, email: string, password: string): Promise<StoredUserRecord> {
    const normalizedEmail = email.trim().toLowerCase();
    const isOwner = normalizedEmail === OWNER_EMAIL;
    const record: StoredUserRecord = {
      id: `usr_${crypto.randomUUID()}`,
      name: name.trim(),
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

    this.state.users.push(record);
    this.persistSnapshot();

    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO users (id, name, email, password_hash, role, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (email) DO NOTHING`,
          [record.id, record.name, record.email, record.passwordHash, record.role]
        );
      } catch (err) {
        console.error('Failed to mirror user into PostgreSQL:', err);
      }
    }

    return record;
  }

  public getStories(): Story[] {
    return this.state.stories.map(s => ({
      ...s,
      totalChapters: s.chapters.length
    }));
  }

  public getStoryBySlug(slug: string): Story | undefined {
    const story = this.state.stories.find(s => s.slug === slug);
    return story ? { ...story, totalChapters: story.chapters.length } : undefined;
  }

  public getStoryById(storyId: string): Story | undefined {
    const story = this.state.stories.find(s => s.id === storyId);
    return story ? { ...story, totalChapters: story.chapters.length } : undefined;
  }

  public hasAccessToChapter(user: StoredUserRecord | undefined, story: Story, chapter: Chapter): boolean {
    if (chapter.isFree || story.accessTier === 'free') return true;
    if (!user) return false;
    if (user.role === 'owner') return true;
    if (user.subscription.status === 'active' && story.accessTier === 'subscription') return true;
    if (user.unlockedStoryIds.includes(story.id)) return true;
    return false;
  }

  public addStory(input: Omit<Story, 'id' | 'chapters'>): Story {
    const baseSlug = input.slug || input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = this.state.stories.some(s => s.slug === baseSlug)
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    const id = `story-${Date.now()}`;
    const newStory: Story = {
      ...input,
      id,
      slug,
      rating: 0,
      ratingsCount: 0,
      totalReads: 0,
      totalChapters: 1,
      chapters: [
        {
          id: `ch-${Date.now()}-1`,
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
        }
      ]
    };

    this.state.stories.unshift(newStory);
    this.persistSnapshot();
    return newStory;
  }

  public addChapterToStory(storyId: string, chapterData: Omit<Chapter, 'id' | 'storyId'>): Chapter | null {
    const story = this.state.stories.find(s => s.id === storyId);
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
    return newChapter;
  }

  public updateStoryPricing(storyId: string, tier: AccessTier, priceNgn: number, freeChaptersCount: number): Story | null {
    const story = this.state.stories.find(s => s.id === storyId);
    if (!story) return null;
    story.accessTier = tier;
    story.priceNgn = Math.max(0, Math.round(priceNgn));
    story.freeChaptersCount = Math.max(0, Math.round(freeChaptersCount));
    story.chapters = story.chapters.map((ch, idx) => ({
      ...ch,
      isFree: tier === 'free' ? true : idx < story.freeChaptersCount
    }));
    this.persistSnapshot();
    return story;
  }

  public toggleBookmark(userId: string, chapterId: string): string[] | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    const exists = user.bookmarkedChapterIds.includes(chapterId);
    user.bookmarkedChapterIds = exists
      ? user.bookmarkedChapterIds.filter(id => id !== chapterId)
      : [...user.bookmarkedChapterIds, chapterId];
    this.persistSnapshot();
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
    user.readingProgress[storyId] = {
      chapterId,
      chapterNumber,
      progressPercent: Math.min(100, Math.max(0, Math.round(progressPercent))),
      lastReadAt: new Date().toISOString()
    };
    this.persistSnapshot();
    return user.readingProgress;
  }

  public updateReadingGoal(userId: string, goal: ReadingGoal): ReadingGoal | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.readingGoal = goal;
    this.persistSnapshot();
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
    return order;
  }

  public getOrderByReference(reference: string): ServerOrder | undefined {
    return this.state.orders.find(o => o.reference === reference);
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

    if (order.itemType === 'subscription') {
      const validUntil = new Date();
      if (order.planId === 'annual') {
        validUntil.setFullYear(validUntil.getFullYear() + 1);
      } else {
        validUntil.setMonth(validUntil.getMonth() + 1);
      }
      user.subscription = {
        plan: order.planId || 'monthly',
        status: 'active',
        amountNgn: order.amountNgn,
        validUntil: validUntil.toISOString(),
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
    return { ok: true, order };
  }

  public getUserTransactions(userId: string): PaymentTransaction[] {
    return this.state.orders
      .filter(o => o.userId === userId)
      .map(o => ({
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
    const paidOrders = this.state.orders.filter(o => o.status === 'success');
    const grossRevenueNgn = paidOrders.reduce((sum, o) => sum + o.amountNgn, 0);
    const activeSubscribers = this.state.users.filter(u => u.subscription.status === 'active').length;

    return {
      grossRevenueNgn,
      activeSubscribers,
      totalRegisteredUsers: this.state.users.length,
      publishedStoriesCount: this.state.stories.length,
      publishedChaptersCount: this.state.stories.reduce((sum, s) => sum + s.chapters.length, 0),
      inquiries: this.state.inquiries,
      transactions: this.state.orders.map(o => ({
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
    const existingList = this.state.highlights[userId] || [];
    const idx = existingList.findIndex(
      h => h.chapterId === highlight.chapterId && h.paragraphIndex === highlight.paragraphIndex
    );
    if (idx >= 0) {
      existingList[idx] = highlight;
    } else {
      existingList.unshift(highlight);
    }
    this.state.highlights[userId] = existingList;
    this.persistSnapshot();
    return existingList;
  }

  public deleteHighlight(userId: string, highlightId: string): TextHighlight[] {
    const existingList = this.state.highlights[userId] || [];
    this.state.highlights[userId] = existingList.filter(h => h.id !== highlightId);
    this.persistSnapshot();
    return this.state.highlights[userId];
  }

  public getComments(chapterId?: string): ChapterComment[] {
    if (!chapterId) return this.state.comments;
    return this.state.comments.filter(c => c.chapterId === chapterId);
  }

  public addComment(comment: ChapterComment): ChapterComment {
    this.state.comments.unshift(comment);
    this.persistSnapshot();
    return comment;
  }

  public deleteComment(commentId: string, authorName: string, isOwner: boolean): boolean {
    const target = this.state.comments.find(c => c.id === commentId);
    if (!target) return false;
    if (!isOwner && target.authorName !== authorName) return false;
    this.state.comments = this.state.comments.filter(c => c.id !== commentId);
    this.persistSnapshot();
    return true;
  }

  public addInquiry(inquiry: CommunityInquiry): CommunityInquiry {
    this.state.inquiries.unshift(inquiry);
    this.persistSnapshot();
    return inquiry;
  }
}

export const repo = new LorethosRepository();
