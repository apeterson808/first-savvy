import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, AlertCircle, Check } from 'lucide-react';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { toast } from 'sonner';

export function InviteChildDialog({ open, onOpenChange, childProfile, currentProfileId }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendInvite = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      const invitation = await profileInvitationsAPI.createInvitation(
        childProfile.id,
        email,
        currentProfileId
      );

      const inviteUrl = `${window.location.origin}/invite/${invitation.invitation_token}`;

      toast.success('Invitation sent!', {
        description: `We've sent an invitation to ${email}`
      });

      setEmail('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error('Failed to send invitation', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite {childProfile?.child_name} to Claim Profile</DialogTitle>
          <DialogDescription>
            Send an email invitation to {childProfile?.child_name} to create their own account
            and take control of their financial profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Once {childProfile?.child_name} accepts the invitation and creates an account,
              you'll still be able to view and manage their profile as a parent.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="child@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-slate-500">
              The invitation will be valid for 7 days
            </p>
          </div>

          {childProfile && !childProfile.user_id && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 mt-0.5" />
              <div className="text-sm text-green-800">
                This profile is ready to be claimed. No account is currently linked.
              </div>
            </div>
          )}

          {childProfile && childProfile.user_id && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                This profile has already been claimed. You cannot send a new invitation.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSendInvite}
            disabled={loading || !email || childProfile?.user_id}
          >
            {loading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
