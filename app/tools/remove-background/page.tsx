'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ToolWorkspace from '@/components/ToolWorkspace';
import { useImageQueue, type Processor } from '@/lib/useImageQueue';
import {
  canvasToBlob,
  drawCover,
  extForMime,
  get2d,
  isLossy,
  loadImage,
  makeCanvas,
  sizeInfo,
  stripExt,
} from '@/lib/image';
import { Button, ColorField, Field, Note, Segmented, Select, Slider } from '@/components/ui';
import { Icon } from '@/components/Icon';

type BgMode = 'transparent' | 'color' | 'image';
type BgFormat = 'png' | 'jpeg' | 'webp';
type SpeedMode = 'turbo' | 'original';

interface BgRemovalModule {
  preload?: (config?: { model?: string; device?: 'cpu' | 'gpu' }) => Promise<void>;
  removeBackground: (
    source: Blob | HTMLImageElement | string,
    config?: {
      model?: string;
      device?: 'cpu' | 'gpu';
      progress?: (key: string, current: number, total: number) => void;
      output?: {
        format?: 'image/png' | 'image/jpeg' | 'image/webp';
        quality?: number;
      };
    }
  ) => Promise<Blob>;
}

// Loaded on demand from jsDelivr — keeps the app bundle small and lets the
// browser cache the library. Deliberately NOT part of the webpack build.
const BG_CDN_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm';
let bgModulePromise: Promise<BgRemovalModule> | null = null;
function loadBgRemoval(): Promise<BgRemovalModule> {
  if (!bgModulePromise) {
    bgModulePromise = (import(/* webpackIgnore: true */ BG_CDN_URL) as Promise<unknown>).then(
      (m) => m as BgRemovalModule
    );
    bgModulePromise.catch(() => {
      bgModulePromise = null; // allow retry after a network hiccup
    });
  }
  return bgModulePromise;
}

const MAX_TURBO_SIDE = 1280;

