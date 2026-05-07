import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useAuth } from './AuthContext';

const ProfileContext = createContext(null);

const getProfileNavigationKey = (profileId) => `profile_nav_${profileId}`;

const saveProfileNavigation = (profileId, pathname) => {
  if (profileId && pathname) {
    localStorage.setItem(getProfileNavigationKey(profileId), pathname);
  }
};

const getProfileNavigation = (profileId) => {
  if (!profileId) return null;
  return localStorage.getItem(getProfileNavigationKey(profileId));
};

const getDefaultPageForProfile = (profile) => {
  if (!profile) return '/dashboard';

  if (profile.is_child_profile) {
    const permissionLevel = profile.current_permission_level || 1;
    return '/dashboard';
  }

  return '/dashboard';
};

const isPageAllowedForProfile = (pathname, profile) => {
  if (!profile) return false;

  if (!profile.is_child_profile) {
    return true;
  }

  const permissionLevel = profile.current_permission_level || 1;

  const allowedPages = {
    '/dashboard': 1,
  };

  if (permissionLevel >= 2) {
    allowedPages['/goals'] = 2;
  }

  if (permissionLevel >= 3) {
    allowedPages['/banking'] = 3;
    allowedPages['/budgeting'] = 3;
    allowedPages['/calendar'] = 3;
    allowedPages['/net-worth'] = 3;
    allowedPages['/contacts'] = 3;
  }

  return allowedPages.hasOwnProperty(pathname);
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

export const ProfileProvider = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewingChildProfile, setViewingChildProfile] = useState(null);
  const [availableChildProfiles, setAvailableChildProfiles] = useState([]);

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

      const { data: childCheck } = await firstsavvy
        .from('child_profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (childCheck) {
        const childProfile = {
          id: childCheck.owned_by_profile_id,
          child_profile_id: childCheck.id,
          display_name: childCheck.display_name || childCheck.child_name,
          profile_type: 'child',
          is_child_profile: true,
          parent_profile_id: childCheck.parent_profile_id,
          owned_by_profile_id: childCheck.owned_by_profile_id,
          permission_level: childCheck.current_permission_level,
          current_permission_level: childCheck.current_permission_level,
          points_balance: childCheck.points_balance || 0,
          cash_balance: childCheck.cash_balance || 0,
          daily_spending_limit: childCheck.daily_spending_limit,
          weekly_spending_limit: childCheck.weekly_spending_limit,
          monthly_spending_limit: childCheck.monthly_spending_limit,
          date_of_birth: childCheck.date_of_birth,
          avatar_url: childCheck.avatar_url,
          child_name: childCheck.child_name,
          first_name: childCheck.first_name,
          last_name: childCheck.last_name,
          role: 'child'
        };

        setProfiles([childProfile]);
        setActiveProfile(childProfile);
        setViewingChildProfile({
          childProfileId: childCheck.id,
          profileId: childCheck.parent_profile_id,
          childName: childCheck.child_name,
          display_name: childCheck.display_name || childCheck.child_name,
          loginType: 'direct'
        });
        setLoading(false);
        return;
      }

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

      // If user joined a household as spouse/member, hide their own empty profile
      // and only show the shared household profile.
      const householdMemberships = memberships.filter(
        m => m.profile && !m.profile.is_deleted && m.role === 'member'
      );
      const hasHouseholdMembership = householdMemberships.length > 0;

      // Determine which memberships to actually show as tabs
      const visibleMemberships = hasHouseholdMembership
        ? memberships.filter(m => m.profile && !m.profile.is_deleted && m.role !== 'owner')
        : memberships.filter(m => m.profile && !m.profile.is_deleted);

      const profilesList = visibleMemberships.map(m => ({
        ...m.profile,
        role: m.role
      }));

      // Members can also see children of profiles they belong to
      const allAccessibleProfileIds = visibleMemberships.map(m => m.profile.id);

      // Ensure profile_tabs exist for every accessible profile
      for (const membership of memberships.filter(m => m.profile && !m.profile.is_deleted && m.role !== 'owner')) {
        const { data: existingTab } = await firstsavvy
          .from('profile_tabs')
          .select('id')
          .eq('owner_user_id', user.id)
          .eq('profile_id', membership.profile.id)
          .maybeSingle();

        if (!existingTab) {
          await firstsavvy.from('profile_tabs').insert({
            owner_user_id: user.id,
            profile_id: membership.profile.id,
            display_name: membership.profile.display_name,
            profile_type: membership.profile.profile_type || 'personal',
            tab_order: 99,
            is_active: false,
          });
        }
      }

      let childProfilesList = [];
      let allChildProfiles = [];

      if (allAccessibleProfileIds.length > 0) {
        const { data: childProfiles, error: childError } = await firstsavvy
          .from('child_profiles')
          .select('*')
          .in('parent_profile_id', allAccessibleProfileIds)
          .eq('is_active', true);

        if (!childError && childProfiles) {
          allChildProfiles = childProfiles.map(child => ({
            id: child.owned_by_profile_id,
            child_profile_id: child.id,
            display_name: child.child_name,
            profile_type: 'child',
            is_child_profile: true,
            parent_profile_id: child.parent_profile_id,
            owned_by_profile_id: child.owned_by_profile_id,
            permission_level: child.current_permission_level,
            current_permission_level: child.current_permission_level,
            points_balance: child.points_balance || 0,
            cash_balance: child.cash_balance || 0,
            daily_spending_limit: child.daily_spending_limit,
            weekly_spending_limit: child.weekly_spending_limit,
            monthly_spending_limit: child.monthly_spending_limit,
            date_of_birth: child.date_of_birth,
            avatar_url: child.avatar_url,
            child_name: child.child_name,
            first_name: child.first_name,
            last_name: child.last_name,
            role: 'child'
          }));
        }

        const { data: grantedAccess, error: grantError } = await firstsavvy
          .from('parent_access_grants')
          .select(`
            child_profile_id,
            child_profiles!inner (*)
          `)
          .in('parent_profile_id', allAccessibleProfileIds)
          .eq('is_active', true)
          .is('revoked_at', null);

        if (!grantError && grantedAccess) {
          const grantedChildProfiles = grantedAccess.map(grant => {
            const child = grant.child_profiles;
            return {
              id: child.owned_by_profile_id,
              child_profile_id: child.id,
              display_name: child.child_name,
              profile_type: 'child',
              is_child_profile: true,
              parent_profile_id: child.parent_profile_id,
              owned_by_profile_id: child.owned_by_profile_id,
              permission_level: child.current_permission_level,
              current_permission_level: child.current_permission_level,
              points_balance: child.points_balance || 0,
              cash_balance: child.cash_balance || 0,
              daily_spending_limit: child.daily_spending_limit,
              weekly_spending_limit: child.weekly_spending_limit,
              monthly_spending_limit: child.monthly_spending_limit,
              date_of_birth: child.date_of_birth,
              avatar_url: child.avatar_url,
              child_name: child.child_name,
              first_name: child.first_name,
              last_name: child.last_name,
              role: 'child'
            };
          });

          const uniqueChildIds = new Set(allChildProfiles.map(c => c.child_profile_id));
          const newGrantedProfiles = grantedChildProfiles.filter(
            c => !uniqueChildIds.has(c.child_profile_id)
          );
          allChildProfiles = [...allChildProfiles, ...newGrantedProfiles];
        }

        setAvailableChildProfiles(allChildProfiles);
      }

      const allProfiles = [...profilesList, ...childProfilesList];

      setProfiles(prev => {
        const hasChanged = JSON.stringify(prev) !== JSON.stringify(allProfiles);
        return hasChanged ? allProfiles : prev;
      });

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

      if (!activeProfileToSet && allProfiles.length > 0) {
        activeProfileToSet = allProfiles[0];
        if (!activeProfileToSet.is_child_profile) {
          const { error: activateError } = await firstsavvy
            .from('profile_tabs')
            .update({ is_active: true })
            .eq('owner_user_id', user.id)
            .eq('profile_id', activeProfileToSet.id);

          if (activateError) {
          }
        }
      }

      setActiveProfile(prev => {
        const hasChanged = JSON.stringify(prev) !== JSON.stringify(activeProfileToSet);
        return hasChanged ? activeProfileToSet : prev;
      });

      if (activeProfileToSet) {
        localStorage.setItem('activeProfileId', activeProfileToSet.id);
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [user]);

  const ensureCompleteProvisioning = async () => {
    try {
      const { data, error } = await firstsavvy.rpc('manual_provision_current_user');

      if (error) throw error;

      return data;
    } catch (err) {
      return null;
    }
  };

  const verifyUserProvisioning = async () => {
    try {
      const { data, error } = await firstsavvy.rpc('verify_user_provisioning');

      if (error) throw error;

      return data;
    } catch (err) {
      return null;
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (activeProfile?.id && location.pathname !== '/login' && location.pathname !== '/auth/callback') {
      if (isPageAllowedForProfile(location.pathname, activeProfile)) {
        saveProfileNavigation(activeProfile.id, location.pathname);
      }
    }
  }, [activeProfile?.id, location.pathname]);

  const switchProfile = useCallback(async (profile) => {
    if (!user || !profile) return;

    try {
      if (!profile.is_child_profile) {
        const { error: deactivateError } = await firstsavvy
          .from('profile_tabs')
          .update({ is_active: false })
          .eq('owner_user_id', user.id);

        if (deactivateError) {
        }

        const { error: activateError } = await firstsavvy
          .from('profile_tabs')
          .update({ is_active: true })
          .eq('owner_user_id', user.id)
          .eq('profile_id', profile.id);

        if (activateError) {
        }
      }

      setViewingChildProfile(null);
      sessionStorage.removeItem('viewingChildProfile');

      setActiveProfile(prev => {
        const hasChanged = JSON.stringify(prev) !== JSON.stringify(profile);
        return hasChanged ? profile : prev;
      });
      localStorage.setItem('activeProfileId', profile.id);

      const savedPath = getProfileNavigation(profile.id);
      let targetPath = savedPath;

      if (savedPath && !isPageAllowedForProfile(savedPath, profile)) {
        targetPath = getDefaultPageForProfile(profile);
      } else if (!savedPath) {
        targetPath = getDefaultPageForProfile(profile);
      }

      if (targetPath && targetPath !== location.pathname) {
        navigate(targetPath);
      }

      window.dispatchEvent(new CustomEvent('profileSwitched', { detail: { profileId: profile.id } }));
    } catch (err) {
      throw err;
    }
  }, [user, navigate, location.pathname]);

  const refreshProfiles = useCallback(async () => {
    await loadProfiles();
  }, [loadProfiles]);

  const exitChildView = useCallback(() => {
    sessionStorage.removeItem('viewingChildProfile');
    setViewingChildProfile(null);
  }, []);

  const value = React.useMemo(() => ({
    profiles,
    activeProfile,
    loading,
    error,
    switchProfile,
    refreshProfiles,
    viewingChildProfile,
    exitChildView,
    availableChildProfiles
  }), [profiles, activeProfile, loading, error, switchProfile, refreshProfiles, viewingChildProfile, exitChildView, availableChildProfiles]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};
