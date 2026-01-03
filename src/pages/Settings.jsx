import React, { useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/PageTabs';
import { useAuth } from '@/contexts/AuthContext';
import ProfileTab from '../components/settings/ProfileTab';
import SecurityTab from '../components/settings/SecurityTab';
import PreferencesTab from '../components/settings/PreferencesTab';
import NotificationsTab from '../components/settings/NotificationsTab';
import ChartOfAccountsTab from '../components/settings/ChartOfAccountsTab';
import ProtectedConfigurationsTab from '../components/settings/ProtectedConfigurationsTab';

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

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'chart-of-accounts', label: 'Chart of Accounts' },
    { id: 'protected', label: 'Protected' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 pb-4">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
      </div>

      <Tabs value={activeTab} className="flex-1 flex flex-col">
        <PageTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          basePath="/Settings"
        />

        <div className="flex-1 overflow-auto mt-6">
          <TabsContent value="profile" className="mt-0">
            <ProfileTab />
          </TabsContent>

          <TabsContent value="security" className="mt-0">
            <SecurityTab />
          </TabsContent>

          <TabsContent value="preferences" className="mt-0">
            <PreferencesTab />
          </TabsContent>

          <TabsContent value="notifications" className="mt-0">
            <NotificationsTab />
          </TabsContent>

          <TabsContent value="chart-of-accounts" className="mt-0">
            <ChartOfAccountsTab />
          </TabsContent>

          <TabsContent value="protected" className="mt-0">
            <ProtectedConfigurationsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
