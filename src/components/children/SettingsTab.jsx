import { useState, useEffect } from 'react';
import { childProfilesAPI } from '@/api/childProfiles';
import { profileSharesAPI } from '@/api/profileShares';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Mail, Crown, X, CheckCircle, Clock, XCircle } from 'lucide-react';
import { InviteChildDialog } from './InviteChildDialog';
import { ShareProfileDialog } from './ShareProfileDialog';
import { toast } from 'sonner';

const PERMISSION_LEVELS = {
  view_only: 'View Only',
  editor: 'Editor',
  co_parent: 'Co-Parent'
};

export function SettingsTab({ child, onUpdate, currentProfileId }) {
  const [formData, setFormData] = useState({
    child_name: child.child_name,
    date_of_birth: child.date_of_birth || '',
    daily_spending_limit: child.daily_spending_limit || '',
    weekly_spending_limit: child.weekly_spending_limit || '',
    monthly_spending_limit: child.monthly_spending_limit || '',
    notes: child.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState([]);
  const [invitation, setInvitation] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    loadAccessData();
  }, [child.id]);

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

  const handleRevokeShare = async (shareId) => {
    try {
      await profileSharesAPI.revokeShare(shareId);
      toast.success('Access revoked');
      await loadAccessData();
    } catch (error) {
      console.error('Error revoking share:', error);
      toast.error('Failed to revoke access');
    }
  };

  const getInvitationStatusBadge = () => {
    if (child.user_id) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Account Active
        </Badge>
      );
    }

    if (!invitation) {
      return (
        <Badge variant="secondary">
          <Mail className="h-3 w-3 mr-1" />
          Not Invited
        </Badge>
      );
    }

    if (invitation.status === 'pending') {
      const isExpired = new Date(invitation.invitation_expires_at) < new Date();
      if (isExpired) {
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Invitation Expired
          </Badge>
        );
      }
      return (
        <Badge className="bg-amber-100 text-amber-800">
          <Clock className="h-3 w-3 mr-1" />
          Invitation Pending
        </Badge>
      );
    }

    return null;
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await childProfilesAPI.updateChildProfile(child.id, {
        child_name: formData.child_name,
        date_of_birth: formData.date_of_birth || null,
        daily_spending_limit: formData.daily_spending_limit ? parseFloat(formData.daily_spending_limit) : null,
        weekly_spending_limit: formData.weekly_spending_limit ? parseFloat(formData.weekly_spending_limit) : null,
        monthly_spending_limit: formData.monthly_spending_limit ? parseFloat(formData.monthly_spending_limit) : null,
        notes: formData.notes,
      });
      toast.success('Settings updated successfully');
      onUpdate();
    } catch (error) {
      console.error('Error updating child:', error);
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Update child's profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="child_name">Name</Label>
            <Input
              id="child_name"
              value={formData.child_name}
              onChange={(e) => setFormData({ ...formData, child_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spending Limits</CardTitle>
          <CardDescription>
            Set spending limits for Tier 3 (Money access)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily_spending_limit">Daily Limit</Label>
              <Input
                id="daily_spending_limit"
                type="number"
                step="0.01"
                min="0"
                value={formData.daily_spending_limit}
                onChange={(e) => setFormData({ ...formData, daily_spending_limit: e.target.value })}
                placeholder="$0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weekly_spending_limit">Weekly Limit</Label>
              <Input
                id="weekly_spending_limit"
                type="number"
                step="0.01"
                min="0"
                value={formData.weekly_spending_limit}
                onChange={(e) => setFormData({ ...formData, weekly_spending_limit: e.target.value })}
                placeholder="$0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthly_spending_limit">Monthly Limit</Label>
              <Input
                id="monthly_spending_limit"
                type="number"
                step="0.01"
                min="0"
                value={formData.monthly_spending_limit}
                onChange={(e) => setFormData({ ...formData, monthly_spending_limit: e.target.value })}
                placeholder="$0.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Access Management
          </CardTitle>
          <CardDescription>
            Manage who can access and control this child's profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium">Child Account Status</h4>
                <p className="text-sm text-slate-600">
                  {child.user_id
                    ? 'This child has an active account and can log in'
                    : 'This profile has not been claimed by the child yet'
                  }
                </p>
              </div>
              {getInvitationStatusBadge()}
            </div>

            {!child.user_id && (
              <div className="space-y-3">
                {invitation && invitation.status === 'pending' && (
                  <Alert>
                    <Mail className="h-4 w-4" />
                    <AlertDescription>
                      Invitation sent to {invitation.invited_email} on{' '}
                      {new Date(invitation.created_at).toLocaleDateString()}.
                      Expires {new Date(invitation.invitation_expires_at).toLocaleDateString()}.
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  onClick={() => setShowInviteDialog(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {invitation ? 'Resend Invitation' : 'Send Invitation to Child'}
                </Button>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium">Shared Access</h4>
                <p className="text-sm text-slate-600">
                  Other adults who can help manage this profile ({shares.length}/3)
                </p>
              </div>
              <Button
                onClick={() => setShowShareDialog(true)}
                variant="outline"
                size="sm"
                disabled={shares.length >= 3}
              >
                <Users className="h-4 w-4 mr-2" />
                Share Profile
              </Button>
            </div>

            {loadingAccess ? (
              <div className="text-center py-4 text-sm text-slate-500">
                Loading access information...
              </div>
            ) : shares.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                <Users className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                No shared access yet
              </div>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={share.shared_with_profile?.avatar_url} />
                        <AvatarFallback>
                          {share.shared_with_profile?.profile_name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {share.shared_with_profile?.profile_name}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-500">
                            {share.shared_with_profile?.user?.email}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {PERMISSION_LEVELS[share.permission_level]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeShare(share.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Alert>
            <Crown className="h-4 w-4" />
            <AlertDescription>
              As the profile owner, you always have full access to manage this child's profile,
              even if they have their own account.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
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
    </div>
  );
}
