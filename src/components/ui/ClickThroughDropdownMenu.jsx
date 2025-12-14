import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '@/lib/utils';

export function ClickThroughDropdownMenu({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
        return;
      }
      if (triggerRef.current && !triggerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mouseup', handleClickOutside, true);
    return () => document.removeEventListener('mouseup', handleClickOutside, true);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.right - 150 // Align to right edge
      });
    }
  }, [isOpen]);

  // Find trigger and content from children
  let trigger = null;
  let content = null;

  React.Children.forEach(children, (child) => {
    if (child?.type === ClickThroughDropdownMenuTrigger) {
      trigger = child;
    } else if (child?.type === ClickThroughDropdownMenuContent) {
      content = child;
    }
  });

  return (
    <>
      <div ref={triggerRef}>
        {trigger && React.cloneElement(trigger, { 
          onClick: () => setIsOpen(!isOpen) 
        })}
      </div>
      {isOpen && content && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            minWidth: '150px',
            pointerEvents: 'auto'
          }}
          className="z-[99999] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {React.cloneElement(content, { onClose: () => setIsOpen(false) })}
        </div>,
        document.body
      )}
    </>
  );
}

export function ClickThroughDropdownMenuTrigger({ children, onClick, asChild }) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { onClick });
  }
  return <button onClick={onClick}>{children}</button>;
}

export function ClickThroughDropdownMenuContent({ children, onClose }) {
  return (
    <>
      {React.Children.map(children, (child) => {
        if (child?.type === ClickThroughDropdownMenuItem) {
          return React.cloneElement(child, { onClose });
        }
        return child;
      })}
    </>
  );
}

export function ClickThroughDropdownMenuItem({ children, onClick, onClose, className }) {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.();
    onClose?.();
  };

  return (
    <div
      onMouseDown={handleClick}
      onClick={handleClick}
      onPointerDown={handleClick}
      style={{ pointerEvents: 'auto' }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none",
        "hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}