import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Film, Loader2, Download, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { VoiceDictationButton } from './VoiceDictationButton';
import { apiFetch, parseJsonSafe } from '../lib/apiClient';
import { ambientAudio } from '../utils/ambientAudio';

interface VideoTrailerStudioProps {
  storySlug?: string;
  storyTitle?: string;
  defaultPrompt?: string;
  heading?: string;
  description?: string;
}

type VideoDurationChoice = '15s' | '20s' | '30s';
type VideoMoodChoice = 'auto' | 'neutral' | 'suspense' | 'action' | 'storm';
type DetectedMood = 'neutral' | 'suspense' | 'action' | 'storm';
type NarratorVoice = 'Kore' | 'Charon' | 'Puck' | 'Zephyr' | 'Fenrir';

interface VideoApiResponse {
  provider?: string;
  model?: string;
  mood?: DetectedMood;
  status?: string;
  interactionId?: string;
  videoUrl?: string;
  videoBase64?: string;
  videoUri?: string;
  mimeType?: string;
  aspectRatio?: string;
  duration?: string;
  sizeBytes?: number | null;
  chunkDownload?: boolean;
  error?: string;
}

interface NarrationApiResponse {
  script?: string;
  mood?: DetectedMood;
  duration?: string;
  voiceName?: string;
  audioBase64?: string | null;
  mimeType?: string | null;
  source?: 'gemini-tts' | 'browser-speech-fallback';
  error?: string;
}

const MOOD_LABELS: Record<DetectedMood, string> = {
  neutral: 'Cinematic Drift Motion',
  suspense: 'Suspense Creeping Motion',
  action: 'Kinetic Action Motion',
  storm: 'Tempest Storm Motion',
};

