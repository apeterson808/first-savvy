import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { formatCurrency } from '@/components/utils/formatters';
import { getJournalEntryWithLines, updateJournalEntryWithLines } from '@/api/journalEntries';
import { FileText, Calendar, User, CheckCircle2, AlertCircle, Edit2, X, Save } from 'lucide-react';
import { getIconComponent } from '@/components/utils/iconMapper';
import { toast } from 'sonner';
import { useProfile } from '@/contexts/ProfileContext';

export default function JournalEntryDialog({ entryId, open, onClose }) {
  const { currentProfile } = useProfile();
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [editedLines, setEditedLines] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal-entry', entryId],
    queryFn: () => getJournalEntryWithLines(entryId),
    enabled: open && !!entryId
  });

  const updateMutation = useMutation({
    mutationFn: updateJournalEntryWithLines,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['account-journal-lines'] });
      toast.success('Journal entry updated successfully');
      setIsEditMode(false);
      setHasUnsavedChanges(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update journal entry');
    }
  });

  useEffect(() => {
    if (entry && !isEditMode) {
      setEditedDescription(entry.description || '');
      setEditedLines(entry.lines || []);
      setHasUnsavedChanges(false);
    }
  }, [entry, isEditMode]);

  if (!open) return null;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <div className="p-8 text-center">Loading journal entry...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!entry) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <div className="p-8 text-center text-muted-foreground">
            Journal entry not found
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const calculateTotals = (lines) => {
    const totalDebits = lines.reduce((sum, line) => sum + (parseFloat(line.debit_amount) || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + (parseFloat(line.credit_amount) || 0), 0);
    return { totalDebits, totalCredits };
  };

  const { totalDebits, totalCredits } = isEditMode
    ? calculateTotals(editedLines)
    : { totalDebits: entry.total_debits, totalCredits: entry.total_credits };

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
  const canEdit = entry.source === 'manual' || entry.source === 'opening_balance';

  const handleEditClick = () => {
    setEditedDescription(entry.description || '');
    setEditedLines(JSON.parse(JSON.stringify(entry.lines || [])));
    setIsEditMode(true);
    setHasUnsavedChanges(false);
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    setIsEditMode(false);
    setHasUnsavedChanges(false);
  };

  const handleSave = async () => {
    if (!isBalanced) {
      toast.error('Cannot save: journal entry must be balanced');
      return;
    }

    const lines = editedLines.map(line => ({
      id: line.id,
      debit_amount: parseFloat(line.debit_amount) || 0,
      credit_amount: parseFloat(line.credit_amount) || 0,
      description: line.description || null
    }));

    await updateMutation.mutateAsync({
      entryId: entry.id,
      profileId: currentProfile.id,
      description: editedDescription,
      lines
    });
  };

  const handleLineAmountChange = (lineIndex, field, value) => {
    const newLines = [...editedLines];
    const numValue = value === '' ? 0 : parseFloat(value) || 0;
    newLines[lineIndex] = {
      ...newLines[lineIndex],
      [field]: numValue
    };
    setEditedLines(newLines);
    setHasUnsavedChanges(true);
  };

  const handleLineDescriptionChange = (lineIndex, value) => {
    const newLines = [...editedLines];
    newLines[lineIndex] = {
      ...newLines[lineIndex],
      description: value
    };
    setEditedLines(newLines);
    setHasUnsavedChanges(true);
  };

  const handleDescriptionChange = (value) => {
    setEditedDescription(value);
    setHasUnsavedChanges(true);
  };

  const getEntryTypeLabel = (type) => {
    const labels = {
      opening_balance: 'Opening Balance',
      adjustment: 'Adjustment',
      transfer: 'Transfer',
      reclassification: 'Reclassification',
      closing: 'Closing Entry',
      depreciation: 'Depreciation',
      accrual: 'Accrual',
      reversal: 'Reversal'
    };
    return labels[type] || type;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'posted':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'void':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const displayLines = isEditMode ? editedLines : entry.lines;
  const displayDescription = isEditMode ? editedDescription : entry.description;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <div>
                <DialogTitle className="text-2xl">
                  Journal Entry {entry.entry_number}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">
                    {getEntryTypeLabel(entry.entry_type)}
                  </Badge>
                  <Badge variant="outline">
                    {entry.source}
                  </Badge>
                  {isEditMode && (
                    <Badge variant="secondary">Editing</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right text-sm text-muted-foreground mr-2">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(entry.entry_date), 'MMMM d, yyyy')}
                </div>
              </div>
              {!isEditMode && canEdit && (
                <Button
                  onClick={handleEditClick}
                  variant="outline"
                  size="sm"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium mb-1">Description</div>
            {isEditMode ? (
              <Textarea
                value={displayDescription}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                className="min-h-[60px]"
                placeholder="Enter journal entry description"
              />
            ) : (
              <div className="text-muted-foreground">{displayDescription}</div>
            )}
          </div>

          <Separator />

          <div>
            <div className="text-sm font-medium mb-3">Journal Entry Lines</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayLines && displayLines.map((line, index) => {
                  const Icon = line.account_icon ? getIconComponent(line.account_icon) : null;
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="text-muted-foreground">
                        {line.line_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-4 w-4" style={{ color: line.account_color }} />}
                          <div>
                            <div className="font-medium">
                              {line.account_number} - {line.account_name}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {isEditMode ? (
                          <Input
                            value={line.description || ''}
                            onChange={(e) => handleLineDescriptionChange(index, e.target.value)}
                            placeholder="Line description"
                            className="h-8 text-sm"
                          />
                        ) : (
                          <span className="text-muted-foreground">{line.description || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditMode ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={line.debit_amount || ''}
                            onChange={(e) => handleLineAmountChange(index, 'debit_amount', e.target.value)}
                            className="h-8 text-right font-mono"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="font-mono">
                            {line.debit_amount ? formatCurrency(line.debit_amount) : ''}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditMode ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={line.credit_amount || ''}
                            onChange={(e) => handleLineAmountChange(index, 'credit_amount', e.target.value)}
                            className="h-8 text-right font-mono"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="font-mono">
                            {line.credit_amount ? formatCurrency(line.credit_amount) : ''}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={3} className="text-right">
                    Totals
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(totalDebits)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(totalCredits)}
                  </TableCell>
                </TableRow>
                {isEditMode && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={3} className="text-right text-sm">
                      Difference
                    </TableCell>
                    <TableCell colSpan={2} className="text-right font-mono">
                      <span className={isBalanced ? 'text-green-600' : 'text-destructive'}>
                        {formatCurrency(Math.abs(totalDebits - totalCredits))}
                      </span>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {isEditMode ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-sm">Entry is balanced</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-destructive text-sm">
                      Out of balance by {formatCurrency(Math.abs(totalDebits - totalCredits))}
                    </span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCancelEdit}
                  variant="outline"
                  disabled={updateMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!isBalanced || updateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Entry is balanced</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-destructive">
                      Entry is out of balance by {formatCurrency(Math.abs(totalDebits - totalCredits))}
                    </span>
                  </>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Created {format(new Date(entry.created_at), 'MMM d, yyyy')}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
