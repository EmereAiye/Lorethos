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
  ParagraphBookmark,
  ChapterComment,
  CommentTag,
  CommunityInquiry,
  WriterRole,
  StoryBookshelf,
  BookshelfVisibility,
  AdminUserDirectoryEntry
} from '../types';
import { INITIAL_STORIES } from '../data/initialStories';
import { apiFetch, parseJsonSafe, setStoredSessionToken } from '../lib/apiClient';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  ensureSupabaseReaderProfile,
  fetchAllSupabaseProfilesForOwner,
  fetchLatestSupabaseUserRole,
  getCurrentSupabaseAuthAndProfile,
  normalizeWriterRole,
  resolveMergedUserRole,
  updateSupabaseUserProfile,
  updateSupabaseUserRole,
  uploadProfileAvatarToSupabaseStorage,
} from '../lib/writerStories';
import {
  createCommentInSupabase,
  deleteCommentInSupabase,
  fetchCommentsFromSupabase,
} from '../lib/chapterComments';
import { normalizePortableAvatarUrl } from '../utils/avatarImage';
import { recordNightReadingTelemetry } from '../utils/readerAchievements';
import {
  DailyStreakSummary,
  touchDailyEngagementStreak,
} from '../utils/dailyEngagementStreak';

export interface RouteParams {
  slug?: string;
  chapterNumber?: number;
  paragraph?: number;
  highlight?: string;
  q?: string;
  genre?: string;
  status?: string;
  tier?: string;
  sort?: string;
  reference?: string;
  interests?: string;
  redirect?: string;
  reauth?: string;
  tab?: string;
  shelf?: string;
}

export function sanitizeInternalRedirect(target?: string | null): string | null {
  if (!target || typeof target !== 'string') return null;
  const trimmed = target.trim();
  if (!trimmed) return null;
  if (/[\u0000-\u001F\u007F\\]/.test(trimmed)) return null;
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return null;
  }
  try {
    const parsed = new URL(trimmed, 'https://lorethos.local');
    if (parsed.origin !== 'https://lorethos.local') return null;
    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) return null;
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (decodedPath.startsWith('//') || decodedPath.includes('\\')) return null;
    if (parsed.pathname === '/account') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
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
  id?: string;
  storyId: string;
  storyTitle: string;
  storySlug: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  paragraphIndex: number;
  excerpt: string;
  selectedText?: string;
  startOffset?: number;
  endOffset?: number;
  color: HighlightColor;
  note?: string;
}

interface ParagraphBookmarkInput {
  storyId: string;
  storyTitle: string;
  storySlug: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  paragraphIndex: number;
  excerpt: string;
  label?: string;
}

interface CommentInput {
  storyId: string;
  chapterId: string;
  chapterNumber?: number;
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

  // Authentication & post-auth preferences/redirects
  login: (email: string, password: string) => Promise<{
    error?: string;
    message?: string;
    requiresEmailVerification?: boolean;
  }>;
  register: (name: string, email: string, password: string, nickname?: string) => Promise<{
    error?: string;
    message?: string;
    requiresEmailVerification?: boolean;
  }>;
  logout: () => Promise<void>;
  refreshUserRole: () => Promise<WriterRole>;
  updateProfile: (patch: {
    name?: string;
    nickname?: string | null;
    avatar?: string | null;
    bio?: string | null;
  }) => Promise<{ ok: boolean; error?: string; user?: UserProfile }>;
  preferredGenres: string[];
  setPreferredGenres: (genres: string[]) => void;
  readingPromptOpen: boolean;
  openReadingPrompt: () => void;
  closeReadingPrompt: () => void;
  pendingAuthRedirect: string | null;
  clearPendingAuthRedirect: () => void;
  completePostAuthRedirect: (fallbackRoute?: string) => void;

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
  adminUsers: AdminUserDirectoryEntry[];
  refreshAdminUsers: () => Promise<void>;
  updateUserRole: (
    userId: string,
    role: WriterRole,
    email?: string
  ) => Promise<{ ok: boolean; error?: string }>;
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
  dailyStreak: DailyStreakSummary;
  updateReadingGoal: (partial: Partial<ReadingGoal>) => void;
  logChapterCompleted: (chapterId?: string) => boolean;

  // Highlights, Paragraph Bookmarks, Margin Notes, Chapter Comments & Community Inquiries
  highlights: TextHighlight[];
  saveHighlight: (input: HighlightInput) => TextHighlight;
  updateHighlight: (highlightId: string, patch: { color?: HighlightColor; note?: string | null }) => void;
  removeHighlight: (highlightId: string) => void;
  paragraphBookmarks: ParagraphBookmark[];
  saveParagraphBookmark: (input: ParagraphBookmarkInput) => void;
  removeParagraphBookmark: (bookmarkId: string) => void;
  isParagraphBookmarked: (chapterId: string, paragraphIndex: number) => boolean;
  chapterComments: ChapterComment[];
  loadChapterComments: (chapterId: string, storyId?: string) => Promise<void>;
  addChapterComment: (input: CommentInput) => Promise<{ error?: string }>;
  deleteChapterComment: (commentId: string) => Promise<void>;
  inquiries: CommunityInquiry[];
  submitInquiry: (input: InquiryInput) => Promise<CommunityInquiry>;

  // Custom Story Bookshelves / Collections
  myBookshelves: StoryBookshelf[];
  publicBookshelves: StoryBookshelf[];
  refreshBookshelves: () => Promise<void>;
  createBookshelf: (input: {
    name: string;
    description?: string;
    visibility: BookshelfVisibility;
    storyIds?: string[];
  }) => Promise<{ ok: boolean; bookshelf?: StoryBookshelf; error?: string }>;
  updateBookshelf: (
    shelfId: string,
    patch: { name?: string; description?: string | null; visibility?: BookshelfVisibility }
  ) => Promise<{ ok: boolean; bookshelf?: StoryBookshelf; error?: string }>;
  deleteBookshelf: (shelfId: string) => Promise<{ ok: boolean; error?: string }>;
  toggleStoryInBookshelf: (
    shelfId: string,
    storyId: string,
    action?: 'add' | 'remove' | 'toggle'
  ) => Promise<{ ok: boolean; inShelf?: boolean; error?: string }>;
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
  ambientTrack: 'adaptive',
  ambientVolume: 0.6
};

interface GuestProfileOverlay {
  name?: string;
  nickname?: string;
  avatar?: string;
  bio?: string;
}

function loadGuestProfileOverlay(): GuestProfileOverlay {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem('lorethos_guest_profile');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<GuestProfileOverlay>;
    return {
      name: typeof parsed.name === 'string' && parsed.name.trim().length >= 2 ? parsed.name.trim() : undefined,
      nickname: typeof parsed.nickname === 'string' && parsed.nickname.trim() ? parsed.nickname.trim() : undefined,
      avatar: normalizePortableAvatarUrl(parsed.avatar),
      bio: typeof parsed.bio === 'string' && parsed.bio.trim() ? parsed.bio.trim() : undefined,
    };
  } catch {
    return {};
  }
}

function saveGuestProfileOverlay(overlay: GuestProfileOverlay): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('lorethos_guest_profile', JSON.stringify(overlay));
  } catch {
    // Ignore storage quota errors
  }
}

