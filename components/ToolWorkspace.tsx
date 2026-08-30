'use client';

import type { ReactNode } from 'react';
import type { ImageQueueApi } from '@/lib/useImageQueue';
import type { IconName } from './Icon';
import { Card, Note, Spinner } from './ui';
import { Icon } from './Icon';
import UploadArea from './UploadArea';
import ImageQueue from './ImageQueue';
import DownloadPanel from './DownloadPanel';
import BeforeAfter from './BeforeAfter';
import ToolHeader from './ToolHeader';
import PrivacyNotice from './PrivacyNotice';

/**
 * Shared layout for every tool page:
 * Upload → Settings → Preview → Download (individual + ZIP),
 * with the privacy notice displayed prominently.
 */
export default function ToolWorkspace({
  title,
  description,
  icon,
  queue,
  errors,
  onFiles,
  zipName,
  settings,
  notes,
  checkerResult = false,
  privacySubline,
}: {
  title: string;
  description: string;
  icon: IconName;
  queue: ImageQueueApi;
  errors: string[];
  onFiles: (files: File[]) => void;
  zipName: string;
  settings: ReactNode;
  notes?: ReactNode;
  checkerResult?: boolean;
  privacySubline?: string;
}) {
  const { items, selected, processing } = queue;

  return (
    <section className="wrap py-10">
      <ToolHeader icon={icon} title={title} description={description} />
      <PrivacyNotice className="mt-6" subline={privacySubline} />

      {errors.length > 0 && (
        <div className="mt-4">
          <Note tone="red">
            <ul className="list-inside list-disc space-y-0.5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Note>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mx-auto mt-6 max-w-2xl">
          <UploadArea onFiles={onFiles} />
          {notes && <div className="mt-4 space-y-3">{notes}</div>}
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Settings column */}
          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-gray-900">Settings</h2>
              <div className="mt-4 space-y-4">{settings}</div>
              <p className="mt-4 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-400">
                <Icon name="check" className="h-3.5 w-3.5 text-emerald-500" />
                Changes apply automatically to all images in the queue.
              </p>
              {processing && (
                <p className="mt-2 flex items-center gap-2 text-xs text-indigo-600">
                  <Spinner className="h-3.5 w-3.5" /> Processing queue…
                </p>
              )}
            </Card>
            {notes}
          </div>

          {/* Queue / preview / download column */}
          <div className="min-w-0 space-y-4">
            <UploadArea compact onFiles={onFiles} />

            <ImageQueue
              items={items}
              selectedId={queue.selectedId}
              onSelect={queue.setSelectedId}
              onRemove={queue.removeItem}
              onClear={queue.clear}
              onDownload={queue.downloadItem}
            />

            {selected && (
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="truncate text-sm font-semibold text-gray-900" title={selected.name}>
                    Preview — {selected.name}
                  </h3>
                  {selected.width && selected.height ? (
                    <span className="shrink-0 text-xs tabular-nums text-gray-400">
                      {selected.width} × {selected.height}
                      {selected.result?.width ? ` → ${selected.result.width} × ${selected.result.height}` : ''}
                    </span>
                  ) : null}
                </div>

                {selected.status === 'done' && selected.result ? (
                  <BeforeAfter
                    beforeUrl={selected.originalUrl}
                    afterUrl={selected.result.url}
                    checkerAfter={checkerResult}
                  />
                ) : selected.status === 'processing' ? (
                  <div className="flex h-64 flex-col items-center justify-center gap-3 text-gray-500">
                    <Spinner className="h-6 w-6" />
                    <p className="text-sm">Processing…</p>
                  </div>
                ) : selected.status === 'error' ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                    <Icon name="alert" className="h-6 w-6 text-red-400" />
                    <p className="max-w-md text-sm text-red-600">{selected.error}</p>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selected.originalUrl} alt={selected.name} className="max-h-[420px] max-w-full rounded-xl" />
                  </div>
                )}
              </Card>
            )}

            <DownloadPanel
              items={items}
              processing={processing}
              zipName={zipName}
              onDownloadItem={queue.downloadItem}
              onDownloadAll={() => queue.downloadAllZip(zipName)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
