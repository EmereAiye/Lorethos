import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Story,
  Chapter,
  UserProfile,
  PaymentTransaction,
  ReaderSettings,
  AccessTier,
  PublicationStatus,
  ReaderTheme,
  ReadingGoal,
  DayGoalHistory,
  TextHighlight,
  HighlightColor,
  ChapterComment,
  CommentTag,
  CommunityInquiry
} from '../types';
import { INITIAL_STORIES } from '../data/initialStories';
import { apiFetch, parseJsonSafe, setStoredSessionToken } from '../lib/apiClient';

export interface RouteParams {
  slug?: string;
  chapterNumber?: number;
  q?: string;
  genre?: string;
  status?: string;
  tier?: string;
  sort?: string;
  reference?: string;
}

export interface PaystackCheckoutRequest {
  type: 'subscription' | 'book_purchase';
  title: string;
  amountNgn: number;
  planId?: 'monthly' | 'annual';
  storyId?: string;
}

export interface AdminOverviewData {
  grossRevenueNgn: number;
  activeSubscribers: number;
  totalRegisteredUsers: number;
  publishedStoriesCount: number;
  publishedChaptersCount: number;
  inquiries: CommunityInquiry[];
  transactions: PaymentTransaction[];
}

interface HighlightInput {
  storyId: string;
  storyTitle: string;
  storySlug: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  paragraphIndex: number;
  excerpt: string;
  color: HighlightColor;
  note?: string;
}

interface CommentInput {
  storyId: string;
  chapterId: string;
  tag: CommentTag;
  body: string;
}

interface InquiryInput {
  name: string;
  email: string;
  inquiryType: string;
  subject: string;
  message: string;
  website?: string;
}

interface AppContextType {
  stories: Story[];
  user: UserProfile;
  isAuthenticated: boolean;
  authLoading: boolean;
  transactions: PaymentTransaction[];
  readerSettings: ReaderSettings;
  currentRoute: string;
  routeParams: RouteParams;
  buildHref: (route: string, params?: RouteParams) => string;
  navigate: (route: string, params?: RouteParams, options?: { replace?: boolean }) => void;
  updateReaderSettings: (partial: Partial<ReaderSettings>) => void;

  // Authentication
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;

  // Paystack hosted checkout modal
  paystackModal: {
    isOpen: boolean;
    data: PaystackCheckoutRequest | null;
  };
  checkoutStatusMessage: string | null;
  clearCheckoutStatusMessage: () => void;
  openPaystackCheckout: (request: PaystackCheckoutRequest) => void;
  closePaystackCheckout: () => void;

  // User interactions
  toggleBookmark: (chapterId: string) => void;
  recordReadingProgress: (storyId: string, chapterId: string, chapterNumber: number, progressPercent: number) => void;
  cancelSubscription: () => Promise<{ ok: boolean; error?: string }>;