function createGuestUser(withSavedOverlay = false): UserProfile {
  const todayIso = getLocalIsoDate();
  const overlay = withSavedOverlay ? loadGuestProfileOverlay() : {};
  return {
    id: 'guest',
    name: overlay.name || 'Guest Reader',
    nickname: overlay.nickname,
    email: '',
    avatar: overlay.avatar,
    bio: overlay.bio,
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
      if (params?.interests) qs.set('interests', params.interests);
      if (params?.shelf) qs.set('shelf', params.shelf);
      const queryStr = qs.toString();
      return queryStr ? `/stories?${queryStr}` : '/stories';
    }
    case 'story-detail':
      return params?.slug ? `/stories/${encodeURIComponent(params.slug)}` : '/stories';
    case 'reader': {
      if (!params?.slug) return '/stories';
      const base = `/stories/${encodeURIComponent(params.slug)}/chapters/${params.chapterNumber || 1}`;
      const qs = new URLSearchParams();
      if (typeof params.paragraph === 'number' && Number.isInteger(params.paragraph) && params.paragraph >= 0) {
        qs.set('paragraph', String(params.paragraph));
      }
      if (params.highlight) {
        qs.set('highlight', params.highlight);
      }
      const queryStr = qs.toString();
      return queryStr ? `${base}?${queryStr}` : base;
    }
    case 'pricing':
      return '/pricing';
    case 'account': {
      const qs = new URLSearchParams();
      const safeRedirect = sanitizeInternalRedirect(params?.redirect);
      if (safeRedirect) qs.set('redirect', safeRedirect);
      if (params?.reauth) qs.set('reauth', params.reauth);
      if (params?.tab) qs.set('tab', params.tab);
      const queryStr = qs.toString();
      return queryStr ? `/account?${queryStr}` : '/account';
    }
    case 'contact':
      return '/contact';
    case 'studio':
      return '/studio';
    case 'admin':
      return '/admin';
    case 'writer':
      return '/writer';
    case 'profile':
      return '/profile';
    default:
      return '/';
  }
}

