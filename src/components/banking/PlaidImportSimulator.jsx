import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Building2, CreditCard, PiggyBank, ChevronRight, Sparkles, Loader2, Check, HelpCircle } from 'lucide-react';
import { format, subDays, subMonths, startOfYear } from 'date-fns';

// Sample discovered accounts that would come from Plaid
const SAMPLE_DISCOVERED_ACCOUNTS = [
  {
    id: 'plaid_checking_1',
    name: 'Primary Checking',
    type: 'checking',
    accountType: 'bank',
    detailType: 'checking',
    balance: 4523.87,
    institution: 'Chase Bank',
    logo: 'https://logo.clearbit.com/chase.com',
    mask: '4521'
  },
  {
    id: 'plaid_savings_1',
    name: 'High Yield Savings',
    type: 'savings',
    accountType: 'bank',
    detailType: 'savings',
    balance: 12750.00,
    institution: 'Chase Bank',
    logo: 'https://logo.clearbit.com/chase.com',
    mask: '8834'
  },
  {
    id: 'plaid_cc_1',
    name: 'Sapphire Preferred',
    type: 'credit_card',
    accountType: 'credit_card',
    detailType: 'credit_card',
    balance: -1847.32,
    institution: 'Chase Bank',
    logo: 'https://logo.clearbit.com/chase.com',
    mask: '9012'
  }
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'bank', label: 'Bank Account' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
];

const DETAIL_TYPE_OPTIONS = {
  bank: [
    { value: 'checking', label: 'Checking' },
    { value: 'savings', label: 'Savings' },
  ],
  credit_card: [
    { value: 'credit_card', label: 'Credit Card' },
  ],
  asset: [
    { value: 'cash', label: 'Cash' },
    { value: 'investment', label: 'Investment' },
    { value: 'property', label: 'Property' },
    { value: 'vehicle', label: 'Vehicle' },
    { value: 'other', label: 'Other' },
  ],
  liability: [
    { value: 'mortgage', label: 'Mortgage' },
    { value: 'car_loan', label: 'Car Loan' },
    { value: 'student_loan', label: 'Student Loan' },
    { value: 'personal_loan', label: 'Personal Loan' },
    { value: 'other', label: 'Other' },
  ],
};

const DATA_RANGE_OPTIONS = [
  { value: 'last_30_days', label: 'Last 30 Days', days: 30 },
  { value: 'last_60_days', label: 'Last 60 Days', days: 60 },
  { value: 'last_90_days', label: 'Last 90 Days', days: 90 },
  { value: 'year_to_date', label: 'Year to Date', days: null },
  { value: 'last_year', label: 'Last Year', days: 365 },
  { value: 'all_available', label: 'All Available (2+ years)', days: 730 },
];

