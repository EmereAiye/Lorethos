export type AccessTier = 'free' | 'subscription' | 'purchase';

export type StoryStatus = 'Ongoing' | 'Completed' | 'Hiatus';

export type PublicationStatus = 'draft' | 'review' | 'published';

export type ReaderTheme = 'day' | 'sepia' | 'night';

export type ReaderFont = 'literata' | 'garamond' | 'sans';

export interface Chapter {
  id: string;
  storyId: string;
  chapterNumber: number;
  title: string;
  slug: string;
  releaseDate: string;
  wordCount: number;
  readTimeMinutes: number;
  isFree: boolean;
  excerpt: string;
  content: string[]; // array of paragraphs or markdown blocks
  audioUrl?: string;
  audioDuration?: string;
  ambientSoundscape?: string;
}

export interface StoryTrailerScene {
  sceneNumber: number;
  title: string;
  mood: SceneMood;
  moodLabel: string;
  startSec: number;
  endSec: number;
  imageUrl: string;
  caption: string;
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  authorId?: string;
  author: string;
  authorBio: string;
  genre: string;
  tags: string[];
  coverImage: string;
  synopsis: string;
  prologueLore: string;
  status: StoryStatus;
  publicationStatus?: PublicationStatus;
  accessTier: AccessTier;
  priceNgn: number;
  writerRequiresPurchase?: boolean;
  rating: number;
  ratingsCount: number;
  totalChapters: number;
  totalReads: number;
  freeChaptersCount: number;
  featured: boolean;
  spotlightOrder?: number;
  updatedAt: string;
  audioUrl?: string;
  trailerVideoUrl?: string;
  trailerPosterUrl?: string;
  trailerDuration?: string;
  trailerMood?: SceneMood;
  trailerNarration?: string;
  trailerScenes?: StoryTrailerScene[];
  chapters: Chapter[];
}

export interface UserSubscription {
  plan: 'free' | 'monthly' | 'annual';
  status: 'active' | 'expired' | 'none';
  validUntil?: string;
  renewsAt?: string;
  amountNgn: number;
}

export type ReadingGoalFrequency = 'daily' | 'weekly';

export interface DayGoalHistory {
  dayName: string;
  dateStr: string;
  dateIso?: string;
  chaptersRead: number;
  metTarget: boolean;
}

export interface ReadingGoal {
  frequency: ReadingGoalFrequency;
  targetChapters: number;
  currentProgress: number;
  streakDays: number;
  bestStreakDays: number;
  lastUpdatedDate: string;
  completedChapterIds?: string[];
  completedAtByChapter?: Record<string, string>;
  history: DayGoalHistory[];
}

export type HighlightColor = 'terracotta' | 'gold' | 'sage';

export interface TextHighlight {
  id: string;
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
  createdAt: string;
  updatedAt?: string;
}

export interface ParagraphBookmark {
  id: string;
  storyId: string;
  storyTitle: string;
  storySlug: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  paragraphIndex: number;
  label?: string;
  excerpt: string;
  createdAt: string;
}

export type CommentTag = 'Reaction' | 'Lore' | 'Theory';

export interface ChapterComment {
  id: string;
  storyId: string;
  chapterId: string;
  chapterNumber?: number;
  userId?: string;
  authorName: string;
  tag: CommentTag;
  body: string;
  createdAt: string;
}

export interface CommunityInquiry {
  id: string;
  referenceId: string;
  name: string;
  email: string;
  inquiryType: string;
  subject: string;
  message: string;
  submittedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  avatar?: string;
  bio?: string;
  role: WriterRole;
  subscription: UserSubscription;
  unlockedStoryIds: string[];
  bookmarkedChapterIds: string[];
  readingProgress: Record<string, { chapterId: string; chapterNumber: number; progressPercent: number; lastReadAt: string }>;
  readingGoal: ReadingGoal;
  preferredGenres?: string[];
}

export interface PaymentTransaction {
  id: string;
  reference: string;
  customerEmail: string;
  amountNgn: number;
  itemType: 'subscription' | 'book_purchase';
  itemName: string;
  itemId?: string;
  channel: 'card' | 'bank_transfer' | 'ussd';
  status: 'success' | 'pending' | 'failed';
  date: string;
}

export type SceneMood = 'neutral' | 'suspense' | 'action' | 'storm';

export interface ReaderSettings {
  theme: ReaderTheme;
  font: ReaderFont;
  fontSize: number; // 14 to 26
  lineHeight: 'normal' | 'relaxed' | 'loose';
  readingWidth: 'compact' | 'standard' | 'wide';
  ambientSound: boolean;
  ambientTrack: 'adaptive' | 'fireplace' | 'rain' | 'mythic_drone' | 'silence';
  ambientVolume: number;
  adaptiveAudio?: boolean;
}

export type WriterRole = 'reader' | 'writer' | 'owner' | 'admin';

export interface SupabaseProfile {
  id: string;
  username: string;
  role: WriterRole;
}

export interface WriterStory {
  id: string;
  author_id: string;
  author_username: string;
  title: string;
  summary: string;
  body: string;
  audio_url: string | null;
  status: 'draft' | 'published';
  likes_count: number;
  created_at: string;
}

export type BookshelfVisibility = 'private' | 'public';

export interface StoryBookshelf {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  description?: string;
  visibility: BookshelfVisibility;
  storyIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDirectoryEntry {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  avatar?: string;
  bio?: string;
  role: WriterRole;
  subscription: UserSubscription;
  completedChaptersCount: number;
  bookshelvesCount: number;
  createdAt: string;
  source?: 'server' | 'supabase' | 'merged';
}

export type LeaderboardPeriod = 'weekly' | 'monthly';

export interface LeaderboardEntry {
  position: number;
  userId: string;
  displayName: string;
  avatar?: string;
  tierTitle: string;
  tierRoman: string;
  tierLevel: number;
  weeklyChapters: number;
  monthlyChapters: number;
  allTimeChapters: number;
  completedStoriesCount: number;
  streakDays: number;
  isCurrentUser: boolean;
}

export interface LeaderboardViewerStanding {
  weeklyPosition: number | null;
  monthlyPosition: number | null;
  weeklyChapters: number;
  monthlyChapters: number;
  allTimeChapters: number;
  completedStoriesCount: number;
  streakDays: number;
  tierTitle: string;
  tierRoman: string;
  tierLevel: number;
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  weekly: LeaderboardEntry[];
  monthly: LeaderboardEntry[];
  totalReaders: number;
  viewerStanding: LeaderboardViewerStanding | null;
  generatedAt: string;
}

export interface CachedChapterTranslation {
  key: string;
  storyId: string;
  storySlug: string;
  chapterNumber: number;
  languageKey: string;
  languageLabel: string;
  translatedTitle?: string;
  translatedParagraphs?: string[];
  translatedText: string;
  contentHash: string;
  model: string;
  createdAt: string;
}
