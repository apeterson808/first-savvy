import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function NotificationsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Control how and when you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-notifications">Email Notifications</Label>
            <Switch id="email-notifications" />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="transaction-alerts">Transaction Alerts</Label>
            <Switch id="transaction-alerts" />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="budget-alerts">Budget Alerts</Label>
            <Switch id="budget-alerts" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
