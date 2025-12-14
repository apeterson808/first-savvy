import React from 'react';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { format, subMonths } from 'date-fns';

export default function ComparisonPeriodDropdown({ 
  value, 
  onValueChange, 
  triggerClassName = "h-8 text-xs gap-1 whitespace-nowrap max-w-[130px] hover:bg-slate-50"
}) {
  const currentYear = new Date().getFullYear();

  return (
    <ClickThroughSelect value={value} onValueChange={onValueChange} triggerClassName={triggerClassName}>
      <ClickThroughSelectItem value="avg3" className="text-xs">vs. Avg (3 mo)</ClickThroughSelectItem>
      <ClickThroughSelectItem value="avg6" className="text-xs">vs. Avg (6 mo)</ClickThroughSelectItem>
      <ClickThroughSelectItem value="avg12" className="text-xs">vs. Avg (12 mo)</ClickThroughSelectItem>
      <ClickThroughSelectItem value="avgAll" className="text-xs">vs. Avg (All time)</ClickThroughSelectItem>
      {Array.from({ length: 12 }, (_, i) => {
        const date = subMonths(new Date(), i + 1);
        const isCurrentYear = date.getFullYear() === currentYear;
        return (
          <ClickThroughSelectItem key={i + 1} value={(i + 1).toString()} className="text-xs">
            vs. {isCurrentYear ? format(date, 'MMMM') : format(date, 'MMMM yyyy')}
          </ClickThroughSelectItem>
        );
      })}
    </ClickThroughSelect>
  );
}