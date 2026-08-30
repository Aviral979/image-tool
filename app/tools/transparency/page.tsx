'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ToolWorkspace from '@/components/ToolWorkspace';
import { useImageQueue, type Processor, type QueueItem } from '@/lib/useImageQueue';
import {
  canvasToBlob,
  downloadBlob,
  extForMime,
  get2d,
  loadImage,
  makeCanvas,
  sizeInfo,
  stripExt,
} from '@/lib/image';
import { Button, Card, ColorField, Field, Note, Segmented, Slider } from '@/components/ui';
import { Icon } from '@/components/Icon';

type Mode = 'opacity' | 'color' | 'eraser';

/** Global color→alpha removal: pixels within tolerance of the target become transparent. */
function colorToTransparent(ctx: CanvasRenderingContext2D, w: number, h: number, tr: number, tg: number, tb: number, tol: number) {
  const d = ctx.getImageData(0, 0, w, h);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i] - tr;
    const dg = px[i + 1] - tg;
    const db = px[i + 2] - tb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= tol) px[i + 3] = 0;
  }
  ctx.putImageData(d, 0, 0);
}

export default function TransparencyPage() {
  const queue = useImageQueue();
  const [errors, setErrors] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>('color');
  const [targetColor, setTargetColor] = useState('#ffffff');
  const [tolerance, setTolerance] = useState(20);
  const [opacityVal, setOpacityVal] = useState(50);

  const processor: Processor = useCallback(
    async (item, report) => {
      if (mode === 'eraser') {
        // Eraser is interactive — handled by the editor card below, not the auto queue.
        return { blob: item.file, name: `${stripExt(item.name)}-edited.png`, info: ['use the eraser card below'] };
      }
      const img = await loadImage(item.originalUrl);
      report(0.35);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = makeCanvas(w, h);
      const ctx = get2d(canvas);
      ctx.drawImage(img, 0, 0);
      if (mode === 'opacity') {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = `rgba(0,0,0,${opacityVal / 100})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const tr = parseInt(targetColor.slice(1, 3), 16);
        const tg = parseInt(targetColor.slice(3, 5), 16);
        const tb = parseInt(targetColor.slice(5, 7), 16);
        colorToTransparent(ctx, w, h, tr, tg, tb, tolerance * 2.2);
      }
      report(0.85);
      const blob = await canvasToBlob(canvas, 'image/png');
      return {
        blob,
        name: `${stripExt(item.name)}-transparent.${extForMime('image/png')}`,
        width: w,
        height: h,
        info: [
          mode === 'opacity' ? `opacity ${opacityVal}%` : `${targetColor} @ tolerance ${tolerance}`,
          sizeInfo(item.size, blob.size),
        ],
      };
    },
    [mode, targetColor, tolerance, opacityVal]
  );

  const procRef = useRef(processor);
  useEffect(() => {
    procRef.current = processor;
  });

  const runAll = useCallback(() => {
    void queue.processAll((item, report) => procRef.current(item, report));
  }, [queue.processAll]);

  useEffect(() => {
    if (queue.items.length === 0 || mode === 'eraser') return;
    const t = window.setTimeout(runAll, 350);
    return () => window.clearTimeout(t);
  }, [processor, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFiles = useCallback(
    (files: File[]) => {
      setErrors(queue.addFiles(files));
      if (mode !== 'eraser') window.setTimeout(runAll, 0);
    },
    [queue.addFiles, runAll, mode]
  );

  return (
    <ToolWorkspace
      title="Transparency Tools"
      description="Adjust opacity, turn any color transparent (one-click white-background removal), or erase by hand with a brush."
      icon="bg"
      queue={queue}
      errors={errors}
      onFiles={handleFiles}
      zipName="imagetool-studio-transparent.zip"
      checkerResult
      settings={
        <>
          <Field label="Mode">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'color', label: 'Color → transparent' },
                { value: 'opacity', label: 'Opacity' },
                { value: 'eraser', label: 'Manual eraser' },
              ]}
              ariaLabel="Transparency mode"
            />
          </Field>

          {mode === 'color' && (
            <>
              <Field label="Color to remove">
                <ColorField value={targetColor} onChange={setTargetColor} />
              </Field>
              <Slider label="Tolerance" value={tolerance} min={0} max={100} onChange={setTolerance} format={(v) => `${v}%`} />
              <Button variant="secondary" size="sm" onClick={() => setTargetColor('#ffffff')}>
                Set to white (white-bg removal)
              </Button>
            </>
          )}

          {mode === 'opacity' && <Slider label="Opacity" value={opacityVal} min={0} max={100} onChange={setOpacityVal} format={(v) => `${v}%`} />}

          {mode === 'eraser' && (
            <Note>Select an image in the queue, then use the eraser card below to paint away what you don&rsquo;t want.</Note>
          )}
        </>
      }
      afterQueue={mode === 'eraser' && queue.selected ? <EraserCard key={queue.selected.id} item={queue.selected} /> : null}
      notes={
        mode === 'color' ? (
          <>
            <Note tone="amber">
              Color removal compares every pixel to the chosen color — increase tolerance for anti-aliased edges. For
              tricky subjects/hair, the Background Remover tool (AI) does a much better job.
            </Note>
            <Note>Output is always PNG so the transparency is preserved.</Note>
          </>
        ) : mode === 'opacity' ? (
          <Note>Opacity multiplies every pixel&rsquo;s alpha channel. Export is PNG to keep the result.</Note>
        ) : (
          <Note>Eraser strokes are local to your machine — nothing uploads anywhere. Use Restore strokes to undo patches.</Note>
        )
      }
    />
  );
}

/* ---------------- Manual eraser ---------------- */

function EraserCard({ item }: { item: QueueItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLImageElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [brush, setBrush] = useState(40);
  const [restore, setRestore] = useState(false);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    loadImage(item.originalUrl).then((img) => {
      if (cancelled) return;
      originalRef.current = img;
      const maxSide = 1200;
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      setScale(k);
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.round(img.naturalWidth * k);
      canvas.height = Math.round(img.naturalHeight * k);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [item.originalUrl]);

  const pos = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvasRef.current!.width,
      y: ((e.clientY - rect.top) / rect.height) * canvasRef.current!.height,
    };
  };

  const stamp = useCallback(
    (p: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      const img = originalRef.current;
      if (!canvas || !img) return;
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, brush / 2, 0, Math.PI * 2);
      ctx.clip();
      if (restore) {
        ctx.clearRect(p.x - brush / 2, p.y - brush / 2, brush, brush);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(p.x - brush / 2, p.y - brush / 2, brush, brush);
      }
      ctx.restore();
    },
    [brush, restore]
  );

  const paintLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const step = Math.max(1, brush / 4);
      const n = Math.max(1, Math.ceil(dist / step));
      for (let i = 0; i <= n; i++) {
        stamp({ x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n });
      }
    },
    [brush, stamp]
  );

  const reset = () => {
    const canvas = canvasRef.current;
    const img = originalRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToBlob(canvas, 'image/png');
    downloadBlob(blob, `${stripExt(item.name)}-erased.png`);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Manual eraser — {item.name}</h3>
        <div className="flex items-center gap-2">
          <Segmented
            value={restore ? 'restore' : 'erase'}
            onChange={(v) => setRestore(v === 'restore')}
            options={[
              { value: 'erase', label: 'Erase' },
              { value: 'restore', label: 'Restore' },
            ]}
            ariaLabel="Brush mode"
          />
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
          <Button size="sm" onClick={download}>
            <Icon name="download" className="h-4 w-4" /> Download PNG
          </Button>
        </div>
      </div>
      <div className="mt-3">
        <Slider label="Brush size" value={brush} min={5} max={150} onChange={setBrush} format={(v) => `${v}px`} />
      </div>
      <div className="bg-checkerboard mt-3 max-h-[420px] overflow-auto rounded-xl border border-gray-200">
        <canvas
          ref={canvasRef}
          className="touch-none"
          style={{ cursor: 'crosshair', display: 'block', maxWidth: 'none' }}
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = pos(e);
            last.current = p;
            stamp(p);
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const p = pos(e);
            paintLine(last.current, p);
            last.current = p;
          }}
          onPointerUp={() => {
            drawing.current = false;
            last.current = null;
          }}
          onPointerCancel={() => {
            drawing.current = false;
            last.current = null;
          }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {ready ? 'Paint to erase. Switch to Restore to bring pixels back. Exported at up to 1200px.' : 'Loading image…'}
      </p>
    </Card>
  );
}
