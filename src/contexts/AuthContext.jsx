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

  useEffect(() => {
    console.log('[AuthContext] Initializing...');

    firstsavvy.auth.getUser()
      .then(user => {
        console.log('[AuthContext] Initial user check:', user ? 'User found' : 'No user');
        setUser(user);
        setLoading(false);
      })
      .catch((error) => {
        console.error('[AuthContext] Error getting user:', error);
        setUser(null);
        setLoading(false);
      });

    const subscription = firstsavvy.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Auth state changed:', event, session?.user ? 'User present' : 'No user');
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
