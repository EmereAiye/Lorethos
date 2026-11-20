import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../lib/apiClient';
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
import { Chapter, HighlightColor, CommentTag, SceneMood, TextHighlight } from '../types';
import { ambientAudio, AmbientTrackId } from '../utils/ambientAudio';
import { NarrativeAudioMiddleware, toSceneMood } from '../utils/narrativeAudioMiddleware';
import { getDisplayName, computeReaderRank } from '../utils/readerProfile';
import {
  measureSelectionInParagraphElement,
  resolveParagraphHighlightSegments
} from '../utils/highlightSpans';
import { VoiceDictationButton } from '../components/VoiceDictationButton';

const TRACK_LABELS: Record<AmbientTrackId, string> = {
  adaptive: 'Scene Mood (Auto)',
  fireplace: 'Hearth Fire',
  rain: 'Night Rain',
  mythic_drone: 'Ambient Drone',
  silence: 'Muted'
};

const MOOD_LABELS: Record<SceneMood, string> = {
  neutral: 'Normal Scene (Silent)',
  suspense: 'Suspense Spot (Playing)',
  action: 'Tense Action (Playing)',
  storm: 'Storm Scene (Playing)'
};

const HIGHLIGHT_STYLES: Record<HighlightColor, { border: string; bg: string; mark: string; label: string; dot: string }> = {
  terracotta: {
    border: 'border-l-4 border-[#C85A32]',
    bg: 'bg-[#C85A32]/10',
    mark: 'bg-[#C85A32]/25 decoration-[#C85A32]/70',
    label: 'Terracotta',
    dot: 'bg-[#C85A32]'
  },
  gold: {
    border: 'border-l-4 border-amber-500',
    bg: 'bg-amber-500/12',
    mark: 'bg-amber-400/32 decoration-amber-500/80',
    label: 'Ochre Gold',
    dot: 'bg-amber-500'
  },
  sage: {
    border: 'border-l-4 border-emerald-600',
    bg: 'bg-emerald-600/10',
    mark: 'bg-emerald-500/24 decoration-emerald-600/75',
    label: 'Forest Sage',
    dot: 'bg-emerald-600'
  }
};

