import React, { useCallback, useEffect, useState } from 'react';
import {
  Trophy,
  Flame,
  BookOpen,
  Award,
  RefreshCw,
  ArrowRight,
  Crown,
  Medal,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, parseJsonSafe } from '../lib/apiClient';
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardResponse } from '../types';
import { ReaderAvatar } from './ReaderAvatar';
import { computeReaderRank, getDisplayName } from '../utils/readerProfile';

interface ReadingLeaderboardSectionProps {
  compact?: boolean;
  onOpenFullLeaderboard?: () => void;
}

export const ReadingLeaderboardSection: React.FC<ReadingLeaderboardSectionProps> = ({
  compact = false,
  onOpenFullLeaderboard,
}) => {
  const { user, stories, isAuthenticated, buildHref, navigate } = useApp();
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localStatus = computeReaderRank(user, stories);
  const completedCountSignature = localStatus.completedChapters;

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/leaderboard?period=${period}`);
      const json = await parseJsonSafe<LeaderboardResponse>(res);
      if (!res.ok || !json) {
        throw new Error('Could not load reading standings right now.');
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard, isAuthenticated, completedCountSignature]);

  const entries: LeaderboardEntry[] = data
    ? period === 'weekly'
      ? data.weekly
      : data.monthly
    : [];

  const visibleEntries = compact ? entries.slice(0, 8) : entries;
  const topThree = visibleEntries.slice(0, 3);
  const periodLabel = period === 'weekly' ? 'This Week (7 Days)' : 'This Month (30 Days)';
  const periodShort = period === 'weekly' ? '7d' : '30d';

  const getPeriodCount = (entry: LeaderboardEntry) =>
    period === 'weekly' ? entry.weeklyChapters : entry.monthlyChapters;

  const viewerEntry = data
    ? (period === 'weekly' ? data.weekly : data.monthly).find((e) => e.isCurrentUser) || null
    : null;

  const viewerAbove =
    viewerEntry && viewerEntry.position > 1
      ? entries.find((e) => e.position === viewerEntry.position - 1) || null
      : null;

  const chaptersToOvertake =
    viewerEntry && viewerAbove
      ? Math.max(1, getPeriodCount(viewerAbove) - getPeriodCount(viewerEntry) + 1)
      : null;

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, route: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route);
  };

  return (
    <section
      aria-label="Reading completion leaderboard"
      className="rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#FAF4EB] border border-[#2D142C]/12 dark:border-white/12 sepia:border-[#2C1E18]/15 p-5 sm:p-7 shadow-xs space-y-6 font-sans-ui"
    >
      {/* Header + Segmented Weekly / Monthly Control */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-[#C85A32]">
            <Trophy className="w-3.5 h-3.5" />
            <span>Community Reading Leaderboard</span>
            {data && (
              <>
                <span className="opacity-40">&middot;</span>
                <span className="text-[#2D142C]/70 dark:text-white/70 sepia:text-[#2C1E18]/70 tabular-nums">
                  {data.totalReaders} {data.totalReaders === 1 ? 'Reader' : 'Readers'}
                </span>
              </>
            )}
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            {period === 'weekly' ? 'Weekly Chapter Leaders' : 'Monthly Chapter Leaders'}
          </h2>
          <p className="text-xs text-[#2D142C]/70 dark:text-white/70 sepia:text-[#2C1E18]/70 max-w-xl">
            Every completed chapter counts toward your {period === 'weekly' ? '7-day' : '30-day'} tally and advances your Lorethos title from Novice Wanderer toward Grand Lorekeeper.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="Leaderboard timeframe"
            className="inline-flex items-center p-1 rounded-xl bg-[#2D142C]/6 dark:bg-white/6 sepia:bg-[#2C1E18]/8 border border-[#2D142C]/10 dark:border-white/10"
          >
            <button
              type="button"
              onClick={() => setPeriod('weekly')}
              aria-pressed={period === 'weekly'}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                period === 'weekly'
                  ? 'bg-[#C85A32] text-white shadow-xs'
                  : 'text-[#2D142C]/75 dark:text-white/75 sepia:text-[#2C1E18]/75 hover:text-[#C85A32]'
              }`}
            >
              Weekly (7 Days)
            </button>
            <button
              type="button"
              onClick={() => setPeriod('monthly')}
              aria-pressed={period === 'monthly'}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                period === 'monthly'
                  ? 'bg-[#C85A32] text-white shadow-xs'
                  : 'text-[#2D142C]/75 dark:text-white/75 sepia:text-[#2C1E18]/75 hover:text-[#C85A32]'
              }`}
            >
              Monthly (30 Days)
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadLeaderboard()}
            disabled={loading}
            aria-label="Refresh leaderboard"
            title="Refresh standings"
            className="p-2 rounded-lg border border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32] hover:text-[#C85A32] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Viewer Standing / Callout Banner */}
      {isAuthenticated && data?.viewerStanding ? (
        <div className="rounded-xl border border-[#C85A32]/30 bg-[#C85A32]/[0.07] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-[#C85A32]/60 bg-[#2D142C] text-white flex items-center justify-center shrink-0">
              <ReaderAvatar src={user.avatar} name={getDisplayName(user)} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#C85A32]">
                Your Standing &middot; {periodLabel}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold">
                <span className="font-mono text-[#C85A32] tabular-nums">
                  #{(period === 'weekly' ? data.viewerStanding.weeklyPosition : data.viewerStanding.monthlyPosition) ?? '—'}
                </span>
                <span className="truncate">{getDisplayName(user)}</span>
                <span className="opacity-40">&middot;</span>
                <span className="text-xs font-semibold text-[#C85A32]">{data.viewerStanding.tierTitle}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs shrink-0">
            <div>
              <span className="font-mono font-bold text-base tabular-nums text-[#C85A32]">
                {period === 'weekly'
                  ? data.viewerStanding.weeklyChapters
                  : data.viewerStanding.monthlyChapters}
              </span>
              <span className="opacity-75 ml-1">ch ({periodShort})</span>
            </div>
            <div className="opacity-75 tabular-nums">
              {data.viewerStanding.allTimeChapters} total ch
            </div>
            {chaptersToOvertake !== null && viewerAbove ? (
              <div className="text-[11px] font-medium text-[#2D142C]/80 dark:text-white/80 sepia:text-[#2C1E18]/80">
                {chaptersToOvertake} more {chaptersToOvertake === 1 ? 'chapter' : 'chapters'} to pass{' '}
                <span className="font-semibold">{viewerAbove.displayName}</span> (#{viewerAbove.position})
              </div>
            ) : viewerEntry?.position === 1 ? (
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                Leading {period === 'weekly' ? 'this week' : 'this month'}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2D142C]/10 dark:border-white/10 bg-[#2D142C]/[0.03] dark:bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold flex items-center gap-1.5 text-[#C85A32]">
              <Users className="w-3.5 h-3.5" />
              <span>Join the Reading Challenge</span>
            </div>
            <p className="text-xs text-[#2D142C]/75 dark:text-white/75 sepia:text-[#2C1E18]/75">
              Sign in and finish chapters in any Lorethos series to claim your place on the weekly and monthly leaderboards.
            </p>
          </div>
          <a
            href={buildHref('account')}
            onClick={(e) => handleNav(e, 'account')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors self-start sm:self-auto"
          >
            <span>Sign In to Compete</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Top 3 Podium Cards */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topThree.map((entry) => {
            const count = getPeriodCount(entry);
            const isFirst = entry.position === 1;
            const isSecond = entry.position === 2;

            return (
              <div
                key={`${period}-podium-${entry.userId}`}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  entry.isCurrentUser
                    ? 'border-[#C85A32] bg-[#C85A32]/[0.09] ring-1 ring-[#C85A32]/35'
                    : isFirst
                    ? 'border-[#D4AF37]/60 bg-[#D4AF37]/[0.07]'
                    : 'border-[#2D142C]/12 dark:border-white/12 bg-[#2D142C]/[0.02] dark:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-full overflow-hidden border-2 flex items-center justify-center shrink-0 bg-[#2D142C] text-white ${
                        isFirst
                          ? 'border-[#D4AF37]'
                          : isSecond
                          ? 'border-[#9CA3AF]'
                          : 'border-[#C85A32]/70'
                      }`}
                    >
                      <ReaderAvatar src={entry.avatar} name={entry.displayName} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-[#C85A32] tabular-nums">
                          #{entry.position}
                        </span>
                        <span className="font-display text-base font-bold truncate">
                          {entry.displayName}
                        </span>
                        {entry.isCurrentUser && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C85A32]">
                            (You)
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-[#C85A32] flex items-center gap-1 truncate mt-0.5">
                        <Award className="w-3 h-3 shrink-0" />
                        <span className="truncate">{entry.tierTitle}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isFirst ? (
                      <Crown className="w-5 h-5 text-[#D4AF37]" />
                    ) : (
                      <Medal
                        className={`w-4 h-4 ${
                          isSecond ? 'text-slate-400' : 'text-[#C85A32]'
                        }`}
                      />
                    )}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#2D142C]/10 dark:border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-lg font-bold text-[#C85A32] tabular-nums">
                      {count}
                    </span>
                    <span className="opacity-70 ml-1">
                      {count === 1 ? 'chapter' : 'chapters'} ({periodShort})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 opacity-75 text-[11px] tabular-nums">
                    <span>{entry.allTimeChapters} total</span>
                    <span>&middot;</span>
                    <span className="inline-flex items-center gap-0.5 text-[#C85A32] font-semibold">
                      <Flame className="w-3 h-3" />
                      {entry.streakDays}d
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Leaderboard Table */}
      {loading && entries.length === 0 ? (
        <div className="py-12 text-center text-xs opacity-65">
          Loading {period} reading standings...
        </div>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center space-y-2 border border-dashed border-[#2D142C]/15 dark:border-white/15 rounded-xl">
          <BookOpen className="w-7 h-7 mx-auto text-[#C85A32]/60" />
          <p className="font-display text-base font-bold">No completions recorded yet</p>
          <p className="text-xs opacity-70 max-w-sm mx-auto">
            Finish reading any chapter to claim the #1 spot on Lorethos.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#2D142C]/10 dark:border-white/10">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#2D142C]/[0.04] dark:bg-white/[0.04] border-b border-[#2D142C]/10 dark:border-white/10 text-[11px] uppercase tracking-wider font-semibold text-[#2D142C]/65 dark:text-white/65 sepia:text-[#2C1E18]/65">
                <th className="py-3 px-4 w-14">#</th>
                <th className="py-3 px-4">Reader</th>
                <th className="py-3 px-4">Literary Title</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">
                  {period === 'weekly' ? 'Weekly Ch.' : 'Monthly Ch.'}
                </th>
                <th className="py-3 px-4 text-right whitespace-nowrap hidden sm:table-cell">
                  All-Time Ch.
                </th>
                <th className="py-3 px-4 text-right whitespace-nowrap hidden md:table-cell">
                  Series Done
                </th>
                <th className="py-3 px-4 text-right whitespace-nowrap hidden sm:table-cell">
                  Streak
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D142C]/10 dark:divide-white/10">
              {visibleEntries.map((entry) => {
                const count = getPeriodCount(entry);
                return (
                  <tr
                    key={`${period}-row-${entry.userId}`}
                    className={
                      entry.isCurrentUser
                        ? 'bg-[#C85A32]/[0.11] font-medium'
                        : 'hover:bg-[#2D142C]/[0.025] dark:hover:bg-white/[0.025] transition-colors'
                    }
                  >
                    <td className="py-3 px-4 font-mono font-bold tabular-nums text-[#C85A32]">
                      #{entry.position}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-[#C85A32]/50 bg-[#2D142C] text-white flex items-center justify-center shrink-0">
                          <ReaderAvatar src={entry.avatar} name={entry.displayName} />
                        </div>
                        <span className="font-semibold truncate max-w-[160px] sm:max-w-[220px]">
                          {entry.displayName}
                        </span>
                        {entry.isCurrentUser && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#C85A32]">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[#2D142C] dark:text-[#F9F6F0] sepia:text-[#2C1E18]">
                        {entry.tierTitle}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-[#C85A32]">
                      {count}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums opacity-80 hidden sm:table-cell">
                      {entry.allTimeChapters}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums opacity-80 hidden md:table-cell">
                      {entry.completedStoriesCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums hidden sm:table-cell">
                      <span className="inline-flex items-center justify-end gap-1 text-[#C85A32] font-semibold">
                        <Flame className="w-3 h-3" />
                        {entry.streakDays}d
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#2D142C]/10 dark:border-white/10 text-xs">
          <span className="opacity-70">
            Showing top {visibleEntries.length} of {data?.totalReaders ?? visibleEntries.length} readers for {periodLabel.toLowerCase()}.
          </span>
          {onOpenFullLeaderboard ? (
            <button
              type="button"
              onClick={onOpenFullLeaderboard}
              className="inline-flex items-center gap-1.5 font-semibold text-[#C85A32] hover:underline cursor-pointer"
            >
              <span>View Full Leaderboard &amp; Tier Ladder</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <a
              href={buildHref('leaderboard')}
              onClick={(e) => handleNav(e, 'leaderboard')}
              className="inline-flex items-center gap-1.5 font-semibold text-[#C85A32] hover:underline"
            >
              <span>View Full Leaderboard &amp; Tier Ladder</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}
    </section>
  );
};
