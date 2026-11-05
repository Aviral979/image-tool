'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ImageTracer from 'imagetracerjs';
import ToolWorkspace from '@/components/ToolWorkspace';
import { useImageQueue, type Processor } from '@/lib/useImageQueue';
import {
  canvasToBlob,
  extForMime,
  isLossy,
  loadImage,
  sizeInfo,
  stripExt,
} from '@/lib/image';
import {
  Button,
  Field,
  Note,
  Segmented,
  Select,
  Slider,
} from '@/components/ui';
import {
  renderIllustration,
  STYLE_PRESETS,
  type IllustrationOptions,
  type IllustrationStyle,
} from '@/lib/illustration';

type ExportFormat = 'png' | 'jpeg' | 'webp' | 'svg';

const FORMAT_CHOICES: { value: ExportFormat; label: string }[] = [
  { value: 'png', label: 'PNG (Lossless Illustration)' },
  { value: 'jpeg', label: 'JPG (Smaller File)' },
  { value: 'webp', label: 'WebP (Modern Web)' },
  { value: 'svg', label: 'SVG (Scalable Vector Illustration)' },
];

function traceCanvasToSvg(canvas: HTMLCanvasElement, colors: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('Vector tracing took too long. Try lower color bands or raster export.')),
      45000
    );
    try {
      const dataUrl = canvas.toDataURL('image/png');
      ImageTracer.imageToSVG(
        dataUrl,
        (svg: unknown) => {
          window.clearTimeout(timer);
          if (typeof svg === 'string' && svg.includes('<svg')) resolve(svg);
          else reject(new Error('Vector tracing failed.'));
        },
        {
          numberofcolors: Math.min(Math.max(colors, 4), 24),
          colorquantcycles: 2,
          ltres: 1,
          qtres: 1,
          pathomit: 8,
          roundcoords: 1,
          viewbox: true,
        }
      );
    } catch {
      window.clearTimeout(timer);
      reject(new Error('Vector tracing failed for this image.'));
    }
  });
}

