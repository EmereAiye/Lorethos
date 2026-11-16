import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Sun,
  Moon,
  Headphones,
  Volume2,
  VolumeX,
  Lock,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Bookmark,
  Flame,
  Loader2,
  Send,
  Highlighter,
  MessageSquare,
  Play,
  Pause,
  Square,
  Trash2
} from 'lucide-react';
import { Chapter, HighlightColor, CommentTag } from '../types';
import { ambientAudio, AmbientTrackId } from '../utils/ambientAudio';

const TRACK_LABELS: Record<AmbientTrackId, string> = {
  fireplace: 'Hearth Fire',
  rain: 'Night Rain',
  mythic_drone: 'Ambient Drone',
  silence: 'Muted'
};

const HIGHLIGHT_STYLES: Record<HighlightColor, { border: string; bg: string; label: string; dot: string }> = {
  terracotta: {
    border: 'border-l-4 border-[#C85A32]',
    bg: 'bg-[#C85A32]/10',
    label: 'Terracotta',
    dot: 'bg-[#C85A32]'
  },
  gold: {
    border: 'border-l-4 border-amber-500',
    bg: 'bg-amber-500/12',
    label: 'Ochre Gold',
    dot: 'bg-amber-500'
  },
  sage: {
    border: 'border-l-4 border-emerald-600',
    bg: 'bg-emerald-600/10',
    label: 'Forest Sage',
    dot: 'bg-emerald-600'
  }
};

