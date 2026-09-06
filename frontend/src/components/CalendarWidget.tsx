import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ClockIcon,
  XIcon,
  CheckIcon,
} from '@phosphor-icons/react';

interface CalendarWidgetProps {
  value?: string; // ISO string or empty string
  onChange: (isoString: string) => void;
  className?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarWidget({ value, onChange, className }: CalendarWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value or use current date as reference
  const selectedDate = value ? new Date(value) : null;
  const now = new Date();

  // Navigation state (month/year offset from selected or current date)
  const [navYear, setNavYear] = useState<number | null>(null);
  const [navMonth, setNavMonth] = useState<number | null>(null);

  const currentYear = navYear ?? (selectedDate ? selectedDate.getFullYear() : now.getFullYear());
  const currentMonth = navMonth ?? (selectedDate ? selectedDate.getMonth() : now.getMonth());

  const hours = selectedDate ? selectedDate.getHours() : 23;
  const minutes = selectedDate ? selectedDate.getMinutes() : 59;

  // Click outside to close popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Get days in month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    const d = new Date(currentYear, currentMonth - 1, 1);
    setNavYear(d.getFullYear());
    setNavMonth(d.getMonth());
  };

  const handleNextMonth = () => {
    const d = new Date(currentYear, currentMonth + 1, 1);
    setNavYear(d.getFullYear());
    setNavMonth(d.getMonth());
  };

