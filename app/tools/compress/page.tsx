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
import { Field, Note, Select, Slider } from '@/components/ui';

type BgFormat = 'png' | 'jpeg' | 'webp';

export default function CompressPage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);
  const [format, setFormat] = useState<'original' | BgFormat>('original');
  const [quality, setQuality] = useState(80);

  const processor: Processor = useCallback(
    async (item, report) => {
      const img = await loadImage(item.originalUrl);
      report(0.3);
      const canvas = makeCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = get2d(canvas);
      const mime = format === 'original' ? (['image/jpeg', 'image/webp'].includes(item.type) ? item.type : 'image/png') : `image/${format}`;
      ctx.drawImage(img, 0, 0);
      report(0.7);
      const blob = await canvasToBlob(canvas, mime, isLossy(mime) ? quality / 100 : undefined);
      // If re-encoding didn't help (common with PNG), keep the original file untouched.
      if (format === 'original' && blob.size >= item.size * 0.98) {
        return {
          blob: item.file,
          name: item.name,
          width: img.naturalWidth,
          height: img.naturalHeight,
          info: ['Already well-compressed — original kept', sizeInfo(item.size, item.size)],
        };
      }
      return {
        blob,
        name: `${stripExt(item.name)}-compressed.${extForMime(mime)}`,
        width: img.naturalWidth,
        height: img.naturalHeight,
        info: [sizeInfo(item.size, blob.size)],
      };
    },
    [format, quality]
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

  const anyTargetLossy = format !== 'png';

  return (
    <ToolWorkspace
      title="Image Compressor"
      description="Reduce file size with an adjustable quality level and instant before/after stats — single images or batches."
      icon="compress"
      queue={queue}
      errors={errors}
      onFiles={handleFiles}
      zipName="imagetool-studio-compressed.zip"
      settings={
        <>
          <Field label="Target format" hint="WebP usually produces the smallest files.">
            <Select
              value={format}
              onChange={setFormat}
              options={[
                { value: 'original', label: 'Keep original format' },
                { value: 'jpeg', label: 'JPG' },
                { value: 'webp', label: 'WebP' },
              ]}
              ariaLabel="Target format"
            />
          </Field>
          {anyTargetLossy && (
            <Slider label="Quality" value={quality} min={10} max={100} onChange={setQuality} format={(v) => `${v}%`} />
          )}
        </>
      }
      notes={
        <>
          <Note>
            The queue shows original size, compressed size, and the percentage saved for every file.
          </Note>
          <Note tone="amber">
            PNG compression is lossless and rarely shrinks files — if your queue contains PNGs, try the WebP target for
            dramatic savings.
          </Note>
        </>
      }
    />
  );
}
