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
  const [allMatchingTransactions, setAllMatchingTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && contact && triggeringTransactionId) {
      setIsLoading(true);

      setTimeout(() => {
        const triggeringTxn = allTransactions.find(t => t.id === triggeringTransactionId);

        if (!triggeringTxn || !triggeringTxn.original_description) {
          setAllMatchingTransactions([triggeringTxn].filter(Boolean));
          setSelectedTransactions(new Set([triggeringTransactionId]));
          setIsLoading(false);
          return;
        }

        const bankDescription = triggeringTxn.original_description.toLowerCase().trim();
        const otherMatches = [];

        allTransactions.forEach(txn => {
          if (txn.id === triggeringTransactionId) return;
          if (!txn.original_description) return;

          if (txn.original_description.toLowerCase().trim() === bankDescription) {
            otherMatches.push(txn);
          }
        });

        otherMatches.sort((a, b) => new Date(b.date) - new Date(a.date));

        setAllMatchingTransactions([triggeringTxn, ...otherMatches]);
        setSelectedTransactions(new Set([triggeringTransactionId]));
        setIsLoading(false);
      }, 100);
    }
  }, [isOpen, contact, allTransactions, triggeringTransactionId]);

  const handleApplyClick = () => {
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

  const renderTransactionList = () => {
    if (!allMatchingTransactions || allMatchingTransactions.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500">
          No matching transactions found
        </div>
      );
    }

    const allSelected = allMatchingTransactions.every(t => selectedTransactions.has(t.id));

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => toggleAll(allMatchingTransactions)}
          />
          <span className="text-sm font-medium text-slate-600">
            Select All ({allMatchingTransactions.length})
          </span>
          {selectedTransactions.size > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {selectedTransactions.size} selected
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-1 pr-4">
            {allMatchingTransactions.map((txn, index) => {
              const account = accounts.find(a => a.id === txn.bank_account_id);
              const isSelected = selectedTransactions.has(txn.id);
              const isCurrentTransaction = txn.id === triggeringTransactionId;

              return (
                <div
                  key={txn.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isCurrentTransaction
                      ? 'bg-blue-50 border-blue-300 shadow-sm'
                      : isSelected
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
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {txn.description}
                          </div>
                          {isCurrentTransaction && (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                              Current
                            </Badge>
                          )}
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

  if (!contact) return null;

  const triggeringTxn = allMatchingTransactions.find(t => t.id === triggeringTransactionId);
  const bankDescription = triggeringTxn?.original_description || triggeringTxn?.description;
  const totalMatches = allMatchingTransactions.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
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
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-white">
                      {totalMatches}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {totalMatches === 0
                        ? 'No transactions'
                        : totalMatches === 1
                        ? '1 transaction'
                        : `${totalMatches} transactions`
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

              <div className="flex-1 overflow-hidden">
                {renderTransactionList()}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {selectedTransactions.size > 0 && (
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
                disabled={isApplying || selectedTransactions.size === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Apply to Selected
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
