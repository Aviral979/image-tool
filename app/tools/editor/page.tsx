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
import { Button, Field, Note, Select, Slider } from '@/components/ui';

const DEFAULTS = { brightness: 100, contrast: 100, saturation: 100, sharpness: 0, blur: 0, grayscale: 0, sepia: 0, opacity: 100 };

/** 3×3 sharpen convolution, amount 0..1. Edge pixels copied through. */
function applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data;
  const d = out.data;
  const a = amount;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = s[i + c] * (1 + 4 * a);
        const l = s[i - 4 + c] * a;
        const r = s[i + 4 + c] * a;
        const t = s[i - w * 4 + c] * a;
        const b = s[i + w * 4 + c] * a;
        let v = center - l - r - t - b;
        d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      d[i + 3] = s[i + 3];
    }
  }
  // copy 1px border from source
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = s[i + 3];
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

export default function EditorPage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);
  const [brightness, setBrightness] = useState(DEFAULTS.brightness);
  const [contrast, setContrast] = useState(DEFAULTS.contrast);
  const [saturation, setSaturation] = useState(DEFAULTS.saturation);
  const [sharpness, setSharpness] = useState(DEFAULTS.sharpness);
  const [blur, setBlur] = useState(DEFAULTS.blur);
  const [grayscale, setGrayscale] = useState(DEFAULTS.grayscale);
  const [sepia, setSepia] = useState(DEFAULTS.sepia);
  const [opacity, setOpacity] = useState(DEFAULTS.opacity);
  const [format, setFormat] = useState<OutFormat>('original');
  const [quality, setQuality] = useState(92);

  const processor: Processor = useCallback(
    async (item, report) => {
      const img = await loadImage(item.originalUrl);
      report(0.3);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = makeCanvas(w, h);
      const ctx = get2d(canvas);

      const filters: string[] = [];
      if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
      if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
      if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
      if (blur > 0) filters.push(`blur(${blur}px)`);
      if (grayscale > 0) filters.push(`grayscale(${grayscale}%)`);
      if (sepia > 0) filters.push(`sepia(${sepia}%)`);
      if (opacity < 100) filters.push(`opacity(${opacity}%)`);
      ctx.filter = filters.length ? filters.join(' ') : 'none';
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';
      report(0.7);

      if (sharpness > 0) applySharpen(ctx, w, h, sharpness / 100);

      const mime = resolveMime(format, item.type);
      const blob = await canvasToBlob(canvas, mime, isLossy(mime) ? quality / 100 : undefined);
      return {
        blob,
        name: `${stripExt(item.name)}-edited.${extForMime(mime)}`,
        width: w,
        height: h,
        info: [sizeInfo(item.size, blob.size)],
      };
    },
    [brightness, contrast, saturation, sharpness, blur, grayscale, sepia, opacity, format, quality]
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

  const reset = () => {
    setBrightness(DEFAULTS.brightness);
    setContrast(DEFAULTS.contrast);
    setSaturation(DEFAULTS.saturation);
    setSharpness(DEFAULTS.sharpness);
    setBlur(DEFAULTS.blur);
    setGrayscale(DEFAULTS.grayscale);
    setSepia(DEFAULTS.sepia);
    setOpacity(DEFAULTS.opacity);
  };

  const mime = resolveMime(format, 'image/jpeg');
  const pct = (v: number) => `${v}%`;

  return (
    <ToolWorkspace
      title="Basic Editor"
      description="Brightness, contrast, saturation, sharpness, blur, grayscale, sepia, and opacity — real-time as you slide."
      icon="image"
      queue={queue}
      errors={errors}
      onFiles={handleFiles}
      zipName="imagetool-studio-edited.zip"
      settings={
        <>
          <Slider label="Brightness" value={brightness} min={0} max={200} onChange={setBrightness} format={pct} />
          <Slider label="Contrast" value={contrast} min={0} max={200} onChange={setContrast} format={pct} />
          <Slider label="Saturation" value={saturation} min={0} max={200} onChange={setSaturation} format={pct} />
          <Slider label="Sharpness" value={sharpness} min={0} max={100} onChange={setSharpness} format={pct} />
          <Slider label="Blur" value={blur} min={0} max={10} step={0.5} onChange={setBlur} format={(v) => `${v}px`} />
          <Slider label="Grayscale" value={grayscale} min={0} max={100} onChange={setGrayscale} format={pct} />
          <Slider label="Sepia" value={sepia} min={0} max={100} onChange={setSepia} format={pct} />
          <Slider label="Opacity" value={opacity} min={0} max={100} onChange={setOpacity} format={pct} />
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset all adjustments
          </Button>
          <Field label="Output format">
            <Select value={format} onChange={setFormat} options={FORMAT_OPTIONS} ariaLabel="Output format" />
          </Field>
          {isLossy(mime) && <Slider label="Quality" value={quality} min={10} max={100} onChange={setQuality} format={pct} />}
        </>
      }
      notes={
        <>
          <Note>Sliders re-render automatically (~350 ms debounce) — the before/after preview updates in real time.</Note>
          <Note tone="amber">Transparent areas may be needed for partial opacity: choose PNG or WebP as output to keep them.</Note>
        </>
      }
    />
  );
}
