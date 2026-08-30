'use client';

import { formatBytes } from '@/lib/image';
import type { QueueItem, QueueStatus } from '@/lib/useImageQueue';
import { Button, Card, Chip } from './ui';
import { Icon } from './Icon';

const STATUS: Record<QueueStatus, { label: string; tone: 'gray' | 'indigo' | 'green' | 'red' }> = {
  ready: { label: 'Ready', tone: 'gray' },
  processing: { label: 'Processing', tone: 'indigo' },
  done: { label: 'Completed', tone: 'green' },
  error: { label: 'Failed', tone: 'red' },
};

export default function ImageQueue({
  items,
  selectedId,
  onSelect,
  onRemove,
  onClear,
  onDownload,
}: {
  items: QueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onDownload: (id: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Queue ({items.length})</h3>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear all
          </Button>
        )}
      </div>

      <ul className="max-h-[380px] divide-y divide-gray-100 overflow-y-auto">
        {items.map((item) => {
          const isSel = item.id === selectedId;
          return (
            <li key={item.id}>
              <div
                role="button"
                tabIndex={0}
                aria-label={`Select ${item.name}`}
                onClick={() => onSelect(item.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), onSelect(item.id)) : undefined)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition ${
                  isSel ? 'bg-indigo-50/60 ring-1 ring-inset ring-indigo-300' : 'hover:bg-gray-50'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.originalUrl}
                  alt=""
                  className="bg-checkerboard h-11 w-11 shrink-0 rounded-lg border border-gray-200 object-cover"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-800" title={item.name}>
                      {item.name}
                    </p>
                    <Chip tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Chip>
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                    <span>{formatBytes(item.size)}</span>
                    {item.status === 'done' && item.result && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-emerald-700">{formatBytes(item.result.size)}</span>
                      </>
                    )}
                    {item.info?.map((t) => (
                      <span key={t} className="text-gray-400">
                        {t}
                      </span>
                    ))}
                  </div>

                  {item.status === 'processing' && (
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-[width]"
                        style={{ width: `${Math.round((item.progress ?? 0.05) * 100)}%` }}
                      />
                    </div>
                  )}
                  {item.status === 'error' && <p className="mt-1 text-xs text-red-600">{item.error}</p>}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {item.status === 'done' && (
                    <button
                      type="button"
                      title="Download this file"
                      aria-label={`Download ${item.result?.name ?? item.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(item.id);
                      }}
                      className="rounded-lg p-1.5 text-gray-500 transition hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <Icon name="download" className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Remove from queue"
                    aria-label={`Remove ${item.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
