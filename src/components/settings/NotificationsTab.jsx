import { useState } from 'react';
import { Bell, Mail, Smartphone, TrendingUp, CreditCard, BarChart3, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import { updateUserProfile } from '../../api/userSettings';

export default function NotificationsTab({ profile, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState({
    email_notifications: profile?.email_notifications ?? true,
    push_notifications: profile?.push_notifications ?? true,
    budget_alerts: profile?.budget_alerts ?? true,
    transaction_alerts: profile?.transaction_alerts ?? true,
    weekly_summary: profile?.weekly_summary ?? true,
    monthly_report: profile?.monthly_report ?? true,
  });

  const handleToggle = (field) => {
    setNotifications(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (profile?.id === 'demo') {
      toast.info('Demo mode: Changes are not saved');
      onUpdate({ ...profile, ...notifications });
      return;
    }

    setLoading(true);

    try {
      const updatedProfile = await updateUserProfile(profile.id, notifications);
      onUpdate(updatedProfile);
      toast.success('Notification preferences updated successfully');
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      toast.error('Failed to update notification preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Manage how and when you receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Channels
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="email_notifications" className="flex items-center gap-2 cursor-pointer">
                      <Mail className="h-4 w-4" />
                      Email Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    id="email_notifications"
                    checked={notifications.email_notifications}
                    onCheckedChange={() => handleToggle('email_notifications')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="push_notifications" className="flex items-center gap-2 cursor-pointer">
                      <Smartphone className="h-4 w-4" />
                      Push Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive push notifications in your browser
                    </p>
                  </div>
                  <Switch
                    id="push_notifications"
                    checked={notifications.push_notifications}
                    onCheckedChange={() => handleToggle('push_notifications')}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Alert Types
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="budget_alerts" className="flex items-center gap-2 cursor-pointer">
                      <BarChart3 className="h-4 w-4" />
                      Budget Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when you approach or exceed budget limits
                    </p>
                  </div>
                  <Switch
                    id="budget_alerts"
                    checked={notifications.budget_alerts}
                    onCheckedChange={() => handleToggle('budget_alerts')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="transaction_alerts" className="flex items-center gap-2 cursor-pointer">
                      <CreditCard className="h-4 w-4" />
                      Transaction Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive alerts for new transactions and large purchases
                    </p>
                  </div>
                  <Switch
                    id="transaction_alerts"
                    checked={notifications.transaction_alerts}
                    onCheckedChange={() => handleToggle('transaction_alerts')}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Reports & Summaries
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="weekly_summary" className="flex items-center gap-2 cursor-pointer">
                      <BarChart3 className="h-4 w-4" />
                      Weekly Summary
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive a weekly summary of your financial activity
                    </p>
                  </div>
                  <Switch
                    id="weekly_summary"
                    checked={notifications.weekly_summary}
                    onCheckedChange={() => handleToggle('weekly_summary')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="monthly_report" className="flex items-center gap-2 cursor-pointer">
                      <FileText className="h-4 w-4" />
                      Monthly Report
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive a detailed monthly financial report
                    </p>
                  </div>
                  <Switch
                    id="monthly_report"
                    checked={notifications.monthly_report}
                    onCheckedChange={() => handleToggle('monthly_report')}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
