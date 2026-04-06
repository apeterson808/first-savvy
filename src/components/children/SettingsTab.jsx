import { useState, useEffect, useRef } from 'react';
import { childProfilesAPI } from '@/api/childProfiles';
import { profileSharesAPI } from '@/api/profileShares';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Edit, Lock, LockOpen, Shield, Trash2 } from 'lucide-react';
import { InviteChildDialog } from './InviteChildDialog';
import { ShareProfileDialog } from './ShareProfileDialog';
import { PINManagementDialog } from './PINManagementDialog';
import AvatarSelector from './AvatarSelector';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

const PERMISSION_LEVELS = {
  view_only: 'View Only',
  editor: 'Editor',
  co_parent: 'Co-Parent'
};

export function SettingsTab({ child, currentProfileId, onUpdate, onDelete }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    date_of_birth: '',
    gender: '',
    notes: '',
    username: '',
    email: '',
  });
  const [originalData, setOriginalData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [shares, setShares] = useState([]);
  const [invitation, setInvitation] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPINDialog, setShowPINDialog] = useState(false);
  const [pinValue, setPinValue] = useState('');

  useEffect(() => {
    loadAccessData();
    if (child) {
      const data = {
        first_name: child.first_name || '',
        last_name: child.last_name || '',
        display_name: child.display_name || '',
        date_of_birth: child.date_of_birth || '',
        gender: child.gender || '',
        notes: child.notes || '',
        username: child.username || '',
        email: child.email || '',
        pin: '',
      };
      setFormData(data);
      setOriginalData(data);
      setHasChanges(false);
      setPinValue('');
    }
  }, [child]);

  useEffect(() => {
    const changed = JSON.stringify(formData) !== JSON.stringify(originalData) || (pinValue && pinValue.length === 4);
    setHasChanges(changed);
  }, [formData, originalData, pinValue]);

  const loadAccessData = async () => {
    try {
      setLoadingAccess(true);
      const [sharesData, invitationData] = await Promise.all([
        profileSharesAPI.getSharesByChildProfile(child.id),
        profileInvitationsAPI.getActiveInvitation(child.id)
      ]);
      setShares(sharesData || []);
      setInvitation(invitationData);
    } catch (error) {
      console.error('Error loading access data:', error);
    } finally {
      setLoadingAccess(false);
    }
  };

  const getInvitationStatus = () => {
    if (child.user_id) {
      return { text: 'Connected', variant: 'success' };
    }

    if (!invitation) {
      return { text: 'Invite', variant: 'default' };
    }

    if (invitation.status === 'pending') {
      const isExpired = new Date(invitation.invitation_expires_at) < new Date();
      if (isExpired) {
        return { text: 'Invite', variant: 'default' };
      }
      return { text: 'Resend Invite', variant: 'secondary' };
    }

    return { text: 'Invite', variant: 'default' };
  };

  const handleInviteClick = () => {
    if (child.user_id) return;
    setShowInviteDialog(true);
  };


  const handleSave = async () => {
    try {
      setIsSaving(true);

      if (pinValue && pinValue.length === 4) {
        await childProfilesAPI.setChildPin(child.id, pinValue);
      }

      await childProfilesAPI.updateChildProfile(child.id, formData);
      toast.success('Changes saved successfully');
      setOriginalData(formData);
      setHasChanges(false);
      setIsEditMode(false);
      setPinValue('');
      onUpdate();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(originalData);
    setHasChanges(false);
    setIsEditMode(false);
  };

  const handleUnlockAccount = async () => {
    try {
      await childProfilesAPI.unlockChildAccount(child.id);
      toast.success('Account unlocked successfully');
      onUpdate();
    } catch (error) {
      console.error('Error unlocking account:', error);
      toast.error('Failed to unlock account');
    }
  };

  const handleAvatarChange = async (newAvatar) => {
    try {
      let avatarUrl = null;

      if (newAvatar.type === 'color') {
        avatarUrl = `color:${newAvatar.value}`;
      }

      if (avatarUrl) {
        await childProfilesAPI.updateChildProfile(child.id, { avatar_url: avatarUrl });
        toast.success('Avatar color updated');
        setAvatar(null);
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast.error('Failed to update avatar');
    }
  };

  return (
    <>
      <div className="max-w-5xl">
        <Card>
          <CardContent className="p-0">
            <div className="p-6 border-b bg-gradient-to-b from-slate-50/50 to-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Profile Settings</h2>
                  <p className="text-sm text-slate-500 mt-1">Manage profile information and access</p>
                </div>
                <div className="flex items-center gap-2">
                  {isEditMode ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancel}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving || !hasChanges}
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditMode(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>

              {child.account_locked && (
                <div className="mt-4 flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-red-700">
                    <Lock className="h-4 w-4" />
                    <span>Account locked due to failed login attempts</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnlockAccount}
                  >
                    <LockOpen className="h-4 w-4 mr-2" />
                    Unlock
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x">
              <div className="lg:col-span-2 p-8 space-y-8">
                <div className="flex items-center gap-6 pb-6 border-b">
                  <AvatarSelector
                    value={avatar}
                    onChange={handleAvatarChange}
                    firstName={formData.first_name}
                    lastName={formData.last_name}
                    currentAvatar={child.avatar_url}
                    compact={true}
                  />
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-slate-900">
                      {child.display_name || `${child.first_name || ''} ${child.last_name || ''}`.trim() || 'Unnamed Profile'}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge
                        variant={getInvitationStatus().variant === 'success' ? 'default' : 'outline'}
                        className={`text-xs`}
                      >
                        {getInvitationStatus().text}
                      </Badge>
                      {child.last_login_at && (
                        <span className="text-xs text-slate-500">
                          Last login {formatDistanceToNow(new Date(child.last_login_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">First Name</Label>
                        {isEditMode ? (
                          <Input
                            value={formData.first_name}
                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                            placeholder="First name"
                          />
                        ) : (
                          <div className="text-sm text-slate-900 py-2">
                            {child.first_name || <span className="text-slate-400">Not set</span>}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Last Name</Label>
                        {isEditMode ? (
                          <Input
                            value={formData.last_name}
                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                            placeholder="Last name"
                          />
                        ) : (
                          <div className="text-sm text-slate-900 py-2">
                            {child.last_name || <span className="text-slate-400">Not set</span>}
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Display Name</Label>
                        {isEditMode ? (
                          <>
                            <Input
                              value={formData.display_name}
                              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                              placeholder={`${formData.first_name} ${formData.last_name}`.trim() || 'Display name'}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              Leave blank to use first and last name
                            </p>
                          </>
                        ) : (
                          <div className="text-sm text-slate-900 py-2">
                            {child.display_name || (
                              <span className="text-slate-600">
                                {`${child.first_name || ''} ${child.last_name || ''}`.trim() || <span className="text-slate-400">Not set</span>}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Date of Birth</Label>
                        {isEditMode ? (
                          <Input
                            type="date"
                            value={formData.date_of_birth}
                            onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                          />
                        ) : (
                          <div className="text-sm text-slate-900 py-2">
                            {child.date_of_birth ? format(new Date(child.date_of_birth), 'MMMM d, yyyy') : <span className="text-slate-400">Not set</span>}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Gender</Label>
                        {isEditMode ? (
                          <Select
                            value={formData.gender}
                            onValueChange={(value) => setFormData({ ...formData, gender: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-sm text-slate-900 py-2">
                            {child.gender ? child.gender.charAt(0).toUpperCase() + child.gender.slice(1) : <span className="text-slate-400">Not set</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-slate-500" />
                      Account & Security
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Username</Label>
                        {isEditMode ? (
                          <Input
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                            placeholder="username"
                            className="font-mono"
                            maxLength={20}
                          />
                        ) : (
                          <div className="text-sm font-mono text-slate-900 py-2">
                            {child.username || <span className="text-slate-400">Not set</span>}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">PIN</Label>
                        {isEditMode ? (
                          <Input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            value={pinValue}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^\d*$/.test(value)) {
                                setPinValue(value);
                              }
                            }}
                            placeholder={child.pin_plaintext || "Set 4-digit PIN"}
                          />
                        ) : (
                          <div className="text-sm text-slate-900 py-2">
                            {child.pin_plaintext || <span className="text-slate-400">Not set</span>}
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Email Address</Label>
                        {isEditMode ? (
                          <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="email@example.com"
                          />
                        ) : (
                          <div className="text-sm text-slate-900 py-2">
                            {child.email || <span className="text-slate-400">Not set</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Notes</h3>
                    {isEditMode ? (
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={4}
                        placeholder="Add notes about this profile..."
                        className="resize-none"
                      />
                    ) : (
                      <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 min-h-[100px]">
                        {child.notes || <span className="text-slate-400">No notes added</span>}
                      </div>
                    )}
                  </div>
                </div>

                {onDelete && (
                  <div className="pt-6 border-t">
                    <h3 className="text-sm font-semibold text-red-600 mb-2">Delete Profile</h3>
                    <p className="text-xs text-slate-600 mb-4">
                      This action cannot be undone. All data associated with this profile will be permanently deleted.
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={onDelete}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete Profile
                    </Button>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50/30">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-900">Access & Sharing</h3>
                      <Badge variant="outline" className="text-xs">
                        {shares.length}/3
                      </Badge>
                    </div>
                    <Button
                      onClick={() => setShowShareDialog(true)}
                      variant="outline"
                      size="sm"
                      disabled={shares.length >= 3}
                      className="w-full justify-start"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Share Profile
                    </Button>
                  </div>

                  {shares.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-slate-600">
                        Shared With
                      </div>
                      {shares.map((share) => (
                        <div
                          key={share.id}
                          className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-blue-100 text-blue-700 font-medium">
                              {share.shared_with_profile?.display_name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {share.shared_with_profile?.display_name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {PERMISSION_LEVELS[share.permission_level]}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {shares.length === 0 && (
                    <div className="text-center py-12">
                      <Users className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-xs text-slate-500">No shared access yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <InviteChildDialog
        open={showInviteDialog}
        onOpenChange={(open) => {
          setShowInviteDialog(open);
          if (!open) loadAccessData();
        }}
        childProfile={child}
        currentProfileId={currentProfileId}
      />

      <ShareProfileDialog
        open={showShareDialog}
        onOpenChange={(open) => {
          setShowShareDialog(open);
          if (!open) loadAccessData();
        }}
        childProfile={child}
        currentProfileId={currentProfileId}
      />

      <PINManagementDialog
        open={showPINDialog}
        onOpenChange={setShowPINDialog}
        childProfile={child}
        onSuccess={onUpdate}
      />
    </>
  );
}
