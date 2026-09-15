import { AlertCircle, CheckSquare, Clock, FileText, MessageSquare, Users } from '@react-zero-ui/icon-sprite';
import type { ComponentType, SVGProps } from 'react';

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

import { cn } from '@/lib/utils';

interface ListItem {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconStyle: string;
  date?: string;
  time?: string;
  amount?: string;
  status: 'pending' | 'in-progress' | 'completed';
  progress?: number;
  count?: number;
}

interface List03Props {
  items?: ListItem[];
  className?: string;
}

const iconStyles = {
  action: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  waiting: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  complete: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
};

const ITEMS: ListItem[] = [
  {
    id: '1',
    title: 'Action Required',
    subtitle: 'Tasks that need your immediate attention',
    icon: AlertCircle,
    iconStyle: 'action',
    status: 'pending',
    count: 5,
  },
  {
    id: '2',
    title: 'Waiting for Others',
    subtitle: 'Tasks pending input from team members',
    icon: Clock,
    iconStyle: 'waiting',
    status: 'in-progress',
    count: 3,
  },
  {
    id: '3',
    title: 'Complete',
    subtitle: 'Tasks you&apos;ve successfully finished',
    icon: CheckSquare,
    iconStyle: 'complete',
    status: 'completed',
    count: 12,
  },
];

export default function List03({ items = ITEMS, className }: List03Props) {
  return (
    <div className={cn('scrollbar-none w-full overflow-x-auto', className)}>
      <div className="flex min-w-full gap-4 p-1">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex flex-col',
              'w-[280px] shrink-0 md:w-[300px] lg:w-[320px]',
              'bg-white dark:bg-zinc-900/70',
              'rounded-xl',
              'border-2 border-zinc-200 dark:border-zinc-700',
              'hover:border-zinc-300 dark:hover:border-zinc-600',
              'transition-all duration-200',
              'shadow-md',
            )}
          >
            <div className="space-y-3 p-4">
              {/* Header with icon, title, and count on a single line */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('rounded-lg p-2', iconStyles[item.iconStyle as keyof typeof iconStyles])}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                </div>
                {typeof item.count === 'number' && (
                  <div
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-medium',
                      iconStyles[item.iconStyle as keyof typeof iconStyles],
                    )}
                  >
                    {item.count} {item.count === 1 ? 'item' : 'items'}
                  </div>
                )}
              </div>

              <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{item.subtitle}</p>

              <div className="space-y-2 pt-2">
                {item.id === '1' && (
                  <>
                    <TaskItem icon={FileText} title="Quarterly report due" time="Due in 2 days" />
                    <TaskItem icon={Users} title="Team meeting preparation" time="Due tomorrow" />
                    <TaskItem icon={MessageSquare} title="Client feedback review" time="Due today" />
                  </>
                )}

                {item.id === '2' && (
                  <>
                    <TaskItem icon={Users} title="Design review" time="Waiting for 2 people" />
                    <TaskItem icon={FileText} title="Budget approval" time="Waiting for manager" />
                    <TaskItem icon={MessageSquare} title="Client proposal" time="Waiting for feedback" />
                  </>
                )}

                {item.id === '3' && (
                  <>
                    <TaskItem icon={FileText} title="Project proposal" time="Completed yesterday" />
                    <TaskItem icon={Users} title="Team onboarding" time="Completed last week" />
                    <TaskItem icon={MessageSquare} title="Client presentation" time="Completed today" />
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskItem({ icon: Icon, title, time }: { icon: LucideIcon; title: string; time: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <Icon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
      <div>
        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{time}</p>
      </div>
    </div>
  );
}
