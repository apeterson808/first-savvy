
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import {
  LayoutDashboard, CircleDollarSign, ClipboardList, PiggyBank,
  Calendar, CreditCard, Banknote, Lock, Users, Cable, UserCheck,
  Menu, X, Bell, Search, LogOut, User, ChevronLeft, CheckCircle,
  Star, Settings
} from 'lucide-react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import NetworkStatus from '@/components/common/NetworkStatus';
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown';
import { getUserProfile } from '@/api/userSettings';
import ProtectedChangeWarningDialog from '@/components/common/ProtectedChangeWarningDialog';
import { useProtectedChangeDialog } from '@/hooks/useProtectedConfiguration';
import { ProfileTabBar } from '@/components/common/ProfileTabBar';
import { ProfileSelector } from '@/components/common/ProfileSelector';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileSelectorOpen, setProfileSelectorOpen] = useState(false);
  const [isLoggedInAsChild, setIsLoggedInAsChild] = useState(false);
  const [childPermissionLevel, setChildPermissionLevel] = useState(1);
  const navigate = useNavigate();
  const location = useLocation();
  const { activeProfile, viewingChildProfile, exitChildView } = useProfile();

  const { isOpen, dialogData, handleConfirm, handleCancel, setIsOpen } = useProtectedChangeDialog();

  // Save current page to localStorage
  React.useEffect(() => {
    if (currentPageName) {
      localStorage.setItem('lastVisitedPage', location.pathname + location.search);
    }
  }, [currentPageName, location]);

  React.useEffect(() => {
    const loadUserData = async () => {
      try {
        const authUser = await firstsavvy.auth.me();
        setUser(authUser);

        if (authUser?.id) {
          const profile = await getUserProfile(authUser.id);
          setUserProfile(profile);

          // Check if the logged-in user is a child user
          const { data: childProfile } = await firstsavvy
            .from('child_profiles')
            .select('current_permission_level')
            .eq('user_id', authUser.id)
            .eq('is_active', true)
            .maybeSingle();

          if (childProfile) {
            setIsLoggedInAsChild(true);
            setChildPermissionLevel(childProfile.current_permission_level || 1);
          } else {
            setIsLoggedInAsChild(false);
            setChildPermissionLevel(1);
          }
        }
      } catch (error) {
      }
    };

    loadUserData();

    const handleProfileUpdate = () => {
      loadUserData();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  const getNavigation = () => {
    // If the logged-in user is NOT a child, show full parent navigation
    if (!isLoggedInAsChild) {
      return [
        { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
        { name: 'Banking', icon: CircleDollarSign, page: 'Banking' },
        { name: 'Budgeting', icon: ClipboardList, page: 'Budgeting' },
        { name: 'Goals & Savings', icon: PiggyBank, page: 'Goals' },
        { name: 'Calendar', icon: Calendar, page: 'Calendar' },
        { name: 'Credit Score', icon: CreditCard, page: 'CreditScore' },
        { name: 'Net Worth', icon: Banknote, page: 'NetWorth' },
        { name: 'Contacts', icon: Users, page: 'Contacts' },
        { name: 'Connections', icon: UserCheck, page: 'Connections' },
        { name: 'Integrations', icon: Cable, page: 'Integrations' },
        { name: 'Password Vault', icon: Lock, page: 'PasswordVault' },
        { name: 'Affiliate', icon: Users, page: 'Affiliate' }
      ];
    }

    // If the logged-in user IS a child, show restricted navigation based on their permission level
    const childNav = [
      { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard', minLevel: 1 },
    ];

    if (childPermissionLevel >= 2) {
      childNav.push({ name: 'My Rewards', icon: Star, page: 'Goals', minLevel: 2 });
    }

    if (childPermissionLevel >= 3) {
      childNav.push(
        { name: 'My Money', icon: CircleDollarSign, page: 'Banking', minLevel: 3 },
        { name: 'My Budget', icon: ClipboardList, page: 'Budgeting', minLevel: 3 }
      );
    }

    if (childPermissionLevel >= 4) {
      childNav.push(
        { name: 'Calendar', icon: Calendar, page: 'Calendar', minLevel: 4 },
        { name: 'Goals & Savings', icon: PiggyBank, page: 'Goals', minLevel: 4 }
      );
    }

    if (childPermissionLevel >= 5) {
      childNav.push(
        { name: 'Net Worth', icon: Banknote, page: 'NetWorth', minLevel: 5 },
        { name: 'Contacts', icon: Users, page: 'Contacts', minLevel: 5 }
      );
    }

    return childNav;
  };

  const navigation = getNavigation();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 ${sidebarCollapsed ? 'w-16' : 'w-48'} transition-all duration-300 ease-in-out`} style={{ backgroundColor: '#2c4a6b' }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-3">
            {sidebarCollapsed ? (
              <div className="flex items-center justify-center w-full">
                <span className="text-xl font-bold text-white">$</span>
              </div>
            ) : (
              <>
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] font-light text-slate-400 tracking-wider">FIRST</span>
                  <h1 className="text-[26px] font-bold text-white tracking-tight">SAVVY</h1>
                </div>
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden lg:block text-slate-400 hover:text-white ml-auto"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </>
            )}
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentPageName === item.page;
              return (
                <button
                    key={item.name}
                    onClick={() => {
                      // Navigate to page with default tab
                      const basePath = createPageUrl(item.page).split('?')[0];
                      navigate(basePath);
                      // Force URL update to trigger tab reset
                      window.history.replaceState({}, '', basePath);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    className={`flex items-center w-full ${sidebarCollapsed ? 'justify-center px-3' : 'px-3'} py-1.5 text-sm font-medium rounded-lg transition-all ${
                      isActive
                        ? 'bg-slate-700 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                    title={sidebarCollapsed ? item.name : ''}
                  >
                  <Icon className={`w-4 h-4 ${!sidebarCollapsed && 'mr-3'}`} />
                  {!sidebarCollapsed && item.name}
                </button>
              );
            })}
          </nav>


        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white px-4 relative overflow-y-hidden">
          <div className="flex flex-col">
            <div className="flex items-center justify-between pt-3 pb-2">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden text-slate-600 hover:text-slate-900"
                >
                  <Menu className="w-5 h-5" />
                </button>

                {sidebarCollapsed && (
                  <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="hidden lg:block p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                )}

                {user && (
                  <span className="text-sm text-slate-600 hidden md:block">
                    Welcome, <span className="font-medium text-slate-900">
                      {userProfile?.display_name || userProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                  <Search className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors relative">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-burgundy rounded-full"></span>
                </button>
                <UserAvatarDropdown />
              </div>
            </div>

            {/* Profile Tabs - Hide when viewing as child */}
            {!viewingChildProfile && (
              <ProfileTabBar onAddProfileClick={() => setProfileSelectorOpen(true)} />
            )}

            {/* Child Viewing Indicator */}
            {viewingChildProfile && (
              <div className="flex items-center justify-between py-2 px-3 bg-gradient-to-r from-blue-50 to-purple-50 border-t border-blue-200">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                    {viewingChildProfile.childName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {viewingChildProfile.childName}'s Profile
                    </p>
                    <p className="text-xs text-slate-600">Parent viewing mode</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    exitChildView();
                    navigate('/Dashboard');
                  }}
                  className="text-xs"
                >
                  Exit Child View
                </Button>
              </div>
            )}
          </div>
          {/* Prominent horizontal border line - spans full width */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-300 z-0"></div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-100 p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Components */}
      <NetworkStatus />

      <ProtectedChangeWarningDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        configurationName={dialogData?.configuration?.name || dialogData?.configurationName}
        affectedFiles={dialogData?.configuration?.file_paths || []}
        changeDescription={dialogData?.configuration?.description}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <ProfileSelector
        open={profileSelectorOpen}
        onOpenChange={setProfileSelectorOpen}
      />

      {/* CSS to fix toaster blocking clicks */}
      <style>{`
        [data-sonner-toaster], .toaster, [class*="Toaster"] {
          pointer-events: none !important;
        }
        [data-sonner-toast] {
          pointer-events: auto !important;
        }
      `}</style>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
