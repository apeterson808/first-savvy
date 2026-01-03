import { useState, useEffect } from 'react';
import { Check, Loader2, Building2, CreditCard, Landmark } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { simulateBankConnection, getTransactionsForAccount } from '../../api/bankSimulation';

const SIMULATION_STEPS = [
  { label: 'Connecting to bank', duration: 1000 },
  { label: 'Authenticating', duration: 1500 },
  { label: 'Retrieving accounts', duration: 1200 },
  { label: 'Loading transaction history', duration: 1800 },
];

export function BankConnectionSimulator({ institution, open, onClose, onSuccess }) {
  const [step, setStep] = useState('credentials');
  const [currentSimulationStep, setCurrentSimulationStep] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (step === 'connecting' && currentSimulationStep < SIMULATION_STEPS.length) {
      const timer = setTimeout(() => {
        setCurrentSimulationStep(prev => prev + 1);
      }, SIMULATION_STEPS[currentSimulationStep].duration);

      return () => clearTimeout(timer);
    } else if (step === 'connecting' && currentSimulationStep >= SIMULATION_STEPS.length) {
      loadAccounts();
    }
  }, [step, currentSimulationStep]);

  async function loadAccounts() {
    try {
      const accountsData = await simulateBankConnection(institution.id);
      setAccounts(accountsData);
      setStep('select-account');
    } catch (err) {
      setError('Failed to connect to bank');
      setStep('error');
    }
  }

  async function handleConnect() {
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    setError(null);
    setStep('connecting');
    setCurrentSimulationStep(0);
  }

  async function handleSelectAccount(account) {
    setSelectedAccount(account);
    setStep('loading-transactions');

    try {
      const { transactions, totalTransactions } = await getTransactionsForAccount(
        account.institutionName,
        account.accountType,
        account.accountNumberLast4
      );

      setTimeout(() => {
        onSuccess({
          institution,
          account,
          transactions,
          totalTransactions
        });
      }, 500);
    } catch (err) {
      setError('Failed to load transactions');
      setStep('error');
    }
  }

  function handleClose() {
    setStep('credentials');
    setCurrentSimulationStep(0);
    setUsername('');
    setPassword('');
    setAccounts([]);
    setSelectedAccount(null);
    setError(null);
    onClose();
  }

  const getInstitutionIcon = (type) => {
    switch (type) {
      case 'credit_union':
        return <Landmark className="h-6 w-6" />;
      case 'brokerage':
        return <CreditCard className="h-6 w-6" />;
      default:
        return <Building2 className="h-6 w-6" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-lg"
              style={{ backgroundColor: institution?.primary_color + '20' }}
            >
              <div style={{ color: institution?.primary_color }}>
                {getInstitutionIcon(institution?.institution_type)}
              </div>
            </div>
            <div>
              <DialogTitle>{institution?.name}</DialogTitle>
              <DialogDescription>
                {step === 'credentials' && 'Sign in to connect your account'}
                {step === 'connecting' && 'Connecting to your bank...'}
                {step === 'select-account' && 'Select an account to import'}
                {step === 'loading-transactions' && 'Loading transaction history...'}
                {step === 'error' && 'Connection failed'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'credentials' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs text-blue-900">
                Demo Mode: Enter any credentials to simulate connection
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleConnect}>
                Connect
              </Button>
            </div>
          </div>
        )}

        {step === 'connecting' && (
          <div className="space-y-6 py-8">
            {SIMULATION_STEPS.map((simStep, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {index < currentSimulationStep ? (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  ) : index === currentSimulationStep ? (
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${index <= currentSimulationStep ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {simStep.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 'select-account' && (
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground mb-4">
              Found {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </div>
            <div className="space-y-2">
              {accounts.map((account, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectAccount(account)}
                  className="w-full p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{account.displayName}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {account.accountType}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-muted-foreground">
                        ****{account.accountNumberLast4}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        )}

        {step === 'loading-transactions' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
            <p className="text-sm text-muted-foreground">
              Loading transaction history...
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Importing from {selectedAccount?.displayName}
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-900">{error}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
