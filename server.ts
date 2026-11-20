import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Request, Response, NextFunction } from 'express';
import JSZip from 'jszip';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { repo, verifyPassword, PLAN_PRICES_NGN } from './server/db.js';
import type { StoredUserRecord } from './server/db.js';
import { sanitizeStoryForPublic } from './server/catalog.js';
import {
  submitWaveSpeedVideoJob,
  getWaveSpeedVideoJob,
  streamWaveSpeedVideoAsset,
  formatWaveSpeedError,
  classifyVideoSceneMood,
  buildMoodCinematicPrompt,
  parseVideoDurationSeconds,
  type WaveSpeedConfig,
  type VideoDurationOption,
  type VideoMoodPreference,
  type VideoSceneMood,
} from './server/wavespeed.js';
import type { AccessTier, CommentTag, HighlightColor, PublicationStatus } from './src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.basename(__dirname) === 'dist-server' ? path.resolve(__dirname, '..') : __dirname;

function parseCliArg(flag: string): string | undefined {
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === flag && i + 1 < process.argv.length) {
      return process.argv[i + 1];
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

const cliPortRaw = parseCliArg('--port');
const cliHostRaw = parseCliArg('--host');
const isAiStudioContainer = Boolean(process.env.K_SERVICE && process.env.APPLET_ID);
const envPortNum = Number(process.env.PORT);
const resolvedEnvPort =
  Number.isFinite(envPortNum) && envPortNum > 0
    ? isAiStudioContainer && process.env.NODE_ENV !== 'production' && envPortNum === 8080
      ? 3000
      : envPortNum
    : 3000;
const PORT =
  cliPortRaw && Number.isFinite(Number(cliPortRaw)) && Number(cliPortRaw) > 0
    ? Number(cliPortRaw)
    : resolvedEnvPort;
const HOST = (cliHostRaw || process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';
const MODEL_NAME = 'gemini-4-hydrogen';
const SESSION_COOKIE_NAME = 'lorethos_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeTtsWavAudio(
  base64Data: string,
  rawMimeType?: string | null
): { audioBase64: string; mimeType: string } {
  const rawBuf = Buffer.from(base64Data, 'base64');
  const mimeLower = String(rawMimeType || '').toLowerCase();

  if (
    rawBuf.length >= 12 &&
    rawBuf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    rawBuf.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return { audioBase64: base64Data, mimeType: 'audio/wav' };
  }

  // Never wrap already-encoded compressed audio streams (MP3, OGG, FLAC, AAC/MP4, WebM) inside a PCM WAV header
  const isMp3Magic =
    (rawBuf.length >= 3 && rawBuf.subarray(0, 3).toString('ascii') === 'ID3') ||
    (rawBuf.length >= 2 && rawBuf[0] === 0xff && (rawBuf[1] & 0xe0) === 0xe0);
  const isOggMagic = rawBuf.length >= 4 && rawBuf.subarray(0, 4).toString('ascii') === 'OggS';
  const isFlacMagic = rawBuf.length >= 4 && rawBuf.subarray(0, 4).toString('ascii') === 'fLaC';
  const isMp4Magic = rawBuf.length >= 8 && rawBuf.subarray(4, 8).toString('ascii') === 'ftyp';
  if (
    isMp3Magic ||
    mimeLower.includes('mpeg') ||
    mimeLower.includes('mp3')
  ) {
    return { audioBase64: base64Data, mimeType: 'audio/mpeg' };
  }
  if (isOggMagic || mimeLower.includes('ogg')) {
    return { audioBase64: base64Data, mimeType: 'audio/ogg' };
  }
  if (isFlacMagic || mimeLower.includes('flac')) {
    return { audioBase64: base64Data, mimeType: 'audio/flac' };
  }
  if (isMp4Magic || mimeLower.includes('mp4') || mimeLower.includes('aac')) {
    return { audioBase64: base64Data, mimeType: 'audio/mp4' };
  }
  if (mimeLower.includes('webm')) {
    return { audioBase64: base64Data, mimeType: 'audio/webm' };
  }

  const rateMatch = mimeLower.match(/rate=(\d+)/);
  const channelsMatch = mimeLower.match(/channels=(\d+)/);
  const sampleRate = rateMatch ? Math.max(8000, Math.min(48000, Number(rateMatch[1]))) : 24000;
  const channels = channelsMatch ? Math.max(1, Math.min(2, Number(channelsMatch[1]))) : 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  // Align to whole 16-bit samples, empirically verify LE vs BE byte smoothness,
  // remove DC offset, cap headroom at -2.5dB (24500), and apply 15ms fade-in/out to prevent clicks.
  const evenLen = rawBuf.length - (rawBuf.length % 2);
  const pcmBuf = Buffer.from(rawBuf.subarray(0, evenLen));
  const sampleCount = Math.floor(pcmBuf.length / 2);

  if (sampleCount >= 4) {
    let leDiff = 0;
    let beDiff = 0;
    const checkBytes = Math.min(pcmBuf.length - 4, 48000);
    for (let i = 0; i < checkBytes; i += 2) {
      leDiff += Math.abs(pcmBuf.readInt16LE(i + 2) - pcmBuf.readInt16LE(i));
      beDiff += Math.abs(pcmBuf.readInt16BE(i + 2) - pcmBuf.readInt16BE(i));
    }
    const hintLE = mimeLower.includes('little') || mimeLower.includes('le');
    const shouldSwapToLE = !hintLE && beDiff < leDiff * 0.7;
    if (shouldSwapToLE) {
      for (let i = 0; i < pcmBuf.length; i += 2) {
        pcmBuf.writeInt16LE(pcmBuf.readInt16BE(i), i);
      }
    }

    let sum = 0;
    for (let i = 0; i < pcmBuf.length; i += 2) {
      sum += pcmBuf.readInt16LE(i);
    }
    const mean = sum / sampleCount;
    let maxAbs = 0;
    for (let i = 0; i < pcmBuf.length; i += 2) {
      const centered = Math.max(-32768, Math.min(32767, Math.round(pcmBuf.readInt16LE(i) - mean)));
      pcmBuf.writeInt16LE(centered, i);
      const abs = Math.abs(centered);
      if (abs > maxAbs) maxAbs = abs;
    }

    if (maxAbs > 24500) {
      const scale = 24500 / maxAbs;
      for (let i = 0; i < pcmBuf.length; i += 2) {
        pcmBuf.writeInt16LE(Math.round(pcmBuf.readInt16LE(i) * scale), i);
      }
    }

    const fadeSamples = Math.min(Math.floor(sampleRate * 0.015), Math.floor(sampleCount / 8));
    for (let s = 0; s < fadeSamples; s += 1) {
      const gain = s / Math.max(1, fadeSamples);
      const headIdx = s * 2;
      const tailIdx = (sampleCount - 1 - s) * 2;
      pcmBuf.writeInt16LE(Math.round(pcmBuf.readInt16LE(headIdx) * gain), headIdx);
      pcmBuf.writeInt16LE(Math.round(pcmBuf.readInt16LE(tailIdx) * gain), tailIdx);
    }
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcmBuf.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcmBuf.length, 40);

  return {
    audioBase64: Buffer.concat([header, pcmBuf]).toString('base64'),
    mimeType: 'audio/wav',
  };
}

function ensureLorethosClosing(text: string, storyTitle?: string): string {
  const cleaned = text.trim();
  const withStop = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  if (/\blorethos\b/i.test(withStop)) {
    return withStop;
  }
  const cta = storyTitle ? `Read ${storyTitle} now on Lorethos.` : 'Read the full story now on Lorethos.';
  return `${withStop} ${cta}`;
}

function buildCleanTrailerNarrationScript(options: {
  scenePrompt: string;
  storyTitle?: string;
  storyNarration?: string;
  mood: VideoSceneMood;
  durationSeconds: number;
}): string {
  const { scenePrompt, storyTitle, storyNarration, mood, durationSeconds } = options;
  const ctaReserveWords = storyTitle ? 8 : 7;
  const maxBodyWords = Math.max(15, Math.min(50, Math.round(durationSeconds * 1.85) - ctaReserveWords));

  const stripProductionCues = (text: string) =>
    text
      .replace(/\b(atmospheric book trailer|painterly lighting|slow camera push|dramatic mood lighting|spoken narration|cinematic|4k|8k|camera angle)\b[^,.!?]*[,.!?]?/gi, '')
      .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const cleanedScene = stripProductionCues(scenePrompt).replace(/[.!?]+$/, '');
  const moodBridge: Record<VideoSceneMood, string> = {
    storm: 'Amid thunder and rising tempest, every choice carries a perilous price.',
    action: 'As conflict ignites, destiny turns upon a single breath.',
    suspense: 'Behind quiet shadows, a hidden truth waits to be uncovered.',
    neutral: 'Discover a gripping story of memory, wonder, and unfolding intrigue.',
  };

  let rawCandidate = '';
  if (storyNarration && storyNarration.trim().length >= 30 && (!cleanedScene || scenePrompt.length > 140)) {
    return ensureLorethosClosing(storyNarration.trim(), storyTitle);
  } else {
    const lead = storyTitle ? `In ${storyTitle}, ` : '';
    const sceneLine = cleanedScene ? `${cleanedScene.charAt(0).toLowerCase()}${cleanedScene.slice(1)}. ` : '';
    rawCandidate = `${lead}${sceneLine}${moodBridge[mood]}`.trim();
  }

  const words = rawCandidate.split(/\s+/).filter(Boolean);
  let body = rawCandidate;
  if (words.length > maxBodyWords) {
    const clipped = words.slice(0, maxBodyWords).join(' ');
    const lastSentenceEnd = Math.max(clipped.lastIndexOf('.'), clipped.lastIndexOf('!'), clipped.lastIndexOf('?'));
    body =
      lastSentenceEnd >= Math.floor(clipped.length * 0.55)
        ? clipped.slice(0, lastSentenceEnd + 1).trim()
        : `${clipped.replace(/[,;:\-–—]+$/, '')}.`;
  }

  return ensureLorethosClosing(body, storyTitle);
}

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

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (proto === 'https') return true;
  const origin = String(req.headers.origin || req.headers.referer || '');
  return origin.startsWith('https://');
}

