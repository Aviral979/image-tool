'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ToolWorkspace from '@/components/ToolWorkspace';
import { useImageQueue, type Processor } from '@/lib/useImageQueue';
import {
  canvasToBlob,
  extForMime,
  get2d,
  isLossy,
  loadImage,
  makeCanvas,
  resolveMime,
  sizeInfo,
  stripExt,
  type OutFormat,
  FORMAT_OPTIONS,
} from '@/lib/image';
import { Field, Note, NumberField, Segmented, Select, Slider } from '@/components/ui';
import GeminiKeyField from '@/components/GeminiKeyField';
import { geminiEnhanceRaw, getSavedGeminiKey } from '@/lib/gemini';

type Engine = 'browser' | 'esrgan' | 'ai';

// ESRGAN upscalers are heavy (TensorFlow.js) — load once, reuse for the whole queue.
const upscalerCache: Partial<Record<2 | 4, any>> = {};
async function getUpscaler(steps: 2 | 4): Promise<any> {
  if (!upscalerCache[steps]) {
    const [{ default: Upscaler }, modelModule] = await Promise.all([
      import('upscaler'),
      steps === 2 ? import('@upscalerjs/esrgan-slim/2x') : import('@upscalerjs/esrgan-slim/4x'),
    ]);
    upscalerCache[steps] = new Upscaler({ model: modelModule.default });
  }
  return upscalerCache[steps];
}

