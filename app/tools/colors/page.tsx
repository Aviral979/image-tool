'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ToolHeader from '@/components/ToolHeader';
import PrivacyNotice from '@/components/PrivacyNotice';
import UploadArea from '@/components/UploadArea';
import { Button, Card, Field, Note, Select } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { canvasToBlob, downloadBlob, formatBytes, get2d, loadImage, makeCanvas } from '@/lib/image';

interface RGB {
  r: number;
  g: number;
  b: number;
}

const toHex = ({ r, g, b }: RGB) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Median-cut palette extraction on a downsampled copy of the image. */
function extractPalette(img: HTMLImageElement, count: number): RGB[] {
  const side = 120;
  const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = makeCanvas(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
  const ctx = get2d(canvas);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // skip mostly-transparent
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }
  if (!pixels.length) return [];

  type Box = RGB[];
  const boxes: Box[] = [pixels];
  while (boxes.length < count) {
    // split the box with the largest channel range
    boxes.sort((a, b) => rangeOf(b) - rangeOf(a));
    const box = boxes.shift()!;
    if (box.length < 2) {
      boxes.push(box);
      break;
    }
    const ch = widestChannel(box);
    box.sort((p1, p2) => p1[ch] - p2[ch]);
    const mid = Math.floor(box.length / 2);
    boxes.push(box.slice(0, mid), box.slice(mid));
  }
  return boxes
    .map((box) => {
      const acc = box.reduce((a, p) => ({ r: a.r + p.r, g: a.g + p.g, b: a.b + p.b }), { r: 0, g: 0, b: 0 });
      const n = box.length || 1;
      return { r: Math.round(acc.r / n), g: Math.round(acc.g / n), b: Math.round(acc.b / n) };
    })
    .sort((a, b) => luminance(b) - luminance(a));

  function luminance(c: RGB) {
    return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  }
  function rangeOf(box: RGB[]) {
    const chs: (keyof RGB)[] = ['r', 'g', 'b'];
    return Math.max(
      ...chs.map((ch) => {
        let min = 255;
        let max = 0;
        for (const p of box) {
          if (p[ch] < min) min = p[ch];
          if (p[ch] > max) max = p[ch];
        }
        return max - min;
      })
    );
  }
  function widestChannel(box: RGB[]): keyof RGB {
    const chs: (keyof RGB)[] = ['r', 'g', 'b'];
    let best: keyof RGB = 'r';
    let bestRange = -1;
    for (const ch of chs) {
      let min = 255;
      let max = 0;
      for (const p of box) {
        if (p[ch] < min) min = p[ch];
        if (p[ch] > max) max = p[ch];
      }
      if (max - min > bestRange) {
        bestRange = max - min;
        best = ch;
      }
    }
    return best;
  }
}

