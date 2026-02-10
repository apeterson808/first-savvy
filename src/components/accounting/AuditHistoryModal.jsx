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
import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/components/utils/formatters';
import { getJournalEntryAuditTrail } from '@/api/journalEntries';

export default function AuditHistoryModal({ open, onClose, transactionId }) {
  const { data: auditTrail = [], isLoading } = useQuery({
    queryKey: ['journalEntryAuditTrail', transactionId],
    queryFn: () => getJournalEntryAuditTrail(transactionId),
    enabled: open && !!transactionId,
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Complete journal entry history including reversals, edits, and all accounting changes. Entries marked as "reversed" have been undone, and "reversal" entries are the system-generated corrections.
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading audit trail...
          </div>
        ) : auditTrail.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No journal entries found for this transaction.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action Time</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Offsetting Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditTrail.map((line) => (
                  <TableRow key={line.line_id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(line.created_at), 'MMM d, h:mm a')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(line.entry_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {line.entry_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {line.entry_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={line.description}>
                        {line.description}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{line.account_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {line.account_number}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.debit_amount ? formatCurrency(line.debit_amount) : ''}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.credit_amount ? formatCurrency(line.credit_amount) : ''}
                    </TableCell>
                    <TableCell>
                      {line.is_voided ? (
                        <Badge variant="destructive">Reversed</Badge>
                      ) : line.reverses_entry_id ? (
                        <Badge variant="outline">Reversal</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
