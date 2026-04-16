import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ChartAccountDropdown from '../common/ChartAccountDropdown';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import * as transactionService from '@/api/transactionService';
import { format } from 'date-fns';
import CalculatorAmountInput from '../common/CalculatorAmountInput';

export function EditJournalEntryDialog({ open, onOpenChange, entryId, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([]);
  const [reason, setReason] = useState('');
  const [entryNumber, setEntryNumber] = useState('');
  const [entryDate, setEntryDate] = useState('');

  useEffect(() => {
    if (open && entryId) {
      loadJournalEntry();
    }
  }, [open, entryId]);

  const loadJournalEntry = async () => {
    setLoadingEntry(true);
    try {
      const { data, error } = await transactionService.getJournalEntry(entryId);

      if (error) {
        toast.error('Failed to load journal entry: ' + error.message);
        return;
      }

      setDescription(data.entry.description || '');
      setEntryNumber(data.entry.entry_number);
      setEntryDate(data.entry.entry_date);

      setLines(data.lines.map(line => ({
        id: line.id,
        account_id: line.account_id,
        account: line.account,
        debit_amount: line.debit_amount || '',
        credit_amount: line.credit_amount || '',
        description: line.description || ''
      })));
    } catch (error) {
      toast.error('Failed to load journal entry');
    } finally {
      setLoadingEntry(false);
    }
  };

  const addLine = () => {
    setLines([...lines, {
      id: null,
      account_id: null,
      account: null,
      debit_amount: '',
      credit_amount: '',
      description: ''
    }]);
  };

  const removeLine = (index) => {
    if (lines.length <= 2) {
      toast.error('Journal entry must have at least 2 lines');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index, field, value) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const calculateTotals = () => {
    let totalDebits = 0;
    let totalCredits = 0;

    lines.forEach(line => {
      totalDebits += parseFloat(line.debit_amount) || 0;
      totalCredits += parseFloat(line.credit_amount) || 0;
    });

    return { totalDebits, totalCredits };
  };

  const isBalanced = () => {
    const { totalDebits, totalCredits } = calculateTotals();
    return Math.abs(totalDebits - totalCredits) < 0.01;
  };

  const handleSave = async () => {
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }

    if (lines.length < 2) {
      toast.error('Journal entry must have at least 2 lines');
      return;
    }

    if (!isBalanced()) {
      toast.error('Debits must equal credits');
      return;
    }

    for (const line of lines) {
      if (!line.account_id) {
        toast.error('All lines must have an account selected');
        return;
      }
      if (!line.debit_amount && !line.credit_amount) {
        toast.error('All lines must have either a debit or credit amount');
        return;
      }
    }

    setLoading(true);
    try {
      const formattedLines = lines.map(line => ({
        account_id: line.account_id,
        debit_amount: line.debit_amount ? parseFloat(line.debit_amount) : null,
        credit_amount: line.credit_amount ? parseFloat(line.credit_amount) : null,
        description: line.description || description
      }));

      const { data, error } = await transactionService.editJournalEntry(
        entryId,
        description,
        formattedLines,
        reason || 'User edit'
      );

      if (error) {
        toast.error('Failed to save changes: ' + error.message);
        return;
      }

      toast.success('Journal entry updated successfully');
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const { totalDebits, totalCredits } = calculateTotals();
  const balanced = isBalanced();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Edit Journal Entry {entryNumber}</DialogTitle>
          <DialogDescription>
            Entry Date: {entryDate ? format(new Date(entryDate), 'MMM d, yyyy') : ''}
          </DialogDescription>
        </DialogHeader>

        {loadingEntry ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter journal entry description"
              />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-medium">Account</th>
                    <th className="px-3 py-2 text-right text-sm font-medium">Amount</th>
                    <th className="px-3 py-2 text-left text-sm font-medium">Description</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const isDebit = parseFloat(line.debit_amount) > 0;
                    const amount = isDebit ? line.debit_amount : line.credit_amount;

                    return (
                      <tr key={index} className="border-t">
                        <td className="px-3 py-2">
                          <ChartAccountDropdown
                            value={line.account_id}
                            onChange={(accountId, account) => {
                              updateLine(index, 'account_id', accountId);
                              updateLine(index, 'account', account);
                            }}
                            showChartOfAccountsNumber={false}
                            includeInactive={false}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              className="h-8 w-12 border rounded px-1 text-sm"
                              value={isDebit ? '+' : '-'}
                              onChange={(e) => {
                                const currentAmount = parseFloat(line.credit_amount || line.debit_amount || 0);
                                if (e.target.value === '+') {
                                  updateLine(index, 'debit_amount', currentAmount.toString());
                                  updateLine(index, 'credit_amount', '');
                                } else {
                                  updateLine(index, 'credit_amount', currentAmount.toString());
                                  updateLine(index, 'debit_amount', '');
                                }
                              }}
                            >
                              <option value="+">+</option>
                              <option value="-">−</option>
                            </select>
                            <CalculatorAmountInput
                              value={parseFloat(amount) || 0}
                              onChange={(value) => {
                                if (isDebit) {
                                  updateLine(index, 'debit_amount', value.toString());
                                  updateLine(index, 'credit_amount', '');
                                } else {
                                  updateLine(index, 'credit_amount', value.toString());
                                  updateLine(index, 'debit_amount', '');
                                }
                              }}
                              placeholder="0.00"
                              className="text-right w-32"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                            placeholder="Line description"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(index)}
                            disabled={lines.length <= 2}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t bg-muted/50">
                  <tr>
                    <td className="px-3 py-2 text-sm font-medium">Total</td>
                    <td className="px-3 py-2 text-right text-sm font-medium">
                      ${(totalDebits - totalCredits).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      {balanced ? (
                        <span className="text-sm text-green-600">Balanced</span>
                      ) : (
                        <span className="text-sm text-red-600">
                          Out of balance: ${Math.abs(totalDebits - totalCredits).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>

            <div>
              <Label htmlFor="reason">Reason for Edit (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you're editing this entry"
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || loadingEntry || !balanced}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
