// High-performance client-side illustration engine.
// Uses fast Canvas ImageData manipulation (typed arrays) for sub-100ms execution.

import { get2d, makeCanvas } from './image';

export type IllustrationStyle = 'comic' | 'flat' | 'anime' | 'sketch' | 'watercolor' | 'retro';

export interface IllustrationOptions {
  style: IllustrationStyle;
  /** Outline strength: 0 to 100 */
  outlineStrength: number;
  /** Number of color quantization steps: 3 to 32, or 0 for smooth */
  colorBands: number;
  /** Edge-preserving smoothing radius / passes: 0 to 5 */
  smoothing: number;
  /** Saturation boost: -50 to 100 */
  vibrancy: number;
  /** Contrast adjustment: -50 to 50 */
  contrast: number;
}

export const STYLE_PRESETS: Record<IllustrationStyle, { label: string; description: string; options: IllustrationOptions }> = {
  flat: {
    label: 'Flat Vector Art',
    description: 'Minimalist clean color blocks with subtle outlines — perfect for modern graphic design.',
    options: {
      style: 'flat',
      outlineStrength: 25,
      colorBands: 7,
      smoothing: 3,
      vibrancy: 30,
      contrast: 15,
    },
  },
  comic: {
    label: 'Comic & Pop Art',
    description: 'Bold black ink contours with saturated cel-shaded tones, classic comic book style.',
    options: {
      style: 'comic',
      outlineStrength: 80,
      colorBands: 8,
      smoothing: 2,
      vibrancy: 45,
      contrast: 25,
    },
  },
  anime: {
    label: 'Anime / Cel-Shaded',
    description: 'Fine clean ink lines with radiant colors, reminiscent of Japanese animation.',
    options: {
      style: 'anime',
      outlineStrength: 60,
      colorBands: 14,
      smoothing: 2,
      vibrancy: 50,
      contrast: 20,
    },
  },
  sketch: {
    label: 'Pencil & Ink Sketch',
    description: 'Artistic hand-drawn graphite and ink line art on archival paper texture.',
    options: {
      style: 'sketch',
      outlineStrength: 85,
      colorBands: 6,
      smoothing: 1,
      vibrancy: -100,
      contrast: 30,
    },
  },
  watercolor: {
    label: 'Watercolor / Painterly',
    description: 'Soft painterly color blending with delicate organic contours.',
    options: {
      style: 'watercolor',
      outlineStrength: 35,
      colorBands: 18,
      smoothing: 4,
      vibrancy: 35,
      contrast: 10,
    },
  },
  retro: {
    label: 'Retro Poster',
    description: 'Limited vintage color palette with warm nostalgic print tones.',
    options: {
      style: 'retro',
      outlineStrength: 65,
      colorBands: 6,
      smoothing: 2,
      vibrancy: 20,
      contrast: 25,
    },
  },
};

/**
 * Fast separable box blur on Uint8ClampedArray RGBA data.
 * Multi-pass box blur closely approximates Gaussian blur while running in O(N).
 */
