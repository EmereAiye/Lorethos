const MAX_RAW_IMAGE_BYTES = 15 * 1024 * 1024;
const AVATAR_SIZE_PX = 256;

const PRESET_AVATAR_STEMS = [
  'avatar_bronze_scribe',
  'avatar_moonlit_reader',
  'avatar_celestial_astrolabe',
  'avatar_baobab_lantern',
  'avatar_crimson_mask',
  'avatar_sunlit_chronicler',
] as const;

/**
 * Heals legacy Vite-hashed or dev-only preset URLs (e.g. `/src/assets/images/avatar_bronze_scribe_...jpg`
 * or `https://.../assets/avatar_bronze_scribe_...-Hash.jpg`) into stable, cross-deployment paths,
 * and validates safe data URLs, local `/assets/` paths, or HTTPS URLs.
 */
export function normalizePortableAvatarUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const val = raw.trim();
  if (!val) return undefined;

  const lower = val.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:image/svg+xml')
  ) {
    return undefined;
  }

  for (const stem of PRESET_AVATAR_STEMS) {
    if (lower.includes(stem)) {
      return `/assets/images/avatars/${stem}.jpg`;
    }
  }

  if (
    val.length <= 500_000 &&
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(val)
  ) {
    return val;
  }

  if (
    val.length <= 512 &&
    /^\/assets\/[A-Za-z0-9/_.-]+\.(png|jpe?g|webp|gif)(\?[A-Za-z0-9=&_-]*)?$/i.test(val)
  ) {
    return val;
  }

  if (val.length <= 1024 && /^https:\/\/[^\s<>"']+$/i.test(val)) {
    return val;
  }

  return undefined;
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/i.exec(
    dataUrl.trim()
  );
  if (!match) return null;
  try {
    const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

export async function processGalleryImageFile(file: File): Promise<string> {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (JPG, PNG, WebP, or GIF) from your gallery.');
  }

  if (file.type === 'image/svg+xml') {
    throw new Error('SVG files are not supported for profile portraits. Please pick a JPG, PNG, or WebP photo.');
  }

  if (file.size > MAX_RAW_IMAGE_BYTES) {
    throw new Error('Image file is too large (max 15 MB). Please choose a smaller photo.');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read the selected image file.'));
      el.src = objectUrl;
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
      throw new Error('Selected image has invalid dimensions.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE_PX;
    canvas.height = AVATAR_SIZE_PX;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Your browser could not process this image.');
    }

    // Warm archival backdrop for transparent PNGs
    ctx.fillStyle = '#F9F6F0';
    ctx.fillRect(0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);

    // Center square crop
    const side = Math.min(width, height);
    const sx = Math.max(0, Math.floor((width - side) / 2));
    const sy = Math.max(0, Math.floor((height - side) / 2));

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (!dataUrl || !dataUrl.startsWith('data:image/jpeg;base64,')) {
      throw new Error('Failed to encode portrait image.');
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
