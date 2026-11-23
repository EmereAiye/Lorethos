import { isSupabaseConfigured, supabase } from './supabase';

const STORAGE_KEY = 'lorethos_chapter_translations_v1';
const MAX_LOCAL_ENTRIES = 60;

export interface LocalTranslationCacheEntry {
  storySlug: string;
  chapterNumber: number;
  languageKey: string;
  languageLabel: string;
  translatedTitle?: string;
  translatedParagraphs?: string[];
  translatedText: string;
  updatedAt: string;
}

export function splitTranslatedTextToParagraphs(rawText: string): string[] {
  const cleaned = rawText.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];
  const blocks = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (blocks.length > 1) return blocks;
  const singleLineSplit = cleaned
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return singleLineSplit.length > 0 ? singleLineSplit : [cleaned];
}

export function resolveCachedParagraphs(
  entry: Pick<LocalTranslationCacheEntry, 'translatedParagraphs' | 'translatedText'>
): string[] {
  if (Array.isArray(entry.translatedParagraphs) && entry.translatedParagraphs.length > 0) {
    return entry.translatedParagraphs.map((p) => String(p || '').trim()).filter(Boolean);
  }
  return splitTranslatedTextToParagraphs(entry.translatedText || '');
}

export function makeChapterTranslationCacheKey(
  storySlug: string,
  chapterNumber: number,
  languageKey: string
): string {
  return `${storySlug.trim().toLowerCase()}::${chapterNumber}::${languageKey.trim().toLowerCase()}`;
}

export function loadLocalChapterTranslations(): Record<string, LocalTranslationCacheEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LocalTranslationCacheEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLocalChapterTranslation(entry: LocalTranslationCacheEntry): void {
  if (typeof window === 'undefined' || !entry.translatedText.trim()) return;
  try {
    const current = loadLocalChapterTranslations();
    const key = makeChapterTranslationCacheKey(
      entry.storySlug,
      entry.chapterNumber,
      entry.languageKey
    );
    const normalizedParagraphs = resolveCachedParagraphs(entry);
    current[key] = {
      ...entry,
      translatedParagraphs: normalizedParagraphs,
    };

    // Trim oldest entries if over limit
    const keys = Object.keys(current);
    if (keys.length > MAX_LOCAL_ENTRIES) {
      keys.sort((a, b) =>
        String(current[b]?.updatedAt || '').localeCompare(String(current[a]?.updatedAt || ''))
      );
      const trimmed: Record<string, LocalTranslationCacheEntry> = {};
      for (const k of keys.slice(0, MAX_LOCAL_ENTRIES)) {
        trimmed[k] = current[k];
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchSupabaseCachedTranslation(
  storySlug: string,
  chapterNumber: number,
  languageKey: string
): Promise<LocalTranslationCacheEntry | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const cacheKey = makeChapterTranslationCacheKey(storySlug, chapterNumber, languageKey);
    const { data, error } = await supabase
      .from('chapter_translations')
      .select('story_slug, chapter_number, language_key, language_label, translated_text, updated_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (error || !data || typeof data.translated_text !== 'string' || !data.translated_text.trim()) {
      return null;
    }
    return {
      storySlug: String(data.story_slug || storySlug),
      chapterNumber: Number(data.chapter_number || chapterNumber),
      languageKey: String(data.language_key || languageKey),
      languageLabel: String(data.language_label || languageKey),
      translatedParagraphs: splitTranslatedTextToParagraphs(data.translated_text),
      translatedText: data.translated_text,
      updatedAt: String(data.updated_at || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export async function saveSupabaseCachedTranslation(
  entry: LocalTranslationCacheEntry
): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !entry.translatedText.trim()) return;
  try {
    const cacheKey = makeChapterTranslationCacheKey(
      entry.storySlug,
      entry.chapterNumber,
      entry.languageKey
    );
    await supabase.from('chapter_translations').upsert(
      {
        cache_key: cacheKey,
        story_slug: entry.storySlug,
        chapter_number: entry.chapterNumber,
        language_key: entry.languageKey,
        language_label: entry.languageLabel,
        translated_text: entry.translatedText,
        updated_at: entry.updatedAt,
      },
      { onConflict: 'cache_key' }
    );
  } catch {
    // Ignore if optional Supabase table has not been provisioned
  }
}
