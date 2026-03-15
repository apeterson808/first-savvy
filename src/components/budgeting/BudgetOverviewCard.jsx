import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Circle } from 'lucide-react';
import * as Icons from 'lucide-react';
import { formatCurrency } from '@/components/utils/formatters';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';
import CalculatorAmountInput from '@/components/common/CalculatorAmountInput';
import AppearancePicker from '@/components/common/AppearancePicker';
import { updateAccountIconColor } from '@/api/chartOfAccounts';

const formatLabel = (str) => {
  if (!str) return '';
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export function BudgetOverviewCard({ budget, categoryAccount, childAccounts = [], childBudgets = [], isEditing = false, onEditChange }) {
  const [editedBudget, setEditedBudget] = useState({
    allocated_amount: budget?.allocated_amount || 0,
    cadence: budget?.cadence || 'monthly',
    custom_name: budget?.custom_name || ''
  });

  const [isActive, setIsActive] = useState(budget?.is_active ?? true);
  const [rolloverEnabled, setRolloverEnabled] = useState(budget?.rollover_enabled ?? false);
  const [accumulatedRollover, setAccumulatedRollover] = useState(budget?.accumulated_rollover || 0);

  const queryClient = useQueryClient();

  useEffect(() => {
    setIsActive(budget?.is_active ?? true);
    setRolloverEnabled(budget?.rollover_enabled ?? false);
    setAccumulatedRollover(budget?.accumulated_rollover || 0);
  }, [budget?.is_active, budget?.rollover_enabled, budget?.accumulated_rollover]);

  const updateBudgetMutation = useMutation({
    mutationFn: async (updates) => {
      if (budget?.id) {
        return await firstsavvy.entities.Budget.update(budget.id, updates);
      } else {
        return await firstsavvy.entities.Budget.create({
          chart_account_id: categoryAccount.id,
          ...updates
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['budgets']);
      toast.success('Budget settings updated');
      if (onEditChange) { onEditChange(false); }
    },
    onError: (error) => {
      toast.error(`Failed to update budget: ${error.message}`);
    }
  });

  const handleSave = () => {
    updateBudgetMutation.mutate({
      ...editedBudget,
      is_active: isActive,
      rollover_enabled: rolloverEnabled,
      accumulated_rollover: accumulatedRollover
    });
  };

  const handleCancel = () => {
    setEditedBudget({
      allocated_amount: budget?.allocated_amount || 0,
      cadence: budget?.cadence || 'monthly',
      custom_name: budget?.custom_name || ''
    });
    setIsActive(budget?.is_active ?? true);
    setRolloverEnabled(budget?.rollover_enabled ?? false);
    setAccumulatedRollover(budget?.accumulated_rollover || 0);
    if (onEditChange) {
      onEditChange(false);
    }
  };

  const handleQuickUpdate = (updates) => {
    updateBudgetMutation.mutate(updates);
  };

  const convertAmount = (amount, fromCadence, toCadence) => {
    if (fromCadence === toCadence) return amount;

    const conversions = {
      daily: { daily: 1, weekly: 7, monthly: 30.44, yearly: 365.25 },
      weekly: { daily: 1/7, weekly: 1, monthly: 4.35, yearly: 52.18 },
      monthly: { daily: 1/30.44, weekly: 1/4.35, monthly: 1, yearly: 12 },
      yearly: { daily: 1/365.25, weekly: 1/52.18, monthly: 1/12, yearly: 1 }
    };

    return amount * conversions[fromCadence][toCadence];
  };

  const displayAmount = budget?.allocated_amount || 0;
  const displayCadence = budget?.cadence || 'monthly';

  const amounts = {
    daily: convertAmount(displayAmount, displayCadence, 'daily'),
    weekly: convertAmount(displayAmount, displayCadence, 'weekly'),
    monthly: convertAmount(displayAmount, displayCadence, 'monthly'),
    yearly: convertAmount(displayAmount, displayCadence, 'yearly')
  };

  const IconComponent = categoryAccount?.icon && Icons[categoryAccount.icon] ? Icons[categoryAccount.icon] : Circle;
  const iconColor = categoryAccount?.color || '#64748b';

  const handleIconColorUpdate = async (icon, color) => {
    try {
      await updateAccountIconColor(categoryAccount.id, icon, color);
      queryClient.invalidateQueries(['budgets']);
      queryClient.invalidateQueries(['chartAccounts']);
      toast.success('Appearance updated');
    } catch (error) {
      toast.error(`Failed to update appearance: ${error.message}`);
    }
  };

  const handleAmountUpdate = (cadence, newAmount) => {
    const convertedAmount = convertAmount(newAmount, cadence, displayCadence);
    updateBudgetMutation.mutate({
      allocated_amount: convertedAmount,
      cadence: displayCadence
    });
  };

  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5">
                {isEditing ? (
                  <AppearancePicker
                    color={iconColor}
                    icon={categoryAccount?.icon}
                    onColorChange={(color) => handleIconColorUpdate(categoryAccount?.icon, color)}
                    onIconChange={(icon) => handleIconColorUpdate(icon, iconColor)}
                  />
                ) : (
                  <IconComponent className="h-5 w-5" style={{ color: iconColor }} />
                )}
              </div>

              <div className="flex items-baseline gap-3 flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={editedBudget.custom_name}
                    onChange={(e) => setEditedBudget({ ...editedBudget, custom_name: e.target.value })}
                    onBlur={() => handleQuickUpdate({ custom_name: editedBudget.custom_name })}
                    placeholder={categoryAccount?.display_name || 'Category name'}
                    className="text-xl font-semibold h-auto py-1 px-2 max-w-md"
                  />
                ) : (
                  <h1 className="text-xl font-semibold">
                    {budget?.custom_name || categoryAccount?.display_name || 'Unnamed Category'}
                  </h1>
                )}
              </div>

              {isEditing ? (
                <CalculatorAmountInput
                  value={amounts.monthly}
                  onChange={(value) => handleAmountUpdate('monthly', value)}
                  placeholder="0.00"
                  className="w-32 h-8 text-lg font-semibold text-center flex-shrink-0"
                />
              ) : (
                <span className="text-lg font-semibold text-slate-700 flex-shrink-0 w-32 text-right">
                  {formatCurrency(amounts.monthly)}<span className="text-sm font-normal text-slate-400">/mo</span>
                </span>
              )}
            </div>

            {childAccounts.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                {childAccounts.map((child) => {
                  const ChildIcon = child.icon && Icons[child.icon] ? Icons[child.icon] : Circle;
                  const childColor = child.color || '#94a3b8';
                  const childBudget = childBudgets.find(b => b.chart_account_id === child.id);
                  const childAmount = childBudget ? convertAmount(childBudget.allocated_amount, childBudget.cadence, 'monthly') : null;
                  return (
                    <div key={child.id} className="flex items-center gap-3 pl-8">
                      <div className="flex-shrink-0 w-5">
                        <ChildIcon className="h-5 w-5" style={{ color: childColor }} />
                      </div>
                      <div className="flex items-baseline gap-3 flex-1 min-w-0">
                        <span className="text-xl font-semibold">{child.display_name}</span>
                      </div>
                      <span className="text-lg font-semibold text-slate-700 flex-shrink-0 w-32 text-right">
                        {childAmount !== null
                          ? <>{formatCurrency(childAmount)}<span className="text-sm font-normal text-slate-400">/mo</span></>
                          : <span className="text-sm font-normal text-slate-400">—</span>
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="is_active_view" className="text-sm text-muted-foreground whitespace-nowrap">
                {isActive ? 'Active' : 'Inactive'}
              </Label>
              <Switch
                id="is_active_view"
                checked={isActive}
                onCheckedChange={(checked) => {
                  setIsActive(checked);
                  handleQuickUpdate({ is_active: checked });
                }}
              />
            </div>

            <TooltipProvider>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="rollover_enabled_view" className="text-sm text-muted-foreground whitespace-nowrap">
                  Rollover
                </Label>
                <div className="flex items-center gap-2">
                  <CalculatorAmountInput
                    id="accumulated_rollover"
                    value={accumulatedRollover}
                    onChange={(value) => setAccumulatedRollover(value)}
                    onBlur={() => handleQuickUpdate({ accumulated_rollover: accumulatedRollover })}
                    placeholder="0.00"
                    className="w-20 h-7 text-sm"
                    disabled={!rolloverEnabled}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Switch
                          id="rollover_enabled_view"
                          checked={rolloverEnabled}
                          onCheckedChange={(checked) => {
                            setRolloverEnabled(checked);
                            handleQuickUpdate({ rollover_enabled: checked });
                          }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>Unused budget accumulates monthly. Perfect for periodic expenses.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
