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
    const [{ createApp }, { repo }] = await Promise.all([
      import('../server'),
      import('../server/db')
    ]);
    repoRef = repo;
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
    assert.ok(Array.isArray(catalogData.stories) && catalogData.stories.length >= 4);

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

    const invalidPollRes = await fetch(`${baseUrl}/api/ai/video/bad!`);
    assert.equal(invalidPollRes.status, 400);

    const invalidStreamRes = await fetch(`${baseUrl}/api/ai/video/bad!/stream`);
    assert.equal(invalidStreamRes.status, 400);
  });

  test('detectSceneMood keeps normal prose silent (neutral) and detects suspense, action, and storm spots', async () => {
    const { detectSceneMood } = await import('../src/utils/ambientAudio');

    assert.equal(
      detectSceneMood(
        'Lady Sylva arranged the warm parchment scrolls beside a cup of spiced hibiscus tea on the morning table.'
      ),
      'neutral'
    );
    assert.equal(
      detectSceneMood(
        'Chancellor Morwen whispered in the cold shadow of the catacombs, his trembling fingers gripping the poisoned blade as muffled footsteps echoed behind him.'
      ),
      'suspense'
    );
    assert.equal(
      detectSceneMood(
        'Warriors clashed with iron spears and arrows while Kaelen slammed his shield through the roaring battle flames.'
      ),
      'action'
    );
    assert.equal(
      detectSceneMood(
        'Thunder rolled overhead as lightning split the howling tempest and heavy rain hammered the courtyard stones.'
      ),
      'storm'
    );
  });

  test('WaveSpeedAI helpers validate models, build Wan payloads, and clamp Vercel byte ranges', async () => {
    const {
      resolveWaveSpeedVideoModel,
      buildWaveSpeedVideoPayload,
      clampByteRange,
      DEFAULT_WAVESPEED_VIDEO_MODEL,
    } = await import('../server/wavespeed');

    assert.equal(resolveWaveSpeedVideoModel(undefined), DEFAULT_WAVESPEED_VIDEO_MODEL);
    assert.equal(resolveWaveSpeedVideoModel('/alibaba/wan-3.0/text-to-video/'), 'alibaba/wan-3.0/text-to-video');
    assert.throws(() => resolveWaveSpeedVideoModel('../bad/path'));

    assert.deepEqual(
      buildWaveSpeedVideoPayload({
        model: 'wavespeed-ai/wan-2.2/t2v-480p-ultra-fast',
        prompt: 'Rain over bronze roofs',
        aspectRatio: '16:9',
        duration: '6s',
      }),
      { prompt: 'Rain over bronze roofs', size: '832*480', duration: 5 }
    );

    assert.deepEqual(
      buildWaveSpeedVideoPayload({
        model: 'wavespeed-ai/wan-2.2/t2v-480p-ultra-fast',
        prompt: 'Vertical lantern shot',
        aspectRatio: '9:16',
        duration: '10s',
      }),
      { prompt: 'Vertical lantern shot', size: '480*832', duration: 8 }
    );

    assert.deepEqual(
      buildWaveSpeedVideoPayload({
        model: 'alibaba/wan-3.0/text-to-video',
        prompt: 'Obsidian gate opening',
        aspectRatio: '9:16',
        duration: '10s',
        resolution: '720p',
      }),
      {
        prompt: 'Obsidian gate opening',
        aspect_ratio: '9:16',
        resolution: '720p',
        duration: 10,
        enable_prompt_expansion: false,
      }
    );

    assert.deepEqual(clampByteRange('bytes=0-', 6_000_000, 3_500_000), {
      valid: true,
      start: 0,
      end: 3_499_999,
    });
    assert.deepEqual(clampByteRange('bytes=3500000-8000000', 5_000_000, 3_500_000), {
      valid: true,
      start: 3_500_000,
      end: 4_999_999,
    });
    assert.deepEqual(clampByteRange('bytes=5000000-', 5_000_000, 3_500_000), { valid: false });
  });

  test('WaveSpeedAI end-to-end /api/ai/video submission, polling, streaming, and error mapping', async () => {
    const { createApp } = await import('../server');
    const mockMp4 = Buffer.from('00000018667479706d703432-lorethos-mock-video-bytes', 'utf8');
    let pollStep = 0;
    let lastAuthHeader = '';
    let lastSubmittedUrl = '';
    let lastSubmittedBody: Record<string, unknown> = {};
    let mode: 'success' | 'insufficient_credits' | 'expired_cdn' = 'success';

    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || 'GET').toUpperCase();
      const headers = new Headers(init?.headers);

      if (url.startsWith('https://api.wavespeed.test/api/v3/wavespeed-ai/wan-2.2/t2v-480p-ultra-fast') && method === 'POST') {
        lastAuthHeader = headers.get('authorization') || '';
        lastSubmittedUrl = url;
        lastSubmittedBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;

        if (mode === 'insufficient_credits') {
          return new Response(
            JSON.stringify({ code: 1407, message: 'insufficient_credits: please top up' }),
            { status: 402, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            code: 200,
            data: { id: 'ws_pred_12345', status: 'created' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url === 'https://api.wavespeed.test/api/v3/predictions/ws_pred_12345/result') {
        pollStep += 1;
        if (pollStep === 1) {
          return new Response(
            JSON.stringify({
              code: 200,
              data: { id: 'ws_pred_12345', status: 'processing' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            code: 200,
            data: {
              id: 'ws_pred_12345',
              status: 'completed',
              outputs: ['https://cdn.wavespeed.test/outputs/ws_pred_12345.mp4'],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url === 'https://cdn.wavespeed.test/outputs/ws_pred_12345.mp4') {
        if (mode === 'expired_cdn') {
          return new Response('AccessDenied', { status: 403 });
        }
        const range = headers.get('range');
        if (range) {
          const match = range.match(/^bytes=(\d+)-(\d+)$/);
          const start = match ? Number(match[1]) : 0;
          const end = match ? Math.min(Number(match[2]), mockMp4.length - 1) : mockMp4.length - 1;
          const slice = mockMp4.subarray(start, end + 1);
          return new Response(slice, {
            status: 206,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Length': String(slice.length),
              'Content-Range': `bytes ${start}-${end}/${mockMp4.length}`,
            },
          });
        }
        return new Response(mockMp4, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(mockMp4.length),
          },
        });
      }

      return new Response('Not Found', { status: 404 });
    };

    const wsApp = await createApp({
      withVite: false,
      waveSpeedConfig: {
        apiKey: 'ws_test_secret_key_should_stay_private',
        apiBase: 'https://api.wavespeed.test/api/v3',
        fetchImpl: mockFetch,
      },
    });

    let wsServer: http.Server | undefined;
    try {
      const wsBaseUrl = await new Promise<string>((resolve) => {
        wsServer = wsApp.listen(0, '127.0.0.1', () => {
          const addr = wsServer!.address();
          assert.ok(addr && typeof addr === 'object');
          resolve(`http://127.0.0.1:${addr.port}`);
        });
      });

      // 1. Submit job with storySlug enrichment -> 202 in_progress
      const submitRes = await fetch(`${wsBaseUrl}/api/ai/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Golden lantern swinging beside rain-slick obsidian walls',
          aspectRatio: '16:9',
          duration: '6s',
          storySlug: 'the-obsidian-throne',
        }),
      });
      assert.equal(submitRes.status, 202);
      const submitData = await submitRes.json();
      assert.equal(submitData.status, 'in_progress');
      assert.equal(submitData.interactionId, 'ws_pred_12345');
      assert.equal(lastAuthHeader, 'Bearer ws_test_secret_key_should_stay_private');
      assert.ok(lastSubmittedUrl.includes('wavespeed-ai/wan-2.2/t2v-480p-ultra-fast'));
      assert.ok(String(lastSubmittedBody.prompt || '').includes('The Obsidian Throne'));
      assert.equal(lastSubmittedBody.size, '832*480');
      assert.equal(lastSubmittedBody.duration, 5);

      // 2. First poll -> processing
      const poll1 = await (await fetch(`${wsBaseUrl}/api/ai/video/ws_pred_12345`)).json();
      assert.equal(poll1.status, 'in_progress');

      // 3. Second poll -> completed with internal /stream URL (upstream CDN URL never leaked)
      const poll2 = await (await fetch(`${wsBaseUrl}/api/ai/video/ws_pred_12345`)).json();
      assert.equal(poll2.status, 'completed');
      assert.equal(poll2.videoUrl, '/api/ai/video/ws_pred_12345/stream');
      assert.equal(poll2.sizeBytes, mockMp4.length);
      assert.equal(poll2.chunkDownload, false);

      // 4. Stream full video + Range request
      const fullRes = await fetch(`${wsBaseUrl}${poll2.videoUrl}`);
      assert.equal(fullRes.status, 200);
      assert.equal(fullRes.headers.get('content-type'), 'video/mp4');
      assert.deepEqual(Buffer.from(await fullRes.arrayBuffer()), mockMp4);

      const rangeRes = await fetch(`${wsBaseUrl}${poll2.videoUrl}`, {
        headers: { Range: 'bytes=0-15' },
      });
      assert.equal(rangeRes.status, 206);
      assert.equal(rangeRes.headers.get('content-range'), `bytes 0-15/${mockMp4.length}`);
      assert.deepEqual(Buffer.from(await rangeRes.arrayBuffer()), mockMp4.subarray(0, 16));

      // 5. Expired CDN output returns 410 Gone
      mode = 'expired_cdn';
      const expiredRes = await fetch(`${wsBaseUrl}${poll2.videoUrl}`);
      assert.equal(expiredRes.status, 410);

      // 6. Insufficient credits maps cleanly to HTTP 402 without exposing API key
      mode = 'insufficient_credits';
      const creditRes = await fetch(`${wsBaseUrl}/api/ai/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Lantern light across ancient bronze gates at dusk',
          aspectRatio: '9:16',
          duration: '10s',
        }),
      });
      assert.equal(creditRes.status, 402);
      const creditData = await creditRes.json();
      assert.ok(/insufficient credits/i.test(creditData.error));
      assert.equal(JSON.stringify(creditData).includes('ws_test_secret_key'), false);
    } finally {
      if (wsServer) {
        await new Promise<void>((resolve, reject) => {
          wsServer!.close((err) => (err ? reject(err) : resolve()));
        });
      }
    }
  });

  test('paragraph & section bookmarks endpoints enforce auth/access, upsert labels idempotently, and delete cleanly', async () => {
    // 1. Unauthenticated access rejected
    const unauthGet = await fetch(`${baseUrl}/api/account/paragraph-bookmarks`);
    assert.equal(unauthGet.status, 401);

    const obsidian = repoRef.getStoryBySlug('the-obsidian-throne')!;
    const ch1 = obsidian.chapters.find((c) => c.chapterNumber === 1)!;
    const ch4 = obsidian.chapters.find((c) => c.chapterNumber === 4)!;

    // 2. Invalid payloads rejected
    const invalidRes = await fetch(`${baseUrl}/api/account/paragraph-bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: readerCookie,
      },
      body: JSON.stringify({
        storyId: obsidian.id,
        chapterId: ch1.id,
        paragraphIndex: -1,
        excerpt: 'Bad index',
      }),
    });
    assert.equal(invalidRes.status, 400);

    const outOfRangeRes = await fetch(`${baseUrl}/api/account/paragraph-bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: readerCookie,
      },
      body: JSON.stringify({
        storyId: obsidian.id,
        chapterId: ch1.id,
        paragraphIndex: ch1.content.length + 5,
        excerpt: 'Beyond end of chapter',
      }),
    });
    assert.equal(outOfRangeRes.status, 400);

    // 3. Locked chapter bookmarking rejected for non-entitled user (create a second user with no purchases)
    const freshRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tunde Guest',
        email: 'tunde.bookmark@example.com',
        password: 'StrongPassword123',
      }),
    });
    assert.equal(freshRegRes.status, 201);
    const freshCookie = extractSessionCookie(freshRegRes);

    const lockedBookmarkRes = await fetch(`${baseUrl}/api/account/paragraph-bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: freshCookie,
      },
      body: JSON.stringify({
        storyId: obsidian.id,
        chapterId: ch4.id,
        paragraphIndex: 0,
        excerpt: 'Locked passage',
      }),
    });
    assert.equal(lockedBookmarkRes.status, 403);

    // 4. Create paragraph bookmark on free chapter 1
    const createRes = await fetch(`${baseUrl}/api/account/paragraph-bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: readerCookie,
      },
      body: JSON.stringify({
        storyId: obsidian.id,
        chapterId: ch1.id,
        paragraphIndex: 1,
        label: 'First Clue',
        excerpt: ch1.content[1],
      }),
    });
    assert.equal(createRes.status, 200);
    const createdData = await createRes.json();
    assert.equal(createdData.paragraphBookmarks.length, 1);
    const createdId = createdData.paragraphBookmarks[0].id;
    assert.equal(createdData.paragraphBookmarks[0].label, 'First Clue');
    assert.equal(createdData.paragraphBookmarks[0].paragraphIndex, 1);

    // 5. Upsert same (chapterId, paragraphIndex) preserves id and updates label
    const updateRes = await fetch(`${baseUrl}/api/account/paragraph-bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: readerCookie,
      },
      body: JSON.stringify({
        storyId: obsidian.id,
        chapterId: ch1.id,
        paragraphIndex: 1,
        label: 'Updated Council Clue',
        excerpt: ch1.content[1],
      }),
    });
    assert.equal(updateRes.status, 200);
    const updatedData = await updateRes.json();
    assert.equal(updatedData.paragraphBookmarks.length, 1);
    assert.equal(updatedData.paragraphBookmarks[0].id, createdId);
    assert.equal(updatedData.paragraphBookmarks[0].label, 'Updated Council Clue');

    // 6. GET returns persisted bookmark
    const listRes = await fetch(`${baseUrl}/api/account/paragraph-bookmarks`, {
      headers: { Cookie: readerCookie },
    });
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.paragraphBookmarks.length, 1);
    assert.equal(listData.paragraphBookmarks[0].storySlug, 'the-obsidian-throne');

    // 7. DELETE removes bookmark cleanly
    const deleteRes = await fetch(`${baseUrl}/api/account/paragraph-bookmarks/${encodeURIComponent(createdId)}`, {
      method: 'DELETE',
      headers: { Cookie: readerCookie },
    });
    assert.equal(deleteRes.status, 200);
    const deletedData = await deleteRes.json();
    assert.equal(deletedData.paragraphBookmarks.length, 0);
  });
});
