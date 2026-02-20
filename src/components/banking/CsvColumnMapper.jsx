import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Sparkles, RotateCcw } from 'lucide-react';
import { parseDate, mapCsvToTransactions } from './StatementProcessor';
import { getCsvMappingConfig, saveCsvMappingConfig } from '@/api/csvMappingConfigs';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

  let detectedAmountType = 'auto';
  if (debitColumn && creditColumn) {
    detectedAmountType = 'separate_columns';
  }

  return {
    mappings: detectedMappings,
    amountType: detectedAmountType,
    debitColumn: debitColumn || '',
    creditColumn: creditColumn || ''
  };
};

const CsvColumnMapper = forwardRef(function CsvColumnMapper({ csvData, onMap, onCancel, isImporting = false, isFirstImport = false, suggestedBeginningBalance = 0, isBalanceExtraction = false, profileId = null, institutionName = null, onValidationChange, hideFooter = false, accountClass = 'asset' }, ref) {
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
        setAutoDetectedFields(detectedFieldsList);
        setHasAutoDetected(true);
      }
    };

    loadSavedMapping();
  }, [headers, hasAutoDetected, profileId, institutionName]);

  useEffect(() => {
    if (!isFirstImport || !csvData.rows?.length) return;

    const calculateBeginningBalance = () => {
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

      // Use ending balance if provided, otherwise fall back to suggested beginning balance
      const baseBalance = endingBalance ? parseFloat(endingBalance) : (suggestedBeginningBalance || 0);
      const calculatedBeginning = baseBalance - netChange;
      return calculatedBeginning.toFixed(2);
    };

    if (columnMappings.amount || (debitColumn && creditColumn)) {
      setBeginningBalance(calculateBeginningBalance());
    }
  }, [isFirstImport, suggestedBeginningBalance, endingBalance, csvData, columnMappings.amount, amountType, debitColumn, creditColumn]);


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
        creditColumn
      });
    }

    const mappingConfig = {
      columnMappings,
      dateFormat,
      amountType,
      debitColumn,
      creditColumn,
      beginningBalance: beginningBalance ? parseFloat(beginningBalance) : null,
      endingBalance: endingBalance ? parseFloat(endingBalance) : null,
      csvData
    };

    onMap(mappingConfig);
  };

  const isValid = columnMappings.date && columnMappings.description &&
    (columnMappings.amount || (debitColumn && creditColumn));

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange({
        isValid,
        transactionCount: csvData.rows?.length || 0,
        isBalanceExtraction
      });
    }
  }, [isValid, csvData.rows?.length, isBalanceExtraction, onValidationChange]);

  useImperativeHandle(ref, () => ({
    handleMap
  }));

  const formatAmountValue = (value) => {
    if (!value || value === '-') return '-';
    const cleaned = value.toString().replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return value;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Generate preview transactions using the same logic as actual import
  const previewTransactions = React.useMemo(() => {
    if (!columnMappings.date || !columnMappings.description) return [];
    if (!columnMappings.amount && (!debitColumn || !creditColumn)) return [];

    try {
      const previewData = { ...csvData, rows: sampleRows };
      const transactions = mapCsvToTransactions(
        previewData,
        columnMappings,
        amountType,
        debitColumn,
        creditColumn,
        accountClass
      );
      return transactions;
    } catch (error) {
      console.error('Error generating preview:', error);
      return [];
    }
  }, [csvData, sampleRows, columnMappings, amountType, debitColumn, creditColumn, accountClass]);

  const requiredFieldsMapped = columnMappings.date && columnMappings.description;
  const optionalFieldsMapped = autoDetectedFields.filter(f => f === 'type' || f === 'category').length;

  return (
    <div className="space-y-4">
      {autoDetectedFields.length > 0 && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-emerald-900 font-medium break-words">
                  {savedMappingLoaded ? 'Loaded saved mapping' : `Auto-detected ${autoDetectedFields.length} field${autoDetectedFields.length !== 1 ? 's' : ''}`} • {csvData.rows?.length || 0} transaction{csvData.rows?.length !== 1 ? 's' : ''} found
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5 leading-tight break-words">
                  {savedMappingLoaded ? `Using previous config for ${institutionName || 'this bank'}. ` : ''}
                  {requiredFieldsMapped ? 'Required fields mapped. ' : 'Some fields need attention. '}
                  You can change any mapping if needed.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetToAutoDetect}
              className="h-6 text-[11px] px-2 flex-shrink-0 hover:bg-emerald-100 whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Re-detect
            </Button>
          </div>
        </div>
      )}

      {/* Column Mappings */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Date */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Label className="text-[11px] font-medium text-slate-700">Date Column *</Label>
              {autoDetectedFields.includes('date') && (
                <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-normal bg-blue-50 text-blue-600 border-blue-200">
                  <Sparkles className="w-2 h-2 mr-0.5" />
                  Auto
                </Badge>
              )}
            </div>
            <ClickThroughSelect
              value={columnMappings.date}
              onValueChange={(val) => setColumnMappings(prev => ({ ...prev, date: val }))}
              placeholder="Select date column"
              triggerClassName="h-8 text-xs bg-white"
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
            <div className="flex items-center gap-1 mb-1">
              <Label className="text-[11px] font-medium text-slate-700">Description Column *</Label>
              {autoDetectedFields.includes('description') && (
                <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-normal bg-blue-50 text-blue-600 border-blue-200">
                  <Sparkles className="w-2 h-2 mr-0.5" />
                  Auto
                </Badge>
              )}
            </div>
            <ClickThroughSelect
              value={columnMappings.description}
              onValueChange={(val) => setColumnMappings(prev => ({ ...prev, description: val }))}
              placeholder="Select description column"
              triggerClassName="h-8 text-xs bg-white"
            >
              {headers.map((header, idx) => (
                <ClickThroughSelectItem key={idx} value={header}>
                  {header}
                </ClickThroughSelectItem>
              ))}
            </ClickThroughSelect>
          </div>
        </div>

        {/* Amount Type */}
        <div>
          <Label className="text-[11px] font-medium text-slate-700 mb-1 block">Amount Structure *</Label>
          <ClickThroughSelect
            value={amountType}
            onValueChange={setAmountType}
            triggerClassName="h-8 text-xs bg-white"
          >
            <ClickThroughSelectItem value="auto">Single Column (auto-detect)</ClickThroughSelectItem>
            <ClickThroughSelectItem value="separate_columns">Separate Debit/Credit</ClickThroughSelectItem>
            <ClickThroughSelectItem value="always_expense">Single Column (all expenses)</ClickThroughSelectItem>
            <ClickThroughSelectItem value="always_income">Single Column (all income)</ClickThroughSelectItem>
          </ClickThroughSelect>
        </div>

        {/* Amount Column(s) */}
        {amountType === 'separate_columns' ? (
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label className="text-[11px] font-medium text-slate-700">Spent Column *</Label>
                {debitColumn && amountType === 'separate_columns' && (
                  <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-normal bg-blue-50 text-blue-600 border-blue-200">
                    <Sparkles className="w-2 h-2 mr-0.5" />
                    Auto
                  </Badge>
                )}
              </div>
              <ClickThroughSelect
                value={debitColumn}
                onValueChange={setDebitColumn}
                placeholder="Select spent column"
                triggerClassName="h-8 text-xs bg-white"
              >
                {headers.map((header, idx) => (
                  <ClickThroughSelectItem key={idx} value={header}>
                    {header}
                  </ClickThroughSelectItem>
                ))}
              </ClickThroughSelect>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label className="text-[11px] font-medium text-slate-700">Received Column *</Label>
                {creditColumn && amountType === 'separate_columns' && (
                  <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-normal bg-blue-50 text-blue-600 border-blue-200">
                    <Sparkles className="w-2 h-2 mr-0.5" />
                    Auto
                  </Badge>
                )}
              </div>
              <ClickThroughSelect
                value={creditColumn}
                onValueChange={setCreditColumn}
                placeholder="Select received column"
                triggerClassName="h-8 text-xs bg-white"
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
            <div className="flex items-center gap-1 mb-1">
              <Label className="text-[11px] font-medium text-slate-700">Amount Column *</Label>
              {autoDetectedFields.includes('amount') && (
                <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-normal bg-blue-50 text-blue-600 border-blue-200">
                  <Sparkles className="w-2 h-2 mr-0.5" />
                  Auto
                </Badge>
              )}
            </div>
            <ClickThroughSelect
              value={columnMappings.amount}
              onValueChange={(val) => setColumnMappings(prev => ({ ...prev, amount: val }))}
              placeholder="Select amount column"
              triggerClassName="h-8 text-xs bg-white"
            >
              {headers.map((header, idx) => (
                <ClickThroughSelectItem key={idx} value={header}>
                  {header}
                </ClickThroughSelectItem>
              ))}
            </ClickThroughSelect>
          </div>
        )}

      </div>

      {/* Preview - Transaction Table Format */}
      <div>
        <h3 className="text-[9px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Preview (First 3 Rows)</h3>
        <Card className="overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-100">
                <tr className="bg-slate-100 h-8">
                  <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left pl-2 pr-1 py-2 text-xs">
                    Date
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left px-4 pl-2 py-2 text-xs">
                    Description
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left pl-2 py-2 whitespace-nowrap text-xs">
                    Spent
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left pl-2 py-2 whitespace-nowrap text-xs">
                    Received
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left px-4 pl-2 py-2 text-xs">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-slate-500 text-xs">
                      Map required fields to see preview
                    </td>
                  </tr>
                ) : (
                  previewTransactions.map((transaction, idx) => (
                    <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} h-8`}>
                      <td className="text-sm border-r border-slate-200 py-1 pl-2 pr-1">
                        {transaction.date && !isNaN(new Date(transaction.date).getTime())
                          ? format(new Date(transaction.date), 'MM/dd/yy')
                          : 'Invalid'}
                      </td>
                      <td className="text-sm border-r border-slate-200 py-1 px-4 pl-2 max-w-[300px]">
                        <div className="text-xs px-1 overflow-hidden text-ellipsis whitespace-nowrap">{transaction.description || '—'}</div>
                      </td>
                      <td className="text-right text-sm border-r border-slate-200 py-1 pl-1 pr-2 whitespace-nowrap">
                        {(transaction.type === 'expense' || transaction.type === 'transfer' || transaction.type === 'credit_card_payment') && (
                          <span>
                            ${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="text-right text-sm border-r border-slate-200 py-1 pl-1 pr-2 whitespace-nowrap">
                        {transaction.type === 'income' && (
                          <span>
                            ${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="border-r border-slate-200 py-1 px-4 pl-2">
                        <span className="text-xs px-1 text-slate-500">
                          {transaction.category || 'Select category'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Beginning Balance - Only shown on first import and not in balance extraction mode */}
      {isFirstImport && !isBalanceExtraction && (
        <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-2.5">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="beginningBalance" className="text-[11px] font-medium text-slate-700">
                Beginning Balance (Optional)
              </Label>
              <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-normal bg-blue-100 text-blue-700 border-blue-200">
                <Sparkles className="w-2 h-2 mr-0.5" />
                Auto
              </Badge>
            </div>
            <Input
              id="beginningBalance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={beginningBalance}
              onChange={(e) => setBeginningBalance(e.target.value)}
              className="max-w-[200px] h-8 text-xs bg-white"
            />
            <p className="text-[10px] text-slate-600 leading-tight">
              Auto-calculated from transactions. Adjust if needed.
            </p>
          </div>
        </div>
      )}

      {/* Validation Warning */}
      {!isValid && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-900">Required fields missing</p>
            <p className="text-[10px] text-amber-700">Map: Date, Description, and Amount</p>
          </div>
        </div>
      )}

      {/* Actions - Only shown when hideFooter is false */}
      {!hideFooter && (
        <div className="flex justify-between items-center gap-3 pt-2.5 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={onCancel}
            size="sm"
            disabled={isImporting}
            className="h-8 text-xs"
          >
            Back
          </Button>
          <Button
            onClick={handleMap}
            disabled={!isValid || isImporting}
            className="bg-blue-600 hover:bg-blue-700 h-8 px-4 text-xs"
            size="sm"
          >
            {isBalanceExtraction
              ? (isImporting ? 'Processing...' : 'Done')
              : (isImporting ? 'Importing...' : `Import ${csvData.rows?.length || 0} Transactions`)
            }
          </Button>
        </div>
      )}
    </div>
  );
});

export default CsvColumnMapper;