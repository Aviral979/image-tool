'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/#tools', label: 'All Tools' },
  { href: '/#tools', label: 'Image Tools' },
  { href: '/#batch', label: 'Batch Tools' },
  { href: '/#privacy', label: 'Privacy' },
  { href: '/#about', label: 'About' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="wrap flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="ImageTool Studio home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <Icon name="image" className="h-4 w-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            ImageTool <span className="text-indigo-600">Studio</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
          {LINKS.map((l) => (
            <Link key={l.label + l.href} href={l.href} className="text-sm font-medium text-gray-600 transition hover:text-indigo-600">
              {l.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? 'x' : 'menu'} />
        </button>
      </div>

      {open && (
        <nav className="border-t border-gray-100 bg-white px-4 py-3 md:hidden" aria-label="Mobile navigation">
          {LINKS.map((l) => (
            <Link
              key={l.label + l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
