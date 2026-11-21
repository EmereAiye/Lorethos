export interface DailyEngagementRecord {
  streakDays: number;
  bestStreakDays: number;
  lastActiveDate: string; // YYYY-MM-DD in local time
  activeDates: string[];
}

export interface DailyStreakSummary {
  currentDays: number;
  bestDays: number;
  lastActiveDate: string;
  engagedToday: boolean;
}

const STORAGE_PREFIX = 'lorethos_daily_engagement_streak_';

export function formatLocalCalendarDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPreviousCalendarDate(todayIso: string): string {
  const [y, m, d] = todayIso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) - 1);
  return formatLocalCalendarDate(dt);
}

export function loadDailyEngagementRecord(userId: string): DailyEngagementRecord {
  const empty: DailyEngagementRecord = {
    streakDays: 0,
    bestStreakDays: 0,
    lastActiveDate: '',
    activeDates: [],
  };
  if (typeof window === 'undefined' || !userId) return empty;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<DailyEngagementRecord>;
    return {
      streakDays:
        typeof parsed.streakDays === 'number' && Number.isFinite(parsed.streakDays)
          ? Math.max(0, Math.floor(parsed.streakDays))
          : 0,
      bestStreakDays:
        typeof parsed.bestStreakDays === 'number' && Number.isFinite(parsed.bestStreakDays)
          ? Math.max(0, Math.floor(parsed.bestStreakDays))
          : 0,
      lastActiveDate: typeof parsed.lastActiveDate === 'string' ? parsed.lastActiveDate : '',
      activeDates: Array.isArray(parsed.activeDates)
        ? parsed.activeDates.filter((d): d is string => typeof d === 'string').slice(-30)
        : [],
    };
  } catch {
    return empty;
  }
}

function saveDailyEngagementRecord(userId: string, record: DailyEngagementRecord): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(record));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

/**
 * Pure transition calculator for consecutive daily engagement.
 */
export function advanceDailyEngagementRecord(
  current: DailyEngagementRecord,
  now: Date = new Date()
): DailyEngagementRecord {
  const todayIso = formatLocalCalendarDate(now);
  const yesterdayIso = getPreviousCalendarDate(todayIso);

  if (current.lastActiveDate === todayIso && current.streakDays >= 1) {
    const hasToday = current.activeDates.includes(todayIso);
    return {
      ...current,
      activeDates: hasToday ? current.activeDates : [...current.activeDates, todayIso].slice(-30),
    };
  }

  let nextStreak = 1;
  if (current.lastActiveDate === yesterdayIso) {
    nextStreak = Math.max(1, current.streakDays) + 1;
  }

  const nextBest = Math.max(current.bestStreakDays, nextStreak);
  const nextDates = current.activeDates.includes(todayIso)
    ? current.activeDates
    : [...current.activeDates, todayIso].slice(-30);

  return {
    streakDays: nextStreak,
    bestStreakDays: nextBest,
    lastActiveDate: todayIso,
    activeDates: nextDates,
  };
}

export function touchDailyEngagementStreak(
  userId: string,
  now: Date = new Date(),
  goalStreakDays = 0,
  goalBestStreakDays = 0
): DailyStreakSummary {
  const current = loadDailyEngagementRecord(userId);
  const next = advanceDailyEngagementRecord(current, now);
  if (
    next.streakDays !== current.streakDays ||
    next.lastActiveDate !== current.lastActiveDate ||
    next.activeDates.length !== current.activeDates.length
  ) {
    saveDailyEngagementRecord(userId, next);
  }

  const todayIso = formatLocalCalendarDate(now);
  return {
    currentDays: Math.max(next.streakDays, Math.max(0, Math.floor(goalStreakDays || 0))),
    bestDays: Math.max(next.bestStreakDays, Math.max(0, Math.floor(goalBestStreakDays || 0))),
    lastActiveDate: next.lastActiveDate,
    engagedToday: next.lastActiveDate === todayIso,
  };
}