export default function ColorToolsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [picked, setPicked] = useState<RGB | null>(null);
  const [palette, setPalette] = useState<RGB[]>([]);
  const [paletteCount, setPaletteCount] = useState('6');
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url]
  );

  const open = useCallback(
    (f: File) => {
      setError(null);
      setPicked(null);
      setPalette([]);
      if (url) URL.revokeObjectURL(url);
      const u = URL.createObjectURL(f);
      setUrl(u);
      setFile(f);
      loadImage(u)
        .then((el) => {
          setImg(el);
          setPalette(extractPalette(el, Number(paletteCount)));
        })
        .catch(() => setError('This image could not be opened.'));
    },
    [url, paletteCount]
  );

  const pickFromPoint = (e: React.MouseEvent) => {
    if (!img) return;
    const target = imgRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * img.naturalWidth);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * img.naturalHeight);
    const canvas = makeCanvas(img.naturalWidth, img.naturalHeight);
    const ctx = get2d(canvas);
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(x, y, 1, 1).data;
    setPicked({ r: d[0], g: d[1], b: d[2] });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1200);
    } catch {
      /* clipboard blocked */
    }
  };

  const downloadPalette = async () => {
    if (!palette.length || !file) return;
    const swatchW = 160;
    const strip = makeCanvas(swatchW * palette.length, 240);
    const ctx = get2d(strip);
    palette.forEach((c, i) => {
      ctx.fillStyle = toHex(c);
      ctx.fillRect(i * swatchW, 0, swatchW, 180);
      ctx.fillStyle = '#111827';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(toHex(c).toUpperCase(), i * swatchW + 10, 205);
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(`${c.r}, ${c.g}, ${c.b}`, i * swatchW + 10, 225);
    });
    const blob = await canvasToBlob(strip, 'image/png');
    downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}-palette.png`);
  };

  const rgba = (c: RGB) => `rgb(${c.r}, ${c.g}, ${c.b})`;

  return (
    <section className="wrap py-10">
      <ToolHeader
        icon="drop"
        title="Color Tools"
        description="Click anywhere on your image to grab HEX + RGB, and generate a balanced color palette from any picture."
      />
      <PrivacyNotice className="mt-6" />

      {error && (
        <div className="mt-4">
          <Note tone="red">{error}</Note>
        </div>
      )}

      {!file ? (
        <div className="mx-auto mt-6 max-w-2xl">
          <UploadArea multiple={false} onFiles={(files) => files[0] && open(files[0])} />
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="truncate text-sm font-semibold text-gray-900">{file.name}</h3>
              <span className="ml-3 shrink-0 text-xs text-gray-400">
                {img ? `${img.naturalWidth} × ${img.naturalHeight}` : ''} · {formatBytes(file.size)}
              </span>
            </div>
            <div className="mt-3 flex justify-center rounded-xl border border-gray-100 bg-gray-50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={url!}
                alt={file.name}
                onClick={pickFromPoint}
                className="max-h-[480px] max-w-full cursor-crosshair rounded-lg"
              />
            </div>
            <p className="mt-2 text-center text-xs text-gray-400">Click anywhere on the image to pick a color</p>
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-900">Picked color</h3>
              {picked ? (
                <div className="mt-3 space-y-3">
                  <div className="h-16 w-full rounded-xl border border-gray-200" style={{ backgroundColor: rgba(picked) }} role="img" aria-label={`Picked color ${toHex(picked)}`} />
                  <div className="space-y-2 text-sm">
                    {[
                      { label: 'HEX', value: toHex(picked).toUpperCase() },
                      { label: 'RGB', value: `${picked.r}, ${picked.g}, ${picked.b}` },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                        <span className="text-gray-500">{row.label}</span>
                        <span className="flex items-center gap-2">
                          <code className="font-mono text-gray-800">{row.value}</code>
                          <button
                            type="button"
                            onClick={() => copy(row.value)}
                            className="text-indigo-600 transition hover:text-indigo-800"
                            aria-label={`Copy ${row.label}`}
                          >
                            <Icon name={copied === row.value ? 'check' : 'stack'} className="h-4 w-4" />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">Click the image to sample a pixel.</p>
              )}
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Palette</h3>
                <Field label="Colors">
                  <Select
                    value={paletteCount}
                    onChange={(v) => {
                      setPaletteCount(v);
                      if (img) setPalette(extractPalette(img, Number(v)));
                    }}
                    options={['4', '6', '8', '10'].map((n) => ({ value: n, label: n }))}
                    ariaLabel="Palette size"
                  />
                </Field>
              </div>
              <div className="mt-3 space-y-2">
                {palette.map((c) => {
                  const hex = toHex(c).toUpperCase();
                  return (
                    <button
                      key={hex + `${c.r}-${c.g}-${c.b}`}
                      type="button"
                      onClick={() => copy(hex)}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm transition hover:border-indigo-200"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="h-7 w-7 rounded-md border border-black/10" style={{ backgroundColor: rgba(c) }} aria-hidden="true" />
                        <code className="font-mono text-gray-800">{hex}</code>
                      </span>
                      {copied === hex ? <Icon name="check" className="h-4 w-4 text-emerald-600" /> : <span className="text-xs text-gray-400">copy</span>}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => copy(palette.map(toHex).join(' '))}>
                  {copied === palette.map(toHex).join(' ') ? 'Copied!' : 'Copy all HEX'}
                </Button>
                <Button size="sm" className="flex-1" onClick={downloadPalette}>
                  <Icon name="download" className="h-4 w-4" /> Palette PNG
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
