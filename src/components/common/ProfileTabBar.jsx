import React, { useState, useEffect } from 'react';
import { Plus, Loader2, X } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { ProfileSelector } from './ProfileSelector';

export function ProfileTabBar({ onAddProfileClick }) {
  const { profiles, activeProfile, switchProfile, loading, availableChildProfiles } = useProfile();
  const [openTabs, setOpenTabs] = useState([]);
  const [showProfileSelector, setShowProfileSelector] = useState(false);

  const allAvailableProfiles = [...profiles, ...availableChildProfiles];

  const getProfileKey = (profile) => {
    return profile.is_child_profile ? profile.child_profile_id : profile.id;
  };

  useEffect(() => {
    if (profiles && profiles.length > 0) {
      setOpenTabs(prev => {
        const prevKeys = new Set(prev.map(getProfileKey));
        const toAdd = profiles.filter(p => !p.is_child_profile && !prevKeys.has(getProfileKey(p)));
        // Update display_name for existing tabs in case it was renamed (e.g. spouse sharing)
        const updated = prev.map(tab => {
          const match = profiles.find(p => getProfileKey(p) === getProfileKey(tab));
          return match ? { ...tab, display_name: match.display_name } : tab;
        });
        return toAdd.length > 0 ? [...updated, ...toAdd] : updated;
      });
    }
  }, [profiles]);

  useEffect(() => {
    if (activeProfile) {
      setOpenTabs(prev => {
        if (prev.length === 0) return [activeProfile];
        const activeKey = getProfileKey(activeProfile);
        if (!prev.find(t => getProfileKey(t) === activeKey)) {
          return [...prev, activeProfile];
        }
        return prev;
      });
    }
  }, [activeProfile]);

  const handleTabClick = (profile) => {
    const profileKey = getProfileKey(profile);
    const activeKey = activeProfile ? getProfileKey(activeProfile) : null;
    if (profileKey !== activeKey) {
      switchProfile(profile);
    }
  };

  const openProfileTab = (profile) => {
    const profileKey = getProfileKey(profile);
    if (!openTabs.find(t => getProfileKey(t) === profileKey)) {
      setOpenTabs(prev => [...prev, profile]);
    }
    switchProfile(profile);
  };

  const closeTab = (e, profile) => {
    e.stopPropagation();
    const profileKey = getProfileKey(profile);
    setOpenTabs(prev => prev.filter(t => getProfileKey(t) !== profileKey));

    const activeKey = activeProfile ? getProfileKey(activeProfile) : null;
    if (activeKey === profileKey && openTabs.length > 1) {
      const remainingTabs = openTabs.filter(t => getProfileKey(t) !== profileKey);
      if (remainingTabs.length > 0) {
        switchProfile(remainingTabs[remainingTabs.length - 1]);
      }
    }
  };

  const handleProfileSelectorClick = () => {
    if (onAddProfileClick) {
      onAddProfileClick();
    } else {
      setShowProfileSelector(true);
    }
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto overflow-y-hidden min-h-[36px] scrollbar-thin">
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-1 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading profiles...</span>
        </div>
      ) : profiles && profiles.length > 0 ? (
        <>
          {openTabs.map((profile) => {
            const profileKey = getProfileKey(profile);
            const activeKey = activeProfile ? getProfileKey(activeProfile) : null;
            const isActive = profileKey === activeKey;
            const isChildProfile = profile.is_child_profile;

            return (
              <div
                key={profileKey}
                onClick={() => handleTabClick(profile)}
                className={`group flex items-center gap-1.5 px-3 py-1 cursor-pointer transition-all min-w-[120px] max-w-[160px] relative flex-shrink-0 ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 z-10'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                style={{
                  borderTop: isActive
                    ? '2px solid #cbd5e1'
                    : '2px solid transparent',
                  borderLeft: isActive
                    ? '2px solid #cbd5e1'
                    : '2px solid transparent',
                  borderRight: isActive
                    ? '2px solid #cbd5e1'
                    : '2px solid transparent',
                  borderBottom: isActive
                    ? '2px solid #f1f5f9'
                    : 'none',
                  borderTopLeftRadius: '12px',
                  borderTopRightRadius: '12px',
                  marginBottom: isActive ? '-2px' : '0',
                  paddingBottom: isActive ? 'calc(0.25rem + 2px)' : '0.25rem',
                }}
              >
                <span className="text-sm font-medium truncate flex-1">
                  {profile.display_name}
                </span>
                <button
                  onClick={(e) => closeTab(e, profile)}
                  className={`flex-shrink-0 rounded p-0.5 transition-colors ${
                    isChildProfile
                      ? 'hover:bg-blue-200'
                      : 'hover:bg-slate-200'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          <button
            onClick={handleProfileSelectorClick}
            className="flex items-center justify-center px-2.5 py-1.5 flex-shrink-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Switch or add profile"
          >
            <Plus className="w-4 h-4" />
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1 text-sm text-slate-500">
          <span>No profiles found</span>
          {onAddProfileClick && (
            <button
              onClick={onAddProfileClick}
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Profile
            </button>
          )}
        </div>
      )}

      <ProfileSelector
        open={showProfileSelector}
        onOpenChange={setShowProfileSelector}
        onOpenChildTab={openProfileTab}
      />
    </div>
  );
}
