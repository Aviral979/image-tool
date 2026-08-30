import type { ReactNode } from 'react';

export type IconName =
  | 'upload'
  | 'download'
  | 'zip'
  | 'x'
  | 'check'
  | 'alert'
  | 'info'
  | 'resize'
  | 'upscale'
  | 'vector'
  | 'bg'
  | 'compress'
  | 'convert'
  | 'shield'
  | 'menu'
  | 'image'
  | 'stack'
  | 'arrowRight'
  | 'refresh';

const PATHS: Record<IconName, ReactNode> = {
  upload: (
    <>
      <path d="M12 16V4m0 0L8 8m4-4l4 4" />
      <path d="M4 20h16" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12m0 0l-4-4m4 4l4-4" />
      <path d="M4 20h16" />
    </>
  ),
  zip: (
    <>
      <path d="M12 3v10m0 0l-3.5-3.5M12 13l3.5-3.5" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: (
    <>
      <path d="M12 4 2.5 20h19L12 4z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.25v.25" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 7.75v.25" />
    </>
  ),
  resize: (
    <>
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
      <path d="M4 4l6 6" />
      <path d="M20 20l-6-6" />
    </>
  ),
  upscale: (
    <>
      <path d="M9 4H4v5" />
      <path d="M15 20h5v-5" />
      <path d="M4 4l7 7" />
      <path d="M20 20l-7-7" />
    </>
  ),
  vector: (
    <>
      <path d="M4 20C12 20 20 12 20 4" />
      <circle cx="4" cy="20" r="1.6" />
      <circle cx="20" cy="4" r="1.6" />
      <circle cx="12" cy="12" r="1.3" />
    </>
  ),
  bg: (
    <>
      <path d="M5 19 19 5" />
      <path d="M15 3.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
      <path d="M6 3.5l.6 1.4L8 5.5l-1.4.6L6 7.5l-.6-1.4L4 5.5l1.4-.6L6 3.5z" />
      <path d="M18.5 13l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4z" />
    </>
  ),
  compress: (
    <>
      <path d="M9 9 4 4" />
      <path d="M9 5v4H5" />
      <path d="M15 15l5 5" />
      <path d="M19 15v4h-4" />
    </>
  ),
  convert: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" />
      <path d="M9.5 12l2 2 3.5-4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M4 17l4.5-4.5L13 17l3-3 4 4" />
    </>
  ),
  stack: (
    <>
      <rect x="7" y="7" width="13" height="13" rx="2" />
      <path d="M4 16V5a1 1 0 0 1 1-1h11" />
    </>
  ),
  arrowRight: <path d="M4 12h16m0 0l-6-6m6 6l-6 6" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
};

export function Icon({
  name,
  className = 'h-5 w-5',
  strokeWidth = 1.8,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
