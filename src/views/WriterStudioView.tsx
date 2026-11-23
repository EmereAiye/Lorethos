import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Feather,
  FileText,
  Home,
  ImagePlus,
  Layers,
  LayoutDashboard,
  Link as LinkIcon,
  Loader2,
  Plus,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { apiFetch, parseJsonSafe } from '../lib/apiClient';
import {
  canAccessWriterStudio,
  createWriterStory,
  fetchLatestSupabaseUserRole,
  formatTrailerSummaryWithLorethosCta,
  getCurrentSupabaseAuthAndProfile,
  isOwnerEmail,
  isWriterStudioAdmin,
  markWriterPortalVisited,
  normalizeWriterRole,
  resolveMergedUserRole,
  uploadTrailerAudioToBucket,
} from '../lib/writerStories';
import type {
  AccessTier,
  PublicationStatus,
  Story,
  StoryStatus,
  SupabaseProfile,
  UserProfile,
} from '../types';
import { ExclusiveAudioPlayer } from '../components/ExclusiveAudioPlayer';
import {
  CURATED_COVER_OPTIONS,
  DEFAULT_WRITER_COVER_IMAGE,
  LORETHOS_GENRES,
  MAX_WORDS_PER_CHAPTER,
  countWords,
  normalizePortableCoverUrl,
  processCoverImageFile,
} from '../utils/coverImage';

interface ChapterDraft {
  id: string;
  title: string;
  body: string;
}

interface StoredWriterDraft {
  authorName?: string;
  title?: string;
  subtitle?: string;
  genre?: string;
  customGenre?: string;
  coverImage?: string;
  synopsis?: string;
  storyStatus?: StoryStatus;
  publicationStatus?: PublicationStatus;
  accessTier?: AccessTier;
  priceNgn?: number;
  freeChaptersCount?: number;
  audioUrl?: string | null;
  chapters?: ChapterDraft[];
  updatedAt?: string;
}

