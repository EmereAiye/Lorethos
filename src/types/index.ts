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

export interface Story {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
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
  rating: number;
  ratingsCount: number;
  totalChapters: number;
  totalReads: number;
  freeChaptersCount: number;
  featured: boolean;
  spotlightOrder?: number;
  updatedAt: string;
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
  color: HighlightColor;
  note?: string;
  createdAt: string;
}

export type CommentTag = 'Reaction' | 'Lore' | 'Theory';

export interface ChapterComment {
  id: string;
  storyId: string;
  chapterId: string;
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
  email: string;
  avatar?: string;
  role: 'reader' | 'owner';
  subscription: UserSubscription;
  unlockedStoryIds: string[];
  bookmarkedChapterIds: string[];
  readingProgress: Record<string, { chapterId: string; chapterNumber: number; progressPercent: number; lastReadAt: string }>;
  readingGoal: ReadingGoal;
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

export interface ReaderSettings {
  theme: ReaderTheme;
  font: ReaderFont;
  fontSize: number; // 14 to 26
  lineHeight: 'normal' | 'relaxed' | 'loose';
  readingWidth: 'compact' | 'standard' | 'wide';
  ambientSound: boolean;
  ambientTrack: 'fireplace' | 'rain' | 'mythic_drone' | 'silence';
  ambientVolume: number;
  adaptiveAudio?: boolean;
}
