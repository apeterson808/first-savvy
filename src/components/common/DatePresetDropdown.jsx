import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DatePresetDropdown({ 
  value, 
  onValueChange, 
  triggerClassName = "w-full hover:bg-slate-50"
}) {
  const presets = [
    { value: 'all', label: 'All dates' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7', label: 'Last 7 days' },
    { value: 'last30', label: 'Last 30 days' },
    { value: 'last3months', label: 'Last 3 months' },
    { value: 'last6months', label: 'Last 6 months' },
    { value: 'last12months', label: 'Last 12 months' },
    { value: 'mtd', label: 'MTD (Month to Date)' },
    { value: 'qtd', label: 'QTD (Quarter to Date)' },
    { value: 'ytd', label: 'YTD (Year to Date)' },
    { value: 'thisMonth', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: 'thisQuarter', label: 'This quarter' },
    { value: 'thisYear', label: 'This year' },
    { value: 'custom', label: 'Custom range' }
  ];

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {presets.map(preset => (
          <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}