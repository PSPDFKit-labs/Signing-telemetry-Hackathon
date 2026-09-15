'use client';

import { Calendar as CalendarIcon } from '@react-zero-ui/icon-sprite';
import { format } from 'date-fns';
import DatePicker from 'react-datepicker';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

// Import react-datepicker styles
import 'react-datepicker/dist/react-datepicker.css';

export interface ReactDatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
}

function CustomHeader({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }: any) {
  return (
    <div className="flex items-center justify-between px-2 py-1">
      <button
        onClick={decreaseMonth}
        disabled={prevMonthButtonDisabled}
        type="button"
        className="p-1 rounded-md border border-input hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24">
          <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>
      <h2 className="text-sm font-medium">{format(date, 'MMMM yyyy')}</h2>
      <button
        onClick={increaseMonth}
        disabled={nextMonthButtonDisabled}
        type="button"
        className="p-1 rounded-md border border-input hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24">
          <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </button>
    </div>
  );
}

export function ReactDatePickerCustom({
  date,
  setDate,
  id,
  className,
  disabled = false,
  placeholder = 'Pick a date',
  minDate,
  maxDate,
}: ReactDatePickerProps) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            disabled={disabled}
            variant={'outline'}
            className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <DatePicker
            selected={date}
            onChange={(date: Date | null) => setDate(date || undefined)}
            inline
            minDate={minDate}
            maxDate={maxDate}
            renderCustomHeader={CustomHeader}
            calendarClassName="bg-background border-none shadow-none"
            dayClassName={(_date) =>
              cn(
                'rounded-md hover:bg-accent hover:text-accent-foreground',
                'h-8 w-8 inline-flex items-center justify-center text-sm',
              )
            }
            wrapperClassName="w-full"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Simple version that follows the API of your current date picker
export function ReactDatePicker({ date, setDate, id, className }: ReactDatePickerProps) {
  return (
    <DatePicker
      selected={date}
      onChange={(date: Date | null) => setDate(date || undefined)}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      id={id}
      dateFormat="MMMM d, yyyy"
    />
  );
}
