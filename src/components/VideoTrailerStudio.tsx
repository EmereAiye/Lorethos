import React, { useState, useEffect, useRef } from 'react';
import { Film, Loader2, Download } from 'lucide-react';
import { VoiceDictationButton } from './VoiceDictationButton';
import { apiFetch, parseJsonSafe } from '../lib/apiClient';

interface VideoTrailerStudioProps {
  storySlug?: string;
  storyTitle?: string;
  defaultPrompt?: string;
  heading?: string;
  description?: string;
}

interface VideoApiResponse {
  status?: string;
  interactionId?: string;
  videoUrl?: string;
  videoBase64?: string;
  videoUri?: string;
  mimeType?: string;
  aspectRatio?: string;
  sizeBytes?: number | null;
  chunkDownload?: boolean;
  error?: string;
}

export const VideoTrailerStudio: React.FC<VideoTrailerStudioProps> = ({
  storySlug,
  storyTitle,
  defaultPrompt = '',
  heading = 'Story Trailer & Scene Visualizer',
  description = 'Generate a short animated literary trailer from a scene description in 16:9 widescreen or 9:16 portrait.'
}) => {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [duration, setDuration] = useState<'6s' | '10s'>('6s');
  const [generating, setGenerating] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [renderedRatio, setRenderedRatio] = useState<'16:9' | '9:16'>('16:9');

  const activeRunIdRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      activeRunIdRef.current += 1;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const downloadVideoInChunks = async (
    url: string,
    totalBytes: number,
    mimeType: string,
    runId: number
  ): Promise<string> => {
    const chunkSize = 3_000_000;
    const chunks: Uint8Array[] = [];
    let offset = 0;

    while (offset < totalBytes) {
      if (activeRunIdRef.current !== runId) {
        throw new Error('Cancelled');
      }
      const end = Math.min(offset + chunkSize - 1, totalBytes - 1);
      const partRes = await apiFetch(url, {
        headers: { Range: `bytes=${offset}-${end}` }
      });
      if (!partRes.ok) {
        throw new Error(`Failed while downloading rendered clip (HTTP ${partRes.status}).`);
      }
      const buf = new Uint8Array(await partRes.arrayBuffer());
      if (buf.byteLength === 0) break;
      chunks.push(buf);
      offset += buf.byteLength;
    }

    const blob = new Blob(chunks as BlobPart[], { type: mimeType || 'video/mp4' });
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    const nextUrl = URL.createObjectURL(blob);
    blobUrlRef.current = nextUrl;
    return nextUrl;
  };

  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = prompt.trim();
    if (cleaned.length < 6) {
      setError('Describe the scene visuals in at least 6 characters.');
      return;
    }

    const runId = ++activeRunIdRef.current;
    setGenerating(true);
    setRenderStatus('Starting video render...');
    setError(null);

    try {
      const res = await apiFetch('/api/ai/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleaned,
          aspectRatio,
          duration,
          storySlug
        })
      });
      const initialData = await parseJsonSafe<VideoApiResponse>(res);
      if (!res.ok || !initialData) {
        throw new Error(
          initialData?.error ||
            (res.status === 504
              ? 'Video request timed out on the server gateway. Please try again.'
              : `Could not start video rendering (HTTP ${res.status}).`)
        );
      }

      let completedData = initialData;
      const targetRatio: '16:9' | '9:16' =
        initialData.aspectRatio === '9:16' || aspectRatio === '9:16' ? '9:16' : '16:9';

      if (initialData.status !== 'completed') {
        if (!initialData.interactionId) {
          throw new Error('Server did not return a video rendering job ID.');
        }

        const startedAt = Date.now();
        const maxWaitMs = 300_000;
        let transientFailures = 0;

        while (activeRunIdRef.current === runId) {
          const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
          setRenderStatus(`Rendering ${duration} trailer clip (${elapsedSec}s)...`);

          await new Promise((resolve) => window.setTimeout(resolve, 3500));
          if (activeRunIdRef.current !== runId) return;

          if (Date.now() - startedAt > maxWaitMs) {
            throw new Error('Video generation timed out after 5 minutes. Please try again.');
          }

          const pollRes = await apiFetch(
            `/api/ai/video/${encodeURIComponent(initialData.interactionId)}`
          );
          const pollData = await parseJsonSafe<VideoApiResponse>(pollRes);

          if (!pollRes.ok) {
            if (pollRes.status >= 500 && pollRes.status !== 502 && transientFailures < 3) {
              transientFailures += 1;
              continue;
            }
            throw new Error(pollData?.error || `Video rendering failed (HTTP ${pollRes.status}).`);
          }

          transientFailures = 0;
          if (!pollData) continue;

          if (pollData.status === 'completed') {
            completedData = pollData;
            break;
          }
        }
      }

      if (activeRunIdRef.current !== runId) return;

      if (completedData.videoUrl) {
        if (completedData.chunkDownload && completedData.sizeBytes) {
          setRenderStatus('Loading rendered video stream...');
          const objectUrl = await downloadVideoInChunks(
            completedData.videoUrl,
            completedData.sizeBytes,
            completedData.mimeType || 'video/mp4',
            runId
          );
          if (activeRunIdRef.current !== runId) return;
          setVideoSrc(objectUrl);
        } else {
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
          }
          setVideoSrc(completedData.videoUrl);
        }
        setRenderedRatio(targetRatio);
      } else if (completedData.videoBase64) {
        setVideoSrc(`data:${completedData.mimeType || 'video/mp4'};base64,${completedData.videoBase64}`);
        setRenderedRatio(targetRatio);
      } else if (completedData.videoUri) {
        setVideoSrc(completedData.videoUri);
        setRenderedRatio(targetRatio);
      } else {
        throw new Error('No playable video stream was returned.');
      }
    } catch (err) {
      if (activeRunIdRef.current === runId) {
        setError(err instanceof Error ? err.message : 'Video generation failed.');
      }
    } finally {
      if (activeRunIdRef.current === runId) {
        setGenerating(false);
        setRenderStatus(null);
      }
    }
  };

  return (
    <section className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/12 dark:border-white/12 space-y-5 font-sans-ui">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2D142C]/10 dark:border-white/10 pb-4">
        <div>
          <h3 className="font-display text-xl font-bold flex items-center gap-2 text-[#2D142C] dark:text-[#F9F6F0]">
            <Film className="w-5 h-5 text-[#C85A32]" />
            <span>{heading}</span>
          </h3>
          <p className="text-xs text-[#2D142C]/65 dark:text-white/65 mt-0.5">
            {description}
          </p>
        </div>

        {storyTitle && (
          <span className="text-[11px] font-mono text-[#2D142C]/60 dark:text-white/60 shrink-0">
            {storyTitle}
          </span>
        )}
      </div>

      <form onSubmit={handleGenerateVideo} className="space-y-4 text-xs">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`video-prompt-${storySlug || 'desk'}`} className="font-semibold">
              Scene Visual Prompt
            </label>
            <VoiceDictationButton
              compact
              label="Speak Prompt"
              contextHint={storyTitle ? `Visual trailer prompt for ${storyTitle}` : 'Literary video scene prompt'}
              onTranscript={(text) => setPrompt((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
            />
          </div>
          <textarea
            id={`video-prompt-${storySlug || 'desk'}`}
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe camera movement, lighting, atmosphere, and action (e.g., Candlelit brass observatory overlooking Benin rainstorms at dusk)..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32] font-reader text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#2D142C]/75 dark:text-white/75">Aspect Ratio</span>
              <div
                role="group"
                aria-label="Video aspect ratio"
                className="inline-flex items-center p-0.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-[#F9F6F0] dark:bg-[#160C16]"
              >
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  aria-pressed={aspectRatio === '16:9'}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    aspectRatio === '16:9'
                      ? 'bg-[#C85A32] text-white'
                      : 'text-[#2D142C]/75 dark:text-white/75 hover:text-[#C85A32]'
                  }`}
                >
                  16:9 Landscape
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  aria-pressed={aspectRatio === '9:16'}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    aspectRatio === '9:16'
                      ? 'bg-[#C85A32] text-white'
                      : 'text-[#2D142C]/75 dark:text-white/75 hover:text-[#C85A32]'
                  }`}
                >
                  9:16 Portrait
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#2D142C]/75 dark:text-white/75">Duration</span>
              <div
                role="group"
                aria-label="Video clip duration"
                className="inline-flex items-center p-0.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-[#F9F6F0] dark:bg-[#160C16]"
              >
                {(['6s', '10s'] as const).map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setDuration(len)}
                    aria-pressed={duration === len}
                    className={`px-2.5 py-1.5 rounded-md font-mono font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      duration === len
                        ? 'bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16]'
                        : 'text-[#2D142C]/75 dark:text-white/75 hover:text-[#C85A32]'
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={generating || prompt.trim().length < 6}
            className="px-4 py-2.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] disabled:opacity-55 text-white font-semibold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{renderStatus || 'Rendering Video...'}</span>
              </>
            ) : (
              <>
                <Film className="w-4 h-4" />
                <span>Generate Video Trailer</span>
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-300 text-xs"
        >
          {error}
        </div>
      )}

      {videoSrc && (
        <div className="space-y-3 pt-2">
          <div
            className={`mx-auto rounded-xl overflow-hidden border border-[#2D142C]/15 dark:border-white/15 bg-black ${
              renderedRatio === '9:16' ? 'max-w-xs aspect-[9/16]' : 'w-full aspect-video'
            }`}
          >
            <video
              src={videoSrc}
              controls
              playsInline
              loop
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#2D142C]/65 dark:text-white/65">
            <span>Rendered format: {renderedRatio} MP4</span>
            <a
              href={videoSrc}
              download={`${storySlug || 'lorethos-scene'}-${renderedRatio.replace(':', 'x')}.mp4`}
              className="inline-flex items-center gap-1.5 font-semibold text-[#C85A32] hover:underline"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Clip</span>
            </a>
          </div>
        </div>
      )}
    </section>
  );
};
