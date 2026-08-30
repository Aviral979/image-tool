import { Icon } from './Icon';

export default function PrivacyNotice({ className = '', subline }: { className?: string; subline?: string }) {
  return (
    <div className={`flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
        <Icon name="shield" className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-emerald-900">Private by design</p>
        <p className="mt-0.5 text-sm text-emerald-800">
          &ldquo;Your images are not permanently stored. Files are processed securely and are deleted after processing.&rdquo;
        </p>
        <p className="mt-1 text-xs text-emerald-700">
          {subline ??
            'Every tool on this site processes images directly in your browser — your files are never uploaded to a server.'}
        </p>
      </div>
    </div>
  );
}
