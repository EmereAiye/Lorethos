import React from 'react';
import { useApp } from '../context/AppContext';
import { getDisplayName, computeReaderRank } from '../utils/readerProfile';
import { BookOpen, Sparkles, ArrowRight, Check, MessageSquare, Headphones, Film, Award, Play, Search, X } from 'lucide-react';
import { StoryTrailerPlayer } from '../components/StoryTrailerPlayer';
import { WriterStoriesFeed } from '../components/WriterStoriesFeed';
import { StoryLikeButton } from '../components/StoryLikeButton';
import { fetchLikesForStories } from '../lib/storyLikes';
import { supabase } from '../lib/supabase';

export const HomeView: React.FC = () => {
  const {
    stories,
    navigate,
    buildHref,
    openPaystackCheckout,
    user,
    isAuthenticated,
    preferredGenres,
    openReadingPrompt
  } = useApp();

  const flagshipStory = stories.find(s => s.id === 'story-obsidian-throne') || stories[0];
  const featuredStories = stories.filter(s => s.featured);
  const [feedSearchQuery, setFeedSearchQuery] = React.useState('');
  const [catalogLikeCounts, setCatalogLikeCounts] = React.useState<Record<string, number>>({});
  const [catalogLikedIds, setCatalogLikedIds] = React.useState<Set<string>>(new Set());

  const trimmedFeedSearch = feedSearchQuery.trim().toLowerCase();
  const visibleCatalogStories = React.useMemo(() => {
    if (!trimmedFeedSearch) return featuredStories;
    return stories.filter(
      (story) =>
        story.title.toLowerCase().includes(trimmedFeedSearch) ||
        story.subtitle.toLowerCase().includes(trimmedFeedSearch) ||
        story.author.toLowerCase().includes(trimmedFeedSearch) ||
        story.genre.toLowerCase().includes(trimmedFeedSearch) ||
        story.synopsis.toLowerCase().includes(trimmedFeedSearch) ||
        story.tags.some((t) => t.toLowerCase().includes(trimmedFeedSearch))
    );
  }, [stories, featuredStories, trimmedFeedSearch]);

  React.useEffect(() => {
    if (stories.length === 0) return;
    let cancelled = false;
    const loadLikes = async () => {
      const res = await fetchLikesForStories(stories.map((s) => s.id));
      if (!cancelled) {
        setCatalogLikeCounts(res.state.counts);
        setCatalogLikedIds(res.state.likedStoryIds);
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
  }, [stories, isAuthenticated]);

  const trailerStories = React.useMemo(() => stories.filter((s) => Boolean(s.trailerVideoUrl)), [stories]);
  const [selectedTrailerSlug, setSelectedTrailerSlug] = React.useState<string>('');
  const activeTrailerStory =
    trailerStories.find((s) => s.slug === selectedTrailerSlug) || trailerStories[0] || null;
  const displayName = getDisplayName(user);
  const readerRank = React.useMemo(() => computeReaderRank(user, stories), [user, stories]);
  const personalizedRecommendations = React.useMemo(() => {
    if (!isAuthenticated || preferredGenres.length === 0) return [];
    const normalizedPrefs = preferredGenres.map((g) => g.toLowerCase());
    return stories
      .map((story) => {
        const isExactGenre = preferredGenres.includes(story.genre);
        const matchedTag = story.tags.find((t) => {
          const lowerTag = t.toLowerCase();
          return normalizedPrefs.some(
            (pref) => lowerTag.includes(pref) || (pref.includes('fiction') && lowerTag.includes('fiction'))
          );
        });
        const score = (isExactGenre ? 2 : 0) + (matchedTag ? 1 : 0);
        return {
          story,
          score,
          matchLabel: isExactGenre ? story.genre : matchedTag ? `Tag: ${matchedTag}` : story.genre
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (a.story.spotlightOrder ?? 99) - (b.story.spotlightOrder ?? 99));
  }, [stories, isAuthenticated, preferredGenres]);

  const latestChapters = stories.flatMap(s =>
    s.chapters.slice(-2).map(ch => ({
      ...ch,
      storyTitle: s.title,
      storySlug: s.slug,
      storyCover: s.coverImage,
      genre: s.genre
    }))
  ).slice(0, 4);

  const handleNav = (
    e: React.MouseEvent<HTMLAnchorElement>,
    route: string,
    params?: Parameters<typeof navigate>[1]
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route, params);
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] transition-colors">

      {/* Dynamic Catalog Announcement Banner */}
      {flagshipStory && (
        <div className="bg-[#2D142C] text-[#F9F6F0] border-b border-white/10 px-4 py-2.5 text-xs text-center font-sans-ui">
          <span className="text-[#C85A32] font-semibold">Featured Series:</span>{' '}
          <span>
            {flagshipStory.title} &middot; {flagshipStory.chapters.length} chapters published &middot; Chapters 1&ndash;{flagshipStory.freeChaptersCount} free for all readers
          </span>
        </div>
      )}

      {/* Hero Spotlight */}
      {flagshipStory && (
        <section className="relative overflow-hidden border-b border-[#2D142C]/10 dark:border-white/10 py-16 md:py-24">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#C85A32]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-80 h-80 bg-[#2D142C]/10 dark:bg-[#C85A32]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

              <div className="lg:col-span-7 space-y-6">
                <div className="flex items-center gap-3 text-xs tracking-wider uppercase text-[#C85A32] font-semibold font-sans-ui">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Featured Serialized Work</span>
                  <span>&middot;</span>
                  <span className="text-[#2D142C]/60 dark:text-white/60 font-normal">
                    {flagshipStory.genre}
                  </span>
                </div>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[#2D142C] dark:text-[#F9F6F0] leading-[1.08] text-balance">
                  {flagshipStory.title}
                </h1>

                <p className="font-reader text-lg sm:text-xl text-[#2D142C]/80 dark:text-[#F9F6F0]/80 italic">
                  &ldquo;{flagshipStory.subtitle}&rdquo;
                </p>

                <p className="font-reader text-base text-[#2D142C]/75 dark:text-[#F9F6F0]/70 leading-relaxed max-w-2xl">
                  {flagshipStory.synopsis}
                </p>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui pt-2">
                  <span>
                    By <strong className="text-[#2D142C] dark:text-white font-medium">{flagshipStory.author}</strong>
                  </span>
                  <span>&middot;</span>
                  <span>{flagshipStory.chapters.length} Chapters Published</span>
                  <span>&middot;</span>
                  <span>First {flagshipStory.freeChaptersCount} Chapters Free</span>
                  <span>&middot;</span>
                  <span>Updated {flagshipStory.updatedAt}</span>
                </div>

                <div className="pt-4 flex flex-wrap items-center gap-4">
                  <a
                    href={buildHref('reader', { slug: flagshipStory.slug, chapterNumber: 1 })}
                    onClick={(e) => handleNav(e, 'reader', { slug: flagshipStory.slug, chapterNumber: 1 })}
                    className="px-6 py-3.5 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#b04d28] rounded-lg shadow-sm hover:shadow transition-all duration-150 flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Start Reading Chapter 1 (Free)</span>
                  </a>

                  <a
                    href={buildHref('story-detail', { slug: flagshipStory.slug })}
                    onClick={(e) => handleNav(e, 'story-detail', { slug: flagshipStory.slug })}
                    className="px-5 py-3.5 text-sm font-medium text-[#2D142C] dark:text-[#F9F6F0] bg-transparent hover:bg-[#2D142C]/5 dark:hover:bg-white/5 border border-[#2D142C]/20 dark:border-white/20 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span>Explore Chapter Directory</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>

                  <a
                    href={buildHref('studio')}
                    onClick={(e) => handleNav(e, 'studio')}
                    className="px-5 py-3.5 text-sm font-semibold text-[#C85A32] bg-[#C85A32]/10 hover:bg-[#C85A32]/15 border border-[#C85A32]/35 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Film className="w-4 h-4" />
                    <span>Turn Words into Video</span>
                  </a>
                </div>

                <div className="pt-6 border-t border-[#2D142C]/10 dark:border-white/10">
                  <blockquote className="font-reader text-xs sm:text-sm text-[#2D142C]/70 dark:text-[#F9F6F0]/70 italic border-l-2 border-[#C85A32] pl-3">
                    &ldquo;{flagshipStory.chapters[0]?.excerpt}&rdquo;
                  </blockquote>
                </div>
              </div>

              <div className="lg:col-span-5 flex justify-center lg:justify-end">
                <a
                  href={buildHref('story-detail', { slug: flagshipStory.slug })}
                  onClick={(e) => handleNav(e, 'story-detail', { slug: flagshipStory.slug })}
                  className="relative group block max-w-xs sm:max-w-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] rounded-lg"
                >
                  <div className="relative rounded-lg overflow-hidden shadow-2xl transition-transform duration-300 group-hover:-translate-y-2 border border-[#2D142C]/20 dark:border-white/20">
                    <img
                      src={flagshipStory.coverImage}
                      alt={`${flagshipStory.title} cover`}
                      className="w-full h-auto aspect-[3/4] object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white">
                      <span className="font-medium bg-[#2D142C]/85 px-2.5 py-1 rounded">
                        Ch. 1&ndash;{flagshipStory.freeChaptersCount} Free
                      </span>
                      <span className="font-sans-ui text-[11px] bg-[#C85A32] px-2 py-1 rounded font-semibold">
                        Featured Series
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <span className="text-xs text-[#2D142C]/65 dark:text-white/65 group-hover:text-[#C85A32] transition-colors">
                      View chapter directory &amp; synopsis &rarr;
                    </span>
                  </div>
                </a>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* Personalized Reading Interests Shelf */}
      {isAuthenticated && personalizedRecommendations.length > 0 && (
        <section className="py-12 border-b border-[#2D142C]/10 dark:border-white/10 bg-[#C85A32]/[0.04]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="text-xs tracking-wider uppercase text-[#C85A32] font-semibold font-sans-ui mb-1 flex flex-wrap items-center gap-2">
                  <span>Recommended for {displayName} &middot; {preferredGenres.join(', ')}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2D142C] text-[#F9F6F0] text-[10px]">
                    <Award className="w-3 h-3 text-[#C85A32]" />
                    <span>Rank {readerRank.roman} &middot; {readerRank.title}</span>
                  </span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
                  Your Personalized Reading Feed
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs font-sans-ui">
                <button
                  type="button"
                  onClick={openReadingPrompt}
                  className="px-3 py-1.5 rounded-lg border border-[#C85A32]/35 text-[#C85A32] font-semibold hover:bg-[#C85A32] hover:text-white transition-colors cursor-pointer"
                >
                  Edit Genre Preferences
                </button>
                <a
                  href={buildHref('stories', preferredGenres.length === 1 ? { genre: preferredGenres[0] } : { interests: '1' })}
                  onClick={(e) =>
                    handleNav(
                      e,
                      'stories',
                      preferredGenres.length === 1 ? { genre: preferredGenres[0] } : { interests: '1' }
                    )
                  }
                  className="font-semibold text-[#C85A32] hover:underline flex items-center gap-1"
                >
                  <span>See all matches ({personalizedRecommendations.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {personalizedRecommendations.slice(0, 4).map(({ story, matchLabel }) => (
                <a
                  key={story.id}
                  href={buildHref('story-detail', { slug: story.slug })}
                  onClick={(e) => handleNav(e, 'story-detail', { slug: story.slug })}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 hover:border-[#C85A32]/50 transition-all flex items-center gap-3.5 group shadow-2xs"
                >
                  <img
                    src={story.coverImage}
                    alt={`${story.title} cover`}
                    loading="lazy"
                    className="w-14 h-20 object-cover rounded border border-current/10 shrink-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#C85A32] font-sans-ui block truncate">
                      {matchLabel}
                    </span>
                    <h3 className="font-display text-base font-bold leading-tight group-hover:text-[#C85A32] transition-colors line-clamp-1">
                      {story.title}
                    </h3>
                    <p className="text-[11px] opacity-70 font-sans-ui truncate">
                      By {story.author} &middot; {story.chapters.length} chs
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {isAuthenticated && preferredGenres.length === 0 && (
        <section className="py-8 border-b border-[#2D142C]/10 dark:border-white/10 bg-[#C85A32]/[0.04]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[#C85A32] font-sans-ui flex items-center gap-2">
                <span>Personalize Your Feed</span>
                <span>&middot;</span>
                <span>Rank {readerRank.roman}: {readerRank.title}</span>
              </div>
              <p className="font-display text-xl font-semibold">
                What do you want to read next, {displayName}?
              </p>
              <p className="text-xs opacity-75 font-reader">
                Choose poetry, literary fiction, myth, or fantasy to save recommendations to your profile.
              </p>
            </div>
            <button
              type="button"
              onClick={openReadingPrompt}
              className="px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold font-sans-ui flex items-center gap-2 self-start sm:self-auto cursor-pointer shrink-0 transition-colors"
            >
              <span>Choose Preferred Genres</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      )}

      {/* Reader Feed Story Search */}
      <section className="py-6 border-b border-[#2D142C]/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#C85A32] font-sans-ui">
              Search Reader Feed
            </span>
            <p className="text-xs text-[#2D142C]/70 dark:text-white/70 font-reader">
              Find stories by title, author, genre, or keyword across writer releases and serialized works.
            </p>
          </div>
          <div className="relative w-full sm:max-w-md">
            <label htmlFor="home-feed-search" className="sr-only">
              Search stories by title, author, genre, or keyword
            </label>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2D142C]/45 dark:text-white/45 pointer-events-none" />
            <input
              id="home-feed-search"
              type="search"
              value={feedSearchQuery}
              onChange={(e) => setFeedSearchQuery(e.target.value)}
              placeholder="Search stories by title, author, genre..."
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-white dark:bg-[#1E111E] focus:outline-none focus:border-[#C85A32] font-sans-ui"
            />
            {feedSearchQuery && (
              <button
                type="button"
                onClick={() => setFeedSearchQuery('')}
                aria-label="Clear story search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2D142C]/55 dark:text-white/55 hover:text-[#C85A32] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Published Writer Releases (Newest First from Supabase) */}
      <WriterStoriesFeed externalQuery={feedSearchQuery} />

      {/* Curated Featured Series */}
      <section className="py-16 border-b border-[#2D142C]/10 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
            <div>
              <div className="text-xs tracking-wider uppercase text-[#C85A32] font-semibold font-sans-ui mb-1">
                {trimmedFeedSearch ? 'Matching Catalog Stories' : 'Curated Catalog'}
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
                {trimmedFeedSearch
                  ? `Search Results (${visibleCatalogStories.length})`
                  : 'Featured Serialized Works'}
              </h2>
            </div>
            <a
              href={buildHref('stories', trimmedFeedSearch ? { q: feedSearchQuery.trim() } : undefined)}
              onClick={(e) =>
                handleNav(e, 'stories', trimmedFeedSearch ? { q: feedSearchQuery.trim() } : undefined)
              }
              className="text-xs font-semibold text-[#C85A32] hover:text-[#b04d28] flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>View complete catalog ({stories.length} stories)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {visibleCatalogStories.length === 0 ? (
            <div className="p-10 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center space-y-3">
              <p className="font-display text-lg font-semibold">
                No catalog stories matching &ldquo;{feedSearchQuery.trim()}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setFeedSearchQuery('')}
                className="text-xs font-semibold text-[#C85A32] hover:underline cursor-pointer"
              >
                Reset search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {visibleCatalogStories.map((story) => (
              <article
                key={story.id}
                className="group flex flex-col justify-between"
              >
                <a
                  href={buildHref('story-detail', { slug: story.slug })}
                  onClick={(e) => handleNav(e, 'story-detail', { slug: story.slug })}
                  className="flex-1 flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] rounded-lg"
                >
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden border border-[#2D142C]/10 dark:border-white/10 shadow-md group-hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1 mb-4">
                    <img
                      src={story.coverImage}
                      alt={`${story.title} cover`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 right-3">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#2D142C]/85 text-white">
                        {story.status}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#C85A32] text-white">
                        {story.accessTier === 'free'
                          ? 'Free Access'
                          : `Chapters 1-${story.freeChaptersCount} Free`}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 flex-1">
                    <div className="text-[11px] text-[#C85A32] font-medium tracking-wide uppercase font-sans-ui">
                      {story.genre}
                    </div>
                    <h3 className="font-display text-xl font-bold tracking-tight text-[#2D142C] dark:text-[#F9F6F0] group-hover:text-[#C85A32] transition-colors line-clamp-1">
                      {story.title}
                    </h3>
                    <p className="text-xs text-[#2D142C]/70 dark:text-[#F9F6F0]/70 font-reader line-clamp-2 mt-1">
                      {story.synopsis}
                    </p>

                    {user.readingProgress[story.id] && (
                      <div className="pt-2 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-sans-ui text-[#C85A32] font-semibold">
                          <span>Ch. {user.readingProgress[story.id].chapterNumber} in progress</span>
                          <span className="font-mono">{user.readingProgress[story.id].progressPercent}%</span>
                        </div>
                        <div className="w-full bg-[#2D142C]/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[#C85A32] h-full rounded-full transition-all"
                            style={{ width: `${user.readingProgress[story.id].progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </a>

                <div className="pt-3 mt-3 border-t border-[#2D142C]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                  <span className="truncate max-w-[110px]">{story.author}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <StoryLikeButton
                      storyId={story.id}
                      storyTitle={story.title}
                      initialCount={catalogLikeCounts[story.id] || 0}
                      initialLiked={catalogLikedIds.has(story.id)}
                      onUpdated={(id, liked, count) => {
                        setCatalogLikeCounts((prev) => ({ ...prev, [id]: count }));
                        setCatalogLikedIds((prev) => {
                          const next = new Set(prev);
                          if (liked) next.add(id);
                          else next.delete(id);
                          return next;
                        });
                      }}
                    />
                    <a
                      href={buildHref('story-detail', { slug: story.slug })}
                      onClick={(e) => handleNav(e, 'story-detail', { slug: story.slug })}
                      className="tabular-nums hover:text-[#C85A32] transition-colors"
                    >
                      {user.readingProgress[story.id]
                        ? `Ch. ${user.readingProgress[story.id].chapterNumber} →`
                        : `${story.chapters.length} Chs`}
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
          )}

        </div>
      </section>

      {/* Official Story Trailers Theater (All Catalog Titles) */}
      {trailerStories.length > 0 && activeTrailerStory && (
        <section id="story-trailers" className="py-16 border-b border-[#2D142C]/10 dark:border-white/10 bg-[#2D142C]/[0.03] dark:bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="text-xs tracking-wider uppercase text-[#C85A32] font-semibold font-sans-ui mb-1">
                  Story Trailers ({trailerStories.length} Titles)
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
                  Watch the Official Story Trailers
                </h2>
                <p className="font-reader text-sm text-[#2D142C]/70 dark:text-[#F9F6F0]/70 mt-1 max-w-2xl">
                  Every serialized work in the Lorethos library features one unified narrated story trailer explaining the story with mood-driven visuals and clear voiceover.
                </p>
              </div>
              <a
                href={buildHref('studio')}
                onClick={(e) => handleNav(e, 'studio')}
                className="text-xs font-semibold text-[#C85A32] hover:underline flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Create Custom Scene Video &rarr;</span>
              </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7">
                <StoryTrailerPlayer
                  story={activeTrailerStory}
                  storyHref={buildHref('story-detail', { slug: activeTrailerStory.slug })}
                  readerHref={buildHref('reader', { slug: activeTrailerStory.slug, chapterNumber: 1 })}
                  onNavigateStory={() => navigate('story-detail', { slug: activeTrailerStory.slug })}
                  onNavigateReader={() => navigate('reader', { slug: activeTrailerStory.slug, chapterNumber: 1 })}
                />
              </div>

              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {trailerStories.map((story) => {
                  const isActive = story.slug === activeTrailerStory.slug;
                  return (
                    <button
                      key={story.id}
                      type="button"
                      onClick={() => setSelectedTrailerSlug(story.slug)}
                      aria-pressed={isActive}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3.5 cursor-pointer ${
                        isActive
                          ? 'bg-white dark:bg-[#1E111E] border-[#C85A32] shadow-sm'
                          : 'bg-white/70 dark:bg-[#1E111E]/60 border-[#2D142C]/10 dark:border-white/10 hover:border-[#C85A32]/50'
                      }`}
                    >
                      <div className="relative w-24 aspect-video rounded-lg overflow-hidden shrink-0 bg-[#160C16] border border-current/10">
                        <img
                          src={story.trailerPosterUrl || story.coverImage}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        <div className={`absolute inset-0 flex items-center justify-center ${isActive ? 'bg-[#C85A32]/30' : 'bg-black/35'}`}>
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5 font-sans-ui">
                        <div className="text-[11px] text-[#C85A32] font-semibold truncate">
                          {story.genre} &middot; Official Trailer
                        </div>
                        <div className="font-display text-base font-bold truncate text-[#2D142C] dark:text-[#F9F6F0]">
                          {story.title}
                        </div>
                        <div className="text-[11px] text-[#2D142C]/65 dark:text-white/65 truncate">
                          By {story.author}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Latest Chapters & Membership */}
      <section className="py-16 border-b border-[#2D142C]/10 dark:border-white/10 bg-[#2D142C]/[0.02] dark:bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

            {/* Latest Chapter Releases */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <div className="text-xs tracking-wider uppercase text-[#C85A32] font-semibold font-sans-ui mb-1">
                  Serialized Releases
                </div>
                <h2 className="font-display text-3xl font-semibold tracking-tight">
                  Latest Published Chapters
                </h2>
              </div>

              <div className="space-y-4">
                {latestChapters.map((ch, idx) => (
                  <a
                    key={ch.id + idx}
                    href={buildHref('reader', { slug: ch.storySlug, chapterNumber: ch.chapterNumber })}
                    onClick={(e) => handleNav(e, 'reader', { slug: ch.storySlug, chapterNumber: ch.chapterNumber })}
                    className="p-4 rounded-lg bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 hover:border-[#C85A32]/40 transition-all flex items-center justify-between gap-4 group shadow-2xs hover:shadow-sm"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={ch.storyCover}
                        alt=""
                        loading="lazy"
                        className="w-12 h-16 rounded object-cover shrink-0 border border-[#2D142C]/10"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] text-[#C85A32] font-medium font-sans-ui">
                          {ch.storyTitle} &middot; Chapter {ch.chapterNumber}
                        </div>
                        <h3 className="font-display text-base font-bold text-[#2D142C] dark:text-[#F9F6F0] group-hover:text-[#C85A32] transition-colors truncate">
                          {ch.title}
                        </h3>
                        <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-reader truncate">
                          &ldquo;{ch.excerpt}&rdquo;
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-sans-ui text-[#2D142C]/60 dark:text-white/60 block">
                        {ch.readTimeMinutes} min read
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded mt-1 inline-block ${
                          ch.isFree
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-[#C85A32]/10 text-[#C85A32]'
                        }`}
                      >
                        {ch.isFree ? 'Free Chapter' : 'Subscriber Chapter'}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Patron Membership Overview */}
            <div className="lg:col-span-5 flex flex-col justify-between p-8 rounded-xl bg-[#2D142C] text-[#F9F6F0] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#C85A32]/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative space-y-5">
                <div className="flex items-center gap-2">
                  <img
                    src="/assets/aistudio/1A2959EF-E3CD-42F2-B9E5-21E771900F65_0f8daa7f.png"
                    alt="Lorethos Logo"
                    className="w-9 h-9 rounded-full border border-[#C85A32]/60"
                  />
                  <span className="text-xs tracking-widest uppercase font-semibold text-[#C85A32]">
                    Lorethos Membership
                  </span>
                </div>

                <h2 className="font-display text-2xl sm:text-3xl font-semibold leading-tight text-white">
                  Support Independent Serialized Literature
                </h2>

                <p className="text-xs sm:text-sm text-white/75 font-reader leading-relaxed">
                  Subscribe to unlock full access across ongoing series, ambient reader audio soundscapes, AI chapter narration, and personal highlights saved to your account.
                </p>

                <div className="space-y-2.5 text-xs text-white/85 font-sans-ui pt-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                    <span>Access all published chapters across subscription titles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                    <span>Checkout in NGN via Paystack (Cards, Transfer, USSD)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                    <span>Built-in ambient soundscapes and voice narration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                    <span>Manage or cancel your membership from your account</span>
                  </div>
                </div>
              </div>

              <div className="relative pt-6 mt-6 border-t border-white/10 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-white/70 font-sans-ui">Monthly Plan</span>
                  <span className="font-sans-ui text-xl font-bold text-white tabular-nums">
                    ₦3,500 <span className="text-xs font-normal text-white/60">/ month</span>
                  </span>
                </div>

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
                  className="w-full py-3 px-4 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold text-xs tracking-wide rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg"
                >
                  <span>Subscribe Monthly</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Editorial Dispatch & Reader Immersion Callout */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#2D142C]/10 dark:border-white/10 bg-gradient-to-r from-[#2D142C]/5 to-[#C85A32]/10 dark:from-white/5 dark:to-white/[0.02] p-8 sm:p-12">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">

              <div className="md:col-span-8 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#C85A32] font-sans-ui">
                  <Headphones className="w-4 h-4" />
                  <span>Reader Companion &amp; Editorial Contact</span>
                </div>

                <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
                  Designed for Deep Reading, Listening &amp; Community Discussion
                </h2>

                <p className="font-reader text-sm sm:text-base text-[#2D142C]/75 dark:text-[#F9F6F0]/75 leading-relaxed">
                  Customize typography across Day, Sepia, and Night modes, listen with built-in AI voice narration, save margin notes, or contact our editorial desk directly with manuscript pitches and feedback.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <a
                    href={buildHref('stories')}
                    onClick={(e) => handleNav(e, 'stories')}
                    className="px-5 py-2.5 text-xs font-semibold bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Explore All Stories</span>
                  </a>

                  <a
                    href={buildHref('contact')}
                    onClick={(e) => handleNav(e, 'contact')}
                    className="px-4 py-2.5 text-xs font-medium text-[#2D142C] dark:text-[#F9F6F0] hover:text-[#C85A32] transition-colors flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Contact the Editorial Desk &rarr;</span>
                  </a>
                </div>
              </div>

              <div className="md:col-span-4 flex justify-center">
                <div className="w-full max-w-xs bg-white dark:bg-[#1E111E] rounded-xl p-5 border border-[#2D142C]/10 dark:border-white/10 shadow-md space-y-3 text-xs font-sans-ui">
                  <div className="text-[11px] uppercase tracking-wider font-bold text-[#C85A32]">
                    Reading Experience
                  </div>
                  <ul className="space-y-2.5 text-[#2D142C]/80 dark:text-white/80">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                      <span>Three adaptive themes: Day, Sepia &amp; Night</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                      <span>Passage highlights &amp; personal margin notes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                      <span>Chapter recaps &amp; spoiler-free Q&amp;A</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                      <span>Daily &amp; weekly reading goal milestones</span>
                    </li>
                  </ul>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
