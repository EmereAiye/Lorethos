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
    assert.equal(data.videoProvider, 'wavespeed');
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

  test('WaveSpeedAI helpers validate models, build Wan 15-30s audio payloads, classify moods, and clamp byte ranges', async () => {
    const {
      resolveWaveSpeedVideoModel,
      buildWaveSpeedVideoPayload,
      classifyVideoSceneMood,
      buildMoodCinematicPrompt,
      clampByteRange,
      DEFAULT_WAVESPEED_VIDEO_MODEL,
    } = await import('../server/wavespeed');

    assert.equal(DEFAULT_WAVESPEED_VIDEO_MODEL, 'alibaba/wan-3.0/text-to-video');
    assert.equal(resolveWaveSpeedVideoModel(undefined), 'alibaba/wan-3.0/text-to-video');
    assert.equal(resolveWaveSpeedVideoModel('/alibaba/wan-2.6/text-to-video/'), 'alibaba/wan-2.6/text-to-video');
    assert.throws(() => resolveWaveSpeedVideoModel('../bad/path'));

    assert.deepEqual(
      buildWaveSpeedVideoPayload({
        model: 'alibaba/wan-3.0/text-to-video',
        prompt: 'Obsidian gate opening in storm rain',
        aspectRatio: '16:9',
        duration: '20s',
        resolution: '480p',
      }),
      {
        prompt: 'Obsidian gate opening in storm rain',
        aspect_ratio: '16:9',
        resolution: '480p',
        duration: 20,
        generate_audio: true,
        enable_prompt_expansion: true,
      }
    );

    assert.deepEqual(
      buildWaveSpeedVideoPayload({
        model: 'alibaba/wan-3.0/text-to-video',
        prompt: 'Vertical lantern shot',
        aspectRatio: '9:16',
        duration: '30s',
        resolution: '720p',
      }),
      {
        prompt: 'Vertical lantern shot',
        aspect_ratio: '9:16',
        resolution: '720p',
        duration: 30,
        generate_audio: true,
        enable_prompt_expansion: true,
      }
    );

    assert.deepEqual(
      buildWaveSpeedVideoPayload({
        model: 'alibaba/wan-2.6/text-to-video',
        prompt: 'Rain over bronze roofs',
        aspectRatio: '16:9',
        duration: '15s',
        resolution: '720p',
      }),
      {
        prompt: 'Rain over bronze roofs',
        size: '1280*720',
        duration: 15,
        shot_type: 'multi',
        enable_prompt_expansion: true,
      }
    );

    assert.deepEqual(
      buildWaveSpeedVideoPayload({
        model: 'wavespeed-ai/wan-2.2/t2v-480p-ultra-fast',
        prompt: 'Quick preview shot',
        aspectRatio: '9:16',
        duration: '15s',
      }),
      { prompt: 'Quick preview shot', size: '480*832', duration: 8 }
    );

    assert.equal(classifyVideoSceneMood('Lightning and thunder over storm rain'), 'storm');
    assert.equal(classifyVideoSceneMood('Shadow whispers in the dark catacombs'), 'suspense');
    assert.equal(classifyVideoSceneMood('Swords clash in blazing battle fire'), 'action');
    assert.ok(
      buildMoodCinematicPrompt({
        scenePrompt: 'Lantern lit courtyard',
        storyTitle: 'The Obsidian Throne',
        mood: 'suspense',
        durationSeconds: 20,
      }).includes('creeping steadicam glide')
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

  test('WaveSpeedAI end-to-end /api/ai/video 15-30s talking trailer, polling, streaming, narration, and error mapping', async () => {
    const { createApp } = await import('../server');
    const mockMp4 = Buffer.from('00000018667479706d703432-lorethos-mock-video-bytes', 'utf8');
    let pollStep = 0;
    let lastAuthHeader = '';
    let lastSubmittedUrl = '';
    let lastSubmittedBody: Record<string, unknown> = {};
    let mode: 'success' | 'insufficient_credits' | 'rate_limited' | 'expired_cdn' = 'success';

    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || 'GET').toUpperCase();
      const headers = new Headers(init?.headers);

      if (url.startsWith('https://api.wavespeed.test/api/v3/alibaba/wan-3.0/text-to-video') && method === 'POST') {
        lastAuthHeader = headers.get('authorization') || '';
        lastSubmittedUrl = url;
        lastSubmittedBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;

        if (mode === 'insufficient_credits') {
          return new Response(
            JSON.stringify({ code: 1407, message: 'insufficient_credits: please top up' }),
            { status: 402, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (mode === 'rate_limited') {
          return new Response(
            JSON.stringify({ code: 429, message: 'Too many requests to WaveSpeedAI' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
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

      // 1. Submit 20s storm/talking job with storySlug enrichment -> 202 in_progress
      const submitRes = await fetch(`${wsBaseUrl}/api/ai/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Golden lantern swinging beside rain-slick obsidian walls during thunder and storm',
          aspectRatio: '16:9',
          duration: '20s',
          storySlug: 'the-obsidian-throne',
          mood: 'auto',
        }),
      });
      assert.equal(submitRes.status, 202);
      assert.equal(submitRes.headers.get('x-video-provider'), 'wavespeed');
      const submitData = await submitRes.json();
      assert.equal(submitData.status, 'in_progress');
      assert.equal(submitData.provider, 'wavespeed');
      assert.equal(submitData.mood, 'storm');
      assert.equal(submitData.interactionId, 'ws_pred_12345');
      assert.equal(lastAuthHeader, 'Bearer ws_test_secret_key_should_stay_private');
      assert.ok(lastSubmittedUrl.includes('alibaba/wan-3.0/text-to-video'));
      assert.ok(String(lastSubmittedBody.prompt || '').includes('The Obsidian Throne'));
      assert.ok(String(lastSubmittedBody.prompt || '').includes('no distorted voices'));
      assert.equal(lastSubmittedBody.aspect_ratio, '16:9');
      assert.equal(lastSubmittedBody.duration, 20);
      assert.equal(lastSubmittedBody.generate_audio, true);

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

      // 4b. Narration explainer endpoint builds spoken script + mood without failing if Gemini TTS is unavailable
      const narrationRes = await fetch(`${wsBaseUrl}/api/ai/video/narration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Golden lantern swinging beside rain-slick obsidian walls during storm thunder',
          storySlug: 'the-obsidian-throne',
          duration: '20s',
          mood: 'auto',
          voiceName: 'Charon',
        }),
      });
      assert.equal(narrationRes.status, 200);
      const narrationData = await narrationRes.json();
      assert.equal(narrationData.mood, 'storm');
      assert.equal(narrationData.voiceName, 'Charon');
      assert.ok(typeof narrationData.script === 'string' && narrationData.script.length > 30);
      assert.match(narrationData.script, /[.!?]$/);

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
          duration: '30s',
        }),
      });
      assert.equal(creditRes.status, 402);
      assert.equal(creditRes.headers.get('x-video-provider'), 'wavespeed');
      const creditData = await creditRes.json();
      assert.ok(/insufficient credits/i.test(creditData.error));
      assert.equal(JSON.stringify(creditData).includes('ws_test_secret_key'), false);

      // 7. WaveSpeedAI 429 maps to WaveSpeedAI rate-limit error (never Gemini billing error)
      mode = 'rate_limited';
      const rateLimitRes = await fetch(`${wsBaseUrl}/api/ai/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Bronze palace gates under storm clouds at dusk',
          aspectRatio: '16:9',
          duration: '15s',
        }),
      });
      assert.equal(rateLimitRes.status, 429);
      assert.equal(rateLimitRes.headers.get('x-video-provider'), 'wavespeed');
      const rateLimitData = await rateLimitRes.json();
      assert.match(rateLimitData.error, /WaveSpeedAI rate limit reached/i);
      assert.doesNotMatch(rateLimitData.error, /Settings > Secrets/i);
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

  test('registration persists nickname, exposes it on auth/session/comments, and allows deleting own nickname comment', async () => {
    const shortNickRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tunde Scribe',
        nickname: 'A',
        email: 'short.nick@example.com',
        password: 'StrongPassword123',
      }),
    });
    assert.equal(shortNickRes.status, 400);

    const nickRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tunde Bakare',
        nickname: 'BronzeScribe',
        email: 'tunde.nick@example.com',
        password: 'StrongPassword123',
      }),
    });
    assert.equal(nickRegRes.status, 201);
    const nickCookie = extractSessionCookie(nickRegRes);
    const nickRegData = await nickRegRes.json();
    assert.equal(nickRegData.user.name, 'Tunde Bakare');
    assert.equal(nickRegData.user.nickname, 'BronzeScribe');

    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: nickCookie },
    });
    assert.equal(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.equal(sessionData.user.nickname, 'BronzeScribe');

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tunde.nick@example.com',
        password: 'StrongPassword123',
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.user.nickname, 'BronzeScribe');

    // Posting a comment displays the user's nickname
    const catalogRes = await fetch(`${baseUrl}/api/stories`);
    const catalogData = await catalogRes.json();
    const firstStory = catalogData.stories[0];
    const firstChapter = firstStory.chapters[0];

    const commentRes = await fetch(`${baseUrl}/api/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: nickCookie,
      },
      body: JSON.stringify({
        storyId: firstStory.id,
        chapterId: firstChapter.id,
        tag: 'Lore',
        body: 'The bronze watchtower scene is atmospheric.',
      }),
    });
    assert.equal(commentRes.status, 201);
    const commentData = await commentRes.json();
    assert.equal(commentData.comment.authorName, 'BronzeScribe');

    // User can delete their own nickname-authored comment
    const delCommentRes = await fetch(`${baseUrl}/api/comments/${encodeURIComponent(commentData.comment.id)}`, {
      method: 'DELETE',
      headers: { Cookie: nickCookie },
    });
    assert.equal(delCommentRes.status, 200);
  });

  test('getDisplayName and computeReaderRank map completed chapters across all 6 literary tiers', async () => {
    const { getDisplayName, computeReaderRank } = await import('../src/utils/readerProfile');
    const { AUTHORITATIVE_STORIES } = await import('../server/catalog');

    assert.equal(getDisplayName({ name: 'Tunde Bakare', nickname: 'BronzeScribe' }), 'BronzeScribe');
    assert.equal(getDisplayName({ name: 'Tunde Bakare', nickname: '   ' }), 'Tunde Bakare');
    assert.equal(getDisplayName({ name: '' }), 'Reader');

    const baseUser = {
      id: 'usr_rank_test',
      name: 'Tunde Bakare',
      nickname: 'BronzeScribe',
      email: 'rank@example.com',
      role: 'reader' as const,
      subscription: { plan: 'free' as const, status: 'none' as const, amountNgn: 0 },
      unlockedStoryIds: [],
      bookmarkedChapterIds: [],
      readingProgress: {},
      readingGoal: {
        frequency: 'daily' as const,
        targetChapters: 2,
        currentProgress: 0,
        streakDays: 0,
        bestStreakDays: 0,
        lastUpdatedDate: '2026-01-01',
        completedChapterIds: [] as string[],
        history: [],
      },
    };

    const rank0 = computeReaderRank(baseUser, AUTHORITATIVE_STORIES);
    assert.equal(rank0.roman, 'I');
    assert.equal(rank0.title, 'Novice Wanderer');
    assert.equal(rank0.nextTitle, 'Page Seeker');
    assert.equal(rank0.remainingToNext, 2);

    const rank2 = computeReaderRank(
      {
        ...baseUser,
        readingGoal: { ...baseUser.readingGoal, completedChapterIds: ['c1'] },
        readingProgress: {
          [AUTHORITATIVE_STORIES[0].id]: {
            chapterId: 'c2',
            chapterNumber: 1,
            progressPercent: 98,
            lastReadAt: '2026-01-01T00:00:00.000Z',
          },
        },
      },
      AUTHORITATIVE_STORIES
    );
    assert.equal(rank2.completedChapters, 2);
    assert.equal(rank2.roman, 'II');
    assert.equal(rank2.title, 'Page Seeker');

    const mkIds = (count: number) => Array.from({ length: count }, (_, idx) => `ch_${idx + 1}`);
    assert.equal(
      computeReaderRank({ ...baseUser, readingGoal: { ...baseUser.readingGoal, completedChapterIds: mkIds(5) } }, AUTHORITATIVE_STORIES).roman,
      'III'
    );
    assert.equal(
      computeReaderRank({ ...baseUser, readingGoal: { ...baseUser.readingGoal, completedChapterIds: mkIds(10) } }, AUTHORITATIVE_STORIES).roman,
      'IV'
    );
    assert.equal(
      computeReaderRank({ ...baseUser, readingGoal: { ...baseUser.readingGoal, completedChapterIds: mkIds(18) } }, AUTHORITATIVE_STORIES).roman,
      'V'
    );
    const rankMax = computeReaderRank(
      { ...baseUser, readingGoal: { ...baseUser.readingGoal, completedChapterIds: mkIds(30) } },
      AUTHORITATIVE_STORIES
    );
    assert.equal(rankMax.roman, 'VI');
    assert.equal(rankMax.title, 'Grand Lorekeeper');
    assert.equal(rankMax.nextTitle, null);
    assert.equal(rankMax.progressToNextPercent, 100);
  });

  test('every existing catalog story includes an official unified narrated trailer video with AAC audio on disk', async () => {
    const { execFileSync } = await import('node:child_process');
    const res = await fetch(`${baseUrl}/api/stories`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const expectedSlugs = [
      'the-obsidian-throne',
      'whisper-of-the-baobab',
      'chronicles-of-the-sunken-epoch',
      'the-crimson-scribe',
      'verses-of-the-harmattan',
      'letters-across-the-lagoon',
    ];

    for (const slug of expectedSlugs) {
      const story = data.stories.find((s: { slug: string }) => s.slug === slug);
      assert.ok(story, `Expected story ${slug} in catalog`);
      assert.equal(story.trailerVideoUrl, `/assets/trailers/${slug}.mp4`);
      assert.equal(story.trailerPosterUrl, `/assets/images/trailers/${slug}.jpg`);
      assert.equal(story.trailerDuration, '21s', `Expected 21s duration on ${slug}`);
      assert.ok(story.trailerNarration && story.trailerNarration.length > 30, `Expected trailerNarration on ${slug}`);
      assert.match(story.trailerNarration, /\bLorethos\b/i, `Expected Lorethos CTA in trailerNarration on ${slug}`);

      const videoFile = path.join(process.cwd(), 'public', story.trailerVideoUrl);
      const videoStat = await fs.stat(videoFile);
      assert.ok(videoStat.size > 100_000, `Expected playable unified MP4 trailer file for ${slug}`);

      const probeJson = execFileSync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'stream=codec_type,codec_name,channels,sample_rate:format=duration',
        '-of', 'json',
        videoFile,
      ]).toString();
      const probe = JSON.parse(probeJson) as {
        streams?: Array<{ codec_type?: string; codec_name?: string; channels?: number; sample_rate?: string }>;
        format?: { duration?: string };
      };
      const videoStream = probe.streams?.find((st) => st.codec_type === 'video');
      const audioStream = probe.streams?.find((st) => st.codec_type === 'audio');
      assert.ok(videoStream, `Expected video stream in ${slug} trailer`);
      assert.ok(audioStream, `Expected audio stream in ${slug} trailer`);
      assert.equal(audioStream.codec_name, 'aac');
      assert.equal(audioStream.channels, 2);
      assert.equal(audioStream.sample_rate, '44100');
      assert.ok(Number(probe.format?.duration || 0) >= 15, `Expected unified trailer >= 15s for ${slug}`);

      const posterStat = await fs.stat(path.join(process.cwd(), 'public', story.trailerPosterUrl));
      assert.ok(posterStat.size > 10_000, `Expected poster image file for ${slug}`);
    }
  });

  test('readingTime utilities compute chapter reading time from word count and story average word count', async () => {
    const {
      AVERAGE_READING_WPM,
      calculateReadingTimeMinutes,
      estimateChapterReadingTime,
      summarizeStoryReadingTime,
    } = await import('../src/utils/readingTime');

    assert.equal(AVERAGE_READING_WPM, 250);
    assert.equal(calculateReadingTimeMinutes(2500), 10);
    assert.equal(calculateReadingTimeMinutes(420), 2);
    assert.equal(calculateReadingTimeMinutes(100), 1);
    // Falls back to story average word count when a draft chapter has 0 words
    assert.equal(calculateReadingTimeMinutes(0, 1500), 6);

    const summary = summarizeStoryReadingTime([
      { wordCount: 2500, content: [], excerpt: '' },
      { wordCount: 3000, content: [], excerpt: '' },
      { wordCount: 2000, content: [], excerpt: '' },
    ]);
    assert.equal(summary.chapterCount, 3);
    assert.equal(summary.totalWordCount, 7500);
    assert.equal(summary.averageWordCount, 2500);
    assert.equal(summary.averageChapterMinutes, 10);
    assert.equal(summary.totalStoryMinutes, 30);

    const draftEstimate = estimateChapterReadingTime(
      { wordCount: 0, content: [], excerpt: '' },
      summary.averageWordCount
    );
    assert.equal(draftEstimate.usedAverageFallback, true);
    assert.equal(draftEstimate.wordCount, 2500);
    assert.equal(draftEstimate.estimatedMinutes, 10);
  });

  test('readingStats computes total reading time, chapters finished, and genres explored', async () => {
    const { computeUserReadingStats, formatReadingDuration } = await import('../src/utils/readingStats');
    const { AUTHORITATIVE_STORIES } = await import('../server/catalog');

    assert.equal(formatReadingDuration(0), '0 min');
    assert.equal(formatReadingDuration(45), '45 min');
    assert.equal(formatReadingDuration(60), '1 hr');
    assert.equal(formatReadingDuration(95), '1h 35m');

    const obsidian = AUTHORITATIVE_STORIES[0];
    const baobab = AUTHORITATIVE_STORIES[1];

    const stats = computeUserReadingStats(
      {
        id: 'usr_stats_test',
        name: 'Amina Reader',
        nickname: 'AminaInk',
        email: 'amina@example.com',
        role: 'reader',
        subscription: { plan: 'free', status: 'none', amountNgn: 0 },
        unlockedStoryIds: [obsidian.id],
        bookmarkedChapterIds: [],
        readingProgress: {
          [obsidian.id]: {
            chapterId: obsidian.chapters[1].id,
            chapterNumber: 2,
            progressPercent: 50,
            lastReadAt: '2026-11-18T12:00:00.000Z',
          },
          [baobab.id]: {
            chapterId: baobab.chapters[0].id,
            chapterNumber: 1,
            progressPercent: 100,
            lastReadAt: '2026-11-18T14:00:00.000Z',
          },
        },
        readingGoal: {
          frequency: 'daily',
          targetChapters: 2,
          currentProgress: 2,
          streakDays: 3,
          bestStreakDays: 5,
          lastUpdatedDate: '2026-11-18',
          completedChapterIds: [obsidian.chapters[0].id],
          history: [
            { dayName: 'Tue', dateStr: 'Nov 17', chaptersRead: 1, metTarget: false },
            { dayName: 'Wed', dateStr: 'Nov 18', chaptersRead: 2, metTarget: true },
          ],
        },
      },
      AUTHORITATIVE_STORIES
    );

    // Ch1 of Obsidian (2450w -> 10m) + Ch1 of Baobab (2800w -> 11m) + 50% of Ch2 Obsidian (3100w -> 12m * 0.5 = 6m)
    assert.equal(stats.chaptersFinished, 2);
    assert.equal(stats.chaptersInProgress, 1);
    assert.equal(stats.totalMinutesRead, 27);
    assert.equal(stats.formattedTotalTime, '27 min');
    assert.equal(stats.genresExploredCount, 2);
    assert.equal(stats.topGenre, 'Epic Fantasy');
    assert.equal(stats.dailyActivity.length, 2);
    assert.equal(stats.dailyActivity[1].isToday, true);
    assert.equal(stats.dailyActivity[1].chaptersFinished, 2);
    assert.ok(stats.dailyActivity[1].minutesRead > 0);
  });

  test('NarrativeAudioMiddleware debounces rapid paragraph scrolling and gates updates on significant intensity changes', async () => {
    const { NarrativeAudioMiddleware, toSceneMood } = await import('../src/utils/narrativeAudioMiddleware');

    const paragraphs = [
      'The courtyard sat quietly in warm afternoon sunlight while merchants folded linen.',
      'A gentle breeze carried spices across the harbor wall.',
      'Suddenly a cold blade pierced the shadow behind the throne as blood, poison, and betrayal echoed in silence!',
      'Still watching in darkness, the assassin crept through the cold shadow with venom and dread!',
      'Tempest and lightning thundered across the courtyard while the storm raged!'
    ];

    const middleware = new NarrativeAudioMiddleware();
    const applied: Array<{ index: number; mood: string; intensity: number; sceneMood: string }> = [];

    const trigger = (index: number, minIntensityDelta = 0.24) => {
      middleware.evaluate(paragraphs, index, {
        enabled: true,
        debounceMs: 60,
        minIntensityDelta,
        cooldownMs: 20,
        onApply: (analysis) => {
          applied.push({
            index: analysis.paragraphIndex,
            mood: analysis.mood,
            intensity: analysis.intensity,
            sceneMood: toSceneMood(analysis, paragraphs[analysis.paragraphIndex]),
          });
        },
      });
    };

    // Rapid scrolling through paragraphs 0 -> 1 -> 2 must debounce to only paragraph 2
    trigger(0);
    trigger(1);
    trigger(2);
    assert.equal(applied.length, 0, 'Rapid updates must not fire synchronously before debounce settles');

    await new Promise((r) => setTimeout(r, 110));
    assert.equal(applied.length, 1, 'Only settled paragraph should trigger a soundtrack update');
    assert.equal(applied[0].index, 2);
    assert.equal(applied[0].mood, 'tense');
    assert.equal(applied[0].sceneMood, 'suspense');

    // Moving to paragraph 3 (also high-intensity tense with tiny delta) should NOT re-trigger soundtrack transition
    trigger(3, 0.28);
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(applied.length, 1, 'Minor intensity change below threshold must not trigger transition');

    // Moving back to calm paragraph 0 represents a major intensity drop and must transition to neutral
    trigger(0, 0.24);
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(applied.length, 2, 'Significant drop in narrative intensity must transition back to calm/neutral');
    assert.equal(applied[1].mood, 'calm');
    assert.equal(applied[1].sceneMood, 'neutral');

    // Moving to storm paragraph 4 transitions into storm SceneMood
    trigger(4, 0.24);
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(applied.length, 3);
    assert.equal(applied[2].sceneMood, 'storm');

    // Calling dispose cancels pending evaluation
    trigger(0, 0.24);
    middleware.dispose();
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(applied.length, 3, 'Disposing middleware cancels pending debounced soundtrack update');
  });

  test('highlights API supports multiple span annotations per paragraph, PATCH editing, entitlement checks, and deletion', async () => {
    // 1. Unauthenticated requests rejected
    const unauthGet = await fetch(`${baseUrl}/api/account/highlights`);
    assert.equal(unauthGet.status, 401);
    const unauthPost = await fetch(`${baseUrl}/api/account/highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: 'x', chapterId: 'y', paragraphIndex: 0, excerpt: 'hi' }),
    });
    assert.equal(unauthPost.status, 401);

    // 2. Register a clean reader with no paid unlocks
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kemi Annotator',
        nickname: 'KemiNotes',
        email: 'kemi.notes@example.com',
        password: 'StrongPassword123',
      }),
    });
    assert.equal(regRes.status, 201);
    const cookie = extractSessionCookie(regRes);

    const obsidian = repoRef.getStoryBySlug('the-obsidian-throne')!;
    const ch1 = obsidian.chapters.find((c) => c.chapterNumber === 1)!;
    const ch4 = obsidian.chapters.find((c) => c.chapterNumber === 4)!;
    const para0 = ch1.content[0];

    // 3. Locked chapter highlight blocked (403)
    const lockedRes = await fetch(`${baseUrl}/api/account/highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        storyId: obsidian.id,
        chapterId: ch4.id,
        paragraphIndex: 0,
        excerpt: 'Locked passage',
        color: 'gold',
      }),
    });
    assert.equal(lockedRes.status, 403);

    // 4. Two distinct span highlights inside the SAME paragraph 0
    const spanAStart = 0;
    const spanAEnd = Math.min(24, para0.length);
    const spanAText = para0.slice(spanAStart, spanAEnd);

    const spanBStart = Math.min(30, Math.max(spanAEnd + 1, Math.floor(para0.length / 2)));
    const spanBEnd = Math.min(para0.length, spanBStart + 25);
    const spanBText = para0.slice(spanBStart, spanBEnd);

    const post1 = await fetch(`${baseUrl}/api/account/highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        storyId: obsidian.id,
        chapterId: ch1.id,
        paragraphIndex: 0,
        excerpt: para0,
        selectedText: spanAText,
        startOffset: spanAStart,
        endOffset: spanAEnd,
        note: 'Opening atmospheric motif',
        color: 'terracotta',
      }),
    });
    assert.equal(post1.status, 200);
    const data1 = await post1.json();
    assert.equal(data1.highlights.length, 1);
    const hl1 = data1.highlights[0];
    assert.equal(hl1.selectedText, spanAText);
    assert.equal(hl1.startOffset, spanAStart);
    assert.equal(hl1.endOffset, spanAEnd);
    assert.equal(hl1.note, 'Opening atmospheric motif');

    const post2 = await fetch(`${baseUrl}/api/account/highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        storyId: obsidian.id,
        chapterId: ch1.id,
        paragraphIndex: 0,
        excerpt: para0,
        selectedText: spanBText,
        startOffset: spanBStart,
        endOffset: spanBEnd,
        color: 'gold',
      }),
    });
    assert.equal(post2.status, 200);
    const data2 = await post2.json();
    assert.equal(data2.highlights.length, 2, 'Multiple span highlights in one paragraph must coexist');
    const hl2 = data2.highlights.find((h: { id: string }) => h.id !== hl1.id);
    assert.ok(hl2);

    // 5. PATCH updates note & color cleanly
    const patchRes = await fetch(`${baseUrl}/api/account/highlights/${encodeURIComponent(hl2.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        note: 'Revisited this symbol during chapter review',
        color: 'sage',
      }),
    });
    assert.equal(patchRes.status, 200);
    const patched = await patchRes.json();
    const updatedHl2 = patched.highlights.find((h: { id: string }) => h.id === hl2.id);
    assert.equal(updatedHl2.note, 'Revisited this symbol during chapter review');
    assert.equal(updatedHl2.color, 'sage');
    assert.ok(updatedHl2.updatedAt);

    // 6. Unknown highlight PATCH returns 404
    const missingPatch = await fetch(`${baseUrl}/api/account/highlights/nonexistent_hl`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ note: 'Test' }),
    });
    assert.equal(missingPatch.status, 404);

    // 7. DELETE removes only the targeted span highlight
    const delRes = await fetch(`${baseUrl}/api/account/highlights/${encodeURIComponent(hl1.id)}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    assert.equal(delRes.status, 200);
    const afterDel = await delRes.json();
    assert.equal(afterDel.highlights.length, 1);
    assert.equal(afterDel.highlights[0].id, hl2.id);
  });

  test('highlightSpans utilities trim selections cleanly and resolve non-overlapping paragraph segments', async () => {
    const { computeTrimmedSelectionOffsets, resolveParagraphHighlightSegments } = await import('../src/utils/highlightSpans');

    const text = 'Under the blackened eclipse, ancient bronze tablets whispered in silence.';
    // Select ' blackened eclipse, ' -> indices 9..29
    const trimmed = computeTrimmedSelectionOffsets(text, 9, 29);
    assert.deepEqual(trimmed, {
      selectedText: 'blackened eclipse,',
      startOffset: 10,
      endOffset: 28,
    });

    const segments = resolveParagraphHighlightSegments(text, [
      {
        id: 'hl_a',
        storyId: 's1',
        storySlug: 's1',
        storyTitle: 'S1',
        chapterId: 'c1',
        chapterNumber: 1,
        chapterTitle: 'C1',
        paragraphIndex: 0,
        excerpt: text,
        selectedText: 'blackened eclipse',
        startOffset: 10,
        endOffset: 27,
        color: 'terracotta',
        createdAt: '2026-11-19',
      },
      {
        id: 'hl_b',
        storyId: 's1',
        storySlug: 's1',
        storyTitle: 'S1',
        chapterId: 'c1',
        chapterNumber: 1,
        chapterTitle: 'C1',
        paragraphIndex: 0,
        excerpt: text,
        selectedText: 'ancient bronze',
        startOffset: 29,
        endOffset: 43,
        color: 'gold',
        note: 'Key artifact',
        createdAt: '2026-11-19',
      },
    ]);

    assert.equal(segments.map((s) => s.text).join(''), text);
    const marked = segments.filter((s) => Boolean(s.highlight));
    assert.equal(marked.length, 2);
    assert.equal(marked[0].text, 'blackened eclipse');
    assert.equal(marked[1].text, 'ancient bronze');
  });

  test('story likes endpoints require authentication, persist likes per user, and toggle cleanly', async () => {
    const storyId = 'story-obsidian-throne';

    // 1. Unauthenticated POST is rejected with 401
    const unauthLikeRes = await fetch(`${baseUrl}/api/stories/${storyId}/like`, {
      method: 'POST',
    });
    assert.equal(unauthLikeRes.status, 401);

    // 2. Register two readers to verify per-user like counts
    const regA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Like Reader One',
        email: `like.reader.one.${Date.now()}@example.com`,
        password: 'StrongPassword123',
      }),
    });
    assert.equal(regA.status, 201);
    const cookieA = extractSessionCookie(regA);

    const regB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Like Reader Two',
        email: `like.reader.two.${Date.now()}@example.com`,
        password: 'StrongPassword123',
      }),
    });
    assert.equal(regB.status, 201);
    const cookieB = extractSessionCookie(regB);

    // 3. Reader A likes story -> count 1, liked true
    const likeARes = await fetch(`${baseUrl}/api/stories/${storyId}/like`, {
      method: 'POST',
      headers: { Cookie: cookieA },
    });
    assert.equal(likeARes.status, 200);
    const likeAData = await likeARes.json();
    assert.equal(likeAData.liked, true);
    assert.equal(likeAData.count, 1);

    // 4. Reader B likes story -> count 2, liked true
    const likeBRes = await fetch(`${baseUrl}/api/stories/${storyId}/like`, {
      method: 'POST',
      headers: { Cookie: cookieB },
    });
    assert.equal(likeBRes.status, 200);
    const likeBData = await likeBRes.json();
    assert.equal(likeBData.liked, true);
    assert.equal(likeBData.count, 2);

    // 5. GET /api/stories/likes reflects counts and current user's liked state
    const getARes = await fetch(`${baseUrl}/api/stories/likes?storyIds=${storyId}`, {
      headers: { Cookie: cookieA },
    });
    assert.equal(getARes.status, 200);
    const getAData = await getARes.json();
    assert.equal(getAData.counts[storyId], 2);
    assert.deepEqual(getAData.likedStoryIds, [storyId]);

    // 6. Reader A unlikes story -> count 1, liked false
    const unlikeARes = await fetch(`${baseUrl}/api/stories/${storyId}/like`, {
      method: 'POST',
      headers: { Cookie: cookieA },
    });
    assert.equal(unlikeARes.status, 200);
    const unlikeAData = await unlikeARes.json();
    assert.equal(unlikeAData.liked, false);
    assert.equal(unlikeAData.count, 1);
  });

  test('profile endpoint validates inputs, updates nickname/bio/preset & gallery avatar, and persists in session', async () => {
    // 1. Unauthenticated PATCH returns 401
    const unauthRes = await fetch(`${baseUrl}/api/account/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'GuestEdit' }),
    });
    assert.equal(unauthRes.status, 401);

    // 2. Register clean user
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sade Adeyemi',
        email: `sade.profile.${Date.now()}@example.com`,
        password: 'StrongPassword123',
      }),
    });
    assert.equal(regRes.status, 201);
    const cookie = extractSessionCookie(regRes);

    // 3. Reject invalid inputs (short nickname, unsafe avatar protocol, oversized bio)
    const badNickRes = await fetch(`${baseUrl}/api/account/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ nickname: 'X' }),
    });
    assert.equal(badNickRes.status, 400);

    const badAvatarRes = await fetch(`${baseUrl}/api/account/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ avatar: 'javascript:alert(1)' }),
    });
    assert.equal(badAvatarRes.status, 400);

    const badSvgRes = await fetch(`${baseUrl}/api/account/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ avatar: 'data:image/svg+xml;base64,PHN2Zz4=' }),
    });
    assert.equal(badSvgRes.status, 400);

    const badBioRes = await fetch(`${baseUrl}/api/account/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ bio: 'a'.repeat(201) }),
    });
    assert.equal(badBioRes.status, 400);

    // 4. Valid update with preset avatar, nickname, name, and bio
    const presetUpdateRes = await fetch(`${baseUrl}/api/account/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: 'Sade Oladipo',
        nickname: 'MoonlitKeeper',
        bio: 'Collector of bronze-age chronicles and twilight verse.',
        avatar: '/assets/avatar_moonlit_reader.jpg',
      }),
    });
    assert.equal(presetUpdateRes.status, 200);
    const presetData = await presetUpdateRes.json();
    assert.equal(presetData.user.name, 'Sade Oladipo');
    assert.equal(presetData.user.nickname, 'MoonlitKeeper');
    assert.equal(presetData.user.bio, 'Collector of bronze-age chronicles and twilight verse.');
    assert.equal(presetData.user.avatar, '/assets/avatar_moonlit_reader.jpg');

    // 5. Valid update with base64 gallery image
    const sampleDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==';
    const galleryRes = await fetch(`${baseUrl}/api/account/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ avatar: sampleDataUrl }),
    });
    assert.equal(galleryRes.status, 200);
    const galleryData = await galleryRes.json();
    assert.equal(galleryData.user.avatar, sampleDataUrl);

    // 6. Session endpoint returns updated profile fields
    const sessRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: cookie },
    });
    assert.equal(sessRes.status, 200);
    const sessData = await sessRes.json();
    assert.equal(sessData.user.nickname, 'MoonlitKeeper');
    assert.equal(sessData.user.avatar, sampleDataUrl);

    // 7. Clearing avatar sets avatar to undefined
    const clearRes = await fetch(`${baseUrl}/api/account/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ avatar: null }),
    });
    assert.equal(clearRes.status, 200);
    const clearData = await clearRes.json();
    assert.equal(clearData.user.avatar, undefined);
  });

  test('writer role helpers authorize writer, owner, and admin case-insensitively and deny reader/null', async () => {
    const {
      normalizeWriterRole,
      canAccessWriterStudio,
      isWriterStudioAdmin,
    } = await import('../src/lib/writerStories');

    assert.equal(normalizeWriterRole('Writer'), 'writer');
    assert.equal(normalizeWriterRole('  OWNER  '), 'owner');
    assert.equal(normalizeWriterRole('Admin'), 'admin');
    assert.equal(normalizeWriterRole('reader'), 'reader');
    assert.equal(normalizeWriterRole(null), 'reader');

    assert.equal(canAccessWriterStudio('writer'), true);
    assert.equal(canAccessWriterStudio('Writer'), true);
    assert.equal(canAccessWriterStudio('owner'), true);
    assert.equal(canAccessWriterStudio('OWNER'), true);
    assert.equal(canAccessWriterStudio('admin'), true);
    assert.equal(canAccessWriterStudio(' Admin '), true);
    assert.equal(canAccessWriterStudio('reader'), false);
    assert.equal(canAccessWriterStudio(''), false);
    assert.equal(canAccessWriterStudio(null), false);
    assert.equal(canAccessWriterStudio(undefined), false);

    assert.equal(isWriterStudioAdmin('owner'), true);
    assert.equal(isWriterStudioAdmin('ADMIN'), true);
    assert.equal(isWriterStudioAdmin('writer'), false);
    assert.equal(isWriterStudioAdmin('reader'), false);
  });

  test('evaluateReaderAchievements unlocks Night Owl, Speed Reader, Completionist, and supporting badges from reading history', async () => {
    const { evaluateReaderAchievements } = await import('../src/utils/readerAchievements');
    const { AUTHORITATIVE_STORIES } = await import('../server/catalog');

    const baseUser = {
      id: 'usr_achievements_test',
      name: 'Kemi Adeyemi',
      nickname: 'LanternReader',
      email: 'kemi@example.com',
      role: 'reader' as const,
      subscription: { plan: 'free' as const, status: 'none' as const, amountNgn: 0 },
      unlockedStoryIds: [],
      bookmarkedChapterIds: ['bm1', 'bm2'],
      readingProgress: {
        [AUTHORITATIVE_STORIES[0].id]: {
          chapterId: AUTHORITATIVE_STORIES[0].chapters[0].id,
          chapterNumber: 1,
          progressPercent: 100,
          lastReadAt: new Date(2026, 2, 10, 23, 30, 0).toISOString(), // 11:30 PM local -> Night Owl
        },
        [AUTHORITATIVE_STORIES[1].id]: {
          chapterId: AUTHORITATIVE_STORIES[1].chapters[0].id,
          chapterNumber: 1,
          progressPercent: 50,
          lastReadAt: new Date(2026, 2, 10, 14, 0, 0).toISOString(),
        },
        [AUTHORITATIVE_STORIES[2].id]: {
          chapterId: AUTHORITATIVE_STORIES[2].chapters[0].id,
          chapterNumber: 1,
          progressPercent: 50,
          lastReadAt: new Date(2026, 2, 10, 15, 0, 0).toISOString(),
        },
      },
      readingGoal: {
        frequency: 'daily' as const,
        targetChapters: 2,
        currentProgress: 3,
        streakDays: 3,
        bestStreakDays: 3,
        lastUpdatedDate: '2026-03-10',
        completedChapterIds: AUTHORITATIVE_STORIES[0].chapters.map((c) => c.id),
        history: [
          {
            dayName: 'Tue',
            dateStr: 'Mar 10',
            dateIso: '2026-03-10',
            chaptersRead: 3,
            metTarget: true,
          },
        ],
      },
    };

    const freshUser = {
      ...baseUser,
      bookmarkedChapterIds: [],
      readingProgress: {},
      readingGoal: {
        ...baseUser.readingGoal,
        currentProgress: 0,
        streakDays: 0,
        bestStreakDays: 0,
        completedChapterIds: [],
        history: [],
      },
    };

    const lockedBadges = evaluateReaderAchievements(freshUser, AUTHORITATIVE_STORIES, {
      telemetry: { nightReadCount: 0, fastCompletionCount: 0 },
      highlightsCount: 0,
      paragraphBookmarksCount: 0,
    });
    assert.equal(lockedBadges.length, 8);
    assert.equal(lockedBadges.every((b) => !b.unlocked), true);

    const unlockedBadges = evaluateReaderAchievements(baseUser, AUTHORITATIVE_STORIES, {
      telemetry: { nightReadCount: 0, fastCompletionCount: 0 },
      highlightsCount: 1,
      paragraphBookmarksCount: 0,
    });
    const byId = Object.fromEntries(unlockedBadges.map((b) => [b.id, b]));
    assert.equal(byId['first-chapter'].unlocked, true);
    assert.equal(byId['chapter-collector'].unlocked, true);
    assert.equal(byId['night-owl'].unlocked, true);
    assert.equal(byId['speed-reader'].unlocked, true);
    assert.equal(byId['completionist'].unlocked, true);
    assert.equal(byId['flame-keeper'].unlocked, true);
    assert.equal(byId['genre-explorer'].unlocked, true);
    assert.equal(byId['archivist'].unlocked, true);
  });
});




