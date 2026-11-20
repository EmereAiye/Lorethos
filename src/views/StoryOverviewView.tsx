import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  BookOpen,
  Lock,
  Unlock,
  Bookmark,
  Share2,
  Check,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { StoryTrailerPlayer } from '../components/StoryTrailerPlayer';
import { VideoTrailerStudio } from '../components/VideoTrailerStudio';
import { StoryLikeButton } from '../components/StoryLikeButton';
import { fetchLikesForStories } from '../lib/storyLikes';
import { supabase } from '../lib/supabase';
import {
  AVERAGE_READING_WPM,
  estimateChapterReadingTime,
  summarizeStoryReadingTime
} from '../utils/readingTime';

export const StoryOverviewView: React.FC = () => {
  const {
    routeParams,
    getStoryBySlug,
    navigate,
    buildHref,
    hasAccessToChapter,
    user,
    isAuthenticated,
    openPaystackCheckout,
    toggleBookmark
  } = useApp();

  const [shareCopied, setShareCopied] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const story = getStoryBySlug(routeParams.slug || '');

  React.useEffect(() => {
    if (!story?.id) return;
    let cancelled = false;
    const loadLikes = async () => {
      const res = await fetchLikesForStories([story.id]);
      if (!cancelled) {
        setLikeCount(res.state.counts[story.id] || 0);
        setIsLiked(res.state.likedStoryIds.has(story.id));
      }
    };
    void loadLikes();
    const sub = supabase?.auth.onAuthStateChange(() => {
      void loadLikes();
    });
    return () => {
      cancelled = true;
      sub?.data?.subscription?.unsubscribe();
    };
  }, [story?.id, isAuthenticated]);

  const handleLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    route: string,
    params?: Parameters<typeof navigate>[1]
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route, params);
  };

  if (!story) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-20 text-center space-y-4">
        <h2 className="font-display text-2xl font-bold">Story Not Found</h2>
        <a
          href={buildHref('stories')}
          onClick={(e) => handleLink(e, 'stories')}
          className="inline-block text-xs font-semibold text-[#C85A32] underline"
        >
          Return to Library
        </a>
      </div>
    );
  }

  const isUnlockedForUser =
    isAuthenticated &&
    (user.unlockedStoryIds.includes(story.id) ||
      user.subscription.status === 'active' ||
      user.role === 'owner' ||
      story.accessTier === 'free');

  const handleShare = async () => {
    const canonicalUrl = `${window.location.origin}${buildHref('story-detail', { slug: story.slug })}`;
    try {
      await navigator.clipboard?.writeText(canonicalUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  };

  const readingSummary = summarizeStoryReadingTime(story.chapters);

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-12 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

        {/* Breadcrumb */}
        <a
          href={buildHref('stories')}
          onClick={(e) => handleLink(e, 'stories')}
          className="inline-flex items-center gap-2 text-xs font-medium text-[#2D142C]/65 dark:text-white/65 hover:text-[#C85A32] transition-colors font-sans-ui"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Story Library</span>
        </a>

        {/* Story Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="w-full max-w-xs rounded-xl overflow-hidden shadow-2xl border border-[#2D142C]/15 dark:border-white/15 relative">
              <img
                src={story.coverImage}
                alt={`${story.title} cover`}
                className="w-full h-auto aspect-[3/4] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white">
                <span className="font-semibold px-2 py-0.5 rounded bg-black/60">
                  {story.status}
                </span>
                <span className="font-semibold px-2 py-0.5 rounded bg-[#C85A32]">
                  {story.chapters.length} Chapters
                </span>
              </div>
            </div>

            <div className="w-full max-w-xs mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 py-2 px-3 rounded border border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32] text-[#2D142C]/80 dark:text-white/80 hover:text-[#C85A32] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {shareCopied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => toggleBookmark(story.chapters[0]?.id || '')}
                className="py-2 px-3 rounded border border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32] text-[#2D142C]/80 dark:text-white/80 hover:text-[#C85A32] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Save Chapter 1 to bookmarks"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Bookmark</span>
              </button>

              <StoryLikeButton
                storyId={story.id}
                storyTitle={story.title}
                size="md"
                initialCount={likeCount}
                initialLiked={isLiked}
                onUpdated={(_id, liked, count) => {
                  setIsLiked(liked);
                  setLikeCount(count);
                }}
              />
            </div>
            <div role="status" aria-live="polite" className="sr-only">
              {shareCopied ? 'Story link copied to clipboard.' : ''}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#C85A32] font-semibold font-sans-ui">
                <span>{story.genre}</span>
                <span>&middot;</span>
                <span className="text-[#2D142C]/60 dark:text-white/60 font-normal">Serialized Release</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#2D142C] dark:text-[#F9F6F0]">
                {story.title}
              </h1>

              <p className="font-reader text-lg text-[#2D142C]/80 dark:text-[#F9F6F0]/80 italic">
                &ldquo;{story.subtitle}&rdquo;
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#2D142C]/70 dark:text-white/70 font-sans-ui pt-1">
              <span>Author: <strong className="text-[#2D142C] dark:text-white">{story.author}</strong></span>
              <span>&middot;</span>
              <span>{story.chapters.length} Chapters</span>
              <span>&middot;</span>
              <span className="inline-flex items-center gap-1 font-medium text-[#2D142C] dark:text-white">
                <Clock className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>
                  ~{readingSummary.totalStoryMinutes} min total ({readingSummary.averageWordCount.toLocaleString()} avg words, ~{readingSummary.averageChapterMinutes} min/ch)
                </span>
              </span>
              <span>&middot;</span>
              <span>Chapters 1&ndash;{story.freeChaptersCount} Free</span>
              <span>&middot;</span>
              <span>Updated {story.updatedAt}</span>
            </div>

            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-semibold tracking-wider uppercase text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                Synopsis
              </h2>
              <p className="font-reader text-sm sm:text-base text-[#2D142C]/85 dark:text-[#F9F6F0]/85 leading-relaxed">
                {story.synopsis}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#2D142C]/5 dark:bg-white/5 border border-[#2D142C]/10 dark:border-white/10 space-y-1.5">
              <div className="text-[11px] font-semibold text-[#C85A32] tracking-wider uppercase font-sans-ui">
                Background Notes
              </div>
              <p className="font-reader text-xs sm:text-sm text-[#2D142C]/80 dark:text-[#F9F6F0]/80 italic">
                &ldquo;{story.prologueLore}&rdquo;
              </p>
            </div>

            {user.readingProgress[story.id] && (
              <div className="p-4 rounded-xl bg-[#C85A32]/10 border border-[#C85A32]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans-ui">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#C85A32] uppercase tracking-wider text-[10px]">
                      Your Reading Progress
                    </span>
                    <span className="font-mono font-bold text-[#C85A32]">
                      {user.readingProgress[story.id].progressPercent}%
                    </span>
                  </div>
                  <p className="text-xs text-[#2D142C]/80 dark:text-white/80">
                    Currently reading Chapter {user.readingProgress[story.id].chapterNumber} &middot; {user.readingProgress[story.id].lastReadAt}
                  </p>
                </div>

                <a
                  href={buildHref('reader', {
                    slug: story.slug,
                    chapterNumber: user.readingProgress[story.id].chapterNumber
                  })}
                  onClick={(e) =>
                    handleLink(e, 'reader', {
                      slug: story.slug,
                      chapterNumber: user.readingProgress[story.id].chapterNumber
                    })
                  }
                  className="px-4 py-2 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold rounded-lg text-xs shadow-xs self-start sm:self-auto"
                >
                  Resume Ch. {user.readingProgress[story.id].chapterNumber} &rarr;
                </a>
              </div>
            )}

            <div className="p-5 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <a
                  href={buildHref('reader', {
                    slug: story.slug,
                    chapterNumber: user.readingProgress[story.id]?.chapterNumber || 1
                  })}
                  onClick={(e) =>
                    handleLink(e, 'reader', {
                      slug: story.slug,
                      chapterNumber: user.readingProgress[story.id]?.chapterNumber || 1
                    })
                  }
                  className="px-6 py-3.5 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold tracking-wide rounded-lg flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>
                    {user.readingProgress[story.id]
                      ? `Resume Reading (Ch. ${user.readingProgress[story.id].chapterNumber})`
                      : 'Start Reading (Chapter 1 Free)'}
                  </span>
                </a>

                {!isUnlockedForUser ? (
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
                    className="px-4 py-3 border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] text-xs font-medium text-[#2D142C] dark:text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#C85A32]" />
                    <span>Unlock Full Story for ₦{story.priceNgn.toLocaleString('en-NG')}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-2 rounded-lg">
                    <Check className="w-4 h-4" />
                    <span>Unlocked on your Account</span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-[#2D142C]/65 dark:text-white/65 font-sans-ui flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>&check; Chapters 1 to {story.freeChaptersCount} are Free</span>
                <span>&middot;</span>
                <span>&check; Verified Paystack Checkout in Nigeria</span>
                <span>&middot;</span>
                <span>&check; Day, Sepia &amp; Night Reader Themes</span>
              </div>
            </div>

          </div>
        </div>

        {story.trailerVideoUrl && (
          <StoryTrailerPlayer
            story={story}
            readerHref={buildHref('reader', { slug: story.slug, chapterNumber: 1 })}
            onNavigateReader={() => navigate('reader', { slug: story.slug, chapterNumber: 1 })}
          />
        )}

        <VideoTrailerStudio
          storySlug={story.slug}
          storyTitle={story.title}
          heading="Custom Scene Video Generator"
          description="Want a custom clip from another scene? Describe the scene in words to generate a new 15–30 second talking video variation."
          defaultPrompt={`${story.synopsis.length <= 220 ? story.synopsis : `${story.synopsis.slice(0, 220).replace(/\s+\S*$/, '')}...`} Atmospheric book trailer, painterly lighting, slow camera push.`}
        />

        {/* Chapter Directory */}
        <section className="space-y-6 pt-6 border-t border-[#2D142C]/10 dark:border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
                Chapter Directory ({story.chapters.length})
              </h2>
              <p className="font-sans-ui text-xs text-[#2D142C]/65 dark:text-white/65 mt-0.5">
                Chapters 1&ndash;{story.freeChaptersCount} are free &middot; Est. reading times calculated at {AVERAGE_READING_WPM} words/min (avg. {readingSummary.averageWordCount.toLocaleString()} words, ~{readingSummary.averageChapterMinutes} min/ch).
              </p>
            </div>

            {!isUnlockedForUser && (
              <a
                href={buildHref('pricing')}
                onClick={(e) => handleLink(e, 'pricing')}
                className="text-xs font-semibold text-[#C85A32] hover:underline"
              >
                Or unlock catalog titles with Monthly Membership (₦3,500/mo) &rarr;
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 divide-y divide-[#2D142C]/10 dark:divide-white/10 bg-white dark:bg-[#1E111E] rounded-xl border border-[#2D142C]/10 dark:border-white/10 shadow-2xs overflow-hidden">
            {story.chapters.map((chapter) => {
              const hasAccess = hasAccessToChapter(story, chapter);
              const estimate = estimateChapterReadingTime(chapter, readingSummary.averageWordCount);

              return (
                <a
                  key={chapter.id}
                  href={buildHref('reader', { slug: story.slug, chapterNumber: chapter.chapterNumber })}
                  onClick={(e) =>
                    handleLink(e, 'reader', { slug: story.slug, chapterNumber: chapter.chapterNumber })
                  }
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-[#2D142C]/[0.02] dark:hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                    <span className="text-xs font-mono font-bold text-[#2D142C]/50 dark:text-white/50 pt-0.5 shrink-0 tabular-nums">
                      {chapter.chapterNumber < 10 ? `0${chapter.chapterNumber}` : chapter.chapterNumber}
                    </span>

                    <div className="space-y-1 min-w-0">
                      <h3 className="font-display text-base sm:text-lg font-bold text-[#2D142C] dark:text-[#F9F6F0] group-hover:text-[#C85A32] transition-colors truncate">
                        {chapter.title}
                      </h3>

                      <p className="font-reader text-xs text-[#2D142C]/65 dark:text-white/65 line-clamp-1">
                        &ldquo;{chapter.excerpt}&rdquo;
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                        <span>{chapter.releaseDate}</span>
                        <span>&middot;</span>
                        <span>
                          {estimate.usedAverageFallback
                            ? `~${estimate.wordCount.toLocaleString()} avg words`
                            : `${estimate.wordCount.toLocaleString()} words`}
                        </span>
                        <span>&middot;</span>
                        <span className="inline-flex items-center gap-1 font-medium text-[#2D142C]/80 dark:text-white/80">
                          <Clock className="w-3 h-3 text-[#C85A32]" />
                          <span>Est. {estimate.estimatedMinutes} min read</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {hasAccess ? (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Unlock className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{chapter.isFree ? 'Free' : 'Unlocked'}</span>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[#C85A32] flex items-center gap-1 bg-[#C85A32]/10 px-2.5 py-1 rounded">
                        <Lock className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Locked</span>
                      </span>
                    )}

                    <ChevronRight className="w-4 h-4 text-[#2D142C]/40 dark:text-white/40 group-hover:text-[#C85A32] transition-colors" />
                  </div>
                </a>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
};