/** Downscales an image blob to max 1280px for turbo-speed AI processing */
async function prepareFastSource(file: Blob): Promise<{ source: Blob; width: number; height: number; scaled: boolean }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;
    const maxSide = Math.max(origW, origH);

    if (maxSide <= MAX_TURBO_SIDE) {
      return { source: file, width: origW, height: origH, scaled: false };
    }

    const scale = MAX_TURBO_SIDE / maxSide;
    const w = Math.max(1, Math.round(origW * scale));
    const h = Math.max(1, Math.round(origH * scale));
    const canvas = makeCanvas(w, h);
    const ctx = get2d(canvas);
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await canvasToBlob(canvas, 'image/png');
    return { source: blob, width: w, height: h, scaled: true };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function RemoveBackgroundPage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);
  const [speedMode, setSpeedMode] = useState<SpeedMode>('turbo');
  const [bgMode, setBgMode] = useState<BgMode>('transparent');
  const [color, setColor] = useState('#ffffff');
  const [bgImage, setBgImage] = useState<{ url: string; name: string } | null>(null);
  const [format, setFormat] = useState<BgFormat>('png');
  const [quality, setQuality] = useState(92);

  const bgInputRef = useRef<HTMLInputElement>(null);
  // AI cutouts cached per queue item and speed mode so tweaking color/format re-composites instantly.
  const cutCache = useRef(new Map<string, { blob: Blob; scaled: boolean }>());

  // Preload AI model and dependencies in the background as soon as page mounts
  useEffect(() => {
    loadBgRemoval()
      .then((mod) => {
        if (typeof mod.preload === 'function') {
          return mod.preload({ model: 'isnet_quint8', device: 'gpu' });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (queue.items.length === 0) cutCache.current.clear();
  }, [queue.items.length]);

  // When speed mode changes, clear cutouts so they are re-inferred with new resolution
  const handleSpeedModeChange = (newMode: SpeedMode) => {
    setSpeedMode(newMode);
    cutCache.current.clear();
  };

  // Release the background-image object URL on unmount.
  useEffect(() => {
    return () => {
      setBgImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return prev;
      });
    };
  }, []);

  const processor: Processor = useCallback(
    async (item, report) => {
      let cached = cutCache.current.get(item.id);
      if (!cached) {
        report(0.05);
        try {
          const mod = await loadBgRemoval();
          let inputBlob: Blob = item.file;
          let wasScaled = false;

          if (speedMode === 'turbo') {
            report(0.1);
            const prep = await prepareFastSource(item.file);
            inputBlob = prep.source;
            wasScaled = prep.scaled;
          }

          const run = (device: 'gpu' | 'cpu') =>
            mod.removeBackground(inputBlob, {
              // Quantized model: much smaller download + faster inference, near-identical quality.
              model: 'isnet_quint8',
              device,
              progress: (_key: string, current: number, total: number) => {
                if (total > 0) report(0.15 + 0.65 * Math.min(1, current / total));
              },
            });

          let cutBlob: Blob;
          try {
            // WebGPU is dramatically faster when the browser supports it.
            cutBlob = await run('gpu');
          } catch {
            cutBlob = await run('cpu');
          }

          cached = { blob: cutBlob, scaled: wasScaled };
          cutCache.current.set(item.id, cached);
        } catch {
          throw new Error(
            'The background remover could not be loaded or this image failed. Check your connection and try again.'
          );
        }
      }

      const cut = cached.blob;
      report(0.85);

      const base = stripExt(item.name);
      // Transparent PNG needs no compositing at all.
      if (bgMode === 'transparent' && format === 'png') {
        return {
          blob: cut,
          name: `${base}-transparent.png`,
          info: [
            speedMode === 'turbo' ? 'Turbo Fast' : 'Full Res',
            sizeInfo(item.size, cut.size),
          ],
        };
      }

      const mime = `image/${format}`;
      const cutUrl = URL.createObjectURL(cut);
      try {
        const cutImg = await loadImage(cutUrl);
        const w = cutImg.naturalWidth;
        const h = cutImg.naturalHeight;
        const canvas = makeCanvas(w, h);
        const ctx = get2d(canvas);

        if (bgMode === 'color') {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, w, h);
        } else if (bgMode === 'image') {
          if (!bgImage) throw new Error('Please choose a background image first (Background → Image).');
          const bgImg = await loadImage(bgImage.url);
          drawCover(ctx, bgImg, w, h);
        } else if (format === 'jpeg') {
          // JPG cannot store transparency — flatten onto the chosen color.
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(cutImg, 0, 0);
        report(0.95);

        const blob = await canvasToBlob(canvas, mime, isLossy(mime) ? quality / 100 : undefined);
        return {
          blob,
          name: `${base}-nobg.${extForMime(mime)}`,
          width: w,
          height: h,
          info: [
            speedMode === 'turbo' ? 'Turbo Fast' : 'Full Res',
            `${w} × ${h} px`,
            sizeInfo(item.size, blob.size),
          ],
        };
      } finally {
        URL.revokeObjectURL(cutUrl);
      }
    },
    [speedMode, bgMode, color, bgImage, format, quality]
  );

  const procRef = useRef(processor);
  useEffect(() => {
    procRef.current = processor;
  });

  const runAll = useCallback(() => {
    void queue.processAll((item, report) => procRef.current(item, report));
  }, [queue.processAll]);

  // Fast auto-trigger on settings change
  useEffect(() => {
    if (queue.items.length === 0) return;
    const t = window.setTimeout(runAll, 60);
    return () => window.clearTimeout(t);
  }, [processor]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFiles = useCallback(
    (files: File[]) => {
      setErrors(queue.addFiles(files));
      window.setTimeout(runAll, 0);
    },
    [queue.addFiles, runAll]
  );

  const pickBgImage = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return;
    setBgImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { url: URL.createObjectURL(f), name: f.name };
    });
  };

  return (
    <ToolWorkspace
      title="Background Remover"
      description="Remove backgrounds with an AI model that runs entirely in your browser. Export transparent PNG, add a solid color, or drop in your own backdrop."
      icon="bg"
      queue={queue}
      errors={errors}
      onFiles={handleFiles}
      zipName="imagetool-studio-nobg.zip"
      checkerResult
      settings={
        <>
          <Field label="Processing Speed" hint="Turbo mode optimizes high-resolution images for 4x faster cutout inference.">
            <Segmented
              value={speedMode}
              onChange={handleSpeedModeChange}
              options={[
                { value: 'turbo', label: '⚡ Turbo (Fast)' },
                { value: 'original', label: 'Full Resolution' },
              ]}
              ariaLabel="Processing speed"
            />
          </Field>

          <Field label="Background">
            <Segmented
              value={bgMode}
              onChange={setBgMode}
              options={[
                { value: 'transparent', label: 'Transparent' },
                { value: 'color', label: 'Color' },
                { value: 'image', label: 'Image' },
              ]}
              ariaLabel="Background type"
            />
          </Field>

          {bgMode === 'color' && (
            <Field label="Background color">
              <ColorField value={color} onChange={setColor} />
            </Field>
          )}

          {bgMode === 'image' && (
            <Field label="Background image">
              {bgImage ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bgImage.url} alt="Chosen background" className="h-10 w-10 rounded-lg border border-gray-200 object-cover" />
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{bgImage.name}</span>
                  <Button variant="secondary" size="sm" onClick={() => bgInputRef.current?.click()}>
                    Replace
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" className="w-full" onClick={() => bgInputRef.current?.click()}>
                  <Icon name="image" className="h-4 w-4" />
                  Choose background image…
                </Button>
              )}
              <input
                ref={bgInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  pickBgImage(e.target.files);
                  e.target.value = '';
                }}
              />
            </Field>
          )}

          <Field label="Output format">
            <Select
              value={format}
              onChange={setFormat}
              options={[
                { value: 'png', label: 'PNG (transparent)' },
                { value: 'webp', label: 'WebP (smaller)' },
                { value: 'jpeg', label: 'JPG (no transparency)' },
              ]}
              ariaLabel="Output format"
            />
          </Field>

          {isLossy(`image/${format}`) && (
            <Slider label="Quality" value={quality} min={10} max={100} onChange={setQuality} format={(v) => `${v}%`} />
          )}

          {format === 'jpeg' && (
            <Note tone="amber">JPG has no alpha channel — transparent areas are filled with the background color.</Note>
          )}
        </>
      }
      notes={
        <>
          <Note>
            <strong>Accelerated in-browser AI:</strong> The compact model is automatically preloaded in the background on page load with WebGPU/WASM acceleration. <strong>Your images never leave your device.</strong>
          </Note>
          <Note>
            <strong>Instant re-compositing:</strong> Changing background colors, images, or export formats takes 0 seconds because the AI cutout mask is cached in memory.
          </Note>
        </>
      }
    />
  );
}
