import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Story, 
  Chapter, 
  UserProfile, 
  PaymentTransaction, 
  ReaderSettings, 
  AccessTier,
  ReaderTheme,
  ReadingGoal 
} from '../types';
import { INITIAL_STORIES, INITIAL_TRANSACTIONS } from '../data/initialStories';

interface PaystackCheckoutRequest {
  type: 'subscription' | 'book_purchase';
  title: string;
  amountNgn: number;
  planId?: 'monthly' | 'annual';
  storyId?: string;
}

interface AppContextType {
  stories: Story[];
  user: UserProfile;
  transactions: PaymentTransaction[];
  readerSettings: ReaderSettings;
  currentRoute: string;
  routeParams: { slug?: string; chapterNumber?: number };
  navigate: (route: string, params?: { slug?: string; chapterNumber?: number }) => void;
  updateReaderSettings: (partial: Partial<ReaderSettings>) => void;
  
  // Paystack checkout modal
  paystackModal: {
    isOpen: boolean;
    data: PaystackCheckoutRequest | null;
  };
  openPaystackCheckout: (request: PaystackCheckoutRequest) => void;
  closePaystackCheckout: () => void;
  completePaystackPayment: (channel: 'card' | 'bank_transfer' | 'ussd') => void;
  
  // User interactions
  toggleBookmark: (chapterId: string) => void;
  recordReadingProgress: (storyId: string, chapterId: string, chapterNumber: number, progressPercent: number) => void;
  toggleRole: () => void;
  
  // Admin publishing controls
  updateStory: (updatedStory: Story) => void;
  addStory: (newStory: Omit<Story, 'id' | 'chapters'>) => void;
  addChapterToStory: (storyId: string, chapterData: Omit<Chapter, 'id' | 'storyId'>) => void;
  updateStoryPricing: (storyId: string, tier: AccessTier, priceNgn: number, freeChaptersCount: number) => void;
  
