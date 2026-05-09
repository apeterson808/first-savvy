import React, { useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/PageTabs';
import { useAuth } from '@/contexts/AuthContext';
import ProfileTab from '../components/settings/ProfileTab';
import SecurityTab from '../components/settings/SecurityTab';
import PreferencesTab from '../components/settings/PreferencesTab';
import NotificationsTab from '../components/settings/NotificationsTab';
import ProtectedConfigurationsTab from '../components/settings/ProtectedConfigurationsTab';
import HouseholdActivityFeed from '../components/dashboard/HouseholdActivityFeed';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') || 'profile';
  });

  React.useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab') || 'profile';
      setActiveTab(tab);
    };

    const interval = setInterval(handleUrlChange, 100);
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <PageTabs tabs={['profile', 'security', 'preferences', 'notifications', 'household', 'protected']} defaultTab="profile" />

      <Tabs value={activeTab} className="w-full">
        <TabsContent value="profile" className="mt-4">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <PreferencesTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="household" className="mt-4">
          <div className="max-w-2xl">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Household Activity</h2>
              <p className="text-sm text-slate-500 mt-1">
                A complete record of all actions taken by household members — who categorized transactions,
                approved tasks, managed budgets, and more.
              </p>
            </div>
            <HouseholdActivityFeed compact={false} />
          </div>
        </TabsContent>

        <TabsContent value="protected" className="mt-4">
          <ProtectedConfigurationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
