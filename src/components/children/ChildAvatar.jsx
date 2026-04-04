import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Cat, Dog, Bird, Fish, Rabbit, Sparkles, Star, Heart, Smile, Sun, Moon, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_MAP } from '@/components/utils/iconMapper';

const PRESET_ICONS = {
  user: User,
  cat: Cat,
  dog: Dog,
  bird: Bird,
  fish: Fish,
  rabbit: Rabbit,
  sparkles: Sparkles,
  star: Star,
  heart: Heart,
  smile: Smile,
  sun: Sun,
  moon: Moon,
};

const PRESET_COLORS = {
  user: 'bg-blue-100 text-blue-600',
  cat: 'bg-purple-100 text-purple-600',
  dog: 'bg-orange-100 text-orange-600',
  bird: 'bg-sky-100 text-sky-600',
  fish: 'bg-cyan-100 text-cyan-600',
  rabbit: 'bg-pink-100 text-pink-600',
  sparkles: 'bg-yellow-100 text-yellow-600',
  star: 'bg-indigo-100 text-indigo-600',
  heart: 'bg-red-100 text-red-600',
  smile: 'bg-green-100 text-green-600',
  sun: 'bg-amber-100 text-amber-600',
  moon: 'bg-slate-100 text-slate-600',
};

export default function ChildAvatar({ child, size = 'default', className }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    default: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-28 h-28',
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

  const isPreset = child?.avatar_url?.startsWith('preset:');
  const presetId = isPreset ? child.avatar_url.replace('preset:', '') : null;

  if (isPreset && presetId && PRESET_ICONS[presetId]) {
    const Icon = PRESET_ICONS[presetId];
    const colorClass = PRESET_COLORS[presetId] || 'bg-slate-100 text-slate-600';

    return (
      <div className={cn('rounded-full flex items-center justify-center shadow-xl', sizeClasses[size], colorClass, className)}>
        <Icon className={iconSizes[size]} />
      </div>
    );
  }

  if (child?.avatar_url && !isPreset) {
    return (
      <Avatar className={cn(sizeClasses[size], 'shadow-xl', className)}>
        <AvatarImage src={child.avatar_url} alt={child?.child_name || 'Avatar'} />
        <AvatarFallback>{getInitials()}</AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar className={cn(sizeClasses[size], 'shadow-xl bg-gradient-to-br from-blue-500 to-cyan-500', className)}>
      <AvatarFallback className="bg-transparent text-white text-xl font-bold">{getInitials()}</AvatarFallback>
    </Avatar>
  );
}
