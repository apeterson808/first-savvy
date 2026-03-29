import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';

export default function MonthSelectorArrows({ value, onValueChange }) {
  const monthsOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: i === 0 ? format(new Date(), 'MMMM') : format(subMonths(new Date(), i), 'MMMM'),
  }));

  const currentIndex = monthsOptions.findIndex(opt => opt.value === value);
  const canGoPrevious = currentIndex < monthsOptions.length - 1;
  const canGoNext = currentIndex > 0;

  const handlePrevious = () => {
    if (canGoPrevious) {
      onValueChange(monthsOptions[currentIndex + 1].value);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onValueChange(monthsOptions[currentIndex - 1].value);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 bg-white h-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePrevious}
        disabled={!canGoPrevious}
        className="h-5 w-5 p-0 disabled:opacity-30 hover:bg-slate-100"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <span className="min-w-[60px] text-center text-xs font-medium">
        {monthsOptions[currentIndex]?.label || 'Month'}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleNext}
        disabled={!canGoNext}
        className="h-5 w-5 p-0 disabled:opacity-30 hover:bg-slate-100"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
