import React, { useRef, useState } from 'react';
import { Upload, Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export const AVATAR_COLORS = [
  { id: 'sky-blue',      bg: 'bg-sky-blue',      text: 'text-white',     label: 'Sky Blue' },
  { id: 'soft-green',    bg: 'bg-soft-green',    text: 'text-white',     label: 'Soft Green' },
  { id: 'pink',          bg: 'bg-pink',           text: 'text-white',     label: 'Pink' },
  { id: 'orange',        bg: 'bg-orange',         text: 'text-white',     label: 'Orange' },
  { id: 'yellow',        bg: 'bg-yellow',         text: 'text-slate-800', label: 'Yellow' },
  { id: 'peach',         bg: 'bg-peach',          text: 'text-slate-800', label: 'Peach' },
  { id: 'lavender',      bg: 'bg-lavender',       text: 'text-slate-800', label: 'Lavender' },
  { id: 'forest-green',  bg: 'bg-forest-green',   text: 'text-white',     label: 'Forest Green' },
  { id: 'burgundy',      bg: 'bg-burgundy',       text: 'text-white',     label: 'Burgundy' },
  { id: 'olive',         bg: 'bg-olive',          text: 'text-white',     label: 'Olive' },
  { id: 'brown',         bg: 'bg-brown',          text: 'text-white',     label: 'Brown' },
  { id: 'slate',         bg: 'bg-slate-500',      text: 'text-white',     label: 'Slate' },
];

export const AVATAR_ICONS = [
  '🦁', '🐻', '🐼', '🦊', '🐶', '🐱', '🐸', '🦋',
  '🌟', '⚡', '🎯', '🚀', '🎨', '🎵', '🏆', '💎',
  '🌈', '🍀',
];

function getInitials(firstName, lastName) {
  const f = firstName?.trim() || '';
  const l = lastName?.trim() || '';
  if (!f && !l) return '?';
  return `${f[0] || ''}${l[0] || ''}`.toUpperCase();
}

// ── Inline avatar renderer (shared) ────────────────────────────────────────

function AvatarPreview({ imageUrl, icon, colorId, firstName, lastName, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'w-16 h-16' : size === 'lg' ? 'w-24 h-24' : 'w-20 h-20';
  const textClass = size === 'sm' ? 'text-xl' : 'text-3xl';
  const color = AVATAR_COLORS.find(c => c.id === colorId) || AVATAR_COLORS[0];

  if (imageUrl) {
    return (
      <div className={cn('rounded-full overflow-hidden shrink-0', sizeClass)}>
        <img src={imageUrl} alt="Avatar" className="w-full h-full object-cover" />
      </div>
    );
  }
  if (icon) {
    return (
      <div className={cn('rounded-full overflow-hidden shrink-0 flex items-center justify-center', sizeClass, color.bg)}>
        <span className={textClass}>{icon}</span>
      </div>
    );
  }
  return (
    <div className={cn('rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold', sizeClass, color.bg, color.text)}>
      <span className={textClass}>{getInitials(firstName, lastName)}</span>
    </div>
  );
}

// ── Inline (new) mode — used in SettingsTab ─────────────────────────────────
// Props: pending, onPendingChange, firstName, lastName, currentAvatar

function InlineAvatarSelector({ pending, onPendingChange, firstName, lastName, currentAvatar }) {
  const fileRef = useRef(null);

  const resolvedColorId = pending?.type === 'color'
    ? pending.colorId
    : currentAvatar?.startsWith('color:')
      ? currentAvatar.replace('color:', '')
      : null;

  const resolvedIcon = pending?.type === 'icon'
    ? pending.icon
    : currentAvatar?.startsWith('icon:')
      ? currentAvatar.replace('icon:', '')
      : null;

  const resolvedImageUrl = pending?.type === 'upload'
    ? pending.previewUrl
    : currentAvatar && !currentAvatar.startsWith('color:') && !currentAvatar.startsWith('icon:')
      ? currentAvatar
      : null;

  const colorId = resolvedColorId || 'sky-blue';

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => onPendingChange({ type: 'upload', file, previewUrl: ev.target.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex gap-6 items-start">
      <div className="shrink-0">
        <AvatarPreview
          imageUrl={resolvedImageUrl}
          icon={resolvedIcon}
          colorId={colorId}
          firstName={firstName}
          lastName={lastName}
          size="lg"
        />
      </div>

      <div className="flex-1 space-y-4">
        {/* Photo */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Photo</div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-dashed border-slate-300 hover:border-slate-400 rounded-lg px-3 py-2 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            {resolvedImageUrl ? 'Replace photo' : 'Upload photo'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Background color */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Background Color</div>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                onClick={() => onPendingChange({ type: 'color', colorId: c.id })}
                className={cn(
                  'w-7 h-7 rounded-full transition-all border-2',
                  c.bg,
                  colorId === c.id ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-110'
                )}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Used when no photo is set</p>
        </div>

        {/* Icon */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Icon (optional)</div>
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_ICONS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() =>
                  onPendingChange(
                    resolvedIcon === em
                      ? { type: 'color', colorId }
                      : { type: 'icon', icon: em }
                  )
                }
                className={cn(
                  'w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all border',
                  resolvedIcon === em
                    ? 'border-slate-900 bg-slate-100 scale-110'
                    : 'border-transparent hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                {em}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Shown over the background color instead of initials</p>
        </div>
      </div>
    </div>
  );
}

// ── Popover (legacy compact) mode — used in EditChildProfileDialog, ProfileHeaderCard ──
// Props: value, onChange, firstName, lastName, currentAvatar, compact

function PopoverAvatarSelector({ value, onChange, firstName, lastName, currentAvatar }) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const getCurrentColorId = () => {
    if (value?.type === 'color') return value.value;
    if (currentAvatar?.startsWith('color:')) return currentAvatar.replace('color:', '');
    return 'slate';
  };

  const getImageUrl = () => {
    if (value?.type === 'upload') return value.value;
    if (currentAvatar && !currentAvatar.startsWith('color:') && !currentAvatar.startsWith('icon:')) return currentAvatar;
    return null;
  };

  const getIcon = () => {
    if (currentAvatar?.startsWith('icon:')) return currentAvatar.replace('icon:', '');
    return null;
  };

  const handleColorSelect = (colorId) => {
    onChange({ type: 'color', value: colorId });
    setPopoverOpen(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ type: 'upload', value: ev.target.result, file });
      setPopoverOpen(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative inline-block">
      <AvatarPreview
        imageUrl={getImageUrl()}
        icon={getIcon()}
        colorId={getCurrentColorId()}
        firstName={firstName}
        lastName={lastName}
        size="lg"
      />
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
            <Label className="text-sm font-semibold">Choose Color</Label>
            <div className="grid grid-cols-4 gap-3">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => handleColorSelect(color.id)}
                  className={cn(
                    'w-full aspect-square rounded-full transition-all',
                    color.bg,
                    getCurrentColorId() === color.id ? 'ring-2 ring-offset-2 ring-slate-900' : 'hover:scale-110'
                  )}
                  title={color.label}
                />
              ))}
            </div>
            <Separator />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => document.getElementById('avatar-upload-popover')?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Image
            </Button>
            <input
              id="avatar-upload-popover"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Public export — auto-selects mode based on props ───────────────────────

export default function AvatarSelector(props) {
  if ('pending' in props || 'onPendingChange' in props) {
    return <InlineAvatarSelector {...props} />;
  }
  return <PopoverAvatarSelector {...props} />;
}
