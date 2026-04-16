import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Star, Clock } from 'lucide-react';

const AVATAR_COLORS = [
  { id: 'sky-blue', bg: 'bg-sky-blue', text: 'text-white' },
  { id: 'soft-green', bg: 'bg-soft-green', text: 'text-slate-800' },
  { id: 'pink', bg: 'bg-pink', text: 'text-white' },
  { id: 'orange', bg: 'bg-orange', text: 'text-white' },
  { id: 'yellow', bg: 'bg-yellow', text: 'text-slate-800' },
  { id: 'peach', bg: 'bg-peach', text: 'text-slate-800' },
  { id: 'lavender', bg: 'bg-lavender', text: 'text-slate-800' },
  { id: 'forest-green', bg: 'bg-forest-green', text: 'text-white' },
  { id: 'burgundy', bg: 'bg-burgundy', text: 'text-white' },
  { id: 'olive', bg: 'bg-olive', text: 'text-white' },
  { id: 'brown', bg: 'bg-brown', text: 'text-white' },
  { id: 'slate', bg: 'bg-slate-500', text: 'text-white' },
];

export function SimpleProfileHeader({ child, starsBalance = 0, starsPending = 0 }) {
  const getInitials = () => {
    const first = child.first_name?.[0] || '';
    const last = child.last_name?.[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  const getAvatarColor = () => {
    if (child.avatar_url && child.avatar_url.startsWith('color:')) {
      const colorId = child.avatar_url.replace('color:', '');
      return AVATAR_COLORS.find(c => c.id === colorId) || AVATAR_COLORS.find(c => c.id === 'slate');
    }
    return AVATAR_COLORS.find(c => c.id === 'slate');
  };

  const calculateAge = () => {
    if (!child.date_of_birth) return null;
    return Math.floor((new Date() - new Date(child.date_of_birth)) / 31557600000);
  };

  const isImageAvatar = child.avatar_url && !child.avatar_url.startsWith('color:');
  const avatarColor = getAvatarColor();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div className="flex items-center gap-4">
        {isImageAvatar ? (
          <div className="h-20 w-20 rounded-full overflow-hidden flex-shrink-0">
            <img
              src={child.avatar_url}
              alt={child.display_name || child.first_name || 'Avatar'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement.classList.add(avatarColor.bg, avatarColor.text, 'flex', 'items-center', 'justify-center');
                e.currentTarget.parentElement.innerHTML = `<span class="text-2xl font-bold">${getInitials()}</span>`;
              }}
            />
          </div>
        ) : (
          <div className={cn(
            'h-20 w-20 rounded-full flex items-center justify-center',
            avatarColor.bg,
            avatarColor.text
          )}>
            <span className="text-2xl font-bold">{getInitials()}</span>
          </div>
        )}
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold text-slate-900">
            {child.display_name || `${child.first_name} ${child.last_name}`}
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-normal">
              Beginner
            </Badge>
            {calculateAge() && (
              <span className="text-sm text-slate-500">
                Age {calculateAge()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:flex-shrink-0">
        <div className="flex items-center gap-3 bg-amber-500 rounded-2xl px-5 py-3 shadow-lg ring-2 ring-amber-600 w-full sm:w-auto">
          <Star className="w-7 h-7 fill-amber-100 text-amber-100" />
          <div>
            <p className="text-amber-100 text-xs font-bold uppercase tracking-wide leading-none mb-1">Total Stars</p>
            <p className="text-white font-black text-3xl leading-none">{starsBalance}</p>
          </div>
        </div>
        {starsPending > 0 && (
          <div className="flex items-center gap-2 bg-orange-50 border-2 border-orange-300 rounded-2xl px-4 py-3">
            <Clock className="w-6 h-6 text-orange-500" />
            <div>
              <p className="text-orange-500 text-xs font-semibold uppercase tracking-wide leading-none mb-1">Pending</p>
              <p className="text-orange-700 font-black text-3xl leading-none">{starsPending}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
