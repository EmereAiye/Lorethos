import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { AVATAR_PRESETS } from '../data/avatarPresets';
import { processGalleryImageFile } from '../utils/avatarImage';
import { computeReaderRank } from '../utils/readerProfile';
import {
  evaluateReaderAchievements,
  type AchievementIconKey,
} from '../utils/readerAchievements';
import {
  canAccessWriterStudio,
  hasVisitedWriterPortal,
} from '../lib/writerStories';
import { ReaderAvatar } from '../components/ReaderAvatar';
import { HighlightColor } from '../types';
import {
  Camera,
  Check,
  CheckCircle2,
  AlertCircle,
  ImagePlus,
  Loader2,
  Trash2,
  UserCheck,
  Award,
  ArrowRight,
  Sparkles,
  BookOpen,
  Layers,
  Moon,
  Zap,
  Trophy,
  Flame,
  Compass,
  Bookmark,
  Lock,
  Feather,
  Highlighter,
  Search,
  Pencil,
  X,
  Users,
} from 'lucide-react';

const ACHIEVEMENT_ICON_MAP: Record<AchievementIconKey, React.ComponentType<{ className?: string }>> = {
  book: BookOpen,
  layers: Layers,
  moon: Moon,
  zap: Zap,
  trophy: Trophy,
  flame: Flame,
  compass: Compass,
  bookmark: Bookmark,
};

const PROFILE_HIGHLIGHT_SWATCHES: Record<
  HighlightColor,
  { label: string; dot: string; accentBorder: string; tintBg: string }
> = {
  terracotta: {
    label: 'Terracotta',
    dot: 'bg-[#C85A32]',
    accentBorder: 'border-[#C85A32]/35',
    tintBg: 'bg-[#C85A32]/[0.06]',
  },
  gold: {
    label: 'Ochre Gold',
    dot: 'bg-amber-500',
    accentBorder: 'border-amber-500/40',
    tintBg: 'bg-amber-500/[0.07]',
  },
  sage: {
    label: 'Forest Sage',
    dot: 'bg-emerald-600',
    accentBorder: 'border-emerald-600/35',
    tintBg: 'bg-emerald-600/[0.06]',
  },
};

