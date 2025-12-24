import React, { useState, useEffect } from 'react';
import { User, Users, Briefcase, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';

export function ProfileSelector({ open, onOpenChange }) {
  const { user } = useAuth();
  const { profileTabs, addProfileTab } = useProfile();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && user) {
      loadAvailableProfiles();
    }
  }, [open, user]);

  const loadAvailableProfiles = async () => {
    setLoading(true);
    try {
      const { data: profile, error } = await firstsavvy
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load available profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProfile = async (profileData) => {
    try {
      await addProfileTab(profileData);
      onOpenChange(false);
      toast.success(`Opened ${profileData.profile_name} profile`);
    } catch (error) {
      if (error.message.includes('Maximum')) {
        toast.error('Maximum of 10 profile tabs allowed');
      } else {
        toast.error('Failed to open profile');
      }
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isProfileOpen = (userId) => {
    return profileTabs.some((tab) => tab.profile_user_id === userId);
  };

  const availableProfiles = [];

  if (userProfile) {
    availableProfiles.push({
      id: user.id,
      name: userProfile.full_name || user.email || 'My Profile',
      email: userProfile.email || user.email,
      avatar_url: userProfile.avatar_url,
      type: 'personal',
      icon: User,
      description: 'Your personal financial profile',
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Open Profile</DialogTitle>
          <DialogDescription>
            Select a profile to open in a new tab. You can have up to 10 profiles open at once.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Loading available profiles...
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {availableProfiles.map((profile) => {
              const isOpen = isProfileOpen(profile.id);
              const Icon = profile.icon;

              return (
                <button
                  key={profile.id}
                  onClick={() =>
                    !isOpen &&
                    handleSelectProfile({
                      profile_user_id: profile.id,
                      profile_type: profile.type,
                      profile_name: profile.name,
                      profile_metadata: {
                        avatar_url: profile.avatar_url,
                        email: profile.email,
                      },
                    })
                  }
                  disabled={isOpen}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                    isOpen
                      ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={profile.avatar_url} alt={profile.name} />
                      <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${
                        profile.type === 'personal'
                          ? 'bg-blue-500'
                          : profile.type === 'household'
                          ? 'bg-green-500'
                          : 'bg-purple-500'
                      }`}
                    >
                      <Icon className="w-3 h-3 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-slate-900 truncate">
                        {profile.name}
                      </h4>
                      {isOpen && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="w-3 h-3 mr-1" />
                          Open
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{profile.email}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{profile.description}</p>
                  </div>
                </button>
              );
            })}

            {availableProfiles.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500">
                No additional profiles available
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-slate-400 mt-0.5" />
            <div className="text-xs text-slate-600">
              <p className="font-medium mb-1">Coming Soon: Household & Business Profiles</p>
              <p className="text-slate-500">
                Share your financial data with household members or manage multiple business profiles.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
