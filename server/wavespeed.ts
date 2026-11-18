export const WAVESPEED_API_BASE = 'https://api.wavespeed.ai/api/v3';
export const DEFAULT_WAVESPEED_VIDEO_MODEL = 'alibaba/wan-3.0/text-to-video';
export const VERCEL_SAFE_CHUNK_BYTES = 3_500_000;
export const CHUNK_DOWNLOAD_THRESHOLD_BYTES = 3_800_000;

export type VideoAspectRatio = '16:9' | '9:16';
export type VideoDurationOption = '6s' | '10s' | '15s' | '20s' | '30s';
export type VideoSceneMood = 'neutral' | 'suspense' | 'action' | 'storm';
export type VideoMoodPreference = 'auto' | VideoSceneMood;

export interface WaveSpeedConfig {
  apiKey?: string;
  apiBase?: string;
  model?: string;
  resolution?: '480p' | '720p';
  fetchImpl?: typeof fetch;
}

export interface WaveSpeedPredictionData {
  id?: string;
  model?: string;
  status?: string;
  outputs?: unknown[];
  urls?: { get?: string };
  error?: string | null;
  has_nsfw_contents?: boolean[];
}

export interface WaveSpeedEnvelope {
  code?: number;
  message?: string;
  error?: string;
  data?: WaveSpeedPredictionData;
}

export interface WaveSpeedSubmitResult {
  status: 'completed' | 'in_progress';
  taskId: string;
  aspectRatio: VideoAspectRatio;
  duration: VideoDurationOption;
  model: string;
  mood: VideoSceneMood;
  mimeType: string;
  sizeBytes: number | null;
  chunkDownload: boolean;
}

export interface WaveSpeedPollResult {
  status: 'completed' | 'in_progress';
  taskId: string;
  outputUrl?: string;
  mimeType?: string;
  sizeBytes?: number | null;
  chunkDownload?: boolean;
}

export interface WaveSpeedStreamResult {
  status: 200 | 206;
  body: Buffer;
  mimeType: string;
  contentLength: number;
  contentRange?: string;
}

export class WaveSpeedApiError extends Error {
  status: number;
  code?: string | number;
  upstreamDetail?: string;

  constructor(status: number, message: string, code?: string | number, upstreamDetail?: string) {
    super(message);
    this.name = 'WaveSpeedApiError';
    this.status = status;
    this.code = code;
    this.upstreamDetail = upstreamDetail;
  }
}

export function sanitizeWaveSpeedText(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/\b(ws|sk|pk|AIza)[A-Za-z0-9_-]{12,}\b/g, '[redacted]')
    .replace(/\b[a-f0-9]{40,}\b/gi, '[redacted]')
    .trim();
}

export function parseVideoDurationSeconds(duration: VideoDurationOption): number {
  switch (duration) {
    case '6s':
      return 6;
    case '10s':
      return 10;
    case '15s':
      return 15;
    case '20s':
      return 20;
    case '30s':
      return 30;
    default:
      return 15;
  }
}

const MOOD_SUSPENSE_RE = /\b(suspense|whisper|shadow|ghost|blood|dread|ominous|crept|heartbeat|blade|dagger|poison|trap|secret|forbidden|catacomb|eerie|dark|midnight|eclipse|silence|fear|footsteps|tomb|crypt)\b/gi;
const MOOD_ACTION_RE = /\b(sword|spear|arrow|strike|struck|slam|shatter|roar|charge|sprint|battle|clash|combat|attack|fire|flame|blaze|explode|pursuit|chase)\b/gi;
const MOOD_STORM_RE = /\b(storm|tempest|hurricane|lightning|thunder|rain|downpour|gale|wind|monsoon)\b/gi;

