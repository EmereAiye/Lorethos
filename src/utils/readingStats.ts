import type { Story, UserProfile } from '../types';
import { estimateChapterReadingTime, summarizeStoryReadingTime } from './readingTime';

export interface DailyReadingStatPoint {
  dateStr: string;
  dayName: string;
  label: string;
  chaptersFinished: number;
  minutesRead: number;
  targetChapters: number;
  isToday: boolean;
}

export interface GenreReadingStat {
  genre: string;
  minutesRead: number;
  chaptersFinished: number;
  storiesExplored: number;
  totalChapters: number;
  completionPercent: number;
}

export interface SeriesReadingStat {
  storyId: string;
  slug: string;
  title: string;
  genre: string;
  chaptersFinished: number;
  totalChapters: number;
  progressPercent: number;
  minutesRead: number;
}

export interface UserReadingStatsSummary {
  totalMinutesRead: number;
  formattedTotalTime: string;
  totalWordsRead: number;
  chaptersFinished: number;
  chaptersInProgress: number;
  totalCatalogChapters: number;
  completionPercent: number;
  genresExploredCount: number;
  totalGenresCount: number;
  topGenre: string | null;
  streakDays: number;
  bestStreakDays: number;
  dailyActivity: DailyReadingStatPoint[];
  genreBreakdown: GenreReadingStat[];
  seriesBreakdown: SeriesReadingStat[];
}

