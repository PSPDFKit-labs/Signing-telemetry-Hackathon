import { ArrowDown, ArrowUp } from '@react-zero-ui/icon-sprite';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: ReactNode;
  description: string;
  href?: string;
}

export function MetricCard({ title, value, change, trend, icon, description, href }: MetricCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</h3>
        <div className="rounded-full bg-zinc-100 p-2 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{icon}</div>
      </div>

      <div className="mt-4">
        <p className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">{value}</p>

        <div className="mt-2 flex items-center">
          <span
            className={cn(
              'mr-2 inline-flex items-center text-xs font-medium',
              trend === 'up'
                ? 'text-green-600 dark:text-green-400'
                : trend === 'down'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-zinc-600 dark:text-zinc-400',
            )}
          >
            {trend === 'up' && <ArrowUp className="mr-1 h-3 w-3" />}
            {trend === 'down' && <ArrowDown className="mr-1 h-3 w-3" />}
            {change}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{description}</span>
        </div>
      </div>

      {/* Decorative gradient background */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 h-1',
          trend === 'up'
            ? 'bg-gradient-to-r from-green-200 to-green-500'
            : trend === 'down'
              ? 'bg-gradient-to-r from-red-200 to-red-500'
              : 'bg-gradient-to-r from-blue-200 to-blue-500',
        )}
      />
    </>
  );

  const className = cn(
    'relative block overflow-hidden rounded-lg border border-zinc-200/70 bg-white p-4 transition-all sm:p-6 dark:border-zinc-800/50 dark:bg-zinc-950',
    href && 'cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700',
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
