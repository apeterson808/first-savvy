import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Sparkles, RotateCcw } from 'lucide-react';
import { parseDate } from './StatementProcessor';
import { getCsvMappingConfig, saveCsvMappingConfig } from '@/api/csvMappingConfigs';
import { toast } from 'sonner';

const DETECTION_PATTERNS = {
  date: ['date', 'trans date', 'transaction date', 'posted date', 'post date', 'posting date', 'value date', 'entry date'],
  description: ['description', 'merchant', 'payee', 'memo', 'details', 'transaction', 'trans desc', 'narrative', 'particulars'],
  amount: ['amount', 'total', 'transaction amount', 'trans amount', 'value', 'sum'],
  balance: ['balance', 'running balance', 'account balance', 'current balance'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'payment', 'expense', 'dr', 'out', 'spent', 'paid'],
  credit: ['credit', 'deposit', 'deposits', 'income', 'receipt', 'cr', 'in', 'received'],
  type: ['type', 'transaction type', 'trans type', 'txn type', 'category', 'classification'],
  category: ['category', 'class', 'classification', 'group', 'expense category']
};

const detectColumn = (headers, patterns) => {
  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    for (const pattern of patterns) {
      if (normalized === pattern || normalized.includes(pattern)) {
        return header;
      }
    }
  }
  return null;
};

const autoDetectMappings = (headers) => {
  const detectedMappings = {
    date: detectColumn(headers, DETECTION_PATTERNS.date),
    description: detectColumn(headers, DETECTION_PATTERNS.description),
    amount: detectColumn(headers, DETECTION_PATTERNS.amount),
    type: detectColumn(headers, DETECTION_PATTERNS.type),
    category: detectColumn(headers, DETECTION_PATTERNS.category)
  };

  const debitColumn = detectColumn(headers, DETECTION_PATTERNS.debit);
  const creditColumn = detectColumn(headers, DETECTION_PATTERNS.credit);
  const balanceColumn = detectColumn(headers, DETECTION_PATTERNS.balance);

  let detectedAmountType = 'auto';
  if (debitColumn && creditColumn) {
    detectedAmountType = 'separate_columns';
  }

  return {
    mappings: detectedMappings,
    amountType: detectedAmountType,
    debitColumn: debitColumn || '',
    creditColumn: creditColumn || '',
    balanceColumn: balanceColumn || ''
  };
};

