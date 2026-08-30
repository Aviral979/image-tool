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
import { Button, ColorField, Field, Note, Segmented, Select, Slider } from '@/components/ui';
import { Icon } from '@/components/Icon';

type WmType = 'text' | 'logo';
type Pos = 'tl' | 'tc' | 'tr' | 'cl' | 'cc' | 'cr' | 'bl' | 'bc' | 'br';

const POSITIONS: { value: Pos; label: string }[] = [
  { value: 'tl', label: 'Top left' },
  { value: 'tc', label: 'Top center' },
  { value: 'tr', label: 'Top right' },
  { value: 'cl', label: 'Middle left' },
  { value: 'cc', label: 'Center' },
  { value: 'cr', label: 'Middle right' },
  { value: 'bl', label: 'Bottom left' },
  { value: 'bc', label: 'Bottom center' },
  { value: 'br', label: 'Bottom right' },
];

/** Anchor point + content alignment for the chosen 9-grid position. */
function anchor(pos: Pos, w: number, h: number, ew: number, eh: number, pad: number) {
  const col = pos[1]; // l | c | r
  const row = pos[0]; // t | c | b
  const x = col === 'l' ? pad : col === 'c' ? w / 2 : w - pad;
  const y = row === 't' ? pad : row === 'c' ? h / 2 : h - pad;
  return { x, y };
}

