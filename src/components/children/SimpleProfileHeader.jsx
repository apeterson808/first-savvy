import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function SimpleProfileHeader({ child }) {
  const getAvatarDisplay = () => {
    if (child.avatar_url) {
      if (child.avatar_url.startsWith('preset:')) {
        return child.avatar_url.replace('preset:', '');
      }
      return <AvatarImage src={child.avatar_url} alt={`${child.first_name} ${child.last_name}`} />;
    }
    return null;
  };

  const getInitials = () => {
    const first = child.first_name?.[0] || '';
    const last = child.last_name?.[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  const calculateAge = () => {
    if (!child.date_of_birth) return null;
    return Math.floor((new Date() - new Date(child.date_of_birth)) / 31557600000);
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      <Avatar className="h-20 w-20 text-3xl border-4 border-slate-200 shadow-sm">
        {getAvatarDisplay()}
        <AvatarFallback className="bg-slate-100 text-slate-700 text-2xl font-semibold">
          {getInitials()}
        </AvatarFallback>
      </Avatar>
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
