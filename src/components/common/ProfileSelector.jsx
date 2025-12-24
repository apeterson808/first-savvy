import React from 'react';
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
import { toast } from 'sonner';

export function ProfileSelector({ open, onOpenChange }) {
  const { profiles, activeProfile, switchProfile, loading } = useProfile();

  const handleSelectProfile = async (profile) => {
    try {
      await switchProfile(profile);
      onOpenChange(false);
      toast.success(`Switched to ${profile.display_name}`);
    } catch (error) {
      console.error('Error switching profile:', error);
      toast.error('Failed to switch profile');
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

  const getProfileDescription = (profileType) => {
    switch (profileType) {
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
            {profiles.map((profile) => {
              const isActive = activeProfile?.id === profile.id;
              const Icon = getProfileIcon(profile.profile_type);

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
                        profile.profile_type === 'personal'
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
                      {getProfileDescription(profile.profile_type)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 capitalize">
                      Role: {profile.role}
                    </p>
                  </div>
                </button>
              );
            })}

            {profiles.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500">
                No profiles available
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-slate-400 mt-0.5" />
            <div className="text-xs text-slate-600">
              <p className="font-medium mb-1">Coming Soon: Create New Profiles</p>
              <p className="text-slate-500">
                Create household or business profiles to share financial data with others.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
