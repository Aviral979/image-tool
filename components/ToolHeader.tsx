import Link from 'next/link';
import { Icon, type IconName } from './Icon';
import { Chip } from './ui';

export default function ToolHeader({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <>
      <Link
        href="/#tools"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-indigo-600"
      >
        <Icon name="arrowRight" className="h-4 w-4 rotate-180" />
        All tools
      </Link>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-gray-600">{description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip>No sign-up</Chip>
          <Chip>Processed in your browser</Chip>
          <Chip>Batch processing</Chip>
          <Chip>ZIP download</Chip>
        </div>
      </div>
    </div>
    </>
  );
}
