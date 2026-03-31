import React, { useState } from 'react';
import { Plus, Loader2, X } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { ProfileSelector } from './ProfileSelector';

export function ProfileTabBar({ onAddProfileClick }) {
  const { profiles, activeProfile, switchProfile, loading } = useProfile();
  const [openChildTabs, setOpenChildTabs] = useState([]);
  const [showProfileSelector, setShowProfileSelector] = useState(false);

  const handleTabClick = (profile) => {
    if (profile.id !== activeProfile?.id) {
      switchProfile(profile);
    }
  };

  const openChildTab = (childProfile) => {
    if (!openChildTabs.find(t => t.id === childProfile.id)) {
      setOpenChildTabs(prev => [...prev, childProfile]);
    }
    switchProfile(childProfile);
  };

  const closeChildTab = (e, childProfileId) => {
    e.stopPropagation();
    setOpenChildTabs(prev => prev.filter(t => t.id !== childProfileId));
    if (activeProfile?.id === childProfileId) {
      const parentProfile = profiles.find(p => !p.is_child_profile);
      if (parentProfile) {
        switchProfile(parentProfile);
      }
    }
  };

  const parentProfiles = profiles.filter(p => !p.is_child_profile);

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
          {parentProfiles.map((profile) => {
            const isActive = profile.id === activeProfile?.id;

            return (
              <div
                key={profile.id}
                onClick={() => handleTabClick(profile)}
                className={`group flex items-center gap-1.5 px-3 py-1 cursor-pointer transition-all min-w-[120px] max-w-[160px] relative flex-shrink-0 ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 z-10'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                style={{
                  borderTop: isActive ? '2px solid #cbd5e1' : '2px solid transparent',
                  borderLeft: isActive ? '2px solid #cbd5e1' : '2px solid transparent',
                  borderRight: isActive ? '2px solid #cbd5e1' : '2px solid transparent',
                  borderBottom: isActive ? '2px solid #f1f5f9' : 'none',
                  borderTopLeftRadius: '12px',
                  borderTopRightRadius: '12px',
                  marginBottom: isActive ? '-2px' : '0',
                  paddingBottom: isActive ? 'calc(0.25rem + 2px)' : '0.25rem',
                }}
              >
                <span className="text-sm font-medium truncate flex-1">
                  {profile.display_name}
                </span>
              </div>
            );
          })}

          {openChildTabs.map((childProfile) => {
            const isActive = childProfile.id === activeProfile?.id;

            return (
              <div
                key={childProfile.id}
                onClick={() => handleTabClick(childProfile)}
                className={`group flex items-center gap-1.5 px-3 py-1 cursor-pointer transition-all min-w-[120px] max-w-[160px] relative flex-shrink-0 ${
                  isActive
                    ? 'bg-blue-100 text-blue-900 z-10'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-900'
                }`}
                style={{
                  borderTop: isActive ? '2px solid #93c5fd' : '2px solid transparent',
                  borderLeft: isActive ? '2px solid #93c5fd' : '2px solid transparent',
                  borderRight: isActive ? '2px solid #93c5fd' : '2px solid transparent',
                  borderBottom: isActive ? '2px solid #f1f5f9' : 'none',
                  borderTopLeftRadius: '12px',
                  borderTopRightRadius: '12px',
                  marginBottom: isActive ? '-2px' : '0',
                  paddingBottom: isActive ? 'calc(0.25rem + 2px)' : '0.25rem',
                }}
              >
                <span className="text-sm font-medium truncate flex-1">
                  {childProfile.display_name}
                </span>
                <button
                  onClick={(e) => closeChildTab(e, childProfile.id)}
                  className="flex-shrink-0 hover:bg-blue-200 rounded p-0.5 transition-colors"
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
        onOpenChildTab={openChildTab}
      />
    </div>
  );
}
