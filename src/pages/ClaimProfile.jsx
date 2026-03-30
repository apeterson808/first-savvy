import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Mail, Lock, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const LEVEL_NAMES = {
  1: 'Supervised',
  2: 'Monitored',
  3: 'Semi-Independent',
  4: 'Independent',
  5: 'Full Control',
};

export default function ClaimProfile() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      const data = await profileInvitationsAPI.getInvitationByToken(token);

      if (!data) {
        setError('Invalid invitation link');
        return;
      }

      if (data.status !== 'pending') {
        setError('This invitation has already been used or revoked');
        return;
      }

      if (new Date(data.invitation_expires_at) < new Date()) {
        setError('This invitation has expired');
        await profileInvitationsAPI.expireOldInvitations();
        return;
      }

      if (data.child_profile?.user_id) {
        setError('This profile has already been claimed');
        return;
      }

      setInvitation(data);
      setEmail(data.invited_email);
    } catch (err) {
      console.error('Error loading invitation:', err);
      setError('Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimProfile = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setClaiming(true);

      const { user: newUser, error: signUpError } = await signUp(email, password);

      if (signUpError) {
        toast.error('Failed to create account', {
          description: signUpError.message
        });
        return;
      }

      const result = await profileInvitationsAPI.acceptInvitation(token, newUser.id);

      if (!result.success) {
        toast.error('Failed to claim profile', {
          description: result.error
        });
        return;
      }

      toast.success('Profile claimed successfully!', {
        description: `Welcome ${result.child_name}! Redirecting to your dashboard...`
      });

      setTimeout(() => {
        navigate('/Dashboard');
      }, 2000);

    } catch (err) {
      console.error('Error claiming profile:', err);
      toast.error('Failed to claim profile', {
        description: err.message
      });
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-center">Invalid Invitation</CardTitle>
            <CardDescription className="text-center">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate('/Login')}
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  const childProfile = invitation.child_profile;
  const invitedBy = invitation.invited_by;
  const daysUntilExpiry = Math.ceil(
    (new Date(invitation.invitation_expires_at) - new Date()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">
            You've Been Invited!
          </CardTitle>
          <CardDescription className="text-center">
            {invitedBy?.profile_name} has invited you to claim your financial profile
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              This invitation expires in {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'}
            </AlertDescription>
          </Alert>

          <div className="bg-slate-100 rounded-lg p-6">
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={childProfile?.avatar_url} />
                <AvatarFallback className="text-lg">
                  {childProfile?.child_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-bold">{childProfile?.child_name}</h3>
                {childProfile?.date_of_birth && (
                  <p className="text-sm text-slate-600 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Age {Math.floor((new Date() - new Date(childProfile.date_of_birth)) / 31557600000)}
                  </p>
                )}
              </div>
              <Badge variant="outline">
                Level {childProfile?.current_permission_level}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white rounded p-3">
                <p className="text-xs text-slate-600 mb-1">Permission Level</p>
                <p className="font-medium">{LEVEL_NAMES[childProfile?.current_permission_level]}</p>
              </div>
              <div className="bg-white rounded p-3">
                <p className="text-xs text-slate-600 mb-1">Starting Balance</p>
                <p className="font-medium">${parseFloat(childProfile?.cash_balance || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleClaimProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-slate-100"
              />
              <p className="text-xs text-slate-500">
                This email was provided in your invitation
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Create Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={claiming}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={claiming}
                required
                minLength={8}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• You'll gain access to your financial profile</li>
                <li>• Your parent can still view and help manage your account</li>
                <li>• You can track your money, set goals, and learn financial skills</li>
                <li>• Your permission level determines what actions you can take</li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={claiming || !password || !confirmPassword}
            >
              {claiming ? 'Claiming Profile...' : 'Claim My Profile'}
            </Button>
          </form>

          <div className="text-center">
            <Button
              variant="link"
              onClick={() => navigate('/Login')}
              className="text-sm text-slate-600"
            >
              Already have an account? Log in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
