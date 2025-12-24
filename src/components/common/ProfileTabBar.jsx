import React from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';

export function ProfileTabBar({ onAddProfileClick }) {
  const { profiles, activeProfile, switchProfile, loading } = useProfile();

  const handleTabClick = (profile) => {
    if (profile.id !== activeProfile?.id) {
      switchProfile(profile);
    }
  };

  return (
    <div className="flex items-center gap-0 overflow-hidden min-h-[36px] px-3">
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-1 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading profiles...</span>
        </div>
      ) : profiles && profiles.length > 0 ? (
        <>
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfile?.id;

            return (
              <div
                key={profile.id}
                onClick={() => handleTabClick(profile)}
                className={`group flex items-center gap-1.5 px-3 py-1 cursor-pointer transition-all min-w-[120px] max-w-[160px] relative ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 z-10 profile-tab-active'
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
                  marginLeft: isActive ? '12px' : '4px',
                  marginRight: isActive ? '12px' : '4px',
                }}
              >
                <span className="text-sm font-medium truncate flex-1">
                  {profile.display_name}
                </span>
              </div>
            );
          })}

          {profiles.length < 10 && onAddProfileClick && (
            <button
              onClick={onAddProfileClick}
              className="flex items-center justify-center px-2.5 py-1.5 flex-shrink-0 text-slate-500 hover:text-slate-700 transition-colors"
              title="Add profile"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
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
    </div>
  );
}
