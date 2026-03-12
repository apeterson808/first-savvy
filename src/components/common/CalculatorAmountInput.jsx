import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Calculator-style currency input component
 * Each digit typed shifts the value left (like entering cents on a calculator)
 * Example: 2 → $0.02, 5 → $0.25, 0 → $2.50, etc.
 */
export default function CalculatorAmountInput({
  value = 0,
  onChange,
  onBlur,
  onEnter,
  autoFocus = false,
  className = '',
  placeholder = '0.00',
  showDollarSign = true,
  disabled = false
}) {
  const [inputValue, setInputValue] = useState('');
  const [isSelected, setIsSelected] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (value === 0 || value === null || value === undefined) {
      setInputValue('');
    } else {
      const formatted = value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      setInputValue(formatted);
    }
  }, [value]);

  const handleKeyDown = (e) => {
    // Handle backspace to remove last digit
    if (e.key === 'Backspace') {
      e.preventDefault();
      setIsSelected(false);
      const cleanValue = inputValue.replace(/,/g, '') || '0';
      const cents = Math.round(parseFloat(cleanValue) * 100);
      const newCents = Math.floor(cents / 10);
      const newAmount = newCents / 100;

      if (newAmount === 0) {
        setInputValue('');
        if (onChange) {
          onChange(0);
        }
      } else {
        const formatted = newAmount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        setInputValue(formatted);
        if (onChange) {
          onChange(newAmount);
        }
      }
      return;
    }

    // Handle numeric input (0-9)
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const digit = parseInt(e.key);

      // If text is selected, start fresh with just this digit
      if (isSelected) {
        setIsSelected(false);
        const newAmount = digit / 100;
        const formatted = newAmount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        setInputValue(formatted);
        if (onChange) {
          onChange(newAmount);
        }
        return;
      }

      // Otherwise, append to existing value
      const cleanValue = inputValue.replace(/,/g, '') || '0';
      const cents = Math.round(parseFloat(cleanValue) * 100);
      const newCents = (cents * 10) + digit;
      const newAmount = newCents / 100;
      const formatted = newAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      setInputValue(formatted);
      if (onChange) {
        onChange(newAmount);
      }
      return;
    }

    if (e.key === 'Enter' && onEnter) {
      e.preventDefault();
      const cleanValue = inputValue.replace(/,/g, '') || '0';
      const numericValue = parseFloat(cleanValue);
      onEnter(numericValue);
    }
  };

  const handleChange = (e) => {
    // Calculator-style input is handled in keyDown
    // This is just for paste/other input events
    const val = e.target.value;
    const cleanValue = val.replace(/,/g, '');

    if (cleanValue === '' || /^\d*\.?\d{0,2}$/.test(cleanValue)) {
      const numericValue = parseFloat(cleanValue) || 0;
      const formatted = numericValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      setInputValue(formatted);
      if (onChange) {
        onChange(numericValue);
      }
    }
  };

  const handleFocus = (e) => {
    e.target.select();
    setIsSelected(true);
  };

  const handleBlurEvent = (e) => {
    if (onBlur) {
      const cleanValue = inputValue.replace(/,/g, '');
      const numericValue = parseFloat(cleanValue) || 0;
      onBlur(numericValue);
    }
  };

  return (
    <div className="relative">
      {showDollarSign && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
      )}
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlurEvent}
        className={`tabular-nums text-right ${showDollarSign ? 'pl-7' : ''} ${className}`}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