export const VideoTrailerStudio: React.FC<VideoTrailerStudioProps> = ({
  storySlug,
  storyTitle,
  defaultPrompt = '',
  heading = 'Story Trailer & Scene Visualizer',
  description = 'Generate a 15–30 second narrated literary trailer with mood-driven camera motions, scene-explaining voiceover, and atmospheric audio.'
}) => {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [duration, setDuration] = useState<VideoDurationChoice>('15s');
  const [moodPreference, setMoodPreference] = useState<VideoMoodChoice>('auto');
  const [voiceName, setVoiceName] = useState<NarratorVoice>('Kore');
  const [audioOverlayEnabled, setAudioOverlayEnabled] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [renderedRatio, setRenderedRatio] = useState<'16:9' | '9:16'>('16:9');
  const [renderedDuration, setRenderedDuration] = useState<string>('15s');
  const [activeMood, setActiveMood] = useState<DetectedMood>('neutral');

  const [narrationScript, setNarrationScript] = useState<string | null>(null);
  const [narrationAudioSrc, setNarrationAudioSrc] = useState<string | null>(null);
  const [narrationSource, setNarrationSource] = useState<'gemini-tts' | 'browser-speech-fallback' | null>(null);

  const activeRunIdRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);
  const narrationBlobUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopSyncedAudio = useCallback(() => {
    if (narrationAudioRef.current) {
      narrationAudioRef.current.pause();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    ambientAudio.stop();
  }, []);

  useEffect(() => {
    return () => {
      activeRunIdRef.current += 1;
      stopSyncedAudio();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (narrationBlobUrlRef.current) {
        URL.revokeObjectURL(narrationBlobUrlRef.current);
        narrationBlobUrlRef.current = null;
      }
    };
  }, [stopSyncedAudio]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const useOverlayVoice = audioOverlayEnabled && Boolean(narrationAudioSrc || narrationScript);
    videoEl.muted = useOverlayVoice;
    videoEl.volume = useOverlayVoice ? 0 : 1.0;
  }, [audioOverlayEnabled, narrationAudioSrc, narrationScript, videoSrc]);

  const speakBrowserFallback = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = activeMood === 'action' ? 1.02 : activeMood === 'suspense' ? 0.92 : 0.96;
      utterance.pitch = activeMood === 'suspense' ? 0.94 : 1.0;
      utterance.volume = 0.95;
      window.speechSynthesis.speak(utterance);
    },
    [activeMood]
  );

  const startSyncedAudio = useCallback(
    (forceRestart = false) => {
      if (!audioOverlayEnabled) return;

      // Always stop Web Audio synth oscillators before playing studio narration to avoid distortion/clipping
      ambientAudio.stop();

      const audioEl = narrationAudioRef.current;
      const videoEl = videoRef.current;
      if (audioEl && narrationAudioSrc) {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        const targetTime = forceRestart ? 0 : Math.max(0, videoEl?.currentTime || 0);
        if (Number.isFinite(audioEl.duration) && audioEl.duration > 0 && targetTime >= audioEl.duration) {
          audioEl.pause();
          return;
        }
        try {
          if (forceRestart || Math.abs((audioEl.currentTime || 0) - targetTime) > 0.35) {
            audioEl.currentTime = targetTime;
          }
        } catch {
          // ignore if metadata isn't ready yet
        }
        audioEl.volume = 0.96;
        void audioEl.play().catch(() => {
          if (narrationScript) {
            speakBrowserFallback(narrationScript);
          }
        });
        return;
      }

      if (narrationScript && (!videoEl || videoEl.currentTime < 1.5 || forceRestart)) {
        speakBrowserFallback(narrationScript);
      }
    },
    [audioOverlayEnabled, narrationAudioSrc, narrationScript, speakBrowserFallback]
  );

  const handleVideoSeeked = useCallback(() => {
    const videoEl = videoRef.current;
    const audioEl = narrationAudioRef.current;
    if (!videoEl || !audioOverlayEnabled || !audioEl || !narrationAudioSrc) return;

    const targetTime = Math.max(0, videoEl.currentTime);
    if (Number.isFinite(audioEl.duration) && audioEl.duration > 0 && targetTime >= audioEl.duration) {
      audioEl.pause();
      return;
    }
    try {
      if (Math.abs((audioEl.currentTime || 0) - targetTime) > 0.35) {
        audioEl.currentTime = targetTime;
      }
    } catch {
      // ignore seek before readyState
    }
    if (!videoEl.paused && audioEl.paused) {
      void audioEl.play().catch(() => {});
    }
  }, [audioOverlayEnabled, narrationAudioSrc]);

  const handleToggleAudioOverlay = () => {
    const next = !audioOverlayEnabled;
    setAudioOverlayEnabled(next);
    if (videoRef.current) {
      const muteNative = next && Boolean(narrationAudioSrc || narrationScript);
      videoRef.current.muted = muteNative;
      videoRef.current.volume = muteNative ? 0 : 1.0;
    }
    if (!next) {
      stopSyncedAudio();
    } else if (videoRef.current && !videoRef.current.paused) {
      startSyncedAudio(false);
    }
  };

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

  const prepareNarrationTrack = async (
    cleanedPrompt: string,
    selectedDuration: VideoDurationChoice,
    selectedMood: VideoMoodChoice,
    selectedVoice: NarratorVoice,
    runId: number
  ) => {
    try {
      const res = await apiFetch('/api/ai/video/narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanedPrompt,
          storySlug,
          duration: selectedDuration,
          mood: selectedMood,
          voiceName: selectedVoice,
        })
      });
      const data = await parseJsonSafe<NarrationApiResponse>(res);
      if (activeRunIdRef.current !== runId || !res.ok || !data) return;

      if (data.mood) {
        setActiveMood(data.mood);
      }
      if (data.script) {
        setNarrationScript(data.script);
      }
      setNarrationSource(data.source || 'browser-speech-fallback');

      if (data.audioBase64) {
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
        if (narrationBlobUrlRef.current) {
          URL.revokeObjectURL(narrationBlobUrlRef.current);
        }
        const audioUrl = URL.createObjectURL(audioBlob);
        narrationBlobUrlRef.current = audioUrl;
        setNarrationAudioSrc(audioUrl);
      } else {
        setNarrationAudioSrc(null);
      }
    } catch {
      // Narration fallback never blocks or replaces WaveSpeedAI video errors
    }
  };

  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = prompt.trim();
    if (cleaned.length < 6) {
      setError('Describe the scene visuals in at least 6 characters.');
      return;
    }

    const runId = ++activeRunIdRef.current;
    stopSyncedAudio();
    ambientAudio.unlock();

    setGenerating(true);
    setRenderStatus(`Starting ${duration} talking trailer render...`);
    setError(null);
    setNarrationScript(null);
    setNarrationAudioSrc(null);
    setNarrationSource(null);

    const narrationPromise = prepareNarrationTrack(cleaned, duration, moodPreference, voiceName, runId);

    try {
      const res = await apiFetch('/api/ai/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleaned,
          aspectRatio,
          duration,
          storySlug,
          mood: moodPreference,
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

      if (initialData.mood) {
        setActiveMood(initialData.mood);
      }

      let completedData = initialData;
      const targetRatio: '16:9' | '9:16' =
        initialData.aspectRatio === '9:16' || aspectRatio === '9:16' ? '9:16' : '16:9';

      if (initialData.status !== 'completed') {
        if (!initialData.interactionId) {
          throw new Error('Server did not return a video rendering job ID.');
        }

        const startedAt = Date.now();
        const maxWaitMs = 360_000;
        let transientFailures = 0;

        while (activeRunIdRef.current === runId) {
          const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
          setRenderStatus(`Rendering ${duration} trailer with audio & mood motion (${elapsedSec}s)...`);

          await new Promise((resolve) => window.setTimeout(resolve, 3500));
          if (activeRunIdRef.current !== runId) return;

          if (Date.now() - startedAt > maxWaitMs) {
            throw new Error('Video generation timed out after 6 minutes. Please try again.');
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

      await narrationPromise;
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
        setRenderedDuration(completedData.duration || duration);
      } else if (completedData.videoBase64) {
        setVideoSrc(`data:${completedData.mimeType || 'video/mp4'};base64,${completedData.videoBase64}`);
        setRenderedRatio(targetRatio);
        setRenderedDuration(completedData.duration || duration);
      } else if (completedData.videoUri) {
        setVideoSrc(completedData.videoUri);
        setRenderedRatio(targetRatio);
        setRenderedDuration(completedData.duration || duration);
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
              Enter Your Words to Turn Into Video
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
            placeholder="Describe what happens, who speaks, mood lighting, and camera movement (e.g., Candlelit brass observatory overlooking Benin rainstorms as the chronicler whispers the ancient prophecy)..."
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
                {(['15s', '20s', '30s'] as const).map((len) => (
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

            <div className="flex items-center gap-2">
              <label htmlFor={`video-mood-${storySlug || 'desk'}`} className="font-semibold text-[#2D142C]/75 dark:text-white/75">
                Mood Motion
              </label>
              <select
                id={`video-mood-${storySlug || 'desk'}`}
                value={moodPreference}
                onChange={(e) => setMoodPreference(e.target.value as VideoMoodChoice)}
                className="px-2.5 py-1.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-[#F9F6F0] dark:bg-[#160C16] font-medium focus:outline-none focus:border-[#C85A32]"
              >
                <option value="auto">Auto-Detect Mood</option>
                <option value="suspense">Suspense (Slow Creep)</option>
                <option value="action">Action (Kinetic)</option>
                <option value="storm">Storm (Tempest Sweep)</option>
                <option value="neutral">Cinematic Drift</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor={`video-voice-${storySlug || 'desk'}`} className="font-semibold text-[#2D142C]/75 dark:text-white/75">
                Explainer Voice
              </label>
              <select
                id={`video-voice-${storySlug || 'desk'}`}
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value as NarratorVoice)}
                className="px-2.5 py-1.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-[#F9F6F0] dark:bg-[#160C16] font-medium focus:outline-none focus:border-[#C85A32]"
              >
                <option value="Kore">Kore (Warm)</option>
                <option value="Charon">Charon (Deep)</option>
                <option value="Fenrir">Fenrir (Dramatic)</option>
                <option value="Zephyr">Zephyr (Calm)</option>
                <option value="Puck">Puck (Expressive)</option>
              </select>
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
                <span>Generate {duration} Talking Trailer</span>
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
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2D142C]/8 dark:bg-white/10 text-[#2D142C] dark:text-[#F9F6F0] font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
              <span>{MOOD_LABELS[activeMood]} · {renderedDuration}</span>
            </div>

            <button
              type="button"
              onClick={handleToggleAudioOverlay}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32] font-medium cursor-pointer transition-colors"
            >
              {audioOverlayEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>Scene Explainer & Mood Audio: On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-[#2D142C]/60 dark:text-white/60" />
                  <span>Native Video Audio Only</span>
                </>
              )}
            </button>
          </div>

          <div
            className={`mx-auto rounded-xl overflow-hidden border border-[#2D142C]/15 dark:border-white/15 bg-black ${
              renderedRatio === '9:16' ? 'max-w-xs aspect-[9/16]' : 'w-full aspect-video'
            }`}
          >
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              playsInline
              muted={audioOverlayEnabled && Boolean(narrationAudioSrc || narrationScript)}
              onPlay={() => startSyncedAudio(false)}
              onPause={() => stopSyncedAudio()}
              onEnded={() => stopSyncedAudio()}
              onSeeked={handleVideoSeeked}
              className="w-full h-full object-cover"
            />
          </div>

          {narrationAudioSrc && (
            <audio
              ref={narrationAudioRef}
              src={narrationAudioSrc}
              preload="auto"
              onError={() => {
                if (narrationScript && videoRef.current && !videoRef.current.paused && audioOverlayEnabled) {
                  speakBrowserFallback(narrationScript);
                }
              }}
              className="hidden"
            />
          )}

          {narrationScript && (
            <div className="p-3 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] border border-[#2D142C]/10 dark:border-white/10 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#2D142C]/70 dark:text-white/70">
                <span>Spoken Scene Explanation ({voiceName})</span>
                <span className="font-mono uppercase text-[10px] opacity-75">
                  {narrationSource === 'gemini-tts' ? 'Studio Voice + Mood Mix' : 'Voice Synthesis + Mood Mix'}
                </span>
              </div>
              <p className="font-reader text-sm text-[#2D142C] dark:text-[#F9F6F0] leading-relaxed">
                “{narrationScript}”
              </p>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-[#2D142C]/65 dark:text-white/65">
            <span>Rendered format: {renderedRatio} MP4 · {renderedDuration}</span>
            <a
              href={videoSrc}
              download={`${storySlug || 'lorethos-scene'}-${renderedDuration}-${renderedRatio.replace(':', 'x')}.mp4`}
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
