import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth } from 'date-fns';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, RefreshCw, Plus, ArrowUpDown, ArrowUp, ArrowDown, Settings, Check } from 'lucide-react';
import AddFinancialAccountSheet from './AddFinancialAccountSheet';
import { getGroupedAccountsForTable } from './accountSortUtils';
import { getDetailTypeDisplayName, getAccountDisplayName } from '../utils/constants';

// Editable inline name component
function EditableAccountName({ account }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(account.account_name || account.name || '');
  const inputRef = React.useRef(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    setValue(account.account_name || account.name || '');
  }, [account.account_name, account.name]);

  const handleSave = async () => {
    setIsEditing(false);
    const trimmed = value.trim();
    if (!trimmed || trimmed === (account.account_name || account.name)) {
      setValue(account.account_name || account.name || '');
      return;
    }

    const entityType = account.entityType || 'BankAccount';
    const updateData = (entityType === 'BankAccount' || entityType === 'CreditCard')
      ? { account_name: trimmed }
      : { name: trimmed };

    if (entityType === 'BankAccount' || entityType === 'CreditCard') {
      await base44.entities.BankAccount.update(account.id, updateData);
    } else if (entityType === 'Asset') {
      await base44.entities.Asset.update(account.id, updateData);
    } else if (entityType === 'Liability') {
      await base44.entities.Liability.update(account.id, updateData);
    } else if (entityType === 'Income' || entityType === 'Expense') {
      await base44.entities.Category.update(account.id, updateData);
    }

    queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setValue(account.account_name || account.name || '');
            setIsEditing(false);
          }
        }}
        className="font-medium text-slate-900 text-xs bg-white border border-blue-400 rounded px-1 py-0.5 outline-none w-full"
        autoFocus
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="font-medium text-slate-900 text-xs cursor-text hover:bg-slate-100 rounded px-1 py-0.5 -mx-1"
    >
      {account.account_name || account.name}
    </div>
  );
}

