import { useState, useEffect } from 'react';
import { Building2, Loader2, CheckCircle2, Calendar, AlertCircle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const MOCK_ACCOUNTS = [
  { type: 'checking', name: 'Checking Account', lastFour: '4532', balance: 3250.75 },
  { type: 'savings', name: 'Savings Account', lastFour: '8821', balance: 12500.00 },
  { type: 'credit_card', name: 'Credit Card', lastFour: '2341', balance: -1250.50, limit: 5000 },
];

export function MockBankConnectionFlow({ institution, open, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState([0, 1, 2]);
  const [startDate, setStartDate] = useState(subDays(new Date(), 90));
  const [goLiveDate, setGoLiveDate] = useState(subDays(new Date(), 7));
  const [isProcessing, setIsProcessing] = useState(false);
  const [simulateError, setSimulateError] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setUsername('');
      setPassword('');
      setSelectedAccounts([0, 1, 2]);
      setStartDate(subDays(new Date(), 90));
      setGoLiveDate(subDays(new Date(), 7));
      setIsProcessing(false);
      setSimulateError(Math.random() < 0.1);
    }
  }, [open]);

  if (!institution) {
    return null;
  }

  const handleLogin = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (simulateError) {
      setIsProcessing(false);
      setStep(5);
      return;
    }

    setStep(3);
    setIsProcessing(false);
  };

  const handleSelectAccounts = async () => {
    if (selectedAccounts.length === 0) return;
    setStep(4);
  };

  const handleFinish = () => {
    const accounts = selectedAccounts.map(index => ({
      ...MOCK_ACCOUNTS[index],
      institution,
      startDate,
      goLiveDate,
    }));
    onSuccess(accounts);
    onClose();
  };

  const toggleAccount = (index) => {
    setSelectedAccounts(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map((num) => (
        <div
          key={num}
          className={cn(
            'w-2 h-2 rounded-full transition-colors',
            step >= num ? 'bg-primary' : 'bg-muted'
          )}
        />
      ))}
    </div>
  );

  const renderLoginStep = () => (
    <div className="space-y-6">
      {renderStepIndicator()}

      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full mx-auto overflow-hidden bg-white flex items-center justify-center border-2">
          {institution.logo_url ? (
            <img
              src={institution.logo_url}
              alt={institution.name}
              className="w-12 h-12 object-contain"
            />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-lg">{institution.name}</h3>
          <p className="text-sm text-muted-foreground">{institution.full_name}</p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Demo Mode: This is a simulated connection. No real credentials are required or stored.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username or Email</Label>
          <Input
            id="username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isProcessing}
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
            disabled={isProcessing}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleLogin}
          disabled={!username || !password || isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </div>
    </div>
  );

  const renderAuthenticatingStep = () => (
    <div className="space-y-6">
      {renderStepIndicator()}

      <div className="text-center space-y-6 py-8">
        <div className="w-16 h-16 rounded-full mx-auto overflow-hidden bg-white flex items-center justify-center border-2">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: institution.primary_color }} />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Authenticating...</h3>
          <p className="text-sm text-muted-foreground">
            Securely connecting to {institution.name}
          </p>
        </div>
      </div>
    </div>
  );

  const renderAccountSelectionStep = () => (
    <div className="space-y-6">
      {renderStepIndicator()}

      <div className="text-center space-y-2">
        <h3 className="font-semibold text-lg">Select Accounts</h3>
        <p className="text-sm text-muted-foreground">
          Choose which accounts to connect
        </p>
      </div>

      <div className="space-y-3">
        {MOCK_ACCOUNTS.map((account, index) => (
          <button
            key={index}
            onClick={() => toggleAccount(index)}
            className={cn(
              'w-full p-4 rounded-lg border-2 transition-all text-left',
              selectedAccounts.includes(index)
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selectedAccounts.includes(index)}
                onCheckedChange={() => toggleAccount(index)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{account.name}</span>
                  <Badge variant="outline" className="text-xs">
                    •••• {account.lastFour}
                  </Badge>
                </div>
                <div className="text-sm">
                  <span className={cn(
                    'font-semibold',
                    account.balance < 0 ? 'text-destructive' : 'text-foreground'
                  )}>
                    ${Math.abs(account.balance).toFixed(2)}
                  </span>
                  {account.type === 'credit_card' && (
                    <span className="text-muted-foreground ml-2">
                      / ${account.limit.toFixed(2)} limit
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 capitalize">
                  {account.type.replace('_', ' ')}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setStep(1)}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onClick={handleSelectAccounts}
          disabled={selectedAccounts.length === 0}
          className="flex-1"
        >
          Continue ({selectedAccounts.length})
        </Button>
      </div>
    </div>
  );

  const renderDateSelectionStep = () => (
    <div className="space-y-6">
      {renderStepIndicator()}

      <div className="text-center space-y-2">
        <h3 className="font-semibold text-lg">Transaction History</h3>
        <p className="text-sm text-muted-foreground">
          Configure your transaction import dates
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Transactions between Start Date and Go Live Date will be auto-categorized and marked as posted.
          Transactions from Go Live Date to today will be marked as pending for your review.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground'
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                disabled={(date) => date > new Date() || date < subDays(new Date(), 365)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            Historical data will be imported from this date
          </p>
        </div>

        <div className="space-y-2">
          <Label>Go Live Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !goLiveDate && 'text-muted-foreground'
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {goLiveDate ? format(goLiveDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={goLiveDate}
                onSelect={setGoLiveDate}
                disabled={(date) => date > new Date() || date < startDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            Transactions after this date will need manual review
          </p>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-muted space-y-2">
        <div className="text-sm font-medium">Summary</div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Posted Transactions:</span>
            <span className="font-medium">
              {format(startDate, 'MMM d')} - {format(goLiveDate, 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pending Transactions:</span>
            <span className="font-medium">
              {format(goLiveDate, 'MMM d')} - {format(new Date(), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Selected Accounts:</span>
            <span className="font-medium">{selectedAccounts.length}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setStep(3)}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onClick={handleFinish}
          className="flex-1"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Complete Connection
        </Button>
      </div>
    </div>
  );

  const renderErrorStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-6 py-8">
        <div className="w-16 h-16 rounded-full mx-auto bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Connection Failed</h3>
          <p className="text-sm text-muted-foreground">
            Unable to connect to {institution.name}. This could be due to:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 text-left max-w-sm mx-auto">
            <li>• Incorrect username or password</li>
            <li>• Two-factor authentication required</li>
            <li>• Temporary service interruption</li>
            <li>• Account locked or suspended</li>
          </ul>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            setStep(1);
            setSimulateError(false);
          }}
          className="flex-1"
        >
          Try Again
        </Button>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return renderLoginStep();
      case 2:
        return renderAuthenticatingStep();
      case 3:
        return renderAccountSelectionStep();
      case 4:
        return renderDateSelectionStep();
      case 5:
        return renderErrorStep();
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 5 ? 'Connection Error' : 'Connect Bank Account'}
          </DialogTitle>
          <DialogDescription>
            {step === 5
              ? 'There was a problem connecting to your bank'
              : 'Securely link your bank account to import transactions'}
          </DialogDescription>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
