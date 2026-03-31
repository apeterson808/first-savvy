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
  const [profileType, setProfileType] = useState('household');
  const [childEmail, setChildEmail] = useState('');
  const [childPassword, setChildPassword] = useState('');
  const [permissionLevel, setPermissionLevel] = useState(1);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!displayName.trim()) {
      toast.error('Please enter a profile name');
      return;
    }

    if (profileType === 'child') {
      if (!childEmail.trim()) {
        toast.error('Please enter an email for the child');
        return;
      }
      if (!childPassword || childPassword.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
    }

    setCreating(true);
    try {
      const { data: { user: parentUser } } = await firstsavvy.auth.getUser();

      if (!parentUser) {
        throw new Error('Not authenticated');
      }

      if (profileType === 'child') {
        const signUpData = await firstsavvy.auth.signUp(
          childEmail.trim(),
          childPassword,
          displayName.trim()
        );

        if (!signUpData.user) throw new Error('Failed to create user account');

        const childUserId = signUpData.user.id;

        const { data: profile, error: profileError } = await firstsavvy
          .from('profiles')
          .insert({
            user_id: childUserId,
            profile_type: 'personal',
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
            user_id: childUserId,
            role: 'owner',
          });

        if (membershipError) throw membershipError;

        const { data: parentProfile } = await firstsavvy
          .from('profile_memberships')
          .select('profile_id')
          .eq('user_id', parentUser.id)
          .eq('role', 'owner')
          .single();

        const { error: childProfileError } = await firstsavvy
          .from('child_profiles')
          .insert({
            parent_profile_id: parentProfile.profile_id,
            user_id: childUserId,
            child_name: displayName.trim(),
            current_permission_level: permissionLevel,
            is_active: true,
          });

        if (childProfileError) throw childProfileError;

        toast.success(`Child profile "${displayName}" created successfully`);
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

        toast.success(`Profile "${displayName}" created successfully`);
      }

      setDisplayName('');
      setChildEmail('');
      setChildPassword('');
      setPermissionLevel(1);
      setProfileType('household');
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
      type: 'household',
      icon: Users,
      title: 'Household',
      description: 'Shared household finances',
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
    { level: 1, name: 'Supervised', description: 'View chores, parent approves all' },
    { level: 2, name: 'Monitored', description: 'Small rewards, daily summaries' },
    { level: 3, name: 'Semi-Independent', description: 'Goals, cash with limits' },
    { level: 4, name: 'Independent', description: 'Full self-management' },
    { level: 5, name: 'Full Control', description: 'Complete ownership' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Profile</DialogTitle>
          <DialogDescription>
            Create a household, business, or child profile to manage separate finances.
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
                <Label htmlFor="childEmail">Email Address</Label>
                <Input
                  id="childEmail"
                  type="email"
                  placeholder="child@example.com"
                  value={childEmail}
                  onChange={(e) => setChildEmail(e.target.value)}
                  disabled={creating}
                />
                <p className="text-xs text-slate-500">
                  Child will use this email to log in
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="childPassword">Password</Label>
                <Input
                  id="childPassword"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={childPassword}
                  onChange={(e) => setChildPassword(e.target.value)}
                  disabled={creating}
                />
              </div>

              <div className="space-y-2">
                <Label>Permission Level</Label>
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
                        <div className="font-medium text-sm">Level {level.level}: {level.name}</div>
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
            disabled={creating || !displayName.trim() || (profileType === 'child' && (!childEmail.trim() || !childPassword))}
            className="flex-1"
          >
            {creating ? 'Creating...' : 'Create Profile'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
