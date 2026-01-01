import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Loader2, Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../pages/utils';
import CsvColumnMapper from './CsvColumnMapper';
import AccountCreationWizard from './AccountCreationWizard';
import { useAuth } from '@/contexts/AuthContext';
import { getUserChartOfAccounts } from '@/api/chartOfAccounts';

export default function FileImporter({ open, onOpenChange, onImportComplete }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [showAddAccountSheet, setShowAddAccountSheet] = useState(false);
  const queryClient = useQueryClient();

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['chart-accounts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const accounts = await getUserChartOfAccounts(user.id);
      return accounts.filter(a => a.level === 3);
    },
    enabled: !!user
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['activeAccounts'],
    queryFn: async () => {
      const allAccounts = await firstsavvy.entities.Account.filter({ is_active: true });
      return allAccounts.filter(acc =>
        (acc.class === 'asset' && ['checking_account', 'savings_account'].includes(acc.account_detail)) ||
        (acc.class === 'liability' && acc.account_type === 'credit_cards')
      );
    }
  });

  const createTransactionsMutation = useMutation({
    mutationFn: async (transactions) => {
      return await firstsavvy.entities.Transaction.bulkCreate(transactions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    }
  });

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

  const handleImport = async () => {
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop().toLowerCase();

      // For CSV, parse locally and show column mapper
      if (fileExt === 'csv') {
        setIsUploading(true);
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          throw new Error('CSV file is empty or has no data rows');
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });
          return row;
        });

        setCsvData({ headers, rows });
        setShowColumnMapper(true);
        setIsUploading(false);
        return;
      }

      // For OFX and PDF, upload and process
      setIsUploading(true);
      setError(null);

      const uploadResponse = await firstsavvy.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResponse.file_url;

      setIsUploading(false);
      setIsExtracting(true);

      let extractResponse;

      if (fileExt === 'ofx') {
        extractResponse = await firstsavvy.functions.parseOfx({ file_url: fileUrl });
      } else {
        extractResponse = await firstsavvy.integrations.Core.ExtractDataFromUploadedFile({
          file_url: fileUrl,
          json_schema: {
            type: "object",
            properties: {
              transactions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string", description: "Transaction date in YYYY-MM-DD format" },
                    description: { type: "string", description: "Transaction description or merchant name" },
                    amount: { type: "number", description: "Transaction amount (negative for expenses, positive for income)" },
                    category: { type: "string", description: "Transaction category" },
                    account_name: { type: "string", description: "Account name if available" }
                  },
                  required: ["date", "description", "amount"]
                }
              }
            }
          }
        });
      }

      setIsExtracting(false);

      if (extractResponse.status === 'success' && extractResponse.output?.transactions) {
        setExtractedData(extractResponse.output.transactions);
        setShowAccountSelector(true);
        toast.success(`Found ${extractResponse.output.transactions.length} transactions`);
      } else {
        const errorMsg = extractResponse.details || extractResponse.error || 'Failed to extract data';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err) {
      setIsUploading(false);
      setIsExtracting(false);
      const errorMsg = err.response?.data?.details || err.message || 'Failed to process file';
      setError(errorMsg);
      toast.error('Import failed: ' + errorMsg);
    }
  };

  const handleCsvMapping = (mappingConfig) => {
    const { columnMappings, amountType, debitColumn, creditColumn } = mappingConfig;

    const parseDate = (dateStr) => {
      if (!dateStr || typeof dateStr !== 'string') return null;

      // Strip any time component first
      let cleanDate = dateStr.trim().split(' ')[0].split('T')[0];
      if (!cleanDate) return null;

      // Try MM/DD/YYYY or M/D/YYYY
      const mdyMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (mdyMatch) {
        const [, month, day, year] = mdyMatch;
        const formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        // Validate the date is actually valid
        const testDate = new Date(formatted);
        if (!isNaN(testDate.getTime())) {
          return formatted;
        }
      }

      // Try YYYY-MM-DD
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanDate)) {
        const parts = cleanDate.split('-');
        const formatted = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        // Validate the date is actually valid
        const testDate = new Date(formatted);
        if (!isNaN(testDate.getTime())) {
          return formatted;
        }
      }

      // Try to parse with Date constructor as fallback
      try {
        const parsed = new Date(cleanDate);
        if (!isNaN(parsed.getTime())) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch (e) {}

      // Return null if parsing fails - don't import invalid dates
      return null;
    };
    
    const transactions = csvData.rows.map(row => {
      let amount = 0;
      let type = 'expense';

      if (amountType === 'separate_columns') {
        const debit = parseFloat(row[debitColumn]?.replace(/[^0-9.-]/g, '') || 0);
        const credit = parseFloat(row[creditColumn]?.replace(/[^0-9.-]/g, '') || 0);

        if (credit > 0) {
          amount = credit;
          type = 'income';
        } else if (debit > 0) {
          amount = debit;
          type = 'expense';
        }
      } else {
        const rawAmount = parseFloat(row[columnMappings.amount]?.replace(/[^0-9.-]/g, '') || 0);

        if (amountType === 'always_expense') {
          amount = Math.abs(rawAmount);
          type = 'expense';
        } else if (amountType === 'always_income') {
          amount = Math.abs(rawAmount);
          type = 'income';
        } else {
          amount = Math.abs(rawAmount);
          type = rawAmount < 0 ? 'expense' : 'income';
        }
      }

      return {
        date: parseDate(row[columnMappings.date]),
        description: row[columnMappings.description] || 'Unknown',
        amount,
        type,
        category: row[columnMappings.category] || null
      };
    }).filter(t => t.amount > 0 && t.date !== null);

    setExtractedData(transactions);
    setShowColumnMapper(false);
    setShowAccountSelector(true);
    toast.success(`Mapped ${transactions.length} transactions`);
  };

  const autoMatchTransfers = async (newTransactions) => {
    try {
      const allPendingTransactions = await firstsavvy.entities.Transaction.filter({ status: 'pending' });

      let matchedCount = 0;
      const processedIds = new Set();
      const updates = [];

      for (const txn of newTransactions) {
        if (processedIds.has(txn.id) || txn.transfer_pair_id) continue;

        for (const candidate of allPendingTransactions) {
          if (processedIds.has(candidate.id) || candidate.transfer_pair_id) continue;
          if (candidate.id === txn.id) continue;

          const amountMatch = Math.abs(Math.abs(txn.amount) - Math.abs(candidate.amount)) < 0.01;
          const oppositeSigns = (txn.amount > 0 && candidate.amount < 0) || (txn.amount < 0 && candidate.amount > 0);

          const txnDate = new Date(txn.date);
          const candidateDate = new Date(candidate.date);
          const daysDiff = Math.abs((txnDate - candidateDate) / (1000 * 60 * 60 * 24));
          const dateMatch = daysDiff <= 7;

          if (!amountMatch || !oppositeSigns || !dateMatch) continue;

          const normalizeDesc = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
          const txnDesc = normalizeDesc(txn.description);
          const candidateDesc = normalizeDesc(candidate.description);

          const commonWords = txnDesc.split(' ').filter(word =>
            word.length > 3 && candidateDesc.includes(word)
          ).length;

          let confidence = 50;
          confidence += Math.max(0, 30 - daysDiff * 4);
          confidence += commonWords * 10;

          if (confidence >= 80) {
            const pairId = crypto.randomUUID();

            const txnType = txn.amount > 0 ? 'transfer' : 'transfer';
            const candidateType = candidate.amount > 0 ? 'transfer' : 'transfer';

            updates.push(
              firstsavvy.entities.Transaction.update(txn.id, {
                transfer_pair_id: pairId,
                type: txnType,
                original_type: txn.original_type || txn.type,
                chart_account_id: null
              })
            );

            updates.push(
              firstsavvy.entities.Transaction.update(candidate.id, {
                transfer_pair_id: pairId,
                type: candidateType,
                original_type: candidate.original_type || candidate.type,
                chart_account_id: null
              })
            );

            processedIds.add(txn.id);
            processedIds.add(candidate.id);
            matchedCount++;
            break;
          }
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
      }

      return matchedCount;
    } catch (err) {
      console.error('Error auto-matching transfers:', err);
      return 0;
    }
  };

  const handleConfirmImport = async (accountId = selectedAccountId, shouldNavigate = true) => {
    if (!extractedData || !accountId) return;

    try {
      // Get the selected account's start_date
      const selectedAccount = accounts.find(acc => acc.id === accountId);
      const accountStartDate = selectedAccount?.start_date;

      // Map chart accounts by display name
      const chartAccountMap = {};
      chartAccounts.forEach(acc => {
        const displayName = acc.display_name || acc.account_detail || acc.account_name;
        chartAccountMap[displayName.toLowerCase()] = acc.id;
      });

      // Transform and create transactions
      const transactions = extractedData
        .filter(txn => {
          // Only include transactions with valid dates
          if (!txn.date || isNaN(new Date(txn.date).getTime())) return false;
          // Filter out transactions before account start date
          if (accountStartDate && txn.date < accountStartDate) return false;
          return true;
        })
        .map(txn => {
          const amount = Math.abs(txn.amount);
          const type = txn.amount < 0 ? 'expense' : 'income';

          // Try to match category
          let categoryId = null;
          if (txn.category) {
            const catLower = txn.category.toLowerCase();
            categoryId = categoryMap[catLower] || null;
          }

          return {
            date: txn.date,
            description: txn.description,
            original_description: txn.description,
            amount,
            type,
            bank_account_id: accountId,
            category_account_id: categoryId,
            status: 'pending',
            payment_method: 'card'
          };
        });

      const createdTransactions = await createTransactionsMutation.mutateAsync(transactions);

      const matchedCount = await autoMatchTransfers(createdTransactions);

      if (matchedCount > 0) {
        toast.success(`Successfully imported ${transactions.length} transactions (auto-matched ${matchedCount} transfers)`);
      } else {
        toast.success(`Successfully imported ${transactions.length} transactions`);
      }

      // Reset state
      setFile(null);
      setExtractedData(null);
      setError(null);
      setShowAccountSelector(false);
      setSelectedAccountId('');
      setShowAddAccountSheet(false);

      onImportComplete?.();
      onOpenChange(false);

      // Refresh accounts data
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });

      // Navigate to accounts tab
      if (shouldNavigate) {
        navigate(createPageUrl('Banking') + '?tab=accounts');
      }
    } catch (err) {
      toast.error('Failed to import transactions');
      setError(err.message);
    }
  };

  const reset = () => {
    setFile(null);
    setExtractedData(null);
    setError(null);
    setIsUploading(false);
    setIsExtracting(false);
    setCsvData(null);
    setShowColumnMapper(false);
    setShowAccountSelector(false);
    setSelectedAccountId('');
  };

  return (
    <Sheet open={open} onOpenChange={(newOpen) => {
      // Don't allow closing if the nested add account sheet is open
      if (!newOpen && showAddAccountSheet) {
        return;
      }
      onOpenChange(newOpen);
      if (!newOpen) reset();
    }} modal={false}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Import Transactions</SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-4">
          {showColumnMapper ? (
            <CsvColumnMapper 
              csvData={csvData}
              onMap={handleCsvMapping}
              onCancel={() => {
                setShowColumnMapper(false);
                setCsvData(null);
                setFile(null);
              }}
            />
          ) : showAccountSelector && extractedData ? (
            <>
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Found {extractedData.length} transactions
                  </p>
                  <p className="text-xs text-green-700">
                    Select an account to import to
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">Import transactions to:</p>

                  <div>
                    <Label>Select Account</Label>
                    <ClickThroughSelect
                      value={selectedAccountId}
                      onValueChange={(val) => {
                        if (val === '__add_new__') {
                          setShowAddAccountSheet(true);
                          setSelectedAccountId('');
                        } else {
                          setSelectedAccountId(val);
                        }
                      }}
                      placeholder="Choose an account..."
                      triggerClassName="hover:bg-slate-50"
                    >
                      <ClickThroughSelectItem value="__add_new__" className="text-blue-600 font-medium" isAction>
                        + Add New Account
                      </ClickThroughSelectItem>
                      {accounts.map(acc => (
                        <ClickThroughSelectItem key={acc.id} value={acc.id}>
                          {acc.account_name}
                        </ClickThroughSelectItem>
                      ))}
                    </ClickThroughSelect>
                  </div>
                </div>

                <div 
                  className="border rounded-lg divide-y max-h-48 overflow-y-auto"
                  onWheel={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <div className="p-2 bg-slate-50 text-xs font-medium text-slate-600">
                    Preview ({extractedData.length} transactions)
                  </div>
                  {extractedData.slice(0, 5).map((txn, idx) => {
                    const isValidDate = txn.date && !isNaN(new Date(txn.date).getTime());
                    const displayDate = isValidDate ? txn.date : 'Invalid date';
                    return (
                      <div key={idx} className="p-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-900 truncate">
                              {txn.description}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {displayDate}
                            </p>
                          </div>
                          <p className={`text-xs font-semibold ml-3 ${txn.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {txn.amount < 0 ? '-' : '+'}${Math.abs(txn.amount).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {extractedData.length > 5 && (
                    <div className="p-2 text-center text-[10px] text-slate-500">
                      And {extractedData.length - 5} more...
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : !extractedData ? (
            <>
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
                  {!isUploading && !isExtracting && (
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
                    <p className="text-sm text-red-800 whitespace-pre-wrap">{error}</p>
                  </div>
                </div>
              )}

              {(isUploading || isExtracting) && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <p className="text-sm text-blue-800">
                    {isUploading ? 'Uploading file...' : 'Extracting transaction data...'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Found {extractedData.length} transactions
                  </p>
                  <p className="text-xs text-green-700">
                    Ready to import to your account
                  </p>
                </div>
              </div>

              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {extractedData.slice(0, 10).map((txn, idx) => {
                  const isValidDate = txn.date && !isNaN(new Date(txn.date).getTime());
                  const displayDate = isValidDate ? txn.date : 'Invalid date';
                  return (
                    <div key={idx} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {txn.description}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {displayDate} {txn.category ? `• ${txn.category}` : ''}
                          </p>
                        </div>
                        <p className={`text-sm font-semibold ml-3 ${txn.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {txn.amount < 0 ? '-' : '+'}${Math.abs(txn.amount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {extractedData.length > 10 && (
                  <div className="p-3 text-center text-xs text-slate-500">
                    And {extractedData.length - 10} more...
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <SheetFooter>
          {showAccountSelector ? (
            <>
              <Button variant="outline" onClick={() => {
                setShowAccountSelector(false);
                setSelectedAccountId('');
              }}>
                Back
              </Button>
              <Button
                onClick={() => handleConfirmImport()}
                disabled={createTransactionsMutation.isPending || !selectedAccountId}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createTransactionsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import Transactions'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {!extractedData ? (
                <Button
                  onClick={handleImport}
                  disabled={!file || isUploading || isExtracting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isUploading || isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Extract Data'
                  )}
                </Button>
              ) : null}
            </>
          )}
        </SheetFooter>
      </SheetContent>

      <AccountCreationWizard
        open={showAddAccountSheet}
        onOpenChange={setShowAddAccountSheet}
        onAccountCreated={async (result) => {
          if (result?.id) {
            setShowAddAccountSheet(false);
            await queryClient.refetchQueries({ queryKey: ['accounts'] });
            setTimeout(() => {
              setSelectedAccountId(result.id);
              toast.success('Account created. Ready to import transactions.');
            }, 100);
          }
        }}
      />
          </Sheet>
          );
          }