export default function IllustrationPage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);

  // Selected Style Preset
  const [style, setStyle] = useState<IllustrationStyle>('flat');

  // Fine-tuning adjustments initialized from preset
  const [outlineStrength, setOutlineStrength] = useState(STYLE_PRESETS.flat.options.outlineStrength);
  const [colorBands, setColorBands] = useState(STYLE_PRESETS.flat.options.colorBands);
  const [smoothing, setSmoothing] = useState(STYLE_PRESETS.flat.options.smoothing);
  const [vibrancy, setVibrancy] = useState(STYLE_PRESETS.flat.options.vibrancy);
  const [contrast, setContrast] = useState(STYLE_PRESETS.flat.options.contrast);

  // Export settings
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(92);

  // When changing style preset, update parameters to match preset defaults
  const handleStyleChange = (newStyle: IllustrationStyle) => {
    setStyle(newStyle);
    const p = STYLE_PRESETS[newStyle].options;
    setOutlineStrength(p.outlineStrength);
    setColorBands(p.colorBands);
    setSmoothing(p.smoothing);
    setVibrancy(p.vibrancy);
    setContrast(p.contrast);
  };

  const resetToPreset = () => {
    const p = STYLE_PRESETS[style].options;
    setOutlineStrength(p.outlineStrength);
    setColorBands(p.colorBands);
    setSmoothing(p.smoothing);
    setVibrancy(p.vibrancy);
    setContrast(p.contrast);
  };

  const processor: Processor = useCallback(
    async (item, report) => {
      report(0.1);
      const img = await loadImage(item.originalUrl);
      report(0.3);

      const opts: IllustrationOptions = {
        style,
        outlineStrength,
        colorBands,
        smoothing,
        vibrancy,
        contrast,
      };

      // Fast typed-array canvas illustration execution (~30-80ms)
      const canvas = renderIllustration(img, opts);
      report(0.7);

      const base = stripExt(item.name);

      // SVG Vector output
      if (format === 'svg') {
        report(0.8);
        const svg = await traceCanvasToSvg(canvas, colorBands || 12);
        report(0.95);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        return {
          blob,
          name: `${base}-illustration.svg`,
          width: canvas.width,
          height: canvas.height,
          info: [
            `${STYLE_PRESETS[style].label}`,
            'Vector SVG',
            sizeInfo(item.size, blob.size),
          ],
        };
      }

      // Raster output (PNG, JPEG, WebP)
      const mime = `image/${format}`;
      report(0.85);
      const blob = await canvasToBlob(
        canvas,
        mime,
        isLossy(mime) ? quality / 100 : undefined
      );
      report(0.98);

      return {
        blob,
        name: `${base}-illustration.${extForMime(mime)}`,
        width: canvas.width,
        height: canvas.height,
        info: [
          `${STYLE_PRESETS[style].label}`,
          `${canvas.width} × ${canvas.height} px`,
          sizeInfo(item.size, blob.size),
        ],
      };
    },
    [style, outlineStrength, colorBands, smoothing, vibrancy, contrast, format, quality]
  );

  const procRef = useRef(processor);
  useEffect(() => {
    procRef.current = processor;
  });

  const runAll = useCallback(() => {
    void queue.processAll((item, report) => procRef.current(item, report));
  }, [queue.processAll]);

  // Snappy auto-trigger on slider change
  useEffect(() => {
    if (queue.items.length === 0) return;
    const t = window.setTimeout(runAll, 80);
    return () => window.clearTimeout(t);
  }, [processor]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFiles = useCallback(
    (files: File[]) => {
      setErrors(queue.addFiles(files));
      window.setTimeout(runAll, 0);
    },
    [queue.addFiles, runAll]
  );

  const pct = (v: number) => `${v}%`;

  return (
    <ToolWorkspace
      title="Image to Illustration"
      description="Turn your photos and graphics into beautiful illustrations: flat vector art, comic books, anime cel-shading, or pencil sketches — in milliseconds, right in your browser."
      icon="illustration"
      queue={queue}
      errors={errors}
      onFiles={handleFiles}
      zipName="imagetool-studio-illustrations.zip"
      settings={
        <>
          <Field label="Illustration Style" hint={STYLE_PRESETS[style].description}>
            <Segmented
              value={style}
              onChange={handleStyleChange}
              options={[
                { value: 'flat', label: 'Flat Art' },
                { value: 'comic', label: 'Comic' },
                { value: 'anime', label: 'Anime' },
                { value: 'sketch', label: 'Sketch' },
                { value: 'watercolor', label: 'Watercolor' },
                { value: 'retro', label: 'Retro' },
              ]}
              ariaLabel="Illustration style"
            />
          </Field>

          <Slider
            label="Outline & Inking"
            value={outlineStrength}
            min={0}
            max={100}
            onChange={setOutlineStrength}
            format={pct}
          />

          <Slider
            label="Color Bands (Cel-Shading)"
            value={colorBands}
            min={3}
            max={32}
            onChange={setColorBands}
            format={(v) => `${v} levels`}
            disabled={style === 'sketch'}
          />

          <Slider
            label="Painterly Smoothing"
            value={smoothing}
            min={0}
            max={5}
            step={1}
            onChange={setSmoothing}
          />

          <Slider
            label="Color Vibrancy"
            value={vibrancy}
            min={-50}
            max={100}
            onChange={setVibrancy}
            format={pct}
            disabled={style === 'sketch'}
          />

          <Slider
            label="Contrast"
            value={contrast}
            min={-40}
            max={50}
            onChange={setContrast}
            format={pct}
          />

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetToPreset}>
              Reset to style defaults
            </Button>
          </div>

          <Field label="Output format">
            <Select
              value={format}
              onChange={setFormat}
              options={FORMAT_CHOICES}
              ariaLabel="Output format"
            />
          </Field>

          {isLossy(`image/${format}`) && (
            <Slider
              label="Quality"
              value={quality}
              min={20}
              max={100}
              onChange={setQuality}
              format={pct}
            />
          )}
        </>
      }
      notes={
        <>
          <Note>
            <strong>Ultra-fast & 100% private:</strong> illustrations are generated in-memory via high-speed Canvas algorithms in 30–80 ms. Your images never leave your browser.
          </Note>
          <Note>
            Supports both <strong>JPEG and PNG</strong> inputs (plus WebP). You can export high-res PNG, JPG, WebP, or scalable vector SVG.
          </Note>
        </>
      }
    />
  );
}

