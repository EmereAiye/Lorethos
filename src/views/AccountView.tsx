import React, { useState, useEffect } from 'react';
import { useApp, sanitizeInternalRedirect } from '../context/AppContext';
import {
  ShieldCheck,
  BookOpen,
  Bookmark,
  Settings,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  Flame,
  Highlighter,
  Trash2,
  LogIn,
  LogOut,
  XCircle,
  Eye,
  EyeOff,
  Award
} from 'lucide-react';
import { ReadingActivityChart } from '../components/ReadingActivityChart';
import { ReadingGoal } from '../components/ReadingGoal';
import { getDisplayName, computeReaderRank, READER_RANK_TIERS } from '../utils/readerProfile';

export const AccountView: React.FC = () => {
  const {
    user,
    isAuthenticated,
    authLoading,
    login,
    register,
    logout,
    cancelSubscription,
    stories,
    transactions,
    readerSettings,
    updateReaderSettings,
    navigate,
    buildHref,
    openPaystackCheckout,
    toggleBookmark,
    highlights,
    removeHighlight,
    paragraphBookmarks,
    removeParagraphBookmark,
    preferredGenres,
    openReadingPrompt,
    routeParams,
    pendingAuthRedirect,
    readingPromptOpen,
    completePostAuthRedirect
  } = useApp();

  const [activeTab, setActiveTab] = useState<'library' | 'goals' | 'highlights' | 'bookmarks' | 'subscription' | 'settings'>('library');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authName, setAuthName] = useState('');
  const [authNickname, setAuthNickname] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [cancelingSub, setCancelingSub] = useState(false);

  const pendingRedirectTarget = sanitizeInternalRedirect(routeParams.redirect || pendingAuthRedirect);

  useEffect(() => {
    if (isAuthenticated && !authLoading && !readingPromptOpen && pendingRedirectTarget) {
      completePostAuthRedirect();
    }
  }, [isAuthenticated, authLoading, readingPromptOpen, pendingRedirectTarget, completePostAuthRedirect]);

  const isPatron = isAuthenticated && user.subscription.status === 'active';
  const goal = user.readingGoal;
  const displayName = getDisplayName(user);
  const rank = computeReaderRank(user, stories);

  const dailyTargetForChart = goal.frequency === 'weekly'
    ? Math.max(1, Math.ceil(goal.targetChapters / 7))
    : goal.targetChapters;

  const chartHistory = (goal.history || []).map((day, idx, arr) =>
    idx === arr.length - 1
      ? { ...day, chaptersRead: goal.currentProgress, metTarget: goal.currentProgress >= dailyTargetForChart }
      : day
  );

  const unlockedStories = stories.filter(s =>
    isAuthenticated &&
    (user.unlockedStoryIds.includes(s.id) || (isPatron && s.accessTier === 'subscription') || user.role === 'owner')
  );

  const bookmarkedChapters = stories.flatMap(s =>
    s.chapters
      .filter(c => user.bookmarkedChapterIds.includes(c.id))
      .map(c => ({
        ...c,
        storyTitle: s.title,
        storySlug: s.slug,
        storyCover: s.coverImage
      }))
  );

  const handleLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    route: string,
    params?: Parameters<typeof navigate>[1]
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route, params);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthMessage(null);

    const trimmedEmail = authEmail.trim();
    const trimmedName = authName.trim();
    const trimmedNickname = authNickname.trim();

    if (authMode === 'signup' && trimmedName.length < 2) {
      setAuthError('Full name must be at least 2 characters.');
      return;
    }
    if (authMode === 'signup' && (trimmedNickname.length < 2 || trimmedNickname.length > 40)) {
      setAuthError('Nickname must be between 2 and 40 characters.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (!authPassword) {
      setAuthError('Please enter your password.');
      return;
    }
    if (authMode === 'signup' && authPassword.length < 8) {
      setAuthError('Password must be at least 8 characters long.');
      return;
    }

    setAuthSubmitting(true);

    try {
      const res =
        authMode === 'signin'
          ? await login(trimmedEmail, authPassword)
          : await register(trimmedName, trimmedEmail, authPassword, trimmedNickname);

      if (res.error) {
        setAuthError(res.error);
      } else if (res.requiresEmailVerification) {
        setAuthMessage(res.message || 'Account created! Check your email to confirm your address before signing in.');
        setAuthPassword('');
        setAuthMode('signin');
      } else {
        setAuthMessage(res.message || (authMode === 'signin' ? 'Signed in successfully.' : 'Account created and signed in.'));
        setAuthPassword('');
      }
    } catch (err) {
      setAuthError(err instanceof Error && err.message ? err.message : 'Unable to complete authentication. Please try again.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-12 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* Account Banner or Sign-In Card */}
        {!isAuthenticated ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#C85A32] font-sans-ui">
                Reader Account
              </span>
              <h1 className="font-display text-3xl font-bold">
                {authMode === 'signin' ? 'Sign In to Lorethos' : 'Create Your Lorethos Account'}
              </h1>
              <p className="font-reader text-sm text-[#2D142C]/75 dark:text-white/75 leading-relaxed">
                Sign in to unlock paid chapters after checkout, keep bookmarks and reading progress across devices, and post chapter notes.
              </p>
              {pendingRedirectTarget && (
                <div className="p-3 rounded-lg bg-[#C85A32]/10 border border-[#C85A32]/25 text-xs font-sans-ui text-[#2D142C] dark:text-[#F9F6F0]">
                  Sign in or create an account to continue back to <span className="font-semibold">{pendingRedirectTarget}</span>.
                </div>
              )}
              {authLoading && (
                <p className="text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                  Checking session...
                </p>
              )}
            </div>

            <form onSubmit={handleAuthSubmit} noValidate className="lg:col-span-6 space-y-3 text-xs font-sans-ui">
              <div className="flex gap-2 border-b border-current/10 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthError(null);
                    setAuthMessage(null);
                  }}
                  className={`px-3 py-1.5 rounded font-semibold cursor-pointer ${
                    authMode === 'signin' ? 'bg-[#C85A32] text-white' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError(null);
                    setAuthMessage(null);
                  }}
                  className={`px-3 py-1.5 rounded font-semibold cursor-pointer ${
                    authMode === 'signup' ? 'bg-[#C85A32] text-white' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {authMode === 'signup' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="auth-name" className="block font-semibold mb-1">
                      Full Name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full px-3 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-nickname" className="block font-semibold mb-1">
                      Nickname <span className="font-normal opacity-65">(Displayed publicly)</span>
                    </label>
                    <input
                      id="auth-nickname"
                      type="text"
                      required
                      minLength={2}
                      maxLength={40}
                      autoComplete="nickname"
                      value={authNickname}
                      onChange={(e) => setAuthNickname(e.target.value)}
                      placeholder="e.g. BronzeScribe"
                      className="w-full px-3 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block font-semibold mb-1">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block font-semibold mb-1">
                  {authMode === 'signup' ? 'Password (min. 8 characters)' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={authMode === 'signup' ? 8 : undefined}
                    autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-3 pr-10 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#2D142C]/55 dark:text-white/55 hover:text-[#C85A32] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300"
                >
                  {authError}
                </div>
              )}
              {authMessage && (
                <div
                  role="status"
                  className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
                >
                  {authMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-2.5 bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>
                  {authSubmitting
                    ? 'Please wait...'
                    : authMode === 'signin'
                    ? 'Sign In'
                    : 'Create Account'}
                </span>
              </button>
            </form>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#2D142C] text-[#F9F6F0] flex items-center justify-center font-display text-2xl font-bold border-2 border-[#C85A32]">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl font-bold">{displayName}</h1>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#C85A32]/15 text-[#C85A32] border border-[#C85A32]/30 px-2 py-0.5 rounded font-sans-ui">
                    <Award className="w-3 h-3" />
                    <span>Rank {rank.roman} &middot; {rank.title}</span>
                  </span>
                  {user.role === 'owner' && (
                    <span className="text-[11px] font-semibold bg-[#2D142C] text-white px-2 py-0.5 rounded font-sans-ui">
                      Publisher (Owner)
                    </span>
                  )}
                  {isPatron ? (
                    <span className="text-[11px] font-semibold bg-[#C85A32] text-white px-2 py-0.5 rounded font-sans-ui">
                      Active Subscriber
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold bg-[#2D142C]/10 dark:bg-white/10 text-[#2D142C]/75 dark:text-white/75 px-2 py-0.5 rounded font-sans-ui">
                      Free Account
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                  {user.nickname && user.nickname.trim() !== user.name.trim()
                    ? `${user.name} · ${user.email}`
                    : user.email}
                </p>
                {preferredGenres.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-sans-ui">
                    <span className="opacity-65">Reading mood:</span>
                    {preferredGenres.map((genre) => (
                      <span
                        key={genre}
                        className="px-2 py-0.5 rounded bg-[#C85A32]/10 text-[#C85A32] font-medium"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openReadingPrompt}
                className="px-3.5 py-2 rounded-lg border border-[#C85A32]/35 text-[#C85A32] text-xs font-semibold hover:bg-[#C85A32] hover:text-white transition-colors cursor-pointer"
              >
                {preferredGenres.length > 0 ? 'Reading Preferences' : 'What Do You Want to Read?'}
              </button>
              {user.role === 'owner' && (
                <a
                  href={buildHref('admin')}
                  onClick={(e) => handleLink(e, 'admin')}
                  className="px-4 py-2 rounded-lg border border-[#C85A32] text-[#C85A32] text-xs font-semibold hover:bg-[#C85A32] hover:text-white transition-colors"
                >
                  Open Publishing Desk
                </a>
              )}

              {!isPatron && (
                <button
                  type="button"
                  onClick={() =>
                    openPaystackCheckout({
                      type: 'subscription',
                      title: 'Patron Monthly Subscription',
                      amountNgn: 3500,
                      planId: 'monthly'
                    })
                  }
                  className="px-4 py-2 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Upgrade Monthly (₦3,500/mo)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => void logout()}
                className="px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-red-500 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Reader Rank & Completion Progress */}
        <section className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs space-y-4 font-sans-ui">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#C85A32]/15 text-[#C85A32] border border-[#C85A32]/30 flex items-center justify-center font-display text-lg font-bold shrink-0">
                {rank.roman}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#C85A32]">
                  Reader Rank &amp; Completion
                </div>
                <h2 className="font-display text-xl font-bold">
                  {rank.title}
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="font-mono font-bold text-base text-[#C85A32]">{rank.completedChapters}</span>
                <span className="opacity-70 ml-1">
                  / {rank.totalCatalogChapters} chapters completed ({rank.completionPercent}%)
                </span>
              </div>
              <div className="px-2.5 py-1 rounded bg-[#2D142C]/5 dark:bg-white/5 font-medium">
                {rank.completedStories} {rank.completedStories === 1 ? 'series' : 'series'} finished
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium opacity-75">
                {rank.nextTitle
                  ? `${rank.remainingToNext} more ${rank.remainingToNext === 1 ? 'chapter' : 'chapters'} to unlock Rank ${READER_RANK_TIERS.find((t) => t.title === rank.nextTitle)?.roman}: ${rank.nextTitle}`
                  : 'Highest Lorethos Reader Rank unlocked'}
              </span>
              <span className="font-mono font-semibold text-[#C85A32]">{rank.progressToNextPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#2D142C]/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#C85A32] transition-all duration-300"
                style={{ width: `${rank.progressToNextPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
            {READER_RANK_TIERS.map((tier) => {
              const unlocked = rank.completedChapters >= tier.minChapters;
              const isCurrent = rank.level === tier.level;
              return (
                <div
                  key={tier.level}
                  className={`p-2.5 rounded-lg border text-[11px] transition-colors ${
                    isCurrent
                      ? 'border-[#C85A32] bg-[#C85A32]/10'
                      : unlocked
                      ? 'border-emerald-600/30 bg-emerald-600/5'
                      : 'border-current/10 opacity-55'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono font-bold">
                    <span>Rank {tier.roman}</span>
                    <span>{tier.minChapters}+ ch</span>
                  </div>
                  <div className="font-semibold truncate mt-0.5">{tier.title}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Reading Goal Banner */}
        <ReadingGoal variant="banner" onOpenSettings={() => setActiveTab('goals')} />

        {/* Tab Navigation */}
        <div className="flex border-b border-[#2D142C]/10 dark:border-white/10 gap-2 font-sans-ui text-xs font-medium overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'library'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>My Library ({unlockedStories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('goals')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'goals'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Reading Goal &amp; Streak</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('highlights')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'highlights'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Highlights &amp; Notes ({highlights.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bookmarks')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'bookmarks'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Bookmarks ({bookmarkedChapters.length + paragraphBookmarks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('subscription')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'subscription'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Subscription &amp; Receipts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'settings'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Preferences</span>
          </button>
        </div>

        {/* Tab 1: My Library */}
        {activeTab === 'library' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">Unlocked Stories</h2>
                <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                  Titles available for full reading on your account.
                </p>
              </div>
              <a
                href={buildHref('stories')}
                onClick={(e) => handleLink(e, 'stories')}
                className="text-xs font-semibold text-[#C85A32] hover:underline"
              >
                Browse Catalog &rarr;
              </a>
            </div>

            {unlockedStories.length === 0 ? (
              <div className="p-8 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center space-y-3">
                <BookOpen className="w-8 h-8 mx-auto text-[#C85A32]/60" />
                <h3 className="font-display text-lg font-bold">No Unlocked Paid Works Yet</h3>
                <p className="text-xs text-[#2D142C]/65 dark:text-white/65 max-w-sm mx-auto">
                  Start reading free opening chapters or subscribe to unlock all published chapters across series.
                </p>
                <a
                  href={buildHref('pricing')}
                  onClick={(e) => handleLink(e, 'pricing')}
                  className="inline-block px-4 py-2 bg-[#C85A32] text-white text-xs font-semibold rounded-lg hover:bg-[#b04d28]"
                >
                  View Membership Plans
                </a>
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
                          loading="lazy"
                          className="w-16 h-22 object-cover rounded shadow-xs shrink-0"
                        />
                        <div className="space-y-1 min-w-0">
                          <span className="text-[10px] uppercase font-bold text-[#C85A32] font-sans-ui">
                            {story.genre}
                          </span>
                          <h3 className="font-display text-base font-bold truncate">
                            {story.title}
                          </h3>
                          <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                            By {story.author}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-[#2D142C]/10 dark:border-white/10">
                        <div className="flex justify-between text-xs font-sans-ui">
                          <span className="text-[#2D142C]/65 dark:text-white/65">
                            Current: Ch. {currentCh} of {story.chapters.length}
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

                      <a
                        href={buildHref('reader', { slug: story.slug, chapterNumber: currentCh })}
                        onClick={(e) => handleLink(e, 'reader', { slug: story.slug, chapterNumber: currentCh })}
                        className="w-full py-2 bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] text-xs font-semibold rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                      >
                        <span>Resume Reading</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-4">
              <ReadingActivityChart
                history={chartHistory}
                dailyTarget={dailyTargetForChart}
                theme={readerSettings.theme}
                onConfigureGoal={() => setActiveTab('goals')}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Reading Goals */}
        {activeTab === 'goals' && <ReadingGoal variant="full" />}

        {/* Tab 3: Highlights */}
        {activeTab === 'highlights' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">Highlights &amp; Margin Notes</h2>
                <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                  Passages saved while reading chapters.
                </p>
              </div>
              <a
                href={buildHref('stories')}
                onClick={(e) => handleLink(e, 'stories')}
                className="text-xs font-semibold text-[#C85A32] hover:underline"
              >
                Open Library &rarr;
              </a>
            </div>

            {highlights.length === 0 ? (
              <div className="p-8 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center text-xs text-[#2D142C]/65 dark:text-white/65 space-y-2">
                <Highlighter className="w-7 h-7 mx-auto text-[#C85A32]/60" />
                <p>No highlights saved yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {highlights.map(hl => (
                  <div
                    key={hl.id}
                    className="p-5 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 border-l-4 border-l-[#C85A32] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs font-sans-ui">
                      <div>
                        <span className="font-semibold text-[#C85A32]">{hl.storyTitle}</span>
                        <span className="mx-1.5 opacity-40">&middot;</span>
                        <span>Ch. {hl.chapterNumber}: {hl.chapterTitle}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeHighlight(hl.id)}
                        aria-label="Delete highlight"
                        className="opacity-65 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <blockquote className="font-reader text-sm italic">
                      &ldquo;{hl.excerpt}&rdquo;
                    </blockquote>
                    {hl.note && (
                      <div className="p-3 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] text-xs font-sans-ui">
                        <strong className="text-[#C85A32] mr-1.5">Note:</strong>
                        <span>{hl.note}</span>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <a
                        href={buildHref('reader', { slug: hl.storySlug, chapterNumber: hl.chapterNumber })}
                        onClick={(e) => handleLink(e, 'reader', { slug: hl.storySlug, chapterNumber: hl.chapterNumber })}
                        className="text-xs font-semibold text-[#C85A32] hover:underline"
                      >
                        Open Chapter {hl.chapterNumber} &rarr;
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Saved Bookmarks */}
        {activeTab === 'bookmarks' && (
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold">Marked Passages &amp; Sections</h2>
                  <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                    Specific paragraphs and named story moments saved while reading.
                  </p>
                </div>
                <span className="text-xs font-mono opacity-65 tabular-nums">
                  {paragraphBookmarks.length} saved
                </span>
              </div>

              {paragraphBookmarks.length === 0 ? (
                <div className="p-8 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center text-xs text-[#2D142C]/65 dark:text-white/65 space-y-2">
                  <Bookmark className="w-7 h-7 mx-auto text-[#C85A32]/60" />
                  <p>No bookmarked paragraphs or sections yet. Select Bookmark beside any paragraph in the reader to save it for quick reference.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#2D142C]/10 dark:divide-white/10 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 overflow-hidden">
                  {paragraphBookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-sans-ui">
                          <span className="font-semibold text-[#C85A32]">{bm.storyTitle}</span>
                          <span className="opacity-40">&middot;</span>
                          <span className="tabular-nums">Ch. {bm.chapterNumber}</span>
                          <span className="opacity-40">&middot;</span>
                          <span className="font-mono tabular-nums opacity-75">Para. {bm.paragraphIndex + 1}</span>
                          {bm.createdAt && (
                            <>
                              <span className="opacity-40">&middot;</span>
                              <span className="opacity-60">{bm.createdAt}</span>
                            </>
                          )}
                        </div>
                        {bm.label && (
                          <h3 className="font-display text-base font-bold">{bm.label}</h3>
                        )}
                        <blockquote className="font-reader text-sm italic text-[#2D142C]/80 dark:text-white/80 line-clamp-2">
                          &ldquo;{bm.excerpt}&rdquo;
                        </blockquote>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 sm:pt-1">
                        <a
                          href={buildHref('reader', {
                            slug: bm.storySlug,
                            chapterNumber: bm.chapterNumber,
                            paragraph: bm.paragraphIndex
                          })}
                          onClick={(e) =>
                            handleLink(e, 'reader', {
                              slug: bm.storySlug,
                              chapterNumber: bm.chapterNumber,
                              paragraph: bm.paragraphIndex
                            })
                          }
                          className="text-xs font-semibold text-[#C85A32] hover:underline whitespace-nowrap"
                        >
                          Jump to Passage &rarr;
                        </a>
                        <button
                          type="button"
                          onClick={() => removeParagraphBookmark(bm.id)}
                          aria-label={`Remove bookmark in ${bm.storyTitle} Chapter ${bm.chapterNumber} Paragraph ${bm.paragraphIndex + 1}`}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="font-display text-2xl font-bold">Bookmarked Chapters</h2>
              {bookmarkedChapters.length === 0 ? (
                <div className="p-8 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center text-xs text-[#2D142C]/65 dark:text-white/65">
                  No bookmarked chapters yet. Open Bookmarks in the reader toolbar to save a whole chapter here.
                </div>
              ) : (
                <div className="space-y-3">
                  {bookmarkedChapters.map(ch => (
                    <div
                      key={ch.id}
                      className="p-4 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <img src={ch.storyCover} alt="" loading="lazy" className="w-10 h-14 object-cover rounded shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[11px] text-[#C85A32] font-semibold font-sans-ui">
                            {ch.storyTitle} &middot; Chapter {ch.chapterNumber}
                          </div>
                          <h3 className="font-display text-base font-bold truncate">{ch.title}</h3>
                          <p className="text-xs text-[#2D142C]/65 dark:text-white/65 line-clamp-1 font-reader">
                            &ldquo;{ch.excerpt}&rdquo;
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <a
                          href={buildHref('reader', { slug: ch.storySlug, chapterNumber: ch.chapterNumber })}
                          onClick={(e) => handleLink(e, 'reader', { slug: ch.storySlug, chapterNumber: ch.chapterNumber })}
                          className="text-xs font-semibold text-[#C85A32] hover:underline whitespace-nowrap"
                        >
                          Open Chapter &rarr;
                        </a>
                        <button
                          type="button"
                          onClick={() => toggleBookmark(ch.id)}
                          aria-label={`Remove bookmark for ${ch.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Subscription & Receipts */}
        {activeTab === 'subscription' && (
          <div className="space-y-8">
            <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display text-xl font-bold">Membership Status</h2>
                {isPatron && (
                  <button
                    type="button"
                    disabled={cancelingSub}
                    onClick={async () => {
                      setCancelingSub(true);
                      await cancelSubscription();
                      setCancelingSub(false);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-500/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{cancelingSub ? 'Canceling...' : 'Cancel Subscription'}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans-ui">
                <div className="p-4 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] space-y-1">
                  <span className="text-[#2D142C]/60 dark:text-white/60 block">Plan</span>
                  <span className="font-bold text-sm capitalize">{user.subscription.plan} Tier</span>
                </div>
                <div className="p-4 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] space-y-1">
                  <span className="text-[#2D142C]/60 dark:text-white/60 block">Status</span>
                  <span className="font-bold text-sm capitalize">
                    {isPatron ? 'Active' : user.subscription.status === 'expired' ? 'Canceled' : 'Free Access'}
                  </span>
                </div>
                <div className="p-4 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] space-y-1">
                  <span className="text-[#2D142C]/60 dark:text-white/60 block">Payment Provider</span>
                  <span className="font-bold text-sm">Paystack Hosted Checkout</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-display text-lg font-bold">Payment Receipts</h3>
              {transactions.length === 0 ? (
                <div className="p-6 rounded-xl border border-[#2D142C]/10 dark:border-white/10 bg-white dark:bg-[#1E111E] text-xs text-[#2D142C]/65 dark:text-white/65">
                  No verified transactions recorded on this account yet.
                </div>
              ) : (
                <div className="rounded-xl border border-[#2D142C]/10 dark:border-white/10 overflow-hidden bg-white dark:bg-[#1E111E]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans-ui">
                      <thead className="bg-[#2D142C]/5 dark:bg-white/5 border-b border-[#2D142C]/10 dark:border-white/10 text-[#2D142C]/70 dark:text-white/70">
                        <tr>
                          <th className="py-3 px-4">Reference</th>
                          <th className="py-3 px-4">Item</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2D142C]/10 dark:divide-white/10">
                        {transactions.map(tx => (
                          <tr key={tx.id}>
                            <td className="py-3 px-4 font-mono text-[11px] text-[#C85A32]">{tx.reference}</td>
                            <td className="py-3 px-4 font-medium">{tx.itemName}</td>
                            <td className="py-3 px-4 font-bold tabular-nums">₦{tx.amountNgn.toLocaleString('en-NG')}</td>
                            <td className="py-3 px-4 capitalize">
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{tx.status}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#2D142C]/65 dark:text-white/65">
                              {new Date(tx.date).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 6: Preferences */}
        {activeTab === 'settings' && (
          <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-6 max-w-2xl">
            <h2 className="font-display text-xl font-bold">Default Reading Preferences</h2>

            <div className="space-y-4 text-xs font-sans-ui">
              <div>
                <span className="block font-semibold mb-2">Default Color Theme</span>
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
                <span className="block font-semibold mb-2">Default Typeface</span>
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
