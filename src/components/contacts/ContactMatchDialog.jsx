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
  const [viewMode, setViewMode] = useState('compact');
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());
  const [matchResults, setMatchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isOpen && contact) {
      const quickCount = getQuickMatchCount(contact.name, allTransactions);
      setMatchResults({ quickCount });
    }
  }, [isOpen, contact, allTransactions]);

  const getQuickMatchCount = (contactName, transactions) => {
    if (!contactName || !transactions) return 0;

    const searchTerm = contactName.toLowerCase();
    let count = 0;

    for (const txn of transactions) {
      if (!txn.description) continue;
      if (txn.description.toLowerCase().includes(searchTerm)) {
        count++;
        if (count >= 2) break;
      }
    }

    return count;
  };

  const performFullSearch = () => {
    setIsSearching(true);

    setTimeout(() => {
      const searchTerm = contact.name.toLowerCase();
      const unassigned = [];
      const assigned = [];

      allTransactions.forEach(txn => {
        if (!txn.description) return;

        if (txn.description.toLowerCase().includes(searchTerm)) {
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
        assigned
      });
      setViewMode('expanded');
      setIsSearching(false);
    }, 100);
  };

  const handleViewAllMatches = () => {
    performFullSearch();
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

        <ScrollArea className="h-[300px]">
          <div className="space-y-1">
            {transactions.map(txn => {
              const account = accounts.find(a => a.id === txn.bank_account_id);
              const isSelected = selectedTransactions.has(txn.id);

              return (
                <div
                  key={txn.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleTransaction(txn.id)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {txn.description}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {account ? getAccountDisplayName(account) : 'Unknown Account'}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-sm font-semibold ${
                          txn.amount > 0 ? 'text-green-600' : 'text-slate-900'
                        }`}>
                          {txn.amount > 0 ? '+' : ''}${Math.abs(txn.amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </div>
                        <div className="text-xs text-slate-500">
                          {format(new Date(txn.date), 'MMM dd, yyyy')}
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${viewMode === 'expanded' ? 'max-w-3xl' : 'max-w-md'}`}>
        <DialogHeader>
          <DialogTitle>Contact Matches Found</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {viewMode === 'compact' ? (
            <div className="text-center space-y-4">
              <div className="bg-blue-50 rounded-lg p-6">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {matchResults.quickCount === 0 ? 'No' : matchResults.quickCount >= 2 ? '2+' : matchResults.quickCount}
                </div>
                <div className="text-slate-600">
                  {matchResults.quickCount === 0
                    ? 'No matching transactions found'
                    : matchResults.quickCount === 1
                    ? 'possible match found'
                    : 'possible matches found'
                  }
                </div>
              </div>

              {hasMatches && (
                <div className="text-sm text-slate-600">
                  Would you like to apply "{contact.name}" to these transactions?
                </div>
              )}
            </div>
          ) : (
            <div>
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  <span className="ml-2 text-slate-600">Searching transactions...</span>
                </div>
              ) : (
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
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {viewMode === 'compact' ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Skip
              </Button>
              {hasMatches && (
                <>
                  {triggeringTransactionId && (
                    <Button
                      onClick={handleApplyToCurrent}
                      disabled={isApplying}
                      className="bg-slate-600 hover:bg-slate-700"
                    >
                      {isApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Apply to Current Transaction
                    </Button>
                  )}
                  <Button
                    onClick={handleViewAllMatches}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    View All Matches
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleApplySelected}
                disabled={selectedTransactions.size === 0 || isApplying}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Apply to {selectedTransactions.size} Transaction{selectedTransactions.size !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
