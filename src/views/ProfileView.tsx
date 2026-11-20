import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { AVATAR_PRESETS } from '../data/avatarPresets';
import { processGalleryImageFile } from '../utils/avatarImage';
import { computeReaderRank } from '../utils/readerProfile';
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
} from 'lucide-react';

export const ProfileView: React.FC = () => {
  const {
    user,
    isAuthenticated,
    stories,
    updateProfile,
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
  const [imageLoadError, setImageLoadError] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftName(user.name || 'Guest Reader');
    setDraftNickname(user.nickname || '');
    setDraftBio(user.bio || '');
    setDraftAvatar(user.avatar);
    setImageLoadError(false);
  }, [user.id, user.name, user.nickname, user.bio, user.avatar]);

  const previewDisplayName = (draftNickname.trim() || draftName.trim() || 'Reader');
  const rank = computeReaderRank(user, stories);

  const hasUnsavedTextChanges =
    draftName.trim() !== (user.name || '').trim() ||
    draftNickname.trim() !== (user.nickname || '').trim() ||
    draftBio.trim() !== (user.bio || '').trim();

  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, route: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route);
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
    setImageLoadError(false);
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
    setImageLoadError(false);
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
      setImageLoadError(false);
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Live Profile Preview + Details Form */}
          <section className="lg:col-span-5 space-y-6">
            {/* Live Preview Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 shadow-xs space-y-5">
              <div className="flex items-start gap-4">
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#C85A32] bg-[#2D142C] text-[#F9F6F0] flex items-center justify-center shrink-0 shadow-sm">
                  {draftAvatar && !imageLoadError ? (
                    <img
                      src={draftAvatar}
                      alt={previewDisplayName}
                      referrerPolicy="no-referrer"
                      onError={() => setImageLoadError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-3xl font-bold select-none">
                      {previewDisplayName.charAt(0).toUpperCase()}
                    </span>
                  )}
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
      </div>
    </div>
  );
};
