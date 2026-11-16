import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { apiFetch, parseJsonSafe } from '../lib/apiClient';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  contextHint?: string;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

let cachedGeminiTranscribeAvailable: boolean | null = null;
async function checkServerTranscriptionAvailable(): Promise<boolean> {
  if (cachedGeminiTranscribeAvailable !== null) {
    return cachedGeminiTranscribeAvailable;
  }
  try {
    const res = await apiFetch('/api/health');
    const data = await parseJsonSafe<{ ok?: boolean; geminiConfigured?: boolean }>(res);
    if (res.ok && data?.ok) {
      cachedGeminiTranscribeAvailable = Boolean(data.geminiConfigured);
      return cachedGeminiTranscribeAvailable;
    }
  } catch {
    // Ignore health probe errors
  }
  cachedGeminiTranscribeAvailable = false;
  return false;
}

function mapMediaError(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name?: string }).name);
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Microphone permission denied. Please allow microphone access in your browser site settings.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No microphone device found. Connect a microphone and try again.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Microphone is busy or unavailable in another application.';
    }
    if (name === 'SecurityError') {
      return 'Microphone access is blocked by browser security policy or non-HTTPS context.';
    }
  }
  return 'Microphone permission denied or unavailable.';
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  contextHint,
  label = 'Dictate',
  compact = false,
  disabled = false,
  className = ''
}) => {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechTranscriptRef = useRef<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanupTracks = () => {
    stopTimer();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    // Pre-warm health check so click handler responds synchronously
    void checkServerTranscriptionAvailable();

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      cleanupTracks();
    };
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Could not read audio recording.'));
      reader.readAsDataURL(blob);
    });
  };

  const startTimer = (onAutoStop: () => void) => {
    setSecondsElapsed(0);
    setRecording(true);
    timerRef.current = window.setInterval(() => {
      setSecondsElapsed((prev) => {
        if (prev >= 59) {
          onAutoStop();
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const startBrowserSpeechRecognition = (): boolean => {
    const SpeechRecCtor = getSpeechRecognitionCtor();
    if (!SpeechRecCtor) return false;

    try {
      const recognition = new SpeechRecCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      speechTranscriptRef.current = '';

      let finalBuffer = '';
      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          if (result.isFinal) {
            finalBuffer += `${text} `;
          } else {
            interim += text;
          }
        }
        speechTranscriptRef.current = `${finalBuffer}${interim}`.trim();
      };

      recognition.onerror = (event) => {
        stopTimer();
        setRecording(false);
        recognitionRef.current = null;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError('Microphone permission denied. Allow microphone access in your browser site settings.');
        } else if (event.error === 'audio-capture') {
          setError('No microphone detected or microphone is unavailable.');
        } else if (event.error === 'no-speech') {
          setError('No speech detected. Please speak closer to your microphone.');
        } else {
          setError(`Voice dictation stopped (${event.error}).`);
        }
      };

      recognition.onend = () => {
        stopTimer();
        setRecording(false);
        recognitionRef.current = null;
        const captured = speechTranscriptRef.current.trim();
        speechTranscriptRef.current = '';
        if (captured) {
          onTranscriptRef.current(captured);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      startTimer(() => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            // ignore
          }
        }
      });
      return true;
    } catch {
      recognitionRef.current = null;
      return false;
    }
  };

  const handleToggleRecording = async () => {
    if (disabled || transcribing) return;
    setError(null);

    if (recording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          stopTimer();
          setRecording(false);
        }
        return;
      }
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        setRecording(false);
        return;
      }
    }

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError('Microphone access requires a secure HTTPS connection.');
      return;
    }

    const canRecordMedia =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined';
    const hasSpeechRecognition = Boolean(getSpeechRecognitionCtor());

    if (!canRecordMedia && !hasSpeechRecognition) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }

    // Use cached health status synchronously so browser user-gesture activation is never lost
    if (cachedGeminiTranscribeAvailable === false && hasSpeechRecognition) {
      const started = startBrowserSpeechRecognition();
      if (started) return;
    }

    if (!canRecordMedia && hasSpeechRecognition) {
      const started = startBrowserSpeechRecognition();
      if (started) return;
    }

    if (!canRecordMedia) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err) {
      cleanupTracks();
      setRecording(false);
      setError(mapMediaError(err));
      return;
    }

    try {
      const candidateMimes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg'
      ];
      const supportedMime = candidateMimes.find((m) => {
        try {
          return MediaRecorder.isTypeSupported(m);
        } catch {
          return false;
        }
      });

      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        cleanupTracks();
        const finalMime = (recorder.mimeType || supportedMime || 'audio/webm').split(';')[0];
        const audioBlob = new Blob(chunksRef.current, { type: finalMime });
        chunksRef.current = [];

        if (audioBlob.size < 256) {
          setError('Recording was too short. Try speaking a full phrase.');
          return;
        }

        setTranscribing(true);
        try {
          const audioBase64 = await blobToBase64(audioBlob);
          const res = await apiFetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64,
              mimeType: finalMime,
              contextHint
            })
          });
          const data = await parseJsonSafe<{ transcript?: string; error?: string }>(res);
          if (!res.ok || !data) {
            if (res.status === 503 || res.status === 404 || res.status === 405 || !data) {
              cachedGeminiTranscribeAvailable = false;
              if (hasSpeechRecognition) {
                throw new Error('Server transcription is unavailable here. Tap the mic again to use live browser speech dictation.');
              }
            }
            throw new Error(data?.error || 'Could not transcribe audio.');
          }
          const transcript = String(data.transcript || '').trim();
          if (!transcript) {
            setError('No clear speech detected in the recording.');
          } else {
            onTranscriptRef.current(transcript);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Transcription failed.');
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      startTimer(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setRecording(false);
        }
      });
    } catch {
      cleanupTracks();
      setRecording(false);
      if (hasSpeechRecognition && startBrowserSpeechRecognition()) {
        return;
      }
      setError('Could not initialize audio recorder in this browser.');
    }
  };

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleToggleRecording}
        disabled={disabled || transcribing}
        aria-label={recording ? 'Stop microphone recording' : `${label} using microphone`}
        aria-pressed={recording}
        className={`inline-flex items-center gap-1.5 rounded-lg border text-xs font-sans-ui font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
        } ${
          recording
            ? 'bg-red-600 text-white border-red-600'
            : 'border-current/20 hover:border-[#C85A32] hover:text-[#C85A32]'
        }`}
      >
        {transcribing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Transcribing...</span>
          </>
        ) : recording ? (
          <>
            <Square className="w-3 h-3 fill-current" />
            <span className="tabular-nums">Stop ({secondsElapsed}s)</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>{label}</span>
          </>
        )}
      </button>

      {error && (
        <span role="alert" className="text-[11px] text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  );
};
