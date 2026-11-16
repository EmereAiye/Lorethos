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
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface RouteParams {
  slug?: string;
  chapterNumber?: number;
  q?: string;
  genre?: string;
  interests?: string;
  status?: string;
  tier?: string;
  sort?: string;
  reference?: string;
  redirect?: string;
}

export interface AuthActionResult {
  error?: string;
  message?: string;
  requiresEmailVerification?: boolean;
  redirectedTo?: string;
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

  // Authentication & post-auth redirection
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (name: string, email: string, password: string) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  pendingAuthRedirect: string | null;
  clearPendingAuthRedirect: () => void;
  navigateToPath: (internalPath: string, options?: { replace?: boolean }) => boolean;
  completePostAuthRedirect: (fallbackRoute?: string) => boolean;

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

  // Personalized Reading Preferences ("What do you want to read?")
  preferredGenres: string[];
  setPreferredGenres: (genres: string[]) => void;
  readingPromptOpen: boolean;
  openReadingPrompt: () => void;
  closeReadingPrompt: () => void;
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
  ambientVolume: 0.6,
  adaptiveAudio: true
};

const PREFS_STORAGE_PREFIX = 'lorethos_reader_prefs_';

function loadUserPreferences(userId: string): string[] {
  if (!userId || userId === 'guest') return [];
  try {
    const raw = localStorage.getItem(`${PREFS_STORAGE_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function saveUserPreferences(userId: string, genres: string[]): void {
  if (!userId || userId === 'guest') return;
  try {
    localStorage.setItem(`${PREFS_STORAGE_PREFIX}${userId}`, JSON.stringify(genres));
  } catch {
    // Ignore storage quota errors
  }
}

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

export function sanitizeInternalRedirect(target?: string | null): string | null {
  if (!target || typeof target !== 'string') return null;
  const trimmed = target.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null;
  }
  try {
    const parsed = new URL(trimmed, 'http://localhost');
    const cleanPath = parsed.pathname.replace(/\/+$/, '') || '/';
    if (cleanPath === '/account') return null;
    return `${cleanPath}${parsed.search}`;
  } catch {
    return null;
  }
}

export function buildHref(route: string, params?: RouteParams): string {
  switch (route) {
    case 'home':
      return '/';
    case 'stories': {
      const qs = new URLSearchParams();
      if (params?.q) qs.set('q', params.q);
      if (params?.genre && params.genre !== 'All') qs.set('genre', params.genre);
      if (params?.interests) qs.set('interests', params.interests);
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
    case 'account': {
      const safeRedirect = sanitizeInternalRedirect(params?.redirect);
      if (safeRedirect) {
        const qs = new URLSearchParams({ redirect: safeRedirect });
        return `/account?${qs.toString()}`;
      }
      return '/account';
    }
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
        interests: qs.get('interests') || undefined,
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

  if (cleanPath === '/account') {
    const safeRedirect = sanitizeInternalRedirect(qs.get('redirect'));
    return { route: 'account', params: safeRedirect ? { redirect: safeRedirect } : {} };
  }
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
  const [preferredGenres, setPreferredGenresState] = useState<string[]>([]);
  const [readingPromptOpen, setReadingPromptOpen] = useState(false);
  const [pendingAuthRedirect, setPendingAuthRedirect] = useState<string | null>(() =>
    sanitizeInternalRedirect(initialParsed.params.redirect)
  );

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
        const catalogJson = await parseJsonSafe<{ stories?: Story[] }>(catalogRes);
        if (catalogJson && Array.isArray(catalogJson.stories) && catalogJson.stories.length > 0) {
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
        const txData = await parseJsonSafe<{ transactions?: PaymentTransaction[] }>(txRes);
        setTransactions(Array.isArray(txData?.transactions) ? txData.transactions : []);
      }
      if (hlRes.ok) {
        const hlData = await parseJsonSafe<{ highlights?: TextHighlight[] }>(hlRes);
        setHighlights(Array.isArray(hlData?.highlights) ? hlData.highlights : []);
      }
    } catch {
      // Safe fallback
    }
  }, []);

  const buildSupabaseUserProfile = useCallback(
    (
      sbUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
      fallbackName?: string
    ): UserProfile => {
      const guest = createGuestUser();
      const email = (sbUser.email || '').trim().toLowerCase();
      const metaPrefs = Array.isArray(sbUser.user_metadata?.preferredGenres)
        ? sbUser.user_metadata.preferredGenres.filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0
          )
        : loadUserPreferences(sbUser.id);
      return {
        ...guest,
        id: sbUser.id,
        name: String(sbUser.user_metadata?.name || fallbackName || email.split('@')[0] || 'Reader'),
        email,
        role: email === 'emmymasterwise@gmail.com' ? 'owner' : 'reader',
        preferredGenres: metaPrefs
      };
    },
    []
  );

  const commitAuthenticatedUser = useCallback((rawUser: UserProfile, token?: string): string[] => {
    if (token) {
      setStoredSessionToken(token);
    }
    const serverPrefs = Array.isArray(rawUser.preferredGenres) ? rawUser.preferredGenres : [];
    const localPrefs = loadUserPreferences(rawUser.id);
    const resolvedPrefs = serverPrefs.length > 0 ? serverPrefs : localPrefs;
    if (resolvedPrefs.length > 0) {
      saveUserPreferences(rawUser.id, resolvedPrefs);
      if (serverPrefs.length === 0 && localPrefs.length > 0) {
        void apiFetch('/api/account/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferredGenres: localPrefs })
        }).catch(() => {});
      }
    }
    const resolvedUser: UserProfile = {
      ...rawUser,
      preferredGenres: resolvedPrefs,
      readingGoal: reconcileReadingGoalRollover(
        rawUser.readingGoal || createGuestUser().readingGoal
      )
    };
    setUser(resolvedUser);
    setIsAuthenticated(true);
    setPreferredGenresState(resolvedPrefs);
    return resolvedPrefs;
  }, []);

  const syncSupabaseAccessToken = useCallback(
    async (
      accessToken: string | undefined,
      sbUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
      fallbackName?: string
    ): Promise<string[]> => {
      if (accessToken) {
        try {
          const exchangeRes = await apiFetch('/api/auth/supabase-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken })
          });
          const exchangeData = await parseJsonSafe<{ user?: UserProfile; token?: string }>(exchangeRes);
          if (exchangeRes.ok && exchangeData?.user) {
            const prefs = commitAuthenticatedUser(exchangeData.user, exchangeData.token);
            void Promise.all([loadAccountExtras(), refreshStories()]);
            return prefs;
          }
        } catch {
          // Fall back to Supabase-only client profile when backend exchange is unavailable
        }
      }
      const profile = buildSupabaseUserProfile(sbUser, fallbackName);
      return commitAuthenticatedUser(profile);
    },
    [buildSupabaseUserProfile, commitAuthenticatedUser, loadAccountExtras, refreshStories]
  );

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
          const catalogJson = await parseJsonSafe<{ stories?: Story[] }>(catalogRes);
          if (catalogJson && Array.isArray(catalogJson.stories) && catalogJson.stories.length > 0) {
            setStories(catalogJson.stories);
          }
        }

        if (sessionRes.ok && mounted) {
          const sessionJson = await parseJsonSafe<{ authenticated?: boolean; user?: UserProfile }>(sessionRes);
          if (sessionJson?.authenticated && sessionJson.user) {
            commitAuthenticatedUser(sessionJson.user);
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
                const verifyJson = await parseJsonSafe<{ user?: UserProfile; transactions?: PaymentTransaction[]; error?: string }>(verifyRes);
                if (verifyRes.ok && verifyJson?.user && mounted) {
                  commitAuthenticatedUser(verifyJson.user);
                  if (Array.isArray(verifyJson.transactions)) {
                    setTransactions(verifyJson.transactions);
                  }
                  setCheckoutStatusMessage('Payment verified and access unlocked on your account.');
                } else if (mounted) {
                  setCheckoutStatusMessage(verifyJson?.error || 'Could not confirm Paystack payment yet.');
                }
              } catch {
                // Ignore verification error cleanly
              }
            }
          } else if (!sessionJson?.authenticated && isSupabaseConfigured && supabase && mounted) {
            const { data: sbSession } = await supabase.auth.getSession();
            const sbUser = sbSession.session?.user;
            if (sbUser && mounted) {
              await syncSupabaseAccessToken(sbSession.session?.access_token, sbUser);
            } else {
              setStoredSessionToken(null);
            }
          } else {
            setStoredSessionToken(null);
          }
        } else {
          if (sessionRes.status === 401) {
            setStoredSessionToken(null);
          }
          if (isSupabaseConfigured && supabase && mounted) {
            const { data: sbSession } = await supabase.auth.getSession();
            const sbUser = sbSession.session?.user;
            if (sbUser && mounted) {
              await syncSupabaseAccessToken(sbSession.session?.access_token, sbUser);
            }
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
  }, [commitAuthenticatedUser, loadAccountExtras, syncSupabaseAccessToken]);

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
      if (route === 'account' && params?.redirect) {
        const safe = sanitizeInternalRedirect(params.redirect);
        if (safe) setPendingAuthRedirect(safe);
      }
      if (!options?.replace) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  const navigateToPath = useCallback(
    (internalPath: string, options?: { replace?: boolean }): boolean => {
      const safe = sanitizeInternalRedirect(internalPath);
      if (!safe) return false;
      const parsedUrl = new URL(safe, 'http://localhost');
      const parsed = parseLocationToRoute(parsedUrl.pathname, parsedUrl.search);
      navigate(parsed.route, parsed.params, options);
      return true;
    },
    [navigate]
  );

  const clearPendingAuthRedirect = useCallback(() => {
    setPendingAuthRedirect(null);
  }, []);

  const completePostAuthRedirect = useCallback(
    (fallbackRoute?: string): boolean => {
      const target = sanitizeInternalRedirect(pendingAuthRedirect || routeParams.redirect);
      setPendingAuthRedirect(null);
      if (target && navigateToPath(target, { replace: true })) {
        return true;
      }
      if (fallbackRoute) {
        navigate(fallbackRoute);
      }
      return false;
    },
    [pendingAuthRedirect, routeParams.redirect, navigateToPath, navigate]
  );

  const updateReaderSettings = (partial: Partial<ReaderSettings>) => {
    setReaderSettings(prev => ({ ...prev, ...partial }));
  };

  const setPreferredGenres = useCallback(
    (genres: string[]) => {
      const cleaned = Array.from(new Set(genres.map(g => g.trim()).filter(Boolean)));
      setPreferredGenresState(cleaned);
      setUser(prev => ({
        ...prev,
        preferredGenres: cleaned
      }));
      if (user.id && user.id !== 'guest') {
        saveUserPreferences(user.id, cleaned);
      }
      if (isAuthenticated) {
        void apiFetch('/api/account/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferredGenres: cleaned })
        }).then(async (res) => {
          if (res.ok) {
            const data = await parseJsonSafe<{ preferredGenres?: string[]; user?: UserProfile }>(res);
            if (data?.user?.preferredGenres) {
              setPreferredGenresState(data.user.preferredGenres);
              setUser(prev => ({ ...prev, preferredGenres: data.user!.preferredGenres }));
              saveUserPreferences(user.id, data.user.preferredGenres);
            }
          }
        }).catch(() => {
          // Local cache retained when offline
        });
      }
    },
    [user.id, isAuthenticated]
  );

  const openReadingPrompt = useCallback(() => setReadingPromptOpen(true), []);
  const closeReadingPrompt = useCallback(() => setReadingPromptOpen(false), []);

  const finalizePostAuthFlow = useCallback(
    (resolvedPrefs: string[], isNewRegistration: boolean): AuthActionResult => {
      const safeRedirect = sanitizeInternalRedirect(routeParams.redirect || pendingAuthRedirect);
      // Returning reader with saved preferences heading back to a specific page (checkout/reader/admin)
      if (!isNewRegistration && safeRedirect && resolvedPrefs.length > 0) {
        setPendingAuthRedirect(null);
        navigateToPath(safeRedirect, { replace: true });
        return { redirectedTo: safeRedirect };
      }

      if (safeRedirect) {
        setPendingAuthRedirect(safeRedirect);
      }
      setReadingPromptOpen(true);
      return {};
    },
    [routeParams.redirect, pendingAuthRedirect, navigateToPath]
  );

  const login = async (email: string, password: string): Promise<AuthActionResult> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return { error: 'Please enter a valid email address.' };
    }
    if (!password) {
      return { error: 'Please enter your password.' };
    }

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password })
      });
      const data = await parseJsonSafe<{ user?: UserProfile; token?: string; error?: string }>(res);
      if (res.ok && data?.user) {
        const resolvedPrefs = commitAuthenticatedUser(data.user, data.token);
        void Promise.all([loadAccountExtras(), refreshStories()]);
        return finalizePostAuthFlow(resolvedPrefs, false);
      }

      const shouldTrySupabase =
        isSupabaseConfigured &&
        supabase &&
        (!data || res.status === 401 || res.status === 404 || res.status === 405 || res.status >= 500);

      if (shouldTrySupabase && supabase) {
        const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password
        });
        if (!sbErr && sbData.user) {
          const resolvedPrefs = await syncSupabaseAccessToken(
            sbData.session?.access_token,
            sbData.user
          );
          return finalizePostAuthFlow(resolvedPrefs, false);
        }
        if (sbErr && (!data || res.status >= 404)) {
          return { error: sbErr.message };
        }
      }

      return {
        error:
          data?.error ||
          (!data
            ? 'Authentication service returned an unexpected response. Please try again.'
            : `Sign-in failed (${res.status}).`)
      };
    } catch {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password
          });
          if (sbErr) return { error: sbErr.message };
          if (sbData.user) {
            const resolvedPrefs = await syncSupabaseAccessToken(
              sbData.session?.access_token,
              sbData.user
            );
            return finalizePostAuthFlow(resolvedPrefs, false);
          }
        } catch {
          // Fall through to clean network error message
        }
      }
      return { error: 'Unable to reach the authentication server. Please check your connection and try again.' };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<AuthActionResult> => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return { error: 'Full name must be between 2 and 80 characters.' };
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return { error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 8) {
      return { error: 'Password must be at least 8 characters long.' };
    }

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail, password })
      });
      const data = await parseJsonSafe<{ user?: UserProfile; token?: string; error?: string }>(res);
      if (res.ok && data?.user) {
        const initialPrefs = commitAuthenticatedUser(data.user, data.token);
        void Promise.all([loadAccountExtras(), refreshStories()]);
        return finalizePostAuthFlow(initialPrefs, true);
      }

      const apiUnavailable = !data || res.status === 404 || res.status === 405 || res.status >= 500;
      if (apiUnavailable && isSupabaseConfigured && supabase) {
        const { data: sbData, error: sbErr } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { name: trimmedName } }
        });
        if (sbErr) {
          return { error: sbErr.message };
        }
        if (sbData.user && !sbData.session) {
          return {
            message: 'Account created! Check your email to confirm your address before signing in.',
            requiresEmailVerification: true
          };
        }
        if (sbData.user) {
          const resolvedPrefs = await syncSupabaseAccessToken(
            sbData.session?.access_token,
            sbData.user,
            trimmedName
          );
          return finalizePostAuthFlow(resolvedPrefs, true);
        }
      }

      return {
        error:
          data?.error ||
          (!data
            ? 'Registration service returned an unexpected response. Please try again.'
            : `Registration failed (${res.status}).`)
      };
    } catch {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sbData, error: sbErr } = await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: { data: { name: trimmedName } }
          });
          if (sbErr) return { error: sbErr.message };
          if (sbData.user && !sbData.session) {
            return {
              message: 'Account created! Check your email to confirm your address before signing in.',
              requiresEmailVerification: true
            };
          }
          if (sbData.user) {
            const resolvedPrefs = await syncSupabaseAccessToken(
              sbData.session?.access_token,
              sbData.user,
              trimmedName
            );
            return finalizePostAuthFlow(resolvedPrefs, true);
          }
        } catch {
          // Fall through to clean network error message
        }
      }
      return { error: 'Unable to reach the registration server. Please check your connection and try again.' };
    }
  };

  const logout = async () => {
    setStoredSessionToken(null);
    setPendingAuthRedirect(null);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors
    }
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore Supabase signout errors
      }
    }
    setIsAuthenticated(false);
    setPreferredGenresState([]);
    setReadingPromptOpen(false);
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
      const data = await parseJsonSafe<{ subscription?: UserProfile['subscription']; error?: string }>(res);
      if (!res.ok || !data?.subscription) {
        return { ok: false, error: data?.error || 'Could not cancel subscription.' };
      }
      setUser(prev => ({
        ...prev,
        subscription: data.subscription!
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
          const data = await parseJsonSafe<{ highlights?: TextHighlight[] }>(res);
          if (data && Array.isArray(data.highlights)) setHighlights(data.highlights);
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
        const data = await parseJsonSafe<{ comments?: ChapterComment[] }>(res);
        if (data && Array.isArray(data.comments)) {
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
      const data = await parseJsonSafe<{ comment?: ChapterComment; error?: string }>(res);
      if (!res.ok || !data?.comment) {
        return { error: data?.error || 'Could not post note.' };
      }
      setChapterComments(prev => [data.comment!, ...prev]);
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
    const data = await parseJsonSafe<{ inquiry?: CommunityInquiry; error?: string }>(res);
    if (!res.ok || !data?.inquiry) {
      throw new Error(data?.error || 'Failed to submit message.');
    }
    const record: CommunityInquiry = data.inquiry;
    setInquiries(prev => [record, ...prev]);
    return record;
  };

  const refreshAdminOverview = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/overview');
      if (res.ok) {
        const data = await parseJsonSafe<AdminOverviewData>(res);
        if (data) {
          setAdminOverview(data);
          setInquiries(data.inquiries || []);
        }
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
      const data = await parseJsonSafe<{ story?: Story; error?: string }>(res);
      if (!res.ok || !data?.story) return { ok: false, error: data?.error || 'Failed to publish story.' };
      setStories(prev => [data.story!, ...prev]);
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
      const data = await parseJsonSafe<{ story?: Story; error?: string }>(res);
      if (!res.ok || !data) return { ok: false, error: data?.error || 'Failed to add chapter.' };
      if (data.story) {
        setStories(prev => prev.map(s => (s.id === storyId ? data.story! : s)));
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
      const data = await parseJsonSafe<{ story?: Story; error?: string }>(res);
      if (!res.ok || !data) return { ok: false, error: data?.error || 'Failed to update pricing.' };
      if (data.story) {
        setStories(prev => prev.map(s => (s.id === storyId ? data.story! : s)));
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
      const data = await parseJsonSafe<{ story?: Story; error?: string }>(res);
      if (!res.ok || !data) return { ok: false, error: data?.error || 'Failed to update workflow status.' };
      if (data.story) {
        setStories(prev => prev.map(s => (s.id === storyId ? data.story! : s)));
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
      const data = await parseJsonSafe<{
        locked?: boolean;
        story?: Story;
        chapter?: Chapter;
        error?: string;
      }>(res);
      if (res.status === 403 || data?.locked) {
        return {
          locked: true,
          story: data?.story,
          chapter: data?.chapter,
          error: data?.error
        };
      }
      if (!res.ok || !data) {
        return { locked: false, error: data?.error || 'Failed to load chapter.' };
      }
      return {
        locked: false,
        story: data.story,
        chapter: data.chapter
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
        pendingAuthRedirect,
        clearPendingAuthRedirect,
        navigateToPath,
        completePostAuthRedirect,
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
        submitInquiry,
        preferredGenres,
        setPreferredGenres,
        readingPromptOpen,
        openReadingPrompt,
        closeReadingPrompt
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
