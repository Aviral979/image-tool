// Shared image-processing helpers. Everything here runs client-side only.

export const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/x-png',
  'image/pjpeg',
];
export const ACCEPT_STRING = ACCEPTED_TYPES.join(',');
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type OutFormat = 'original' | 'png' | 'jpeg' | 'webp';

export const FORMAT_OPTIONS: { value: OutFormat; label: string }[] = [
  { value: 'original', label: 'Keep original format' },
  { value: 'png', label: 'PNG (lossless)' },
  { value: 'jpeg', label: 'JPG (smaller file)' },
  { value: 'webp', label: 'WebP (smallest)' },
];

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let i = -1;
  do {
    value /= 1024;
    i++;
  } while (value >= 1024 && i < units.length - 1);
  return `${value.toFixed(decimals)} ${units[i]}`;
}

export function stripExt(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

export function extForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
    case 'image/pjpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'png';
  }
}

export function resolveMime(format: OutFormat, originalType: string): string {
  if (format === 'original') {
    if (originalType === 'image/jpg' || originalType === 'image/pjpeg') return 'image/jpeg';
    if (originalType === 'image/x-png') return 'image/png';
    return ACCEPTED_TYPES.includes(originalType) ? originalType : 'image/png';
  }
  return `image/${format}`;
}

export function isLossy(mime: string): boolean {
  return mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/webp';
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('This image could not be opened. The file may be corrupted or in an unsupported format.'));
    img.src = url;
  });
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (w > 16384 || h > 16384 || w * h > 200_000_000) {
    throw new Error(`The target dimensions (${w} × ${h}) exceed what this browser can handle. Please choose a smaller size.`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');
  return ctx;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (b) => {
          if (b) {
            resolve(b);
          } else {
            // Fallback attempt with standard image/png if lossy format failed
            if (type !== 'image/png') {
              canvas.toBlob(
                (fallbackBlob) => {
                  if (fallbackBlob) resolve(fallbackBlob);
                  else reject(new Error('The image could not be exported. Please try a different format or smaller size.'));
                },
                'image/png'
              );
            } else {
              reject(new Error('The image could not be exported. Please try a smaller size.'));
            }
          }
        },
        type,
        quality
      );
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Canvas export failed.'));
    }
  });
}

/** Draw an image so it fully covers the canvas, cropping overflow (like CSS object-fit: cover). */
export function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, cw: number, ch: number): void {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  if (!iw || !ih) {
    ctx.drawImage(image, 0, 0, cw, ch);
    return;
  }
  const scale = Math.max(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

/**
 * Sanitize a filename to prevent operating system rejection:
 * - Strips characters forbidden on Windows, macOS, Linux: / \ : * ? " < > |
 * - Strips control characters and leading/trailing dots/spaces
 * - Ensures a safe fallback
 */
export function sanitizeFilename(filename: string, fallback = 'download'): string {
  let safe = filename
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/[\x00-\x1f\x80-\x9f]/g, '')
    .trim();
  // Strip trailing dots/spaces which Windows forbids
  safe = safe.replace(/[. ]+$/, '');
  return safe || fallback;
}

/**
 * Reliable in-browser blob download helper:
 * - Sanitizes filename against forbidden OS characters
 * - Ensures proper file extension
 * - Keeps anchor attached to DOM during navigation initialization to avoid Chromium download cancellation
 * - Safe 2-minute object URL revocation so "Save As" prompts don't abort
 */
export function downloadBlob(blob: Blob, rawFilename: string): void {
  if (!blob || blob.size === 0) {
    console.error('Cannot download empty blob');
    return;
  }

  const mimeExt = extForMime(blob.type);
  let filename = sanitizeFilename(rawFilename, `image.${mimeExt}`);

  // Ensure file extension exists
  if (!/\.[a-zA-Z0-9]+$/.test(filename)) {
    filename = `${filename}.${mimeExt}`;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.position = 'fixed';
  a.style.top = '-9999px';
  a.style.left = '-9999px';
  a.style.opacity = '0';
  a.setAttribute('aria-hidden', 'true');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';

  document.body.appendChild(a);

  // Trigger download via click
  try {
    a.click();
  } catch {
    const clickEvt = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    a.dispatchEvent(clickEvt);
  }

  // Delay DOM removal to allow browser download manager to initiate the download stream
  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
  }, 2000);

  // Keep object URL alive for 2 minutes to prevent revocation while Windows Save As dialog is open
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 120000);
}

export function percentChange(orig: number, next: number): string {
  if (!orig) return '';
  const p = Math.round((1 - next / orig) * 100);
  return p >= 0 ? `−${p}%` : `+${Math.abs(p)}%`;
}

export function sizeInfo(orig: number, next: number): string {
  return `${formatBytes(orig)} → ${formatBytes(next)} (${percentChange(orig, next)})`;
}

export function friendlyError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'This image could not be processed. Please try another supported image file.';
}