export const ReaderView: React.FC = () => {
  const {
    stories,
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
    updateHighlight,
    removeHighlight,
    paragraphBookmarks,
    saveParagraphBookmark,
    removeParagraphBookmark,
    chapterComments,
    loadChapterComments,
    addChapterComment,
    deleteChapterComment
  } = useApp();

  const [scrollProgress, setScrollProgress] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [bookmarksDrawerOpen, setBookmarksDrawerOpen] = useState(false);
  const [highlightsDrawerOpen, setHighlightsDrawerOpen] = useState(false);
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
  const [ttsCurrentTime, setTtsCurrentTime] = useState(0);
  const [ttsDuration, setTtsDuration] = useState(0);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Highlight, Text Selection & Annotation popover state
  const [editingParagraphIdx, setEditingParagraphIdx] = useState<number | null>(null);
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    paragraphIndex: number;
    startOffset: number;
    endOffset: number;
    selectedText: string;
  } | null>(null);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('terracotta');
  const [noteDraft, setNoteDraft] = useState('');

  // Paragraph / Section Bookmark editor & deep-link focus state
  const [bookmarkingParagraphIdx, setBookmarkingParagraphIdx] = useState<number | null>(null);
  const [bookmarkLabelDraft, setBookmarkLabelDraft] = useState('');
  const [focusedParagraphIdx, setFocusedParagraphIdx] = useState<number | null>(null);
  const [focusedHighlightId, setFocusedHighlightId] = useState<string | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  // Chapter Discussion state
  const [commentTag, setCommentTag] = useState<CommentTag>('Reaction');
  const [commentDraft, setCommentDraft] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentFilterChapterId, setCommentFilterChapterId] = useState<string>('current');
  const [commentTargetChapterId, setCommentTargetChapterId] = useState<string>('');

  // Scene-adaptive mood tracking state & debounced middleware
  const [activeParagraphIdx, setActiveParagraphIdx] = useState(0);
  const [detectedMood, setDetectedMood] = useState<SceneMood>('neutral');
  const [moodPreviewActive, setMoodPreviewActive] = useState(false);
  const activeIdxRef = useRef(0);
  const lastRecordedPercentRef = useRef(-1);
  const audioMiddlewareRef = useRef<NarrativeAudioMiddleware | null>(null);
  if (!audioMiddlewareRef.current) {
    audioMiddlewareRef.current = new NarrativeAudioMiddleware();
  }

  const chapterData = getChapter(routeParams.slug || '', routeParams.chapterNumber || 1);
  const storySlug = routeParams.slug || '';
  const chapterNumber = routeParams.chapterNumber || 1;
  const chapterId = chapterData?.chapter.id || '';
  const storyId = chapterData?.story.id || '';

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
      setCommentFilterChapterId('current');
      setCommentTargetChapterId(chapterId);
    }
  }, [chapterId]);

  useEffect(() => {
    if (!chapterId) return;
    const scopeChapterId =
      commentFilterChapterId === 'current' ? chapterId : commentFilterChapterId;
    void loadChapterComments(scopeChapterId, storyId);
  }, [chapterId, storyId, commentFilterChapterId, loadChapterComments]);

  const isChapterLogged = Boolean(
    chapterId && user.readingGoal.completedChapterIds?.includes(chapterId)
  );

  // Sync Web Audio Ambient Soundscape (separate start/track from volume ticks)
  useEffect(() => {
    if (!readerSettings.ambientSound || readerSettings.ambientTrack === 'silence') {
      ambientAudio.stop();
      setMoodPreviewActive(false);
      return;
    }

    if (readerSettings.ambientTrack === 'adaptive') {
      ambientAudio.start('adaptive', readerSettings.ambientVolume);
    } else {
      setMoodPreviewActive(false);
      ambientAudio.start(readerSettings.ambientTrack, readerSettings.ambientVolume);
    }
  }, [readerSettings.ambientSound, readerSettings.ambientTrack]);

  useEffect(() => {
    ambientAudio.setVolume(readerSettings.ambientVolume);
  }, [readerSettings.ambientVolume]);

  useEffect(() => {
    return () => {
      audioMiddlewareRef.current?.dispose();
      ambientAudio.stop();
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
      }
      if (focusTimerRef.current) {
        window.clearTimeout(focusTimerRef.current);
      }
    };
  }, []);

  // Scroll depth tracking throttled per animation frame to avoid jank while reading
  useEffect(() => {
    let rafId: number | null = null;
    const updateScroll = () => {
      rafId = null;
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0 && chapterData) {
        const current = (window.scrollY / totalHeight) * 100;
        const bounded = Math.min(100, Math.max(0, current));
        const rounded = Math.round(bounded);

        if (rounded !== lastRecordedPercentRef.current) {
          lastRecordedPercentRef.current = rounded;
          setScrollProgress(rounded);

          const accessible = !chapterLocked && hasAccessToChapter(chapterData.story, chapterData.chapter);
          if (accessible) {
            recordReadingProgress(
              chapterData.story.id,
              chapterData.chapter.id,
              chapterData.chapter.chapterNumber,
              rounded
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
      }
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(updateScroll);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
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
    setEditingHighlightId(null);
    setPendingSelection(null);
    setBookmarkingParagraphIdx(null);
    setBookmarksDrawerOpen(false);
    setHighlightsDrawerOpen(false);
    setFocusedParagraphIdx(null);
    setFocusedHighlightId(null);
    setAutoCompletedToast(false);
    activeIdxRef.current = 0;
    lastRecordedPercentRef.current = -1;
    setActiveParagraphIdx(0);
    setDetectedMood('neutral');
    setMoodPreviewActive(false);
    audioMiddlewareRef.current?.reset();
    setTtsError(null);
    setTtsCurrentTime(0);
    setTtsDuration(0);
    setTtsAudioSrc((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setTtsPlaying(false);
    setScrollProgress(0);
    if (routeParams.paragraph === undefined) {
      window.scrollTo({ top: 0 });
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.removeAttribute('src');
      ttsAudioRef.current.load();
    }
  }, [chapterId]);

  useEffect(() => {
    return () => {
      if (ttsAudioSrc && ttsAudioSrc.startsWith('blob:')) {
        URL.revokeObjectURL(ttsAudioSrc);
      }
    };
  }, [ttsAudioSrc]);

  const activeChapter = serverChapter || chapterData?.chapter;
  const activeParagraphs = activeChapter?.content || [];
  const activeIsAccessible = Boolean(
    chapterData && activeChapter && !chapterLocked && hasAccessToChapter(chapterData.story, activeChapter)
  );
  const activeParagraphBookmarks = paragraphBookmarks
    .filter(b => b.chapterId === (activeChapter?.id || ''))
    .sort((a, b) => a.paragraphIndex - b.paragraphIndex);

  const jumpToParagraph = (paragraphIdx: number, openLabelEditor = false, highlightId?: string) => {
    setBookmarksDrawerOpen(false);
    setHighlightsDrawerOpen(false);
    const el =
      document.getElementById(`paragraph-${paragraphIdx}`) ||
      document.querySelector<HTMLElement>(`[data-paragraph-idx="${paragraphIdx}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setFocusedParagraphIdx(paragraphIdx);
    setFocusedHighlightId(highlightId || null);
    if (focusTimerRef.current) {
      window.clearTimeout(focusTimerRef.current);
    }
    focusTimerRef.current = window.setTimeout(() => {
      setFocusedParagraphIdx(null);
      setFocusedHighlightId(null);
    }, 2800);

    if (openLabelEditor) {
      const existing = activeParagraphBookmarks.find(b => b.paragraphIndex === paragraphIdx);
      setBookmarkLabelDraft(existing?.label || '');
      setBookmarkingParagraphIdx(paragraphIdx);
      setEditingParagraphIdx(null);
      setEditingHighlightId(null);
    }
  };

  // Automatically scroll to ?paragraph=N (and optional ?highlight=ID) when arriving from a saved bookmark or note deep link
  useEffect(() => {
    const targetPara = routeParams.paragraph;
    if (
      typeof targetPara !== 'number' ||
      chapterLoading ||
      !activeIsAccessible ||
      targetPara < 0 ||
      targetPara >= activeParagraphs.length
    ) {
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      jumpToParagraph(targetPara, false, routeParams.highlight);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [routeParams.paragraph, routeParams.highlight, chapterLoading, activeIsAccessible, activeParagraphs.length, chapterId]);

  // Observe visible paragraph so Scene Mood (Auto) updates activeIdx only when settled on a new paragraph
  useEffect(() => {
    if (!activeIsAccessible || activeParagraphs.length === 0) {
      setDetectedMood('neutral');
      return;
    }

    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-paragraph-idx]'));
    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const visibleScores = new Map<number, number>();
    let focalRafId: number | null = null;

    const commitFocalParagraph = () => {
      focalRafId = null;
      if (visibleScores.size === 0) return;
      let bestIdx = activeIdxRef.current;
      let bestRatio = -1;
      for (const [idx, ratio] of visibleScores.entries()) {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestIdx = idx;
        }
      }
      if (bestIdx !== activeIdxRef.current) {
        activeIdxRef.current = bestIdx;
        setActiveParagraphIdx(bestIdx);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number(entry.target.getAttribute('data-paragraph-idx'));
          if (!Number.isFinite(idx)) continue;
          if (entry.isIntersecting) {
            visibleScores.set(idx, entry.intersectionRatio);
          } else {
            visibleScores.delete(idx);
          }
        }
        if (focalRafId === null && visibleScores.size > 0) {
          focalRafId = window.requestAnimationFrame(commitFocalParagraph);
        }
      },
      {
        rootMargin: '-22% 0px -42% 0px',
        threshold: [0.15, 0.5, 0.85]
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      if (focalRafId !== null) {
        window.cancelAnimationFrame(focalRafId);
      }
    };
  }, [activeIsAccessible, chapterId, activeParagraphs.length]);

  // Evaluate mood transitions through debounced NarrativeAudioMiddleware (hysteresis prevents rapid stutters)
  const prevAdaptiveKeyRef = useRef('');
  useEffect(() => {
    const middleware = audioMiddlewareRef.current;
    if (!middleware) return;

    const adaptiveEnabled =
      activeIsAccessible &&
      activeParagraphs.length > 0 &&
      readerSettings.ambientSound &&
      readerSettings.ambientTrack === 'adaptive';

    if (moodPreviewActive) {
      setDetectedMood('suspense');
      if (readerSettings.ambientSound && readerSettings.ambientTrack === 'adaptive') {
        ambientAudio.setSceneMood('suspense', readerSettings.ambientVolume, 0.75);
      }
      return;
    }

    if (!activeIsAccessible || activeParagraphs.length === 0) {
      middleware.evaluate([], 0, {
        enabled: false,
        immediate: true,
        onApply: () => {
          setDetectedMood('neutral');
          if (readerSettings.ambientSound && readerSettings.ambientTrack === 'adaptive') {
            ambientAudio.setSceneMood('neutral', readerSettings.ambientVolume, 0.2);
          }
        }
      });
      return;
    }

    const modeKey = `${chapterId}:${adaptiveEnabled}`;
    const isModeOrChapterChange = prevAdaptiveKeyRef.current !== modeKey;
    prevAdaptiveKeyRef.current = modeKey;

    middleware.evaluate(activeParagraphs, activeParagraphIdx, {
      enabled: adaptiveEnabled,
      immediate: isModeOrChapterChange,
      debounceMs: 550,
      minIntensityDelta: 0.22,
      cooldownMs: 1200,
      onApply: (analysis) => {
        const currentText = activeParagraphs[analysis.paragraphIndex] || '';
        const sceneMood = adaptiveEnabled ? toSceneMood(analysis, currentText) : 'neutral';
        setDetectedMood(sceneMood);
        if (adaptiveEnabled) {
          const scaledVolume = readerSettings.ambientVolume * (0.68 + analysis.intensity * 0.32);
          ambientAudio.setSceneMood(sceneMood, scaledVolume, analysis.intensity);
        }
      }
    });
  }, [
    chapterId,
    activeIsAccessible,
    activeParagraphs,
    activeParagraphIdx,
    moodPreviewActive,
    readerSettings.ambientSound,
    readerSettings.ambientTrack,
    readerSettings.ambientVolume
  ]);

  const askLorekeeper = async (mode: 'recap' | 'ask', customQuestion?: string) => {
    if (!chapterData) return;
    const { story, chapter } = chapterData;
    const q = (customQuestion ?? loreQuestion).trim();
    if (mode === 'ask' && !q) return;

    setCompanionLoading(true);
    setCompanionError(null);

    try {
      const res = await apiFetch('/api/ai/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const decodeBase64ToBlobUrl = (base64: string, mimeType: string): string => {
    const clean = base64.replace(/\s+/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  };

  const handleNarrateChapter = async () => {
    if (!chapterData) return;
    const { story, chapter } = chapterData;

    if (ttsAudioSrc && ttsAudioRef.current) {
      if (ttsPlaying) {
        ttsAudioRef.current.pause();
        setTtsPlaying(false);
      } else {
        try {
          await ttsAudioRef.current.play();
          setTtsPlaying(true);
        } catch {
          setTtsError('Tap Play Audio again to start browser playback.');
        }
      }
      return;
    }

    setTtsLoading(true);
    setTtsError(null);

    try {
      const res = await apiFetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      if (!data.audioBase64) {
        throw new Error('No audio stream returned for this chapter.');
      }

      const blobUrl = decodeBase64ToBlobUrl(data.audioBase64, data.mimeType || 'audio/wav');
      setTtsAudioSrc((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return blobUrl;
      });

      if (ttsAudioRef.current) {
        ttsAudioRef.current.src = blobUrl;
        ttsAudioRef.current.load();
        try {
          await ttsAudioRef.current.play();
          setTtsPlaying(true);
        } catch {
          // If mobile browser blocks autoplay after async fetch, audio is loaded and user can tap Play Audio immediately
          setTtsPlaying(false);
          setTtsError('Audio ready. Press Play Audio to listen.');
        }
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
  const storyOtherHighlights = highlights
    .filter(h => h.storyId === story.id && h.chapterId !== chapter.id)
    .sort((a, b) => a.chapterNumber - b.chapterNumber || a.paragraphIndex - b.paragraphIndex);
  const chapterParagraphBookmarks = activeParagraphBookmarks;
  const storyOtherParagraphBookmarks = paragraphBookmarks
    .filter(b => b.storyId === story.id && b.chapterId !== chapter.id)
    .sort((a, b) => a.chapterNumber - b.chapterNumber || a.paragraphIndex - b.paragraphIndex);
  const effectiveFilterChapterId =
    commentFilterChapterId === 'current' ? chapter.id : commentFilterChapterId;
  const activeComments =
    effectiveFilterChapterId === 'all'
      ? chapterComments.filter(c => c.storyId === story.id)
      : chapterComments.filter(c => c.chapterId === effectiveFilterChapterId);
  const targetPostChapter =
    story.chapters.find(c => c.id === commentTargetChapterId) || chapter;

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

  const openParagraphEditor = (idx: number, highlightToEdit?: TextHighlight) => {
    if (!highlightToEdit && editingParagraphIdx === idx && editingHighlightId === null && !pendingSelection) {
      setEditingParagraphIdx(null);
      return;
    }
    if (highlightToEdit && editingHighlightId === highlightToEdit.id && editingParagraphIdx === idx) {
      setEditingParagraphIdx(null);
      setEditingHighlightId(null);
      return;
    }
    setBookmarkingParagraphIdx(null);
    const fallbackBlock = highlightToEdit || chapterHighlights.find(h => h.paragraphIndex === idx && typeof h.startOffset !== 'number');
    setEditingHighlightId(fallbackBlock?.id || null);
    setPendingSelection(null);
    setSelectedColor(fallbackBlock?.color || 'terracotta');
    setNoteDraft(fallbackBlock?.note || '');
    setEditingParagraphIdx(idx);
  };

  const handleParagraphSelectionRelease = () => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const startEl =
      range.startContainer instanceof HTMLElement
        ? range.startContainer.closest<HTMLElement>('[data-paragraph-text-idx]')
        : range.startContainer.parentElement?.closest<HTMLElement>('[data-paragraph-text-idx]');
    const endEl =
      range.endContainer instanceof HTMLElement
        ? range.endContainer.closest<HTMLElement>('[data-paragraph-text-idx]')
        : range.endContainer.parentElement?.closest<HTMLElement>('[data-paragraph-text-idx]');

    if (!startEl || !endEl || startEl !== endEl) return;
    const paraIdx = Number(startEl.getAttribute('data-paragraph-text-idx'));
    if (!Number.isInteger(paraIdx) || paraIdx < 0) return;

    const measured = measureSelectionInParagraphElement(startEl, range);
    if (!measured) return;

    setBookmarkingParagraphIdx(null);
    setEditingHighlightId(null);
    setEditingParagraphIdx(null);
    setPendingSelection({
      paragraphIndex: paraIdx,
      ...measured,
    });
  };

  const commitQuickSelectionHighlight = (
    selection: { paragraphIndex: number; startOffset: number; endOffset: number; selectedText: string },
    color: HighlightColor
  ) => {
    const paragraphText = paragraphs[selection.paragraphIndex] || selection.selectedText;
    saveHighlight({
      storyId: story.id,
      storyTitle: story.title,
      storySlug: story.slug,
      chapterId: chapter.id,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.title,
      paragraphIndex: selection.paragraphIndex,
      excerpt: paragraphText,
      selectedText: selection.selectedText,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
      color,
    });
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const openSelectionNoteComposer = (
    selection: { paragraphIndex: number; startOffset: number; endOffset: number; selectedText: string },
    initialColor: HighlightColor = 'terracotta'
  ) => {
    setSelectedColor(initialColor);
    setNoteDraft('');
    setEditingHighlightId(null);
    setEditingParagraphIdx(selection.paragraphIndex);
    window.getSelection()?.removeAllRanges();
  };

  const openBookmarkEditor = (idx: number) => {
    if (bookmarkingParagraphIdx === idx) {
      setBookmarkingParagraphIdx(null);
      return;
    }
    setEditingParagraphIdx(null);
    setEditingHighlightId(null);
    setPendingSelection(null);
    const existing = chapterParagraphBookmarks.find(b => b.paragraphIndex === idx);
    setBookmarkLabelDraft(existing?.label || '');
    setBookmarkingParagraphIdx(idx);
  };

  const handleToggleOrMarkParagraph = (idx: number, paragraphText: string) => {
    const existing = chapterParagraphBookmarks.find(b => b.paragraphIndex === idx);
    if (existing) {
      openBookmarkEditor(idx);
      return;
    }
    saveParagraphBookmark({
      storyId: story.id,
      storyTitle: story.title,
      storySlug: story.slug,
      chapterId: chapter.id,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.title,
      paragraphIndex: idx,
      excerpt: paragraphText
    });
    setEditingParagraphIdx(null);
    setEditingHighlightId(null);
    setPendingSelection(null);
    setBookmarkLabelDraft('');
    setBookmarkingParagraphIdx(idx);
  };

  return (
    <div className={`min-h-screen ${themeStyles.canvas} transition-colors duration-200 selection:bg-[#C85A32]/25`}>
      <audio
        ref={ttsAudioRef}
        preload="auto"
        onEnded={() => setTtsPlaying(false)}
        onPause={() => setTtsPlaying(false)}
        onPlay={() => {
          setTtsPlaying(true);
          setTtsError(null);
        }}
        onLoadedMetadata={(e) => setTtsDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setTtsCurrentTime(e.currentTarget.currentTime || 0)}
        onError={() => {
          if (ttsAudioSrc) {
            setTtsPlaying(false);
            setTtsError('Browser audio playback failed. Try another voice or click Play Audio again.');
          }
        }}
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
      <header className={`sticky top-1 z-40 w-full backdrop-blur-md border-b ${themeStyles.bar} transition-colors px-2.5 sm:px-4 py-2 sm:py-2.5`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3 text-xs font-sans-ui">
          <a
            href={buildHref('story-detail', { slug: story.slug })}
            onClick={(e) => handleLink(e, 'story-detail', { slug: story.slug })}
            className="flex items-center gap-1 hover:text-[#C85A32] transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Exit</span>
          </a>

          <div className="flex items-center gap-1.5 sm:gap-2 text-center truncate px-1 sm:px-2 min-w-0">
            <span className="font-semibold truncate max-w-[82px] sm:max-w-xs">{story.title}</span>
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

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div role="group" aria-label="Reader color theme" className="flex items-center bg-current/5 p-0.5 rounded-lg border border-current/15 text-[10px] sm:text-[11px]">
              <button
                type="button"
                onClick={() => updateReaderSettings({ theme: 'day' })}
                aria-label="Day theme"
                aria-pressed={readerSettings.theme === 'day'}
                className={`px-1.5 sm:px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
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
                className={`px-1.5 sm:px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
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
                className={`px-1.5 sm:px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                  readerSettings.theme === 'night' ? 'bg-[#231323] text-white shadow-xs font-semibold' : 'opacity-65 hover:opacity-100'
                }`}
              >
                <Moon className="w-3 h-3" />
                <span className="hidden md:inline">Night</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setBookmarksDrawerOpen(!bookmarksDrawerOpen);
                setHighlightsDrawerOpen(false);
                setControlsOpen(false);
                setAudioDrawerOpen(false);
                setCompanionOpen(false);
              }}
              aria-expanded={bookmarksDrawerOpen}
              aria-label="Chapter and paragraph bookmarks"
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                bookmarksDrawerOpen || isBookmarked || chapterParagraphBookmarks.length > 0
                  ? 'text-[#C85A32] bg-[#C85A32]/12 font-semibold'
                  : 'opacity-80 hover:opacity-100 hover:text-[#C85A32]'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked || chapterParagraphBookmarks.length > 0 ? 'fill-current' : ''}`} />
              {chapterParagraphBookmarks.length > 0 && (
                <span className="text-[11px] font-semibold tabular-nums">
                  {chapterParagraphBookmarks.length}
                </span>
              )}
              <span className="hidden lg:inline">Bookmarks</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHighlightsDrawerOpen(!highlightsDrawerOpen);
                setBookmarksDrawerOpen(false);
                setControlsOpen(false);
                setAudioDrawerOpen(false);
                setCompanionOpen(false);
              }}
              aria-expanded={highlightsDrawerOpen}
              aria-label="Highlights and reading notes"
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                highlightsDrawerOpen || chapterHighlights.length > 0
                  ? 'text-[#C85A32] bg-[#C85A32]/12 font-semibold'
                  : 'opacity-80 hover:opacity-100 hover:text-[#C85A32]'
              }`}
            >
              <Highlighter className="w-4 h-4" />
              {chapterHighlights.length > 0 && (
                <span className="text-[11px] font-semibold tabular-nums">
                  {chapterHighlights.length}
                </span>
              )}
              <span className="hidden lg:inline">Notes</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAudioDrawerOpen(!audioDrawerOpen);
                setBookmarksDrawerOpen(false);
                setHighlightsDrawerOpen(false);
                setControlsOpen(false);
                setCompanionOpen(false);
              }}
              aria-expanded={audioDrawerOpen}
              aria-label="Audio narration and adaptive scene mood audio"
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                audioDrawerOpen || readerSettings.ambientSound || ttsPlaying
                  ? 'text-[#C85A32] bg-[#C85A32]/15 font-semibold'
                  : 'opacity-80 hover:opacity-100 hover:text-[#C85A32]'
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span className="hidden lg:inline">
                {ttsPlaying
                  ? 'Narrating'
                  : readerSettings.ambientSound && readerSettings.ambientTrack === 'adaptive' && detectedMood !== 'neutral'
                  ? 'Mood Active'
                  : 'Audio'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCompanionOpen(!companionOpen);
                setBookmarksDrawerOpen(false);
                setHighlightsDrawerOpen(false);
                setControlsOpen(false);
                setAudioDrawerOpen(false);
              }}
              aria-expanded={companionOpen}
              aria-label="Ask about this chapter"
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
                setBookmarksDrawerOpen(false);
                setHighlightsDrawerOpen(false);
                setCompanionOpen(false);
                setAudioDrawerOpen(false);
              }}
              aria-expanded={controlsOpen}
              aria-label="Typography settings"
              className="p-1.5 rounded opacity-80 hover:opacity-100 hover:text-[#C85A32] transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Settings2 className="w-4 h-4" />
              <span className="font-serif">Aa</span>
            </button>
          </div>
        </div>

        {/* Highlights & Personal Annotations Drawer */}
        {highlightsDrawerOpen && (
          <div className="max-w-xl mx-auto mt-2 p-5 rounded-xl border transition-all text-xs space-y-4 shadow-xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border-[#C85A32]/25 text-slate-800 dark:text-slate-100 sepia:text-[#2C1E18]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Highlighter className="w-4 h-4 text-[#C85A32]" />
                <div>
                  <span className="font-display text-sm font-bold block">Highlights &amp; Annotations</span>
                  <span className="text-[11px] opacity-65">
                    Select any text while reading to highlight or attach thoughts
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHighlightsDrawerOpen(false)}
                className="text-xs text-[#C85A32] font-semibold hover:underline cursor-pointer"
              >
                Close &times;
              </button>
            </div>

            <div className="p-3 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-current/10 flex flex-wrap items-center justify-between gap-2">
              {isAuthenticated ? (
                <div className="flex items-center gap-2 text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Notes saved to <strong className="text-[#C85A32]">{getDisplayName(user)}</strong>&rsquo;s account
                  </span>
                </div>
              ) : (
                <>
                  <span className="text-[11px] opacity-75">
                    Saved locally on this browser. Sign in to sync notes to your account.
                  </span>
                  <a
                    href={buildHref('account', {
                      redirect: buildHref('reader', { slug: story.slug, chapterNumber: chapter.chapterNumber })
                    })}
                    onClick={(e) => {
                      setHighlightsDrawerOpen(false);
                      handleLink(e, 'account', {
                        redirect: buildHref('reader', { slug: story.slug, chapterNumber: chapter.chapterNumber })
                      });
                    }}
                    className="px-3 py-1 rounded-md bg-[#C85A32] text-white font-semibold text-[11px] shrink-0"
                  >
                    Sign In to Sync
                  </a>
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold opacity-75">
                <span>Annotated Passages in Chapter {chapter.chapterNumber}</span>
                <span className="tabular-nums">{chapterHighlights.length}</span>
              </div>

              {chapterHighlights.length === 0 ? (
                <p className="p-3.5 rounded-lg border border-dashed border-current/15 text-[11px] opacity-70 leading-relaxed">
                  Select a phrase in the text or click <strong className="text-[#C85A32]">Highlight / Note</strong> beside any paragraph to save a passage thought.
                </p>
              ) : (
                <div className="divide-y divide-current/10 border border-current/12 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  {chapterHighlights.map((hl) => (
                    <div key={hl.id} className="p-3 space-y-1.5 hover:bg-current/[0.03] transition-colors">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => jumpToParagraph(hl.paragraphIndex, false, hl.id)}
                          className="flex items-center gap-1.5 font-semibold text-[#C85A32] hover:underline cursor-pointer"
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${HIGHLIGHT_STYLES[hl.color].dot}`} />
                          <span className="font-mono tabular-nums">Para. {hl.paragraphIndex + 1}</span>
                          {hl.selectedText && <span className="opacity-70 font-sans-ui font-normal">&middot; Selected Passage</span>}
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setHighlightsDrawerOpen(false);
                              jumpToParagraph(hl.paragraphIndex, false, hl.id);
                              openParagraphEditor(hl.paragraphIndex, hl);
                            }}
                            className="text-[11px] font-semibold text-[#C85A32] hover:underline cursor-pointer"
                          >
                            {hl.note ? 'Edit Note' : 'Add Note'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeHighlight(hl.id)}
                            aria-label="Remove highlight"
                            className="p-1 opacity-60 hover:opacity-100 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="font-reader text-xs italic opacity-85 line-clamp-2">
                        &ldquo;{hl.selectedText || hl.excerpt}&rdquo;
                      </p>

                      {hl.note && (
                        <p className="text-[11px] px-2.5 py-1.5 rounded bg-current/[0.04] leading-snug">
                          <strong className="text-[#C85A32] mr-1">Thought:</strong>
                          {hl.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {storyOtherHighlights.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-current/10">
                <span className="text-[11px] font-semibold opacity-70 block">
                  Notes in Other Chapters of {story.title}
                </span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {storyOtherHighlights.map((hl) => (
                    <a
                      key={hl.id}
                      href={buildHref('reader', {
                        slug: story.slug,
                        chapterNumber: hl.chapterNumber,
                        paragraph: hl.paragraphIndex,
                        highlight: hl.id
                      })}
                      onClick={(e) => {
                        setHighlightsDrawerOpen(false);
                        handleLink(e, 'reader', {
                          slug: story.slug,
                          chapterNumber: hl.chapterNumber,
                          paragraph: hl.paragraphIndex,
                          highlight: hl.id
                        });
                      }}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded hover:bg-current/[0.04] text-[11px]"
                    >
                      <span className="truncate">
                        <span className="font-semibold text-[#C85A32] tabular-nums">
                          Ch. {hl.chapterNumber} &middot; Para. {hl.paragraphIndex + 1}
                        </span>
                        {hl.note ? ` — ${hl.note}` : ` — “${hl.selectedText || hl.excerpt}”`}
                      </span>
                      <span className="text-[#C85A32] font-semibold shrink-0">Revisit &rarr;</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bookmarks & Marked Sections Drawer */}
        {bookmarksDrawerOpen && (
          <div className="max-w-xl mx-auto mt-2 p-5 rounded-xl border transition-all text-xs space-y-4 shadow-xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border-[#C85A32]/25 text-slate-800 dark:text-slate-100 sepia:text-[#2C1E18]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#C85A32]" />
                <div>
                  <span className="font-display text-sm font-bold block">Bookmarks &amp; Sections</span>
                  <span className="text-[11px] opacity-65">Save this chapter or jump to marked paragraphs</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookmarksDrawerOpen(false)}
                className="text-xs text-[#C85A32] font-semibold hover:underline cursor-pointer"
              >
                Close &times;
              </button>
            </div>

            <div className="p-3 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-current/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="font-semibold block truncate">
                  Chapter {chapter.chapterNumber}: {chapter.title}
                </span>
                <span className="text-[11px] opacity-65">
                  {isBookmarked ? 'Saved in your chapter bookmarks' : 'Mark the entire chapter for quick access'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleBookmark(chapter.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors ${
                  isBookmarked
                    ? 'bg-[#C85A32] text-white'
                    : 'border border-[#C85A32]/40 text-[#C85A32] hover:bg-[#C85A32] hover:text-white'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                <span>{isBookmarked ? 'Bookmarked' : 'Bookmark Chapter'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold opacity-75">
                <span>Marked Paragraphs in This Chapter</span>
                <span className="tabular-nums">{chapterParagraphBookmarks.length}</span>
              </div>

              {chapterParagraphBookmarks.length === 0 ? (
                <p className="p-3.5 rounded-lg border border-dashed border-current/15 text-[11px] opacity-70 leading-relaxed">
                  No passages marked in this chapter yet. Select <strong className="text-[#C85A32]">Bookmark</strong> on any paragraph while reading to mark a key section for reference.
                </p>
              ) : (
                <div className="divide-y divide-current/10 border border-current/12 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  {chapterParagraphBookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      className="p-3 flex items-start justify-between gap-3 hover:bg-current/[0.03] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => jumpToParagraph(bm.paragraphIndex)}
                        className="text-left flex-1 min-w-0 space-y-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-sans-ui">
                          <span className="font-mono font-semibold text-[#C85A32] tabular-nums">
                            Para. {bm.paragraphIndex + 1}
                          </span>
                          {bm.label && (
                            <>
                              <span className="opacity-40">&middot;</span>
                              <span className="font-semibold truncate">{bm.label}</span>
                            </>
                          )}
                        </div>
                        <p className="font-reader text-xs opacity-75 line-clamp-2 italic">
                          &ldquo;{bm.excerpt}&rdquo;
                        </p>
                      </button>

                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => jumpToParagraph(bm.paragraphIndex, true)}
                          className="text-[11px] font-semibold text-[#C85A32] hover:underline cursor-pointer"
                        >
                          {bm.label ? 'Rename' : 'Label'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeParagraphBookmark(bm.id)}
                          aria-label={`Remove bookmark at paragraph ${bm.paragraphIndex + 1}`}
                          className="p-1 opacity-60 hover:opacity-100 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {storyOtherParagraphBookmarks.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-current/10">
                <span className="text-[11px] font-semibold opacity-70 block">
                  Other Marked Sections in {story.title}
                </span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {storyOtherParagraphBookmarks.map((bm) => (
                    <a
                      key={bm.id}
                      href={buildHref('reader', {
                        slug: story.slug,
                        chapterNumber: bm.chapterNumber,
                        paragraph: bm.paragraphIndex
                      })}
                      onClick={(e) => {
                        setBookmarksDrawerOpen(false);
                        handleLink(e, 'reader', {
                          slug: story.slug,
                          chapterNumber: bm.chapterNumber,
                          paragraph: bm.paragraphIndex
                        });
                      }}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded hover:bg-current/[0.04] text-[11px]"
                    >
                      <span className="truncate">
                        <span className="font-semibold text-[#C85A32] tabular-nums">
                          Ch. {bm.chapterNumber} &middot; Para. {bm.paragraphIndex + 1}
                        </span>
                        {bm.label ? ` — ${bm.label}` : ''}
                      </span>
                      <span className="text-[#C85A32] font-semibold shrink-0">Jump &rarr;</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold flex items-center gap-1.5">
                  {readerSettings.ambientSound && readerSettings.ambientTrack !== 'silence' ? (
                    <Volume2 className="w-3.5 h-3.5 text-[#C85A32]" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 opacity-60" />
                  )}
                  <span>Scene Mood &amp; Ambient Audio</span>
                </span>
                <span className="text-[11px] font-mono text-[#C85A32]">
                  {readerSettings.ambientSound ? TRACK_LABELS[readerSettings.ambientTrack] : 'Muted'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(['adaptive', 'fireplace', 'rain', 'mythic_drone', 'silence'] as const).map(track => {
                  const isActive =
                    track === 'silence'
                      ? !readerSettings.ambientSound || readerSettings.ambientTrack === 'silence'
                      : readerSettings.ambientSound && readerSettings.ambientTrack === track;
                  return (
                    <button
                      key={track}
                      type="button"
                      onClick={() => {
                        if (track !== 'silence') {
                          ambientAudio.unlock();
                        }
                        setMoodPreviewActive(false);
                        updateReaderSettings({
                          ambientTrack: track,
                          ambientSound: track !== 'silence'
                        });
                      }}
                      className={`py-1.5 px-2 rounded-lg border text-center font-medium cursor-pointer transition-all text-[11px] ${
                        isActive ? 'bg-[#C85A32] text-white border-[#C85A32]' : 'border-current/15 hover:border-[#C85A32]'
                      }`}
                    >
                      {TRACK_LABELS[track]}
                    </button>
                  );
                })}
              </div>

              {readerSettings.ambientSound && readerSettings.ambientTrack === 'adaptive' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 pb-0.5 text-[11px] border-t border-current/10">
                  <div className="space-y-0.5">
                    <div className="font-semibold flex items-center gap-1.5">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          detectedMood === 'neutral' ? 'bg-slate-400' : 'bg-[#C85A32] animate-pulse'
                        }`}
                      />
                      <span>{MOOD_LABELS[detectedMood]}</span>
                    </div>
                    <p className="opacity-70 text-[10px]">
                      Stays silent on normal prose; swells softly during suspense, action, or storm spots.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      ambientAudio.unlock();
                      setMoodPreviewActive((prev) => !prev);
                    }}
                    className="px-2.5 py-1 rounded border border-[#C85A32]/40 text-[#C85A32] hover:bg-[#C85A32] hover:text-white transition-colors font-semibold text-[10px] cursor-pointer shrink-0"
                  >
                    {moodPreviewActive ? 'End Preview' : 'Preview Suspense'}
                  </button>
                </div>
              )}

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
                        setTtsAudioSrc((prev) => {
                          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                          return null;
                        });
                        setTtsCurrentTime(0);
                        setTtsDuration(0);
                        stopTtsNarration();
                        if (ttsAudioRef.current) {
                          ttsAudioRef.current.removeAttribute('src');
                          ttsAudioRef.current.load();
                        }
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
                        <span>{ttsAudioSrc ? 'Play Audio' : 'Listen to Chapter'}</span>
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

              {ttsAudioSrc && ttsDuration > 0 && (
                <div className="flex items-center gap-2.5 pt-1 text-[11px] font-mono">
                  <span className="tabular-nums opacity-75 w-10">
                    {Math.floor(ttsCurrentTime / 60)}:{String(Math.floor(ttsCurrentTime % 60)).padStart(2, '0')}
                  </span>
                  <input
                    type="range"
                    aria-label="Narration playback position"
                    min={0}
                    max={ttsDuration}
                    step={0.25}
                    value={Math.min(ttsCurrentTime, ttsDuration)}
                    onChange={(e) => {
                      const nextTime = Number(e.target.value);
                      setTtsCurrentTime(nextTime);
                      if (ttsAudioRef.current) {
                        ttsAudioRef.current.currentTime = nextTime;
                      }
                    }}
                    className="flex-1 accent-[#C85A32] cursor-pointer"
                  />
                  <span className="tabular-nums opacity-75 w-10 text-right">
                    {Math.floor(ttsDuration / 60)}:{String(Math.floor(ttsDuration % 60)).padStart(2, '0')}
                  </span>
                </div>
              )}

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
              <VoiceDictationButton
                compact
                label="Speak"
                disabled={!isAccessible || companionLoading}
                contextHint={`Question about ${story.title}, Chapter ${chapter.chapterNumber}: ${chapter.title}`}
                onTranscript={(text) => setLoreQuestion((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
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
              onMouseUp={handleParagraphSelectionRelease}
              onTouchEnd={handleParagraphSelectionRelease}
              className={`${fontClass} space-y-6 leading-relaxed`}
              style={{ fontSize: `${readerSettings.fontSize}px` }}
            >
              {paragraphs.map((paragraph, index) => {
                const paraHighlights = chapterHighlights.filter(h => h.paragraphIndex === index);
                const blockHighlight = paraHighlights.find(h => typeof h.startOffset !== 'number');
                const hlStyle = blockHighlight ? HIGHLIGHT_STYLES[blockHighlight.color] : null;
                const existingBookmark = chapterParagraphBookmarks.find(b => b.paragraphIndex === index);
                const isEditing = editingParagraphIdx === index;
                const activeEditTarget =
                  editingHighlightId !== null
                    ? paraHighlights.find(h => h.id === editingHighlightId)
                    : blockHighlight;
                const paraSelection =
                  pendingSelection && pendingSelection.paragraphIndex === index ? pendingSelection : null;
                const isBookmarkEditing = bookmarkingParagraphIdx === index;
                const isFocused = focusedParagraphIdx === index;
                const segments = resolveParagraphHighlightSegments(paragraph, paraHighlights);
                const hasAnyHighlight = paraHighlights.length > 0;

                return (
                  <div
                    key={index}
                    id={`paragraph-${index}`}
                    data-paragraph-idx={index}
                    className="group relative space-y-2 scroll-mt-24"
                  >
                    {paraSelection && !isEditing && (
                      <div
                        role="region"
                        aria-label="Highlight selected passage"
                        className={`p-3 rounded-xl border text-xs font-sans-ui flex flex-wrap items-center justify-between gap-3 shadow-lg ${themeStyles.panel}`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#C85A32] font-semibold block">
                            Selected Text
                          </span>
                          <p className="font-reader italic truncate opacity-85">
                            &ldquo;{paraSelection.selectedText}&rdquo;
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 mr-1">
                            {(['terracotta', 'gold', 'sage'] as const).map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => commitQuickSelectionHighlight(paraSelection, color)}
                                title={`Highlight ${HIGHLIGHT_STYLES[color].label}`}
                                aria-label={`Highlight selection in ${HIGHLIGHT_STYLES[color].label}`}
                                className={`w-5 h-5 rounded-full ${HIGHLIGHT_STYLES[color].dot} hover:scale-110 transition-transform cursor-pointer ring-1 ring-black/15`}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => openSelectionNoteComposer(paraSelection, 'terracotta')}
                            className="px-3 py-1.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold cursor-pointer inline-flex items-center gap-1"
                          >
                            <Highlighter className="w-3.5 h-3.5" />
                            <span>Highlight &amp; Add Note</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingSelection(null)}
                            className="px-2 py-1 opacity-65 hover:opacity-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div
                      className={`rounded-lg transition-all duration-300 ${
                        hlStyle
                          ? `${hlStyle.border} ${hlStyle.bg} pl-4 pr-3 py-2 ${isFocused ? 'ring-2 ring-[#C85A32]/70' : existingBookmark ? 'ring-1 ring-[#C85A32]/25' : ''}`
                          : isFocused
                          ? 'ring-2 ring-[#C85A32]/70 bg-[#C85A32]/[0.08] px-3 py-2 -mx-3'
                          : existingBookmark
                          ? 'bg-[#C85A32]/[0.045] ring-1 ring-[#C85A32]/20 px-3 py-2 -mx-3'
                          : 'hover:bg-current/[0.025] px-2 -mx-2 py-1'
                      }`}
                    >
                      {existingBookmark && (
                        <div className="flex items-center justify-between gap-2 text-[11px] font-sans-ui text-[#C85A32] pb-1.5 mb-2 border-b border-[#C85A32]/20">
                          <span className="flex items-center gap-1.5 font-semibold min-w-0">
                            <Bookmark className="w-3 h-3 fill-current shrink-0" />
                            <span className="truncate">
                              {existingBookmark.label ? existingBookmark.label : `Bookmarked · Para. ${index + 1}`}
                            </span>
                            {existingBookmark.label && (
                              <span className="opacity-65 font-normal tabular-nums shrink-0">
                                &middot; Para. {index + 1}
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              type="button"
                              onClick={() => openBookmarkEditor(index)}
                              className="hover:underline cursor-pointer"
                            >
                              {existingBookmark.label ? 'Rename' : 'Add label'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                removeParagraphBookmark(existingBookmark.id);
                                if (bookmarkingParagraphIdx === index) setBookmarkingParagraphIdx(null);
                              }}
                              className="opacity-75 hover:opacity-100 hover:text-red-500 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}

                      <p
                        data-paragraph-text-idx={index}
                        className={
                          index === 0
                            ? 'first-letter:text-5xl first-letter:font-display first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:text-[#C85A32]'
                            : ''
                        }
                      >
                        {segments.map((seg, segIdx) => {
                          if (!seg.highlight) {
                            return <React.Fragment key={segIdx}>{seg.text}</React.Fragment>;
                          }
                          const segHl = seg.highlight;
                          const isSpotlight = focusedHighlightId === segHl.id;
                          return (
                            <mark
                              key={segHl.id + '-' + segIdx}
                              data-highlight-id={segHl.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openParagraphEditor(index, segHl);
                              }}
                              title={segHl.note ? `Note: ${segHl.note}` : 'Click to add or edit note'}
                              className={`cursor-pointer underline decoration-2 underline-offset-4 transition-all ${HIGHLIGHT_STYLES[segHl.color].mark} ${
                                isSpotlight ? 'ring-2 ring-[#C85A32] rounded' : ''
                              }`}
                            >
                              {seg.text}
                            </mark>
                          );
                        })}
                      </p>

                      <div
                        className={`mt-1.5 flex items-center justify-end gap-4 transition-opacity ${
                          existingBookmark || hasAnyHighlight || isEditing || isBookmarkEditing
                            ? 'opacity-100'
                            : 'opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleOrMarkParagraph(index, paragraph)}
                          className="text-[11px] font-sans-ui text-[#C85A32] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Bookmark className={`w-3 h-3 ${existingBookmark ? 'fill-current' : ''}`} />
                          <span>{existingBookmark ? 'Edit Bookmark' : 'Bookmark'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openParagraphEditor(index)}
                          className="text-[11px] font-sans-ui text-[#C85A32] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Highlighter className="w-3 h-3" />
                          <span>{blockHighlight ? 'Edit Note' : 'Highlight / Note'}</span>
                        </button>
                      </div>
                    </div>

                    {!isEditing &&
                      paraHighlights
                        .filter((h) => Boolean(h.note || h.selectedText))
                        .map((hl) => (
                          <div
                            key={hl.id}
                            className={`ml-3 pl-3 py-1.5 border-l-2 text-xs font-sans-ui flex items-start justify-between gap-2 rounded-r transition-colors ${
                              hl.color === 'gold'
                                ? 'border-amber-500'
                                : hl.color === 'sage'
                                ? 'border-emerald-600'
                                : 'border-[#C85A32]'
                            } ${focusedHighlightId === hl.id ? 'bg-[#C85A32]/12 ring-1 ring-[#C85A32]/50' : 'bg-current/[0.025]'}`}
                          >
                            <div className="min-w-0 space-y-0.5">
                              {hl.selectedText && (
                                <span className="text-[11px] font-reader italic opacity-75 block truncate">
                                  &ldquo;{hl.selectedText}&rdquo;
                                </span>
                              )}
                              {hl.note ? (
                                <span className="block opacity-90">
                                  <strong className="text-[#C85A32] mr-1">Note:</strong>
                                  {hl.note}
                                </span>
                              ) : (
                                <span className="opacity-65 italic">Highlighted passage (no note yet)</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => openParagraphEditor(index, hl)}
                              className="text-[11px] font-semibold text-[#C85A32] hover:underline shrink-0 cursor-pointer"
                            >
                              {hl.note ? 'Edit' : 'Add Note'}
                            </button>
                          </div>
                        ))}

                    {isBookmarkEditing && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveParagraphBookmark({
                            storyId: story.id,
                            storyTitle: story.title,
                            storySlug: story.slug,
                            chapterId: chapter.id,
                            chapterNumber: chapter.chapterNumber,
                            chapterTitle: chapter.title,
                            paragraphIndex: index,
                            excerpt: paragraph,
                            label: bookmarkLabelDraft
                          });
                          setBookmarkingParagraphIdx(null);
                        }}
                        className={`p-4 rounded-xl border text-xs font-sans-ui space-y-3 ${themeStyles.panel}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor={`bookmark-label-${index}`} className="font-semibold flex items-center gap-1.5">
                            <Bookmark className="w-3.5 h-3.5 text-[#C85A32] fill-current" />
                            <span>Name Section Bookmark (Para. {index + 1})</span>
                          </label>
                          <span className="text-[10px] opacity-60">Optional label</span>
                        </div>
                        <input
                          id={`bookmark-label-${index}`}
                          type="text"
                          maxLength={120}
                          value={bookmarkLabelDraft}
                          onChange={(e) => setBookmarkLabelDraft(e.target.value)}
                          placeholder="e.g. The Council Oath, Key Clue, Turning Point..."
                          className="w-full px-3 py-2 rounded-lg border border-current/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                        />
                        <div className="flex items-center justify-between gap-2">
                          {existingBookmark ? (
                            <button
                              type="button"
                              onClick={() => {
                                removeParagraphBookmark(existingBookmark.id);
                                setBookmarkingParagraphIdx(null);
                              }}
                              className="text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove Bookmark</span>
                            </button>
                          ) : (
                            <span />
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setBookmarkingParagraphIdx(null)}
                              className="px-3 py-1.5 rounded-lg border border-current/20 opacity-80 hover:opacity-100 cursor-pointer"
                            >
                              Done
                            </button>
                            <button
                              type="submit"
                              className="px-3.5 py-1.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold cursor-pointer"
                            >
                              Save Label
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {isEditing && (
                      <div className={`p-4 rounded-xl border text-xs font-sans-ui space-y-3 ${themeStyles.panel}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Highlighter className="w-3.5 h-3.5 text-[#C85A32]" />
                            <span>
                              {activeEditTarget?.selectedText || paraSelection?.selectedText
                                ? 'Annotate Selected Passage'
                                : 'Highlight Passage & Margin Note'}
                            </span>
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

                        {(activeEditTarget?.selectedText || paraSelection?.selectedText) && (
                          <blockquote className="p-2.5 rounded-lg bg-current/[0.04] border-l-2 border-[#C85A32] font-reader text-xs italic opacity-85">
                            &ldquo;{activeEditTarget?.selectedText || paraSelection?.selectedText}&rdquo;
                          </blockquote>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor={`note-draft-${index}`} className="font-semibold text-[11px] opacity-75">
                            Personal Note ({isAuthenticated ? 'Saved to Account' : 'Saved Locally'})
                          </label>
                          <VoiceDictationButton
                            compact
                            label="Dictate Note"
                            contextHint={`Margin note for ${story.title}, Chapter ${chapter.chapterNumber}`}
                            onTranscript={(text) => setNoteDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
                          />
                        </div>
                        <textarea
                          id={`note-draft-${index}`}
                          rows={2}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Write your thoughts on this passage..."
                          className="w-full px-3 py-2 rounded-lg border border-current/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                        />

                        <div className="flex items-center justify-between gap-2">
                          {activeEditTarget ? (
                            <button
                              type="button"
                              onClick={() => {
                                removeHighlight(activeEditTarget.id);
                                setEditingParagraphIdx(null);
                                setEditingHighlightId(null);
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
                              onClick={() => {
                                setEditingParagraphIdx(null);
                                setEditingHighlightId(null);
                                setPendingSelection(null);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-current/20 opacity-80 hover:opacity-100 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (activeEditTarget) {
                                  updateHighlight(activeEditTarget.id, {
                                    color: selectedColor,
                                    note: noteDraft.trim() || null
                                  });
                                } else {
                                  saveHighlight({
                                    storyId: story.id,
                                    storyTitle: story.title,
                                    storySlug: story.slug,
                                    chapterId: chapter.id,
                                    chapterNumber: chapter.chapterNumber,
                                    chapterTitle: chapter.title,
                                    paragraphIndex: index,
                                    excerpt: paragraph,
                                    selectedText: paraSelection?.selectedText,
                                    startOffset: paraSelection?.startOffset,
                                    endOffset: paraSelection?.endOffset,
                                    color: selectedColor,
                                    note: noteDraft.trim() || undefined
                                  });
                                }
                                setEditingParagraphIdx(null);
                                setEditingHighlightId(null);
                                setPendingSelection(null);
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold cursor-pointer"
                            >
                              Save Note
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

          {/* Story & Chapter Reader Comments Section */}
          <section
            aria-labelledby="reader-comments-heading"
            className="pt-8 border-t border-current/15 space-y-5 font-sans-ui"
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h2
                  id="reader-comments-heading"
                  className="font-display text-2xl font-bold flex items-center gap-2"
                >
                  <MessageSquare className="w-5 h-5 text-[#C85A32]" />
                  <span>
                    {effectiveFilterChapterId === 'all'
                      ? `${story.title} Comments`
                      : `Chapter ${
                          story.chapters.find(c => c.id === effectiveFilterChapterId)?.chapterNumber ||
                          chapter.chapterNumber
                        } Comments`}
                  </span>
                </h2>
                <p className="text-xs opacity-70 mt-0.5">
                  Post text feedback on specific chapters and read thoughts from other Lorethos readers.
                </p>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto">
                <label htmlFor="comment-chapter-filter" className="sr-only">
                  Filter comments by chapter
                </label>
                <select
                  id="comment-chapter-filter"
                  value={commentFilterChapterId}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setCommentFilterChapterId(nextVal);
                    if (nextVal !== 'all') {
                      setCommentTargetChapterId(nextVal === 'current' ? chapter.id : nextVal);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-current/20 bg-transparent text-xs focus:outline-none focus:border-[#C85A32] cursor-pointer"
                >
                  <option value="current" className="bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5]">
                    Current: Chapter {chapter.chapterNumber}
                  </option>
                  <option value="all" className="bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5]">
                    All Chapters ({story.chapters.length})
                  </option>
                  {story.chapters.map((ch) => (
                    <option
                      key={ch.id}
                      value={ch.id}
                      className="bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5]"
                    >
                      Ch. {ch.chapterNumber}: {ch.title}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-mono opacity-65 tabular-nums whitespace-nowrap">
                  {activeComments.length} {activeComments.length === 1 ? 'Comment' : 'Comments'}
                </span>
              </div>
            </div>

            {!isAuthenticated ? (
              <div className="p-4 rounded-xl border border-current/15 bg-current/[0.03] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span>
                  Log in as a Lorethos reader to share chapter feedback on {story.title}.
                </span>
                <a
                  href={buildHref('account', {
                    redirect: buildHref('reader', { slug: story.slug, chapterNumber: chapter.chapterNumber })
                  })}
                  onClick={(e) =>
                    handleLink(e, 'account', {
                      redirect: buildHref('reader', { slug: story.slug, chapterNumber: chapter.chapterNumber })
                    })
                  }
                  className="px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold self-start sm:self-auto whitespace-nowrap transition-colors"
                >
                  Log In to Comment &rarr;
                </a>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!commentDraft.trim() || commentSubmitting) return;
                  setCommentError(null);
                  setCommentSubmitting(true);
                  const res = await addChapterComment({
                    storyId: story.id,
                    chapterId: targetPostChapter.id,
                    chapterNumber: targetPostChapter.chapterNumber,
                    tag: commentTag,
                    body: commentDraft
                  });
                  setCommentSubmitting(false);
                  if (res.error) {
                    setCommentError(res.error);
                  } else {
                    setCommentDraft('');
                  }
                }}
                className="p-4 rounded-xl border border-current/15 bg-current/[0.03] space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      Posting as {getDisplayName(user)} &middot; Rank {computeReaderRank(user, stories).roman}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['Reaction', 'Lore', 'Theory'] as const).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setCommentTag(tag)}
                        className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
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

                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="comment-target-chapter" className="text-[11px] opacity-75 font-medium">
                    Chapter feedback target:
                  </label>
                  <select
                    id="comment-target-chapter"
                    value={targetPostChapter.id}
                    onChange={(e) => setCommentTargetChapterId(e.target.value)}
                    className="px-2.5 py-1 rounded-md border border-current/20 bg-transparent text-[11px] font-medium focus:outline-none focus:border-[#C85A32] cursor-pointer"
                  >
                    {story.chapters.map((ch) => (
                      <option
                        key={ch.id}
                        value={ch.id}
                        className="bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5]"
                      >
                        Chapter {ch.chapterNumber}: {ch.title}
                      </option>
                    ))}
                  </select>
                </div>

                <label htmlFor="chapter-comment-input" className="sr-only">
                  Write your chapter feedback
                </label>
                <textarea
                  id="chapter-comment-input"
                  rows={3}
                  maxLength={1000}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder={`Share your feedback on Chapter ${targetPostChapter.chapterNumber}: ${targetPostChapter.title}...`}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-current/20 bg-transparent focus:outline-none focus:border-[#C85A32] font-reader text-sm"
                />

                {commentError && (
                  <p role="alert" className="text-red-600 dark:text-red-400">
                    {commentError}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <VoiceDictationButton
                      compact
                      label="Dictate Comment"
                      contextHint={`Reader feedback on ${story.title}, Chapter ${targetPostChapter.chapterNumber}`}
                      onTranscript={(text) => setCommentDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
                    />
                    <span className="text-[11px] opacity-55 tabular-nums">
                      {commentDraft.trim().length}/1000
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={commentSubmitting || commentDraft.trim().length < 2}
                    className="px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  >
                    {commentSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Posting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Post Comment</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {activeComments.length === 0 ? (
              <p className="text-xs opacity-65 italic py-2">
                No reader comments yet for{' '}
                {effectiveFilterChapterId === 'all'
                  ? story.title
                  : `Chapter ${
                      story.chapters.find(c => c.id === effectiveFilterChapterId)?.chapterNumber ||
                      chapter.chapterNumber
                    }`}
                .
              </p>
            ) : (
              <div className="divide-y divide-current/10 border border-current/12 rounded-xl overflow-hidden bg-current/[0.015]">
                {activeComments.map((cmt) => {
                  const matchedChapter = story.chapters.find(c => c.id === cmt.chapterId);
                  const chapterNum = cmt.chapterNumber || matchedChapter?.chapterNumber;
                  const canDelete =
                    isAuthenticated &&
                    ((cmt.userId && cmt.userId === user.id) ||
                      cmt.authorName === getDisplayName(user) ||
                      cmt.authorName === user.name ||
                      user.role === 'owner');

                  return (
                    <div key={cmt.id} className="p-4 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold">{cmt.authorName}</span>
                          <span aria-hidden="true" className="opacity-40">&middot;</span>
                          <span className="text-[#C85A32] font-semibold">{cmt.tag}</span>
                          {chapterNum && (
                            <>
                              <span aria-hidden="true" className="opacity-40">&middot;</span>
                              <span className="opacity-70 tabular-nums">Chapter {chapterNum}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-[11px] opacity-60">{cmt.createdAt}</span>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => void deleteChapterComment(cmt.id)}
                              aria-label="Delete comment"
                              className="opacity-60 hover:text-red-500 hover:opacity-100 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="font-reader text-sm leading-relaxed opacity-90 whitespace-pre-line">
                        {cmt.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

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
