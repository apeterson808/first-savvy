import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function InlineEditableAverage({
  suggestedAmount,
  currentAmount,
  onAmountChange,
  onEnter,
  isLoading = false,
  hasBorder = false
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const enterPressedRef = useRef(false);

  useEffect(() => {
    const amountToUse = currentAmount !== undefined && currentAmount !== null ? currentAmount : suggestedAmount;
    if (amountToUse !== null && amountToUse !== undefined) {
      setValue(formatNumberWithCommas(amountToUse.toFixed(2)));
    }
  }, [suggestedAmount, currentAmount]);

  const formatNumberWithCommas = (value) => {
    if (!value) return '';
    const parts = value.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const parseValue = (val) => {
    return parseFloat(val.replace(/,/g, '')) || 0;
  };

  const handleClick = () => {
    if (!isLoading) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    if (enterPressedRef.current) {
      enterPressedRef.current = false;
      return;
    }
    setIsEditing(false);
    const numericValue = parseValue(value);

    if (!value || numericValue === 0) {
      if (suggestedAmount !== null && suggestedAmount !== undefined) {
        setValue(formatNumberWithCommas(suggestedAmount.toFixed(2)));
        if (onAmountChange) {
          onAmountChange(suggestedAmount);
        }
      }
    } else {
      setValue(formatNumberWithCommas(numericValue.toFixed(2)));
      if (onAmountChange) {
        onAmountChange(numericValue);
      }
    }
  };

  const handleChange = (e) => {
    const input = e.target.value;
    const cleanValue = input.replace(/[^0-9.]/g, '');

    const decimalCount = (cleanValue.match(/\./g) || []).length;
    if (decimalCount > 1) return;

    const parts = cleanValue.split('.');
    if (parts[1] && parts[1].length > 2) return;

    const formatted = formatNumberWithCommas(cleanValue);
    setValue(formatted);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      enterPressedRef.current = true;
      const numericValue = parseValue(value);
      setIsEditing(false);
      if (!value || numericValue === 0) {
        if (suggestedAmount !== null && suggestedAmount !== undefined) {
          setValue(formatNumberWithCommas(suggestedAmount.toFixed(2)));
          if (onAmountChange) onAmountChange(suggestedAmount);
        }
      } else {
        setValue(formatNumberWithCommas(numericValue.toFixed(2)));
        if (onAmountChange) onAmountChange(numericValue);
      }
      if (onEnter) onEnter();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const amountToUse = currentAmount !== undefined && currentAmount !== null ? currentAmount : suggestedAmount;
      if (amountToUse !== null && amountToUse !== undefined) {
        setValue(formatNumberWithCommas(amountToUse.toFixed(2)));
      }
      setIsEditing(false);
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const amountToDisplay = currentAmount !== undefined && currentAmount !== null ? currentAmount : suggestedAmount;
  const displayValue = value || (amountToDisplay ? formatNumberWithCommas(amountToDisplay.toFixed(2)) : '0.00');
  const hasValue = parseValue(value) > 0 || (amountToDisplay && amountToDisplay > 0);

  return (
    <td
      className={`px-4 text-right group relative ${hasBorder ? 'border-r border-slate-100' : ''} ${
        hasValue ? 'bg-blue-50/30' : ''
      }`}
    >
      <div className="flex justify-end items-center h-full">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : isEditing ? (
          <div className="relative w-28">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
            <Input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-7 text-sm pl-6 pr-2 text-right tabular-nums"
            />
          </div>
        ) : (
          <button
            onClick={handleClick}
            className={`px-2 py-1 rounded text-sm tabular-nums text-right hover:bg-slate-100 transition-colors ${
              hasValue ? 'text-slate-700 font-medium' : 'text-slate-400'
            }`}
          >
            ${displayValue}
          </button>
        )}
      </div>
    </td>
  );
}
