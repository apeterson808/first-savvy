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
import { Loader2 } from 'lucide-react';
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
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());
  const [matchResults, setMatchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [applyMode, setApplyMode] = useState('current');

  useEffect(() => {
    if (isOpen && contact) {
      setSelectedTransactions(new Set());
      setApplyMode('current');
      setIsLoading(true);

      setTimeout(() => {
        performFullSearch();
        setIsLoading(false);
      }, 100);
    }
  }, [isOpen, contact, allTransactions, triggeringTransactionId]);

  const performFullSearch = () => {
    if (!triggeringTransactionId) {
      return;
    }

    const triggeringTxn = allTransactions.find(t => t.id === triggeringTransactionId);
    if (!triggeringTxn || !triggeringTxn.original_description) {
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
      totalCount: unassigned.length + assigned.length,
      unassigned,
      assigned,
      triggeringTransaction: triggeringTxn
    });
  };

  const handleToggleChange = (mode) => {
    setApplyMode(mode);
    if (mode === 'current') {
      setSelectedTransactions(new Set());
    }
  };

  const handleApplyClick = () => {
    if (applyMode === 'current') {
      if (triggeringTransactionId) {
        onApply([triggeringTransactionId]);
      }
    } else {
      const selectedIds = Array.from(selectedTransactions);
      if (selectedIds.length > 0) {
        onApply(selectedIds);
      }
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
    const checkboxesDisabled = applyMode === 'current';

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => toggleAll(transactions)}
            disabled={checkboxesDisabled}
          />
          <span className="text-sm font-medium text-slate-600">
            Select All ({transactions.length})
          </span>
          {selectedTransactions.size > 0 && applyMode === 'viewAll' && (
            <Badge variant="secondary" className="ml-auto">
              {selectedTransactions.size} selected
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[280px]">
          <div className="space-y-1 pr-4">
            {transactions.map(txn => {
              const account = accounts.find(a => a.id === txn.bank_account_id);
              const isSelected = selectedTransactions.has(txn.id);

              return (
                <div
                  key={txn.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
                    checkboxesDisabled
                      ? 'bg-white opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-50 border-blue-300 shadow-sm cursor-pointer'
                      : 'bg-white hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm cursor-pointer'
                  }`}
                  onClick={() => !checkboxesDisabled && toggleTransaction(txn.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleTransaction(txn.id)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={checkboxesDisabled}
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

  const hasMatches = matchResults.totalCount > 0;
  const triggeringTxn = matchResults.triggeringTransaction;
  const bankDescription = triggeringTxn?.original_description || triggeringTxn?.description;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Update Contact Assignment</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-600">Loading transactions...</span>
          </div>
        ) : (
          <>
            <div className="space-y-3 overflow-y-auto flex-1">
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-white">
                      {matchResults.totalCount}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {matchResults.totalCount === 0
                        ? 'No matching transactions'
                        : matchResults.totalCount === 1
                        ? '1 matching transaction'
                        : `${matchResults.totalCount} matching transactions`
                      }
                    </div>
                    <div className="text-xs text-slate-600">
                      Applying contact: <span className="font-semibold text-blue-700">"{contact.name}"</span>
                    </div>
                  </div>
                </div>
                {bankDescription && (
                  <div className="text-xs text-slate-600 font-mono bg-white px-2 py-1 rounded border max-w-xs truncate">
                    {bankDescription}
                  </div>
                )}
              </div>

              {triggeringTxn && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1">
                    Current Transaction
                  </div>
                  <div className="p-3 bg-white rounded-lg border-2 border-blue-300 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900">
                          {triggeringTxn.description}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <span>
                            {accounts.find(a => a.id === triggeringTxn.bank_account_id)
                              ? getAccountDisplayName(accounts.find(a => a.id === triggeringTxn.bank_account_id))
                              : 'Unknown Account'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span>{format(new Date(triggeringTxn.date), 'MMM dd, yyyy')}</span>
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
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {hasMatches && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1">
                    All Matching Transactions
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

                    <TabsContent value="unassigned" className="mt-3">
                      {renderTransactionList(matchResults.unassigned)}
                    </TabsContent>

                    <TabsContent value="assigned" className="mt-3">
                      {renderTransactionList(matchResults.assigned, true)}
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 pt-4 border-t">
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
                      Select Multiple
                    </button>
                  </div>

                  {applyMode === 'viewAll' && selectedTransactions.size > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-md border border-blue-200">
                      <Badge variant="default" className="bg-blue-600">
                        {selectedTransactions.size}
                      </Badge>
                      <span className="text-sm text-slate-700">
                        selected
                      </span>
                    </div>
                  )}

                  <Button
                    onClick={handleApplyClick}
                    disabled={isApplying || (applyMode === 'viewAll' && selectedTransactions.size === 0)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {applyMode === 'current' ? 'Apply' : 'Apply to Selected'}
                  </Button>
                </div>
              ) : (
                <div className="flex justify-end w-full">
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
