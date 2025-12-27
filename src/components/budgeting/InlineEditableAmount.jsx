import React, { useState, useRef, useEffect } from 'react';
import { formatCadenceAmount } from '@/utils/cadenceUtils';
import { Loader2 } from 'lucide-react';

export default function InlineEditableAmount({
  value,
  cadence,
  isActiveCadence,
  onUpdate,
  isLoading = false
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

  if (isEditing) {
    return (
      <td className={`px-4 text-right ${isActiveCadence ? 'font-semibold' : 'text-muted-foreground'}`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full text-right bg-blue-50 border-2 border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
          style={{ minWidth: '100px' }}
        />
      </td>
    );
  }

  return (
    <td
      className={`px-4 text-right tabular-nums cursor-pointer hover:bg-blue-50/50 transition-colors ${
        isActiveCadence ? 'font-semibold' : 'text-muted-foreground'
      } ${isLoading ? 'opacity-50' : ''}`}
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
