import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Feather,
  Home,
  Loader2,
  PlusCircle,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  canAccessWriterStudio,
  createWriterStory,
  deleteWriterStory,
  fetchManageableWriterStories,
  formatTrailerSummaryWithLorethosCta,
  getCurrentSupabaseAuthAndProfile,
  updateWriterStory,
  uploadTrailerAudioToBucket,
} from '../lib/writerStories';
import type { SupabaseProfile, WriterStory } from '../types';
import { ExclusiveAudioPlayer } from '../components/ExclusiveAudioPlayer';

export const WriterStudioView: React.FC = () => {
  const { navigate, buildHref } = useApp();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);

  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [submittedStories, setSubmittedStories] = useState<WriterStory[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadStories = useCallback(async (uid: string, isAdmin: boolean) => {
    setStoriesLoading(true);
    setStoriesError(null);
    const res = await fetchManageableWriterStories(uid, isAdmin);
    if (res.error) {
      setStoriesError(res.error);
    }
    setSubmittedStories(res.stories);
    setStoriesLoading(false);
  }, []);

  const refreshAccessAndData = useCallback(async () => {
    setCheckingAccess(true);
    const state = await getCurrentSupabaseAuthAndProfile();
    setAuthUserId(state.userId);
    setProfile(state.profile);
    setCheckingAccess(false);

    if (state.userId && state.profile && canAccessWriterStudio(state.profile.role)) {
      await loadStories(state.userId, state.profile.role === 'admin');
    } else {
      setSubmittedStories([]);
    }
  }, [loadStories]);

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

  const resetForm = () => {
    setEditingStoryId(null);
    setTitle('');
    setSummary('');
    setBody('');
    setAudioUrl(null);
    setSelectedAudioFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUserId || !profile || !canAccessWriterStudio(profile.role)) return;

    setFormError(null);
    setFormSuccess(null);

    const cleanTitle = title.trim();
    const cleanSummary = summary.trim();
    const cleanBody = body.trim();

    if (cleanTitle.length < 2) {
      setFormError('Please enter a Story Title.');
      return;
    }
    if (cleanSummary.length < 10) {
      setFormError('Please enter a Short Summary / Trailer Blurb.');
      return;
    }
    if (cleanBody.length < 20) {
      setFormError('Please enter the Full Story Body.');
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

      if (editingStoryId) {
        const updateRes = await updateWriterStory(editingStoryId, {
          title: cleanTitle,
          summary: cleanSummary,
          body: cleanBody,
          audioUrl: finalAudioUrl,
        });
        if (updateRes.error) {
          setFormError(updateRes.error);
          return;
        }
        setFormSuccess('Story updated and live on the reader feed.');
      } else {
        const createRes = await createWriterStory({
          authorId: authUserId,
          title: cleanTitle,
          summary: cleanSummary,
          body: cleanBody,
          audioUrl: finalAudioUrl,
        });
        if (createRes.error) {
          setFormError(createRes.error);
          return;
        }
        setFormSuccess('Story published to the reader feed.');
      }

      resetForm();
      await loadStories(authUserId, profile.role === 'admin');
    } finally {
      setUploadingAudio(false);
      setSubmitting(false);
    }
  };

  const handleStartEdit = (story: WriterStory) => {
    setFormError(null);
    setFormSuccess(null);
    setEditingStoryId(story.id);
    setTitle(story.title);
    setSummary(story.summary);
    setBody(story.body);
    setAudioUrl(story.audio_url);
    setSelectedAudioFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (storyId: string) => {
    if (!authUserId || !profile) return;
    setDeletingId(storyId);
    setStoriesError(null);
    const res = await deleteWriterStory(storyId);
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (res.error) {
      setStoriesError(res.error);
      return;
    }
    if (editingStoryId === storyId) {
      resetForm();
    }
    setSubmittedStories((prev) => prev.filter((item) => item.id !== storyId));
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-xs font-sans-ui opacity-75">
          <Loader2 className="w-6 h-6 animate-spin text-[#C85A32]" />
          <span>Verifying Writer Studio access...</span>
        </div>
      </div>
    );
  }

  const isAuthorized = Boolean(authUserId && profile && canAccessWriterStudio(profile.role));

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
              This private Lorethos studio is restricted to approved writers and administrators.
            </p>
          </div>
          <a
            href={buildHref('home')}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate('home');
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold font-sans-ui transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </a>
        </div>
      </div>
    );
  }

  const summaryPreview = summary.trim()
    ? formatTrailerSummaryWithLorethosCta(summary, title)
    : '';

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] py-12 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2D142C]/12 dark:border-white/12 pb-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-[#C85A32] font-sans-ui">
              <Feather className="w-3.5 h-3.5" />
              <span>Private Writer Studio</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">
              {editingStoryId ? 'Edit Published Story' : 'Publish a New Story'}
            </h1>
            <p className="text-xs font-sans-ui text-[#2D142C]/70 dark:text-white/70">
              Signed in as <strong className="text-[#2D142C] dark:text-white">{profile.username}</strong>{' '}
              <span className="inline-block ml-1 px-2 py-0.5 rounded bg-[#C85A32]/15 text-[#C85A32] font-semibold uppercase text-[10px]">
                {profile.role}
              </span>
            </p>
          </div>

          <a
            href={buildHref('home')}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate('home');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] text-xs font-semibold font-sans-ui self-start sm:self-auto"
          >
            <Home className="w-3.5 h-3.5" />
            <span>View Reader Feed</span>
          </a>
        </header>

        {/* Writer Posting Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] border border-[#2D142C]/12 dark:border-white/12 shadow-xs space-y-5 font-sans-ui"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#C85A32]" />
              <span>{editingStoryId ? 'Update Story Details' : 'Story Submission Form'}</span>
            </h2>
            {editingStoryId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-[#C85A32] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Edit</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="writer-story-title" className="block text-xs font-semibold">
              Story Title
            </label>
            <input
              id="writer-story-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter your story title"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="writer-story-summary" className="block text-xs font-semibold">
                Short Summary / Trailer Blurb
              </label>
              <button
                type="button"
                onClick={() =>
                  setSummary((prev) => formatTrailerSummaryWithLorethosCta(prev || 'An unforgettable tale awaits.', title))
                }
                className="text-[11px] font-semibold text-[#C85A32] hover:underline cursor-pointer"
              >
                Append Lorethos Read Callout
              </button>
            </div>
            <textarea
              id="writer-story-summary"
              required
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief plot hook that ends with an invitation to read the full story on Lorethos..."
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32] font-reader"
            />
            <p className="text-[11px] text-[#2D142C]/65 dark:text-white/65">
              End with a call to read the full story on Lorethos (added automatically on publish if omitted).
            </p>
            {summaryPreview && summaryPreview !== summary.trim() && (
              <p className="text-[11px] italic text-[#C85A32] bg-[#C85A32]/5 px-3 py-1.5 rounded-lg border border-[#C85A32]/20">
                Will publish as: &ldquo;{summaryPreview}&rdquo;
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="writer-story-body" className="block text-xs font-semibold">
              Full Story Body
            </label>
            <textarea
              id="writer-story-body"
              required
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write or paste the full story text here..."
              className="w-full px-3.5 py-3 text-sm rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32] font-reader leading-relaxed"
            />
          </div>

          <div className="space-y-2.5">
            <label htmlFor="writer-trailer-audio" className="block text-xs font-semibold">
              Optional Trailer Audio Upload <span className="font-normal opacity-65">(Uploaded to trailers bucket)</span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="writer-trailer-audio"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] text-xs font-semibold cursor-pointer transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>{selectedAudioFile ? selectedAudioFile.name : audioUrl ? 'Replace Audio File' : 'Choose Audio File'}</span>
              </label>
              <input
                ref={fileInputRef}
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
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
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

          {formError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300"
            >
              {formError}
            </div>
          )}

          {formSuccess && (
            <div
              role="status"
              className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {uploadingAudio
                ? 'Uploading Trailer Audio...'
                : submitting
                ? 'Saving Story...'
                : editingStoryId
                ? 'Save Changes'
                : 'Publish Story'}
            </span>
          </button>
        </form>

        {/* Submitted Stories List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-bold">
                {profile.role === 'admin' ? 'All Submitted Stories' : 'Your Submitted Stories'}
              </h2>
              <p className="text-xs font-sans-ui text-[#2D142C]/65 dark:text-white/65">
                {profile.role === 'admin'
                  ? 'Admin view: manage stories submitted across all writers.'
                  : 'Edit or remove any story you have published.'}
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#C85A32]">
              {submittedStories.length} {submittedStories.length === 1 ? 'story' : 'stories'}
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
              Loading submitted stories...
            </div>
          ) : submittedStories.length === 0 ? (
            <div className="p-8 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center text-xs text-[#2D142C]/65 dark:text-white/65">
              No stories submitted yet. Publish your first story using the form above.
            </div>
          ) : (
            <div className="space-y-4">
              {submittedStories.map((story) => (
                <article
                  key={story.id}
                  className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] border border-[#2D142C]/12 dark:border-white/12 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-sans-ui">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold uppercase">
                          {story.status}
                        </span>
                        <span className="text-[#C85A32] font-semibold">
                          By {story.author_username}
                        </span>
                        <span className="opacity-60">
                          {new Date(story.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-bold">{story.title}</h3>
                      <p className="font-reader text-xs sm:text-sm text-[#2D142C]/80 dark:text-white/80">
                        {story.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-sans-ui text-xs">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(story)}
                        className="px-3 py-1.5 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] hover:text-[#C85A32] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      {confirmDeleteId === story.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={deletingId === story.id}
                            onClick={() => void handleDelete(story.id)}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer disabled:opacity-60"
                          >
                            {deletingId === story.id ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 rounded-lg border border-current/20 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(story.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {story.audio_url && (
                    <ExclusiveAudioPlayer
                      src={story.audio_url}
                      label="Attached Trailer Audio"
                      compact
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
