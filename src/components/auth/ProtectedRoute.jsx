import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Loader2, AlertCircle } from 'lucide-react';

export const ProtectedRoute = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [isChild, setIsChild] = useState(false);
  const [checkingChild, setCheckingChild] = useState(true);

  useEffect(() => {
    const checkChildStatus = async () => {
      if (!user) {
        setCheckingChild(false);
        return;
      }

      try {
        const { data: childProfile } = await firstsavvy
          .from('child_profiles')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        setIsChild(!!childProfile);
      } catch (error) {
        setIsChild(false);
      } finally {
        setCheckingChild(false);
      }
    };

    checkChildStatus();
  }, [user]);

  if (authLoading || checkingChild) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-slate-600" />
          <div className="text-slate-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isChild && location.pathname !== '/Dashboard' && location.pathname !== '/dashboard') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Access Restricted</h2>
          <p className="text-slate-600">
            Child accounts can only access the Dashboard. This page is only available to parent accounts.
          </p>
          <Navigate to="/Dashboard" replace />
        </div>
      </div>
    );
  }

  return children;
};
