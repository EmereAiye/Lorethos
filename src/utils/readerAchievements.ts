import type { Story, UserProfile } from '../types';
import { computeUserReadingStats } from './readingStats';
import { computeReaderRank } from './readerProfile';

export type AchievementCategory = 'Milestone' | 'Habit' | 'Mastery';

export type AchievementIconKey =
  | 'book'
  | 'layers'
  | 'moon'
  | 'zap'
  | 'trophy'
  | 'flame'
  | 'compass'
  | 'bookmark';

export interface ReaderAchievement {
  id: string;
  title: string;
  category: AchievementCategory;
  description: string;
  requirementLabel: string;
  iconKey: AchievementIconKey;
  unlocked: boolean;
  progressCurrent: number;
  progressTarget: number;
  progressPercent: number;
  progressLabel: string;
}

export interface ReaderAchievementTelemetry {
  nightReadCount: number;
  fastCompletionCount: number;
  lastNightReadAt?: string;
  lastFastCompletionAt?: string;
}

const TELEMETRY_STORAGE_PREFIX = 'lorethos_reading_telemetry_';

function isNightHour(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 21 || hour < 5;
}

export function loadReadingTelemetry(userId: string): ReaderAchievementTelemetry {
  const fallback: ReaderAchievementTelemetry = {
    nightReadCount: 0,
    fastCompletionCount: 0,
  };
  if (typeof window === 'undefined' || !userId) return fallback;
  try {
    const raw = window.localStorage.getItem(`${TELEMETRY_STORAGE_PREFIX}${userId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ReaderAchievementTelemetry>;
    return {
      nightReadCount:
        typeof parsed.nightReadCount === 'number' && Number.isFinite(parsed.nightReadCount)
          ? Math.max(0, Math.floor(parsed.nightReadCount))
          : 0,
      fastCompletionCount:
        typeof parsed.fastCompletionCount === 'number' && Number.isFinite(parsed.fastCompletionCount)
          ? Math.max(0, Math.floor(parsed.fastCompletionCount))
          : 0,
      lastNightReadAt: typeof parsed.lastNightReadAt === 'string' ? parsed.lastNightReadAt : undefined,
      lastFastCompletionAt:
        typeof parsed.lastFastCompletionAt === 'string' ? parsed.lastFastCompletionAt : undefined,
    };
  } catch {
    return fallback;
  }
}

function saveReadingTelemetry(userId: string, telemetry: ReaderAchievementTelemetry): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(`${TELEMETRY_STORAGE_PREFIX}${userId}`, JSON.stringify(telemetry));
  } catch {
    // Ignore storage quota errors
  }
}

export function recordNightReadingTelemetry(
  userId: string,
  now: Date = new Date()
): ReaderAchievementTelemetry {
  const current = loadReadingTelemetry(userId);
  if (!isNightHour(now)) return current;

  const updated: ReaderAchievementTelemetry = {
    ...current,
    nightReadCount: Math.max(1, current.nightReadCount + 1),
    lastNightReadAt: now.toISOString(),
  };
  saveReadingTelemetry(userId, updated);
  return updated;
}

export function recordChapterCompletionTelemetry(
  userId: string,
  options: {
    elapsedMs?: number;
    estimatedMinutes?: number;
    now?: Date;
  } = {}
): ReaderAchievementTelemetry {
  const now = options.now || new Date();
  let current = loadReadingTelemetry(userId);

  if (isNightHour(now)) {
    current = {
      ...current,
      nightReadCount: current.nightReadCount + 1,
      lastNightReadAt: now.toISOString(),
    };
  }

  const elapsedMs = options.elapsedMs;
  const estMinutes = Math.max(1, options.estimatedMinutes || 6);
  const targetMaxMs = Math.max(60_000, estMinutes * 60_000 * 0.75);

  if (
    typeof elapsedMs === 'number' &&
    Number.isFinite(elapsedMs) &&
    elapsedMs >= 10_000 &&
    elapsedMs <= targetMaxMs
  ) {
    current = {
      ...current,
      fastCompletionCount: current.fastCompletionCount + 1,
      lastFastCompletionAt: now.toISOString(),
    };
  }

  saveReadingTelemetry(userId, current);
  return current;
}

export interface EvaluateAchievementsOptions {
  telemetry?: ReaderAchievementTelemetry;
  highlightsCount?: number;
  paragraphBookmarksCount?: number;
}

export function evaluateReaderAchievements(
  user: UserProfile,
  stories: Story[] = [],
  options: EvaluateAchievementsOptions = {}
): ReaderAchievement[] {
  const stats = computeUserReadingStats(user, stories);
  const rank = computeReaderRank(user, stories);
  const telemetry = options.telemetry || loadReadingTelemetry(user.id);

  // Inspect persisted readingProgress timestamps for late-night sessions too
  let hasNightTimestamp = telemetry.nightReadCount > 0;
  if (!hasNightTimestamp && user.readingProgress) {
    for (const prog of Object.values(user.readingProgress)) {
      if (!prog?.lastReadAt) continue;
      const parsed = new Date(prog.lastReadAt);
      if (!Number.isNaN(parsed.getTime()) && isNightHour(parsed)) {
        hasNightTimestamp = true;
        break;
      }
    }
  }

  // Compute maximum chapters read in a single calendar day from goal history
  const dailyHistory = user.readingGoal?.history || [];
  let maxDailyChapters = user.readingGoal?.currentProgress || 0;
  for (const day of dailyHistory) {
    if (typeof day?.chaptersRead === 'number' && day.chaptersRead > maxDailyChapters) {
      maxDailyChapters = day.chaptersRead;
    }
  }

  const speedProgress = telemetry.fastCompletionCount > 0 ? 3 : Math.min(3, maxDailyChapters);
  const speedUnlocked = telemetry.fastCompletionCount > 0 || maxDailyChapters >= 3;

  const savedAnnotationsCount =
    (options.highlightsCount ?? 0) +
    (options.paragraphBookmarksCount ?? 0) +
    (user.bookmarkedChapterIds?.length ?? 0);

  const clampPct = (current: number, target: number) =>
    Math.min(100, Math.max(0, Math.round((Math.min(current, target) / Math.max(1, target)) * 100)));

  return [
    {
      id: 'first-chapter',
      title: 'First Chapter',
      category: 'Milestone',
      description: 'Finish your opening chapter on Lorethos.',
      requirementLabel: 'Complete 1 chapter',
      iconKey: 'book',
      unlocked: stats.chaptersFinished >= 1,
      progressCurrent: Math.min(1, stats.chaptersFinished),
      progressTarget: 1,
      progressPercent: clampPct(stats.chaptersFinished, 1),
      progressLabel: `${Math.min(1, stats.chaptersFinished)} / 1 ch`,
    },
    {
      id: 'chapter-collector',
      title: 'Page Turn Devotee',
      category: 'Milestone',
      description: 'Maintain momentum across five full chapters.',
      requirementLabel: 'Complete 5 chapters',
      iconKey: 'layers',
      unlocked: stats.chaptersFinished >= 5,
      progressCurrent: Math.min(5, stats.chaptersFinished),
      progressTarget: 5,
      progressPercent: clampPct(stats.chaptersFinished, 5),
      progressLabel: `${Math.min(5, stats.chaptersFinished)} / 5 ch`,
    },
    {
      id: 'night-owl',
      title: 'Night Owl',
      category: 'Habit',
      description: 'Read or finish a chapter after dusk between 9 PM and 5 AM.',
      requirementLabel: 'Read between 9 PM and 5 AM',
      iconKey: 'moon',
      unlocked: hasNightTimestamp,
      progressCurrent: hasNightTimestamp ? 1 : 0,
      progressTarget: 1,
      progressPercent: hasNightTimestamp ? 100 : 0,
      progressLabel: hasNightTimestamp ? '1 / 1 session' : '0 / 1 session',
    },
    {
      id: 'speed-reader',
      title: 'Speed Reader',
      category: 'Habit',
      description: 'Complete 3 chapters in a single day or finish a chapter ahead of pace.',
      requirementLabel: '3 chapters in 1 day or swift finish',
      iconKey: 'zap',
      unlocked: speedUnlocked,
      progressCurrent: speedUnlocked ? 3 : speedProgress,
      progressTarget: 3,
      progressPercent: speedUnlocked ? 100 : clampPct(speedProgress, 3),
      progressLabel: speedUnlocked ? 'Unlocked' : `${speedProgress} / 3 ch today`,
    },
    {
      id: 'completionist',
      title: 'Completionist',
      category: 'Mastery',
      description: 'Read every published chapter of a full story series.',
      requirementLabel: 'Finish 1 complete story',
      iconKey: 'trophy',
      unlocked: rank.completedStories >= 1,
      progressCurrent: Math.min(1, rank.completedStories),
      progressTarget: 1,
      progressPercent: clampPct(rank.completedStories, 1),
      progressLabel: `${Math.min(1, rank.completedStories)} / 1 series`,
    },
    {
      id: 'flame-keeper',
      title: 'Flame Keeper',
      category: 'Habit',
      description: 'Hit your daily reading target for three days.',
      requirementLabel: 'Reach a 3-day reading streak',
      iconKey: 'flame',
      unlocked: stats.bestStreakDays >= 3,
      progressCurrent: Math.min(3, stats.bestStreakDays),
      progressTarget: 3,
      progressPercent: clampPct(stats.bestStreakDays, 3),
      progressLabel: `${Math.min(3, stats.bestStreakDays)} / 3 days`,
    },
    {
      id: 'genre-explorer',
      title: 'Genre Explorer',
      category: 'Mastery',
      description: 'Step into chronicles across three distinct literary genres.',
      requirementLabel: 'Read across 3 genres',
      iconKey: 'compass',
      unlocked: stats.genresExploredCount >= 3,
      progressCurrent: Math.min(3, stats.genresExploredCount),
      progressTarget: 3,
      progressPercent: clampPct(stats.genresExploredCount, 3),
      progressLabel: `${Math.min(3, stats.genresExploredCount)} / 3 genres`,
    },
    {
      id: 'archivist',
      title: 'Lore Archivist',
      category: 'Mastery',
      description: 'Save highlights, margin notes, or bookmarks while reading.',
      requirementLabel: 'Save 3 highlights or bookmarks',
      iconKey: 'bookmark',
      unlocked: savedAnnotationsCount >= 3,
      progressCurrent: Math.min(3, savedAnnotationsCount),
      progressTarget: 3,
      progressPercent: clampPct(savedAnnotationsCount, 3),
      progressLabel: `${Math.min(3, savedAnnotationsCount)} / 3 saved`,
    },
  ];
}
