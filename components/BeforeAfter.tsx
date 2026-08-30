'use client';

import { useRef, useState } from 'react';

/**
 * Draggable before/after comparison slider.
 * Keyboard accessible: focus the divider and use arrow keys.
 */
export default function BeforeAfter({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Original',
  afterLabel = 'Result',
  checkerAfter = false,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  checkerAfter?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [pos, setPos] = useState(50);

  const setFromClientX = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(98, Math.max(2, p)));
  };

  return (
    <div>
      <div
        ref={ref}
        className="relative h-[400px] w-full touch-none select-none overflow-hidden rounded-xl border border-gray-200 bg-white"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromClientX(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {/* Before (bottom layer) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={beforeLabel}
          draggable={false}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
        />

        {/* After (top layer, clipped) */}
        <div className={`absolute inset-0 ${checkerAfter ? 'bg-checkerboard' : ''}`} style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterUrl}
            alt={afterLabel}
            draggable={false}
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
          />
        </div>

        {/* Labels */}
        <span className="absolute left-2 top-2 rounded bg-black/55 px-2 py-0.5 text-xs font-medium text-white">{beforeLabel}</span>
        <span className="absolute right-2 top-2 rounded bg-black/55 px-2 py-0.5 text-xs font-medium text-white">{afterLabel}</span>

        {/* Divider */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Comparison slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-orientation="horizontal"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setPos((p) => Math.max(2, p - 2));
            if (e.key === 'ArrowRight') setPos((p) => Math.min(98, p + 2));
          }}
          className="absolute inset-y-0 z-10 w-0.5 cursor-ew-resize bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)] outline-none focus-visible:bg-indigo-400"
          style={{ left: `${pos}%` }}
        >
          <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-500 shadow-md">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M9 6l-4 6 4 6" />
              <path d="M15 6l4 6-4 6" />
            </svg>
          </span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-gray-400">Drag the divider (or use arrow keys) to compare</p>
    </div>
  );
}
