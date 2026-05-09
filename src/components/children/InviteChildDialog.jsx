import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, AlertCircle, Check, Phone } from 'lucide-react';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { toast } from 'sonner';

export function InviteChildDialog({ open, onOpenChange, childProfile, currentProfileId }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteMethod, setInviteMethod] = useState('email');
  const [loading, setLoading] = useState(false);

  const handleSendInvite = async () => {
    const contactValue = inviteMethod === 'email' ? email : phone;

    if (!contactValue) {
      toast.error(`Please enter a ${inviteMethod === 'email' ? 'email address' : 'phone number'}`);
      return;
    }

    if (inviteMethod === 'email' && !contactValue.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      const invitation = await profileInvitationsAPI.createInvitation(
        childProfile.id,
        contactValue,
        currentProfileId
      );

      const inviteUrl = `${window.location.origin}/invite/${invitation.invitation_token}`;

      toast.success('Invitation sent!', {
        description: `We've sent an invitation to ${contactValue}`
      });

      setEmail('');
      setPhone('');
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
          <DialogTitle>Invite {childProfile?.display_name || childProfile?.child_name} to Claim Profile</DialogTitle>
          <DialogDescription>
            Send an email invitation to {childProfile?.display_name || childProfile?.child_name} to create their own account
            and take control of their financial profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Once {childProfile?.display_name || childProfile?.child_name} accepts the invitation and creates an account,
              you'll still be able to view and manage their profile as a parent.
            </AlertDescription>
          </Alert>

          <Tabs value={inviteMethod} onValueChange={setInviteMethod} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </TabsTrigger>
              <TabsTrigger value="phone">
                <Phone className="h-4 w-4 mr-2" />
                Phone
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-2 mt-4">
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
            </TabsContent>

            <TabsContent value="phone" className="space-y-2 mt-4">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-slate-500">
                The invitation will be sent via SMS and valid for 7 days
              </p>
            </TabsContent>
          </Tabs>

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
            disabled={
              loading ||
              (inviteMethod === 'email' ? !email : !phone) ||
              childProfile?.user_id
            }
          >
            {loading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
