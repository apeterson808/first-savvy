import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = [
  { id: 'blue', bg: 'bg-blue-500', label: 'Blue' },
  { id: 'green', bg: 'bg-green-500', label: 'Green' },
  { id: 'red', bg: 'bg-red-500', label: 'Red' },
  { id: 'yellow', bg: 'bg-yellow-500', label: 'Yellow' },
  { id: 'orange', bg: 'bg-orange-500', label: 'Orange' },
  { id: 'pink', bg: 'bg-pink-500', label: 'Pink' },
  { id: 'cyan', bg: 'bg-cyan-500', label: 'Cyan' },
  { id: 'teal', bg: 'bg-teal-500', label: 'Teal' },
  { id: 'emerald', bg: 'bg-emerald-500', label: 'Emerald' },
  { id: 'lime', bg: 'bg-lime-500', label: 'Lime' },
  { id: 'amber', bg: 'bg-amber-500', label: 'Amber' },
  { id: 'slate', bg: 'bg-slate-500', label: 'Slate' },
];

export default function AvatarSelector({ value, onChange, firstName = '', lastName = '', currentAvatar = null, compact = false }) {
  const [selectedColor, setSelectedColor] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleColorSelect = (colorId) => {
    setSelectedColor(colorId);
    onChange({ type: 'color', value: colorId });
    setPopoverOpen(false);
  };

  const getInitials = () => {
    const first = firstName?.trim() || '';
    const last = lastName?.trim() || '';
    if (!first && !last) return '?';
    return `${first[0] || ''}${last[0] || ''}`.toUpperCase();
  };

  const getCurrentColor = () => {
    if (value?.type === 'color') {
      return value.value;
    }
    if (currentAvatar && currentAvatar.startsWith('color:')) {
      return currentAvatar.replace('color:', '');
    }
    return 'slate';
  };

  const renderPreview = () => {
    const colorId = getCurrentColor();
    const color = AVATAR_COLORS.find(c => c.id === colorId) || AVATAR_COLORS.find(c => c.id === 'slate');

    return (
      <div className={cn('w-full h-full flex items-center justify-center', color.bg, 'text-white')}>
        <span className={compact ? 'text-3xl font-bold' : 'text-3xl font-bold'}>{getInitials()}</span>
      </div>
    );
  };

  if (compact) {
    return (
      <div className="relative inline-block">
        <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0">
          {renderPreview()}
        </div>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="default"
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-md"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">Choose Avatar Color</Label>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_COLORS.map((color) => {
                  const isSelected = getCurrentColor() === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => handleColorSelect(color.id)}
                      className={cn(
                        'w-9 h-9 rounded-full transition-all',
                        color.bg,
                        isSelected && 'ring-2 ring-offset-2 ring-slate-900',
                        !isSelected && 'hover:scale-110'
                      )}
                      title={color.label}
                    />
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative inline-block">
        <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0">
          {renderPreview()}
        </div>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="default"
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-md"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">Choose Avatar Color</Label>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_COLORS.map((color) => {
                  const isSelected = getCurrentColor() === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => handleColorSelect(color.id)}
                      className={cn(
                        'w-9 h-9 rounded-full transition-all',
                        color.bg,
                        isSelected && 'ring-2 ring-offset-2 ring-slate-900',
                        !isSelected && 'hover:scale-110'
                      )}
                      title={color.label}
                    />
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
