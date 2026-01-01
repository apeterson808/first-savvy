import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronRight, ArrowLeft } from 'lucide-react';
import { getAccountDisplayName } from '../utils/constants';

export default function ContactMatchDialog({
  isOpen,
  onClose,
  contact,
  triggeringTransactionId,
  allTransactions,
  accounts,
  onApply,
  isApplying
}) {
  const [viewMode, setViewMode] = useState('compact');
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());
  const [matchResults, setMatchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [applyMode, setApplyMode] = useState('current');

  useEffect(() => {
    if (isOpen && contact) {
      setViewMode('compact');
      setSelectedTransactions(new Set());
      setApplyMode('current');
      const quickCount = getQuickMatchCount(triggeringTransactionId, allTransactions);
      const triggeringTxn = triggeringTransactionId
        ? allTransactions.find(t => t.id === triggeringTransactionId)
        : null;
      setMatchResults({ quickCount, triggeringTransaction: triggeringTxn });
    }
  }, [isOpen, contact, allTransactions, triggeringTransactionId]);

  const getQuickMatchCount = (triggeringTxnId, transactions) => {
    if (!triggeringTxnId || !transactions) return 0;

    const triggeringTxn = transactions.find(t => t.id === triggeringTxnId);
    if (!triggeringTxn || !triggeringTxn.original_description) return 0;

    const bankDescription = triggeringTxn.original_description.toLowerCase().trim();
    let count = 0;

    for (const txn of transactions) {
      if (txn.id === triggeringTxnId) continue;
      if (!txn.original_description) continue;

      if (txn.original_description.toLowerCase().trim() === bankDescription) {
        count++;
        if (count >= 2) break;
      }
    }

    return count;
  };

  const performFullSearch = () => {
    setIsSearching(true);
    setApplyMode('viewAll');

    setTimeout(() => {
      if (!triggeringTransactionId) {
        setIsSearching(false);
        return;
      }

      const triggeringTxn = allTransactions.find(t => t.id === triggeringTransactionId);
      if (!triggeringTxn || !triggeringTxn.original_description) {
        setIsSearching(false);
        return;
      }

      const bankDescription = triggeringTxn.original_description.toLowerCase().trim();
      const unassigned = [];
      const assigned = [];

      allTransactions.forEach(txn => {
        if (txn.id === triggeringTransactionId) return;
        if (!txn.original_description) return;

        if (txn.original_description.toLowerCase().trim() === bankDescription) {
          if (txn.contact_id) {
            assigned.push(txn);
          } else {
            unassigned.push(txn);
          }
        }
      });

      unassigned.sort((a, b) => new Date(b.date) - new Date(a.date));
      assigned.sort((a, b) => new Date(b.date) - new Date(a.date));

      setMatchResults({
        quickCount: unassigned.length + assigned.length,
        unassigned,
        assigned,
        triggeringTransaction: triggeringTxn
      });
      setViewMode('expanded');
      setIsSearching(false);
    }, 100);
  };

  const handleViewAllMatches = () => {
    performFullSearch();
  };

  const handleBackToSummary = () => {
    setViewMode('compact');
    setSelectedTransactions(new Set());
    setApplyMode('current');
  };

  const handleApplyToCurrent = () => {
    if (triggeringTransactionId) {
      onApply([triggeringTransactionId]);
    }
  };

  const handleApplySelected = () => {
    const selectedIds = Array.from(selectedTransactions);
    if (selectedIds.length > 0) {
      onApply(selectedIds);
    }
  };

  const handleToggleChange = (mode) => {
    setApplyMode(mode);
    if (mode === 'viewAll' && viewMode === 'compact') {
      performFullSearch();
    } else if (mode === 'current' && viewMode === 'expanded') {
      handleBackToSummary();
    }
  };

  const handleApplyClick = () => {
    if (viewMode === 'compact' && applyMode === 'current') {
      handleApplyToCurrent();
    } else if (viewMode === 'compact' && applyMode === 'viewAll') {
      performFullSearch();
    }
  };

  const toggleTransaction = (transactionId) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const toggleAll = (transactions) => {
    const allIds = transactions.map(t => t.id);
    const allSelected = allIds.every(id => selectedTransactions.has(id));

    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        allIds.forEach(id => newSet.delete(id));
      } else {
        allIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const renderTransactionList = (transactions, showContact = false) => {
    if (!transactions || transactions.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500">
          No matching transactions found
        </div>
      );
    }

    const allSelected = transactions.every(t => selectedTransactions.has(t.id));

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => toggleAll(transactions)}
          />
          <span className="text-sm font-medium text-slate-600">
            Select All ({transactions.length})
          </span>
          {selectedTransactions.size > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {selectedTransactions.size} selected
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-1 pr-4">
            {transactions.map(txn => {
              const account = accounts.find(a => a.id === txn.bank_account_id);
              const isSelected = selectedTransactions.has(txn.id);

              return (
                <div
                  key={txn.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300 shadow-sm'
                      : 'bg-white hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm'
                  }`}
                  onClick={() => toggleTransaction(txn.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleTransaction(txn.id)}
                    onClick={(e) => e.stopPropagation()}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {txn.description}
                        </div>
                        {txn.original_description && txn.original_description !== txn.description && (
                          <div className="text-xs text-slate-400 mt-0.5 truncate">
                            Bank: {txn.original_description}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <span>{account ? getAccountDisplayName(account) : 'Unknown Account'}</span>
                          <span className="text-slate-300">•</span>
                          <span>{format(new Date(txn.date), 'MMM dd, yyyy')}</span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className={`text-base font-semibold ${
                          txn.amount > 0 ? 'text-green-600' : 'text-slate-900'
                        }`}>
                          {txn.amount > 0 ? '+' : ''}${Math.abs(txn.amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  if (!contact || !matchResults) return null;

  const hasMatches = matchResults.quickCount > 0;
  const triggeringTxn = matchResults.triggeringTransaction;
  const bankDescription = triggeringTxn?.original_description || triggeringTxn?.description;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`transition-all duration-300 ${viewMode === 'expanded' ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {viewMode === 'expanded' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSummary}
                className="mr-2 -ml-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <span>{viewMode === 'compact' ? 'Matching Transactions Found' : 'Select Transactions to Update'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {viewMode === 'compact' ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-xl border border-blue-200">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {matchResults.quickCount === 0 ? '0' : matchResults.quickCount >= 2 ? '2+' : matchResults.quickCount}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold text-slate-900 mb-1">
                    {matchResults.quickCount === 0
                      ? 'No matching transactions found'
                      : matchResults.quickCount === 1
                      ? '1 possible match found'
                      : `${matchResults.quickCount}+ possible matches found`
                    }
                  </div>
                  <div className="text-sm text-slate-600">
                    {hasMatches ? (
                      <>Transactions with matching bank descriptions can be updated to <span className="font-semibold">"{contact.name}"</span></>
                    ) : (
                      'No other transactions match this description'
                    )}
                  </div>
                </div>
              </div>

              {hasMatches && bankDescription && (
                <div className="bg-slate-50 rounded-lg p-4 border">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Matching Bank Description
                  </div>
                  <div className="text-sm font-mono text-slate-900 bg-white px-3 py-2 rounded border">
                    {bankDescription}
                  </div>
                </div>
              )}

              {hasMatches && triggeringTxn && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Current Transaction
                  </div>
                  <div className="p-4 bg-white rounded-lg border-2 border-blue-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 mb-1">
                          {triggeringTxn.description}
                        </div>
                        <div className="text-xs text-slate-500">
                          {accounts.find(a => a.id === triggeringTxn.bank_account_id)
                            ? getAccountDisplayName(accounts.find(a => a.id === triggeringTxn.bank_account_id))
                            : 'Unknown Account'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-base font-semibold ${
                          triggeringTxn.amount > 0 ? 'text-green-600' : 'text-slate-900'
                        }`}>
                          {triggeringTxn.amount > 0 ? '+' : ''}${Math.abs(triggeringTxn.amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {format(new Date(triggeringTxn.date), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  <span className="ml-2 text-slate-600">Searching transactions...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        Applying contact: <span className="font-semibold text-blue-700">"{contact.name}"</span>
                      </div>
                      {bankDescription && (
                        <div className="text-xs text-slate-600 mt-1 font-mono">
                          Matching: {bankDescription}
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {(matchResults.unassigned?.length || 0) + (matchResults.assigned?.length || 0)} total
                    </Badge>
                  </div>

                  <Tabs defaultValue="unassigned" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="unassigned">
                        Unassigned ({matchResults.unassigned?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="assigned">
                        Already Assigned ({matchResults.assigned?.length || 0})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="unassigned" className="mt-4">
                      {renderTransactionList(matchResults.unassigned)}
                    </TabsContent>

                    <TabsContent value="assigned" className="mt-4">
                      {renderTransactionList(matchResults.assigned, true)}
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {viewMode === 'compact' ? (
            <>
              {hasMatches && triggeringTransactionId ? (
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="relative bg-slate-100 rounded-full p-1 flex items-center">
                    <div
                      className={`absolute top-1 bottom-1 bg-white rounded-full shadow-sm transition-all duration-200 ease-out ${
                        applyMode === 'current' ? 'left-1 right-[50%]' : 'left-[50%] right-1'
                      }`}
                    />
                    <button
                      onClick={() => handleToggleChange('current')}
                      className={`relative z-10 px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-full ${
                        applyMode === 'current' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Current Only
                    </button>
                    <button
                      onClick={() => handleToggleChange('viewAll')}
                      className={`relative z-10 px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-full ${
                        applyMode === 'viewAll' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      View All Matches
                    </button>
                  </div>

                  <Button
                    onClick={handleApplyClick}
                    disabled={isApplying}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Apply
                  </Button>
                </div>
              ) : (
                <div className="flex justify-end w-full">
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {selectedTransactions.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-md border border-blue-200 mr-auto">
                  <Badge variant="default" className="bg-blue-600">
                    {selectedTransactions.size}
                  </Badge>
                  <span className="text-sm text-slate-700">
                    transaction{selectedTransactions.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
              )}
              <Button
                onClick={handleApplySelected}
                disabled={selectedTransactions.size === 0 || isApplying}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Apply to Selected
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
