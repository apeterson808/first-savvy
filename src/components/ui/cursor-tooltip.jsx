import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

export function CursorTooltip({ children, content, className }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef(null);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseEnter = (e) => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      handleMouseMove(e);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            "fixed z-50 overflow-hidden rounded-md bg-white px-2 py-1 text-xs font-light text-black shadow-lg border border-gray-200 pointer-events-none",
            className
          )}
          style={{
            left: `${position.x + 15}px`,
            top: `${position.y + 15}px`,
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