// Sample transactions that would come from Plaid
const generateSampleTransactions = (dataRange) => {
  const rangeOption = DATA_RANGE_OPTIONS.find(r => r.value === dataRange) || DATA_RANGE_OPTIONS[1];
  const today = new Date();
  
  let daysToGenerate;
  if (dataRange === 'year_to_date') {
    const startOfYearDate = startOfYear(today);
    daysToGenerate = Math.floor((today - startOfYearDate) / (1000 * 60 * 60 * 24));
  } else {
    daysToGenerate = rangeOption.days;
  }
  const categories = ['Groceries', 'Dining', 'Gas', 'Shopping', 'Utilities', 'Entertainment', 'Healthcare'];
  const merchants = {
    'Groceries': ['Whole Foods', 'Trader Joes', 'Safeway', 'Costco'],
    'Dining': ['Starbucks', 'Chipotle', 'McDonalds', 'Local Restaurant'],
    'Gas': ['Shell', 'Chevron', 'BP', 'Exxon'],
    'Shopping': ['Amazon', 'Target', 'Walmart', 'Best Buy'],
    'Utilities': ['PG&E', 'Comcast', 'AT&T', 'Water Company'],
    'Entertainment': ['Netflix', 'Spotify', 'Movie Theater', 'Concert Tickets'],
    'Healthcare': ['CVS Pharmacy', 'Walgreens', 'Doctor Visit', 'Gym Membership']
  };
  
  const transactions = [];
  
  // Generate transactions for the selected range
  for (let i = 0; i < daysToGenerate; i++) {
    const date = subDays(today, i);
    const numTransactions = Math.floor(Math.random() * 4) + 1;
    
    for (let j = 0; j < numTransactions; j++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const merchantList = merchants[category];
      const merchant = merchantList[Math.floor(Math.random() * merchantList.length)];
      const amount = (Math.random() * 150 + 5).toFixed(2);
      
      transactions.push({
        id: `plaid_txn_${i}_${j}`,
        date: format(date, 'yyyy-MM-dd'),
        description: merchant,
        amount: parseFloat(amount),
        type: 'expense',
        category_suggestion: category,
        account_id: SAMPLE_DISCOVERED_ACCOUNTS[Math.floor(Math.random() * 2)].id // checking or savings
      });
    }
  }
  
  // Add some income transactions
  for (let i = 0; i < 2; i++) {
    const date = subDays(today, i * 14 + 1);
    transactions.push({
      id: `plaid_income_${i}`,
      date: format(date, 'yyyy-MM-dd'),
      description: 'Payroll Direct Deposit',
      amount: 3250.00,
      type: 'income',
      category_suggestion: 'Salary',
      account_id: SAMPLE_DISCOVERED_ACCOUNTS[0].id
    });
  }
  
  return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
};

