import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { BarChart3, BookOpen, Clock, Compass } from 'lucide-react';
import type { Story, UserProfile, ReaderTheme } from '../types';
import { computeUserReadingStats } from '../utils/readingStats';

interface ReadingStatisticsDashboardProps {
  user: UserProfile;
  stories: Story[];
  theme?: ReaderTheme;
  onBrowseStories?: () => void;
  onConfigureGoal?: () => void;
  showSeriesTable?: boolean;
}

const GENRE_BAR_COLORS = ['#C85A32', '#2D142C', '#D97706', '#0F766E', '#6D28D9', '#BE123C'];

export const ReadingStatisticsDashboard: React.FC<ReadingStatisticsDashboardProps> = ({
  user,
  stories,
  theme = 'day',
  onBrowseStories,
  onConfigureGoal,
  showSeriesTable = true,
}) => {
  const [timeframe, setTimeframe] = useState<'7d' | '14d'>('14d');
  const [chartMetric, setChartMetric] = useState<'minutes' | 'chapters'>('minutes');

  const stats = useMemo(() => computeUserReadingStats(user, stories), [user, stories]);

  const dailySeries = useMemo(() => {
    return timeframe === '7d' ? stats.dailyActivity.slice(-7) : stats.dailyActivity;
  }, [stats.dailyActivity, timeframe]);

  const hasAnyReadingActivity =
    stats.totalMinutesRead > 0 ||
    stats.chaptersFinished > 0 ||
    stats.genresExploredCount > 0 ||
    dailySeries.some((d) => d.chaptersFinished > 0);

  const isDark = theme === 'night';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(45, 20, 44, 0.08)';
  const axisTickColor = isDark ? 'rgba(249, 246, 240, 0.65)' : 'rgba(45, 20, 44, 0.65)';

  return (
    <section
      aria-label="Reading Statistics Dashboard"
      className="rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/12 dark:border-white/12 shadow-xs overflow-hidden font-sans-ui"
    >
      {/* Header Row */}
      <div className="p-6 border-b border-[#2D142C]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#C85A32]">
            <BarChart3 className="w-4 h-4" />
            <span>Reader Analytics</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-[#2D142C] dark:text-[#F9F6F0] mt-0.5">
            Reading Statistics
          </h2>
          <p className="text-xs text-[#2D142C]/65 dark:text-white/65 mt-0.5">
            Total reading time estimated from chapter word counts, chapters finished, and genres explored.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Chart metric"
            className="inline-flex items-center p-0.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-[#F9F6F0] dark:bg-[#160C16] text-xs"
          >
            <button
              type="button"
              onClick={() => setChartMetric('minutes')}
              aria-pressed={chartMetric === 'minutes'}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors ${
                chartMetric === 'minutes'
                  ? 'bg-[#C85A32] text-white'
                  : 'text-[#2D142C]/75 dark:text-white/75 hover:text-[#C85A32]'
              }`}
            >
              Reading Time
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('chapters')}
              aria-pressed={chartMetric === 'chapters'}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors ${
                chartMetric === 'chapters'
                  ? 'bg-[#C85A32] text-white'
                  : 'text-[#2D142C]/75 dark:text-white/75 hover:text-[#C85A32]'
              }`}
            >
              Chapters
            </button>
          </div>

          <div
            role="group"
            aria-label="Timeframe"
            className="inline-flex items-center p-0.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-[#F9F6F0] dark:bg-[#160C16] text-xs"
          >
            <button
              type="button"
              onClick={() => setTimeframe('7d')}
              aria-pressed={timeframe === '7d'}
              className={`px-3 py-1.5 rounded-md font-mono font-medium whitespace-nowrap cursor-pointer transition-colors ${
                timeframe === '7d'
                  ? 'bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16]'
                  : 'text-[#2D142C]/75 dark:text-white/75 hover:text-[#C85A32]'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('14d')}
              aria-pressed={timeframe === '14d'}
              className={`px-3 py-1.5 rounded-md font-mono font-medium whitespace-nowrap cursor-pointer transition-colors ${
                timeframe === '14d'
                  ? 'bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16]'
                  : 'text-[#2D142C]/75 dark:text-white/75 hover:text-[#C85A32]'
              }`}
            >
              14 Days
            </button>
          </div>
        </div>
      </div>

      {/* 3-Metric KPI Strip (Single Elevation, Hairline Dividers) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#2D142C]/10 dark:divide-white/10 border-b border-[#2D142C]/10 dark:border-white/10">
        <div className="p-5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-[#2D142C]/65 dark:text-white/65">
            <Clock className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Total Time Reading</span>
          </div>
          <div className="font-mono text-2xl font-bold text-[#2D142C] dark:text-[#F9F6F0] tabular-nums">
            {stats.formattedTotalTime}
          </div>
          <div className="text-[11px] text-[#2D142C]/60 dark:text-white/60 tabular-nums">
            {stats.totalWordsRead.toLocaleString()} words read across library
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-[#2D142C]/65 dark:text-white/65">
            <BookOpen className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Chapters Finished</span>
          </div>
          <div className="font-mono text-2xl font-bold text-[#2D142C] dark:text-[#F9F6F0] tabular-nums">
            {stats.chaptersFinished}
            <span className="text-sm font-normal text-[#2D142C]/55 dark:text-white/55 ml-1.5">
              / {stats.totalCatalogChapters} ({stats.completionPercent}%)
            </span>
          </div>
          <div className="text-[11px] text-[#2D142C]/60 dark:text-white/60 tabular-nums">
            {stats.streakDays} day streak &middot; Best: {stats.bestStreakDays} days
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-[#2D142C]/65 dark:text-white/65">
            <Compass className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Genres Explored</span>
          </div>
          <div className="font-mono text-2xl font-bold text-[#2D142C] dark:text-[#F9F6F0] tabular-nums">
            {stats.genresExploredCount}
            <span className="text-sm font-normal text-[#2D142C]/55 dark:text-white/55 ml-1.5">
              of {stats.totalGenresCount}
            </span>
          </div>
          <div className="text-[11px] text-[#2D142C]/60 dark:text-white/60 truncate">
            {stats.topGenre ? `Most read: ${stats.topGenre}` : 'Open any story to begin tracking'}
          </div>
        </div>
      </div>

      {/* Recharts Visualizations */}
      {!hasAnyReadingActivity ? (
        <div className="p-8 text-center space-y-3">
          <BookOpen className="w-8 h-8 mx-auto text-[#C85A32]/65" />
          <h3 className="font-display text-lg font-bold text-[#2D142C] dark:text-[#F9F6F0]">
            No Reading Activity Recorded Yet
          </h3>
          <p className="text-xs text-[#2D142C]/65 dark:text-white/65 max-w-md mx-auto">
            Finish a chapter or begin reading across different genres to populate your daily reading time, completion pace, and genre distribution charts.
          </p>
          {onBrowseStories && (
            <button
              type="button"
              onClick={onBrowseStories}
              className="px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Browse Story Library
            </button>
          )}
        </div>
      ) : (
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Chart 1: Daily Reading Time & Chapters Finished */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-[#2D142C] dark:text-[#F9F6F0]">
                  {chartMetric === 'minutes'
                    ? 'Daily Reading Time & Chapter Pace'
                    : 'Daily Chapters Finished'}
                </h3>
                <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60">
                  {timeframe === '7d' ? 'Past 7 days' : 'Past 14 days'} across all serialized chapters
                </p>
              </div>
              {onConfigureGoal && (
                <button
                  type="button"
                  onClick={onConfigureGoal}
                  className="text-xs font-semibold text-[#C85A32] hover:underline cursor-pointer whitespace-nowrap"
                >
                  Adjust Goal &rarr;
                </button>
              )}
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailySeries} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                    axisLine={{ stroke: gridColor }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const pt = payload[0].payload as {
                        dayName: string;
                        dateStr: string;
                        isToday: boolean;
                        minutesRead: number;
                        chaptersFinished: number;
                      };
                      return (
                        <div className="rounded-lg bg-[#2D142C] text-[#F9F6F0] px-3 py-2 text-xs shadow-lg border border-[#C85A32]/40">
                          <div className="font-mono text-[10px] opacity-75">
                            {pt.dayName}, {pt.dateStr}
                            {pt.isToday ? ' (Today)' : ''}
                          </div>
                          <div className="font-bold tabular-nums mt-0.5">
                            {pt.minutesRead} min reading
                          </div>
                          <div className="text-[11px] text-[#F5D0A9] tabular-nums">
                            {pt.chaptersFinished} {pt.chaptersFinished === 1 ? 'chapter' : 'chapters'} finished
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey={chartMetric === 'minutes' ? 'minutesRead' : 'chaptersFinished'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  >
                    {dailySeries.map((entry) => (
                      <Cell
                        key={entry.dateStr}
                        fill={
                          entry.chaptersFinished >= entry.targetChapters
                            ? '#C85A32'
                            : entry.chaptersFinished > 0
                            ? '#D97706'
                            : isDark
                            ? 'rgba(255,255,255,0.12)'
                            : 'rgba(45,20,44,0.12)'
                        }
                      />
                    ))}
                  </Bar>
                  {chartMetric === 'minutes' && (
                    <Line
                      type="monotone"
                      dataKey="chaptersFinished"
                      stroke="#16A34A"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#16A34A' }}
                      activeDot={{ r: 5 }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Genres Explored Breakdown */}
          <div className="lg:col-span-5 space-y-3">
            <div>
              <h3 className="font-display text-base font-bold text-[#2D142C] dark:text-[#F9F6F0]">
                Genres Explored
              </h3>
              <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60">
                Minutes spent reading and chapters finished per genre
              </p>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.genreBreakdown}
                  layout="vertical"
                  margin={{ top: 6, right: 16, left: 6, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                    axisLine={{ stroke: gridColor }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="genre"
                    width={118}
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const g = payload[0].payload as {
                        genre: string;
                        minutesRead: number;
                        chaptersFinished: number;
                        totalChapters: number;
                        completionPercent: number;
                      };
                      return (
                        <div className="rounded-lg bg-[#2D142C] text-[#F9F6F0] px-3 py-2 text-xs shadow-lg border border-[#C85A32]/40">
                          <div className="font-semibold">{g.genre}</div>
                          <div className="font-mono text-[#F5D0A9] tabular-nums mt-0.5">
                            {g.minutesRead} min read
                          </div>
                          <div className="text-[11px] tabular-nums">
                            {g.chaptersFinished} / {g.totalChapters} chapters ({g.completionPercent}%)
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="minutesRead" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {stats.genreBreakdown.map((entry, idx) => (
                      <Cell
                        key={entry.genre}
                        fill={
                          entry.minutesRead > 0
                            ? GENRE_BAR_COLORS[idx % GENRE_BAR_COLORS.length]
                            : isDark
                            ? 'rgba(255,255,255,0.12)'
                            : 'rgba(45,20,44,0.12)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Optional Series Breakdown Table */}
      {showSeriesTable && stats.seriesBreakdown.length > 0 && (
        <div className="border-t border-[#2D142C]/10 dark:border-white/10 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#2D142C]/[0.03] dark:bg-white/[0.03] border-b border-[#2D142C]/10 dark:border-white/10 text-[#2D142C]/70 dark:text-white/70">
              <tr>
                <th className="py-3 px-6 font-semibold">Series</th>
                <th className="py-3 px-4 font-semibold">Genre</th>
                <th className="py-3 px-4 font-semibold text-right">Chapters Finished</th>
                <th className="py-3 px-4 font-semibold text-right">Time Reading</th>
                <th className="py-3 px-6 font-semibold text-right">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D142C]/10 dark:divide-white/10">
              {stats.seriesBreakdown.map((row) => (
                <tr key={row.storyId} className="hover:bg-[#2D142C]/[0.02] dark:hover:bg-white/[0.02]">
                  <td className="py-3 px-6 font-medium text-[#2D142C] dark:text-[#F9F6F0]">
                    {row.title}
                  </td>
                  <td className="py-3 px-4 text-[#2D142C]/70 dark:text-white/70">
                    {row.genre}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {row.chaptersFinished} / {row.totalChapters}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[#C85A32] font-semibold">
                    {row.minutesRead} min
                  </td>
                  <td className="py-3 px-6 text-right font-mono tabular-nums">
                    {row.progressPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