export function classifyVideoSceneMood(text: string, preferredMood?: VideoMoodPreference): VideoSceneMood {
  if (preferredMood && preferredMood !== 'auto') {
    return preferredMood;
  }
  const clean = String(text || '').trim();
  if (!clean) return 'neutral';

  const suspenseHits = clean.match(MOOD_SUSPENSE_RE)?.length ?? 0;
  const actionHits = clean.match(MOOD_ACTION_RE)?.length ?? 0;
  const stormHits = clean.match(MOOD_STORM_RE)?.length ?? 0;

  if (actionHits >= 2 && actionHits >= suspenseHits && actionHits >= stormHits) {
    return 'action';
  }
  if (stormHits >= 2 && stormHits > suspenseHits) {
    return 'storm';
  }
  if (suspenseHits >= 2) {
    return 'suspense';
  }
  if (stormHits === 1 && actionHits === 0) return 'storm';
  if (actionHits === 1 && suspenseHits === 0) return 'action';
  if (suspenseHits === 1) return 'suspense';
  return 'neutral';
}

export function buildMoodCinematicPrompt(options: {
  scenePrompt: string;
  storyTitle?: string;
  storyGenre?: string;
  mood: VideoSceneMood;
  durationSeconds: number;
}): string {
  const { scenePrompt, storyTitle, storyGenre, mood, durationSeconds } = options;

  const moodMotionCue: Record<VideoSceneMood, string> = {
    storm:
      'Mood & camera motion: tempestuous sweeping crane pull-back, wind-whipped rain, lightning flashes, urgent dolly push-in; synchronized audible rolling thunder, rain ambience, and expressive spoken storytelling voiceover explaining the scene.',
    action:
      'Mood & camera motion: kinetic low-angle tracking shot, dynamic whip-pans, flying embers and crisp swift movement; synchronized audible dramatic percussion impacts and urgent spoken narrator explanation.',
    suspense:
      'Mood & camera motion: slow creeping steadicam glide, shifting chiaroscuro shadows, tense atmospheric close-up; subtle low heartbeat pulse and hushed, expressive spoken voiceover explaining the hidden tension.',
    neutral:
      'Mood & camera motion: fluid cinematic crane reveal, gentle golden-hour light drift, expressive character movement; warm audible atmospheric soundscape and clear spoken narrator voiceover explaining the scene.',
  };

  const storyLead = storyTitle
    ? `Literary scene trailer (${durationSeconds}s) for "${storyTitle}"${storyGenre ? ` (${storyGenre})` : ''}: `
    : `Cinematic story trailer (${durationSeconds}s): `;

  return `${storyLead}${scenePrompt}. ${moodMotionCue[mood]}`.slice(0, 1200);
}

export function getWaveSpeedApiKey(explicitKey?: string): string {
  const apiKey = (explicitKey ?? process.env.WAVESPEED_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new WaveSpeedApiError(
      503,
      'Video generation is not configured on the server. Set WAVESPEED_API_KEY in environment variables.'
    );
  }
  return apiKey;
}

export function resolveWaveSpeedVideoModel(rawModel?: string): string {
  const candidate = (rawModel ?? process.env.WAVESPEED_VIDEO_MODEL ?? DEFAULT_WAVESPEED_VIDEO_MODEL)
    .trim()
    .replace(/^\/+|\/+$/g, '');

  if (!candidate) {
    return DEFAULT_WAVESPEED_VIDEO_MODEL;
  }
  if (candidate.includes('..') || !/^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+){1,3}$/.test(candidate)) {
    throw new WaveSpeedApiError(
      500,
      'Configured WAVESPEED_VIDEO_MODEL identifier is invalid. Expected a WaveSpeedAI slug such as alibaba/wan-3.0/text-to-video.'
    );
  }
  return candidate;
}

export function resolveWaveSpeedResolution(rawResolution?: string): '480p' | '720p' | undefined {
  const candidate = (rawResolution ?? process.env.WAVESPEED_VIDEO_RESOLUTION ?? '').trim().toLowerCase();
  if (candidate === '480p' || candidate === '720p') {
    return candidate;
  }
  return undefined;
}

