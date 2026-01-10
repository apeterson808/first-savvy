import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, ExternalLink, Calendar, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/components/utils/formatters';
import { getAccountJournalLines } from '@/api/journalEntries';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
import JournalEntryDialog from './JournalEntryDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

export default function AccountRegister({ account, onBack }) {
  const { activeProfile } = useProfile();
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

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
        transactionStatus: line.transaction_status,
        clearedStatus: line.cleared_status
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

  const getClearedStatusIcon = (status) => {
    switch (status) {
      case 'reconciled':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'cleared':
        return <Circle className="h-4 w-4 text-blue-600 fill-current" />;
      case 'uncleared':
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getClearedStatusLabel = (status) => {
    switch (status) {
      case 'reconciled':
        return 'Reconciled';
      case 'cleared':
        return 'Cleared';
      case 'uncleared':
      default:
        return 'Uncleared';
    }
  };

  const balanceDifference = account.bank_balance
    ? Math.abs((account.current_balance || 0) - account.bank_balance)
    : null;
  const hasDifference = balanceDifference && balanceDifference > 0.01;


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
              {account.account_number} - {account.display_name || account.account_name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {account.account_class} Account Register
            </p>
          </div>
        </div>
        <div className="flex gap-6 items-start">
          {account.bank_balance != null && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Bank Balance</div>
              <div className="text-xl font-semibold">
                {formatCurrency(account.bank_balance)}
              </div>
              {account.last_synced_at && (
                <div className="text-xs text-muted-foreground">
                  As of {format(new Date(account.last_synced_at), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          )}
          <div className="text-right">
            <div className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
              Savvy Balance
              {hasDifference && (
                <AlertCircle className="h-3 w-3 text-amber-500" title="Differs from bank balance" />
              )}
            </div>
            <div className="text-xl font-semibold">
              {formatCurrency(account.current_balance || 0)}
            </div>
            {hasDifference && (
              <div className="text-xs text-amber-600">
                Diff: {formatCurrency(balanceDifference)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Date Range:</span>
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                {dateRange.start ? format(new Date(dateRange.start), 'MMM d, yyyy') : 'Start Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={dateRange.start ? new Date(dateRange.start) : undefined}
                onSelect={(date) => {
                  setDateRange(prev => ({ ...prev, start: date ? format(date, 'yyyy-MM-dd') : null }));
                  setStartDateOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">to</span>
          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                {dateRange.end ? format(new Date(dateRange.end), 'MMM d, yyyy') : 'End Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={dateRange.end ? new Date(dateRange.end) : undefined}
                onSelect={(date) => {
                  setDateRange(prev => ({ ...prev, end: date ? format(date, 'yyyy-MM-dd') : null }));
                  setEndDateOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          {(dateRange.start || dateRange.end) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateRange({ start: null, end: null })}
            >
              Clear
            </Button>
          )}
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
                <TableHead className="w-[30px]"></TableHead>
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No transactions or journal entries
                  </TableCell>
                </TableRow>
              ) : (
                combinedEntries.map((entry, index) => (
                  <TableRow key={`${entry.type}-${index}`}>
                    <TableCell>
                      <div title={getClearedStatusLabel(entry.clearedStatus)}>
                        {getClearedStatusIcon(entry.clearedStatus)}
                      </div>
                    </TableCell>
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
