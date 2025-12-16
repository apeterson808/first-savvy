import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function TimeRangeDropdown({
  value,
  onValueChange,
  triggerClassName = "w-36 h-8 text-xs hover:bg-slate-50"
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-8 text-xs", triggerClassName)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ytd" className="text-xs">YTD</SelectItem>
        <SelectItem value="mtd" className="text-xs">MTD</SelectItem>
        <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
        <SelectItem value="3" className="text-xs">3 Months</SelectItem>
        <SelectItem value="6" className="text-xs">6 Months</SelectItem>
        <SelectItem value="12" className="text-xs">12 Months</SelectItem>
        <SelectItem value="all" className="text-xs">All Time</SelectItem>
      </SelectContent>
    </Select>
  );
}