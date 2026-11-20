import React, { useEffect, useId, useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';
import {
  claimExclusiveAudio,
  registerExclusiveAudio,
  releaseExclusiveAudio,
} from '../utils/exclusiveAudio';

interface ExclusiveAudioPlayerProps {
  src: string;
  label?: string;
  compact?: boolean;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs < 10 ? `0${secs}` : secs}`;
}

export const ExclusiveAudioPlayer: React.FC<ExclusiveAudioPlayerProps> = ({
  src,
  label = 'Trailer Audio',
  compact = false,
}) => {
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unregister = registerExclusiveAudio(playerId, () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        audio.pause();
      }
      setIsPlaying(false);
    });
    return () => {
      unregister();
      releaseExclusiveAudio(playerId);
    };
  }, [playerId]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setErrorMsg(null);
  }, [src]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setErrorMsg(null);

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      releaseExclusiveAudio(playerId);
      return;
    }

    claimExclusiveAudio(playerId);
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      releaseExclusiveAudio(playerId);
      setErrorMsg('Unable to play trailer audio.');
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    const audio = audioRef.current;
    if (audio && Number.isFinite(nextTime)) {
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`rounded-xl border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 bg-[#F9F6F0]/80 dark:bg-[#160C16]/80 sepia:bg-[#EDE3D5]/80 font-sans-ui ${
        compact ? 'px-3 py-2' : 'px-3.5 py-2.5'
      }`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        data-exclusive-id={playerId}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onPlay={() => {
          claimExclusiveAudio(playerId);
          setIsPlaying(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          releaseExclusiveAudio(playerId);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          releaseExclusiveAudio(playerId);
        }}
        onError={() => {
          setIsPlaying(false);
          releaseExclusiveAudio(playerId);
          setErrorMsg('Audio stream unavailable.');
        }}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlayback()}
          aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
          className="w-8 h-8 rounded-full bg-[#C85A32] hover:bg-[#b04d28] text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 font-semibold text-[#C85A32] truncate">
              <Volume2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{label}</span>
            </span>
            <span className="font-mono text-[10px] opacity-70 tabular-nums shrink-0">
              {formatSeconds(currentTime)} / {formatSeconds(duration)}
            </span>
          </div>

          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              aria-label={`Seek ${label}`}
              className="w-full h-1.5 accent-[#C85A32] cursor-pointer"
              style={{
                background: `linear-gradient(to right, #C85A32 ${progressPct}%, rgba(128,128,128,0.22) ${progressPct}%)`,
              }}
            />
          </div>
        </div>
      </div>

      {errorMsg && (
        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5">{errorMsg}</p>
      )}
    </div>
  );
};
