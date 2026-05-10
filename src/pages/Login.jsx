import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Eye, EyeOff, Users, Search, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  // 'form' | 'household' | 'household-search' | 'household-sent'
  const [postSignupStep, setPostSignupStep] = useState(null);
  const [newUserId, setNewUserId] = useState(null);
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [householdEmail, setHouseholdEmail] = useState('');
  const [householdSearchResult, setHouseholdSearchResult] = useState(null);
  const [householdSearching, setHouseholdSearching] = useState(false);
  const [householdConnecting, setHouseholdConnecting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await firstsavvy.auth.signIn(email, password);
        navigate('/Dashboard');
      } else {
        const result = await firstsavvy.auth.signUp(email, password, { firstName, lastName, phone });
        if (result?.session) {
          setNewUserId(result.session.user.id);
          setNewUserDisplayName([firstName, lastName].filter(Boolean).join(' ') || email);
          setPostSignupStep('household');
        } else {
          setSignUpSuccess(true);
        }
      }
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

  const handleHouseholdSearch = async (e) => {
    e.preventDefault();
    if (!householdEmail.trim()) return;
    setHouseholdSearching(true);
    setHouseholdSearchResult(null);
    try {
      const { data, error } = await supabase.rpc('find_user_by_email', { p_email: householdEmail.trim().toLowerCase() });
      if (error) throw error;
      setHouseholdSearchResult(!data || data.length === 0 ? 'not_found' : data[0]);
    } catch {
      toast.error('Search failed. Please try again.');
    } finally {
      setHouseholdSearching(false);
    }
  };

  const handleHouseholdConnect = async () => {
    if (!householdSearchResult || householdSearchResult === 'not_found') return;
    setHouseholdConnecting(true);
    try {
      const { data: result, error } = await supabase.rpc('request_join_household', {
        p_owner_user_id: householdSearchResult.user_id,
        p_requester_display_name: newUserDisplayName,
      });
      if (error) throw error;
      if (result?.already_member) {
        toast.success('You are already connected to this household');
        navigate('/Dashboard');
      } else {
        setPostSignupStep('household-sent');
      }
    } catch {
      toast.error('Failed to send request. Please try again.');
    } finally {
      setHouseholdConnecting(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  if (postSignupStep === 'household' || postSignupStep === 'household-search' || postSignupStep === 'household-sent') {
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
          </CardHeader>
          <CardContent className="space-y-4">
            {postSignupStep === 'household-sent' ? (
              <div className="text-center space-y-4 py-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-lg">Request sent!</p>
                  <p className="text-sm text-slate-500 mt-1">
                    <span className="font-medium">{householdSearchResult?.display_name || householdSearchResult?.email}</span> will be notified and can approve your request.
                  </p>
                </div>
                <Button className="w-full" onClick={() => navigate('/')}>Continue</Button>
              </div>
            ) : postSignupStep === 'household-search' ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 mb-3 mx-auto">
                    <Search className="w-6 h-6 text-teal-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">Find a Household</h2>
                  <p className="text-sm text-slate-500 mt-1">Enter the email of the household owner you want to join.</p>
                </div>
                <form onSubmit={handleHouseholdSearch} className="flex gap-2">
                  <Input
                    type="email"
                    value={householdEmail}
                    onChange={(e) => { setHouseholdEmail(e.target.value); setHouseholdSearchResult(null); }}
                    placeholder="their@email.com"
                    disabled={householdSearching || householdConnecting}
                    className="flex-1"
                    autoFocus
                  />
                  <Button type="submit" variant="outline" disabled={householdSearching || !householdEmail.trim() || householdConnecting}>
                    {householdSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </form>
                {householdSearchResult === 'not_found' && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    No account found with that email. Make sure they have a First Savvy account.
                  </div>
                )}
                {householdSearchResult && householdSearchResult !== 'not_found' && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                        {(householdSearchResult.display_name || householdSearchResult.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm">{householdSearchResult.display_name || householdSearchResult.email}</p>
                        <p className="text-xs text-slate-500 truncate">{householdSearchResult.email}</p>
                      </div>
                      <CheckCircle className="w-5 h-5 text-teal-600 shrink-0" />
                    </div>
                    <div className="rounded-md bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-800">
                      Your request will be sent for approval. They choose your role (e.g. Spouse, View-only).
                    </div>
                    <Button className="w-full" onClick={handleHouseholdConnect} disabled={householdConnecting}>
                      {householdConnecting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending...</> : 'Send join request'}
                    </Button>
                  </div>
                )}
                <Button variant="ghost" className="w-full text-slate-500 text-sm" onClick={() => setPostSignupStep('household')} disabled={householdConnecting}>
                  Back
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 mb-3 mx-auto">
                    <Users className="w-6 h-6 text-teal-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">One more thing</h2>
                  <p className="text-sm text-slate-500 mt-1">Are you joining an existing household or starting fresh?</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full h-auto py-4 flex flex-col items-center gap-1 border-2 hover:border-teal-400 hover:bg-teal-50 transition-colors"
                  onClick={() => setPostSignupStep('household-search')}
                >
                  <span className="font-semibold text-slate-800">Join an existing household</span>
                  <span className="text-xs text-slate-500 font-normal">Send a request to someone already on First Savvy</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-auto py-4 flex flex-col items-center gap-1 hover:bg-slate-50 transition-colors"
                  onClick={() => navigate('/Dashboard')}
                >
                  <span className="font-semibold text-slate-800">Start fresh</span>
                  <span className="text-xs text-slate-500 font-normal">Set up my own independent account</span>
                </Button>
              </div>
            )}
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
          {signUpSuccess ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-lg">Check your email</p>
                <p className="text-sm text-slate-500 mt-1">
                  We sent a confirmation link to <span className="font-medium text-slate-700">{email}</span>. Click it to activate your account.
                </p>
              </div>
              <p className="text-xs text-slate-400">
                After confirming your email and signing in, you'll be able to connect to an existing household.
              </p>
              <button
                type="button"
                onClick={() => { setSignUpSuccess(false); setIsLogin(true); }}
                className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-4"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
          <>
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
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    disabled={loading}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">
                {isLogin ? 'Email or Username' : 'Email'}{!isLogin && <span className="text-red-500"> *</span>}
              </Label>
              <Input
                id="email"
                type={isLogin ? 'text' : 'email'}
                placeholder={isLogin ? 'you@example.com or username' : 'you@example.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {isLogin ? 'Password or PIN' : 'Password'}{!isLogin && <span className="text-red-500"> *</span>}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isLogin ? '•••••••• or PIN' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

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

          {!isLogin && (
            <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 text-center">
              Joining an existing household? Create your account first — you'll be able to connect to a household on the next screen.
            </div>
          )}

          <div className="text-center text-sm">
            <button
              type="button"
              onClick={switchMode}
              className="text-slate-600 hover:text-slate-900 underline underline-offset-4"
              disabled={loading}
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
