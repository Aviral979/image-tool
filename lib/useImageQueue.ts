'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ACCEPTED_TYPES, MAX_FILE_BYTES, downloadBlob, formatBytes, friendlyError } from './image';
import { downloadZip } from './zip';

export type QueueStatus = 'ready' | 'processing' | 'done' | 'error';

export interface ItemResult {
  blob: Blob;
  url: string;
  name: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
}

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  originalUrl: string;
  width?: number;
  height?: number;
  status: QueueStatus;
  progress?: number;
  error?: string;
  result?: ItemResult;
  info?: string[];
}

export interface ProcessOutcome {
  blob: Blob;
  name: string;
  width?: number;
  height?: number;
  info?: string[];
}

/** Runs the tool-specific pipeline for one image; report() receives 0..1 progress. */
export type Processor = (item: QueueItem, report: (p: number) => void) => Promise<ProcessOutcome>;

let counter = 0;
const nextId = () => `item_${Date.now()}_${counter++}`;

function disposeItem(item: QueueItem): void {
  URL.revokeObjectURL(item.originalUrl);
  if (item.result) URL.revokeObjectURL(item.result.url);
}

/**
 * Shared batch queue used by every tool: multi-upload, per-item status,
 * sequential processing (keeps the UI responsive), individual + ZIP download.
 */
export function useImageQueue(options?: { accept?: string[]; maxBytes?: number }) {
  const accept = options?.accept ?? ACCEPTED_TYPES;
  const maxBytes = options?.maxBytes ?? MAX_FILE_BYTES;

  const [items, setItems] = useState<QueueItem[]>([]);
  const itemsRef = useRef<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  // If processAll is requested while a run is active, chain it afterwards with the latest settings.
  const pendingRef = useRef<Processor | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Revoke all object URLs when the page unmounts (no lingering in-memory files).
  useEffect(
    () => () => {
      itemsRef.current.forEach(disposeItem);
    },
    []
  );

  const update = useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  /** Returns one human-readable error string per rejected file. */
  const addFiles = useCallback(
    (files: File[] | FileList): string[] => {
      const errors: string[] = [];
      const created: QueueItem[] = [];
      for (const f of Array.from(files)) {
        if (!accept.includes(f.type)) {
          errors.push(`${f.name}: unsupported file type (use JPG, PNG or WebP).`);
          continue;
        }
        if (f.size > maxBytes) {
          errors.push(`${f.name}: file is too large (max ${formatBytes(maxBytes)}).`);
          continue;
        }
        created.push({
          id: nextId(),
          file: f,
          name: f.name,
          size: f.size,
          type: f.type,
          originalUrl: URL.createObjectURL(f),
          status: 'ready',
        });
      }
      if (created.length) {
        setItems((prev) => [...prev, ...created]);
        setSelectedId((prev) => prev ?? created[0].id);
      }
      return errors;
    },
    [accept, maxBytes]
  );

  const removeItem = useCallback((id: string) => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (it) disposeItem(it);
    const next = itemsRef.current.filter((i) => i.id !== id);
    itemsRef.current = next;
    setItems(next);
    setSelectedId((sel) => (sel === id ? next[0]?.id ?? null : sel));
  }, []);

  const clear = useCallback(() => {
    itemsRef.current.forEach(disposeItem);
    itemsRef.current = [];
    setItems([]);
    setSelectedId(null);
  }, []);

  const processAll = useCallback(
    async (processor: Processor) => {
      if (processingRef.current) {
        pendingRef.current = processor;
        return;
      }
      if (!itemsRef.current.length) return;
      processingRef.current = true;
      setProcessing(true);
      try {
        let current: Processor | null = processor;
        while (current) {
          pendingRef.current = null;
          const snapshot = [...itemsRef.current];
          for (const item of snapshot) {
            // Item may have been removed while a previous file was processing.
            if (!itemsRef.current.some((i) => i.id === item.id)) continue;
            update(item.id, { status: 'processing', progress: 0, error: undefined });
            let last = 0;
            const report = (p: number) => {
              const now = Date.now();
              if (now - last > 120 || p >= 1) {
                last = now;
                update(item.id, { progress: p });
              }
            };
            try {
              const outcome = await current(item, report);
              const stillThere = itemsRef.current.find((i) => i.id === item.id);
              if (!stillThere) continue;
              if (stillThere.result) URL.revokeObjectURL(stillThere.result.url);
              update(item.id, {
                status: 'done',
                progress: undefined,
                info: outcome.info,
                result: {
                  blob: outcome.blob,
                  url: URL.createObjectURL(outcome.blob),
                  name: outcome.name,
                  size: outcome.blob.size,
                  type: outcome.blob.type,
                  width: outcome.width,
                  height: outcome.height,
                },
              });
            } catch (err) {
              update(item.id, { status: 'error', progress: undefined, error: friendlyError(err) });
            }
          }
          current = pendingRef.current;
        }
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [update]
  );

  const downloadItem = useCallback((id: string, nameOverride?: string) => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it?.result) return;
    downloadBlob(it.result.blob, (nameOverride ?? '').trim() || it.result.name);
  }, []);

  const downloadAllZip = useCallback(async (zipName: string) => {
    const done = itemsRef.current.filter((i) => i.status === 'done' && i.result);
    if (!done.length) return;
    await downloadZip(
      done.map((i) => ({ name: i.result!.name, blob: i.result!.blob })),
      zipName
    );
  }, []);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  return {
    items,
    selected,
    selectedId,
    setSelectedId,
    addFiles,
    removeItem,
    clear,
    processAll,
    processing,
    downloadItem,
    downloadAllZip,
  };
}

export type ImageQueueApi = ReturnType<typeof useImageQueue>;
