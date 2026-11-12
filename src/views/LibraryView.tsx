import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Filter, BookOpen, Star, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

export const LibraryView: React.FC = () => {
  const { stories, navigate, user } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedTier, setSelectedTier] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'chapters'>('popular');

  const genres = useMemo(() => {
    const list = Array.from(new Set(stories.map(s => s.genre)));
    return ['All', ...list];
  }, [stories]);

  const filteredStories = useMemo(() => {
    return stories.filter(story => {
      // Search
      const matchesSearch = 
        story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        story.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        story.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        story.synopsis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        story.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      // Genre
      const matchesGenre = selectedGenre === 'All' || story.genre === selectedGenre;

      // Status
      const matchesStatus = selectedStatus === 'All' || story.status === selectedStatus;

      // Tier
      const matchesTier = 
        selectedTier === 'All' || 
        (selectedTier === 'Free' && story.accessTier === 'free') ||
        (selectedTier === 'Subscription' && story.accessTier === 'subscription') ||
        (selectedTier === 'Purchase' && story.accessTier === 'purchase');

      return matchesSearch && matchesGenre && matchesStatus && matchesTier;
    }).sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'chapters') return b.totalChapters - a.totalChapters;
      return b.totalReads - a.totalReads;
    });
  }, [stories, searchQuery, selectedGenre, selectedStatus, selectedTier, sortBy]);

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
            Explore our curated shelf of original high fantasy, mythological realism, and historical chronicles. All stories feature free opening chapters.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="space-y-4 bg-white dark:bg-[#1E111E] p-6 rounded-xl border border-[#2D142C]/10 dark:border-white/10 shadow-2xs">
          
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#2D142C]/40 dark:text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, author, keyword, or mythos lore..."
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-transparent focus:outline-none focus:border-[#C85A32] text-[#2D142C] dark:text-white font-sans-ui"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-[#2D142C]/50 dark:text-white/50 hover:text-[#C85A32]"
              >
                Clear
              </button>
            )}
          </div>

          {/* Interactive Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#2D142C]/10 dark:border-white/10 text-xs font-sans-ui">
            
            {/* Genre Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[#2D142C]/50 dark:text-white/50 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>Genre:</span>
              </span>
              {genres.map(genre => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                    selectedGenre === genre
                      ? 'bg-[#2D142C] text-[#F9F6F0] dark:bg-white dark:text-[#160C16] font-semibold shadow-xs'
                      : 'text-[#2D142C]/70 dark:text-white/70 hover:bg-[#2D142C]/5 dark:hover:bg-white/5'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            {/* Sort & Status Controls */}
            <div className="flex flex-wrap items-center gap-3 ml-auto">
              {/* Access Tier */}
              <div className="flex items-center gap-1">
                <span className="text-[#2D142C]/50 dark:text-white/50">Tier:</span>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="bg-transparent border border-[#2D142C]/15 dark:border-white/15 rounded px-2.5 py-1 text-xs text-[#2D142C] dark:text-white focus:outline-none focus:border-[#C85A32]"
                >
                  <option value="All" className="bg-white dark:bg-[#1E111E]">All Access Tiers</option>
                  <option value="Free" className="bg-white dark:bg-[#1E111E]">Free to Read</option>
                  <option value="Subscription" className="bg-white dark:bg-[#1E111E]">Patron Subscription</option>
                  <option value="Purchase" className="bg-white dark:bg-[#1E111E]">Single Purchase</option>
                </select>
              </div>

              {/* Status */}
              <div className="flex items-center gap-1">
                <span className="text-[#2D142C]/50 dark:text-white/50">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-transparent border border-[#2D142C]/15 dark:border-white/15 rounded px-2.5 py-1 text-xs text-[#2D142C] dark:text-white focus:outline-none focus:border-[#C85A32]"
                >
                  <option value="All" className="bg-white dark:bg-[#1E111E]">All Statuses</option>
                  <option value="Ongoing" className="bg-white dark:bg-[#1E111E]">Ongoing</option>
                  <option value="Completed" className="bg-white dark:bg-[#1E111E]">Completed</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-[#2D142C]/50 dark:text-white/50" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent border border-[#2D142C]/15 dark:border-white/15 rounded px-2.5 py-1 text-xs text-[#2D142C] dark:text-white focus:outline-none focus:border-[#C85A32]"
                >
                  <option value="popular" className="bg-white dark:bg-[#1E111E]">Most Popular</option>
                  <option value="rating" className="bg-white dark:bg-[#1E111E]">Highest Rated</option>
                  <option value="chapters" className="bg-white dark:bg-[#1E111E]">Most Chapters</option>
                </select>
              </div>
            </div>

          </div>

        </div>

        {/* Story Grid */}
        {filteredStories.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#1E111E] rounded-xl border border-[#2D142C]/10 dark:border-white/10 p-8 space-y-3">
            <BookOpen className="w-10 h-10 mx-auto text-[#C85A32]/60" />
            <h3 className="font-display text-xl font-semibold">No Stories Found</h3>
            <p className="text-xs text-[#2D142C]/60 dark:text-white/60">
              Try adjusting your search terms or genre filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedGenre('All');
                setSelectedStatus('All');
                setSelectedTier('All');
              }}
              className="text-xs font-semibold text-[#C85A32] hover:underline"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredStories.map((story) => (
              <div
                key={story.id}
                onClick={() => navigate('story-detail', { slug: story.slug })}
                className="bg-white dark:bg-[#1E111E] rounded-xl border border-[#2D142C]/10 dark:border-white/10 overflow-hidden hover:border-[#C85A32]/40 transition-all duration-200 hover:shadow-lg flex flex-col group cursor-pointer"
              >
                {/* Book Cover Header */}
                <div className="relative aspect-[16/10] overflow-hidden bg-[#2D142C]">
                  <img
                    src={story.coverImage}
                    alt={story.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300 opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  
                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex justify-between items-center text-xs">
                    <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                      {story.status}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#C85A32] text-white">
                      {story.accessTier === 'free'
                        ? 'Free'
                        : story.accessTier === 'subscription'
                        ? 'Patron Subscription'
                        : `₦${story.priceNgn.toLocaleString('en-NG')} Unlock`}
                    </span>
                  </div>

                  {/* Title overlay */}
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="text-[10px] uppercase tracking-widest text-[#C85A32] font-semibold font-sans-ui block mb-0.5">
                      {story.genre}
                    </span>
                    <h3 className="font-display text-xl font-bold text-white leading-tight">
                      {story.title}
                    </h3>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <p className="font-reader text-xs text-[#2D142C]/75 dark:text-[#F9F6F0]/75 line-clamp-3 leading-relaxed">
                      {story.synopsis}
                    </p>
                    
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {story.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Reading Progress Indicator if story in progress */}
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

                  {/* Card Footer Metadata */}
                  <div className="pt-3 border-t border-[#2D142C]/10 dark:border-white/10 flex items-center justify-between text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span className="font-semibold text-[#2D142C] dark:text-white tabular-nums">
                        {story.rating}
                      </span>
                      <span>({story.ratingsCount})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-medium text-[#2D142C] dark:text-white">
                        {story.totalChapters} Chs
                      </span>
                      <span>&middot;</span>
                      <span className="text-[#C85A32] font-medium group-hover:underline">
                        Overview &rarr;
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
