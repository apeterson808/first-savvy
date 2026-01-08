import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/components/utils/formatters';
import { getAccountJournalLines } from '@/api/journalEntries';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
import JournalEntryDialog from './JournalEntryDialog';

export default function AccountRegister({ account, onBack }) {
  const { activeProfile } = useProfile();
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  const { data: journalLines = [], isLoading: journalLoading } = useQuery({
    queryKey: ['account-journal-lines', activeProfile?.id, account.id, dateRange],
    queryFn: () => getAccountJournalLines(activeProfile.id, account.id, dateRange.start, dateRange.end),
    enabled: !!activeProfile && !!account
  });

  const combinedEntries = useMemo(() => {
    const entries = [];

    journalLines.forEach(line => {
      entries.push({
        type: 'journal',
        date: new Date(line.entry_date),
        description: line.entry_description,
        lineDescription: line.line_description,
        offsettingAccounts: line.offsetting_accounts,
        debit: line.debit_amount,
        credit: line.credit_amount,
        entryId: line.entry_id,
        entryNumber: line.entry_number,
        transactionStatus: line.transaction_status
      });
    });

    entries.sort((a, b) => a.date - b.date);

    let balance = 0;
    entries.forEach(entry => {
      if (account.account_class === 'Asset' || account.account_class === 'Expense') {
        balance += (entry.debit || 0) - (entry.credit || 0);
      } else {
        balance += (entry.credit || 0) - (entry.debit || 0);
      }
      entry.balance = balance;
    });

    return entries;
  }, [journalLines, account]);


  if (journalLoading) {
    return <div className="p-4">Loading account register...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">
              {account.account_number} - {account.account_name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {account.account_class} Account Register
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Current Balance</div>
          <div className="text-2xl font-bold">
            {formatCurrency(combinedEntries[combinedEntries.length - 1]?.balance || 0)}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Offsetting Account</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No transactions or journal entries
                  </TableCell>
                </TableRow>
              ) : (
                combinedEntries.map((entry, index) => (
                  <TableRow key={`${entry.type}-${index}`}>
                    <TableCell className="whitespace-nowrap">
                      {format(entry.date, 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{entry.description}</div>
                        {entry.lineDescription && (
                          <div className="text-sm text-muted-foreground">
                            {entry.lineDescription}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.type === 'journal' && (
                          <Badge variant="outline" className="gap-1">
                            <FileText className="h-3 w-3" />
                            {entry.entryNumber}
                          </Badge>
                        )}
                        <span className="text-sm">{entry.offsettingAccounts}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.debit ? formatCurrency(entry.debit) : ''}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.credit ? formatCurrency(entry.credit) : ''}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(entry.balance)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEntryId(entry.entryId)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedEntryId && (
        <JournalEntryDialog
          entryId={selectedEntryId}
          open={!!selectedEntryId}
          onClose={() => setSelectedEntryId(null)}
        />
      )}
    </div>
  );
}
