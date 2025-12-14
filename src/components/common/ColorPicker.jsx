import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const CUSTOM_COLOR_PALETTE = [
  { name: 'Tea Green', hex: '#AACC96' },
  { name: 'Forest', hex: '#25533F' },
  { name: 'Peach Frost', hex: '#F4BEAE' },
  { name: 'Blueberry', hex: '#52A5CE' },
  { name: 'Bubblegum', hex: '#FF7BAC' },
  { name: 'Dry Earth', hex: '#876029' },
  { name: 'Grape Juice', hex: '#6D1F42' },
  { name: 'Lilacs', hex: '#D3B6D3' },
  { name: 'Butter Yellow', hex: '#EFCE7B' },
  { name: 'Iced Blue', hex: '#B8CEE8' },
  { name: 'Blood Orange', hex: '#EF6F3C' },
  { name: 'Olive Green', hex: '#AFAB23' }
];

const DEFAULT_COLOR = '#52A5CE';

export default function ColorPicker({ 
  value, 
  onChange, 
  existingColors = [], 
  label = "Color",
  showLabel = true 
}) {
  const [open, setOpen] = useState(false);
  const selectedColor = value || DEFAULT_COLOR;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-6 h-6 rounded-full border-2 border-slate-200 hover:border-slate-300 transition-colors ml-2 mt-2"
          style={{ backgroundColor: selectedColor }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="grid grid-cols-6 gap-2">
          {CUSTOM_COLOR_PALETTE.map((color) => (
            <button
              key={color.hex}
              type="button"
              onClick={() => {
                onChange(color.hex);
                setOpen(false);
              }}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                selectedColor === color.hex 
                  ? 'border-slate-800 scale-110' 
                  : 'border-slate-300 hover:scale-105 hover:border-slate-400'
              }`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}