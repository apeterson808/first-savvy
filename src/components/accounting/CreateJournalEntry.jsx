import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Plus, Trash2, Save, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/utils/formatters';
import { createJournalEntry, getNextJournalEntryNumber } from '@/api/journalEntries';
import { getUserChartOfAccounts } from '@/api/chartOfAccounts';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import ChartAccountDropdown from '@/components/common/ChartAccountDropdown';
import { cn } from '@/lib/utils';

export default function CreateJournalEntry({ onClose, onSuccess }) {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();

  const [entryDate, setEntryDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [entryType, setEntryType] = useState('adjustment');
  const [lines, setLines] = useState([
    { accountId: null, description: '', debitAmount: '', creditAmount: '', type: 'debit' },
    { accountId: null, description: '', debitAmount: '', creditAmount: '', type: 'credit' }
  ]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['chart-of-accounts', activeProfile?.id],
    queryFn: () => getUserChartOfAccounts(activeProfile.id),
    enabled: !!activeProfile
  });

  const createMutation = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: () => {
      toast.success('Journal entry created successfully');
      queryClient.invalidateQueries(['journal-entries']);
      queryClient.invalidateQueries(['account-journal-lines']);
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    },
    onError: (error) => {
      toast.error(`Failed to create journal entry: ${error.message}`);
    }
  });

  const addLine = () => {
    setLines([...lines, { accountId: null, description: '', debitAmount: '', creditAmount: '', type: 'debit' }]);
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
    newLines[index][field] = value;

    if (field === 'type') {
      newLines[index].debitAmount = '';
      newLines[index].creditAmount = '';
    }

    setLines(newLines);
  };

  const calculateTotals = () => {
    const totalDebits = lines.reduce((sum, line) => {
      const amount = parseFloat(line.debitAmount) || 0;
      return sum + amount;
    }, 0);

    const totalCredits = lines.reduce((sum, line) => {
      const amount = parseFloat(line.creditAmount) || 0;
      return sum + amount;
    }, 0);

    return { totalDebits, totalCredits, difference: totalDebits - totalCredits };
  };

  const isBalanced = () => {
    const { difference } = calculateTotals();
    return Math.abs(difference) < 0.01;
  };

  const canSave = () => {
    if (!description.trim()) return false;
    if (!entryDate) return false;
    if (lines.length < 2) return false;
    if (!isBalanced()) return false;

    for (const line of lines) {
      if (!line.accountId) return false;
      const hasAmount = (parseFloat(line.debitAmount) > 0) || (parseFloat(line.creditAmount) > 0);
      if (!hasAmount) return false;
    }

    return true;
  };

  const handleSave = async (status = 'posted') => {
    if (!canSave()) {
      toast.error('Please fill in all required fields and ensure entry is balanced');
      return;
    }

    const formattedLines = lines.map(line => ({
      account_id: line.accountId,
      description: line.description || null,
      debit_amount: parseFloat(line.debitAmount) || null,
      credit_amount: parseFloat(line.creditAmount) || null
    }));

    createMutation.mutate({
      profileId: activeProfile.id,
      userId: user.id,
      entryDate: format(entryDate, 'yyyy-MM-dd'),
      description: description,
      entryType: entryType,
      status: status,
      source: 'manual',
      lines: formattedLines
    });
  };

  const { totalDebits, totalCredits, difference } = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Create Journal Entry</h2>
          <p className="text-sm text-muted-foreground">Manual accounting entry</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Entry Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(entryDate, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={entryDate} onSelect={setEntryDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label>Entry Type</Label>
          <Select value={entryType} onValueChange={setEntryType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adjustment">Adjustment</SelectItem>
              <SelectItem value="reclassification">Reclassification</SelectItem>
              <SelectItem value="accrual">Accrual</SelectItem>
              <SelectItem value="reversal">Reversal</SelectItem>
              <SelectItem value="depreciation">Depreciation</SelectItem>
              <SelectItem value="closing">Closing Entry</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          placeholder="Describe what this journal entry is for..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Journal Entry Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32">Debit</TableHead>
                <TableHead className="w-32">Credit</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <ChartAccountDropdown
                      value={line.accountId}
                      onChange={(value) => updateLine(index, 'accountId', value)}
                      accounts={accounts}
                      placeholder="Select account"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Line description"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={line.debitAmount}
                      onChange={(e) => {
                        updateLine(index, 'debitAmount', e.target.value);
                        if (e.target.value) updateLine(index, 'creditAmount', '');
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={line.creditAmount}
                      onChange={(e) => {
                        updateLine(index, 'creditAmount', e.target.value);
                        if (e.target.value) updateLine(index, 'debitAmount', '');
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 2}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={3} className="text-right">Totals</TableCell>
                <TableCell className="text-right">{formatCurrency(totalDebits)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalCredits)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Button variant="outline" onClick={addLine} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Add Line
          </Button>
        </CardContent>
      </Card>

      <div className={cn(
        "flex items-center justify-between p-4 rounded-lg",
        isBalanced() ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"
      )}>
        <div className="flex items-center gap-2">
          {isBalanced() ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium">Entry is balanced</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="font-medium text-destructive">
                Out of balance by {formatCurrency(Math.abs(difference))}
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button
            onClick={() => handleSave('posted')}
            disabled={!canSave() || createMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {createMutation.isPending ? 'Saving...' : 'Save & Post'}
          </Button>
        </div>
      </div>
    </div>
  );
}
