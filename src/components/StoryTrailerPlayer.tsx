import React, { useState, useRef } from 'react';
import { Film, BookOpen, Download, Volume2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { Story } from '../types';

interface StoryTrailerPlayerProps {
  story: Story;
  onNavigateStory?: () => void;
  onNavigateReader?: () => void;
  storyHref?: string;
  readerHref?: string;
  compact?: boolean;
}

export const StoryTrailerPlayer: React.FC<StoryTrailerPlayerProps> = ({
  story,
  onNavigateStory,
  onNavigateReader,
  storyHref,
  readerHref,
  compact = false,
}) => {
  const [showTranscript, setShowTranscript] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  if (!story.trailerVideoUrl) {
    return null;
  }

  return (
    <section
      aria-label={`Official trailer for ${story.title}`}
      className={`rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/12 dark:border-white/12 overflow-hidden shadow-xs font-sans-ui ${
        compact ? 'p-4 space-y-3' : 'p-6 space-y-4'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2D142C]/10 dark:border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-[#C85A32]">
            <Film className="w-3.5 h-3.5" />
            <span>Official Story Trailer</span>
            <span aria-hidden="true">&middot;</span>
            <span>{story.genre}</span>
            {story.trailerDuration && (
              <>
                <span aria-hidden="true">&middot;</span>
                <span className="font-mono">{story.trailerDuration}</span>
              </>
            )}
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-[#2D142C] dark:text-[#F9F6F0] mt-0.5">
            {story.title}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {readerHref && (
            <a
              href={readerHref}
              onClick={(e) => {
                if (!onNavigateReader || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onNavigateReader();
              }}
              className="px-3.5 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Read Chapter 1</span>
            </a>
          )}
          {storyHref && (
            <a
              href={storyHref}
              onClick={(e) => {
                if (!onNavigateStory || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onNavigateStory();
              }}
              className="px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Story Overview</span>
            </a>
          )}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-[#2D142C]/15 dark:border-white/15 bg-[#160C16] aspect-video">
        <video
          ref={videoRef}
          key={story.trailerVideoUrl}
          src={story.trailerVideoUrl}
          poster={story.trailerPosterUrl || story.coverImage}
          controls
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        >
          Your browser does not support video playback.
        </video>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#2D142C]/70 dark:text-white/70">
        <div className="flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
          <span>Narrated video trailer with atmospheric score &middot; By {story.author}</span>
        </div>

        <div className="flex items-center gap-3">
          {story.trailerNarration && (
            <button
              type="button"
              onClick={() => setShowTranscript((prev) => !prev)}
              className="inline-flex items-center gap-1 font-semibold text-[#C85A32] hover:underline cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showTranscript ? 'Hide Transcript' : 'Read Transcript'}</span>
              {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <a
            href={story.trailerVideoUrl}
            download={`${story.slug}-official-trailer.mp4`}
            className="inline-flex items-center gap-1 font-semibold hover:text-[#C85A32] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download MP4</span>
          </a>
        </div>
      </div>

      {showTranscript && story.trailerNarration && (
        <div className="p-3.5 rounded-lg bg-[#2D142C]/[0.04] dark:bg-white/[0.04] border border-[#2D142C]/10 dark:border-white/10 font-reader text-xs sm:text-sm italic leading-relaxed text-[#2D142C]/85 dark:text-white/85">
          &ldquo;{story.trailerNarration}&rdquo;
        </div>
      )}
    </section>
  );
};