  // Admin publishing controls (server-verified owner endpoints)
  adminOverview: AdminOverviewData | null;
  refreshAdminOverview: () => Promise<void>;
  addStory: (input: {
    title: string;
    subtitle?: string;
    author: string;
    genre: string;
    synopsis: string;
    coverImage: string;
    accessTier: AccessTier;
    priceNgn: number;
    publicationStatus?: PublicationStatus;
  }) => Promise<{ ok: boolean; error?: string }>;
  addChapterToStory: (
    storyId: string,
    chapterData: {
      chapterNumber: number;
      title: string;
      excerpt: string;
      content: string[];
      isFree: boolean;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  updateStoryPricing: (
    storyId: string,
    tier: AccessTier,
    priceNgn: number,
    freeChaptersCount: number
  ) => Promise<{ ok: boolean; error?: string }>;
  updateStoryWorkflow: (
    storyId: string,
    publicationStatus: PublicationStatus
  ) => Promise<{ ok: boolean; error?: string }>;

  // Helper getters & gated chapter loader
  getStoryBySlug: (slug: string) => Story | undefined;
  getChapter: (storySlug: string, chapterNumber: number) => { story: Story; chapter: Chapter } | null;
  fetchChapterContent: (
    storySlug: string,
    chapterNumber: number
  ) => Promise<{ locked: boolean; story?: Story; chapter?: Chapter; error?: string }>;
  hasAccessToChapter: (story: Story, chapter: Chapter) => boolean;
  setTheme: (theme: ReaderTheme) => void;
  activeProgress: { story: Story; chapterNumber: number; progressPercent: number; lastReadAt: string } | null;

  // Reading goals (calendar rollover & deduplication)
  updateReadingGoal: (partial: Partial<ReadingGoal>) => void;
  logChapterCompleted: (chapterId?: string) => boolean;

  // Highlights, Margin Notes, Chapter Comments & Community Inquiries
  highlights: TextHighlight[];
  saveHighlight: (input: HighlightInput) => void;
  removeHighlight: (highlightId: string) => void;
  chapterComments: ChapterComment[];
  loadChapterComments: (chapterId: string) => Promise<void>;
  addChapterComment: (input: CommentInput) => Promise<{ error?: string }>;
  deleteChapterComment: (commentId: string) => Promise<void>;
  inquiries: CommunityInquiry[];
  submitInquiry: (input: InquiryInput) => Promise<CommunityInquiry>;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getLocalIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatShortDate(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}`;
}

function getIsoWeekKey(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function buildEmpty14DayHistory(todayIso: string, dailyTarget: number): DayGoalHistory[] {
  const baseDate = parseIsoDate(todayIso) || new Date();
  return Array.from({ length: 14 }, (_, idx) => {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - (13 - idx));
    return {
      dayName: DAY_NAMES[d.getDay()],
      dateStr: formatShortDate(d),
      dateIso: getLocalIsoDate(d),
      chaptersRead: 0,
      metTarget: 0 >= dailyTarget
    };
  });
}

function reconcileReadingGoalRollover(goal: ReadingGoal, todayIso: string = getLocalIsoDate()): ReadingGoal {
  const dailyTarget = goal.frequency === 'weekly'
    ? Math.max(1, Math.ceil(goal.targetChapters / 7))
    : goal.targetChapters;

  const existingHistory = Array.isArray(goal.history) ? goal.history : [];
  const lastDate = parseIsoDate(goal.lastUpdatedDate);
  const todayDate = parseIsoDate(todayIso) || new Date();

  if (!lastDate || existingHistory.length === 0) {
    const migratedHistory = Array.from({ length: 14 }, (_, idx) => {
      const d = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - (13 - idx));
      const existing = existingHistory[existingHistory.length - 14 + idx];
      const count = idx === 13 ? (goal.currentProgress ?? existing?.chaptersRead ?? 0) : (existing?.chaptersRead ?? 0);
      return {
        dayName: DAY_NAMES[d.getDay()],
        dateStr: formatShortDate(d),
        dateIso: getLocalIsoDate(d),
        chaptersRead: count,
        metTarget: count >= dailyTarget
      };
    });

    return {
      ...goal,
      lastUpdatedDate: todayIso,
      completedChapterIds: goal.completedChapterIds || [],
      history: migratedHistory
    };
  }

  if (goal.lastUpdatedDate === todayIso) {
    const aligned = existingHistory.map((item, idx) => {
      const d = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - (existingHistory.length - 1 - idx));
      return {
        ...item,
        dayName: item.dayName || DAY_NAMES[d.getDay()],
        dateStr: item.dateStr || formatShortDate(d),
        dateIso: item.dateIso || getLocalIsoDate(d),
        metTarget: item.chaptersRead >= dailyTarget
      };
    });
    return {
      ...goal,
      completedChapterIds: goal.completedChapterIds || [],
      history: aligned.slice(-14)
    };
  }

  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);
  const byIso = new Map<string, DayGoalHistory>();
  existingHistory.forEach((h, idx) => {
    if (h.dateIso) {
      byIso.set(h.dateIso, h);
    } else {
      const inferred = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() - (existingHistory.length - 1 - idx));
      byIso.set(getLocalIsoDate(inferred), { ...h, dateIso: getLocalIsoDate(inferred) });
    }
  });

  const nextHistory: DayGoalHistory[] = Array.from({ length: 14 }, (_, idx) => {
    const d = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - (13 - idx));
    const iso = getLocalIsoDate(d);
    const found = byIso.get(iso);
    const chaptersRead = found ? found.chaptersRead : 0;
    return {
      dayName: DAY_NAMES[d.getDay()],
      dateStr: formatShortDate(d),
      dateIso: iso,
      chaptersRead,
      metTarget: chaptersRead >= dailyTarget
    };
  });

  let nextStreak = goal.streakDays;
  if (diffDays > 1) {
    nextStreak = 0;
  } else if (diffDays === 1) {
    const yesterdayIso = getLocalIsoDate(lastDate);
    const yesterdayEntry = byIso.get(yesterdayIso);
    if (!yesterdayEntry || yesterdayEntry.chaptersRead < dailyTarget) {
      nextStreak = 0;
    }
  }

  let nextProgress = 0;
  if (goal.frequency === 'weekly' && getIsoWeekKey(lastDate) === getIsoWeekKey(todayDate)) {
    nextProgress = goal.currentProgress;
  }

  return {
    ...goal,
    currentProgress: nextProgress,
    streakDays: nextStreak,
    bestStreakDays: Math.max(goal.bestStreakDays, nextStreak),
    lastUpdatedDate: todayIso,
    completedChapterIds: goal.completedChapterIds || [],
    history: nextHistory
  };
}

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'day',
  font: 'literata',
  fontSize: 18,
  lineHeight: 'relaxed',
  readingWidth: 'standard',
  ambientSound: false,
  ambientTrack: 'fireplace',
  ambientVolume: 0.6
};

function createGuestUser(): UserProfile {
  const todayIso = getLocalIsoDate();
  return {
    id: 'guest',
    name: 'Guest Reader',
    email: '',
    role: 'reader',
    subscription: {
      plan: 'free',
      status: 'none',
      amountNgn: 0
    },
    unlockedStoryIds: [],
    bookmarkedChapterIds: [],
    readingProgress: {},
    readingGoal: {
      frequency: 'daily',
      targetChapters: 2,
      currentProgress: 0,
      streakDays: 0,
      bestStreakDays: 0,
      lastUpdatedDate: todayIso,
      completedChapterIds: [],
      history: buildEmpty14DayHistory(todayIso, 2)
    }
  };
}

export function buildHref(route: string, params?: RouteParams): string {
  switch (route) {
    case 'home':
      return '/';
    case 'stories': {
      const qs = new URLSearchParams();
      if (params?.q) qs.set('q', params.q);
      if (params?.genre && params.genre !== 'All') qs.set('genre', params.genre);
      if (params?.status && params.status !== 'All') qs.set('status', params.status);
      if (params?.tier && params.tier !== 'All') qs.set('tier', params.tier);
      if (params?.sort && params.sort !== 'popular') qs.set('sort', params.sort);
      const queryStr = qs.toString();
      return queryStr ? `/stories?${queryStr}` : '/stories';
    }
    case 'story-detail':
      return params?.slug ? `/stories/${encodeURIComponent(params.slug)}` : '/stories';
    case 'reader':
      return params?.slug
        ? `/stories/${encodeURIComponent(params.slug)}/chapters/${params.chapterNumber || 1}`
        : '/stories';
    case 'pricing':
      return '/pricing';
    case 'account':
      return '/account';
    case 'contact':
      return '/contact';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}

function parseLocationToRoute(pathname: string, search: string): { route: string; params: RouteParams } {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const qs = new URLSearchParams(search);

  if (cleanPath === '/' || cleanPath === '') {
    return { route: 'home', params: {} };
  }

  if (cleanPath === '/stories') {
    return {
      route: 'stories',
      params: {
        q: qs.get('q') || undefined,
        genre: qs.get('genre') || undefined,
        status: qs.get('status') || undefined,
        tier: qs.get('tier') || undefined,
        sort: qs.get('sort') || undefined
      }
    };
  }

  const chapterMatch = cleanPath.match(/^\/stories\/([^/]+)\/chapters\/(\d+)$/);
  if (chapterMatch) {
    return {
      route: 'reader',
      params: {
        slug: decodeURIComponent(chapterMatch[1]),
        chapterNumber: Number(chapterMatch[2]) || 1
      }
    };
  }

  const storyMatch = cleanPath.match(/^\/stories\/([^/]+)$/);
  if (storyMatch) {
    return {
      route: 'story-detail',
      params: {
        slug: decodeURIComponent(storyMatch[1])
      }
    };
  }

  if (cleanPath === '/pricing') {
    return {
      route: 'pricing',
      params: {
        reference: qs.get('reference') || qs.get('trxref') || undefined
      }
    };
  }

  if (cleanPath === '/account') return { route: 'account', params: {} };
  if (cleanPath === '/contact') return { route: 'contact', params: {} };
  if (cleanPath === '/admin') return { route: 'admin', params: {} };

  return { route: 'home', params: {} };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialParsed =
    typeof window !== 'undefined'
      ? parseLocationToRoute(window.location.pathname, window.location.search)
      : { route: 'home', params: {} };

  const [stories, setStories] = useState<Story[]>(INITIAL_STORIES);
  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const savedGuestGoal = localStorage.getItem('lorethos_guest_goal');
      const guest = createGuestUser();
      if (savedGuestGoal) {
        return {
          ...guest,
          readingGoal: reconcileReadingGoalRollover(JSON.parse(savedGuestGoal))
        };
      }
      return guest;
    } catch {
      return createGuestUser();
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [adminOverview, setAdminOverview] = useState<AdminOverviewData | null>(null);

  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(() => {
    try {
      const saved = localStorage.getItem('lorethos_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [highlights, setHighlights] = useState<TextHighlight[]>([]);
  const [chapterComments, setChapterComments] = useState<ChapterComment[]>([]);
  const [inquiries, setInquiries] = useState<CommunityInquiry[]>([]);

  const [currentRoute, setCurrentRoute] = useState<string>(initialParsed.route);
  const [routeParams, setRouteParams] = useState<RouteParams>(initialParsed.params);

  const [paystackModal, setPaystackModal] = useState<{
    isOpen: boolean;
    data: PaystackCheckoutRequest | null;
  }>({
    isOpen: false,
    data: null
  });
  const [checkoutStatusMessage, setCheckoutStatusMessage] = useState<string | null>(null);

  const progressSaveTimerRef = useRef<number | null>(null);

  // Persist reader display preferences locally
  useEffect(() => {
    try {
      localStorage.setItem('lorethos_settings', JSON.stringify(readerSettings));
    } catch {
      // Ignore storage quota errors
    }
  }, [readerSettings]);

  // Persist guest goal locally when not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      try {
        localStorage.setItem('lorethos_guest_goal', JSON.stringify(user.readingGoal));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [isAuthenticated, user.readingGoal]);

  // Synchronize document classes based on reader theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'sepia');
    if (readerSettings.theme === 'night') {
      root.classList.add('dark');
    } else if (readerSettings.theme === 'sepia') {
      root.classList.add('sepia');
    }
  }, [readerSettings.theme]);

  // Listen to browser Back / Forward buttons
  useEffect(() => {
    const onPopState = () => {
      const parsed = parseLocationToRoute(window.location.pathname, window.location.search);
      setCurrentRoute(parsed.route);
      setRouteParams(parsed.params);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const refreshStories = useCallback(async () => {
    try {
      const catalogRes = await apiFetch('/api/stories');
      if (catalogRes.ok) {
        const catalogJson = await catalogRes.json();
        if (Array.isArray(catalogJson.stories) && catalogJson.stories.length > 0) {
          setStories(catalogJson.stories);
        }
      }
    } catch {
      // Safe fallback
    }
  }, []);

  const loadAccountExtras = useCallback(async () => {
    try {
      const [txRes, hlRes] = await Promise.all([
        apiFetch('/api/account/transactions'),
        apiFetch('/api/account/highlights')
      ]);
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(Array.isArray(txData.transactions) ? txData.transactions : []);
      }
      if (hlRes.ok) {
        const hlData = await hlRes.json();
        setHighlights(Array.isArray(hlData.highlights) ? hlData.highlights : []);
      }
    } catch {
      // Safe fallback
    }
  }, []);

  // Load initial catalog and session on startup
  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const [catalogRes, sessionRes] = await Promise.all([
          apiFetch('/api/stories'),
          apiFetch('/api/auth/session')
        ]);

        if (catalogRes.ok && mounted) {
          const catalogJson = await catalogRes.json();
          if (Array.isArray(catalogJson.stories) && catalogJson.stories.length > 0) {
            setStories(catalogJson.stories);
          }
        }

        if (sessionRes.ok && mounted) {
          const sessionJson = await sessionRes.json();
          if (sessionJson.authenticated && sessionJson.user) {
            const serverUser: UserProfile = {
              ...sessionJson.user,
              readingGoal: reconcileReadingGoalRollover(
                sessionJson.user.readingGoal || createGuestUser().readingGoal
              )
            };
            setUser(serverUser);
            setIsAuthenticated(true);
            await loadAccountExtras();

            // Verify Paystack callback if redirected back with ?reference=...
            const urlParams = new URLSearchParams(window.location.search);
            const reference = urlParams.get('reference') || urlParams.get('trxref');
            if (reference) {
              try {
                const verifyRes = await apiFetch('/api/payments/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reference })
                });
                const verifyJson = await verifyRes.json();
                if (verifyRes.ok && verifyJson.user && mounted) {
                  setUser({
                    ...verifyJson.user,
                    readingGoal: reconcileReadingGoalRollover(
                      verifyJson.user.readingGoal || serverUser.readingGoal
                    )
                  });
                  if (Array.isArray(verifyJson.transactions)) {
                    setTransactions(verifyJson.transactions);
                  }
                  setCheckoutStatusMessage('Payment verified and access unlocked on your account.');
                } else if (mounted) {
                  setCheckoutStatusMessage(verifyJson.error || 'Could not confirm Paystack payment yet.');
                }
              } catch {
                // Ignore verification error cleanly
              }
            }
          } else {
            setStoredSessionToken(null);
          }
        }
      } catch {
        // Fallback cleanly to sanitized catalog
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadAccountExtras]);

  // Automatic Daily Rollover Watcher
  useEffect(() => {
    const checkRollover = () => {
      const todayIso = getLocalIsoDate();
      setUser(prev => {
        if (prev.readingGoal.lastUpdatedDate === todayIso) return prev;
        return {
          ...prev,
          readingGoal: reconcileReadingGoalRollover(prev.readingGoal, todayIso)
        };
      });
    };

    const interval = window.setInterval(checkRollover, 60_000);
    window.addEventListener('focus', checkRollover);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkRollover);
    };
  }, []);

  const setTheme = (theme: ReaderTheme) => {
    setReaderSettings(prev => ({ ...prev, theme }));
  };

  const navigate = useCallback(
    (route: string, params?: RouteParams, options?: { replace?: boolean }) => {
      const nextHref = buildHref(route, params);
      const currentFull = `${window.location.pathname}${window.location.search}`;
      if (nextHref !== currentFull) {
        if (options?.replace) {
          window.history.replaceState({}, '', nextHref);
        } else {
          window.history.pushState({}, '', nextHref);
        }
      }
      setCurrentRoute(route);
      setRouteParams(params || {});
      if (!options?.replace) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  const updateReaderSettings = (partial: Partial<ReaderSettings>) => {
    setReaderSettings(prev => ({ ...prev, ...partial }));
  };

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await parseJsonSafe<{ user?: UserProfile; token?: string; error?: string }>(res);
      if (!res.ok || !data?.user) {
        return { error: data?.error || `Sign-in failed (${res.status}).` };
      }
      if (data.token) {
        setStoredSessionToken(data.token);
      }
      setUser({
        ...data.user,
        readingGoal: reconcileReadingGoalRollover(
          data.user.readingGoal || createGuestUser().readingGoal
        )
      });
      setIsAuthenticated(true);
      await Promise.all([loadAccountExtras(), refreshStories()]);
      return {};
    } catch {
      return { error: 'Network error while signing in.' };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<{ error?: string }> => {
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password })
      });
      const data = await parseJsonSafe<{ user?: UserProfile; token?: string; error?: string }>(res);
      if (!res.ok || !data?.user) {
        return { error: data?.error || `Registration failed (${res.status}).` };
      }
      if (data.token) {
        setStoredSessionToken(data.token);
      }
      setUser({
        ...data.user,
        readingGoal: reconcileReadingGoalRollover(
          data.user.readingGoal || createGuestUser().readingGoal
        )
      });
      setIsAuthenticated(true);
      await Promise.all([loadAccountExtras(), refreshStories()]);
      return {};
    } catch {
      return { error: 'Network error while creating account.' };
    }
  };

  const logout = async () => {
    setStoredSessionToken(null);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors
    }
    setIsAuthenticated(false);
    setTransactions([]);
    setHighlights([]);
    setAdminOverview(null);
    setUser(createGuestUser());
    await refreshStories();
  };

  const openPaystackCheckout = (request: PaystackCheckoutRequest) => {
    setPaystackModal({ isOpen: true, data: request });
  };

  const closePaystackCheckout = () => {
    setPaystackModal({ isOpen: false, data: null });
  };

  const cancelSubscription = async (): Promise<{ ok: boolean; error?: string }> => {
    if (!isAuthenticated) return { ok: false, error: 'Sign in required.' };
    try {
      const res = await apiFetch('/api/account/subscription/cancel', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Could not cancel subscription.' };
      }
      setUser(prev => ({
        ...prev,
        subscription: data.subscription
      }));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error.' };
    }
  };

  const toggleBookmark = (chapterId: string) => {
    setUser(prev => {
      const exists = prev.bookmarkedChapterIds.includes(chapterId);
      return {
        ...prev,
        bookmarkedChapterIds: exists
          ? prev.bookmarkedChapterIds.filter(id => id !== chapterId)
          : [...prev.bookmarkedChapterIds, chapterId]
      };
    });

    if (isAuthenticated) {
      void apiFetch('/api/account/bookmarks/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId })
      });
    }
  };

  const recordReadingProgress = useCallback(
    (storyId: string, chapterId: string, chapterNumber: number, progressPercent: number) => {
      const rounded = Math.min(100, Math.max(0, Math.round(progressPercent)));

      setUser(prev => {
        const existing = prev.readingProgress[storyId];
        if (
          existing &&
          existing.chapterId === chapterId &&
          Math.abs(existing.progressPercent - rounded) < 3 &&
          rounded < 98
        ) {
          return prev;
        }
        return {
          ...prev,
          readingProgress: {
            ...prev.readingProgress,
            [storyId]: {
              chapterId,
              chapterNumber,
              progressPercent: rounded,
              lastReadAt: 'Just now'
            }
          }
        };
      });

      if (isAuthenticated) {
        if (progressSaveTimerRef.current) {
          window.clearTimeout(progressSaveTimerRef.current);
        }
        progressSaveTimerRef.current = window.setTimeout(() => {
          void apiFetch('/api/account/progress', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storyId, chapterId, chapterNumber, progressPercent: rounded })
          });
        }, 2500);
      }
    },
    [isAuthenticated]
  );

  const syncGoalToServer = useCallback(
    (goal: ReadingGoal) => {
      if (!isAuthenticated) return;
      void apiFetch('/api/account/goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingGoal: goal })
      });
    },
    [isAuthenticated]
  );

  const updateReadingGoal = (partial: Partial<ReadingGoal>) => {
    setUser(prev => {
      const currentGoal = reconcileReadingGoalRollover(prev.readingGoal);
      const nextTarget = partial.targetChapters ?? currentGoal.targetChapters;
      const nextFrequency = partial.frequency ?? currentGoal.frequency;
      const dailyEquivalent = nextFrequency === 'weekly'
        ? Math.max(1, Math.ceil(nextTarget / 7))
        : nextTarget;

      let updatedHistory = [...currentGoal.history];
      if (partial.currentProgress !== undefined && updatedHistory.length > 0) {
        const lastIdx = updatedHistory.length - 1;
        updatedHistory[lastIdx] = {
          ...updatedHistory[lastIdx],
          chaptersRead: partial.currentProgress,
          metTarget: partial.currentProgress >= dailyEquivalent
        };
      } else if (partial.targetChapters !== undefined || partial.frequency !== undefined) {
        updatedHistory = updatedHistory.map(day => ({
          ...day,
          metTarget: day.chaptersRead >= dailyEquivalent
        }));
      }

      const nextGoal: ReadingGoal = {
        ...currentGoal,
        ...partial,
        lastUpdatedDate: getLocalIsoDate(),
        history: updatedHistory
      };

      syncGoalToServer(nextGoal);
      return {
        ...prev,
        readingGoal: nextGoal
      };
    });
  };

  const logChapterCompleted = useCallback(
    (chapterId?: string): boolean => {
      let wasLogged = false;

      setUser(prev => {
        const currentGoal = reconcileReadingGoalRollover(prev.readingGoal);
        const completedIds = currentGoal.completedChapterIds || [];

        if (chapterId && completedIds.includes(chapterId)) {
          wasLogged = false;
          return prev;
        }

        wasLogged = true;
        const dailyEquivalent = currentGoal.frequency === 'weekly'
          ? Math.max(1, Math.ceil(currentGoal.targetChapters / 7))
          : currentGoal.targetChapters;

        const nextProgress = currentGoal.currentProgress + 1;
        const targetMetNow = nextProgress >= currentGoal.targetChapters;
        const crossedThreshold = targetMetNow && currentGoal.currentProgress < currentGoal.targetChapters;
        const newStreak = crossedThreshold ? currentGoal.streakDays + 1 : currentGoal.streakDays;
        const newBest = Math.max(currentGoal.bestStreakDays, newStreak);

        const updatedHistory = [...currentGoal.history];
        if (updatedHistory.length > 0) {
          const lastIdx = updatedHistory.length - 1;
          const nextDayReads = updatedHistory[lastIdx].chaptersRead + 1;
          updatedHistory[lastIdx] = {
            ...updatedHistory[lastIdx],
            chaptersRead: nextDayReads,
            metTarget: nextDayReads >= dailyEquivalent
          };
        }

        const nextGoal: ReadingGoal = {
          ...currentGoal,
          currentProgress: nextProgress,
          streakDays: newStreak,
          bestStreakDays: newBest,
          lastUpdatedDate: getLocalIsoDate(),
          completedChapterIds: chapterId ? [...completedIds, chapterId] : completedIds,
          history: updatedHistory
        };

        syncGoalToServer(nextGoal);
        return {
          ...prev,
          readingGoal: nextGoal
        };
      });

      return wasLogged;
    },
    [syncGoalToServer]
  );

  const saveHighlight = (input: HighlightInput) => {
    const existing = highlights.find(
      h => h.chapterId === input.chapterId && h.paragraphIndex === input.paragraphIndex
    );

    const record: TextHighlight = {
      id: existing ? existing.id : `hl-${Date.now()}`,
      ...input,
      createdAt: 'Just now'
    };

    setHighlights(prev =>
      existing ? prev.map(h => (h.id === existing.id ? record : h)) : [record, ...prev]
    );

    if (isAuthenticated) {
      void apiFetch('/api/account/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.highlights)) setHighlights(data.highlights);
        }
      });
    }
  };

  const removeHighlight = (highlightId: string) => {
    setHighlights(prev => prev.filter(h => h.id !== highlightId));
    if (isAuthenticated) {
      void apiFetch(`/api/account/highlights/${encodeURIComponent(highlightId)}`, {
        method: 'DELETE',
      });
    }
  };

  const loadChapterComments = useCallback(async (chapterId: string) => {
    try {
      const res = await apiFetch(`/api/comments?chapterId=${encodeURIComponent(chapterId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.comments)) {
          setChapterComments(data.comments);
        }
      }
    } catch {
      // Safe fallback
    }
  }, []);

  const addChapterComment = async (input: CommentInput): Promise<{ error?: string }> => {
    if (!isAuthenticated) {
      return { error: 'Please sign in on the Account page before posting comments.' };
    }
    try {
      const res = await apiFetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Could not post note.' };
      }
      setChapterComments(prev => [data.comment, ...prev]);
      return {};
    } catch {
      return { error: 'Network error while posting note.' };
    }
  };

  const deleteChapterComment = async (commentId: string) => {
    setChapterComments(prev => prev.filter(c => c.id !== commentId));
    if (isAuthenticated) {
      await apiFetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
      });
    }
  };

  const submitInquiry = async (input: InquiryInput): Promise<CommunityInquiry> => {
    const res = await apiFetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit message.');
    }
    const record: CommunityInquiry = data.inquiry;
    setInquiries(prev => [record, ...prev]);
    return record;
  };

  const refreshAdminOverview = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/overview');
      if (res.ok) {
        const data: AdminOverviewData = await res.json();
        setAdminOverview(data);
        setInquiries(data.inquiries || []);
      }
    } catch {
      // Ignore if unauthorized
    }
  }, []);

  const addStory = async (input: {
    title: string;
    subtitle?: string;
    author: string;
    genre: string;
    synopsis: string;
    coverImage: string;
    accessTier: AccessTier;
    priceNgn: number;
    publicationStatus?: PublicationStatus;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/api/admin/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Failed to publish story.' };
      setStories(prev => [data.story, ...prev]);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error.' };
    }
  };

  const addChapterToStory = async (
    storyId: string,
    chapterData: {
      chapterNumber: number;
      title: string;
      excerpt: string;
      content: string[];
      isFree: boolean;
    }
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await apiFetch(`/api/admin/stories/${encodeURIComponent(storyId)}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chapterData)
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Failed to add chapter.' };
      if (data.story) {
        setStories(prev => prev.map(s => (s.id === storyId ? data.story : s)));
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error.' };
    }
  };

  const updateStoryPricing = async (
    storyId: string,
    accessTier: AccessTier,
    priceNgn: number,
    freeChaptersCount: number
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await apiFetch(`/api/admin/stories/${encodeURIComponent(storyId)}/pricing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessTier, priceNgn, freeChaptersCount })
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Failed to update pricing.' };
      if (data.story) {
        setStories(prev => prev.map(s => (s.id === storyId ? data.story : s)));
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error.' };
    }
  };

  const updateStoryWorkflow = async (
    storyId: string,
    publicationStatus: PublicationStatus
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await apiFetch(`/api/admin/stories/${encodeURIComponent(storyId)}/workflow`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicationStatus })
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Failed to update workflow status.' };
      if (data.story) {
        setStories(prev => prev.map(s => (s.id === storyId ? data.story : s)));
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error.' };
    }
  };

  const getStoryBySlug = useCallback(
    (slug: string) => stories.find(s => s.slug === slug),
    [stories]
  );

  const getChapter = useCallback(
    (storySlug: string, chapterNumber: number) => {
      const story = getStoryBySlug(storySlug);
      if (!story) return null;
      const chapter = story.chapters.find(c => c.chapterNumber === chapterNumber);
      if (!chapter) return null;
      return { story, chapter };
    },
    [getStoryBySlug]
  );

  const fetchChapterContent = useCallback(async (storySlug: string, chapterNumber: number) => {
    try {
      const res = await apiFetch(
        `/api/stories/${encodeURIComponent(storySlug)}/chapters/${chapterNumber}`
      );
      const data = await res.json();
      if (res.status === 403 || data.locked) {
        return {
          locked: true,
          story: data.story as Story | undefined,
          chapter: data.chapter as Chapter | undefined,
          error: data.error as string | undefined
        };
      }
      if (!res.ok) {
        return { locked: false, error: data.error || 'Failed to load chapter.' };
      }
      return {
        locked: false,
        story: data.story as Story,
        chapter: data.chapter as Chapter
      };
    } catch {
      return { locked: false, error: 'Network error while loading chapter.' };
    }
  }, []);

  const hasAccessToChapter = useCallback(
    (story: Story, chapter: Chapter): boolean => {
      if (chapter.isFree || story.accessTier === 'free') return true;
      if (!isAuthenticated) return false;
      if (user.role === 'owner') return true;
      if (user.subscription.status === 'active' && story.accessTier === 'subscription') return true;
      if (user.unlockedStoryIds.includes(story.id)) return true;
      return false;
    },
    [isAuthenticated, user]
  );

  const activeProgress = React.useMemo(() => {
    const progressKeys = Object.keys(user.readingProgress);
    if (progressKeys.length === 0) return null;
    const latestStoryId = progressKeys[0];
    const progressData = user.readingProgress[latestStoryId];
    const story = stories.find(s => s.id === latestStoryId);
    if (!story || !progressData) return null;
    return {
      story,
      chapterNumber: progressData.chapterNumber,
      progressPercent: progressData.progressPercent,
      lastReadAt: progressData.lastReadAt
    };
  }, [user.readingProgress, stories]);

  return (
    <AppContext.Provider
      value={{
        stories,
        user,
        isAuthenticated,
        authLoading,
        transactions,
        readerSettings,
        currentRoute,
        routeParams,
        buildHref,
        navigate,
        updateReaderSettings,
        login,
        register,
        logout,
        paystackModal,
        checkoutStatusMessage,
        clearCheckoutStatusMessage: () => setCheckoutStatusMessage(null),
        openPaystackCheckout,
        closePaystackCheckout,
        toggleBookmark,
        recordReadingProgress,
        cancelSubscription,
        adminOverview,
        refreshAdminOverview,
        addStory,
        addChapterToStory,
        updateStoryPricing,
        updateStoryWorkflow,
        getStoryBySlug,
        getChapter,
        fetchChapterContent,
        hasAccessToChapter,
        setTheme,
        activeProgress,
        updateReadingGoal,
        logChapterCompleted,
        highlights,
        saveHighlight,
        removeHighlight,
        chapterComments,
        loadChapterComments,
        addChapterComment,
        deleteChapterComment,
        inquiries,
        submitInquiry
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
