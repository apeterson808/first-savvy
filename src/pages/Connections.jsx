import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/contexts/ProfileContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Briefcase, Home } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/api/supabaseClient';
import { CreateChildProfileSheet } from '@/components/profiles/CreateChildProfileSheet';
import { CreateProfileDialog } from '@/components/profiles/CreateProfileDialog';
import { differenceInYears } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function Connections() {
  const navigate = useNavigate();
  const { switchProfile, activeProfile, refreshProfiles } = useProfile();
  const [childProfiles, setChildProfiles] = useState([]);
  const [businessProfiles, setBusinessProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateChild, setShowCreateChild] = useState(false);
  const [showCreateBusiness, setShowCreateBusiness] = useState(false);

  useEffect(() => {
    loadAllProfiles();
  }, []);

  const loadAllProfiles = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('profile_type', 'personal')
        .eq('is_deleted', false)
        .single();

      if (!ownerProfile) return;

      const { data: children, error: childrenError } = await supabase
        .from('child_profiles')
        .select('*')
        .eq('parent_profile_id', ownerProfile.id)
        .order('child_name', { ascending: true });

      if (childrenError) throw childrenError;

      const { data: businesses, error: businessError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('profile_type', 'business')
        .eq('is_deleted', false)
        .order('display_name', { ascending: true });

      if (businessError) throw businessError;

      setChildProfiles(children || []);
      setBusinessProfiles(businesses || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChild = (child) => {
    navigate(`/Connections/${child.id}`);
  };

  const handleOpenBusiness = async (business) => {
    try {
      await switchProfile(business);
      toast.success(`Switched to ${business.display_name}`);
    } catch (error) {
      console.error('Error switching to business profile:', error);
      toast.error('Failed to switch profile');
    }
  };


  const getAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    return differenceInYears(new Date(), new Date(dateOfBirth));
  };

  const getTierInfo = (level) => {
    const tiers = {
      1: { name: 'Basic Access', color: 'bg-slate-100 text-slate-700' },
      2: { name: 'Rewards', color: 'bg-blue-100 text-blue-700' },
      3: { name: 'Money', color: 'bg-green-100 text-green-700' },
    };
    return tiers[level] || tiers[1];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading child profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Home className="h-5 w-5 text-blue-600" />
            Family ({childProfiles.length})
          </h2>
          {childProfiles.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <Card
                className="hover:shadow-md transition-shadow cursor-pointer border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100"
                onClick={() => setShowCreateChild(true)}
              >
                <CardContent className="pt-4 pb-3 px-3">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                      <Plus className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="w-full">
                      <h3 className="font-semibold text-sm">Add Family Member</h3>
                      <p className="text-xs text-slate-600 mt-1">
                        Create profile
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {childProfiles.map((child) => {
              const age = getAge(child.date_of_birth);
              const initials = child.child_name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <Card
                  key={child.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleOpenChild(child)}
                >
                  <CardContent className="pt-4 pb-3 px-3">
                    <div className="flex flex-col items-center text-center gap-2">
                      <Avatar className="w-14 h-14">
                        <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold text-lg">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="w-full">
                        <h3 className="font-semibold text-sm truncate">{child.child_name}</h3>
                        {age && (
                          <p className="text-xs text-slate-600">
                            Age {age}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          Tier {child.current_permission_level}
                        </p>
                      </div>
                      {!child.is_active && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                          Inactive
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Card
              className="hover:shadow-md transition-shadow cursor-pointer border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100"
              onClick={() => setShowCreateChild(true)}
            >
              <CardContent className="pt-4 pb-3 px-3">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                    <Plus className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="w-full">
                    <h3 className="font-semibold text-sm">Add Family Member</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Create profile
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-orange-600" />
            Business
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <Card
              className="border-2 border-dashed border-slate-300 bg-slate-50 opacity-60 cursor-not-allowed"
            >
              <CardContent className="pt-4 pb-3 px-3">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                    <Plus className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="w-full">
                    <h3 className="font-semibold text-sm">Create Business Profile</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Coming soon
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <CreateChildProfileSheet
        open={showCreateChild}
        onOpenChange={setShowCreateChild}
        onChildCreated={async () => {
          await loadAllProfiles();
          await refreshProfiles();
        }}
        profileId={activeProfile?.id}
      />

      <CreateProfileDialog
        open={showCreateBusiness}
        onOpenChange={setShowCreateBusiness}
        onProfileCreated={async () => {
          await loadAllProfiles();
          await refreshProfiles();
        }}
        profileType="business"
      />
    </div>
  );
}