export function formatReadingDuration(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  if (safe === 0) return '0 min';
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours}h ${mins}m`;
}

export function computeUserReadingStats(
  user: UserProfile,
  stories: Story[] = []
): UserReadingStatsSummary {
  const completedIds = new Set<string>(user.readingGoal?.completedChapterIds || []);

  Object.values(user.readingProgress || {}).forEach((prog) => {
    if (prog && prog.progressPercent >= 95 && prog.chapterId) {
      completedIds.add(prog.chapterId);
    }
  });

  let totalMinutesRead = 0;
  let totalWordsRead = 0;
  let totalCatalogChapters = 0;
  let chaptersInProgress = 0;

  const catalogMinutesPool: number[] = [];
  const genreMap = new Map<
    string,
    {
      genre: string;
      minutesRead: number;
      chaptersFinished: number;
      storyIds: Set<string>;
      totalChapters: number;
    }
  >();
  const seriesBreakdown: SeriesReadingStat[] = [];

  for (const story of stories) {
    const chapters = story.chapters || [];
    const summary = summarizeStoryReadingTime(chapters);
    totalCatalogChapters += chapters.length;

    const genreKey = story.genre || 'General Fiction';
    if (!genreMap.has(genreKey)) {
      genreMap.set(genreKey, {
        genre: genreKey,
        minutesRead: 0,
        chaptersFinished: 0,
        storyIds: new Set<string>(),
        totalChapters: 0,
      });
    }
    const gEntry = genreMap.get(genreKey)!;
    gEntry.totalChapters += chapters.length;

    const storyProgress = user.readingProgress?.[story.id];
    let storyFinishedCount = 0;
    let storyMinutes = 0;
    let touchedStory = Boolean(storyProgress && storyProgress.progressPercent > 0);

    for (const ch of chapters) {
      const est = estimateChapterReadingTime(ch, summary.averageWordCount);
      catalogMinutesPool.push(est.estimatedMinutes);

      if (completedIds.has(ch.id)) {
        touchedStory = true;
        storyFinishedCount += 1;
        storyMinutes += est.estimatedMinutes;
        totalMinutesRead += est.estimatedMinutes;
        totalWordsRead += est.wordCount;
        gEntry.chaptersFinished += 1;
        gEntry.minutesRead += est.estimatedMinutes;
      } else if (
        storyProgress &&
        storyProgress.chapterId === ch.id &&
        storyProgress.progressPercent > 0 &&
        storyProgress.progressPercent < 95
      ) {
        touchedStory = true;
        chaptersInProgress += 1;
        const partialMinutes = Math.max(
          1,
          Math.round((est.estimatedMinutes * storyProgress.progressPercent) / 100)
        );
        const partialWords = Math.round((est.wordCount * storyProgress.progressPercent) / 100);
        storyMinutes += partialMinutes;
        totalMinutesRead += partialMinutes;
        totalWordsRead += partialWords;
        gEntry.minutesRead += partialMinutes;
      }
    }

    if (touchedStory) {
      gEntry.storyIds.add(story.id);
    }

    if (touchedStory || user.unlockedStoryIds.includes(story.id)) {
      const pct =
        chapters.length > 0
          ? Math.min(
              100,
              Math.max(
                storyProgress?.progressPercent || 0,
                Math.round((storyFinishedCount / chapters.length) * 100)
              )
            )
          : 0;

      seriesBreakdown.push({
        storyId: story.id,
        slug: story.slug,
        title: story.title,
        genre: genreKey,
        chaptersFinished: storyFinishedCount,
        totalChapters: chapters.length,
        progressPercent: pct,
        minutesRead: storyMinutes,
      });
    }
  }

  // Average minutes per chapter to convert daily goal history chapter counts into reading minutes
  const avgMinutesPerChapter =
    completedIds.size > 0 && totalMinutesRead > 0
      ? Math.max(1, Math.round(totalMinutesRead / completedIds.size))
      : catalogMinutesPool.length > 0
      ? Math.max(
          1,
          Math.round(
            catalogMinutesPool.reduce((sum, m) => sum + m, 0) / catalogMinutesPool.length
          )
        )
      : 10;

  const goal = user.readingGoal;
  const dailyTarget =
    goal?.frequency === 'weekly'
      ? Math.max(1, Math.ceil((goal?.targetChapters || 1) / 7))
      : Math.max(1, goal?.targetChapters || 1);

  const history = goal?.history || [];
  const dailyActivity: DailyReadingStatPoint[] = history.slice(-14).map((day, idx, arr) => {
    const isToday = idx === arr.length - 1;
    const chaptersFinished = isToday ? goal?.currentProgress ?? day.chaptersRead : day.chaptersRead;
    return {
      dateStr: day.dateStr,
      dayName: day.dayName,
      label: isToday ? 'Today' : day.dateStr,
      chaptersFinished,
      minutesRead: chaptersFinished * avgMinutesPerChapter,
      targetChapters: dailyTarget,
      isToday,
    };
  });

  const genreBreakdown: GenreReadingStat[] = Array.from(genreMap.values())
    .map((entry) => ({
      genre: entry.genre,
      minutesRead: entry.minutesRead,
      chaptersFinished: entry.chaptersFinished,
      storiesExplored: entry.storyIds.size,
      totalChapters: entry.totalChapters,
      completionPercent:
        entry.totalChapters > 0
          ? Math.min(100, Math.round((entry.chaptersFinished / entry.totalChapters) * 100))
          : 0,
    }))
    .sort((a, b) => b.minutesRead - a.minutesRead || b.chaptersFinished - a.chaptersFinished);

  const exploredGenres = genreBreakdown.filter(
    (g) => g.storiesExplored > 0 || g.chaptersFinished > 0 || g.minutesRead > 0
  );

  // Include preferred genres if reader has not finished a chapter yet, only as metadata if zero explored
  const topGenre =
    exploredGenres.length > 0 ? exploredGenres[0].genre : null;

  const chaptersFinished = completedIds.size;
  const completionPercent =
    totalCatalogChapters > 0
      ? Math.min(100, Math.round((chaptersFinished / totalCatalogChapters) * 100))
      : 0;

  seriesBreakdown.sort((a, b) => b.minutesRead - a.minutesRead || b.progressPercent - a.progressPercent);

  return {
    totalMinutesRead,
    formattedTotalTime: formatReadingDuration(totalMinutesRead),
    totalWordsRead,
    chaptersFinished,
    chaptersInProgress,
    totalCatalogChapters,
    completionPercent,
    genresExploredCount: exploredGenres.length,
    totalGenresCount: genreBreakdown.length,
    topGenre,
    streakDays: goal?.streakDays || 0,
    bestStreakDays: goal?.bestStreakDays || 0,
    dailyActivity,
    genreBreakdown,
    seriesBreakdown,
  };
}
