'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ImageTracer from 'imagetracerjs';
import ToolWorkspace from '@/components/ToolWorkspace';
import { useImageQueue, type Processor } from '@/lib/useImageQueue';
import { formatBytes, get2d, loadImage, makeCanvas, sizeInfo, stripExt } from '@/lib/image';
import { Field, Note, Segmented, Slider } from '@/components/ui';

type TraceMode = 'color' | 'bw';
type Detail = 'low' | 'medium' | 'high';

const MAX_TRACE_SIDE = 1200;

const DETAIL_PRESETS: Record<Detail, { ltres: number; qtres: number; pathomit: number; linefilter: boolean }> = {
  low: { ltres: 2.5, qtres: 2.5, pathomit: 24, linefilter: false },
  medium: { ltres: 1, qtres: 1, pathomit: 8, linefilter: false },
  high: { ltres: 0.3, qtres: 0.3, pathomit: 2, linefilter: true },
};

function traceToSvg(dataUrl: string, options: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Tracing took too long. Try a simpler image or lower detail.')), 90000);
    try {
      ImageTracer.imageToSVG(
        dataUrl,
        (svg: unknown) => {
          window.clearTimeout(timer);
          if (typeof svg === 'string' && svg.includes('<svg')) resolve(svg);
          else reject(new Error('Tracing failed for this image.'));
        },
        options
      );
    } catch {
      window.clearTimeout(timer);
      reject(new Error('Tracing failed for this image. Try lowering the detail level.'));
    }
  });
}

export default function VectorizePage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);
  const [mode, setMode] = useState<TraceMode>('color');
  const [colors, setColors] = useState(12);
  const [detail, setDetail] = useState<Detail>('medium');
  const [smoothing, setSmoothing] = useState(1);

  const processor: Processor = useCallback(
    async (item, report) => {
      const img = await loadImage(item.originalUrl);
      report(0.1);

      // Tracing very large rasters is slow — downscale first (vectors scale back up losslessly).
      const k = Math.min(1, MAX_TRACE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const canvas = makeCanvas(w, h);
      const ctx = get2d(canvas);
      ctx.drawImage(img, 0, 0, w, h);

      if (mode === 'bw') {
        // Threshold to pure black & white before tracing for a crisp 2-color result.
        const d = ctx.getImageData(0, 0, w, h);
        const px = d.data;
        for (let i = 0; i < px.length; i += 4) {
          const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          const v = lum >= 180 ? 255 : 0;
          px[i] = px[i + 1] = px[i + 2] = v;
        }
        ctx.putImageData(d, 0, 0);
      }
      report(0.3);

      const preset = DETAIL_PRESETS[detail];
      const options: Record<string, unknown> = {
        ...preset,
        rightangleenhance: true,
        numberofcolors: mode === 'bw' ? 2 : colors,
        colorquantcycles: 3,
        blurradius: smoothing,
        blurdelta: 64,
        roundcoords: 1,
        viewbox: true,
      };

      const svg = await traceToSvg(canvas.toDataURL('image/png'), options);
      report(0.95);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      return {
        blob,
        name: `${stripExt(item.name)}.svg`,
        width: w,
        height: h,
        info: [mode === 'bw' ? 'Black & white' : `${colors} colors`, `detail: ${detail}`, sizeInfo(item.size, blob.size)],
      };
    },
    [mode, colors, detail, smoothing]
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

  return (
    <ToolWorkspace
      title="Image to Vector"
      description="Convert JPG, PNG, or WebP rasters into clean, scalable SVG vectors — with color and black & white tracing modes."
      icon="vector"
      queue={queue}
      errors={errors}
      onFiles={handleFiles}
      zipName="imagetool-studio-vectors.zip"
      checkerResult
      settings={
        <>
          <Field label="Tracing mode">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'color', label: 'Color' },
                { value: 'bw', label: 'Black & White' },
              ]}
              ariaLabel="Tracing mode"
            />
          </Field>
          <Slider label="Color count" value={colors} min={2} max={32} onChange={setColors} disabled={mode === 'bw'} />
          <Field label="Detail level" hint="Higher detail produces more paths and larger SVG files.">
            <Segmented
              value={detail}
              onChange={setDetail}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
              ariaLabel="Detail level"
            />
          </Field>
          <Slider label="Smoothing" value={smoothing} min={0} max={5} onChange={setSmoothing} />
        </>
      }
      notes={
        <>
          <Note tone="amber">
            Vectorizing works best on <strong>logos, icons, simple illustrations, and line art</strong>. Complex photographs
            won&rsquo;t trace cleanly.
          </Note>
          <Note>
            Images larger than {MAX_TRACE_SIDE}px are scaled down before tracing to keep things fast — the SVG itself scales
            to any size without quality loss.
          </Note>
        </>
      }
    />
  );
}
