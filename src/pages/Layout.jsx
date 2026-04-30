
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import {
  LayoutDashboard, CircleDollarSign, ClipboardList, PiggyBank,
  Calendar, CreditCard, Banknote, Lock, Users, Cable, ScrollText,
  Menu, X, Bell, Search, LogOut, User, ChevronLeft, CheckCircle,
  Star, Settings, ArrowLeft, ArrowRight, RefreshCw, TrendingUp
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
import ChildAvatar from '@/components/children/ChildAvatar';
import ChildHeader from '@/components/children/ChildHeader';

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileSelectorOpen, setProfileSelectorOpen] = useState(false);
  const [isLoggedInAsChild, setIsLoggedInAsChild] = useState(false);
  const [childPermissionLevel, setChildPermissionLevel] = useState(1);
  const [childDisplayName, setChildDisplayName] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { activeProfile, viewingChildProfile } = useProfile();

  const { isOpen, dialogData, handleConfirm, handleCancel, setIsOpen } = useProtectedChangeDialog();

  const isParentViewingChild = viewingChildProfile && viewingChildProfile.loginType === 'parent-selected';

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

          const { data: childProfile } = await firstsavvy
            .from('child_profiles')
            .select('current_permission_level, display_name, child_name')
            .eq('user_id', authUser.id)
            .eq('is_active', true)
            .maybeSingle();

          if (childProfile) {
            setIsLoggedInAsChild(true);
            setChildPermissionLevel(childProfile.current_permission_level || 1);
            setChildDisplayName(childProfile.display_name || childProfile.child_name || 'Child');
          } else {
            setIsLoggedInAsChild(false);
            setChildPermissionLevel(1);
            setChildDisplayName('');
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
        { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard', availableForChildProfile: true },
        { name: 'Banking', icon: CircleDollarSign, page: 'Banking', availableForChildProfile: false },
        { name: 'Budgeting', icon: ClipboardList, page: 'Budgeting', availableForChildProfile: false },
        { name: 'Goals & Savings', icon: PiggyBank, page: 'Goals', availableForChildProfile: false },
        { name: 'Calendar', icon: Calendar, page: 'Calendar', availableForChildProfile: false },
        { name: 'Credit Score', icon: CreditCard, page: 'CreditScore', availableForChildProfile: false },
        { name: 'Net Worth', icon: Banknote, page: 'NetWorth', availableForChildProfile: false },
        { name: 'Investments', icon: TrendingUp, page: 'Investments', availableForChildProfile: false },
        { name: 'Contacts', icon: Users, page: 'Contacts', availableForChildProfile: false },
        { name: 'Estate Planning', icon: ScrollText, page: 'EstatePlanning', availableForChildProfile: false },
        { name: 'Integrations', icon: Cable, page: 'Integrations', availableForChildProfile: false },
        { name: 'Password Vault', icon: Lock, page: 'PasswordVault', availableForChildProfile: false },
        { name: 'Affiliate', icon: Users, page: 'Affiliate', availableForChildProfile: false }
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
        { name: 'My Budget', icon: ClipboardList, page: 'Budgeting', minLevel: 3 },
        { name: 'Calendar', icon: Calendar, page: 'Calendar', minLevel: 3 },
        { name: 'Goals & Savings', icon: PiggyBank, page: 'Goals', minLevel: 3 },
        { name: 'Net Worth', icon: Banknote, page: 'NetWorth', minLevel: 3 },
        { name: 'Contacts', icon: Users, page: 'Contacts', minLevel: 3 }
      );
    }

    return childNav;
  };

  const navigation = getNavigation();

  if (isLoggedInAsChild) {
    return (
      <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChildHeader childName={childDisplayName} displayName={childDisplayName} />
          <main className="flex-1 overflow-y-auto">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
        <NetworkStatus />
      </div>
    );
  }

  if (isParentViewingChild) {
    return (
      <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <NetworkStatus />
        <ProtectedChangeWarningDialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          dialogData={dialogData}
        />
        <ProfileSelector
          open={profileSelectorOpen}
          onOpenChange={setProfileSelectorOpen}
        />
      </div>
    );
  }

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
              const isViewingChildProfile = activeProfile?.is_child_profile === true;
              const isDisabled = isViewingChildProfile && !item.availableForChildProfile;

              return (
                <button
                    key={item.name}
                    onClick={() => {
                      if (isDisabled) return;
                      setSidebarOpen(false);
                      const basePath = createPageUrl(item.page).split('?')[0];
                      navigate(basePath);
                      window.history.replaceState({}, '', basePath);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    disabled={isDisabled}
                    className={`flex items-center w-full ${sidebarCollapsed ? 'justify-center px-3' : 'px-3'} py-1.5 text-sm font-medium rounded-lg transition-all ${
                      isDisabled
                        ? 'text-slate-500 cursor-not-allowed opacity-40'
                        : isActive
                        ? 'bg-slate-700 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                    title={sidebarCollapsed ? item.name : (isDisabled ? `Switch to your profile to access ${item.name}` : '')}
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

            {/* Profile Tabs */}
            <ProfileTabBar onAddProfileClick={() => setProfileSelectorOpen(true)} />
          </div>
          {/* Prominent horizontal border line - spans full width */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-300 z-0"></div>
        </header>

        {/* Child View Mode Banner */}
        {viewingChildProfile && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Viewing as {viewingChildProfile.display_name || viewingChildProfile.childName}
                  </p>
                  <p className="text-xs text-blue-100">
                    Child Profile View
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem('viewingChildProfile');
                navigate('/Dashboard');
                window.location.reload();
              }}
              className="bg-white/20 hover:bg-white/30 text-white border-white/40"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit to Parent View
            </Button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-100">
          {/* Navigation Bar - Sticky */}
          <div className="bg-slate-100 border-b border-slate-300 px-6 py-2 flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
              title="Go forward"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.location.reload()}
              className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
              title="Refresh page"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div id="main-scroll-area" className="flex-1 overflow-y-auto p-6">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
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