export const ProfileView: React.FC = () => {
  const {
    user,
    isAuthenticated,
    stories,
    highlights,
    paragraphBookmarks,
    updateProfile,
    updateHighlight,
    removeHighlight,
    refreshUserRole,
    navigate,
    buildHref,
  } = useApp();

  const [draftName, setDraftName] = useState(user.name || 'Guest Reader');
  const [draftNickname, setDraftNickname] = useState(user.nickname || '');
  const [draftBio, setDraftBio] = useState(user.bio || '');
  const [draftAvatar, setDraftAvatar] = useState<string | undefined>(user.avatar);

  const [savingForm, setSavingForm] = useState(false);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [achievementFilter, setAchievementFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const [highlightQuery, setHighlightQuery] = useState('');
  const [highlightFilter, setHighlightFilter] = useState<'all' | 'notes' | HighlightColor>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [editingNoteColor, setEditingNoteColor] = useState<HighlightColor>('terracotta');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      void refreshUserRole();
    }
  }, [isAuthenticated, refreshUserRole]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#highlights-notes') {
      const timer = window.setTimeout(() => {
        document.getElementById('highlights-notes')?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    setDraftName(user.name || 'Guest Reader');
    setDraftNickname(user.nickname || '');
    setDraftBio(user.bio || '');
    setDraftAvatar(user.avatar);
  }, [user.id, user.name, user.nickname, user.bio, user.avatar]);

  const hasWriterAccess = isAuthenticated && canAccessWriterStudio(user.role);
  const writerPortalSaved = hasWriterAccess && hasVisitedWriterPortal(user.id);

  const previewDisplayName = (draftNickname.trim() || draftName.trim() || 'Reader');
  const rank = computeReaderRank(user, stories);
  const achievements = evaluateReaderAchievements(user, stories, {
    highlightsCount: highlights.length,
    paragraphBookmarksCount: paragraphBookmarks.length,
  });
  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  const filteredAchievements = achievements.filter((item) => {
    if (achievementFilter === 'unlocked') return item.unlocked;
    if (achievementFilter === 'locked') return !item.unlocked;
    return true;
  });

  const hasUnsavedTextChanges =
    draftName.trim() !== (user.name || '').trim() ||
    draftNickname.trim() !== (user.nickname || '').trim() ||
    draftBio.trim() !== (user.bio || '').trim();

  const handleLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    route: string,
    params?: Parameters<typeof navigate>[1]
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route, params);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const cleanName = draftName.trim();
    const cleanNickname = draftNickname.trim();
    const cleanBio = draftBio.trim();

    if (cleanName.length < 2 || cleanName.length > 80) {
      setStatusMessage({ type: 'error', text: 'Display name must be between 2 and 80 characters.' });
      return;
    }
    if (cleanNickname && (cleanNickname.length < 2 || cleanNickname.length > 40)) {
      setStatusMessage({ type: 'error', text: 'Nickname must be between 2 and 40 characters, or left empty.' });
      return;
    }
    if (cleanBio.length > 200) {
      setStatusMessage({ type: 'error', text: 'Bio must be 200 characters or fewer.' });
      return;
    }

    setSavingForm(true);
    try {
      const result = await updateProfile({
        name: cleanName,
        nickname: cleanNickname || null,
        bio: cleanBio || null,
        avatar: draftAvatar ?? null,
      });
      if (!result.ok) {
        setStatusMessage({ type: 'error', text: result.error || 'Could not save profile updates.' });
        return;
      }
      setStatusMessage({
        type: 'success',
        text: isAuthenticated
          ? 'Your reader profile has been saved.'
          : 'Profile saved on this device.',
      });
    } finally {
      setSavingForm(false);
    }
  };

  const handleSelectPreset = async (presetSrc: string, presetLabel: string) => {
    setStatusMessage(null);
    setDraftAvatar(presetSrc);
    const result = await updateProfile({ avatar: presetSrc });
    if (!result.ok) {
      setStatusMessage({ type: 'error', text: result.error || 'Could not update portrait.' });
      return;
    }
    setStatusMessage({ type: 'success', text: `${presetLabel} portrait applied to your profile.` });
  };

  const handleClearAvatar = async () => {
    setStatusMessage(null);
    setDraftAvatar(undefined);
    const result = await updateProfile({ avatar: null });
    if (!result.ok) {
      setStatusMessage({ type: 'error', text: result.error || 'Could not remove portrait.' });
      return;
    }
    setStatusMessage({ type: 'success', text: 'Profile portrait removed.' });
  };

  const handleGalleryFile = async (file: File | undefined) => {
    if (!file) return;
    setStatusMessage(null);
    setProcessingUpload(true);
    try {
      const croppedDataUrl = await processGalleryImageFile(file);
      setDraftAvatar(croppedDataUrl);
      const result = await updateProfile({ avatar: croppedDataUrl });
      if (!result.ok) {
        setStatusMessage({ type: 'error', text: result.error || 'Could not save uploaded image.' });
        return;
      }
      setStatusMessage({ type: 'success', text: 'Gallery photo uploaded and saved to your profile.' });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to process this gallery image.',
      });
    } finally {
      setProcessingUpload(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] py-10 sm:py-12 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 pb-6">
          <div className="space-y-2 max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C85A32] font-sans-ui block">
              Reader Identity
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Your Reader Profile
            </h1>
            <p className="font-reader text-sm sm:text-base opacity-80 leading-relaxed">
              Edit your name, add a public nickname, write a short bio, and pick a curated literary portrait or a photo straight from your device gallery.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-sans-ui text-xs shrink-0">
            {isAuthenticated ? (
              <a
                href={buildHref('account')}
                onClick={(e) => handleLink(e, 'account')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 sepia:border-[#2C1E18]/20 font-semibold hover:border-[#C85A32] hover:text-[#C85A32] transition-colors whitespace-nowrap shrink-0"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Reader Account &amp; Library</span>
              </a>
            ) : (
              <a
                href={buildHref('account', { redirect: '/profile' })}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  navigate('account', { redirect: '/profile' });
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <span>Sign In to Sync Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </header>

        {!isAuthenticated && (
          <div className="rounded-xl border border-[#C85A32]/30 bg-[#C85A32]/8 px-4 py-3 text-xs font-sans-ui flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="leading-relaxed">
              Browsing as a guest — your nickname, bio, and profile picture are saved right on this browser. Sign in anytime to unlock paid chapters and sync your library across devices.
            </p>
          </div>
        )}

        {statusMessage && (
          <div
            role={statusMessage.type === 'error' ? 'alert' : 'status'}
            className={`rounded-xl border px-4 py-3 text-xs font-sans-ui flex items-center gap-2.5 ${
              statusMessage.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/35 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300'
                : 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200'
            }`}
          >
            {statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {hasWriterAccess && (
          <section
            aria-label="Writer Studio quick access"
            className="editorial-card rounded-2xl border border-[#C85A32]/35 bg-[#2D142C] text-[#F9F6F0] p-6 sm:p-7 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6"
          >
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-sans-ui font-semibold uppercase tracking-[0.18em] text-[#C85A32]">
                <Feather className="w-3.5 h-3.5" />
                <span>Approved Writer Side</span>
                <span className="opacity-40">&middot;</span>
                <span>Role: {user.role}</span>
                {writerPortalSaved && (
                  <>
                    <span className="opacity-40">&middot;</span>
                    <span className="text-emerald-300">Quick-Access Linked</span>
                  </>
                )}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Your Private Writer Studio Desk
              </h2>
              <p className="font-reader text-xs sm:text-sm text-white/80 leading-relaxed">
                Open your Lorethos publishing desk directly from your profile anytime to submit new stories, upload trailer audio, and edit or manage your published works—no need to search for your invite link again.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0 font-sans-ui">
              <a
                href={buildHref('writer')}
                onClick={(e) => handleLink(e, 'writer')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Feather className="w-4 h-4" />
                <span>Open Writer Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              {user.role === 'owner' && (
                <a
                  href={buildHref('admin', { tab: 'users' })}
                  onClick={(e) => handleLink(e, 'admin', { tab: 'users' })}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-white/25 hover:border-[#C85A32] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <Users className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>Manage Community Profiles</span>
                </a>
              )}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Live Profile Preview + Details Form */}
          <section className="lg:col-span-5 space-y-6">
            {/* Live Preview Card */}
            <div className="editorial-card p-6 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 shadow-xs space-y-5">
              <div className="flex items-start gap-4">
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#C85A32] bg-[#2D142C] text-[#F9F6F0] flex items-center justify-center shrink-0 shadow-sm">
                  <ReaderAvatar
                    src={draftAvatar}
                    name={previewDisplayName}
                    initialClassName="font-display text-3xl font-bold select-none leading-none"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1.5 pt-1">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-[#C85A32] font-sans-ui">
                    Live Profile Preview
                  </div>
                  <h2 className="font-display text-2xl font-bold truncate">
                    {previewDisplayName}
                  </h2>
                  {draftNickname.trim() && draftName.trim() && draftNickname.trim() !== draftName.trim() && (
                    <p className="text-xs opacity-70 font-sans-ui truncate">
                      {draftName.trim()}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs font-sans-ui">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#C85A32]">
                      <Award className="w-3.5 h-3.5" />
                      <span>Rank {rank.roman} &middot; {rank.title}</span>
                    </span>
                    <span className="opacity-40">&middot;</span>
                    <span className="opacity-70 tabular-nums">
                      {rank.completedChapters} ch read
                    </span>
                  </div>
                </div>
              </div>

              {draftBio.trim() ? (
                <p className="font-reader text-sm opacity-85 leading-relaxed pt-3 border-t border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/12">
                  {draftBio.trim()}
                </p>
              ) : (
                <p className="font-reader text-xs italic opacity-55 pt-3 border-t border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/12">
                  Add a short bio below to share your favorite genres or reading mood.
                </p>
              )}

              {draftAvatar && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-sans-ui opacity-65 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#C85A32]" />
                    <span>Portrait active on navbar &amp; account</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleClearAvatar()}
                    className="inline-flex items-center gap-1 text-[11px] font-sans-ui font-semibold text-[#2D142C]/65 dark:text-white/65 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove Photo</span>
                  </button>
                </div>
              )}
            </div>

            {/* Identity Details Form */}
            <form
              onSubmit={handleSaveDetails}
              className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 shadow-xs space-y-4 font-sans-ui text-xs"
            >
              <div className="space-y-1">
                <h2 className="font-display text-xl font-bold">Profile Details</h2>
                <p className="opacity-70">
                  Set your display name and optional nickname shown across Lorethos.
                </p>
              </div>

              <div>
                <label htmlFor="profile-name" className="block font-semibold mb-1.5">
                  Display / Full Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/20 dark:border-white/20 sepia:border-[#2C1E18]/25 bg-[#F9F6F0]/60 dark:bg-[#160C16]/70 sepia:bg-[#F4ECE1]/70 text-sm focus:outline-none focus:border-[#C85A32]"
                />
              </div>

              <div>
                <label htmlFor="profile-nickname" className="block font-semibold mb-1.5">
                  Nickname <span className="font-normal opacity-65">(Optional — shown publicly)</span>
                </label>
                <input
                  id="profile-nickname"
                  type="text"
                  maxLength={40}
                  value={draftNickname}
                  onChange={(e) => setDraftNickname(e.target.value)}
                  placeholder="e.g. BronzeScribe, LanternKeeper"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/20 dark:border-white/20 sepia:border-[#2C1E18]/25 bg-[#F9F6F0]/60 dark:bg-[#160C16]/70 sepia:bg-[#F4ECE1]/70 text-sm focus:outline-none focus:border-[#C85A32]"
                />
                <p className="mt-1 text-[11px] opacity-65">
                  When set, your nickname appears on chapter comments and in the top bar.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="profile-bio" className="font-semibold">
                    Short Bio <span className="font-normal opacity-65">(Optional)</span>
                  </label>
                  <span className="text-[11px] font-mono opacity-60 tabular-nums">
                    {draftBio.length}/200
                  </span>
                </div>
                <textarea
                  id="profile-bio"
                  rows={3}
                  maxLength={200}
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  placeholder="Tell fellow readers what kinds of worlds and chronicles draw you in..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#2D142C]/20 dark:border-white/20 sepia:border-[#2C1E18]/25 bg-[#F9F6F0]/60 dark:bg-[#160C16]/70 sepia:bg-[#F4ECE1]/70 text-sm font-reader leading-relaxed focus:outline-none focus:border-[#C85A32] resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingForm}
                  className="px-5 py-2.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold text-xs inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {savingForm ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Profile</span>
                    </>
                  )}
                </button>

                {hasUnsavedTextChanges && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftName(user.name || 'Guest Reader');
                      setDraftNickname(user.nickname || '');
                      setDraftBio(user.bio || '');
                      setStatusMessage(null);
                    }}
                    className="px-3.5 py-2.5 rounded-lg border border-[#2D142C]/20 dark:border-white/20 text-xs font-semibold hover:border-[#C85A32] transition-colors cursor-pointer"
                  >
                    Discard Edits
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Right Column: Profile Image Studio (Gallery Upload + Easy Preset Series) */}
          <section className="lg:col-span-7 space-y-6">
            {/* Upload From Device Gallery */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="font-display text-xl font-bold">
                    Pick a Photo from Your Gallery
                  </h2>
                  <p className="text-xs font-sans-ui opacity-70">
                    Choose any picture from your phone or computer gallery. It is automatically centered and fitted cleanly to your portrait frame.
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-label="Choose profile photo from gallery"
                className="sr-only"
                onChange={(e) => void handleGalleryFile(e.target.files?.[0])}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  void handleGalleryFile(e.dataTransfer.files?.[0]);
                }}
                className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-[#C85A32] bg-[#C85A32]/10'
                    : 'border-[#2D142C]/20 dark:border-white/20 sepia:border-[#2C1E18]/25 bg-[#F9F6F0]/60 dark:bg-[#160C16]/50 sepia:bg-[#F4ECE1]/60'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#C85A32]/15 text-[#C85A32] flex items-center justify-center">
                    {processingUpload ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ImagePlus className="w-5 h-5" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold font-sans-ui">
                      {processingUpload
                        ? 'Preparing your portrait...'
                        : 'Select an image from your device gallery'}
                    </p>
                    <p className="text-[11px] font-sans-ui opacity-65">
                      Supports JPG, PNG, WebP, or GIF (drag &amp; drop or browse files)
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={processingUpload}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] text-xs font-semibold font-sans-ui hover:opacity-90 transition-opacity inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Choose Photo from Gallery</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Easy Curated Preset Portraits */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#C85A32]" />
                    <h2 className="font-display text-xl font-bold">
                      Easy Portrait Gallery
                    </h2>
                  </div>
                  <p className="text-xs font-sans-ui opacity-70">
                    Tap any Lorethos emblem or reader portrait below to set it right away.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {AVATAR_PRESETS.map((preset) => {
                  const isSelected = draftAvatar === preset.src;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => void handleSelectPreset(preset.src, preset.label)}
                      aria-pressed={isSelected}
                      className={`group text-left rounded-xl p-2.5 border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] ${
                        isSelected
                          ? 'border-[#C85A32] bg-[#C85A32]/10 ring-1 ring-[#C85A32]'
                          : 'border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 hover:border-[#C85A32]/60 bg-[#F9F6F0]/50 dark:bg-[#160C16]/40 sepia:bg-[#F4ECE1]/50'
                      }`}
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-[#2D142C]/10">
                        <img
                          src={preset.src}
                          alt={preset.label}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {isSelected && (
                          <span
                            aria-hidden="true"
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#C85A32] text-white flex items-center justify-center shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="pt-2.5 px-0.5 space-y-0.5">
                        <div className="font-display text-sm font-bold leading-snug">
                          {preset.label}
                        </div>
                        <div className="text-[11px] font-sans-ui opacity-65 leading-snug line-clamp-2">
                          {preset.caption}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Reader Achievements Showcase */}
        <section
          aria-labelledby="reader-achievements-heading"
          className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 shadow-xs space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/12 pb-5">
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C85A32] font-sans-ui block">
                Reading Milestones
              </span>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2
                  id="reader-achievements-heading"
                  className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
                >
                  Reader Achievements
                </h2>
                <span className="text-xs font-sans-ui font-semibold text-[#C85A32] tabular-nums">
                  {unlockedCount} of {achievements.length} Badges Earned
                </span>
              </div>
              <p className="text-xs sm:text-sm font-reader opacity-75 max-w-2xl">
                Badges unlock automatically from your chapters finished, late-night sessions, reading speed, streaks, and saved margin lore.
              </p>
            </div>

            {/* Filter Tabs */}
            <div
              role="tablist"
              aria-label="Filter reader achievements"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 font-sans-ui text-xs self-start md:self-auto"
            >
              {(
                [
                  { id: 'all', label: `All (${achievements.length})` },
                  { id: 'unlocked', label: `Earned (${unlockedCount})` },
                  { id: 'locked', label: `In Progress (${achievements.length - unlockedCount})` },
                ] as const
              ).map((tab) => {
                const active = achievementFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setAchievementFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      active
                        ? 'bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16]'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredAchievements.length === 0 ? (
            <div className="py-8 text-center space-y-2 font-sans-ui">
              <p className="text-sm font-semibold">
                {achievementFilter === 'unlocked'
                  ? 'No badges earned yet.'
                  : 'Every badge has been unlocked.'}
              </p>
              <p className="text-xs opacity-70">
                {achievementFilter === 'unlocked'
                  ? 'Open any chronicle and finish your first chapter to unlock your opening badge.'
                  : 'You have mastered every reading achievement currently available on Lorethos.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredAchievements.map((badge) => {
                const Icon = ACHIEVEMENT_ICON_MAP[badge.iconKey] || Award;
                return (
                  <article
                    key={badge.id}
                    className={`rounded-xl p-4 border flex flex-col justify-between gap-4 transition-colors ${
                      badge.unlocked
                        ? 'border-[#C85A32]/40 bg-[#F9F6F0]/80 dark:bg-[#160C16]/75 sepia:bg-[#F4ECE1]/85'
                        : 'border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 bg-[#F9F6F0]/35 dark:bg-[#160C16]/35 sepia:bg-[#F4ECE1]/40'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            badge.unlocked
                              ? 'bg-[#C85A32]/15 text-[#C85A32]'
                              : 'bg-[#2D142C]/8 dark:bg-white/10 text-[#2D142C]/55 dark:text-white/55 sepia:text-[#2C1E18]/55'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="text-right font-sans-ui">
                          <span className="text-[10px] uppercase tracking-wider opacity-60 block">
                            {badge.category}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5 ${
                              badge.unlocked
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'opacity-65'
                            }`}
                          >
                            {badge.unlocked ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Earned</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" />
                                <span>In Progress</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-display text-base font-bold leading-snug">
                          {badge.title}
                        </h3>
                        <p className="font-reader text-xs opacity-75 leading-relaxed">
                          {badge.description}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/12 font-sans-ui">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="opacity-70 truncate" title={badge.requirementLabel}>
                          {badge.requirementLabel}
                        </span>
                        <span className="font-semibold tabular-nums shrink-0 text-[#C85A32]">
                          {badge.progressLabel}
                        </span>
                      </div>
                      <div
                        className="w-full h-1.5 rounded-full bg-[#2D142C]/10 dark:bg-white/10 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={badge.progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${badge.title} progress`}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            badge.unlocked ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-[#C85A32]'
                          }`}
                          style={{ width: `${badge.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Saved Highlights & Personal Story Notes */}
        <section
          id="highlights-notes"
          aria-labelledby="profile-highlights-heading"
          className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 shadow-xs space-y-6 scroll-mt-24"
        >
          {(() => {
            const notesCount = highlights.filter((h) => Boolean(h.note && h.note.trim())).length;
            const trimmedQ = highlightQuery.trim().toLowerCase();
            const filteredHighlights = highlights.filter((hl) => {
              if (highlightFilter === 'notes' && (!hl.note || !hl.note.trim())) return false;
              if (
                (highlightFilter === 'terracotta' ||
                  highlightFilter === 'gold' ||
                  highlightFilter === 'sage') &&
                hl.color !== highlightFilter
              ) {
                return false;
              }
              if (!trimmedQ) return true;
              return (
                hl.storyTitle.toLowerCase().includes(trimmedQ) ||
                hl.chapterTitle.toLowerCase().includes(trimmedQ) ||
                (hl.selectedText || '').toLowerCase().includes(trimmedQ) ||
                hl.excerpt.toLowerCase().includes(trimmedQ) ||
                (hl.note || '').toLowerCase().includes(trimmedQ)
              );
            });

            return (
              <>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/12 pb-5">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C85A32] font-sans-ui block">
                      Margin Annotations
                    </span>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h2
                        id="profile-highlights-heading"
                        className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
                      >
                        Saved Highlights &amp; Personal Notes
                      </h2>
                      <span className="text-xs font-sans-ui font-semibold text-[#C85A32] tabular-nums">
                        {highlights.length} {highlights.length === 1 ? 'Highlight' : 'Highlights'} &middot; {notesCount}{' '}
                        {notesCount === 1 ? 'Personal Note' : 'Personal Notes'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-reader opacity-75 max-w-2xl">
                      Revisit any highlighted line or personal paragraph note you saved while reading stories, edit your thoughts anytime, or jump straight back into that exact passage.
                    </p>
                  </div>

                  {highlights.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 font-sans-ui text-xs">
                      <div className="relative">
                        <label htmlFor="profile-highlights-search" className="sr-only">
                          Search highlights and personal notes
                        </label>
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
                        <input
                          id="profile-highlights-search"
                          type="search"
                          value={highlightQuery}
                          onChange={(e) => setHighlightQuery(e.target.value)}
                          placeholder="Search notes or passages..."
                          className="pl-8 pr-3 py-1.5 rounded-lg border border-[#2D142C]/18 dark:border-white/18 sepia:border-[#2C1E18]/20 bg-[#F9F6F0]/70 dark:bg-[#160C16]/70 sepia:bg-[#F4ECE1]/70 text-xs focus:outline-none focus:border-[#C85A32] w-52 sm:w-60"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {highlights.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 font-sans-ui text-xs">
                    {(
                      [
                        { id: 'all', label: `All (${highlights.length})` },
                        { id: 'notes', label: `With Notes (${notesCount})` },
                        { id: 'terracotta', label: 'Terracotta' },
                        { id: 'gold', label: 'Ochre Gold' },
                        { id: 'sage', label: 'Forest Sage' },
                      ] as const
                    ).map((tab) => {
                      const active = highlightFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setHighlightFilter(tab.id)}
                          className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                            active
                              ? 'bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] border-[#2D142C] dark:border-white'
                              : 'border-[#2D142C]/15 dark:border-white/15 sepia:border-[#2C1E18]/20 opacity-75 hover:opacity-100 hover:border-[#C85A32]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {highlights.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-[#2D142C]/18 dark:border-white/18 sepia:border-[#2C1E18]/20 text-center space-y-3">
                    <div className="w-11 h-11 rounded-full bg-[#C85A32]/12 text-[#C85A32] flex items-center justify-center mx-auto">
                      <Highlighter className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                      <h3 className="font-display text-lg font-bold">No Saved Highlights or Notes Yet</h3>
                      <p className="text-xs font-reader opacity-75 leading-relaxed">
                        Open any story chapter, select a line or tap <strong className="text-[#C85A32]">Highlight / Note</strong> beside any paragraph, and your personal margin thoughts will gather here for review.
                      </p>
                    </div>
                    <a
                      href={buildHref('stories')}
                      onClick={(e) => handleLink(e, 'stories')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold font-sans-ui transition-colors whitespace-nowrap"
                    >
                      <span>Browse Stories to Read</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : filteredHighlights.length === 0 ? (
                  <div className="py-8 text-center text-xs font-sans-ui opacity-70">
                    No highlights match your current search or filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredHighlights.map((hl) => {
                      const swatch = PROFILE_HIGHLIGHT_SWATCHES[hl.color] || PROFILE_HIGHLIGHT_SWATCHES.terracotta;
                      const isEditing = editingNoteId === hl.id;
                      const readerParams = {
                        slug: hl.storySlug,
                        chapterNumber: hl.chapterNumber,
                        paragraph: hl.paragraphIndex,
                        highlight: hl.id,
                      };

                      return (
                        <article
                          key={hl.id}
                          className={`rounded-xl p-5 border ${swatch.accentBorder} ${swatch.tintBg} flex flex-col justify-between gap-4`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2 text-[11px] font-sans-ui">
                              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${swatch.dot}`}
                                  aria-hidden="true"
                                />
                                <span className="font-semibold text-[#C85A32] truncate">
                                  {hl.storyTitle}
                                </span>
                                <span className="opacity-40">&middot;</span>
                                <span className="opacity-75 tabular-nums whitespace-nowrap">
                                  Ch. {hl.chapterNumber}
                                </span>
                                <span className="opacity-40">&middot;</span>
                                <span className="opacity-75 tabular-nums whitespace-nowrap">
                                  Para. {hl.paragraphIndex + 1}
                                </span>
                              </div>
                              <span className="opacity-60 whitespace-nowrap shrink-0 tabular-nums">
                                {hl.createdAt}
                              </span>
                            </div>

                            <blockquote className="font-reader text-sm italic leading-relaxed opacity-90 line-clamp-4">
                              &ldquo;{hl.selectedText || hl.excerpt}&rdquo;
                            </blockquote>

                            {isEditing ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  updateHighlight(hl.id, {
                                    color: editingNoteColor,
                                    note: editingNoteText.trim() || null,
                                  });
                                  setEditingNoteId(null);
                                }}
                                className="p-3 rounded-lg bg-white/85 dark:bg-[#160C16]/85 sepia:bg-[#F4ECE1]/90 border border-[#C85A32]/30 space-y-2.5 font-sans-ui text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-[11px] opacity-80">Edit Personal Note</span>
                                  <div className="flex items-center gap-1.5">
                                    {(['terracotta', 'gold', 'sage'] as const).map((color) => (
                                      <button
                                        key={color}
                                        type="button"
                                        onClick={() => setEditingNoteColor(color)}
                                        aria-label={PROFILE_HIGHLIGHT_SWATCHES[color].label}
                                        className={`w-4 h-4 rounded-full ${PROFILE_HIGHLIGHT_SWATCHES[color].dot} cursor-pointer transition-transform ${
                                          editingNoteColor === color
                                            ? 'ring-2 ring-offset-1 ring-[#C85A32] scale-110'
                                            : 'opacity-65 hover:opacity-100'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <textarea
                                  rows={2}
                                  maxLength={1000}
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  placeholder="Write your personal reflection on this passage..."
                                  className="w-full px-3 py-2 rounded-lg border border-current/20 bg-transparent text-xs focus:outline-none focus:border-[#C85A32]"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingNoteId(null)}
                                    className="px-2.5 py-1 rounded border border-current/20 opacity-80 hover:opacity-100 cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Cancel</span>
                                  </button>
                                  <button
                                    type="submit"
                                    className="px-3 py-1 rounded bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Save Note</span>
                                  </button>
                                </div>
                              </form>
                            ) : hl.note ? (
                              <div className="p-3 rounded-lg bg-white/70 dark:bg-[#160C16]/70 sepia:bg-[#F4ECE1]/80 border border-current/10 text-xs font-sans-ui leading-relaxed">
                                <span className="font-semibold text-[#C85A32] mr-1.5">Personal Note:</span>
                                <span className="opacity-90 whitespace-pre-line">{hl.note}</span>
                              </div>
                            ) : (
                              <p className="text-[11px] font-sans-ui italic opacity-60">
                                Highlighted passage — add a personal note to capture your thoughts.
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-2 border-t border-current/10 text-xs font-sans-ui">
                            <div className="flex items-center gap-3">
                              {!isEditing && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNoteId(hl.id);
                                    setEditingNoteText(hl.note || '');
                                    setEditingNoteColor(hl.color);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C85A32] hover:underline cursor-pointer whitespace-nowrap"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>{hl.note ? 'Edit Note' : 'Add Note'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeHighlight(hl.id)}
                                aria-label={`Delete highlight from ${hl.storyTitle}`}
                                className="inline-flex items-center gap-1 text-[11px] opacity-60 hover:opacity-100 hover:text-red-600 dark:hover:text-red-400 cursor-pointer whitespace-nowrap"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </div>

                            <a
                              href={buildHref('reader', readerParams)}
                              onClick={(e) => {
                                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                                e.preventDefault();
                                navigate('reader', readerParams);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#C85A32] hover:underline whitespace-nowrap shrink-0"
                            >
                              <span>Revisit Passage</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </section>
      </div>
    </div>
  );
};
