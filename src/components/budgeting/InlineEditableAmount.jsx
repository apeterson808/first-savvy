import React, { useState, useRef, useEffect } from 'react';
import { formatAccountingAmount } from '@/utils/cadenceUtils';
import { Loader2 } from 'lucide-react';

export default function InlineEditableAmount({
  value,
  cadence,
  isActiveCadence,
  onUpdate,
  isLoading = false,
  hasBorder = false,
  isMonthlyColumn = false
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (isLoading) return;
    const numericValue = value.toFixed(2);
    setInputValue(numericValue);
    setIsEditing(true);
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue('');
    }
  };

  const handleSave = async () => {
    const numericValue = parseFloat(inputValue);

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
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setInputValue(value);
    }
  };

  const isZero = value === 0;
  const formatted = formatAccountingAmount(value);

  if (isEditing) {
    return (
      <td className={`text-left ${hasBorder ? 'border-r border-slate-100' : ''} ${isMonthlyColumn ? 'bg-blue-100/70' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`w-full text-left bg-transparent px-4 py-0 focus:outline-none tabular-nums border-0 ${
            isMonthlyColumn ? 'font-semibold' : ''
          }`}
        />
      </td>
    );
  }

  return (
    <td
      className={`cursor-pointer hover:bg-slate-50/70 transition-colors ${
        isLoading ? 'opacity-50' : ''
      } ${hasBorder ? 'border-r border-slate-100' : ''} ${isMonthlyColumn ? 'bg-blue-100/70' : ''}`}
      onClick={handleClick}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 px-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <div className="flex justify-between w-full tabular-nums">
            <span className={isMonthlyColumn || isZero ? 'font-semibold' : ''}>{formatted.sign}</span>
            <span className={`text-right ${isMonthlyColumn || isZero ? 'font-semibold' : ''}`}>{formatted.amount}</span>
          </div>
        </div>
      ) : (
        <div className="flex justify-between px-4 tabular-nums">
          <span className={isMonthlyColumn || isZero ? 'font-semibold' : ''}>{formatted.sign}</span>
          <span className={`text-right ${isMonthlyColumn || isZero ? 'font-semibold' : ''}`}>{formatted.amount}</span>
        </div>
      )}
    </td>
  );
}
