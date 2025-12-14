import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingFallback({ message = 'Loading...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}

export function TableLoadingFallback({ rows = 5, cols = 4 }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3 border-b border-slate-100">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 bg-slate-200 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardLoadingFallback() {
  return (
    <div className="animate-pulse p-4 border rounded-lg">
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
      <div className="h-8 bg-slate-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-slate-200 rounded w-2/3" />
    </div>
  );
}