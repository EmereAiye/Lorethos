import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, User, Sun, Moon, BookmarkCheck, Menu, X, ShieldCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    currentRoute,
    navigate,
    buildHref,
    user,
    isAuthenticated,
    readerSettings,
    setTheme,
    activeProgress
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement | null>(null);

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

  if (currentRoute === 'reader') {
    return null;
  }

  const isPatron = isAuthenticated && user.subscription.status === 'active';
  const isOwner = isAuthenticated && user.role === 'owner';

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    route: string,
    params?: Parameters<typeof navigate>[1]
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setMobileMenuOpen(false);
    navigate(route, params);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#F9F6F0]/95 dark:bg-[#160C16]/95 sepia:bg-[#F4ECE1]/95 backdrop-blur-md border-b border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/15 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">

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
        <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-7 text-sm font-medium">
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

        {/* Zone 3: Reading Progress, Theme Toggles & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
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
              className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#C85A32]/30 bg-[#C85A32]/5 hover:bg-[#C85A32]/10 transition-colors text-xs group"
              title={`Resume reading: ${activeProgress.story.title}`}
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-[#C85A32]" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-[#C85A32] font-semibold uppercase tracking-wider">
                  Resume
                </span>
                <span className="text-xs font-medium text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] truncate max-w-[130px]">
                  {activeProgress.story.title} &middot; Ch {activeProgress.chapterNumber}
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#C85A32] font-bold tabular-nums">
                {activeProgress.progressPercent}%
              </span>
            </a>
          )}

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
            href={buildHref('account')}
            onClick={(e) => handleNavClick(e, 'account')}
            aria-current={currentRoute === 'account' ? 'page' : undefined}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap border ${
              currentRoute === 'account'
                ? 'bg-[#2D142C] text-[#F9F6F0] border-[#2D142C] dark:bg-white dark:text-[#160C16]'
                : 'border-[#2D142C]/20 dark:border-white/20 sepia:border-[#2C1E18]/20 text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] hover:bg-[#2D142C]/5 dark:hover:bg-white/5'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {!isAuthenticated ? 'Sign In' : isPatron ? 'Patron Account' : 'Account'}
            </span>
          </a>

          {/* Primary CTA */}
          <a
            href={buildHref('stories')}
            onClick={(e) => handleNavClick(e, 'stories')}
            className="hidden sm:flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#C85A32] hover:bg-[#b04d28] rounded shadow-xs hover:shadow transition-all duration-150 whitespace-nowrap shrink-0"
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
              href={buildHref('contact')}
              onClick={(e) => handleNavClick(e, 'contact')}
              className={`px-3 py-2.5 rounded-lg font-medium ${
                currentRoute === 'contact' ? 'bg-[#C85A32]/15 text-[#C85A32] font-semibold' : ''
              }`}
            >
              Contact &amp; Editorial
            </a>
            <a
              href={buildHref('account')}
              onClick={(e) => handleNavClick(e, 'account')}
              className={`px-3 py-2.5 rounded-lg font-medium ${
                currentRoute === 'account' ? 'bg-[#C85A32]/15 text-[#C85A32] font-semibold' : ''
              }`}
            >
              {isAuthenticated ? 'My Account & Library' : 'Sign In / Create Account'}
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