export function buildWaveSpeedVideoPayload(options: {
  model: string;
  prompt: string;
  aspectRatio: VideoAspectRatio;
  duration: VideoDurationOption;
  resolution?: '480p' | '720p';
}): Record<string, string | number | boolean> {
  const { model, prompt, aspectRatio, duration, resolution } = options;
  const lowerModel = model.toLowerCase();
  const durationSeconds = parseVideoDurationSeconds(duration);

  if (lowerModel.includes('wan-3.0')) {
    const targetRes = resolution ?? (lowerModel.includes('720p') ? '720p' : '480p');
    const clampedSeconds = Math.max(2, Math.min(30, durationSeconds));
    return {
      prompt,
      aspect_ratio: aspectRatio,
      resolution: targetRes,
      duration: clampedSeconds,
      generate_audio: true,
      enable_prompt_expansion: true,
    };
  }

  if (lowerModel.includes('wan-2.6')) {
    const use720 = resolution === '720p' || !resolution || lowerModel.includes('720p');
    const size = use720
      ? aspectRatio === '9:16'
        ? '720*1280'
        : '1280*720'
      : aspectRatio === '9:16'
        ? '480*832'
        : '832*480';
    // Wan 2.6 supports 5, 10, or 15s clips with multi-shot narrative support
    const wan26Duration = durationSeconds <= 6 ? 5 : durationSeconds <= 10 ? 10 : 15;
    return {
      prompt,
      size,
      duration: wan26Duration,
      shot_type: wan26Duration >= 10 ? 'multi' : 'single',
      enable_prompt_expansion: true,
    };
  }

  if (lowerModel.includes('wan-2.2')) {
    const use720 = lowerModel.includes('720p') || (!lowerModel.includes('480p') && resolution === '720p');
    const size = use720
      ? aspectRatio === '9:16'
        ? '720*1280'
        : '1280*720'
      : aspectRatio === '9:16'
        ? '480*832'
        : '832*480';

    return {
      prompt,
      size,
      // Wan 2.2 endpoints support 5s or 8s clips
      duration: durationSeconds <= 6 ? 5 : 8,
    };
  }

  // Wan 2.1, Wan 2.5, and other Wan T2V endpoints use width*height + 5/10s duration
  const use480 =
    lowerModel.includes('480p') ||
    (!lowerModel.includes('720p') && !lowerModel.includes('1080p') && resolution === '480p');

  const size = use480
    ? aspectRatio === '9:16'
      ? '480*832'
      : '832*480'
    : aspectRatio === '9:16'
      ? '720*1280'
      : '1280*720';

  return {
    prompt,
    size,
    duration: durationSeconds <= 6 ? 5 : 10,
  };
}

export function assertSafeHttpsVideoUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new WaveSpeedApiError(502, 'WaveSpeedAI returned a malformed video output URL.');
  }
  if (parsed.protocol !== 'https:') {
    throw new WaveSpeedApiError(502, 'WaveSpeedAI returned a non-HTTPS video output URL.');
  }
  return parsed;
}

