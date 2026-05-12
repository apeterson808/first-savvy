import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { updatePassword } from '@/api/userSettings';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';

export default function SecurityTab() {
  const { signOut } = useAuth();
  const { activeProfile } = useProfile();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResetTransactionsDialog, setShowResetTransactionsDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResettingTransactions, setIsResettingTransactions] = useState(false);

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(newPassword);
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Password update error:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete account');

      toast.success('Your account has been deleted');
      await signOut();
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error(error.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  const handleResetTransactions = async () => {
    if (resetConfirmText !== 'RESET' || !activeProfile?.id) return;
    setIsResettingTransactions(true);
    try {
      const { error } = await supabase.rpc('reset_transactions_to_pending', {
        p_profile_id: activeProfile.id,
      });
      if (error) throw error;
      toast.success('All transactions moved back to pending');
      setShowResetTransactionsDialog(false);
      setResetConfirmText('');
    } catch (error) {
      console.error('Reset transactions error:', error);
      toast.error(error.message || 'Failed to reset transactions');
    } finally {
      setIsResettingTransactions(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="text-orange-600">Danger Zone</CardTitle>
          <CardDescription>
            These actions affect your financial data and cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 py-3 border-b border-orange-100">
            <div>
              <p className="font-medium text-sm">Reset Transactions to Pending</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Move all posted transactions back to pending and clear the audit history. Opening balances are preserved. All accounts, categories, and rules are kept.
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0 border-orange-300 text-orange-700 hover:bg-orange-50"
              onClick={() => { setResetConfirmText(''); setShowResetTransactionsDialog(true); }}
            >
              Reset Transactions
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4 pt-1">
            <div>
              <p className="font-medium text-sm">Delete Account</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              className="shrink-0"
              onClick={() => { setDeleteConfirmText(''); setShowDeleteDialog(true); }}
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showResetTransactionsDialog} onOpenChange={setShowResetTransactionsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset transactions to pending?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                This will move all posted transactions back to pending and erase the entire audit history for <strong>{activeProfile?.name || 'this profile'}</strong>.
              </span>
              <span className="block">
                <strong>Preserved:</strong> all transactions (moved to pending), accounts, categories, rules, opening balances.
              </span>
              <span className="block">
                <strong>Cleared:</strong> posted status, journal entries, audit history.
              </span>
              <span className="block pt-1">
                Type <strong>RESET</strong> below to confirm.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="Type RESET to confirm"
            className="my-2"
            disabled={isResettingTransactions}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResettingTransactions}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
              disabled={resetConfirmText !== 'RESET' || isResettingTransactions}
              onClick={handleResetTransactions}
            >
              {isResettingTransactions ? 'Resetting...' : 'Reset Transactions'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                This will permanently delete your account, all profiles, transactions, budgets, and every piece of data associated with your account. <strong>This cannot be undone.</strong>
              </span>
              <span className="block pt-1">
                Type <strong>DELETE</strong> below to confirm.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="my-2"
            disabled={isDeleting}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              onClick={handleDeleteAccount}
            >
              {isDeleting ? 'Deleting...' : 'Permanently Delete Account'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