export default function PlaidImportSimulator({ open, onOpenChange, onImportComplete }) {
  const [step, setStep] = useState(1); // 1: Review Accounts, 2: Import Options, 3: Processing
  const [accountMappings, setAccountMappings] = useState({});
  const [dataRange, setDataRange] = useState('last_60_days'); // Controls how much data to pull
  const [goLiveDates, setGoLiveDates] = useState(() => {
    const initialDates = {};
    SAMPLE_DISCOVERED_ACCOUNTS.forEach(acc => {
      initialDates[acc.id] = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    });
    return initialDates;
  });
  const [accountNames, setAccountNames] = useState(() => {
    const initialNames = {};
    SAMPLE_DISCOVERED_ACCOUNTS.forEach(acc => {
      initialNames[acc.id] = acc.name;
    });
    return initialNames;
  });
  const [accountTypes, setAccountTypes] = useState(() => {
    const initialTypes = {};
    SAMPLE_DISCOVERED_ACCOUNTS.forEach(acc => {
      initialTypes[acc.id] = { accountType: acc.accountType, detailType: acc.detailType };
    });
    return initialTypes;
  });
  const [autoCategorizeBefore, setAutoCategorizeBefore] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  
  const queryClient = useQueryClient();

  const { data: existingAccounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.BankAccount.filter({ is_active: true })
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('name')
  });

  const sampleTransactions = React.useMemo(() => generateSampleTransactions(dataRange), [dataRange]);
  
  const getDataRangeLabel = () => {
    const option = DATA_RANGE_OPTIONS.find(r => r.value === dataRange);
    return option?.label || 'Last 60 Days';
  };

  // Count transactions before and after go-live date (per account)
  const transactionCounts = React.useMemo(() => {
    let historical = 0;
    let pending = 0;
    sampleTransactions.forEach(t => {
      const accountGoLiveDate = goLiveDates[t.account_id] || format(subDays(new Date(), 7), 'yyyy-MM-dd');
      if (t.date < accountGoLiveDate) {
        historical++;
      } else {
        pending++;
      }
    });
    return { historical, pending };
  }, [sampleTransactions, goLiveDates]);

  const handleAccountMapping = (plaidAccountId, action, existingAccountId = null) => {
    setAccountMappings(prev => ({
      ...prev,
      [plaidAccountId]: { action, existingAccountId }
    }));
  };

  const handleGoLiveDateChange = (plaidAccountId, date) => {
    setGoLiveDates(prev => ({
      ...prev,
      [plaidAccountId]: date
    }));
  };

  const createBankAccountMutation = useMutation({
    mutationFn: (data) => base44.entities.BankAccount.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    }
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
  });

  const processImport = async () => {
    setIsProcessing(true);
    setStep(3);

    try {
      const accountIdMap = {};

      setProcessingStatus('Creating accounts...');

      const existingAccountNumbers = existingAccounts
        .map(acc => parseInt(acc.account_number))
        .filter(num => !isNaN(num));
      let nextAccountNumber = existingAccountNumbers.length > 0
        ? Math.max(...existingAccountNumbers) + 1
        : 1001;

      for (const plaidAccount of SAMPLE_DISCOVERED_ACCOUNTS) {
        const mapping = accountMappings[plaidAccount.id];

        if (!mapping || mapping.action === 'create') {
          const types = accountTypes[plaidAccount.id] || { accountType: plaidAccount.accountType, detailType: plaidAccount.detailType };
          const accountData = {
            account_name: accountNames[plaidAccount.id] || plaidAccount.name,
            account_type: types.detailType,
            current_balance: Math.abs(plaidAccount.balance),
            start_date: goLiveDates[plaidAccount.id],
            institution_name: plaidAccount.institution,
            account_number: nextAccountNumber.toString(),
            account_number_last4: plaidAccount.mask,
            is_active: true
          };

          const newAccount = await createBankAccountMutation.mutateAsync(accountData);
          accountIdMap[plaidAccount.id] = newAccount.id;
          nextAccountNumber++;
        } else if (mapping.action === 'link' && mapping.existingAccountId) {
          accountIdMap[plaidAccount.id] = mapping.existingAccountId;
        } else if (mapping.action === 'skip') {
          continue;
        }
      }

      setProcessingStatus('Importing transactions...');

      const categoryMap = {};
      for (const cat of categories) {
        categoryMap[cat.name.toLowerCase()] = cat.id;
      }

      let processedCount = 0;
      const totalTransactions = sampleTransactions.filter(t => accountIdMap[t.account_id]).length;

      for (const txn of sampleTransactions) {
        const bankAccountId = accountIdMap[txn.account_id];
        if (!bankAccountId) continue;

        const accountGoLiveDate = goLiveDates[txn.account_id] || format(subDays(new Date(), 7), 'yyyy-MM-dd');
        const isHistorical = txn.date < accountGoLiveDate;

        let categoryId = null;
        if (autoCategorizeBefore || !isHistorical) {
          const suggestionLower = txn.category_suggestion.toLowerCase();
          categoryId = categoryMap[suggestionLower] || null;
        }

        const transactionData = {
          date: txn.date,
          description: txn.description,
          original_description: txn.description,
          amount: txn.amount,
          type: txn.type,
          bank_account_id: bankAccountId,
          category_id: categoryId,
          status: isHistorical && autoCategorizeBefore ? 'posted' : 'pending',
          payment_method: 'card'
        };

        await createTransactionMutation.mutateAsync(transactionData);
        processedCount++;
        setProcessingStatus(`Importing transactions... (${processedCount}/${totalTransactions})`);
      }

      setProcessingStatus('Import complete!');
      setIsProcessing(false);

      setTimeout(() => {
        onImportComplete?.();
        onOpenChange(false);
        setStep(1);
        setAccountMappings({});
        setGoLiveDates(() => {
          const initialDates = {};
          SAMPLE_DISCOVERED_ACCOUNTS.forEach(acc => {
            initialDates[acc.id] = format(subDays(new Date(), 7), 'yyyy-MM-dd');
          });
          return initialDates;
        });
      }, 1500);
    } catch (error) {
      console.error('Import error:', error);
      setProcessingStatus(`Error: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const getAccountIcon = (type) => {
    switch (type) {
      case 'checking':
      case 'savings':
        return <Building2 className="w-5 h-5 text-blue-600" />;
      case 'credit_card':
        return <CreditCard className="w-5 h-5 text-blue-700" />;
      default:
        return <PiggyBank className="w-5 h-5 text-green-600" />;
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4 py-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-green-800">
          <span className="font-medium">Success!</span> We found {SAMPLE_DISCOVERED_ACCOUNTS.length} accounts at Chase Bank.
        </p>
      </div>



      <div className="space-y-3">
        {SAMPLE_DISCOVERED_ACCOUNTS.map((account) => {
          const mapping = accountMappings[account.id];
          const action = mapping?.action || 'create';
          
          return (
            <Card key={account.id} className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {account.logo ? (
                    <img 
                      src={account.logo} 
                      alt={account.institution} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full items-center justify-center ${account.logo ? 'hidden' : 'flex'}`}>
                    {getAccountIcon(account.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        value={accountNames[account.id] || account.name}
                        onChange={(e) => setAccountNames(prev => ({ ...prev, [account.id]: e.target.value }))}
                        className="h-6 text-xs font-medium border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-slate-300 focus:bg-white px-1 -ml-1"
                      />
                    </div>
                    <p className={`font-semibold text-xs flex-shrink-0 ${account.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                      ${Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 ml-0.5">••••{account.mask} · {account.type}</p>
                </div>
              </div>

              <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <ClickThroughSelect
                        value={action}
                        onValueChange={(val) => handleAccountMapping(account.id, val)}
                        triggerClassName="h-7 text-xs flex-1"
                      >
                        <ClickThroughSelectItem value="create">
                          <span className="text-green-600">+ Create new account</span>
                        </ClickThroughSelectItem>
                        <ClickThroughSelectItem value="link">
                          <span className="text-blue-600">Link existing account</span>
                        </ClickThroughSelectItem>
                        <ClickThroughSelectItem value="skip">
                          <span className="text-slate-400">Skip</span>
                        </ClickThroughSelectItem>
                      </ClickThroughSelect>

                      {action !== 'skip' && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Input
                            type="date"
                            value={goLiveDates[account.id] || ''}
                            onChange={(e) => handleGoLiveDateChange(account.id, e.target.value)}
                            max={format(new Date(), 'yyyy-MM-dd')}
                            className="h-7 text-xs w-32"
                            title="Go-Live Date"
                          />
                          <div className="relative group">
                            <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-1 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                              Transactions before this date will be automatically posted. Transactions after will go to your pending list for review.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {action === 'link' && (
                      <ClickThroughSelect
                        value={mapping?.existingAccountId || ''}
                        onValueChange={(val) => handleAccountMapping(account.id, 'link', val)}
                        placeholder="Select account"
                        className="w-40"
                        triggerClassName="h-7 text-xs"
                      >
                        {existingAccounts
                          .filter(acc => acc.account_type === account.type || 
                            (account.type === 'credit_card' && acc.account_type === 'credit_card') ||
                            (['checking', 'savings'].includes(account.type) && ['checking', 'savings'].includes(acc.account_type))
                          )
                          .map(acc => (
                            <ClickThroughSelectItem key={acc.id} value={acc.id}>
                              {acc.account_name}
                            </ClickThroughSelectItem>
                          ))
                        }
                        {existingAccounts.filter(acc => 
                          acc.account_type === account.type || 
                          (account.type === 'credit_card' && acc.account_type === 'credit_card') ||
                          (['checking', 'savings'].includes(account.type) && ['checking', 'savings'].includes(acc.account_type))
                        ).length === 0 && (
                          <div className="px-2 py-2 text-xs text-slate-400 text-center">
                            No compatible accounts
                          </div>
                        )}
                      </ClickThroughSelect>
                    )}

                    {action === 'create' && (
                      <div className="flex items-center gap-2">
                        <ClickThroughSelect
                          value={accountTypes[account.id]?.accountType || account.accountType}
                          onValueChange={(val) => {
                            setAccountTypes(prev => ({
                              ...prev,
                              [account.id]: { 
                                accountType: val, 
                                detailType: DETAIL_TYPE_OPTIONS[val]?.[0]?.value || '' 
                              }
                            }));
                          }}
                          className="w-32"
                          triggerClassName="h-7 text-xs"
                        >
                          {ACCOUNT_TYPE_OPTIONS.map(opt => (
                            <ClickThroughSelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </ClickThroughSelectItem>
                          ))}
                        </ClickThroughSelect>
                        <ClickThroughSelect
                          value={accountTypes[account.id]?.detailType || account.detailType}
                          onValueChange={(val) => {
                            setAccountTypes(prev => ({
                              ...prev,
                              [account.id]: { 
                                ...prev[account.id],
                                detailType: val 
                              }
                            }));
                          }}
                          className="w-32"
                          triggerClassName="h-7 text-xs"
                        >
                          {(DETAIL_TYPE_OPTIONS[accountTypes[account.id]?.accountType || account.accountType] || []).map(opt => (
                            <ClickThroughSelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </ClickThroughSelectItem>
                          ))}
                        </ClickThroughSelect>
                      </div>
                    )}
                    </div>
            </Card>
          );
        })}
      </div>

      <SheetFooter className="pt-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button 
          onClick={() => setStep(2)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Continue
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </SheetFooter>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4 py-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Historical Transaction Import</h3>
        <p className="text-sm text-blue-700 mb-3">
          Choose how much transaction history to import.
        </p>
        <ClickThroughSelect
          value={dataRange}
          onValueChange={setDataRange}
          triggerClassName="bg-white"
        >
          {DATA_RANGE_OPTIONS.map(option => (
            <ClickThroughSelectItem key={option.value} value={option.value}>
              {option.label}
            </ClickThroughSelectItem>
          ))}
        </ClickThroughSelect>
        <p className="text-sm text-blue-700 mt-3">
          Found <span className="font-semibold">{sampleTransactions.length} transactions</span> for {getDataRangeLabel().toLowerCase()}.
        </p>
      </div>

      <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
        <Checkbox
          id="autoCategorizeBefore"
          checked={autoCategorizeBefore}
          onCheckedChange={setAutoCategorizeBefore}
          className="mt-0.5"
        />
        <div>
          <Label htmlFor="autoCategorizeBefore" className="text-sm font-medium cursor-pointer flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Auto-categorize historical transactions with AI
          </Label>
          <p className="text-xs text-slate-500 mt-1">
            Transactions before the go-live date will be automatically categorized and marked as "posted."
          </p>
        </div>
      </div>

      <div className="bg-slate-100 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Historical (auto-posted):</span>
          <span className="font-medium text-slate-900">{transactionCounts.historical} transactions</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Pending (for review):</span>
          <span className="font-medium text-orange-600">{transactionCounts.pending} transactions</span>
        </div>
      </div>

      <SheetFooter className="pt-4">
        <Button type="button" variant="outline" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button 
          onClick={processImport}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Import Transactions
        </Button>
      </SheetFooter>
    </div>
  );

  const renderStep3 = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      {isProcessing ? (
        <>
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-600">{processingStatus}</p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-lg font-medium text-slate-900">Import Complete!</p>
          <p className="text-sm text-slate-500">Your accounts and transactions have been imported.</p>
        </>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {step === 1 && 'Review Discovered Accounts'}
            {step === 2 && 'Import Options'}
            {step === 3 && 'Processing Import'}
          </SheetTitle>
        </SheetHeader>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </SheetContent>
    </Sheet>
  );
}