import React from 'react';
import { useApp } from '../context/AppContext';
import {
  CheckCircle2,
  Flame,
  Target,
  Trophy,
  Sparkles,
  Plus,
  Minus,
  RotateCcw,
  Calendar,
  Award
} from 'lucide-react';
import { ReadingActivityChart } from './ReadingActivityChart';

interface ReadingGoalProps {
  variant?: 'banner' | 'full';
  onOpenSettings?: () => void;
}

export const ReadingGoal: React.FC<ReadingGoalProps> = ({
  variant = 'full',
  onOpenSettings
}) => {
  const {
    user,
    readerSettings,
    updateReadingGoal,
    logChapterCompleted,
    navigate
  } = useApp();

  const goal = user.readingGoal || {
    frequency: 'daily' as const,
    targetChapters: 2,
    currentProgress: 1,
    streakDays: 5,
    bestStreakDays: 14,
    lastUpdatedDate: 'Today',
    history: []
  };

  const isDaily = goal.frequency === 'daily';
  const progressPct = Math.min(
    100,
    Math.round((goal.currentProgress / Math.max(1, goal.targetChapters)) * 100)
  );
  const isGoalMet = goal.currentProgress >= goal.targetChapters;
  const remaining = Math.max(0, goal.targetChapters - goal.currentProgress);

  const dailyTargetForChart = isDaily
    ? goal.targetChapters
    : Math.max(1, Math.ceil(goal.targetChapters / 7));

  const chartHistory = (goal.history || []).map((day, idx, arr) =>
    idx === arr.length - 1
      ? {
          ...day,
          chaptersRead: goal.currentProgress,
          metTarget: goal.currentProgress >= dailyTargetForChart
        }
      : day
  );

  const recent7Days = chartHistory.slice(-7);
  const recent7DaysMet = recent7Days.filter(
    (d) => d.chaptersRead >= dailyTargetForChart
  ).length;
  const weeklyConsistencyPct =
    recent7Days.length > 0
      ? Math.round((recent7DaysMet / recent7Days.length) * 100)
      : 0;

  const estimatedDaysForEpic = Math.ceil(
    24 / (isDaily ? goal.targetChapters : goal.targetChapters / 7)
  );

  if (variant === 'banner') {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#2D142C] via-[#3B1939] to-[#2D142C] text-[#F9F6F0] border border-[#C85A32]/30 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-xl bg-[#C85A32]/20 border border-[#C85A32]/50 flex items-center justify-center shrink-0">
            <span className="text-2xl">🔥</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#C85A32]">
                {isDaily ? 'Daily Habit & Streak' : 'Weekly Sprint & Streak'}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/90 font-mono">
                {goal.streakDays}-Day Streak
              </span>
            </div>
            <h3 className="font-display text-xl font-bold">
              {isGoalMet
                ? `🎉 ${isDaily ? 'Daily' : 'Weekly'} Milestone Achieved!`
                : `${goal.currentProgress} of ${goal.targetChapters} Chapters Read ${
                    isDaily ? 'Today' : 'This Week'
                  }`}
            </h3>
            <p className="text-xs text-white/70 font-sans-ui">
              {isGoalMet
                ? `Your streak is protected ${
                    isDaily ? 'for today' : 'this week'
                  }. Fantastic dedication to African storytelling.`
                : `Read ${remaining} more chapter${remaining > 1 ? 's' : ''} ${
                    isDaily ? 'today' : 'this week'
                  } to reach your milestone.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          {/* Visual Linear Progress Indicator */}
          <div className="space-y-1.5 w-36 sm:w-44">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-white/70">
                {goal.currentProgress}/{goal.targetChapters} ch
              </span>
              <span className="text-[#C85A32] font-bold">{progressPct}%</span>
            </div>
            <div className="h-2 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C85A32] rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => logChapterCompleted()}
              title="Log 1 chapter completed"
              className="px-3 py-2 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Ch.</span>
            </button>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Set Goal &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header Lockup */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono font-bold tracking-wider text-[#C85A32]">
              Reading Habits &amp; Consistency
            </span>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#C85A32]/10 text-[#C85A32]">
              🔥 {goal.streakDays}-Day Streak
            </span>
          </div>
          <h3 className="font-display text-3xl font-bold mt-1">
            Reading Goal &amp; Streak
          </h3>
          <p className="text-xs text-[#2D142C]/65 dark:text-white/65 sepia:text-[#2C1E18]/70 font-sans-ui mt-0.5">
            Set your daily or weekly chapter milestones, protect your streak, and track reading velocity.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => logChapterCompleted()}
            className="px-4 py-2.5 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Chapter Read</span>
          </button>
        </div>
      </div>

      {/* Goal Progress Ring & Goal Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Circular Visual Progress Ring & Status */}
        <div className="lg:col-span-5 p-7 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/15 shadow-xs flex flex-col items-center justify-between space-y-6 text-center">
          <div className="w-full flex items-center justify-between text-xs font-sans-ui text-[#2D142C]/60 dark:text-white/60 sepia:text-[#2C1E18]/70">
            <span className="font-mono uppercase font-bold tracking-wider text-[#C85A32]">
              {isDaily ? 'Today’s Progress' : 'Weekly Progress'}
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              {isGoalMet && <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{isGoalMet ? 'Target Reached' : 'In Progress'}</span>
            </span>
          </div>

          {/* SVG Circular Radial Progress Meter */}
          <div className="relative w-48 h-48 flex items-center justify-center my-2">
            <svg className="w-48 h-48 -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="76"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                className="text-[#2D142C]/10 dark:text-white/10 sepia:text-[#2C1E18]/15"
              />
              <circle
                cx="96"
                cy="96"
                r="76"
                stroke="#C85A32"
                strokeWidth="12"
                strokeDasharray={477.5}
                strokeDashoffset={477.5 - (477.5 * progressPct) / 100}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-500 ease-out"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-display font-bold tabular-nums">
                {goal.currentProgress}
                <span className="text-xl text-[#2D142C]/40 dark:text-white/40 sepia:text-[#2C1E18]/45 font-normal">
                  {' '}
                  / {goal.targetChapters}
                </span>
              </span>
              <span className="text-[11px] uppercase tracking-wider font-mono font-semibold text-[#C85A32] mt-0.5">
                Chapters Read
              </span>
              <span className="text-xs font-mono font-bold mt-1 text-[#2D142C]/70 dark:text-white/70 sepia:text-[#2C1E18]/75 tabular-nums">
                {progressPct}% Met
              </span>
            </div>
          </div>

          {/* Dynamic Status / Encouragement Message */}
          <div className="p-3.5 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-[#2D142C]/5 dark:border-white/5 w-full text-xs font-sans-ui space-y-1">
            {isGoalMet ? (
              <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>
                  {isDaily ? 'Daily' : 'Weekly'} Target Complete! Streak Maintained 🔥
                </span>
              </div>
            ) : (
              <div className="text-[#2D142C]/80 dark:text-white/80 sepia:text-[#2C1E18]/85">
                <span>Read </span>
                <strong className="text-[#C85A32] font-mono">{remaining}</strong>
                <span>
                  {' '}
                  more chapter{remaining > 1 ? 's' : ''}{' '}
                  {isDaily ? 'today' : 'this week'} to hit your goal.
                </span>
              </div>
            )}
          </div>

          {/* Direct Log & Reset Controls */}
          <div className="w-full flex items-center gap-2 pt-1">
            <button
              onClick={() => logChapterCompleted()}
              className="flex-1 py-2.5 px-3 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+1 Chapter Finished</span>
            </button>

            <button
              onClick={() => updateReadingGoal({ currentProgress: 0 })}
              title="Reset current cycle progress to 0"
              className="p-2.5 rounded-lg border border-[#2D142C]/20 dark:border-white/20 text-[#2D142C]/60 dark:text-white/60 hover:text-[#C85A32] hover:border-[#C85A32] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          {Array.isArray(goal.completedChapterIds) && goal.completedChapterIds.length > 0 && (
            <div className="text-[11px] font-mono text-[#2D142C]/55 dark:text-white/55 sepia:text-[#2C1E18]/65">
              {goal.completedChapterIds.length} unique chapter{goal.completedChapterIds.length > 1 ? 's' : ''} verified complete
            </div>
          )}
        </div>

        {/* Right: Target Settings & Velocity Configuration */}
        <div className="lg:col-span-7 p-7 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/15 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-[#2D142C]/10 dark:border-white/10 pb-4">
              <div>
                <h4 className="font-display text-xl font-bold">
                  Goal Frequency &amp; Targets
                </h4>
                <p className="text-xs text-[#2D142C]/60 dark:text-white/60 sepia:text-[#2C1E18]/70 font-sans-ui mt-0.5">
                  Customize how often you read and how many chapters you aim for.
                </p>
              </div>
              <Target className="w-5 h-5 text-[#C85A32]" />
            </div>

            {/* Frequency Switcher: Daily vs Weekly */}
            <div className="space-y-2">
              <label className="text-xs font-semibold block font-sans-ui">
                Cadence
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    updateReadingGoal({
                      frequency: 'daily',
                      targetChapters: isDaily
                        ? goal.targetChapters
                        : Math.max(1, Math.round(goal.targetChapters / 5))
                    })
                  }
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isDaily
                      ? 'border-[#C85A32] bg-[#C85A32]/5 ring-1 ring-[#C85A32]'
                      : 'border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32]/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs">Daily Habit</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#C85A32]/10 text-[#C85A32]">
                      Every Day
                    </span>
                  </div>
                  <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60 mt-1">
                    Build momentum by reading chapters daily.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateReadingGoal({
                      frequency: 'weekly',
                      targetChapters: !isDaily
                        ? goal.targetChapters
                        : Math.max(5, goal.targetChapters * 5)
                    })
                  }
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    !isDaily
                      ? 'border-[#C85A32] bg-[#C85A32]/5 ring-1 ring-[#C85A32]'
                      : 'border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32]/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs">Weekly Sprint</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#C85A32]/10 text-[#C85A32]">
                      Per Week
                    </span>
                  </div>
                  <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60 mt-1">
                    Flexible reading across 7 days at your own pace.
                  </p>
                </button>
              </div>
            </div>

            {/* Target Chapters Stepper */}
            <div className="space-y-2">
              <label className="text-xs font-semibold block font-sans-ui">
                Target Chapters ({isDaily ? 'Per Day' : 'Per Week'})
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    updateReadingGoal({
                      targetChapters: Math.max(1, goal.targetChapters - 1)
                    })
                  }
                  className="w-12 h-12 rounded-xl border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] hover:text-[#C85A32] flex items-center justify-center font-bold text-lg cursor-pointer transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="flex-1 py-2 px-4 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-[#2D142C]/10 dark:border-white/10 text-center">
                  <div className="font-display text-2xl font-bold text-[#C85A32] tabular-nums">
                    {goal.targetChapters}
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[#2D142C]/60 dark:text-white/60">
                    Chapters {isDaily ? 'per day' : 'per week'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateReadingGoal({
                      targetChapters: Math.min(
                        isDaily ? 20 : 70,
                        goal.targetChapters + 1
                      )
                    })
                  }
                  className="w-12 h-12 rounded-xl border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] hover:text-[#C85A32] flex items-center justify-center font-bold text-lg cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-[#2D142C]/50 dark:text-white/50 font-sans-ui">
                  Quick Presets:
                </span>
                {(isDaily ? [1, 2, 3, 5] : [5, 10, 15, 20]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateReadingGoal({ targetChapters: preset })}
                    className={`text-[11px] px-2.5 py-1 rounded-md border font-mono transition-colors cursor-pointer ${
                      goal.targetChapters === preset
                        ? 'bg-[#C85A32] text-white border-[#C85A32] font-bold'
                        : 'border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32]'
                    }`}
                  >
                    {preset} ch
                  </button>
                ))}
              </div>
            </div>

            {/* Velocity Estimate Callout */}
            <div className="p-4 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-[#2D142C]/10 dark:border-white/10 flex items-start gap-3 text-xs font-sans-ui">
              <Sparkles className="w-4 h-4 text-[#C85A32] shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-[#2D142C]/75 dark:text-white/75 sepia:text-[#2C1E18]/80">
                <strong className="text-[#2D142C] dark:text-white sepia:text-[#2C1E18] block font-semibold">
                  Reading Velocity Projection
                </strong>
                <p>
                  At{' '}
                  <span className="font-mono text-[#C85A32] font-semibold">
                    {goal.targetChapters} chapters
                  </span>{' '}
                  {isDaily ? 'per day' : 'per week'}, you will spend roughly{' '}
                  <span className="font-mono font-semibold">
                    {goal.targetChapters * 12} mins
                  </span>{' '}
                  reading and finish a full 24-chapter serialized epic in ~
                  <span className="font-mono text-[#C85A32] font-semibold">
                    {estimatedDaysForEpic} days
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Streak & Achievements Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 font-sans-ui">
        <div className="p-5 rounded-xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/10 dark:border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#C85A32]/10 text-[#C85A32] flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-[#2D142C]/60 dark:text-white/60 block">
              Current Streak
            </span>
            <div className="text-2xl font-bold font-display text-[#C85A32] tabular-nums">
              {goal.streakDays} Days
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Active &amp; burning bright
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/10 dark:border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#2D142C]/10 dark:bg-white/10 text-[#2D142C] dark:text-white flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <span className="text-[11px] text-[#2D142C]/60 dark:text-white/60 block">
              Personal Best
            </span>
            <div className="text-2xl font-bold font-display tabular-nums">
              {goal.bestStreakDays} Days
            </div>
            <span className="text-[10px] text-[#2D142C]/60 dark:text-white/60">
              All-time record streak
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/10 dark:border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#C85A32]/10 text-[#C85A32] flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-[#2D142C]/60 dark:text-white/60 block">
              Weekly Consistency
            </span>
            <div className="text-2xl font-bold font-display tabular-nums text-emerald-600">
              {weeklyConsistencyPct}%
            </div>
            <span className="text-[10px] text-[#2D142C]/60 dark:text-white/60">
              {recent7DaysMet} of last {recent7Days.length} days completed
            </span>
          </div>
        </div>
      </div>

      {/* D3 Two-Week Reading Activity Bar Chart */}
      <ReadingActivityChart
        history={chartHistory}
        dailyTarget={dailyTargetForChart}
        theme={readerSettings.theme}
      />

      {/* 7-Day Habit Activity Tracker */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/10 dark:border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-display text-lg font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C85A32]" />
              <span>7-Day Reading Activity Matrix</span>
            </h4>
            <p className="text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui mt-0.5">
              Your recent daily chapter completions across the Lorethos serialized library.
            </p>
          </div>
          <span className="text-xs font-mono text-[#C85A32] font-semibold">
            Nigeria &middot; Standard Time
          </span>
        </div>

        <div className="grid grid-cols-7 gap-3 pt-2">
          {recent7Days.map((day, idx) => {
            const isCurrentDay = idx === recent7Days.length - 1;
            const isMet = day.metTarget || (isCurrentDay && isGoalMet);
            const count = isCurrentDay ? goal.currentProgress : day.chaptersRead;

            return (
              <div
                key={day.dateStr}
                className={`p-3.5 rounded-xl border text-center flex flex-col items-center justify-between space-y-2 transition-all ${
                  isCurrentDay
                    ? 'border-[#C85A32] bg-[#C85A32]/5 ring-1 ring-[#C85A32]'
                    : isMet
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-[#2D142C]/10 dark:border-white/10 bg-[#F9F6F0]/50 dark:bg-[#160C16]/50'
                }`}
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-bold block font-sans-ui">
                    {day.dayName}
                  </span>
                  <span className="text-[10px] text-[#2D142C]/50 dark:text-white/50 block font-mono">
                    {day.dateStr}
                  </span>
                </div>

                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                    isMet
                      ? 'bg-[#C85A32] text-white shadow-xs'
                      : count > 0
                      ? 'bg-[#2D142C]/10 dark:bg-white/10 text-[#C85A32]'
                      : 'bg-[#2D142C]/5 dark:bg-white/5 text-[#2D142C]/40 dark:text-white/40'
                  }`}
                >
                  {isMet ? '✓' : count}
                </div>

                <span className="text-[10px] font-mono text-[#2D142C]/60 dark:text-white/60">
                  {count} ch
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* African Storytelling Wisdom Banner */}
      <div className="p-6 rounded-2xl bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-[#2D142C]/10 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#C85A32] font-semibold">
            The Storyteller’s Discipline
          </span>
          <p className="font-reader text-sm italic text-[#2D142C]/80 dark:text-white/80">
            &ldquo;The story is our escort; without it, we are blind.&rdquo;
          </p>
          <span className="text-xs text-[#2D142C]/50 dark:text-white/50 font-sans-ui block">
            &mdash; Chinua Achebe
          </span>
        </div>

        <button
          onClick={() => navigate('stories')}
          className="px-5 py-2.5 bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer shrink-0"
        >
          Continue Reading in Library &rarr;
        </button>
      </div>
    </div>
  );
};
