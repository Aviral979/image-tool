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
import { Button, ColorField, Field, Note, Select, Slider, Toggle } from '@/components/ui';
import { Icon } from '@/components/Icon';

export default function RotateFlipPage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);
  const [angle, setAngle] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [fillCorners, setFillCorners] = useState(false);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [format, setFormat] = useState<OutFormat>('original');
  const [quality, setQuality] = useState(95);

  const processor: Processor = useCallback(
    async (item, report) => {
      const img = await loadImage(item.originalUrl);
      report(0.3);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const rad = (angle * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      // Bounding box of the rotated image (canvas grows so nothing is cut).
      const nw = Math.max(1, Math.round(w * cos + h * sin));
      const nh = Math.max(1, Math.round(w * sin + h * cos));

      const canvas = makeCanvas(nw, nh);
      const ctx = get2d(canvas);
      const mime = resolveMime(format, item.type);
      if (fillCorners || mime === 'image/jpeg') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, nw, nh);
      }
      ctx.translate(nw / 2, nh / 2);
      ctx.rotate(rad);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -w / 2, -h / 2);

      report(0.8);
      const blob = await canvasToBlob(canvas, mime, isLossy(mime) ? quality / 100 : undefined);
      const parts: string[] = [];
      if (angle) parts.push(`${angle}°`);
      if (flipH) parts.push('flipped H');
      if (flipV) parts.push('flipped V');
      return {
        blob,
        name: `${stripExt(item.name)}-rotated.${extForMime(mime)}`,
        width: nw,
        height: nh,
        info: [parts.length ? parts.join(' · ') : 'no change', sizeInfo(item.size, blob.size)],
      };
    },
    [angle, flipH, flipV, fillCorners, bgColor, format, quality]
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

  return (
    <ToolWorkspace
      title="Rotate & Flip"
      description="Rotate left/right or any custom angle, flip horizontally or vertically — with live preview and batch support."
      icon="refresh"
      queue={queue}
      errors={errors}
      onFiles={handleFiles}
      zipName="imagetool-studio-rotated.zip"
      checkerResult
      settings={
        <>
          <Field label="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => setAngle((a) => (((a - 90) % 360) + 360) % 360 - 180)}>
                <Icon name="refresh" className="h-3.5 w-3.5" /> Left 90°
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAngle((a) => (((a + 90 + 360) % 360) + 360) % 360 - 180)}>
                <Icon name="refresh" className="h-3.5 w-3.5 scale-x-[-1]" /> Right 90°
              </Button>
              <Button variant={flipH ? 'primary' : 'secondary'} size="sm" onClick={() => setFlipH((v) => !v)} aria-pressed={flipH}>
                Flip horizontal
              </Button>
              <Button variant={flipV ? 'primary' : 'secondary'} size="sm" onClick={() => setFlipV((v) => !v)} aria-pressed={flipV}>
                Flip vertical
              </Button>
            </div>
          </Field>
          <Slider label="Custom angle" value={angle} min={-180} max={180} onChange={setAngle} format={(v) => `${v}°`} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAngle(0);
              setFlipH(false);
              setFlipV(false);
              setFillCorners(false);
            }}
          >
            Reset all
          </Button>
          <Field
            label="Corner fill"
            hint="Custom angles grow the canvas; empty corners stay transparent (PNG/WebP) unless filled. JPG always fills."
          >
            <div className="flex items-center gap-3">
              <Toggle checked={fillCorners} onChange={setFillCorners} label="Fill corners" />
              <ColorField value={bgColor} onChange={setBgColor} />
            </div>
          </Field>
          <Field label="Output format">
            <Select value={format} onChange={setFormat} options={FORMAT_OPTIONS} ariaLabel="Output format" />
          </Field>
          {isLossy(mime) && <Slider label="Quality" value={quality} min={10} max={100} onChange={setQuality} format={(v) => `${v}%`} />}
        </>
      }
      notes={
        <Note>
          Custom angles enlarge the canvas so nothing gets cropped. The checkerboard in the preview marks transparent
          corners.
        </Note>
      }
    />
  );
}
