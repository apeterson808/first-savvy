import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Sparkles, RotateCcw } from 'lucide-react';

const DETECTION_PATTERNS = {
  date: ['date', 'trans date', 'transaction date', 'posted date', 'post date', 'posting date', 'value date', 'entry date'],
  description: ['description', 'merchant', 'payee', 'memo', 'details', 'transaction', 'trans desc', 'narrative', 'particulars'],
  amount: ['amount', 'total', 'transaction amount', 'trans amount', 'value', 'sum', 'balance'],
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

export default function CsvColumnMapper({ csvData, onMap, onCancel, isImporting = false, isFirstImport = false }) {
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
  const [beginningBalance, setBeginningBalance] = useState('');

  const headers = csvData.headers || [];
  const sampleRows = csvData.rows?.slice(0, 3) || [];

  useEffect(() => {
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
  }, [headers, hasAutoDetected]);

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

  const handleMap = () => {
    onMap({
      columnMappings,
      dateFormat,
      amountType,
      debitColumn,
      creditColumn,
      beginningBalance: beginningBalance ? parseFloat(beginningBalance) : null
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
              <p className="text-sm text-green-900 font-medium">Auto-detected {autoDetectedFields.length} field{autoDetectedFields.length !== 1 ? 's' : ''}</p>
              <p className="text-xs text-green-700 mt-1">
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-900">
          Map your CSV columns to transaction fields. Preview shows first 3 rows.
        </p>
      </div>

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

      {/* Beginning Balance - Only shown on first import */}
      {isFirstImport && (
        <Card className="p-4">
          <div className="space-y-2">
            <Label htmlFor="beginningBalance" className="text-sm font-medium">
              Beginning Balance (Optional)
            </Label>
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
              <div className="text-xs text-slate-500 mt-1.5">
                Enter the account balance before these transactions.
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
          {isImporting ? 'Importing...' : `Import ${csvData.rows?.length || 0} Transactions`}
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