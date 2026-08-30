import JSZip from 'jszip';
import { downloadBlob } from './image';

export interface ZipEntry {
  name: string;
  blob: Blob;
}

/** Avoid duplicate filenames inside the archive. */
function uniqueName(used: Set<string>, name: string): string {
  if (!used.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) {
    i++;
    candidate = `${base} (${i})${ext}`;
  }
  return candidate;
}

/** Build a ZIP entirely in the browser and trigger a download. */
export async function downloadZip(entries: ZipEntry[], zipName: string): Promise<void> {
  if (!entries.length) return;
  const zip = new JSZip();
  const used = new Set<string>();
  for (const e of entries) {
    const name = uniqueName(used, e.name || 'image');
    used.add(name);
    zip.file(name, e.blob);
  }
  // Images barely re-compress — STORE keeps ZIP creation fast on large batches.
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  downloadBlob(blob, zipName.endsWith('.zip') ? zipName : `${zipName}.zip`);
}
