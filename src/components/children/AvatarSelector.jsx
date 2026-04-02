import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, User, Cat, Dog, Bird, Fish, Rabbit, Sparkles, Star, Heart, Smile, Sun, Moon, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESET_AVATARS = [
  { id: 'user', icon: User, color: 'bg-blue-100 text-blue-600' },
  { id: 'cat', icon: Cat, color: 'bg-purple-100 text-purple-600' },
  { id: 'dog', icon: Dog, color: 'bg-orange-100 text-orange-600' },
  { id: 'bird', icon: Bird, color: 'bg-sky-100 text-sky-600' },
  { id: 'fish', icon: Fish, color: 'bg-cyan-100 text-cyan-600' },
  { id: 'rabbit', icon: Rabbit, color: 'bg-pink-100 text-pink-600' },
  { id: 'sparkles', icon: Sparkles, color: 'bg-yellow-100 text-yellow-600' },
  { id: 'star', icon: Star, color: 'bg-indigo-100 text-indigo-600' },
  { id: 'heart', icon: Heart, color: 'bg-red-100 text-red-600' },
  { id: 'smile', icon: Smile, color: 'bg-green-100 text-green-600' },
  { id: 'sun', icon: Sun, color: 'bg-amber-100 text-amber-600' },
  { id: 'moon', icon: Moon, color: 'bg-slate-100 text-slate-600' },
];

export default function AvatarSelector({ value, onChange, firstName = '', lastName = '', currentAvatar = null, compact = false }) {
  const [uploadedFile, setUploadedFile] = useState(null);

  const handlePresetSelect = (presetId) => {
    setUploadedFile(null);
    onChange({ type: 'preset', value: presetId });
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
    };
    reader.readAsDataURL(file);
  };

  const getInitials = () => {
    const first = firstName?.trim() || '';
    const last = lastName?.trim() || '';
    if (!first && !last) return '?';
    return `${first[0] || ''}${last[0] || ''}`.toUpperCase();
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

    if (value?.type === 'preset') {
      const preset = PRESET_AVATARS.find(p => p.id === value.value);
      if (preset) {
        const Icon = preset.icon;
        return (
          <div className={cn('w-full h-full flex items-center justify-center', preset.color)}>
            <Icon className="w-12 h-12" />
          </div>
        );
      }
    }

    if (currentAvatar && currentAvatar.startsWith('preset:')) {
      const presetId = currentAvatar.replace('preset:', '');
      const preset = PRESET_AVATARS.find(p => p.id === presetId);
      if (preset) {
        const Icon = preset.icon;
        return (
          <div className={cn('w-full h-full flex items-center justify-center', preset.color)}>
            <Icon className="w-12 h-12" />
          </div>
        );
      }
    }

    if (currentAvatar) {
      return (
        <img
          src={currentAvatar}
          alt="Current avatar"
          className="w-full h-full object-cover"
        />
      );
    }

    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-600">
        <span className="text-3xl font-bold">{getInitials()}</span>
      </div>
    );
  };

  if (compact) {
    return (
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0">
          {renderPreview()}
        </div>
        <Button
          type="button"
          size="icon"
          variant="default"
          className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-md"
          onClick={() => document.getElementById('avatar-upload-compact')?.click()}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <input
          id="avatar-upload-compact"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label>Avatar</Label>

      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0">
          {renderPreview()}
        </div>

        <div className="flex-1">
          <p className="text-xs text-slate-500 mb-2">
            Choose a preset avatar or upload your own image
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('avatar-upload')?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
            {(uploadedFile || value?.type === 'upload') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUploadedFile(null);
                  onChange(null);
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-2 block">Preset Avatars</Label>
        <div className="grid grid-cols-6 gap-2">
          {PRESET_AVATARS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = value?.type === 'preset' && value.value === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset.id)}
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                  preset.color,
                  isSelected && 'ring-2 ring-offset-2 ring-sky-blue',
                  !isSelected && 'hover:scale-110'
                )}
              >
                <Icon className="w-6 h-6" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
