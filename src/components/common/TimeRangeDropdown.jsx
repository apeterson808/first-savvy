import React from 'react';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';

export default function TimeRangeDropdown({ 
  value, 
  onValueChange, 
  triggerClassName = "w-28 h-8 text-xs hover:bg-slate-50"
}) {
  return (
    <ClickThroughSelect value={value} onValueChange={onValueChange} triggerClassName={triggerClassName}>
      <ClickThroughSelectItem value="ytd" className="text-xs">YTD</ClickThroughSelectItem>
      <ClickThroughSelectItem value="1" className="text-xs">1 Month</ClickThroughSelectItem>
      <ClickThroughSelectItem value="3" className="text-xs">3 Month</ClickThroughSelectItem>
      <ClickThroughSelectItem value="6" className="text-xs">6 Month</ClickThroughSelectItem>
      <ClickThroughSelectItem value="12" className="text-xs">12 Month</ClickThroughSelectItem>
      <ClickThroughSelectItem value="all" className="text-xs">All Time</ClickThroughSelectItem>
    </ClickThroughSelect>
  );
}