  const handleDaySelect = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day, hours, minutes, 0, 0);
    onChange(newDate.toISOString());
  };

  const handleTimeChange = (newHours: number, newMinutes: number) => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    base.setFullYear(currentYear);
    base.setMonth(currentMonth);
    if (!selectedDate) {
      base.setDate(now.getDate());
    }
    base.setHours(newHours);
    base.setMinutes(newMinutes);
    base.setSeconds(0);
    base.setMilliseconds(0);
    onChange(base.toISOString());
  };

  const applyPreset = (durationHours: number) => {
    const d = new Date();
    d.setTime(d.getTime() + durationHours * 60 * 60 * 1000);
    setNavYear(d.getFullYear());
    setNavMonth(d.getMonth());
    onChange(d.toISOString());
    setIsOpen(false);
  };

  const clearExpiry = () => {
    setNavYear(null);
    setNavMonth(null);
    onChange('');
    setIsOpen(false);
  };

  // Helper to test if a day is today
  const isToday = (day: number) => {
    return (
      now.getFullYear() === currentYear &&
      now.getMonth() === currentMonth &&
      now.getDate() === day
    );
  };

  // Helper to test if a day is in the past
  const isPastDay = (day: number) => {
    const d = new Date(currentYear, currentMonth, day, 23, 59, 59);
    return d < now;
  };

  // Helper to test if a day is selected
  const isSelectedDay = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === currentYear &&
      selectedDate.getMonth() === currentMonth &&
      selectedDate.getDate() === day
    );
  };

  // Format display string
  const formatSelected = () => {
    if (!selectedDate) return 'Permanent (No expiry)';
    return selectedDate.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className={cn('space-y-3', className)} ref={containerRef}>
      {/* Quick TTL Preset Pills */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[11px] text-muted-foreground mr-1">Quick Presets:</span>
        <button
          type="button"
          onClick={() => applyPreset(1)}
          className="px-2 py-0.5 rounded-lg border text-[11px] hover:bg-muted font-medium transition-colors cursor-pointer"
        >
          +1 Hour
        </button>
        <button
          type="button"
          onClick={() => applyPreset(24)}
          className="px-2 py-0.5 rounded-lg border text-[11px] hover:bg-muted font-medium transition-colors cursor-pointer"
        >
          +24 Hours
        </button>
        <button
          type="button"
          onClick={() => applyPreset(24 * 7)}
          className="px-2 py-0.5 rounded-lg border text-[11px] hover:bg-muted font-medium transition-colors cursor-pointer"
        >
          +7 Days
        </button>
        <button
          type="button"
          onClick={() => applyPreset(24 * 30)}
          className="px-2 py-0.5 rounded-lg border text-[11px] hover:bg-muted font-medium transition-colors cursor-pointer"
        >
          +30 Days
        </button>
        {value && (
          <button
            type="button"
            onClick={clearExpiry}
            className="px-2 py-0.5 rounded-lg border border-destructive/30 text-destructive text-[11px] hover:bg-destructive/10 font-medium transition-colors flex items-center gap-1 cursor-pointer"
          >
            <XIcon className="size-3" />
            <span>Never (Permanent)</span>
          </button>
        )}
      </div>

      {/* Trigger Button & Popover Container */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className={cn(
              'flex-1 flex items-center justify-between px-3 py-2 text-xs border rounded-lg bg-background text-foreground transition-colors hover:bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer',
              value && 'border-primary/50'
            )}
          >
            <div className="flex items-center gap-2">
              <CalendarBlankIcon className="size-4 text-muted-foreground" />
              <span className={cn(!value && 'text-muted-foreground')}>
                {formatSelected()}
              </span>
            </div>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {isOpen ? 'Close Calendar' : 'Select Date & Time'}
            </span>
          </button>

          {value && (
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={clearExpiry}
              title="Clear expiration date"
              className="shrink-0"
            >
              <XIcon className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Dropdown Calendar Popover */}
        {isOpen && (
          <div className="absolute left-0 top-full mt-2 z-50 w-full sm:w-80 p-4 border bg-popover text-popover-foreground shadow-xl rounded-2xl space-y-4 animate-in fade-in zoom-in-95">
            {/* Header: Month and Year navigation */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs font-mono">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                >
                  <CaretLeftIcon className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                >
                  <CaretRightIcon className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono text-muted-foreground">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar Day Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {/* Padding days from previous month */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="p-1.5" />
              ))}

              {/* Days in current month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const past = isPastDay(day);
                const selected = isSelectedDay(day);
                const today = isToday(day);

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={past}
                    onClick={() => handleDaySelect(day)}
                    className={cn(
                      'p-1.5 text-xs font-mono rounded-lg transition-colors relative',
                      past && 'text-muted-foreground/40 cursor-not-allowed line-through',
                      !past && !selected && 'hover:bg-muted text-foreground cursor-pointer',
                      today && !selected && 'border border-primary/40 font-bold',
                      selected && 'bg-primary text-primary-foreground font-bold shadow-sm'
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Time Picker Controls */}
            <div className="pt-3 border-t space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium">
                  <ClockIcon className="size-3.5" />
                  <span>Time Selection (HH:MM)</span>
                </span>
                <span className="text-[10px] font-mono">
                  {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1">
                  <label htmlFor="calendar-hours" className="text-[10px] font-mono text-muted-foreground">Hour:</label>
                  <select
                    id="calendar-hours"
                    value={hours}
                    onChange={(e) => handleTimeChange(Number(e.target.value), minutes)}
                    className="w-full text-xs p-1 border rounded-lg bg-background font-mono"
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 flex items-center gap-1">
                  <label htmlFor="calendar-minutes" className="text-[10px] font-mono text-muted-foreground">Min:</label>
                  <select
                    id="calendar-minutes"
                    value={minutes}
                    onChange={(e) => handleTimeChange(hours, Number(e.target.value))}
                    className="w-full text-xs p-1 border rounded-lg bg-background font-mono"
                  >
                    {[0, 15, 30, 45, 59].map((m) => (
                      <option key={m} value={m}>
                        :{String(m).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t gap-2 text-xs">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={clearExpiry}
                className="text-muted-foreground hover:text-destructive"
              >
                Reset (Never)
              </Button>
              <Button
                type="button"
                variant="default"
                size="xs"
                onClick={() => setIsOpen(false)}
                className="gap-1"
              >
                <CheckIcon className="size-3" />
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
