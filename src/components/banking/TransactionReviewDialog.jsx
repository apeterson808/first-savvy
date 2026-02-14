import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, CheckCircle2, AlertCircle, Info, Sparkles, Brain, Calendar, Filter } from 'lucide-react';
import ChartAccountDropdown from '../common/ChartAccountDropdown';
import { formatCurrency } from '../utils/formatters';
import { supabase } from '../../api/supabaseClient';
import { format } from 'date-fns';
import { transferAutoDetectionAPI } from '@/api/transferAutoDetection';
import categorizationMemoryAPI from '@/api/categorizationMemory';
import { toast } from 'sonner';
import { Label } from '../ui/label';
import { calculateBeginningBalanceFromCurrent } from './StatementProcessor';

export function TransactionReviewDialog({
  open,
  onOpenChange,
  extractedData,
  profileId,
  onImportComplete
}) {
  const [transactions, setTransactions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [bulkAccountId, setBulkAccountId] = useState(null);
  const [filterStartDate, setFilterStartDate] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(false);

  useEffect(() => {
    if (extractedData?.transactions && profileId) {
      const processTxns = async () => {
        const txns = extractedData.transactions.map((txn, idx) => ({
          id: `temp-${idx}`,
          date: txn.date,
          description: txn.description,
          amount: txn.amount,
          type: txn.type || 'expense',
          chartAccountId: null,
          categoryAccountId: null,
          categoryFromMemory: false,
          confidence: txn.confidence || 50,
          isValid: true
        }));

        let processedTxns = txns;

        if (extractedData.suggestedAccountId) {
          setBulkAccountId(extractedData.suggestedAccountId);
        }

        try {
          const memoriesMap = {};
          for (const txn of txns) {
            const memoryTxn = {
              date: txn.date,
              original_description: txn.description,
              description: txn.description,
              amount: txn.amount,
              bank_account_id: extractedData.suggestedAccountId
            };

            const rememberedCategoryId = await categorizationMemoryAPI.lookupMemory(profileId, memoryTxn);
            if (rememberedCategoryId) {
              memoriesMap[txn.id] = rememberedCategoryId;
            }
          }

          const memorizedCount = Object.keys(memoriesMap).length;
          if (memorizedCount > 0) {
            processedTxns = txns.map(t => ({
              ...t,
              chartAccountId: extractedData.suggestedAccountId || null,
              categoryAccountId: memoriesMap[t.id] || null,
              categoryFromMemory: !!memoriesMap[t.id]
            }));

            toast.success(`Found ${memorizedCount} remembered categorization${memorizedCount !== 1 ? 's' : ''}`, {
              icon: <Brain className="w-4 h-4" />,
              description: 'Categories from previous imports'
            });
          } else if (extractedData.suggestedAccountId) {
            processedTxns = txns.map(t => ({
              ...t,
              chartAccountId: extractedData.suggestedAccountId,
              categoryAccountId: null
            }));
          }
        } catch (error) {
          console.error('Failed to lookup categorization memories:', error);
          if (extractedData.suggestedAccountId) {
            processedTxns = txns.map(t => ({
              ...t,
              chartAccountId: extractedData.suggestedAccountId,
              categoryAccountId: null
            }));
          }
        }

        setTransactions(processedTxns);
        setSelectedIds(new Set(processedTxns.map(t => t.id)));
      };

      processTxns();
    }
  }, [extractedData, profileId]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const updateTransaction = (id, field, value) => {
    setTransactions(prev => prev.map(txn => {
      if (txn.id === id) {
        const updated = { ...txn, [field]: value };

        if (field === 'date' || field === 'description' || field === 'amount') {
          updated.isValid = Boolean(
            updated.date &&
            updated.description?.trim() &&
            updated.amount &&
            !isNaN(parseFloat(updated.amount))
          );
        }

        return updated;
      }
      return txn;
    }));
  };

  const applyBulkAccount = () => {
    if (bulkAccountId) {
      setTransactions(prev => prev.map(txn =>
        selectedIds.has(txn.id)
          ? { ...txn, chartAccountId: bulkAccountId }
          : txn
      ));
    }
  };

  const handleImport = async () => {
    const selectedTransactions = transactions.filter(t => selectedIds.has(t.id));

    if (selectedTransactions.length === 0) {
      setError('Please select at least one transaction to import');
      return;
    }

    const invalidCount = selectedTransactions.filter(t => !t.isValid).length;
    if (invalidCount > 0) {
      setError(`${invalidCount} transaction(s) have invalid data. Please fix before importing.`);
      return;
    }

    setImporting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const transactionsToInsert = selectedTransactions.map(txn => ({
        user_id: user.id,
        profile_id: profileId,
        date: txn.date,
        description: txn.description,
        original_description: txn.description,
        amount: Math.abs(parseFloat(txn.amount)),
        type: txn.type,
        bank_account_id: txn.chartAccountId,
        category_account_id: txn.categoryAccountId || null,
        source: 'pdf',
        status: 'posted',
        include_in_reports: true
      }));

      const { data: insertedTransactions, error: insertError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)
        .select('id');

      if (insertError) throw insertError;

      if (insertedTransactions && insertedTransactions.length > 0) {
        const transactionIds = insertedTransactions.map(t => t.id);

        const { data: fullTransactions } = await supabase
          .from('transactions')
          .select('*')
          .in('id', transactionIds);

        let transfersCount = 0;

        try {
          await transferAutoDetectionAPI.detectTransfers(profileId, transactionIds);
          const { count } = await supabase
            .from('transactions')
            .select('id', { count: 'exact' })
            .in('id', transactionIds)
            .eq('type', 'transfer');
          transfersCount = count || 0;
        } catch (err) {
          console.warn('Transfer auto-detection failed:', err);
        }

        const successMessage = [
          `${insertedTransactions.length} transaction${insertedTransactions.length !== 1 ? 's' : ''} imported`,
          transfersCount > 0 && `${transfersCount} transfer${transfersCount !== 1 ? 's' : ''} detected`
        ].filter(Boolean).join(', ');

        toast.success(successMessage, {
          duration: 5000,
          icon: categorizedCount > 0 ? <Sparkles className="w-4 h-4" /> : undefined
        });
      }

      setImporting(false);
      onImportComplete?.();
      onOpenChange(false);

    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to import transactions');
      setImporting(false);
    }
  };

  const dateRange = useMemo(() => {
    if (transactions.length === 0) return null;

    const dates = transactions.map(t => new Date(t.date)).sort((a, b) => a - b);
    return {
      minDate: format(dates[0], 'yyyy-MM-dd'),
      maxDate: format(dates[dates.length - 1], 'yyyy-MM-dd')
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (!filterStartDate) return transactions;

    return transactions.filter(t => t.date >= filterStartDate);
  }, [transactions, filterStartDate]);

  const excludedTransactions = useMemo(() => {
    if (!filterStartDate) return [];

    return transactions.filter(t => t.date < filterStartDate);
  }, [transactions, filterStartDate]);

  const calculatedBeginningBalance = useMemo(() => {
    if (!filterStartDate || !extractedData?.endingBalance) return null;

    const allTransactions = transactions.map(t => ({
      date: t.date,
      amount: Math.abs(parseFloat(t.amount) || 0),
      type: t.type
    }));

    const isLiability = extractedData.accountType === 'liability';

    return calculateBeginningBalanceFromCurrent(
      extractedData.endingBalance,
      allTransactions,
      filterStartDate,
      isLiability
    );
  }, [filterStartDate, extractedData, transactions]);

  const selectedCount = selectedIds.size;
  const selectedTransactions = filteredTransactions.filter(t => selectedIds.has(t.id));
  const totalAmount = selectedTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);
  const incomeCount = selectedTransactions.filter(t => t.type === 'income').length;
  const expenseCount = selectedTransactions.filter(t => t.type === 'expense').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review & Import Transactions</DialogTitle>
          <DialogDescription>
            Review the extracted transactions below. Edit any details and select which ones to import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {extractedData && (
            <div className="flex items-center gap-4 px-4 py-3 bg-blue-50 rounded-lg text-sm">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <span className="font-medium">Statement from:</span> {extractedData.institutionName}
                {extractedData.extractionMethod === 'vision' && (
                  <Badge variant="secondary" className="ml-2">AI Enhanced</Badge>
                )}
              </div>
            </div>
          )}

          {dateRange && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium">Date Range Filter</span>
                  {!showDateFilter && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowDateFilter(true)}
                      className="h-7 px-2 text-xs"
                    >
                      <Filter className="w-3 h-3 mr-1" />
                      Filter Transactions
                    </Button>
                  )}
                </div>
                <div className="text-xs text-slate-600">
                  Statement period: {dateRange.minDate} to {dateRange.maxDate}
                </div>
              </div>

              {showDateFilter && (
                <div className="border-t pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Import transactions from:</Label>
                      <Input
                        type="date"
                        value={filterStartDate || dateRange.minDate}
                        onChange={(e) => setFilterStartDate(e.target.value || null)}
                        min={dateRange.minDate}
                        max={dateRange.maxDate}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Through:</Label>
                      <Input
                        type="date"
                        value={dateRange.maxDate}
                        disabled
                        className="text-sm bg-slate-50"
                      />
                    </div>
                  </div>

                  {filterStartDate && filterStartDate !== dateRange.minDate && (
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-xs">
                        <div className="space-y-1">
                          <p className="font-medium text-amber-900">
                            {excludedTransactions.length} transaction{excludedTransactions.length !== 1 ? 's' : ''} will be excluded (before {filterStartDate})
                          </p>
                          <p className="text-amber-700">
                            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} will be imported
                          </p>
                          {calculatedBeginningBalance !== null && extractedData?.endingBalance && (
                            <p className="text-amber-700 mt-2 pt-2 border-t border-amber-200">
                              <span className="font-medium">Adjusted beginning balance:</span> {formatCurrency(calculatedBeginningBalance)}
                              <br />
                              <span className="text-xs">(Calculated from statement ending balance of {formatCurrency(extractedData.endingBalance)})</span>
                            </p>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFilterStartDate(null);
                        setShowDateFilter(false);
                      }}
                      className="text-xs"
                    >
                      Clear Filter
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm font-medium">Select All ({filteredTransactions.length})</span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-600">Bulk assign account:</span>
              <ChartAccountDropdown
                value={bulkAccountId}
                onChange={setBulkAccountId}
                profileId={profileId}
                className="w-[250px]"
                filterClass="asset"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={applyBulkAccount}
                disabled={!bulkAccountId || selectedIds.size === 0}
              >
                Apply to Selected
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 border rounded-lg">
            <div className="min-w-[1000px]">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr className="text-left text-xs text-gray-600">
                    <th className="p-3 w-12"></th>
                    <th className="p-3 w-32">Date</th>
                    <th className="p-3 flex-1">Description</th>
                    <th className="p-3 w-32">Amount</th>
                    <th className="p-3 w-24">Type</th>
                    <th className="p-3 w-[250px]">Account</th>
                    <th className="p-3 w-20">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn, idx) => (
                    <tr
                      key={txn.id}
                      className={`border-t hover:bg-gray-50 ${!txn.isValid ? 'bg-red-50' : ''}`}
                    >
                      <td className="p-3">
                        <Checkbox
                          checked={selectedIds.has(txn.id)}
                          onCheckedChange={() => toggleSelect(txn.id)}
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="date"
                          value={txn.date}
                          onChange={(e) => updateTransaction(txn.id, 'date', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          value={txn.description}
                          onChange={(e) => updateTransaction(txn.id, 'description', e.target.value)}
                          className="h-8 text-sm"
                          placeholder="Description"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          step="0.01"
                          value={txn.amount}
                          onChange={(e) => updateTransaction(txn.id, 'amount', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={txn.type}
                          onChange={(e) => updateTransaction(txn.id, 'type', e.target.value)}
                          className="h-8 px-2 text-sm border rounded-md w-full"
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <ChartAccountDropdown
                          value={txn.chartAccountId}
                          onChange={(value) => updateTransaction(txn.id, 'chartAccountId', value)}
                          profileId={profileId}
                          className="h-8 text-sm"
                          filterClass="asset"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {txn.confidence && (
                            <Badge
                              variant={txn.confidence > 80 ? 'default' : txn.confidence > 60 ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {txn.confidence}%
                            </Badge>
                          )}
                          {txn.categoryFromMemory && (
                            <Badge variant="default" className="text-xs bg-purple-600">
                              <Brain className="w-3 h-3 mr-1" />
                              Remembered
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex gap-6">
              <div>
                <span className="text-gray-600">Selected:</span>
                <span className="font-semibold ml-1">{selectedCount}</span>
              </div>
              <div>
                <span className="text-gray-600">Total:</span>
                <span className="font-semibold ml-1">{formatCurrency(totalAmount)}</span>
              </div>
              <div>
                <span className="text-gray-600">Income:</span>
                <span className="font-semibold ml-1 text-green-600">{incomeCount}</span>
              </div>
              <div>
                <span className="text-gray-600">Expenses:</span>
                <span className="font-semibold ml-1 text-red-600">{expenseCount}</span>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || selectedCount === 0}
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${selectedCount} Transaction${selectedCount !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
