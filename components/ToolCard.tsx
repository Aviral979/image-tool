import Link from 'next/link';
import { Icon, type IconName } from './Icon';
import { Card, Chip } from './ui';

export default function ToolCard({
  icon,
  name,
  description,
  href,
  badge,
}: {
  icon: IconName;
  name: string;
  description: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link href={href} className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-2xl">
      <Card className="relative h-full p-5 transition group-hover:-translate-y-0.5 group-hover:border-indigo-200 group-hover:shadow-md">
        {badge && (
          <span className="absolute right-4 top-4">
            <Chip tone="indigo">{badge}</Chip>
          </span>
        )}
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-base font-semibold text-gray-900">{name}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{description}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600">
          Open Tool
          <Icon name="arrowRight" className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </Card>
    </Link>
  );
}
