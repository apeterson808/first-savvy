import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit2, Save, X, Clock, Circle, Info } from 'lucide-react';
import * as Icons from 'lucide-react';
import { formatCurrency } from '@/components/utils/formatters';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';
import { format } from 'date-fns';
import IconPicker from '@/components/common/IconPicker';
import ColorPicker from '@/components/common/ColorPicker';
import CalculatorAmountInput from '@/components/common/CalculatorAmountInput';

export function BudgetSettingsCard({ budget, categoryAccount }) {
  const [isEditing, setIsEditing] = useState(false);
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
      setIsEditing(false);
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
    setIsEditing(false);
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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Budget Settings</p>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateBudgetMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 flex-1">
        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="custom_name">Custom Name (Optional)</Label>
              <Input
                id="custom_name"
                value={editedBudget.custom_name}
                onChange={(e) => setEditedBudget({ ...editedBudget, custom_name: e.target.value })}
                placeholder={categoryAccount?.display_name || 'Category name'}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use category name: {categoryAccount?.display_name}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allocated_amount">Budget Amount</Label>
              <Input
                id="allocated_amount"
                type="number"
                step="0.01"
                value={editedBudget.allocated_amount}
                onChange={(e) => setEditedBudget({ ...editedBudget, allocated_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cadence">Budget Cadence</Label>
              <Select
                value={editedBudget.cadence}
                onValueChange={(value) => setEditedBudget({ ...editedBudget, cadence: value })}
              >
                <SelectTrigger id="cadence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <IconComponent className="h-8 w-8" style={{ color: iconColor }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Display Name</p>
                  <p className="text-base font-medium">
                    {budget?.custom_name || categoryAccount?.display_name || 'Unnamed Category'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Budget Amount ({displayCadence})</p>
                <p className="text-2xl font-bold">{formatCurrency(displayAmount)}</p>
              </div>

              <div className="pt-2 border-t">
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Daily</p>
                    <p className="text-sm font-medium">{formatCurrency(amounts.daily)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Weekly</p>
                    <p className="text-sm font-medium">{formatCurrency(amounts.weekly)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Monthly</p>
                    <p className="text-sm font-medium">{formatCurrency(amounts.monthly)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Yearly</p>
                    <p className="text-sm font-medium">{formatCurrency(amounts.yearly)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <Label htmlFor="is_active_view" className="text-sm text-muted-foreground">Active Budget</Label>
                <Switch
                  id="is_active_view"
                  checked={isActive}
                  onCheckedChange={(checked) => {
                    setIsActive(checked);
                    handleQuickUpdate({ is_active: checked });
                  }}
                />
              </div>

              <div className="pt-2 border-t">
                <TooltipProvider>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="rollover_enabled_view" className="text-sm text-muted-foreground">
                      Budget Rollover
                    </Label>
                    <div className="flex items-center gap-2">
                      {rolloverEnabled && (
                        <CalculatorAmountInput
                          id="accumulated_rollover"
                          value={accumulatedRollover}
                          onChange={(value) => setAccumulatedRollover(value)}
                          onBlur={() => handleQuickUpdate({ accumulated_rollover: accumulatedRollover })}
                          placeholder="0.00"
                          className="w-28 h-8 text-sm"
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
                        <TooltipContent side="top" className="max-w-xs">
                          <p>Unused budget accumulates monthly. Perfect for periodic expenses like property taxes or insurance.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </TooltipProvider>
              </div>

              {budget?.updated_at && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                  <Clock className="h-3 w-3" />
                  <span>Last modified: {format(new Date(budget.updated_at), 'MMM d, yyyy h:mm a')}</span>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
