import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Request, Response, NextFunction } from 'express';
import JSZip from 'jszip';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { repo, verifyPassword, PLAN_PRICES_NGN, StoredUserRecord } from './server/db';
import { sanitizeStoryForPublic } from './server/catalog';
import { AccessTier, CommentTag, HighlightColor } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';
const SESSION_COOKIE_NAME = 'lorethos_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EPHEMERAL_DEV_SECRET = crypto.randomBytes(32).toString('hex');
function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    console.warn('WARNING: SESSION_SECRET is not set in production; using ephemeral secret.');
  }
  return EPHEMERAL_DEV_SECRET;
}

// Simple sliding-window in-memory rate limiter
function createRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (buckets.get(key) || []).filter(ts => ts > cutoff);
    if (timestamps.length >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
      return;
    }
    timestamps.push(now);
    buckets.set(key, timestamps);
    next();
  };
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

function signSessionToken(userId: string): string {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      uid?: string;
      exp?: number;
    };
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed.uid;
  } catch {
    return null;
  }
}

function setSessionCookie(req: Request, res: Response, userId: string): void {
  const token = signSessionToken(userId);
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (isHttps && process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}

function getAuthenticatedUser(req: Request): StoredUserRecord | undefined {
  const cookies = parseCookies(req.headers.cookie);
  const userId = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
  if (!userId) return undefined;
  return repo.getUserById(userId);
}

interface AuthedRequest extends Request {
  currentUser?: StoredUserRecord;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }
  req.currentUser = user;
  next();
}

function requireOwner(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = req.currentUser || getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Owner authorization required for Publishing Desk access.' });
    return;
  }
  req.currentUser = user;
  next();
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 25000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out after 25 seconds.')), timeoutMs)
    )
  ]);
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  if (rawMessage.includes('GEMINI_API_KEY is not configured')) {
    return {
      status: 503,
      message: 'AI features are unavailable because the server Gemini key is not configured.',
    };
  }
  if (rawMessage.includes('403') || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 502,
      message: 'AI provider denied the request. Please try again later.',
    };
  }
  if (rawMessage.includes('400') || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 502,
      message: 'AI service configuration rejected the request.',
    };
  }
  if (rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI rate limit reached. Please wait a moment and try again.',
    };
  }
  if (rawMessage.includes('timed out')) {
    return {
      status: 504,
      message: 'The AI service took too long to respond. Please try again.',
    };
  }
  return {
    status: 500,
    message: 'Failed to generate AI response. Please try again.',
  };
}

