import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';

export function ProfileTabBar({ onAddProfileClick }) {
  const { profileTabs, activeTabId, switchToTab, closeProfileTab } = useProfile();
  const [draggedTab, setDraggedTab] = useState(null);

  const handleTabClick = (tabId) => {
    if (tabId !== activeTabId) {
      switchToTab(tabId);
    }
  };

  const handleCloseTab = async (e, tabId) => {
    e.stopPropagation();
    try {
      await closeProfileTab(tabId);
      toast.success('Profile closed');
    } catch (error) {
      toast.error(error.message || 'Failed to close profile');
    }
  };

  if (profileTabs.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-hidden">
      {profileTabs.map((tab) => {
        const isActive = tab.id === activeTabId;

        return (
          <div
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            draggable
            onDragStart={() => setDraggedTab(tab)}
            onDragEnd={() => setDraggedTab(null)}
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
              {tab.profile_name}
            </span>

            <button
              onClick={(e) => handleCloseTab(e, tab.id)}
              className="p-0.5 rounded hover:bg-slate-200 transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3 text-slate-500" />
            </button>
          </div>
        );
      })}

      {profileTabs.length < 10 && (
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
