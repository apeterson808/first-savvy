import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

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
    base44.auth.getUser()
      .then(user => {
        setUser(user);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });

    const subscription = base44.auth.onAuthStateChange((event, session) => {
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
      await base44.auth.signOut();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
