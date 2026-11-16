import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, Feather, Sparkles, Compass, ScrollText, Clock, Check, X, ArrowRight } from 'lucide-react';

interface GenreOption {
  name: string;
  tagline: string;
  icon: React.ReactNode;
}

const PRESET_GENRE_OPTIONS: GenreOption[] = [
  {
    name: 'Poetry',
    tagline: 'Verse cycles, harmattan elegies & spoken-word lyricism',
    icon: <Feather className="w-4 h-4" />
  },
  {
    name: 'Literary Fiction',
    tagline: 'Epistolary prose, intimate portraits & contemporary life',
    icon: <ScrollText className="w-4 h-4" />
  },
  {
    name: 'Epic Fantasy',
    tagline: 'Imperial courts, blood oaths & high-stakes worldbuilding',
    icon: <Sparkles className="w-4 h-4" />
  },
  {
    name: 'Mythological Realism',
    tagline: 'Ancestral folklore, griot voices & sacred landscapes',
    icon: <Compass className="w-4 h-4" />
  },
  {
    name: 'Lost Epoch & Sci-Fi',
    tagline: 'Submerged relics, celestial cartography & deep time',
    icon: <Clock className="w-4 h-4" />
  },
  {
    name: 'Historical Mystery',
    tagline: 'Archival secrets, royal dynasties & vanished scribes',
    icon: <BookOpen className="w-4 h-4" />
  }
];

function matchesSelectedGenres(storyGenre: string, storyTags: string[], selected: string[]): boolean {
  if (selected.length === 0) return true;
  if (selected.includes(storyGenre)) return true;
  const normalizedTags = storyTags.map((t) => t.toLowerCase());
  return selected.some((sel) => {
    const lower = sel.toLowerCase();
    return normalizedTags.some((tag) => tag.includes(lower) || (lower.includes('fiction') && tag.includes('fiction')));
  });
}

