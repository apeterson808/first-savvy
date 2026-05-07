import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/contexts/ProfileContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Clock, CheckCircle, Users, Trash2, UserCheck, Search, Link2 } from 'lucide-react';
import { Loader2 as LoaderIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/api/supabaseClient';

const ADULT_FAMILY_ROLES = ['spouse_partner', 'parent', 'sibling', 'grandparent', 'other'];

const ROLE_LABELS = {
  spouse_partner: 'Spouse / Partner',
  parent: 'Parent',
  sibling: 'Sibling',
  grandparent: 'Grandparent',
  other: 'Family Member',
};

const AVATAR_COLORS = [
  { id: 'slate', bg: 'bg-slate-500', text: 'text-white' },
];

export function AdultFamilyMemberView({ child, onUpdate, onDelete }) {
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkSearchResult, setLinkSearchResult] = useState(null);
  const [linkSearching, setLinkSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  const getInitials = () => {
    if (child.first_name && child.last_name && child.first_name !== 'Invited') {
      return `${child.first_name[0]}${child.last_name[0]}`.toUpperCase();
    }
    const email = child.email || child.child_name || '';
    return email.slice(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    if (child.first_name && child.first_name !== 'Invited' && child.last_name) {
      return `${child.first_name} ${child.last_name}`;
    }
    return child.email || child.child_name || 'Family Member';
  };

  const roleLabel = ROLE_LABELS[child.family_role] || 'Family Member';
  const isPending = !child.user_id;
  const inviteEmail = child.email || child.child_name;

  const handleSearchUser = async (e) => {
    e.preventDefault();
    if (!linkEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setLinkSearching(true);
    setLinkSearchResult(null);
    try {
      const { data, error } = await supabase.rpc('find_user_by_email', { p_email: linkEmail.trim().toLowerCase() });
      if (error) throw error;
      setLinkSearchResult(!data || data.length === 0 ? 'not_found' : data[0]);
    } catch (error) {
      toast.error('Search failed: ' + (error.message || 'Unknown error'));
    } finally {
      setLinkSearching(false);
    }
  };

  const handleLink = async () => {
    if (!linkSearchResult || linkSearchResult === 'not_found') return;
    setLinking(true);
    try {
      await supabase
        .from('child_profiles')
        .update({ user_id: linkSearchResult.user_id })
        .eq('id', child.id);
      toast.success('Account linked successfully');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('Failed to link account');
    } finally {
      setLinking(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await childProfilesAPI.deleteChildProfile(child.id);
      toast.success('Profile removed');
      navigate('/Contacts');
    } catch (error) {
      toast.error('Failed to remove profile');
      setDeleting(false);
    }
  };

  return (
    <div className="h-full flex flex-col pb-6 p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/Contacts')}
          className="gap-2 text-slate-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="h-20 w-20 rounded-full bg-slate-500 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-white">{getInitials()}</span>
        </div>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold text-slate-900">{getDisplayName()}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-teal-100 text-teal-700 border-0 font-normal">{roleLabel}</Badge>
            {isPending ? (
              <Badge className="bg-amber-100 text-amber-700 border-0 font-normal gap-1">
                <Clock className="w-3 h-3" />
                Invitation Pending
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 border-0 font-normal gap-1">
                <CheckCircle className="w-3 h-3" />
                Connected
              </Badge>
            )}
          </div>
        </div>
      </div>

      {isPending && (
        <Card className="mb-4 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Link2 className="w-4 h-4" />
              Link Existing Account
            </CardTitle>
            <CardDescription>
              Enter their email address to find and link their existing account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSearchUser} className="flex gap-2">
              <Input
                type="email"
                value={linkEmail}
                onChange={(e) => { setLinkEmail(e.target.value); setLinkSearchResult(null); }}
                placeholder="their@email.com"
                disabled={linkSearching || linking}
                className="flex-1"
              />
              <Button type="submit" variant="outline" disabled={linkSearching || !linkEmail.trim() || linking}>
                {linkSearching ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </form>

            {linkSearchResult === 'not_found' && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No account found with that email. Make sure they have already signed up.
              </p>
            )}

            {linkSearchResult && linkSearchResult !== 'not_found' && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {(linkSearchResult.display_name || linkSearchResult.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{linkSearchResult.display_name || linkSearchResult.email}</p>
                    <p className="text-xs text-slate-500 truncate">{linkSearchResult.email}</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                </div>
                <Button size="sm" className="w-full" onClick={handleLink} disabled={linking}>
                  {linking ? 'Linking...' : 'Link Account'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isPending && (
        <Card className="mb-4 border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-800">
              <UserCheck className="w-4 h-4" />
              Shared Access Active
            </CardTitle>
            <CardDescription className="text-green-700">
              {getDisplayName()} has accepted the invitation and is connected to your account with full shared access.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            About Shared Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
            <span>Once accepted, both of you can view and manage the same financial data.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
            <span>Accounts, budgets, and transactions are fully visible to both parties.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
            <span>Each person maintains their own login and profile.</span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-auto pt-4 border-t border-slate-200">
        <Button
          variant="ghost"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Remove {roleLabel}
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this family member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{getDisplayName()}</strong> from your family connections. Any pending invitation will also be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
