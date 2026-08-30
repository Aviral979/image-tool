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

interface BgRemovalModule {
  removeBackground: (
    source: Blob,
    config?: {
      model?: string;
      device?: 'cpu' | 'gpu';
      progress?: (key: string, current: number, total: number) => void;
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

export default function RemoveBackgroundPage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);
  const [bgMode, setBgMode] = useState<BgMode>('transparent');
  const [color, setColor] = useState('#ffffff');
  const [bgImage, setBgImage] = useState<{ url: string; name: string } | null>(null);
  const [format, setFormat] = useState<BgFormat>('png');
  const [quality, setQuality] = useState(92);

  const bgInputRef = useRef<HTMLInputElement>(null);
  // AI cutouts cached per queue item so tweaking color/format re-composites instantly.
  const cutCache = useRef(new Map<string, Blob>());

  useEffect(() => {
    if (queue.items.length === 0) cutCache.current.clear();
  }, [queue.items.length]);

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
      let cut = cutCache.current.get(item.id);
      if (!cut) {
        report(0.02);
        try {
          const mod = await loadBgRemoval();
          const run = (device: 'gpu' | 'cpu') =>
            mod.removeBackground(item.file, {
              // Quantized model: much smaller download + faster inference, near-identical quality.
              model: 'isnet_quint8',
              device,
              progress: (_key: string, current: number, total: number) => {
                if (total > 0) report(0.02 + 0.6 * Math.min(1, current / total));
              },
            });
          try {
            // WebGPU is dramatically faster when the browser supports it.
            cut = await run('gpu');
          } catch {
            cut = await run('cpu');
          }
        } catch {
          throw new Error(
            'The background remover could not be loaded or this image failed. Check your connection and try again.'
          );
        }
        cutCache.current.set(item.id, cut);
      }
      report(0.65);

      const base = stripExt(item.name);
      // Transparent PNG needs no compositing at all.
      if (bgMode === 'transparent' && format === 'png') {
        return { blob: cut, name: `${base}-transparent.png`, info: [sizeInfo(item.size, cut.size)] };
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
        report(0.9);

        const blob = await canvasToBlob(canvas, mime, isLossy(mime) ? quality / 100 : undefined);
        return {
          blob,
          name: `${base}-nobg.${extForMime(mime)}`,
          width: w,
          height: h,
          info: [sizeInfo(item.size, blob.size)],
        };
      } finally {
        URL.revokeObjectURL(cutUrl);
      }
    },
    [bgMode, color, bgImage, format, quality]
  );

  const procRef = useRef(processor);
  useEffect(() => {
    procRef.current = processor;
  });

  const runAll = useCallback(() => {
    void queue.processAll((item, report) => procRef.current(item, report));
  }, [queue.processAll]);

  useEffect(() => {
    if (queue.items.length === 0) return;
    const t = window.setTimeout(runAll, 350);
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
            First use downloads a compact quantized AI model (≈10 MB) that caches in your browser and runs offline
            afterwards — WebGPU acceleration kicks in when available. <strong>Your images never leave your device.</strong>
          </Note>
          <Note>Changing the color or format afterwards is instant: the AI cutout is reused, not recomputed.</Note>
        </>
      }
    />
  );
}
