import type { Chapter } from '../types';

export const AVERAGE_READING_WPM = 250;

export function countTextWords(text: string): number {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function getChapterWordCount(
  chapter: Pick<Chapter, 'wordCount' | 'content' | 'excerpt'>
): number {
  if (typeof chapter.wordCount === 'number' && Number.isFinite(chapter.wordCount) && chapter.wordCount > 0) {
    return Math.round(chapter.wordCount);
  }
  if (Array.isArray(chapter.content) && chapter.content.length > 0) {
    const contentWords = countTextWords(chapter.content.join(' '));
    if (contentWords > 0) return contentWords;
  }
  return countTextWords(chapter.excerpt || '');
}

export function calculateReadingTimeMinutes(
  wordCount: number,
  fallbackAverageWordCount = 0,
  wpm = AVERAGE_READING_WPM
): number {
  const effectiveWords =
    typeof wordCount === 'number' && Number.isFinite(wordCount) && wordCount > 0
      ? wordCount
      : Math.max(0, fallbackAverageWordCount);

  if (effectiveWords <= 0) {
    return 1;
  }

  const safeWpm = wpm > 0 ? wpm : AVERAGE_READING_WPM;
  return Math.max(1, Math.round(effectiveWords / safeWpm));
}

export interface StoryReadingTimeSummary {
  chapterCount: number;
  totalWordCount: number;
  averageWordCount: number;
  averageChapterMinutes: number;
  totalStoryMinutes: number;
}

export function summarizeStoryReadingTime(
  chapters: Array<Pick<Chapter, 'wordCount' | 'content' | 'excerpt'>>,
  wpm = AVERAGE_READING_WPM
): StoryReadingTimeSummary {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return {
      chapterCount: 0,
      totalWordCount: 0,
      averageWordCount: 0,
      averageChapterMinutes: 1,
      totalStoryMinutes: 0,
    };
  }

  const wordCounts = chapters.map((ch) => getChapterWordCount(ch));
  const populatedCounts = wordCounts.filter((count) => count > 0);
  const totalWordCount = wordCounts.reduce((sum, count) => sum + count, 0);
  const averageWordCount =
    populatedCounts.length > 0
      ? Math.round(
          populatedCounts.reduce((sum, count) => sum + count, 0) / populatedCounts.length
        )
      : 0;

  const totalStoryMinutes = wordCounts.reduce(
    (sum, count) => sum + calculateReadingTimeMinutes(count, averageWordCount, wpm),
    0
  );

  const averageChapterMinutes = calculateReadingTimeMinutes(averageWordCount, 0, wpm);

  return {
    chapterCount: chapters.length,
    totalWordCount,
    averageWordCount,
    averageChapterMinutes,
    totalStoryMinutes,
  };
}

export interface ChapterReadingEstimate {
  wordCount: number;
  estimatedMinutes: number;
  usedAverageFallback: boolean;
}

export function estimateChapterReadingTime(
  chapter: Pick<Chapter, 'wordCount' | 'content' | 'excerpt'>,
  averageWordCount: number,
  wpm = AVERAGE_READING_WPM
): ChapterReadingEstimate {
  const directWordCount = getChapterWordCount(chapter);
  const usedAverageFallback = directWordCount <= 0 && averageWordCount > 0;
  return {
    wordCount: usedAverageFallback ? averageWordCount : directWordCount,
    estimatedMinutes: calculateReadingTimeMinutes(directWordCount, averageWordCount, wpm),
    usedAverageFallback,
  };
}
