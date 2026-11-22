import type { Story, UserProfile } from '../types/index.js';

export interface ReaderRankTier {
  level: number;
  roman: string;
  title: string;
  minChapters: number;
}

export const READER_RANK_TIERS: ReaderRankTier[] = [
  { level: 1, roman: 'I', title: 'Novice Wanderer', minChapters: 0 },
  { level: 2, roman: 'II', title: 'Page Seeker', minChapters: 5 },
  { level: 3, roman: 'III', title: 'Ink Initiate', minChapters: 12 },
  { level: 4, roman: 'IV', title: 'Lore Chronicler', minChapters: 25 },
  { level: 5, roman: 'V', title: 'Folio Scholar', minChapters: 40 },
  { level: 6, roman: 'VI', title: 'Archive Keeper', minChapters: 60 },
  { level: 7, roman: 'VII', title: 'Vellum Warden', minChapters: 85 },
  { level: 8, roman: 'VIII', title: 'Mythic Vanguard', minChapters: 115 },
  { level: 9, roman: 'IX', title: 'Elder Scribe', minChapters: 150 },
  { level: 10, roman: 'X', title: 'Grand Lorekeeper', minChapters: 200 },
];

export const READER_TIERS = READER_RANK_TIERS;

export function getTierForCompletedChapters(completedChapters: number): {
  currentTier: ReaderRankTier;
  nextTier: ReaderRankTier | null;
} {
  const safeCount = Math.max(0, Math.floor(completedChapters || 0));
  let currentIdx = 0;
  for (let i = 0; i < READER_RANK_TIERS.length; i += 1) {
    if (safeCount >= READER_RANK_TIERS[i].minChapters) {
      currentIdx = i;
    }
  }
  return {
    currentTier: READER_RANK_TIERS[currentIdx],
    nextTier: READER_RANK_TIERS[currentIdx + 1] || null,
  };
}

export interface ReaderRankStatus {
  level: number;
  roman: string;
  title: string;
  minChapters: number;
  completedChapters: number;
  completedStories: number;
  totalCatalogChapters: number;
  completionPercent: number;
  nextTitle: string | null;
  nextThreshold: number | null;
  remainingToNext: number;
  progressToNextPercent: number;
}

export function getDisplayName(user: { nickname?: string | null; name?: string | null }): string {
  const nick = user.nickname?.trim();
  if (nick) return nick;
  const full = user.name?.trim();
  if (full) return full;
  return 'Reader';
}

export function computeReaderRank(user: UserProfile, stories: Story[] = []): ReaderRankStatus {
  const completedIds = new Set<string>(user.readingGoal?.completedChapterIds || []);

  Object.values(user.readingProgress || {}).forEach((prog) => {
    if (prog && prog.progressPercent >= 95 && prog.chapterId) {
      completedIds.add(prog.chapterId);
    }
  });

  const completedChapters = completedIds.size;

  const totalCatalogChapters = stories.reduce(
    (sum, s) => sum + Math.max(s.totalChapters || 0, s.chapters?.length || 0),
    0
  );

  let completedStories = 0;
  for (const story of stories) {
    const chs = story.chapters || [];
    if (chs.length === 0) continue;
    const allDone = chs.every((ch) => completedIds.has(ch.id));
    const lastProg = user.readingProgress?.[story.id];
    const finishedLast =
      Boolean(lastProg) && lastProg.chapterNumber >= chs.length && lastProg.progressPercent >= 95;
    if (allDone || finishedLast) {
      completedStories += 1;
    }
  }

  const completionPercent =
    totalCatalogChapters > 0
      ? Math.min(100, Math.round((completedChapters / totalCatalogChapters) * 100))
      : 0;

  const { currentTier, nextTier } = getTierForCompletedChapters(completedChapters);

  const remainingToNext = nextTier ? Math.max(0, nextTier.minChapters - completedChapters) : 0;
  const span = nextTier ? Math.max(1, nextTier.minChapters - currentTier.minChapters) : 1;
  const progressToNextPercent = nextTier
    ? Math.min(100, Math.max(0, Math.round(((completedChapters - currentTier.minChapters) / span) * 100)))
    : 100;

  return {
    level: currentTier.level,
    roman: currentTier.roman,
    title: currentTier.title,
    minChapters: currentTier.minChapters,
    completedChapters,
    completedStories,
    totalCatalogChapters,
    completionPercent,
    nextTitle: nextTier ? nextTier.title : null,
    nextThreshold: nextTier ? nextTier.minChapters : null,
    remainingToNext,
    progressToNextPercent,
  };
}
