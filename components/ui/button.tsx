'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors cursor-pointer',
          // Variant styles
          {
            'bg-blue-600 text-white hover:bg-blue-700': variant === 'default',
            'bg-transparent text-zinc-900 hover:bg-gray-100 dark:text-zinc-100 dark:hover:bg-zinc-800':
              variant === 'ghost',
            'border border-gray-300 bg-transparent text-zinc-900 hover:bg-gray-50 dark:border-gray-600 dark:text-zinc-100 dark:hover:bg-zinc-800':
              variant === 'outline',
            'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
          },
          // Size styles
          {
            'h-9 px-4 text-sm': size === 'default',
            'h-8 px-3 text-xs': size === 'sm',
            'h-11 px-8 text-base': size === 'lg',
            'h-9 w-9 p-0': size === 'icon',
          },
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export { Button };
