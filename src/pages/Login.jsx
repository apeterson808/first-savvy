import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Users } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('main');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [childProfiles, setChildProfiles] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    firstsavvy.auth.getUser().then(({ data }) => {
      if (data?.user) {
        navigate('/Dashboard');
      }
    }).catch(() => {});
  }, [navigate]);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await firstsavvy.auth.signIn(email, password);
      } else {
        await firstsavvy.auth.signUp(email, password, fullName);
      }
      navigate('/Dashboard');
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      await firstsavvy.auth.signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  const handleChildLoginClick = async () => {
    setError('');
    setMode('childAuth');
  };

  const handleChildAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await firstsavvy.auth.signIn(email, password);

      const { data: { user } } = await firstsavvy.auth.getUser();

      if (!user) {
        throw new Error('Authentication failed');
      }

      const { data: memberships } = await firstsavvy
        .from('profile_memberships')
        .select('profile:profiles!inner(id)')
        .eq('user_id', user.id)
        .eq('role', 'owner');

      if (!memberships || memberships.length === 0) {
        throw new Error('No profiles found');
      }

      const ownerProfileIds = memberships.map(m => m.profile.id);

      const { data: children, error: childError } = await firstsavvy
        .from('child_profiles')
        .select('*')
        .in('parent_profile_id', ownerProfileIds)
        .eq('is_active', true);

      if (childError) throw childError;

      if (children && children.length > 0) {
        setChildProfiles(children);
        setMode('childSelect');
      } else {
        setChildProfiles([]);
        setMode('childSelect');
      }

      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to authenticate');
      setLoading(false);
    }
  };

  const handleChildProfileSelect = async (childProfile) => {
    sessionStorage.setItem('viewingChildProfile', JSON.stringify({
      childProfileId: childProfile.id,
      profileId: childProfile.owned_by_profile_id,
      childName: childProfile.child_name
    }));

    navigate('/Dashboard');
  };

  const handleCreateChildProfile = () => {
    navigate('/Children');
  };

  if (mode === 'childAuth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex flex-col items-center mb-4">
              <div className="flex flex-col leading-none text-center">
                <span className="text-[10px] font-light text-slate-400 tracking-wider">FIRST</span>
                <h1 className="text-[32px] font-bold text-slate-900 tracking-tight">SAVVY</h1>
              </div>
            </div>
            <CardTitle className="text-2xl text-center">
              Parent Authentication
            </CardTitle>
            <CardDescription className="text-center">
              Sign in to access your child profiles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleChildAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Please wait
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </form>

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode('main');
                  setError('');
                  setEmail('');
                  setPassword('');
                }}
                className="text-slate-600 hover:text-slate-900 underline underline-offset-4"
                disabled={loading}
              >
                Back to main login
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'childSelect') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex flex-col items-center mb-4">
              <div className="flex flex-col leading-none text-center">
                <span className="text-[10px] font-light text-slate-400 tracking-wider">FIRST</span>
                <h1 className="text-[32px] font-bold text-slate-900 tracking-tight">SAVVY</h1>
              </div>
            </div>
            <CardTitle className="text-2xl text-center">
              Select Child Profile
            </CardTitle>
            <CardDescription className="text-center">
              Choose which child profile to view
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {childProfiles.length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 mb-4">No child profiles found</p>
                <Button onClick={handleCreateChildProfile} className="w-full">
                  Create Child Profile
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {childProfiles.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => handleChildProfileSelect(child)}
                    className="w-full p-4 border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                        {child.child_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{child.child_name}</p>
                        <p className="text-sm text-slate-500">Level {child.current_permission_level}</p>
                      </div>
                    </div>
                  </button>
                ))}
                <Button
                  onClick={handleCreateChildProfile}
                  variant="outline"
                  className="w-full mt-2"
                >
                  Create New Child Profile
                </Button>
              </div>
            )}

            <div className="text-center text-sm pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('main');
                  setError('');
                  setEmail('');
                  setPassword('');
                  setChildProfiles([]);
                }}
                className="text-slate-600 hover:text-slate-900 underline underline-offset-4"
              >
                Back to main login
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex flex-col items-center mb-4">
            <div className="flex flex-col leading-none text-center">
              <span className="text-[10px] font-light text-slate-400 tracking-wider">FIRST</span>
              <h1 className="text-[32px] font-bold text-slate-900 tracking-tight">SAVVY</h1>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin
              ? 'Sign in to your account to continue'
              : 'Sign up to start managing your finances'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">Or continue with</span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  disabled={loading}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait
                </>
              ) : (
                isLogin ? 'Sign In' : 'Sign Up'
              )}
            </Button>
          </form>

          {isLogin && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleChildLoginClick}
                disabled={loading}
              >
                <Users className="mr-2 h-4 w-4" />
                Sign In for Child
              </Button>
            </>
          )}

          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-slate-600 hover:text-slate-900 underline underline-offset-4"
              disabled={loading}
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
