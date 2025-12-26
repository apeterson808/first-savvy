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
        const result = await ensureCompleteProvisioning();

        if (result?.success) {
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

      const { data: activeTabs, error: tabError } = await firstsavvy
        .from('profile_tabs')
        .select(`
          id,
          owner_user_id,
          display_name,
          profile:profiles!profile_tabs_profile_id_fkey (
            id,
            profile_type,
            display_name,
            is_deleted
          )
        `)
        .eq('owner_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (tabError && tabError.code !== 'PGRST116') {
        console.error('Error loading active tab:', tabError);
      }

      let activeProfileToSet = null;

      if (activeTabs && activeTabs.profile && !activeTabs.profile.is_deleted) {
        const membership = memberships.find(m => m.profile?.id === activeTabs.profile.id);
        if (membership) {
          activeProfileToSet = {
            ...activeTabs.profile,
            role: membership.role
          };
        }
      }

      if (!activeProfileToSet && profilesList.length > 0) {
        activeProfileToSet = profilesList[0];
        const { error: activateError } = await firstsavvy
          .from('profile_tabs')
          .update({ is_active: true })
          .eq('owner_user_id', user.id)
          .eq('profile_id', activeProfileToSet.id);

        if (activateError) {
          console.error('Error setting default active tab:', activateError);
        }
      }

      setActiveProfile(activeProfileToSet);

      if (activeProfileToSet) {
        localStorage.setItem('activeProfileId', activeProfileToSet.id);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading profiles:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [user]);

  const ensureCompleteProvisioning = async () => {
    try {
      const { data, error } = await firstsavvy.rpc('ensure_complete_provisioning');

      if (error) throw error;

      if (data?.success) {
        const verificationResult = await verifyUserProvisioning();
        if (verificationResult && !verificationResult.success) {
          console.warn('Provisioning verification failed:', verificationResult.diagnostics);
        }
      }

      return data;
    } catch (err) {
      console.error('Error ensuring complete provisioning:', err);
      return null;
    }
  };

  const verifyUserProvisioning = async () => {
    try {
      const { data, error } = await firstsavvy.rpc('verify_user_provisioning');

      if (error) throw error;

      return data;
    } catch (err) {
      console.error('Error verifying user provisioning:', err);
      return null;
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const switchProfile = async (profile) => {
    if (!user || !profile) return;

    try {
      const { error: deactivateError } = await firstsavvy
        .from('profile_tabs')
        .update({ is_active: false })
        .eq('owner_user_id', user.id);

      if (deactivateError) {
        console.error('Error deactivating tabs:', deactivateError);
      }

      const { error: activateError } = await firstsavvy
        .from('profile_tabs')
        .update({ is_active: true })
        .eq('owner_user_id', user.id)
        .eq('profile_id', profile.id);

      if (activateError) {
        console.error('Error activating tab:', activateError);
      }

      setActiveProfile(profile);
      localStorage.setItem('activeProfileId', profile.id);

      window.dispatchEvent(new CustomEvent('profileSwitched', { detail: { profileId: profile.id } }));
    } catch (err) {
      console.error('Error switching profile:', err);
      throw err;
    }
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
