import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  contextHint?: string;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
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
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const cleanupTracks = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
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

  const handleToggleRecording = async () => {
    if (disabled || transcribing) return;
    setError(null);

    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const candidateMimes = ['audio/webm', 'audio/mp4', 'audio/ogg'];
      const supportedMime =
        typeof MediaRecorder !== 'undefined'
          ? candidateMimes.find((m) => MediaRecorder.isTypeSupported(m))
          : undefined;

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
          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              audioBase64,
              mimeType: finalMime,
              contextHint
            })
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Could not transcribe audio.');
          }
          const transcript = String(data.transcript || '').trim();
          if (!transcript) {
            setError('No clear speech detected in the recording.');
          } else {
            onTranscript(transcript);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Transcription failed.');
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setSecondsElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setSecondsElapsed((prev) => {
          if (prev >= 59) {
            if (mediaRecorderRef.current?.state === 'recording') {
              mediaRecorderRef.current.stop();
              setRecording(false);
            }
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      cleanupTracks();
      setRecording(false);
      setError('Microphone permission denied or unavailable.');
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
