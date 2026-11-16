import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const TEST_DATA_FILE = path.join('/tmp', `lorethos-test-${process.pid}-${Date.now()}.json`);
const OWNER_EMAIL = 'Emmymasterwise@gmail.com';
const TEST_WEBHOOK_SECRET = 'test-paystack-webhook-secret-only';

process.env.LORETHOS_NO_LISTEN = '1';
process.env.LORETHOS_DATA_FILE = TEST_DATA_FILE;
process.env.OWNER_EMAIL = OWNER_EMAIL;
process.env.SESSION_SECRET = 'test-session-secret-only';
process.env.PAYSTACK_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

let server: http.Server;
let baseUrl = '';
let repoRef: typeof import('../server/db').repo;
let signSessionTokenRef: typeof import('../server').signSessionToken;
let normalizeVercelRequestUrlRef: typeof import('../api/index').normalizeVercelRequestUrl;

function signPaystackWebhook(payload: unknown): string {
  const raw = JSON.stringify(payload);
  return crypto.createHmac('sha512', TEST_WEBHOOK_SECRET).update(raw).digest('hex');
}

function extractSessionCookie(res: Response): string {
  const rawSetCookie = res.headers.get('set-cookie');
  assert.ok(rawSetCookie, 'Expected Set-Cookie header on auth response');
  return rawSetCookie.split(';')[0];
}

