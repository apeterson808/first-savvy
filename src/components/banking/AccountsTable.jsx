import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
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
import { Wallet, RefreshCw, Plus, ArrowUpDown, ArrowUp, ArrowDown, Settings, Check, Upload, Package } from 'lucide-react';
import AccountCreationWizard from './AccountCreationWizard';
import EditAccountDialog from './EditAccountDialog';
import FileImporter from './FileImporter';
import AmazonOrderImporter from './AmazonOrderImporter';
import { getGroupedAccountsForTable } from './accountSortUtils';
import { getAccountDisplayName } from '../utils/constants';

const getDetailTypeDisplayName = (type) => {
  if (!type) return 'Unknown';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getAccountTypeDisplayName = (type) => {
  if (!type) return 'Unknown';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Editable inline name component
function EditableAccountName({ account }) {
  const [isEditing, setIsEditing] = useState(false);
  const displayName = getAccountDisplayName(account);
  const [value, setValue] = useState(displayName);
  const inputRef = React.useRef(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    setValue(getAccountDisplayName(account));
  }, [account.custom_display_name, account.display_name, account.account_name, account.name]);

  const handleSave = async () => {
    setIsEditing(false);
    const trimmed = value.trim();
    const currentName = getAccountDisplayName(account);
    if (!trimmed || trimmed === currentName) {
      setValue(currentName);
      return;
    }

    await firstsavvy.entities.ChartAccount.update(account.id, {
      custom_display_name: trimmed
    });

    queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
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
            setValue(getAccountDisplayName(account));
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
      {displayName}
    </div>
  );
}

export default function AccountsTable({ accounts, isLoading }) {
  const navigate = useNavigate();
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [fileImporterOpen, setFileImporterOpen] = useState(false);
  const [amazonImporterOpen, setAmazonImporterOpen] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const initialFilter = urlParams.get('filter') || 'all';

  const [accountTypeFilter, setAccountTypeFilter] = useState(initialFilter);
  const [showInactive, setShowInactive] = useState(false);
  const [sortColumn, setSortColumn] = useState('accountNumber');
  const [sortDirection, setSortDirection] = useState('asc');
  const [visibleColumns, setVisibleColumns] = useState({
    accountNumber: true,
    name: true,
    type: true,
    accountType: true,
    detail: true,
    balance: true,
    status: true
  });

  const queryClient = useQueryClient();

  // Fetch transactions to calculate category totals
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => firstsavvy.entities.Transaction.list('-date', 1000),
    staleTime: 30000,
    gcTime: 300000
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
      if (t.chart_account_id) {
        acc[t.chart_account_id] = (acc[t.chart_account_id] || 0) + t.amount;
      }
      return acc;
    }, {});

  // Build transaction count mapping for all transactions (not filtered by date)
  const transactionCountMap = React.useMemo(() => {
    const countMap = new Map();

    transactions.forEach(t => {
      if (t.account_id) {
        countMap.set(t.account_id, (countMap.get(t.account_id) || 0) + 1);
      }
      if (t.chart_account_id) {
        countMap.set(t.chart_account_id, (countMap.get(t.chart_account_id) || 0) + 1);
      }
    });

    return countMap;
  }, [transactions]);


  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  // Helper function to check if an account is "used" (has transactions or non-zero balance)
  const isAccountUsed = React.useCallback((account) => {
    // Check if account has non-zero balance
    if (account.current_balance && Math.abs(account.current_balance) > 0.01) {
      return true;
    }

    // Check if account has any transactions (using account_id or chart_account_id)
    if (transactionCountMap.get(account.id) > 0) {
      return true;
    }

    // For parent accounts, recursively check if any child account is used
    const childAccounts = accounts.filter(a => a.parent_account_id === account.id);
    if (childAccounts.length > 0) {
      return childAccounts.some(child => isAccountUsed(child));
    }

    return false;
  }, [accounts, transactionCountMap]);

  // Filter accounts based on selected type and active status
  const filteredAccounts = accounts.filter(acc => {
    const matchesType = accountTypeFilter === 'all' || !accountTypeFilter || acc.entityType === accountTypeFilter;
    const matchesActive = showInactive || acc.is_active !== false;
    return matchesType && matchesActive;
  });

  const availableEntityTypes = React.useMemo(() => {
    const allTypes = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
    return allTypes.filter(type => {
      const matchesActive = showInactive || accounts.some(acc => acc.entityType === type && acc.is_active !== false);
      return accounts.some(acc => acc.entityType === type) && matchesActive;
    });
  }, [accounts, showInactive]);

  React.useEffect(() => {
    if (availableEntityTypes.length > 0) {
      if (accountTypeFilter && accountTypeFilter !== 'all' && !availableEntityTypes.includes(accountTypeFilter)) {
        setAccountTypeFilter('all');
        updateUrlFilter('all');
      }
    }
  }, [availableEntityTypes, accountTypeFilter]);

  const updateUrlFilter = (filter) => {
    const url = new URL(window.location);
    url.searchParams.set('filter', filter);
    window.history.replaceState({}, '', url);
  };

  const handleFilterChange = (newFilter) => {
    setAccountTypeFilter(newFilter);
    updateUrlFilter(newFilter);
  };

  React.useEffect(() => {
    if (accountTypeFilter === 'all') {
      setVisibleColumns(v => ({
        ...v,
        type: true,
        accountType: true,
        detail: true
      }));
    } else {
      setVisibleColumns(v => ({
        ...v,
        type: false,
        accountType: false,
        detail: true
      }));
    }
  }, [accountTypeFilter]);

  const entityTypeLabels = {
    'Asset': 'Assets',
    'Liability': 'Liabilities',
    'Equity': 'Equity',
    'Income': 'Income',
    'Expense': 'Expenses'
  };


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
        case 'accountNumber':
          aVal = a.account_number || 0;
          bVal = b.account_number || 0;
          break;
        case 'name':
          aVal = getAccountDisplayName(a).toLowerCase();
          bVal = getAccountDisplayName(b).toLowerCase();
          break;
        case 'type':
          aVal = (a.entityType || '').toLowerCase();
          bVal = (b.entityType || '').toLowerCase();
          break;
        case 'accountType':
          aVal = getAccountTypeDisplayName(a.account_type).toLowerCase();
          bVal = getAccountTypeDisplayName(b.account_type).toLowerCase();
          break;
        case 'detail':
          aVal = getDetailTypeDisplayName(a.account_detail).toLowerCase();
          bVal = getDetailTypeDisplayName(b.account_detail).toLowerCase();
          break;
        case 'balance':
          aVal = getAccountBalance(a);
          bVal = getAccountBalance(b);
          break;
        default:
          aVal = a.account_number || 0;
          bVal = b.account_number || 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      // Secondary sort by name (alphabetical) when primary values are equal
      const aName = getAccountDisplayName(a).toLowerCase();
      const bName = getAccountDisplayName(b).toLowerCase();
      return aName.localeCompare(bName);
    });

    // Build ordered list with children under parents
    const result = [];
    sortedParents.forEach(parent => {
      result.push(parent);
      const children = childAccounts.filter(c => c.parent_account_id === parent.id);
      children.sort((a, b) => getAccountDisplayName(a).localeCompare(getAccountDisplayName(b)));
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
  const typeOrder = ['checking', 'savings', 'CreditCard', 'investment', 'business', 'Asset', 'Liability', 'Equity', 'Income', 'Expense'];
  
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
          <div className="flex items-center gap-1 mb-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Accounts</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
                queryClient.invalidateQueries({ queryKey: ['transactions'] });
              }}
              className="h-6 w-6"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            </Button>
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            <ClickThroughSelect
              value={accountTypeFilter}
              onValueChange={handleFilterChange}
              placeholder="Select account type"
              triggerClassName="h-9 w-48"
            >
              <ClickThroughSelectItem value="all">
                All Accounts
              </ClickThroughSelectItem>
              {availableEntityTypes.map(entityType => (
                <ClickThroughSelectItem key={entityType} value={entityType}>
                  {entityTypeLabels[entityType] || entityType}
                </ClickThroughSelectItem>
              ))}
            </ClickThroughSelect>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWizardOpen(true)}
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
              <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={() => setShowInactive(!showInactive)}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${showInactive ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {showInactive && <Check className="w-3 h-3 text-white" />}
                    </div>
                    Show inactive accounts
                  </DropdownMenuItem>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Columns</div>
                  <DropdownMenuItem onClick={() => setVisibleColumns(v => ({ ...v, accountNumber: !v.accountNumber }))}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${visibleColumns.accountNumber ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {visibleColumns.accountNumber && <Check className="w-3 h-3 text-white" />}
                    </div>
                    Account #
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibleColumns(v => ({ ...v, name: !v.name }))}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${visibleColumns.name ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {visibleColumns.name && <Check className="w-3 h-3 text-white" />}
                    </div>
                    Account Name
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibleColumns(v => ({ ...v, type: !v.type }))}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${visibleColumns.type ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {visibleColumns.type && <Check className="w-3 h-3 text-white" />}
                    </div>
                    Class
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibleColumns(v => ({ ...v, accountType: !v.accountType }))}>
                    <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded border ${visibleColumns.accountType ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {visibleColumns.accountType && <Check className="w-3 h-3 text-white" />}
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
        </CardHeader>
        <CardContent className="p-0 border-t border-slate-200">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-slate-400 mx-auto mb-3 animate-spin" />
              <p className="text-slate-500">Loading accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-8 px-6">
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Add an account</h3>
                  <p className="text-sm text-slate-600">Import your transactions to get started</p>
                </div>

                <div className="bg-slate-50 rounded-lg border border-slate-200 p-6">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Import Options</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setFileImporterOpen(true)}
                      className="p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <Upload className="w-6 h-6 text-teal-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-900">Import from CSV, PDF, or OFX</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setAmazonImporterOpen(true)}
                      className="p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-orange-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-900">Import Amazon Orders</span>
                      </div>
                    </button>
                  </div>
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setWizardOpen(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Or add an account manually
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="bg-slate-50 text-xs">
                  {visibleColumns.accountNumber && (
                    <th
                      className="font-semibold text-slate-700 text-left px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('accountNumber')}
                    >
                      <div className="flex items-center">Account #{getSortIcon('accountNumber')}</div>
                    </th>
                  )}
                  {visibleColumns.name && (
                    <th
                      className="font-semibold text-slate-700 text-left px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">Account Name{getSortIcon('name')}</div>
                    </th>
                  )}
                  {visibleColumns.type && (
                    <th
                      className="font-semibold text-slate-700 text-left px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center">Class{getSortIcon('type')}</div>
                    </th>
                  )}
                  {visibleColumns.accountType && (
                    <th
                      className="font-semibold text-slate-700 text-left px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('accountType')}
                    >
                      <div className="flex items-center">Type{getSortIcon('accountType')}</div>
                    </th>
                  )}
                  {visibleColumns.detail && (
                    <th
                      className="font-semibold text-slate-700 text-left px-4 py-3 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('detail')}
                    >
                      <div className="flex items-center">Detail{getSortIcon('detail')}</div>
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
                            onClick={() => navigate(`/banking/account/${account.id}?from=${encodeURIComponent(window.location.search)}`)}
                          >
                            {visibleColumns.accountNumber && (
                              <td className="px-4 py-0.5">
                                <span className="text-xs text-slate-600 font-mono">
                                  {account.account_number}
                                </span>
                              </td>
                            )}
                            {visibleColumns.name && (
                              <td className="px-4 py-0.5">
                                <span className="text-xs text-slate-900 font-medium group-hover:text-blue-700">
                                  {getAccountDisplayName(account)}
                                </span>
                              </td>
                            )}
                            {visibleColumns.type && (
                             <td className="px-4 py-0.5">
                               <span className="text-xs text-slate-600">
                                 {account.entityType}
                               </span>
                             </td>
                            )}
                            {visibleColumns.accountType && (
                             <td className="px-4 py-0.5">
                               <span className="text-xs text-slate-600">
                                 {getAccountTypeDisplayName(account.account_type)}
                               </span>
                             </td>
                            )}
                            {visibleColumns.detail && (
                             <td className="px-4 py-0.5">
                               <span className="text-xs text-slate-600">
                                 {getDetailTypeDisplayName(account.account_detail)}
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



      {/* Edit Account Dialog */}
      <EditAccountDialog
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) setEditingAccount(null);
        }}
        account={editingAccount}
        onSuccess={handleSuccess}
      />

      {/* Account Creation Wizard */}
      <AccountCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onAccountCreated={handleSuccess}
      />

      {/* File Importer */}
      <FileImporter
        open={fileImporterOpen}
        onOpenChange={setFileImporterOpen}
        onImportComplete={(accounts) => {
          queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
        }}
      />

      {/* Amazon Order Importer */}
      <AmazonOrderImporter
        open={amazonImporterOpen}
        onOpenChange={setAmazonImporterOpen}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
        }}
      />

    </>
  );
}