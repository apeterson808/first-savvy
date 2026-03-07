import React, { useState, useRef, useEffect } from 'react';
import { formatAccountingAmount } from '@/utils/cadenceUtils';
import { Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function InlineEditableAmount({
  value,
  cadence,
  isActiveCadence,
  onUpdate,
  isLoading = false,
  hasBorder = false,
  isMonthlyColumn = false,
  disabled = false,
  className = '',
  isSuggested = false
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Only select all if the value is 0.00
      if (value === 0) {
        inputRef.current.select();
      }
    }
  }, [isEditing, value]);

  const handleClick = () => {
    if (isLoading || disabled) return;
    // Start with 0.00 for calculator-style input
    setInputValue('0.00');
    setIsEditing(true);
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleKeyDown = (e) => {
    // Handle backspace to remove last digit
    if (e.key === 'Backspace') {
      e.preventDefault();
      const cleanValue = inputValue.replace(/,/g, '');
      const cents = Math.round(parseFloat(cleanValue) * 100);
      const newCents = Math.floor(cents / 10);
      const newAmount = newCents / 100;
      const formatted = newAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      setInputValue(formatted);
      return;
    }

    // Handle numeric input (0-9)
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const digit = parseInt(e.key);
      const cleanValue = inputValue.replace(/,/g, '');
      const cents = Math.round(parseFloat(cleanValue) * 100);
      const newCents = (cents * 10) + digit;
      const newAmount = newCents / 100;
      const formatted = newAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      setInputValue(formatted);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue('');
    }
  };

  const handleSave = async () => {
    const cleanValue = inputValue.replace(/,/g, '');
    const numericValue = parseFloat(cleanValue);

    if (isNaN(numericValue) || numericValue < 0) {
      setIsEditing(false);
      setInputValue('');
      return;
    }

    if (Math.abs(numericValue - value) < 0.01) {
      setIsEditing(false);
      setInputValue('');
      return;
    }

    setIsEditing(false);
    await onUpdate(numericValue, cadence);
    setInputValue('');
  };

  const handleInputChange = (e) => {
    // Calculator-style input is handled in keyDown
    // This is just for paste/other input events
    const value = e.target.value;
    const cleanValue = value.replace(/,/g, '');

    if (cleanValue === '' || /^\d*\.?\d{0,2}$/.test(cleanValue)) {
      const numericValue = parseFloat(cleanValue) || 0;
      const formatted = numericValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      setInputValue(formatted);
    }
  };

  const isZero = value === 0;
  const formatted = formatAccountingAmount(value);

  if (isEditing) {
    return (
      <td className={`text-center ${isMonthlyColumn ? 'bg-slate-50/50' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full text-center bg-transparent px-4 py-0 focus:outline-none tabular-nums border-0"
        />
      </td>
    );
  }

  const cellContent = (
    <td
      className={`text-center ${disabled ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50/70'} transition-colors ${
        isLoading ? 'opacity-50' : ''
      } ${isMonthlyColumn ? 'bg-slate-50/50' : ''} ${className}`}
      onClick={handleClick}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 px-4">
          <Loader2 className="h-3 w-3 animate-spin" />
          <div className={`inline-flex items-center gap-1 tabular-nums ${isMonthlyColumn ? 'font-medium' : ''}`}>
            <span>{formatted.sign}</span>
            <span>{formatted.amount}</span>
          </div>
        </div>
      ) : (
        <div className={`inline-flex items-center gap-1 tabular-nums text-sm ${isMonthlyColumn ? 'font-medium' : ''}`}>
          <span>{formatted.sign}</span>
          <span>{formatted.amount}</span>
        </div>
      )}
    </td>
  );

  if (isSuggested) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            {cellContent}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Suggested amount based on historical spending</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cellContent;
}
