import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Pencil, Upload } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = [
  { id: 'sky-blue', bg: 'bg-sky-blue', text: 'text-white', label: 'Sky Blue' },
  { id: 'soft-green', bg: 'bg-soft-green', text: 'text-slate-800', label: 'Soft Green' },
  { id: 'pink', bg: 'bg-pink', text: 'text-white', label: 'Pink' },
  { id: 'orange', bg: 'bg-orange', text: 'text-white', label: 'Orange' },
  { id: 'yellow', bg: 'bg-yellow', text: 'text-slate-800', label: 'Yellow' },
  { id: 'peach', bg: 'bg-peach', text: 'text-slate-800', label: 'Peach' },
  { id: 'lavender', bg: 'bg-lavender', text: 'text-slate-800', label: 'Lavender' },
  { id: 'forest-green', bg: 'bg-forest-green', text: 'text-white', label: 'Forest Green' },
  { id: 'burgundy', bg: 'bg-burgundy', text: 'text-white', label: 'Burgundy' },
  { id: 'olive', bg: 'bg-olive', text: 'text-white', label: 'Olive' },
  { id: 'brown', bg: 'bg-brown', text: 'text-white', label: 'Brown' },
  { id: 'slate', bg: 'bg-slate-500', text: 'text-white', label: 'Slate' },
];

export default function AvatarSelector({ value, onChange, firstName = '', lastName = '', currentAvatar = null, compact = false }) {
  const [selectedColor, setSelectedColor] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleColorSelect = (colorId) => {
    setSelectedColor(colorId);
    setUploadedFile(null);
    onChange({ type: 'color', value: colorId });
    setPopoverOpen(false);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedFile(e.target.result);
      onChange({ type: 'upload', value: e.target.result, file });
      setPopoverOpen(false);
    };
    reader.readAsDataURL(file);
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
    if (uploadedFile) {
      return (
        <img
          src={uploadedFile}
          alt="Avatar preview"
          className="w-full h-full object-cover"
        />
      );
    }

    if (value?.type === 'upload') {
      return (
        <img
          src={value.value}
          alt="Avatar preview"
          className="w-full h-full object-cover"
        />
      );
    }

    if (currentAvatar && !currentAvatar.startsWith('color:')) {
      return (
        <img
          src={currentAvatar}
          alt="Current avatar"
          className="w-full h-full object-cover"
        />
      );
    }

    const colorId = getCurrentColor();
    const color = AVATAR_COLORS.find(c => c.id === colorId) || AVATAR_COLORS.find(c => c.id === 'slate');

    return (
      <div className={cn('w-full h-full flex items-center justify-center', color.bg, color.text)}>
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
          <PopoverContent className="w-72" align="end">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Choose Color</Label>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {AVATAR_COLORS.map((color) => {
                  const isSelected = getCurrentColor() === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => handleColorSelect(color.id)}
                      className={cn(
                        'w-full aspect-square rounded-full transition-all',
                        color.bg,
                        isSelected && 'ring-2 ring-offset-2 ring-slate-900',
                        !isSelected && 'hover:scale-110'
                      )}
                      title={color.label}
                    />
                  );
                })}
              </div>
              <Separator />
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById('avatar-upload-compact')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Image
                </Button>
                <input
                  id="avatar-upload-compact"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
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
          <PopoverContent className="w-72" align="end">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Choose Color</Label>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {AVATAR_COLORS.map((color) => {
                  const isSelected = getCurrentColor() === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => handleColorSelect(color.id)}
                      className={cn(
                        'w-full aspect-square rounded-full transition-all',
                        color.bg,
                        isSelected && 'ring-2 ring-offset-2 ring-slate-900',
                        !isSelected && 'hover:scale-110'
                      )}
                      title={color.label}
                    />
                  );
                })}
              </div>
              <Separator />
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById('avatar-upload-compact')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Image
                </Button>
                <input
                  id="avatar-upload-compact"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