export default function UpscalePage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);
  const [engine, setEngine] = useState<Engine>('browser');
  const [choice, setChoice] = useState<'2' | '4' | 'custom'>('2');
  const [customScale, setCustomScale] = useState(3);
  const [format, setFormat] = useState<OutFormat>('original');
  const [quality, setQuality] = useState(95);
  // Bumped whenever the BYOK key changes so the queue re-processes.
  const [keyVersion, setKeyVersion] = useState(0);

  const scale = choice === 'custom' ? customScale : Number(choice);

  const processor: Processor = useCallback(
    async (item, report) => {
      const img = await loadImage(item.originalUrl);
      const tw = Math.max(1, Math.round(img.naturalWidth * scale));
      const th = Math.max(1, Math.round(img.naturalHeight * scale));

      let source: HTMLImageElement = img;
      let tempUrl: string | null = null;

      if (engine === 'esrgan') {
        // Free on-device AI: ESRGAN model runs in the browser via TensorFlow.js.
        report(0.05);
        try {
          const upscaler = await getUpscaler(scale > 2 ? 4 : 2);
          const src: string = await upscaler.upscale(img, {
            output: 'src',
            patchSize: 128, // larger patches = noticeably faster inference on WebGL
            padding: 4,
            progress: (p: number) => report(0.05 + 0.7 * Math.min(1, p)),
          });
          source = await loadImage(src);
        } catch {
          throw new Error('Browser AI could not run on this image (not enough memory?). Try Fast mode or a smaller image.');
        }
      } else if (engine === 'ai') {
        // Cloud path: Google Gemini enhances detail; exact sizing still happens locally below.
        // BYOK first: if the visitor saved their own key, call Google directly from the browser.
        report(0.05);
        let enhanced: Blob;
        const ownKey = getSavedGeminiKey();
        if (ownKey) {
          enhanced = await geminiEnhanceRaw(item.file, ownKey, (p) => report(0.05 + 0.65 * p));
        } else {
          const fd = new FormData();
          fd.append('image', item.file);
          const res = await fetch('/api/ai-upscale', { method: 'POST', body: fd });
          report(0.7);
          if (!res.ok) {
            const j: any = await res.json().catch(() => null);
            throw new Error(j?.error || 'Gemini failed. Save your own key below (BYOK) or try again.');
          }
          enhanced = await res.blob();
        }
        tempUrl = URL.createObjectURL(enhanced);
        try {
          source = await loadImage(tempUrl);
        } catch {
          URL.revokeObjectURL(tempUrl);
          throw new Error('The AI result could not be read. Please try again.');
        }
      } else {
        report(0.25);
      }

      try {
        const canvas = makeCanvas(tw, th); // throws a friendly error if beyond browser limits
        const ctx = get2d(canvas);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, 0, 0, tw, th);
        report(engine === 'browser' ? 0.75 : 0.9);
        const mime = resolveMime(format, item.type);
        const blob = await canvasToBlob(canvas, mime, isLossy(mime) ? quality / 100 : undefined);
        const tag = engine === 'browser' ? '' : engine === 'esrgan' ? 'ai-' : 'gemini-';
        return {
          blob,
          name: `${stripExt(item.name)}-upscaled-${tag}${scale}x.${extForMime(mime)}`,
          width: tw,
          height: th,
          info: [`${img.naturalWidth} × ${img.naturalHeight} → ${tw} × ${th}`, sizeInfo(item.size, blob.size)],
        };
      } finally {
        if (tempUrl) URL.revokeObjectURL(tempUrl);
      }
    },
    [engine, scale, format, quality, keyVersion]
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

  const mime = resolveMime(format, 'image/jpeg');

  const engineHint =
    engine === 'browser'
      ? 'Instant bicubic-quality enlargement. 100% private.'
      : engine === 'esrgan'
        ? 'ESRGAN AI model runs in your browser — free & private. Model (~2 MB) downloads once and caches.'
        : 'Google Gemini cloud — needs an account with billing enabled (image generation is paid on Google’s free tier = 0).';

  return (
    <ToolWorkspace
      title="Image Upscaler"
      description="Enlarge images 2x, 4x, or a custom scale — instant browser resampling, free on-device AI (ESRGAN), or Gemini cloud enhancement."
      icon="upscale"
      queue={queue}
      errors={errors}
      onFiles={handleFiles}
      zipName="imagetool-studio-upscaled.zip"
      privacySubline={
        engine === 'ai'
          ? 'Fast and Browser AI modes are 100% local. Gemini mode sends each image to Google Gemini for processing — this site stores nothing and keeps no history.'
          : undefined
      }
      settings={
        <>
          <Field label="Engine" hint={engineHint}>
            <Segmented
              value={engine}
              onChange={setEngine}
              options={[
                { value: 'browser', label: 'Fast' },
                { value: 'esrgan', label: 'AI (free)' },
                { value: 'ai', label: 'Gemini' },
              ]}
              ariaLabel="Upscale engine"
            />
          </Field>
          {engine === 'ai' && <GeminiKeyField onChanged={() => setKeyVersion((v) => v + 1)} />}
          <Field label="Scale">
            <Segmented
              value={choice}
              onChange={setChoice}
              options={[
                { value: '2', label: '2x' },
                { value: '4', label: '4x' },
                { value: 'custom', label: 'Custom' },
              ]}
              ariaLabel="Upscale factor"
            />
          </Field>
          {choice === 'custom' && (
            <NumberField label="Custom scale" value={customScale} onChange={setCustomScale} min={1.5} max={8} step={0.5} suffix="×" />
          )}
          <Field label="Output format">
            <Select value={format} onChange={setFormat} options={FORMAT_OPTIONS} ariaLabel="Output format" />
          </Field>
          {isLossy(mime) && <Slider label="Quality" value={quality} min={10} max={100} onChange={setQuality} format={(v) => `${v}%`} />}
        </>
      }
      notes={
        engine === 'ai' ? (
          <>
            <Note tone="amber">
              <strong>Cloud processing:</strong> Gemini mode sends each image to Google, processed in memory only — this
              site stores nothing and keeps no history. Image generation needs a billing-enabled Google account (it costs
              roughly $0.04 per image).
            </Note>
            <Note>
              Gemini reconstructs creative detail; afterwards the image is resized to your exact target dimensions and
              encoded locally in your browser.
            </Note>
          </>
        ) : engine === 'esrgan' ? (
          <>
            <Note>
              ESRGAN is a real AI super-resolution model running entirely on your device with TensorFlow.js — it sharpens
              edges and textures. First image is slowest (one-time model download + GPU warmup); everything after is much
              faster.
            </Note>
            <Note tone="amber">
              AI upscaling uses more memory than Fast mode. On very large images, try Fast mode or upscale in two steps.
            </Note>
          </>
        ) : (
          <>
            <Note>
              This is traditional upscaling: it enlarges the pixel dimensions using bicubic-quality resampling. It does{' '}
              <strong>not</strong> reconstruct detail that isn&rsquo;t in the original image — try AI (free) for that.
            </Note>
            <Note tone="amber">
              Very large results may exceed browser canvas limits — if that happens the queue will tell you and you can
              pick a smaller scale.
            </Note>
          </>
        )
      }
    />
  );
}