function fastBoxBlur(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, radius: number): void {
  if (radius <= 0) {
    dst.set(src);
    return;
  }

  const r = Math.min(radius, 8);
  const div = 2 * r + 1;
  const temp = new Uint8ClampedArray(src.length);

  // Horizontal pass: src -> temp
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w * 4;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;

    // Seed window with clamped left edge
    const firstIdx = rowOffset;
    const fR = src[firstIdx];
    const fG = src[firstIdx + 1];
    const fB = src[firstIdx + 2];
    rSum = fR * (r + 1);
    gSum = fG * (r + 1);
    bSum = fB * (r + 1);

    for (let i = 1; i <= r; i++) {
      const idx = rowOffset + Math.min(i, w - 1) * 4;
      rSum += src[idx];
      gSum += src[idx + 1];
      bSum += src[idx + 2];
    }

    for (let x = 0; x < w; x++) {
      const outIdx = rowOffset + x * 4;
      temp[outIdx] = (rSum / div) | 0;
      temp[outIdx + 1] = (gSum / div) | 0;
      temp[outIdx + 2] = (bSum / div) | 0;
      temp[outIdx + 3] = src[outIdx + 3];

      // Slide window
      const leftIdx = rowOffset + Math.max(0, x - r) * 4;
      const rightIdx = rowOffset + Math.min(w - 1, x + r + 1) * 4;
      rSum += src[rightIdx] - src[leftIdx];
      gSum += src[rightIdx + 1] - src[leftIdx + 1];
      bSum += src[rightIdx + 2] - src[leftIdx + 2];
    }
  }

  // Vertical pass: temp -> dst
  for (let x = 0; x < w; x++) {
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;

    const firstIdx = x * 4;
    const fR = temp[firstIdx];
    const fG = temp[firstIdx + 1];
    const fB = temp[firstIdx + 2];
    rSum = fR * (r + 1);
    gSum = fG * (r + 1);
    bSum = fB * (r + 1);

    for (let i = 1; i <= r; i++) {
      const idx = (Math.min(i, h - 1) * w + x) * 4;
      rSum += temp[idx];
      gSum += temp[idx + 1];
      bSum += temp[idx + 2];
    }

    for (let y = 0; y < h; y++) {
      const outIdx = (y * w + x) * 4;
      dst[outIdx] = (rSum / div) | 0;
      dst[outIdx + 1] = (gSum / div) | 0;
      dst[outIdx + 2] = (bSum / div) | 0;
      dst[outIdx + 3] = temp[outIdx + 3];

      const topIdx = (Math.max(0, y - r) * w + x) * 4;
      const btmIdx = (Math.min(h - 1, y + r + 1) * w + x) * 4;
      rSum += temp[btmIdx] - temp[topIdx];
      gSum += temp[btmIdx + 1] - temp[topIdx + 1];
      bSum += temp[btmIdx + 2] - temp[topIdx + 2];
    }
  }
}

/** Precomputed quantization look-up table for rapid cel-shading */
function makeQuantTable(bands: number): Uint8Array {
  const lut = new Uint8Array(256);
  if (bands <= 1 || bands >= 64) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }
  const step = 255 / (bands - 1);
  for (let i = 0; i < 256; i++) {
    const b = Math.round(i / step);
    lut[i] = Math.min(255, Math.max(0, Math.round(b * step)));
  }
  return lut;
}

/** Precomputed contrast adjustment look-up table */
function makeContrastTable(contrast: number): Uint8Array {
  const lut = new Uint8Array(256);
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < 256; i++) {
    const val = factor * (i - 128) + 128;
    lut[i] = Math.min(255, Math.max(0, Math.round(val)));
  }
  return lut;
}

/**
 * Transforms an HTMLImageElement or Canvas into an illustration.
 * Executes in ~30-100ms via optimized typed-array loops.
 */
