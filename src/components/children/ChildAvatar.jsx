import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_MAP } from '@/components/utils/iconMapper';

const AVATAR_COLORS = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
  teal: 'bg-teal-500',
  emerald: 'bg-emerald-500',
  lime: 'bg-lime-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-500',
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
    const first = child?.first_name?.trim() || '';
    const last = child?.last_name?.trim() || '';

    if (first && last) {
      return `${first[0]}${last[0]}`.toUpperCase();
    }

    if (child?.child_name) {
      return child.child_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }

    return '?';
  };

  const avatar = child?.avatar;

  if (avatar?.imageUrl) {
    return (
      <Avatar className={cn(sizeClasses[size], 'shadow-xl', className)}>
        <AvatarImage src={avatar.imageUrl} alt={child?.child_name || child?.first_name || 'Avatar'} />
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

  const isColorAvatar = child?.avatar_url?.startsWith('color:');
  const colorId = isColorAvatar ? child.avatar_url.replace('color:', '') : 'slate';
  const colorClass = AVATAR_COLORS[colorId] || AVATAR_COLORS.slate;

  return (
    <div className={cn('rounded-full flex items-center justify-center text-white font-bold', sizeClasses[size], colorClass, className)}>
      {getInitials()}
    </div>
  );
}
