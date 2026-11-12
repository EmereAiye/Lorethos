import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  BookOpen, 
  Lock, 
  Unlock, 
  Bookmark, 
  Share2, 
  Star, 
  Clock, 
  Headphones, 
  Check, 
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export const StoryOverviewView: React.FC = () => {
  const { 
    routeParams, 
    getStoryBySlug, 
    navigate, 
    hasAccessToChapter, 
    user, 
    openPaystackCheckout,
    toggleBookmark
  } = useApp();

  const [shareCopied, setShareCopied] = useState(false);
  const story = getStoryBySlug(routeParams.slug || '');

  if (!story) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-20 text-center">
        <h2 className="font-display text-2xl font-bold mb-4">Story Not Found</h2>
        <button
          onClick={() => navigate('stories')}
          className="text-xs font-semibold text-[#C85A32] underline cursor-pointer"
        >
          Return to Library
        </button>
      </div>
    );
  }

  const isUnlockedForUser = user.unlockedStoryIds.includes(story.id) || user.subscription.status === 'active' || user.role === 'owner';

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-12 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Breadcrumb / Back button */}
        <button
          onClick={() => navigate('stories')}
          className="flex items-center gap-2 text-xs font-medium text-[#2D142C]/60 dark:text-white/60 hover:text-[#C85A32] transition-colors cursor-pointer font-sans-ui"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Story Library</span>
        </button>

        {/* Story Header & Hero Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Column: Book Cover with Depth */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="w-full max-w-xs rounded-xl overflow-hidden shadow-2xl border border-[#2D142C]/15 dark:border-white/15 relative">
              <img
                src={story.coverImage}
                alt={story.title}
                referrerPolicy="no-referrer"
                className="w-full h-auto aspect-[3/4] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white">
                <span className="font-semibold px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs">
                  {story.status}
                </span>
                <span className="font-semibold px-2 py-0.5 rounded bg-[#C85A32]">
                  {story.totalChapters} Chapters
                </span>
              </div>
            </div>

            {/* Quick Action Ribbon Under Cover */}
            <div className="w-full max-w-xs mt-4 flex items-center justify-between gap-2 text-xs">
              <button
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
                    <span>Share Story</span>
                  </>
                )}
              </button>

              <button
                onClick={() => toggleBookmark(story.chapters[0]?.id || '')}
                className="py-2 px-3 rounded border border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32] text-[#2D142C]/80 dark:text-white/80 hover:text-[#C85A32] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Bookmark in Account Vault"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Right Column: Title, Synopsis, Purchase & Reading CTAs */}
          <div className="lg:col-span-8 space-y-6">
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#C85A32] font-semibold font-sans-ui">
                <span>{story.genre}</span>
                <span>·</span>
                <span className="text-[#2D142C]/60 dark:text-white/60 font-normal">Serialized Release</span>
              </div>
              
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#2D142C] dark:text-[#F9F6F0]">
                {story.title}
              </h1>

              <p className="font-reader text-lg text-[#2D142C]/80 dark:text-[#F9F6F0]/80 italic">
                "{story.subtitle}"
              </p>
            </div>

            {/* Author Credit & Tabular Rating */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#2D142C]/70 dark:text-white/70 font-sans-ui pt-1">
              <span>Author: <strong className="text-[#2D142C] dark:text-white">{story.author}</strong></span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <strong className="text-[#2D142C] dark:text-white tabular-nums">{story.rating}</strong>
                <span>({story.ratingsCount} reviews)</span>
              </span>
              <span>·</span>
              <span className="tabular-nums">{(story.totalReads).toLocaleString()} reads</span>
              <span>·</span>
              <span>Updated {story.updatedAt}</span>
            </div>

            {/* Synopsis */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-semibold tracking-wider uppercase text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                Synopsis
              </h3>
              <p className="font-reader text-sm sm:text-base text-[#2D142C]/85 dark:text-[#F9F6F0]/85 leading-relaxed">
                {story.synopsis}
              </p>
            </div>

            {/* Prologue Lore Callout */}
            <div className="p-4 rounded-lg bg-[#2D142C]/5 dark:bg-white/5 border border-[#2D142C]/10 dark:border-white/10 space-y-1.5">
              <div className="text-[11px] font-semibold text-[#C85A32] tracking-wider uppercase font-sans-ui">
                Fragment of Antiquity / World Lore
              </div>
              <p className="font-reader text-xs sm:text-sm text-[#2D142C]/80 dark:text-[#F9F6F0]/80 italic">
                "{story.prologueLore}"
              </p>
            </div>

            {/* Reading Progress Tracker if user has read this story */}
            {user.readingProgress[story.id] && (
              <div className="p-4 rounded-xl bg-[#C85A32]/10 border border-[#C85A32]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans-ui">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#C85A32] uppercase tracking-wider text-[10px]">
                      Your Reading Progress
                    </span>
                    <span className="font-mono font-bold text-[#C85A32]">
                      {user.readingProgress[story.id].progressPercent}% Completed
                    </span>
                  </div>
                  <p className="text-xs text-[#2D142C]/80 dark:text-white/80">
                    Currently reading Chapter {user.readingProgress[story.id].chapterNumber} &middot; Last updated {user.readingProgress[story.id].lastReadAt}
                  </p>
                  <div className="w-48 bg-[#2D142C]/15 dark:bg-white/15 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#C85A32] h-full rounded-full transition-all"
                      style={{ width: `${user.readingProgress[story.id].progressPercent}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => navigate('reader', { slug: story.slug, chapterNumber: user.readingProgress[story.id].chapterNumber })}
                  className="px-4 py-2 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs self-start sm:self-auto"
                >
                  Resume Ch. {user.readingProgress[story.id].chapterNumber} &rarr;
                </button>
              </div>
            )}

            {/* Primary Action Panel */}
            <div className="p-5 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {/* Left: Reading button */}
                <button
                  onClick={() => {
                    const chNum = user.readingProgress[story.id]?.chapterNumber || 1;
                    navigate('reader', { slug: story.slug, chapterNumber: chNum });
                  }}
                  className="px-6 py-3.5 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold tracking-wide rounded-lg flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>
                    {user.readingProgress[story.id] 
                      ? `Resume Reading (Ch. ${user.readingProgress[story.id].chapterNumber})` 
                      : 'Start Reading (Chapter 1 Free)'}
                  </span>
                </button>

                {/* Right: Unlock whole book or join subscription */}
                {!isUnlockedForUser ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openPaystackCheckout({
                        type: 'book_purchase',
                        title: `Book Unlock: ${story.title}`,
                        amountNgn: story.priceNgn,
                        storyId: story.id
                      })}
                      className="px-4 py-3 border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] text-xs font-medium text-[#2D142C] dark:text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#C85A32]" />
                      <span>Unlock Entire Omnibus for ₦{story.priceNgn.toLocaleString('en-NG')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-2 rounded-lg">
                    <Check className="w-4 h-4" />
                    <span>Unlocked on your Account</span>
                  </div>
                )}

              </div>

              <div className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>✓ Chapters 1 to {story.freeChaptersCount} are 100% Free</span>
                <span>·</span>
                <span>✓ Paystack Instant Settlement in Nigeria</span>
                <span>·</span>
                <span>✓ Distraction-Free Day/Sepia/Night Reader Canvas</span>
              </div>
            </div>

          </div>

        </div>

        {/* Chapter Index Section */}
        <section className="space-y-6 pt-6 border-t border-[#2D142C]/10 dark:border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
                Chapter Directory ({story.chapters.length})
              </h2>
              <p className="font-sans-ui text-xs text-[#2D142C]/60 dark:text-white/60 mt-0.5">
                Select any chapter to begin reading. Chapters 1–{story.freeChaptersCount} are open to everyone.
              </p>
            </div>

            {/* Quick Unlock info */}
            {!isUnlockedForUser && (
              <button
                onClick={() => navigate('pricing')}
                className="text-xs font-semibold text-[#C85A32] hover:underline cursor-pointer"
              >
                Or unlock all catalog stories with Patron Circle (₦3,500/mo) &rarr;
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 divide-y divide-[#2D142C]/10 dark:divide-white/10 bg-white dark:bg-[#1E111E] rounded-xl border border-[#2D142C]/10 dark:border-white/10 shadow-2xs overflow-hidden">
            {story.chapters.map((chapter) => {
              const hasAccess = hasAccessToChapter(story, chapter);

              return (
                <div
                  key={chapter.id}
                  onClick={() => navigate('reader', { slug: story.slug, chapterNumber: chapter.chapterNumber })}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-[#2D142C]/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                    <span className="text-xs font-mono font-bold text-[#2D142C]/40 dark:text-white/40 pt-0.5 shrink-0 tabular-nums">
                      {chapter.chapterNumber < 10 ? `0${chapter.chapterNumber}` : chapter.chapterNumber}
                    </span>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-display text-base sm:text-lg font-bold text-[#2D142C] dark:text-[#F9F6F0] group-hover:text-[#C85A32] transition-colors truncate">
                          {chapter.title}
                        </h4>
                        {chapter.audioUrl && (
                          <span title="Audio Narration Available" className="inline-flex items-center">
                            <Headphones className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                          </span>
                        )}
                      </div>

                      <p className="font-reader text-xs text-[#2D142C]/65 dark:text-white/65 line-clamp-1">
                        "{chapter.excerpt}"
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-[#2D142C]/50 dark:text-white/50 font-sans-ui">
                        <span>{chapter.releaseDate}</span>
                        <span>·</span>
                        <span>{chapter.wordCount.toLocaleString()} words</span>
                        <span>·</span>
                        <span>{chapter.readTimeMinutes} min read</span>
                      </div>
                    </div>
                  </div>

                  {/* Lock / Unlock Status, Reading Progress & Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Reading Progress Indicator */}
                    {user.readingProgress[story.id]?.chapterNumber === chapter.chapterNumber && (
                      <span className="text-[10px] font-bold text-[#C85A32] bg-[#C85A32]/10 border border-[#C85A32]/30 px-2 py-0.5 rounded font-sans-ui">
                        Reading ({user.readingProgress[story.id].progressPercent}%)
                      </span>
                    )}
                    {user.readingProgress[story.id] && user.readingProgress[story.id].chapterNumber > chapter.chapterNumber && (
                      <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded font-sans-ui">
                        Read ✓
                      </span>
                    )}

                    {hasAccess ? (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Unlock className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{chapter.isFree ? 'Free' : 'Unlocked'}</span>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[#C85A32] flex items-center gap-1 bg-[#C85A32]/10 px-2.5 py-1 rounded">
                        <Lock className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Patron Locked</span>
                      </span>
                    )}

                    <ChevronRight className="w-4 h-4 text-[#2D142C]/30 dark:text-white/30 group-hover:text-[#C85A32] transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
};
