
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import {
  LayoutDashboard, CircleDollarSign, ClipboardList, PiggyBank,
  Calendar, CreditCard, Banknote, Lock, Users, Cable, UserCog,
  Menu, X, Bell, Search, LogOut, User, ChevronLeft
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import NetworkStatus from '@/components/common/NetworkStatus';
import { useDefaultAccounts } from '@/components/hooks/useDefaultAccounts';
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown';


function HeaderTabs({ tabs, defaultTab = 'overview', disabledTabs = [] }) {
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') || defaultTab;
  });

  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      setActiveTab(urlParams.get('tab') || defaultTab);
    };
    window.addEventListener('popstate', handlePopState);
    
    const interval = setInterval(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const currentTab = urlParams.get('tab') || defaultTab;
      setActiveTab(prev => prev !== currentTab ? currentTab : prev);
    }, 100);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, [defaultTab]);

  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        const isDisabled = disabledTabs.includes(tab);
        return (
          <button
            key={tab}
            disabled={isDisabled}
            onClick={() => {
              if (isDisabled) return;
              const newUrl = `${window.location.pathname}?tab=${tab}`;
              window.history.pushState({}, '', newUrl);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              isActive
                ? 'bg-slate-100 text-slate-900'
                : isDisabled
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {tab.replace(/_/g, ' ')}
          </button>
        );
      })}
    </div>
  );
}

function BudgetingTabs() {
  const [budgetGroups, setBudgetGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.BudgetGroup.list().then(groups => {
      setBudgetGroups(groups);
      setLoading(false);
    });
  }, []);

  const hasSetupStarted = budgetGroups.length > 0;
  const disabledTabs = loading || !hasSetupStarted ? ['overview'] : [];

  return <HeaderTabs tabs={['overview', 'setup']} defaultTab={hasSetupStarted ? 'overview' : 'setup'} disabledTabs={disabledTabs} />;
}

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize default accounts
  useDefaultAccounts();

  // Save current page to localStorage
  React.useEffect(() => {
    if (currentPageName) {
      localStorage.setItem('lastVisitedPage', location.pathname + location.search);
    }
  }, [currentPageName, location]);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Banking', icon: CircleDollarSign, page: 'Banking' },
    { name: 'Budgeting', icon: ClipboardList, page: 'Budgeting' },
    { name: 'Goals & Savings', icon: PiggyBank, page: 'Goals' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Credit Score', icon: CreditCard, page: 'CreditScore' },
    { name: 'Net Worth', icon: Banknote, page: 'NetWorth' },
    { name: 'Contacts', icon: Users, page: 'Contacts' },
    { name: 'Integrations', icon: Cable, page: 'Integrations' },
    { name: 'Collaboration', icon: UserCog, page: 'Collaboration' },
    { name: 'Password Vault', icon: Lock, page: 'PasswordVault' },
    { name: 'Affiliate', icon: Users, page: 'Affiliate' }
  ];

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
        <header className="h-20 bg-white border-b border-slate-200 px-4">
          <div className="h-full flex flex-col justify-start pt-2">
            <div className="flex items-center justify-between mb-2">
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
                    Welcome, <span className="font-medium text-slate-900">{user.full_name}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                  <Search className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors relative">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <UserAvatarDropdown />
              </div>
            </div>

            {/* Page Tabs */}
            {currentPageName === 'Banking' && (
              <HeaderTabs tabs={['overview', 'transactions', 'recurring', 'rules', 'accounts']} />
            )}
            {currentPageName === 'Budgeting' && (
                          <BudgetingTabs />
                        )}
            {currentPageName === 'NetWorth' && (
              <HeaderTabs tabs={['overview', 'assets', 'liabilities']} />
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Components */}
      <NetworkStatus />
      
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