function loadSavedPreferredGenres(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`lorethos_preferred_genres_${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === 'string') : [];
  } catch {
    return [];
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
        sort: qs.get('sort') || undefined,
        interests: qs.get('interests') || undefined,
        shelf: qs.get('shelf') || undefined
      }
    };
  }

  const chapterMatch = cleanPath.match(/^\/stories\/([^/]+)\/chapters\/(\d+)$/);
  if (chapterMatch) {
    const rawPara = qs.get('paragraph');
    const parsedPara = rawPara !== null && /^\d+$/.test(rawPara) ? Number(rawPara) : undefined;
    const rawHighlight = qs.get('highlight') || undefined;
    return {
      route: 'reader',
      params: {
        slug: decodeURIComponent(chapterMatch[1]),
        chapterNumber: Number(chapterMatch[2]) || 1,
        ...(parsedPara !== undefined ? { paragraph: parsedPara } : {}),
        ...(rawHighlight ? { highlight: rawHighlight } : {})
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
    const reauth = qs.get('reauth') || undefined;
    const tab = qs.get('tab') || undefined;
    const params: RouteParams = {};
    if (safeRedirect) params.redirect = safeRedirect;
    if (reauth) params.reauth = reauth;
    if (tab) params.tab = tab;
    return {
      route: 'account',
      params
    };
  }
  if (cleanPath === '/contact') return { route: 'contact', params: {} };
  if (cleanPath === '/studio') return { route: 'studio', params: {} };
  if (cleanPath === '/admin') return { route: 'admin', params: {} };
  if (cleanPath === '/writer') return { route: 'writer', params: {} };
  if (cleanPath === '/profile') return { route: 'profile', params: {} };

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
      const guest = createGuestUser(true);
      if (savedGuestGoal) {
        return {
          ...guest,
          readingGoal: reconcileReadingGoalRollover(JSON.parse(savedGuestGoal))
        };
      }
      return guest;
    } catch {
      return createGuestUser(true);
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [adminOverview, setAdminOverview] = useState<AdminOverviewData | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserDirectoryEntry[]>([]);

  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(() => {
    try {
      const saved = localStorage.getItem('lorethos_settings');
      if (!saved) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(saved) as Partial<ReaderSettings>;
      const validTracks = new Set(['adaptive', 'fireplace', 'rain', 'mythic_drone', 'silence']);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        ambientTrack: parsed.ambientTrack && validTracks.has(parsed.ambientTrack) ? parsed.ambientTrack : 'adaptive'
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [highlights, setHighlights] = useState<TextHighlight[]>(() => {
    try {
      const raw = window.localStorage.getItem('lorethos_guest_highlights');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [paragraphBookmarks, setParagraphBookmarks] = useState<ParagraphBookmark[]>(() => {
    try {
      const raw = window.localStorage.getItem('lorethos_guest_paragraph_bookmarks');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [chapterComments, setChapterComments] = useState<ChapterComment[]>([]);
  const [inquiries, setInquiries] = useState<CommunityInquiry[]>([]);
  const [myBookshelves, setMyBookshelves] = useState<StoryBookshelf[]>(() => {
    try {
      const raw = window.localStorage.getItem('lorethos_guest_bookshelves');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [publicBookshelves, setPublicBookshelves] = useState<StoryBookshelf[]>([]);

  const [currentRoute, setCurrentRoute] = useState<string>(initialParsed.route);
  const [routeParams, setRouteParams] = useState<RouteParams>(initialParsed.params);
  const [preferredGenres, setPreferredGenresState] = useState<string[]>([]);
  const [readingPromptOpen, setReadingPromptOpen] = useState(false);
  const [pendingAuthRedirect, setPendingAuthRedirect] = useState<string | null>(() =>
    sanitizeInternalRedirect(initialParsed.params.redirect)
  );

  const [paystackModal, setPaystackModal] = useState<{
    isOpen: boolean;
    data: PaystackCheckoutRequest | null;
  }>({
    isOpen: false,
    data: null
  });
  const [checkoutStatusMessage, setCheckoutStatusMessage] = useState<string | null>(null);
  const [dailyStreak, setDailyStreak] = useState<DailyStreakSummary>(() =>
    touchDailyEngagementStreak(
      user.id,
      new Date(),
      user.readingGoal.streakDays,
      user.readingGoal.bestStreakDays
    )
  );

  const progressSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDailyStreak(
      touchDailyEngagementStreak(
        user.id,
        new Date(),
        user.readingGoal.streakDays,
        user.readingGoal.bestStreakDays
      )
    );
  }, [user.id, user.readingGoal.streakDays, user.readingGoal.bestStreakDays, currentRoute]);

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

  // Persist guest paragraph bookmarks, highlights & bookshelves locally when not authenticated
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      try {
        localStorage.setItem('lorethos_guest_paragraph_bookmarks', JSON.stringify(paragraphBookmarks));
        localStorage.setItem('lorethos_guest_highlights', JSON.stringify(highlights));
        localStorage.setItem('lorethos_guest_bookshelves', JSON.stringify(myBookshelves));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [isAuthenticated, authLoading, paragraphBookmarks, highlights, myBookshelves]);

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
      if (parsed.route === 'account' && parsed.params.redirect) {
        setPendingAuthRedirect(sanitizeInternalRedirect(parsed.params.redirect));
      }
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
      // If the reader created highlights while browsing as a guest before signing in, sync them to their account first
      let guestHighlights: TextHighlight[] = [];
      try {
        const rawGuestHl = window.localStorage.getItem('lorethos_guest_highlights');
        const parsed = rawGuestHl ? JSON.parse(rawGuestHl) : [];
        if (Array.isArray(parsed) && parsed.length > 0) {
          guestHighlights = parsed;
        }
      } catch {
        // Ignore malformed guest storage
      }

      if (guestHighlights.length > 0) {
        for (const hl of guestHighlights) {
          await apiFetch('/api/account/highlights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hl),
          }).catch(() => {});
        }
        try {
          window.localStorage.removeItem('lorethos_guest_highlights');
        } catch {
          // Ignore storage removal errors
        }
      }

      const [txRes, hlRes, pbmRes, shelvesRes] = await Promise.all([
        apiFetch('/api/account/transactions'),
        apiFetch('/api/account/highlights'),
        apiFetch('/api/account/paragraph-bookmarks'),
        apiFetch('/api/bookshelves')
      ]);

      // Sync any guest private bookshelves created before signing in
      let guestShelves: StoryBookshelf[] = [];
      try {
        const rawGuestShelves = window.localStorage.getItem('lorethos_guest_bookshelves');
        const parsed = rawGuestShelves ? JSON.parse(rawGuestShelves) : [];
        if (Array.isArray(parsed) && parsed.length > 0) {
          guestShelves = parsed;
        }
      } catch {
        // Ignore malformed guest storage
      }
      if (guestShelves.length > 0) {
        for (const gs of guestShelves) {
          await apiFetch('/api/account/bookshelves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: gs.name,
              description: gs.description,
              visibility: 'private',
              storyIds: gs.storyIds || [],
            }),
          }).catch(() => {});
        }
        try {
          window.localStorage.removeItem('lorethos_guest_bookshelves');
        } catch {
          // Ignore storage removal errors
        }
        const refreshedShelvesRes = await apiFetch('/api/bookshelves');
        if (refreshedShelvesRes.ok) {
          const refreshedData = await parseJsonSafe<{
            myBookshelves?: StoryBookshelf[];
            publicBookshelves?: StoryBookshelf[];
          }>(refreshedShelvesRes);
          if (refreshedData) {
            setMyBookshelves(Array.isArray(refreshedData.myBookshelves) ? refreshedData.myBookshelves : []);
            setPublicBookshelves(Array.isArray(refreshedData.publicBookshelves) ? refreshedData.publicBookshelves : []);
          }
        }
      } else if (shelvesRes.ok) {
        const shelvesData = await parseJsonSafe<{
          myBookshelves?: StoryBookshelf[];
          publicBookshelves?: StoryBookshelf[];
        }>(shelvesRes);
        if (shelvesData) {
          setMyBookshelves(Array.isArray(shelvesData.myBookshelves) ? shelvesData.myBookshelves : []);
          setPublicBookshelves(Array.isArray(shelvesData.publicBookshelves) ? shelvesData.publicBookshelves : []);
        }
      }

      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(Array.isArray(txData.transactions) ? txData.transactions : []);
      }
      if (hlRes.ok) {
        const hlData = await hlRes.json();
        setHighlights(Array.isArray(hlData.highlights) ? hlData.highlights : []);
      }
      if (pbmRes.ok) {
        const pbmData = await pbmRes.json();
        setParagraphBookmarks(Array.isArray(pbmData.paragraphBookmarks) ? pbmData.paragraphBookmarks : []);
      }
    } catch {
      // Safe fallback
    }
  }, []);

  const refreshBookshelves = useCallback(async () => {
    try {
      const res = await apiFetch('/api/bookshelves');
      if (!res.ok) return;
      const data = await parseJsonSafe<{
        myBookshelves?: StoryBookshelf[];
        publicBookshelves?: StoryBookshelf[];
      }>(res);
      if (!data) return;
      if (Array.isArray(data.publicBookshelves)) {
        setPublicBookshelves(data.publicBookshelves);
      }
      if (isAuthenticated && Array.isArray(data.myBookshelves)) {
        setMyBookshelves(data.myBookshelves);
      }
    } catch {
      // Safe fallback
    }
  }, [isAuthenticated]);

  // Load initial catalog and session on startup
  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const [catalogRes, sessionRes, shelvesRes] = await Promise.all([
          apiFetch('/api/stories'),
          apiFetch('/api/auth/session'),
          apiFetch('/api/bookshelves')
        ]);

        if (shelvesRes.ok && mounted) {
          const shelvesJson = await parseJsonSafe<{ publicBookshelves?: StoryBookshelf[] }>(shelvesRes);
          if (shelvesJson && Array.isArray(shelvesJson.publicBookshelves)) {
            setPublicBookshelves(shelvesJson.publicBookshelves);
          }
        }

        if (catalogRes.ok && mounted) {
          const catalogJson = await catalogRes.json();
          if (Array.isArray(catalogJson.stories) && catalogJson.stories.length > 0) {
            setStories(catalogJson.stories);
          }
        }

        if (sessionRes.ok && mounted) {
          const sessionJson = await sessionRes.json();
          if (sessionJson.authenticated && sessionJson.user) {
            const savedGenres =
              Array.isArray(sessionJson.user.preferredGenres) && sessionJson.user.preferredGenres.length > 0
                ? sessionJson.user.preferredGenres
                : loadSavedPreferredGenres(sessionJson.user.id);

            let resolvedRole = normalizeWriterRole(sessionJson.user.role);
            let resolvedAvatar = normalizePortableAvatarUrl(sessionJson.user.avatar);
            let resolvedNickname = sessionJson.user.nickname;
            let resolvedBio = sessionJson.user.bio;
            if (isSupabaseConfigured && supabase) {
              try {
                const sbState = await getCurrentSupabaseAuthAndProfile();
                const { data: sbSession } = await supabase.auth.getSession();
                const sbAuthId = sbSession.session?.user?.id;
                const sbLookup = await fetchLatestSupabaseUserRole(
                  sbAuthId || sessionJson.user.id,
                  sbSession.session?.user?.email || sessionJson.user.email
                );
                if (sbLookup.source !== 'none') {
                  resolvedRole = resolveMergedUserRole(resolvedRole, sbLookup);
                }
                const sbAvatar = normalizePortableAvatarUrl(sbState.profile?.avatar_url);
                if (!resolvedAvatar && sbAvatar) {
                  resolvedAvatar = sbAvatar;
                } else if (resolvedAvatar && !sbAvatar && sbAuthId) {
                  void updateSupabaseUserProfile(
                    sbAuthId,
                    { avatar: resolvedAvatar, nickname: resolvedNickname, bio: resolvedBio },
                    sessionJson.user.email
                  );
                }
                if (!resolvedNickname && sbState.profile?.nickname) {
                  resolvedNickname = sbState.profile.nickname;
                }
                if (!resolvedBio && sbState.profile?.bio) {
                  resolvedBio = sbState.profile.bio;
                }
              } catch {
                // Keep Express session fields if Supabase lookup fails
              }
            }

            const serverUser: UserProfile = {
              ...sessionJson.user,
              avatar: resolvedAvatar,
              nickname: resolvedNickname,
              bio: resolvedBio,
              role: resolvedRole,
              preferredGenres: savedGenres,
              readingGoal: reconcileReadingGoalRollover(
                sessionJson.user.readingGoal || createGuestUser().readingGoal
              )
            };
            setUser(serverUser);
            setPreferredGenresState(savedGenres);
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
                    role: resolvedRole,
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
            if (isSupabaseConfigured && supabase && mounted) {
              const sbState = await getCurrentSupabaseAuthAndProfile();
              if (sbState.userId && mounted) {
                const guestBase = createGuestUser();
                const displayName = sbState.profile?.username || sbState.email?.split('@')[0] || 'Reader';
                const savedGenres = loadSavedPreferredGenres(sbState.userId);
                setUser({
                  ...guestBase,
                  id: sbState.userId,
                  name: sbState.profile?.name || displayName,
                  nickname: sbState.profile?.nickname || displayName,
                  email: sbState.email || '',
                  avatar: sbState.profile?.avatar_url || undefined,
                  bio: sbState.profile?.bio || undefined,
                  role: normalizeWriterRole(sbState.profile?.role),
                  preferredGenres: savedGenres,
                });
                setPreferredGenresState(savedGenres);
                setIsAuthenticated(true);
              }
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

    const sbAuthSub =
      isSupabaseConfigured && supabase
        ? supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
              const sbState = await getCurrentSupabaseAuthAndProfile();
              if (!mounted || !sbState.userId) return;
              const liveRole = normalizeWriterRole(sbState.profile?.role);
              setUser((prev) => {
                if (prev.id !== 'guest' && prev.email) {
                  return prev.role === liveRole ? prev : { ...prev, role: liveRole };
                }
                const guestBase = createGuestUser();
                const displayName = sbState.profile?.username || sbState.email?.split('@')[0] || 'Reader';
                const savedGenres = loadSavedPreferredGenres(sbState.userId!);
                setPreferredGenresState(savedGenres);
                return {
                  ...guestBase,
                  id: sbState.userId!,
                  name: sbState.profile?.name || displayName,
                  nickname: sbState.profile?.nickname || displayName,
                  email: sbState.email || '',
                  avatar: sbState.profile?.avatar_url || undefined,
                  bio: sbState.profile?.bio || undefined,
                  role: liveRole,
                  preferredGenres: savedGenres,
                };
              });
              setIsAuthenticated(true);
            }
          })
        : null;

    return () => {
      mounted = false;
      sbAuthSub?.data?.subscription?.unsubscribe();
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
      if (route === 'account' && params?.redirect) {
        setPendingAuthRedirect(sanitizeInternalRedirect(params.redirect));
      }
      if (!options?.replace && params?.paragraph === undefined) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  const setPreferredGenres = useCallback((genres: string[]) => {
    const cleaned = Array.from(new Set(genres.map((g) => g.trim()).filter(Boolean)));
    setPreferredGenresState(cleaned);
    setUser((prev) => {
      try {
        window.localStorage.setItem(
          `lorethos_preferred_genres_${prev.id}`,
          JSON.stringify(cleaned)
        );
      } catch {
        // Ignore storage errors
      }
      return { ...prev, preferredGenres: cleaned };
    });
  }, []);

  const openReadingPrompt = useCallback(() => setReadingPromptOpen(true), []);
  const closeReadingPrompt = useCallback(() => setReadingPromptOpen(false), []);
  const clearPendingAuthRedirect = useCallback(() => setPendingAuthRedirect(null), []);

  const completePostAuthRedirect = useCallback(
    (fallbackRoute?: string) => {
      const target = sanitizeInternalRedirect(routeParams.redirect || pendingAuthRedirect);
      setPendingAuthRedirect(null);
      if (target) {
        const url = new URL(target, 'https://lorethos.local');
        const parsed = parseLocationToRoute(url.pathname, url.search);
        navigate(parsed.route, parsed.params, { replace: true });
        return;
      }
      if (fallbackRoute) {
        navigate(fallbackRoute);
      }
    },
    [routeParams.redirect, pendingAuthRedirect, navigate]
  );

  const updateReaderSettings = (partial: Partial<ReaderSettings>) => {
    setReaderSettings(prev => ({ ...prev, ...partial }));
  };

  const login = async (
    email: string,
    password: string
  ): Promise<{ error?: string; message?: string; requiresEmailVerification?: boolean }> => {
    const cleanEmail = email.trim();
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
      });
      const data = await parseJsonSafe<{
        user?: UserProfile;
        token?: string;
        error?: string;
        message?: string;
        requiresEmailVerification?: boolean;
      }>(res);

      // Synchronize Supabase Auth session & live role/profile from Supabase alongside Express login
      let sbLoginOk = false;
      let sbUserId: string | null = null;
      let sbEmail: string | null = null;
      let sbRole: WriterRole = 'reader';
      let sbRoleSource: 'users' | 'profiles' | 'none' = 'none';
      let sbUsername = '';
      let sbAvatar: string | undefined;
      let sbNickname: string | undefined;
      let sbBio: string | undefined;

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          if (!sbErr && sbData.user) {
            sbLoginOk = true;
            sbUserId = sbData.user.id;
            sbEmail = sbData.user.email || cleanEmail;
            const ensured = await ensureSupabaseReaderProfile(
              sbData.user.id,
              data?.user?.nickname ||
                data?.user?.name ||
                (typeof sbData.user.user_metadata?.username === 'string'
                  ? sbData.user.user_metadata.username
                  : '') ||
                cleanEmail.split('@')[0],
              sbEmail
            );
            if (ensured) {
              sbRole = normalizeWriterRole(ensured.role);
              sbUsername = ensured.username;
            }
          }

          // Always fetch live role & saved profile fields directly from Supabase
          const [liveLookup, sbProfileState] = await Promise.all([
            fetchLatestSupabaseUserRole(
              sbUserId || data?.user?.id,
              sbEmail || cleanEmail
            ),
            getCurrentSupabaseAuthAndProfile(),
          ]);
          if (liveLookup.source !== 'none') {
            sbRole = liveLookup.role;
            sbRoleSource = liveLookup.source;
          }
          sbAvatar = normalizePortableAvatarUrl(sbProfileState.profile?.avatar_url);
          sbNickname = sbProfileState.profile?.nickname || undefined;
          sbBio = sbProfileState.profile?.bio || undefined;
          if (!sbUsername && sbProfileState.profile?.username) {
            sbUsername = sbProfileState.profile.username;
          }
        } catch {
          // Keep Express flow independent if Supabase is unavailable
        }
      }

      if (!res.ok || !data?.user) {
        if (sbLoginOk && sbUserId) {
          const guestBase = createGuestUser();
          const displayName = sbUsername || sbEmail?.split('@')[0] || 'Reader';
          const savedGenres = loadSavedPreferredGenres(sbUserId);
          setUser({
            ...guestBase,
            id: sbUserId,
            name: displayName,
            nickname: sbNickname || displayName,
            avatar: sbAvatar,
            bio: sbBio,
            email: sbEmail || cleanEmail,
            role: sbRole,
            preferredGenres: savedGenres,
          });
          setPreferredGenresState(savedGenres);
          setIsAuthenticated(true);
          await refreshStories();
          return { message: 'Signed in successfully.' };
        }
        return { error: data?.error || `Sign-in failed (${res.status}).` };
      }

      if (data.token) {
        setStoredSessionToken(data.token);
      }
      const expressRole = normalizeWriterRole(data.user.role);
      const finalRole: WriterRole = resolveMergedUserRole(expressRole, {
        role: sbRole,
        userRow: null,
        source: sbRoleSource,
      });
      const expressAvatar = normalizePortableAvatarUrl(data.user.avatar);
      const finalAvatar = expressAvatar || sbAvatar;
      if (expressAvatar && !sbAvatar && sbUserId) {
        void updateSupabaseUserProfile(
          sbUserId,
          { avatar: expressAvatar, nickname: data.user.nickname, bio: data.user.bio },
          sbEmail || data.user.email
        );
      }
      const savedGenres =
        Array.isArray(data.user.preferredGenres) && data.user.preferredGenres.length > 0
          ? data.user.preferredGenres
          : loadSavedPreferredGenres(data.user.id);
      setUser({
        ...data.user,
        avatar: finalAvatar,
        nickname: data.user.nickname || sbNickname,
        bio: data.user.bio || sbBio,
        role: finalRole,
        preferredGenres: savedGenres,
        readingGoal: reconcileReadingGoalRollover(
          data.user.readingGoal || createGuestUser().readingGoal
        )
      });
      setPreferredGenresState(savedGenres);
      setIsAuthenticated(true);
      await Promise.all([loadAccountExtras(), refreshStories()]);
      return { message: data.message || 'Signed in successfully.' };
    } catch {
      return { error: 'Network error while signing in.' };
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    nickname?: string
  ): Promise<{ error?: string; message?: string; requiresEmailVerification?: boolean }> => {
    const cleanName = name.trim();
    const cleanNickname = nickname?.trim() || '';
    const cleanEmail = email.trim();
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          nickname: cleanNickname || undefined,
          email: cleanEmail,
          password
        })
      });
      const data = await parseJsonSafe<{
        user?: UserProfile;
        token?: string;
        error?: string;
        message?: string;
        requiresEmailVerification?: boolean;
      }>(res);

      // Register matching Supabase user defaulting strictly to 'reader' in profiles
      let sbRequiresVerification = false;
      if (isSupabaseConfigured && supabase && res.ok) {
        try {
          const derivedUsername = cleanNickname || cleanName || cleanEmail.split('@')[0];
          const { data: sbData, error: sbErr } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                username: derivedUsername,
                full_name: cleanName,
              },
            },
          });
          if (!sbErr && sbData.user) {
            if (sbData.session) {
              await ensureSupabaseReaderProfile(sbData.user.id, derivedUsername, cleanEmail);
            } else {
              sbRequiresVerification = true;
            }
          }
        } catch {
          // Non-blocking if Supabase user already exists or offline
        }
      }

      if (!res.ok) {
        return { error: data?.error || `Registration failed (${res.status}).` };
      }
      if (data?.requiresEmailVerification) {
        return {
          requiresEmailVerification: true,
          message:
            data.message || 'Account created! Check your email to confirm your address before signing in.'
        };
      }
      if (!data?.user) {
        return { error: data?.error || `Registration failed (${res.status}).` };
      }
      if (data.token) {
        setStoredSessionToken(data.token);
      }
      const savedGenres =
        Array.isArray(data.user.preferredGenres) && data.user.preferredGenres.length > 0
          ? data.user.preferredGenres
          : loadSavedPreferredGenres(data.user.id);
      setUser({
        ...data.user,
        preferredGenres: savedGenres,
        readingGoal: reconcileReadingGoalRollover(
          data.user.readingGoal || createGuestUser().readingGoal
        )
      });
      setPreferredGenresState(savedGenres);
      setIsAuthenticated(true);
      const safeRedirect = sanitizeInternalRedirect(routeParams.redirect || pendingAuthRedirect);
      if (safeRedirect) {
        setPendingAuthRedirect(safeRedirect);
      }
      if (savedGenres.length === 0) {
        setReadingPromptOpen(true);
      }
      await Promise.all([loadAccountExtras(), refreshStories()]);
      return {
        message: sbRequiresVerification
          ? 'Account created. Check your email if your Supabase project requires confirmation.'
          : data.message || 'Account created and signed in.'
      };
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
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore Supabase signout errors
      }
    }
    setIsAuthenticated(false);
    setTransactions([]);
    try {
      const rawGuestHl = window.localStorage.getItem('lorethos_guest_highlights');
      const parsedGuestHl = rawGuestHl ? JSON.parse(rawGuestHl) : [];
      setHighlights(Array.isArray(parsedGuestHl) ? parsedGuestHl : []);
    } catch {
      setHighlights([]);
    }
    try {
      const rawGuestBookmarks = window.localStorage.getItem('lorethos_guest_paragraph_bookmarks');
      const parsedGuestBookmarks = rawGuestBookmarks ? JSON.parse(rawGuestBookmarks) : [];
      setParagraphBookmarks(Array.isArray(parsedGuestBookmarks) ? parsedGuestBookmarks : []);
    } catch {
      setParagraphBookmarks([]);
    }
    try {
      const rawGuestShelves = window.localStorage.getItem('lorethos_guest_bookshelves');
      const parsedGuestShelves = rawGuestShelves ? JSON.parse(rawGuestShelves) : [];
      setMyBookshelves(Array.isArray(parsedGuestShelves) ? parsedGuestShelves : []);
    } catch {
      setMyBookshelves([]);
    }
    setAdminOverview(null);
    setAdminUsers([]);
    setPreferredGenresState([]);
    setReadingPromptOpen(false);
    setPendingAuthRedirect(null);
    setUser(createGuestUser(true));
    await Promise.all([refreshStories(), refreshBookshelves()]);
  };

  const refreshUserRole = useCallback(async (): Promise<WriterRole> => {
    let expressRole: WriterRole = normalizeWriterRole(user.role);
    let lookupUserId: string | null = user.id !== 'guest' ? user.id : null;
    let lookupEmail: string | null = user.email || null;

    try {
      const sessionRes = await apiFetch('/api/auth/session');
      if (sessionRes.ok) {
        const sessionJson = await parseJsonSafe<{ authenticated?: boolean; user?: UserProfile }>(sessionRes);
        if (sessionJson?.authenticated && sessionJson.user) {
          lookupUserId = sessionJson.user.id;
          lookupEmail = sessionJson.user.email || lookupEmail;
          expressRole = normalizeWriterRole(sessionJson.user.role);
        }
      }
    } catch {
      // Ignore session fallback error when offline
    }

    let resolvedRole: WriterRole = expressRole;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sbUser = sessionData.session?.user;
        const sbLookup = await fetchLatestSupabaseUserRole(
          sbUser?.id || lookupUserId,
          sbUser?.email || lookupEmail
        );
        resolvedRole = resolveMergedUserRole(expressRole, sbLookup);
      } catch {
        // Keep current resolvedRole if Supabase check fails
      }
    }

    setUser((prev) => (prev.role === resolvedRole ? prev : { ...prev, role: resolvedRole }));
    return resolvedRole;
  }, [user.id, user.email, user.role]);

  const updateProfile = useCallback(
    async (patch: {
      name?: string;
      nickname?: string | null;
      avatar?: string | null;
      bio?: string | null;
    }): Promise<{ ok: boolean; error?: string; user?: UserProfile }> => {
      if (patch.name !== undefined) {
        const trimmed = patch.name.trim();
        if (trimmed.length < 2 || trimmed.length > 80) {
          return { ok: false, error: 'Name must be between 2 and 80 characters.' };
        }
      }
      if (patch.nickname !== undefined && patch.nickname !== null && patch.nickname.trim() !== '') {
        const trimmed = patch.nickname.trim();
        if (trimmed.length < 2 || trimmed.length > 40) {
          return { ok: false, error: 'Nickname must be between 2 and 40 characters.' };
        }
      }
      if (patch.bio !== undefined && patch.bio !== null && patch.bio.trim().length > 200) {
        return { ok: false, error: 'Bio must be 200 characters or fewer.' };
      }

      let normalizedPatch = { ...patch };
      if (patch.avatar !== undefined) {
        if (patch.avatar === null) {
          normalizedPatch.avatar = null;
        } else {
          const normalizedUrl = normalizePortableAvatarUrl(patch.avatar);
          normalizedPatch.avatar = normalizedUrl ?? null;
        }
      }

      if (!isAuthenticated) {
        const nextUser: UserProfile = {
          ...user,
          name: normalizedPatch.name !== undefined ? normalizedPatch.name.trim() : user.name,
          nickname:
            normalizedPatch.nickname === null
              ? undefined
              : normalizedPatch.nickname !== undefined
              ? normalizedPatch.nickname.trim() || undefined
              : user.nickname,
          avatar:
            normalizedPatch.avatar === null
              ? undefined
              : normalizedPatch.avatar !== undefined
              ? normalizedPatch.avatar.trim() || undefined
              : user.avatar,
          bio:
            normalizedPatch.bio === null
              ? undefined
              : normalizedPatch.bio !== undefined
              ? normalizedPatch.bio.trim() || undefined
              : user.bio,
        };
        saveGuestProfileOverlay({
          name: nextUser.name,
          nickname: nextUser.nickname,
          avatar: nextUser.avatar,
          bio: nextUser.bio,
        });
        setUser(nextUser);
        return { ok: true, user: nextUser };
      }

      // If uploading a gallery photo while authenticated with Supabase, try cloud storage first
      // so the avatar loads cleanly via HTTPS across all phones and web origins.
      let supabaseUserId: string | null = null;
      let supabaseEmail: string | null = user.email || null;
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sbSess } = await supabase.auth.getSession();
          supabaseUserId = sbSess.session?.user?.id || null;
          supabaseEmail = sbSess.session?.user?.email || supabaseEmail;
          if (
            supabaseUserId &&
            typeof normalizedPatch.avatar === 'string' &&
            normalizedPatch.avatar.startsWith('data:image/')
          ) {
            const uploadedUrl = await uploadProfileAvatarToSupabaseStorage(
              normalizedPatch.avatar,
              supabaseUserId
            );
            if (uploadedUrl) {
              normalizedPatch = { ...normalizedPatch, avatar: uploadedUrl };
            }
          }
        } catch {
          // Keep compact inline data URL fallback when storage bucket upload is unavailable
        }
      }

      try {
        const res = await apiFetch('/api/account/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizedPatch),
        });
        const data = await parseJsonSafe<{ user?: UserProfile; error?: string }>(res);

        if (res.ok && data?.user) {
          const nextUser: UserProfile = {
            ...user,
            ...data.user,
            avatar: normalizePortableAvatarUrl(data.user.avatar ?? normalizedPatch.avatar ?? user.avatar),
            preferredGenres: user.preferredGenres,
            readingGoal: user.readingGoal,
          };
          setUser(nextUser);

          if (supabaseUserId) {
            await updateSupabaseUserProfile(supabaseUserId, normalizedPatch, supabaseEmail);
          }

          return { ok: true, user: nextUser };
        }

        if (res.status === 401 && supabaseUserId) {
          const sbRes = await updateSupabaseUserProfile(supabaseUserId, normalizedPatch, supabaseEmail);
          if (!sbRes.ok) {
            return { ok: false, error: sbRes.error || 'Could not update your profile.' };
          }
          const nextUser: UserProfile = {
            ...user,
            name: normalizedPatch.name !== undefined ? normalizedPatch.name.trim() : user.name,
            nickname:
              normalizedPatch.nickname === null
                ? undefined
                : normalizedPatch.nickname !== undefined
                ? normalizedPatch.nickname.trim() || undefined
                : user.nickname,
            avatar:
              normalizedPatch.avatar === null
                ? undefined
                : normalizedPatch.avatar !== undefined
                ? normalizedPatch.avatar.trim() || undefined
                : user.avatar,
            bio:
              normalizedPatch.bio === null
                ? undefined
                : normalizedPatch.bio !== undefined
                ? normalizedPatch.bio.trim() || undefined
                : user.bio,
          };
          setUser(nextUser);
          return { ok: true, user: nextUser };
        }

        return { ok: false, error: data?.error || `Failed to update profile (${res.status}).` };
      } catch {
        return { ok: false, error: 'Network error while saving profile.' };
      }
    },
    [isAuthenticated, user]
  );

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

  const queuePendingReadingProgress = useCallback(
    (
      targetUserId: string,
      payload: { storyId: string; chapterId: string; chapterNumber: number; progressPercent: number }
    ) => {
      if (typeof window === 'undefined' || !targetUserId || targetUserId === 'guest') return;
      try {
        const key = `lorethos_pending_progress_${targetUserId}`;
        const raw = window.localStorage.getItem(key);
        const existing: Record<string, typeof payload> = raw ? JSON.parse(raw) : {};
        existing[payload.storyId] = payload;
        window.localStorage.setItem(key, JSON.stringify(existing));
      } catch {
        // Ignore localStorage quota failures
      }
    },
    []
  );

  const flushPendingReadingProgress = useCallback(async (targetUserId: string) => {
    if (
      typeof window === 'undefined' ||
      !targetUserId ||
      targetUserId === 'guest' ||
      (typeof navigator !== 'undefined' && navigator.onLine === false)
    ) {
      return;
    }
    const key = `lorethos_pending_progress_${targetUserId}`;
    let pending: Record<
      string,
      { storyId: string; chapterId: string; chapterNumber: number; progressPercent: number }
    > = {};
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      pending = JSON.parse(raw) || {};
    } catch {
      return;
    }
    const entries = Object.values(pending);
    if (entries.length === 0) return;

    const remaining: typeof pending = {};
    for (const item of entries) {
      try {
        const res = await apiFetch('/api/account/progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (!res.ok && res.status >= 500) {
          remaining[item.storyId] = item;
        }
      } catch {
        remaining[item.storyId] = item;
      }
    }

    try {
      if (Object.keys(remaining).length === 0) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(remaining));
      }
    } catch {
      // Ignore storage failures
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || user.id === 'guest') return;
    void flushPendingReadingProgress(user.id);
    const onOnline = () => {
      void flushPendingReadingProgress(user.id);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('lorethos:network-online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('lorethos:network-online', onOnline);
    };
  }, [isAuthenticated, user.id, flushPendingReadingProgress]);

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

      if (rounded >= 10) {
        recordNightReadingTelemetry(user.id);
        setDailyStreak(
          touchDailyEngagementStreak(
            user.id,
            new Date(),
            user.readingGoal.streakDays,
            user.readingGoal.bestStreakDays
          )
        );
      }

      if (isAuthenticated) {
        const payload = { storyId, chapterId, chapterNumber, progressPercent: rounded };
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          queuePendingReadingProgress(user.id, payload);
          return;
        }
        if (progressSaveTimerRef.current) {
          window.clearTimeout(progressSaveTimerRef.current);
        }
        progressSaveTimerRef.current = window.setTimeout(() => {
          void apiFetch('/api/account/progress', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
            .then((res) => {
              if (!res.ok) {
                queuePendingReadingProgress(user.id, payload);
              }
            })
            .catch(() => {
              queuePendingReadingProgress(user.id, payload);
            });
        }, 2500);
      }
    },
    [isAuthenticated, user.id, queuePendingReadingProgress]
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

      if (wasLogged) {
        recordNightReadingTelemetry(user.id);
        setDailyStreak(
          touchDailyEngagementStreak(
            user.id,
            new Date(),
            user.readingGoal.streakDays + 1,
            user.readingGoal.bestStreakDays + 1
          )
        );
      }

      return wasLogged;
    },
    [syncGoalToServer, user.id, user.readingGoal.streakDays, user.readingGoal.bestStreakDays]
  );

  const saveHighlight = (input: HighlightInput): TextHighlight => {
    const hasOffsets =
      typeof input.startOffset === 'number' && typeof input.endOffset === 'number';
    const existing = highlights.find((h) => {
      if (input.id && h.id === input.id) return true;
      if (!hasOffsets && typeof h.startOffset !== 'number') {
        return h.chapterId === input.chapterId && h.paragraphIndex === input.paragraphIndex;
      }
      return false;
    });

    const record: TextHighlight = {
      id: existing ? existing.id : input.id || `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      storyId: input.storyId,
      storyTitle: input.storyTitle,
      storySlug: input.storySlug,
      chapterId: input.chapterId,
      chapterNumber: input.chapterNumber,
      chapterTitle: input.chapterTitle,
      paragraphIndex: input.paragraphIndex,
      excerpt: input.excerpt,
      selectedText: input.selectedText,
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      color: input.color,
      note: input.note,
      createdAt: existing ? existing.createdAt : 'Just now',
      updatedAt: existing ? 'Just now' : undefined
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

    return record;
  };

  const updateHighlight = (
    highlightId: string,
    patch: { color?: HighlightColor; note?: string | null }
  ) => {
    setHighlights((prev) =>
      prev.map((h) => {
        if (h.id !== highlightId) return h;
        return {
          ...h,
          color: patch.color ?? h.color,
          note:
            patch.note === null
              ? undefined
              : patch.note !== undefined
              ? patch.note.trim() || undefined
              : h.note,
          updatedAt: 'Just now',
        };
      })
    );

    if (isAuthenticated) {
      void apiFetch(`/api/account/highlights/${encodeURIComponent(highlightId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
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
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.highlights)) setHighlights(data.highlights);
        }
      });
    }
  };

  const saveParagraphBookmark = (input: ParagraphBookmarkInput) => {
    const existing = paragraphBookmarks.find(
      b => b.chapterId === input.chapterId && b.paragraphIndex === input.paragraphIndex
    );
    const cleanedLabel = input.label?.trim() || undefined;

    const record: ParagraphBookmark = {
      id: existing ? existing.id : `pbm-${Date.now()}-${input.paragraphIndex}`,
      storyId: input.storyId,
      storyTitle: input.storyTitle,
      storySlug: input.storySlug,
      chapterId: input.chapterId,
      chapterNumber: input.chapterNumber,
      chapterTitle: input.chapterTitle,
      paragraphIndex: input.paragraphIndex,
      label: cleanedLabel,
      excerpt: input.excerpt,
      createdAt: 'Just now'
    };

    setParagraphBookmarks(prev =>
      existing ? prev.map(b => (b.id === existing.id ? record : b)) : [record, ...prev]
    );

    if (isAuthenticated) {
      void apiFetch('/api/account/paragraph-bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.paragraphBookmarks)) {
            setParagraphBookmarks(data.paragraphBookmarks);
          }
        }
      });
    }
  };

  const removeParagraphBookmark = (bookmarkId: string) => {
    setParagraphBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
    if (isAuthenticated) {
      void apiFetch(`/api/account/paragraph-bookmarks/${encodeURIComponent(bookmarkId)}`, {
        method: 'DELETE',
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.paragraphBookmarks)) {
            setParagraphBookmarks(data.paragraphBookmarks);
          }
        }
      });
    }
  };

  const isParagraphBookmarked = useCallback(
    (chapterId: string, paragraphIndex: number) =>
      paragraphBookmarks.some(b => b.chapterId === chapterId && b.paragraphIndex === paragraphIndex),
    [paragraphBookmarks]
  );

  const loadChapterComments = useCallback(async (chapterId: string, storyId?: string) => {
    if (isSupabaseConfigured && supabase && storyId) {
      const sbRes = await fetchCommentsFromSupabase(storyId, chapterId);
      if (!sbRes.error) {
        setChapterComments(sbRes.comments);
        return;
      }
    }

    try {
      const query = chapterId === 'all' ? '' : `?chapterId=${encodeURIComponent(chapterId)}`;
      const res = await apiFetch(`/api/comments${query}`);
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

    if (isSupabaseConfigured && supabase) {
      const displayAuthor = user.nickname?.trim() || user.name || 'Lorethos Reader';
      const sbRes = await createCommentInSupabase({
        storyId: input.storyId,
        chapterId: input.chapterId,
        chapterNumber: input.chapterNumber ?? 1,
        authorName: displayAuthor,
        tag: input.tag,
        body: input.body,
      });

      if (sbRes.comment) {
        setChapterComments(prev => [sbRes.comment!, ...prev]);
        return {};
      }
      if (!sbRes.requiresAuth && sbRes.error) {
        return { error: sbRes.error };
      }
      if (sbRes.requiresAuth) {
        return { error: sbRes.error || 'Please sign in to post chapter feedback.' };
      }
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
    if (isSupabaseConfigured && supabase) {
      const sbDel = await deleteCommentInSupabase(commentId);
      if (!sbDel.error) return;
    }
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

  const createBookshelf = async (input: {
    name: string;
    description?: string;
    visibility: BookshelfVisibility;
    storyIds?: string[];
  }): Promise<{ ok: boolean; bookshelf?: StoryBookshelf; error?: string }> => {
    const cleanName = input.name.trim();
    const cleanDesc = input.description?.trim() || undefined;
    if (cleanName.length < 2 || cleanName.length > 60) {
      return { ok: false, error: 'Bookshelf name must be between 2 and 60 characters.' };
    }
    if (cleanDesc && cleanDesc.length > 200) {
      return { ok: false, error: 'Description must be 200 characters or fewer.' };
    }

    if (!isAuthenticated) {
      if (input.visibility === 'public') {
        return {
          ok: false,
          error: 'Sign in on the Account page to publish a Public list, or switch to Private to save on this device.',
        };
      }
      const nowIso = new Date().toISOString();
      const shelf: StoryBookshelf = {
        id: `guest-shelf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerId: 'guest',
        ownerName: user.nickname?.trim() || user.name || 'Guest Reader',
        name: cleanName,
        description: cleanDesc,
        visibility: 'private',
        storyIds: Array.from(new Set(input.storyIds || [])),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setMyBookshelves((prev) => [shelf, ...prev]);
      return { ok: true, bookshelf: shelf };
    }

    try {
      const res = await apiFetch('/api/account/bookshelves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          description: cleanDesc,
          visibility: input.visibility,
          storyIds: input.storyIds || [],
        }),
      });
      const data = await parseJsonSafe<{
        bookshelf?: StoryBookshelf;
        myBookshelves?: StoryBookshelf[];
        publicBookshelves?: StoryBookshelf[];
        error?: string;
      }>(res);
      if (!res.ok || !data?.bookshelf) {
        return { ok: false, error: data?.error || 'Could not create bookshelf.' };
      }
      if (Array.isArray(data.myBookshelves)) setMyBookshelves(data.myBookshelves);
      if (Array.isArray(data.publicBookshelves)) setPublicBookshelves(data.publicBookshelves);
      return { ok: true, bookshelf: data.bookshelf };
    } catch {
      return { ok: false, error: 'Network error while creating bookshelf.' };
    }
  };

  const updateBookshelf = async (
    shelfId: string,
    patch: { name?: string; description?: string | null; visibility?: BookshelfVisibility }
  ): Promise<{ ok: boolean; bookshelf?: StoryBookshelf; error?: string }> => {
    if (patch.name !== undefined) {
      const cleanName = patch.name.trim();
      if (cleanName.length < 2 || cleanName.length > 60) {
        return { ok: false, error: 'Bookshelf name must be between 2 and 60 characters.' };
      }
    }

    if (!isAuthenticated) {
      if (patch.visibility === 'public') {
        return {
          ok: false,
          error: 'Sign in on the Account page to publish this bookshelf publicly.',
        };
      }
      let updatedShelf: StoryBookshelf | undefined;
      setMyBookshelves((prev) =>
        prev.map((s) => {
          if (s.id !== shelfId) return s;
          updatedShelf = {
            ...s,
            name: patch.name !== undefined ? patch.name.trim() : s.name,
            description:
              patch.description === null
                ? undefined
                : patch.description !== undefined
                ? patch.description.trim() || undefined
                : s.description,
            visibility: 'private',
            updatedAt: new Date().toISOString(),
          };
          return updatedShelf;
        })
      );
      return updatedShelf ? { ok: true, bookshelf: updatedShelf } : { ok: false, error: 'Bookshelf not found.' };
    }

    try {
      const res = await apiFetch(`/api/account/bookshelves/${encodeURIComponent(shelfId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await parseJsonSafe<{
        bookshelf?: StoryBookshelf;
        myBookshelves?: StoryBookshelf[];
        publicBookshelves?: StoryBookshelf[];
        error?: string;
      }>(res);
      if (!res.ok || !data?.bookshelf) {
        return { ok: false, error: data?.error || 'Could not update bookshelf.' };
      }
      if (Array.isArray(data.myBookshelves)) setMyBookshelves(data.myBookshelves);
      if (Array.isArray(data.publicBookshelves)) setPublicBookshelves(data.publicBookshelves);
      return { ok: true, bookshelf: data.bookshelf };
    } catch {
      return { ok: false, error: 'Network error while updating bookshelf.' };
    }
  };

  const deleteBookshelf = async (shelfId: string): Promise<{ ok: boolean; error?: string }> => {
    if (!isAuthenticated) {
      setMyBookshelves((prev) => prev.filter((s) => s.id !== shelfId));
      return { ok: true };
    }

    try {
      const res = await apiFetch(`/api/account/bookshelves/${encodeURIComponent(shelfId)}`, {
        method: 'DELETE',
      });
      const data = await parseJsonSafe<{
        myBookshelves?: StoryBookshelf[];
        publicBookshelves?: StoryBookshelf[];
        error?: string;
      }>(res);
      if (!res.ok) {
        return { ok: false, error: data?.error || 'Could not delete bookshelf.' };
      }
      if (Array.isArray(data?.myBookshelves)) setMyBookshelves(data.myBookshelves);
      if (Array.isArray(data?.publicBookshelves)) setPublicBookshelves(data.publicBookshelves);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while deleting bookshelf.' };
    }
  };

  const toggleStoryInBookshelf = async (
    shelfId: string,
    storyId: string,
    action: 'add' | 'remove' | 'toggle' = 'toggle'
  ): Promise<{ ok: boolean; inShelf?: boolean; error?: string }> => {
    if (!isAuthenticated) {
      let inShelf = false;
      setMyBookshelves((prev) =>
        prev.map((s) => {
          if (s.id !== shelfId) return s;
          const exists = s.storyIds.includes(storyId);
          let nextIds = [...s.storyIds];
          if (action === 'add' || (action === 'toggle' && !exists)) {
            if (!exists) nextIds.unshift(storyId);
            inShelf = true;
          } else if (action === 'remove' || (action === 'toggle' && exists)) {
            nextIds = nextIds.filter((id) => id !== storyId);
            inShelf = false;
          }
          return { ...s, storyIds: nextIds, updatedAt: new Date().toISOString() };
        })
      );
      return { ok: true, inShelf };
    }

    try {
      const res = await apiFetch(
        `/api/account/bookshelves/${encodeURIComponent(shelfId)}/stories`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyId, action }),
        }
      );
      const data = await parseJsonSafe<{
        inShelf?: boolean;
        myBookshelves?: StoryBookshelf[];
        publicBookshelves?: StoryBookshelf[];
        error?: string;
      }>(res);
      if (!res.ok) {
        return { ok: false, error: data?.error || 'Could not update bookshelf stories.' };
      }
      if (Array.isArray(data?.myBookshelves)) setMyBookshelves(data.myBookshelves);
      if (Array.isArray(data?.publicBookshelves)) setPublicBookshelves(data.publicBookshelves);
      return { ok: true, inShelf: data?.inShelf };
    } catch {
      return { ok: false, error: 'Network error while organizing bookshelf.' };
    }
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

  const refreshAdminUsers = useCallback(async () => {
    const mergedMap = new Map<string, AdminUserDirectoryEntry>();
    const emailToKey = new Map<string, string>();

    try {
      const [serverRes, sbRes] = await Promise.all([
        apiFetch('/api/admin/users').catch(() => null),
        fetchAllSupabaseProfilesForOwner(),
      ]);

      if (serverRes && serverRes.ok) {
        const serverJson = await parseJsonSafe<{ users?: AdminUserDirectoryEntry[] }>(serverRes);
        if (Array.isArray(serverJson?.users)) {
          for (const entry of serverJson.users) {
            const emailKey = entry.email?.trim().toLowerCase() || '';
            const key = emailKey || entry.id;
            mergedMap.set(key, {
              ...entry,
              avatar: normalizePortableAvatarUrl(entry.avatar),
              role: normalizeWriterRole(entry.role),
            });
            if (emailKey) emailToKey.set(emailKey, key);
          }
        }
      }

      for (const sbEntry of sbRes.users) {
        const emailKey = sbEntry.email?.trim().toLowerCase() || '';
        const existingKey = (emailKey && emailToKey.get(emailKey)) || sbEntry.id;
        const existing = mergedMap.get(existingKey);
        if (!existing) {
          mergedMap.set(existingKey, sbEntry);
          if (emailKey) emailToKey.set(emailKey, existingKey);
        } else {
          const mergedRole = resolveMergedUserRole(existing.role, {
            role: sbEntry.role,
            userRow: null,
            source: 'users',
          });
          mergedMap.set(existingKey, {
            ...existing,
            nickname: existing.nickname || sbEntry.nickname,
            avatar: existing.avatar || sbEntry.avatar,
            bio: existing.bio || sbEntry.bio,
            role: mergedRole,
            source: 'merged',
          });
        }
      }

      const roleWeight: Record<WriterRole, number> = {
        owner: 0,
        admin: 1,
        writer: 2,
        reader: 3,
      };
      const sorted = Array.from(mergedMap.values()).sort((a, b) => {
        const rankDiff = roleWeight[a.role] - roleWeight[b.role];
        if (rankDiff !== 0) return rankDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setAdminUsers(sorted);
    } catch {
      // Ignore if unauthorized
    }
  }, []);

  const updateUserRole = useCallback(
    async (
      userId: string,
      role: WriterRole,
      email?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      let serverOk = false;
      let serverNotFound = false;
      let serverError: string | undefined;

      try {
        const res = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        });
        const data = await parseJsonSafe<{
          user?: AdminUserDirectoryEntry;
          users?: AdminUserDirectoryEntry[];
          error?: string;
        }>(res);
        if (res.ok) {
          serverOk = true;
        } else if (res.status === 404) {
          serverNotFound = true;
          serverError = data?.error;
        } else {
          return { ok: false, error: data?.error || `Failed to update role (${res.status}).` };
        }
      } catch {
        serverError = 'Network error while updating user role.';
      }

      const sbRes = await updateSupabaseUserRole(userId, email, role);
      if (!serverOk && (!serverNotFound || !sbRes.ok)) {
        return {
          ok: false,
          error: serverError || sbRes.error || 'Could not update account role.',
        };
      }

      setAdminUsers((prev) =>
        prev.map((entry) =>
          entry.id === userId || (email && entry.email.toLowerCase() === email.toLowerCase())
            ? { ...entry, role }
            : entry
        )
      );
      await Promise.all([refreshAdminUsers(), refreshAdminOverview()]);
      return { ok: true };
    },
    [refreshAdminUsers, refreshAdminOverview]
  );

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
      if (user.role === 'owner' || user.role === 'admin') return true;
      if (user.subscription.status === 'active' && story.accessTier === 'subscription') return true;
      if (user.unlockedStoryIds.includes(story.id)) return true;
      return false;
    },
    [isAuthenticated, user]
  );

  const formatProgressTimestamp = (raw?: string): string => {
    if (!raw || typeof raw !== 'string') return 'Recently';
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }
    return trimmed;
  };

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
      lastReadAt: formatProgressTimestamp(progressData.lastReadAt)
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
        refreshUserRole,
        updateProfile,
        preferredGenres,
        setPreferredGenres,
        readingPromptOpen,
        openReadingPrompt,
        closeReadingPrompt,
        pendingAuthRedirect,
        clearPendingAuthRedirect,
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
        adminUsers,
        refreshAdminUsers,
        updateUserRole,
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
        dailyStreak,
        updateReadingGoal,
        logChapterCompleted,
        highlights,
        saveHighlight,
        updateHighlight,
        removeHighlight,
        paragraphBookmarks,
        saveParagraphBookmark,
        removeParagraphBookmark,
        isParagraphBookmarked,
        chapterComments,
        loadChapterComments,
        addChapterComment,
        deleteChapterComment,
        inquiries,
        submitInquiry,
        myBookshelves,
        publicBookshelves,
        refreshBookshelves,
        createBookshelf,
        updateBookshelf,
        deleteBookshelf,
        toggleStoryInBookshelf
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
