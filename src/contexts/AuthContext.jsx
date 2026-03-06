import React, { createContext, useContext, useState, useEffect } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    firstsavvy.auth.getSession()
      .then((session) => {
        setUser(session?.user || null);
        setLoading(false);
        setConnectionError(null);
      })
      .catch((error) => {
        setUser(null);
        setLoading(false);
        setConnectionError(error.message || 'Unable to connect to Supabase');
      });

    const subscription = firstsavvy.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      if (subscription?.data?.subscription) {
        subscription.data.subscription.unsubscribe();
      }
    };
  }, []);

  const value = {
    user,
    loading,
    connectionError,
    signOut: async () => {
      await firstsavvy.auth.signOut();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