const createEmptyChapter = (index: number): ChapterDraft => ({
  id: `ch-draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  title: `Chapter ${index}`,
  body: '',
});

const INITIAL_CHAPTERS = (): ChapterDraft[] => [
  {
    id: 'ch-draft-1',
    title: 'Chapter 1: Opening',
    body: '',
  },
];

export const WriterStudioView: React.FC = () => {
  const { navigate, buildHref, refreshUserRole, refreshStories, user, isAuthenticated } = useApp();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);

  // Story Metadata State
  const [authorName, setAuthorName] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>(LORETHOS_GENRES[0]);
  const [customGenre, setCustomGenre] = useState('');
  const [coverImage, setCoverImage] = useState<string>(DEFAULT_WRITER_COVER_IMAGE);
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [processingCover, setProcessingCover] = useState(false);
  const [synopsis, setSynopsis] = useState('');
  const [storyStatus, setStoryStatus] = useState<StoryStatus>('Ongoing');
  const [publicationStatus, setPublicationStatus] = useState<PublicationStatus>('published');
  const [accessTier, setAccessTier] = useState<AccessTier>('free');
  const [priceNgn, setPriceNgn] = useState<number>(1500);
  const [freeChaptersCount, setFreeChaptersCount] = useState<number>(1);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);

  // Chapter-by-Chapter Composer State
  const [chapters, setChapters] = useState<ChapterDraft[]>(INITIAL_CHAPTERS);
  const [chapterViewMode, setChapterViewMode] = useState<'focused' | 'all'>('focused');
  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(0);

  // Submission & Feedback State
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [lastSavedStory, setLastSavedStory] = useState<{ slug: string; title: string; published: boolean } | null>(null);

  // Manageable Catalog Stories State
  const [catalogStories, setCatalogStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hasLocalDraftBackup, setHasLocalDraftBackup] = useState(false);

  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const restoredDraftForUserRef = useRef<string | null>(null);

  const draftStorageKey = authUserId ? `lorethos_writer_draft_${authUserId}` : null;

  const loadStories = useCallback(async () => {
    setStoriesLoading(true);
    setStoriesError(null);
    try {
      const res = await apiFetch('/api/writer/stories');
      const data = await parseJsonSafe<{ stories?: Story[]; error?: string }>(res);
      if (!res.ok) {
        setStoriesError(data?.error || 'Unable to load Writer Studio catalog stories.');
        setCatalogStories([]);
      } else {
        setCatalogStories(Array.isArray(data?.stories) ? data.stories : []);
      }
    } catch {
      setStoriesError('Unable to reach the Lorethos story catalog right now.');
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  const refreshAccessAndData = useCallback(async () => {
    setCheckingAccess(true);
    try {
      const sbState = await getCurrentSupabaseAuthAndProfile();
      let effectiveUserId: string | null = sbState.userId;
      let effectiveEmail: string | null = sbState.email || user.email || null;
      let effectiveProfile: SupabaseProfile | null = sbState.profile
        ? {
            id: sbState.profile.id,
            username: sbState.profile.username,
            role: normalizeWriterRole(sbState.profile.role, sbState.email),
          }
        : null;

      if (effectiveUserId) {
        const liveLookup = await fetchLatestSupabaseUserRole(effectiveUserId, sbState.email);
        const liveRole =
          liveLookup.source !== 'none'
            ? liveLookup.role
            : normalizeWriterRole(effectiveProfile?.role, sbState.email);
        effectiveProfile = {
          id: effectiveProfile?.id || effectiveUserId,
          username:
            effectiveProfile?.username || sbState.email?.split('@')[0] || 'Writer',
          role: isOwnerEmail(sbState.email) ? 'owner' : liveRole,
        };
      } else {
        try {
          const sessionRes = await apiFetch('/api/auth/session');
          if (sessionRes.ok) {
            const sessionJson = await parseJsonSafe<{
              authenticated?: boolean;
              user?: UserProfile;
            }>(sessionRes);
            if (sessionJson?.authenticated && sessionJson.user) {
              effectiveUserId = sessionJson.user.id;
              effectiveEmail = sessionJson.user.email || effectiveEmail;
              const liveLookup = await fetchLatestSupabaseUserRole(
                sessionJson.user.id,
                sessionJson.user.email
              );
              const expressRole = normalizeWriterRole(
                sessionJson.user.role,
                sessionJson.user.email
              );
              const liveRole = resolveMergedUserRole(
                expressRole,
                liveLookup,
                sessionJson.user.email
              );
              effectiveProfile = {
                id: sessionJson.user.id,
                username:
                  sessionJson.user.nickname || sessionJson.user.name || 'Writer',
                role: isOwnerEmail(sessionJson.user.email) ? 'owner' : liveRole,
              };
            }
          }
        } catch {
          // Fallback to AppContext authenticated state below
        }
      }

      // Guarantee AppContext owner / authenticated writer always gets access even during offline reload
      if (!effectiveUserId && isAuthenticated && user.id && user.id !== 'guest') {
        const ctxRole = normalizeWriterRole(user.role, user.email);
        if (canAccessWriterStudio(ctxRole) || isOwnerEmail(user.email)) {
          effectiveUserId = user.id;
          effectiveEmail = user.email || effectiveEmail;
          effectiveProfile = {
            id: user.id,
            username: user.nickname || user.name || 'Lorethos Writer',
            role: isOwnerEmail(user.email) ? 'owner' : ctxRole,
          };
        }
      }

      if (effectiveEmail && isOwnerEmail(effectiveEmail) && effectiveProfile) {
        effectiveProfile = { ...effectiveProfile, role: 'owner' };
      }

      setAuthUserId(effectiveUserId);
      setAuthEmail(effectiveEmail);
      setProfile(effectiveProfile);
      setCheckingAccess(false);

      if (effectiveProfile) {
        setAuthorName((prev) =>
          prev.trim() ? prev : user.nickname || user.name || effectiveProfile!.username || 'Lorethos Writer'
        );
      }

      if (effectiveUserId) {
        void refreshUserRole();
      }

      const ownerCheck = isOwnerEmail(effectiveEmail || user.email);
      if (
        effectiveUserId &&
        effectiveProfile &&
        (canAccessWriterStudio(effectiveProfile.role) || ownerCheck)
      ) {
        markWriterPortalVisited(effectiveUserId);
        if (user.id && user.id !== 'guest') {
          markWriterPortalVisited(user.id);
        }
        await loadStories();
      } else {
        setCatalogStories([]);
      }
    } catch {
      setAuthUserId(null);
      setAuthEmail(null);
      setProfile(null);
      setCatalogStories([]);
      setCheckingAccess(false);
    }
  }, [
    isAuthenticated,
    loadStories,
    refreshUserRole,
    user.email,
    user.id,
    user.name,
    user.nickname,
    user.role,
  ]);

  useEffect(() => {
    void refreshAccessAndData();

    if (!isSupabaseConfigured || !supabase) return;
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void refreshAccessAndData();
    });
    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, [refreshAccessAndData]);

  // Restore saved local draft when entering Writer Studio (never overwrites active edits)
  useEffect(() => {
    if (!draftStorageKey || editingStoryId || restoredDraftForUserRef.current === draftStorageKey) {
      return;
    }
    restoredDraftForUserRef.current = draftStorageKey;
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as StoredWriterDraft;
      const hasChapters = Array.isArray(saved.chapters) && saved.chapters.some((c) => c.body?.trim());
      if (saved.title || saved.synopsis || hasChapters) {
        if (saved.authorName) setAuthorName(saved.authorName);
        if (saved.title) setTitle(saved.title);
        if (saved.subtitle) setSubtitle(saved.subtitle);
        if (saved.genre) setSelectedGenre(saved.genre);
        if (saved.customGenre) setCustomGenre(saved.customGenre);
        if (saved.coverImage && normalizePortableCoverUrl(saved.coverImage)) {
          setCoverImage(saved.coverImage);
        }
        if (saved.synopsis) setSynopsis(saved.synopsis);
        if (saved.storyStatus) setStoryStatus(saved.storyStatus);
        if (saved.publicationStatus) setPublicationStatus(saved.publicationStatus);
        if (saved.accessTier) setAccessTier(saved.accessTier);
        if (typeof saved.priceNgn === 'number') setPriceNgn(saved.priceNgn);
        if (typeof saved.freeChaptersCount === 'number') setFreeChaptersCount(saved.freeChaptersCount);
        if (saved.audioUrl) setAudioUrl(saved.audioUrl);
        if (Array.isArray(saved.chapters) && saved.chapters.length > 0) {
          setChapters(
            saved.chapters.map((ch, idx) => ({
              id: ch.id || `ch-restored-${idx + 1}`,
              title: ch.title || `Chapter ${idx + 1}`,
              body: ch.body || '',
            }))
          );
          setActiveChapterIdx(0);
        }
        setHasLocalDraftBackup(true);
      }
    } catch {
      // Ignore malformed draft backup
    }
  }, [draftStorageKey, editingStoryId]);

  // Continuously back up in-progress multi-chapter manuscripts locally so work is never lost offline
  useEffect(() => {
    if (!draftStorageKey || editingStoryId) return;
    const hasChapterText = chapters.some((c) => c.body.trim().length > 0);
    const hasContent = Boolean(title.trim() || synopsis.trim() || hasChapterText || audioUrl);
    try {
      if (!hasContent) {
        window.localStorage.removeItem(draftStorageKey);
        setHasLocalDraftBackup(false);
      } else {
        const payload: StoredWriterDraft = {
          authorName,
          title,
          subtitle,
          genre: selectedGenre,
          customGenre,
          coverImage,
          synopsis,
          storyStatus,
          publicationStatus,
          accessTier,
          priceNgn,
          freeChaptersCount,
          audioUrl,
          chapters,
          updatedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
        setHasLocalDraftBackup(true);
      }
    } catch {
      // Ignore storage quota errors (for instance when large custom cover data URI exceeds localStorage)
    }
  }, [
    draftStorageKey,
    editingStoryId,
    authorName,
    title,
    subtitle,
    selectedGenre,
    customGenre,
    coverImage,
    synopsis,
    storyStatus,
    publicationStatus,
    accessTier,
    priceNgn,
    freeChaptersCount,
    audioUrl,
    chapters,
  ]);

  const clearSavedLocalDraft = useCallback(() => {
    if (draftStorageKey) {
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // Ignore storage errors
      }
    }
    setHasLocalDraftBackup(false);
  }, [draftStorageKey]);

  const resetForm = useCallback(() => {
    setEditingStoryId(null);
    setAuthorName(user.nickname || user.name || profile?.username || 'Lorethos Writer');
    setTitle('');
    setSubtitle('');
    setSelectedGenre(LORETHOS_GENRES[0]);
    setCustomGenre('');
    setCoverImage(DEFAULT_WRITER_COVER_IMAGE);
    setCoverUrlInput('');
    setSynopsis('');
    setStoryStatus('Ongoing');
    setPublicationStatus('published');
    setAccessTier('free');
    setPriceNgn(1500);
    setFreeChaptersCount(1);
    setAudioUrl(null);
    setSelectedAudioFile(null);
    setChapters(INITIAL_CHAPTERS());
    setActiveChapterIdx(0);
    if (audioFileInputRef.current) {
      audioFileInputRef.current.value = '';
    }
    if (coverFileInputRef.current) {
      coverFileInputRef.current.value = '';
    }
  }, [profile?.username, user.name, user.nickname]);

  const resolvedGenre = useMemo(() => {
    if (selectedGenre === '__custom__') {
      return customGenre.trim();
    }
    return selectedGenre;
  }, [selectedGenre, customGenre]);

  const chapterMetrics = useMemo(() => {
    const counts = chapters.map((ch) => countWords(ch.body));
    const totalWords = counts.reduce((sum, n) => sum + n, 0);
    const overLimitIndices = counts
      .map((c, idx) => (c > MAX_WORDS_PER_CHAPTER ? idx : -1))
      .filter((idx) => idx >= 0);
    const emptyIndices = counts
      .map((c, idx) => (c === 0 ? idx : -1))
      .filter((idx) => idx >= 0);
    return {
      counts,
      totalWords,
      overLimitIndices,
      emptyIndices,
    };
  }, [chapters]);

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingCover(true);
    try {
      const processedDataUrl = await processCoverImageFile(file);
      setCoverImage(processedDataUrl);
      setCoverUrlInput('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to process selected cover image.');
    } finally {
      setProcessingCover(false);
      e.target.value = '';
    }
  };

  const handleApplyCoverUrl = () => {
    setFormError(null);
    const trimmed = coverUrlInput.trim();
    if (!trimmed) {
      setCoverImage(DEFAULT_WRITER_COVER_IMAGE);
      return;
    }
    const normalized = normalizePortableCoverUrl(trimmed);
    if (!normalized) {
      setFormError('Cover URL must start with https:// or point to a valid curated asset.');
      return;
    }
    setCoverImage(normalized);
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedAudioFile(null);
      return;
    }
    if (!file.type.startsWith('audio/')) {
      setFormError('Please select a valid audio file (MP3, WAV, M4A, OGG, or AAC).');
      e.target.value = '';
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setFormError('Trailer audio file must be 25 MB or smaller.');
      e.target.value = '';
      return;
    }
    setSelectedAudioFile(file);
  };

  const handleAddChapter = () => {
    setFormError(null);
    setChapters((prev) => {
      const nextIndex = prev.length + 1;
      const updated = [...prev, createEmptyChapter(nextIndex)];
      setActiveChapterIdx(updated.length - 1);
      return updated;
    });
  };

  const handleRemoveChapter = (idx: number) => {
    if (chapters.length <= 1) return;
    setChapters((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setActiveChapterIdx((curr) => Math.min(curr, Math.max(0, next.length - 1)));
      return next;
    });
  };

  const handleMoveChapter = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= chapters.length) return;
    setChapters((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
    if (activeChapterIdx === idx) {
      setActiveChapterIdx(target);
    } else if (activeChapterIdx === target) {
      setActiveChapterIdx(idx);
    }
  };

  const handleChapterChange = (idx: number, patch: Partial<Pick<ChapterDraft, 'title' | 'body'>>) => {
    setChapters((prev) =>
      prev.map((ch, i) => (i === idx ? { ...ch, ...patch } : ch))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasOwnerAccess = isOwnerEmail(authEmail || user.email);
    if (!authUserId || !profile || (!canAccessWriterStudio(profile.role) && !hasOwnerAccess)) {
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    setLastSavedStory(null);

    const cleanTitle = title.trim();
    const cleanAuthor = authorName.trim();
    const cleanGenre = resolvedGenre.trim();
    const cleanSynopsis = synopsis.trim();

    if (cleanTitle.length < 2) {
      setFormError('Please enter a Story Title (at least 2 characters).');
      return;
    }
    if (cleanAuthor.length < 2) {
      setFormError('Please enter the Author Name shown on the story.');
      return;
    }
    if (cleanGenre.length < 2) {
      setFormError('Please select or enter a Genre for your story.');
      return;
    }
    if (cleanSynopsis.length < 10) {
      setFormError('Please enter a Synopsis / Trailer Blurb (at least 10 characters).');
      return;
    }
    if (chapters.length === 0) {
      setFormError('Please include at least one chapter.');
      return;
    }

    if (chapterMetrics.emptyIndices.length > 0) {
      const firstEmpty = chapterMetrics.emptyIndices[0];
      setActiveChapterIdx(firstEmpty);
      setFormError(
        `Chapter ${firstEmpty + 1} is empty. Paste or write its chapter prose before publishing.`
      );
      return;
    }

    if (chapterMetrics.overLimitIndices.length > 0) {
      const firstOver = chapterMetrics.overLimitIndices[0];
      const overWords = chapterMetrics.counts[firstOver];
      setActiveChapterIdx(firstOver);
      setFormError(
        `Chapter ${firstOver + 1} exceeds the ${MAX_WORDS_PER_CHAPTER.toLocaleString()}-word per-chapter limit (${overWords.toLocaleString()} words). Split the continuation into the next chapter — total chapters and total story words are unlimited.`
      );
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setFormError(
        'You are currently offline. Your story chapters are safely backed up locally — stay on this page and click Publish once your connection returns.'
      );
      return;
    }

    setSubmitting(true);
    try {
      let finalAudioUrl = audioUrl;

      if (selectedAudioFile) {
        setUploadingAudio(true);
        const uploadRes = await uploadTrailerAudioToBucket(selectedAudioFile, authUserId);
        setUploadingAudio(false);
        if (uploadRes.error || !uploadRes.audioUrl) {
          setFormError(uploadRes.error || 'Failed to upload trailer audio.');
          setSubmitting(false);
          return;
        }
        finalAudioUrl = uploadRes.audioUrl;
      }

      const payload = {
        title: cleanTitle,
        subtitle: subtitle.trim() || undefined,
        author: cleanAuthor,
        genre: cleanGenre,
        coverImage: normalizePortableCoverUrl(coverImage) || DEFAULT_WRITER_COVER_IMAGE,
        synopsis: cleanSynopsis,
        status: storyStatus,
        publicationStatus,
        accessTier,
        priceNgn: accessTier === 'free' ? 0 : Math.max(0, Number(priceNgn) || 0),
        freeChaptersCount:
          accessTier === 'free'
            ? chapters.length
            : Math.max(1, Math.min(chapters.length, Number(freeChaptersCount) || 1)),
        audioUrl: finalAudioUrl,
        chapters: chapters.map((ch, idx) => ({
          title: ch.title.trim() || `Chapter ${idx + 1}`,
          body: ch.body.trim(),
        })),
      };

      const endpoint = editingStoryId
        ? `/api/writer/stories/${encodeURIComponent(editingStoryId)}`
        : '/api/writer/stories';
      const method = editingStoryId ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await parseJsonSafe<{ story?: Story; error?: string }>(res);
      if (!res.ok || !json?.story) {
        setFormError(json?.error || 'Unable to save story to Lorethos.');
        return;
      }

      const savedStory = json.story;

      // Non-blocking best-effort mirror to Supabase stories table when configured
      if (!editingStoryId && isSupabaseConfigured && supabase) {
        const combinedBody = chapters
          .map((c, idx) => `## ${c.title.trim() || `Chapter ${idx + 1}`}\n\n${c.body.trim()}`)
          .join('\n\n---\n\n');
        void createWriterStory({
          authorId: authUserId,
          authorUsername: cleanAuthor,
          title: cleanTitle,
          summary: cleanSynopsis,
          body: combinedBody,
          audioUrl: finalAudioUrl,
        }).catch(() => undefined);
      }

      await Promise.all([refreshStories(), loadStories()]);

      if (!editingStoryId) {
        clearSavedLocalDraft();
      }

      setLastSavedStory({
        slug: savedStory.slug,
        title: savedStory.title,
        published: (savedStory.publicationStatus || 'published') === 'published',
      });
      setFormSuccess(
        editingStoryId
          ? `"${savedStory.title}" (${savedStory.chapters.length} chapters) updated across Lorethos.`
          : (savedStory.publicationStatus || 'published') === 'published'
          ? `"${savedStory.title}" (${savedStory.chapters.length} chapters) is now live and readable across Lorethos.`
          : `"${savedStory.title}" saved as a private studio draft.`
      );
      resetForm();
    } finally {
      setUploadingAudio(false);
      setSubmitting(false);
    }
  };

  const handleStartEdit = (story: Story) => {
    setFormError(null);
    setFormSuccess(null);
    setLastSavedStory(null);
    setEditingStoryId(story.id);
    setAuthorName(story.author || user.nickname || user.name || profile?.username || '');
    setTitle(story.title);
    setSubtitle(story.subtitle || '');

    const matchingPreset = LORETHOS_GENRES.find(
      (g) => g.toLowerCase() === (story.genre || '').trim().toLowerCase()
    );
    if (matchingPreset) {
      setSelectedGenre(matchingPreset);
      setCustomGenre('');
    } else {
      setSelectedGenre('__custom__');
      setCustomGenre(story.genre || '');
    }

    setCoverImage(normalizePortableCoverUrl(story.coverImage) || DEFAULT_WRITER_COVER_IMAGE);
    setCoverUrlInput(
      story.coverImage && story.coverImage.startsWith('https://') ? story.coverImage : ''
    );
    setSynopsis(story.synopsis || '');
    setStoryStatus(story.status || 'Ongoing');
    setPublicationStatus(story.publicationStatus || 'published');
    setAccessTier(story.accessTier || 'free');
    setPriceNgn(story.priceNgn || 1500);
    setFreeChaptersCount(Math.max(1, story.freeChaptersCount || 1));
    setAudioUrl(story.audioUrl || null);
    setSelectedAudioFile(null);

    if (Array.isArray(story.chapters) && story.chapters.length > 0) {
      setChapters(
        story.chapters.map((ch, idx) => ({
          id: ch.id || `ch-edit-${idx + 1}`,
          title: ch.title || `Chapter ${idx + 1}`,
          body: Array.isArray(ch.content) ? ch.content.join('\n\n') : '',
        }))
      );
    } else {
      setChapters(INITIAL_CHAPTERS());
    }
    setActiveChapterIdx(0);

    if (audioFileInputRef.current) {
      audioFileInputRef.current.value = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (storyId: string) => {
    setDeletingId(storyId);
    setStoriesError(null);
    try {
      const res = await apiFetch(`/api/writer/stories/${encodeURIComponent(storyId)}`, {
        method: 'DELETE',
      });
      const json = await parseJsonSafe<{ error?: string }>(res);
      if (!res.ok) {
        setStoriesError(json?.error || 'Failed to delete story.');
        return;
      }
      if (editingStoryId === storyId) {
        resetForm();
      }
      setCatalogStories((prev) => prev.filter((item) => item.id !== storyId));
      await refreshStories();
    } catch {
      setStoriesError('Unable to reach server while deleting story.');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-xs font-sans-ui opacity-75">
          <Loader2 className="w-6 h-6 animate-spin text-[#C85A32]" />
          <span>Verifying Writer Studio access...</span>
        </div>
      </div>
    );
  }

  const effectiveRole = normalizeWriterRole(profile?.role || user.role, authEmail || user.email);
  const isOwner = isOwnerEmail(authEmail || user.email) || effectiveRole === 'owner';
  const isAdmin = isWriterStudioAdmin(effectiveRole) || isOwner;
  const isAuthorized = Boolean(
    authUserId && profile && (canAccessWriterStudio(effectiveRole) || isOwner)
  );

  if (!isAuthorized || !profile) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] border border-[#2D142C]/15 dark:border-white/15 shadow-lg text-center space-y-5">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold">
              Access Denied &ndash; Approved Writers Only
            </h1>
            <p className="font-reader text-sm text-[#2D142C]/75 dark:text-white/75">
              This private Lorethos studio is restricted to approved writers and the platform owner.
            </p>
          </div>
          <a
            href={buildHref('home')}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate('home');
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold font-sans-ui transition-colors whitespace-nowrap shrink-0"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </a>
        </div>
      </div>
    );
  }

  const summaryPreview = synopsis.trim()
    ? formatTrailerSummaryWithLorethosCta(synopsis, title)
    : '';
  const visibleChapters =
    chapterViewMode === 'all'
      ? chapters.map((ch, idx) => ({ ch, idx }))
      : chapters[activeChapterIdx]
      ? [{ ch: chapters[activeChapterIdx], idx: activeChapterIdx }]
      : [];

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] py-10 sm:py-12 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Studio Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#2D142C]/12 dark:border-white/12 pb-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-[#C85A32] font-sans-ui">
              <Feather className="w-3.5 h-3.5" />
              <span>Lorethos Writer Studio</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              {editingStoryId ? 'Edit Story & Chapters' : 'Compose & Publish a Story'}
            </h1>
            <p className="text-xs font-sans-ui text-[#2D142C]/70 dark:text-white/70">
              Signed in as{' '}
              <strong className="text-[#2D142C] dark:text-white">
                {authorName.trim() || profile.username}
              </strong>
              {' · '}
              <span className="text-[#C85A32] font-semibold uppercase tracking-wide text-[11px]">
                {effectiveRole}
              </span>
              {isOwner && ' (Unrestricted Owner Access)'}
              {' · '}
              <span className="opacity-85">Publishes directly to the Lorethos reader catalog</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto font-sans-ui">
            {isOwner && (
              <a
                href={buildHref('admin')}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  navigate('admin');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#C85A32]/40 bg-[#C85A32]/8 hover:bg-[#C85A32]/15 text-xs font-semibold text-[#C85A32] whitespace-nowrap shrink-0 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Publishing Desk</span>
              </a>
            )}

            <a
              href={buildHref('account')}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate('account');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#C85A32]" />
              <span>Dashboard</span>
            </a>

            <a
              href={buildHref('profile')}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate('profile');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#C85A32]" />
              <span>My Profile</span>
            </a>

            <a
              href={buildHref('home')}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate('home');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Reader Feed</span>
            </a>
          </div>
        </header>

        {/* Multi-Chapter Submission & Cover Studio Form */}
        <form onSubmit={handleSubmit} className="space-y-8 font-sans-ui">
          {/* Top Card: Book Identity, Author, Genre & Cover Image */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] border border-[#2D142C]/12 dark:border-white/12 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2D142C]/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#C85A32]" />
                <h2 className="font-display text-xl font-bold">
                  {editingStoryId ? 'Story Identity & Cover Art' : '1. Story Identity & Cover Art'}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {!editingStoryId && hasLocalDraftBackup && (
                  <>
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                      Manuscript backed up locally
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        clearSavedLocalDraft();
                        resetForm();
                      }}
                      className="text-[#2D142C]/65 dark:text-white/65 hover:text-red-600 dark:hover:text-red-400 underline cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Discard Draft
                    </button>
                  </>
                )}
                {editingStoryId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs font-semibold text-[#C85A32] hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel Edit</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
              {/* Left 4 columns: Live 3:4 Cover Art Preview & Upload Controls */}
              <div className="lg:col-span-4 space-y-4">
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold">Story Cover Art (3:4 Portrait)</span>
                  <div className="relative aspect-[3/4] w-full max-w-[240px] mx-auto lg:mx-0 rounded-xl overflow-hidden border border-[#2D142C]/15 dark:border-white/15 bg-[#2D142C]/5 dark:bg-white/5 shadow-sm">
                    <img
                      src={coverImage || DEFAULT_WRITER_COVER_IMAGE}
                      alt={title.trim() ? `${title} cover preview` : 'Story cover preview'}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallbackApplied === '1') return;
                        img.dataset.fallbackApplied = '1';
                        img.src = DEFAULT_WRITER_COVER_IMAGE;
                      }}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3.5 text-white">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-[#F4A261] truncate">
                        {resolvedGenre || 'Genre'}
                      </p>
                      <p className="font-display text-sm font-bold leading-snug line-clamp-2">
                        {title.trim() || 'Untitled Story'}
                      </p>
                      <p className="text-[11px] text-white/80 truncate mt-0.5">
                        {authorName.trim() || profile.username}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Upload Cover from Device */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="writer-cover-upload"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    >
                      {processingCover ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C85A32]" />
                      ) : (
                        <ImagePlus className="w-3.5 h-3.5 text-[#C85A32]" />
                      )}
                      <span>{processingCover ? 'Preparing...' : 'Upload Cover Image'}</span>
                    </label>
                    <input
                      ref={coverFileInputRef}
                      id="writer-cover-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleCoverFileChange}
                      className="sr-only"
                    />
                  </div>

                  {/* Curated Local Cover Presets */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-medium opacity-75">
                      Or choose a curated editorial cover:
                    </span>
                    <div className="grid grid-cols-4 gap-2 max-w-[240px]">
                      {CURATED_COVER_OPTIONS.map((opt) => {
                        const selected = coverImage === opt.url;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setCoverImage(opt.url);
                              setCoverUrlInput('');
                            }}
                            title={opt.label}
                            className={`aspect-[3/4] rounded-lg overflow-hidden border transition-all cursor-pointer ${
                              selected
                                ? 'border-[#C85A32] ring-2 ring-[#C85A32]/40'
                                : 'border-[#2D142C]/15 dark:border-white/15 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={opt.url}
                              alt={opt.label}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Paste HTTPS Cover URL */}
                  <div className="space-y-1.5">
                    <label htmlFor="writer-cover-url" className="block text-[11px] font-medium opacity-75">
                      Or paste HTTPS cover image URL:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1 min-w-0">
                        <LinkIcon className="w-3.5 h-3.5 opacity-50 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="writer-cover-url"
                          type="url"
                          value={coverUrlInput}
                          onChange={(e) => setCoverUrlInput(e.target.value)}
                          placeholder="https://..."
                          className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCoverUrl}
                        className="px-3 py-1.5 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 8 columns: Title, Subtitle, Author Name, Genre, Synopsis, Access & Visibility */}
              <div className="lg:col-span-8 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="writer-story-title" className="block text-xs font-semibold">
                      Story Title <span className="text-[#C85A32]">*</span>
                    </label>
                    <input
                      id="writer-story-title"
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Ashes of the Brass Citadel"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="writer-author-name" className="block text-xs font-semibold">
                      Author Display Name <span className="text-[#C85A32]">*</span>
                    </label>
                    <input
                      id="writer-author-name"
                      type="text"
                      required
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="Pen name or full author name"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="writer-story-subtitle" className="block text-xs font-semibold">
                      Subtitle / Tagline <span className="font-normal opacity-60">(Optional)</span>
                    </label>
                    <input
                      id="writer-story-subtitle"
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="A short evocative subtitle"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="writer-story-genre" className="block text-xs font-semibold">
                      Story Genre <span className="text-[#C85A32]">*</span>
                    </label>
                    <select
                      id="writer-story-genre"
                      value={selectedGenre}
                      onChange={(e) => setSelectedGenre(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] focus:outline-none focus:border-[#C85A32]"
                    >
                      {LORETHOS_GENRES.map((genre) => (
                        <option key={genre} value={genre}>
                          {genre}
                        </option>
                      ))}
                      <option value="__custom__">Custom Genre...</option>
                    </select>
                  </div>
                </div>

                {selectedGenre === '__custom__' && (
                  <div className="space-y-1.5">
                    <label htmlFor="writer-custom-genre" className="block text-xs font-semibold">
                      Enter Custom Genre
                    </label>
                    <input
                      id="writer-custom-genre"
                      type="text"
                      required
                      value={customGenre}
                      onChange={(e) => setCustomGenre(e.target.value)}
                      placeholder="e.g., Cozy African Noir, Urban Paranormal..."
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="writer-story-summary" className="block text-xs font-semibold">
                      Synopsis / Trailer Blurb <span className="text-[#C85A32]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSynopsis((prev) =>
                          formatTrailerSummaryWithLorethosCta(
                            prev || 'An unforgettable story unfolds chapter by chapter.',
                            title
                          )
                        )
                      }
                      className="text-[11px] font-semibold text-[#C85A32] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Append Lorethos Read Callout
                    </button>
                  </div>
                  <textarea
                    id="writer-story-summary"
                    required
                    rows={3}
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    placeholder="Introduce your story world, stakes, and central characters..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32] font-reader"
                  />
                  {summaryPreview && summaryPreview !== synopsis.trim() && (
                    <p className="text-[11px] italic text-[#C85A32] bg-[#C85A32]/5 px-3 py-1.5 rounded-lg border border-[#C85A32]/20">
                      Callout suggestion: &ldquo;{summaryPreview}&rdquo;
                    </p>
                  )}
                </div>

                {/* Story Status, Visibility & Access Tier */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label htmlFor="writer-story-status" className="block text-xs font-semibold">
                      Series Status
                    </label>
                    <select
                      id="writer-story-status"
                      value={storyStatus}
                      onChange={(e) => setStoryStatus(e.target.value as StoryStatus)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] focus:outline-none focus:border-[#C85A32]"
                    >
                      <option value="Ongoing">Ongoing Serial</option>
                      <option value="Completed">Completed Book</option>
                      <option value="Hiatus">On Hiatus</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="writer-publication-status" className="block text-xs font-semibold">
                      Site Visibility
                    </label>
                    <select
                      id="writer-publication-status"
                      value={publicationStatus}
                      onChange={(e) => setPublicationStatus(e.target.value as PublicationStatus)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] focus:outline-none focus:border-[#C85A32]"
                    >
                      <option value="published">Published (Live for Readers)</option>
                      <option value="draft">Draft (Studio Only)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="writer-access-tier" className="block text-xs font-semibold">
                      Reader Access Tier
                    </label>
                    <select
                      id="writer-access-tier"
                      value={accessTier}
                      onChange={(e) => setAccessTier(e.target.value as AccessTier)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] focus:outline-none focus:border-[#C85A32]"
                    >
                      <option value="free">Free to Everyone</option>
                      <option value="subscription">Included in Membership</option>
                      <option value="purchase">Single Book Purchase</option>
                    </select>
                  </div>
                </div>

                {accessTier !== 'free' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#2D142C]/[0.03] dark:bg-white/[0.03] border border-[#2D142C]/10 dark:border-white/10">
                    <div className="space-y-1.5">
                      <label htmlFor="writer-free-chapters" className="block text-xs font-semibold">
                        Free Opening Chapters
                      </label>
                      <input
                        id="writer-free-chapters"
                        type="number"
                        min={1}
                        max={Math.max(1, chapters.length)}
                        value={freeChaptersCount}
                        onChange={(e) =>
                          setFreeChaptersCount(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32] tabular-nums"
                      />
                    </div>
                    {accessTier === 'purchase' && (
                      <div className="space-y-1.5">
                        <label htmlFor="writer-price-ngn" className="block text-xs font-semibold">
                          Full Book Price (NGN)
                        </label>
                        <input
                          id="writer-price-ngn"
                          type="number"
                          min={0}
                          step={100}
                          value={priceNgn}
                          onChange={(e) => setPriceNgn(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32] tabular-nums"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Optional Trailer Audio */}
                <div className="space-y-2 pt-1">
                  <label htmlFor="writer-trailer-audio" className="block text-xs font-semibold">
                    Optional Trailer Audio{' '}
                    <span className="font-normal opacity-65">(Uploaded to Supabase trailers bucket)</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="writer-trailer-audio"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#C85A32]" />
                      <span>
                        {selectedAudioFile
                          ? selectedAudioFile.name
                          : audioUrl
                          ? 'Replace Trailer Audio'
                          : 'Choose Audio File'}
                      </span>
                    </label>
                    <input
                      ref={audioFileInputRef}
                      id="writer-trailer-audio"
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileChange}
                      className="sr-only"
                    />
                    {(selectedAudioFile || audioUrl) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAudioFile(null);
                          setAudioUrl(null);
                          if (audioFileInputRef.current) audioFileInputRef.current.value = '';
                        }}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Remove audio
                      </button>
                    )}
                  </div>
                  {audioUrl && !selectedAudioFile && (
                    <div className="pt-1">
                      <ExclusiveAudioPlayer src={audioUrl} label="Current Trailer Audio" compact />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Bottom Card: Chapter-by-Chapter Composer */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] border border-[#2D142C]/12 dark:border-white/12 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2D142C]/10 dark:border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#C85A32]" />
                  <h2 className="font-display text-xl font-bold">
                    2. Chapter-by-Chapter Manuscript
                  </h2>
                </div>
                <p className="text-xs text-[#2D142C]/70 dark:text-white/70">
                  Add as many chapters as your story needs until completion. Separate paragraphs with blank lines.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-[#2D142C]/15 dark:border-white/15 p-0.5 bg-[#2D142C]/[0.03] dark:bg-white/[0.03]">
                  <button
                    type="button"
                    onClick={() => setChapterViewMode('focused')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      chapterViewMode === 'focused'
                        ? 'bg-[#C85A32] text-white'
                        : 'text-[#2D142C]/75 dark:text-white/75 hover:text-[#C85A32]'
                    }`}
                  >
                    Focused Chapter
                  </button>
                  <button
                    type="button"
                    onClick={() => setChapterViewMode('all')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      chapterViewMode === 'all'
                        ? 'bg-[#C85A32] text-white'
                        : 'text-[#2D142C]/75 dark:text-white/75 hover:text-[#C85A32]'
                    }`}
                  >
                    All Chapters ({chapters.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddChapter}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] hover:bg-[#C85A32] dark:hover:bg-[#C85A32] dark:hover:text-white text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Chapter</span>
                </button>
              </div>
            </div>

            {/* Word & Chapter Telemetry Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="px-4 py-3 rounded-xl border border-[#2D142C]/10 dark:border-white/10 bg-[#2D142C]/[0.02] dark:bg-white/[0.02]">
                <span className="block text-[11px] uppercase tracking-wider opacity-65">
                  Total Chapters
                </span>
                <span className="font-display text-lg font-bold tabular-nums">
                  {chapters.length}
                </span>{' '}
                <span className="text-[11px] opacity-70">(Unlimited)</span>
              </div>
              <div className="px-4 py-3 rounded-xl border border-[#2D142C]/10 dark:border-white/10 bg-[#2D142C]/[0.02] dark:bg-white/[0.02]">
                <span className="block text-[11px] uppercase tracking-wider opacity-65">
                  Total Manuscript Words
                </span>
                <span className="font-display text-lg font-bold tabular-nums">
                  {chapterMetrics.totalWords.toLocaleString()}
                </span>{' '}
                <span className="text-[11px] opacity-70">(Unlimited across story)</span>
              </div>
              <div className="px-4 py-3 rounded-xl border border-[#2D142C]/10 dark:border-white/10 bg-[#2D142C]/[0.02] dark:bg-white/[0.02]">
                <span className="block text-[11px] uppercase tracking-wider opacity-65">
                  Per-Chapter Limit
                </span>
                <span className="font-display text-lg font-bold tabular-nums text-[#C85A32]">
                  {MAX_WORDS_PER_CHAPTER.toLocaleString()}
                </span>{' '}
                <span className="text-[11px] opacity-70">words per chapter</span>
              </div>
            </div>

            {/* Chapter Outline Navigator */}
            <div className="space-y-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wider opacity-70">
                Chapter Outline ({chapters.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {chapters.map((ch, idx) => {
                  const wc = chapterMetrics.counts[idx] ?? 0;
                  const isOver = wc > MAX_WORDS_PER_CHAPTER;
                  const isActive = chapterViewMode === 'focused' && activeChapterIdx === idx;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        setActiveChapterIdx(idx);
                        if (chapterViewMode === 'all') {
                          const el = document.getElementById(`chapter-editor-${idx}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                        isOver
                          ? 'border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300'
                          : isActive
                          ? 'border-[#C85A32] bg-[#C85A32]/12 text-[#C85A32] font-semibold'
                          : 'border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32]'
                      }`}
                    >
                      <span className="font-mono text-[11px] opacity-75">
                        Ch {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="max-w-[140px] truncate">
                        {ch.title.trim() || `Chapter ${idx + 1}`}
                      </span>
                      <span className="text-[10px] opacity-70 tabular-nums">
                        ({wc.toLocaleString()}w)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Demarcated Chapter Editor Boxes */}
            <div className="space-y-6">
              {visibleChapters.map(({ ch, idx }) => {
                const wc = chapterMetrics.counts[idx] ?? 0;
                const isOverLimit = wc > MAX_WORDS_PER_CHAPTER;
                const readMinutes = Math.max(1, Math.round(wc / 220));
                return (
                  <div
                    key={ch.id}
                    id={`chapter-editor-${idx}`}
                    className={`rounded-xl border p-5 sm:p-6 space-y-4 transition-colors ${
                      isOverLimit
                        ? 'border-red-500/60 bg-red-500/[0.03]'
                        : 'border-[#2D142C]/15 dark:border-white/15 bg-[#F9F6F0]/60 dark:bg-[#160C16]/55 sepia:bg-[#F4ECE1]/60'
                    }`}
                  >
                    {/* Chapter Box Header Demarcation */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2D142C]/10 dark:border-white/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-md bg-[#C85A32]/12 text-[#C85A32] font-mono text-xs font-bold tracking-wider uppercase">
                          Chapter {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            isOverLimit
                              ? 'text-red-600 dark:text-red-400'
                              : wc === 0
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-[#2D142C]/75 dark:text-white/75'
                          }`}
                        >
                          {wc.toLocaleString()} / {MAX_WORDS_PER_CHAPTER.toLocaleString()} words
                          {wc > 0 && !isOverLimit ? ` · ~${readMinutes} min read` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveChapter(idx, -1)}
                          title="Move chapter earlier"
                          className="p-1.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === chapters.length - 1}
                          onClick={() => handleMoveChapter(idx, 1)}
                          title="Move chapter later"
                          className="p-1.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        {chapters.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveChapter(idx)}
                            title="Delete this chapter"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor={`chapter-title-${idx}`}
                        className="block text-xs font-semibold"
                      >
                        Chapter {idx + 1} Title
                      </label>
                      <input
                        id={`chapter-title-${idx}`}
                        type="text"
                        value={ch.title}
                        onChange={(e) => handleChapterChange(idx, { title: e.target.value })}
                        placeholder={`e.g., Chapter ${idx + 1}: Into the Salt Caves`}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] focus:outline-none focus:border-[#C85A32]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`chapter-body-${idx}`}
                          className="block text-xs font-semibold"
                        >
                          Chapter {idx + 1} Story Prose
                        </label>
                        {isOverLimit && (
                          <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                            Exceeds 15,000 words — move excess paragraphs to Chapter {idx + 2}
                          </span>
                        )}
                      </div>
                      <textarea
                        id={`chapter-body-${idx}`}
                        rows={13}
                        value={ch.body}
                        onChange={(e) => handleChapterChange(idx, { body: e.target.value })}
                        placeholder={`Write or paste Chapter ${idx + 1} here...\n\nLeave an empty line between paragraphs so readers enjoy clean spacing and paragraph annotations.`}
                        className="w-full px-4 py-3 text-sm rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] focus:outline-none focus:border-[#C85A32] font-reader leading-relaxed"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Another Chapter Quick Action at bottom of composer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleAddChapter}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[#C85A32]/50 hover:border-[#C85A32] hover:bg-[#C85A32]/5 text-xs font-semibold text-[#C85A32] cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Append Chapter {chapters.length + 1}</span>
              </button>
              <span className="text-[11px] opacity-70 tabular-nums">
                Currently editing {chapters.length}{' '}
                {chapters.length === 1 ? 'chapter' : 'chapters'} &middot;{' '}
                {chapterMetrics.totalWords.toLocaleString()} total words
              </span>
            </div>

            {formError && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300"
              >
                {formError}
              </div>
            )}

            {formSuccess && (
              <div
                role="status"
                className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{formSuccess}</span>
                </div>
                {lastSavedStory && (
                  <a
                    href={buildHref('story-detail', { slug: lastSavedStory.slug })}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      navigate('story-detail', { slug: lastSavedStory.slug });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Open Story Page</span>
                  </a>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting || processingCover}
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {uploadingAudio
                    ? 'Uploading Trailer Audio...'
                    : submitting
                    ? 'Saving Manuscript...'
                    : editingStoryId
                    ? 'Save Story & Chapters'
                    : publicationStatus === 'draft'
                    ? 'Save as Studio Draft'
                    : 'Publish Story to Lorethos'}
                </span>
              </button>
              {editingStoryId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-3 rounded-lg border border-[#2D142C]/20 dark:border-white/20 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  Discard Edit
                </button>
              )}
            </div>
          </section>
        </form>

        {/* Published & Studio Catalog Stories */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-bold">
                {isAdmin ? 'All Catalog Stories' : 'Your Stories on Lorethos'}
              </h2>
              <p className="text-xs font-sans-ui text-[#2D142C]/65 dark:text-white/65">
                {isAdmin
                  ? 'Owner/Admin view: edit chapters, update covers, or manage every story in the catalog.'
                  : 'Every published story appears across the reader catalog. Edit chapters anytime.'}
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#C85A32] tabular-nums">
              {catalogStories.length} {catalogStories.length === 1 ? 'story' : 'stories'}
            </span>
          </div>

          {storiesError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300"
            >
              {storiesError}
            </div>
          )}

          {storiesLoading ? (
            <div className="p-8 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center text-xs opacity-70">
              Loading Lorethos catalog stories...
            </div>
          ) : catalogStories.length === 0 ? (
            <div className="p-8 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center text-xs text-[#2D142C]/65 dark:text-white/65">
              No stories yet. Compose your cover, genre, and chapters above to publish your first work.
            </div>
          ) : (
            <div className="space-y-4">
              {catalogStories.map((story) => {
                const totalWords = (story.chapters || []).reduce(
                  (sum, ch) => sum + (ch.wordCount || 0),
                  0
                );
                const isPublished = (story.publicationStatus || 'published') === 'published';
                return (
                  <article
                    key={story.id}
                    className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] border border-[#2D142C]/12 dark:border-white/12 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
                      <img
                        src={story.coverImage || DEFAULT_WRITER_COVER_IMAGE}
                        alt={story.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.dataset.fallbackApplied === '1') return;
                          img.dataset.fallbackApplied = '1';
                          img.src = DEFAULT_WRITER_COVER_IMAGE;
                        }}
                        className="w-20 aspect-[3/4] rounded-lg object-cover border border-[#2D142C]/12 dark:border-white/12 shrink-0 bg-[#2D142C]/5"
                      />

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-sans-ui">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold uppercase ${
                              isPublished
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {story.publicationStatus || 'published'}
                          </span>
                          <span className="text-[#C85A32] font-semibold">{story.genre}</span>
                          <span className="opacity-65">By {story.author}</span>
                          <span className="opacity-65 tabular-nums inline-flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {story.chapters.length}{' '}
                            {story.chapters.length === 1 ? 'chapter' : 'chapters'} &middot;{' '}
                            {totalWords.toLocaleString()} words
                          </span>
                        </div>

                        <h3 className="font-display text-xl font-bold leading-snug">{story.title}</h3>
                        <p className="font-reader text-xs sm:text-sm text-[#2D142C]/80 dark:text-white/80 line-clamp-2">
                          {story.synopsis}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1 font-sans-ui text-xs">
                          <a
                            href={buildHref('story-detail', { slug: story.slug })}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                              e.preventDefault();
                              navigate('story-detail', { slug: story.slug });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#C85A32]/10 text-[#C85A32] hover:bg-[#C85A32] hover:text-white font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{isPublished ? 'Read on Site' : 'Preview Draft'}</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleStartEdit(story)}
                            className="px-3 py-1.5 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] hover:text-[#C85A32] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Chapters &amp; Cover</span>
                          </button>

                          {confirmDeleteId === story.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={deletingId === story.id}
                                onClick={() => void handleDelete(story.id)}
                                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                              >
                                {deletingId === story.id ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1.5 rounded-lg border border-current/20 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(story.id)}
                              className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {story.audioUrl && (
                      <ExclusiveAudioPlayer
                        src={story.audioUrl}
                        label="Attached Trailer Audio"
                        compact
                      />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
