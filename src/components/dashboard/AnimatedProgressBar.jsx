import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';

export default function AnimatedProgressBar({ item }) {
  const IconComponent = item.icon && Icons[item.icon] ? Icons[item.icon] : Icons.Circle;
  const displayPercentage = Math.min(item.percentage, 100);

  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(displayPercentage);
    }, 50);
    return () => clearTimeout(timer);
  }, [displayPercentage]);

  return (
    <div className="group relative">
      <div className="relative h-9 rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: item.bgColor }}>
        <div
          className="absolute left-0 top-0 h-full transition-all duration-700 ease-out rounded-2xl"
          style={{
            width: `${animatedWidth}%`,
            backgroundColor: item.progressColor
          }}
        />

        <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <IconComponent className="w-4 h-4 flex-shrink-0 text-white" />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-semibold text-sm text-slate-900 truncate">
                {item.categoryName}
              </span>
              <span className="text-xs text-slate-400 font-normal flex-shrink-0">
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-slate-900">
                ${item.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-600">
                ${item.limit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
