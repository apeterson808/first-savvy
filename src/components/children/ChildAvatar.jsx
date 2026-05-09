import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_MAP } from '@/components/utils/iconMapper';

const AVATAR_COLORS = {
  'sky-blue': { bg: 'bg-sky-blue', text: 'text-white' },
  'soft-green': { bg: 'bg-soft-green', text: 'text-slate-800' },
  'pink': { bg: 'bg-pink', text: 'text-white' },
  'orange': { bg: 'bg-orange', text: 'text-white' },
  'yellow': { bg: 'bg-yellow', text: 'text-slate-800' },
  'peach': { bg: 'bg-peach', text: 'text-slate-800' },
  'lavender': { bg: 'bg-lavender', text: 'text-slate-800' },
  'forest-green': { bg: 'bg-forest-green', text: 'text-white' },
  'burgundy': { bg: 'bg-burgundy', text: 'text-white' },
  'olive': { bg: 'bg-olive', text: 'text-white' },
  'brown': { bg: 'bg-brown', text: 'text-white' },
  'slate': { bg: 'bg-slate-500', text: 'text-white' },
};

export default function ChildAvatar({ child, size = 'default', className }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    default: 'w-12 h-12 text-base',
    lg: 'w-20 h-20 text-2xl',
    xl: 'w-28 h-28 text-3xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
  };

  const getInitials = () => {
    const displayName = child?.display_name || child?.child_name;
    if (displayName) {
      return displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }

    const first = child?.first_name?.trim() || '';
    const last = child?.last_name?.trim() || '';
    if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
    if (first) return first[0].toUpperCase();

    return '?';
  };

  const avatar = child?.avatar;

  if (avatar?.imageUrl) {
    return (
      <Avatar className={cn(sizeClasses[size], 'shadow-xl', className)}>
        <AvatarImage src={avatar.imageUrl} alt={child?.display_name || child?.child_name || 'Avatar'} />
        <AvatarFallback>{getInitials()}</AvatarFallback>
      </Avatar>
    );
  }

  if (avatar?.icon && avatar?.color) {
    const Icon = ICON_MAP[avatar.icon] || Circle;
    return (
      <div
        className={cn('rounded-full flex items-center justify-center shadow-xl', sizeClasses[size], className)}
        style={{ backgroundColor: avatar.color }}
      >
        <Icon className={cn(iconSizes[size], 'text-white')} />
      </div>
    );
  }

  const avatarUrl = child?.avatar_url;
  const isColorAvatar = avatarUrl?.startsWith('color:');
  const isImageAvatar = avatarUrl && !isColorAvatar;

  if (isImageAvatar) {
    return (
      <Avatar className={cn(sizeClasses[size], 'shadow-xl', className)}>
        <AvatarImage src={avatarUrl} alt={child?.display_name || child?.child_name || 'Avatar'} />
        <AvatarFallback className={cn('font-bold', AVATAR_COLORS.slate.bg, AVATAR_COLORS.slate.text)}>
          {getInitials()}
        </AvatarFallback>
      </Avatar>
    );
  }

  const colorId = isColorAvatar ? avatarUrl.replace('color:', '') : 'slate';
  const colorStyles = AVATAR_COLORS[colorId] || AVATAR_COLORS.slate;

  return (
    <div className={cn('rounded-full flex items-center justify-center font-bold', sizeClasses[size], colorStyles.bg, colorStyles.text, className)}>
      {getInitials()}
    </div>
  );
}
