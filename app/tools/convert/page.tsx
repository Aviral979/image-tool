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
  sizeInfo,
  stripExt,
} from '@/lib/image';
import { ColorField, Field, Note, Segmented, Slider } from '@/components/ui';

type ConvertFormat = 'jpeg' | 'png' | 'webp';

export default function ConvertPage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);
  const [format, setFormat] = useState<ConvertFormat>('webp');
  const [quality, setQuality] = useState(90);
  const [bgColor, setBgColor] = useState('#ffffff');

  const processor: Processor = useCallback(
    async (item, report) => {
      const img = await loadImage(item.originalUrl);
      report(0.3);
      const canvas = makeCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = get2d(canvas);
      const mime = `image/${format}`;
      if (mime === 'image/jpeg') {
        // JPG has no alpha channel — flatten transparency onto the chosen color.
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      report(0.7);
      const blob = await canvasToBlob(canvas, mime, isLossy(mime) ? quality / 100 : undefined);
      return {
        blob,
        name: `${stripExt(item.name)}.${extForMime(mime)}`,
        width: img.naturalWidth,
        height: img.naturalHeight,
        info: [sizeInfo(item.size, blob.size)],
      };
    },
    [format, quality, bgColor]
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
      title="Image Converter"
      description="Convert between JPG, PNG, and WebP in any direction — one file or an entire batch at once."
      icon="convert"
      queue={queue}
      errors={errors}
      onFiles={handleFiles}
      zipName="imagetool-studio-converted.zip"
      settings={
        <>
          <Field label="Output format">
            <Segmented
              value={format}
              onChange={setFormat}
              options={[
                { value: 'jpeg', label: 'JPG' },
                { value: 'png', label: 'PNG' },
                { value: 'webp', label: 'WebP' },
              ]}
              ariaLabel="Output format"
            />
          </Field>
          {isLossy(`image/${format}`) && (
            <Slider label="Quality" value={quality} min={10} max={100} onChange={setQuality} format={(v) => `${v}%`} />
          )}
          {format === 'jpeg' && (
            <Field label="Background color">
              <ColorField value={bgColor} onChange={setBgColor} />
            </Field>
          )}
        </>
      }
      notes={
        <>
          {format === 'jpeg' ? (
            <Note tone="amber">
              JPG does not support transparency — transparent areas are filled with the background color above.
            </Note>
          ) : (
            <Note>PNG and WebP keep transparency intact. WebP usually gives the best quality-per-byte.</Note>
          )}
        </>
      }
    />
  );
}
