import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';

export default function PlaidConnectionTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);

    const testResults = {
      steps: [],
      overall: 'pending'
    };

    try {
      testResults.steps.push({
        name: 'Check Authentication',
        status: 'running'
      });

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        testResults.steps[0].status = 'failed';
        testResults.steps[0].error = authError?.message || 'Not authenticated';
        testResults.overall = 'failed';
        setResult(testResults);
        setTesting(false);
        return;
      }

      testResults.steps[0].status = 'passed';
      testResults.steps[0].details = `User ID: ${user.id}`;

      testResults.steps.push({
        name: 'Check Supabase Connection',
        status: 'running'
      });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        testResults.steps[1].status = 'failed';
        testResults.steps[1].error = 'VITE_SUPABASE_URL not configured';
        testResults.overall = 'failed';
        setResult(testResults);
        setTesting(false);
        return;
      }

      testResults.steps[1].status = 'passed';
      testResults.steps[1].details = `URL: ${supabaseUrl}`;

      testResults.steps.push({
        name: 'Call Plaid Link Token Endpoint',
        status: 'running'
      });

      setResult({ ...testResults });

      const response = await base44.functions.plaidCreateLinkToken();

      if (response?.link_token) {
        testResults.steps[2].status = 'passed';
        testResults.steps[2].details = `Link token received (expires: ${response.expiration})`;
        testResults.overall = 'passed';
      } else {
        testResults.steps[2].status = 'failed';
        testResults.steps[2].error = 'No link token in response';
        testResults.overall = 'failed';
      }

    } catch (error) {
      const lastStep = testResults.steps[testResults.steps.length - 1];
      lastStep.status = 'failed';
      lastStep.error = error.message;
      lastStep.details = error.toString();
      testResults.overall = 'failed';

      if (error.message.includes('Plaid credentials not configured')) {
        lastStep.solution = 'Add PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV to Supabase Edge Function secrets';
      } else if (error.message.includes('INVALID_CREDENTIALS')) {
        lastStep.solution = 'Check that PLAID_CLIENT_ID and PLAID_SECRET are correct';
      } else if (error.message.includes('Unauthorized')) {
        lastStep.solution = 'Authentication issue - try logging out and back in';
      }
    }

    setResult(testResults);
    setTesting(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <Info className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Plaid Connection Test</CardTitle>
        <CardDescription>
          Test your Plaid integration to diagnose connection issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runTest} disabled={testing}>
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            'Run Connection Test'
          )}
        </Button>

        {result && (
          <div className="space-y-3">
            {result.steps.map((step, index) => (
              <Alert key={index} variant={step.status === 'failed' ? 'destructive' : 'default'}>
                <div className="flex items-start gap-3">
                  {getStatusIcon(step.status)}
                  <div className="flex-1">
                    <AlertTitle className="mb-1">{step.name}</AlertTitle>
                    {step.details && (
                      <AlertDescription className="text-sm text-muted-foreground">
                        {step.details}
                      </AlertDescription>
                    )}
                    {step.error && (
                      <AlertDescription className="text-sm font-medium mt-1">
                        Error: {step.error}
                      </AlertDescription>
                    )}
                    {step.solution && (
                      <AlertDescription className="text-sm mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded">
                        <strong>Solution:</strong> {step.solution}
                      </AlertDescription>
                    )}
                  </div>
                </div>
              </Alert>
            ))}

            {result.overall === 'passed' && (
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <AlertTitle className="text-green-900 dark:text-green-100">
                  All Tests Passed!
                </AlertTitle>
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Your Plaid connection is working correctly. You can now link bank accounts.
                </AlertDescription>
              </Alert>
            )}

            {result.overall === 'failed' && (
              <Alert variant="destructive">
                <XCircle className="h-5 w-5" />
                <AlertTitle>Test Failed</AlertTitle>
                <AlertDescription>
                  Please review the errors above and follow the suggested solutions.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
