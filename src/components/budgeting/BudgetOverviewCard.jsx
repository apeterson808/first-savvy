import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit2, Save, X, Circle, ChevronRight } from 'lucide-react';
import * as Icons from 'lucide-react';
import { formatCurrency } from '@/components/utils/formatters';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';
import CalculatorAmountInput from '@/components/common/CalculatorAmountInput';
import AppearancePicker from '@/components/common/AppearancePicker';
import { updateAccountIconColor } from '@/api/chartOfAccounts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formatLabel = (str) => {
  if (!str) return '';
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export function BudgetOverviewCard({ budget, categoryAccount, isEditing = false, onEditChange, parentAccount, relatedAccounts = [] }) {
  const navigate = useNavigate();

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

  const accountName = budget?.custom_name || categoryAccount?.display_name || 'Unnamed Category';
  const accountNumber = categoryAccount?.account_number;

  const isChildAccount = !!categoryAccount?.parent_account_id;
  const parentName = parentAccount?.display_name || parentAccount?.name;

  const siblings = relatedAccounts.filter(a => a.id !== categoryAccount?.id);

  return (
    <Card>
      <CardContent className="pt-4 pb-5">
        <div className="flex flex-col gap-0">

          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isChildAccount && parentName ? (
                <>
                  <button
                    onClick={() => navigate(`/account/${categoryAccount.parent_account_id}`)}
                    className="hover:text-foreground transition-colors hover:underline"
                  >
                    {parentName}
                  </button>
                  <ChevronRight className="h-3 w-3 flex-shrink-0" />
                  <span className="text-foreground font-medium">{accountName}</span>
                </>
              ) : null}
              {accountNumber && (
                <span className="font-mono ml-1 text-muted-foreground">#{accountNumber}</span>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="is_active_view" className="text-xs text-muted-foreground whitespace-nowrap">
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
                <div className="flex items-center gap-2">
                  <Label htmlFor="rollover_enabled_view" className="text-xs text-muted-foreground whitespace-nowrap">
                    Rollover
                  </Label>
                  <div className="flex items-center gap-1.5">
                    {rolloverEnabled && (
                      <CalculatorAmountInput
                        id="accumulated_rollover"
                        value={accumulatedRollover}
                        onChange={(value) => setAccumulatedRollover(value)}
                        onBlur={() => handleQuickUpdate({ accumulated_rollover: accumulatedRollover })}
                        placeholder="0.00"
                        className="w-20 h-7 text-xs"
                      />
                    )}
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
                      <TooltipContent side="left" className="max-w-xs">
                        <p>Unused budget accumulates monthly. Perfect for periodic expenses.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </TooltipProvider>
            </div>
          </div>

          <div className="flex items-start gap-3 pr-2">
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {isEditing ? (
                    <AppearancePicker
                      color={iconColor}
                      icon={categoryAccount?.icon}
                      onColorChange={(color) => handleIconColorUpdate(categoryAccount?.icon, color)}
                      onIconChange={(icon) => handleIconColorUpdate(icon, iconColor)}
                    />
                  ) : (
                    <IconComponent className="h-8 w-8" style={{ color: iconColor }} />
                  )}
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isEditing ? (
                    <Input
                      value={editedBudget.custom_name}
                      onChange={(e) => setEditedBudget({ ...editedBudget, custom_name: e.target.value })}
                      onBlur={() => handleQuickUpdate({ custom_name: editedBudget.custom_name })}
                      placeholder={categoryAccount?.display_name || 'Category name'}
                      className="text-lg font-semibold h-auto py-1 px-2 max-w-xs"
                    />
                  ) : (
                    <h1 className="text-lg font-semibold truncate">{accountName}</h1>
                  )}

                  <span className="text-muted-foreground font-medium text-sm whitespace-nowrap flex-shrink-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <CalculatorAmountInput
                          value={amounts.monthly}
                          onChange={(value) => handleAmountUpdate('monthly', value)}
                          placeholder="0.00"
                          className="w-28 h-8 text-base font-bold text-center"
                        />
                        <Select
                          value={editedBudget.cadence}
                          onValueChange={(val) => {
                            const newAmount = convertAmount(displayAmount, displayCadence, val);
                            setEditedBudget({ ...editedBudget, cadence: val });
                            updateBudgetMutation.mutate({ cadence: val });
                          }}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">/ day</SelectItem>
                            <SelectItem value="weekly">/ week</SelectItem>
                            <SelectItem value="monthly">/ mo</SelectItem>
                            <SelectItem value="yearly">/ yr</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <span className="text-base font-bold text-foreground">
                        {formatCurrency(amounts.monthly)}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {siblings.length > 0 && (
                <div className="flex flex-col gap-0.5 pl-11">
                  {siblings.map((sibling) => {
                    const SiblingIcon = sibling.icon && Icons[sibling.icon] ? Icons[sibling.icon] : Circle;
                    const siblingColor = sibling.color || '#94a3b8';
                    return (
                      <button
                        key={sibling.id}
                        onClick={() => navigate(`/account/${sibling.id}`)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5 group w-full text-left"
                      >
                        <SiblingIcon className="h-4 w-4 flex-shrink-0" style={{ color: siblingColor }} />
                        <span className="group-hover:underline truncate">{sibling.display_name || 'Unnamed'}</span>
                        {sibling.account_number && (
                          <span className="font-mono text-xs text-muted-foreground/60">#{sibling.account_number}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {!isChildAccount && relatedAccounts.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-500 pl-11">
                  <span className="capitalize">{formatLabel(categoryAccount?.account_class || categoryAccount?.class || '')}</span>
                  {categoryAccount?.account_type && (
                    <>
                      <span>•</span>
                      <span>{formatLabel(categoryAccount.account_type)}</span>
                    </>
                  )}
                  {categoryAccount?.account_detail && (
                    <>
                      <span>•</span>
                      <span>{formatLabel(categoryAccount.account_detail)}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {!isEditing && (
            <div className="flex items-end justify-center gap-6 px-8 pt-5 border-t mt-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1.5">Daily</p>
                <p className="text-sm font-semibold">{formatCurrency(amounts.daily)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1.5">Weekly</p>
                <p className="text-sm font-semibold">{formatCurrency(amounts.weekly)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1.5">Monthly</p>
                <p className="text-2xl font-bold">{formatCurrency(amounts.monthly)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1.5">Yearly</p>
                <p className="text-sm font-semibold">{formatCurrency(amounts.yearly)}</p>
              </div>
            </div>
          )}

          {isEditing && (
            <div className="flex items-end justify-center gap-6 px-8 pt-5 border-t mt-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1.5">Daily</p>
                <CalculatorAmountInput
                  value={amounts.daily}
                  onChange={(value) => handleAmountUpdate('daily', value)}
                  placeholder="0.00"
                  className="w-20 h-8 text-sm font-semibold text-center"
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1.5">Weekly</p>
                <CalculatorAmountInput
                  value={amounts.weekly}
                  onChange={(value) => handleAmountUpdate('weekly', value)}
                  placeholder="0.00"
                  className="w-20 h-8 text-sm font-semibold text-center"
                />
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1.5">Monthly</p>
                <CalculatorAmountInput
                  value={amounts.monthly}
                  onChange={(value) => handleAmountUpdate('monthly', value)}
                  placeholder="0.00"
                  className="w-28 h-10 text-xl font-bold text-center"
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1.5">Yearly</p>
                <CalculatorAmountInput
                  value={amounts.yearly}
                  onChange={(value) => handleAmountUpdate('yearly', value)}
                  placeholder="0.00"
                  className="w-20 h-8 text-sm font-semibold text-center"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
