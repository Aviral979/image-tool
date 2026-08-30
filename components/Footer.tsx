import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-gray-200 bg-white">
      <div className="wrap flex flex-col items-center justify-between gap-4 py-8 text-sm text-gray-500 sm:flex-row">
        <p>© {new Date().getFullYear()} ImageTool Studio — free, private image tools.</p>
        <div className="flex items-center gap-5">
          <Link href="/#tools" className="transition hover:text-indigo-600">
            All tools
          </Link>
          <Link href="/#privacy" className="transition hover:text-indigo-600">
            Privacy
          </Link>
          <span className="inline-flex items-center gap-1.5 text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            All processing happens in your browser
          </span>
        </div>
      </div>
    </footer>
  );
}
