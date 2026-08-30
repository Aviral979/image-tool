import Link from 'next/link';
import { TOOLS, TOOLS_PHASE2, toolHref } from '@/lib/tools';
import ToolCard from '@/components/ToolCard';
import PrivacyNotice from '@/components/PrivacyNotice';
import { Icon } from '@/components/Icon';
import { SectionHead } from '@/components/ui';
import { btnClass } from '@/lib/styles';

const PRIVACY_BULLETS = [
  'No permanent storage — images never leave your device',
  'No accounts and no sign-up for any tool',
  'No image history saved, no database',
  'Files are processed locally in your browser memory',
  'In-memory data is released as soon as you clear the queue or leave the page',
];

const STEPS = [
  {
    n: '1',
    title: 'Upload',
    text: 'Drag & drop one image or a whole batch. Everything stays on your device.',
  },
  {
    n: '2',
    title: 'Configure',
    text: 'Adjust the settings and watch the queue update automatically with a live preview.',
  },
  {
    n: '3',
    title: 'Preview & Download',
    text: 'Compare before/after, then download files individually or grab everything as one ZIP.',
  },
];

export default function HomePage() {
  return (
    <div>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-200/60 to-violet-200/60 blur-3xl"
        />
        <div className="wrap relative py-20 text-center sm:py-28">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3.5 py-1 text-xs font-medium text-indigo-700">
            <Icon name="shield" className="h-3.5 w-3.5" />
            100% free · No sign-up · Processed in your browser
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Edit Your Images. Fast, Simple, and <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Private</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
            Resize, convert, compress, upscale, remove backgrounds, convert images to vectors, and more — all in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="#tools" className={btnClass('primary', 'lg')}>
              Choose a Tool
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
            <Link href="#batch" className={btnClass('secondary', 'lg')}>
              Explore All Tools
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Popular tools ---------- */}
      <section id="tools" className="wrap scroll-mt-24 py-16">
        <SectionHead
          eyebrow="All tools"
          title="Popular Tools"
          sub="Six powerful image utilities — free forever, no account needed, all running on your device."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <ToolCard
              key={t.slug}
              icon={t.icon}
              name={t.name}
              description={t.description}
              href={toolHref(t.slug)}
              badge={t.batch ? 'Batch + ZIP' : undefined}
            />
          ))}
        </div>
      </section>

      {/* ---------- Phase 2 tools ---------- */}
      <section className="wrap pb-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">New — Phase 2</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">More Tools, Same Privacy</h2>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS_PHASE2.map((t) => (
            <ToolCard
              key={t.slug}
              icon={t.icon}
              name={t.name}
              description={t.description}
              href={toolHref(t.slug)}
              badge={t.batch ? 'Batch + ZIP' : undefined}
            />
          ))}
        </div>
      </section>

      {/* ---------- Batch processing ---------- */}
      <section id="batch" className="scroll-mt-24 bg-indigo-50/60 py-16">
        <div className="wrap">
          <SectionHead
            eyebrow="Batch processing"
            title="Process Multiple Images at Once"
            sub="Upload a whole folder, apply one setting to everything, then download a single ZIP."
          />
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
            {TOOLS.filter((t) => t.batch).map((t) => (
              <Link
                key={t.slug}
                href={toolHref(t.slug)}
                className="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                  <Icon name={t.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900">{t.name}</span>
                  <span className="block text-xs text-gray-500">Multi-upload · Download All as ZIP</span>
                </span>
                <span className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                  <Icon name="stack" className="h-3 w-3" />
                  Batch
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="wrap scroll-mt-24 py-16">
        <SectionHead eyebrow="How it works" title="From Upload to Download in Seconds" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
                {s.n}
              </span>
              <h3 className="mt-4 text-base font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Privacy ---------- */}
      <section id="privacy" className="scroll-mt-24 bg-white py-16">
        <div className="wrap grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Privacy</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Your Images, Your Privacy</h2>
            <p className="mt-4 text-gray-600">
              ImageTool Studio is built privacy-first: every tool runs directly in your browser using the Canvas API and
              WebAssembly. There are no uploads, no accounts, and nothing to delete later — because nothing is ever stored.
            </p>
            <ul className="mt-6 space-y-3">
              {PRIVACY_BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
            <PrivacyNotice />
            <p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-relaxed text-gray-600 shadow-sm">
              <strong className="text-gray-800">Honest labeling:</strong> the Background Remover downloads a small AI model on
              first use so it can run offline afterwards — your images still never leave your device. Any future tool that
              requires a server will say so clearly.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- About ---------- */}
      <section id="about" className="wrap scroll-mt-24 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHead
            eyebrow="About"
            title="Built for Everyday Image Work"
            sub="ImageTool Studio is a free collection of fast browser-based image utilities for creators, developers, marketers, and anyone tired of slow upload-wait-download websites. No accounts, no watermarks, no tracking of your files — just tools that work."
          />
          <Link href="#tools" className={`${btnClass('primary', 'lg')} mt-8`}>
            Start Editing — It&rsquo;s Free
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
