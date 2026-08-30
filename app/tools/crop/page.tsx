'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ToolHeader from '@/components/ToolHeader';
import PrivacyNotice from '@/components/PrivacyNotice';
import UploadArea from '@/components/UploadArea';
import { Button, Card, Field, Note, Segmented, Select, Slider } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { btnClass } from '@/lib/styles';
import {
  canvasToBlob,
  downloadBlob,
  extForMime,
  formatBytes,
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

type Aspect = 'free' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16';
const ASPECT_RATIO: Record<Exclude<Aspect, 'free'>, number> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
};

interface RectF {
  x: number; // 0..1 of displayed image width
  y: number;
  w: number;
  h: number;
}

type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

// normalize() lives inside onPointerMove constraints (unused helper removed).

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function CropPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState<Aspect>('free');
  const [rect, setRect] = useState<RectF>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [zoom, setZoom] = useState(1);
  const [format, setFormat] = useState<OutFormat>('original');
  const [quality, setQuality] = useState(95);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: DragHandle; startX: number; startY: number; startRect: RectF } | null>(null);

  useEffect(
    () => () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    },
    [imgUrl]
  );

  const setImage = useCallback(
    (f: File) => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
      const url = URL.createObjectURL(f);
      setFile(f);
      setImgUrl(url);
      setError(null);
      loadImage(url)
        .then((el) => {
          setImg(el);
          setRect({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
          setZoom(1);
        })
        .catch((e) => setError(e.message));
    },
    [imgUrl]
  );

  const applyAspect = (a: Aspect) => {
    setAspect(a);
    if (a !== 'free') {
      const ratio = ASPECT_RATIO[a];
      setRect((r) => {
        let w = Math.min(r.w, 0.9);
        let h = w / ratio;
        if (h > 0.9) {
          h = 0.9;
          w = h * ratio;
        }
        const x = clamp(r.x, 0, 1 - w);
        const y = clamp(r.y, 0, 1 - h);
        return { x, y, w, h };
      });
    }
  };

  const onPointerDown = (handle: DragHandle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, startRect: { ...rect } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const box = stage.getBoundingClientRect();
    // Stage box is zoom-scaled; rect fractions are relative to the UNZOOMED image.
    const dx = (e.clientX - drag.startX) / (box.width / zoom);
    const dy = (e.clientY - drag.startY) / (box.height / zoom);
    const s = drag.startRect;
    let r: RectF = { ...s };
    if (drag.handle === 'move') {
      r.x = clamp(s.x + dx, 0, 1 - s.w);
      r.y = clamp(s.y + dy, 0, 1 - s.h);
    } else if (drag.handle === 'se') {
      r.w = clamp(s.w + dx, 0.05, 1 - s.x);
      r.h = aspect === 'free' ? clamp(s.h + dy, 0.05, 1 - s.y) : r.w / ASPECT_RATIO[aspect];
    } else if (drag.handle === 'sw') {
      const newW = clamp(s.w - dx, 0.05, s.x + s.w);
      r.x = s.x + (s.w - newW);
      r.w = newW;
      r.h = aspect === 'free' ? clamp(s.h + dy, 0.05, 1 - s.y) : newW / ASPECT_RATIO[aspect];
    } else if (drag.handle === 'ne') {
      r.w = clamp(s.w + dx, 0.05, 1 - s.x);
      const newH = aspect === 'free' ? clamp(s.h - dy, 0.05, s.y + s.h) : r.w / ASPECT_RATIO[aspect];
      r.y = s.y + (s.h - newH);
      r.h = newH;
    } else if (drag.handle === 'nw') {
      const newW = clamp(s.w - dx, 0.05, s.x + s.w);
      r.x = s.x + (s.w - newW);
      r.w = newW;
      const newH = aspect === 'free' ? clamp(s.h - dy, 0.05, s.y + s.h) : newW / ASPECT_RATIO[aspect];
      r.y = s.y + (s.h - newH);
      r.h = newH;
    }
    // clamp overflow when aspect-driven height exceeds canvas
    if (r.y + r.h > 1) {
      r.h = 1 - r.y;
      if (aspect !== 'free') r.w = r.h * ASPECT_RATIO[aspect];
    }
    if (r.x + r.w > 1) {
      r.w = 1 - r.x;
    }
    setRect(r);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const cropNow = async () => {
    if (!file || !img) return;
    setBusy(true);
    setError(null);
    try {
      const sx = Math.round(rect.x * img.naturalWidth);
      const sy = Math.round(rect.y * img.naturalHeight);
      const sw = Math.max(1, Math.round(rect.w * img.naturalWidth));
      const sh = Math.max(1, Math.round(rect.h * img.naturalHeight));
      const canvas = makeCanvas(sw, sh);
      const ctx = get2d(canvas);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const mime = resolveMime(format, file.type);
      const blob = await canvasToBlob(canvas, mime, isLossy(mime) ? quality / 100 : undefined);
      downloadBlob(blob, `${stripExt(file.name)}-cropped-${sw}x${sh}.${extForMime(mime)}`);
    } catch (e: any) {
      setError(e?.message || 'The image could not be cropped.');
    } finally {
      setBusy(false);
    }
  };

  const outW = img ? Math.round(rect.w * img.naturalWidth) : 0;
  const outH = img ? Math.round(rect.h * img.naturalHeight) : 0;

  const handleStyle = 'absolute h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-600 shadow';

  return (
    <section className="wrap py-10">
      <ToolHeader
        icon="crop"
        title="Crop Tool"
        description="Free-form, square, or fixed-ratio cropping with drag & resize — output keeps the original resolution of the selected area."
      />
      <PrivacyNotice className="mt-6" />

      {error && (
        <div className="mt-4">
          <Note tone="red">{error}</Note>
        </div>
      )}

      {!img || !imgUrl ? (
        <div className="mx-auto mt-6 max-w-2xl">
          <UploadArea multiple={false} onFiles={(files) => files[0] && setImage(files[0])} />
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-gray-900">Crop settings</h2>
              <div className="mt-4 space-y-4">
                <Field label="Aspect ratio">
                  <Segmented
                    value={aspect}
                    onChange={(v) => applyAspect(v)}
                    options={[
                      { value: 'free', label: 'Free' },
                      { value: '1:1', label: '1:1' },
                      { value: '4:3', label: '4:3' },
                      { value: '16:9', label: '16:9' },
                      { value: '3:2', label: '3:2' },
                      { value: '9:16', label: '9:16' },
                    ]}
                    ariaLabel="Aspect ratio"
                  />
                </Field>
                <Slider label="Zoom" value={zoom} min={1} max={3} step={0.1} onChange={setZoom} format={(v) => `${v.toFixed(1)}×`} />
                <div className="rounded-xl bg-gray-50 p-3 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-500">Selection</span>
                    <span className="font-medium tabular-nums text-gray-800">
                      {outW} × {outH} px
                    </span>
                  </p>
                  <p className="mt-1 flex justify-between">
                    <span className="text-gray-500">Original</span>
                    <span className="font-medium tabular-nums text-gray-800">
                      {img.naturalWidth} × {img.naturalHeight} px · {formatBytes(file!.size)}
                    </span>
                  </p>
                </div>
                <Field label="Output format">
                  <Select value={format} onChange={setFormat} options={FORMAT_OPTIONS} ariaLabel="Output format" />
                </Field>
                {isLossy(resolveMime(format, file!.type)) && (
                  <Slider label="Quality" value={quality} min={10} max={100} onChange={setQuality} format={(v) => `${v}%`} />
                )}
                <Button className="w-full" size="lg" onClick={cropNow} disabled={busy}>
                  <Icon name="download" className="h-4 w-4" />
                  {busy ? 'Cropping…' : 'Crop & Download'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setImg(null);
                    setFile(null);
                  }}
                >
                  Choose a different image
                </Button>
              </div>
            </Card>
          </div>

          <div className="min-w-0">
            <Card className="overflow-hidden p-4">
              <div className="max-h-[70vh] overflow-auto rounded-xl bg-gray-100">
                <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }} className="w-fit">
                  <div
                    ref={stageRef}
                    className="relative w-fit touch-none select-none"
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl} alt={file?.name ?? 'Crop source'} draggable={false} className="block max-w-none" />
                    {/* dimmed outside area */}
                    <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 0 9999px rgba(0,0,0,0.45)' }} />
                    {/* crop window */}
                    <div
                      role="application"
                      aria-label="Crop area — drag to move, drag corners to resize"
                      className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                      style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
                      onPointerDown={onPointerDown('move')}
                    >
                      {/* rule of thirds */}
                      <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} className="border border-white/40" />
                        ))}
                      </div>
                      {/* corner handles */}
                      <div aria-hidden className={`${handleStyle} -left-2 -top-2 cursor-nwse-resize`} onPointerDown={onPointerDown('nw')} />
                      <div aria-hidden className={`${handleStyle} -right-2 -top-2 cursor-nesw-resize`} onPointerDown={onPointerDown('ne')} />
                      <div aria-hidden className={`${handleStyle} -bottom-2 -left-2 cursor-nesw-resize`} onPointerDown={onPointerDown('sw')} />
                      <div aria-hidden className={`${handleStyle} -bottom-2 -right-2 cursor-nwse-resize`} onPointerDown={onPointerDown('se')} />
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-gray-400">Drag the box to move · drag the purple dots to resize</p>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
