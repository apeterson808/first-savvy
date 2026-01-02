import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign
} from 'lucide-react';
import CsvColumnMapper from './CsvColumnMapper';
import {
  processStatementFile,
  mapCsvToTransactions,
  splitTransactionsByGoLiveDate,
  autoMatchTransfers
} from './StatementProcessor';

export default function StatementImportWizard({ open, onOpenChange, accountType, onAccountCreated }) {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState('upload-choice');
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [error, setError] = useState(null);

  const [csvData, setCsvData] = useState(null);
  const [showCsvMapper, setShowCsvMapper] = useState(false);
  const [extractedTransactions, setExtractedTransactions] = useState(null);

  const [accountName, setAccountName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [last4, setLast4] = useState('');
  const [goLiveDate, setGoLiveDate] = useState(() => {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    return firstOfMonth.toISOString().split('T')[0];
  });

  const { data: userChartAccounts = [] } = useQuery({
    queryKey: ['user-chart-accounts', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const { data, error } = await firstsavvy
        .from('user_chart_of_accounts')
        .select('*')
        .eq('profile_id', activeProfile.id)
        .order('account_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeProfile?.id && open
  });

  const detailMap = {
    'checking': 'checking_account',
    'savings': 'savings_account',
    'credit_card': 'personal_credit_card',
  };

  const getNextAccountNumber = async (templateAccountNumber) => {
    const { data: existingAccounts, error } = await firstsavvy
      .from('user_chart_of_accounts')
      .select('account_number')
      .eq('user_id', user.id)
      .eq('profile_id', activeProfile.id)
      .eq('template_account_number', templateAccountNumber)
      .order('account_number', { ascending: false })
      .limit(1);

    if (error || !existingAccounts || existingAccounts.length === 0) {
      return templateAccountNumber + 1;
    }

    return existingAccounts[0].account_number + 1;
  };

  const resetWizard = () => {
    setCurrentStep('upload-choice');
    setFile(null);
    setIsProcessing(false);
    setProcessingStage('');
    setError(null);
    setCsvData(null);
    setShowCsvMapper(false);
    setExtractedTransactions(null);
    setAccountName('');
    setInstitutionName('');
    setLast4('');
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    setGoLiveDate(firstOfMonth.toISOString().split('T')[0]);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (['csv', 'pdf', 'ofx'].includes(ext)) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please select a CSV, PDF, or OFX file');
        setFile(null);
      }
    }
  };

  const handleFileUpload = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      setError(null);

      const result = await processStatementFile(file, (stage) => {
        setProcessingStage(stage);
      });

      if (result.type === 'csv') {
        setCsvData(result);
        setShowCsvMapper(true);
        setIsProcessing(false);
      } else if (result.type === 'transactions') {
        setExtractedTransactions(result.transactions);
        setIsProcessing(false);
        setCurrentStep('configure');
      }
    } catch (err) {
      setIsProcessing(false);
      const errorMsg = err.message || 'Failed to process file';
      setError(errorMsg);
      toast.error('Import failed: ' + errorMsg);
    }
  };

  const handleCsvMapping = (mappingConfig) => {
    const { columnMappings, amountType, debitColumn, creditColumn } = mappingConfig;

    const transactions = mapCsvToTransactions(csvData, columnMappings, amountType, debitColumn, creditColumn);

    setExtractedTransactions(transactions);
    setShowCsvMapper(false);
    setCsvData(null);
    setCurrentStep('configure');
    toast.success(`Mapped ${transactions.length} transactions`);
  };

  const importTransactionsMutation = useMutation({
    mutationFn: async ({ accountId, transactions }) => {
      const chartAccountMap = {};
      userChartAccounts.forEach(acc => {
        const displayName = acc.display_name || acc.account_detail || acc.account_name;
        chartAccountMap[displayName.toLowerCase()] = acc.id;
      });

      const transactionsToCreate = transactions.map(txn => {
        let chartAccountId = null;
        if (txn.category) {
          const catLower = txn.category.toLowerCase();
          chartAccountId = chartAccountMap[catLower] || null;
        }

        return {
          user_id: user.id,
          profile_id: activeProfile.id,
          date: txn.date,
          description: txn.description,
          original_description: txn.original_description || txn.description,
          amount: txn.amount,
          type: txn.type,
          bank_account_id: accountId,
          chart_account_id: chartAccountId,
          status: txn.status,
          payment_method: 'card'
        };
      });

      const { data: createdTransactions, error } = await firstsavvy
        .from('transactions')
        .insert(transactionsToCreate)
        .select();

      if (error) throw error;

      const matchedCount = await autoMatchTransfers(createdTransactions);

      return { createdTransactions, matchedCount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['user-chart-accounts'] });
    }
  });

  const handleImport = async () => {
    if (!accountName.trim()) {
      toast.error('Please enter an account name');
      return;
    }

    if (!extractedTransactions || extractedTransactions.length === 0) {
      toast.error('No transactions to import');
      return;
    }

    try {
      const accountDetail = detailMap[accountType];
      const chartAccount = userChartAccounts.find(a => a.account_detail === accountDetail);

      if (!chartAccount) {
        throw new Error(`No chart account found for type: ${accountDetail}`);
      }

      const accountNumber = await getNextAccountNumber(chartAccount.template_account_number);

      const { data: newAccount, error: createError } = await firstsavvy
        .from('user_chart_of_accounts')
        .insert({
          user_id: user.id,
          profile_id: activeProfile.id,
          template_account_number: chartAccount.template_account_number,
          account_number: accountNumber,
          display_name: accountName,
          class: chartAccount.class,
          account_detail: chartAccount.account_detail,
          account_type: chartAccount.account_type,
          icon: chartAccount.icon,
          color: chartAccount.color,
          current_balance: 0,
          institution_name: institutionName,
          account_number_last4: last4,
          is_active: true,
          is_user_created: true
        })
        .select()
        .single();

      if (createError) throw createError;

      const { posted, pending } = splitTransactionsByGoLiveDate(extractedTransactions, goLiveDate);
      const allTransactions = [...posted, ...pending];

      const { matchedCount } = await importTransactionsMutation.mutateAsync({
        accountId: newAccount.id,
        transactions: allTransactions
      });

      const totalCount = allTransactions.length;
      const postedCount = posted.length;

      toast.success(
        `Account created with ${totalCount} transactions (${postedCount} posted, ${pending.length} pending)` +
        (matchedCount > 0 ? `. Auto-matched ${matchedCount} transfers.` : '')
      );

      onAccountCreated?.({ account: newAccount, transactionCount: totalCount });
      onOpenChange(false);
      resetWizard();

      setTimeout(() => {
        navigate(`/Banking/account/${newAccount.id}`);
      }, 100);
    } catch (err) {
      toast.error('Failed to import: ' + (err.message || 'Unknown error'));
      setError(err.message);
    }
  };

  const handleManualEntry = () => {
    onOpenChange(false);
  };

  const renderUploadChoice = () => (
    <div className="space-y-6 max-w-lg mx-auto py-8">
      <p className="text-center text-slate-600">
        How would you like to set up your {accountType} account?
      </p>

      <div className="grid gap-4">
        <Card
          className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
          onClick={() => setCurrentStep('upload')}
        >
          <CardContent className="p-6 flex items-start gap-4">
            <div className="rounded-full bg-blue-100 p-3">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Import from Statement</h3>
              <p className="text-sm text-slate-600">
                Upload a bank statement (CSV, PDF, or OFX) to automatically populate transactions
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-slate-400 hover:shadow-md transition-all"
          onClick={handleManualEntry}
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

  const renderUpload = () => {
    if (showCsvMapper && csvData) {
      return (
        <CsvColumnMapper
          csvData={csvData}
          onMap={handleCsvMapping}
          onCancel={() => {
            setShowCsvMapper(false);
            setCsvData(null);
            setFile(null);
          }}
        />
      );
    }

    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
          <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <Label htmlFor="file-upload" className="cursor-pointer">
            <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Choose a file
            </span>
            <span className="text-sm text-slate-500"> or drag and drop</span>
          </Label>
          <p className="text-xs text-slate-500 mt-2">CSV, PDF, or OFX up to 10MB</p>
          <Input
            id="file-upload"
            type="file"
            accept=".csv,.pdf,.ofx"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {file && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <FileText className="w-5 h-5 text-slate-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            {!isProcessing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFile(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                Remove
              </Button>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 mb-1">Import Error</p>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <p className="text-sm text-blue-800">
              {processingStage === 'uploading' && 'Uploading file...'}
              {processingStage === 'extracting' && 'Extracting transaction data...'}
              {processingStage === 'parsing' && 'Parsing CSV file...'}
              {!processingStage && 'Processing...'}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderConfigure = () => {
    if (!extractedTransactions) return null;

    const { posted, pending } = splitTransactionsByGoLiveDate(extractedTransactions, goLiveDate);

    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-900">
              Found {extractedTransactions.length} transactions
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="account-name">Account Name*</Label>
            <Input
              id="account-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g., Chase Freedom, Main Checking"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="institution">Institution Name</Label>
              <Input
                id="institution"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="e.g., Chase"
              />
            </div>
            <div>
              <Label htmlFor="last4">Last 4 Digits</Label>
              <Input
                id="last4"
                value={last4}
                onChange={(e) => setLast4(e.target.value)}
                placeholder="1234"
                maxLength={4}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="go-live-date" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Go-Live Date
            </Label>
            <Input
              id="go-live-date"
              type="date"
              value={goLiveDate}
              onChange={(e) => setGoLiveDate(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">
              Transactions before this date will be marked as posted (historical).
              Transactions on or after will be marked as pending (current).
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Posted (Historical):</span>
              <span className="font-semibold">{posted.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Pending (Current):</span>
              <span className="font-semibold">{pending.length}</span>
            </div>
            <div className="h-px bg-slate-200 my-2" />
            <div className="flex justify-between text-sm font-semibold">
              <span>Total Transactions:</span>
              <span>{extractedTransactions.length}</span>
            </div>
          </div>

          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
            <div className="p-2 bg-slate-50 text-xs font-medium text-slate-600 sticky top-0">
              Preview (first 5 transactions)
            </div>
            {extractedTransactions.slice(0, 5).map((txn, idx) => (
              <div key={idx} className="p-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">
                      {txn.description}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {txn.date} {txn.date < goLiveDate ? '(Posted)' : '(Pending)'}
                    </p>
                  </div>
                  <p className={`text-xs font-semibold ml-3 ${txn.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                    {txn.type === 'expense' ? '-' : '+'}${txn.amount.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
            {extractedTransactions.length > 5 && (
              <div className="p-2 text-center text-[10px] text-slate-500">
                And {extractedTransactions.length - 5} more...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getProgressPercentage = () => {
    if (currentStep === 'upload-choice') return 33;
    if (currentStep === 'upload') return 66;
    if (currentStep === 'configure') return 100;
    return 0;
  };

  const canProceed = () => {
    if (currentStep === 'upload') return !!file && !isProcessing;
    if (currentStep === 'configure') return !!accountName.trim();
    return true;
  };

  const handleNext = () => {
    if (currentStep === 'upload') {
      handleFileUpload();
    } else if (currentStep === 'configure') {
      handleImport();
    }
  };

  const handleBack = () => {
    if (currentStep === 'upload') {
      setCurrentStep('upload-choice');
      setFile(null);
      setError(null);
    } else if (currentStep === 'configure') {
      setCurrentStep('upload');
      setExtractedTransactions(null);
    }
  };

  const getStepTitle = () => {
    if (currentStep === 'upload-choice') return 'Choose Setup Method';
    if (currentStep === 'upload') return 'Upload Statement';
    if (currentStep === 'configure') return 'Configure Import';
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetWizard();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <div className="mb-8">
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>

          <div className="min-h-[400px]">
            {currentStep === 'upload-choice' && renderUploadChoice()}
            {currentStep === 'upload' && renderUpload()}
            {currentStep === 'configure' && renderConfigure()}
          </div>

          <div className="flex justify-between mt-8 pt-4 border-t">
            {currentStep !== 'upload-choice' ? (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isProcessing || importTransactionsMutation.isPending}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}

            {currentStep !== 'upload-choice' && (
              <Button
                onClick={handleNext}
                disabled={!canProceed() || importTransactionsMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing || importTransactionsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {currentStep === 'upload' ? 'Processing...' : 'Importing...'}
                  </>
                ) : (
                  <>
                    {currentStep === 'upload' ? 'Extract Data' : 'Import Transactions'}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
