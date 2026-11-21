import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiFetch, parseJsonSafe } from '../lib/apiClient';
import {
  Search,
  Filter,
  BookOpen,
  ArrowUpDown,
  Sparkles,
  Loader2,
  ArrowRight,
  X,
  Film,
  Library,
  Plus,
  Lock,
  Globe,
  BookmarkPlus,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react';
import { StoryTrailerPlayer } from '../components/StoryTrailerPlayer';
import { WriterStoriesFeed } from '../components/WriterStoriesFeed';
import { StoryLikeButton } from '../components/StoryLikeButton';
import { fetchLikesForStories } from '../lib/storyLikes';
import { supabase } from '../lib/supabase';
import type { BookshelfVisibility, Story, StoryBookshelf } from '../types';

interface AIRecommendation {
  slug: string;
  vibeTag: string;
  reason: string;
}

export const LibraryView: React.FC = () => {
  const {
    stories,
    navigate,
    buildHref,
    routeParams,
    user,
    isAuthenticated,
    myBookshelves,
    publicBookshelves,
    createBookshelf,
    updateBookshelf,
    deleteBookshelf,
    toggleStoryInBookshelf,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState(routeParams.q || '');
  const [selectedGenre, setSelectedGenre] = useState<string>(routeParams.genre || 'All');
  const [selectedStatus, setSelectedStatus] = useState<string>(routeParams.status || 'All');
  const [selectedTier, setSelectedTier] = useState<string>(routeParams.tier || 'All');
  const [sortBy, setSortBy] = useState<'popular' | 'chapters'>(
    routeParams.sort === 'chapters' ? 'chapters' : 'popular'
  );
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(routeParams.shelf || null);
  const [shelfDirectoryTab, setShelfDirectoryTab] = useState<'mine' | 'public'>('mine');

  // Create bookshelf panel state
  const [showCreateShelfForm, setShowCreateShelfForm] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [newShelfDescription, setNewShelfDescription] = useState('');
  const [newShelfVisibility, setNewShelfVisibility] = useState<BookshelfVisibility>('private');
  const [shelfSaving, setShelfSaving] = useState(false);
  const [shelfFeedback, setShelfFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Edit active bookshelf state
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null);
  const [editShelfName, setEditShelfName] = useState('');
  const [editShelfDescription, setEditShelfDescription] = useState('');
  const [confirmDeleteShelfId, setConfirmDeleteShelfId] = useState<string | null>(null);

  // Story -> Bookshelf picker modal state
  const [activeShelfStory, setActiveShelfStory] = useState<Story | null>(null);
  const [quickShelfName, setQuickShelfName] = useState('');
  const [quickShelfVisibility, setQuickShelfVisibility] = useState<BookshelfVisibility>('private');
  const [quickShelfFeedback, setQuickShelfFeedback] = useState<string | null>(null);

  const [moodPrompt, setMoodPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCuratorNote, setAiCuratorNote] = useState<string | null>(null);
  const [aiMatches, setAiMatches] = useState<AIRecommendation[]>([]);
  const [activeTrailerStory, setActiveTrailerStory] = useState<Story | null>(null);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedStoryIds, setLikedStoryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (stories.length === 0) return;
    let cancelled = false;
    const loadLikes = async () => {
      const res = await fetchLikesForStories(stories.map((s) => s.id));
      if (!cancelled) {
        setLikeCounts(res.state.counts);
        setLikedStoryIds(res.state.likedStoryIds);
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

  useEffect(() => {
    if (!activeTrailerStory && !activeShelfStory) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTrailerStory(null);
        setActiveShelfStory(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTrailerStory, activeShelfStory]);

  const activeShelf: StoryBookshelf | null = useMemo(() => {
    if (!selectedShelfId) return null;
    return (
      myBookshelves.find((s) => s.id === selectedShelfId) ||
      publicBookshelves.find((s) => s.id === selectedShelfId) ||
      null
    );
  }, [selectedShelfId, myBookshelves, publicBookshelves]);

  const isOwnActiveShelf = Boolean(
    activeShelf &&
      (myBookshelves.some((s) => s.id === activeShelf.id) ||
        (isAuthenticated && activeShelf.ownerId === user.id))
  );

  useEffect(() => {
    if (selectedShelfId && !activeShelf && myBookshelves.length + publicBookshelves.length > 0) {
      // Wait cleanly if still loading; clear only if shelf was deleted locally
    }
  }, [selectedShelfId, activeShelf, myBookshelves.length, publicBookshelves.length]);

  // Synchronize filter state with /stories URL query parameters
  useEffect(() => {
    navigate(
      'stories',
      {
        q: searchQuery || undefined,
        genre: selectedGenre !== 'All' ? selectedGenre : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        tier: selectedTier !== 'All' ? selectedTier : undefined,
        sort: sortBy !== 'popular' ? sortBy : undefined,
        shelf: selectedShelfId || undefined,
      },
      { replace: true }
    );
  }, [searchQuery, selectedGenre, selectedStatus, selectedTier, sortBy, selectedShelfId, navigate]);

  const handleCreateShelfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShelfFeedback(null);
    setShelfSaving(true);
    const res = await createBookshelf({
      name: newShelfName,
      description: newShelfDescription || undefined,
      visibility: newShelfVisibility,
    });
    setShelfSaving(false);
    if (!res.ok || !res.bookshelf) {
      setShelfFeedback({ type: 'error', text: res.error || 'Could not create bookshelf.' });
      return;
    }
    setNewShelfName('');
    setNewShelfDescription('');
    setNewShelfVisibility('private');
    setShowCreateShelfForm(false);
    setShelfDirectoryTab('mine');
    setSelectedShelfId(res.bookshelf.id);
    setShelfFeedback({
      type: 'success',
      text: `Created "${res.bookshelf.name}" (${res.bookshelf.visibility === 'public' ? 'Public' : 'Private'}).`,
    });
  };

  const handleSaveShelfEdit = async (shelfId: string) => {
    setShelfFeedback(null);
    setShelfSaving(true);
    const res = await updateBookshelf(shelfId, {
      name: editShelfName,
      description: editShelfDescription.trim() || null,
    });
    setShelfSaving(false);
    if (!res.ok) {
      setShelfFeedback({ type: 'error', text: res.error || 'Could not update bookshelf.' });
      return;
    }
    setEditingShelfId(null);
    setShelfFeedback({ type: 'success', text: 'Bookshelf details updated.' });
  };

  const handleToggleShelfVisibility = async (shelf: StoryBookshelf) => {
    setShelfFeedback(null);
    const nextVis: BookshelfVisibility = shelf.visibility === 'public' ? 'private' : 'public';
    const res = await updateBookshelf(shelf.id, { visibility: nextVis });
    if (!res.ok) {
      setShelfFeedback({ type: 'error', text: res.error || 'Could not change visibility.' });
      return;
    }
    setShelfFeedback({
      type: 'success',
      text: `"${shelf.name}" is now ${nextVis === 'public' ? 'Public on Lorethos Lists' : 'Private (visible only to you)'}.`,
    });
  };

  const handleDeleteShelf = async (shelfId: string) => {
    setShelfFeedback(null);
    const res = await deleteBookshelf(shelfId);
    if (!res.ok) {
      setShelfFeedback({ type: 'error', text: res.error || 'Could not delete bookshelf.' });
      return;
    }
    if (selectedShelfId === shelfId) {
      setSelectedShelfId(null);
    }
    setConfirmDeleteShelfId(null);
    setEditingShelfId(null);
    setShelfFeedback({ type: 'success', text: 'Bookshelf deleted.' });
  };

  const handleQuickCreateAndAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShelfStory) return;
    setQuickShelfFeedback(null);
    setShelfSaving(true);
    const res = await createBookshelf({
      name: quickShelfName,
      visibility: quickShelfVisibility,
      storyIds: [activeShelfStory.id],
    });
    setShelfSaving(false);
    if (!res.ok || !res.bookshelf) {
      setQuickShelfFeedback(res.error || 'Could not create bookshelf.');
      return;
    }
    setQuickShelfName('');
    setQuickShelfVisibility('private');
    setQuickShelfFeedback(`Added "${activeShelfStory.title}" to "${res.bookshelf.name}".`);
  };

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
        if (activeShelf && !activeShelf.storyIds.includes(story.id)) {
          return false;
        }

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
  }, [stories, activeShelf, searchQuery, selectedGenre, selectedStatus, selectedTier, sortBy]);

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

        {/* Curated Story Bookshelves */}
        <section
          aria-label="Custom Story Bookshelves"
          className="bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] rounded-xl border border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/15 p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs tracking-wider uppercase text-[#C85A32] font-semibold font-sans-ui">
                <Library className="w-3.5 h-3.5" />
                <span>Curated Bookshelves</span>
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Organize Saved Stories Into Lists
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-sans-ui">
              <div
                role="tablist"
                aria-label="Bookshelf directories"
                className="inline-flex rounded-lg border border-[#2D142C]/15 dark:border-white/15 p-0.5 bg-[#F9F6F0] dark:bg-[#160C16]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={shelfDirectoryTab === 'mine'}
                  onClick={() => setShelfDirectoryTab('mine')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    shelfDirectoryTab === 'mine'
                      ? 'bg-[#2D142C] text-white dark:bg-white dark:text-[#160C16]'
                      : 'text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
                  }`}
                >
                  My Shelves (<span className="tabular-nums">{myBookshelves.length}</span>)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={shelfDirectoryTab === 'public'}
                  onClick={() => setShelfDirectoryTab('public')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    shelfDirectoryTab === 'public'
                      ? 'bg-[#2D142C] text-white dark:bg-white dark:text-[#160C16]'
                      : 'text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
                  }`}
                >
                  Public Lists (<span className="tabular-nums">{publicBookshelves.length}</span>)
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShelfFeedback(null);
                  setShowCreateShelfForm((prev) => !prev);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showCreateShelfForm ? 'Close Form' : 'New Bookshelf'}</span>
              </button>
            </div>
          </div>

          {shelfFeedback && (
            <div
              role={shelfFeedback.type === 'error' ? 'alert' : 'status'}
              className={`px-3.5 py-2.5 rounded-lg border text-xs font-sans-ui flex items-center justify-between gap-3 ${
                shelfFeedback.type === 'error'
                  ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                  : 'border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              <span>{shelfFeedback.text}</span>
              <button
                type="button"
                onClick={() => setShelfFeedback(null)}
                aria-label="Dismiss shelf message"
                className="opacity-70 hover:opacity-100 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showCreateShelfForm && (
            <form
              onSubmit={handleCreateShelfSubmit}
              className="p-4 sm:p-5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] space-y-4 font-sans-ui"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label htmlFor="new-bookshelf-name" className="block text-xs font-semibold">
                    Bookshelf Name
                  </label>
                  <input
                    id="new-bookshelf-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={60}
                    value={newShelfName}
                    onChange={(e) => setNewShelfName(e.target.value)}
                    placeholder="e.g., Midnight Mythic Reads"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-white dark:bg-[#1E111E] focus:outline-none focus:border-[#C85A32]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="new-bookshelf-desc" className="block text-xs font-semibold">
                    Curator Note <span className="font-normal opacity-60">(optional)</span>
                  </label>
                  <input
                    id="new-bookshelf-desc"
                    type="text"
                    maxLength={200}
                    value={newShelfDescription}
                    onChange={(e) => setNewShelfDescription(e.target.value)}
                    placeholder="Short theme or reading order note..."
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-white dark:bg-[#1E111E] focus:outline-none focus:border-[#C85A32]"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#2D142C]/10 dark:border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold mr-1">Visibility:</span>
                  <button
                    type="button"
                    onClick={() => setNewShelfVisibility('private')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      newShelfVisibility === 'private'
                        ? 'border-[#2D142C] bg-[#2D142C] text-white dark:border-white dark:bg-white dark:text-[#160C16]'
                        : 'border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32]/50'
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    <span>Private</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewShelfVisibility('public')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      newShelfVisibility === 'public'
                        ? 'border-[#C85A32] bg-[#C85A32] text-white'
                        : 'border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32]/50'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    <span>Public</span>
                  </button>
                  {!isAuthenticated && newShelfVisibility === 'public' && (
                    <span className="text-[11px] text-[#C85A32]">
                      Sign in on{' '}
                      <a
                        href={buildHref('account', { redirect: '/stories' })}
                        onClick={(e) => handleLink(e, 'account', { redirect: '/stories' })}
                        className="underline font-semibold"
                      >
                        Account
                      </a>{' '}
                      to publish publicly.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowCreateShelfForm(false)}
                    className="px-3 py-1.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 text-xs font-medium hover:bg-[#2D142C]/5 dark:hover:bg-white/5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={shelfSaving || newShelfName.trim().length < 2}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {shelfSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Create Bookshelf</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Bookshelf Index Strip */}
          <div className="flex flex-wrap items-center gap-2 pt-1 font-sans-ui">
            <button
              type="button"
              onClick={() => setSelectedShelfId(null)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedShelfId === null
                  ? 'border-[#2D142C] bg-[#2D142C] text-white dark:border-white dark:bg-white dark:text-[#160C16] font-semibold'
                  : 'border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32]/50'
              }`}
            >
              <span>All Catalog Stories</span>
              <span className="opacity-70">&middot;</span>
              <span className="tabular-nums">{stories.length}</span>
            </button>

            {(shelfDirectoryTab === 'mine' ? myBookshelves : publicBookshelves).map((shelf) => {
              const isSelected = selectedShelfId === shelf.id;
              return (
                <button
                  key={shelf.id}
                  type="button"
                  onClick={() => {
                    setSelectedShelfId(isSelected ? null : shelf.id);
                    setEditingShelfId(null);
                    setConfirmDeleteShelfId(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#C85A32] bg-[#C85A32] text-white font-semibold'
                      : 'border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32]/50'
                  }`}
                >
                  {shelf.visibility === 'public' ? (
                    <Globe className="w-3 h-3 shrink-0 opacity-85" />
                  ) : (
                    <Lock className="w-3 h-3 shrink-0 opacity-85" />
                  )}
                  <span className="truncate max-w-[170px]">{shelf.name}</span>
                  {shelfDirectoryTab === 'public' && (
                    <span className="opacity-75 text-[11px] hidden sm:inline">
                      &middot; {shelf.ownerName}
                    </span>
                  )}
                  <span className="opacity-70">&middot;</span>
                  <span className="tabular-nums shrink-0">{shelf.storyIds.length}</span>
                </button>
              );
            })}

            {shelfDirectoryTab === 'mine' && myBookshelves.length === 0 && (
              <span className="text-xs text-[#2D142C]/60 dark:text-white/60 px-2">
                No personal shelves yet &mdash; create one to group stories into Private or Public lists.
              </span>
            )}
            {shelfDirectoryTab === 'public' && publicBookshelves.length === 0 && (
              <span className="text-xs text-[#2D142C]/60 dark:text-white/60 px-2">
                No public reader lists yet &mdash; publish a shelf to share your reading list.
              </span>
            )}
          </div>

          {/* Active Bookshelf Header & Management */}
          {activeShelf && (
            <div className="pt-4 border-t border-[#2D142C]/10 dark:border-white/10 space-y-3 font-sans-ui">
              {editingShelfId === activeShelf.id ? (
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <label htmlFor="edit-shelf-name" className="block text-[11px] font-semibold">
                      Shelf Name
                    </label>
                    <input
                      id="edit-shelf-name"
                      type="text"
                      minLength={2}
                      maxLength={60}
                      value={editShelfName}
                      onChange={(e) => setEditShelfName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label htmlFor="edit-shelf-desc" className="block text-[11px] font-semibold">
                      Note
                    </label>
                    <input
                      id="edit-shelf-desc"
                      type="text"
                      maxLength={200}
                      value={editShelfDescription}
                      onChange={(e) => setEditShelfDescription(e.target.value)}
                      placeholder="Optional shelf note..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={shelfSaving || editShelfName.trim().length < 2}
                      onClick={() => handleSaveShelfEdit(activeShelf.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#C85A32] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingShelfId(null)}
                      className="px-3 py-1.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 text-xs cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-display text-lg font-bold text-[#2D142C] dark:text-white">
                        {activeShelf.name}
                      </span>
                      <span className="opacity-50">&middot;</span>
                      <span className="inline-flex items-center gap-1 text-[#C85A32] font-semibold">
                        {activeShelf.visibility === 'public' ? (
                          <Globe className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                        <span>{activeShelf.visibility === 'public' ? 'Public List' : 'Private Shelf'}</span>
                      </span>
                      <span className="opacity-50">&middot;</span>
                      <span className="opacity-70">Curated by {activeShelf.ownerName}</span>
                      <span className="opacity-50">&middot;</span>
                      <span className="tabular-nums opacity-70">
                        {activeShelf.storyIds.length}{' '}
                        {activeShelf.storyIds.length === 1 ? 'story' : 'stories'}
                      </span>
                    </div>
                    {activeShelf.description && (
                      <p className="text-xs font-reader text-[#2D142C]/75 dark:text-white/75">
                        {activeShelf.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isOwnActiveShelf && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingShelfId(activeShelf.id);
                            setEditShelfName(activeShelf.name);
                            setEditShelfDescription(activeShelf.description || '');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 text-xs hover:border-[#C85A32] cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Rename</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleShelfVisibility(activeShelf)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 text-xs hover:border-[#C85A32] cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {activeShelf.visibility === 'public' ? (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>Make Private</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-3 h-3" />
                              <span>Make Public</span>
                            </>
                          )}
                        </button>
                        {confirmDeleteShelfId === activeShelf.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteShelf(activeShelf.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteShelfId(null)}
                              className="px-2 py-1.5 text-xs opacity-75 hover:opacity-100 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteShelfId(activeShelf.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/25 text-red-600 dark:text-red-400 text-xs hover:bg-red-500/10 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedShelfId(null)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#C85A32] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Show All Stories
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Story Grid */}
        {filteredStories.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#1E111E] rounded-xl border border-[#2D142C]/10 dark:border-white/10 p-8 space-y-3">
            <BookOpen className="w-10 h-10 mx-auto text-[#C85A32]/60" />
            <h3 className="font-display text-xl font-semibold">
              {activeShelf && activeShelf.storyIds.length === 0
                ? `"${activeShelf.name}" Is Empty`
                : 'No Stories Found'}
            </h3>
            <p className="text-xs text-[#2D142C]/60 dark:text-white/60 max-w-md mx-auto">
              {activeShelf && activeShelf.storyIds.length === 0
                ? 'Browse the catalog and tap "Save" on any story card to organize it into this bookshelf.'
                : 'Try adjusting your search terms, active shelf, or filters.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedGenre('All');
                setSelectedStatus('All');
                setSelectedTier('All');
                setSelectedShelfId(null);
              }}
              className="text-xs font-semibold text-[#C85A32] hover:underline cursor-pointer"
            >
              {activeShelf ? 'Browse All Catalog Stories' : 'Reset all filters'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredStories.map((story) => {
              const containingShelvesCount = myBookshelves.filter((s) =>
                s.storyIds.includes(story.id)
              ).length;
              return (
              <article
                key={story.id}
                className="bg-white dark:bg-[#1E111E] rounded-xl border border-[#2D142C]/10 dark:border-white/10 overflow-hidden hover:border-[#C85A32]/40 transition-all duration-200 hover:shadow-lg flex flex-col justify-between group"
              >
                <a
                  href={buildHref('story-detail', { slug: story.slug })}
                  onClick={(e) => handleLink(e, 'story-detail', { slug: story.slug })}
                  className="flex-1 flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
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

                  <div className="p-5 pb-4 flex-1 space-y-2">
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
                </a>

                <div className="px-5 pb-5">
                  <div className="pt-3 border-t border-[#2D142C]/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                    <span className="truncate">
                      {story.author} &middot; Ch. 1&ndash;{story.freeChaptersCount} Free
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickShelfFeedback(null);
                          setActiveShelfStory(story);
                        }}
                        aria-label={`Save ${story.title} to bookshelf`}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          containingShelvesCount > 0
                            ? 'bg-[#2D142C] text-white dark:bg-white dark:text-[#160C16]'
                            : 'border border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32] hover:text-[#C85A32]'
                        }`}
                      >
                        <BookmarkPlus className="w-3 h-3" />
                        <span>
                          {containingShelvesCount > 0 ? `Shelves (${containingShelvesCount})` : 'Save'}
                        </span>
                      </button>

                      {activeShelf && isOwnActiveShelf && (
                        <button
                          type="button"
                          onClick={() => toggleStoryInBookshelf(activeShelf.id, story.id, 'remove')}
                          title={`Remove ${story.title} from ${activeShelf.name}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-500/25 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <X className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}

                      <StoryLikeButton
                        storyId={story.id}
                        storyTitle={story.title}
                        initialCount={likeCounts[story.id] || 0}
                        initialLiked={likedStoryIds.has(story.id)}
                        onUpdated={(id, liked, count) => {
                          setLikeCounts((prev) => ({ ...prev, [id]: count }));
                          setLikedStoryIds((prev) => {
                            const next = new Set(prev);
                            if (liked) next.add(id);
                            else next.delete(id);
                            return next;
                          });
                        }}
                      />
                      {story.trailerVideoUrl && (
                        <button
                          type="button"
                          onClick={() => setActiveTrailerStory(story)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#C85A32]/10 hover:bg-[#C85A32] text-[#C85A32] hover:text-white font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          <Film className="w-3 h-3" />
                          <span>Trailer</span>
                        </button>
                      )}
                      <a
                        href={buildHref('story-detail', { slug: story.slug })}
                        onClick={(e) => handleLink(e, 'story-detail', { slug: story.slug })}
                        className="tabular-nums font-medium text-[#2D142C] dark:text-white hover:text-[#C85A32]"
                      >
                        {story.chapters.length} Chs
                      </a>
                    </div>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        )}

      </div>

      <WriterStoriesFeed externalQuery={searchQuery} />

      {/* Save Story to Bookshelf Picker Dialog */}
      {activeShelfStory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`Organize ${activeShelfStory.title} into bookshelves`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveShelfStory(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] border border-[#2D142C]/15 dark:border-white/15 shadow-2xl p-6 space-y-5 my-auto font-sans-ui">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={activeShelfStory.coverImage}
                  alt=""
                  className="w-10 h-14 object-cover rounded border border-[#2D142C]/15 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-[#C85A32] font-semibold">
                    Organize in Bookshelves
                  </div>
                  <h3 className="font-display text-lg font-bold truncate">
                    {activeShelfStory.title}
                  </h3>
                  <p className="text-xs opacity-65 truncate">By {activeShelfStory.author}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveShelfStory(null)}
                aria-label="Close bookshelf picker"
                className="p-1.5 rounded-lg hover:bg-[#2D142C]/10 dark:hover:bg-white/10 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickShelfFeedback && (
              <div className="px-3 py-2 rounded-lg bg-[#C85A32]/10 border border-[#C85A32]/25 text-xs text-[#C85A32] font-medium">
                {quickShelfFeedback}
              </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {myBookshelves.length === 0 ? (
                <p className="text-xs opacity-70 py-3 text-center border border-dashed border-[#2D142C]/15 dark:border-white/15 rounded-lg">
                  You don&rsquo;t have any bookshelves yet. Create one below to save this story.
                </p>
              ) : (
                myBookshelves.map((shelf) => {
                  const inShelf = shelf.storyIds.includes(activeShelfStory.id);
                  return (
                    <button
                      key={shelf.id}
                      type="button"
                      onClick={async () => {
                        const res = await toggleStoryInBookshelf(shelf.id, activeShelfStory.id, 'toggle');
                        if (!res.ok && res.error) {
                          setQuickShelfFeedback(res.error);
                        } else {
                          setQuickShelfFeedback(
                            res.inShelf
                              ? `Added to "${shelf.name}".`
                              : `Removed from "${shelf.name}".`
                          );
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        inShelf
                          ? 'border-[#C85A32] bg-[#C85A32]/10'
                          : 'border-[#2D142C]/12 dark:border-white/12 hover:border-[#C85A32]/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                          {shelf.visibility === 'public' ? (
                            <Globe className="w-3 h-3 text-[#C85A32] shrink-0" />
                          ) : (
                            <Lock className="w-3 h-3 opacity-65 shrink-0" />
                          )}
                          <span className="truncate">{shelf.name}</span>
                        </div>
                        <div className="text-[11px] opacity-60">
                          {shelf.visibility === 'public' ? 'Public' : 'Private'} &middot;{' '}
                          <span className="tabular-nums">{shelf.storyIds.length}</span>{' '}
                          {shelf.storyIds.length === 1 ? 'story' : 'stories'}
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                          inShelf
                            ? 'bg-[#C85A32] border-[#C85A32] text-white'
                            : 'border-[#2D142C]/25 dark:border-white/25'
                        }`}
                      >
                        {inShelf && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleQuickCreateAndAddStory}
              className="pt-3 border-t border-[#2D142C]/10 dark:border-white/10 space-y-2.5"
            >
              <label htmlFor="quick-shelf-name" className="block text-xs font-semibold">
                Or create a new bookshelf &amp; add story
              </label>
              <div className="flex gap-2">
                <input
                  id="quick-shelf-name"
                  type="text"
                  minLength={2}
                  maxLength={60}
                  required
                  value={quickShelfName}
                  onChange={(e) => setQuickShelfName(e.target.value)}
                  placeholder="New shelf name..."
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32]"
                />
                <button
                  type="button"
                  onClick={() =>
                    setQuickShelfVisibility((v) => (v === 'private' ? 'public' : 'private'))
                  }
                  title="Toggle Private or Public list"
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[#2D142C]/15 dark:border-white/15 text-xs font-medium hover:border-[#C85A32] cursor-pointer whitespace-nowrap shrink-0"
                >
                  {quickShelfVisibility === 'public' ? (
                    <>
                      <Globe className="w-3 h-3 text-[#C85A32]" />
                      <span>Public</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" />
                      <span>Private</span>
                    </>
                  )}
                </button>
                <button
                  type="submit"
                  disabled={shelfSaving || quickShelfName.trim().length < 2}
                  className="px-3.5 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTrailerStory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeTrailerStory.title} official trailer`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveTrailerStory(null);
          }}
        >
          <div className="w-full max-w-3xl relative my-auto">
            <button
              type="button"
              onClick={() => setActiveTrailerStory(null)}
              aria-label="Close trailer dialog"
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-[#2D142C] text-white border border-white/20 flex items-center justify-center shadow-lg hover:bg-[#C85A32] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <StoryTrailerPlayer
              story={activeTrailerStory}
              storyHref={buildHref('story-detail', { slug: activeTrailerStory.slug })}
              readerHref={buildHref('reader', { slug: activeTrailerStory.slug, chapterNumber: 1 })}
              onNavigateStory={() => {
                setActiveTrailerStory(null);
                navigate('story-detail', { slug: activeTrailerStory.slug });
              }}
              onNavigateReader={() => {
                setActiveTrailerStory(null);
                navigate('reader', { slug: activeTrailerStory.slug, chapterNumber: 1 });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