function setSessionCookie(req: Request, res: Response, userId: string): string {
  const token = signSessionToken(userId);
  const isHttps = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    'Path=/',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (isHttps) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
  return token;
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    'Path=/',
    'Max-Age=0'
  ];
  if (isHttps) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function extractSessionUserId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const uid = verifySessionToken(bearerToken);
    if (uid) return uid;
  }
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionToken(cookies[SESSION_COOKIE_NAME]);
}

async function getAuthenticatedUserAsync(req: Request): Promise<StoredUserRecord | undefined> {
  const userId = extractSessionUserId(req);
  if (!userId) return undefined;
  return repo.findUserById(userId);
}

interface AuthedRequest extends Request {
  currentUser?: StoredUserRecord;
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = await getAuthenticatedUserAsync(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }
  req.currentUser = user;
  next();
}

async function requireOwner(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = req.currentUser || (await getAuthenticatedUserAsync(req));
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
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 25000): Promise<T> {
  const seconds = Math.max(1, Math.round(timeoutMs / 1000));
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${seconds} seconds.`)), timeoutMs)
    )
  ]);
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  console.error('[Gemini API error]', rawMessage);
  let extractedReason = '';
  try {
    const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { error?: { message?: string } };
      if (parsed?.error?.message) {
        extractedReason = parsed.error.message.replace(/AIza[0-9A-Za-z_-]+/g, '[redacted]');
      }
    }
  } catch {
    // ignore parse failure
  }
  if (rawMessage.includes('GEMINI_API_KEY is not configured')) {
    return {
      status: 503,
      message: 'AI features require a valid API key in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('403') || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: extractedReason || 'AI provider denied this request. Check that your GEMINI_API_KEY in Settings > Secrets is valid and enabled for this model.',
    };
  }
  if (rawMessage.includes('400') || rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('INVALID_ARGUMENT')) {
    return {
      status: 400,
      message: extractedReason || 'The AI service rejected the API key or request parameters. Please verify Settings > Secrets.',
    };
  }
  if (rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI quota reached or paid billing tier required for this model. Check Settings > Secrets for a billing-enabled key.',
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
    message: extractedReason || rawMessage.replace(/AIza[0-9A-Za-z_-]+/g, '[redacted]').slice(0, 240) || 'Failed to generate AI response. Please try again.',
  };
}

function mapPaystackChannel(channel: unknown): 'card' | 'bank_transfer' | 'ussd' {
  const c = String(channel || '').toLowerCase();
  if (c === 'bank_transfer' || c === 'bank' || c === 'dedicated_nuban') return 'bank_transfer';
  if (c === 'ussd') return 'ussd';
  return 'card';
}

export async function createApp(options?: {
  withVite?: boolean;
  httpServer?: http.Server;
  waveSpeedConfig?: WaveSpeedConfig;
}) {
  await repo.initDatabase();
  const app = express();
  app.set('trust proxy', 1);

  const aiLimiter = createRateLimiter(20, 60_000);
  const videoPollLimiter = createRateLimiter(120, 60_000);
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

  app.use(express.json({ limit: '12mb' }));

  // =========================================================================
  // HEALTH & READINESS
  // =========================================================================
  app.get('/api/health', async (_req, res) => {
    const db = await repo.checkDatabaseHealth();
    res.json({
      ok: true,
      db,
      videoProvider: 'wavespeed',
      waveSpeedConfigured: Boolean(process.env.WAVESPEED_API_KEY?.trim()),
      paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================================
  // AUTHENTICATION & SESSIONS
  // =========================================================================
  app.get('/api/auth/session', async (req, res) => {
    const user = await getAuthenticatedUserAsync(req);
    if (!user) {
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({ authenticated: true, user: repo.toPublicProfile(user) });
  });

  app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
      const { name, nickname, email, password } = req.body as {
        name?: string;
        nickname?: string;
        email?: string;
        password?: string;
      };

      const trimmedName = String(name || '').trim();
      const trimmedNickname = typeof nickname === 'string' ? nickname.trim() : '';
      const trimmedEmail = String(email || '').trim().toLowerCase();
      const rawPassword = String(password || '');

      if (trimmedName.length < 2 || trimmedName.length > 80) {
        res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
        return;
      }
      if (trimmedNickname && (trimmedNickname.length < 2 || trimmedNickname.length > 40)) {
        res.status(400).json({ error: 'Nickname must be between 2 and 40 characters.' });
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

      if (await repo.findUserByEmail(trimmedEmail)) {
        res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
        return;
      }

      const user = await repo.createUser(trimmedName, trimmedEmail, rawPassword, trimmedNickname || undefined);
      const token = setSessionCookie(req, res, user.id);
      res.status(201).json({ user: repo.toPublicProfile(user), token });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      const trimmedEmail = String(email || '').trim().toLowerCase();
      const rawPassword = String(password || '');

      if (!EMAIL_REGEX.test(trimmedEmail) || !rawPassword) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const user = await repo.findUserByEmail(trimmedEmail);
      if (!user || !verifyPassword(rawPassword, user.passwordHash)) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const token = setSessionCookie(req, res, user.id);
      res.json({ user: repo.toPublicProfile(user), token });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Failed to sign in. Please try again.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // =========================================================================
  // PUBLIC CATALOG & SERVER-GATED CHAPTER DELIVERY
  // =========================================================================
  app.get('/api/stories', async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const genre = String(req.query.genre || 'All').trim();
    const status = String(req.query.status || 'All').trim();
    const tier = String(req.query.tier || 'All').trim();
    const sort = String(req.query.sort || 'popular').trim();

    const user = await getAuthenticatedUserAsync(req);
    const isOwner = user?.role === 'owner';
    let stories = repo.getStories({ includeUnpublished: isOwner }).map(sanitizeStoryForPublic);

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

  app.get('/api/stories/likes', async (req, res) => {
    const user = await getAuthenticatedUserAsync(req);
    const rawIds = typeof req.query.storyIds === 'string' ? req.query.storyIds : '';
    const storyIds = rawIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
    const data = repo.getStoryLikes(storyIds, user?.id);
    res.json(data);
  });

  app.post('/api/stories/:id/like', requireAuth, (req: AuthedRequest, res) => {
    const storyId = String(req.params.id || '').trim();
    if (!storyId || storyId.length > 120) {
      res.status(400).json({ error: 'Valid story id is required.' });
      return;
    }
    const result = repo.toggleStoryLike(storyId, req.currentUser!.id);
    res.json({
      storyId,
      liked: result.liked,
      count: result.count,
    });
  });

  app.get('/api/stories/:slug', async (req, res) => {
    const user = await getAuthenticatedUserAsync(req);
    const story = repo.getStoryBySlug(req.params.slug, {
      includeUnpublished: user?.role === 'owner'
    });
    if (!story) {
      res.status(404).json({ error: 'Story not found.' });
      return;
    }
    res.json({ story: sanitizeStoryForPublic(story) });
  });

  app.get('/api/stories/:slug/chapters/:chapterNumber', async (req, res) => {
    const user = await getAuthenticatedUserAsync(req);
    const story = repo.getStoryBySlug(req.params.slug, {
      includeUnpublished: user?.role === 'owner'
    });
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
  // ACCOUNT STATE, PROFILE, READING GOALS, HIGHLIGHTS & COMMENTS
  // =========================================================================
  app.patch('/api/account/profile', requireAuth, (req: AuthedRequest, res) => {
    const body = req.body as {
      name?: unknown;
      nickname?: unknown;
      avatar?: unknown;
      bio?: unknown;
    };

    const patch: {
      name?: string;
      nickname?: string | null;
      avatar?: string | null;
      bio?: string | null;
    } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string') {
        res.status(400).json({ error: 'Name must be a string.' });
        return;
      }
      const trimmed = body.name.trim();
      if (trimmed.length < 2 || trimmed.length > 80) {
        res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
        return;
      }
      patch.name = trimmed;
    }

    if (body.nickname !== undefined) {
      if (body.nickname === null || body.nickname === '') {
        patch.nickname = null;
      } else if (typeof body.nickname === 'string') {
        const trimmed = body.nickname.trim();
        if (!trimmed) {
          patch.nickname = null;
        } else if (trimmed.length < 2 || trimmed.length > 40) {
          res.status(400).json({ error: 'Nickname must be between 2 and 40 characters.' });
          return;
        } else {
          patch.nickname = trimmed;
        }
      } else {
        res.status(400).json({ error: 'Invalid nickname format.' });
        return;
      }
    }

    if (body.bio !== undefined) {
      if (body.bio === null || body.bio === '') {
        patch.bio = null;
      } else if (typeof body.bio === 'string') {
        const trimmed = body.bio.trim();
        if (trimmed.length > 200) {
          res.status(400).json({ error: 'Bio must be 200 characters or fewer.' });
          return;
        }
        patch.bio = trimmed || null;
      } else {
        res.status(400).json({ error: 'Invalid bio format.' });
        return;
      }
    }

    if (body.avatar !== undefined) {
      if (body.avatar === null || body.avatar === '') {
        patch.avatar = null;
      } else if (typeof body.avatar === 'string') {
        const val = body.avatar.trim();
        if (!val) {
          patch.avatar = null;
        } else {
          const isSafeDataImage =
            val.length <= 500_000 &&
            /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(val);
          const isSafeLocalAsset =
            val.length <= 512 &&
            /^\/(assets|src\/assets)\/[A-Za-z0-9/_.-]+\.(png|jpe?g|webp|gif)(\?[A-Za-z0-9=&_-]*)?$/i.test(val);
          const isSafeHttpsUrl =
            val.length <= 1024 &&
            /^https:\/\/[^\s<>"']+$/i.test(val);

          if (!isSafeDataImage && !isSafeLocalAsset && !isSafeHttpsUrl) {
            res.status(400).json({ error: 'Invalid profile image format or size.' });
            return;
          }
          patch.avatar = val;
        }
      } else {
        res.status(400).json({ error: 'Invalid profile image payload.' });
        return;
      }
    }

    if (
      patch.name === undefined &&
      patch.nickname === undefined &&
      patch.bio === undefined &&
      patch.avatar === undefined
    ) {
      res.status(400).json({ error: 'Provide at least one profile field to update.' });
      return;
    }

    const updated = repo.updateUserProfile(req.currentUser!.id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    res.json({ user: repo.toPublicProfile(updated) });
  });

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
      selectedText?: string;
      startOffset?: number;
      endOffset?: number;
      color?: HighlightColor;
      note?: string;
    };

    const storyId = typeof body.storyId === 'string' ? body.storyId.trim() : '';
    const chapterId = typeof body.chapterId === 'string' ? body.chapterId.trim() : '';
    const paragraphIndex = body.paragraphIndex;
    const rawSelected = typeof body.selectedText === 'string' ? body.selectedText.trim() : '';
    const rawExcerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : rawSelected;

    if (
      !storyId ||
      !chapterId ||
      typeof paragraphIndex !== 'number' ||
      !Number.isInteger(paragraphIndex) ||
      paragraphIndex < 0 ||
      !rawExcerpt
    ) {
      res.status(400).json({ error: 'Invalid highlight payload.' });
      return;
    }

    const story = repo.getStoryById(storyId);
    const chapter = story?.chapters.find((c) => c.id === chapterId);
    if (!story || !chapter) {
      res.status(404).json({ error: 'Story or chapter not found.' });
      return;
    }

    if (!repo.hasAccessToChapter(req.currentUser, story, chapter)) {
      res.status(403).json({ error: 'You do not have access to highlight this chapter.' });
      return;
    }

    if (chapter.content.length > 0 && paragraphIndex >= chapter.content.length) {
      res.status(400).json({ error: 'Invalid paragraph index.' });
      return;
    }

    const validOffsets =
      typeof body.startOffset === 'number' &&
      typeof body.endOffset === 'number' &&
      Number.isInteger(body.startOffset) &&
      Number.isInteger(body.endOffset) &&
      body.startOffset >= 0 &&
      body.endOffset > body.startOffset;

    const safeId =
      typeof body.id === 'string' && body.id.trim().length > 0 && body.id.trim().length <= 100
        ? body.id.trim()
        : `hl_${crypto.randomUUID()}`;
    const cleanedNote = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';

    const highlights = repo.saveHighlight(req.currentUser!.id, {
      id: safeId,
      storyId: story.id,
      storyTitle: story.title.slice(0, 120),
      storySlug: story.slug.slice(0, 120),
      chapterId: chapter.id,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.title.slice(0, 160),
      paragraphIndex,
      excerpt: rawExcerpt.slice(0, 1200),
      selectedText: rawSelected ? rawSelected.slice(0, 800) : undefined,
      startOffset: validOffsets ? body.startOffset : undefined,
      endOffset: validOffsets ? body.endOffset : undefined,
      color: (['terracotta', 'gold', 'sage'].includes(String(body.color)) ? body.color : 'terracotta') as HighlightColor,
      note: cleanedNote || undefined,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
    res.json({ highlights });
  });

  app.patch('/api/account/highlights/:id', requireAuth, (req: AuthedRequest, res) => {
    const body = req.body as {
      color?: HighlightColor;
      note?: string | null;
    };

    const nextColor =
      body.color && ['terracotta', 'gold', 'sage'].includes(String(body.color))
        ? (body.color as HighlightColor)
        : undefined;
    const nextNote =
      body.note === null
        ? null
        : typeof body.note === 'string'
        ? body.note.trim().slice(0, 1000) || null
        : undefined;

    if (nextColor === undefined && nextNote === undefined) {
      res.status(400).json({ error: 'Provide color or note updates.' });
      return;
    }

    const updated = repo.updateHighlight(req.currentUser!.id, req.params.id, {
      color: nextColor,
      note: nextNote,
    });
    if (!updated) {
      res.status(404).json({ error: 'Highlight not found.' });
      return;
    }
    res.json({ highlights: updated });
  });

  app.delete('/api/account/highlights/:id', requireAuth, (req: AuthedRequest, res) => {
    const highlights = repo.deleteHighlight(req.currentUser!.id, req.params.id);
    res.json({ highlights });
  });

  app.get('/api/account/paragraph-bookmarks', requireAuth, (req: AuthedRequest, res) => {
    res.json({ paragraphBookmarks: repo.getParagraphBookmarks(req.currentUser!.id) });
  });

  app.post('/api/account/paragraph-bookmarks', requireAuth, (req: AuthedRequest, res) => {
    const body = req.body as {
      id?: string;
      storyId?: string;
      chapterId?: string;
      paragraphIndex?: number;
      label?: string;
      excerpt?: string;
    };

    const storyId = typeof body.storyId === 'string' ? body.storyId.trim() : '';
    const chapterId = typeof body.chapterId === 'string' ? body.chapterId.trim() : '';
    const paragraphIndex = body.paragraphIndex;
    const rawExcerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : '';

    if (
      !storyId ||
      !chapterId ||
      typeof paragraphIndex !== 'number' ||
      !Number.isInteger(paragraphIndex) ||
      paragraphIndex < 0 ||
      !rawExcerpt
    ) {
      res.status(400).json({ error: 'Invalid paragraph bookmark payload.' });
      return;
    }

    const story = repo.getStoryById(storyId);
    const chapter = story?.chapters.find((c) => c.id === chapterId);
    if (!story || !chapter) {
      res.status(404).json({ error: 'Story or chapter not found.' });
      return;
    }

    if (!repo.hasAccessToChapter(req.currentUser, story, chapter)) {
      res.status(403).json({ error: 'You do not have access to bookmark this chapter.' });
      return;
    }

    if (chapter.content.length > 0 && paragraphIndex >= chapter.content.length) {
      res.status(400).json({ error: 'Invalid paragraph index.' });
      return;
    }

    const cleanedLabel = typeof body.label === 'string' ? body.label.trim().slice(0, 120) : '';
    const safeId =
      typeof body.id === 'string' && body.id.trim().length > 0 && body.id.trim().length <= 100
        ? body.id.trim()
        : `pbm_${crypto.randomUUID()}`;

    const paragraphBookmarks = repo.saveParagraphBookmark(req.currentUser!.id, {
      id: safeId,
      storyId: story.id,
      storyTitle: story.title.slice(0, 120),
      storySlug: story.slug.slice(0, 120),
      chapterId: chapter.id,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.title.slice(0, 160),
      paragraphIndex,
      label: cleanedLabel || undefined,
      excerpt: rawExcerpt.slice(0, 1200),
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });

    res.json({ paragraphBookmarks });
  });

  app.delete('/api/account/paragraph-bookmarks/:id', requireAuth, (req: AuthedRequest, res) => {
    const paragraphBookmarks = repo.deleteParagraphBookmark(req.currentUser!.id, req.params.id);
    res.json({ paragraphBookmarks });
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
    const comment = repo.addComment(
      {
        id: `cmt_${crypto.randomUUID()}`,
        storyId,
        chapterId,
        authorName: req.currentUser!.nickname?.trim() || req.currentUser!.name,
        tag: safeTag,
        body: cleanedBody,
        createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      },
      req.currentUser!.id
    );
    res.status(201).json({ comment });
  });

  app.delete('/api/comments/:id', requireAuth, (req: AuthedRequest, res) => {
    const authorAliases = [
      req.currentUser!.name,
      ...(req.currentUser!.nickname?.trim() ? [req.currentUser!.nickname.trim()] : []),
    ];
    const ok = repo.deleteComment(
      req.params.id,
      authorAliases,
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
      publicationStatus?: PublicationStatus;
    };

    const title = String(body.title || '').trim();
    const synopsis = String(body.synopsis || '').trim();
    if (title.length < 2 || synopsis.length < 10) {
      res.status(400).json({ error: 'Story title and synopsis are required.' });
      return;
    }

    const pubStatus: PublicationStatus = (['draft', 'review', 'published'].includes(String(body.publicationStatus))
      ? body.publicationStatus
      : 'draft') as PublicationStatus;

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
      prologueLore: 'Authored in the Lorethos Publishing Desk.',
      status: 'Ongoing',
      publicationStatus: pubStatus,
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

  app.patch('/api/admin/stories/:storyId/workflow', requireAuth, requireOwner, (req, res) => {
    const { publicationStatus } = req.body as { publicationStatus?: PublicationStatus };
    if (!['draft', 'review', 'published'].includes(String(publicationStatus))) {
      res.status(400).json({ error: 'publicationStatus must be draft, review, or published.' });
      return;
    }
    const updated = repo.updateStoryWorkflow(req.params.storyId, publicationStatus as PublicationStatus);
    if (!updated) {
      res.status(404).json({ error: 'Story not found.' });
      return;
    }
    res.json({ story: sanitizeStoryForPublic(updated) });
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

      const user = await getAuthenticatedUserAsync(req);
      const story = storySlug
        ? repo.getStoryBySlug(storySlug, { includeUnpublished: user?.role === 'owner' })
        : undefined;
      const chNum = Number(chapterNumber);
      const chapter = story?.chapters.find((c) => c.chapterNumber === chNum);

      if (!story || !chapter) {
        res.status(404).json({ error: 'Story or chapter could not be found.' });
        return;
      }

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

      const user = await getAuthenticatedUserAsync(req);
      const story = storySlug
        ? repo.getStoryBySlug(storySlug, { includeUnpublished: user?.role === 'owner' })
        : undefined;
      const chNum = Number(chapterNumber);
      const chapter = story?.chapters.find((c) => c.chapterNumber === chNum);

      if (!story || !chapter) {
        res.status(404).json({ error: 'Story or chapter could not be found.' });
        return;
      }

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

      const allowedVoices = new Set(['Kore', 'Charon', 'Puck', 'Zephyr', 'Fenrir']);
      const selectedVoice = voiceName && allowedVoices.has(voiceName) ? voiceName : 'Kore';
      const cappedText = cleaned.slice(0, 2400);
      const intro = `${story.title}. Chapter ${chapter.chapterNumber}: ${chapter.title}.\n\n`;

      const ai = getGeminiClient();
      const interaction = await withTimeout(
        ai.interactions.create({
          model: 'gemini-3.8-flash-lite-tts',
          input: [
            {
              type: 'text',
              text: `${intro}${cappedText}`,
              annotations: [
                {
                  type: 'speech_metadata',
                  style: 'Warm, clear, expressive literary audiobook narrator',
                },
              ],
            },
          ],
          response_format: { type: 'audio' },
          generation_config: {
            speech_config: [
              {
                language: 'en-US',
                voice: selectedVoice,
              },
            ],
          },
        }),
        45000
      );

      const audioPart = interaction.output_audio;
      if (!audioPart?.data) {
        res.status(502).json({ error: 'Audio narration was not returned by the model.' });
        return;
      }

      const normalizedAudio = normalizeTtsWavAudio(audioPart.data, audioPart.mime_type);
      res.json({
        audioBase64: normalizedAudio.audioBase64,
        mimeType: normalizedAudio.mimeType,
        voiceName: selectedVoice,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 5. Audio Transcription via Microphone / Recorded Audio (gemini-3.5-transcribe)
  app.post('/api/ai/transcribe', aiLimiter, async (req, res) => {
    try {
      const { audioBase64, mimeType, contextHint } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        contextHint?: string;
      };

      const cleanedBase64 = String(audioBase64 || '')
        .replace(/^data:audio\/[a-zA-Z0-9.+-]+;base64,/, '')
        .trim();

      if (!cleanedBase64 || cleanedBase64.length < 32) {
        res.status(400).json({ error: 'Valid recorded audio is required for transcription.' });
        return;
      }

      const rawMime = String(mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
      const allowedAudioMimes = new Set([
        'audio/webm',
        'audio/wav',
        'audio/mp3',
        'audio/mpeg',
        'audio/mp4',
        'audio/ogg',
        'audio/aac',
        'audio/flac',
      ]);
      const safeMimeType = allowedAudioMimes.has(rawMime) ? rawMime : 'audio/webm';
      const safeContext = String(contextHint || '').trim().slice(0, 200);
      const instruction = safeContext
        ? `Transcribe this spoken literary note clearly and accurately without adding commentary. Context: ${safeContext}`
        : 'Transcribe this spoken audio clearly and accurately without adding commentary.';

      const ai = getGeminiClient();
      const interaction = await withTimeout(
        ai.interactions.create({
          model: 'gemini-3.5-transcribe',
          input: [
            {
              type: 'audio',
              data: cleanedBase64,
              mime_type: safeMimeType,
            },
            {
              type: 'text',
              text: instruction,
            },
          ],
        }),
        45000
      );

      res.json({
        transcript: (interaction.output_text ?? '').trim(),
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 6. Text-to-Video Story Trailer / Scene Visualizer via WaveSpeedAI API v3 (Wan series)
  // Supports 15-30s talking trailers with mood-driven motions, asynchronous polling under
  // Vercel's 60s timeout, and Range-clamped MP4 streaming under the 4.5MB payload ceiling.
  const ALLOWED_VIDEO_DURATIONS = new Set<VideoDurationOption>(['6s', '10s', '15s', '20s', '30s']);
  const ALLOWED_VIDEO_MOODS = new Set<VideoMoodPreference>(['auto', 'neutral', 'suspense', 'action', 'storm']);

  app.post('/api/ai/video', aiLimiter, async (req, res) => {
    res.setHeader('X-Video-Provider', 'wavespeed');
    try {
      const { prompt, aspectRatio, duration, storySlug, mood } = req.body as {
        prompt?: string;
        aspectRatio?: '16:9' | '9:16';
        duration?: VideoDurationOption;
        storySlug?: string;
        mood?: VideoMoodPreference;
      };

      const cleanPrompt = String(prompt || '').trim().slice(0, 600);
      if (cleanPrompt.length < 6) {
        res.status(400).json({ error: 'Please describe the video scene in at least 6 characters.' });
        return;
      }

      if (aspectRatio && aspectRatio !== '16:9' && aspectRatio !== '9:16') {
        res.status(400).json({ error: 'Aspect ratio must be either 16:9 or 9:16.' });
        return;
      }

      if (duration && !ALLOWED_VIDEO_DURATIONS.has(duration)) {
        res.status(400).json({ error: 'Duration must be one of 6s, 10s, 15s, 20s, or 30s.' });
        return;
      }

      if (mood && !ALLOWED_VIDEO_MOODS.has(mood)) {
        res.status(400).json({ error: 'Mood must be one of auto, neutral, suspense, action, or storm.' });
        return;
      }

      const safeAspectRatio: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
      const safeDuration: VideoDurationOption = duration && ALLOWED_VIDEO_DURATIONS.has(duration) ? duration : '15s';
      const safeMoodPref: VideoMoodPreference = mood && ALLOWED_VIDEO_MOODS.has(mood) ? mood : 'auto';

      const user = await getAuthenticatedUserAsync(req);
      const story = storySlug
        ? repo.getStoryBySlug(storySlug, { includeUnpublished: user?.role === 'owner' })
        : undefined;
      if (storySlug && !story) {
        res.status(404).json({ error: 'Referenced story was not found.' });
        return;
      }

      const detectedMood = classifyVideoSceneMood(
        `${story ? `${story.title} ${story.genre} ` : ''}${cleanPrompt}`,
        safeMoodPref
      );
      const cinematicInput = buildMoodCinematicPrompt({
        scenePrompt: cleanPrompt,
        storyTitle: story?.title,
        storyGenre: story?.genre,
        mood: detectedMood,
        durationSeconds: parseVideoDurationSeconds(safeDuration),
      });

      const job = await submitWaveSpeedVideoJob(
        {
          prompt: cinematicInput,
          aspectRatio: safeAspectRatio,
          duration: safeDuration,
          mood: detectedMood,
        },
        options?.waveSpeedConfig
      );

      if (job.status === 'completed') {
        res.json({
          provider: 'wavespeed',
          model: job.model,
          mood: job.mood,
          status: 'completed',
          interactionId: job.taskId,
          videoUrl: `/api/ai/video/${encodeURIComponent(job.taskId)}/stream`,
          mimeType: job.mimeType,
          aspectRatio: job.aspectRatio,
          duration: job.duration,
          sizeBytes: job.sizeBytes,
          chunkDownload: job.chunkDownload,
        });
        return;
      }

      res.status(202).json({
        provider: 'wavespeed',
        model: job.model,
        mood: job.mood,
        status: 'in_progress',
        interactionId: job.taskId,
        aspectRatio: job.aspectRatio,
        duration: job.duration,
      });
    } catch (err) {
      const formatted = formatWaveSpeedError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Spoken scene-explainer script + TTS audio synchronized with 15-30s video playback & mood motions
  app.post('/api/ai/video/narration', aiLimiter, async (req, res) => {
    try {
      const { prompt, storySlug, duration, mood, voiceName, useStoryNarration } = req.body as {
        prompt?: string;
        storySlug?: string;
        duration?: VideoDurationOption;
        mood?: VideoMoodPreference;
        voiceName?: string;
        useStoryNarration?: boolean;
      };

      const cleanPrompt = String(prompt || '').trim().slice(0, 600);
      if (cleanPrompt.length < 6) {
        res.status(400).json({ error: 'Please describe the video scene in at least 6 characters.' });
        return;
      }

      const safeDuration: VideoDurationOption =
        duration && ALLOWED_VIDEO_DURATIONS.has(duration) ? duration : '15s';
      const safeMoodPref: VideoMoodPreference =
        mood && ALLOWED_VIDEO_MOODS.has(mood) ? mood : 'auto';
      const durationSeconds = parseVideoDurationSeconds(safeDuration);

      const user = await getAuthenticatedUserAsync(req);
      const story = storySlug
        ? repo.getStoryBySlug(storySlug, { includeUnpublished: user?.role === 'owner' })
        : undefined;
      if (storySlug && !story) {
        res.status(404).json({ error: 'Referenced story was not found.' });
        return;
      }

      const detectedMood: VideoSceneMood = classifyVideoSceneMood(
        `${story ? `${story.title} ${story.genre} ` : ''}${cleanPrompt}`,
        safeMoodPref
      );

      const allowedVoices = new Set(['Kore', 'Charon', 'Puck', 'Zephyr', 'Fenrir']);
      const selectedVoice = voiceName && allowedVoices.has(voiceName) ? voiceName : 'Kore';

      let script =
        useStoryNarration && story?.trailerNarration
          ? story.trailerNarration.trim()
          : buildCleanTrailerNarrationScript({
              scenePrompt: cleanPrompt,
              storyTitle: story?.title,
              storyNarration: story?.trailerNarration,
              mood: detectedMood,
              durationSeconds,
            });
      let audioBase64: string | null = null;
      let mimeType: string | null = null;
      let source: 'gemini-tts' | 'browser-speech-fallback' = 'browser-speech-fallback';

      const targetWords = Math.max(20, Math.min(58, Math.round(durationSeconds * 1.85)));
      const speechStyleByMood: Record<VideoSceneMood, string> = {
        storm: 'Clear, resonant, dramatic cinema trailer narrator speaking with steady diction',
        action: 'Crisp, dynamic, confident literary trailer narrator with clear articulation',
        suspense: 'Low, warm, deliberate, captivating literary narrator with clean pauses',
        neutral: 'Warm, clear, expressive, studio-quality literary audiobook narrator',
      };

      if (process.env.GEMINI_API_KEY?.trim()) {
        const ai = getGeminiClient();

        // Step 1: Try polishing narration script with Gemini text model, but NEVER let text-model
        // load or latency skip TTS audio synthesis below.
        if (!(useStoryNarration && story?.trailerNarration)) {
          try {
          const scriptRes = await withTimeout(
            ai.models.generateContent({
              model: MODEL_NAME,
              contents: `Write one concise, natural spoken book-trailer voiceover (about ${targetWords} words total, paced calmly for a ${durationSeconds}-second trailer). Summarize the core plot hook from the premise below without spoiling the ending so listeners want to read the full story, and ALWAYS end with a short invitation to read it on Lorethos (for example: "Read ${story ? story.title : 'the full story'} now on Lorethos."). Use complete sentences, no stage directions, no brackets, no markdown, and no camera terms.\n\nStory: ${
                story ? `${story.title} (${story.genre})` : 'Lorethos Original'
              }\nPremise: ${cleanPrompt}`,
              config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
            }),
            10000
          );
          const generatedText = scriptRes.text?.trim();
          if (generatedText && generatedText.length >= 20) {
            const cleanedGenerated = generatedText
              .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
              .replace(/\*{1,2}|_{1,2}|`/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            const genWords = cleanedGenerated.split(/\s+/).filter(Boolean);
            let formattedScript = '';
            if (genWords.length > targetWords + 10) {
              const clipped = genWords.slice(0, targetWords).join(' ');
              const lastStop = Math.max(clipped.lastIndexOf('.'), clipped.lastIndexOf('!'), clipped.lastIndexOf('?'));
              formattedScript = lastStop >= Math.floor(clipped.length * 0.5)
                ? clipped.slice(0, lastStop + 1).trim()
                : `${clipped.replace(/[,;:\-–—]+$/, '')}.`;
            } else {
              formattedScript = /[.!?]$/.test(cleanedGenerated) ? cleanedGenerated : `${cleanedGenerated}.`;
            }
            script = ensureLorethosClosing(formattedScript, story?.title);
          }
          } catch (scriptErr) {
            const formatted = formatGeminiError(scriptErr);
            console.warn('[Video Narration Script fallback]', formatted.status, formatted.message);
          }
        }

        // Step 2: Synthesize crisp studio WAV voiceover via Gemini TTS
        try {
          const ttsInteraction = await withTimeout(
            ai.interactions.create({
              model: 'gemini-3.8-flash-lite-tts',
              input: [
                {
                  type: 'text',
                  text: script,
                  annotations: [
                    {
                      type: 'speech_metadata',
                      style: speechStyleByMood[detectedMood],
                    },
                  ],
                },
              ],
              response_format: { type: 'audio' },
              generation_config: {
                speech_config: [
                  {
                    language: 'en-US',
                    voice: selectedVoice,
                  },
                ],
              },
            }),
            30000
          );

          const audioPart = ttsInteraction.output_audio;
          if (audioPart?.data) {
            const normalizedAudio = normalizeTtsWavAudio(audioPart.data, audioPart.mime_type);
            audioBase64 = normalizedAudio.audioBase64;
            mimeType = normalizedAudio.mimeType;
            source = 'gemini-tts';
          }
        } catch (ttsErr) {
          const formatted = formatGeminiError(ttsErr);
          console.warn('[Video Narration TTS fallback]', formatted.status, formatted.message);
        }
      }

      res.json({
        script,
        mood: detectedMood,
        duration: safeDuration,
        voiceName: selectedVoice,
        audioBase64,
        mimeType,
        source,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to prepare scene narration.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/ai/video/:interactionId', videoPollLimiter, async (req, res) => {
    res.setHeader('X-Video-Provider', 'wavespeed');
    try {
      const interactionId = String(req.params.interactionId || '').trim();
      if (!/^[a-zA-Z0-9._:-]{4,200}$/.test(interactionId)) {
        res.status(400).json({ error: 'Invalid video interaction identifier.' });
        return;
      }

      const job = await getWaveSpeedVideoJob(interactionId, options?.waveSpeedConfig);

      if (job.status === 'completed') {
        res.json({
          provider: 'wavespeed',
          status: 'completed',
          interactionId: job.taskId,
          videoUrl: `/api/ai/video/${encodeURIComponent(job.taskId)}/stream`,
          mimeType: job.mimeType || 'video/mp4',
          sizeBytes: job.sizeBytes ?? null,
          chunkDownload: Boolean(job.chunkDownload),
        });
        return;
      }

      res.json({
        provider: 'wavespeed',
        status: 'in_progress',
        interactionId: job.taskId,
      });
    } catch (err) {
      const formatted = formatWaveSpeedError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/ai/video/:interactionId/stream', videoPollLimiter, async (req, res) => {
    res.setHeader('X-Video-Provider', 'wavespeed');
    try {
      const interactionId = String(req.params.interactionId || '').trim();
      if (!/^[a-zA-Z0-9._:-]{4,200}$/.test(interactionId)) {
        res.status(400).json({ error: 'Invalid video interaction identifier.' });
        return;
      }

      const streamRes = await streamWaveSpeedVideoAsset(
        interactionId,
        req.headers.range,
        options?.waveSpeedConfig
      );

      res.status(streamRes.status);
      res.setHeader('Content-Type', streamRes.mimeType);
      res.setHeader('Accept-Ranges', 'bytes');
      if (streamRes.contentRange) {
        res.setHeader('Content-Range', streamRes.contentRange);
      }
      res.setHeader('Content-Length', String(streamRes.contentLength));
      res.setHeader('Content-Disposition', 'inline; filename="lorethos-trailer.mp4"');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(streamRes.body);
    } catch (err) {
      const formatted = formatWaveSpeedError(err);
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
      const isExcludedFile = (name: string) =>
        name === '.DS_Store' ||
        name.endsWith('.zip') ||
        (name.startsWith('.env') && name !== '.env.example');

      const addDirToZip = async (dirPath: string, relBase: string) => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (excludedDirs.has(entry.name)) continue;
            const nextAbs = path.join(dirPath, entry.name);
            const nextRel = relBase ? `${relBase}/${entry.name}` : entry.name;
            await addDirToZip(nextAbs, nextRel);
          } else if (entry.isFile()) {
            if (isExcludedFile(entry.name)) continue;
            const absFile = path.join(dirPath, entry.name);
            const zipPath = relBase ? `${relBase}/${entry.name}` : entry.name;
            const content = await fs.readFile(absFile);
            zip.file(zipPath, content);
          }
        }
      };

      await addDirToZip(PROJECT_ROOT, '');
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

  if ((options?.withVite ?? true) && process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled =
      process.env.DISABLE_HMR === 'true' ||
      Boolean(process.env.K_SERVICE && process.env.APPLET_ID);
    const vite = await createViteServer({
      plugins: hmrDisabled
        ? [
            {
              name: 'lorethos-disable-hmr-ws',
              transform(code, id) {
                const cleanId = id.split('?', 1)[0];
                if (
                  cleanId.endsWith('/vite/dist/client/client.mjs') ||
                  cleanId.endsWith('/@vite/client')
                ) {
                  return code.replace(
                    'transport.connect(createHMRHandler(handleMessage));',
                    '/* HMR WebSocket disabled */'
                  );
                }
                return null;
              },
            },
          ]
        : [],
      server: {
        middlewareMode: true,
        port: PORT,
        allowedHosts: true,
        ...(hmrDisabled
          ? { hmr: false, ws: false, watch: null }
          : { ws: options?.httpServer ? { server: options.httpServer } : false }),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(PROJECT_ROOT, 'dist');
    try {
      await fs.access(distPath);
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } catch {
      // Running API-only behind Caddy static web container or Vercel Serverless
      app.get('/', (_req, res) => {
        res.json({ ok: true, service: 'lorethos-api' });
      });
    }
  }

  return app;
}

const isDirectExecution =
  !process.env.LORETHOS_NO_LISTEN &&
  !process.env.VERCEL &&
  !process.env.VERCEL_ENV;
if (isDirectExecution) {
  const httpServer = http.createServer();
  httpServer.on('error', (err) => {
    console.error(`Failed to bind server on ${HOST}:${PORT}:`, err);
    process.exit(1);
  });
  createApp({ withVite: process.env.NODE_ENV !== 'production', httpServer })
    .then((app) => {
      httpServer.on('request', app);
      httpServer.listen(PORT, HOST, () => {
        console.log(`Lorethos server listening on http://${HOST}:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}

