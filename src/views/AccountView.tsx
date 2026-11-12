import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  User, 
  ShieldCheck, 
  BookOpen, 
  Bookmark, 
  History, 
  Settings, 
  CreditCard, 
  CheckCircle2, 
  ArrowRight,
  ExternalLink,
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

export const AccountView: React.FC = () => {
  const { 
    user, 
    stories, 
    transactions, 
    readerSettings, 
    updateReaderSettings, 
    navigate, 
    openPaystackCheckout,
    updateReadingGoal,
    logChapterCompleted
  } = useApp();

  const [activeTab, setActiveTab] = useState<'vault' | 'goals' | 'history' | 'subscription' | 'settings'>('vault');

  const isPatron = user.subscription.status === 'active';
  const goal = user.readingGoal || {
    frequency: 'daily',
    targetChapters: 2,
    currentProgress: 1,
    streakDays: 5,
    bestStreakDays: 14,
    lastUpdatedDate: 'Today',
    history: []
  };

  const progressPct = Math.min(100, Math.round((goal.currentProgress / Math.max(1, goal.targetChapters)) * 100));
  const isGoalMet = goal.currentProgress >= goal.targetChapters;

  // Find stories that the user has unlocked or has in progress
  const unlockedStories = stories.filter(s => 
    user.unlockedStoryIds.includes(s.id) || (isPatron && s.accessTier === 'subscription')
  );

  const bookmarkedChapters = stories.flatMap(s => 
    s.chapters.filter(c => user.bookmarkedChapterIds.includes(c.id)).map(c => ({
      ...c,
      storyTitle: s.title,
      storySlug: s.slug,
      storyCover: s.coverImage
    }))
  );

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-12 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Profile Banner */}
        <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#2D142C] text-[#F9F6F0] flex items-center justify-center font-display text-2xl font-bold border-2 border-[#C85A32]">
              {user.name.charAt(0)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold">{user.name}</h1>
                {isPatron ? (
                  <span className="text-[11px] font-semibold bg-[#C85A32] text-white px-2 py-0.5 rounded font-sans-ui">
                    Patron Circle Member
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold bg-[#2D142C]/10 dark:bg-white/10 text-[#2D142C]/70 dark:text-white/70 px-2 py-0.5 rounded font-sans-ui">
                    Free Traveler
                  </span>
                )}
              </div>
              <p className="text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                {user.email} &middot; Member since 2026
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isPatron ? (
              <button
                onClick={() => openPaystackCheckout({
                  type: 'subscription',
                  title: 'Patron Monthly Membership',
                  amountNgn: 3500,
                  planId: 'monthly'
                })}
                className="px-4 py-2.5 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Upgrade to Patron (₦3,500/mo)</span>
              </button>
            ) : (
              <div className="text-right">
                <span className="text-[11px] text-[#2D142C]/50 dark:text-white/50 block font-sans-ui">
                  Active Subscription
                </span>
                <span className="text-xs font-semibold text-emerald-600">
                  Renews {user.subscription.renewsAt || 'Dec 15, 2026'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Reading Goal & Streak Interactive Quick Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#2D142C] via-[#3B1939] to-[#2D142C] text-[#F9F6F0] border border-[#C85A32]/30 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-xl bg-[#C85A32]/20 border border-[#C85A32]/50 flex items-center justify-center shrink-0">
              <span className="text-2xl">🔥</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#C85A32]">
                  Daily Habit & Streak
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/90 font-mono">
                  {goal.streakDays}-Day Streak
                </span>
              </div>
              <h3 className="font-display text-xl font-bold">
                {isGoalMet
                  ? '🎉 Daily Milestone Achieved!'
                  : `${goal.currentProgress} of ${goal.targetChapters} Chapters Read Today`}
              </h3>
              <p className="text-xs text-white/70 font-sans-ui">
                {isGoalMet
                  ? 'Your streak is protected for today. Fantastic dedication to African storytelling.'
                  : `Read ${goal.targetChapters - goal.currentProgress} more chapter${goal.targetChapters - goal.currentProgress > 1 ? 's' : ''} today to keep your streak glowing.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            {/* Visual Linear Progress Indicator */}
            <div className="space-y-1.5 w-36 sm:w-44">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-white/70">{goal.currentProgress}/{goal.targetChapters} ch</span>
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
                onClick={logChapterCompleted}
                title="Log 1 chapter completed today"
                className="px-3 py-2 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Ch.</span>
              </button>

              <button
                onClick={() => setActiveTab('goals')}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Set Goal &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#2D142C]/10 dark:border-white/10 gap-2 font-sans-ui text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('vault')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'vault'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>My Book Vault ({unlockedStories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('goals')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'goals'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Reading Goal & Streak</span>
            <span className="text-[10px] font-mono font-bold bg-[#C85A32]/15 text-[#C85A32] px-1.5 py-0.5 rounded-full">
              🔥 {goal.streakDays}d
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'history'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Bookmarks ({bookmarkedChapters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('subscription')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'subscription'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Subscription & Paystack Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'settings'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Reading Preferences</span>
          </button>
        </div>

        {/* Tab 1: Book Vault */}
        {activeTab === 'vault' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-2xl font-bold">Unlocked Works & Ongoing Reading</h3>
                <p className="text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                  Stories available to read without chapter restrictions.
                </p>
              </div>
              <button
                onClick={() => navigate('stories')}
                className="text-xs font-semibold text-[#C85A32] hover:underline"
              >
                Browse Catalog &rarr;
              </button>
            </div>

            {unlockedStories.length === 0 ? (
              <div className="p-8 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center space-y-3">
                <BookOpen className="w-8 h-8 mx-auto text-[#C85A32]/60" />
                <h4 className="font-display text-lg font-bold">Your Vault is Empty</h4>
                <p className="text-xs text-[#2D142C]/60 dark:text-white/60 max-w-sm mx-auto">
                  Unlock a single story or join the Patron Circle to build your permanent digital library.
                </p>
                <button
                  onClick={() => navigate('pricing')}
                  className="px-4 py-2 bg-[#C85A32] text-white text-xs font-semibold rounded-lg hover:bg-[#b04d28] cursor-pointer"
                >
                  Explore Membership Plans
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {unlockedStories.map(story => {
                  const progress = user.readingProgress[story.id];
                  const currentCh = progress?.chapterNumber || 1;
                  const pct = progress?.progressPercent || 0;

                  return (
                    <div
                      key={story.id}
                      className="p-5 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 flex flex-col justify-between space-y-4"
                    >
                      <div className="flex gap-4">
                        <img
                          src={story.coverImage}
                          alt={story.title}
                          className="w-16 h-22 object-cover rounded shadow-xs shrink-0"
                        />
                        <div className="space-y-1 min-w-0">
                          <span className="text-[10px] uppercase font-bold text-[#C85A32] font-sans-ui">
                            {story.genre}
                          </span>
                          <h4 className="font-display text-base font-bold truncate">
                            {story.title}
                          </h4>
                          <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                            By {story.author}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-[#2D142C]/10 dark:border-white/10">
                        <div className="flex justify-between text-xs font-sans-ui">
                          <span className="text-[#2D142C]/60 dark:text-white/60">
                            Current: Ch. {currentCh} of {story.totalChapters}
                          </span>
                          <span className="font-semibold tabular-nums text-[#C85A32]">
                            {pct}% Read
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#2D142C]/10 dark:bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#C85A32] rounded-full"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => navigate('reader', { slug: story.slug, chapterNumber: currentCh })}
                        className="w-full py-2 bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] text-xs font-semibold rounded hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Resume Reading</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Reading Goal & Streak Feature */}
        {activeTab === 'goals' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Header Lockup */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-mono font-bold tracking-wider text-[#C85A32]">
                    Reading Habits & Consistency
                  </span>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#C85A32]/10 text-[#C85A32]">
                    🔥 {goal.streakDays}-Day Streak
                  </span>
                </div>
                <h3 className="font-display text-3xl font-bold mt-1">Reading Goal & Streak</h3>
                <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui mt-0.5">
                  Set your daily or weekly chapter milestones, protect your streak, and track reading velocity.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={logChapterCompleted}
                  className="px-4 py-2.5 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Log Chapter Read</span>
                </button>
              </div>
            </div>

            {/* Goal Progress Ring & Goal Configuration Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left: Circular Visual Progress Ring & Status */}
              <div className="lg:col-span-5 p-7 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs flex flex-col items-center justify-between space-y-6 text-center">
                <div className="w-full flex items-center justify-between text-xs font-sans-ui text-[#2D142C]/60 dark:text-white/60">
                  <span className="font-mono uppercase font-bold tracking-wider text-[#C85A32]">
                    {goal.frequency === 'daily' ? 'Today’s Progress' : 'Weekly Progress'}
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    {isGoalMet && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{isGoalMet ? 'Target Reached' : 'In Progress'}</span>
                  </span>
                </div>

                {/* SVG Circular Radial Progress Meter */}
                <div className="relative w-48 h-48 flex items-center justify-center my-2">
                  <svg className="w-48 h-48 -rotate-90">
                    {/* Background track circle */}
                    <circle
                      cx="96"
                      cy="96"
                      r="76"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      className="text-[#2D142C]/10 dark:text-white/10"
                    />
                    {/* Foreground colored progress arc */}
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

                  {/* Central Statistics in the Progress Ring */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-display font-bold tabular-nums">
                      {goal.currentProgress}
                      <span className="text-xl text-[#2D142C]/40 dark:text-white/40 font-normal"> / {goal.targetChapters}</span>
                    </span>
                    <span className="text-[11px] uppercase tracking-wider font-mono font-semibold text-[#C85A32] mt-0.5">
                      Chapters Read
                    </span>
                    <span className="text-xs font-mono font-bold mt-1 text-[#2D142C]/70 dark:text-white/70 tabular-nums">
                      {progressPct}% Met
                    </span>
                  </div>
                </div>

                {/* Dynamic Status / Encouragement Message */}
                <div className="p-3.5 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] border border-[#2D142C]/5 dark:border-white/5 w-full text-xs font-sans-ui space-y-1">
                  {isGoalMet ? (
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>{goal.frequency === 'daily' ? 'Daily' : 'Weekly'} Target Complete! Streak Maintained 🔥</span>
                    </div>
                  ) : (
                    <div className="text-[#2D142C]/80 dark:text-white/80">
                      <span>Read </span>
                      <strong className="text-[#C85A32] font-mono">
                        {goal.targetChapters - goal.currentProgress}
                      </strong>
                      <span> more chapter{goal.targetChapters - goal.currentProgress > 1 ? 's' : ''} {goal.frequency === 'daily' ? 'today' : 'this week'} to hit your goal.</span>
                    </div>
                  )}
                </div>

                {/* Direct Log & Reset Controls */}
                <div className="w-full flex items-center gap-2 pt-1">
                  <button
                    onClick={logChapterCompleted}
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
              </div>

              {/* Right: Target Settings & Velocity Configuration */}
              <div className="lg:col-span-7 p-7 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-[#2D142C]/10 dark:border-white/10 pb-4">
                    <div>
                      <h4 className="font-display text-xl font-bold">Goal Frequency & Targets</h4>
                      <p className="text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui mt-0.5">
                        Customize how often you read and how many chapters you aim for.
                      </p>
                    </div>
                    <Target className="w-5 h-5 text-[#C85A32]" />
                  </div>

                  {/* Frequency Switcher: Daily vs Weekly */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold block font-sans-ui">Cadence</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => updateReadingGoal({ 
                          frequency: 'daily',
                          targetChapters: goal.frequency === 'daily' ? goal.targetChapters : Math.max(1, Math.round(goal.targetChapters / 5))
                        })}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          goal.frequency === 'daily'
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
                        onClick={() => updateReadingGoal({ 
                          frequency: 'weekly',
                          targetChapters: goal.frequency === 'weekly' ? goal.targetChapters : Math.max(5, goal.targetChapters * 5)
                        })}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          goal.frequency === 'weekly'
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
                      Target Chapters ({goal.frequency === 'daily' ? 'Per Day' : 'Per Week'})
                    </label>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => updateReadingGoal({ 
                          targetChapters: Math.max(1, goal.targetChapters - 1) 
                        })}
                        className="w-12 h-12 rounded-xl border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] hover:text-[#C85A32] flex items-center justify-center font-bold text-lg cursor-pointer transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div className="flex-1 py-2 px-4 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] border border-[#2D142C]/10 dark:border-white/10 text-center">
                        <div className="font-display text-2xl font-bold text-[#C85A32] tabular-nums">
                          {goal.targetChapters}
                        </div>
                        <div className="text-[10px] uppercase font-mono tracking-wider text-[#2D142C]/60 dark:text-white/60">
                          Chapters {goal.frequency === 'daily' ? 'per day' : 'per week'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateReadingGoal({ 
                          targetChapters: Math.min(goal.frequency === 'daily' ? 20 : 70, goal.targetChapters + 1) 
                        })}
                        className="w-12 h-12 rounded-xl border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] hover:text-[#C85A32] flex items-center justify-center font-bold text-lg cursor-pointer transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-[#2D142C]/50 dark:text-white/50 font-sans-ui">Quick Presets:</span>
                      {(goal.frequency === 'daily' ? [1, 2, 3, 5] : [5, 10, 15, 20]).map(preset => (
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
                  <div className="p-4 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] border border-[#2D142C]/10 dark:border-white/10 flex items-start gap-3 text-xs font-sans-ui">
                    <Sparkles className="w-4 h-4 text-[#C85A32] shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-[#2D142C]/75 dark:text-white/75">
                      <strong className="text-[#2D142C] dark:text-white block font-semibold">Reading Velocity Projection</strong>
                      <p>
                        At <span className="font-mono text-[#C85A32] font-semibold">{goal.targetChapters} chapters</span> {goal.frequency === 'daily' ? 'per day' : 'per week'}, you will spend roughly <span className="font-mono font-semibold">{goal.targetChapters * 12} mins</span> reading and finish a full 24-chapter serialized epic in ~<span className="font-mono text-[#C85A32] font-semibold">{Math.ceil(24 / (goal.frequency === 'daily' ? goal.targetChapters : goal.targetChapters / 7))} days</span>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Streak & Achievements Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 font-sans-ui">
              <div className="p-5 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#C85A32]/10 text-[#C85A32] flex items-center justify-center shrink-0">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] text-[#2D142C]/60 dark:text-white/60 block">Current Streak</span>
                  <div className="text-2xl font-bold font-display text-[#C85A32] tabular-nums">
                    {goal.streakDays} Days
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Active & burning bright
                  </span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#2D142C]/10 dark:bg-white/10 text-[#2D142C] dark:text-white flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <span className="text-[11px] text-[#2D142C]/60 dark:text-white/60 block">Personal Best</span>
                  <div className="text-2xl font-bold font-display tabular-nums">
                    {goal.bestStreakDays} Days
                  </div>
                  <span className="text-[10px] text-[#2D142C]/60 dark:text-white/60">
                    All-time record streak
                  </span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#C85A32]/10 text-[#C85A32] flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] text-[#2D142C]/60 dark:text-white/60 block">Weekly Consistency</span>
                  <div className="text-2xl font-bold font-display tabular-nums text-emerald-600">
                    86%
                  </div>
                  <span className="text-[10px] text-[#2D142C]/60 dark:text-white/60">
                    6 of last 7 days completed
                  </span>
                </div>
              </div>
            </div>

            {/* 7-Day Habit Activity Tracker */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-4">
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
                {goal.history.map((day, idx) => {
                  const isCurrentDay = idx === goal.history.length - 1;
                  const isMet = day.metTarget || (isCurrentDay && isGoalMet);
                  const count = isCurrentDay ? goal.currentProgress : day.chaptersRead;

                  return (
                    <div
                      key={day.dayName}
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

                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                        isMet
                          ? 'bg-[#C85A32] text-white shadow-xs'
                          : count > 0
                          ? 'bg-[#2D142C]/10 dark:bg-white/10 text-[#C85A32]'
                          : 'bg-[#2D142C]/5 dark:bg-white/5 text-[#2D142C]/40 dark:text-white/40'
                      }`}>
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
            <div className="p-6 rounded-2xl bg-[#F9F6F0] dark:bg-[#160C16] border border-[#2D142C]/10 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#C85A32] font-semibold">
                  The Storyteller’s Discipline
                </span>
                <p className="font-reader text-sm italic text-[#2D142C]/80 dark:text-white/80">
                  "The story is our escort; without it, we are blind."
                </p>
                <span className="text-xs text-[#2D142C]/50 dark:text-white/50 font-sans-ui block">
                  — Chinua Achebe
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
        )}

        {/* Tab 3: Bookmarks */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <h3 className="font-display text-2xl font-bold">Saved Bookmarks</h3>
            {bookmarkedChapters.length === 0 ? (
              <div className="p-8 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center text-xs text-[#2D142C]/60 dark:text-white/60">
                No bookmarked chapters yet. While reading any chapter, click the bookmark icon to save it here.
              </div>
            ) : (
              <div className="space-y-3">
                {bookmarkedChapters.map(ch => (
                  <div
                    key={ch.id}
                    onClick={() => navigate('reader', { slug: ch.storySlug, chapterNumber: ch.chapterNumber })}
                    className="p-4 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 hover:border-[#C85A32] transition-colors flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <img src={ch.storyCover} alt="" className="w-10 h-14 object-cover rounded" />
                      <div>
                        <div className="text-[11px] text-[#C85A32] font-semibold font-sans-ui">
                          {ch.storyTitle} &middot; Chapter {ch.chapterNumber}
                        </div>
                        <h4 className="font-display text-base font-bold">{ch.title}</h4>
                        <p className="text-xs text-[#2D142C]/60 dark:text-white/60 line-clamp-1 font-reader">
                          "{ch.excerpt}"
                        </p>
                      </div>
                    </div>

                    <button className="text-xs font-semibold text-[#C85A32] shrink-0">
                      Jump to Chapter &rarr;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Subscription & Paystack Ledger */}
        {activeTab === 'subscription' && (
          <div className="space-y-8">
            <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-4">
              <h3 className="font-display text-xl font-bold">Billing Status</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans-ui">
                <div className="p-4 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] space-y-1">
                  <span className="text-[#2D142C]/60 dark:text-white/60 block">Plan</span>
                  <span className="font-bold text-sm capitalize">{user.subscription.plan} Tier</span>
                </div>
                <div className="p-4 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] space-y-1">
                  <span className="text-[#2D142C]/60 dark:text-white/60 block">Status</span>
                  <span className="font-bold text-sm text-emerald-600 capitalize">
                    {user.subscription.status === 'active' ? 'Active Subscription' : 'Free Access'}
                  </span>
                </div>
                <div className="p-4 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] space-y-1">
                  <span className="text-[#2D142C]/60 dark:text-white/60 block">Payment Method</span>
                  <span className="font-bold text-sm">Paystack Nigeria (NIBSS)</span>
                </div>
              </div>
            </div>

            {/* Paystack Transactions Ledger */}
            <div className="space-y-3">
              <h4 className="font-display text-lg font-bold">Paystack Transaction Receipts</h4>
              <div className="rounded-xl border border-[#2D142C]/10 dark:border-white/10 overflow-hidden bg-white dark:bg-[#1E111E]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans-ui">
                    <thead className="bg-[#2D142C]/5 dark:bg-white/5 border-b border-[#2D142C]/10 dark:border-white/10 text-[#2D142C]/70 dark:text-white/70">
                      <tr>
                        <th className="py-3 px-4">Paystack Ref</th>
                        <th className="py-3 px-4">Item Description</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Channel</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D142C]/10 dark:divide-white/10">
                      {transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-[#2D142C]/[0.02]">
                          <td className="py-3 px-4 font-mono text-[11px] text-[#C85A32]">{tx.reference}</td>
                          <td className="py-3 px-4 font-medium">{tx.itemName}</td>
                          <td className="py-3 px-4 font-bold tabular-nums">₦{tx.amountNgn.toLocaleString('en-NG')}</td>
                          <td className="py-3 px-4 uppercase text-[10px]">{tx.channel}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Success</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#2D142C]/60 dark:text-white/60">{tx.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Reading Preferences */}
        {activeTab === 'settings' && (
          <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-6 max-w-xl">
            <h3 className="font-display text-xl font-bold">Saved Reading Preferences</h3>
            <p className="text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              These preferences will automatically apply whenever you launch any chapter on Lorethos.
            </p>

            <div className="space-y-4 text-xs font-sans-ui">
              <div>
                <label className="block font-semibold mb-1">Default Canvas Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['day', 'sepia', 'night'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateReaderSettings({ theme: t })}
                      className={`py-2 px-3 rounded border capitalize cursor-pointer ${
                        readerSettings.theme === t
                          ? 'border-[#C85A32] font-semibold text-[#C85A32]'
                          : 'border-[#2D142C]/15 dark:border-white/15'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Default Body Typeface</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['literata', 'garamond', 'sans'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => updateReaderSettings({ font: f })}
                      className={`py-2 px-3 rounded border capitalize cursor-pointer ${
                        readerSettings.font === f
                          ? 'border-[#C85A32] font-semibold text-[#C85A32]'
                          : 'border-[#2D142C]/15 dark:border-white/15'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
