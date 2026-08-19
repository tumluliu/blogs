export function fitLongEdge(w: number, h: number, max: number): { width: number; height: number } {
  const long = Math.max(w, h);
  if (long <= max) return { width: w, height: h };
  const scale = max / long;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export async function hash8(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest).subarray(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function extFromMime(mime: string): 'webp' | 'jpg' | 'png' {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  return 'jpg';
}

const MAX_EDGE = 1600;
const QUALITY = 0.82;

// Browser-only. Uses OffscreenCanvas where available and falls back to a
// detached <canvas>. webp support is decided by the type of the blob the
// encoder actually returned, not by feature sniffing.
export async function compressImage(
  file: Blob,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<{ blob: Blob; ext: string; width: number; height: number }> {
  const maxEdge = opts.maxEdge ?? MAX_EDGE;
  const quality = opts.quality ?? QUALITY;

  // from-image applies EXIF orientation, so portrait phone photos stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitLongEdge(bitmap.width, bitmap.height, maxEdge);

  let blob: Blob;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('encode failed'))),
        'image/webp',
        quality,
      );
    });
  }
  bitmap.close();

  // Safari <16 silently hands back image/png when asked for webp.
  return { blob, ext: extFromMime(blob.type), width, height };
}
