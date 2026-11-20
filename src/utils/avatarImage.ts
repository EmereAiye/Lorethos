const MAX_RAW_IMAGE_BYTES = 15 * 1024 * 1024;
const AVATAR_SIZE_PX = 256;

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

    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    if (!dataUrl || !dataUrl.startsWith('data:image/jpeg;base64,')) {
      throw new Error('Failed to encode portrait image.');
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
