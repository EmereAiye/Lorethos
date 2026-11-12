import React from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, Sparkles, Clock, ArrowRight, Play, Youtube, Check } from 'lucide-react';

export const HomeView: React.FC = () => {
  const { stories, navigate, openPaystackCheckout, user } = useApp();

  const flagshipStory = stories.find(s => s.id === 'story-obsidian-throne') || stories[0];
  const featuredStories = stories.filter(s => s.featured);
  const allStories = stories;

  // Flatten latest chapters across stories
  const latestChapters = stories.flatMap(s => 
    s.chapters.slice(-2).map(ch => ({
      ...ch,
      storyTitle: s.title,
      storySlug: s.slug,
      storyCover: s.coverImage,
      genre: s.genre
    }))
  ).slice(0, 4);

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] transition-colors">
      
      {/* Editorial Announcement Banner */}
      <div className="bg-[#2D142C] text-[#F9F6F0] border-b border-white/10 px-4 py-2.5 text-xs text-center font-sans-ui">
        <span className="text-[#C85A32] font-semibold">New Chapter Drop:</span>{' '}
        <span>The Obsidian Throne &middot; Chapter 5 is now live for Patrons &middot; Chapters 1–3 Free for All Readers</span>
      </div>

      {/* Hero Spotlight: Flagship Story */}
      <section className="relative overflow-hidden border-b border-[#2D142C]/10 dark:border-white/10 py-16 md:py-24">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#C85A32]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-[#2D142C]/10 dark:bg-[#C85A32]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Flagship Story Prose & CTAs */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-3 text-xs tracking-wider uppercase text-[#C85A32] font-semibold font-sans-ui">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Flagship Serialized Epic</span>
                <span>·</span>
                <span className="text-[#2D142C]/60 dark:text-white/60 font-normal">
                  {flagshipStory.genre}
                </span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[#2D142C] dark:text-[#F9F6F0] leading-[1.08] text-balance">
                {flagshipStory.title}
              </h1>

              <p className="font-reader text-lg sm:text-xl text-[#2D142C]/80 dark:text-[#F9F6F0]/80 italic">
                "{flagshipStory.subtitle}"
              </p>

              <p className="font-reader text-base text-[#2D142C]/75 dark:text-[#F9F6F0]/70 leading-relaxed max-w-2xl">
                {flagshipStory.synopsis}
              </p>

              {/* Unboxed Metadata & Reader Metrics */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui pt-2">
                <span>By <strong className="text-[#2D142C] dark:text-white font-medium">{flagshipStory.author}</strong></span>
                <span>·</span>
                <span>{flagshipStory.totalChapters} Chapters Released</span>
                <span>·</span>
                <span>First 3 Chapters Free</span>
                <span>·</span>
                <span className="tabular-nums">★ {flagshipStory.rating} ({flagshipStory.ratingsCount} reviews)</span>
              </div>

              {/* Primary Action Buttons */}
              <div className="pt-4 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => navigate('reader', { slug: flagshipStory.slug, chapterNumber: 1 })}
                  className="px-6 py-3.5 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#b04d28] rounded-lg shadow-sm hover:shadow transition-all duration-150 flex items-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Start Reading Chapter 1 (Free)</span>
                </button>

                <button
                  onClick={() => navigate('story-detail', { slug: flagshipStory.slug })}
                  className="px-5 py-3.5 text-sm font-medium text-[#2D142C] dark:text-[#F9F6F0] bg-transparent hover:bg-[#2D142C]/5 dark:hover:bg-white/5 border border-[#2D142C]/20 dark:border-white/20 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <span>Explore Index & Lore</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Reader Hook Quote */}
              <div className="pt-6 border-t border-[#2D142C]/10 dark:border-white/10">
                <blockquote className="font-reader text-xs sm:text-sm text-[#2D142C]/70 dark:text-[#F9F6F0]/70 italic border-l-2 border-[#C85A32] pl-3">
                  "{flagshipStory.chapters[0]?.excerpt}"
                </blockquote>
              </div>
            </div>

            {/* Right Column: Physical Book Visual Presentation */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div 
                onClick={() => navigate('story-detail', { slug: flagshipStory.slug })}
                className="relative group cursor-pointer max-w-xs sm:max-w-sm"
              >
                {/* Book Spine and Depth Effect */}
                <div className="relative rounded-lg overflow-hidden shadow-2xl transition-transform duration-300 group-hover:-translate-y-2 border border-[#2D142C]/20 dark:border-white/20">
                  <img
                    src={flagshipStory.coverImage}
                    alt={flagshipStory.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-auto aspect-[3/4] object-cover"
                  />
                  {/* Subtle lighting overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none" />
                  
                  {/* Subtle Badge */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white">
                    <span className="font-medium bg-[#2D142C]/80 backdrop-blur-xs px-2.5 py-1 rounded">
                      Ch. 1–3 Free to Read
                    </span>
                    <span className="font-sans-ui text-[11px] bg-[#C85A32] px-2 py-1 rounded font-semibold">
                      Featured Series
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <span className="text-xs text-[#2D142C]/60 dark:text-white/60 group-hover:text-[#C85A32] transition-colors">
                    Click to view chapter directory & synopsis &rarr;
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Bookshelf 1: Curated Featured Series */}
      <section className="py-16 border-b border-[#2D142C]/10 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
            <div>
              <div className="text-xs tracking-wider uppercase text-[#C85A32] font-semibold font-sans-ui mb-1">
                Curated Bookshelf
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
                Featured Serialized Works
              </h2>
            </div>
            <button
              onClick={() => navigate('stories')}
              className="text-xs font-semibold text-[#C85A32] hover:text-[#b04d28] flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <span>View complete catalog ({stories.length} stories)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredStories.map((story) => (
              <div
                key={story.id}
                onClick={() => navigate('story-detail', { slug: story.slug })}
                className="group flex flex-col cursor-pointer"
              >
                {/* Book Cover Container */}
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden border border-[#2D142C]/10 dark:border-white/10 shadow-md group-hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1 mb-4">
                  <img
                    src={story.coverImage}
                    alt={story.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#2D142C]/85 text-white backdrop-blur-xs">
                      {story.status}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#C85A32] text-white">
                      {story.accessTier === 'free' ? 'Free Access' : 'Chapters 1-3 Free'}
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] text-[#C85A32] font-medium tracking-wide uppercase font-sans-ui">
                      {story.genre}
                    </div>
                    <h3 className="font-display text-xl font-bold tracking-tight text-[#2D142C] dark:text-[#F9F6F0] group-hover:text-[#C85A32] transition-colors line-clamp-1">
                      {story.title}
                    </h3>
                    <p className="text-xs text-[#2D142C]/70 dark:text-[#F9F6F0]/70 font-reader line-clamp-2 mt-1">
                      {story.synopsis}
                    </p>
                  </div>

                  {/* Reading Progress Indicator if story in progress */}
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

                  <div className="pt-3 border-t border-[#2D142C]/10 dark:border-white/10 flex items-center justify-between text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                    <span>{story.author}</span>
                    <span className="tabular-nums">
                      {user.readingProgress[story.id] 
                        ? `Resume Ch. ${user.readingProgress[story.id].chapterNumber} →` 
                        : `${story.totalChapters} Chs`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Bookshelf 2 & Latest Chapters Drops */}
      <section className="py-16 border-b border-[#2D142C]/10 dark:border-white/10 bg-[#2D142C]/[0.02] dark:bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Left: Latest Chapter Releases */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <div className="text-xs tracking-wider uppercase text-[#C85A32] font-semibold font-sans-ui mb-1">
                  Fresh from the Scriptorium
                </div>
                <h2 className="font-display text-3xl font-semibold tracking-tight">
                  Latest Chapter Drops
                </h2>
              </div>

              <div className="space-y-4">
                {latestChapters.map((ch, idx) => (
                  <div
                    key={ch.id + idx}
                    onClick={() => navigate('reader', { slug: ch.storySlug, chapterNumber: ch.chapterNumber })}
                    className="p-4 rounded-lg bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 hover:border-[#C85A32]/40 transition-all cursor-pointer flex items-center justify-between gap-4 group shadow-2xs hover:shadow-sm"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={ch.storyCover}
                        alt=""
                        className="w-12 h-16 rounded object-cover shrink-0 border border-[#2D142C]/10"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] text-[#C85A32] font-medium font-sans-ui">
                          {ch.storyTitle} &middot; Chapter {ch.chapterNumber}
                        </div>
                        <h4 className="font-display text-base font-bold text-[#2D142C] dark:text-[#F9F6F0] group-hover:text-[#C85A32] transition-colors truncate">
                          {ch.title}
                        </h4>
                        <p className="text-xs text-[#2D142C]/60 dark:text-white/60 font-reader truncate">
                          "{ch.excerpt}"
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-sans-ui text-[#2D142C]/50 dark:text-white/50 block">
                        {ch.readTimeMinutes} min read
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded mt-1 inline-block ${
                        ch.isFree
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-[#C85A32]/10 text-[#C85A32]'
                      }`}>
                        {ch.isFree ? 'Free Chapter' : 'Patron Chapter'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: The Patron Membership Circle Overview */}
            <div className="lg:col-span-5 flex flex-col justify-between p-8 rounded-xl bg-[#2D142C] text-[#F9F6F0] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#C85A32]/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative space-y-5">
                <div className="flex items-center gap-2">
                  <img
                    src="/assets/aistudio/1A2959EF-E3CD-42F2-B9E5-21E771900F65_0f8daa7f.png"
                    alt="Logo Monogram"
                    className="w-9 h-9 rounded-full border border-[#C85A32]/60"
                  />
                  <span className="text-xs tracking-widest uppercase font-semibold text-[#C85A32]">
                    Lorethos Patron Circle
                  </span>
                </div>

                <h3 className="font-display text-2xl sm:text-3xl font-semibold leading-tight text-white">
                  Sustain Independent Serialized Literature
                </h3>

                <p className="text-xs sm:text-sm text-white/70 font-reader leading-relaxed">
                  Support original writing while enjoying unrestricted access to all ongoing novels, advance chapter drops 14 days early, and atmospheric audio narration.
                </p>

                <div className="space-y-2.5 text-xs text-white/80 font-sans-ui pt-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                    <span>Instant access to every serialized chapter</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                    <span>Pay in Nigerian Naira via Paystack (Debit Cards, Transfer, USSD)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                    <span>Ambient fireplace and rain soundscapes in the reader</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#C85A32] shrink-0" />
                    <span>Cancel or switch plans at any time</span>
                  </div>
                </div>
              </div>

              <div className="relative pt-6 mt-6 border-t border-white/10 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-white/70 font-sans-ui">Standard Patron Pass</span>
                  <span className="font-sans-ui text-xl font-bold text-white tabular-nums">
                    ₦3,500 <span className="text-xs font-normal text-white/60">/ month</span>
                  </span>
                </div>

                <button
                  onClick={() => openPaystackCheckout({
                    type: 'subscription',
                    title: 'Lorethos Patron Monthly Membership',
                    amountNgn: 3500,
                    planId: 'monthly'
                  })}
                  className="w-full py-3 px-4 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold text-xs tracking-wide rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg"
                >
                  <span>Join the Patron Circle</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* Community & YouTube Channel Integration */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#2D142C]/10 dark:border-white/10 bg-gradient-to-r from-[#2D142C]/5 to-[#C85A32]/10 dark:from-white/5 dark:to-white/[0.02] p-8 sm:p-12">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              
              <div className="md:col-span-8 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#C85A32] font-sans-ui">
                  <Youtube className="w-4 h-4 text-red-600" />
                  <span>Lorethos Chronicles on YouTube</span>
                </div>
                
                <h3 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
                  Immerse in Video Narrations & Mythic Worldbuilding
                </h3>

                <p className="font-reader text-sm sm:text-base text-[#2D142C]/75 dark:text-[#F9F6F0]/75 leading-relaxed">
                  Join the official Lorethos YouTube channel for deep lore analyses, character lineage breakdowns, animated story excerpts, and author discussions exploring the mythos behind every saga.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={() => navigate('contact')}
                    className="px-5 py-2.5 text-xs font-semibold bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Watch Lore Excerpts & Episodes</span>
                  </button>

                  <button
                    onClick={() => navigate('contact')}
                    className="px-4 py-2.5 text-xs font-medium text-[#2D142C] dark:text-[#F9F6F0] hover:text-[#C85A32] transition-colors cursor-pointer"
                  >
                    Submit Author Question &rarr;
                  </button>
                </div>
              </div>

              <div className="md:col-span-4 flex justify-center">
                <div className="w-full max-w-xs bg-white dark:bg-[#1E111E] rounded-xl p-4 border border-[#2D142C]/10 dark:border-white/10 shadow-md space-y-3">
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black/80 flex items-center justify-center">
                    <img
                      src="/src/assets/images/book_cover_obsidian_throne_1794465561565.jpg"
                      alt="Episode Thumbnail"
                      className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute w-12 h-12 bg-red-600/90 rounded-full flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#C85A32] font-semibold font-sans-ui">Featured Broadcast</div>
                    <div className="text-xs font-bold text-[#2D142C] dark:text-[#F9F6F0] line-clamp-1">
                      The Astronomy of Ostraka: Deciphering the Solar Eclipse
                    </div>
                    <div className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui mt-0.5">
                      18.4K Views &middot; Lorethos Official
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
