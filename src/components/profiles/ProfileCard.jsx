import { Users, Briefcase, Edit, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState } from 'react';
import { format } from 'date-fns';
import ChildAvatar from '../children/ChildAvatar';
import { differenceInYears } from 'date-fns';

const TIER_COLORS = {
  1: 'bg-slate-100 text-slate-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-green-100 text-green-800',
};

export function ProfileCard({
  profile,
  children = [],
  onEdit,
  onDelete,
  onEditChild,
  onDeleteChild,
  onAddChild,
  onOpen
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isFamily = profile.profile_type === 'family';
  const isBusiness = profile.profile_type === 'business';
  const colorClass = isFamily ? 'border-green-500' : 'border-orange-500';
  const bgClass = isFamily ? 'bg-green-50' : 'bg-orange-50';
  const iconColorClass = isFamily ? 'text-green-600' : 'text-orange-600';
  const Icon = isFamily ? Users : Briefcase;

  return (
    <Card className={`border-l-4 ${colorClass}`}>
      <CardHeader className={`${bgClass} pb-4`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className={iconColorClass}>
                <Icon className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{profile.display_name}</h3>
                <Badge variant="outline" className="text-xs">
                  {isFamily ? 'Family' : 'Business'}
                </Badge>
              </div>
              <p className="text-sm text-slate-600">
                Created {format(new Date(profile.created_at), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpen(profile)}>
              Open
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(profile)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(profile)}>
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isFamily && (
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Children ({children.length})
              </button>
              <Button variant="outline" size="sm" onClick={() => onAddChild(profile)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Child
              </Button>
            </div>

            {isExpanded && (
              <div className="space-y-2">
                {children.length === 0 ? (
                  <div className="text-center py-6 text-sm text-slate-500">
                    No children yet. Click "Add Child" to create one.
                  </div>
                ) : (
                  children.map((child) => {
                    const age = child.date_of_birth
                      ? differenceInYears(new Date(), new Date(child.date_of_birth))
                      : null;

                    return (
                      <div
                        key={child.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <ChildAvatar child={child} size="sm" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{child.child_name}</p>
                              <Badge className={TIER_COLORS[child.current_permission_level]} variant="secondary">
                                Tier {child.current_permission_level}
                              </Badge>
                            </div>
                            {age !== null && (
                              <p className="text-xs text-slate-500">Age {age}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => onEditChild(child)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onDeleteChild(child)}>
                            <Trash2 className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
