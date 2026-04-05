import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
        'h-20 w-20 rounded-full flex items-center justify-center',
        avatarColor.bg,
        avatarColor.text
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