function mapPaystackChannel(channel: unknown): 'card' | 'bank_transfer' | 'ussd' {
  const c = String(channel || '').toLowerCase();
  if (c === 'bank_transfer' || c === 'bank' || c === 'dedicated_nuban') return 'bank_transfer';
  if (c === 'ussd') return 'ussd';
  return 'card';
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  const aiLimiter = createRateLimiter(20, 60_000);
  const authLimiter = createRateLimiter(25, 60_000);
  const inquiryLimiter = createRateLimiter(10, 60_000);

  // =========================================================================
  // PAYSTACK WEBHOOK (MUST BE REGISTERED BEFORE express.json() TO PRESERVE RAW BODY)
  // =========================================================================
  app.post(
    '/api/payments/webhook',
    express.raw({ type: 'application/json' }),
    (req, res) => {
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
      if (!secret) {
        res.status(503).json({ error: 'Paystack webhook secret not configured.' });
        return;
      }

      const signature = req.headers['x-paystack-signature'];
      if (typeof signature !== 'string' || !signature) {
        res.status(401).json({ error: 'Missing Paystack signature.' });
        return;
      }

      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || ''));

      const computedHash = crypto
        .createHmac('sha512', secret)
        .update(rawBody)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expectedBuf = Buffer.from(computedHash, 'utf8');
      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        res.status(401).json({ error: 'Invalid Paystack signature.' });
        return;
      }

      try {
        const event = JSON.parse(rawBody.toString('utf8')) as {
          id?: string | number;
          event?: string;
          data?: {
            id?: string | number;
            reference?: string;
            amount?: number;
            currency?: string;
            channel?: string;
            status?: string;
          };
        };

        if (event.event === 'charge.success' && event.data?.reference) {
          const eventId = String(event.id ?? event.data.id ?? event.data.reference);
          repo.fulfillOrderIdempotently(
            event.data.reference,
            Number(event.data.amount || 0),
            String(event.data.currency || 'NGN'),
            mapPaystackChannel(event.data.channel),
            eventId
          );
        }

        res.status(200).json({ received: true });
      } catch {
        res.status(400).json({ error: 'Malformed webhook payload.' });
      }
    }
  );

  app.use(express.json({ limit: '2mb' }));

  // =========================================================================
  // HEALTH & READINESS
  // =========================================================================
  app.get('/api/health', async (_req, res) => {
    const db = await repo.checkDatabaseHealth();
    res.json({
      ok: true,
      db,
      paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================================
  // AUTHENTICATION & SESSIONS
  // =========================================================================
  app.get('/api/auth/session', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({ authenticated: true, user: repo.toPublicProfile(user) });
  });

  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };

    const trimmedName = (name || '').trim();
    const trimmedEmail = (email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (rawPassword.length < 8 || rawPassword.length > 128) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    if (repo.getUserByEmail(trimmedEmail)) {
      res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
      return;
    }

    const user = await repo.createUser(trimmedName, trimmedEmail, rawPassword);
    setSessionCookie(req, res, user.id);
    res.status(201).json({ user: repo.toPublicProfile(user) });
  });

  app.post('/api/auth/login', authLimiter, (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const trimmedEmail = (email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!EMAIL_REGEX.test(trimmedEmail) || !rawPassword) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = repo.getUserByEmail(trimmedEmail);
    if (!user || !verifyPassword(rawPassword, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    setSessionCookie(req, res, user.id);
    res.json({ user: repo.toPublicProfile(user) });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // =========================================================================
  // PUBLIC CATALOG & SERVER-GATED CHAPTER DELIVERY
  // =========================================================================
  app.get('/api/stories', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const genre = String(req.query.genre || 'All').trim();
    const status = String(req.query.status || 'All').trim();
    const tier = String(req.query.tier || 'All').trim();
    const sort = String(req.query.sort || 'popular').trim();

    let stories = repo.getStories().map(sanitizeStoryForPublic);

    stories = stories.filter((story) => {
      const matchesSearch =
        !q ||
        story.title.toLowerCase().includes(q) ||
        story.subtitle.toLowerCase().includes(q) ||
        story.author.toLowerCase().includes(q) ||
        story.synopsis.toLowerCase().includes(q) ||
        story.tags.some((t) => t.toLowerCase().includes(q));

      const matchesGenre = genre === 'All' || story.genre === genre;
      const matchesStatus = status === 'All' || story.status === status;
      const matchesTier =
        tier === 'All' ||
        (tier === 'Free' && story.accessTier === 'free') ||
        (tier === 'Subscription' && story.accessTier === 'subscription') ||
        (tier === 'Purchase' && story.accessTier === 'purchase');

      return matchesSearch && matchesGenre && matchesStatus && matchesTier;
    });

    stories.sort((a, b) => {
      if (sort === 'chapters') return b.chapters.length - a.chapters.length;
      if (sort === 'rating') return b.rating - a.rating;
      return (a.spotlightOrder ?? 99) - (b.spotlightOrder ?? 99);
    });

    res.json({ stories });
  });

  app.get('/api/stories/:slug', (req, res) => {
    const story = repo.getStoryBySlug(req.params.slug);
    if (!story) {
      res.status(404).json({ error: 'Story not found.' });
      return;
    }
    res.json({ story: sanitizeStoryForPublic(story) });
  });

  app.get('/api/stories/:slug/chapters/:chapterNumber', (req, res) => {
    const story = repo.getStoryBySlug(req.params.slug);
    if (!story) {
      res.status(404).json({ error: 'Story not found.' });
      return;
    }
    const chNum = Number(req.params.chapterNumber);
    const chapter = story.chapters.find((c) => c.chapterNumber === chNum);
    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found.' });
      return;
    }

    const user = getAuthenticatedUser(req);
    const allowed = repo.hasAccessToChapter(user, story, chapter);
    if (!allowed) {
      res.status(403).json({
        locked: true,
        error: 'This chapter requires an active Patron membership or individual story unlock.',
        story: sanitizeStoryForPublic(story),
        chapter: {
          ...chapter,
          content: [],
        },
      });
      return;
    }

    res.json({
      locked: false,
      story: sanitizeStoryForPublic(story),
      chapter,
    });
  });

  // =========================================================================
  // ACCOUNT STATE, READING GOALS, HIGHLIGHTS & COMMENTS
  // =========================================================================
  app.get('/api/account/transactions', requireAuth, (req: AuthedRequest, res) => {
    res.json({ transactions: repo.getUserTransactions(req.currentUser!.id) });
  });

  app.post('/api/account/bookmarks/toggle', requireAuth, (req: AuthedRequest, res) => {
    const { chapterId } = req.body as { chapterId?: string };
    if (!chapterId) {
      res.status(400).json({ error: 'chapterId is required.' });
      return;
    }
    const updated = repo.toggleBookmark(req.currentUser!.id, chapterId);
    res.json({ bookmarkedChapterIds: updated || [] });
  });

  app.put('/api/account/progress', requireAuth, (req: AuthedRequest, res) => {
    const { storyId, chapterId, chapterNumber, progressPercent } = req.body as {
      storyId?: string;
      chapterId?: string;
      chapterNumber?: number;
      progressPercent?: number;
    };
    if (!storyId || !chapterId || !Number.isFinite(chapterNumber)) {
      res.status(400).json({ error: 'Valid reading progress fields are required.' });
      return;
    }
    const updated = repo.recordProgress(
      req.currentUser!.id,
      storyId,
      chapterId,
      Number(chapterNumber),
      Number(progressPercent || 0)
    );
    res.json({ readingProgress: updated || {} });
  });

  app.put('/api/account/goal', requireAuth, (req: AuthedRequest, res) => {
    const { readingGoal } = req.body as { readingGoal?: StoredUserRecord['readingGoal'] };
    if (!readingGoal || !Number.isFinite(readingGoal.targetChapters)) {
      res.status(400).json({ error: 'Valid readingGoal payload is required.' });
      return;
    }
    const updated = repo.updateReadingGoal(req.currentUser!.id, readingGoal);
    res.json({ readingGoal: updated });
  });

  app.post('/api/account/subscription/cancel', requireAuth, (req: AuthedRequest, res) => {
    const updated = repo.cancelSubscription(req.currentUser!.id);
    res.json({ subscription: updated });
  });

  app.get('/api/account/highlights', requireAuth, (req: AuthedRequest, res) => {
    res.json({ highlights: repo.getHighlights(req.currentUser!.id) });
  });

  app.post('/api/account/highlights', requireAuth, (req: AuthedRequest, res) => {
    const body = req.body as {
      id?: string;
      storyId?: string;
      storyTitle?: string;
      storySlug?: string;
      chapterId?: string;
      chapterNumber?: number;
      chapterTitle?: string;
      paragraphIndex?: number;
      excerpt?: string;
      color?: HighlightColor;
      note?: string;
    };
    if (!body.storyId || !body.chapterId || typeof body.paragraphIndex !== 'number' || !body.excerpt) {
      res.status(400).json({ error: 'Invalid highlight payload.' });
      return;
    }
    const highlights = repo.saveHighlight(req.currentUser!.id, {
      id: body.id || `hl_${crypto.randomUUID()}`,
      storyId: body.storyId,
      storyTitle: String(body.storyTitle || '').slice(0, 120),
      storySlug: String(body.storySlug || '').slice(0, 120),
      chapterId: body.chapterId,
      chapterNumber: Number(body.chapterNumber || 1),
      chapterTitle: String(body.chapterTitle || '').slice(0, 160),
      paragraphIndex: body.paragraphIndex,
      excerpt: String(body.excerpt).slice(0, 1200),
      color: (['terracotta', 'gold', 'sage'].includes(String(body.color)) ? body.color : 'terracotta') as HighlightColor,
      note: body.note ? String(body.note).slice(0, 600) : undefined,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
    res.json({ highlights });
  });

  app.delete('/api/account/highlights/:id', requireAuth, (req: AuthedRequest, res) => {
    const highlights = repo.deleteHighlight(req.currentUser!.id, req.params.id);
    res.json({ highlights });
  });

  app.get('/api/comments', (req, res) => {
    const chapterId = typeof req.query.chapterId === 'string' ? req.query.chapterId : undefined;
    res.json({ comments: repo.getComments(chapterId) });
  });

  app.post('/api/comments', requireAuth, (req: AuthedRequest, res) => {
    const { storyId, chapterId, tag, body } = req.body as {
      storyId?: string;
      chapterId?: string;
      tag?: CommentTag;
      body?: string;
    };
    const cleanedBody = String(body || '').trim();
    if (!storyId || !chapterId || cleanedBody.length < 2 || cleanedBody.length > 1000) {
      res.status(400).json({ error: 'Comment body must be between 2 and 1000 characters.' });
      return;
    }
    const safeTag: CommentTag = (['Reaction', 'Lore', 'Theory'].includes(String(tag)) ? tag : 'Reaction') as CommentTag;
    const comment = repo.addComment({
      id: `cmt_${crypto.randomUUID()}`,
      storyId,
      chapterId,
      authorName: req.currentUser!.name,
      tag: safeTag,
      body: cleanedBody,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
    res.status(201).json({ comment });
  });

  app.delete('/api/comments/:id', requireAuth, (req: AuthedRequest, res) => {
    const ok = repo.deleteComment(
      req.params.id,
      req.currentUser!.name,
      req.currentUser!.role === 'owner'
    );
    if (!ok) {
      res.status(403).json({ error: 'Unable to delete comment.' });
      return;
    }
    res.json({ ok: true });
  });

  // =========================================================================
  // PAYSTACK HOSTED CHECKOUT & SERVER VERIFICATION
  // =========================================================================
  app.post('/api/payments/initialize', requireAuth, aiLimiter, async (req: AuthedRequest, res) => {
    const { itemType, planId, storyId } = req.body as {
      itemType?: 'subscription' | 'book_purchase';
      planId?: 'monthly' | 'annual';
      storyId?: string;
    };

    const user = req.currentUser!;
    let amountNgn = 0;
    let itemName = '';
    let resolvedPlanId: 'monthly' | 'annual' | undefined;
    let resolvedStoryId: string | undefined;

    if (itemType === 'subscription') {
      const pid = planId === 'annual' ? 'annual' : 'monthly';
      const plan = PLAN_PRICES_NGN[pid];
      amountNgn = plan.amountNgn;
      itemName = plan.label;
      resolvedPlanId = pid;
    } else if (itemType === 'book_purchase' && storyId) {
      const story = repo.getStoryById(storyId);
      if (!story) {
        res.status(404).json({ error: 'Selected story not found.' });
        return;
      }
      if (story.priceNgn <= 0) {
        res.status(400).json({ error: 'This title does not require purchase.' });
        return;
      }
      amountNgn = story.priceNgn;
      itemName = `Book Unlock: ${story.title}`;
      resolvedStoryId = story.id;
    } else {
      res.status(400).json({ error: 'Valid itemType and item selection are required.' });
      return;
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!paystackSecret) {
      res.status(503).json({
        mode: 'unconfigured',
        error: 'Paystack hosted checkout is not configured in this environment yet (requires PAYSTACK_SECRET_KEY on server).',
      });
      return;
    }

    const order = repo.createOrder({
      userId: user.id,
      customerEmail: user.email,
      itemType,
      planId: resolvedPlanId,
      storyId: resolvedStoryId,
      itemName,
      amountNgn,
    });

    const baseUrl =
      process.env.APP_URL?.trim() ||
      `${req.protocol}://${req.get('host')}`;
    const callbackUrl = `${baseUrl.replace(/\/$/, '')}/pricing`;

    try {
      const response = await withTimeout(
        fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            amount: amountNgn * 100,
            currency: 'NGN',
            reference: order.reference,
            callback_url: callbackUrl,
            metadata: {
              orderId: order.id,
              userId: user.id,
              itemType,
              planId: resolvedPlanId,
              storyId: resolvedStoryId,
            },
          }),
        })
      );

      const json = (await response.json()) as {
        status?: boolean;
        message?: string;
        data?: { authorization_url?: string; reference?: string };
      };

      if (!response.ok || !json.status || !json.data?.authorization_url) {
        res.status(502).json({
          error: json.message || 'Paystack refused to initialize transaction.',
        });
        return;
      }

      res.json({
        mode: 'hosted',
        authorizationUrl: json.data.authorization_url,
        reference: order.reference,
        amountNgn: order.amountNgn,
        itemName: order.itemName,
      });
    } catch {
      res.status(502).json({ error: 'Failed to reach Paystack gateway. Please retry.' });
    }
  });

  app.post('/api/payments/verify', requireAuth, async (req: AuthedRequest, res) => {
    const { reference } = req.body as { reference?: string };
    if (!reference) {
      res.status(400).json({ error: 'Transaction reference is required.' });
      return;
    }

    const user = req.currentUser!;
    const order = repo.getOrderByReference(reference);
    if (!order || (order.userId !== user.id && user.role !== 'owner')) {
      res.status(404).json({ error: 'Order reference not found for your account.' });
      return;
    }

    if (order.status === 'success') {
      res.json({
        ok: true,
        status: 'success',
        user: repo.toPublicProfile(user),
        transactions: repo.getUserTransactions(user.id),
      });
      return;
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!paystackSecret) {
      res.status(503).json({ error: 'Paystack verification is not configured on the server.' });
      return;
    }

    try {
      const response = await withTimeout(
        fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
          },
        })
      );
      const json = (await response.json()) as {
        status?: boolean;
        data?: {
          id?: string | number;
          status?: string;
          amount?: number;
          currency?: string;
          channel?: string;
        };
      };

      if (!response.ok || !json.status || json.data?.status !== 'success') {
        res.status(402).json({
          ok: false,
          status: json.data?.status || 'pending',
          error: 'Payment has not completed on Paystack yet.',
        });
        return;
      }

      const result = repo.fulfillOrderIdempotently(
        reference,
        Number(json.data.amount || 0),
        String(json.data.currency || 'NGN'),
        mapPaystackChannel(json.data.channel),
        String(json.data.id ?? reference)
      );

      if (!result.ok) {
        res.status(400).json({ error: result.reason || 'Payment verification failed.' });
        return;
      }

      const refreshed = repo.getUserById(user.id) || user;
      res.json({
        ok: true,
        status: 'success',
        user: repo.toPublicProfile(refreshed),
        transactions: repo.getUserTransactions(user.id),
      });
    } catch {
      res.status(502).json({ error: 'Unable to verify Paystack transaction.' });
    }
  });

  // =========================================================================
  // OWNER-ONLY ADMIN PUBLISHING DESK
  // =========================================================================
  app.get('/api/admin/overview', requireAuth, requireOwner, (_req, res) => {
    res.json(repo.getAdminOverview());
  });

  app.post('/api/admin/stories', requireAuth, requireOwner, (req, res) => {
    const body = req.body as {
      title?: string;
      subtitle?: string;
      author?: string;
      genre?: string;
      synopsis?: string;
      coverImage?: string;
      accessTier?: AccessTier;
      priceNgn?: number;
    };

    const title = String(body.title || '').trim();
    const synopsis = String(body.synopsis || '').trim();
    if (title.length < 2 || synopsis.length < 10) {
      res.status(400).json({ error: 'Story title and synopsis are required.' });
      return;
    }

    const story = repo.addStory({
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      title,
      subtitle: String(body.subtitle || 'An Original Lorethos Release').trim(),
      author: String(body.author || 'Lorethos Editorial').trim(),
      authorBio: 'Published author on Lorethos.',
      genre: String(body.genre || 'Epic Fantasy').trim(),
      tags: [String(body.genre || 'Fiction').trim(), 'Serialized'],
      coverImage: String(body.coverImage || '/assets/images/book_cover_obsidian_throne_1794465561565.jpg'),
      synopsis,
      prologueLore: 'Published directly from the Lorethos Publishing Desk.',
      status: 'Ongoing',
      accessTier: (['free', 'subscription', 'purchase'].includes(String(body.accessTier))
        ? body.accessTier
        : 'subscription') as AccessTier,
      priceNgn: Math.max(0, Number(body.priceNgn || 2500)),
      rating: 0,
      ratingsCount: 0,
      totalChapters: 1,
      totalReads: 0,
      freeChaptersCount: 3,
      featured: false,
      updatedAt: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    });

    res.status(201).json({ story: sanitizeStoryForPublic(story) });
  });

  app.post('/api/admin/stories/:storyId/chapters', requireAuth, requireOwner, (req, res) => {
    const body = req.body as {
      title?: string;
      chapterNumber?: number;
      excerpt?: string;
      content?: string[];
      isFree?: boolean;
    };

    const title = String(body.title || '').trim();
    const paragraphs = Array.isArray(body.content)
      ? body.content.map((p) => String(p).trim()).filter(Boolean)
      : [];

    if (!title || paragraphs.length === 0) {
      res.status(400).json({ error: 'Chapter title and prose content are required.' });
      return;
    }

    const wordCount = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
    const chapter = repo.addChapterToStory(req.params.storyId, {
      chapterNumber: Number(body.chapterNumber || 1),
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      releaseDate: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
      wordCount,
      readTimeMinutes: Math.max(2, Math.round(wordCount / 250)),
      isFree: Boolean(body.isFree),
      excerpt: String(body.excerpt || paragraphs[0]).slice(0, 260),
      content: paragraphs,
    });

    if (!chapter) {
      res.status(404).json({ error: 'Target story not found.' });
      return;
    }

    const updatedStory = repo.getStoryById(req.params.storyId)!;
    res.status(201).json({ chapter, story: sanitizeStoryForPublic(updatedStory) });
  });

  app.patch('/api/admin/stories/:storyId/pricing', requireAuth, requireOwner, (req, res) => {
    const { accessTier, priceNgn, freeChaptersCount } = req.body as {
      accessTier?: AccessTier;
      priceNgn?: number;
      freeChaptersCount?: number;
    };

    const updated = repo.updateStoryPricing(
      req.params.storyId,
      (['free', 'subscription', 'purchase'].includes(String(accessTier))
        ? accessTier
        : 'subscription') as AccessTier,
      Number(priceNgn ?? 2500),
      Number(freeChaptersCount ?? 3)
    );

    if (!updated) {
      res.status(404).json({ error: 'Story not found.' });
      return;
    }

    res.json({ story: sanitizeStoryForPublic(updated) });
  });

  // =========================================================================
  // HARDENED AI ENDPOINTS (SERVER CATALOG & ENTITLEMENT ENFORCED)
  // =========================================================================

  // 1. Reader Chapter Companion
  app.post('/api/ai/companion', aiLimiter, async (req, res) => {
    try {
      const { mode, question, storySlug, chapterNumber } = req.body as {
        mode?: 'recap' | 'ask';
        question?: string;
        storySlug?: string;
        chapterNumber?: number;
      };

      const story = storySlug ? repo.getStoryBySlug(storySlug) : undefined;
      const chNum = Number(chapterNumber);
      const chapter = story?.chapters.find((c) => c.chapterNumber === chNum);

      if (!story || !chapter) {
        res.status(404).json({ error: 'Story or chapter could not be found.' });
        return;
      }

      const user = getAuthenticatedUser(req);
      if (!repo.hasAccessToChapter(user, story, chapter)) {
        res.status(403).json({
          error: 'Unlock this chapter before querying the companion on its full contents.',
        });
        return;
      }

      const safeQuestion = String(question || '').trim().slice(0, 600);
      if (mode === 'ask' && !safeQuestion) {
        res.status(400).json({ error: 'Please enter a question about the chapter.' });
        return;
      }

      const ai = getGeminiClient();
      const chapterText = chapter.content.join('\n\n').slice(0, 12000);
      const contextBlock = [
        `Title: ${story.title} by ${story.author} (${story.genre})`,
        `Synopsis: ${story.synopsis}`,
        `World Lore: ${story.prologueLore}`,
        `Current Chapter ${chapter.chapterNumber}: "${chapter.title}"`,
        `Chapter Prose:\n${chapterText}`,
      ].join('\n\n');

      const prompt =
        mode === 'recap'
          ? `Provide a spoiler-free recap of Chapter ${chapter.chapterNumber} ("${chapter.title}"). Keep it concise (3 short bullet points highlighting key events, character stakes, and setting). Do not invent events outside the provided text.`
          : `Answer the reader's question clearly and concisely (2-4 sentences) using only the provided story lore and chapter prose. Question: "${safeQuestion}"`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `${contextBlock}\n\nTask: ${prompt}`,
          config: {
            systemInstruction:
              'You are a concise literary reading companion for Lorethos. Be accurate to the text and strictly spoiler-free beyond the current chapter.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      res.json({ reply: (response.text ?? '').trim() });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. Library Story Matchmaker (server catalog metadata only)
  app.post('/api/ai/recommend', aiLimiter, async (req, res) => {
    try {
      const { moodPrompt } = req.body as { moodPrompt?: string };
      const cleanMood = String(moodPrompt || '').trim().slice(0, 400);

      if (!cleanMood) {
        res.status(400).json({ error: 'Please describe what kind of story you want to read.' });
        return;
      }

      const catalog = repo.getStories();
      const ai = getGeminiClient();
      const catalogSummary = catalog
        .map(
          (s) =>
            `- slug: "${s.slug}" | title: "${s.title}" | genre: "${s.genre}" | author: "${s.author}" | tags: [${s.tags.join(', ')}] | synopsis: ${s.synopsis}`
        )
        .join('\n');

      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Reader preference: "${cleanMood}"\n\nAvailable Catalog:\n${catalogSummary}\n\nSelect up to 3 best-matching stories from the catalog above (ordered best match first). Only use slugs that exist in the catalog.`,
          config: {
            systemInstruction:
              'You are a literary curator at Lorethos. Match readers to stories strictly from the provided catalog with clear, specific explanations.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                curatorNote: {
                  type: Type.STRING,
                  description: 'A brief 1-sentence greeting tailored to the reader mood.',
                },
                recommendations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      slug: { type: Type.STRING },
                      vibeTag: { type: Type.STRING },
                      reason: { type: Type.STRING },
                    },
                    required: ['slug', 'vibeTag', 'reason'],
                  },
                },
              },
              required: ['curatorNote', 'recommendations'],
            },
          },
        })
      );

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Author Publishing Desk — Drafting Assistant (Owner Only)
  app.post('/api/ai/scriptorium', requireAuth, requireOwner, aiLimiter, async (req, res) => {
    try {
      const { task, storyTitle, genre, chapterTitle, outline, existingSynopsis } = req.body as {
        task: 'draft_chapter' | 'craft_synopsis';
        storyTitle: string;
        genre: string;
        chapterTitle?: string;
        outline?: string;
        existingSynopsis?: string;
      };

      const safeTitle = String(storyTitle || 'Untitled Story').slice(0, 140);
      const safeGenre = String(genre || 'Epic Fantasy').slice(0, 80);
      const safeChapterTitle = String(chapterTitle || 'New Chapter').slice(0, 140);
      const safeOutline = String(outline || existingSynopsis || '').slice(0, 1200);

      const ai = getGeminiClient();

      if (task === 'craft_synopsis') {
        const response = await withTimeout(
          ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Story Title: "${safeTitle}"\nGenre: ${safeGenre}\nAuthor notes: "${safeOutline || 'Original narrative'}"\n\nWrite a concise, publication-ready synopsis in 2-3 sentences that hooks readers without giving away the ending.`,
            config: {
              systemInstruction:
                'You are a literary editor at Lorethos Publishing. Craft compelling book synopses.',
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          })
        );
        res.json({ synopsis: (response.text ?? '').trim() });
        return;
      }

      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Story: "${safeTitle}" (${safeGenre})\nChapter Title: "${safeChapterTitle}"\nScene Outline / Prompt: "${safeOutline || 'Continue the narrative tension with rich atmosphere and dialogue.'}"\n\nWrite an immersive 3-4 paragraph opening chapter draft and a gripping 1-sentence teaser excerpt.`,
          config: {
            systemInstruction:
              'You are a co-author at Lorethos. Produce vivid serialized fiction prose with strong pacing.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                excerpt: {
                  type: Type.STRING,
                  description: 'A compelling one-sentence teaser hook for chapter previews.',
                },
                paragraphs: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 to 4 prose paragraphs forming the chapter draft.',
                },
              },
              required: ['excerpt', 'paragraphs'],
            },
          },
        })
      );

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Text-to-Speech Chapter Narration (Server Prose & Entitlement Enforced)
  app.post('/api/ai/tts', aiLimiter, async (req, res) => {
    try {
      const { storySlug, chapterNumber, voiceName } = req.body as {
        storySlug?: string;
        chapterNumber?: number;
        voiceName?: string;
      };

      const story = storySlug ? repo.getStoryBySlug(storySlug) : undefined;
      const chNum = Number(chapterNumber);
      const chapter = story?.chapters.find((c) => c.chapterNumber === chNum);

      if (!story || !chapter) {
        res.status(404).json({ error: 'Story or chapter could not be found.' });
        return;
      }

      const user = getAuthenticatedUser(req);
      if (!repo.hasAccessToChapter(user, story, chapter)) {
        res.status(403).json({
          error: 'Unlock this chapter before generating full chapter audio narration.',
        });
        return;
      }

      const cleaned = chapter.content.join('\n\n').trim();
      if (!cleaned) {
        res.status(400).json({ error: 'Chapter narration text is empty.' });
        return;
      }

      const allowedVoices = new Set(['Kore', 'Charon', 'Puck', 'Zephyr']);
      const selectedVoice = voiceName && allowedVoices.has(voiceName) ? voiceName : 'Kore';
      const cappedText = cleaned.slice(0, 3200);
      const intro = `${story.title}. Chapter ${chapter.chapterNumber}: ${chapter.title}.\n\n`;

      const ai = getGeminiClient();
      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: `Read in a warm, clear literary audiobook narration style:\n\n${intro}${cappedText}`,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoice,
                },
              },
            },
          },
        }),
        30000
      );

      const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!audioPart?.data) {
        res.status(502).json({ error: 'Audio narration was not returned by the model.' });
        return;
      }

      res.json({
        audioBase64: audioPart.data,
        mimeType: audioPart.mimeType || 'audio/wav',
        voiceName: selectedVoice,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // =========================================================================
  // COMMUNITY CONTACT INQUIRIES
  // =========================================================================
  app.post('/api/inquiries', inquiryLimiter, (req, res) => {
    const { name, email, inquiryType, subject, message, website } = req.body as {
      name?: string;
      email?: string;
      inquiryType?: string;
      subject?: string;
      message?: string;
      website?: string;
    };

    // Bot honeypot trap
    if (website && website.trim().length > 0) {
      res.status(400).json({ error: 'Submission rejected.' });
      return;
    }

    const safeName = String(name || '').trim();
    const safeEmail = String(email || '').trim();
    const safeSubject = String(subject || '').trim();
    const safeMessage = String(message || '').trim();

    if (safeName.length < 2 || safeName.length > 120) {
      res.status(400).json({ error: 'Please provide your name (2-120 characters).' });
      return;
    }
    if (!EMAIL_REGEX.test(safeEmail)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (safeSubject.length < 2 || safeSubject.length > 160) {
      res.status(400).json({ error: 'Please provide a subject (2-160 characters).' });
      return;
    }
    if (safeMessage.length < 10 || safeMessage.length > 3000) {
      res.status(400).json({ error: 'Message must be between 10 and 3000 characters.' });
      return;
    }

    const referenceId = `INQ-${Date.now().toString(36).toUpperCase()}`;
    const inquiry = repo.addInquiry({
      id: `inq_${crypto.randomUUID()}`,
      referenceId,
      name: safeName,
      email: safeEmail,
      inquiryType: String(inquiryType || 'Reader Feedback').slice(0, 80),
      subject: safeSubject,
      message: safeMessage,
      submittedAt: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });

    res.status(201).json({
      ok: true,
      referenceId: inquiry.referenceId,
      receivedAt: new Date().toISOString(),
      inquiry,
    });
  });

  // =========================================================================
  // SOURCE CODE EXPORT (OWNER PROTECTED)
  // =========================================================================
  app.get('/api/export-zip', requireAuth, requireOwner, async (_req, res) => {
    try {
      const zip = new JSZip();
      const excludedDirs = new Set([
        'node_modules',
        'dist',
        'dist-server',
        '.git',
        '.vercel',
        '.next',
      ]);
      const excludedFiles = new Set(['.env', '.env.local', '.env.production', '.DS_Store']);

      const addDirToZip = async (dirPath: string, relBase: string) => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (excludedDirs.has(entry.name)) continue;
            const nextAbs = path.join(dirPath, entry.name);
            const nextRel = relBase ? `${relBase}/${entry.name}` : entry.name;
            await addDirToZip(nextAbs, nextRel);
          } else if (entry.isFile()) {
            if (excludedFiles.has(entry.name) || entry.name.endsWith('.zip')) continue;
            const absFile = path.join(dirPath, entry.name);
            const zipPath = relBase ? `${relBase}/${entry.name}` : entry.name;
            const content = await fs.readFile(absFile);
            zip.file(zipPath, content);
          }
        }
      };

      await addDirToZip(__dirname, '');
      const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="lorethos-source.zip"');
      res.setHeader('Content-Length', String(buffer.length));
      res.send(buffer);
    } catch {
      res.status(500).json({ error: 'Failed to build ZIP archive.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    try {
      await fs.access(distPath);
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } catch {
      // Running API-only behind Caddy static web container
      app.get('/', (_req, res) => {
        res.json({ ok: true, service: 'lorethos-api' });
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lorethos server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
