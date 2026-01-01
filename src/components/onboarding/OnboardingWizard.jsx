import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AccountClassificationSelector from '@/components/common/AccountClassificationSelector';
import { Sparkles, CheckCircle2, ArrowRight, Wallet, Home, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { BASE44_COLORS } from '@/components/utils/constants';

const QUICK_SETUP_ACCOUNTS = [
  {
    id: 'checking',
    title: 'Main Checking Account',
    description: 'Your primary account for daily transactions',
    icon: Wallet,
    bgColor: BASE44_COLORS.skyBlue,
    defaultName: 'Checking Account',
    classFilter: 'asset'
  },
  {
    id: 'savings',
    title: 'Savings Account',
    description: 'Build your emergency fund and save for goals',
    icon: Home,
    bgColor: BASE44_COLORS.softGreen,
    defaultName: 'Savings Account',
    classFilter: 'asset'
  },
  {
    id: 'credit',
    title: 'Credit Card',
    description: 'Track spending and manage credit responsibly',
    icon: TrendingUp,
    bgColor: BASE44_COLORS.orange,
    defaultName: 'Credit Card',
    classFilter: 'liability'
  }
];

export default function OnboardingWizard({ open, onComplete }) {
  const [step, setStep] = useState('welcome');
  const [accountData, setAccountData] = useState({});
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const createAccountMutation = useMutation({
    mutationFn: async (account) => {
      return await firstsavvy.entities.Account.create(account);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    }
  });

  const handleStartSetup = () => {
    setStep('quick-setup');
    setCurrentAccountIndex(0);
  };

  const handleSkipToManual = () => {
    onComplete?.();
    navigate('/banking');
  };

  const handleNextAccount = () => {
    if (currentAccountIndex < QUICK_SETUP_ACCOUNTS.length - 1) {
      setCurrentAccountIndex(currentAccountIndex + 1);
    } else {
      handleFinishSetup();
    }
  };

  const handleSkipAccount = () => {
    const accountId = QUICK_SETUP_ACCOUNTS[currentAccountIndex].id;
    const newData = { ...accountData };
    delete newData[accountId];
    setAccountData(newData);
    handleNextAccount();
  };

  const handleFinishSetup = async () => {
    setStep('creating');
    try {
      const accountsToCreate = Object.entries(accountData)
        .filter(([_, data]) => data.name && data.account_classification_id)
        .map(([accountId, data]) => ({
          account_name: data.name,
          account_type: accountId === 'credit' ? 'credit_card' : accountId,
          current_balance: data.balance || 0,
          account_classification_id: data.account_classification_id,
          is_active: true
        }));

      for (const account of accountsToCreate) {
        await createAccountMutation.mutateAsync(account);
      }

      setStep('complete');
      setTimeout(() => {
        onComplete?.();
        navigate('/banking');
      }, 2000);
    } catch (error) {
      console.error('Error creating accounts:', error);
      toast.error('Failed to create accounts');
      setStep('quick-setup');
    }
  };

  const updateAccountData = (field, value) => {
    const accountId = QUICK_SETUP_ACCOUNTS[currentAccountIndex].id;
    setAccountData(prev => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        [field]: value
      }
    }));
  };

  const currentAccount = QUICK_SETUP_ACCOUNTS[currentAccountIndex];
  const currentData = accountData[currentAccount?.id] || {};
  const progress = ((currentAccountIndex + 1) / QUICK_SETUP_ACCOUNTS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl p-0 gap-0" hideCloseButton>
        {step === 'welcome' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `${BASE44_COLORS.skyBlue}20` }}
              >
                <Sparkles className="w-8 h-8" style={{ color: BASE44_COLORS.skyBlue }} />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Welcome to FirstSavvy!</h2>
              <p className="text-lg text-slate-600">
                Let's get you started with your financial journey
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${BASE44_COLORS.skyBlue}20` }}
                    >
                      <Wallet className="w-6 h-6" style={{ color: BASE44_COLORS.skyBlue }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">89 Account Types Ready</h3>
                      <p className="text-sm text-slate-600">
                        From checking accounts to investments, we've got you covered with a complete chart of accounts
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${BASE44_COLORS.softGreen}20` }}
                    >
                      <Home className="w-6 h-6" style={{ color: BASE44_COLORS.softGreen }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Quick Setup</h3>
                      <p className="text-sm text-slate-600">
                        We'll guide you through creating your essential accounts in just a few steps
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleStartSetup}
                className="flex-1 h-12 text-base font-medium"
                style={{ backgroundColor: BASE44_COLORS.skyBlue }}
              >
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                onClick={handleSkipToManual}
                variant="outline"
                className="flex-1 h-12 text-base font-medium"
              >
                I'll Do It Myself
              </Button>
            </div>
          </div>
        )}

        {step === 'quick-setup' && (
          <div className="p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">
                  Account {currentAccountIndex + 1} of {QUICK_SETUP_ACCOUNTS.length}
                </span>
                <span className="text-sm font-medium text-slate-600">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="mb-8">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: `${currentAccount.bgColor}20` }}
              >
                <currentAccount.icon className="w-8 h-8" style={{ color: currentAccount.bgColor }} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">{currentAccount.title}</h3>
              <p className="text-slate-600">{currentAccount.description}</p>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <Label>Account Name</Label>
                <Input
                  value={currentData.name || currentAccount.defaultName}
                  onChange={(e) => updateAccountData('name', e.target.value)}
                  placeholder={currentAccount.defaultName}
                  className="mt-1.5"
                />
              </div>

              <AccountClassificationSelector
                value={currentData.account_classification_id}
                onValueChange={(value) => updateAccountData('account_classification_id', value)}
                classFilter={currentAccount.classFilter}
                label="Account Type"
                required
              />

              <div>
                <Label>Current Balance (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={currentData.balance || ''}
                  onChange={(e) => updateAccountData('balance', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSkipAccount}
                variant="outline"
                className="flex-1"
              >
                Skip This Account
              </Button>
              <Button
                onClick={handleNextAccount}
                disabled={!currentData.name || !currentData.account_classification_id}
                className="flex-1"
                style={{ backgroundColor: BASE44_COLORS.skyBlue }}
              >
                {currentAccountIndex < QUICK_SETUP_ACCOUNTS.length - 1 ? 'Next' : 'Finish Setup'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 'creating' && (
          <div className="p-8 text-center">
            <div className="animate-spin w-16 h-16 border-4 border-slate-200 border-t-sky-600 rounded-full mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Creating Your Accounts</h3>
            <p className="text-slate-600">Just a moment...</p>
          </div>
        )}

        {step === 'complete' && (
          <div className="p-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${BASE44_COLORS.softGreen}20` }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: BASE44_COLORS.softGreen }} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">All Set!</h3>
            <p className="text-slate-600">Your accounts have been created successfully</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
