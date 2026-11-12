import React from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, User, ShieldCheck, Sun, Moon, BookMarked, BookmarkCheck } from 'lucide-react';
import { ReaderTheme } from '../types';

export const Navbar: React.FC = () => {
  const { currentRoute, navigate, user, toggleRole, readerSettings, setTheme, activeProgress } = useApp();

  if (currentRoute === 'reader') {
    return null;
  }

  const isPatron = user.subscription.status === 'active';
  const isOwner = user.role === 'owner';

  return (
    <header className="sticky top-0 z-40 w-full bg-[#F9F6F0]/95 dark:bg-[#160C16]/95 sepia:bg-[#F4ECE1]/95 backdrop-blur-md border-b border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/15 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
        
        {/* Zone 1: Single Brand Lockup with Attached Logo */}
        <button
          onClick={() => navigate('home')}
          className="flex items-center gap-3 text-left group whitespace-nowrap shrink-0 cursor-pointer focus:outline-none"
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
        </button>

        {/* Zone 2: 4-5 Concise Single-line Nav Links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium">
          <button
            onClick={() => navigate('stories')}
            className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              currentRoute === 'stories'
                ? 'text-[#C85A32] font-semibold'
                : 'text-[#2D142C]/80 dark:text-[#F9F6F0]/80 sepia:text-[#2C1E18]/80 hover:text-[#C85A32]'
            }`}
          >
            Library
          </button>
          
          <button
            onClick={() => navigate('pricing')}
            className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              currentRoute === 'pricing'
                ? 'text-[#C85A32] font-semibold'
                : 'text-[#2D142C]/80 dark:text-[#F9F6F0]/80 sepia:text-[#2C1E18]/80 hover:text-[#C85A32]'
            }`}
          >
            Patron Circle
          </button>

          <button
            onClick={() => navigate('contact')}
            className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              currentRoute === 'contact'
                ? 'text-[#C85A32] font-semibold'
                : 'text-[#2D142C]/80 dark:text-[#F9F6F0]/80 sepia:text-[#2C1E18]/80 hover:text-[#C85A32]'
            }`}
          >
            Community
          </button>

          <button
            onClick={() => navigate('admin')}
            className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              currentRoute === 'admin'
                ? 'text-[#C85A32] font-semibold'
                : 'text-[#2D142C]/70 dark:text-[#F9F6F0]/70 sepia:text-[#2C1E18]/70 hover:text-[#C85A32]'
            }`}
          >
            <span>Publishing Desk</span>
            {isOwner && (
              <span className="text-[10px] bg-[#C85A32]/15 text-[#C85A32] px-1.5 py-0.5 rounded font-mono">
                OWNER
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: Reading Progress, Theme Toggles & Action Area */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Active Reading Progress Quick Resume Pill */}
          {activeProgress && (
            <button
              onClick={() => navigate('reader', { slug: activeProgress.story.slug, chapterNumber: activeProgress.chapterNumber })}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#C85A32]/30 bg-[#C85A32]/5 hover:bg-[#C85A32]/10 transition-colors text-xs cursor-pointer group"
              title={`Resume reading: ${activeProgress.story.title}`}
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-[#C85A32]" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-[#C85A32] font-semibold uppercase tracking-wider">
                  Reading Progress
                </span>
                <span className="text-xs font-medium text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] truncate max-w-[140px]">
                  {activeProgress.story.title} &middot; Ch {activeProgress.chapterNumber}
                </span>
              </div>
              <div className="w-12 bg-[#2D142C]/10 dark:bg-white/15 h-1.5 rounded-full overflow-hidden ml-1">
                <div 
                  className="bg-[#C85A32] h-full rounded-full transition-all"
                  style={{ width: `${activeProgress.progressPercent}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-[#C85A32] font-bold tabular-nums">
                {activeProgress.progressPercent}%
              </span>
            </button>
          )}

          {/* Theme Toggles (Day ☀️ / Sepia 📜 / Night 🌙) */}
          <div className="flex items-center bg-[#2D142C]/5 dark:bg-white/5 sepia:bg-[#2C1E18]/10 p-0.5 rounded-lg border border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/15 text-xs font-sans-ui">
            <button
              type="button"
              onClick={() => setTheme('day')}
              title="Day Mode (Alabaster Cream)"
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
              title="Sepia Mode (Warm Sand Parchment)"
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
              title="Night Mode (Smoked Plum)"
              className={`p-1.5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                readerSettings.theme === 'night'
                  ? 'bg-[#231323] text-white shadow-xs font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Role Mode Quick Toggle */}
          <button
            onClick={toggleRole}
            title={`Current View: ${isOwner ? 'Owner Admin' : 'Reader'}. Click to toggle.`}
            className="hidden md:flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border border-[#2D142C]/15 dark:border-white/15 sepia:border-[#2C1E18]/20 text-[#2D142C]/70 dark:text-[#F9F6F0]/70 sepia:text-[#2C1E18]/70 hover:border-[#C85A32] hover:text-[#C85A32] transition-colors whitespace-nowrap cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isOwner ? 'Owner' : 'Reader'}</span>
          </button>

          {/* Reading Goal Streak Pill */}
          {user.readingGoal && (
            <button
              onClick={() => navigate('account')}
              title={`Reading Streak: ${user.readingGoal.streakDays} Days (${user.readingGoal.currentProgress}/${user.readingGoal.targetChapters} chapters ${user.readingGoal.frequency})`}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#C85A32]/30 bg-[#C85A32]/10 hover:bg-[#C85A32]/20 transition-colors text-xs font-semibold text-[#C85A32] cursor-pointer"
            >
              <span>🔥</span>
              <span className="font-mono tabular-nums">{user.readingGoal.streakDays}d</span>
              <span className="text-[10px] opacity-80 font-normal">
                {user.readingGoal.currentProgress}/{user.readingGoal.targetChapters}
              </span>
            </button>
          )}

          {/* Account Vault Button */}
          <button
            onClick={() => navigate('account')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer border ${
              currentRoute === 'account'
                ? 'bg-[#2D142C] text-[#F9F6F0] border-[#2D142C] dark:bg-white dark:text-[#160C16]'
                : 'border-[#2D142C]/20 dark:border-white/20 sepia:border-[#2C1E18]/20 text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18] hover:bg-[#2D142C]/5 dark:hover:bg-white/5'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isPatron ? 'Patron Vault' : 'Account'}
            </span>
          </button>

          {/* Primary CTA */}
          <button
            onClick={() => navigate('stories')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#C85A32] hover:bg-[#b04d28] rounded shadow-xs hover:shadow transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read Stories</span>
          </button>
        </div>

      </div>
    </header>
  );
};