export const ReaderView: React.FC = () => {
  const {
    routeParams,
    getChapter,
    fetchChapterContent,
    navigate,
    buildHref,
    readerSettings,
    updateReaderSettings,
    hasAccessToChapter,
    openPaystackCheckout,
    recordReadingProgress,
    toggleBookmark,
    user,
    isAuthenticated,
    logChapterCompleted,
    highlights,
    saveHighlight,
    removeHighlight,
    chapterComments,
    loadChapterComments,
    addChapterComment,
    deleteChapterComment
  } = useApp();

  const [scrollProgress, setScrollProgress] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [audioDrawerOpen, setAudioDrawerOpen] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [companionLoading, setCompanionLoading] = useState(false);
  const [companionReply, setCompanionReply] = useState<string | null>(null);
  const [companionError, setCompanionError] = useState<string | null>(null);
  const [loreQuestion, setLoreQuestion] = useState('');
  const [autoCompletedToast, setAutoCompletedToast] = useState(false);

  // Authoritative server chapter content state
  const [serverChapter, setServerChapter] = useState<Chapter | null>(null);
  const [chapterLocked, setChapterLocked] = useState(false);
  const [chapterLoading, setChapterLoading] = useState(true);

  // TTS AI Audio Narration state
  const [ttsVoice, setTtsVoice] = useState<'Kore' | 'Charon' | 'Zephyr' | 'Puck'>('Kore');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsAudioSrc, setTtsAudioSrc] = useState<string | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Highlight & Margin Note popover state
  const [editingParagraphIdx, setEditingParagraphIdx] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('terracotta');
  const [noteDraft, setNoteDraft] = useState('');

  // Chapter Discussion state
  const [commentTag, setCommentTag] = useState<CommentTag>('Reaction');
  const [commentDraft, setCommentDraft] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  const chapterData = getChapter(routeParams.slug || '', routeParams.chapterNumber || 1);
  const storySlug = routeParams.slug || '';
  const chapterNumber = routeParams.chapterNumber || 1;
  const chapterId = chapterData?.chapter.id || '';

  // Load authoritative chapter body & comments from server
  useEffect(() => {
    let active = true;
    setChapterLoading(true);
    setServerChapter(null);
    setChapterLocked(false);

    void fetchChapterContent(storySlug, chapterNumber).then((res) => {
      if (!active) return;
      if (res.locked) {
        setChapterLocked(true);
        if (res.chapter) setServerChapter(res.chapter);
      } else if (res.chapter) {
        setChapterLocked(false);
        setServerChapter(res.chapter);
      }
      setChapterLoading(false);
    });

    return () => {
      active = false;
    };
  }, [storySlug, chapterNumber, isAuthenticated, user.subscription.status, user.unlockedStoryIds, fetchChapterContent]);

  useEffect(() => {
    if (chapterId) {
      void loadChapterComments(chapterId);
    }
  }, [chapterId, loadChapterComments]);

  const isChapterLogged = Boolean(
    chapterId && user.readingGoal.completedChapterIds?.includes(chapterId)
  );

  // Sync Web Audio Ambient Soundscape
  useEffect(() => {
    if (readerSettings.ambientSound && readerSettings.ambientTrack !== 'silence') {
      ambientAudio.start(readerSettings.ambientTrack, readerSettings.ambientVolume);
    } else {
      ambientAudio.stop();
    }
  }, [readerSettings.ambientSound, readerSettings.ambientTrack, readerSettings.ambientVolume]);

  useEffect(() => {
    ambientAudio.setVolume(readerSettings.ambientVolume);
  }, [readerSettings.ambientVolume]);

  useEffect(() => {
    return () => {
      ambientAudio.stop();
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
      }
    };
  }, []);

  // Scroll depth tracking
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0 && chapterData) {
        const current = (window.scrollY / totalHeight) * 100;
        const bounded = Math.min(100, Math.max(0, current));
        setScrollProgress(bounded);

        const accessible = !chapterLocked && hasAccessToChapter(chapterData.story, chapterData.chapter);
        if (accessible) {
          recordReadingProgress(
            chapterData.story.id,
            chapterData.chapter.id,
            chapterData.chapter.chapterNumber,
            Math.round(bounded)
          );
          if (
            bounded >= 92 &&
            !user.readingGoal.completedChapterIds?.includes(chapterData.chapter.id)
          ) {
            const newlyLogged = logChapterCompleted(chapterData.chapter.id);
            if (newlyLogged) {
              setAutoCompletedToast(true);
              window.setTimeout(() => setAutoCompletedToast(false), 3800);
            }
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [
    chapterData,
    chapterLocked,
    hasAccessToChapter,
    user.readingGoal.completedChapterIds,
    logChapterCompleted,
    recordReadingProgress
  ]);

  useEffect(() => {
    setCompanionReply(null);
    setCompanionError(null);
    setEditingParagraphIdx(null);
    setAutoCompletedToast(false);
    setTtsError(null);
    setTtsAudioSrc(null);
    setTtsPlaying(false);
    setScrollProgress(0);
    window.scrollTo({ top: 0 });
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
    }
  }, [chapterId]);

  const askLorekeeper = async (mode: 'recap' | 'ask', customQuestion?: string) => {
    if (!chapterData) return;
    const { story, chapter } = chapterData;
    const q = (customQuestion ?? loreQuestion).trim();
    if (mode === 'ask' && !q) return;

    setCompanionLoading(true);
    setCompanionError(null);

    try {
      const res = await fetch('/api/ai/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode,
          question: q,
          storySlug: story.slug,
          chapterNumber: chapter.chapterNumber
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not reach chapter companion.');
      }
      setCompanionReply(data.reply);
      if (mode === 'ask') setLoreQuestion('');
    } catch (err) {
      setCompanionError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setCompanionLoading(false);
    }
  };

  const handleNarrateChapter = async () => {
    if (!chapterData) return;
    const { story, chapter } = chapterData;

    if (ttsAudioSrc && ttsAudioRef.current) {
      if (ttsPlaying) {
        ttsAudioRef.current.pause();
        setTtsPlaying(false);
      } else {
        await ttsAudioRef.current.play();
        setTtsPlaying(true);
      }
      return;
    }

    setTtsLoading(true);
    setTtsError(null);

    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          storySlug: story.slug,
          chapterNumber: chapter.chapterNumber,
          voiceName: ttsVoice
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to generate chapter narration.');
      }

      const dataUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
      setTtsAudioSrc(dataUrl);

      if (ttsAudioRef.current) {
        ttsAudioRef.current.src = dataUrl;
        await ttsAudioRef.current.play();
        setTtsPlaying(true);
      }
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : 'Narration playback failed.');
    } finally {
      setTtsLoading(false);
    }
  };

  const stopTtsNarration = () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
    }
    setTtsPlaying(false);
  };

  const handleLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    route: string,
    params?: Parameters<typeof navigate>[1]
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route, params);
  };

  if (!chapterData) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-24 text-center space-y-4">
        <h2 className="font-display text-2xl font-bold">Chapter Not Found</h2>
        <a
          href={buildHref('stories')}
          onClick={(e) => handleLink(e, 'stories')}
          className="inline-block text-xs font-semibold text-[#C85A32] underline"
        >
          Return to Story Library
        </a>
      </div>
    );
  }

  const { story, chapter: fallbackChapter } = chapterData;
  const chapter = serverChapter || fallbackChapter;
  const isAccessible = !chapterLocked && hasAccessToChapter(story, chapter);
  const paragraphs = chapter.content || [];
  const isBookmarked = user.bookmarkedChapterIds.includes(chapter.id);
  const chapterHighlights = highlights.filter(h => h.chapterId === chapter.id);
  const activeComments = chapterComments.filter(c => c.chapterId === chapter.id);

  const themeStyles = {
    day: {
      canvas: 'bg-[#F9F6F0] text-[#2D142C]',
      bar: 'bg-[#F9F6F0]/90 border-[#2D142C]/10 text-[#2D142C]',
      panel: 'bg-white border-[#2D142C]/15 text-[#2D142C] shadow-lg'
    },
    sepia: {
      canvas: 'bg-[#F4ECE1] text-[#2C1E18]',
      bar: 'bg-[#F4ECE1]/90 border-[#2C1E18]/10 text-[#2C1E18]',
      panel: 'bg-[#EDE3D5] border-[#2C1E18]/15 text-[#2C1E18] shadow-lg'
    },
    night: {
      canvas: 'bg-[#160C16] text-[#F9F6F0]',
      bar: 'bg-[#160C16]/90 border-white/10 text-[#F9F6F0]',
      panel: 'bg-[#231323] border-white/15 text-[#F9F6F0] shadow-lg'
    }
  }[readerSettings.theme];

  const fontClass = {
    literata: 'font-reader',
    garamond: 'font-display',
    sans: 'font-sans-ui'
  }[readerSettings.font];

  const widthClass = {
    compact: 'max-w-xl',
    standard: 'max-w-2xl',
    wide: 'max-w-3xl'
  }[readerSettings.readingWidth];

  const prevChapter = story.chapters.find(c => c.chapterNumber === chapter.chapterNumber - 1);
  const nextChapter = story.chapters.find(c => c.chapterNumber === chapter.chapterNumber + 1);

  const openParagraphEditor = (idx: number) => {
    if (editingParagraphIdx === idx) {
      setEditingParagraphIdx(null);
      return;
    }
    const existing = chapterHighlights.find(h => h.paragraphIndex === idx);
    setSelectedColor(existing?.color || 'terracotta');
    setNoteDraft(existing?.note || '');
    setEditingParagraphIdx(idx);
  };

  return (
    <div className={`min-h-screen ${themeStyles.canvas} transition-colors duration-200 selection:bg-[#C85A32]/25`}>
      <audio
        ref={ttsAudioRef}
        onEnded={() => setTtsPlaying(false)}
        onPause={() => setTtsPlaying(false)}
        onPlay={() => setTtsPlaying(true)}
      />

      {/* Top Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-[#2D142C]/10 dark:bg-white/10">
        <div
          className="h-full bg-[#C85A32] transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {autoCompletedToast && (
        <div
          role="status"
          className="fixed top-16 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#2D142C] text-white border border-[#C85A32] shadow-xl flex items-center gap-2 text-xs font-sans-ui"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Chapter completed and logged to your reading goal.</span>
        </div>
      )}

      {/* Reader Floating Header Toolbar */}
      <header className={`sticky top-1 z-40 w-full backdrop-blur-md border-b ${themeStyles.bar} transition-colors px-4 py-2.5`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 text-xs font-sans-ui">
          <a
            href={buildHref('story-detail', { slug: story.slug })}
            onClick={(e) => handleLink(e, 'story-detail', { slug: story.slug })}
            className="flex items-center gap-1.5 hover:text-[#C85A32] transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Exit</span>
          </a>

          <div className="flex items-center gap-2 text-center truncate px-2 min-w-0">
            <span className="font-semibold truncate max-w-[120px] sm:max-w-xs">{story.title}</span>
            <span className="opacity-40">&middot;</span>
            <span className="opacity-80 whitespace-nowrap">Ch. {chapter.chapterNumber}</span>
            <div className="hidden md:flex items-center gap-2 ml-1">
              <div className="w-14 bg-current/15 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#C85A32] h-full rounded-full transition-all duration-150"
                  style={{ width: `${scrollProgress}%` }}
                />
              </div>
              <span className="font-mono text-[11px] font-bold text-[#C85A32] tabular-nums">
                {Math.round(scrollProgress)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div role="group" aria-label="Reader color theme" className="flex items-center bg-current/5 p-0.5 rounded-lg border border-current/15 text-[11px]">
              <button
                type="button"
                onClick={() => updateReaderSettings({ theme: 'day' })}
                aria-label="Day theme"
                aria-pressed={readerSettings.theme === 'day'}
                className={`px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                  readerSettings.theme === 'day' ? 'bg-white text-[#2D142C] shadow-xs font-semibold' : 'opacity-65 hover:opacity-100'
                }`}
              >
                <Sun className="w-3 h-3" />
                <span className="hidden md:inline">Day</span>
              </button>
              <button
                type="button"
                onClick={() => updateReaderSettings({ theme: 'sepia' })}
                aria-label="Sepia theme"
                aria-pressed={readerSettings.theme === 'sepia'}
                className={`px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                  readerSettings.theme === 'sepia' ? 'bg-[#EDE3D5] text-[#2C1E18] shadow-xs font-semibold' : 'opacity-65 hover:opacity-100'
                }`}
              >
                <span>Sepia</span>
              </button>
              <button
                type="button"
                onClick={() => updateReaderSettings({ theme: 'night' })}
                aria-label="Night theme"
                aria-pressed={readerSettings.theme === 'night'}
                className={`px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                  readerSettings.theme === 'night' ? 'bg-[#231323] text-white shadow-xs font-semibold' : 'opacity-65 hover:opacity-100'
                }`}
              >
                <Moon className="w-3 h-3" />
                <span className="hidden md:inline">Night</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => toggleBookmark(chapter.id)}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark chapter'}
              aria-pressed={isBookmarked}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isBookmarked ? 'text-[#C85A32]' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                setAudioDrawerOpen(!audioDrawerOpen);
                setControlsOpen(false);
                setCompanionOpen(false);
              }}
              aria-expanded={audioDrawerOpen}
              aria-label="Audio narration and ambient soundscapes"
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer ${
                audioDrawerOpen || readerSettings.ambientSound || ttsPlaying
                  ? 'text-[#C85A32] bg-[#C85A32]/15 font-semibold'
                  : 'opacity-80 hover:opacity-100 hover:text-[#C85A32]'
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span className="hidden lg:inline">
                {ttsPlaying ? 'Narrating' : 'Audio'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCompanionOpen(!companionOpen);
                setControlsOpen(false);
                setAudioDrawerOpen(false);
              }}
              aria-expanded={companionOpen}
              aria-label="Ask about this chapter"
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer ${
                companionOpen
                  ? 'text-[#C85A32] bg-[#C85A32]/15 font-semibold'
                  : 'opacity-80 hover:opacity-100 hover:text-[#C85A32]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
              <span className="hidden lg:inline">Chapter Help</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setControlsOpen(!controlsOpen);
                setCompanionOpen(false);
                setAudioDrawerOpen(false);
              }}
              aria-expanded={controlsOpen}
              aria-label="Typography settings"
              className="p-1.5 rounded opacity-80 hover:opacity-100 hover:text-[#C85A32] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Settings2 className="w-4 h-4" />
              <span className="font-serif">Aa</span>
            </button>
          </div>
        </div>

        {/* Reading Settings Drawer */}
        {controlsOpen && (
          <div className="max-w-md mx-auto mt-2 p-4 rounded-xl border transition-all text-xs space-y-4 shadow-xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border-slate-300 dark:border-white/20 text-slate-800 dark:text-slate-100 sepia:text-[#2C1E18]">
            <div className="space-y-1.5">
              <span className="font-semibold block opacity-75">Reading Theme</span>
              <div className="grid grid-cols-3 gap-2">
                {(['day', 'sepia', 'night'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => updateReaderSettings({ theme: t })}
                    className={`py-2 px-3 rounded-lg border text-center font-medium cursor-pointer capitalize ${
                      readerSettings.theme === t ? 'border-[#C85A32] ring-1 ring-[#C85A32]' : 'border-current/15'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="font-semibold block opacity-75">Typeface</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ font: 'literata' })}
                  className={`py-2 px-2 rounded-lg border text-center font-reader cursor-pointer ${
                    readerSettings.font === 'literata' ? 'border-[#C85A32] ring-1 ring-[#C85A32] font-semibold' : 'border-current/15'
                  }`}
                >
                  Literata
                </button>
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ font: 'garamond' })}
                  className={`py-2 px-2 rounded-lg border text-center font-display cursor-pointer ${
                    readerSettings.font === 'garamond' ? 'border-[#C85A32] ring-1 ring-[#C85A32] font-semibold' : 'border-current/15'
                  }`}
                >
                  Cormorant
                </button>
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ font: 'sans' })}
                  className={`py-2 px-2 rounded-lg border text-center font-sans-ui cursor-pointer ${
                    readerSettings.font === 'sans' ? 'border-[#C85A32] ring-1 ring-[#C85A32] font-semibold' : 'border-current/15'
                  }`}
                >
                  Jakarta Sans
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <span className="font-semibold block opacity-75">
                  Font Size ({readerSettings.fontSize}px)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateReaderSettings({ fontSize: Math.max(14, readerSettings.fontSize - 1) })}
                    className="flex-1 py-1 px-2 border rounded font-semibold cursor-pointer hover:border-[#C85A32]"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() => updateReaderSettings({ fontSize: Math.min(24, readerSettings.fontSize + 1) })}
                    className="flex-1 py-1 px-2 border rounded font-semibold cursor-pointer hover:border-[#C85A32]"
                  >
                    A+
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-semibold block opacity-75">Column Width</span>
                <div className="flex items-center gap-1">
                  {(['compact', 'standard', 'wide'] as const).map(w => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => updateReaderSettings({ readingWidth: w })}
                      className={`flex-1 py-1 px-1 rounded border text-[11px] cursor-pointer ${
                        readerSettings.readingWidth === w ? 'border-[#C85A32] font-semibold' : 'border-current/15'
                      }`}
                    >
                      {w === 'compact' ? '60ch' : w === 'standard' ? '75ch' : '90ch'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setControlsOpen(false)}
                className="text-xs text-[#C85A32] font-semibold hover:underline cursor-pointer"
              >
                Close &times;
              </button>
            </div>
          </div>
        )}

        {/* Audio & AI Narration Drawer */}
        {audioDrawerOpen && (
          <div className="max-w-xl mx-auto mt-2 p-5 rounded-xl border transition-all text-xs space-y-5 shadow-xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border-[#C85A32]/30 text-slate-800 dark:text-slate-100 sepia:text-[#2C1E18]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-[#C85A32]" />
                <div>
                  <span className="font-display text-sm font-bold block">Audio &amp; Narration</span>
                  <span className="text-[11px] opacity-65">Ambient soundscapes and AI chapter narration</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAudioDrawerOpen(false)}
                className="text-xs text-[#C85A32] font-semibold hover:underline cursor-pointer"
              >
                Close &times;
              </button>
            </div>

            <div className="space-y-2.5 p-3.5 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-current/10">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  {readerSettings.ambientSound && readerSettings.ambientTrack !== 'silence' ? (
                    <Volume2 className="w-3.5 h-3.5 text-[#C85A32]" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 opacity-60" />
                  )}
                  <span>Ambient Soundscape</span>
                </span>
                <span className="text-[11px] font-mono text-[#C85A32]">
                  {readerSettings.ambientSound ? TRACK_LABELS[readerSettings.ambientTrack] : 'Muted'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['fireplace', 'rain', 'mythic_drone', 'silence'] as const).map(track => {
                  const isActive =
                    track === 'silence'
                      ? !readerSettings.ambientSound || readerSettings.ambientTrack === 'silence'
                      : readerSettings.ambientSound && readerSettings.ambientTrack === track;
                  return (
                    <button
                      key={track}
                      type="button"
                      onClick={() =>
                        updateReaderSettings({
                          ambientTrack: track,
                          ambientSound: track !== 'silence'
                        })
                      }
                      className={`py-1.5 px-2.5 rounded-lg border text-center font-medium cursor-pointer transition-all ${
                        isActive ? 'bg-[#C85A32] text-white border-[#C85A32]' : 'border-current/15 hover:border-[#C85A32]'
                      }`}
                    >
                      {TRACK_LABELS[track]}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label htmlFor="ambient-volume-slider" className="text-[11px] opacity-70 w-14">
                  Volume
                </label>
                <input
                  id="ambient-volume-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(readerSettings.ambientVolume * 100)}
                  onChange={(e) =>
                    updateReaderSettings({ ambientVolume: Number(e.target.value) / 100 })
                  }
                  className="flex-1 accent-[#C85A32] cursor-pointer"
                />
                <span className="text-[11px] font-mono w-9 text-right">
                  {Math.round(readerSettings.ambientVolume * 100)}%
                </span>
              </div>
            </div>

            <div className="space-y-2.5 p-3.5 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-current/10">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>AI Voice Narration</span>
                </span>
                <span className="text-[10px] font-mono opacity-65">Ch. {chapter.chapterNumber}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] opacity-70 mr-1">Voice:</span>
                  {(['Kore', 'Charon', 'Zephyr', 'Puck'] as const).map(voice => (
                    <button
                      key={voice}
                      type="button"
                      onClick={() => {
                        setTtsVoice(voice);
                        setTtsAudioSrc(null);
                        stopTtsNarration();
                      }}
                      className={`px-2 py-1 rounded border text-[11px] cursor-pointer transition-colors ${
                        ttsVoice === voice
                          ? 'border-[#C85A32] bg-[#C85A32]/15 text-[#C85A32] font-semibold'
                          : 'border-current/15 opacity-75 hover:opacity-100'
                      }`}
                    >
                      {voice}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={ttsLoading || !isAccessible}
                    onClick={handleNarrateChapter}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2D142C] dark:bg-[#C85A32] text-white font-semibold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-55 cursor-pointer"
                  >
                    {ttsLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : ttsPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>{ttsAudioSrc ? 'Resume Audio' : 'Listen to Chapter'}</span>
                      </>
                    )}
                  </button>

                  {ttsAudioSrc && (
                    <button
                      type="button"
                      onClick={stopTtsNarration}
                      aria-label="Stop narration"
                      className="p-1.5 rounded-lg border border-current/20 hover:border-[#C85A32] cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {ttsError && (
                <div role="alert" className="p-2.5 rounded bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-[11px]">
                  {ttsError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chapter Companion Drawer */}
        {companionOpen && (
          <div className="max-w-xl mx-auto mt-2 p-5 rounded-xl border transition-all text-xs space-y-4 shadow-xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border-[#C85A32]/30 text-slate-800 dark:text-slate-100 sepia:text-[#2C1E18]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C85A32]" />
                <div>
                  <span className="font-display text-sm font-bold block">Ask about this chapter</span>
                  <span className="text-[11px] opacity-65">Spoiler-free recaps &amp; answers for Ch. {chapter.chapterNumber}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompanionOpen(false)}
                className="text-xs text-[#C85A32] font-semibold hover:underline cursor-pointer"
              >
                Close &times;
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={companionLoading || !isAccessible}
                onClick={() => askLorekeeper('recap')}
                className="px-3 py-1.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] disabled:opacity-55 text-white font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {companionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Summarize Chapter</span>
              </button>

              <button
                type="button"
                disabled={companionLoading || !isAccessible}
                onClick={() => askLorekeeper('ask', 'Who are the key figures introduced in this chapter?')}
                className="px-3 py-1.5 rounded-lg border border-current/20 hover:border-[#C85A32] font-medium cursor-pointer disabled:opacity-55 transition-colors"
              >
                Key Characters
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                askLorekeeper('ask');
              }}
              className="flex items-center gap-2"
            >
              <label htmlFor="chapter-companion-question" className="sr-only">
                Ask a question about this chapter
              </label>
              <input
                id="chapter-companion-question"
                type="text"
                value={loreQuestion}
                onChange={(e) => setLoreQuestion(e.target.value)}
                placeholder="Ask a question about this chapter..."
                className="flex-1 px-3 py-2 rounded-lg border border-current/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
              />
              <button
                type="submit"
                disabled={companionLoading || !loreQuestion.trim() || !isAccessible}
                className="px-3 py-2 rounded-lg bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] disabled:opacity-50 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask</span>
              </button>
            </form>

            {companionError && (
              <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs">
                {companionError}
              </div>
            )}

            {companionReply && (
              <div className="p-3.5 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-current/10 font-reader text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                {companionReply}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Chapter Canvas */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <article className={`${widthClass} mx-auto space-y-10`}>
          <div className="text-center space-y-4 pb-8 border-b border-current/10">
            <div className="text-xs tracking-[0.25em] uppercase text-[#C85A32] font-semibold font-sans-ui">
              Chapter {chapter.chapterNumber} &middot; {chapter.wordCount.toLocaleString()} Words
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
              {chapter.title}
            </h1>

            <div className="text-xs font-sans-ui opacity-65 flex flex-wrap items-center justify-center gap-3">
              <span>By {story.author}</span>
              <span>&middot;</span>
              <span>{chapter.readTimeMinutes} min read</span>
              <span>&middot;</span>
              <span>{chapter.releaseDate}</span>
            </div>
          </div>

          {chapterLoading ? (
            <div className="py-20 text-center space-y-3 text-xs font-sans-ui opacity-70">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#C85A32]" />
              <p>Loading chapter...</p>
            </div>
          ) : isAccessible ? (
            <div
              className={`${fontClass} space-y-6 leading-relaxed`}
              style={{ fontSize: `${readerSettings.fontSize}px` }}
            >
              {paragraphs.map((paragraph, index) => {
                const existingHighlight = chapterHighlights.find(h => h.paragraphIndex === index);
                const hlStyle = existingHighlight ? HIGHLIGHT_STYLES[existingHighlight.color] : null;
                const isEditing = editingParagraphIdx === index;

                return (
                  <div key={index} className="group relative space-y-2">
                    <div
                      className={`rounded-r-lg transition-all ${
                        hlStyle
                          ? `${hlStyle.border} ${hlStyle.bg} pl-4 pr-3 py-2`
                          : 'hover:bg-current/[0.025] px-2 -mx-2 py-1'
                      }`}
                    >
                      <p
                        className={
                          index === 0
                            ? 'first-letter:text-5xl first-letter:font-display first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:text-[#C85A32]'
                            : ''
                        }
                      >
                        {paragraph}
                      </p>
                      <div className="mt-1 flex justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openParagraphEditor(index)}
                          className="text-[11px] font-sans-ui text-[#C85A32] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Highlighter className="w-3 h-3" />
                          <span>{existingHighlight ? 'Edit Highlight' : 'Highlight / Note'}</span>
                        </button>
                      </div>
                    </div>

                    {existingHighlight?.note && !isEditing && (
                      <div className="ml-4 pl-3 border-l border-current/25 text-xs font-sans-ui italic opacity-80 flex items-start justify-between gap-2">
                        <span>Margin Note: &ldquo;{existingHighlight.note}&rdquo;</span>
                        <button
                          type="button"
                          onClick={() => openParagraphEditor(index)}
                          className="text-[11px] font-semibold not-italic text-[#C85A32] hover:underline shrink-0 cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    )}

                    {isEditing && (
                      <div className={`p-4 rounded-xl border text-xs font-sans-ui space-y-3 ${themeStyles.panel}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Highlighter className="w-3.5 h-3.5 text-[#C85A32]" />
                            <span>Highlight Passage &amp; Margin Note</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            {(['terracotta', 'gold', 'sage'] as const).map(color => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setSelectedColor(color)}
                                aria-label={HIGHLIGHT_STYLES[color].label}
                                className={`w-5 h-5 rounded-full ${HIGHLIGHT_STYLES[color].dot} cursor-pointer transition-transform ${
                                  selectedColor === color ? 'ring-2 ring-offset-2 ring-[#C85A32] scale-110' : 'opacity-65 hover:opacity-100'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <label htmlFor={`note-draft-${index}`} className="sr-only">
                          Margin note
                        </label>
                        <textarea
                          id={`note-draft-${index}`}
                          rows={2}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Write an optional margin note..."
                          className="w-full px-3 py-2 rounded-lg border border-current/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                        />

                        <div className="flex items-center justify-between gap-2">
                          {existingHighlight ? (
                            <button
                              type="button"
                              onClick={() => {
                                removeHighlight(existingHighlight.id);
                                setEditingParagraphIdx(null);
                              }}
                              className="text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove Highlight</span>
                            </button>
                          ) : (
                            <span />
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingParagraphIdx(null)}
                              className="px-3 py-1.5 rounded-lg border border-current/20 opacity-80 hover:opacity-100 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                saveHighlight({
                                  storyId: story.id,
                                  storyTitle: story.title,
                                  storySlug: story.slug,
                                  chapterId: chapter.id,
                                  chapterNumber: chapter.chapterNumber,
                                  chapterTitle: chapter.title,
                                  paragraphIndex: index,
                                  excerpt: paragraph,
                                  color: selectedColor,
                                  note: noteDraft.trim() || undefined
                                });
                                setEditingParagraphIdx(null);
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold cursor-pointer"
                            >
                              Save Highlight
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Reading Goal Card */}
              <div className="py-10 text-center space-y-6">
                <div className="inline-flex items-center gap-2 opacity-50 font-display text-sm tracking-widest uppercase">
                  <span>&bull;</span>
                  <span>End of Chapter {chapter.chapterNumber}</span>
                  <span>&bull;</span>
                </div>

                <div className="p-6 rounded-2xl bg-white/70 dark:bg-[#1E111E]/70 sepia:bg-[#EDE3D5]/90 border border-[#C85A32]/30 shadow-md flex flex-col sm:flex-row items-center justify-between gap-5 text-left">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#C85A32]/15 border border-[#C85A32]/30 flex items-center justify-center shrink-0">
                      <Flame className="w-6 h-6 text-[#C85A32]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase font-mono font-bold text-[#C85A32] tracking-wider">
                          Reading Goal
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#C85A32]/10 text-[#C85A32] font-semibold">
                          {user.readingGoal.streakDays}-Day Streak
                        </span>
                      </div>
                      <div className="font-display text-lg font-bold mt-0.5">
                        {isChapterLogged
                          ? `Chapter Logged (${user.readingGoal.currentProgress}/${user.readingGoal.targetChapters})`
                          : `Finished Chapter ${chapter.chapterNumber}?`}
                      </div>
                      <p className="text-xs opacity-70 font-sans-ui mt-0.5">
                        {isChapterLogged
                          ? 'This chapter is counted toward your reading goal.'
                          : `Log this chapter toward your ${user.readingGoal.frequency} target of ${user.readingGoal.targetChapters} chapters.`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isChapterLogged) {
                        logChapterCompleted(chapter.id);
                      }
                    }}
                    disabled={isChapterLogged}
                    className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shrink-0 shadow-xs ${
                      isChapterLogged
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-[#C85A32] hover:bg-[#b04d28] text-white cursor-pointer'
                    }`}
                  >
                    {isChapterLogged ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Completed</span>
                      </>
                    ) : (
                      <>
                        <Flame className="w-4 h-4" />
                        <span>Mark Chapter Complete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Chapter Discussion */}
              <section className="pt-8 border-t border-current/15 space-y-5 font-sans-ui">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-[#C85A32]" />
                      <span>Chapter {chapter.chapterNumber} Discussion</span>
                    </h2>
                    <p className="text-xs opacity-70 mt-0.5">
                      Share reactions and theories with fellow readers.
                    </p>
                  </div>
                  <span className="text-xs font-mono opacity-65">
                    {activeComments.length} Note{activeComments.length === 1 ? '' : 's'}
                  </span>
                </div>

                {!isAuthenticated ? (
                  <div className="p-4 rounded-xl border border-current/15 bg-current/[0.03] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <span>Sign in to post a comment or theory on this chapter.</span>
                    <a
                      href={buildHref('account')}
                      onClick={(e) => handleLink(e, 'account')}
                      className="px-4 py-2 rounded-lg bg-[#C85A32] text-white font-semibold self-start sm:self-auto"
                    >
                      Sign In &rarr;
                    </a>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!commentDraft.trim()) return;
                      setCommentError(null);
                      const res = await addChapterComment({
                        storyId: story.id,
                        chapterId: chapter.id,
                        tag: commentTag,
                        body: commentDraft
                      });
                      if (res.error) {
                        setCommentError(res.error);
                      } else {
                        setCommentDraft('');
                      }
                    }}
                    className="p-4 rounded-xl border border-current/15 bg-current/[0.03] space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">Posting as {user.name}</span>
                      <div className="flex items-center gap-1.5">
                        {(['Reaction', 'Lore', 'Theory'] as const).map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setCommentTag(tag)}
                            className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                              commentTag === tag
                                ? 'bg-[#C85A32] text-white border-[#C85A32]'
                                : 'border-current/20 opacity-75 hover:opacity-100'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label htmlFor="chapter-comment-input" className="sr-only">
                      Write your chapter note
                    </label>
                    <textarea
                      id="chapter-comment-input"
                      rows={3}
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder={`Share your ${commentTag.toLowerCase()} on Chapter ${chapter.chapterNumber}...`}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-current/20 bg-transparent focus:outline-none focus:border-[#C85A32] font-reader text-sm"
                    />

                    {commentError && (
                      <p role="alert" className="text-red-600 dark:text-red-400">
                        {commentError}
                      </p>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!commentDraft.trim()}
                        className="px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Post Note</span>
                      </button>
                    </div>
                  </form>
                )}

                {activeComments.length === 0 ? (
                  <p className="text-xs opacity-65 italic py-2">
                    No reader notes yet for Chapter {chapter.chapterNumber}.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeComments.map(cmt => (
                      <div
                        key={cmt.id}
                        className="p-4 rounded-xl border border-current/12 bg-current/[0.02] space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{cmt.authorName}</span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#C85A32]/15 text-[#C85A32] font-semibold">
                              {cmt.tag}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] opacity-60">{cmt.createdAt}</span>
                            {(cmt.authorName === user.name || user.role === 'owner') && isAuthenticated && (
                              <button
                                type="button"
                                onClick={() => deleteChapterComment(cmt.id)}
                                aria-label="Delete note"
                                className="opacity-60 hover:text-red-500 hover:opacity-100 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="font-reader text-sm leading-relaxed opacity-90">{cmt.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            /* Server-Enforced Paywall Container */
            <div className="space-y-8">
              <div
                className={`${fontClass} space-y-4 leading-relaxed relative`}
                style={{ fontSize: `${readerSettings.fontSize}px` }}
              >
                <p className="first-letter:text-5xl first-letter:font-display first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:text-[#C85A32]">
                  {chapter.excerpt}
                </p>
              </div>

              <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#C85A32]/40 shadow-2xl text-center space-y-5 text-slate-900 dark:text-white">
                <div className="w-12 h-12 bg-[#C85A32]/10 text-[#C85A32] rounded-full flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>

                <div className="space-y-2 max-w-lg mx-auto">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold">
                    Chapter {chapter.chapterNumber} Is Locked
                  </h2>
                  <p className="font-reader text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Chapters 1&ndash;{story.freeChaptersCount} are complimentary. Unlock Chapter {chapter.chapterNumber} by subscribing to the Monthly Plan or purchasing this story.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      openPaystackCheckout({
                        type: 'subscription',
                        title: 'Patron Monthly Subscription',
                        amountNgn: 3500,
                        planId: 'monthly'
                      })
                    }
                    className="py-3.5 px-4 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold text-xs tracking-wide rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Subscribe Monthly (₦3,500/mo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openPaystackCheckout({
                        type: 'book_purchase',
                        title: `Book Unlock: ${story.title}`,
                        amountNgn: story.priceNgn,
                        storyId: story.id
                      })
                    }
                    className="py-3.5 px-4 border border-slate-300 dark:border-white/20 hover:border-[#C85A32] text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Unlock Story (₦{story.priceNgn.toLocaleString('en-NG')} Once)</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans-ui flex items-center justify-center gap-2 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Paystack Hosted Checkout: Cards, Bank Transfer &amp; USSD in Nigeria</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Between Chapters */}
          <div className="pt-10 border-t border-current/10 flex items-center justify-between gap-4 font-sans-ui text-xs">
            {prevChapter ? (
              <a
                href={buildHref('reader', { slug: story.slug, chapterNumber: prevChapter.chapterNumber })}
                onClick={(e) =>
                  handleLink(e, 'reader', { slug: story.slug, chapterNumber: prevChapter.chapterNumber })
                }
                className="py-2.5 px-4 rounded border border-current/20 hover:border-[#C85A32] flex items-center gap-2 hover:text-[#C85A32] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Ch. {prevChapter.chapterNumber}: {prevChapter.title}</span>
                <span className="sm:hidden">Prev Ch.</span>
              </a>
            ) : (
              <div />
            )}

            <a
              href={buildHref('story-detail', { slug: story.slug })}
              onClick={(e) => handleLink(e, 'story-detail', { slug: story.slug })}
              className="py-2.5 px-4 text-center font-medium opacity-80 hover:opacity-100 hover:text-[#C85A32] transition-colors"
            >
              Table of Contents
            </a>

            {nextChapter ? (
              <a
                href={buildHref('reader', { slug: story.slug, chapterNumber: nextChapter.chapterNumber })}
                onClick={(e) =>
                  handleLink(e, 'reader', { slug: story.slug, chapterNumber: nextChapter.chapterNumber })
                }
                className="py-2.5 px-4 rounded bg-[#C85A32] text-white hover:bg-[#b04d28] flex items-center gap-2 transition-colors font-semibold shadow-xs"
              >
                <span className="hidden sm:inline">Ch. {nextChapter.chapterNumber}: {nextChapter.title}</span>
                <span className="sm:hidden">Next Ch.</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            ) : (
              <a
                href={buildHref('stories')}
                onClick={(e) => handleLink(e, 'stories')}
                className="py-2.5 px-4 rounded border border-current/20 hover:border-[#C85A32] text-xs font-semibold"
              >
                More Stories &rarr;
              </a>
            )}
          </div>
        </article>
      </main>
    </div>
  );
};
