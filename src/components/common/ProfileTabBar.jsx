import React, { useState } from 'react';
import { X, Plus, Pin, PinOff } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export function ProfileTabBar({ onAddProfileClick }) {
  const { profileTabs, activeTabId, switchToTab, closeProfileTab, togglePinTab } = useProfile();
  const [draggedTab, setDraggedTab] = useState(null);

  const handleTabClick = (tabId) => {
    if (tabId !== activeTabId) {
      switchToTab(tabId);
    }
  };

  const handleCloseTab = async (e, tab) => {
    e.stopPropagation();
    if (tab.is_pinned) {
      toast.error('Cannot close a pinned profile');
      return;
    }
    try {
      await closeProfileTab(tab.id);
      toast.success('Profile closed');
    } catch (error) {
      toast.error(error.message || 'Failed to close profile');
    }
  };

  const handleTogglePin = async (e, tab) => {
    e.stopPropagation();
    try {
      await togglePinTab(tab.id);
      toast.success(tab.is_pinned ? 'Profile unpinned' : 'Profile pinned');
    } catch (error) {
      toast.error('Failed to toggle pin');
    }
  };

  if (profileTabs.length === 0) return null;

  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300">
      {profileTabs.map((tab) => {
        const isActive = tab.id === activeTabId;

        return (
          <div
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            draggable
            onDragStart={() => setDraggedTab(tab)}
            onDragEnd={() => setDraggedTab(null)}
            className={`group flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer transition-all min-w-[120px] max-w-[160px] relative ${
              isActive
                ? 'bg-slate-100 text-slate-900 z-10'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            style={{
              borderTop: isActive ? '2px solid #cbd5e1' : '2px solid transparent',
              borderLeft: isActive ? '2px solid #cbd5e1' : '2px solid transparent',
              borderRight: isActive ? '2px solid #cbd5e1' : '2px solid transparent',
              borderBottom: isActive ? '2px solid #f1f5f9' : 'none',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              marginBottom: isActive ? '-2px' : '0',
              paddingBottom: isActive ? 'calc(0.375rem + 2px)' : '0.375rem',
            }}
          >
            <span className="text-sm font-medium truncate flex-1">
              {tab.profile_name}
            </span>

            <div className="flex items-center gap-1 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 transition-opacity ${
                      isActive ? 'hover:bg-slate-200' : ''
                    }`}
                  >
                    <X className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => handleTogglePin(e, tab)}>
                    {tab.is_pinned ? (
                      <>
                        <PinOff className="w-4 h-4 mr-2" />
                        Unpin Profile
                      </>
                    ) : (
                      <>
                        <Pin className="w-4 h-4 mr-2" />
                        Pin Profile
                      </>
                    )}
                  </DropdownMenuItem>
                  {!tab.is_pinned && (
                    <DropdownMenuItem
                      onClick={(e) => handleCloseTab(e, tab)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Close Profile
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}

      {profileTabs.length < 10 && (
        <button
          onClick={onAddProfileClick}
          className="flex items-center justify-center px-2 py-1.5 bg-slate-50 hover:bg-slate-100 transition-colors flex-shrink-0 text-slate-600"
          title="Add profile"
          style={{
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
          }}
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
