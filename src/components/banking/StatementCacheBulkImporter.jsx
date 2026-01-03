import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Database, CheckCircle2, AlertCircle, Wallet, CreditCard,
  PiggyBank, ArrowRight, ArrowLeft, Check, X, Upload,
  Calendar, FileText, Loader2
} from 'lucide-react';
import { getAvailableInstitutions, getAccountsForInstitution, getStatementCache } from '@/api/bankSimulation';
import { importFromStatementCache } from '@/api/bankSimulation';
import { firstsavvy } from '@/api/firstsavvyClient';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STEPS = {
  SELECT_ACCOUNTS: 1,
  CONFIGURE_ACCOUNTS: 2,
  SELECT_DATE_RANGES: 3,
  PREVIEW: 4,
  IMPORTING: 5,
  RESULTS: 6
};

const getAccountTypeIcon = (accountType) => {
  switch (accountType) {
    case 'checking':
      return Wallet;
    case 'savings':
      return PiggyBank;
    case 'credit':
    case 'credit_card':
      return CreditCard;
    default:
      return Wallet;
  }
};

const getAccountTypeLabel = (accountType) => {
  switch (accountType) {
    case 'checking':
      return 'Checking';
    case 'savings':
      return 'Savings';
    case 'credit':
    case 'credit_card':
      return 'Credit Card';
    default:
      return accountType;
  }
};

