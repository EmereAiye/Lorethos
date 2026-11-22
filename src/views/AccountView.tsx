import React, { useState, useEffect } from 'react';
import { useApp, sanitizeInternalRedirect } from '../context/AppContext';
import { ReaderAvatar } from '../components/ReaderAvatar';
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
  Award,
  BarChart3,
  Search,
  Pencil,
  Check,
  X,
  MessageSquare,
  Feather,
  Users,
  Trophy,
  Mail,
  RefreshCw,
  KeyRound,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ReadingStatisticsDashboard } from '../components/ReadingStatisticsDashboard';
import { ReadingGoal } from '../components/ReadingGoal';
import { ReadingLeaderboardSection } from '../components/ReadingLeaderboardSection';
import { getDisplayName, computeReaderRank, READER_RANK_TIERS } from '../utils/readerProfile';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { canAccessWriterStudio } from '../lib/writerStories';

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
    updateHighlight,
    removeHighlight,
    paragraphBookmarks,
    removeParagraphBookmark,
    preferredGenres,
    openReadingPrompt,
    routeParams,
    pendingAuthRedirect,
    readingPromptOpen,
    completePostAuthRedirect,
    refreshUserRole,
    checkEmailVerificationStatus,
    requestEmailVerification,
    confirmEmailVerificationCode
  } = useApp();

  const [activeTab, setActiveTab] = useState<'library' | 'stats' | 'goals' | 'leaderboard' | 'highlights' | 'bookmarks' | 'subscription' | 'settings'>('library');
  const [hlSearch, setHlSearch] = useState('');
  const [hlColorFilter, setHlColorFilter] = useState<'all' | 'terracotta' | 'gold' | 'sage'>('all');
  const [hlNotesOnly, setHlNotesOnly] = useState(false);
  const [editingHlId, setEditingHlId] = useState<string | null>(null);
  const [editingHlNote, setEditingHlNote] = useState('');
  const [editingHlColor, setEditingHlColor] = useState<'terracotta' | 'gold' | 'sage'>('terracotta');
  const [savingHlEdit, setSavingHlEdit] = useState(false);
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
  const [needsSupabaseReauth, setNeedsSupabaseReauth] = useState(
    routeParams.reauth === '1' && isSupabaseConfigured
  );
  const [reauthChecked, setReauthChecked] = useState(
    !(routeParams.reauth === '1' && isSupabaseConfigured)
  );
  const [emailVerifyExpanded, setEmailVerifyExpanded] = useState(false);
  const [checkingEmailVerify, setCheckingEmailVerify] = useState(false);
  const [sendingEmailVerify, setSendingEmailVerify] = useState(false);
  const [confirmingEmailVerify, setConfirmingEmailVerify] = useState(false);
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [showVerifyCodeEntry, setShowVerifyCodeEntry] = useState(false);
  const [emailVerifyDeliveryMode, setEmailVerifyDeliveryMode] = useState<'email' | 'supabase' | 'preview' | null>(null);
  const [emailVerifyPreviewCode, setEmailVerifyPreviewCode] = useState<string | null>(null);
  const [emailVerifyFeedback, setEmailVerifyFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const pendingRedirectTarget = sanitizeInternalRedirect(routeParams.redirect || pendingAuthRedirect);

  useEffect(() => {
    const validTabs = new Set([
      'library',
      'stats',
      'goals',
      'leaderboard',
      'highlights',
      'bookmarks',
      'subscription',
      'settings',
    ]);
    if (routeParams.tab && validTabs.has(routeParams.tab)) {
      setActiveTab(
        routeParams.tab as
          | 'library'
          | 'stats'
          | 'goals'
          | 'leaderboard'
          | 'highlights'
          | 'bookmarks'
          | 'subscription'
          | 'settings'
      );
    }
    if (
      routeParams.verify === '1' ||
      (typeof window !== 'undefined' && window.location.hash === '#email-verification')
    ) {
      setActiveTab('settings');
      setEmailVerifyExpanded(true);
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          document.getElementById('email-verification')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    }
  }, [routeParams.tab, routeParams.verify]);

  useEffect(() => {
    const sb = supabase;
    if (routeParams.reauth !== '1' || !isSupabaseConfigured || !sb) {
      setNeedsSupabaseReauth(false);
      setReauthChecked(true);
      return;
    }

    let cancelled = false;
    const verifySupabaseSession = async () => {
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      const missing = !data.session?.user;
      setNeedsSupabaseReauth(missing);
      setReauthChecked(true);
      if (missing && user.email) {
        setAuthEmail((prev) => prev || user.email);
      }
    };
    void verifySupabaseSession();

    const sub = sb.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session?.user) {
        setNeedsSupabaseReauth(false);
      }
    });

    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, [routeParams.reauth, user.email]);

  useEffect(() => {
    if (
      isAuthenticated &&
      !authLoading &&
      !readingPromptOpen &&
      reauthChecked &&
      !needsSupabaseReauth &&
      pendingRedirectTarget
    ) {
      completePostAuthRedirect();
    }
  }, [
    isAuthenticated,
    authLoading,
    readingPromptOpen,
    reauthChecked,
    needsSupabaseReauth,
    pendingRedirectTarget,
    completePostAuthRedirect
  ]);

  useEffect(() => {
    if (isAuthenticated) {
      void refreshUserRole();
    }
  }, [isAuthenticated, refreshUserRole]);

  const isPatron = isAuthenticated && user.subscription.status === 'active';
  const hasWriterAccess = isAuthenticated && canAccessWriterStudio(user.role);
  const isOwner = isAuthenticated && user.role === 'owner';
  const isWriterOrAdmin = isAuthenticated && (user.role === 'writer' || user.role === 'admin');
  const displayName = getDisplayName(user);
  const rank = computeReaderRank(user, stories);

  const unlockedStories = stories.filter(s =>
    isAuthenticated &&
    (isOwner ||
      (isWriterOrAdmin && !s.writerRequiresPurchase) ||
      user.unlockedStoryIds.includes(s.id) ||
      (isPatron && s.accessTier === 'subscription'))
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

  const handleCheckEmailVerification = async (expandOnCheck = true) => {
    if (expandOnCheck) {
      setEmailVerifyExpanded(true);
    }
    setCheckingEmailVerify(true);
    const result = await checkEmailVerificationStatus();
    setCheckingEmailVerify(false);
    if (result.error) {
      setEmailVerifyFeedback({ type: 'error', text: result.error });
    } else if (result.verified) {
      setEmailVerifyFeedback({
        type: 'success',
        text: result.message || 'Confirmed: your email address is verified.',
      });
    } else {
      setEmailVerifyFeedback({
        type: 'info',
        text: 'Your email is not verified yet. Request a verification email or enter your 6-digit code below.',
      });
    }
  };

  const handleToggleEmailVerificationSpot = async () => {
    const nextExpanded = !emailVerifyExpanded;
    setEmailVerifyExpanded(nextExpanded);
    if (nextExpanded) {
      await handleCheckEmailVerification(false);
    }
  };

  const handleOpenEmailVerificationInSettings = async () => {
    setActiveTab('settings');
    setEmailVerifyExpanded(true);
    await handleCheckEmailVerification(false);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('email-verification')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  };

  const handleSendVerificationEmail = async () => {
    setSendingEmailVerify(true);
    setEmailVerifyFeedback(null);
    const res = await requestEmailVerification();
    setSendingEmailVerify(false);

    if (!res.ok) {
      setEmailVerifyFeedback({
        type: 'error',
        text: res.error || 'Could not send verification email.',
      });
      return;
    }

    if (res.alreadyVerified) {
      setEmailVerifyPreviewCode(null);
      setEmailVerifyFeedback({
        type: 'success',
        text: res.message || 'Your email address is already verified.',
      });
      return;
    }

    if (res.deliveryMode) {
      setEmailVerifyDeliveryMode(res.deliveryMode);
    }
    if (res.deliveryMode === 'preview' && res.previewCode) {
      setEmailVerifyPreviewCode(res.previewCode);
      setShowVerifyCodeEntry(true);
    } else if (res.deliveryMode === 'email') {
      setEmailVerifyPreviewCode(null);
      setShowVerifyCodeEntry(true);
    } else {
      setEmailVerifyPreviewCode(null);
    }

    setEmailVerifyFeedback({
      type: 'info',
      text: res.message || 'Verification instructions sent.',
    });
  };

  const handleConfirmVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmingEmailVerify(true);
    setEmailVerifyFeedback(null);
    const res = await confirmEmailVerificationCode(emailVerifyCode);
    setConfirmingEmailVerify(false);

    if (!res.ok) {
      setEmailVerifyFeedback({
        type: 'error',
        text: res.error || 'Invalid or expired verification code.',
      });
      return;
    }

    setEmailVerifyCode('');
    setEmailVerifyPreviewCode(null);
    setShowVerifyCodeEntry(false);
    setEmailVerifyFeedback({
      type: 'success',
      text: res.message || 'Email verified successfully!',
    });
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
        {!isAuthenticated || needsSupabaseReauth ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#C85A32] font-sans-ui">
                Reader Account
              </span>
              <h1 className="font-display text-3xl font-bold">
                {authMode === 'signin' ? 'Sign In to Lorethos' : 'Create Your Lorethos Account'}
              </h1>
              <p className="font-reader text-sm text-[#2D142C]/75 dark:text-white/75 leading-relaxed">
                {needsSupabaseReauth
                  ? 'Please sign in with your email and password to connect your session for story likes and chapter comments.'
                  : 'Sign in to unlock paid chapters after checkout, keep bookmarks and reading progress across devices, and post chapter notes.'}
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
              {authMode === 'signup' && (
                <p className="text-[11px] opacity-65 text-center leading-relaxed pt-1">
                  You can begin reading immediately and verify your email anytime later in Account &rarr; Settings.
                </p>
              )}
            </form>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[#2D142C] text-[#F9F6F0] flex items-center justify-center font-display text-2xl font-bold border-2 border-[#C85A32] shrink-0">
                <ReaderAvatar
                  src={user.avatar}
                  name={displayName}
                  initialClassName="font-display text-2xl font-bold select-none leading-none"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl font-bold">{displayName}</h1>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#C85A32]/15 text-[#C85A32] border border-[#C85A32]/30 px-2 py-0.5 rounded font-sans-ui">
                    <Award className="w-3 h-3" />
                    <span>{rank.title}</span>
                  </span>
                  {isOwner && (
                    <span className="text-[11px] font-semibold bg-[#2D142C] text-white px-2 py-0.5 rounded font-sans-ui">
                      Publisher (Owner &middot; Writer &amp; Reader)
                    </span>
                  )}
                  {!isOwner && user.role === 'writer' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] px-2 py-0.5 rounded font-sans-ui">
                      <Feather className="w-3 h-3 text-[#C85A32]" />
                      <span>Approved Writer</span>
                    </span>
                  )}
                  {!isOwner && user.role === 'admin' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] px-2 py-0.5 rounded font-sans-ui">
                      <Feather className="w-3 h-3 text-[#C85A32]" />
                      <span>Editorial Admin</span>
                    </span>
                  )}
                  {isOwner ? (
                    <span className="text-[11px] font-semibold bg-[#C85A32] text-white px-2 py-0.5 rounded font-sans-ui">
                      Total All-Access
                    </span>
                  ) : isWriterOrAdmin ? (
                    <span className="text-[11px] font-semibold bg-emerald-700 text-white px-2 py-0.5 rounded font-sans-ui">
                      Writer Complimentary Access
                    </span>
                  ) : isPatron ? (
                    <span className="text-[11px] font-semibold bg-[#C85A32] text-white px-2 py-0.5 rounded font-sans-ui">
                      Active Subscriber
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold bg-[#2D142C]/10 dark:bg-white/10 text-[#2D142C]/75 dark:text-white/75 px-2 py-0.5 rounded font-sans-ui">
                      Free Account
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                  <span>
                    {user.nickname && user.nickname.trim() !== user.name.trim()
                      ? `${user.name} · ${user.email}`
                      : user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleOpenEmailVerificationInSettings()}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[11px] transition-colors cursor-pointer ${
                      user.emailVerified
                        ? 'bg-emerald-600/12 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/20'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25'
                    }`}
                  >
                    {user.emailVerified ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Email Verified</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        <span>Not Verified · Check Settings</span>
                      </>
                    )}
                  </button>
                </div>
                {user.bio && (
                  <p className="text-xs font-reader text-[#2D142C]/80 dark:text-white/80 max-w-xl pt-0.5">
                    {user.bio}
                  </p>
                )}
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
              <a
                href={buildHref('profile')}
                onClick={(e) => handleLink(e, 'profile')}
                className="px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] hover:text-[#C85A32] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Pencil className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Edit Profile</span>
              </a>
              <button
                type="button"
                onClick={openReadingPrompt}
                className="px-3.5 py-2 rounded-lg border border-[#C85A32]/35 text-[#C85A32] text-xs font-semibold hover:bg-[#C85A32] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {preferredGenres.length > 0 ? 'Reading Preferences' : 'What Do You Want to Read?'}
              </button>
              {hasWriterAccess && (
                <a
                  href={buildHref('writer')}
                  onClick={(e) => handleLink(e, 'writer')}
                  className="px-4 py-2 rounded-lg bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] hover:bg-[#C85A32] dark:hover:bg-[#C85A32] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Feather className="w-3.5 h-3.5 text-[#C85A32] group-hover:text-white" />
                  <span>Open Writer Studio</span>
                </a>
              )}
              {isOwner && (
                <a
                  href={buildHref('admin')}
                  onClick={(e) => handleLink(e, 'admin')}
                  className="px-4 py-2 rounded-lg border border-[#C85A32] text-[#C85A32] text-xs font-semibold hover:bg-[#C85A32] hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  Open Publishing Desk
                </a>
              )}
              {isOwner && (
                <a
                  href={buildHref('admin', { tab: 'users' })}
                  onClick={(e) => handleLink(e, 'admin', { tab: 'users' })}
                  className="px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] hover:text-[#C85A32] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Users className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>All Profiles &amp; Writers</span>
                </a>
              )}

              {!isPatron && !isOwner && !isWriterOrAdmin && (
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
                  className="px-4 py-2 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Upgrade Monthly (₦3,500/mo)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => void logout()}
                className="px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-red-500 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {hasWriterAccess && (
          <section
            aria-label="Writer Studio dashboard access"
            className="rounded-2xl border border-[#C85A32]/35 bg-[#2D142C] text-[#F9F6F0] p-6 sm:p-7 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6"
          >
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-sans-ui font-semibold uppercase tracking-[0.18em] text-[#C85A32]">
                <Feather className="w-3.5 h-3.5" />
                <span>{isOwner ? 'Owner Publishing & Writer Portal' : 'Approved Writer Portal'}</span>
                <span className="opacity-40">&middot;</span>
                <span>Role: {user.role}</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Your Private Writer Studio Desk
              </h2>
              <p className="font-reader text-xs sm:text-sm text-white/80 leading-relaxed">
                {isOwner
                  ? 'Switch between your personal Writer Studio, your Reading Library, and the Owner Profiles Directory to manage all readers and upgraded writers.'
                  : 'Your account is approved for publishing. Jump straight back into your Writer Studio anytime from your dashboard to write stories, upload audio trailers, and manage published works.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0 font-sans-ui">
              <a
                href={buildHref('writer')}
                onClick={(e) => handleLink(e, 'writer')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Feather className="w-4 h-4" />
                <span>Open Writer Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              {isOwner && (
                <a
                  href={buildHref('admin', { tab: 'users' })}
                  onClick={(e) => handleLink(e, 'admin', { tab: 'users' })}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/25 hover:border-[#C85A32] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <Users className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>Manage All Profiles &amp; Writers</span>
                </a>
              )}
            </div>
          </section>
        )}

        {/* Literary Distinction & Completion Progress */}
        <section className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs space-y-4 font-sans-ui">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#C85A32]/15 text-[#C85A32] border border-[#C85A32]/30 flex items-center justify-center font-display text-lg font-bold shrink-0">
                {rank.roman}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#C85A32]">
                  Literary Distinction &amp; Completion
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
                  ? `${rank.remainingToNext} more ${rank.remainingToNext === 1 ? 'chapter' : 'chapters'} to unlock ${rank.nextTitle}`
                  : 'Highest Lorethos Literary Distinction unlocked'}
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
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
                    <span className="text-[#C85A32]">{tier.roman}</span>
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
            onClick={() => setActiveTab('stats')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'stats'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Reading Statistics</span>
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
            onClick={() => setActiveTab('leaderboard')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'leaderboard'
                ? 'border-[#C85A32] text-[#C85A32] font-semibold'
                : 'border-transparent text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Leaderboard</span>
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
            <span>Settings &amp; Preferences</span>
            {!user.emailVerified && (
              <span
                title="Email verification pending"
                className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
              />
            )}
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
              <ReadingStatisticsDashboard
                user={user}
                stories={stories}
                theme={readerSettings.theme}
                onBrowseStories={() => navigate('stories')}
                onConfigureGoal={() => setActiveTab('goals')}
                showSeriesTable={false}
              />
            </div>
          </div>
        )}

        {/* Tab 1b: Full Reading Statistics */}
        {activeTab === 'stats' && (
          <ReadingStatisticsDashboard
            user={user}
            stories={stories}
            theme={readerSettings.theme}
            onBrowseStories={() => navigate('stories')}
            onConfigureGoal={() => setActiveTab('goals')}
            showSeriesTable
          />
        )}

        {/* Tab 2: Reading Goals */}
        {activeTab === 'goals' && <ReadingGoal variant="full" />}

        {/* Tab 2b: Community Reading Leaderboard */}
        {activeTab === 'leaderboard' && (
          <ReadingLeaderboardSection onOpenFullLeaderboard={() => navigate('leaderboard')} />
        )}

        {/* Tab 3: Highlights */}
        {activeTab === 'highlights' && (() => {
          const query = hlSearch.trim().toLowerCase();
          const filteredHighlights = highlights.filter((hl) => {
            if (hlColorFilter !== 'all' && hl.color !== hlColorFilter) return false;
            if (hlNotesOnly && !hl.note?.trim()) return false;
            if (!query) return true;
            return (
              hl.storyTitle.toLowerCase().includes(query) ||
              hl.chapterTitle.toLowerCase().includes(query) ||
              hl.excerpt.toLowerCase().includes(query) ||
              (hl.selectedText && hl.selectedText.toLowerCase().includes(query)) ||
              (hl.note && hl.note.toLowerCase().includes(query))
            );
          });

          const startEditingHighlight = (hl: (typeof highlights)[number]) => {
            setEditingHlId(hl.id);
            setEditingHlNote(hl.note || '');
            setEditingHlColor(hl.color);
          };

          const handleSaveHighlightEdit = async (highlightId: string) => {
            setSavingHlEdit(true);
            try {
              await updateHighlight(highlightId, {
                note: editingHlNote.trim() ? editingHlNote.trim() : null,
                color: editingHlColor,
              });
              setEditingHlId(null);
            } finally {
              setSavingHlEdit(false);
            }
          };

          const colorBorderMap: Record<'terracotta' | 'gold' | 'sage', string> = {
            terracotta: 'border-l-[#C85A32]',
            gold: 'border-l-[#D4AF37]',
            sage: 'border-l-[#10B981]',
          };

          const colorDotMap: Record<'terracotta' | 'gold' | 'sage', string> = {
            terracotta: 'bg-[#C85A32]',
            gold: 'bg-[#D4AF37]',
            sage: 'bg-[#10B981]',
          };

          const colorNameMap: Record<'terracotta' | 'gold' | 'sage', string> = {
            terracotta: 'Ember',
            gold: 'Gold',
            sage: 'Sage',
          };

          return (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold">Highlights &amp; Margin Notes</h2>
                  <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                    Selected passages and personal notes saved to your account. Revisit any passage right where you marked it.
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

              {highlights.length > 0 && (
                <div className="p-4 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#2D142C]/45 dark:text-white/45" />
                    <input
                      type="text"
                      value={hlSearch}
                      onChange={(e) => setHlSearch(e.target.value)}
                      placeholder="Search passages, thoughts, or story titles..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[#F9F6F0] dark:bg-[#160C16] border border-[#2D142C]/15 dark:border-white/15 focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-sans-ui">
                    {(['all', 'terracotta', 'gold', 'sage'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setHlColorFilter(c)}
                        className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 cursor-pointer transition-colors ${
                          hlColorFilter === c
                            ? 'bg-[#2D142C] text-white dark:bg-white dark:text-[#160C16] border-transparent font-semibold'
                            : 'border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32]'
                        }`}
                      >
                        {c !== 'all' && <span className={`w-2 h-2 rounded-full ${colorDotMap[c]}`} />}
                        <span className="capitalize">{c === 'all' ? 'All Colors' : colorNameMap[c]}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setHlNotesOnly((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 cursor-pointer transition-colors ${
                        hlNotesOnly
                          ? 'bg-[#C85A32] text-white border-[#C85A32] font-semibold'
                          : 'border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32]'
                      }`}
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>With Notes Only</span>
                    </button>
                  </div>
                </div>
              )}

              {highlights.length === 0 ? (
                <div className="p-8 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center text-xs text-[#2D142C]/65 dark:text-white/65 space-y-2">
                  <Highlighter className="w-7 h-7 mx-auto text-[#C85A32]/60" />
                  <p>No highlights or margin notes saved yet. Select any text while reading a chapter to highlight it and jot down a note.</p>
                </div>
              ) : filteredHighlights.length === 0 ? (
                <div className="p-8 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center text-xs text-[#2D142C]/65 dark:text-white/65 space-y-2">
                  <Search className="w-6 h-6 mx-auto text-[#C85A32]/60" />
                  <p>No highlights match your current filter.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredHighlights.map((hl) => {
                    const isEditing = editingHlId === hl.id;
                    const primaryQuote = hl.selectedText && hl.selectedText.trim().length > 0 ? hl.selectedText : hl.excerpt;
                    const showContextExcerpt = hl.selectedText && hl.excerpt && hl.excerpt !== hl.selectedText;

                    return (
                      <div
                        key={hl.id}
                        className={`p-5 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 border-l-4 ${colorBorderMap[hl.color]} space-y-3`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-sans-ui">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${colorDotMap[hl.color]}`} title={colorNameMap[hl.color]} />
                            <span className="font-semibold text-[#C85A32]">{hl.storyTitle}</span>
                            <span className="opacity-40">&middot;</span>
                            <span>Ch. {hl.chapterNumber}: {hl.chapterTitle}</span>
                            <span className="opacity-40">&middot;</span>
                            <span className="font-mono text-[11px] opacity-70">Para. {hl.paragraphIndex + 1}</span>
                            {hl.createdAt && (
                              <>
                                <span className="opacity-40">&middot;</span>
                                <span className="opacity-60">{hl.createdAt}</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => startEditingHighlight(hl)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[#2D142C]/75 dark:text-white/75 hover:text-[#C85A32] hover:bg-[#C85A32]/10 cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>{hl.note ? 'Edit Note' : 'Add Thought'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeHighlight(hl.id)}
                              aria-label="Delete highlight"
                              className="p-1 opacity-65 hover:text-red-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <blockquote className="font-reader text-sm italic">
                          &ldquo;{primaryQuote}&rdquo;
                        </blockquote>

                        {showContextExcerpt && (
                          <p className="text-[11px] font-sans-ui text-[#2D142C]/55 dark:text-white/55 line-clamp-2">
                            Context: {hl.excerpt}
                          </p>
                        )}

                        {isEditing ? (
                          <div className="p-3 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] border border-[#C85A32]/30 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 text-[11px] font-sans-ui">
                              <span className="font-semibold text-[#C85A32]">Edit Annotation &amp; Highlight Color</span>
                              <div className="flex items-center gap-1.5">
                                {(['terracotta', 'gold', 'sage'] as const).map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setEditingHlColor(c)}
                                    aria-label={`Set highlight color ${colorNameMap[c]}`}
                                    className={`w-4 h-4 rounded-full ${colorDotMap[c]} cursor-pointer ${
                                      editingHlColor === c ? 'ring-2 ring-offset-1 ring-[#C85A32]' : 'opacity-60 hover:opacity-100'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <textarea
                              rows={2}
                              value={editingHlNote}
                              onChange={(e) => setEditingHlNote(e.target.value)}
                              placeholder="Write your reflection or margin note on this passage..."
                              className="w-full px-3 py-2 rounded-md text-xs bg-white dark:bg-[#1E111E] border border-[#2D142C]/15 dark:border-white/15 focus:outline-none focus:border-[#C85A32]"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingHlId(null)}
                                className="px-2.5 py-1 rounded text-[11px] font-medium text-[#2D142C]/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                                <span>Cancel</span>
                              </button>
                              <button
                                type="button"
                                disabled={savingHlEdit}
                                onClick={() => handleSaveHighlightEdit(hl.id)}
                                className="px-3 py-1 rounded text-[11px] font-semibold bg-[#C85A32] text-white hover:bg-[#b54e29] disabled:opacity-60 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>{savingHlEdit ? 'Saving...' : 'Save Note'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          hl.note && (
                            <div className="p-3 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] text-xs font-sans-ui">
                              <strong className="text-[#C85A32] mr-1.5">Note:</strong>
                              <span>{hl.note}</span>
                            </div>
                          )
                        )}

                        <div className="flex items-center justify-between pt-1">
                          {hl.updatedAt && (
                            <span className="text-[11px] text-[#2D142C]/45 dark:text-white/45 font-sans-ui">
                              Updated {hl.updatedAt}
                            </span>
                          )}
                          <a
                            href={buildHref('reader', {
                              slug: hl.storySlug,
                              chapterNumber: hl.chapterNumber,
                              paragraph: hl.paragraphIndex,
                              highlight: hl.id,
                            })}
                            onClick={(e) =>
                              handleLink(e, 'reader', {
                                slug: hl.storySlug,
                                chapterNumber: hl.chapterNumber,
                                paragraph: hl.paragraphIndex,
                                highlight: hl.id,
                              })
                            }
                            className="ml-auto text-xs font-semibold text-[#C85A32] hover:underline"
                          >
                            Revisit Passage &rarr;
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

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
                {isPatron && !isOwner && (
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
                  <span className="font-bold text-sm capitalize">
                    {isOwner
                      ? 'Owner Total All-Access'
                      : isWriterOrAdmin
                      ? 'Writer Complimentary Tier'
                      : `${user.subscription.plan} Tier`}
                  </span>
                </div>
                <div className="p-4 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] space-y-1">
                  <span className="text-[#2D142C]/60 dark:text-white/60 block">Status</span>
                  <span className="font-bold text-sm capitalize">
                    {isOwner
                      ? 'Complimentary · Unrestricted'
                      : isWriterOrAdmin
                      ? 'Complimentary (Owner Exclusions Apply)'
                      : isPatron
                      ? 'Active'
                      : user.subscription.status === 'expired'
                      ? 'Canceled'
                      : 'Free Access'}
                  </span>
                </div>
                <div className="p-4 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] space-y-1">
                  <span className="text-[#2D142C]/60 dark:text-white/60 block">Billing &amp; Access</span>
                  <span className="font-bold text-sm">
                    {isOwner
                      ? '₦0 · Full Publisher Entitlement'
                      : isWriterOrAdmin
                      ? 'Only Owner-Restricted Books Paid'
                      : 'Paystack Hosted Checkout'}
                  </span>
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

        {/* Tab 6: Settings & Preferences */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-2xl">
            {/* Clickable Email Verification Status Spot */}
            <section
              id="email-verification"
              className="rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => void handleToggleEmailVerificationSpot()}
                aria-expanded={emailVerifyExpanded}
                className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-[#2D142C]/[0.025] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      user.emailVerified
                        ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-bold">Email Verification</h2>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-sans-ui ${
                          user.emailVerified
                            ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {user.emailVerified ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Not Verified</span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-xs font-sans-ui text-[#2D142C]/70 dark:text-white/70 truncate">
                      {user.emailVerified
                        ? `${user.email} is confirmed. Click to inspect or re-check status.`
                        : `${user.email} · Skipped or pending verification. Click here to check status or verify now.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-xs font-semibold font-sans-ui text-[#C85A32]">
                  {checkingEmailVerify ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : emailVerifyExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>

              {emailVerifyExpanded && (
                <div className="px-6 pb-6 pt-4 border-t border-[#2D142C]/10 dark:border-white/10 space-y-4 text-xs font-sans-ui">
                  {user.emailVerified ? (
                    <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5 text-emerald-800 dark:text-emerald-200">
                        <p className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Your email address ({user.email}) is verified.</span>
                        </p>
                        {user.emailVerifiedAt && (
                          <p className="text-[11px] opacity-80">
                            Verified on {new Date(user.emailVerifiedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={checkingEmailVerify}
                        onClick={() => void handleCheckEmailVerification(true)}
                        className="px-3 py-1.5 rounded-lg border border-emerald-700/30 dark:border-emerald-400/30 text-emerald-800 dark:text-emerald-200 font-semibold hover:bg-emerald-600/10 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingEmailVerify ? 'animate-spin' : ''}`} />
                        <span>{checkingEmailVerify ? 'Checking...' : 'Re-check Status'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 space-y-1">
                        <p className="font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>Email verification has not been completed yet.</span>
                        </p>
                        <p className="text-[11px] opacity-85 leading-relaxed">
                          If you skipped verifying {user.email} when creating your account, send a verification email below or tap Check Verification Status if you already clicked an inbox link.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          disabled={sendingEmailVerify}
                          onClick={() => void handleSendVerificationEmail()}
                          className="px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{sendingEmailVerify ? 'Sending...' : 'Send Verification Email'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={checkingEmailVerify}
                          onClick={() => void handleCheckEmailVerification(true)}
                          className="px-4 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${checkingEmailVerify ? 'animate-spin' : ''}`} />
                          <span>{checkingEmailVerify ? 'Checking...' : 'Check Verification Status'}</span>
                        </button>

                        {!showVerifyCodeEntry && (
                          <button
                            type="button"
                            onClick={() => setShowVerifyCodeEntry(true)}
                            className="px-3 py-2 rounded-lg text-[#C85A32] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Enter 6-Digit Code</span>
                          </button>
                        )}
                      </div>

                      {emailVerifyDeliveryMode === 'preview' && emailVerifyPreviewCode && (
                        <div className="p-3.5 rounded-lg bg-[#2D142C]/5 dark:bg-white/5 border border-[#C85A32]/30 space-y-1">
                          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#C85A32]">
                            Preview Verification Code (Local / No Mailer Configured)
                          </p>
                          <p className="font-mono text-base font-bold tracking-[0.25em]">
                            {emailVerifyPreviewCode}
                          </p>
                        </div>
                      )}

                      {showVerifyCodeEntry && (
                        <form onSubmit={handleConfirmVerificationCode} className="flex flex-col sm:flex-row gap-2.5 pt-1">
                          <div className="flex-1">
                            <label htmlFor="email-verify-code" className="sr-only">
                              6-digit verification code
                            </label>
                            <input
                              id="email-verify-code"
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={emailVerifyCode}
                              onChange={(e) => setEmailVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="Enter 6-digit code"
                              className="w-full px-3.5 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent font-mono tracking-widest focus:outline-none focus:border-[#C85A32]"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={confirmingEmailVerify || emailVerifyCode.length !== 6}
                            className="px-4 py-2 rounded-lg bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          >
                            {confirmingEmailVerify ? 'Verifying...' : 'Confirm Email'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {emailVerifyFeedback && (
                    <div
                      role={emailVerifyFeedback.type === 'error' ? 'alert' : 'status'}
                      className={`p-3 rounded-lg border ${
                        emailVerifyFeedback.type === 'error'
                          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300'
                          : emailVerifyFeedback.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-[#C85A32]/10 border-[#C85A32]/25 text-[#2D142C] dark:text-[#F9F6F0]'
                      }`}
                    >
                      {emailVerifyFeedback.text}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Default Reading Preferences */}
            <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-6">
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
          </div>
        )}

      </div>
    </div>
  );
};
