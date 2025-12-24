import React from 'react';
import { Plus } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';

export function ProfileTabBar({ onAddProfileClick }) {
  const { profiles, activeProfile, switchProfile } = useProfile();

  const handleTabClick = (profile) => {
    if (profile.id !== activeProfile?.id) {
      switchProfile(profile);
    }
  };

  if (!profiles || profiles.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-hidden">
      {profiles.map((profile) => {
        const isActive = profile.id === activeProfile?.id;

        return (
          <div
            key={profile.id}
            onClick={() => handleTabClick(profile)}
            className={`group flex items-center gap-1.5 px-3 py-1 cursor-pointer transition-all min-w-[120px] max-w-[160px] relative ${
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

      {profiles.length < 10 && onAddProfileClick && (
        <button
          onClick={onAddProfileClick}
          className="flex items-center justify-center px-2.5 py-1.5 flex-shrink-0 text-slate-500 hover:text-slate-700 transition-colors"
          title="Add profile"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
