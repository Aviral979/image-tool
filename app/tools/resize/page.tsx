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
import { Field, Note, NumberField, Segmented, Select, Slider, Toggle } from '@/components/ui';

const PRESETS = [
  { id: 'custom', label: 'Custom Size' },
  { id: 'ig-post', label: 'Instagram Post (1080 × 1080)', w: 1080, h: 1080 },
  { id: 'ig-story', label: 'Instagram Story (1080 × 1920)', w: 1080, h: 1920 },
  { id: 'yt-thumb', label: 'YouTube Thumbnail (1280 × 720)', w: 1280, h: 720 },
  { id: 'fb-post', label: 'Facebook Post (1200 × 630)', w: 1200, h: 630 },
  { id: 'pfp', label: 'Profile Picture (400 × 400)', w: 400, h: 400 },
];

function computeTarget(
  w: number,
  h: number,
  s: { mode: 'dimensions' | 'percent'; width: number; height: number; keepAspect: boolean; percent: number }
): { w: number; h: number } {
  if (s.mode === 'percent') {
    const k = Math.max(1, s.percent) / 100;
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }
  const tw = s.width || 0;
  const th = s.height || 0;
  if (!tw && !th) return { w, h };
  if (!s.keepAspect) return { w: tw || w, h: th || h };
  if (tw && !th) return { w: tw, h: Math.max(1, Math.round((h * tw) / w)) };
  if (th && !tw) return { w: Math.max(1, Math.round((w * th) / h)), h: th };
  const k = Math.min(tw / w, th / h);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export default function ResizePage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);
  const [preset, setPreset] = useState('custom');
  const [mode, setMode] = useState<'dimensions' | 'percent'>('dimensions');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [keepAspect, setKeepAspect] = useState(true);
  const [percent, setPercent] = useState(50);
  const [format, setFormat] = useState<OutFormat>('original');
  const [quality, setQuality] = useState(92);

  const processor: Processor = useCallback(
    async (item, report) => {
      const img = await loadImage(item.originalUrl);
      report(0.3);
      const { w, h } = computeTarget(img.naturalWidth, img.naturalHeight, { mode, width, height, keepAspect, percent });
      const canvas = makeCanvas(w, h);
      const ctx = get2d(canvas);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      report(0.75);
      const mime = resolveMime(format, item.type);
      const blob = await canvasToBlob(canvas, mime, isLossy(mime) ? quality / 100 : undefined);
      return {
        blob,
        name: `${stripExt(item.name)}-${w}x${h}.${extForMime(mime)}`,
        width: w,
        height: h,
        info: [`${img.naturalWidth} × ${img.naturalHeight} → ${w} × ${h}`, sizeInfo(item.size, blob.size)],
      };
    },
    [mode, width, height, keepAspect, percent, format, quality]
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

  const applyPreset = (id: string) => {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p?.w && p?.h) {
      setMode('dimensions');
      setWidth(p.w);
      setHeight(p.h);
      setKeepAspect(false);
    }
  };

  const mime = resolveMime(format, 'image/jpeg');

  return (
    <ToolWorkspace
      title="Image Resizer"
      description="Resize by exact pixels or percentage, with presets for popular platforms. Upload a single image or a whole batch."
      icon="resize"
      queue={queue}
      errors={errors}
      onFiles={handleFiles}
      zipName="imagetool-studio-resized.zip"
      settings={
        <>
          <Field label="Preset">
            <Select value={preset} onChange={applyPreset} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} ariaLabel="Size preset" />
          </Field>
          <Field label="Resize mode">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'dimensions', label: 'Dimensions' },
                { value: 'percent', label: 'Percentage' },
              ]}
              ariaLabel="Resize mode"
            />
          </Field>
          {mode === 'percent' ? (
            <Slider label="Scale" value={percent} min={1} max={400} onChange={setPercent} format={(v) => `${v}%`} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Width" value={width} onChange={setWidth} min={1} max={16384} suffix="px" />
                <NumberField label="Height" value={height} onChange={setHeight} min={1} max={16384} suffix="px" />
              </div>
              <Toggle
                checked={keepAspect}
                onChange={setKeepAspect}
                label="Lock aspect ratio"
                hint="Keeps each image's proportions. With both values set, they act as a bounding box; with one value, the other follows proportionally."
              />
            </>
          )}
          <Field label="Output format">
            <Select value={format} onChange={setFormat} options={FORMAT_OPTIONS} ariaLabel="Output format" />
          </Field>
          {isLossy(mime) && <Slider label="Quality" value={quality} min={10} max={100} onChange={setQuality} format={(v) => `${v}%`} />}
        </>
      }
      notes={<Note>Presets use exact dimensions and unlock the aspect ratio so the output matches the platform spec.</Note>}
    />
  );
}
