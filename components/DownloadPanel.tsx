'use client';

import { useEffect, useState } from 'react';
import type { QueueItem } from '@/lib/useImageQueue';
import { formatBytes } from '@/lib/image';
import { Button, Card, Spinner } from './ui';
import { Icon } from './Icon';

export default function DownloadPanel({
  items,
  processing,
  zipName,
  onDownloadItem,
  onDownloadAll,
}: {
  items: QueueItem[];
  processing: boolean;
  zipName: string;
  onDownloadItem: (id: string, nameOverride?: string) => void;
  onDownloadAll: () => Promise<void> | void;
}) {
  const done = items.filter((i) => i.status === 'done' && i.result);
  const singleName = done.length === 1 ? done[0].result!.name : '';
  const [name, setName] = useState(singleName);
  const [zipping, setZipping] = useState(false);

  useEffect(() => setName(singleName), [singleName]);

  if (!items.length) return null;

  const totalBytes = done.reduce((sum, i) => sum + (i.result?.size ?? 0), 0);

  const handleZip = async () => {
    setZipping(true);
    try {
      await onDownloadAll();
    } finally {
      setZipping(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Download</h3>
        <p className="text-xs text-gray-500">
          {done.length} of {items.length} ready
          {totalBytes > 0 && ` · ${formatBytes(totalBytes)}`}
        </p>
      </div>

      {done.length === 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          {processing ? (
            <>
              <Spinner /> Processing your images…
            </>
          ) : (
            'No processed images yet.'
          )}
        </p>
      )}

      {done.length === 1 && (
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="dl-name" className="mb-1.5 block text-sm font-medium text-gray-700">
              File name
            </label>
            <input
              id="dl-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <Button className="w-full" onClick={() => onDownloadItem(done[0].id, name)}>
            <Icon name="download" className="h-4 w-4" />
            Download {done[0].result ? `(${formatBytes(done[0].result.size)})` : ''}
          </Button>
        </div>
      )}

      {done.length > 1 && (
        <div className="mt-3 space-y-2">
          <Button className="w-full" size="lg" onClick={handleZip} disabled={zipping}>
            {zipping ? <Spinner /> : <Icon name="zip" className="h-4 w-4" />}
            {zipping ? 'Preparing ZIP…' : `Download All as ZIP (${done.length})`}
          </Button>
          <p className="text-center text-xs text-gray-400">Or download files individually from the queue above.</p>
        </div>
      )}

      {processing && done.length > 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <Spinner className="h-3.5 w-3.5" /> More images are still processing…
        </p>
      )}
    </Card>
  );
}
