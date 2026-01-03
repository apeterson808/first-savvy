import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

export default function ProtectedConfigurationsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Protected Configurations</CardTitle>
          <CardDescription>
            View and manage protected system configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Protected configurations are managed programmatically.
              See the PROTECTED_CONFIG_GUIDE.md for API usage.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
