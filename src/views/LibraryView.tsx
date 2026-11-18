import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiFetch, parseJsonSafe } from '../lib/apiClient';
import { Search, Filter, BookOpen, ArrowUpDown, Sparkles, Loader2, ArrowRight, X } from 'lucide-react';

interface AIRecommendation {
  slug: string;
  vibeTag: string;
  reason: string;
}

export const LibraryView: React.FC = () => {
  const { stories, navigate, buildHref, routeParams, user } = useApp();

  const [searchQuery, setSearchQuery] = useState(routeParams.q || '');
  const [selectedGenre, setSelectedGenre] = useState<string>(routeParams.genre || 'All');
  const [selectedStatus, setSelectedStatus] = useState<string>(routeParams.status || 'All');
  const [selectedTier, setSelectedTier] = useState<string>(routeParams.tier || 'All');
  const [sortBy, setSortBy] = useState<'popular' | 'chapters'>(
    routeParams.sort === 'chapters' ? 'chapters' : 'popular'
  );

  const [moodPrompt, setMoodPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCuratorNote, setAiCuratorNote] = useState<string | null>(null);
  const [aiMatches, setAiMatches] = useState<AIRecommendation[]>([]);

  // Synchronize filter state with /stories URL query parameters
  useEffect(() => {
    navigate(
      'stories',
      {
        q: searchQuery || undefined,
        genre: selectedGenre !== 'All' ? selectedGenre : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        tier: selectedTier !== 'All' ? selectedTier : undefined,
        sort: sortBy !== 'popular' ? sortBy : undefined
      },
      { replace: true }
    );
  }, [searchQuery, selectedGenre, selectedStatus, selectedTier, sortBy, navigate]);

  const handleCurateStories = async (customPrompt?: string) => {
    const query = (customPrompt ?? moodPrompt).trim();
    if (!query) return;
    if (customPrompt) setMoodPrompt(customPrompt);

    setAiLoading(true);
    setAiError(null);

    try {
      const res = await apiFetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moodPrompt: query })
      });
      const data = await parseJsonSafe<{
        curatorNote?: string;
        recommendations?: AIRecommendation[];
        error?: string;
      }>(res);
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Unable to fetch story recommendations.');
      }
      setAiCuratorNote(data.curatorNote || null);
      setAiMatches(Array.isArray(data.recommendations) ? data.recommendations : []);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setAiLoading(false);
    }
  };

  const genres = useMemo(() => {
    const list = Array.from(new Set(stories.map(s => s.genre)));
    return ['All', ...list];
  }, [stories]);

  const filteredStories = useMemo(() => {
    return stories
      .filter(story => {
        const matchesSearch =
          !searchQuery ||
          story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          story.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          story.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
          story.synopsis.toLowerCase().includes(searchQuery.toLowerCase()) ||
          story.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesGenre = selectedGenre === 'All' || story.genre === selectedGenre;
        const matchesStatus = selectedStatus === 'All' || story.status === selectedStatus;
        const matchesTier =
          selectedTier === 'All' ||
          (selectedTier === 'Free' && story.accessTier === 'free') ||
          (selectedTier === 'Subscription' && story.accessTier === 'subscription') ||
          (selectedTier === 'Purchase' && story.accessTier === 'purchase');

        return matchesSearch && matchesGenre && matchesStatus && matchesTier;
      })
      .sort((a, b) => {
        if (sortBy === 'chapters') return b.chapters.length - a.chapters.length;
        return (a.spotlightOrder ?? 99) - (b.spotlightOrder ?? 99);
      });
  }, [stories, searchQuery, selectedGenre, selectedStatus, selectedTier, sortBy]);

  const handleLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    route: string,
    params?: Parameters<typeof navigate>[1]
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route, params);
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

        {/* Header */}
        <div className="space-y-3">
          <div className="text-xs tracking-wider uppercase text-[#C85A32] font-semibold font-sans-ui">
            Original Literary Catalog
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">
            The Lorethos Story Library
          </h1>
          <p className="font-reader text-base text-[#2D142C]/70 dark:text-[#F9F6F0]/70 max-w-2xl">
            Explore our catalog of original high fantasy, mythological realism, and historical chronicles. Every story includes complimentary opening chapters.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="space-y-4 bg-white dark:bg-[#1E111E] p-6 rounded-xl border border-[#2D142C]/10 dark:border-white/10 shadow-2xs">

          <div className="relative">
            <label htmlFor="library-search" className="sr-only">
              Search stories by title, author, keyword, or tag
            </label>
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#2D142C]/40 dark:text-white/40" />
            <input
              id="library-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, author, keyword, or theme..."
              className="w-full pl-10 pr-16 py-2.5 text-xs sm:text-sm rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32] text-[#2D142C] dark:text-white font-sans-ui"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-[#2D142C]/60 dark:text-white/60 hover:text-[#C85A32] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#2D142C]/10 dark:border-white/10 text-xs font-sans-ui">

            {/* Genre Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[#2D142C]/60 dark:text-white/60 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>Genre:</span>
              </span>
              {genres.map(genre => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                    selectedGenre === genre
                      ? 'bg-[#2D142C] text-[#F9F6F0] dark:bg-white dark:text-[#160C16] font-semibold shadow-xs'
                      : 'text-[#2D142C]/75 dark:text-white/75 hover:bg-[#2D142C]/5 dark:hover:bg-white/5'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            {/* Sort & Status Controls */}
            <div className="flex flex-wrap items-center gap-3 ml-auto">
              <div className="flex items-center gap-1.5">
                <label htmlFor="filter-tier" className="text-[#2D142C]/60 dark:text-white/60">
                  Tier:
                </label>
                <select
                  id="filter-tier"
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="bg-transparent border border-[#2D142C]/15 dark:border-white/15 rounded px-2.5 py-1 text-xs text-[#2D142C] dark:text-white focus:outline-none focus:border-[#C85A32]"
                >
                  <option value="All" className="bg-white dark:bg-[#1E111E]">All Access Tiers</option>
                  <option value="Free" className="bg-white dark:bg-[#1E111E]">Free to Read</option>
                  <option value="Subscription" className="bg-white dark:bg-[#1E111E]">Subscription</option>
                  <option value="Purchase" className="bg-white dark:bg-[#1E111E]">Single Purchase</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="filter-status" className="text-[#2D142C]/60 dark:text-white/60">
                  Status:
                </label>
                <select
                  id="filter-status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-transparent border border-[#2D142C]/15 dark:border-white/15 rounded px-2.5 py-1 text-xs text-[#2D142C] dark:text-white focus:outline-none focus:border-[#C85A32]"
                >
                  <option value="All" className="bg-white dark:bg-[#1E111E]">All Statuses</option>
                  <option value="Ongoing" className="bg-white dark:bg-[#1E111E]">Ongoing</option>
                  <option value="Completed" className="bg-white dark:bg-[#1E111E]">Completed</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3 h-3 text-[#2D142C]/60 dark:text-white/60" />
                <label htmlFor="filter-sort" className="sr-only">
                  Sort stories by
                </label>
                <select
                  id="filter-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'popular' | 'chapters')}
                  className="bg-transparent border border-[#2D142C]/15 dark:border-white/15 rounded px-2.5 py-1 text-xs text-[#2D142C] dark:text-white focus:outline-none focus:border-[#C85A32]"
                >
                  <option value="popular" className="bg-white dark:bg-[#1E111E]">Featured Order</option>
                  <option value="chapters" className="bg-white dark:bg-[#1E111E]">Most Chapters</option>
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* Story Matchmaker */}
        <div className="p-6 rounded-xl bg-gradient-to-r from-[#2D142C]/5 via-[#C85A32]/5 to-[#2D142C]/5 dark:from-[#1E111E] dark:via-[#2A1526] dark:to-[#1E111E] border border-[#C85A32]/25 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#C85A32]/15 text-[#C85A32] flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold leading-tight">
                  Story Matchmaker
                </h2>
                <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                  Describe a mood, theme, or setting to get catalog recommendations.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-sans-ui">
              {[
                'West African cosmic folklore',
                'Dark royal betrayal & blood pacts',
                'Submerged ancient mysteries'
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleCurateStories(preset)}
                  className="px-2.5 py-1 rounded-md border border-[#C85A32]/30 text-[#C85A32] hover:bg-[#C85A32] hover:text-white transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCurateStories();
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <label htmlFor="mood-prompt-input" className="sr-only">
              Describe what kind of story you want to read
            </label>
            <input
              id="mood-prompt-input"
              type="text"
              value={moodPrompt}
              onChange={(e) => setMoodPrompt(e.target.value)}
              placeholder="What are you in the mood to read tonight? (e.g. 'ancient empires and forbidden ink')"
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-white dark:bg-[#160C16] focus:outline-none focus:border-[#C85A32] font-sans-ui"
            />
            <button
              type="submit"
              disabled={aiLoading || !moodPrompt.trim()}
              className="px-5 py-2.5 bg-[#C85A32] hover:bg-[#b04d28] disabled:opacity-55 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Matching...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Match Stories</span>
                </>
              )}
            </button>
          </form>

          {aiError && (
            <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs font-sans-ui">
              {aiError}
            </div>
          )}

          {aiMatches.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-[#C85A32]/15">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs italic font-reader text-[#2D142C]/80 dark:text-white/80">
                  {aiCuratorNote}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAiMatches([]);
                    setAiCuratorNote(null);
                  }}
                  className="text-[11px] text-[#2D142C]/60 dark:text-white/60 hover:text-[#C85A32] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <X className="w-3 h-3" />
                  <span>Dismiss</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiMatches.map((match) => {
                  const matchedStory = stories.find(s => s.slug === match.slug);
                  if (!matchedStory) return null;
                  return (
                    <a
                      key={match.slug}
                      href={buildHref('story-detail', { slug: matchedStory.slug })}
                      onClick={(e) => handleLink(e, 'story-detail', { slug: matchedStory.slug })}
                      className="p-4 rounded-xl bg-white dark:bg-[#160C16] border border-[#C85A32]/30 hover:border-[#C85A32] shadow-xs flex flex-col justify-between space-y-3 transition-all"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono uppercase font-bold text-[#C85A32]">
                            {match.vibeTag}
                          </span>
                          <span className="text-[10px] text-[#2D142C]/60 dark:text-white/60">
                            {matchedStory.genre}
                          </span>
                        </div>
                        <h3 className="font-display text-base font-bold">{matchedStory.title}</h3>
                        <p className="text-xs text-[#2D142C]/70 dark:text-white/70 font-reader leading-relaxed">
                          {match.reason}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#2D142C]/10 dark:border-white/10 text-xs font-semibold text-[#C85A32]">
                        <span>By {matchedStory.author}</span>
                        <span className="inline-flex items-center gap-1">
                          Explore <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Story Grid */}
        {filteredStories.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#1E111E] rounded-xl border border-[#2D142C]/10 dark:border-white/10 p-8 space-y-3">
            <BookOpen className="w-10 h-10 mx-auto text-[#C85A32]/60" />
            <h3 className="font-display text-xl font-semibold">No Stories Found</h3>
            <p className="text-xs text-[#2D142C]/60 dark:text-white/60">
              Try adjusting your search terms or filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedGenre('All');
                setSelectedStatus('All');
                setSelectedTier('All');
              }}
              className="text-xs font-semibold text-[#C85A32] hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredStories.map((story) => (
              <a
                key={story.id}
                href={buildHref('story-detail', { slug: story.slug })}
                onClick={(e) => handleLink(e, 'story-detail', { slug: story.slug })}
                className="bg-white dark:bg-[#1E111E] rounded-xl border border-[#2D142C]/10 dark:border-white/10 overflow-hidden hover:border-[#C85A32]/40 transition-all duration-200 hover:shadow-lg flex flex-col group"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-[#2D142C]">
                  <img
                    src={story.coverImage}
                    alt={`${story.title} cover`}
                    loading="lazy"
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300 opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                  <div className="absolute top-3 left-3 right-3 flex justify-between items-center text-xs">
                    <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded bg-black/60 text-white">
                      {story.status}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#C85A32] text-white">
                      {story.accessTier === 'free'
                        ? 'Free'
                        : story.accessTier === 'subscription'
                        ? 'Subscription'
                        : `₦${story.priceNgn.toLocaleString('en-NG')} Unlock`}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="text-[10px] uppercase tracking-widest text-[#C85A32] font-semibold font-sans-ui block mb-0.5">
                      {story.genre}
                    </span>
                    <h3 className="font-display text-xl font-bold text-white leading-tight">
                      {story.title}
                    </h3>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <p className="font-reader text-xs text-[#2D142C]/75 dark:text-[#F9F6F0]/75 line-clamp-3 leading-relaxed">
                      {story.synopsis}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {story.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {user.readingProgress[story.id] && (
                      <div className="pt-2 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-sans-ui text-[#C85A32] font-semibold">
                          <span>Ch. {user.readingProgress[story.id].chapterNumber} in progress</span>
                          <span className="font-mono">{user.readingProgress[story.id].progressPercent}% read</span>
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

                  <div className="pt-3 border-t border-[#2D142C]/10 dark:border-white/10 flex items-center justify-between text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                    <span>
                      {story.author} &middot; Ch. 1&ndash;{story.freeChaptersCount} Free
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-medium text-[#2D142C] dark:text-white">
                        {story.chapters.length} Chs
                      </span>
                      <span>&middot;</span>
                      <span className="text-[#C85A32] font-medium group-hover:underline">
                        Overview &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
