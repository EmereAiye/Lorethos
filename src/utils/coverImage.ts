export const MAX_WORDS_PER_CHAPTER = 15000;

export const LORETHOS_GENRES = [
  'Epic Fantasy',
  'Historical Mystery',
  'Afrofuturism',
  'Lost Epoch & Sci-Fi',
  'Mythological Realism',
  'Literary Fiction',
  'Poetry',
  'Short Stories',
  'Essays & Memoir',
  'Gothic & Folklore',
  'Drama & Romance',
] as const;

export const DEFAULT_WRITER_COVER_IMAGE =
  '/assets/images/book_cover_obsidian_throne_1794465561565.jpg';

export interface CuratedCoverOption {
  id: string;
  label: string;
  url: string;
}

export const CURATED_COVER_OPTIONS: CuratedCoverOption[] = [
  {
    id: 'obsidian-throne',
    label: 'Obsidian Throne',
    url: '/assets/images/book_cover_obsidian_throne_1794465561565.jpg',
  },
  {
    id: 'crimson-dynasty',
    label: 'Crimson Dynasty',
    url: '/assets/images/book_cover_crimson_dynasty_1794465562273.jpg',
  },
  {
    id: 'whispering-savanna',
    label: 'Whispering Savanna',
    url: '/assets/images/book_cover_whispering_savanna_1794465562207.jpg',
  },
  {
    id: 'sunken-epoch',
    label: 'Sunken Epoch',
    url: '/assets/images/book_cover_sunken_epoch_1794465563519.jpg',
  },
];

export const CURATED_COVER_URLS = new Set(CURATED_COVER_OPTIONS.map((c) => c.url));

const MAX_COVER_DATA_URL_LENGTH = 1_500_000;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function splitProseIntoParagraphs(rawBody: string): string[] {
  const normalized = rawBody.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const doubleBreakParagraphs = normalized
    .split(/\n{2,}/)
    .map((para) => para.replace(/\n+/g, ' ').trim())
    .filter(Boolean);

  if (doubleBreakParagraphs.length > 1) {
    return doubleBreakParagraphs;
  }

  return normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Validates and normalizes story cover URLs across browser and server.
 * Blocks unsafe schemes (`javascript:`, `vbscript:`, `data:image/svg+xml`, `blob:`)
 * while allowing local `/assets/...`, `https://...`, and raster base64 data URLs.
 */
export function normalizePortableCoverUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('data:image/svg+xml')
  ) {
    return undefined;
  }

  if (trimmed.startsWith('/assets/')) {
    if (trimmed.includes('..') || /[\s"'<>\\]/.test(trimmed)) {
      return undefined;
    }
    return trimmed;
  }

  if (trimmed.startsWith('data:image/')) {
    const validHeader = /^data:image\/(jpeg|jpg|png|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i.test(
      trimmed
    );
    if (!validHeader || trimmed.length > MAX_COVER_DATA_URL_LENGTH) {
      return undefined;
    }
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Crops an uploaded cover image file to a clean 3:4 portrait (600x800 JPEG)
 * so every story card and overview hero renders crisply across devices.
 */
export async function processCoverImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (JPEG, PNG, or WebP).');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Selected cover image must be 12 MB or smaller.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected cover image.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read the selected cover image.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const imageEl = new Image();
    imageEl.onload = () => resolve(imageEl);
    imageEl.onerror = () => reject(new Error('Unable to decode the selected cover image.'));
    imageEl.src = rawDataUrl;
  });

  const targetW = 600;
  const targetH = 800; // exact 3:4 portrait aspect ratio
  const targetAspect = targetW / targetH;

  const srcW = Math.max(1, img.naturalWidth || img.width);
  const srcH = Math.max(1, img.naturalHeight || img.height);
  const srcAspect = srcW / srcH;

  let cropX = 0;
  let cropY = 0;
  let cropW = srcW;
  let cropH = srcH;

  if (srcAspect > targetAspect) {
    cropW = Math.round(srcH * targetAspect);
    cropX = Math.max(0, Math.round((srcW - cropW) / 2));
  } else if (srcAspect < targetAspect) {
    cropH = Math.round(srcW / targetAspect);
    cropY = Math.max(0, Math.round((srcH - cropH) / 4));
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser canvas is unavailable to prepare the cover image.');
  }

  ctx.fillStyle = '#1E111E';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

  let encoded = canvas.toDataURL('image/jpeg', 0.84);
  if (encoded.length > MAX_COVER_DATA_URL_LENGTH) {
    encoded = canvas.toDataURL('image/jpeg', 0.72);
  }
  if (encoded.length > MAX_COVER_DATA_URL_LENGTH) {
    throw new Error('Cover image remained too large after compression. Please pick a smaller image.');
  }
  return encoded;
}