export function mapWaveSpeedHttpError(
  httpStatus: number,
  envelope?: WaveSpeedEnvelope,
  rawText?: string
): WaveSpeedApiError {
  const upstreamCode = envelope?.code;
  const rawMessage =
    envelope?.data?.error ||
    envelope?.message ||
    envelope?.error ||
    rawText ||
    '';
  const cleanMessage = sanitizeWaveSpeedText(String(rawMessage)).slice(0, 240);
  const lower = cleanMessage.toLowerCase();

  if (
    httpStatus === 402 ||
    upstreamCode === 1407 ||
    lower.includes('insufficient') ||
    lower.includes('credit') ||
    lower.includes('balance') ||
    lower.includes('payment required')
  ) {
    return new WaveSpeedApiError(
      402,
      'WaveSpeedAI account has insufficient credits for video generation. Please top up your WaveSpeedAI balance.',
      upstreamCode,
      cleanMessage
    );
  }

  if (httpStatus === 401) {
    return new WaveSpeedApiError(
      401,
      'WaveSpeedAI rejected WAVESPEED_API_KEY. Verify your API key configuration on the server.',
      upstreamCode,
      cleanMessage
    );
  }

  if (httpStatus === 403) {
    return new WaveSpeedApiError(
      403,
      cleanMessage || 'WaveSpeedAI denied access to this video model or prediction. Check your API key permissions.',
      upstreamCode,
      cleanMessage
    );
  }

  if (httpStatus === 404) {
    return new WaveSpeedApiError(
      404,
      'The requested video rendering job or model endpoint was not found, or temporary results have expired.',
      upstreamCode,
      cleanMessage
    );
  }

  if (httpStatus === 410) {
    return new WaveSpeedApiError(
      410,
      'This generated video link has expired. Please generate a fresh trailer clip.',
      upstreamCode,
      cleanMessage
    );
  }

  if (
    httpStatus === 422 ||
    lower.includes('nsfw') ||
    lower.includes('safety') ||
    lower.includes('moderation') ||
    lower.includes('policy')
  ) {
    return new WaveSpeedApiError(
      422,
      cleanMessage || 'The scene prompt did not pass WaveSpeedAI content safety checks.',
      upstreamCode,
      cleanMessage
    );
  }

  if (httpStatus === 429) {
    return new WaveSpeedApiError(
      429,
      cleanMessage
        ? `WaveSpeedAI rate limit reached (${cleanMessage}). Please wait a moment and try again.`
        : 'WaveSpeedAI rate limit reached. Please wait a moment and try again.',
      upstreamCode,
      cleanMessage
    );
  }

  if (httpStatus === 400) {
    return new WaveSpeedApiError(
      400,
      cleanMessage || 'WaveSpeedAI rejected the video generation request parameters.',
      upstreamCode,
      cleanMessage
    );
  }

  if (httpStatus === 504) {
    return new WaveSpeedApiError(
      504,
      'WaveSpeedAI took too long to respond. Please try again.',
      upstreamCode,
      cleanMessage
    );
  }

  return new WaveSpeedApiError(
    502,
    cleanMessage || `WaveSpeedAI request failed (HTTP ${httpStatus}).`,
    upstreamCode,
    cleanMessage
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new WaveSpeedApiError(504, 'WaveSpeedAI request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function callWaveSpeedJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  config?: WaveSpeedConfig
): Promise<WaveSpeedEnvelope> {
  const apiKey = getWaveSpeedApiKey(config?.apiKey);
  const fetchImpl = config?.fetchImpl ?? fetch;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetchWithTimeout(url, { ...init, headers }, timeoutMs, fetchImpl);
  const rawText = await res.text();

  let parsed: WaveSpeedEnvelope | undefined;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as WaveSpeedEnvelope;
    } catch {
      parsed = undefined;
    }
  }

  if (!res.ok || (typeof parsed?.code === 'number' && parsed.code >= 400)) {
    const effectiveStatus = res.ok && typeof parsed?.code === 'number' ? parsed.code : res.status;
    console.error('[WaveSpeedAI upstream error]', {
      endpoint: url,
      method: (init.method || 'GET').toUpperCase(),
      httpStatus: res.status,
      upstreamCode: parsed?.code ?? null,
      effectiveStatus,
      responseBody: sanitizeWaveSpeedText(rawText).slice(0, 600),
    });
    throw mapWaveSpeedHttpError(effectiveStatus, parsed, rawText);
  }

  if (!parsed || typeof parsed !== 'object') {
    console.error('[WaveSpeedAI invalid JSON]', {
      endpoint: url,
      httpStatus: res.status,
      responseBody: sanitizeWaveSpeedText(rawText).slice(0, 300),
    });
    throw new WaveSpeedApiError(502, 'WaveSpeedAI returned an unreadable JSON response.');
  }

  return parsed;
}

