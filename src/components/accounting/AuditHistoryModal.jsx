import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, Clock, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/components/utils/formatters';
import { getJournalEntryAuditTrail } from '@/api/journalEntries';

export default function AuditHistoryModal({ open, onClose, transactionId }) {
  const { data: auditTrail = [], isLoading } = useQuery({
    queryKey: ['journalEntryAuditTrail', transactionId],
    queryFn: () => getJournalEntryAuditTrail(transactionId),
    enabled: open && !!transactionId,
  });

  const groupedByEntry = React.useMemo(() => {
    const groups = {};
    auditTrail.forEach((line) => {
      if (!groups[line.entry_id]) {
        groups[line.entry_id] = {
          entryId: line.entry_id,
          entryNumber: line.entry_number,
          entryDate: line.entry_date,
          entryType: line.entry_type,
          source: line.source,
          description: line.description,
          reversesEntryId: line.reverses_entry_id,
          reversedByEntryId: line.reversed_by_entry_id,
          isCurrentEntry: line.is_current_entry,
          isVoided: line.is_voided,
          createdAt: line.created_at,
          updatedAt: line.updated_at,
          lines: [],
        };
      }
      groups[line.entry_id].lines.push({
        lineId: line.line_id,
        lineNumber: line.line_number,
        accountId: line.account_id,
        accountNumber: line.account_number,
        accountName: line.account_name,
        debitAmount: line.debit_amount,
        creditAmount: line.credit_amount,
        lineDescription: line.line_description,
      });
    });
    return Object.values(groups).sort((a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt)
    );
  }, [auditTrail]);

  const getEntryLabel = (entry) => {
    if (entry.isCurrentEntry && !entry.isVoided) {
      return { text: 'Current Active Entry', icon: CheckCircle2, color: 'text-green-600' };
    }
    if (entry.reversesEntryId) {
      return { text: 'Reversal Entry', icon: AlertCircle, color: 'text-orange-600' };
    }
    if (entry.isVoided) {
      return { text: 'Voided Entry', icon: AlertCircle, color: 'text-gray-500' };
    }
    if (!entry.reversedByEntryId && !entry.isCurrentEntry) {
      return { text: 'Original Entry', icon: FileText, color: 'text-blue-600' };
    }
    return { text: 'Historical Entry', icon: Clock, color: 'text-gray-600' };
  };

  const getEntryBadgeVariant = (entry) => {
    if (entry.isCurrentEntry && !entry.isVoided) return 'default';
    if (entry.reversesEntryId) return 'secondary';
    if (entry.isVoided) return 'outline';
    return 'secondary';
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Journal Entry Audit Trail
          </DialogTitle>
          <DialogDescription>
            Complete history of all journal entries for this transaction, including original entries,
            reversals, and re-posted entries.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading audit trail...
          </div>
        ) : groupedByEntry.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No journal entries found for this transaction.
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByEntry.map((entry, index) => {
              const label = getEntryLabel(entry);
              const Icon = label.icon;
              const totalDebits = entry.lines.reduce((sum, line) => sum + (Number(line.debitAmount) || 0), 0);
              const totalCredits = entry.lines.reduce((sum, line) => sum + (Number(line.creditAmount) || 0), 0);

              return (
                <Card
                  key={entry.entryId}
                  className={entry.isVoided ? 'opacity-60 border-dashed' : ''}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${label.color}`} />
                          <span className={entry.isVoided ? 'line-through' : ''}>
                            {entry.entryNumber}
                          </span>
                          <Badge variant={getEntryBadgeVariant(entry)}>
                            {label.text}
                          </Badge>
                        </CardTitle>
                        <div className="text-sm text-muted-foreground">
                          {entry.description}
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>{format(new Date(entry.entryDate), 'MMM d, yyyy')}</div>
                        <div className="text-xs">
                          Created: {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        Type: {entry.entryType}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Source: {entry.source}
                      </Badge>
                      {entry.reversesEntryId && (
                        <Badge variant="outline" className="text-xs text-orange-600">
                          Reverses entry
                        </Badge>
                      )}
                      {entry.reversedByEntryId && !entry.isCurrentEntry && (
                        <Badge variant="outline" className="text-xs text-red-600">
                          Reversed
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Line</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entry.lines.map((line) => (
                          <TableRow key={line.lineId}>
                            <TableCell className="text-muted-foreground">
                              {line.lineNumber}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{line.accountName}</div>
                              <div className="text-xs text-muted-foreground">
                                {line.accountNumber}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.debitAmount ? formatCurrency(line.debitAmount) : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.creditAmount ? formatCurrency(line.creditAmount) : '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {line.lineDescription || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold bg-muted/50">
                          <TableCell colSpan={2} className="text-right">Totals:</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(totalDebits)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(totalCredits)}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {groupedByEntry.length > 0 && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <div className="font-semibold mb-2">Legend:</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Current Active Entry - Currently posted to accounts</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>Original Entry - First entry created</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <span>Reversal Entry - Created when undoing post</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-gray-500" />
                <span>Voided Entry - Reversed and no longer active</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
