import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Feather, Headphones, Search, X, Calendar, User as UserIcon } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { fetchPublishedWriterStories } from '../lib/writerStories';
import { fetchLikesForStories } from '../lib/storyLikes';
import type { WriterStory } from '../types';
import { ExclusiveAudioPlayer } from './ExclusiveAudioPlayer';
import { StoryLikeButton } from './StoryLikeButton';

interface WriterStoriesFeedProps {
  title?: string;
  subtitle?: string;
  externalQuery?: string;
}

function formatPublishedDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Recently published';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently published';
  }
}

export const WriterStoriesFeed: React.FC<WriterStoriesFeedProps> = ({
  title = 'Latest Stories from Lorethos Writers',
  subtitle = 'Fresh published releases from approved Lorethos writers, ordered newest first with trailer audio previews.',
  externalQuery,
}) => {
  const [stories, setStories] = useState<WriterStory[]>([]);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [activeStory, setActiveStory] = useState<WriterStory | null>(null);
  const [internalQuery, setInternalQuery] = useState('');
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedStoryIds, setLikedStoryIds] = useState<Set<string>>(new Set());

  const activeQuery = (externalQuery !== undefined ? externalQuery : internalQuery).trim();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const res = await fetchPublishedWriterStories();
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
      } else {
        setError(null);
      }
      setStories(res.stories);

      if (res.stories.length > 0) {
        const seededCounts: Record<string, number> = {};
        for (const s of res.stories) {
          seededCounts[s.id] = s.likes_count ?? 0;
        }
        const likesRes = await fetchLikesForStories(res.stories.map((s) => s.id));
        if (!cancelled) {
          setLikeCounts({ ...seededCounts, ...likesRes.state.counts });
          setLikedStoryIds(likesRes.state.likedStoryIds);
        }
      }
      setLoading(false);
    };

    void load();

    const sub = supabase?.auth.onAuthStateChange(async () => {
      if (cancelled) return;
      const storyRes = await fetchPublishedWriterStories();
      if (cancelled || storyRes.stories.length === 0) return;
      const seededCounts: Record<string, number> = {};
      for (const s of storyRes.stories) {
        seededCounts[s.id] = s.likes_count ?? 0;
      }
      const likesRes = await fetchLikesForStories(storyRes.stories.map((s) => s.id));
      if (!cancelled) {
        setStories(storyRes.stories);
        setLikeCounts({ ...seededCounts, ...likesRes.state.counts });
        setLikedStoryIds(likesRes.state.likedStoryIds);
      }
    });

    return () => {
      cancelled = true;
      sub?.data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!activeStory) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveStory(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeStory]);

  const filteredStories = useMemo(() => {
    if (!activeQuery) return stories;
    const q = activeQuery.toLowerCase();
    return stories.filter(
      (story) =>
        story.title.toLowerCase().includes(q) ||
        story.author_username.toLowerCase().includes(q) ||
        story.summary.toLowerCase().includes(q) ||
        story.body.toLowerCase().includes(q)
    );
  }, [stories, activeQuery]);

  if (!isSupabaseConfigured) {
    return null;
  }

  if (!loading && !error && stories.length === 0) {
    return null;
  }

  return (
    <section className="py-14 border-b border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs tracking-wider uppercase text-[#C85A32] font-semibold font-sans-ui">
              <Feather className="w-3.5 h-3.5" />
              <span>Writer Releases</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
              {title}
            </h2>
            <p className="font-reader text-sm text-[#2D142C]/75 dark:text-[#F9F6F0]/75 sepia:text-[#2C1E18]/75 max-w-2xl">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {externalQuery === undefined && stories.length > 0 && (
              <div className="relative w-full sm:w-72">
                <label htmlFor="writer-feed-search" className="sr-only">
                  Search published writer stories
                </label>
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#2D142C]/45 dark:text-white/45 pointer-events-none" />
                <input
                  id="writer-feed-search"
                  type="search"
                  value={internalQuery}
                  onChange={(e) => setInternalQuery(e.target.value)}
                  placeholder="Search stories or authors..."
                  className="w-full pl-8 pr-8 py-2 text-xs rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-white dark:bg-[#1E111E] focus:outline-none focus:border-[#C85A32] font-sans-ui"
                />
                {internalQuery && (
                  <button
                    type="button"
                    onClick={() => setInternalQuery('')}
                    aria-label="Clear writer story search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#2D142C]/50 dark:text-white/50 hover:text-[#C85A32] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {stories.length > 0 && (
              <span className="text-xs font-sans-ui font-medium text-[#2D142C]/65 dark:text-white/65 shrink-0">
                {filteredStories.length} of {stories.length}{' '}
                {stories.length === 1 ? 'published story' : 'published stories'}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 animate-pulse space-y-3"
              >
                <div className="h-4 w-28 rounded bg-[#2D142C]/10 dark:bg-white/10" />
                <div className="h-6 w-3/4 rounded bg-[#2D142C]/10 dark:bg-white/10" />
                <div className="h-16 w-full rounded bg-[#2D142C]/10 dark:bg-white/10" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-xs font-sans-ui text-red-700 dark:text-red-300"
          >
            Unable to load published writer stories: {error}
          </div>
        ) : filteredStories.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center space-y-2">
            <p className="font-display text-lg font-semibold">
              No writer stories matching &ldquo;{activeQuery}&rdquo;
            </p>
            {externalQuery === undefined && (
              <button
                type="button"
                onClick={() => setInternalQuery('')}
                className="text-xs font-semibold text-[#C85A32] hover:underline cursor-pointer"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStories.map((story) => (
              <article
                key={story.id}
                className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 shadow-xs flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-sans-ui text-[#2D142C]/65 dark:text-white/65 sepia:text-[#2C1E18]/65">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#C85A32]">
                      <UserIcon className="w-3 h-3" />
                      <span>{story.author_username}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatPublishedDate(story.created_at)}</span>
                    </span>
                  </div>

                  <h3 className="font-display text-2xl font-bold leading-snug text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18]">
                    {story.title}
                  </h3>

                  <p className="font-reader text-sm text-[#2D142C]/80 dark:text-[#F9F6F0]/80 sepia:text-[#2C1E18]/80 leading-relaxed">
                    {story.summary}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-[#2D142C]/10 dark:border-white/10">
                  {story.audio_url && (
                    <ExclusiveAudioPlayer
                      src={story.audio_url}
                      label="Trailer Audio"
                      compact
                    />
                  )}

                  <div className="flex items-center justify-between gap-2.5">
                    <StoryLikeButton
                      storyId={story.id}
                      storyTitle={story.title}
                      initialCount={likeCounts[story.id] ?? story.likes_count ?? 0}
                      initialLiked={likedStoryIds.has(story.id)}
                      onUpdated={(id, liked, count) => {
                        setLikeCounts((prev) => ({ ...prev, [id]: count }));
                        setStories((prev) =>
                          prev.map((item) => (item.id === id ? { ...item, likes_count: count } : item))
                        );
                        setLikedStoryIds((prev) => {
                          const next = new Set(prev);
                          if (liked) next.add(id);
                          else next.delete(id);
                          return next;
                        });
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => setActiveStory(story)}
                      className="flex-1 py-2 px-4 rounded-lg bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] hover:bg-[#C85A32] dark:hover:bg-[#C85A32] dark:hover:text-white text-xs font-semibold font-sans-ui flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Read Full Story</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Full Story Reader Modal */}
      {activeStory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="writer-story-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveStory(null);
          }}
        >
          <article className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#F9F6F0] dark:bg-[#1E111E] sepia:bg-[#F4ECE1] text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] border border-[#2D142C]/15 dark:border-white/15 shadow-2xl p-6 sm:p-10 space-y-6 my-auto relative">
            <button
              type="button"
              onClick={() => setActiveStory(null)}
              aria-label="Close full story reader"
              className="sticky top-0 float-right w-9 h-9 rounded-full bg-[#2D142C] text-white hover:bg-[#C85A32] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <header className="space-y-3 border-b border-[#2D142C]/12 dark:border-white/12 pb-6">
              <div className="flex flex-wrap items-center gap-2 text-xs font-sans-ui text-[#C85A32] font-semibold uppercase tracking-wider">
                <span>Lorethos Reader Feed</span>
                <span>&middot;</span>
                <span>By {activeStory.author_username}</span>
                <span>&middot;</span>
                <span className="font-normal text-[#2D142C]/65 dark:text-white/65 normal-case">
                  {formatPublishedDate(activeStory.created_at)}
                </span>
              </div>

              <h2
                id="writer-story-modal-title"
                className="font-display text-3xl sm:text-4xl font-bold leading-tight"
              >
                {activeStory.title}
              </h2>

              <p className="font-reader text-sm sm:text-base italic text-[#2D142C]/80 dark:text-[#F9F6F0]/80 sepia:text-[#2C1E18]/80 border-l-2 border-[#C85A32] pl-3.5">
                {activeStory.summary}
              </p>

              <div className="pt-1">
                <StoryLikeButton
                  storyId={activeStory.id}
                  storyTitle={activeStory.title}
                  size="md"
                  initialCount={likeCounts[activeStory.id] ?? activeStory.likes_count ?? 0}
                  initialLiked={likedStoryIds.has(activeStory.id)}
                  onUpdated={(id, liked, count) => {
                    setLikeCounts((prev) => ({ ...prev, [id]: count }));
                    setStories((prev) =>
                      prev.map((item) => (item.id === id ? { ...item, likes_count: count } : item))
                    );
                    setLikedStoryIds((prev) => {
                      const next = new Set(prev);
                      if (liked) next.add(id);
                      else next.delete(id);
                      return next;
                    });
                  }}
                />
              </div>

              {activeStory.audio_url && (
                <div className="pt-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-sans-ui font-semibold text-[#C85A32] mb-1.5">
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Listen to the Trailer Audio</span>
                  </div>
                  <ExclusiveAudioPlayer
                    src={activeStory.audio_url}
                    label={`${activeStory.title} · Trailer Audio`}
                  />
                </div>
              )}
            </header>

            <div className="font-reader text-base sm:text-lg leading-relaxed space-y-5">
              {activeStory.body
                .split(/\n{2,}/)
                .map((para) => para.trim())
                .filter(Boolean)
                .map((para, idx) => (
                  <p key={idx} className="whitespace-pre-line">
                    {para}
                  </p>
                ))}
            </div>
          </article>
        </div>
      )}
    </section>
  );
};
