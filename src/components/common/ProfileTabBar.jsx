import React, { useState } from 'react';
import { X, Plus, Pin, PinOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getProfileTypeColor = (type) => {
    switch (type) {
      case 'personal':
        return 'bg-blue-500';
      case 'household':
        return 'bg-green-500';
      case 'business':
        return 'bg-purple-500';
      default:
        return 'bg-slate-500';
    }
  };

  if (profileTabs.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 pb-2">
      {profileTabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const initials = getInitials(tab.profile_name);

        return (
          <div
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            draggable
            onDragStart={() => setDraggedTab(tab)}
            onDragEnd={() => setDraggedTab(null)}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg border cursor-pointer transition-all min-w-[180px] max-w-[220px] relative ${
              isActive
                ? 'bg-white border-slate-200 border-b-white shadow-sm z-10 -mb-px'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
            style={isActive ? { paddingBottom: 'calc(0.375rem + 1px)' } : {}}
          >
            <div className="relative flex-shrink-0">
              <Avatar className="w-6 h-6">
                <AvatarImage src={tab.profile_metadata?.avatar_url} alt={tab.profile_name} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                  isActive ? 'border-white' : 'border-slate-50'
                } ${getProfileTypeColor(tab.profile_type)}`}
                title={tab.profile_type}
              />
            </div>

            <span className="text-sm font-medium text-slate-900 truncate flex-1">
              {tab.profile_name}
            </span>

            <div className="flex items-center gap-1 flex-shrink-0">
              {tab.is_pinned && (
                <Pin className="w-3 h-3 text-slate-400" />
              )}

              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 transition-opacity ${
                      isActive ? 'hover:bg-slate-100' : ''
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
          className="flex items-center justify-center w-8 h-8 rounded-t-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors flex-shrink-0"
          title="Add profile"
        >
          <Plus className="w-4 h-4 text-slate-600" />
        </button>
      )}
    </div>
  );
}
