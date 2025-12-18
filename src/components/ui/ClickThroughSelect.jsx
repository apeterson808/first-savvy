import React, { useState, useRef, useEffect, useId } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDropdownContext } from '@/contexts/DropdownContext';

export function ClickThroughSelect({
  value,
  defaultValue,
  onValueChange,
  onOpenChange,
  children,
  placeholder = "Select...",
  className,
  triggerClassName,
  renderValue,
  name,
  enableSearch = false,
  onSearchTermChange
}) {
  const dropdownId = useId();
  const { registerDropdown, openDropdownId } = useDropdownContext();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || defaultValue || '');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const handleOpenChange = (open) => {
    setIsOpen(open);
    registerDropdown(dropdownId, open);
    onOpenChange?.(open);
  };

  useEffect(() => {
    if (openDropdownId && openDropdownId !== dropdownId && isOpen) {
      setIsOpen(false);
      onOpenChange?.(false);
    }
  }, [openDropdownId, dropdownId, isOpen, onOpenChange]);

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

  const getDisplayText = (node) => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getDisplayText).join('');
    if (node?.props?.children) return getDisplayText(node.props.children);
    return '';
  };

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
        result.push(...extractOptions(child.props.children));
      }
    });
    return result;
  };

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      return;
    }

    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    };

    updatePosition();

    if (enableSearch) {
      const options = extractOptions(children);
      const currentOption = options.find(opt => opt.props.value === selectedValue && !opt.props.isAction);
      const currentDisplayText = currentOption
        ? (currentOption.props['data-display'] || getDisplayText(currentOption.props.children))
        : '';

      setSearchTerm(currentDisplayText !== placeholder ? currentDisplayText : '');

      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }, 0);
    }

    const handleClickOutside = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        handleOpenChange(false);
      }
    };

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, enableSearch]);

  const handleSelect = (val, isAction) => {
    if (!isAction) {
      setSelectedValue(val);
    }
    onValueChange?.(val);
    handleOpenChange(false);
  };

  const options = extractOptions(children);
  const selectedOption = options.find(opt => opt.props.value === selectedValue && !opt.props.isAction);
  const displayText = selectedOption
    ? (selectedOption.props['data-display'] || getDisplayText(selectedOption.props.children))
    : placeholder;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={selectedValue || ''} />}

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleOpenChange(!isOpen);
        }}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs",
          "focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName
        )}
      >
        <span className="flex-1 min-w-0 flex items-center">
          {renderValue ? renderValue(selectedValue, displayText) : (
            <span className={cn("truncate", displayText === placeholder && "text-slate-400")}>
              {displayText}
            </span>
          )}
        </span>
        <ChevronDown className={cn("h-3 w-3 opacity-50 ml-1 flex-shrink-0 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            minWidth: Math.max(dropdownPosition.width, 160),
            zIndex: 999999999
          }}
          className="rounded-md border bg-popover text-popover-foreground shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          {enableSearch && (
            <div className="p-2 border-b">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  onSearchTermChange?.(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    handleOpenChange(false);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();

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
                    const visibleItems = flatChildren.filter(child => {
                      if (!isSelectItem(child) || child.props.isAction) return false;
                      const displayText = child.props['data-display'] || getDisplayText(child.props.children);
                      return !searchTerm || displayText.toLowerCase().includes(searchTerm.toLowerCase()) || child.props.isRecommended;
                    });

                    const exactMatch = visibleItems.find(child => {
                      const displayText = child.props['data-display'] || getDisplayText(child.props.children);
                      return displayText.toLowerCase() === searchTerm.toLowerCase();
                    });

                    if (exactMatch) {
                      handleSelect(exactMatch.props.value, false);
                    } else if (visibleItems.length === 1) {
                      handleSelect(visibleItems[0].props.value, false);
                    } else {
                      const actionItems = flatChildren.filter(child =>
                        isSelectItem(child) && child.props.isAction
                      );
                      if (actionItems.length > 0 && searchTerm) {
                        handleSelect(actionItems[0].props.value, true);
                      } else if (visibleItems.length > 0) {
                        handleSelect(visibleItems[0].props.value, false);
                      }
                    }
                  }
                }}
                placeholder="Search..."
                className="w-full px-2 py-1 text-xs border rounded outline-none"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-48 overflow-auto p-1">
            {(() => {
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
                  const childText = getDisplayText(child.props.children);
                  const matchesSearch = !enableSearch || !searchTerm ||
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
  return (
    <div
      data-click-through-select-item="true"
      data-is-action={isAction ? "true" : undefined}
      data-value={value}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect?.(value, isAction);
      }}
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
