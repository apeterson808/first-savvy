import { useState, useEffect } from 'react';
import { childProfilesAPI } from '@/api/childProfiles';
import { profileSharesAPI } from '@/api/profileShares';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { calendarPreferencesAPI } from '@/api/calendarPreferences';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Lock, LockOpen, Shield, Trash2, Check } from 'lucide-react';
import { InviteChildDialog } from './InviteChildDialog';
import { ShareProfileDialog } from './ShareProfileDialog';
import { PINManagementDialog } from './PINManagementDialog';
import AvatarSelector, { PROFILE_COLORS } from './AvatarSelector';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

const PERMISSION_LEVELS = {
  view_only: 'View Only',
  editor: 'Editor',
  co_parent: 'Co-Parent',
};

function buildInitialForm(child) {
  return {
    first_name: child.first_name || '',
    last_name: child.last_name || '',
    display_name: child.display_name || '',
    date_of_birth: child.date_of_birth || '',
    gender: child.gender || '',
    notes: child.notes || '',
    username: child.username || '',
    email: child.email || '',
  };
}

export function SettingsTab({ child, currentProfileId, onUpdate, onDelete }) {
  const [formData, setFormData] = useState(() => buildInitialForm(child));
  const [savedForm, setSavedForm] = useState(() => buildInitialForm(child));
  const [pinValue, setPinValue] = useState('');

  // avatar pending change: { type: 'upload', file, previewUrl } | { type: 'color', colorId } | { type: 'icon', icon } | null
  const [pendingAvatar, setPendingAvatar] = useState(null);

  // calendar color
  const [calendarColor, setCalendarColor] = useState('#3b82f6');
  const [savedCalendarColor, setSavedCalendarColor] = useState('#3b82f6');

  const [isSaving, setIsSaving] = useState(false);
  const [shares, setShares] = useState([]);
  const [invitation, setInvitation] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showPINDialog, setShowPINDialog] = useState(false);

  useEffect(() => {
    const form = buildInitialForm(child);
    setFormData(form);
    setSavedForm(form);
    setPinValue('');
    setPendingAvatar(null);
    loadAccessData();
    loadCalendarColor();
  }, [child?.id]);

  const loadCalendarColor = async () => {
    if (!currentProfileId || !child?.id) return;
    try {
      const prefs = await calendarPreferencesAPI.getPreferences(currentProfileId);
      const color = prefs?.child_colors?.[child.id] || '#3b82f6';
      setCalendarColor(color);
      setSavedCalendarColor(color);
    } catch {}
  };

  const loadAccessData = async () => {
    try {
      setLoadingAccess(true);
      const [sharesData, invitationData] = await Promise.all([
        profileSharesAPI.getSharesByChildProfile(child.id),
        profileInvitationsAPI.getActiveInvitation(child.id),
      ]);
      setShares(sharesData || []);
      setInvitation(invitationData);
    } catch (err) {
      console.error('Error loading access data:', err);
    } finally {
      setLoadingAccess(false);
    }
  };

  const hasChanges =
    JSON.stringify(formData) !== JSON.stringify(savedForm) ||
    (pinValue && pinValue.length === 4) ||
    pendingAvatar !== null ||
    calendarColor !== savedCalendarColor;

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // PIN
      if (pinValue && pinValue.length === 4) {
        await childProfilesAPI.setChildPin(child.id, pinValue);
      }

      // Profile fields
      await childProfilesAPI.updateChildProfile(child.id, formData);

      // Avatar
      if (pendingAvatar) {
        let avatarUrl = null;
        if (pendingAvatar.type === 'remove-photo' || pendingAvatar.type === 'remove-icon') {
          avatarUrl = null; // clear to initials
          await childProfilesAPI.updateChildProfile(child.id, { avatar_url: null });
        } else if (pendingAvatar.type === 'icon') {
          avatarUrl = `icon:${pendingAvatar.iconName}`;
        } else if (pendingAvatar.type === 'upload' && pendingAvatar.file) {
          const file = pendingAvatar.file;
          const ext = file.name.split('.').pop();
          const path = `children/${child.id}/avatar.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(path, file, { upsert: true, contentType: file.type });
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        }
        if (avatarUrl !== null && pendingAvatar.type !== 'remove-photo' && pendingAvatar.type !== 'remove-icon') {
          await childProfilesAPI.updateChildProfile(child.id, { avatar_url: avatarUrl });
        }
      }

      // Calendar color
      if (calendarColor !== savedCalendarColor && currentProfileId) {
        const prefs = await calendarPreferencesAPI.getPreferences(currentProfileId);
        const existing = prefs?.child_colors || {};
        await calendarPreferencesAPI.upsertPreferences(currentProfileId, {
          child_colors: { ...existing, [child.id]: calendarColor },
        });
      }

      toast.success('Changes saved');
      setSavedForm(formData);
      setSavedCalendarColor(calendarColor);
      setPendingAvatar(null);
      setPinValue('');
      onUpdate();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(savedForm);
    setPinValue('');
    setPendingAvatar(null);
    setCalendarColor(savedCalendarColor);
  };

  const handleUnlockAccount = async () => {
    try {
      await childProfilesAPI.unlockChildAccount(child.id);
      toast.success('Account unlocked');
      onUpdate();
    } catch {
      toast.error('Failed to unlock account');
    }
  };

  const getInvitationStatus = () => {
    if (child.user_id) return { text: 'Connected', variant: 'success' };
    if (!invitation) return { text: 'Invite', variant: 'default' };
    if (invitation.status === 'pending') {
      const expired = new Date(invitation.invitation_expires_at) < new Date();
      return expired
        ? { text: 'Invite', variant: 'default' }
        : { text: 'Resend Invite', variant: 'secondary' };
    }
    return { text: 'Invite', variant: 'default' };
  };

  return (
    <>
      <div className="max-w-5xl">
        <Card>
          <CardContent className="p-0">
            {/* Header */}
            <div className="p-6 border-b bg-gradient-to-b from-slate-50/50 to-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Profile Settings</h2>
                  <p className="text-sm text-slate-500 mt-1">Manage profile information and access</p>
                </div>
                {hasChanges && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>

              {child.account_locked && (
                <div className="mt-4 flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-red-700">
                    <Lock className="h-4 w-4" />
                    <span>Account locked due to failed login attempts</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleUnlockAccount}>
                    <LockOpen className="h-4 w-4 mr-2" />
                    Unlock
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x">
              <div className="lg:col-span-2 p-8 space-y-8">

                {/* Avatar + identity header */}
                <div className="pb-6 border-b space-y-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">
                        {child.display_name || `${child.first_name || ''} ${child.last_name || ''}`.trim() || 'Unnamed Profile'}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <Badge
                          variant={getInvitationStatus().variant === 'success' ? 'default' : 'outline'}
                          className="text-xs"
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

                  {/* Unified avatar selector */}
                  <AvatarSelector
                    pending={pendingAvatar}
                    onPendingChange={setPendingAvatar}
                    firstName={formData.first_name}
                    lastName={formData.last_name}
                    currentAvatar={child.avatar_url}
                    currentColor={calendarColor}
                  />

                  {/* Profile & calendar color (single unified color) */}
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Profile Color</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {PROFILE_COLORS.map(({ hex, label }) => (
                        <button
                          key={hex}
                          type="button"
                          title={label}
                          onClick={() => setCalendarColor(hex)}
                          className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center"
                          style={{
                            backgroundColor: hex,
                            borderColor: calendarColor === hex ? 'white' : 'transparent',
                            boxShadow: calendarColor === hex ? `0 0 0 2px ${hex}` : 'none',
                          }}
                        >
                          {calendarColor === hex && <Check className="h-3 w-3 text-white stroke-[3]" />}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">Used as avatar background and for calendar events</p>
                  </div>
                </div>

                {/* Personal Information */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">First Name</Label>
                        <Input
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          placeholder="First name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Last Name</Label>
                        <Input
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          placeholder="Last name"
                        />
                      </div>

                      <div className="col-span-2 space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Display Name</Label>
                        <Input
                          value={formData.display_name}
                          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                          placeholder={`${formData.first_name} ${formData.last_name}`.trim() || 'Display name'}
                        />
                        <p className="text-xs text-slate-400">Leave blank to use first and last name</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Date of Birth</Label>
                        <Input
                          type="date"
                          value={formData.date_of_birth}
                          onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Gender</Label>
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
                      </div>
                    </div>
                  </div>

                  {/* Account & Security */}
                  <div className="pt-6 border-t">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-slate-500" />
                      Account & Security
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Username</Label>
                        <Input
                          value={formData.username}
                          onChange={(e) =>
                            setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })
                          }
                          placeholder="username"
                          className="font-mono"
                          maxLength={20}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">PIN</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          value={pinValue}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (/^\d*$/.test(v)) setPinValue(v);
                          }}
                          placeholder={child.pin_plaintext || 'Set 4-digit PIN'}
                        />
                      </div>

                      <div className="col-span-2 space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Email Address</Label>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="email@example.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="pt-6 border-t">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Notes</h3>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={4}
                      placeholder="Add notes about this profile..."
                      className="resize-none"
                    />
                  </div>
                </div>

                {/* Delete */}
                {onDelete && (
                  <div className="pt-6 border-t">
                    <h3 className="text-sm font-semibold text-red-600 mb-2">Delete Profile</h3>
                    <p className="text-xs text-slate-600 mb-4">
                      This action cannot be undone. All data associated with this profile will be permanently deleted.
                    </p>
                    <Button variant="destructive" size="sm" onClick={onDelete}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete Profile
                    </Button>
                  </div>
                )}
              </div>

              {/* Access & Sharing sidebar */}
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

                  {shares.length > 0 ? (
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-slate-600">Shared With</div>
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
                  ) : (
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
        onOpenChange={(open) => { setShowInviteDialog(open); if (!open) loadAccessData(); }}
        childProfile={child}
        currentProfileId={currentProfileId}
      />

      <ShareProfileDialog
        open={showShareDialog}
        onOpenChange={(open) => { setShowShareDialog(open); if (!open) loadAccessData(); }}
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
