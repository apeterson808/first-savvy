import { useState } from 'react';
import { Shield, Mail, Key, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import { updatePassword, updateEmail } from '../../api/userSettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { supabase } from '../../api/supabaseClient';

export default function SecurityTab({ user }) {
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [emailData, setEmailData] = useState({
    newEmail: '',
  });
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleEmailChange = (e) => {
    setEmailData({ newEmail: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (user?.id === 'demo') {
      toast.info('Demo mode: Changes are not saved');
      setPasswordData({ newPassword: '', confirmPassword: '' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoadingPassword(true);
    try {
      await updatePassword(passwordData.newPassword);
      toast.success('Password updated successfully');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();

    if (user?.id === 'demo') {
      toast.info('Demo mode: Changes are not saved');
      setEmailData({ newEmail: '' });
      return;
    }

    if (!emailData.newEmail || !emailData.newEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoadingEmail(true);
    try {
      await updateEmail(emailData.newEmail);
      toast.success('Confirmation email sent. Please check your inbox.');
      setEmailData({ newEmail: '' });
    } catch (error) {
      console.error('Error updating email:', error);
      toast.error(error.message || 'Failed to update email');
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleResetAccountData = async () => {
    setLoadingReset(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset account data');
      }

      toast.success('Account data reset successfully. Refreshing page...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error resetting account data:', error);
      toast.error(error.message || 'Failed to reset account data');
    } finally {
      setLoadingReset(false);
      setShowResetDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Email Address</CardTitle>
          </div>
          <CardDescription>
            Change your account email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentEmail">Current Email</Label>
              <Input
                id="currentEmail"
                type="email"
                value={user?.email || ''}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email</Label>
              <Input
                id="newEmail"
                type="email"
                value={emailData.newEmail}
                onChange={handleEmailChange}
                placeholder="Enter new email address"
              />
              <p className="text-xs text-muted-foreground">
                A confirmation link will be sent to your new email address
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={loadingEmail}>
                {loadingEmail ? 'Updating...' : 'Update Email'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>Password</CardTitle>
          </div>
          <CardDescription>
            Change your account password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                placeholder="Enter new password"
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters long
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Confirm new password"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={loadingPassword}>
                {loadingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Security Information</CardTitle>
          </div>
          <CardDescription>
            Your account security details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center py-2">
            <div>
              <p className="font-medium">Account Created</p>
              <p className="text-sm text-muted-foreground">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex justify-between items-center py-2">
            <div>
              <p className="font-medium">Last Sign In</p>
              <p className="text-sm text-muted-foreground">
                {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Irreversible actions that will permanently affect your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Reset Account Data</h4>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently delete all your financial data including transactions, accounts, budgets, and contacts. Your account will remain active but all data will be cleared.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowResetDialog(true)}
                disabled={loadingReset}
              >
                {loadingReset ? 'Resetting...' : 'Reset All Data'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all your:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Transactions</li>
                <li>Bank accounts and credit cards</li>
                <li>Budgets and categories</li>
                <li>Contacts and relationships</li>
                <li>All other financial data</li>
              </ul>
              <p className="mt-4 font-semibold">Your account and login credentials will remain intact.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAccountData}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
