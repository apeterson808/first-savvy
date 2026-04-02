import React, { useState } from 'react';
import { User, Users, Briefcase, Baby } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';

export function AddProfileDialog({ open, onOpenChange, onProfileCreated }) {
  const [displayName, setDisplayName] = useState('');
  const [profileType, setProfileType] = useState('family');
  const [permissionLevel, setPermissionLevel] = useState(1);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!displayName.trim()) {
      toast.error('Please enter a profile name');
      return;
    }

    setCreating(true);
    try {
      const { data: { user: parentUser } } = await firstsavvy.auth.getUser();

      if (!parentUser) {
        throw new Error('Not authenticated');
      }

      if (profileType === 'child') {
        const { data: parentProfile } = await firstsavvy
          .from('profile_memberships')
          .select('profile_id')
          .eq('user_id', parentUser.id)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle();

        if (!parentProfile) {
          throw new Error('No parent profile found');
        }

        const { error: childProfileError } = await firstsavvy
          .from('child_profiles')
          .insert({
            parent_profile_id: parentProfile.profile_id,
            user_id: null,
            child_name: displayName.trim(),
            current_permission_level: permissionLevel,
            is_active: true,
          });

        if (childProfileError) throw childProfileError;
      } else {
        const { data: profile, error: profileError } = await firstsavvy
          .from('profiles')
          .insert({
            user_id: parentUser.id,
            profile_type: profileType,
            display_name: displayName.trim(),
            is_deleted: false,
          })
          .select()
          .single();

        if (profileError) throw profileError;

        const { error: membershipError } = await firstsavvy
          .from('profile_memberships')
          .insert({
            profile_id: profile.id,
            user_id: parentUser.id,
            role: 'owner',
          });

        if (membershipError) throw membershipError;
      }

      toast.success(`Profile "${displayName}" created successfully`);

      setDisplayName('');
      setPermissionLevel(1);
      setProfileType('family');
      onOpenChange(false);

      if (onProfileCreated) {
        await onProfileCreated();
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error(error.message || 'Failed to create profile');
    } finally {
      setCreating(false);
    }
  };

  const profileTypes = [
    {
      type: 'family',
      icon: Users,
      title: 'Family',
      description: 'Shared family finances',
      color: 'bg-green-500',
    },
    {
      type: 'business',
      icon: Briefcase,
      title: 'Business',
      description: 'Business financial management',
      color: 'bg-orange-500',
    },
    {
      type: 'child',
      icon: Baby,
      title: 'Child',
      description: 'Child financial profile',
      color: 'bg-blue-500',
    },
  ];

  const permissionLevels = [
    { level: 1, name: 'Basic Access', description: 'Dashboard and tasks only' },
    { level: 2, name: 'Rewards', description: 'Can view and redeem rewards' },
    { level: 3, name: 'Money', description: 'View accounts and budgets' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Profile</DialogTitle>
          <DialogDescription>
            Create a family, business, or child profile to manage separate finances.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Profile Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {profileTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = profileType === type.type;

                return (
                  <button
                    key={type.type}
                    onClick={() => setProfileType(type.type)}
                    disabled={creating}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full ${type.color} flex items-center justify-center`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-xs">{type.title}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">
              {profileType === 'child' ? "Child's Name" : 'Profile Name'}
            </Label>
            <Input
              id="displayName"
              type="text"
              placeholder={
                profileType === 'child'
                  ? "e.g., Emma, Alex"
                  : "e.g., Family Budget, Peterson Household"
              }
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={creating}
              autoFocus
            />
          </div>

          {profileType === 'child' && (
            <>
              <div className="space-y-2">
                <Label>Permission Tier</Label>
                <div className="space-y-2">
                  {permissionLevels.map((level) => (
                    <button
                      key={level.level}
                      onClick={() => setPermissionLevel(level.level)}
                      disabled={creating}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                        permissionLevel === level.level
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        permissionLevel === level.level
                          ? 'border-slate-900 bg-slate-900'
                          : 'border-slate-300'
                      }`}>
                        {permissionLevel === level.level && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">Tier {level.level}: {level.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {level.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !displayName.trim()}
            className="flex-1"
          >
            {creating ? 'Creating...' : 'Create Profile'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
