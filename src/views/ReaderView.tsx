import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Settings2, 
  Sun, 
  Moon, 
  BookMarked, 
  Headphones, 
  Volume2, 
  VolumeX, 
  Lock, 
  ShieldCheck, 
  Share2, 
  Maximize2, 
  Minimize2,
  Sparkles,
  CheckCircle2,
  Bookmark,
  Flame
} from 'lucide-react';
import { ReaderTheme, ReaderFont } from '../types';

export const ReaderView: React.FC = () => {
  const { 
    routeParams, 
    getChapter, 
    navigate, 
    readerSettings, 
    updateReaderSettings, 
    hasAccessToChapter,
    openPaystackCheckout,
    recordReadingProgress,
    toggleBookmark,
    user,
    logChapterCompleted
  } = useApp();

  const [scrollProgress, setScrollProgress] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [goalLogged, setGoalLogged] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const chapterData = getChapter(routeParams.slug || '', routeParams.chapterNumber || 1);

  // Scroll depth tracking
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const current = (window.scrollY / totalHeight) * 100;
        const bounded = Math.min(100, Math.max(0, current));
        setScrollProgress(bounded);

        if (chapterData) {
          recordReadingProgress(
            chapterData.story.id,
            chapterData.chapter.id,
            chapterData.chapter.chapterNumber,
            Math.round(bounded)
          );
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [chapterData]);

  // Reset goalLogged when chapter changes
  useEffect(() => {
    setGoalLogged(false);
  }, [chapterData?.chapter.id]);

  if (!chapterData) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-24 text-center">
        <h2 className="font-display text-2xl font-bold mb-3">Chapter Not Found</h2>
        <button
          onClick={() => navigate('stories')}
          className="text-xs font-semibold text-[#C85A32] underline cursor-pointer"
        >
          Return to Story Library
        </button>
      </div>
    );
  }

  const { story, chapter } = chapterData;
  const isAccessible = hasAccessToChapter(story, chapter);
  const isBookmarked = user.bookmarkedChapterIds.includes(chapter.id);

  // Background colors corresponding to blueprint:
  // Day: Alabaster Cream (#F9F6F0)
  // Sepia: Warm Sand / Alabaster (#F5EFEB)
  // Night: Smoked Plum (#160C16)
  const themeStyles = {
    day: {
      canvas: 'bg-[#F9F6F0] text-[#2D142C]',
      bar: 'bg-[#F9F6F0]/90 border-[#2D142C]/10 text-[#2D142C]',
      panel: 'bg-white border-[#2D142C]/15 text-[#2D142C] shadow-lg',
      subtle: 'text-[#2D142C]/65',
      accent: 'text-[#C85A32]'
    },
    sepia: {
      canvas: 'bg-[#F4ECE1] text-[#2C1E18]',
      bar: 'bg-[#F4ECE1]/90 border-[#2C1E18]/10 text-[#2C1E18]',
      panel: 'bg-[#EDE3D5] border-[#2C1E18]/15 text-[#2C1E18] shadow-lg',
      subtle: 'text-[#2C1E18]/65',
      accent: 'text-[#B84E27]'
    },
    night: {
      canvas: 'bg-[#160C16] text-[#F9F6F0]',
      bar: 'bg-[#160C16]/90 border-white/10 text-[#F9F6F0]',
      panel: 'bg-[#231323] border-white/15 text-[#F9F6F0] shadow-lg',
      subtle: 'text-white/65',
      accent: 'text-[#C85A32]'
    }
  }[readerSettings.theme];

  // Font family styles
  const fontClass = {
    literata: 'font-reader',
    garamond: 'font-display',
    sans: 'font-sans-ui'
  }[readerSettings.font];

  // Container width
  const widthClass = {
    compact: 'max-w-xl',
    standard: 'max-w-2xl',
    wide: 'max-w-3xl'
  }[readerSettings.readingWidth];

  const prevChapter = story.chapters.find(c => c.chapterNumber === chapter.chapterNumber - 1);
  const nextChapter = story.chapters.find(c => c.chapterNumber === chapter.chapterNumber + 1);

  return (
    <div className={`min-h-screen ${themeStyles.canvas} transition-colors duration-200 selection:bg-[#C85A32]/25`}>
      
      {/* Top Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-[#2D142C]/10 dark:bg-white/10">
        <div 
          className="h-full bg-[#C85A32] transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Reader Floating Header Toolbar */}
      <header className={`sticky top-1 z-40 w-full backdrop-blur-md border-b ${themeStyles.bar} transition-colors px-4 py-2.5`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 text-xs font-sans-ui">
          
          {/* Left: Back to Overview */}
          <button
            onClick={() => navigate('story-detail', { slug: story.slug })}
            className="flex items-center gap-1.5 hover:text-[#C85A32] transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Exit</span>
          </button>

          {/* Center: Story, Chapter & Reading Progress percentage */}
          <div className="flex items-center gap-3 text-center truncate px-2">
            <span className="font-semibold truncate max-w-[160px] sm:max-w-xs">{story.title}</span>
            <span className="opacity-40">&middot;</span>
            <span className="opacity-80 whitespace-nowrap">Ch. {chapter.chapterNumber}</span>
            <span className="opacity-40 hidden sm:inline">&middot;</span>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-16 bg-current/15 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#C85A32] h-full rounded-full transition-all duration-150"
                  style={{ width: `${scrollProgress}%` }}
                />
              </div>
              <span className="font-mono text-[11px] font-bold text-[#C85A32] tabular-nums">
                {Math.round(scrollProgress)}%
              </span>
              <span className="text-[10px] opacity-60">
                ({Math.max(1, Math.round(chapter.readTimeMinutes * (1 - scrollProgress / 100)))}m left)
              </span>
            </div>
          </div>

          {/* Right: Quick Theme Toggles (Day / Sepia / Night) & Settings */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick 1-Click Theme Toggles */}
            <div className="flex items-center bg-current/5 p-0.5 rounded-lg border border-current/15 text-[11px]">
              <button
                type="button"
                onClick={() => updateReaderSettings({ theme: 'day' })}
                title="Day Theme (Alabaster Cream)"
                className={`px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                  readerSettings.theme === 'day'
                    ? 'bg-white text-[#2D142C] shadow-xs font-semibold'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <Sun className="w-3 h-3" />
                <span className="hidden md:inline">Day</span>
              </button>
              <button
                type="button"
                onClick={() => updateReaderSettings({ theme: 'sepia' })}
                title="Sepia Theme (Warm Sand Parchment)"
                className={`px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                  readerSettings.theme === 'sepia'
                    ? 'bg-[#EDE3D5] text-[#2C1E18] shadow-xs font-semibold'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <span>Sepia</span>
              </button>
              <button
                type="button"
                onClick={() => updateReaderSettings({ theme: 'night' })}
                title="Night Theme (Smoked Plum)"
                className={`px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                  readerSettings.theme === 'night'
                    ? 'bg-[#231323] text-white shadow-xs font-semibold'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <Moon className="w-3 h-3" />
                <span className="hidden md:inline">Night</span>
              </button>
            </div>

            {/* Bookmark */}
            <button
              onClick={() => toggleBookmark(chapter.id)}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isBookmarked ? 'text-[#C85A32]' : 'opacity-70 hover:opacity-100'
              }`}
              title={isBookmarked ? 'Bookmarked' : 'Add Bookmark'}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>

            {/* Ambient Audio Toggle */}
            <button
              onClick={() => {
                setAudioPlaying(!audioPlaying);
                updateReaderSettings({ ambientSound: !audioPlaying });
              }}
              className={`hidden sm:flex items-center gap-1 p-1.5 rounded transition-colors cursor-pointer ${
                audioPlaying ? 'text-[#C85A32] bg-[#C85A32]/10 font-medium' : 'opacity-70 hover:opacity-100'
              }`}
              title="Ambient Narration Soundscape"
            >
              <Headphones className="w-4 h-4" />
              <span className="hidden lg:inline">{audioPlaying ? 'Audio Active' : 'Soundscape'}</span>
            </button>

            {/* Font & Layout Settings Toggle */}
            <button
              onClick={() => setControlsOpen(!controlsOpen)}
              className="p-1.5 rounded opacity-80 hover:opacity-100 hover:text-[#C85A32] transition-colors cursor-pointer flex items-center gap-1"
              title="Typography & Sizing"
            >
              <Settings2 className="w-4 h-4" />
              <span className="font-serif">Aa</span>
            </button>
          </div>

        </div>

        {/* Reading Settings Dropdown Drawer */}
        {controlsOpen && (
          <div className="max-w-md mx-auto mt-2 p-4 rounded-xl border transition-all text-xs space-y-4 shadow-xl bg-white dark:bg-[#1E111E] border-slate-300 dark:border-white/20 text-slate-800 dark:text-slate-100">
            
            {/* Canvas Theme */}
            <div className="space-y-1.5">
              <span className="font-semibold block opacity-75">Reading Canvas Theme</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ theme: 'day' })}
                  className={`py-2 px-3 rounded-lg border text-center font-medium cursor-pointer transition-all ${
                    readerSettings.theme === 'day'
                      ? 'border-[#C85A32] ring-1 ring-[#C85A32] bg-[#F9F6F0] text-[#2D142C]'
                      : 'border-slate-200 dark:border-white/10 bg-[#F9F6F0] text-[#2D142C]'
                  }`}
                >
                  Alabaster (Day)
                </button>
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ theme: 'sepia' })}
                  className={`py-2 px-3 rounded-lg border text-center font-medium cursor-pointer transition-all ${
                    readerSettings.theme === 'sepia'
                      ? 'border-[#C85A32] ring-1 ring-[#C85A32] bg-[#F4ECE1] text-[#2C1E18]'
                      : 'border-slate-200 dark:border-white/10 bg-[#F4ECE1] text-[#2C1E18]'
                  }`}
                >
                  Warm Sand (Sepia)
                </button>
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ theme: 'night' })}
                  className={`py-2 px-3 rounded-lg border text-center font-medium cursor-pointer transition-all ${
                    readerSettings.theme === 'night'
                      ? 'border-[#C85A32] ring-1 ring-[#C85A32] bg-[#160C16] text-[#F9F6F0]'
                      : 'border-slate-200 dark:border-white/10 bg-[#160C16] text-[#F9F6F0]'
                  }`}
                >
                  Smoked Plum (Night)
                </button>
              </div>
            </div>

            {/* Font Family */}
            <div className="space-y-1.5">
              <span className="font-semibold block opacity-75">Typography Style</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ font: 'literata' })}
                  className={`py-2 px-2 rounded-lg border text-center font-reader cursor-pointer transition-all ${
                    readerSettings.font === 'literata'
                      ? 'border-[#C85A32] ring-1 ring-[#C85A32] font-semibold'
                      : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  Literata
                </button>
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ font: 'garamond' })}
                  className={`py-2 px-2 rounded-lg border text-center font-display cursor-pointer transition-all ${
                    readerSettings.font === 'garamond'
                      ? 'border-[#C85A32] ring-1 ring-[#C85A32] font-semibold'
                      : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  Cormorant
                </button>
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ font: 'sans' })}
                  className={`py-2 px-2 rounded-lg border text-center font-sans-ui cursor-pointer transition-all ${
                    readerSettings.font === 'sans'
                      ? 'border-[#C85A32] ring-1 ring-[#C85A32] font-semibold'
                      : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  Jakarta Sans
                </button>
              </div>
            </div>

            {/* Font Size & Measure */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <span className="font-semibold block opacity-75">
                  Font Size ({readerSettings.fontSize}px)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateReaderSettings({ fontSize: Math.max(14, readerSettings.fontSize - 1) })}
                    className="flex-1 py-1 px-2 border rounded font-semibold cursor-pointer hover:border-[#C85A32]"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() => updateReaderSettings({ fontSize: Math.min(24, readerSettings.fontSize + 1) })}
                    className="flex-1 py-1 px-2 border rounded font-semibold cursor-pointer hover:border-[#C85A32]"
                  >
                    A+
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-semibold block opacity-75">Reading Width</span>
                <div className="flex items-center gap-1">
                  {(['compact', 'standard', 'wide'] as const).map(w => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => updateReaderSettings({ readingWidth: w })}
                      className={`flex-1 py-1 px-1 rounded border text-[11px] capitalize cursor-pointer ${
                        readerSettings.readingWidth === w
                          ? 'border-[#C85A32] font-semibold'
                          : 'border-slate-200 dark:border-white/10'
                      }`}
                    >
                      {w === 'compact' ? '60ch' : w === 'standard' ? '75ch' : '90ch'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setControlsOpen(false)}
                className="text-xs text-[#C85A32] font-semibold hover:underline cursor-pointer"
              >
                Close Settings &times;
              </button>
            </div>
          </div>
        )}

        {/* Ambient Sound Player Floating Indicator */}
        {audioPlaying && (
          <div className="max-w-sm mx-auto mt-2 px-3 py-2 rounded-lg bg-[#2D142C] text-white text-xs flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#C85A32] animate-ping" />
              <span>Ambient Soundscape: Royal Library Hearth Fire</span>
            </div>
            <button
              onClick={() => setAudioPlaying(false)}
              className="text-white/60 hover:text-white cursor-pointer ml-3 text-[11px]"
            >
              Mute
            </button>
          </div>
        )}
      </header>

      {/* Main Chapter Canvas */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <article className={`${widthClass} mx-auto space-y-10`}>
          
          {/* Chapter Metadata & Editorial Lockup */}
          <div className="text-center space-y-4 pb-8 border-b border-current/10">
            <div className="text-xs tracking-[0.25em] uppercase text-[#C85A32] font-semibold font-sans-ui">
              Chapter {chapter.chapterNumber} &middot; {chapter.wordCount.toLocaleString()} Words
            </div>
            
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
              {chapter.title}
            </h1>

            <div className="text-xs font-sans-ui opacity-60 flex items-center justify-center gap-3">
              <span>By {story.author}</span>
              <span>&middot;</span>
              <span>{chapter.readTimeMinutes} min read</span>
              <span>&middot;</span>
              <span>{chapter.releaseDate}</span>
            </div>
          </div>

          {/* Chapter Body or Inline Paywall */}
          {isAccessible ? (
            <div 
              className={`${fontClass} space-y-6 leading-relaxed`}
              style={{ fontSize: `${readerSettings.fontSize}px` }}
            >
              {chapter.content.map((paragraph, index) => (
                <p 
                  key={index} 
                  className={index === 0 ? 'first-letter:text-5xl first-letter:font-display first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:text-[#C85A32]' : ''}
                >
                  {paragraph}
                </p>
              ))}

              {/* End of Chapter Mark & Reading Goal Card */}
              <div className="py-10 text-center space-y-6">
                <div className="inline-flex items-center gap-2 opacity-40 font-display text-sm tracking-widest uppercase">
                  <span>&bull;</span>
                  <span>End of Chapter {chapter.chapterNumber}</span>
                  <span>&bull;</span>
                </div>

                {/* Reading Goal Progress Card */}
                <div className="p-6 rounded-2xl bg-white/70 dark:bg-[#1E111E]/70 border border-[#C85A32]/30 shadow-md backdrop-blur-xs flex flex-col sm:flex-row items-center justify-between gap-5 text-left">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#C85A32]/15 border border-[#C85A32]/30 flex items-center justify-center shrink-0 text-2xl">
                      🔥
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase font-mono font-bold text-[#C85A32] tracking-wider">
                          Reading Goal
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#C85A32]/10 text-[#C85A32] font-semibold">
                          {user.readingGoal.streakDays}-Day Streak
                        </span>
                      </div>
                      <div className="font-display text-lg font-bold mt-0.5">
                        {goalLogged
                          ? `Progress Recorded! (${user.readingGoal.currentProgress}/${user.readingGoal.targetChapters} Chapters Read)`
                          : `Finished Chapter ${chapter.chapterNumber}?`}
                      </div>
                      <p className="text-xs opacity-70 font-sans-ui mt-0.5">
                        {goalLogged
                          ? 'Your reading streak has been preserved. Keep the fire burning!'
                          : `Log this chapter towards your ${user.readingGoal.frequency} target of ${user.readingGoal.targetChapters} chapters.`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!goalLogged) {
                        logChapterCompleted();
                        setGoalLogged(true);
                      }
                    }}
                    disabled={goalLogged}
                    className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-xs ${
                      goalLogged
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-[#C85A32] hover:bg-[#b04d28] text-white'
                    }`}
                  >
                    {goalLogged ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Target Progress Logged!</span>
                      </>
                    ) : (
                      <>
                        <Flame className="w-4 h-4" />
                        <span>Log to Reading Goal 🔥</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Inline Paywall Container */
            <div className="space-y-8">
              {/* Blurred preview excerpt */}
              <div 
                className={`${fontClass} space-y-6 leading-relaxed select-none relative`}
                style={{ fontSize: `${readerSettings.fontSize}px` }}
              >
                <p className="first-letter:text-5xl first-letter:font-display first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:text-[#C85A32]">
                  {chapter.excerpt}
                </p>
                <p className="blur-[5px] opacity-60 pointer-events-none">
                  {chapter.content[0] || 'Beyond the outer courtyard, the shadow lengthened across the ancient marble stairs...'}
                </p>
                <p className="blur-[7px] opacity-40 pointer-events-none">
                  The voices of the elders echoed down the vaulted ceiling, warning of pacts signed in the blood of stars...
                </p>
                
                {/* Gradient Fade */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-current/5 to-current/20 pointer-events-none" />
              </div>

              {/* Paywall Callout Box */}
              <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#C85A32]/40 shadow-2xl text-center space-y-5 text-slate-900 dark:text-white">
                <div className="w-12 h-12 bg-[#C85A32]/10 text-[#C85A32] rounded-full flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>

                <div className="space-y-2 max-w-lg mx-auto">
                  <h3 className="font-display text-2xl sm:text-3xl font-bold">
                    This Chapter is Reserved for Lorethos Patrons
                  </h3>
                  <p className="font-reader text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Chapters 1–{story.freeChaptersCount} are complimentary. Unlock Chapter {chapter.chapterNumber} and the entire ongoing catalog with a monthly patron membership, or purchase this single story.
                  </p>
                </div>

                {/* Checkout CTA Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto pt-2">
                  <button
                    onClick={() => openPaystackCheckout({
                      type: 'subscription',
                      title: 'Patron Monthly Circle (Full Catalog Access)',
                      amountNgn: 3500,
                      planId: 'monthly'
                    })}
                    className="py-3.5 px-4 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold text-xs tracking-wide rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Join Patron Circle (₦3,500/mo)</span>
                  </button>

                  <button
                    onClick={() => openPaystackCheckout({
                      type: 'book_purchase',
                      title: `Book Unlock: ${story.title}`,
                      amountNgn: story.priceNgn,
                      storyId: story.id
                    })}
                    className="py-3.5 px-4 border border-slate-300 dark:border-white/20 hover:border-[#C85A32] text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Unlock Story (₦{story.priceNgn.toLocaleString('en-NG')} Once)</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-sans-ui flex items-center justify-center gap-2 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Instant Paystack Checkout: Debit Cards, Bank Transfer & USSD in Nigeria</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Between Chapters */}
          <div className="pt-10 border-t border-current/10 flex items-center justify-between gap-4 font-sans-ui text-xs">
            {prevChapter ? (
              <button
                onClick={() => navigate('reader', { slug: story.slug, chapterNumber: prevChapter.chapterNumber })}
                className="py-2.5 px-4 rounded border border-current/20 hover:border-[#C85A32] flex items-center gap-2 hover:text-[#C85A32] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Ch. {prevChapter.chapterNumber}: {prevChapter.title}</span>
                <span className="sm:hidden">Prev Ch.</span>
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={() => navigate('story-detail', { slug: story.slug })}
              className="py-2.5 px-4 text-center font-medium opacity-80 hover:opacity-100 hover:text-[#C85A32] transition-colors cursor-pointer"
            >
              Table of Contents
            </button>

            {nextChapter ? (
              <button
                onClick={() => navigate('reader', { slug: story.slug, chapterNumber: nextChapter.chapterNumber })}
                className="py-2.5 px-4 rounded bg-[#C85A32] text-white hover:bg-[#b04d28] flex items-center gap-2 transition-colors cursor-pointer font-semibold shadow-xs"
              >
                <span className="hidden sm:inline">Ch. {nextChapter.chapterNumber}: {nextChapter.title}</span>
                <span className="sm:hidden">Next Ch.</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => navigate('stories')}
                className="py-2.5 px-4 rounded border border-current/20 hover:border-[#C85A32] text-xs font-semibold cursor-pointer"
              >
                More Stories &rarr;
              </button>
            )}
          </div>

        </article>
      </main>

      {/* Floating Bottom Reading Progress Capsule */}
      <div className="fixed bottom-6 right-6 z-30 hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-full bg-[#2D142C]/90 text-white dark:bg-white/95 dark:text-[#160C16] shadow-xl backdrop-blur-md border border-white/10 dark:border-black/10 text-xs font-sans-ui transition-all animate-in fade-in">
        <div className="relative w-5 h-5 flex items-center justify-center">
          <svg className="w-5 h-5 -rotate-90">
            <circle
              cx="10"
              cy="10"
              r="8"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="transparent"
              className="opacity-20"
            />
            <circle
              cx="10"
              cy="10"
              r="8"
              stroke="#C85A32"
              strokeWidth="2.5"
              fill="transparent"
              strokeDasharray={50.2}
              strokeDashoffset={50.2 - (50.2 * scrollProgress) / 100}
              strokeLinecap="round"
              className="transition-all duration-150"
            />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-[#C85A32] tabular-nums">
            {Math.round(scrollProgress)}%
          </span>
          <span className="opacity-50">&middot;</span>
          <span className="text-[11px] opacity-80">
            Ch. {chapter.chapterNumber} of {story.totalChapters}
          </span>
        </div>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="text-[10px] uppercase font-bold text-[#C85A32] hover:underline ml-1 cursor-pointer"
        >
          Top ↑
        </button>
      </div>

    </div>
  );
};