export const ReadingPreferencesModal: React.FC = () => {
  const {
    readingPromptOpen,
    closeReadingPrompt,
    preferredGenres,
    setPreferredGenres,
    stories,
    user,
    isAuthenticated,
    currentRoute,
    navigate,
    pendingAuthRedirect,
    clearPendingAuthRedirect,
    completePostAuthRedirect
  } = useApp();

  const [selected, setSelected] = useState<string[]>(preferredGenres);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (readingPromptOpen) {
      setSelected(preferredGenres);
      window.setTimeout(() => {
        firstActionRef.current?.focus();
      }, 20);
    }
  }, [readingPromptOpen, preferredGenres]);

  useEffect(() => {
    if (!readingPromptOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeReadingPrompt();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readingPromptOpen, closeReadingPrompt]);

  const genreOptions = useMemo(() => {
    const presetNames = new Set(PRESET_GENRE_OPTIONS.map((g) => g.name));
    const extras: GenreOption[] = Array.from(new Set(stories.map((s) => s.genre)))
      .filter((genre) => !presetNames.has(genre))
      .map((genre) => ({
        name: genre,
        tagline: `Original ${genre.toLowerCase()} works from the Lorethos catalog`,
        icon: <BookOpen className="w-4 h-4" />
      }));
    return [...PRESET_GENRE_OPTIONS, ...extras];
  }, [stories]);

  const countByGenre = useMemo(() => {
    const map = new Map<string, number>();
    stories.forEach((s) => {
      map.set(s.genre, (map.get(s.genre) || 0) + 1);
    });
    return map;
  }, [stories]);

  const matchingTotal = useMemo(() => {
    if (selected.length === 0) return stories.length;
    return stories.filter((s) => matchesSelectedGenres(s.genre, s.tags, selected)).length;
  }, [stories, selected]);

  if (!readingPromptOpen || !isAuthenticated) {
    return null;
  }

  const toggleGenre = (genre: string) => {
    setSelected((prev) =>
      prev.includes(genre) ? prev.filter((item) => item !== genre) : [...prev, genre]
    );
  };

  const handleSaveForHomeFeed = () => {
    setPreferredGenres(selected);
    closeReadingPrompt();
    completePostAuthRedirect(currentRoute !== 'home' ? 'home' : undefined);
  };

  const handleBrowseLibrary = () => {
    setPreferredGenres(selected);
    clearPendingAuthRedirect();
    closeReadingPrompt();
    if (selected.length === 1) {
      navigate('stories', { genre: selected[0] });
    } else if (selected.length > 1) {
      navigate('stories', { interests: '1' });
    } else {
      navigate('stories');
    }
  };

  const handleSkip = () => {
    closeReadingPrompt();
    if (pendingAuthRedirect) {
      completePostAuthRedirect();
    }
  };

  const firstName = user.name.trim().split(/\s+/)[0] || 'Reader';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reading-prompt-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeReadingPrompt();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#F9F6F0] dark:bg-[#1E111E] sepia:bg-[#F4ECE1] text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] border border-[#2D142C]/15 dark:border-white/15 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#2D142C]/10 dark:border-white/10 flex items-start justify-between gap-4 bg-gradient-to-r from-[#2D142C]/5 via-[#C85A32]/10 to-transparent">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#C85A32] font-sans-ui">
              Welcome, {firstName}
            </div>
            <h2 id="reading-prompt-title" className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
              What do you want to read?
            </h2>
            <p className="text-xs sm:text-sm opacity-75 font-reader">
              Select your preferred genres&mdash;from poetry and literary fiction to epic sagas. We save these to your profile to personalize your home feed.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            aria-label="Close reading preferences prompt"
            className="p-1.5 rounded-lg opacity-65 hover:opacity-100 hover:bg-current/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Genre Selection Grid */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {genreOptions.map((option, idx) => {
              const isSelected = selected.includes(option.name);
              const count = countByGenre.get(option.name) || 0;
              return (
                <button
                  key={option.name}
                  ref={idx === 0 ? firstActionRef : undefined}
                  type="button"
                  onClick={() => toggleGenre(option.name)}
                  aria-pressed={isSelected}
                  className={`p-4 rounded-xl border text-left transition-colors cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'border-[#C85A32] bg-[#C85A32]/12 shadow-xs'
                      : 'border-[#2D142C]/15 dark:border-white/15 bg-white/70 dark:bg-white/[0.03] hover:border-[#C85A32]/50'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? 'bg-[#C85A32] text-white'
                        : 'bg-[#2D142C]/8 dark:bg-white/10 text-[#C85A32]'
                    }`}
                  >
                    {isSelected ? <Check className="w-4 h-4" /> : option.icon}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-base font-bold leading-tight">
                        {option.name}
                      </span>
                      <span className="text-[10px] font-mono opacity-65 shrink-0 tabular-nums">
                        {count} {count === 1 ? 'work' : 'works'}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-70 font-sans-ui leading-snug">
                      {option.tagline}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#2D142C]/10 dark:border-white/10 bg-white/60 dark:bg-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans-ui">
          <div className="flex items-center gap-3">
            <span className="opacity-75">
              {selected.length === 0
                ? `No filter active · ${stories.length} stories available`
                : `${selected.length} ${selected.length === 1 ? 'genre' : 'genres'} saved · ${matchingTotal} recommended ${matchingTotal === 1 ? 'work' : 'works'}`}
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-[#C85A32] hover:underline font-medium cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleSkip}
              className="px-3.5 py-2 rounded-lg border border-[#2D142C]/15 dark:border-white/15 hover:bg-current/5 font-medium cursor-pointer transition-colors"
            >
              Skip for Now
            </button>
            <button
              type="button"
              onClick={handleBrowseLibrary}
              className="px-3.5 py-2 rounded-lg border border-[#C85A32]/35 text-[#C85A32] hover:bg-[#C85A32]/10 font-semibold cursor-pointer transition-colors"
            >
              Open in Library
            </button>
            <button
              type="button"
              onClick={handleSaveForHomeFeed}
              className="px-5 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
            >
              <span>
                {pendingAuthRedirect
                  ? 'Save & Continue'
                  : selected.length === 0
                  ? 'Save & Go Home'
                  : `Personalize Home (${matchingTotal})`}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
