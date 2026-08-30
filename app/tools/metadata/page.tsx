'use client';

import { useCallback, useEffect, useState } from 'react';
import ToolHeader from '@/components/ToolHeader';
import PrivacyNotice from '@/components/PrivacyNotice';
import UploadArea from '@/components/UploadArea';
import { Button, Card, Note } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { canvasToBlob, downloadBlob, extForMime, formatBytes, get2d, loadImage, makeCanvas, sizeInfo, stripExt } from '@/lib/image';

const EXIF_LABELS: [string, string][] = [
  ['Make', 'Camera make'],
  ['Model', 'Camera model'],
  ['LensModel', 'Lens'],
  ['Software', 'Software'],
  ['DateTimeOriginal', 'Taken'],
  ['CreateDate', 'Created'],
  ['ModifyDate', 'Modified'],
  ['ExposureTime', 'Exposure'],
  ['FNumber', 'Aperture'],
  ['ISO', 'ISO'],
  ['FocalLength', 'Focal length'],
  ['Orientation', 'Orientation'],
];

export default function MetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [exif, setExif] = useState<Record<string, any> | null>(null);
  const [parseState, setParseState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url]
  );

  const open = useCallback(async (f: File) => {
    setError(null);
    setExif(null);
    setDims(null);
    setParseState('loading');
    if (url) URL.revokeObjectURL(url);
    const u = URL.createObjectURL(f);
    setUrl(u);
    setFile(f);
    try {
      const img = await loadImage(u);
      setDims({ w: img.naturalWidth, h: img.naturalHeight });
    } catch {
      setError('This image could not be opened.');
    }
    try {
      const exifr = (await import('exifr')).default;
      const data = await exifr.parse(f, { reviveValues: true });
      setExif(data ?? {});
    } catch {
      setExif({});
    }
    setParseState('done');
  }, [url]);

  const stripAndDownload = useCallback(async () => {
    if (!file || !url) return;
    try {
      const img = await loadImage(url);
      const canvas = makeCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = get2d(canvas);
      ctx.drawImage(img, 0, 0);
      // Re-encoding via canvas drops every APPn metadata segment.
      const mime = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      const blob = await canvasToBlob(canvas, mime, mime === 'image/png' ? undefined : 0.95);
      downloadBlob(blob, `${stripExt(file.name)}-clean.${extForMime(mime)}`);
    } catch {
      setError('Could not create a cleaned copy.');
    }
  }, [file, url]);

  const exifEntries = exif ? Object.entries(exif) : [];
  const shownRows = EXIF_LABELS.filter(([k]) => exif && exif[k] != null);
  const hasGps = !!(exif && (exif.latitude != null || exif.GPSLatitude != null));
  const fmtVal = (v: any): string => {
    if (v instanceof Date) return v.toLocaleString();
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object' && v !== null) return JSON.stringify(v).slice(0, 80);
    return String(v);
  };

  return (
    <section className="wrap py-10">
      <ToolHeader
        icon="info"
        title="Metadata Tool"
        description="See what's inside your image — size, format, and EXIF camera data — then download a cleaned, metadata-free copy."
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
          <div className="mt-4">
            <Note tone="amber">
              JPEG photos from cameras/phones often contain EXIF: camera model, settings, date — sometimes even GPS
              location. Re-sharing them publicly leaks that data.
            </Note>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <Card className="p-4">
            <div className="bg-checkerboard flex justify-center rounded-xl border border-gray-100 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url!} alt={file.name} className="max-h-[420px] max-w-full rounded-lg" />
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              {[
                ['File name', file.name],
                ['File size', formatBytes(file.size)],
                ['Type', file.type || 'unknown'],
                ['Dimensions', dims ? `${dims.w} × ${dims.h} px` : '—'],
                ['Last modified', new Date(file.lastModified).toLocaleString()],
                ['EXIF fields found', parseState === 'loading' ? 'scanning…' : String(exifEntries.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-gray-50 pb-2">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="break-all text-right font-medium text-gray-800">{v}</dd>
                </div>
              ))}
            </dl>
            <Button className="mt-4 w-full" size="lg" onClick={stripAndDownload}>
              <Icon name="download" className="h-4 w-4" />
              Download without metadata
            </Button>
            <p className="mt-2 text-center text-xs text-gray-400">{file ? sizeInfo(file.size, file.size) : ''} — pixels unchanged, only metadata removed</p>
            <div className="mt-2 text-center">
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                Check another image
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900">EXIF details</h3>
            {parseState === 'loading' ? (
              <p className="mt-4 text-sm text-gray-500">Reading metadata…</p>
            ) : exifEntries.length === 0 ? (
              <div className="mt-4">
                <Note>
                  No EXIF metadata found — normal for PNG/WebP, screenshots, and images already cleaned or exported from
                  editors.
                </Note>
              </div>
            ) : (
              <>
                {hasGps && (
                  <div className="mt-3">
                    <Note tone="amber">
                      <strong>GPS coordinates present</strong> — share this file and people can see where it was taken.
                      Download the cleaned copy before publishing.
                    </Note>
                  </div>
                )}
                <div className="mt-4 max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {shownRows.map(([key, label]) => (
                        <tr key={key} className="border-b border-gray-50">
                          <td className="py-2 pr-3 text-gray-500">{label}</td>
                          <td className="break-all py-2 text-right font-medium text-gray-800">{fmtVal(exif![key])}</td>
                        </tr>
                      ))}
                      {exifEntries
                        .filter(([k]) => !EXIF_LABELS.some(([kk]) => kk === k) && k !== 'latitude' && k !== 'longitude')
                        .slice(0, 40)
                        .map(([k, v]) => (
                          <tr key={k} className="border-b border-gray-50">
                            <td className="py-1.5 pr-3 text-xs text-gray-400">{k}</td>
                            <td className="break-all py-1.5 text-right text-xs text-gray-500">{fmtVal(v)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {exifEntries.length > 40 && (
                    <p className="mt-2 text-xs text-gray-400">…and {exifEntries.length - 40} more fields</p>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}
