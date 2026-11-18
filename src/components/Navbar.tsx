import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getDisplayName, computeReaderRank } from '../utils/readerProfile';
import { BookOpen, User, Sun, Moon, BookmarkCheck, Menu, X, ShieldCheck, Search, ArrowRight, Film, Award } from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    currentRoute,
    navigate,
    buildHref,
    user,
    isAuthenticated,
    readerSettings,
    setTheme,
    activeProgress,
    stories
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const desktopSearchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const t = window.setTimeout(() => firstMobileLinkRef.current?.focus(), 10);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        mobileToggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (desktopSearchRef.current && !desktopSearchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return stories.filter((story) => {
      return (
        story.title.toLowerCase().includes(q) ||
        story.subtitle.toLowerCase().includes(q) ||
        story.author.toLowerCase().includes(q) ||
        story.genre.toLowerCase().includes(q) ||
        story.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [stories, searchQuery]);

  if (currentRoute === 'reader') {
    return null;
  }

  const isPatron = isAuthenticated && user.subscription.status === 'active';
  const isOwner = isAuthenticated && user.role === 'owner';
  const displayName = getDisplayName(user);
  const rank = useMemo(() => computeReaderRank(user, stories), [user, stories]);
  const trimmedSearch = searchQuery.trim();
  const showDropdown = searchFocused && trimmedSearch.length > 0;

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    route: string,
    params?: Parameters<typeof navigate>[1]
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setMobileMenuOpen(false);
    setSearchFocused(false);
    navigate(route, params);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchFocused(false);
    setMobileMenuOpen(false);
    navigate('stories', trimmedSearch ? { q: trimmedSearch } : undefined);
  };

  const handleOpenMobileSearch = () => {
    setMobileMenuOpen(true);
    window.setTimeout(() => {
      mobileSearchInputRef.current?.focus();
    }, 30);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#F9F6F0]/95 dark:bg-[#160C16]/95 sepia:bg-[#F4ECE1]/95 backdrop-blur-md border-b border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/15 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3 xl:gap-4">

        {/* Zone 1: Brand Lockup */}
        <a
          href={buildHref('home')}
          onClick={(e) => handleNavClick(e, 'home')}
          className="flex items-center gap-3 text-left group whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] rounded-lg"
        >
          <img
            src="/assets/aistudio/1A2959EF-E3CD-42F2-B9E5-21E771900F65_0f8daa7f.png"
            alt="Lorethos Monogram"
            className="w-10 h-10 object-contain rounded-full shadow-xs border border-[#C85A32]/40 group-hover:scale-105 transition-transform duration-200"
          />
          <div className="flex flex-col">
            <span className="font-display text-2xl font-semibold tracking-[0.22em] uppercase text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] leading-none">
              LORETHOS
            </span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-[#C85A32] font-medium mt-1">
              Digital Storytelling
            </span>
          </div>
        </a>

        {/* Zone 2: Primary Nav Links */}
        <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-5 xl:gap-6 text-sm font-medium shrink-0">
          <a
            href={buildHref('stories')}
            onClick={(e) => handleNavClick(e, 'stories')}
            aria-current={currentRoute === 'stories' ? 'page' : undefined}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              currentRoute === 'stories'
                ? 'text-[#C85A32] font-semibold'
                : 'text-[#2D142C]/80 dark:text-[#F9F6F0]/80 sepia:text-[#2C1E18]/80 hover:text-[#C85A32]'
            }`}
          >
            Library
          </a>

          <a
            href={buildHref('pricing')}
            onClick={(e) => handleNavClick(e, 'pricing')}
            aria-current={currentRoute === 'pricing' ? 'page' : undefined}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              currentRoute === 'pricing'
                ? 'text-[#C85A32] font-semibold'
                : 'text-[#2D142C]/80 dark:text-[#F9F6F0]/80 sepia:text-[#2C1E18]/80 hover:text-[#C85A32]'
            }`}
          >
            Membership
          </a>

          <a
            href={buildHref('studio')}
            onClick={(e) => handleNavClick(e, 'studio')}
            aria-current={currentRoute === 'studio' ? 'page' : undefined}
            className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              currentRoute === 'studio'
                ? 'text-[#C85A32] font-semibold'
                : 'text-[#2D142C]/80 dark:text-[#F9F6F0]/80 sepia:text-[#2C1E18]/80 hover:text-[#C85A32]'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Video Studio</span>
          </a>

          <a
            href={buildHref('contact')}
            onClick={(e) => handleNavClick(e, 'contact')}
            aria-current={currentRoute === 'contact' ? 'page' : undefined}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              currentRoute === 'contact'
                ? 'text-[#C85A32] font-semibold'
                : 'text-[#2D142C]/80 dark:text-[#F9F6F0]/80 sepia:text-[#2C1E18]/80 hover:text-[#C85A32]'
            }`}
          >
            Contact
          </a>

          {isOwner && (
            <a
              href={buildHref('admin')}
              onClick={(e) => handleNavClick(e, 'admin')}
              aria-current={currentRoute === 'admin' ? 'page' : undefined}
              className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                currentRoute === 'admin'
                  ? 'text-[#C85A32] font-semibold'
                  : 'text-[#2D142C]/75 dark:text-[#F9F6F0]/75 sepia:text-[#2C1E18]/75 hover:text-[#C85A32]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#C85A32]" />
              <span>Publishing Desk</span>
            </a>
          )}
        </nav>

        {/* Global Search Bar (Tablet & Desktop) */}
        <div ref={desktopSearchRef} className="relative hidden md:block flex-1 max-w-xs lg:max-w-[240px] xl:max-w-[270px]">
          <form onSubmit={handleSearchSubmit} role="search" aria-label="Global story search">
            <label htmlFor="global-navbar-search" className="sr-only">
              Search stories by title, author, or genre
            </label>
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#2D142C]/45 dark:text-white/45 sepia:text-[#2C1E18]/45 pointer-events-none" />
            <input
              id="global-navbar-search"
              type="search"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchFocused(false);
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchFocused(true);
              }}
              placeholder="Search title, author, genre..."
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-[#2D142C]/15 dark:border-white/15 sepia:border-[#2C1E18]/20 bg-white/75 dark:bg-white/5 sepia:bg-white/60 focus:outline-none focus:border-[#C85A32] text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] placeholder:text-[#2D142C]/45 dark:placeholder:text-white/45 font-sans-ui transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear global search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#2D142C]/50 dark:text-white/50 hover:text-[#C85A32] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </form>

          {showDropdown && (
            <div className="absolute left-0 right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-[#2D142C]/15 dark:border-white/15 bg-[#F9F6F0] dark:bg-[#1E111E] sepia:bg-[#F4ECE1] text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] shadow-2xl overflow-hidden z-50">
              {searchResults.length === 0 ? (
                <div className="p-4 text-xs font-sans-ui opacity-70 text-center">
                  No stories matching &ldquo;{trimmedSearch}&rdquo;.
                </div>
              ) : (
                <div className="divide-y divide-[#2D142C]/10 dark:divide-white/10 max-h-80 overflow-y-auto">
                  {searchResults.slice(0, 5).map((story) => (
                    <a
                      key={story.id}
                      href={buildHref('story-detail', { slug: story.slug })}
                      onClick={(e) => handleNavClick(e, 'story-detail', { slug: story.slug })}
                      className="flex items-center gap-3 p-3 hover:bg-[#C85A32]/10 transition-colors"
                    >
                      <img
                        src={story.coverImage}
                        alt=""
                        className="w-9 h-12 object-cover rounded border border-current/10 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-[#C85A32] font-sans-ui">
                          {story.genre}
                        </div>
                        <div className="font-display text-sm font-bold truncate">
                          {story.title}
                        </div>
                        <div className="text-[11px] opacity-70 font-sans-ui truncate">
                          By {story.author} &middot; {story.chapters.length} chs
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
              <a
                href={buildHref('stories', { q: trimmedSearch })}
                onClick={(e) => handleNavClick(e, 'stories', { q: trimmedSearch })}
                className="flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-[#C85A32] bg-[#2D142C]/[0.04] dark:bg-white/[0.04] hover:bg-[#C85A32]/15 border-t border-[#2D142C]/10 dark:border-white/10 transition-colors font-sans-ui"
              >
                <span>
                  {searchResults.length > 0
                    ? `View all ${searchResults.length} matches in Library`
                    : 'Search in Library'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Zone 3: Reading Progress, Theme Toggles & Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {activeProgress && (
            <a
              href={buildHref('reader', {
                slug: activeProgress.story.slug,
                chapterNumber: activeProgress.chapterNumber
              })}
              onClick={(e) =>
                handleNavClick(e, 'reader', {
                  slug: activeProgress.story.slug,
                  chapterNumber: activeProgress.chapterNumber
                })
              }
              className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#C85A32]/30 bg-[#C85A32]/5 hover:bg-[#C85A32]/10 transition-colors text-xs group"
              title={`Resume reading: ${activeProgress.story.title}`}
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-[#C85A32]" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-[#C85A32] font-semibold uppercase tracking-wider">
                  Resume
                </span>
                <span className="text-xs font-medium text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] truncate max-w-[120px]">
                  {activeProgress.story.title} &middot; Ch {activeProgress.chapterNumber}
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#C85A32] font-bold tabular-nums">
                {activeProgress.progressPercent}%
              </span>
            </a>
          )}

          {/* Mobile Search Quick Button */}
          <button
            type="button"
            onClick={handleOpenMobileSearch}
            aria-label="Search stories"
            className="md:hidden p-2 rounded-lg border border-[#2D142C]/15 dark:border-white/15 text-[#2D142C] dark:text-[#F9F6F0] hover:border-[#C85A32] cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Theme Toggles */}
          <div
            role="group"
            aria-label="Color theme"
            className="hidden sm:flex items-center bg-[#2D142C]/5 dark:bg-white/5 sepia:bg-[#2C1E18]/10 p-0.5 rounded-lg border border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/15 text-xs font-sans-ui"
          >
            <button
              type="button"
              onClick={() => setTheme('day')}
              aria-label="Day theme"
              aria-pressed={readerSettings.theme === 'day'}
              className={`p-1.5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                readerSettings.theme === 'day'
                  ? 'bg-white text-[#2D142C] shadow-xs font-semibold'
                  : 'text-[#2D142C]/60 hover:text-[#2D142C]'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('sepia')}
              aria-label="Sepia theme"
              aria-pressed={readerSettings.theme === 'sepia'}
              className={`p-1.5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                readerSettings.theme === 'sepia'
                  ? 'bg-[#EDE3D5] text-[#2C1E18] shadow-xs font-semibold'
                  : 'text-[#2C1E18]/60 hover:text-[#2C1E18]'
              }`}
            >
              <span className="text-[11px] font-bold leading-none px-0.5">Sepia</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('night')}
              aria-label="Night theme"
              aria-pressed={readerSettings.theme === 'night'}
              className={`p-1.5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                readerSettings.theme === 'night'
                  ? 'bg-[#231323] text-white shadow-xs font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Account / Sign In Link */}
          <a
            href={buildHref(
              'account',
              !isAuthenticated && currentRoute !== 'home' && currentRoute !== 'account' && typeof window !== 'undefined'
                ? { redirect: `${window.location.pathname}${window.location.search}` }
                : undefined
            )}
            onClick={(e) =>
              handleNavClick(
                e,
                'account',
                !isAuthenticated && currentRoute !== 'home' && currentRoute !== 'account' && typeof window !== 'undefined'
                  ? { redirect: `${window.location.pathname}${window.location.search}` }
                  : undefined
              )
            }
            aria-current={currentRoute === 'account' ? 'page' : undefined}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap border ${
              currentRoute === 'account'
                ? 'bg-[#2D142C] text-[#F9F6F0] border-[#2D142C] dark:bg-white dark:text-[#160C16]'
                : 'border-[#2D142C]/20 dark:border-white/20 sepia:border-[#2C1E18]/20 text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] hover:bg-[#2D142C]/5 dark:hover:bg-white/5'
            }`}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline max-w-[115px] truncate">
              {!isAuthenticated ? 'Sign In' : displayName}
            </span>
            {isAuthenticated && (
              <span
                title={`${rank.title} (${rank.completedChapters} chapters completed)`}
                className={`hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  currentRoute === 'account'
                    ? 'bg-[#C85A32] text-white'
                    : isPatron
                    ? 'bg-[#C85A32]/15 text-[#C85A32]'
                    : 'bg-current/10 opacity-85'
                }`}
              >
                <Award className="w-2.5 h-2.5" />
                <span>{rank.roman}</span>
              </span>
            )}
          </a>

          {/* Primary CTA */}
          <a
            href={buildHref('stories')}
            onClick={(e) => handleNavClick(e, 'stories')}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#C85A32] hover:bg-[#b04d28] rounded shadow-xs hover:shadow transition-all duration-150 whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read Stories</span>
          </a>

          {/* Mobile Drawer Trigger */}
          <button
            ref={mobileToggleRef}
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="lg:hidden p-2 rounded-lg border border-[#2D142C]/15 dark:border-white/15 text-[#2D142C] dark:text-[#F9F6F0] hover:border-[#C85A32] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          className="lg:hidden border-t border-[#2D142C]/10 dark:border-white/10 bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] px-4 py-5 space-y-4 font-sans-ui text-sm"
        >
          {/* Mobile Global Search */}
          <form onSubmit={handleSearchSubmit} role="search" className="relative">
            <label htmlFor="mobile-navbar-search" className="sr-only">
              Search stories by title, author, or genre
            </label>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
            <input
              ref={mobileSearchInputRef}
              id="mobile-navbar-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, author, or genre..."
              className="w-full pl-9 pr-16 py-2.5 text-xs rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-white/80 dark:bg-white/5 focus:outline-none focus:border-[#C85A32]"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-semibold bg-[#C85A32] text-white rounded cursor-pointer"
            >
              Go
            </button>
          </form>

          {trimmedSearch.length > 0 && (
            <div className="rounded-lg border border-[#2D142C]/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] divide-y divide-[#2D142C]/10 dark:divide-white/10">
              {searchResults.slice(0, 4).map((story) => (
                <a
                  key={story.id}
                  href={buildHref('story-detail', { slug: story.slug })}
                  onClick={(e) => handleNavClick(e, 'story-detail', { slug: story.slug })}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-[#C85A32]/10"
                >
                  <div className="min-w-0">
                    <div className="font-display font-bold truncate">{story.title}</div>
                    <div className="text-[11px] opacity-70 truncate">
                      {story.author} &middot; {story.genre}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                </a>
              ))}
              {searchResults.length === 0 && (
                <div className="px-3 py-2 text-xs opacity-65">No stories matching &ldquo;{trimmedSearch}&rdquo;.</div>
              )}
            </div>
          )}

          <nav aria-label="Mobile navigation" className="flex flex-col space-y-2">
            <a
              ref={firstMobileLinkRef}
              href={buildHref('stories')}
              onClick={(e) => handleNavClick(e, 'stories')}
              className={`px-3 py-2.5 rounded-lg font-medium ${
                currentRoute === 'stories' ? 'bg-[#C85A32]/15 text-[#C85A32] font-semibold' : ''
              }`}
            >
              Library
            </a>
            <a
              href={buildHref('pricing')}
              onClick={(e) => handleNavClick(e, 'pricing')}
              className={`px-3 py-2.5 rounded-lg font-medium ${
                currentRoute === 'pricing' ? 'bg-[#C85A32]/15 text-[#C85A32] font-semibold' : ''
              }`}
            >
              Membership &amp; Pricing
            </a>
            <a
              href={buildHref('studio')}
              onClick={(e) => handleNavClick(e, 'studio')}
              className={`px-3 py-2.5 rounded-lg font-medium flex items-center gap-2 ${
                currentRoute === 'studio' ? 'bg-[#C85A32]/15 text-[#C85A32] font-semibold' : ''
              }`}
            >
              <Film className="w-4 h-4 text-[#C85A32]" />
              <span>Video Studio (Words to Video)</span>
            </a>
            <a
              href={buildHref('contact')}
              onClick={(e) => handleNavClick(e, 'contact')}
              className={`px-3 py-2.5 rounded-lg font-medium ${
                currentRoute === 'contact' ? 'bg-[#C85A32]/15 text-[#C85A32] font-semibold' : ''
              }`}
            >
              Contact &amp; Editorial
            </a>
            <a
              href={buildHref(
                'account',
                !isAuthenticated && currentRoute !== 'home' && currentRoute !== 'account' && typeof window !== 'undefined'
                  ? { redirect: `${window.location.pathname}${window.location.search}` }
                  : undefined
              )}
              onClick={(e) =>
                handleNavClick(
                  e,
                  'account',
                  !isAuthenticated && currentRoute !== 'home' && currentRoute !== 'account' && typeof window !== 'undefined'
                    ? { redirect: `${window.location.pathname}${window.location.search}` }
                    : undefined
                )
              }
              className={`px-3 py-2.5 rounded-lg font-medium flex items-center justify-between gap-2 ${
                currentRoute === 'account' ? 'bg-[#C85A32]/15 text-[#C85A32] font-semibold' : ''
              }`}
            >
              <span>{isAuthenticated ? `${displayName} · Account` : 'Sign In / Create Account'}</span>
              {isAuthenticated && (
                <span className="text-[11px] font-mono font-bold text-[#C85A32]">
                  Rank {rank.roman} · {rank.title}
                </span>
              )}
            </a>
            {isOwner && (
              <a
                href={buildHref('admin')}
                onClick={(e) => handleNavClick(e, 'admin')}
                className={`px-3 py-2.5 rounded-lg font-medium flex items-center gap-2 ${
                  currentRoute === 'admin' ? 'bg-[#C85A32]/15 text-[#C85A32] font-semibold' : ''
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[#C85A32]" />
                <span>Publishing Desk</span>
              </a>
            )}
          </nav>

          {/* Theme Switcher for Small Screens */}
          <div className="pt-3 border-t border-current/10 flex items-center justify-between text-xs">
            <span className="font-semibold opacity-75">Reading Theme</span>
            <div className="flex items-center gap-1.5">
              {(['day', 'sepia', 'night'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`px-3 py-1.5 rounded border capitalize cursor-pointer ${
                    readerSettings.theme === t
                      ? 'border-[#C85A32] bg-[#C85A32]/10 text-[#C85A32] font-semibold'
                      : 'border-current/15'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