export function renderIllustration(
  source: HTMLImageElement | HTMLCanvasElement,
  options: IllustrationOptions,
  targetWidth?: number,
  targetHeight?: number
): HTMLCanvasElement {
  const srcW = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const srcH = 'naturalHeight' in source ? source.naturalHeight : source.height;

  const w = targetWidth || srcW;
  const h = targetHeight || srcH;

  const canvas = makeCanvas(w, h);
  const ctx = get2d(canvas);
  ctx.drawImage(source, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const px = imgData.data;
  const totalPixels = w * h;

  // 1. Compute greyscale luminance map for edge & line detection
  const luma = new Uint8Array(totalPixels);
  for (let i = 0, p = 0; i < totalPixels; i++, p += 4) {
    // Standard perceptual luminance: 0.299 R + 0.587 G + 0.114 B
    luma[i] = ((px[p] * 77 + px[p + 1] * 150 + px[p + 2] * 29) >> 8) & 0xff;
  }

  // 2. Edge detection (Sobel filter for ink outline contours)
  const edges = new Uint8Array(totalPixels);
  if (options.outlineStrength > 0) {
    // Sobel operator (3x3 kernel)
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      const prevRow = (y - 1) * w;
      const nextRow = (y + 1) * w;

      for (let x = 1; x < w - 1; x++) {
        // Horizontal gradient Gx
        const gx =
          -luma[prevRow + x - 1] +
          luma[prevRow + x + 1] -
          2 * luma[row + x - 1] +
          2 * luma[row + x + 1] -
          luma[nextRow + x - 1] +
          luma[nextRow + x + 1];

        // Vertical gradient Gy
        const gy =
          -luma[prevRow + x - 1] -
          2 * luma[prevRow + x] -
          luma[prevRow + x + 1] +
          luma[nextRow + x - 1] +
          2 * luma[nextRow + x] +
          luma[nextRow + x + 1];

        // Manhattan magnitude approximation: |Gx| + |Gy|
        const mag = Math.abs(gx) + Math.abs(gy);
        edges[row + x] = mag > 255 ? 255 : mag;
      }
    }
  }

  // 3. Edge-preserving surface smoothing (simulating painted / illustrated look)
  let smoothedData = px;
  if (options.smoothing > 0) {
    const buf = new Uint8ClampedArray(px.length);
    fastBoxBlur(px, buf, w, h, options.smoothing);
    // Extra pass for watercolor or heavy flat art
    if (options.smoothing >= 3) {
      const buf2 = new Uint8ClampedArray(px.length);
      fastBoxBlur(buf, buf2, w, h, Math.max(1, (options.smoothing / 2) | 0));
      smoothedData = buf2;
    } else {
      smoothedData = buf;
    }
  }

  // 4. Precompute quantization & contrast LUTs
  const quantLut = makeQuantTable(options.colorBands);
  const contrastLut = makeContrastTable(options.contrast);

  const satMult = 1 + options.vibrancy / 100;
  const lineSens = options.outlineStrength / 100;
  // Adaptive threshold based on line strength
  const edgeThreshold = Math.max(18, 75 - lineSens * 45);

  const isSketch = options.style === 'sketch';
  const isRetro = options.style === 'retro';

  // 5. Pixel pass: color quantization, saturation, and outline inking
  for (let i = 0, p = 0; i < totalPixels; i++, p += 4) {
    let r = smoothedData[p];
    let g = smoothedData[p + 1];
    let b = smoothedData[p + 2];
    const a = px[p + 3];

    if (a === 0) continue;

    if (isSketch) {
      // Pencil / ink sketch on archival warm paper
      const edge = edges[i];
      const lum = luma[i];

      // Draw paper background with pencil shading & ink lines
      let pencil = 255;
      if (edge > edgeThreshold) {
        const inkFactor = Math.min(1, (edge - edgeThreshold) / 80) * lineSens;
        pencil = Math.round(255 * (1 - inkFactor * 0.9));
      } else {
        // Subtle graphite shading in dark regions
        const shade = lum < 120 ? (lum / 120) * 0.4 + 0.6 : 1;
        pencil = Math.round(250 * shade);
      }

      // Slightly warm paper tint (#faf7f2)
      px[p] = Math.min(255, (pencil * 250) / 255);
      px[p + 1] = Math.min(255, (pencil * 247) / 255);
      px[p + 2] = Math.min(255, (pencil * 242) / 255);
      continue;
    }

    // Apply contrast
    r = contrastLut[r];
    g = contrastLut[g];
    b = contrastLut[b];

    // Saturation / Vibrancy adjustment
    if (options.vibrancy !== 0) {
      const avg = (r + g + b) / 3;
      r = Math.min(255, Math.max(0, avg + (r - avg) * satMult));
      g = Math.min(255, Math.max(0, avg + (g - avg) * satMult));
      b = Math.min(255, Math.max(0, avg + (b - avg) * satMult));
    }

    // Retro warm tone tinting
    if (isRetro) {
      r = Math.min(255, r * 1.05);
      g = Math.min(255, g * 0.98);
      b = Math.min(255, b * 0.9);
    }

    // Cel-shading / Quantization
    if (options.colorBands > 0) {
      r = quantLut[r | 0];
      g = quantLut[g | 0];
      b = quantLut[b | 0];
    }

    // Edge inking / outline blending
    if (options.outlineStrength > 0) {
      const edge = edges[i];
      if (edge > edgeThreshold) {
        const inkAmount = Math.min(1, ((edge - edgeThreshold) / 70) * lineSens);
        const inkDarkness = 1 - inkAmount * (options.style === 'flat' ? 0.65 : 0.88);
        r = (r * inkDarkness) | 0;
        g = (g * inkDarkness) | 0;
        b = (b * inkDarkness) | 0;
      }
    }

    px[p] = r;
    px[p + 1] = g;
    px[p + 2] = b;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