describe('Lorethos API Security & Workflow Release Gates', () => {
  let readerCookie = '';
  let readerUserId = '';
  let ownerCookie = '';
  let draftStoryId = '';
  let draftStorySlug = '';

  before(async () => {
    const [{ createApp, signSessionToken }, { repo }, { normalizeVercelRequestUrl }] = await Promise.all([
      import('../server'),
      import('../server/db'),
      import('../api/index')
    ]);
    repoRef = repo;
    signSessionTokenRef = signSessionToken;
    normalizeVercelRequestUrlRef = normalizeVercelRequestUrl;
    const app = await createApp({ withVite: false });
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        assert.ok(addr && typeof addr === 'object');
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await fs.rm(TEST_DATA_FILE, { force: true }).catch(() => {});
  });

  test('health check returns ok status without throwing', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.ok(data.db === 'postgres' || data.db === 'local-store');
  });

  test('public catalog strips locked chapter prose and rejects unauthenticated premium chapter reads', async () => {
    const catalogRes = await fetch(`${baseUrl}/api/stories`);
    assert.equal(catalogRes.status, 200);
    const catalogData = await catalogRes.json();
    assert.ok(Array.isArray(catalogData.stories) && catalogData.stories.length >= 6);

    const poetrySearchRes = await fetch(`${baseUrl}/api/stories?q=Poetry`);
    assert.equal(poetrySearchRes.status, 200);
    const poetrySearchData = await poetrySearchRes.json();
    assert.ok(
      poetrySearchData.stories.some((s: { slug: string }) => s.slug === 'verses-of-the-harmattan'),
      'Expected Poetry search to return Verses of the Harmattan'
    );

    const authorSearchRes = await fetch(`${baseUrl}/api/stories?q=Tunde`);
    assert.equal(authorSearchRes.status, 200);
    const authorSearchData = await authorSearchRes.json();
    assert.ok(
      authorSearchData.stories.some((s: { slug: string }) => s.slug === 'letters-across-the-lagoon'),
      'Expected author search to return Letters Across the Lagoon'
    );

    const obsidian = catalogData.stories.find((s: { slug: string }) => s.slug === 'the-obsidian-throne');
    assert.ok(obsidian, 'Expected The Obsidian Throne in public catalog');
    const ch4Summary = obsidian.chapters.find((c: { chapterNumber: number }) => c.chapterNumber === 4);
    assert.ok(ch4Summary);
    assert.deepEqual(ch4Summary.content, [], 'Locked chapter prose must be omitted from public catalog');

    const lockedRes = await fetch(`${baseUrl}/api/stories/the-obsidian-throne/chapters/4`);
    assert.equal(lockedRes.status, 403);
    const lockedData = await lockedRes.json();
    assert.equal(lockedData.locked, true);
    assert.deepEqual(lockedData.chapter.content, []);

    const companionRes = await fetch(`${baseUrl}/api/ai/companion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'recap',
        storySlug: 'the-obsidian-throne',
        chapterNumber: 4
      })
    });
    assert.equal(companionRes.status, 403);

    const ttsRes = await fetch(`${baseUrl}/api/ai/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storySlug: 'the-obsidian-throne',
        chapterNumber: 4,
        voiceName: 'Kore'
      })
    });
    assert.equal(ttsRes.status, 403);
  });

  test('standard reader registration cannot escalate to owner or access admin endpoints', async () => {
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Chidi Reader',
        email: 'reader.gate@example.com',
        password: 'StrongPassword123',
        role: 'owner'
      })
    });
    assert.equal(regRes.status, 201);
    readerCookie = extractSessionCookie(regRes);
    const regData = await regRes.json();
    assert.equal(regData.user.role, 'reader');
    readerUserId = regData.user.id;

    const overviewRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Cookie: readerCookie }
    });
    assert.equal(overviewRes.status, 403);

    const createStoryRes = await fetch(`${baseUrl}/api/admin/stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: readerCookie
      },
      body: JSON.stringify({
        title: 'Unauthorized Series',
        synopsis: 'Attempt by non-owner reader account.'
      })
    });
    assert.equal(createStoryRes.status, 403);

    const exportRes = await fetch(`${baseUrl}/api/export-zip`, {
      headers: { Cookie: readerCookie }
    });
    assert.equal(exportRes.status, 403);
  });

  test('owner draft -> review -> published workflow hides drafts from public readers and exposes after publish', async () => {
    const ownerRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Lorethos Founder',
        email: OWNER_EMAIL,
        password: 'OwnerStrongPassword123'
      })
    });
    assert.equal(ownerRegRes.status, 201);
    ownerCookie = extractSessionCookie(ownerRegRes);
    const ownerData = await ownerRegRes.json();
    assert.equal(ownerData.user.role, 'owner');

    const draftRes = await fetch(`${baseUrl}/api/admin/stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie
      },
      body: JSON.stringify({
        title: 'Chronicle of Benin Bronze',
        synopsis: 'A secluded guild uncovers royal brass prophecies beneath the moat.',
        genre: 'Mythic Fantasy',
        publicationStatus: 'draft',
        accessTier: 'subscription',
        priceNgn: 2500
      })
    });
    assert.equal(draftRes.status, 201);
    const draftPayload = await draftRes.json();
    draftStoryId = draftPayload.story.id;
    draftStorySlug = draftPayload.story.slug;
    assert.equal(draftPayload.story.publicationStatus, 'draft');

    // Public/reader catalog must hide drafts
    const publicCatalog = await (await fetch(`${baseUrl}/api/stories`, {
      headers: { Cookie: readerCookie }
    })).json();
    assert.equal(
      publicCatalog.stories.some((s: { id: string }) => s.id === draftStoryId),
      false,
      'Draft story must not appear in reader catalog'
    );

    const publicDetailRes = await fetch(`${baseUrl}/api/stories/${draftStorySlug}`, {
      headers: { Cookie: readerCookie }
    });
    assert.equal(publicDetailRes.status, 404);

    // Owner sees draft in catalog
    const ownerCatalog = await (await fetch(`${baseUrl}/api/stories`, {
      headers: { Cookie: ownerCookie }
    })).json();
    assert.equal(
      ownerCatalog.stories.some((s: { id: string }) => s.id === draftStoryId),
      true,
      'Owner must see unpublished drafts'
    );

    // Transition review -> still hidden from public
    const reviewRes = await fetch(`${baseUrl}/api/admin/stories/${draftStoryId}/workflow`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie
      },
      body: JSON.stringify({ publicationStatus: 'review' })
    });
    assert.equal(reviewRes.status, 200);
    assert.equal((await reviewRes.json()).story.publicationStatus, 'review');

    const reviewDetailRes = await fetch(`${baseUrl}/api/stories/${draftStorySlug}`);
    assert.equal(reviewDetailRes.status, 404);

    // Publish -> now visible publicly
    const publishRes = await fetch(`${baseUrl}/api/admin/stories/${draftStoryId}/workflow`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie
      },
      body: JSON.stringify({ publicationStatus: 'published' })
    });
    assert.equal(publishRes.status, 200);
    assert.equal((await publishRes.json()).story.publicationStatus, 'published');

    const publishedDetailRes = await fetch(`${baseUrl}/api/stories/${draftStorySlug}`);
    assert.equal(publishedDetailRes.status, 200);
  });

  test('Paystack webhook verifies HMAC signature, blocks underpayment, unlocks idempotently, and grants chapter access', async () => {
    const order = repoRef.createOrder({
      userId: readerUserId,
      customerEmail: 'reader.gate@example.com',
      itemType: 'book_purchase',
      storyId: 'story-obsidian-throne',
      itemName: 'Book Unlock: The Obsidian Throne',
      amountNgn: 2800
    });

    // 1. Missing signature -> 401
    const noSigRes = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'charge.success', data: { reference: order.reference } })
    });
    assert.equal(noSigRes.status, 401);

    // 2. Invalid signature -> 401
    const badSigRes = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': '0'.repeat(128)
      },
      body: JSON.stringify({ event: 'charge.success', data: { reference: order.reference } })
    });
    assert.equal(badSigRes.status, 401);

    // 3. Underpayment rejected without granting entitlement
    const underpayPayload = {
      id: 'evt_underpay_1',
      event: 'charge.success',
      data: {
        id: 101,
        reference: order.reference,
        amount: 500 * 100, // Only 500 NGN instead of 2800 NGN
        currency: 'NGN',
        channel: 'card'
      }
    };
    const underpayRes = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': signPaystackWebhook(underpayPayload)
      },
      body: JSON.stringify(underpayPayload)
    });
    assert.equal(underpayRes.status, 200);
    const readerBefore = repoRef.getUserById(readerUserId)!;
    assert.equal(readerBefore.unlockedStoryIds.includes('story-obsidian-throne'), false);

    // 4. Valid signature & full amount fulfills order and grants access to Ch. 4
    const validPayload = {
      id: 'evt_valid_1',
      event: 'charge.success',
      data: {
        id: 102,
        reference: order.reference,
        amount: 2800 * 100,
        currency: 'NGN',
        channel: 'bank_transfer'
      }
    };
    const validRes = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': signPaystackWebhook(validPayload)
      },
      body: JSON.stringify(validPayload)
    });
    assert.equal(validRes.status, 200);

    // Replay same event ID -> remains idempotent
    const replayRes = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': signPaystackWebhook(validPayload)
      },
      body: JSON.stringify(validPayload)
    });
    assert.equal(replayRes.status, 200);

    const readerAfter = repoRef.getUserById(readerUserId)!;
    assert.equal(
      readerAfter.unlockedStoryIds.filter((id) => id === 'story-obsidian-throne').length,
      1,
      'Book unlock must be granted exactly once even on webhook replay'
    );

    const unlockedChapterRes = await fetch(`${baseUrl}/api/stories/the-obsidian-throne/chapters/4`, {
      headers: { Cookie: readerCookie }
    });
    assert.equal(unlockedChapterRes.status, 200);
    const unlockedData = await unlockedChapterRes.json();
    assert.equal(unlockedData.locked, false);
    assert.ok(unlockedData.chapter.content.length > 0);
  });

  test('community inquiry endpoint validates fields, absorbs honeypot bots, and records valid messages', async () => {
    const invalidRes = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'A',
        email: 'not-an-email',
        subject: 'Hi',
        message: 'short'
      })
    });
    assert.equal(invalidRes.status, 400);

    const honeypotRes = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Spam Bot',
        email: 'bot@example.com',
        subject: 'Automated Pitch',
        message: 'Buy backlinks now from our automated service.',
        website: 'https://spam.example'
      })
    });
    assert.equal(honeypotRes.status, 400);

    const validRes = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Adaobi Okafor',
        email: 'adaobi@example.com',
        inquiryType: 'Editorial',
        subject: 'Manuscript Query from Abuja',
        message: 'Hello Lorethos team, I would love to discuss submitting a serialized Yoruba-futurism novella.'
      })
    });
    assert.equal(validRes.status, 201);
    const validData = await validRes.json();
    assert.ok(validData.referenceId.startsWith('INQ-'));
    assert.equal(repoRef.getAdminOverview().inquiries.length, 1);
  });

  test('audio transcription and video generation endpoints validate inputs and enforce draft visibility', async () => {
    const emptyAudioRes = await fetch(`${baseUrl}/api/ai/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64: '', mimeType: 'audio/webm' })
    });
    assert.equal(emptyAudioRes.status, 400);

    const shortVideoPromptRes = await fetch(`${baseUrl}/api/ai/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Hi', aspectRatio: '16:9' })
    });
    assert.equal(shortVideoPromptRes.status, 400);

    const invalidAspectRes = await fetch(`${baseUrl}/api/ai/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Lantern light across ancient stone steps in midnight mist',
        aspectRatio: '4:3'
      })
    });
    assert.equal(invalidAspectRes.status, 400);
  });

  test('Vercel API URL normalizer preserves subpaths and query parameters', () => {
    assert.equal(
      normalizeVercelRequestUrlRef('/api/index?__vercel_path=auth/login'),
      '/api/auth/login'
    );
    assert.equal(
      normalizeVercelRequestUrlRef('/api/index?__vercel_path=stories&q=Poetry&genre=Poetry'),
      '/api/stories?q=Poetry&genre=Poetry'
    );
    assert.equal(
      normalizeVercelRequestUrlRef('/api/index?__vercel_path=/auth/session'),
      '/api/auth/session'
    );
    assert.equal(
      normalizeVercelRequestUrlRef('/api/index?__vercel_path='),
      '/api'
    );
    assert.equal(normalizeVercelRequestUrlRef('/api/health'), '/api/health');
  });

  test('signed Bearer token rehydrates session safely on cold serverless instance and enforces owner email role', async () => {
    const forgedOwnerToken = signSessionTokenRef({
      id: 'usr_cold_lambda_reader',
      name: 'Cold Lambda Reader',
      email: 'cold.lambda@example.com',
      role: 'owner'
    });

    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Authorization: `Bearer ${forgedOwnerToken}` }
    });
    assert.equal(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.equal(sessionData.authenticated, true);
    assert.equal(sessionData.user.id, 'usr_cold_lambda_reader');
    assert.equal(sessionData.user.email, 'cold.lambda@example.com');
    assert.equal(
      sessionData.user.role,
      'reader',
      'Cold token hydration must verify owner status against server OWNER_EMAIL'
    );
  });

  test('user genre preferences require auth, persist to profile, and return across session reload', async () => {
    const unauthRes = await fetch(`${baseUrl}/api/account/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredGenres: ['Poetry'] })
    });
    assert.equal(unauthRes.status, 401);

    const saveRes = await fetch(`${baseUrl}/api/account/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: readerCookie
      },
      body: JSON.stringify({
        preferredGenres: ['Poetry', '  Literary Fiction ', 'Poetry', 'Mythological Realism']
      })
    });
    assert.equal(saveRes.status, 200);
    const saveData = await saveRes.json();
    assert.deepEqual(saveData.preferredGenres, ['Poetry', 'Literary Fiction', 'Mythological Realism']);
    assert.deepEqual(saveData.user.preferredGenres, ['Poetry', 'Literary Fiction', 'Mythological Realism']);

    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: readerCookie }
    });
    assert.equal(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.deepEqual(
      sessionData.user.preferredGenres,
      ['Poetry', 'Literary Fiction', 'Mythological Realism']
    );
  });

  test('narrative audio middleware debounces rapid scrolls and triggers transitions only on significant mood or intensity shifts', async () => {
    const { NarrativeAudioMiddleware } = await import('../src/utils/narrativeAudioMiddleware');
    const middleware = new NarrativeAudioMiddleware();
    const applied: Array<{ mood: string; intensity: number; paragraphIndex: number }> = [];

    const chapterParagraphs = [
      'Morning light drifted over the quiet wooden library table.',
      'Another quiet page turned while afternoon tea cooled beside the linen curtain.',
      'Suddenly dark shadows crept across the blade and poison stained the cipher trap in dread!',
      'A cold dagger gleamed in the dark shadow as footsteps whispered.',
      'Suddenly flames erupted, thundered, crashed, clashed, and arrows surged in tempest fury!!'
    ];

    // 1. Immediate calm baseline
    middleware.evaluate(chapterParagraphs, 0, {
      enabled: true,
      immediate: true,
      onApply: (a) => applied.push({ mood: a.mood, intensity: a.intensity, paragraphIndex: a.paragraphIndex })
    });
    assert.equal(applied.length, 1);
    assert.equal(applied[0].mood, 'calm');

    // 2. Rapidly scroll through paragraph 2 -> settle on paragraph 1 (calm, insignificant change)
    middleware.evaluate(chapterParagraphs, 2, {
      enabled: true,
      debounceMs: 40,
      minIntensityDelta: 0.22,
      onApply: (a) => applied.push({ mood: a.mood, intensity: a.intensity, paragraphIndex: a.paragraphIndex })
    });
    middleware.evaluate(chapterParagraphs, 1, {
      enabled: true,
      debounceMs: 40,
      minIntensityDelta: 0.22,
      onApply: (a) => applied.push({ mood: a.mood, intensity: a.intensity, paragraphIndex: a.paragraphIndex })
    });

    await new Promise((r) => setTimeout(r, 75));
    assert.equal(
      applied.length,
      1,
      'Debounced scroll across neutral paragraphs must not trigger redundant soundtrack updates'
    );

    // 3. Settle on intense action paragraph (significant jump in mood & intensity)
    middleware.evaluate(chapterParagraphs, 4, {
      enabled: true,
      debounceMs: 40,
      minIntensityDelta: 0.22,
      cooldownMs: 0,
      onApply: (a) => applied.push({ mood: a.mood, intensity: a.intensity, paragraphIndex: a.paragraphIndex })
    });
    await new Promise((r) => setTimeout(r, 75));
    assert.equal(applied.length, 2);
    assert.equal(applied[1].mood, 'action');
    assert.ok(applied[1].intensity >= 0.7);

    middleware.dispose();
  });

  test('auth endpoints return accurate 4xx errors on malformed/duplicate/invalid inputs and redirect sanitizer blocks external URLs', async () => {
    const emptyRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST'
    });
    assert.equal(emptyRegRes.status, 400);
    const emptyRegJson = await emptyRegRes.json();
    assert.ok(emptyRegJson.error);

    const emptyLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST'
    });
    assert.equal(emptyLoginRes.status, 400);
    const emptyLoginJson = await emptyLoginRes.json();
    assert.ok(emptyLoginJson.error);

    const dupRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: 'reader.gate@example.com',
        password: 'StrongPassword123'
      })
    });
    assert.equal(dupRegRes.status, 409);

    const badPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'reader.gate@example.com',
        password: 'WrongPassword123'
      })
    });
    assert.equal(badPassRes.status, 401);

    const validLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'READER.GATE@example.com',
        password: 'StrongPassword123'
      })
    });
    assert.equal(validLoginRes.status, 200);
    const validLoginJson = await validLoginRes.json();
    assert.ok(validLoginJson.token);
    assert.equal(validLoginJson.user.email, 'reader.gate@example.com');

    const missingSbTokenRes = await fetch(`${baseUrl}/api/auth/supabase-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(missingSbTokenRes.status, 400);

    const { sanitizeInternalRedirect, buildHref } = await import('../src/context/AppContext');
    assert.equal(sanitizeInternalRedirect('/pricing'), '/pricing');
    assert.equal(sanitizeInternalRedirect('/stories/the-obsidian-throne/chapters/4'), '/stories/the-obsidian-throne/chapters/4');
    assert.equal(sanitizeInternalRedirect('//evil.com'), null);
    assert.equal(sanitizeInternalRedirect('https://evil.com/phish'), null);
    assert.equal(sanitizeInternalRedirect('/account'), null);
    assert.equal(buildHref('account', { redirect: '/pricing' }), '/account?redirect=%2Fpricing');
    assert.equal(buildHref('account', { redirect: 'https://evil.com' }), '/account');
  });
});

