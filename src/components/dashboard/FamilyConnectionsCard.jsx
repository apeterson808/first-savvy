import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';

export default function FamilyConnectionsCard() {
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const [childProfiles, setChildProfiles] = useState([]);
  const [householdMembers, setHouseholdMembers] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFamily();
  }, [activeProfile?.id]);

  const loadFamily = async () => {
    if (!activeProfile?.id) return;

    // Only load for the owner's own profile (not when viewing a shared profile)
    const profileId = activeProfile.is_child_profile ? activeProfile.parent_profile_id : activeProfile.id;
    if (!profileId) return;

    try {
      setLoading(true);

      // Load children
      const { data: children, error: childrenError } = await supabase
        .from('child_profiles')
        .select('*')
        .eq('parent_profile_id', profileId)
        .eq('is_active', true)
        .order('child_name', { ascending: true });

      if (childrenError) throw childrenError;
      setChildProfiles(children || []);

      // Pending task counts per child
      const counts = {};
      for (const child of children || []) {
        const { count } = await supabase
          .from('task_completions')
          .select('*', { count: 'exact', head: true })
          .eq('child_profile_id', child.id)
          .eq('status', 'pending');
        counts[child.id] = count || 0;
      }
      setPendingCounts(counts);

      // Load household members (spouse/partner contacts) for this profile
      const { data: members } = await supabase
        .from('contacts')
        .select('id, name, email, group_name, linked_user_id')
        .eq('profile_id', profileId)
        .eq('group_name', 'Spouse / Partner')
        .eq('connection_status', 'connected');

      setHouseholdMembers(members || []);
    } catch (error) {
      toast.error('Failed to load family');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) =>
    (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const isEmpty = childProfiles.length === 0 && householdMembers.length === 0;

  if (loading) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2 pt-3 px-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Family</p>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Family</p>
            <Button variant="link" className="text-xs p-0 h-auto text-sky-blue" onClick={() => navigate('/Contacts')}>
              Add family
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-xs text-slate-600">Add family members to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Family</p>
          <Button variant="link" className="text-xs p-0 h-auto text-sky-blue" onClick={() => navigate('/Contacts')}>
            View all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="grid grid-cols-3 gap-3">
          {householdMembers.map((member) => (
            <div
              key={member.id}
              className="flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg p-2 transition-colors"
              onClick={() => navigate('/Contacts')}
            >
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-teal-100 text-teal-700 font-semibold text-sm">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <p className="text-xs font-medium text-slate-900 truncate w-full text-center">
                {(member.name || member.email).split(' ')[0]}
              </p>
            </div>
          ))}
          {[...childProfiles]
            .sort((a, b) => (pendingCounts[b.id] || 0) - (pendingCounts[a.id] || 0))
            .slice(0, 6)
            .map((child) => {
              const displayName = child.display_name || child.child_name || `${child.first_name || ''} ${child.last_name || ''}`.trim();
              const pendingCount = pendingCounts[child.id] || 0;
              return (
                <div
                  key={child.id}
                  className="flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg p-2 transition-colors"
                  onClick={() => navigate(`/Contacts/family/${child.id}`)}
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      {child.avatar_url && !child.avatar_url.startsWith('color:') && (
                        <AvatarImage src={child.avatar_url} alt={displayName} className="object-cover" />
                      )}
                      <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold text-sm">
                        {getInitials(displayName)}
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
                  <p className="text-xs font-medium text-slate-900 truncate w-full text-center">
                    {displayName.split(' ')[0]}
                  </p>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
