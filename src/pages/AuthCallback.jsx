import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const session = await firstsavvy.auth.getSession();

        if (session) {
          const lastVisitedPage = localStorage.getItem('lastVisitedPage');
          navigate(lastVisitedPage || '/Dashboard');
        } else {
          setError('No session found');
          setTimeout(() => navigate('/login'), 2000);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err.message);
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="text-burgundy text-lg">Authentication failed</div>
            <div className="text-slate-600">{error}</div>
            <div className="text-sm text-slate-500">Redirecting to login...</div>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-slate-600" />
            <div className="text-slate-600 text-lg">Completing sign in...</div>
          </>
        )}
      </div>
    </div>
  );
}
