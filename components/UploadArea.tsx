'use client';

import { useRef, useState } from 'react';
import { ACCEPT_STRING, MAX_FILE_BYTES, formatBytes } from '@/lib/image';
import { Icon } from './Icon';

export default function UploadArea({
  onFiles,
  multiple = true,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const openPicker = () => inputRef.current?.click();

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Add more images"
        onClick={openPicker}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), openPicker()) : undefined)}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
        }}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 text-sm font-medium transition ${
          drag ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 bg-white text-gray-600 hover:border-indigo-400 hover:text-indigo-600'
        }`}
      >
        <Icon name="upload" className="h-4 w-4" />
        Add more images — drag & drop or click to browse
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_STRING}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload images"
      onClick={openPicker}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), openPicker()) : undefined)}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition ${
        drag ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40'
      }`}
    >
      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl transition ${drag ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
        <Icon name="upload" className="h-7 w-7" />
      </span>
      <p className="mt-4 text-lg font-semibold text-gray-900">Drag &amp; Drop Images Here</p>
      <p className="mt-1 text-sm text-gray-500">or click to browse</p>
      <p className="mt-3 text-xs text-gray-400">
        JPG · PNG · WebP — up to {formatBytes(MAX_FILE_BYTES, 0)} each{multiple ? ' · multi-select supported' : ''}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_STRING}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
    </div>
  );
}
