import React, { useState } from 'react';
import { User, Users, Briefcase, Check, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';
import { AddProfileDialog } from './AddProfileDialog';

export function ProfileSelector({ open, onOpenChange, onOpenChildTab }) {
  const { profiles, activeProfile, switchProfile, loading, refreshProfiles, availableChildProfiles } = useProfile();
  const [showAddProfile, setShowAddProfile] = useState(false);

  const handleSelectProfile = async (profile) => {
    try {
      if (profile.is_child_profile && onOpenChildTab) {
        onOpenChildTab(profile);
        onOpenChange(false);
        toast.success(`Opened ${profile.display_name}`);
      } else {
        await switchProfile(profile);
        onOpenChange(false);
        toast.success(`Switched to ${profile.display_name}`);
      }
    } catch (error) {
      toast.error('Failed to switch profile');
    }
  };

  const handleProfileCreated = async (newProfile) => {
    await refreshProfiles();
    await switchProfile(newProfile);
    onOpenChange(false);
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

  const getProfileIcon = (profileType) => {
    switch (profileType) {
      case 'personal':
        return User;
      case 'household':
        return Users;
      case 'business':
        return Briefcase;
      default:
        return User;
    }
  };

  const getProfileDescription = (profile) => {
    if (profile.is_child_profile) {
      return `Child profile - Level ${profile.permission_level || 1}`;
    }

    switch (profile.profile_type) {
      case 'personal':
        return 'Your personal financial profile';
      case 'household':
        return 'Shared household finances';
      case 'business':
        return 'Business financial management';
      default:
        return 'Financial profile';
    }
  };

  const allProfiles = [...profiles, ...availableChildProfiles];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Switch Profile</DialogTitle>
          <DialogDescription>
            Select a profile to switch to. All financial data is scoped to the active profile.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Loading profiles...
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {allProfiles.map((profile) => {
              const isActive = activeProfile?.id === profile.id;
              const Icon = profile.is_child_profile ? User : getProfileIcon(profile.profile_type);

              return (
                <button
                  key={profile.id}
                  onClick={() => !isActive && handleSelectProfile(profile)}
                  disabled={isActive}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                    isActive
                      ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback>{getInitials(profile.display_name)}</AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${
                        profile.is_child_profile
                          ? 'bg-blue-500'
                          : profile.profile_type === 'personal'
                          ? 'bg-blue-500'
                          : profile.profile_type === 'household'
                          ? 'bg-green-500'
                          : 'bg-orange-500'
                      }`}
                    >
                      <Icon className="w-3 h-3 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-slate-900 truncate">
                        {profile.display_name}
                      </h4>
                      {isActive && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {getProfileDescription(profile)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 capitalize">
                      Role: {profile.role}
                    </p>
                  </div>
                </button>
              );
            })}

            {allProfiles.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500">
                No profiles available
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <Button
            onClick={() => setShowAddProfile(true)}
            variant="outline"
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Profile
          </Button>
        </div>
      </DialogContent>

      <AddProfileDialog
        open={showAddProfile}
        onOpenChange={setShowAddProfile}
        onProfileCreated={handleProfileCreated}
      />
    </Dialog>
  );
}
