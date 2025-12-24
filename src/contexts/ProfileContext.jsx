import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useAuth } from './AuthContext';

const ProfileContext = createContext(null);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

export const ProfileProvider = ({ children }) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfiles = useCallback(async () => {
    if (!user) {
      setProfiles([]);
      setActiveProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: memberships, error: membershipsError } = await firstsavvy
        .from('profile_memberships')
        .select(`
          role,
          profile:profiles (
            id,
            profile_type,
            display_name,
            is_deleted,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (membershipsError) throw membershipsError;

      if (!memberships || memberships.length === 0) {
        const profileId = await ensureDefaultProfile();

        if (profileId) {
          await loadProfiles();
          return;
        } else {
          throw new Error('Failed to create default profile');
        }
      }

      const profilesList = memberships
        .filter(m => m.profile && !m.profile.is_deleted)
        .map(m => ({
          ...m.profile,
          role: m.role
        }));

      setProfiles(profilesList);

      const savedProfileId = localStorage.getItem('activeProfileId');
      const savedProfile = profilesList.find(p => p.id === savedProfileId);

      if (savedProfile) {
        setActiveProfile(savedProfile);
      } else if (profilesList.length > 0) {
        setActiveProfile(profilesList[0]);
        localStorage.setItem('activeProfileId', profilesList[0].id);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading profiles:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [user]);

  const ensureDefaultProfile = async () => {
    try {
      const { data, error } = await firstsavvy.rpc('ensure_default_profile');

      if (error) throw error;

      return data;
    } catch (err) {
      console.error('Error ensuring default profile:', err);
      return null;
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const switchProfile = (profile) => {
    setActiveProfile(profile);
    localStorage.setItem('activeProfileId', profile.id);
  };

  const refreshProfiles = async () => {
    await loadProfiles();
  };

  const value = {
    profiles,
    activeProfile,
    loading,
    error,
    switchProfile,
    refreshProfiles
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};