export default function CsvColumnMapper({ csvData, onMap, onCancel, isImporting = false, isFirstImport = false, suggestedBeginningBalance = 0, isBalanceExtraction = false, profileId = null, institutionName = null }) {
  const [columnMappings, setColumnMappings] = useState({
    date: '',
    description: '',
    amount: '',
    type: '',
    category: ''
  });

  const [dateFormat, setDateFormat] = useState('auto');
  const [amountType, setAmountType] = useState('auto');
  const [debitColumn, setDebitColumn] = useState('');
  const [creditColumn, setCreditColumn] = useState('');
  const [balanceColumn, setBalanceColumn] = useState('');
  const [autoDetectedFields, setAutoDetectedFields] = useState([]);
  const [hasAutoDetected, setHasAutoDetected] = useState(false);
  const [beginningBalance, setBeginningBalance] = useState(suggestedBeginningBalance.toString());
  const [endingBalance, setEndingBalance] = useState('');
  const [savedMappingLoaded, setSavedMappingLoaded] = useState(false);

  const headers = csvData.headers || [];
  const sampleRows = csvData.rows?.slice(0, 3) || [];

  useEffect(() => {
    const loadSavedMapping = async () => {
      if (headers.length > 0 && !hasAutoDetected && profileId && institutionName) {
        const { data: savedConfig } = await getCsvMappingConfig(profileId, institutionName);

        if (savedConfig && savedConfig.column_mappings) {
          setColumnMappings(savedConfig.column_mappings);
          setDateFormat(savedConfig.date_format || 'auto');
          setAmountType(savedConfig.amount_type || 'auto');
          setDebitColumn(savedConfig.debit_column || '');
          setCreditColumn(savedConfig.credit_column || '');
          setBalanceColumn(savedConfig.balance_column || '');

          const detectedFieldsList = [];
          Object.entries(savedConfig.column_mappings).forEach(([field, value]) => {
            if (value) detectedFieldsList.push(field);
          });
          setAutoDetectedFields(detectedFieldsList);
          setSavedMappingLoaded(true);
          setHasAutoDetected(true);

          toast.success('Loaded saved mapping configuration');
          return;
        }
      }

      if (headers.length > 0 && !hasAutoDetected) {
        const detected = autoDetectMappings(headers);

        const detectedFieldsList = [];
        Object.entries(detected.mappings).forEach(([field, value]) => {
          if (value) detectedFieldsList.push(field);
        });

        setColumnMappings(detected.mappings);
        setAmountType(detected.amountType);
        setDebitColumn(detected.debitColumn);
        setCreditColumn(detected.creditColumn);
        setBalanceColumn(detected.balanceColumn);
        setAutoDetectedFields(detectedFieldsList);
        setHasAutoDetected(true);
      }
    };

    loadSavedMapping();
  }, [headers, hasAutoDetected, profileId, institutionName]);

  useEffect(() => {
    if (!isFirstImport || !csvData.rows?.length) return;

    const calculateBeginningBalance = () => {
      if (balanceColumn && columnMappings.date) {
        const rowsWithDates = csvData.rows.map(row => ({
          row,
          date: parseDate(row[columnMappings.date]),
          balance: parseFloat(row[balanceColumn]?.toString().replace(/[^0-9.-]/g, '') || 0)
        })).filter(item => item.date !== null);

        if (rowsWithDates.length === 0) return '0.00';

        rowsWithDates.sort((a, b) => new Date(a.date) - new Date(b.date));
        const oldestTransaction = rowsWithDates[0];

        let transactionAmount = 0;
        if (amountType === 'separate_columns' && debitColumn && creditColumn) {
          const debit = parseFloat(oldestTransaction.row[debitColumn]?.toString().replace(/[^0-9.-]/g, '') || 0);
          const credit = parseFloat(oldestTransaction.row[creditColumn]?.toString().replace(/[^0-9.-]/g, '') || 0);
          transactionAmount = credit - debit;
        } else if (columnMappings.amount) {
          const amountStr = oldestTransaction.row[columnMappings.amount]?.toString().replace(/[^0-9.-]/g, '') || '0';
          transactionAmount = parseFloat(amountStr);
        }

        const beginningBalance = oldestTransaction.balance - transactionAmount;
        return beginningBalance.toFixed(2);
      }

      let netChange = 0;

      if (amountType === 'separate_columns' && debitColumn && creditColumn) {
        csvData.rows.forEach(row => {
          const debit = parseFloat(row[debitColumn]?.toString().replace(/[^0-9.-]/g, '') || 0);
          const credit = parseFloat(row[creditColumn]?.toString().replace(/[^0-9.-]/g, '') || 0);
          netChange += credit - debit;
        });
      } else if (columnMappings.amount) {
        csvData.rows.forEach(row => {
          const amountStr = row[columnMappings.amount]?.toString().replace(/[^0-9.-]/g, '') || '0';
          const amount = parseFloat(amountStr);

          if (amountType === 'always_expense') {
            netChange -= Math.abs(amount);
          } else if (amountType === 'always_income') {
            netChange += Math.abs(amount);
          } else {
            netChange += amount;
          }
        });
      }

      const calculatedBeginning = (suggestedBeginningBalance || 0) - netChange;
      return calculatedBeginning.toFixed(2);
    };

    if (columnMappings.amount || (debitColumn && creditColumn)) {
      setBeginningBalance(calculateBeginningBalance());
    }
  }, [isFirstImport, suggestedBeginningBalance, csvData, columnMappings.amount, columnMappings.date, amountType, debitColumn, creditColumn, balanceColumn]);

  useEffect(() => {
    if (!csvData.rows?.length) return;

    const calculateEndingBalance = () => {
      if (balanceColumn && columnMappings.date) {
        const rowsWithDates = csvData.rows.map(row => ({
          row,
          date: parseDate(row[columnMappings.date]),
          balance: parseFloat(row[balanceColumn]?.toString().replace(/[^0-9.-]/g, '') || 0)
        })).filter(item => item.date !== null && !isNaN(item.balance));

        if (rowsWithDates.length === 0) return '';

        rowsWithDates.sort((a, b) => new Date(b.date) - new Date(a.date));
        const newestTransaction = rowsWithDates[0];

        if (newestTransaction.balance === 0) return '';

        return newestTransaction.balance.toFixed(2);
      }

      return '';
    };

    const calculatedEnding = calculateEndingBalance();
    if (calculatedEnding) {
      setEndingBalance(calculatedEnding);
    }
  }, [csvData, columnMappings.date, balanceColumn]);

  const handleResetToAutoDetect = () => {
    setHasAutoDetected(false);
  };

  const FIELD_LABELS = {
    date: 'Date',
    description: 'Description',
    amount: 'Amount',
    type: 'Transaction Type',
    category: 'Category'
  };

  const handleMap = async () => {
    if (profileId && institutionName) {
      await saveCsvMappingConfig(profileId, institutionName, {
        columnMappings,
        dateFormat,
        amountType,
        debitColumn,
        creditColumn,
        balanceColumn
      });
    }

    onMap({
      columnMappings,
      dateFormat,
      amountType,
      debitColumn,
      creditColumn,
      balanceColumn,
      beginningBalance: beginningBalance ? parseFloat(beginningBalance) : null,
      endingBalance: endingBalance ? parseFloat(endingBalance) : null,
      csvData
    });
  };

  const isValid = columnMappings.date && columnMappings.description &&
    (columnMappings.amount || (debitColumn && creditColumn));

  const formatAmountValue = (value) => {
    if (!value || value === '-') return '-';
    const cleaned = value.toString().replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return value;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const requiredFieldsMapped = columnMappings.date && columnMappings.description;
  const optionalFieldsMapped = autoDetectedFields.filter(f => f === 'type' || f === 'category').length;

  return (
    <div className="space-y-4">
      {autoDetectedFields.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-green-900 font-medium">
                {savedMappingLoaded ? 'Loaded saved mapping' : `Auto-detected ${autoDetectedFields.length} field${autoDetectedFields.length !== 1 ? 's' : ''}`} ({csvData.rows?.length || 0} transaction{csvData.rows?.length !== 1 ? 's' : ''} found)
              </p>
              <p className="text-xs text-green-700 mt-1">
                {savedMappingLoaded ? `Using your previous configuration for ${institutionName || 'this bank'}. ` : ''}
                {requiredFieldsMapped ? 'Required fields mapped successfully. ' : 'Some required fields need attention. '}
                {optionalFieldsMapped > 0 && `Found ${optionalFieldsMapped} optional field${optionalFieldsMapped !== 1 ? 's' : ''}. `}
                You can change any mapping if needed.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetToAutoDetect}
              className="h-7 text-xs flex-shrink-0"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Re-detect
            </Button>
          </div>
        </div>
      )}

      {/* Column Mappings */}
      <div className="space-y-3">
        {/* Date */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Label className="text-xs font-medium">Date Column *</Label>
            {autoDetectedFields.includes('date') && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                Auto-detected
              </Badge>
            )}
          </div>
          <ClickThroughSelect
            value={columnMappings.date}
            onValueChange={(val) => setColumnMappings(prev => ({ ...prev, date: val }))}
            placeholder="Select date column"
            triggerClassName="h-8 text-xs"
          >
            {headers.map((header, idx) => (
              <ClickThroughSelectItem key={idx} value={header}>
                {header}
              </ClickThroughSelectItem>
            ))}
          </ClickThroughSelect>
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Label className="text-xs font-medium">Description Column *</Label>
            {autoDetectedFields.includes('description') && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                Auto-detected
              </Badge>
            )}
          </div>
          <ClickThroughSelect
            value={columnMappings.description}
            onValueChange={(val) => setColumnMappings(prev => ({ ...prev, description: val }))}
            placeholder="Select description column"
            triggerClassName="h-8 text-xs"
          >
            {headers.map((header, idx) => (
              <ClickThroughSelectItem key={idx} value={header}>
                {header}
              </ClickThroughSelectItem>
            ))}
          </ClickThroughSelect>
        </div>

        {/* Amount Type */}
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Amount Structure *</Label>
          <ClickThroughSelect
            value={amountType}
            onValueChange={setAmountType}
            triggerClassName="h-8 text-xs"
          >
            <ClickThroughSelectItem value="auto">Single Amount Column (auto-detect type)</ClickThroughSelectItem>
            <ClickThroughSelectItem value="separate_columns">Separate Debit/Credit Columns</ClickThroughSelectItem>
            <ClickThroughSelectItem value="always_expense">Single Amount (all expenses)</ClickThroughSelectItem>
            <ClickThroughSelectItem value="always_income">Single Amount (all income)</ClickThroughSelectItem>
          </ClickThroughSelect>
        </div>

        {/* Amount Column(s) */}
        {amountType === 'separate_columns' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Label className="text-xs font-medium">Debit/Expense Column *</Label>
                {debitColumn && amountType === 'separate_columns' && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                    <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                    Auto-detected
                  </Badge>
                )}
              </div>
              <ClickThroughSelect
                value={debitColumn}
                onValueChange={setDebitColumn}
                placeholder="Select debit column"
                triggerClassName="h-8 text-xs"
              >
                {headers.map((header, idx) => (
                  <ClickThroughSelectItem key={idx} value={header}>
                    {header}
                  </ClickThroughSelectItem>
                ))}
              </ClickThroughSelect>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Label className="text-xs font-medium">Credit/Income Column *</Label>
                {creditColumn && amountType === 'separate_columns' && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                    <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                    Auto-detected
                  </Badge>
                )}
              </div>
              <ClickThroughSelect
                value={creditColumn}
                onValueChange={setCreditColumn}
                placeholder="Select credit column"
                triggerClassName="h-8 text-xs"
              >
                {headers.map((header, idx) => (
                  <ClickThroughSelectItem key={idx} value={header}>
                    {header}
                  </ClickThroughSelectItem>
                ))}
              </ClickThroughSelect>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Label className="text-xs font-medium">Amount Column *</Label>
              {autoDetectedFields.includes('amount') && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                  Auto-detected
                </Badge>
              )}
            </div>
            <ClickThroughSelect
              value={columnMappings.amount}
              onValueChange={(val) => setColumnMappings(prev => ({ ...prev, amount: val }))}
              placeholder="Select amount column"
              triggerClassName="h-8 text-xs"
            >
              {headers.map((header, idx) => (
                <ClickThroughSelectItem key={idx} value={header}>
                  {header}
                </ClickThroughSelectItem>
              ))}
            </ClickThroughSelect>
          </div>
        )}

        {/* Optional: Transaction Type */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Label className="text-xs font-medium">Transaction Type Column (Optional)</Label>
            {autoDetectedFields.includes('type') && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                Auto-detected
              </Badge>
            )}
          </div>
          <ClickThroughSelect
            value={columnMappings.type}
            onValueChange={(val) => setColumnMappings(prev => ({ ...prev, type: val }))}
            placeholder="Skip if not available"
            triggerClassName="h-8 text-xs"
          >
            <ClickThroughSelectItem value="">None</ClickThroughSelectItem>
            {headers.map((header, idx) => (
              <ClickThroughSelectItem key={idx} value={header}>
                {header}
              </ClickThroughSelectItem>
            ))}
          </ClickThroughSelect>
        </div>

        {/* Optional: Category */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Label className="text-xs font-medium">Category Column (Optional)</Label>
            {autoDetectedFields.includes('category') && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                Auto-detected
              </Badge>
            )}
          </div>
          <ClickThroughSelect
            value={columnMappings.category}
            onValueChange={(val) => setColumnMappings(prev => ({ ...prev, category: val }))}
            placeholder="Skip if not available"
            triggerClassName="h-8 text-xs"
          >
            <ClickThroughSelectItem value="">None</ClickThroughSelectItem>
            {headers.map((header, idx) => (
              <ClickThroughSelectItem key={idx} value={header}>
                {header}
              </ClickThroughSelectItem>
            ))}
          </ClickThroughSelect>
        </div>
      </div>

      {/* Preview */}
      <div>
        <Label className="text-xs font-medium mb-2 block">Preview</Label>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {Object.entries(columnMappings).map(([field, column]) => {
                    if (amountType === 'separate_columns' && field === 'amount') return null;
                    if (!column && field !== 'category' && field !== 'type') return null;
                    return (
                      <th key={field} className="px-3 py-2 text-left font-medium text-slate-600">
                        {FIELD_LABELS[field]}
                      </th>
                    );
                  })}
                  {amountType === 'separate_columns' && (
                    <>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Debit</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Credit</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {sampleRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {Object.entries(columnMappings).map(([field, column]) => {
                      if (amountType === 'separate_columns' && field === 'amount') return null;
                      if (!column && field !== 'category' && field !== 'type') return null;
                      const cellValue = row[column] || '-';
                      const displayValue = field === 'amount' ? formatAmountValue(cellValue) : cellValue;
                      return (
                        <td key={field} className="px-3 py-2 text-slate-900">
                          {displayValue}
                        </td>
                      );
                    })}
                    {amountType === 'separate_columns' && (
                      <>
                        <td className="px-3 py-2 text-slate-900">{formatAmountValue(row[debitColumn])}</td>
                        <td className="px-3 py-2 text-slate-900">{formatAmountValue(row[creditColumn])}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Beginning Balance - Only shown on first import and not in balance extraction mode */}
      {isFirstImport && !isBalanceExtraction && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="beginningBalance" className="text-sm font-medium">
                Beginning Balance (Optional)
              </Label>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                Auto-calculated
              </Badge>
            </div>
            <div className="flex items-start gap-2">
              <Input
                id="beginningBalance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={beginningBalance}
                onChange={(e) => setBeginningBalance(e.target.value)}
                className="max-w-xs"
              />
              <div className="text-xs text-slate-600 mt-1.5">
                Calculated from your CSV transactions and current account balance. You can adjust if needed.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Ending Balance - shown for all imports when balance column is detected */}
      {!isBalanceExtraction && endingBalance && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="endingBalance" className="text-sm font-medium">
                Ending Balance (Optional)
              </Label>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                Auto-detected
              </Badge>
            </div>
            <div className="flex items-start gap-2">
              <Input
                id="endingBalance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={endingBalance}
                onChange={(e) => setEndingBalance(e.target.value)}
                className="max-w-xs"
              />
              <div className="text-xs text-slate-600 mt-1.5">
                Detected from the last transaction in your CSV. This will update the bank balance for reconciliation.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} size="sm" disabled={isImporting}>
          Cancel
        </Button>
        <Button
          onClick={handleMap}
          disabled={!isValid || isImporting}
          className="bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          {isBalanceExtraction
            ? (isImporting ? 'Processing...' : 'Done')
            : (isImporting ? 'Importing...' : `Import ${csvData.rows?.length || 0} Transactions`)
          }
        </Button>
      </div>

      {!isValid && (
        <div className="flex items-center gap-2 text-xs text-amber-600">
          <AlertCircle className="w-3 h-3" />
          <span>Please map required fields: Date, Description, and Amount</span>
        </div>
      )}
    </div>
  );
}