import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ClickThroughSelect({ 
  value, 
  defaultValue,
  onValueChange,
  onOpenChange,
  onSearchTermChange,
  children, 
  placeholder = "Select...",
  className,
  triggerClassName,
  renderValue
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleOpenChange = (open) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };
  const [selectedValue, setSelectedValue] = useState(value || defaultValue || '');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      // Allow clicks on dropdown items to propagate
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
        return;
      }
      // Close for clicks outside
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        // If search term is empty, clear the selection
        if (searchTerm === '') {
          setSelectedValue('');
          if (onValueChange) {
            onValueChange('');
          }
        }
        handleOpenChange(false);
      }
    };

    // Use mousedown without capture to let item mousedowns fire first
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, searchTerm]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
      // Pre-fill search with selected value when opening
      if (selectedValue && displayText !== placeholder) {
        setSearchTerm(displayText);
      }
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 0);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleSelect = (val, isAction) => {
    if (!isAction) {
      setSelectedValue(val);
    }
    if (onValueChange) {
      onValueChange(val);
    }
    handleOpenChange(false);
  };

  // Helper to check if child is a SelectItem
  const isSelectItem = (child) => {
    return child?.type?.displayName === 'ClickThroughSelectItem' || 
           child?.type === ClickThroughSelectItem ||
           child?.props?.['data-click-through-select-item'];
  };

  const isSeparator = (child) => {
    return child?.type?.displayName === 'ClickThroughSelectSeparator' || 
           child?.type === ClickThroughSelectSeparator ||
           child?.props?.['data-click-through-select-separator'];
  };

  // Extract options from children (including nested in fragments)
  const extractOptions = (nodes) => {
    const result = [];
    React.Children.forEach(nodes, (child) => {
      if (!child) return;
      if (child.type === React.Fragment) {
        result.push(...extractOptions(child.props.children));
      } else if (Array.isArray(child)) {
        result.push(...extractOptions(child));
      } else if (isSelectItem(child)) {
        result.push(child);
      } else if (isSeparator(child)) {
        result.push(child);
      } else if (child.props?.children) {
        // Check inside wrapper divs etc
        result.push(...extractOptions(child.props.children));
      }
    });
    return result;
  };

  const options = extractOptions(children);
  const selectedOption = options.find(opt => opt.props.value === selectedValue && !opt.props.isAction);
  
  // Get text content for display - use data-display if available, otherwise extract text
  const getDisplayText = (node) => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getDisplayText).join('');
    if (node?.props?.children) return getDisplayText(node.props.children);
    return '';
  };
  
  // Prefer data-display attribute for clean display text (without icons/badges)
  const displayText = selectedOption 
    ? (selectedOption.props['data-display'] || getDisplayText(selectedOption.props.children))
    : placeholder;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {isOpen ? (
        <div
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs",
            triggerClassName
          )}
        >
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              onSearchTermChange?.(e.target.value);
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === 'Tab') && searchTerm === '') {
                e.preventDefault();
                handleSelect('', false);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={placeholder}
            className="flex-1 min-w-0 outline-none bg-transparent text-xs"
            autoFocus
          />
          <ChevronDown 
                          className={cn("h-3 w-3 opacity-50 ml-2 flex-shrink-0 transition-transform cursor-pointer hover:opacity-100", isOpen && "rotate-180")} 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenChange(false);
                          }}
                        />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => handleOpenChange(!isOpen)}
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs",
            "focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName
          )}
        >
          <span className="flex-1 min-w-0 flex items-center">
            {renderValue ? renderValue(selectedValue, displayText) : <span className={cn("truncate", displayText === placeholder && "text-slate-400")}>{displayText}</span>}
          </span>
          <ChevronDown className={cn("h-3 w-3 opacity-50 ml-1 flex-shrink-0 transition-transform", isOpen && "rotate-180")} />
        </button>
      )}

      {isOpen && ReactDOM.createPortal(
        <div 
          ref={dropdownRef}
          style={{
                          position: 'fixed',
                          top: dropdownPosition.top,
                          left: dropdownPosition.left,
                          minWidth: Math.max(dropdownPosition.width, 160),
                          pointerEvents: 'auto',
                          zIndex: 999999999
                        }}
          className="rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <div 
            className="max-h-48 overflow-auto p-1"
            onWheel={(e) => e.stopPropagation()}
          >
            {(() => {
              const getTextContent = (node) => {
                if (typeof node === 'string') return node;
                if (typeof node === 'number') return String(node);
                if (Array.isArray(node)) return node.map(getTextContent).join('');
                if (node?.props?.children) return getTextContent(node.props.children);
                return '';
              };

              // Flatten all children recursively to handle fragments
              const flattenChildren = (nodes) => {
                const result = [];
                React.Children.forEach(nodes, (child) => {
                  if (!child) return;
                  if (child.type === React.Fragment) {
                    result.push(...flattenChildren(child.props.children));
                  } else if (Array.isArray(child)) {
                    result.push(...flattenChildren(child));
                  } else {
                    result.push(child);
                  }
                });
                return result;
              };

              const flatChildren = flattenChildren(children);

              return flatChildren.map((child, index) => {
                if (!child) return null;

                if (isSelectItem(child)) {
                  const childText = getTextContent(child.props.children);
                  const matchesSearch = !searchTerm || 
                    childText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    child.props.isAction ||
                    child.props.isRecommended;
                  if (!matchesSearch) return null;
                  return React.cloneElement(child, {
                    key: child.props.value || index,
                    isSelected: child.props.value === selectedValue,
                    onSelect: (val, isAction) => handleSelect(val, isAction || child.props.isAction)
                  });
                }
                if (isSeparator(child)) {
                  return React.cloneElement(child, { key: `sep-${index}` });
                }
                // Render other elements (like div headers) as-is
                return React.cloneElement(child, { key: `other-${index}` });
              });
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function ClickThroughSelectItem({ value, children, className, isSelected, onSelect, isAction }) {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSelect) {
      onSelect(value, isAction);
    }
  };

  return (
    <div
      data-click-through-select-item="true"
      data-is-action={isAction ? "true" : undefined}
      data-value={value}
      onMouseDown={handleClick}
      style={{ pointerEvents: 'auto', userSelect: 'none', cursor: 'pointer' }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-xs outline-none",
        "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent/50",
        className
      )}
    >
      {children}
    </div>
  );
}
ClickThroughSelectItem.displayName = 'ClickThroughSelectItem';

export function ClickThroughSelectSeparator() {
  return <div className="h-px bg-slate-200 my-1" data-click-through-select-separator="true" />;
}
ClickThroughSelectSeparator.displayName = 'ClickThroughSelectSeparator';