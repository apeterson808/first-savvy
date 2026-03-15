import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, ChevronLeft, FileText, History, Search } from 'lucide-react';
import { Circle } from 'lucide-react';
import * as Icons from 'lucide-react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { budgetAnalytics } from '@/api/budgetAnalytics';
import { BudgetPerformanceCard } from '@/components/budgeting/BudgetPerformanceCard';
import { SpendingAndVendorCard } from '@/components/budgeting/SpendingAndVendorCard';
import { getAccountJournalLinesPaginated, getAccountAuditHistoryPaginated } from '@/api/journalEntries';
import { formatCurrency } from '@/components/utils/formatters';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import JournalEntryDialog from '@/components/accounting/JournalEntryDialog';
import AuditHistoryModal from '@/components/accounting/AuditHistoryModal';

const PAGE_SIZE = 10;

export function ChildBudgetSection({ childAccount, profileId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [ledgerTab, setLedgerTab] = useState('register');
  const [searchQuery, setSearchQuery] = useState('');
  const [registerPage, setRegisterPage] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [selectedJournalEntryId, setSelectedJournalEntryId] = useState(null);
  const [selectedTransactionForAudit, setSelectedTransactionForAudit] = useState(null);

  const { data: budget } = useQuery({
    queryKey: ['budget-for-category', childAccount.id, profileId],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('budgets')
        .select('*')
        .eq('chart_account_id', childAccount.id)
        .eq('profile_id', profileId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: currentMonthSpending } = useQuery({
    queryKey: ['current-month-spending', childAccount.id, profileId],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const { data, error } = await firstsavvy.supabase
        .from('transactions')
        .select('amount')
        .eq('profile_id', profileId)
        .eq('category_account_id', childAccount.id)
        .eq('status', 'posted')
        .eq('type', childAccount.class === 'expense' ? 'expense' : 'income')
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString());
      if (error) throw error;
      return data?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    },
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: historicalData } = useQuery({
    queryKey: ['historical-spending', childAccount.id, profileId],
    queryFn: () => budgetAnalytics.getHistoricalSpending(childAccount.id, 12, profileId),
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: vendorData } = useQuery({
    queryKey: ['vendor-breakdown', childAccount.id, profileId],
    queryFn: () => budgetAnalytics.getVendorBreakdown(childAccount.id, null, profileId),
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: performanceHistory } = useQuery({
    queryKey: ['budget-performance-history', childAccount.id, profileId],
    queryFn: () => budgetAnalytics.getBudgetPerformanceHistory(childAccount.id, 12, profileId),
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: comparativeData } = useQuery({
    queryKey: ['comparative-analysis', childAccount.id, profileId],
    queryFn: () => budgetAnalytics.getComparativeAnalysis(childAccount.id, profileId),
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: journalLinesData, isLoading: journalLinesLoading } = useQuery({
    queryKey: ['journal-lines-paginated', 'account', childAccount.id, profileId, registerPage],
    queryFn: async () => {
      if (!childAccount.id || !profileId) return { lines: [], totalCount: 0, hasMore: false };
      return await getAccountJournalLinesPaginated({
        profileId,
        accountId: childAccount.id,
        startDate: null,
        endDate: null,
        limit: PAGE_SIZE,
        offset: registerPage * PAGE_SIZE
      });
    },
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: auditHistoryData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-history-paginated', 'account', childAccount.id, profileId, auditPage],
    queryFn: async () => {
      if (!childAccount.id || !profileId) return { lines: [], totalCount: 0, hasMore: false };
      return await getAccountAuditHistoryPaginated({
        profileId,
        accountId: childAccount.id,
        startDate: null,
        endDate: null,
        limit: PAGE_SIZE,
        offset: auditPage * PAGE_SIZE
      });
    },
    enabled: !!childAccount.id && !!profileId && isOpen && ledgerTab === 'audit'
  });

  const journalLines = journalLinesData?.lines || [];
  const auditHistoryLines = auditHistoryData?.lines || [];
  const registerTotalCount = journalLinesData?.totalCount || 0;
  const auditTotalCount = auditHistoryData?.totalCount || 0;
  const registerTotalPages = Math.ceil(registerTotalCount / PAGE_SIZE);
  const auditTotalPages = Math.ceil(auditTotalCount / PAGE_SIZE);

  const allActivity = useMemo(() => {
    let combined = journalLines.map(jl => {
      const entryType = jl.entry_type || 'adjustment';
      let fromToDisplay = '';
      if (entryType === 'transfer') {
        fromToDisplay = jl.offsetting_accounts || 'Transfer';
      } else if (entryType === 'credit_card_payment') {
        fromToDisplay = 'Credit Card Payment';
      } else if (jl.contact_name) {
        fromToDisplay = jl.contact_name;
      }
      return {
        ...jl,
        id: jl.line_id,
        activityType: 'posted',
        displayDate: jl.entry_date,
        displayDescription: jl.line_description || jl.entry_description,
        debitAmount: jl.debit_amount,
        creditAmount: jl.credit_amount,
        entryNumber: jl.entry_number,
        journalEntryId: jl.entry_id,
        transactionId: jl.transaction_id,
        entryType,
        offsettingAccounts: fromToDisplay,
        runningBalance: parseFloat(jl.running_balance || 0)
      };
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      combined = combined.filter(item =>
        item.displayDescription?.toLowerCase().includes(query) ||
        item.entryNumber?.toLowerCase().includes(query) ||
        item.offsettingAccounts?.toLowerCase().includes(query)
      );
    }

    return combined;
  }, [journalLines, searchQuery]);

  const filteredAuditLines = useMemo(() => {
    if (!searchQuery) return auditHistoryLines;
    const query = searchQuery.toLowerCase();
    return auditHistoryLines.filter(line =>
      line.description?.toLowerCase().includes(query) ||
      line.action?.toLowerCase().includes(query)
    );
  }, [auditHistoryLines, searchQuery]);

  const IconComponent = childAccount.icon && Icons[childAccount.icon] ? Icons[childAccount.icon] : Circle;
  const iconColor = childAccount.color || '#94a3b8';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4" style={{ borderLeftColor: iconColor }}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 pt-3 px-4 cursor-pointer hover:bg-slate-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <IconComponent className="h-5 w-5 flex-shrink-0" style={{ color: iconColor }} />
                <span className="text-base font-semibold">{childAccount.display_name}</span>
                {budget && (
                  <Badge variant={budget.is_active ? 'default' : 'secondary'} className="text-xs">
                    {budget.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                )}
                {!budget && (
                  <Badge variant="outline" className="text-xs text-slate-400">No Budget</Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                {currentMonthSpending !== undefined && (
                  <span className="text-sm text-slate-500">
                    {formatCurrency(currentMonthSpending)} this month
                  </span>
                )}
                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BudgetPerformanceCard
                budget={budget}
                currentSpending={currentMonthSpending}
                performanceHistory={performanceHistory}
                comparativeData={comparativeData}
                historicalData={historicalData}
                parentName={childAccount?.display_name}
              />
              <SpendingAndVendorCard
                historicalData={historicalData}
                budget={budget}
                vendorData={vendorData}
              />
            </div>

            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Account Ledger</p>
              </CardHeader>
              <CardContent className="pt-2">
                <Tabs value={ledgerTab} onValueChange={setLedgerTab} className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <TabsList>
                      <TabsTrigger value="register" className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Register
                      </TabsTrigger>
                      <TabsTrigger value="audit" className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5" />
                        Audit History
                      </TabsTrigger>
                    </TabsList>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setRegisterPage(0); setAuditPage(0); }}
                        className="pl-8 w-48 h-8 text-sm"
                      />
                    </div>
                  </div>

                  <TabsContent value="register" className="mt-0">
                    {journalLinesLoading ? (
                      <p className="text-center text-slate-500 py-3 text-sm">Loading register...</p>
                    ) : allActivity.length === 0 ? (
                      <p className="text-center text-slate-500 py-6 text-sm">No activity found</p>
                    ) : (
                      <>
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="h-8 bg-slate-100">
                                <TableHead className="py-1.5 text-[11px] font-semibold">Date</TableHead>
                                <TableHead className="py-1.5 text-[11px] font-semibold">Budget</TableHead>
                                <TableHead className="py-1.5 text-[11px] font-semibold">Reference</TableHead>
                                <TableHead className="py-1.5 text-[11px] font-semibold">Description</TableHead>
                                <TableHead className="py-1.5 text-[11px] font-semibold">From/To</TableHead>
                                <TableHead className="text-right py-1.5 text-[11px] font-semibold">Money In</TableHead>
                                <TableHead className="text-right py-1.5 text-[11px] font-semibold">Money Out</TableHead>
                                <TableHead className="text-right py-1.5 text-[11px] font-semibold">Balance</TableHead>
                                <TableHead className="w-[40px] py-1.5"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {allActivity.map((activity, index) => (
                                <TableRow
                                  key={`${activity.id || index}`}
                                  className={`h-7 ${index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100'}`}
                                >
                                  <TableCell className="whitespace-nowrap text-[11px] py-1">
                                    {activity.displayDate ? format(parseISO(activity.displayDate), 'MMM d, yyyy') : '—'}
                                  </TableCell>
                                  <TableCell className="text-[11px] py-1 text-slate-600 font-medium">
                                    {childAccount.display_name}
                                  </TableCell>
                                  <TableCell className="text-[11px] py-1 text-slate-500">
                                    {activity.entryNumber || '—'}
                                  </TableCell>
                                  <TableCell className="text-[11px] py-1">
                                    {activity.displayDescription || '—'}
                                  </TableCell>
                                  <TableCell className="text-[11px] py-1 text-slate-600">
                                    {activity.offsettingAccounts || '—'}
                                  </TableCell>
                                  <TableCell className="text-right text-[11px] py-1 text-emerald-600 font-medium">
                                    {activity.debitAmount > 0 ? formatCurrency(activity.debitAmount) : ''}
                                  </TableCell>
                                  <TableCell className="text-right text-[11px] py-1 text-red-500 font-medium">
                                    {activity.creditAmount > 0 ? formatCurrency(activity.creditAmount) : ''}
                                  </TableCell>
                                  <TableCell className="text-right text-[11px] py-1 font-medium">
                                    {formatCurrency(activity.runningBalance)}
                                  </TableCell>
                                  <TableCell className="py-1">
                                    {activity.journalEntryId && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                        onClick={() => setSelectedJournalEntryId(activity.journalEntryId)}
                                      >
                                        <FileText className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {registerTotalPages > 1 && (
                          <div className="flex items-center justify-between mt-2 px-1">
                            <span className="text-xs text-slate-500">
                              {registerPage * PAGE_SIZE + 1}–{Math.min((registerPage + 1) * PAGE_SIZE, registerTotalCount)} of {registerTotalCount}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                disabled={registerPage === 0}
                                onClick={() => setRegisterPage(p => p - 1)}
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </Button>
                              <span className="text-xs text-slate-600">{registerPage + 1} / {registerTotalPages}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                disabled={registerPage >= registerTotalPages - 1}
                                onClick={() => setRegisterPage(p => p + 1)}
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="audit" className="mt-0">
                    {auditLoading ? (
                      <p className="text-center text-slate-500 py-3 text-sm">Loading audit history...</p>
                    ) : filteredAuditLines.length === 0 ? (
                      <p className="text-center text-slate-500 py-6 text-sm">No audit history found</p>
                    ) : (
                      <>
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="h-8 bg-slate-100">
                                <TableHead className="py-1.5 text-[11px] font-semibold">Date</TableHead>
                                <TableHead className="py-1.5 text-[11px] font-semibold">Budget</TableHead>
                                <TableHead className="py-1.5 text-[11px] font-semibold">Action</TableHead>
                                <TableHead className="py-1.5 text-[11px] font-semibold">Description</TableHead>
                                <TableHead className="text-right py-1.5 text-[11px] font-semibold">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredAuditLines.map((line, index) => (
                                <TableRow
                                  key={`audit-${line.id || index}`}
                                  className={`h-7 ${index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100'} cursor-pointer`}
                                  onClick={() => setSelectedTransactionForAudit(line)}
                                >
                                  <TableCell className="whitespace-nowrap text-[11px] py-1">
                                    {line.changed_at ? format(parseISO(line.changed_at), 'MMM d, yyyy') : '—'}
                                  </TableCell>
                                  <TableCell className="text-[11px] py-1 text-slate-600 font-medium">
                                    {childAccount.display_name}
                                  </TableCell>
                                  <TableCell className="text-[11px] py-1">
                                    <Badge variant="outline" className="text-[10px] py-0">{line.action || '—'}</Badge>
                                  </TableCell>
                                  <TableCell className="text-[11px] py-1">{line.description || '—'}</TableCell>
                                  <TableCell className="text-right text-[11px] py-1 font-medium">
                                    {line.amount != null ? formatCurrency(line.amount) : '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {auditTotalPages > 1 && (
                          <div className="flex items-center justify-between mt-2 px-1">
                            <span className="text-xs text-slate-500">
                              {auditPage * PAGE_SIZE + 1}–{Math.min((auditPage + 1) * PAGE_SIZE, auditTotalCount)} of {auditTotalCount}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                disabled={auditPage === 0}
                                onClick={() => setAuditPage(p => p - 1)}
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </Button>
                              <span className="text-xs text-slate-600">{auditPage + 1} / {auditTotalPages}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                disabled={auditPage >= auditTotalPages - 1}
                                onClick={() => setAuditPage(p => p + 1)}
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </CardContent>
        </CollapsibleContent>
      </Card>

      {selectedJournalEntryId && (
        <JournalEntryDialog
          entryId={selectedJournalEntryId}
          open={!!selectedJournalEntryId}
          onOpenChange={(open) => { if (!open) setSelectedJournalEntryId(null); }}
        />
      )}

      {selectedTransactionForAudit && (
        <AuditHistoryModal
          transaction={selectedTransactionForAudit}
          open={!!selectedTransactionForAudit}
          onOpenChange={(open) => { if (!open) setSelectedTransactionForAudit(null); }}
        />
      )}
    </Collapsible>
  );
}
