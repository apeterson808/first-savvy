import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = [
  { id: 'blue', bg: 'bg-blue-500' },
  { id: 'green', bg: 'bg-green-500' },
  { id: 'red', bg: 'bg-red-500' },
  { id: 'yellow', bg: 'bg-yellow-500' },
  { id: 'orange', bg: 'bg-orange-500' },
  { id: 'pink', bg: 'bg-pink-500' },
  { id: 'cyan', bg: 'bg-cyan-500' },
  { id: 'teal', bg: 'bg-teal-500' },
  { id: 'emerald', bg: 'bg-emerald-500' },
  { id: 'lime', bg: 'bg-lime-500' },
  { id: 'amber', bg: 'bg-amber-500' },
  { id: 'slate', bg: 'bg-slate-500' },
];

export function SimpleProfileHeader({ child }) {
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

  const avatarColor = getAvatarColor();

  return (
    <div className="flex items-center gap-4 mb-6">
      <div className={cn(
        'h-20 w-20 rounded-full border-4 border-slate-200 shadow-sm flex items-center justify-center text-white',
        avatarColor.bg
      )}>
        <span className="text-2xl font-bold">{getInitials()}</span>
      </div>
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold text-slate-900">
          {child.first_name} {child.last_name}
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
  );
}
