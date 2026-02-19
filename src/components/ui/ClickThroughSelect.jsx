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
  onSearchTermChange,
  disabled = false
}) {
  const dropdownId = useId();
  const { registerDropdown, openDropdownId } = useDropdownContext();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || defaultValue || '');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const triggerInputRef = useRef(null);
  const isSelectingRef = useRef(false);
  const isCancelingRef = useRef(false);
  const originalValueRef = useRef(selectedValue);
  const itemRefs = useRef({});

  const handleOpenChange = (open) => {
    setIsOpen(open);
    registerDropdown(dropdownId, open);
    onOpenChange?.(open);
    if (open) {
      originalValueRef.current = selectedValue;
      setHighlightedIndex(-1);
    }
    if (!open) {
      setIsEditing(false);
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
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
      originalValueRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownMaxHeight = 208;

        const shouldOpenUpward = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;

        setDropdownPosition({
          top: shouldOpenUpward ? rect.top - dropdownMaxHeight - 4 : rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    };

    updatePosition();

    let scrollRafId = null;
    const handleScroll = () => {
      if (scrollRafId) {
        cancelAnimationFrame(scrollRafId);
      }
      scrollRafId = requestAnimationFrame(() => {
        updatePosition();
      });
    };

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

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
      if (scrollRafId) {
        cancelAnimationFrame(scrollRafId);
      }
    };
  }, [isOpen]);

  const handleSelect = (val, isAction) => {
    isSelectingRef.current = true;
    if (!isAction) {
      setSelectedValue(val);
      originalValueRef.current = val;
    }
    onValueChange?.(val);
    handleOpenChange(false);
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 100);
  };

  const options = extractOptions(children);
  const selectedOption = options.find(opt => opt.props.value === selectedValue && !opt.props.isAction);
  const displayText = selectedOption
    ? (selectedOption.props['data-display'] || getDisplayText(selectedOption.props.children))
    : placeholder;

  const getVisibleItems = () => {
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
    return flatChildren.filter(child => {
      if (!isSelectItem(child)) return false;
      const displayText = child.props['data-display'] || getDisplayText(child.props.children);
      return !enableSearch || !isEditing || !searchTerm ||
        displayText.toLowerCase().includes(searchTerm.toLowerCase()) ||
        child.props.isRecommended;
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const visibleItems = getVisibleItems();
      if (visibleItems.length === 0) return;

      const newIndex = highlightedIndex < visibleItems.length - 1 ? highlightedIndex + 1 : 0;
      setHighlightedIndex(newIndex);

      const itemValue = visibleItems[newIndex]?.props?.value;
      if (itemValue && itemRefs.current[itemValue]) {
        itemRefs.current[itemValue].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const visibleItems = getVisibleItems();
      if (visibleItems.length === 0) return;

      const newIndex = highlightedIndex > 0 ? highlightedIndex - 1 : visibleItems.length - 1;
      setHighlightedIndex(newIndex);

      const itemValue = visibleItems[newIndex]?.props?.value;
      if (itemValue && itemRefs.current[itemValue]) {
        itemRefs.current[itemValue].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isCancelingRef.current = true;
      setSelectedValue(originalValueRef.current);
      if (originalValueRef.current !== selectedValue) {
        onValueChange?.(originalValueRef.current);
      }
      setSearchTerm('');
      handleOpenChange(false);
      triggerInputRef.current?.blur();
      setTimeout(() => {
        isCancelingRef.current = false;
      }, 200);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const visibleItems = getVisibleItems();

      if (highlightedIndex >= 0 && visibleItems[highlightedIndex]) {
        e.preventDefault();
        const highlightedItem = visibleItems[highlightedIndex];
        handleSelect(highlightedItem.props.value, highlightedItem.props.isAction);
        return;
      }

      if (searchTerm === '') {
        // For Tab, allow natural focus movement
        if (e.key === 'Tab') {
          handleOpenChange(false);
          return;
        }
        // For Enter, prevent default and close
        e.preventDefault();
        handleOpenChange(false);
        triggerInputRef.current?.blur();
        return;
      }

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
      const nonActionItems = visibleItems.filter(child => !child.props.isAction);

      const exactMatch = nonActionItems.find(child => {
        const displayText = child.props['data-display'] || getDisplayText(child.props.children);
        return displayText.toLowerCase() === searchTerm.toLowerCase();
      });

      const actionItems = flatChildren.filter(child =>
        isSelectItem(child) && child.props.isAction
      );

      if (exactMatch) {
        handleSelect(exactMatch.props.value, false);
      } else if (nonActionItems.length === 1) {
        handleSelect(nonActionItems[0].props.value, false);
      } else if (searchTerm && actionItems.length > 0) {
        handleSelect(actionItems[0].props.value, true);
      } else if (nonActionItems.length > 0) {
        handleSelect(nonActionItems[0].props.value, false);
      }
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      if (searchTerm === '') {
        setSelectedValue('');
        onValueChange?.('');
      }
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {name && (
        <input
          type="hidden"
          name={name}
          value={selectedValue || ''}
        />
      )}

      {enableSearch ? (
        <div
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs",
            "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            triggerClassName
          )}
          style={{ pointerEvents: 'auto' }}
        >
          <input
            ref={triggerInputRef}
            type="text"
            disabled={disabled}
            value={isEditing ? searchTerm : displayText}
            onChange={(e) => {
              if (disabled) return;
              setSearchTerm(e.target.value);
              onSearchTermChange?.(e.target.value);
              setHighlightedIndex(-1);
              if (!isOpen) {
                handleOpenChange(true);
              }
              setIsEditing(true);
            }}
            onFocus={() => {
              if (disabled) return;
              setIsEditing(true);
              const options = extractOptions(children);
              const currentOption = options.find(opt => opt.props.value === selectedValue && !opt.props.isAction);
              const currentDisplayText = currentOption
                ? (currentOption.props['data-display'] || getDisplayText(currentOption.props.children))
                : '';
              setSearchTerm(currentDisplayText !== placeholder ? currentDisplayText : '');
              if (!isOpen) {
                handleOpenChange(true);
              }
              setTimeout(() => {
                triggerInputRef.current?.select();
              }, 0);
            }}
            onBlur={() => {
              setTimeout(() => {
                if (!isSelectingRef.current && !isCancelingRef.current && isEditing && searchTerm === '') {
                  setSelectedValue('');
                  onValueChange?.('');
                }
                setIsEditing(false);
              }, 150);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "flex-1 min-w-0 bg-transparent outline-none border-none",
              !isEditing && displayText === placeholder && "text-slate-400"
            )}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          />
          <ChevronDown
            className={cn("h-3 w-3 opacity-50 ml-1 flex-shrink-0 transition-transform cursor-pointer", isOpen && "rotate-180")}
            onClick={() => {
              if (isOpen) {
                handleOpenChange(false);
                triggerInputRef.current?.blur();
              } else {
                handleOpenChange(true);
                triggerInputRef.current?.focus();
              }
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) {
              handleOpenChange(!isOpen);
            }
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          style={{ pointerEvents: 'auto' }}
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
      )}

      {isOpen && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            minWidth: Math.max(dropdownPosition.width, 160),
            zIndex: 999999,
            pointerEvents: 'auto'
          }}
          className="rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className="overflow-y-auto overflow-x-hidden p-1"
            style={{
              maxHeight: '200px',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch'
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
          >
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
              let visibleItemIndex = 0;

              return flatChildren.map((child, index) => {
                if (!child) return null;

                if (isSelectItem(child)) {
                  const childText = child.props['data-display'] || getDisplayText(child.props.children);
                  const matchesSearch = !enableSearch || !isEditing || !searchTerm ||
                    childText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    child.props.isAction ||
                    child.props.isRecommended;

                  if (!matchesSearch) return null;

                  const currentVisibleIndex = visibleItemIndex;
                  visibleItemIndex++;

                  return React.cloneElement(child, {
                    key: child.props.value || index,
                    isSelected: child.props.value === selectedValue,
                    isHighlighted: currentVisibleIndex === highlightedIndex,
                    onSelect: (val, isAction) => handleSelect(val, isAction || child.props.isAction),
                    onMouseEnter: () => setHighlightedIndex(currentVisibleIndex),
                    ref: (el) => {
                      if (el && child.props.value) {
                        itemRefs.current[child.props.value] = el;
                      }
                    }
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

export const ClickThroughSelectItem = React.forwardRef(({ value, children, className, isSelected, isHighlighted, onSelect, onMouseEnter, isAction }, ref) => {
  return (
    <div
      ref={ref}
      data-click-through-select-item="true"
      data-is-action={isAction ? "true" : undefined}
      data-value={value}
      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseEnter={onMouseEnter}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect?.(value, isAction);
      }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-xs outline-none",
        "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent/50",
        isHighlighted && "bg-accent text-accent-foreground",
        className
      )}
    >
      {children}
    </div>
  );
});
ClickThroughSelectItem.displayName = 'ClickThroughSelectItem';

export function ClickThroughSelectSeparator() {
  return <div className="h-px bg-slate-200 my-1" data-click-through-select-separator="true" />;
}
ClickThroughSelectSeparator.displayName = 'ClickThroughSelectSeparator';
