import React, { useState, useRef, useEffect } from 'react';
import { formatAccountingAmount, convertCadence } from '@/utils/cadenceUtils';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CADENCE_LABELS = {
  daily: '/day',
  weekly: '/wk',
  monthly: '/mo',
  yearly: '/yr'
};

const CADENCE_CYCLE = ['daily', 'weekly', 'monthly', 'yearly'];

export default function InlineEditableAmountWithCadence({
  suggestedAmount = 0,
  currentAmount = null,
  currentCadence = 'monthly',
  onAmountChange,
  onEnter,
  isLoading = false,
  hasBorder = false
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedCadence, setSelectedCadence] = useState(currentCadence);
  const inputRef = useRef(null);

  // Determine display amount and cadence
  const displayAmount = currentAmount !== null ? currentAmount : suggestedAmount;
  const displayCadence = currentCadence || 'monthly';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Auto-select all text if there's an actual amount (not 0.00)
      if (displayAmount !== 0) {
        inputRef.current.select();
      }
    }
  }, [isEditing, displayAmount]);

  const handleClick = () => {
    if (isLoading) return;
    // Start with 0.00 for calculator-style input
    setInputValue('0.00');
    setSelectedCadence(displayCadence);
    setIsEditing(true);
  };

  const handleBlur = (e) => {
    // Don't close if clicking on the cadence button
    if (e.relatedTarget && e.relatedTarget.closest('[data-cadence-button]')) {
      return;
    }
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
      if (onEnter) {
        const cleanValue = inputValue.replace(/,/g, '');
        const numericValue = parseFloat(cleanValue);
        if (!isNaN(numericValue) && numericValue >= 0) {
          onEnter(numericValue, selectedCadence);
          setIsEditing(false);
          setInputValue('');
        }
      } else {
        handleSave();
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue('');
      setSelectedCadence(displayCadence);
    }
  };

  const handleSave = () => {
    const cleanValue = inputValue.replace(/,/g, '');
    const numericValue = parseFloat(cleanValue);

    if (isNaN(numericValue) || numericValue < 0) {
      setIsEditing(false);
      setInputValue('');
      setSelectedCadence(displayCadence);
      return;
    }

    // Notify parent of change
    if (onAmountChange) {
      onAmountChange(numericValue, selectedCadence);
    }

    setIsEditing(false);
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

  const handleCadenceClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const currentIndex = CADENCE_CYCLE.indexOf(selectedCadence);
    const nextIndex = (currentIndex + 1) % CADENCE_CYCLE.length;
    const nextCadence = CADENCE_CYCLE[nextIndex];

    // Convert the current input value to the new cadence
    const cleanValue = inputValue.replace(/,/g, '');
    const currentInputAmount = parseFloat(cleanValue);
    if (!isNaN(currentInputAmount)) {
      const convertedAmount = convertCadence(currentInputAmount, selectedCadence, nextCadence);
      const formatted = convertedAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      setInputValue(formatted);
    }

    setSelectedCadence(nextCadence);

    // Keep focus on input after changing cadence
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const isZero = displayAmount === 0;
  const isSuggested = currentAmount === null && suggestedAmount > 0;
  const formatted = formatAccountingAmount(displayAmount);

  if (isEditing) {
    return (
      <td className={`text-left ${hasBorder ? 'border-r border-slate-200' : ''}`}>
        <div className="flex items-center gap-1 px-4 py-2">
          <span className="text-slate-700">$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 text-left bg-transparent py-0 focus:outline-none tabular-nums border-0 min-w-0"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex-shrink-0"
            onClick={handleCadenceClick}
            onMouseDown={(e) => e.preventDefault()}
            type="button"
            data-cadence-button
          >
            {CADENCE_LABELS[selectedCadence]}
          </Button>
        </div>
      </td>
    );
  }

  return (
    <td
      className={`cursor-pointer hover:bg-slate-50/70 transition-colors ${
        isLoading ? 'opacity-50' : ''
      } ${hasBorder ? 'border-r border-slate-200' : ''}`}
      onClick={handleClick}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 px-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <div className="flex items-center justify-between w-full tabular-nums">
            <span className={isZero ? 'font-semibold text-slate-400' : isSuggested ? 'text-slate-600' : ''}>{formatted.sign}</span>
            <div className="flex items-center gap-1">
              <span className={`text-right ${isZero ? 'font-semibold text-slate-400' : isSuggested ? 'text-slate-600' : ''}`}>{formatted.amount}</span>
              <span className={`text-xs ${isZero ? 'text-slate-400' : isSuggested ? 'text-slate-600' : 'text-muted-foreground'}`}>{CADENCE_LABELS[displayCadence]}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 tabular-nums">
          <span className={isZero ? 'font-semibold text-slate-400' : isSuggested ? 'text-slate-600' : ''}>{formatted.sign}</span>
          <div className="flex items-center gap-1">
            <span className={`text-right ${isZero ? 'font-semibold text-slate-400' : isSuggested ? 'text-slate-600' : ''}`}>{formatted.amount}</span>
            <span className={`text-xs ${isZero ? 'text-slate-400' : isSuggested ? 'text-slate-600' : 'text-muted-foreground'}`}>{CADENCE_LABELS[displayCadence]}</span>
          </div>
        </div>
      )}
    </td>
  );
}