export async function probeRemoteVideoMetadata(
  outputUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ sizeBytes: number | null; mimeType: string }> {
  const safeUrl = assertSafeHttpsVideoUrl(outputUrl).toString();

  // Attempt HEAD first
  try {
    const headRes = await fetchWithTimeout(safeUrl, { method: 'HEAD' }, 8000, fetchImpl);
    if (headRes.status === 403 || headRes.status === 404 || headRes.status === 410) {
      throw new WaveSpeedApiError(
        410,
        'The generated video link on WaveSpeedAI has expired or been removed. Please generate a fresh clip.'
      );
    }
    if (headRes.ok) {
      const lenHeader = headRes.headers.get('content-length');
      const sizeBytes = lenHeader && /^\d+$/.test(lenHeader.trim()) ? Number(lenHeader.trim()) : null;
      const mimeType = headRes.headers.get('content-type')?.split(';')[0].trim() || 'video/mp4';
      if (sizeBytes !== null) {
        return { sizeBytes, mimeType };
      }
    }
  } catch (err) {
    if (err instanceof WaveSpeedApiError) throw err;
  }

  // Fallback to single-byte Range probe for CDNs that omit Content-Length on HEAD
  try {
    const rangeRes = await fetchWithTimeout(
      safeUrl,
      { method: 'GET', headers: { Range: 'bytes=0-0' } },
      8000,
      fetchImpl
    );
    if (rangeRes.status === 403 || rangeRes.status === 404 || rangeRes.status === 410) {
      throw new WaveSpeedApiError(
        410,
        'The generated video link on WaveSpeedAI has expired or been removed. Please generate a fresh clip.'
      );
    }
    const contentRange = rangeRes.headers.get('content-range') || '';
    const match = contentRange.match(/bytes\s+\d+-\d+\/(\d+)/i);
    const lenHeader = rangeRes.headers.get('content-length');
    const sizeBytes = match
      ? Number(match[1])
      : rangeRes.status === 200 && lenHeader && /^\d+$/.test(lenHeader.trim())
        ? Number(lenHeader.trim())
        : null;
    const mimeType = rangeRes.headers.get('content-type')?.split(';')[0].trim() || 'video/mp4';
    // Drain body quietly if needed
    await rangeRes.arrayBuffer().catch(() => {});
    return { sizeBytes, mimeType };
  } catch (err) {
    if (err instanceof WaveSpeedApiError) throw err;
    return { sizeBytes: null, mimeType: 'video/mp4' };
  }
}

