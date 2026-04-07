import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { childProfilesAPI } from '@/api/childProfiles';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

export default function ChildLogin({ onBackToParentLogin }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: childProfile, error: lookupError } = await firstsavvy
        .from('child_profiles')
        .select('*')
        .eq('username', username.toLowerCase())
        .single();

      if (lookupError || !childProfile) {
        throw new Error('Invalid username or PIN');
      }

      if (!childProfile.user_id) {
        throw new Error('This child account has not been set up yet. Please contact your parent.');
      }

      const verifyResult = await childProfilesAPI.verifyChildPin(childProfile.id, pin);

      if (!verifyResult.valid) {
        throw new Error('Invalid username or PIN');
      }

      const childEmail = `child_${childProfile.id}@firstsavvy.internal`;

      const { data: authData, error: authError } = await firstsavvy.auth.signInWithPassword({
        email: childEmail,
        password: pin
      });

      if (authError) {
        throw new Error('Invalid username or PIN');
      }

      navigate('/Dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToParentLogin}
            className="w-fit -ml-2 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Parent Login
          </Button>
          <div className="flex flex-col items-center mb-4">
            <div className="flex flex-col leading-none text-center">
              <span className="text-[10px] font-light text-slate-400 tracking-wider">FIRST</span>
              <h1 className="text-[32px] font-bold text-slate-900 tracking-tight">SAVVY</h1>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            Welcome back
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Email or Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="you@example.com or username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">Password or PIN</Label>
              <Input
                id="pin"
                type="password"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                maxLength={6}
                inputMode="numeric"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || pin.length < 4}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-600">
            <p>Forgot your PIN? Ask your parent for help.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
