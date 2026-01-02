import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, DollarSign, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatementImportWizard from './StatementImportWizard';
import AccountCreationWizard from './AccountCreationWizard';

export default function BankAccountSetupFlow({ open, onOpenChange, onAccountCreated }) {
  const [step, setStep] = useState('choice');
  const [selectedAccountType, setSelectedAccountType] = useState(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showManualWizard, setShowManualWizard] = useState(false);

  const resetFlow = () => {
    setStep('choice');
    setSelectedAccountType(null);
    setShowImportWizard(false);
    setShowManualWizard(false);
  };

  const handleAccountTypeSelect = (type) => {
    setSelectedAccountType(type);
    setStep('method');
  };

  const handleImportChoice = () => {
    setShowImportWizard(true);
    onOpenChange(false);
  };

  const handleManualChoice = () => {
    setShowManualWizard(true);
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === 'method') {
      setStep('choice');
      setSelectedAccountType(null);
    }
  };

  const handleClose = (newOpen) => {
    if (!newOpen) resetFlow();
    onOpenChange(newOpen);
  };

  const renderAccountTypeChoice = () => (
    <div className="space-y-6 max-w-md mx-auto py-6">
      <p className="text-center text-slate-600">
        What type of account would you like to add?
      </p>

      <div className="grid gap-3">
        <Card
          className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
          onClick={() => handleAccountTypeSelect('checking')}
        >
          <CardContent className="p-5">
            <h3 className="font-semibold text-base">Checking Account</h3>
            <p className="text-sm text-slate-600 mt-1">
              For everyday transactions and bill payments
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
          onClick={() => handleAccountTypeSelect('savings')}
        >
          <CardContent className="p-5">
            <h3 className="font-semibold text-base">Savings Account</h3>
            <p className="text-sm text-slate-600 mt-1">
              For building emergency funds and long-term savings
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
          onClick={() => handleAccountTypeSelect('credit_card')}
        >
          <CardContent className="p-5">
            <h3 className="font-semibold text-base">Credit Card</h3>
            <p className="text-sm text-slate-600 mt-1">
              For tracking credit card purchases and payments
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderMethodChoice = () => (
    <div className="space-y-6 max-w-lg mx-auto py-6">
      <p className="text-center text-slate-600">
        How would you like to set up your account?
      </p>

      <div className="grid gap-4">
        <Card
          className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
          onClick={handleImportChoice}
        >
          <CardContent className="p-6 flex items-start gap-4">
            <div className="rounded-full bg-blue-100 p-3">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Import from Statement</h3>
              <p className="text-sm text-slate-600">
                Upload a bank statement (CSV, PDF, or OFX) to automatically create the account and import transactions
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-slate-400 hover:shadow-md transition-all"
          onClick={handleManualChoice}
        >
          <CardContent className="p-6 flex items-start gap-4">
            <div className="rounded-full bg-slate-100 p-3">
              <DollarSign className="w-6 h-6 text-slate-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Enter Manually</h3>
              <p className="text-sm text-slate-600">
                Create an empty account and add transactions later
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const getTitle = () => {
    if (step === 'choice') return 'Add Bank Account';
    if (step === 'method') {
      const typeLabels = {
        checking: 'Checking Account',
        savings: 'Savings Account',
        credit_card: 'Credit Card'
      };
      return `Set Up ${typeLabels[selectedAccountType] || 'Account'}`;
    }
    return 'Add Bank Account';
  };

  return (
    <>
      <Dialog open={open && !showImportWizard && !showManualWizard} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{getTitle()}</DialogTitle>
          </DialogHeader>

          <div className="min-h-[300px]">
            {step === 'choice' && renderAccountTypeChoice()}
            {step === 'method' && renderMethodChoice()}
          </div>

          {step === 'method' && (
            <div className="flex justify-start pt-4 border-t">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <StatementImportWizard
        open={showImportWizard}
        onOpenChange={(newOpen) => {
          setShowImportWizard(newOpen);
          if (!newOpen) {
            resetFlow();
            onOpenChange(false);
          }
        }}
        accountType={selectedAccountType}
        onAccountCreated={(result) => {
          setShowImportWizard(false);
          resetFlow();
          onAccountCreated?.(result);
        }}
      />

      <AccountCreationWizard
        open={showManualWizard}
        onOpenChange={(newOpen) => {
          setShowManualWizard(newOpen);
          if (!newOpen) {
            resetFlow();
            onOpenChange(false);
          }
        }}
        initialAccountType="banking"
        initialSubtype={selectedAccountType}
        onAccountCreated={(result) => {
          setShowManualWizard(false);
          resetFlow();
          onAccountCreated?.(result);
        }}
      />
    </>
  );
}
