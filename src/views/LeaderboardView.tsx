import React from 'react';
import { Award, ArrowRight, BookOpen, Trophy } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ReadingLeaderboardSection } from '../components/ReadingLeaderboardSection';
import { READER_RANK_TIERS, computeReaderRank } from '../utils/readerProfile';

export const LeaderboardView: React.FC = () => {
  const { user, stories, isAuthenticated, buildHref, navigate } = useApp();
  const status = computeReaderRank(user, stories);

  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, route: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route);
  };

  return (
    <div className="min-h-screen py-12 bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Editorial Page Header */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#C85A32] font-sans-ui">
                <Trophy className="w-4 h-4" />
                <span>Lorethos Reader Standings</span>
              </div>
              <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight">
                Weekly &amp; Monthly Reading Leaderboard
              </h1>
              <p className="font-reader text-sm sm:text-base text-[#2D142C]/75 dark:text-white/75 sepia:text-[#2C1E18]/75 max-w-2xl leading-relaxed">
                Track the fastest chapter finishers across Lorethos each week and month, and climb all ten literary milestones from Novice Wanderer to Grand Lorekeeper.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 font-sans-ui">
              <a
                href={buildHref('stories')}
                onClick={(e) => handleLink(e, 'stories')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Read Chapters</span>
              </a>
              <a
                href={buildHref('account')}
                onClick={(e) => handleLink(e, 'account')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] hover:text-[#C85A32] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <span>{isAuthenticated ? 'Your Account & Goals' : 'Sign In'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </header>

        {/* Competitive Weekly & Monthly Leaderboard */}
        <ReadingLeaderboardSection />

        {/* 10-Tier Aspirational Progression Ladder (Zero "Rank" Copy) */}
        <section className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 shadow-xs space-y-5 font-sans-ui">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-[#C85A32]">
                <Award className="w-3.5 h-3.5" />
                <span>Literary Distinctions</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                Path to Grand Lorekeeper
              </h2>
              <p className="text-xs text-[#2D142C]/70 dark:text-white/70 sepia:text-[#2C1E18]/70 max-w-xl">
                Reaching the pinnacle requires completing 200+ chapters across the Lorethos library. Every chapter you finish locks permanently to your distinction record.
              </p>
            </div>

            {isAuthenticated && (
              <div className="text-xs text-right shrink-0">
                <div className="text-[11px] uppercase tracking-wider opacity-65">Your Current Title</div>
                <div className="font-display text-lg font-bold text-[#C85A32]">{status.title}</div>
                <div className="text-[11px] opacity-75 tabular-nums">
                  {status.completedChapters} chapters completed
                  {status.nextTitle ? ` · ${status.remainingToNext} ch to ${status.nextTitle}` : ' · Pinnacle reached'}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {READER_RANK_TIERS.map((tier) => {
              const unlocked = isAuthenticated && status.completedChapters >= tier.minChapters;
              const isCurrent = isAuthenticated && status.level === tier.level;

              return (
                <div
                  key={tier.level}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                    isCurrent
                      ? 'border-[#C85A32] bg-[#C85A32]/10 shadow-xs'
                      : unlocked
                      ? 'border-emerald-600/35 bg-emerald-600/[0.06]'
                      : 'border-[#2D142C]/12 dark:border-white/12 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <span className="text-[#C85A32]">{tier.roman}</span>
                    <span className="tabular-nums opacity-80">{tier.minChapters}+ ch</span>
                  </div>
                  <div>
                    <div className="font-display text-base font-bold leading-snug">{tier.title}</div>
                    <div className="text-[11px] opacity-65 mt-0.5">
                      {isCurrent
                        ? 'Current title'
                        : unlocked
                        ? 'Unlocked'
                        : tier.level === 10
                        ? 'Highest distinction'
                        : `${Math.max(0, tier.minChapters - status.completedChapters)} ch needed`}
                    </div>
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