export default function StatementCacheBulkImporter({ open, onOpenChange }) {
  const [currentStep, setCurrentStep] = useState(STEPS.SELECT_ACCOUNTS);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [selectedAccountKeys, setSelectedAccountKeys] = useState(new Set());
  const [accountConfigurations, setAccountConfigurations] = useState({});
  const [dateRangeSelections, setDateRangeSelections] = useState({});
  const [importResults, setImportResults] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const queryClient = useQueryClient();

  const { data: institutions, isLoading: institutionsLoading } = useQuery({
    queryKey: ['available-institutions'],
    queryFn: getAvailableInstitutions,
    enabled: open
  });

  const { data: existingAccounts = [] } = useQuery({
    queryKey: ['activeAccounts'],
    queryFn: async () => {
      const accounts = await firstsavvy.entities.Account.filter({
        is_active: true,
        account_type: ['checking', 'savings', 'credit_card']
      });
      return accounts;
    },
    enabled: open
  });

  useEffect(() => {
    if (open) {
      setCurrentStep(STEPS.SELECT_ACCOUNTS);
      setSelectedAccountKeys(new Set());
      setAccountConfigurations({});
      setDateRangeSelections({});
      setImportResults(null);
      loadAvailableAccounts();
    }
  }, [open]);

  const loadAvailableAccounts = async () => {
    if (!institutions || institutions.length === 0) return;

    try {
      const allAccounts = [];
      const allowedTypes = ['checking', 'savings', 'credit'];

      for (const institution of institutions) {
        const accounts = await getAccountsForInstitution(institution.name);
        const filteredAccounts = accounts.filter(acc => allowedTypes.includes(acc.accountType));

        for (const account of filteredAccounts) {
          const statements = await getStatementCache(institution.name, account.accountType);

          if (statements && statements.length > 0) {
            const totalTransactions = statements.reduce((sum, stmt) => sum + (stmt.transaction_count || 0), 0);
            const sortedStatements = [...statements].sort((a, b) => {
              const yearDiff = a.statement_year - b.statement_year;
              if (yearDiff !== 0) return yearDiff;
              const monthOrder = { sep: 9, oct: 10, nov: 11, dec: 12 };
              return (monthOrder[a.statement_month] || 0) - (monthOrder[b.statement_month] || 0);
            });

            const key = `${institution.name}-${account.accountType}-${account.accountNumberLast4}`;

            allAccounts.push({
              key,
              ...account,
              institutionId: institution.id,
              institutionLogo: institution.logo_url,
              statementCount: statements.length,
              totalTransactions,
              statements: sortedStatements
            });
          }
        }
      }

      setAvailableAccounts(allAccounts);
    } catch (error) {
      console.error('Error loading cached accounts:', error);
      toast.error('Failed to load cached accounts');
    }
  };

  useEffect(() => {
    if (institutions) {
      loadAvailableAccounts();
    }
  }, [institutions]);

  const handleSelectAll = () => {
    if (selectedAccountKeys.size === availableAccounts.length) {
      setSelectedAccountKeys(new Set());
    } else {
      setSelectedAccountKeys(new Set(availableAccounts.map(acc => acc.key)));
    }
  };

  const toggleAccountSelection = (accountKey) => {
    const newSelection = new Set(selectedAccountKeys);
    if (newSelection.has(accountKey)) {
      newSelection.delete(accountKey);
    } else {
      newSelection.add(accountKey);
    }
    setSelectedAccountKeys(newSelection);
  };

  const handleNextFromSelectAccounts = () => {
    if (selectedAccountKeys.size === 0) {
      toast.error('Please select at least one account');
      return;
    }

    const configs = {};
    selectedAccountKeys.forEach(key => {
      const account = availableAccounts.find(acc => acc.key === key);
      if (!account) return;

      const matchedAccount = existingAccounts.find(
        existing =>
          existing.institution_name === account.institutionName &&
          existing.account_number_last4 === account.accountNumberLast4 &&
          (
            (existing.account_type === 'credit_card' && account.accountType === 'credit') ||
            (existing.account_type === account.accountType)
          )
      );

      configs[key] = {
        action: matchedAccount ? 'use_existing' : 'create_new',
        existingAccountId: matchedAccount?.id || null,
        existingAccountName: matchedAccount?.account_name || null,
        newAccountName: matchedAccount ? '' : `${account.institutionName} ${getAccountTypeLabel(account.accountType)} ****${account.accountNumberLast4}`,
        openingBalance: 0
      };
    });

    setAccountConfigurations(configs);
    setCurrentStep(STEPS.CONFIGURE_ACCOUNTS);
  };

  const handleNextFromConfigureAccounts = () => {
    const dateRanges = {};
    selectedAccountKeys.forEach(key => {
      const account = availableAccounts.find(acc => acc.key === key);
      if (account && account.statements) {
        const selectedMonths = new Set(account.statements.map(stmt =>
          `${stmt.statement_year}-${stmt.statement_month}`
        ));
        dateRanges[key] = selectedMonths;
      }
    });

    setDateRangeSelections(dateRanges);
    setCurrentStep(STEPS.SELECT_DATE_RANGES);
  };

  const handleNextFromDateRanges = () => {
    let hasSelection = false;
    for (const ranges of Object.values(dateRangeSelections)) {
      if (ranges.size > 0) {
        hasSelection = true;
        break;
      }
    }

    if (!hasSelection) {
      toast.error('Please select at least one date range to import');
      return;
    }

    setCurrentStep(STEPS.PREVIEW);
  };

  const handleStartImport = async () => {
    setCurrentStep(STEPS.IMPORTING);
    setIsImporting(true);

    try {
      const importData = Array.from(selectedAccountKeys).map(key => {
        const account = availableAccounts.find(acc => acc.key === key);
        const config = accountConfigurations[key];
        const selectedRanges = dateRangeSelections[key];

        const selectedStatements = account.statements.filter(stmt =>
          selectedRanges.has(`${stmt.statement_year}-${stmt.statement_month}`)
        );

        return {
          key,
          institutionName: account.institutionName,
          accountType: account.accountType,
          accountNumberLast4: account.accountNumberLast4,
          action: config.action,
          existingAccountId: config.existingAccountId,
          newAccountName: config.newAccountName,
          openingBalance: config.openingBalance,
          statements: selectedStatements
        };
      });

      const results = await importFromStatementCache(importData);
      setImportResults(results);
      setCurrentStep(STEPS.RESULTS);

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['activeAccounts'] });
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Import failed: ' + error.message);
      setCurrentStep(STEPS.PREVIEW);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      onOpenChange(false);
    }
  };

  const handleFinish = () => {
    onOpenChange(false);
    toast.success('Import completed successfully');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Bulk Import from Statement Cache
          </DialogTitle>
        </DialogHeader>

        {currentStep === STEPS.SELECT_ACCOUNTS && (
          <StepSelectAccounts
            availableAccounts={availableAccounts}
            selectedAccountKeys={selectedAccountKeys}
            loading={institutionsLoading}
            onToggleAccount={toggleAccountSelection}
            onSelectAll={handleSelectAll}
            onNext={handleNextFromSelectAccounts}
            onCancel={handleClose}
          />
        )}

        {currentStep === STEPS.CONFIGURE_ACCOUNTS && (
          <StepConfigureAccounts
            availableAccounts={availableAccounts}
            selectedAccountKeys={selectedAccountKeys}
            accountConfigurations={accountConfigurations}
            onConfigChange={setAccountConfigurations}
            onNext={handleNextFromConfigureAccounts}
            onBack={() => setCurrentStep(STEPS.SELECT_ACCOUNTS)}
          />
        )}

        {currentStep === STEPS.SELECT_DATE_RANGES && (
          <StepSelectDateRanges
            availableAccounts={availableAccounts}
            selectedAccountKeys={selectedAccountKeys}
            dateRangeSelections={dateRangeSelections}
            onDateRangeChange={setDateRangeSelections}
            onNext={handleNextFromDateRanges}
            onBack={() => setCurrentStep(STEPS.CONFIGURE_ACCOUNTS)}
          />
        )}

        {currentStep === STEPS.PREVIEW && (
          <StepPreview
            availableAccounts={availableAccounts}
            selectedAccountKeys={selectedAccountKeys}
            accountConfigurations={accountConfigurations}
            dateRangeSelections={dateRangeSelections}
            onStartImport={handleStartImport}
            onBack={() => setCurrentStep(STEPS.SELECT_DATE_RANGES)}
          />
        )}

        {currentStep === STEPS.IMPORTING && (
          <StepImporting />
        )}

        {currentStep === STEPS.RESULTS && (
          <StepResults
            results={importResults}
            onFinish={handleFinish}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepSelectAccounts({
  availableAccounts,
  selectedAccountKeys,
  loading,
  onToggleAccount,
  onSelectAll,
  onNext,
  onCancel
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (availableAccounts.length === 0) {
    return (
      <div className="text-center py-12">
        <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-lg font-medium mb-2">No Cached Accounts Available</p>
        <p className="text-sm text-muted-foreground mb-6">
          No cached statement data found for checking, savings, or credit card accounts.
        </p>
        <Button onClick={onCancel}>Close</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Select accounts to import</p>
          <p className="text-xs text-muted-foreground">
            {selectedAccountKeys.size} of {availableAccounts.length} accounts selected
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onSelectAll}>
          {selectedAccountKeys.size === availableAccounts.length ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {availableAccounts.map((account) => {
          const AccountIcon = getAccountTypeIcon(account.accountType);
          const isSelected = selectedAccountKeys.has(account.key);

          return (
            <Card
              key={account.key}
              className={`cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-slate-50'
              }`}
              onClick={() => onToggleAccount(account.key)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox checked={isSelected} onCheckedChange={() => onToggleAccount(account.key)} />

                  <div className="p-2 bg-slate-100 rounded-lg">
                    <AccountIcon className="w-5 h-5 text-slate-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">
                        {account.institutionName} {getAccountTypeLabel(account.accountType)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">****{account.accountNumberLast4}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {account.statementCount} statements
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {account.totalTransactions} transactions
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onNext} disabled={selectedAccountKeys.size === 0}>
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function StepConfigureAccounts({
  availableAccounts,
  selectedAccountKeys,
  accountConfigurations,
  onConfigChange,
  onNext,
  onBack
}) {
  const updateConfig = (key, field, value) => {
    onConfigChange({
      ...accountConfigurations,
      [key]: {
        ...accountConfigurations[key],
        [field]: value
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-1">Configure account settings</p>
        <p className="text-xs text-muted-foreground">
          Choose whether to import to existing accounts or create new ones
        </p>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {Array.from(selectedAccountKeys).map(key => {
          const account = availableAccounts.find(acc => acc.key === key);
          const config = accountConfigurations[key];
          if (!account || !config) return null;

          const AccountIcon = getAccountTypeIcon(account.accountType);

          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <AccountIcon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {account.institutionName} {getAccountTypeLabel(account.accountType)}
                    </p>
                    <p className="text-xs text-muted-foreground">****{account.accountNumberLast4}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      variant={config.action === 'use_existing' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => updateConfig(key, 'action', 'use_existing')}
                      disabled={!config.existingAccountId}
                    >
                      Use Existing
                    </Button>
                    <Button
                      variant={config.action === 'create_new' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => updateConfig(key, 'action', 'create_new')}
                    >
                      Create New
                    </Button>
                  </div>

                  {config.action === 'use_existing' && config.existingAccountId && (
                    <Alert>
                      <CheckCircle2 className="w-4 h-4" />
                      <AlertDescription className="text-xs">
                        Will import to: <strong>{config.existingAccountName}</strong>
                      </AlertDescription>
                    </Alert>
                  )}

                  {config.action === 'use_existing' && !config.existingAccountId && (
                    <Alert>
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription className="text-xs">
                        No matching account found. Please create a new account instead.
                      </AlertDescription>
                    </Alert>
                  )}

                  {config.action === 'create_new' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Account Name</Label>
                        <Input
                          value={config.newAccountName}
                          onChange={(e) => updateConfig(key, 'newAccountName', e.target.value)}
                          placeholder="Enter account name"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Opening Balance</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={config.openingBalance}
                          onChange={(e) => updateConfig(key, 'openingBalance', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function StepSelectDateRanges({
  availableAccounts,
  selectedAccountKeys,
  dateRangeSelections,
  onDateRangeChange,
  onNext,
  onBack
}) {
  const toggleDateRange = (accountKey, rangeKey) => {
    const currentRanges = new Set(dateRangeSelections[accountKey] || []);
    if (currentRanges.has(rangeKey)) {
      currentRanges.delete(rangeKey);
    } else {
      currentRanges.add(rangeKey);
    }
    onDateRangeChange({
      ...dateRangeSelections,
      [accountKey]: currentRanges
    });
  };

  const selectAllForAccount = (accountKey, account) => {
    const allRanges = account.statements.map(stmt =>
      `${stmt.statement_year}-${stmt.statement_month}`
    );
    const currentRanges = dateRangeSelections[accountKey] || new Set();

    if (currentRanges.size === allRanges.length) {
      onDateRangeChange({
        ...dateRangeSelections,
        [accountKey]: new Set()
      });
    } else {
      onDateRangeChange({
        ...dateRangeSelections,
        [accountKey]: new Set(allRanges)
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-1">Select date ranges to import</p>
        <p className="text-xs text-muted-foreground">
          Choose which statement periods to import for each account
        </p>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {Array.from(selectedAccountKeys).map(key => {
          const account = availableAccounts.find(acc => acc.key === key);
          if (!account) return null;

          const AccountIcon = getAccountTypeIcon(account.accountType);
          const selectedRanges = dateRangeSelections[key] || new Set();
          const totalSelectedTxs = account.statements
            .filter(stmt => selectedRanges.has(`${stmt.statement_year}-${stmt.statement_month}`))
            .reduce((sum, stmt) => sum + stmt.transaction_count, 0);

          return (
            <Card key={key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <AccountIcon className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {account.institutionName} {getAccountTypeLabel(account.accountType)}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">****{account.accountNumberLast4}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectAllForAccount(key, account)}
                  >
                    {selectedRanges.size === account.statements.length ? 'Clear All' : 'Select All'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {account.statements.map(stmt => {
                  const rangeKey = `${stmt.statement_year}-${stmt.statement_month}`;
                  const isSelected = selectedRanges.has(rangeKey);
                  const monthName = stmt.statement_month.charAt(0).toUpperCase() + stmt.statement_month.slice(1);

                  return (
                    <div
                      key={rangeKey}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => toggleDateRange(key, rangeKey)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleDateRange(key, rangeKey)}
                        />
                        <div>
                          <p className="text-sm font-medium">{monthName} {stmt.statement_year}</p>
                          <p className="text-xs text-muted-foreground">
                            {stmt.transaction_count} transactions
                          </p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </div>
                  );
                })}
                {selectedRanges.size > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      <strong>{selectedRanges.size}</strong> periods selected, <strong>{totalSelectedTxs}</strong> transactions
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function StepPreview({
  availableAccounts,
  selectedAccountKeys,
  accountConfigurations,
  dateRangeSelections,
  onStartImport,
  onBack
}) {
  let totalNewAccounts = 0;
  let totalTransactions = 0;

  const summary = Array.from(selectedAccountKeys).map(key => {
    const account = availableAccounts.find(acc => acc.key === key);
    const config = accountConfigurations[key];
    const selectedRanges = dateRangeSelections[key] || new Set();

    if (!account || !config) return null;

    const selectedStatements = account.statements.filter(stmt =>
      selectedRanges.has(`${stmt.statement_year}-${stmt.statement_month}`)
    );

    const txCount = selectedStatements.reduce((sum, stmt) => sum + stmt.transaction_count, 0);
    totalTransactions += txCount;

    if (config.action === 'create_new') {
      totalNewAccounts++;
    }

    return {
      account,
      config,
      selectedStatements,
      txCount
    };
  }).filter(Boolean);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-1">Review and confirm import</p>
        <p className="text-xs text-muted-foreground">
          Please review the following summary before importing
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{selectedAccountKeys.size}</p>
            <p className="text-xs text-muted-foreground">Accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalTransactions}</p>
            <p className="text-xs text-muted-foreground">Transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalNewAccounts}</p>
            <p className="text-xs text-muted-foreground">New Accounts</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {summary.map(({ account, config, selectedStatements, txCount }) => {
          const AccountIcon = getAccountTypeIcon(account.accountType);

          return (
            <Card key={account.key}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <AccountIcon className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {account.institutionName} {getAccountTypeLabel(account.accountType)} ****{account.accountNumberLast4}
                    </p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant={config.action === 'create_new' ? 'default' : 'secondary'} className="text-xs">
                          {config.action === 'create_new' ? 'Creating New' : 'Using Existing'}
                        </Badge>
                        {config.action === 'create_new' ? (
                          <span className="text-muted-foreground">{config.newAccountName}</span>
                        ) : (
                          <span className="text-muted-foreground">{config.existingAccountName}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedStatements.length} statements, {txCount} transactions
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertDescription className="text-xs">
          Duplicate transactions (matching date and amount) will be automatically skipped.
        </AlertDescription>
      </Alert>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onStartImport} className="bg-primary hover:bg-primary/90">
          <Upload className="w-4 h-4 mr-2" />
          Start Import
        </Button>
      </div>
    </div>
  );
}

function StepImporting() {
  return (
    <div className="text-center py-16">
      <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-4" />
      <p className="text-lg font-medium mb-2">Importing transactions...</p>
      <p className="text-sm text-muted-foreground">
        This may take a few moments. Please do not close this window.
      </p>
    </div>
  );
}

function StepResults({ results, onFinish }) {
  if (!results) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <p className="text-lg font-medium">Import Failed</p>
        <Button onClick={onFinish} className="mt-4">Close</Button>
      </div>
    );
  }

  const { success, accountsCreated, transactionsImported, duplicatesSkipped, errors } = results;

  return (
    <div className="space-y-4">
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <p className="text-xl font-bold mb-2">Import Completed Successfully!</p>
        <p className="text-sm text-muted-foreground">
          Your transactions have been imported and are now available.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{accountsCreated}</p>
            <p className="text-xs text-muted-foreground">Accounts Created</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{transactionsImported}</p>
            <p className="text-xs text-muted-foreground">Transactions Imported</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-500">{duplicatesSkipped}</p>
            <p className="text-xs text-muted-foreground">Duplicates Skipped</p>
          </CardContent>
        </Card>
      </div>

      {errors && errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            <p className="font-medium mb-1">Some errors occurred:</p>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-center pt-4 border-t">
        <Button onClick={onFinish} className="bg-primary hover:bg-primary/90">
          <Check className="w-4 h-4 mr-2" />
          Done
        </Button>
      </div>
    </div>
  );
}
