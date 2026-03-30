import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, AlertCircle, X, Mail } from 'lucide-react';
import { profileSharesAPI } from '@/api/profileShares';
import { toast } from 'sonner';
import { supabase } from '@/api/supabaseClient';

const PERMISSION_LEVELS = {
  view_only: {
    label: 'View Only',
    description: 'Can view all data but cannot make changes'
  },
  editor: {
    label: 'Editor',
    description: 'Can view and modify data, but cannot delete or share'
  },
  co_parent: {
    label: 'Co-Parent',
    description: 'Full access including ability to share with others'
  }
};

export function ShareProfileDialog({ open, onOpenChange, childProfile, currentProfileId }) {
  const [email, setEmail] = useState('');
  const [permissionLevel, setPermissionLevel] = useState('editor');
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState([]);
  const [loadingShares, setLoadingShares] = useState(true);

  useEffect(() => {
    if (open && childProfile) {
      loadShares();
    }
  }, [open, childProfile]);

  const loadShares = async () => {
    try {
      setLoadingShares(true);
      const data = await profileSharesAPI.getSharesByChildProfile(childProfile.id);
      setShares(data || []);
    } catch (error) {
      console.error('Error loading shares:', error);
    } finally {
      setLoadingShares(false);
    }
  };

  const handleShareProfile = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (shares.length >= 3) {
      toast.error('Maximum limit reached', {
        description: 'You can share with up to 3 other adults (4 total including owner)'
      });
      return;
    }

    try {
      setLoading(true);

      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, profile_name, user_id')
        .eq('user_id', (
          await supabase.auth.admin.getUserByEmail(email)
        )?.data?.user?.id)
        .maybeSingle();

      if (userError || !userData) {
        toast.error('User not found', {
          description: 'No user with that email address exists in the system'
        });
        return;
      }

      const share = await profileSharesAPI.createShare(
        childProfile.id,
        userData.id,
        permissionLevel,
        currentProfileId
      );

      toast.success('Profile shared successfully', {
        description: `${userData.profile_name} can now access this profile`
      });

      setEmail('');
      setPermissionLevel('editor');
      await loadShares();
    } catch (error) {
      console.error('Error sharing profile:', error);
      toast.error('Failed to share profile', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeShare = async (shareId) => {
    try {
      await profileSharesAPI.revokeShare(shareId);
      toast.success('Access revoked');
      await loadShares();
    } catch (error) {
      console.error('Error revoking share:', error);
      toast.error('Failed to revoke access');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Share {childProfile?.child_name}'s Profile</DialogTitle>
          <DialogDescription>
            Share access with other trusted adults to help manage this child's financial profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              You can share this profile with up to 3 other adults (4 total including you).
              Currently {shares.length} of 3 slots used.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-email">Adult's Email Address</Label>
              <Input
                id="share-email"
                type="email"
                placeholder="adult@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || shares.length >= 3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="permission-level">Permission Level</Label>
              <Select
                value={permissionLevel}
                onValueChange={setPermissionLevel}
                disabled={loading || shares.length >= 3}
              >
                <SelectTrigger id="permission-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERMISSION_LEVELS).map(([value, { label, description }]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-slate-500">{description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleShareProfile}
              disabled={loading || !email || shares.length >= 3}
              className="w-full"
            >
              {loading ? 'Sharing...' : 'Share Profile'}
            </Button>
          </div>

          {shares.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Current Access</h4>
                {loadingShares ? (
                  <div className="text-center py-4 text-sm text-slate-500">
                    Loading...
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
                                {PERMISSION_LEVELS[share.permission_level]?.label}
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
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
