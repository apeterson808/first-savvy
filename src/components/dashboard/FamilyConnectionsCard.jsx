import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';

export default function FamilyConnectionsCard() {
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const [childProfiles, setChildProfiles] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChildProfiles();
  }, [activeProfile?.id]);

  const loadChildProfiles = async () => {
    if (!activeProfile?.id) return;

    try {
      setLoading(true);

      const { data: children, error: childrenError } = await supabase
        .from('child_profiles')
        .select('*')
        .eq('parent_profile_id', activeProfile.id)
        .eq('is_active', true)
        .order('child_name', { ascending: true });

      if (childrenError) throw childrenError;

      setChildProfiles(children || []);

      const counts = {};
      for (const child of children || []) {
        const { count, error: countError } = await supabase
          .from('task_completions')
          .select('*', { count: 'exact', head: true })
          .eq('child_profile_id', child.id)
          .eq('status', 'pending');

        if (!countError) {
          counts[child.id] = count || 0;
        }
      }
      setPendingCounts(counts);
    } catch (error) {
      console.error('Error loading child profiles:', error);
      toast.error('Failed to load family connections');
    } finally {
      setLoading(false);
    }
  };

  const handleChildClick = (child) => {
    navigate(`/Contacts/family/${child.id}`);
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Family Connections</p>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (childProfiles.length === 0) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Family Connections</p>
            <Button
              variant="link"
              className="text-xs p-0 h-auto text-sky-blue"
              onClick={() => navigate('/Contacts')}
            >
              Add family
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-xs text-slate-600">
              Add family members to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Family Connections</p>
          <Button
            variant="link"
            className="text-xs p-0 h-auto text-sky-blue"
            onClick={() => navigate('/Contacts')}
          >
            View all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="grid grid-cols-3 gap-3">
          {childProfiles.slice(0, 6).map((child) => {
            const displayName = child.display_name || child.child_name || `${child.first_name || ''} ${child.last_name || ''}`.trim();
            const initials = getInitials(displayName);
            const pendingCount = pendingCounts[child.id] || 0;

            return (
              <div
                key={child.id}
                className="flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg p-2 transition-colors"
                onClick={() => handleChildClick(child)}
              >
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {pendingCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-center w-full">
                  <p className="text-xs font-medium text-slate-900 truncate">
                    {displayName.split(' ')[0]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