export default function WatermarkPage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);
  const [wtype, setWtype] = useState<WmType>('text');
  const [text, setText] = useState('© ImageTool Studio');
  const [textSize, setTextSize] = useState(7); // % of min image dimension
  const [color, setColor] = useState('#ffffff');
  const [logoImg, setLogoImg] = useState<{ url: string; name: string } | null>(null);
  const [logoSize, setLogoSize] = useState(20); // % of min dimension (width)
  const [position, setPosition] = useState<Pos>('br');
  const [opacity, setOpacity] = useState(70);
  const [rotation, setRotation] = useState(0);
  const [format, setFormat] = useState<OutFormat>('original');
  const [quality, setQuality] = useState(92);

  const logoInputRef = useRef<HTMLInputElement>(null);
  // Keep ONE decoded logo per queue run (don't re-decode per image).
  const logoElemRef = useRef<HTMLImageElement | null>(null);
  const logoUrlRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    if (!logoImg) {
      logoElemRef.current = null;
      logoUrlRef.current = '';
      return;
    }
    if (logoUrlRef.current === logoImg.url && logoElemRef.current) return;
    loadImage(logoImg.url)
      .then((el) => {
        if (!cancelled) {
          logoElemRef.current = el;
          logoUrlRef.current = logoImg.url;
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [logoImg]);

  // Revoke logo object URL on unmount.
  useEffect(
    () => () => {
      setLogoImg((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return prev;
      });
    },
    []
  );

  const processor: Processor = useCallback(
    async (item, report) => {
      const img = await loadImage(item.originalUrl);
      report(0.3);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = makeCanvas(w, h);
      const ctx = get2d(canvas);
      ctx.drawImage(img, 0, 0);

      const minDim = Math.min(w, h);
      const pad = minDim * 0.04;
      const rad = (rotation * Math.PI) / 180;

      if (wtype === 'text') {
        const px = Math.max(8, Math.round((minDim * textSize) / 100));
        ctx.font = `600 ${px}px system-ui, -apple-system, 'Segoe UI', Arial, sans-serif`;
        const metrics = ctx.measureText(text || ' ');
        const ew = metrics.width;
        const eh = px;
        const { x, y } = anchor(position, w, h, ew, eh, pad + ew / 2);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rad);
        ctx.globalAlpha = opacity / 100;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text || ' ', 0, 0);
        ctx.restore();
      } else {
        const el = logoElemRef.current;
        if (!el) throw new Error('Please choose a logo image first (Watermark type → Logo).');
        const ew = Math.max(8, (minDim * logoSize) / 100);
        const eh = (ew * el.naturalHeight) / Math.max(1, el.naturalWidth);
        const { x, y } = anchor(position, w, h, ew, eh, pad + ew / 2);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rad);
        ctx.globalAlpha = opacity / 100;
        ctx.drawImage(el, -ew / 2, -eh / 2, ew, eh);
        ctx.restore();
      }

      report(0.8);
      const mime = resolveMime(format, item.type);
      const blob = await canvasToBlob(canvas, mime, isLossy(mime) ? quality / 100 : undefined);
      return {
        blob,
        name: `${stripExt(item.name)}-watermarked.${extForMime(mime)}`,
        width: w,
        height: h,
        info: [wtype === 'text' ? `text: “${text.slice(0, 20)}${text.length > 20 ? '…' : ''}”` : `logo @ ${logoSize}%`, sizeInfo(item.size, blob.size)],
      };
    },
    [wtype, text, textSize, color, logoImg, logoSize, position, opacity, rotation, format, quality]
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

  const pickLogo = (files: FileList | null) => {
    const f = files?.[0];
    if (!f || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return;
    setLogoImg((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { url: URL.createObjectURL(f), name: f.name };
    });
  };

  const mime = resolveMime(format, 'image/jpeg');

  return (
    <ToolWorkspace
      title="Watermark Tool"
      description="Add text or logo watermarks to one image or a whole batch — position, size, opacity, and rotation included."
      icon="image"
      queue={queue}
      errors={errors}
      onFiles={handleFiles}
      zipName="imagetool-studio-watermarked.zip"
      settings={
        <>
          <Field label="Watermark type">
            <Segmented
              value={wtype}
              onChange={setWtype}
              options={[
                { value: 'text', label: 'Text' },
                { value: 'logo', label: 'Logo image' },
              ]}
              ariaLabel="Watermark type"
            />
          </Field>

          {wtype === 'text' ? (
            <>
              <Field label="Text">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  aria-label="Watermark text"
                />
              </Field>
              <Field label="Text color">
                <ColorField value={color} onChange={setColor} />
              </Field>
              <Slider label="Text size" value={textSize} min={3} max={30} onChange={setTextSize} format={(v) => `${v}%`} />
            </>
          ) : (
            <>
              <Field label="Logo image">
                {logoImg ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoImg.url} alt="Watermark logo" className="bg-checkerboard h-10 w-10 rounded-lg border border-gray-200 object-contain" />
                    <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{logoImg.name}</span>
                    <Button variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()}>
                      Replace
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" className="w-full" onClick={() => logoInputRef.current?.click()}>
                    <Icon name="image" className="h-4 w-4" />
                    Choose logo…
                  </Button>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    pickLogo(e.target.files);
                    e.target.value = '';
                  }}
                />
              </Field>
              <Slider label="Logo size" value={logoSize} min={5} max={50} onChange={setLogoSize} format={(v) => `${v}%`} />
            </>
          )}

          <Field label="Position">
            <Select value={position} onChange={setPosition} options={POSITIONS} ariaLabel="Watermark position" />
          </Field>
          <Slider label="Opacity" value={opacity} min={5} max={100} onChange={setOpacity} format={(v) => `${v}%`} />
          <Slider label="Rotation" value={rotation} min={-90} max={90} onChange={setRotation} format={(v) => `${v}°`} />
          <Field label="Output format">
            <Select value={format} onChange={setFormat} options={FORMAT_OPTIONS} ariaLabel="Output format" />
          </Field>
          {isLossy(mime) && <Slider label="Quality" value={quality} min={10} max={100} onChange={setQuality} format={(v) => `${v}%`} />}
        </>
      }
      notes={
        <>
          <Note>Batch friendly: upload many images and the same watermark settings apply to all of them, then grab one ZIP.</Note>
          <Note tone="amber">Size is set relative to each image (percent of its smaller side), so every photo gets a proportional mark.</Note>
        </>
      }
    />
  );
}
