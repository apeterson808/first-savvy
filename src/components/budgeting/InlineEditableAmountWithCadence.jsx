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
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (isLoading) return;
    const numericValue = displayAmount.toFixed(2);
    setInputValue(numericValue);
    setSelectedCadence(displayCadence);
    setIsEditing(true);
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (onEnter) {
        const numericValue = parseFloat(inputValue);
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
    const numericValue = parseFloat(inputValue);

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
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setInputValue(value);
    }
  };

  const handleCadenceClick = (e) => {
    e.stopPropagation();
    const currentIndex = CADENCE_CYCLE.indexOf(selectedCadence);
    const nextIndex = (currentIndex + 1) % CADENCE_CYCLE.length;
    const nextCadence = CADENCE_CYCLE[nextIndex];

    // Convert the current input value to the new cadence
    const currentInputAmount = parseFloat(inputValue);
    if (!isNaN(currentInputAmount)) {
      const convertedAmount = convertCadence(currentInputAmount, selectedCadence, nextCadence);
      setInputValue(convertedAmount.toFixed(2));
    }

    setSelectedCadence(nextCadence);
  };

  const isZero = displayAmount === 0;
  const formatted = formatAccountingAmount(displayAmount);

  if (isEditing) {
    return (
      <td className={`text-left ${hasBorder ? 'border-r border-slate-200' : ''}`}>
        <div className="flex items-center gap-1 px-4">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 text-left bg-transparent py-0 focus:outline-none tabular-nums border-0"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            onClick={handleCadenceClick}
            type="button"
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
            <span className={isZero ? 'font-semibold' : ''}>{formatted.sign}</span>
            <div className="flex items-center gap-1">
              <span className={`text-right ${isZero ? 'font-semibold' : ''}`}>{formatted.amount}</span>
              <span className="text-xs text-muted-foreground">{CADENCE_LABELS[displayCadence]}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 tabular-nums">
          <span className={isZero ? 'font-semibold' : ''}>{formatted.sign}</span>
          <div className="flex items-center gap-1">
            <span className={`text-right ${isZero ? 'font-semibold' : ''}`}>{formatted.amount}</span>
            <span className="text-xs text-muted-foreground">{CADENCE_LABELS[displayCadence]}</span>
          </div>
        </div>
      )}
    </td>
  );
}
