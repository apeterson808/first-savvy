import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { formatCurrency } from '@/components/utils/formatters';
import { getJournalEntryWithLines } from '@/api/journalEntries';
import { FileText, Calendar, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { getIconComponent } from '@/components/utils/iconMapper';

export default function JournalEntryDialog({ entryId, open, onClose }) {
  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal-entry', entryId],
    queryFn: () => getJournalEntryWithLines(entryId),
    enabled: open && !!entryId
  });

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

  const isBalanced = Math.abs(entry.total_debits - entry.total_credits) < 0.01;

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
                  <Badge variant={getStatusColor(entry.status)}>
                    {entry.status.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">
                    {getEntryTypeLabel(entry.entry_type)}
                  </Badge>
                  <Badge variant="outline">
                    {entry.source}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(entry.entry_date), 'MMMM d, yyyy')}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium mb-1">Description</div>
            <div className="text-muted-foreground">{entry.description}</div>
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
                {entry.lines && entry.lines.map((line) => {
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
                      <TableCell className="text-sm text-muted-foreground">
                        {line.description || '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {line.debit_amount ? formatCurrency(line.debit_amount) : ''}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {line.credit_amount ? formatCurrency(line.credit_amount) : ''}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={3} className="text-right">
                    Totals
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(entry.total_debits)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(entry.total_credits)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

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
                    Entry is out of balance by {formatCurrency(Math.abs(entry.total_debits - entry.total_credits))}
                  </span>
                </>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Created {format(new Date(entry.created_at), 'MMM d, yyyy')}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
