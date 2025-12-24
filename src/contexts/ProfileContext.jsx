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
  const [profileTabs, setProfileTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfileTabs = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data: tabs, error } = await firstsavvy
        .from('profile_tabs')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('tab_order');

      if (error) throw error;

      if (!tabs || tabs.length === 0) {
        const { data: userProfile } = await firstsavvy
          .from('user_profiles')
          .select('full_name, email, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        const defaultTab = {
          owner_user_id: user.id,
          profile_user_id: user.id,
          profile_type: 'personal',
          profile_name: userProfile?.full_name || user.email || 'My Profile',
          profile_metadata: {
            avatar_url: userProfile?.avatar_url,
            email: userProfile?.email || user.email,
          },
          tab_order: 0,
          is_pinned: true,
          is_active: true,
          state_data: {},
        };

        const { data: newTab, error: insertError } = await firstsavvy
          .from('profile_tabs')
          .insert(defaultTab)
          .select()
          .single();

        if (insertError) throw insertError;

        setProfileTabs([newTab]);
        setActiveTabId(newTab.id);
      } else {
        setProfileTabs(tabs);
        const activeTab = tabs.find((t) => t.is_active);
        if (activeTab) {
          setActiveTabId(activeTab.id);
        } else if (tabs.length > 0) {
          await switchToTab(tabs[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading profile tabs:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfileTabs();
  }, [loadProfileTabs]);

  const switchToTab = async (tabId) => {
    try {
      if (activeTabId) {
        await firstsavvy
          .from('profile_tabs')
          .update({ is_active: false })
          .eq('id', activeTabId);
      }

      await firstsavvy
        .from('profile_tabs')
        .update({
          is_active: true,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', tabId);

      setActiveTabId(tabId);
      setProfileTabs((prev) =>
        prev.map((tab) => ({
          ...tab,
          is_active: tab.id === tabId,
        }))
      );
    } catch (error) {
      console.error('Error switching tabs:', error);
    }
  };

  const addProfileTab = async (profileData) => {
    if (profileTabs.length >= 10) {
      throw new Error('Maximum of 10 profile tabs allowed');
    }

    const existingTab = profileTabs.find(
      (tab) => tab.profile_user_id === profileData.profile_user_id
    );
    if (existingTab) {
      await switchToTab(existingTab.id);
      return existingTab;
    }

    const newTab = {
      owner_user_id: user.id,
      profile_user_id: profileData.profile_user_id,
      profile_type: profileData.profile_type,
      profile_name: profileData.profile_name,
      profile_metadata: profileData.profile_metadata || {},
      tab_order: profileTabs.length,
      is_pinned: false,
      is_active: false,
      state_data: {},
    };

    try {
      const { data: insertedTab, error } = await firstsavvy
        .from('profile_tabs')
        .insert(newTab)
        .select()
        .single();

      if (error) throw error;

      setProfileTabs((prev) => [...prev, insertedTab]);
      await switchToTab(insertedTab.id);
      return insertedTab;
    } catch (error) {
      console.error('Error adding profile tab:', error);
      throw error;
    }
  };

  const closeProfileTab = async (tabId) => {
    const tab = profileTabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.is_pinned) {
      throw new Error('Cannot close a pinned tab');
    }

    try {
      await firstsavvy.from('profile_tabs').delete().eq('id', tabId);

      const remainingTabs = profileTabs.filter((t) => t.id !== tabId);
      setProfileTabs(remainingTabs);

      if (tab.is_active && remainingTabs.length > 0) {
        await switchToTab(remainingTabs[0].id);
      }
    } catch (error) {
      console.error('Error closing profile tab:', error);
      throw error;
    }
  };

  const updateTabOrder = async (reorderedTabs) => {
    try {
      const updates = reorderedTabs.map((tab, index) => ({
        id: tab.id,
        tab_order: index,
      }));

      for (const update of updates) {
        await firstsavvy
          .from('profile_tabs')
          .update({ tab_order: update.tab_order })
          .eq('id', update.id);
      }

      setProfileTabs(reorderedTabs);
    } catch (error) {
      console.error('Error updating tab order:', error);
      throw error;
    }
  };

  const updateTabState = async (tabId, stateData) => {
    try {
      await firstsavvy
        .from('profile_tabs')
        .update({ state_data: stateData })
        .eq('id', tabId);

      setProfileTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabId ? { ...tab, state_data: stateData } : tab
        )
      );
    } catch (error) {
      console.error('Error updating tab state:', error);
    }
  };

  const togglePinTab = async (tabId) => {
    const tab = profileTabs.find((t) => t.id === tabId);
    if (!tab) return;

    try {
      const newPinnedState = !tab.is_pinned;
      await firstsavvy
        .from('profile_tabs')
        .update({ is_pinned: newPinnedState })
        .eq('id', tabId);

      setProfileTabs((prev) =>
        prev.map((t) =>
          t.id === tabId ? { ...t, is_pinned: newPinnedState } : t
        )
      );
    } catch (error) {
      console.error('Error toggling pin:', error);
      throw error;
    }
  };

  const activeProfile = profileTabs.find((tab) => tab.id === activeTabId);

  const value = {
    profileTabs,
    activeTabId,
    activeProfile,
    loading,
    switchToTab,
    addProfileTab,
    closeProfileTab,
    updateTabOrder,
    updateTabState,
    togglePinTab,
    refreshTabs: loadProfileTabs,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};
