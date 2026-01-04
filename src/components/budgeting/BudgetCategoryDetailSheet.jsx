import React, { useMemo, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trash2 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import AppearancePicker from '@/components/common/AppearancePicker';
import BudgetConflictDialog from './BudgetConflictDialog';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';

export default function BudgetCategoryDetailSheet({ open, onOpenChange, budget, category, currentSpent }) {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [localName, setLocalName] = useState('');
  const [localAmount, setLocalAmount] = useState('');
  const [localColor, setLocalColor] = useState('');
  const [localIcon, setLocalIcon] = useState('');
  const inputRef = useRef(null);
  const amountInputRef = useRef(null);
  const queryClient = useQueryClient();

  const [limitAmount, setLimitAmount] = useState('');
  const [isSubAccount, setIsSubAccount] = useState(false);
  const [parentBudgetId, setParentBudgetId] = useState('');
  const [allowRollover, setAllowRollover] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingBudgetData, setPendingBudgetData] = useState(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => firstsavvy.entities.Transaction.list('-date', 1000)
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const allAccounts = await firstsavvy.entities.Account.filter({ is_active: true });
      return allAccounts.filter(acc =>
        (acc.class === 'asset' && ['checking_account', 'savings_account'].includes(acc.account_detail)) ||
        (acc.class === 'liability' && acc.account_type === 'credit_cards')
      );
    }
  });

  const { data: existingBudgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('budgets')
        .select(`
          *,
          chartAccount:user_chart_of_accounts!budgets_chart_account_id_fkey(
            id,
            display_name,
            class,
            account_type,
            account_detail
          )
        `)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    }
  });

  const activeAccountIds = accounts.map(a => a.id);

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }) => firstsavvy.entities.Budget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (!activeProfile) throw new Error('No active profile');
      return firstsavvy.from('user_chart_of_accounts')
        .update(data)
        .eq('id', id)
        .eq('profile_id', activeProfile.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    }
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (id) => firstsavvy.entities.Budget.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      onOpenChange(false);
      toast.success('Budget item deleted');
    }
  });

  React.useEffect(() => {
    if (budget && open) {
      const newColor = budget.chartAccount?.color || category?.color || '#64748b';
      const newIcon = budget.chartAccount?.icon || category?.icon || 'Circle';

      setLocalName(budget.name || category?.name || '');
      setLocalAmount(budget.allocated_amount?.toString() || '');

      // Only update color/icon if they're different to avoid overwriting pending changes
      setLocalColor(prev => prev && prev !== '#64748b' ? prev : newColor);
      setLocalIcon(prev => prev && prev !== 'Circle' ? prev : newIcon);

      setSelectedGroupId(budget.group_id || '');
      setLimitAmount(budget.allocated_amount?.toString() || '');
      setIsSubAccount(!!budget.parent_budget_id);
      setParentBudgetId(budget.parent_budget_id || '');
      setAllowRollover(budget.allow_rollover || false);
    }
  }, [budget, category, open]);

  // Calculate historical spending (past 6 months)
  const historicalData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(today, i);
      const monthStart = startOfMonth(date);
      const monthEnd = i === 0 ? today : endOfMonth(date);
      
      const monthTransactions = transactions.filter(t => {
        if (!t.date) return false;
        const tDate = new Date(t.date);
        if (isNaN(tDate.getTime())) return false;
        const matchesAccount = activeAccountIds.includes(t.bank_account_id);
        const matchesCategory = budget ? (t.chart_account_id === budget.chart_account_id) : false;
        return tDate >= monthStart && tDate <= monthEnd && 
               t.status === 'posted' && 
               matchesAccount && 
               matchesCategory;
      });
      
      const spent = monthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      data.push({
        month: format(date, 'MMM'),
        spent,
        isCurrentMonth: i === 0
      });
    }
    
    return data;
  }, [transactions, budget, activeAccountIds]);

  // Calculate averages
  const lastMonthSpent = historicalData[4]?.spent || 0;
  const monthlyAverage = historicalData.slice(0, 5).reduce((sum, d) => sum + d.spent, 0) / 5;

  const currentTotalExpenses = existingBudgets
    .filter(b => b.chartAccount?.class === 'expense' && b.id !== budget?.id)
    .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

  const totalIncome = existingBudgets
    .filter(b => b.chartAccount?.class === 'income')
    .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

  const allParentBudgets = existingBudgets.filter(b => !b.parent_budget_id);

  // Get current month transactions
  const today = new Date();
  const monthStart = startOfMonth(today);
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return false;
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return false;
      const matchesAccount = activeAccountIds.includes(t.bank_account_id);
      const matchesCategory = budget ? (t.chart_account_id === budget.chart_account_id) : false;
      return tDate >= monthStart && tDate <= today && 
             t.status === 'posted' && 
             matchesAccount && 
             matchesCategory;
    }).sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });
  }, [transactions, budget, activeAccountIds, monthStart, today]);

  if (!budget) return null;

  const handleSaveBudgetDetails = async () => {
    if (!limitAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    const trimmed = limitAmount.trim();
    let newAmount;

    try {
      // If starts with operator, prepend current value
      if (trimmed.match(/^[+\-*/]/)) {
        newAmount = eval(`${budget.allocated_amount}${trimmed}`);
      } else {
        // Evaluate the full expression
        newAmount = eval(trimmed);
      }
    } catch {
      toast.error('Invalid calculation');
      return;
    }

    if (isNaN(newAmount) || newAmount <= 0) {
      toast.error('Please enter a valid budget amount');
      return;
    }

    const budgetData = {
      allocated_amount: newAmount,
      allow_rollover: allowRollover,
      parent_budget_id: isSubAccount ? parentBudgetId || null : null,
    };

    const isExpenseBudget = budget.chartAccount?.class === 'expense';
    if (isExpenseBudget && totalIncome > 0) {
      const newTotalExpenses = currentTotalExpenses + newAmount;
      if (newTotalExpenses > totalIncome) {
        setPendingBudgetData(budgetData);
        setConflictDialogOpen(true);
        return;
      }
    }

    updateBudgetMutation.mutate({ id: budget.id, data: budgetData });
    toast.success('Budget details updated');
  };

  const handleConflictSave = async (updates) => {
    for (const update of updates) {
      if (update.id) {
        await firstsavvy.entities.Budget.update(update.id, { allocated_amount: update.allocated_amount });
      }
    }

    if (pendingBudgetData) {
      await firstsavvy.entities.Budget.update(budget.id, pendingBudgetData);
    }

    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    toast.success('Budgets updated successfully');
    setConflictDialogOpen(false);
    setPendingBudgetData(null);
  };

  const isIncome = category?.type === 'income';
  const remaining = budget.allocated_amount - currentSpent;
  const percent = (currentSpent / budget.allocated_amount) * 100;

  const handleColorChange = (newColor) => {
    setLocalColor(newColor);
    updateBudgetMutation.mutate({ id: budget.id, data: { color: newColor } });
    if (budget.chart_account_id) {
      updateCategoryMutation.mutate({ id: budget.chart_account_id, data: { color: newColor } });
    }
  };

  const handleIconChange = (newIcon) => {
    setLocalIcon(newIcon);
    if (budget.chart_account_id) {
      updateCategoryMutation.mutate({ id: budget.chart_account_id, data: { icon: newIcon } });
    }
  };

  const handleNameSave = async () => {
    const trimmedName = localName.trim();
    if (trimmedName && trimmedName !== budget.name) {
      await updateBudgetMutation.mutateAsync({ id: budget.id, data: { name: trimmedName } });
      if (budget.chart_account_id) {
        await updateCategoryMutation.mutateAsync({ id: budget.chart_account_id, data: { name: trimmedName } });
      }
    } else {
      setLocalName(budget.name || category?.name || '');
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setLocalName(budget.name || category?.name || '');
      setIsEditingName(false);
    }
  };

  const handleAmountSave = async () => {
    const trimmed = localAmount.trim();
    if (!trimmed) {
      setLocalAmount(budget.allocated_amount?.toString() || '');
      setIsEditingAmount(false);
      return;
    }

    let newAmount;
    try {
      if (trimmed.match(/^[+\-*/]/)) {
        newAmount = eval(`${budget.allocated_amount}${trimmed}`);
      } else {
        newAmount = eval(trimmed);
      }
    } catch (error) {
      toast.error('Invalid calculation');
      setLocalAmount(budget.allocated_amount?.toString() || '');
      setIsEditingAmount(false);
      return;
    }

    if (isNaN(newAmount) || newAmount <= 0) {
      toast.error('Result must be a positive number');
      setLocalAmount(budget.allocated_amount?.toString() || '');
      setIsEditingAmount(false);
      return;
    }

    // Replace input with calculated result immediately
    setLocalAmount(newAmount.toString());

    const budgetData = {
      allocated_amount: newAmount,
    };

    const isExpenseBudget = budget.chartAccount?.class === 'expense';
    if (isExpenseBudget && totalIncome > 0) {
      const newTotalExpenses = currentTotalExpenses + newAmount;
      if (newTotalExpenses > totalIncome) {
        setPendingBudgetData(budgetData);
        setConflictDialogOpen(true);
        setIsEditingAmount(false);
        return;
      }
    }

    await updateBudgetMutation.mutateAsync({ id: budget.id, data: budgetData });
    setLimitAmount(newAmount.toString());
    setIsEditingAmount(false);
  };

  const handleAmountKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAmountSave();
    } else if (e.key === 'Escape') {
      setLocalAmount(budget.allocated_amount?.toString() || '');
      setIsEditingAmount(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <SheetTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Category Detail
          </SheetTitle>

          {/* Category Header */}
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
            <AppearancePicker
              color={localColor}
              icon={localIcon}
              onColorChange={handleColorChange}
              onIconChange={handleIconChange}
            />
            <input
              ref={inputRef}
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onFocus={() => setIsEditingName(true)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              className={`text-lg font-semibold text-slate-900 bg-transparent rounded px-2 py-1 outline-none flex-1 cursor-text ${
                isEditingName ? 'bg-white border border-blue-400' : 'border border-transparent hover:border-slate-300'
              }`}
            />
          </div>

          {/* Budget Progress */}
          <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#e2e8f0"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke={localColor}
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${Math.min(percent, 100) * 1.76} 176`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-slate-900">{Math.round(percent)}%</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl font-bold text-slate-900">
                      ${currentSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-slate-400">/</span>
                    {isEditingAmount ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-slate-600">$</span>
                        <input
                          ref={amountInputRef}
                          type="text"
                          value={localAmount}
                          onChange={(e) => setLocalAmount(e.target.value.replace(/[^0-9.+\-*/]/g, ''))}
                          onKeyDown={handleAmountKeyDown}
                          onBlur={handleAmountSave}
                          className="w-20 px-1 py-0.5 text-base border border-blue-400 rounded bg-white outline-none"
                          autoFocus
                        />
                      </span>
                    ) : (
                      <span 
                        className="text-base font-semibold text-slate-600 cursor-text px-1 py-0.5 rounded hover:bg-slate-50 hover:border hover:border-slate-300"
                        onClick={() => {
                          setIsEditingAmount(true);
                          setTimeout(() => amountInputRef.current?.focus(), 0);
                        }}
                      >
                        ${parseFloat(limitAmount || budget.allocated_amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    ${remaining >= 0 ? remaining.toLocaleString(undefined, { maximumFractionDigits: 0 }) : Math.abs(remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })} 
                    {isIncome 
                      ? (remaining >= 0 ? ' remaining' : ' over')
                      : (remaining >= 0 ? ' left' : ' over')
                    }
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allowRollover"
                    checked={allowRollover}
                    onCheckedChange={setAllowRollover}
                  />
                  <Label htmlFor="allowRollover" className="text-sm font-normal cursor-pointer text-slate-600">
                    Allow rollover
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isSubAccount"
                    checked={isSubAccount}
                    onCheckedChange={(checked) => {
                      setIsSubAccount(checked);
                      if (!checked) setParentBudgetId('');
                    }}
                  />
                  <Label htmlFor="isSubAccount" className="text-sm font-normal cursor-pointer text-slate-600">
                    Add as sub-account
                  </Label>
                </div>
              </div>
            </div>

            {isSubAccount && (
              <div className="pt-2 border-t border-slate-100">
                <Label htmlFor="parentBudget" className="text-xs text-slate-500 mb-1 block">Parent Budget Item</Label>
                <ClickThroughSelect
                  value={parentBudgetId}
                  onValueChange={setParentBudgetId}
                  placeholder="Select parent"
                  triggerClassName="hover:bg-slate-50 h-7 text-xs"
                >
                  {allParentBudgets.map(pb => (
                    <ClickThroughSelectItem key={pb.id} value={pb.id}>
                      {pb.name}
                    </ClickThroughSelectItem>
                  ))}
                </ClickThroughSelect>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-xs text-slate-500 mb-1">{isIncome ? 'Earned' : 'Spent'} last month</p>
              <p className="text-xl font-bold text-slate-900">
                ${lastMonthSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-xs text-slate-500 mb-1">Monthly average</p>
              <p className="text-xl font-bold text-slate-900">
                ${monthlyAverage.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Historical Chart */}
          <div className="mt-6">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={historicalData} margin={{ top: 10, right: 0, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#64748b" 
                  tick={{ fontSize: 12 }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke="#64748b" 
                  tick={{ fontSize: 12 }} 
                  width={60}
                  tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                  axisLine={false} 
                  tickLine={false}
                  orientation="right"
                />
                <Tooltip 
                  contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  formatter={(value) => [`$${value.toFixed(2)}`, isIncome ? 'Earned' : 'Spent']}
                />
                <Bar 
                  dataKey="spent" 
                  fill={localColor}
                  radius={[4, 4, 0, 0]}
                  fillOpacity={(entry) => entry.isCurrentMonth ? 1 : 0.6}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>



          {/* Transactions List */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Transactions
              </h3>
              <span className="text-xs text-slate-500">
                {currentMonthTransactions.length} this month
              </span>
            </div>
            <div className="space-y-2">
              {currentMonthTransactions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No transactions this month</p>
              ) : (
                currentMonthTransactions.map(transaction => {
                  const account = accounts.find(a => a.id === transaction.bank_account_id);
                  return (
                    <div key={transaction.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: localColor }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {transaction.description}
                          </p>
                          <p className="text-xs text-slate-500">
                            {transaction.date && !isNaN(new Date(transaction.date).getTime()) 
                              ? format(new Date(transaction.date), 'MMM d') 
                              : 'No date'} · {account?.account_name || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 ml-2">
                        ${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SheetHeader>
      </SheetContent>

      <BudgetConflictDialog
        open={conflictDialogOpen}
        onOpenChange={(open) => {
          setConflictDialogOpen(open);
          if (!open) setPendingBudgetData(null);
        }}
        conflictBudget={pendingBudgetData ? { name: budget.name, allocated_amount: pendingBudgetData.allocated_amount } : null}
        requestedAmount={pendingBudgetData?.allocated_amount || 0}
        totalIncome={totalIncome}
        allBudgets={existingBudgets}
        onSave={handleConflictSave}
      />
    </Sheet>
  );
}