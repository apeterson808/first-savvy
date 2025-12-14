import React from 'react';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { format, subMonths } from 'date-fns';

export default function MonthSelectorDropdown({ 
  value, 
  onValueChange, 
  monthsToShow = 12,
  triggerClassName = "h-8 text-xs gap-1 whitespace-nowrap max-w-[120px] hover:bg-slate-50"
}) {
  const currentYear = new Date().getFullYear();

  return (
    <ClickThroughSelect value={value} onValueChange={onValueChange} triggerClassName={triggerClassName}>
      {Array.from({ length: monthsToShow }, (_, i) => {
        const date = subMonths(new Date(), i);
        const isCurrentYear = date.getFullYear() === currentYear;
        return (
          <ClickThroughSelectItem key={i} value={i.toString()} className="text-xs">
            {isCurrentYear ? format(date, 'MMMM') : format(date, 'MMMM yyyy')}
          </ClickThroughSelectItem>
        );
      })}
    </ClickThroughSelect>
  );
}