export default function AccountsTable({ accounts, isLoading }) {
  const navigate = useNavigate();
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  const [accountTypeFilter, setAccountTypeFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [sortColumn, setSortColumn] = useState('accountType');
  const [sortDirection, setSortDirection] = useState('asc');
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    institution: true,
    type: true,
    detail: false,
    balance: true,
    status: true
  });

  const queryClient = useQueryClient();

  // Fetch transactions to calculate category totals
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date', 1000)
  });

  // Calculate current month spending/income by category
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const categoryTotals = transactions
    .filter(t => {
      const tDate = new Date(t.date);
      return tDate >= monthStart && tDate <= monthEnd && t.status === 'posted';
    })
    .reduce((acc, t) => {
      if (t.category_id) {
        acc[t.category_id] = (acc[t.category_id] || 0) + t.amount;
      }
      return acc;
    }, {});






  // Filter accounts based on selected type and active status
  const filteredAccounts = accounts.filter(acc => {
    const matchesType = accountTypeFilter === 'all' || acc.entityType === accountTypeFilter;
    const matchesActive = showInactive || acc.is_active !== false;
    return matchesType && matchesActive;
  });

  // Sort helper
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" /> 
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  // Get balance for an account (including children if parent)
  const getAccountBalance = (account) => {
    let balance = (account.entityType === 'Income' || account.entityType === 'Expense')
      ? (categoryTotals[account.id] || 0)
      : (account.current_balance || 0);
    
    if (!account.isSubAccount) {
      const childAccounts = accounts.filter(a => a.parent_account_id === account.id);
      childAccounts.forEach(child => {
        if (child.entityType === 'Income' || child.entityType === 'Expense') {
          balance += (categoryTotals[child.id] || 0);
        } else {
          balance += (child.current_balance || 0);
        }
      });
    }
    return balance;
  };

  // Sort filtered accounts - keeping sub-accounts under their parents
  const sortedFilteredAccounts = (() => {
    // Separate parents and children
    const parentAccounts = filteredAccounts.filter(a => !a.parent_account_id);
    const childAccounts = filteredAccounts.filter(a => a.parent_account_id);

    // Sort parents
    const sortedParents = [...parentAccounts].sort((a, b) => {
      let aVal, bVal;

      switch (sortColumn) {
        case 'name':
          aVal = (a.account_name || '').toLowerCase();
          bVal = (b.account_name || '').toLowerCase();
          break;
        case 'accountType':
          aVal = (a.entityType === 'BankAccount' ? 'Bank Account' : a.entityType === 'CreditCard' ? 'Credit Card' : a.entityType || '').toLowerCase();
          bVal = (b.entityType === 'BankAccount' ? 'Bank Account' : b.entityType === 'CreditCard' ? 'Credit Card' : b.entityType || '').toLowerCase();
          break;
        case 'institution':
          aVal = (a.institution || '').toLowerCase();
          bVal = (b.institution || '').toLowerCase();
          break;
        case 'type':
          aVal = getDetailTypeDisplayName(a.entityType === 'BankAccount' ? a.account_type : a.entityType === 'Asset' || a.entityType === 'Liability' ? a.type : a.detail_type).toLowerCase();
          bVal = getDetailTypeDisplayName(b.entityType === 'BankAccount' ? b.account_type : b.entityType === 'Asset' || b.entityType === 'Liability' ? b.type : b.detail_type).toLowerCase();
          break;
        case 'balance':
          aVal = getAccountBalance(a);
          bVal = getAccountBalance(b);
          break;
        default:
          aVal = (a.account_name || '').toLowerCase();
          bVal = (b.account_name || '').toLowerCase();
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      // Secondary sort by name (alphabetical) when primary values are equal
      const aName = (a.account_name || '').toLowerCase();
      const bName = (b.account_name || '').toLowerCase();
      return aName.localeCompare(bName);
    });

    // Build ordered list with children under parents
    const result = [];
    sortedParents.forEach(parent => {
      result.push(parent);
      const children = childAccounts.filter(c => c.parent_account_id === parent.id);
      children.sort((a, b) => (a.account_name || '').localeCompare(b.account_name || ''));
      children.forEach(child => result.push({ ...child, isSubAccount: true }));
    });
    return result;
  })();

  // Group accounts: Type -> Institution -> Accounts
  const groupedByType = filteredAccounts.reduce((types, account) => {
    // Get account type (use entityType for non-bank accounts)
    const accountType = account.entityType === 'BankAccount' 
      ? (account.account_type || 'other') 
      : account.entityType;
    
    // Get institution name
    const institution = account.entityType === 'BankAccount'
      ? (account.institution && account.institution.trim() !== '' ? account.institution : 'Other')
      : null;
    
    if (!types[accountType]) {
      types[accountType] = { institutions: {}, order: account.bank_order ?? 999 };
    }
    
    const instKey = institution || '_none';
    if (!types[accountType].institutions[instKey]) {
      types[accountType].institutions[instKey] = [];
    }
    types[accountType].institutions[instKey].push(account);
    
    return types;
  }, {});

  // Define type order priority
  const typeOrder = ['checking', 'savings', 'CreditCard', 'investment', 'business', 'Asset', 'Liability', 'Income', 'Expense'];
  
  const sortedTypes = Object.entries(groupedByType).sort(([typeA], [typeB]) => {
    const orderA = typeOrder.indexOf(typeA);
    const orderB = typeOrder.indexOf(typeB);
    if (orderA === -1 && orderB === -1) return typeA.localeCompare(typeB);
    if (orderA === -1) return 1;
    if (orderB === -1) return -1;
    return orderA - orderB;
  });





  return (
    <>
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Accounts</p>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['allAccounts'] })}
                className="h-6 w-6"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              </Button>
            </div>
            <div className="flex items-center">
              <ClickThroughSelect value={accountTypeFilter} onValueChange={setAccountTypeFilter} triggerClassName="w-40 h-8 text-xs hover:bg-slate-50">
                                      <ClickThroughSelectItem value="all">All Accounts</ClickThroughSelectItem>
                                      <ClickThroughSelectItem value="Asset">Assets</ClickThroughSelectItem>
                                      <ClickThroughSelectItem value="BankAccount">Bank Accounts</ClickThroughSelectItem>
                                      <ClickThroughSelectItem value="CreditCard">Credit Cards</ClickThroughSelectItem>
                                      <ClickThroughSelectItem value="Expense">Expenses</ClickThroughSelectItem>
                                      <ClickThroughSelectItem value="Income">Income</ClickThroughSelectItem>
                                      <ClickThroughSelectItem value="Liability">Liabilities</ClickThroughSelectItem>
                                  </ClickThroughSelect>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setAddSheetOpen(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setShowInactive(!showInactive)}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${showInactive ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {showInactive && <Check className="w-3 h-3 text-white" />}
                    </div>
                    Show inactive accounts
                  </DropdownMenuItem>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Columns</div>
                  <DropdownMenuItem onClick={() => setVisibleColumns(v => ({ ...v, name: !v.name }))}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${visibleColumns.name ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {visibleColumns.name && <Check className="w-3 h-3 text-white" />}
                    </div>
                    Name
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibleColumns(v => ({ ...v, institution: !v.institution }))}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${visibleColumns.institution ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {visibleColumns.institution && <Check className="w-3 h-3 text-white" />}
                    </div>
                    Institution
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibleColumns(v => ({ ...v, type: !v.type }))}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${visibleColumns.type ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {visibleColumns.type && <Check className="w-3 h-3 text-white" />}
                    </div>
                    Type
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibleColumns(v => ({ ...v, detail: !v.detail }))}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${visibleColumns.detail ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {visibleColumns.detail && <Check className="w-3 h-3 text-white" />}
                    </div>
                    Detail
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibleColumns(v => ({ ...v, balance: !v.balance }))}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${visibleColumns.balance ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {visibleColumns.balance && <Check className="w-3 h-3 text-white" />}
                    </div>
                    Balance
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibleColumns(v => ({ ...v, status: !v.status }))}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${visibleColumns.status ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {visibleColumns.status && <Check className="w-3 h-3 text-white" />}
                    </div>
                    Status
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 border-t border-slate-200">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-slate-400 mx-auto mb-3 animate-spin" />
              <p className="text-slate-500">Loading accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No accounts yet</h3>
              <p className="text-slate-600 mb-4">Add your first bank account to get started</p>
            </div>
          ) : (
            <div>
              <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="bg-slate-50 text-xs">
                  {visibleColumns.name && (
                    <th
                      className="font-semibold text-slate-700 text-left px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">Display Name{getSortIcon('name')}</div>
                    </th>
                    )}
                    {visibleColumns.institution && (
                    <th
                      className="font-semibold text-slate-700 text-left px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('institution')}
                    >
                      <div className="flex items-center">Institution{getSortIcon('institution')}</div>
                    </th>
                    )}
                    {visibleColumns.type && (
                    <th
                      className="font-semibold text-slate-700 text-left px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('accountType')}
                    >
                      <div className="flex items-center">Account Type{getSortIcon('accountType')}</div>
                    </th>
                    )}
                    {visibleColumns.detail && (
                    <th
                      className="font-semibold text-slate-700 text-left px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center">Detail Type{getSortIcon('type')}</div>
                    </th>
                    )}
                  {visibleColumns.balance && (
                    <th
                      className="font-semibold text-slate-700 text-right px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('balance')}
                    >
                      <div className="flex items-center justify-end">Balance{getSortIcon('balance')}</div>
                    </th>
                  )}
                  {visibleColumns.status && (
                    <th className="font-semibold text-slate-700 text-center px-4 py-3">Status</th>
                  )}
                </tr>
              </thead>
              {(() => {
                return (
                  <tbody>
                    {sortedFilteredAccounts.map((account) => (
                          <tr
                            key={account.id}
                            className="group hover:bg-blue-50/50 border-t border-slate-100 cursor-pointer transition-colors"
                            onClick={() => navigate(`/banking/account/${account.id}`)}
                          >
                            {visibleColumns.name && (
                              <td className={`px-4 py-0.5 ${account.isSubAccount ? 'pl-10' : 'pl-4'}`}>
                                {account.isSubAccount && (
                                  <span className="inline-block w-4 h-4 mr-1 text-slate-400">└</span>
                                )}
                                <span className="text-xs text-slate-900 font-medium group-hover:text-blue-700">
                                  {getAccountDisplayName(account)}
                                </span>
                              </td>
                            )}
                            {visibleColumns.institution && (
                              <td className="px-4 py-0.5">
                                <span className="text-xs text-slate-600">
                                  {account.bank_name || account.institution || '-'}
                                </span>
                              </td>
                            )}
                            {visibleColumns.type && (
                             <td className="px-4 py-0.5">
                               <span className="text-xs text-slate-600">
                                 {account.entityType === 'BankAccount' ? 'Bank Account' : account.entityType === 'CreditCard' ? 'Credit Card' : account.entityType}
                               </span>
                             </td>
                            )}
                            {visibleColumns.detail && (
                             <td className="px-4 py-0.5">
                               <span className="text-xs text-slate-600">
                                 {getDetailTypeDisplayName(account.entityType === 'BankAccount' ? account.account_type : account.entityType === 'Asset' || account.entityType === 'Liability' ? account.type : account.detail_type)}
                               </span>
                             </td>
                            )}
                            {visibleColumns.balance && (
                              <td className="px-4 py-0.5 text-right">
                                <span className="font-semibold text-slate-900 text-xs">
                                  {(() => {
                                    const balance = getAccountBalance(account);
                                    return balance < 0 ? `-$${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                  })()}
                                </span>
                              </td>
                            )}
                            {visibleColumns.status && (
                              <td className="px-4 py-0.5 text-center">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${account.is_active === false ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                                  {account.is_active === false ? 'Inactive' : 'Active'}
                                </span>
                              </td>
                            )}
                          </tr>
                        ))}
                  </tbody>
                );
              })()}
            </table>
            </div>
          )}
        </CardContent>
      </Card>



      {/* Edit Account Sheet */}
      <AddFinancialAccountSheet
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) setEditingAccount(null);
        }}
        editingAccount={editingAccount}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
      />

      {/* Add Account Sheet */}
      <AddFinancialAccountSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
      />

    </>
  );
}