  // Helper getters
  getStoryBySlug: (slug: string) => Story | undefined;
  getChapter: (storySlug: string, chapterNumber: number) => { story: Story; chapter: Chapter } | null;
  hasAccessToChapter: (story: Story, chapter: Chapter) => boolean;
  setTheme: (theme: ReaderTheme) => void;
  activeProgress: { story: Story; chapterNumber: number; progressPercent: number; lastReadAt: string } | null;
  updateReadingGoal: (partial: Partial<ReadingGoal>) => void;
  logChapterCompleted: () => void;
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

const DEFAULT_USER: UserProfile = {
  id: 'user-folake-01',
  name: 'Folake Adebayo',
  email: 'folake.adebayo@gmail.com',
  role: 'reader',
  subscription: {
    plan: 'free',
    status: 'none',
    amountNgn: 0
  },
  unlockedStoryIds: [],
  bookmarkedChapterIds: ['ch-obsidian-1', 'ch-baobab-2'],
  readingProgress: {
    'story-obsidian-throne': {
      chapterId: 'ch-obsidian-1',
      chapterNumber: 1,
      progressPercent: 75,
      lastReadAt: '2 hours ago'
    },
    'story-whispering-savanna': {
      chapterId: 'ch-baobab-1',
      chapterNumber: 1,
      progressPercent: 30,
      lastReadAt: 'Yesterday'
    }
  },
  readingGoal: {
    frequency: 'daily',
    targetChapters: 2,
    currentProgress: 1,
    streakDays: 5,
    bestStreakDays: 14,
    lastUpdatedDate: 'Today',
    history: [
      { dayName: 'Mon', dateStr: 'Nov 06', chaptersRead: 2, metTarget: true },
      { dayName: 'Tue', dateStr: 'Nov 07', chaptersRead: 3, metTarget: true },
      { dayName: 'Wed', dateStr: 'Nov 08', chaptersRead: 2, metTarget: true },
      { dayName: 'Thu', dateStr: 'Nov 09', chaptersRead: 4, metTarget: true },
      { dayName: 'Fri', dateStr: 'Nov 10', chaptersRead: 2, metTarget: true },
      { dayName: 'Sat', dateStr: 'Nov 11', chaptersRead: 2, metTarget: true },
      { dayName: 'Sun', dateStr: 'Nov 12', chaptersRead: 1, metTarget: false }
    ]
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stories, setStories] = useState<Story[]>(() => {
    const saved = localStorage.getItem('lorethos_stories');
    if (saved) {
      try {
        const parsed: Story[] = JSON.parse(saved);
        return parsed.map(s => ({
          ...s,
          coverImage: s.coverImage?.startsWith('/src/assets/images/')
            ? s.coverImage.replace('/src/assets/images/', '/assets/images/')
            : s.coverImage
        }));
      } catch {
        return INITIAL_STORIES;
      }
    }
    return INITIAL_STORIES;
  });

  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('lorethos_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.readingGoal) {
          parsed.readingGoal = DEFAULT_USER.readingGoal;
        }
        return parsed;
      } catch (e) {
        return DEFAULT_USER;
      }
    }
    return DEFAULT_USER;
  });

  const [transactions, setTransactions] = useState<PaymentTransaction[]>(() => {
    const saved = localStorage.getItem('lorethos_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(() => {
    const saved = localStorage.getItem('lorethos_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [currentRoute, setCurrentRoute] = useState<string>('home');
  const [routeParams, setRouteParams] = useState<{ slug?: string; chapterNumber?: number }>({});

  const [paystackModal, setPaystackModal] = useState<{
    isOpen: boolean;
    data: PaystackCheckoutRequest | null;
  }>({
    isOpen: false,
    data: null
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('lorethos_stories', JSON.stringify(stories));
  }, [stories]);

  useEffect(() => {
    localStorage.setItem('lorethos_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('lorethos_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('lorethos_settings', JSON.stringify(readerSettings));
  }, [readerSettings]);

  // Synchronize document classes based on reader theme (day, sepia, night)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'sepia');
    if (readerSettings.theme === 'night') {
      root.classList.add('dark');
    } else if (readerSettings.theme === 'sepia') {
      root.classList.add('sepia');
    }
  }, [readerSettings.theme]);

  const setTheme = (theme: ReaderTheme) => {
    updateReaderSettings({ theme });
  };

  // Find the most recently read story for the global Continue Reading / Progress indicator
  const activeProgress = React.useMemo(() => {
    const progressKeys = Object.keys(user.readingProgress);
    if (progressKeys.length === 0) return null;
    
    // Pick first or most recent
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

  const navigate = (route: string, params?: { slug?: string; chapterNumber?: number }) => {
    setCurrentRoute(route);
    setRouteParams(params || {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateReaderSettings = (partial: Partial<ReaderSettings>) => {
    setReaderSettings(prev => ({ ...prev, ...partial }));
  };

  const openPaystackCheckout = (request: PaystackCheckoutRequest) => {
    setPaystackModal({ isOpen: true, data: request });
  };

  const closePaystackCheckout = () => {
    setPaystackModal({ isOpen: false, data: null });
  };

  const completePaystackPayment = (channel: 'card' | 'bank_transfer' | 'ussd') => {
    if (!paystackModal.data) return;

    const request = paystackModal.data;
    const refCode = `pstk_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString().slice(-4)}`;

    const newTx: PaymentTransaction = {
      id: `tx-${Date.now()}`,
      reference: refCode,
      customerEmail: user.email,
      amountNgn: request.amountNgn,
      itemType: request.type,
      itemName: request.title,
      itemId: request.storyId,
      channel,
      status: 'success',
      date: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    setTransactions(prev => [newTx, ...prev]);

    // Update user subscription or unlocked stories
    if (request.type === 'subscription') {
      const now = new Date();
      const validUntil = new Date(now);
      if (request.planId === 'annual') {
        validUntil.setFullYear(validUntil.getFullYear() + 1);
      } else {
        validUntil.setMonth(validUntil.getMonth() + 1);
      }

      setUser(prev => ({
        ...prev,
        subscription: {
          plan: request.planId || 'monthly',
          status: 'active',
          amountNgn: request.amountNgn,
          validUntil: validUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          renewsAt: validUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }
      }));
    } else if (request.type === 'book_purchase' && request.storyId) {
      setUser(prev => ({
        ...prev,
        unlockedStoryIds: prev.unlockedStoryIds.includes(request.storyId!)
          ? prev.unlockedStoryIds
          : [...prev.unlockedStoryIds, request.storyId!]
      }));
    }

    closePaystackCheckout();
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
  };

  const recordReadingProgress = (storyId: string, chapterId: string, chapterNumber: number, progressPercent: number) => {
    setUser(prev => ({
      ...prev,
      readingProgress: {
        ...prev.readingProgress,
        [storyId]: {
          chapterId,
          chapterNumber,
          progressPercent,
          lastReadAt: 'Just now'
        }
      }
    }));
  };

  const updateReadingGoal = (partial: Partial<ReadingGoal>) => {
    setUser(prev => {
      const currentGoal = prev.readingGoal || DEFAULT_USER.readingGoal;
      return {
        ...prev,
        readingGoal: {
          ...currentGoal,
          ...partial
        }
      };
    });
  };

  const logChapterCompleted = () => {
    setUser(prev => {
      const currentGoal = prev.readingGoal || DEFAULT_USER.readingGoal;
      const nextProgress = currentGoal.currentProgress + 1;
      const targetMet = nextProgress >= currentGoal.targetChapters;
      const newStreak = (targetMet && currentGoal.currentProgress < currentGoal.targetChapters)
        ? currentGoal.streakDays + 1
        : currentGoal.streakDays;
      const newBest = Math.max(currentGoal.bestStreakDays, newStreak);

      const updatedHistory = [...currentGoal.history];
      if (updatedHistory.length > 0) {
        const lastIdx = updatedHistory.length - 1;
        updatedHistory[lastIdx] = {
          ...updatedHistory[lastIdx],
          chaptersRead: updatedHistory[lastIdx].chaptersRead + 1,
          metTarget: (updatedHistory[lastIdx].chaptersRead + 1) >= currentGoal.targetChapters
        };
      }

      return {
        ...prev,
        readingGoal: {
          ...currentGoal,
          currentProgress: nextProgress,
          streakDays: newStreak,
          bestStreakDays: newBest,
          history: updatedHistory
        }
      };
    });
  };

  const toggleRole = () => {
    setUser(prev => ({
      ...prev,
      role: prev.role === 'reader' ? 'owner' : 'reader'
    }));
  };

  const updateStory = (updatedStory: Story) => {
    setStories(prev => prev.map(s => (s.id === updatedStory.id ? updatedStory : s)));
  };

  const addStory = (newStoryData: Omit<Story, 'id' | 'chapters'>) => {
    const id = `story-${Date.now()}`;
    const newStory: Story = {
      ...newStoryData,
      id,
      chapters: [
        {
          id: `ch-${Date.now()}-1`,
          storyId: id,
          chapterNumber: 1,
          title: 'Prologue: The First Awakening',
          slug: 'prologue-the-first-awakening',
          releaseDate: 'Today',
          wordCount: 1850,
          readTimeMinutes: 7,
          isFree: true,
          excerpt: 'Before words were committed to ink, they lived as whispers in the evening hearth.',
          content: [
            'Before words were committed to ink, they lived as whispers in the evening hearth.',
            'The wind swept through the ancient stone porticos, carrying with it the scents of scorched incense and fresh papyrus.',
            'Thus begins the record of what was forgotten, set down for those who seek beyond worlds.'
          ]
        }
      ]
    };
    setStories(prev => [newStory, ...prev]);
  };

  const addChapterToStory = (storyId: string, chapterData: Omit<Chapter, 'id' | 'storyId'>) => {
    setStories(prev => prev.map(story => {
      if (story.id !== storyId) return story;
      const newChapter: Chapter = {
        ...chapterData,
        id: `ch-${Date.now()}`,
        storyId
      };
      return {
        ...story,
        totalChapters: story.chapters.length + 1,
        chapters: [...story.chapters, newChapter]
      };
    }));
  };

  const updateStoryPricing = (storyId: string, tier: AccessTier, priceNgn: number, freeChaptersCount: number) => {
    setStories(prev => prev.map(story => {
      if (story.id !== storyId) return story;
      const updatedChapters = story.chapters.map((ch, idx) => ({
        ...ch,
        isFree: idx < freeChaptersCount
      }));
      return {
        ...story,
        accessTier: tier,
        priceNgn,
        freeChaptersCount,
        chapters: updatedChapters
      };
    }));
  };

  const getStoryBySlug = (slug: string) => {
    return stories.find(s => s.slug === slug);
  };

  const getChapter = (storySlug: string, chapterNumber: number) => {
    const story = getStoryBySlug(storySlug);
    if (!story) return null;
    const chapter = story.chapters.find(c => c.chapterNumber === chapterNumber);
    if (!chapter) return null;
    return { story, chapter };
  };

  const hasAccessToChapter = (story: Story, chapter: Chapter): boolean => {
    // Free chapters are always unlocked (e.g. chapters 1-3)
    if (chapter.isFree) return true;
    
    // Admin owner has full master access
    if (user.role === 'owner') return true;

    // Active patron subscribers have access to all subscription stories
    if (user.subscription.status === 'active' && story.accessTier === 'subscription') {
      return true;
    }

    // Individual purchased book unlock
    if (user.unlockedStoryIds.includes(story.id)) {
      return true;
    }

    return false;
  };

  return (
    <AppContext.Provider
      value={{
        stories,
        user,
        transactions,
        readerSettings,
        currentRoute,
        routeParams,
        navigate,
        updateReaderSettings,
        paystackModal,
        openPaystackCheckout,
        closePaystackCheckout,
        completePaystackPayment,
        toggleBookmark,
        recordReadingProgress,
        toggleRole,
        updateStory,
        addStory,
        addChapterToStory,
        updateStoryPricing,
        getStoryBySlug,
        getChapter,
        hasAccessToChapter,
        setTheme,
        activeProgress,
        updateReadingGoal,
        logChapterCompleted
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
