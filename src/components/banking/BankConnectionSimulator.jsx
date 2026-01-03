import { useState, useEffect } from 'react';
import { Check, Loader2, Building2, CreditCard, Landmark, Lock, ShieldCheck } from 'lucide-react';
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
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        <div className="bg-[#000000] px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-white" />
              <span className="text-white text-sm font-medium">Secure connection</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#00d4b4] text-xs font-semibold tracking-wide">POWERED BY</span>
              <span className="text-white text-sm font-bold">plaid</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-14 h-14 rounded-xl bg-white"
            >
              <div style={{ color: institution?.primary_color || '#000' }}>
                {getInstitutionIcon(institution?.institution_type)}
              </div>
            </div>
            <div>
              <h2 className="text-white text-xl font-semibold">{institution?.name}</h2>
              <p className="text-gray-300 text-sm">
                {step === 'credentials' && 'Sign in to securely connect'}
                {step === 'connecting' && 'Establishing secure connection'}
                {step === 'select-account' && 'Select account to link'}
                {step === 'loading-transactions' && 'Importing transactions'}
                {step === 'error' && 'Connection failed'}
              </p>
            </div>
          </div>
        </div>

        {step === 'credentials' && (
          <div className="px-6 py-6 space-y-5">
            <div className="bg-[#f0fdf9] border border-[#00d4b4]/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-[#00a58e] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Your credentials are encrypted</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Plaid uses 256-bit encryption and never shares your credentials with Base44
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  className="h-11"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-11 hover:bg-gray-50"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 bg-[#00d4b4] hover:bg-[#00a58e] text-white font-medium"
                onClick={handleConnect}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'connecting' && (
          <div className="px-6 py-10 space-y-6">
            {SIMULATION_STEPS.map((simStep, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {index < currentSimulationStep ? (
                    <div className="w-7 h-7 rounded-full bg-[#00d4b4] flex items-center justify-center">
                      <Check className="h-4 w-4 text-white stroke-[3]" />
                    </div>
                  ) : index === currentSimulationStep ? (
                    <Loader2 className="h-7 w-7 animate-spin text-[#00d4b4]" />
                  ) : (
                    <div className="w-7 h-7 rounded-full border-2 border-gray-200" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-base ${index <= currentSimulationStep ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                    {simStep.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 'select-account' && (
          <div className="px-6 py-6">
            <p className="text-sm text-gray-600 mb-5">
              Select which account you'd like to connect
            </p>
            <div className="space-y-3">
              {accounts.map((account, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectAccount(account)}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-[#00d4b4] hover:bg-[#f0fdf9]/50 transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-base mb-0.5">
                        {account.displayName}
                      </p>
                      <p className="text-sm text-gray-500 capitalize">
                        {account.accountType}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-gray-600">
                        ····{account.accountNumberLast4}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full mt-6 h-11 hover:bg-gray-50"
              onClick={handleClose}
            >
              Cancel
            </Button>
          </div>
        )}

        {step === 'loading-transactions' && (
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <Loader2 className="h-14 w-14 animate-spin text-[#00d4b4] mb-5" />
            <p className="text-base font-medium text-gray-900 mb-1">
              Importing transactions
            </p>
            <p className="text-sm text-gray-500">
              This may take a moment
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="px-6 py-6 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900 font-medium">{error}</p>
            </div>
            <Button
              variant="outline"
              className="w-full h-11 hover:bg-gray-50"
              onClick={handleClose}
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
