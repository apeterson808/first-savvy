import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function CsvColumnMapper({ csvData, onMap, onCancel }) {
  const [columnMappings, setColumnMappings] = useState({
    date: '',
    description: '',
    amount: '',
    type: '',
    category: ''
  });
  
  const [dateFormat, setDateFormat] = useState('auto');
  const [amountType, setAmountType] = useState('auto'); // auto, always_expense, always_income, separate_columns
  const [debitColumn, setDebitColumn] = useState('');
  const [creditColumn, setCreditColumn] = useState('');

  const headers = csvData.headers || [];
  const sampleRows = csvData.rows?.slice(0, 3) || [];

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
      creditColumn
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

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-900">
          Map your CSV columns to transaction fields. Preview shows first 3 rows.
        </p>
      </div>

      {/* Column Mappings */}
      <div className="space-y-3">
        {/* Date */}
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Date Column *</Label>
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
          <Label className="text-xs font-medium mb-1.5 block">Description Column *</Label>
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
              <Label className="text-xs font-medium mb-1.5 block">Debit/Expense Column *</Label>
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
              <Label className="text-xs font-medium mb-1.5 block">Credit/Income Column *</Label>
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
            <Label className="text-xs font-medium mb-1.5 block">Amount Column *</Label>
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

        {/* Optional: Category */}
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Category Column (Optional)</Label>
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

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} size="sm">
          Cancel
        </Button>
        <Button 
          onClick={handleMap} 
          disabled={!isValid}
          className="bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          Import {csvData.rows?.length || 0} Transactions
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