export async function submitWaveSpeedVideoJob(
  params: {
    prompt: string;
    aspectRatio: VideoAspectRatio;
    duration: VideoDurationOption;
    mood?: VideoSceneMood;
  },
  config?: WaveSpeedConfig
): Promise<WaveSpeedSubmitResult> {
  const apiBase = (config?.apiBase ?? WAVESPEED_API_BASE).replace(/\/+$/, '');
  const model = resolveWaveSpeedVideoModel(config?.model);
  const resolution = resolveWaveSpeedResolution(config?.resolution);
  const mood = params.mood ?? classifyVideoSceneMood(params.prompt);
  const payload = buildWaveSpeedVideoPayload({
    model,
    prompt: params.prompt,
    aspectRatio: params.aspectRatio,
    duration: params.duration,
    resolution,
  });

  console.info('[WaveSpeedAI submit]', {
    endpoint: `${apiBase}/${model}`,
    model,
    mood,
    aspectRatio: params.aspectRatio,
    requestedDuration: params.duration,
    payloadKeys: Object.keys(payload),
    payloadDuration: payload.duration,
    generateAudio: Boolean(payload.generate_audio),
    promptLength: params.prompt.length,
    apiKeySource: config?.apiKey ? 'explicit-config' : 'process.env.WAVESPEED_API_KEY',
  });

  const envelope = await callWaveSpeedJson(
    `${apiBase}/${model}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    25000,
    config
  );

  const data = envelope.data;
  const taskId = String(data?.id || '').trim();
  if (!taskId || !/^[a-zA-Z0-9._:-]{4,200}$/.test(taskId)) {
    throw new WaveSpeedApiError(502, 'WaveSpeedAI did not return a valid video prediction ID.');
  }

  const status = String(data?.status || '').toLowerCase();
  const outputUrl = Array.isArray(data?.outputs)
    ? data.outputs.find((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined;

  if (status === 'completed' && outputUrl) {
    const meta = await probeRemoteVideoMetadata(outputUrl, config?.fetchImpl);
    return {
      status: 'completed',
      taskId,
      aspectRatio: params.aspectRatio,
      duration: params.duration,
      model,
      mood,
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
      chunkDownload: meta.sizeBytes !== null && meta.sizeBytes > CHUNK_DOWNLOAD_THRESHOLD_BYTES,
    };
  }

  return {
    status: 'in_progress',
    taskId,
    aspectRatio: params.aspectRatio,
    duration: params.duration,
    model,
    mood,
    mimeType: 'video/mp4',
    sizeBytes: null,
    chunkDownload: false,
  };
}

export async function getWaveSpeedVideoJob(
  taskId: string,
  config?: WaveSpeedConfig
): Promise<WaveSpeedPollResult> {
  const apiBase = (config?.apiBase ?? WAVESPEED_API_BASE).replace(/\/+$/, '');
  const envelope = await callWaveSpeedJson(
    `${apiBase}/predictions/${encodeURIComponent(taskId)}/result`,
    { method: 'GET' },
    20000,
    config
  );

  const data = envelope.data;
  if (!data) {
    throw new WaveSpeedApiError(502, 'WaveSpeedAI returned an empty prediction status payload.');
  }

  const status = String(data.status || '').toLowerCase();

  if (status === 'failed' || status === 'cancelled' || status === 'timeout' || status === 'deleted') {
    const hasNsfw = Array.isArray(data.has_nsfw_contents) && data.has_nsfw_contents.some(Boolean);
    if (hasNsfw) {
      throw new WaveSpeedApiError(
        422,
        'Generated video frames were flagged by WaveSpeedAI safety filters. Try adjusting the scene description.'
      );
    }
    if (status === 'timeout') {
      throw new WaveSpeedApiError(504, 'WaveSpeedAI video rendering timed out on the server. Please try again.');
    }
    if (status === 'deleted') {
      throw new WaveSpeedApiError(410, 'This video rendering job was deleted or expired. Please generate a fresh clip.');
    }
    const errText = data.error ? sanitizeWaveSpeedText(String(data.error)) : '';
    if (errText) {
      throw mapWaveSpeedHttpError(502, { data: { error: errText } }, errText);
    }
    throw new WaveSpeedApiError(502, `WaveSpeedAI video generation ${status}. Please try again.`);
  }

  if (status === 'completed') {
    const outputUrl = Array.isArray(data.outputs)
      ? data.outputs.find((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : undefined;

    if (!outputUrl) {
      throw new WaveSpeedApiError(502, 'WaveSpeedAI completed the job without returning a video output URL.');
    }

    const meta = await probeRemoteVideoMetadata(outputUrl, config?.fetchImpl);
    return {
      status: 'completed',
      taskId,
      outputUrl: assertSafeHttpsVideoUrl(outputUrl).toString(),
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
      chunkDownload: meta.sizeBytes !== null && meta.sizeBytes > CHUNK_DOWNLOAD_THRESHOLD_BYTES,
    };
  }

  return {
    status: 'in_progress',
    taskId,
  };
}

export type ClampedRangeResult =
  | { valid: true; start: number; end: number }
  | { valid: false };

export function clampByteRange(
  rangeHeader: string,
  totalBytes: number | null,
  maxChunkBytes = VERCEL_SAFE_CHUNK_BYTES
): ClampedRangeResult {
  const match = rangeHeader.trim().match(/^bytes=(\d+)-(\d*)$/i);
  if (!match) {
    return { valid: false };
  }
  const start = Number(match[1]);
  if (!Number.isFinite(start) || start < 0) {
    return { valid: false };
  }
  if (totalBytes !== null && start >= totalBytes) {
    return { valid: false };
  }

  const rawEnd = match[2] ? Number(match[2]) : undefined;
  if (rawEnd !== undefined && (!Number.isFinite(rawEnd) || rawEnd < start)) {
    return { valid: false };
  }

  const maxBoundedEnd = start + maxChunkBytes - 1;
  let safeEnd = rawEnd !== undefined ? Math.min(rawEnd, maxBoundedEnd) : maxBoundedEnd;
  if (totalBytes !== null) {
    safeEnd = Math.min(safeEnd, totalBytes - 1);
  }
  if (safeEnd < start) {
    return { valid: false };
  }

  return { valid: true, start, end: safeEnd };
}

export async function streamWaveSpeedVideoAsset(
  taskId: string,
  rangeHeader: string | undefined,
  config?: WaveSpeedConfig
): Promise<WaveSpeedStreamResult> {
  const job = await getWaveSpeedVideoJob(taskId, config);
  if (job.status !== 'completed' || !job.outputUrl) {
    throw new WaveSpeedApiError(404, 'Video clip is not ready yet or has expired.');
  }

  const fetchImpl = config?.fetchImpl ?? fetch;
  const outputUrl = job.outputUrl;
  const totalBytes = job.sizeBytes ?? null;
  const defaultMime = job.mimeType || 'video/mp4';

  const upstreamHeaders: Record<string, string> = {};
  let requestedRange: { start: number; end: number } | null = null;

  if (rangeHeader && rangeHeader.trim().toLowerCase().startsWith('bytes=')) {
    const clamped = clampByteRange(rangeHeader, totalBytes, VERCEL_SAFE_CHUNK_BYTES);
    if (!clamped.valid) {
      throw new WaveSpeedApiError(416, 'Requested byte range is outside the video bounds.');
    }
    requestedRange = { start: clamped.start, end: clamped.end };
    upstreamHeaders.Range = `bytes=${clamped.start}-${clamped.end}`;
  } else if (totalBytes !== null && totalBytes > CHUNK_DOWNLOAD_THRESHOLD_BYTES) {
    // Keep non-Range requests within Vercel's 4.5MB response payload ceiling
    const safeEnd = Math.min(VERCEL_SAFE_CHUNK_BYTES - 1, totalBytes - 1);
    requestedRange = { start: 0, end: safeEnd };
    upstreamHeaders.Range = `bytes=0-${safeEnd}`;
  }

  const upstreamRes = await fetchWithTimeout(
    outputUrl,
    { method: 'GET', headers: upstreamHeaders },
    20000,
    fetchImpl
  );

  if (upstreamRes.status === 403 || upstreamRes.status === 404 || upstreamRes.status === 410) {
    throw new WaveSpeedApiError(
      410,
      'Generated video link has expired or been removed from temporary storage. Please generate a fresh clip.'
    );
  }

  if (!upstreamRes.ok) {
    throw new WaveSpeedApiError(502, `Failed to retrieve generated video from upstream storage (HTTP ${upstreamRes.status}).`);
  }

  const bytes = Buffer.from(await upstreamRes.arrayBuffer());
  const mimeType = upstreamRes.headers.get('content-type')?.split(';')[0].trim() || defaultMime;

  if (upstreamRes.status === 206) {
    const contentRange =
      upstreamRes.headers.get('content-range') ||
      (requestedRange && totalBytes !== null
        ? `bytes ${requestedRange.start}-${requestedRange.start + bytes.length - 1}/${totalBytes}`
        : undefined);
    return {
      status: 206,
      body: bytes,
      mimeType,
      contentLength: bytes.length,
      contentRange,
    };
  }

  // Upstream ignored Range and returned 200 OK; slice locally if needed to stay safely below Vercel's 4.5MB cap
  if (requestedRange) {
    const slice = bytes.subarray(requestedRange.start, requestedRange.end + 1);
    const total = bytes.length;
    return {
      status: 206,
      body: slice,
      mimeType,
      contentLength: slice.length,
      contentRange: `bytes ${requestedRange.start}-${requestedRange.start + slice.length - 1}/${total}`,
    };
  }

  if (bytes.length > VERCEL_SAFE_CHUNK_BYTES + 700_000) {
    const slice = bytes.subarray(0, VERCEL_SAFE_CHUNK_BYTES);
    return {
      status: 206,
      body: slice,
      mimeType,
      contentLength: slice.length,
      contentRange: `bytes 0-${slice.length - 1}/${bytes.length}`,
    };
  }

  return {
    status: 200,
    body: bytes,
    mimeType,
    contentLength: bytes.length,
  };
}

export function formatWaveSpeedError(err: unknown): { status: number; message: string } {
  if (err instanceof WaveSpeedApiError) {
    console.error('[WaveSpeedAI API error]', {
      status: err.status,
      code: err.code ?? null,
      message: sanitizeWaveSpeedText(err.message),
      upstreamDetail: err.upstreamDetail ? sanitizeWaveSpeedText(err.upstreamDetail) : null,
    });
    return { status: err.status, message: err.message };
  }
  const rawMessage = err instanceof Error ? err.message : String(err);
  console.error('[WaveSpeedAI API error]', sanitizeWaveSpeedText(rawMessage));
  if (rawMessage.toLowerCase().includes('timed out')) {
    return { status: 504, message: 'WaveSpeedAI took too long to respond. Please try again.' };
  }
  return {
    status: 500,
    message: sanitizeWaveSpeedText(rawMessage).slice(0, 240) || 'Failed to generate video trailer. Please try again.',
  };
}
