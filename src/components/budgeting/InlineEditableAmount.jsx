import React, { useState, useRef, useEffect } from 'react';
import { formatCadenceAmount } from '@/utils/cadenceUtils';
import { Loader2 } from 'lucide-react';

export default function InlineEditableAmount({
  value,
  cadence,
  isActiveCadence,
  onUpdate,
  isLoading = false,
  isMonthly = false,
  isZero = false
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

  const getTextColor = () => {
    if (isZero) return 'text-slate-400';
    if (isMonthly) return isActiveCadence ? 'text-slate-900 font-bold' : 'text-slate-800 font-semibold';
    return isActiveCadence ? 'font-semibold text-slate-900' : 'text-slate-600';
  };

  const cellBgClass = isMonthly ? 'bg-slate-50/50' : '';

  if (isEditing) {
    return (
      <td className={`text-right py-2.5 ${cellBgClass}`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`w-full text-right bg-transparent px-4 py-0 focus:outline-none tabular-nums border-0 ${getTextColor()}`}
        />
      </td>
    );
  }

  return (
    <td
      className={`px-4 py-2.5 text-right tabular-nums cursor-pointer hover:bg-slate-100/30 transition-colors ${getTextColor()} ${
        isLoading ? 'opacity-50' : ''
      } ${cellBgClass}`}
      onClick={handleClick}
    >
      {isLoading ? (
        <div className="flex items-center justify-end gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{formatCadenceAmount(value, 2)}</span>
        </div>
      ) : (
        formatCadenceAmount(value, isActiveCadence && cadence === 'yearly' ? 0 : 2)
      )}
    </td>
  );
}
