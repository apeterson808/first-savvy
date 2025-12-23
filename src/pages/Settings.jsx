import { useState, useEffect } from 'react';
import { User, Lock, Settings as SettingsIcon, Bell, Shield, BookOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { supabase } from '../api/supabaseClient';
import { getUserProfile } from '../api/userSettings';
import ProfileTab from '../components/settings/ProfileTab';
import SecurityTab from '../components/settings/SecurityTab';
import PreferencesTab from '../components/settings/PreferencesTab';
import NotificationsTab from '../components/settings/NotificationsTab';
import ProtectedConfigurationsTab from '../components/settings/ProtectedConfigurationsTab';
import ChartOfAccountsTab from '../components/settings/ChartOfAccountsTab';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);
        const userProfile = await getUserProfile(authUser.id);
        setProfile(userProfile);
      } else {
        setUser({ id: 'demo', email: 'demo@example.com' });
        setProfile({
          id: 'demo',
          full_name: 'Demo User',
          email: 'demo@example.com',
          phone: '',
          bio: '',
          timezone: 'UTC',
          language: 'en',
          currency: 'USD',
          date_format: 'MM/DD/YYYY',
          theme: 'system',
          email_notifications: true,
          push_notifications: true,
          budget_alerts: true,
          transaction_alerts: true,
          weekly_summary: true,
          monthly_report: true
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setUser({ id: 'demo', email: 'demo@example.com' });
      setProfile({
        id: 'demo',
        full_name: 'Demo User',
        email: 'demo@example.com',
        phone: '',
        bio: '',
        timezone: 'UTC',
        language: 'en',
        currency: 'USD',
        date_format: 'MM/DD/YYYY',
        theme: 'system',
        email_notifications: true,
        push_notifications: true,
        budget_alerts: true,
        transaction_alerts: true,
        weekly_summary: true,
        monthly_report: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = (updatedProfile) => {
    setProfile(updatedProfile);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-blue"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="chart-of-accounts" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Chart of Accounts</span>
          </TabsTrigger>
          <TabsTrigger value="protected" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Protected</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab user={user} profile={profile} onUpdate={handleProfileUpdate} />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab user={user} />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab profile={profile} onUpdate={handleProfileUpdate} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab profile={profile} onUpdate={handleProfileUpdate} />
        </TabsContent>

        <TabsContent value="chart-of-accounts">
          <Card>
            <CardHeader>
              <CardTitle>Chart of Accounts</CardTitle>
              <CardDescription>
                Manage your unified chart of accounts for comprehensive financial tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartOfAccountsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="protected">
          <ProtectedConfigurationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
