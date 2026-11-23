export type NarrationLanguageId = string;

export interface NarrationLanguageOption {
  id: string;
  label: string;
  nativeLabel: string;
  speechLangTag: string;
  regionHint?: string;
  popular?: boolean;
  geminiTtsPreferred?: boolean;
  available: boolean;
  isCustom?: boolean;
}

export const ACTIVE_NARRATION_LANGUAGE_IDS = new Set<string>([
  'en-US',
  'fr-FR',
  'yo-NG',
  'ig-NG',
  'ha-NG',
]);

export function isNarrationLanguageAvailable(
  input: string | NarrationLanguageOption | null | undefined
): boolean {
  if (!input) return false;
  const id = typeof input === 'string' ? input : input.id;
  return ACTIVE_NARRATION_LANGUAGE_IDS.has(id);
}

export const POPULAR_NARRATION_LANGUAGES: NarrationLanguageOption[] = [
  { id: 'en-US', label: 'English', nativeLabel: 'English', speechLangTag: 'en-US', popular: true, geminiTtsPreferred: true, available: true },
  { id: 'fr-FR', label: 'French', nativeLabel: 'Français', speechLangTag: 'fr-FR', popular: true, geminiTtsPreferred: true, available: true },
  { id: 'yo-NG', label: 'Yoruba', nativeLabel: 'Èdè Yorùbá', speechLangTag: 'yo-NG', regionHint: 'Nigeria', popular: true, available: true },
  { id: 'ig-NG', label: 'Igbo', nativeLabel: 'Asụsụ Igbo', speechLangTag: 'ig-NG', regionHint: 'Nigeria', popular: true, available: true },
  { id: 'ha-NG', label: 'Hausa', nativeLabel: 'Harshen Hausa', speechLangTag: 'ha-NG', regionHint: 'Nigeria', popular: true, available: true },
  { id: 'de-DE', label: 'German', nativeLabel: 'Deutsch', speechLangTag: 'de-DE', popular: true, geminiTtsPreferred: true, available: false },
  { id: 'es-ES', label: 'Spanish', nativeLabel: 'Español', speechLangTag: 'es-ES', popular: true, geminiTtsPreferred: true, available: false },
  { id: 'pt-PT', label: 'Portuguese', nativeLabel: 'Português', speechLangTag: 'pt-PT', popular: true, geminiTtsPreferred: true, available: false },
  { id: 'ar-SA', label: 'Arabic', nativeLabel: 'العربية', speechLangTag: 'ar-SA', popular: true, geminiTtsPreferred: true, available: false },
  { id: 'pcm-NG', label: 'Nigerian Pidgin', nativeLabel: 'Naijá', speechLangTag: 'pcm-NG', regionHint: 'Nigeria', popular: true, available: false },
  { id: 'sw-KE', label: 'Swahili', nativeLabel: 'Kiswahili', speechLangTag: 'sw-KE', regionHint: 'East Africa', popular: true, available: false },
  { id: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी', speechLangTag: 'hi-IN', popular: true, geminiTtsPreferred: true, available: false },
  { id: 'ja-JP', label: 'Japanese', nativeLabel: '日本語', speechLangTag: 'ja-JP', popular: true, geminiTtsPreferred: true, available: false },
  { id: 'ko-KR', label: 'Korean', nativeLabel: '한국어', speechLangTag: 'ko-KR', popular: true, geminiTtsPreferred: true, available: false },
  { id: 'zh-CN', label: 'Mandarin Chinese', nativeLabel: '中文 (普通话)', speechLangTag: 'zh-CN', popular: true, geminiTtsPreferred: true, available: false },
];

export const ADDITIONAL_WORLD_LANGUAGES: NarrationLanguageOption[] = [
  { id: 'it-IT', label: 'Italian', nativeLabel: 'Italiano', speechLangTag: 'it-IT', geminiTtsPreferred: true, available: false },
  { id: 'nl-NL', label: 'Dutch', nativeLabel: 'Nederlands', speechLangTag: 'nl-NL', geminiTtsPreferred: true, available: false },
  { id: 'ru-RU', label: 'Russian', nativeLabel: 'Русский', speechLangTag: 'ru-RU', geminiTtsPreferred: true, available: false },
  { id: 'tr-TR', label: 'Turkish', nativeLabel: 'Türkçe', speechLangTag: 'tr-TR', geminiTtsPreferred: true, available: false },
  { id: 'pl-PL', label: 'Polish', nativeLabel: 'Polski', speechLangTag: 'pl-PL', geminiTtsPreferred: true, available: false },
  { id: 'uk-UA', label: 'Ukrainian', nativeLabel: 'Українська', speechLangTag: 'uk-UA', geminiTtsPreferred: true, available: false },
  { id: 'sv-SE', label: 'Swedish', nativeLabel: 'Svenska', speechLangTag: 'sv-SE', geminiTtsPreferred: true, available: false },
  { id: 'no-NO', label: 'Norwegian', nativeLabel: 'Norsk', speechLangTag: 'no-NO', geminiTtsPreferred: true, available: false },
  { id: 'da-DK', label: 'Danish', nativeLabel: 'Dansk', speechLangTag: 'da-DK', geminiTtsPreferred: true, available: false },
  { id: 'fi-FI', label: 'Finnish', nativeLabel: 'Suomi', speechLangTag: 'fi-FI', geminiTtsPreferred: true, available: false },
  { id: 'el-GR', label: 'Greek', nativeLabel: 'Ελληνικά', speechLangTag: 'el-GR', geminiTtsPreferred: true, available: false },
  { id: 'cs-CZ', label: 'Czech', nativeLabel: 'Čeština', speechLangTag: 'cs-CZ', geminiTtsPreferred: true, available: false },
  { id: 'ro-RO', label: 'Romanian', nativeLabel: 'Română', speechLangTag: 'ro-RO', geminiTtsPreferred: true, available: false },
  { id: 'hu-HU', label: 'Hungarian', nativeLabel: 'Magyar', speechLangTag: 'hu-HU', geminiTtsPreferred: true, available: false },
  { id: 'id-ID', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', speechLangTag: 'id-ID', geminiTtsPreferred: true, available: false },
  { id: 'ms-MY', label: 'Malay', nativeLabel: 'Bahasa Melayu', speechLangTag: 'ms-MY', geminiTtsPreferred: true, available: false },
  { id: 'vi-VN', label: 'Vietnamese', nativeLabel: 'Tiếng Việt', speechLangTag: 'vi-VN', geminiTtsPreferred: true, available: false },
  { id: 'th-TH', label: 'Thai', nativeLabel: 'ไทย', speechLangTag: 'th-TH', geminiTtsPreferred: true, available: false },
  { id: 'tl-PH', label: 'Filipino / Tagalog', nativeLabel: 'Tagalog', speechLangTag: 'tl-PH', geminiTtsPreferred: true, available: false },
  { id: 'bn-BD', label: 'Bengali', nativeLabel: 'বাংলা', speechLangTag: 'bn-BD', geminiTtsPreferred: true, available: false },
  { id: 'ur-PK', label: 'Urdu', nativeLabel: 'اردو', speechLangTag: 'ur-PK', available: false },
  { id: 'pa-IN', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', speechLangTag: 'pa-IN', available: false },
  { id: 'ta-IN', label: 'Tamil', nativeLabel: 'தமிழ்', speechLangTag: 'ta-IN', geminiTtsPreferred: true, available: false },
  { id: 'te-IN', label: 'Telugu', nativeLabel: 'తెలుగు', speechLangTag: 'te-IN', geminiTtsPreferred: true, available: false },
  { id: 'mr-IN', label: 'Marathi', nativeLabel: 'मराठी', speechLangTag: 'mr-IN', geminiTtsPreferred: true, available: false },
  { id: 'fa-IR', label: 'Persian (Farsi)', nativeLabel: 'فارسی', speechLangTag: 'fa-IR', available: false },
  { id: 'he-IL', label: 'Hebrew', nativeLabel: 'עברית', speechLangTag: 'he-IL', geminiTtsPreferred: true, available: false },
  { id: 'am-ET', label: 'Amharic', nativeLabel: 'አማርኛ', speechLangTag: 'am-ET', regionHint: 'Ethiopia', available: false },
  { id: 'zu-ZA', label: 'Zulu', nativeLabel: 'isiZulu', speechLangTag: 'zu-ZA', regionHint: 'South Africa', available: false },
  { id: 'xh-ZA', label: 'Xhosa', nativeLabel: 'isiXhosa', speechLangTag: 'xh-ZA', regionHint: 'South Africa', available: false },
  { id: 'af-ZA', label: 'Afrikaans', nativeLabel: 'Afrikaans', speechLangTag: 'af-ZA', regionHint: 'South Africa', geminiTtsPreferred: true, available: false },
  { id: 'ak-GH', label: 'Twi / Akan', nativeLabel: 'Akan', speechLangTag: 'ak-GH', regionHint: 'Ghana', available: false },
  { id: 'wo-SN', label: 'Wolof', nativeLabel: 'Wolof', speechLangTag: 'wo-SN', regionHint: 'Senegal', available: false },
  { id: 'sn-ZW', label: 'Shona', nativeLabel: 'chiShona', speechLangTag: 'sn-ZW', regionHint: 'Zimbabwe', available: false },
  { id: 'so-SO', label: 'Somali', nativeLabel: 'Af-Soomaali', speechLangTag: 'so-SO', available: false },
  { id: 'rw-RW', label: 'Kinyarwanda', nativeLabel: 'Ikinyarwanda', speechLangTag: 'rw-RW', regionHint: 'Rwanda', available: false },
  { id: 'lg-UG', label: 'Luganda', nativeLabel: 'Oluganda', speechLangTag: 'lg-UG', regionHint: 'Uganda', available: false },
  { id: 'ibb-NG', label: 'Ibibio', nativeLabel: 'Ibibio', speechLangTag: 'ibb-NG', regionHint: 'Nigeria', available: false },
  { id: 'efi-NG', label: 'Efik', nativeLabel: 'Efik', speechLangTag: 'efi-NG', regionHint: 'Nigeria', available: false },
  { id: 'bin-NG', label: 'Edo / Bini', nativeLabel: 'Ẹ̀dó', speechLangTag: 'bin-NG', regionHint: 'Nigeria', available: false },
  { id: 'tiv-NG', label: 'Tiv', nativeLabel: 'Tiv', speechLangTag: 'tiv-NG', regionHint: 'Nigeria', available: false },
  { id: 'ht-HT', label: 'Haitian Creole', nativeLabel: 'Kreyòl Ayisyen', speechLangTag: 'ht-HT', available: false },
  { id: 'la-VA', label: 'Latin', nativeLabel: 'Latina', speechLangTag: 'la', available: false },
];

export const NARRATION_LANGUAGES: NarrationLanguageOption[] = [
  ...POPULAR_NARRATION_LANGUAGES,
  ...ADDITIONAL_WORLD_LANGUAGES,
];

export const ACTIVE_NARRATION_LANGUAGES: NarrationLanguageOption[] = NARRATION_LANGUAGES.filter(
  (lang) => lang.available
);

export const AVAILABLE_NARRATION_LANGUAGES = ACTIVE_NARRATION_LANGUAGES;

const LANGUAGE_PREFIX_TO_ID: Record<string, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-PT',
  ar: 'ar-SA',
  yo: 'yo-NG',
  ig: 'ig-NG',
  ha: 'ha-NG',
  pcm: 'pcm-NG',
  sw: 'sw-KE',
  hi: 'hi-IN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
  it: 'it-IT',
  nl: 'nl-NL',
  ru: 'ru-RU',
  tr: 'tr-TR',
  pl: 'pl-PL',
  uk: 'uk-UA',
  sv: 'sv-SE',
  no: 'no-NO',
  nb: 'no-NO',
  da: 'da-DK',
  fi: 'fi-FI',
  el: 'el-GR',
  cs: 'cs-CZ',
  ro: 'ro-RO',
  hu: 'hu-HU',
  id: 'id-ID',
  ms: 'ms-MY',
  vi: 'vi-VN',
  th: 'th-TH',
  tl: 'tl-PH',
  fil: 'tl-PH',
  bn: 'bn-BD',
  ur: 'ur-PK',
  pa: 'pa-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  fa: 'fa-IR',
  he: 'he-IL',
  iw: 'he-IL',
  am: 'am-ET',
  zu: 'zu-ZA',
  xh: 'xh-ZA',
  af: 'af-ZA',
  ak: 'ak-GH',
  tw: 'ak-GH',
  wo: 'wo-SN',
  sn: 'sn-ZW',
  so: 'so-SO',
  rw: 'rw-RW',
  lg: 'lg-UG',
  ibb: 'ibb-NG',
  efi: 'efi-NG',
  bin: 'bin-NG',
  tiv: 'tiv-NG',
  ht: 'ht-HT',
  la: 'la-VA',
};

const COUNTRY_TO_SUGGESTIONS: Record<string, { regionLabel: string; languageIds: string[] }> = {
  NG: { regionLabel: 'Nigeria', languageIds: ['yo-NG', 'ig-NG', 'ha-NG', 'en-US'] },
  GH: { regionLabel: 'Ghana', languageIds: ['ak-GH', 'en-US'] },
  KE: { regionLabel: 'Kenya', languageIds: ['sw-KE', 'en-US'] },
  TZ: { regionLabel: 'Tanzania', languageIds: ['sw-KE', 'en-US'] },
  UG: { regionLabel: 'Uganda', languageIds: ['lg-UG', 'sw-KE', 'en-US'] },
  ZA: { regionLabel: 'South Africa', languageIds: ['zu-ZA', 'xh-ZA', 'af-ZA', 'en-US'] },
  ET: { regionLabel: 'Ethiopia', languageIds: ['am-ET', 'en-US'] },
  SN: { regionLabel: 'Senegal', languageIds: ['wo-SN', 'fr-FR'] },
  FR: { regionLabel: 'France', languageIds: ['fr-FR'] },
  CA: { regionLabel: 'Canada', languageIds: ['en-US', 'fr-FR'] },
  DE: { regionLabel: 'Germany', languageIds: ['de-DE'] },
  AT: { regionLabel: 'Austria', languageIds: ['de-DE'] },
  CH: { regionLabel: 'Switzerland', languageIds: ['de-DE', 'fr-FR', 'it-IT'] },
  ES: { regionLabel: 'Spain', languageIds: ['es-ES'] },
  MX: { regionLabel: 'Mexico', languageIds: ['es-ES'] },
  AR: { regionLabel: 'Argentina', languageIds: ['es-ES'] },
  CO: { regionLabel: 'Colombia', languageIds: ['es-ES'] },
  PT: { regionLabel: 'Portugal', languageIds: ['pt-PT'] },
  BR: { regionLabel: 'Brazil', languageIds: ['pt-PT'] },
  SA: { regionLabel: 'Saudi Arabia', languageIds: ['ar-SA'] },
  EG: { regionLabel: 'Egypt', languageIds: ['ar-SA'] },
  AE: { regionLabel: 'UAE', languageIds: ['ar-SA'] },
  IN: { regionLabel: 'India', languageIds: ['hi-IN', 'ta-IN', 'te-IN', 'mr-IN', 'bn-BD'] },
  PK: { regionLabel: 'Pakistan', languageIds: ['ur-PK', 'pa-IN'] },
  BD: { regionLabel: 'Bangladesh', languageIds: ['bn-BD'] },
  JP: { regionLabel: 'Japan', languageIds: ['ja-JP'] },
  KR: { regionLabel: 'South Korea', languageIds: ['ko-KR'] },
  CN: { regionLabel: 'China', languageIds: ['zh-CN'] },
  TW: { regionLabel: 'Taiwan', languageIds: ['zh-CN'] },
  IT: { regionLabel: 'Italy', languageIds: ['it-IT'] },
  NL: { regionLabel: 'Netherlands', languageIds: ['nl-NL'] },
  BR_PT: { regionLabel: 'Brazil', languageIds: ['pt-PT'] },
  TR: { regionLabel: 'Turkey', languageIds: ['tr-TR'] },
  RU: { regionLabel: 'Russia', languageIds: ['ru-RU'] },
  PL: { regionLabel: 'Poland', languageIds: ['pl-PL'] },
  ID: { regionLabel: 'Indonesia', languageIds: ['id-ID'] },
  VN: { regionLabel: 'Vietnam', languageIds: ['vi-VN'] },
  TH: { regionLabel: 'Thailand', languageIds: ['th-TH'] },
  PH: { regionLabel: 'Philippines', languageIds: ['tl-PH', 'en-US'] },
  GB: { regionLabel: 'United Kingdom', languageIds: ['en-US'] },
  US: { regionLabel: 'United States', languageIds: ['en-US', 'es-ES'] },
};

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Africa/Lagos': 'NG',
  'Africa/Accra': 'GH',
  'Africa/Nairobi': 'KE',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Kampala': 'UG',
  'Africa/Johannesburg': 'ZA',
  'Africa/Addis_Ababa': 'ET',
  'Africa/Dakar': 'SN',
  'Africa/Cairo': 'EG',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Lisbon': 'PT',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'Europe/Warsaw': 'PL',
  'Europe/Istanbul': 'TR',
  'Europe/London': 'GB',
  'America/Sao_Paulo': 'BR',
  'America/Mexico_City': 'MX',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Bogota': 'CO',
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Asia/Taipei': 'TW',
  'Asia/Jakarta': 'ID',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Bangkok': 'TH',
  'Asia/Manila': 'PH',
};

export function normalizeLanguageKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

export function getNarrationLanguageMeta(rawId: unknown): NarrationLanguageOption | undefined {
  if (typeof rawId !== 'string') return undefined;
  const cleaned = rawId.trim().toLowerCase();
  if (!cleaned) return undefined;

  const exact = NARRATION_LANGUAGES.find(
    (lang) =>
      lang.id.toLowerCase() === cleaned ||
      lang.label.toLowerCase() === cleaned ||
      lang.nativeLabel.toLowerCase() === cleaned ||
      lang.speechLangTag.toLowerCase() === cleaned
  );
  if (exact) return exact;

  // Match BCP-47 prefix or alias (e.g., "fr", "pt-BR", "zh-Hant", "yoruba", "pidgin")
  const primary = cleaned.split(/[-_]/)[0];
  const mappedId = LANGUAGE_PREFIX_TO_ID[primary];
  if (mappedId) {
    return NARRATION_LANGUAGES.find((l) => l.id === mappedId);
  }
  if (cleaned === 'mandarin' || cleaned === 'chinese') {
    return NARRATION_LANGUAGES.find((l) => l.id === 'zh-CN');
  }
  if (cleaned === 'pidgin' || cleaned === 'naija') {
    return NARRATION_LANGUAGES.find((l) => l.id === 'pcm-NG');
  }
  if (cleaned === 'tagalog' || cleaned === 'filipino') {
    return NARRATION_LANGUAGES.find((l) => l.id === 'tl-PH');
  }
  if (cleaned === 'farsi' || cleaned === 'persian') {
    return NARRATION_LANGUAGES.find((l) => l.id === 'fa-IR');
  }
  if (cleaned === 'twi' || cleaned === 'akan') {
    return NARRATION_LANGUAGES.find((l) => l.id === 'ak-GH');
  }
  if (cleaned === 'edo' || cleaned === 'bini') {
    return NARRATION_LANGUAGES.find((l) => l.id === 'bin-NG');
  }

  return undefined;
}

/**
 * Resolves ANY requested language (known preset, BCP-47 code, or arbitrary custom language name
 * entered by the reader) into a clean, safe NarrationLanguageOption.
 */
export function resolveNarrationLanguage(rawInput: unknown): NarrationLanguageOption | null {
  if (typeof rawInput !== 'string') return null;
  const trimmed = rawInput.replace(/[\r\n\t]+/g, ' ').trim();
  if (!trimmed || trimmed.length > 64) return null;

  const known = getNarrationLanguageMeta(trimmed);
  if (known) return known;

  // Sanitize custom language name (letters, spaces, hyphens, parentheses, apostrophes, accents)
  const sanitizedLabel = trimmed.replace(/[^\p{L}\p{N}\s\-()'’./]/gu, '').trim();
  if (sanitizedLabel.length < 2) return null;

  const slug = sanitizedLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const id = `custom:${slug || 'language'}`;

  return {
    id,
    label: sanitizedLabel,
    nativeLabel: sanitizedLabel,
    speechLangTag: /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(sanitizedLabel) ? sanitizedLabel : 'en',
    available: false,
    isCustom: true,
  };
}

export interface DetectedReaderLocale {
  countryCode: string | null;
  regionLabel: string | null;
  primaryLanguageId: string;
  suggestedLanguageIds: string[];
  detectedFrom: 'browser-language' | 'country' | 'timezone' | 'default';
}

export function detectLanguageFromSignals(signals: {
  languages?: readonly string[];
  timeZone?: string | null;
  countryCode?: string | null;
}): DetectedReaderLocale {
  const rawCountry = signals.countryCode?.trim().toUpperCase() || '';
  const tzCountry = signals.timeZone ? TIMEZONE_TO_COUNTRY[signals.timeZone.trim()] || '' : '';
  const effectiveCountry = rawCountry || tzCountry || null;

  const suggestedSet = new Set<string>();
  let primaryLanguageId = 'en-US';
  let detectedFrom: DetectedReaderLocale['detectedFrom'] = 'default';

  if (Array.isArray(signals.languages)) {
    for (const tag of signals.languages) {
      if (typeof tag !== 'string' || !tag.trim()) continue;
      const meta = getNarrationLanguageMeta(tag);
      if (meta && meta.available) {
        suggestedSet.add(meta.id);
        if (detectedFrom === 'default' && meta.id !== 'en-US') {
          primaryLanguageId = meta.id;
          detectedFrom = 'browser-language';
        }
      }
      const parts = tag.split(/[-_]/);
      if (parts.length > 1 && !rawCountry) {
        const tagCountry = parts[1].toUpperCase();
        if (COUNTRY_TO_SUGGESTIONS[tagCountry]) {
          for (const id of COUNTRY_TO_SUGGESTIONS[tagCountry].languageIds) {
            if (isNarrationLanguageAvailable(id)) {
              suggestedSet.add(id);
            }
          }
        }
      }
    }
  }

  const countrySuggestion = effectiveCountry ? COUNTRY_TO_SUGGESTIONS[effectiveCountry] : undefined;
  if (countrySuggestion) {
    const activeCountryLangs = countrySuggestion.languageIds.filter((id) =>
      isNarrationLanguageAvailable(id)
    );
    for (const id of activeCountryLangs) {
      suggestedSet.add(id);
    }
    if (detectedFrom === 'default' && activeCountryLangs.length > 0) {
      primaryLanguageId = activeCountryLangs[0] || 'en-US';
      detectedFrom = rawCountry ? 'country' : 'timezone';
    }
  }

  if (suggestedSet.size === 0) {
    suggestedSet.add('en-US');
  }

  return {
    countryCode: effectiveCountry,
    regionLabel: countrySuggestion?.regionLabel || effectiveCountry,
    primaryLanguageId,
    suggestedLanguageIds: Array.from(suggestedSet),
    detectedFrom,
  };
}
