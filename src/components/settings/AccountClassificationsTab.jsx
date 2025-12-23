import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountClassifications } from '@/api/accountClassifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { Pencil, Check, X, Plus, Loader2 } from 'lucide-react';

function ClassificationItem({ classification, onEdit }) {
  const displayName = accountClassifications.getDisplayName(classification);
  const isCustom = classification.is_custom;

  const getClassBadgeColor = (classType) => {
    const colors = {
      'asset': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'liability': 'bg-rose-100 text-rose-700 border-rose-200',
      'income': 'bg-sky-100 text-sky-700 border-sky-200',
      'expense': 'bg-orange-100 text-orange-700 border-orange-200',
      'equity': 'bg-purple-100 text-purple-700 border-purple-200'
    };
    return colors[classType] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${getClassBadgeColor(classification.class)}`}>
            {classification.class}
          </span>
          <span className="text-xs text-slate-500 font-medium">{classification.type}</span>
          {isCustom && (
            <span className="text-xs px-1.5 py-0.5 rounded border bg-violet-100 text-violet-700 border-violet-200 font-medium">
              Custom
            </span>
          )}
        </div>
        <p className="font-medium text-sm">{displayName}</p>
        {classification.display_name && classification.display_name !== classification.category && (
          <p className="text-xs text-slate-500">Original: {classification.category}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(classification)}
        className="ml-2 hover:bg-slate-100"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EditClassificationDialog({ open, onOpenChange, classification }) {
  const [displayName, setDisplayName] = useState('');
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (classification) {
      setDisplayName(classification.display_name || classification.category);
    }
  }, [classification]);

  const updateMutation = useMutation({
    mutationFn: (newDisplayName) =>
      accountClassifications.updateDisplayName(classification.id, newDisplayName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-classifications'] });
      toast.success('Display name updated');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update display name');
    }
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      accountClassifications.updateDisplayName(classification.id, null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-classifications'] });
      toast.success('Display name reset to default');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reset display name');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error('Display name cannot be empty');
      return;
    }
    updateMutation.mutate(trimmed);
  };

  const handleReset = () => {
    resetMutation.mutate();
  };

  if (!classification) return null;

  const getClassBadgeColor = (classType) => {
    const colors = {
      'asset': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'liability': 'bg-rose-100 text-rose-700 border-rose-200',
      'income': 'bg-sky-100 text-sky-700 border-sky-200',
      'expense': 'bg-orange-100 text-orange-700 border-orange-200',
      'equity': 'bg-purple-100 text-purple-700 border-purple-200'
    };
    return colors[classType] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Display Name</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-sm bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${getClassBadgeColor(classification.class)}`}>
                {classification.class}
              </span>
              <span className="text-slate-400">›</span>
              <span className="font-medium">{classification.type}</span>
              <span className="text-slate-400">›</span>
              <span>{classification.category}</span>
            </div>

            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={classification.category}
                className="mt-1.5"
              />
              <p className="text-xs text-slate-500 mt-1">
                Customize how this classification appears in dropdowns and reports
              </p>
            </div>

            {classification.display_name && (
              <p className="text-xs text-slate-600">
                Original name: <span className="font-medium">{classification.category}</span>
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            {classification.display_name && (
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={updateMutation.isPending || resetMutation.isPending}
              >
                {resetMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Reset to Default
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending || resetMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending || resetMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountClassificationsTab() {
  const [editingClassification, setEditingClassification] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState('asset');

  const { data: classifications = [], isLoading } = useQuery({
    queryKey: ['account-classifications'],
    queryFn: () => accountClassifications.getAll(),
    staleTime: 5 * 60 * 1000
  });

  const handleEdit = (classification) => {
    setEditingClassification(classification);
    setEditDialogOpen(true);
  };

  const classGroups = {
    asset: classifications.filter(c => c.class === 'asset'),
    liability: classifications.filter(c => c.class === 'liability'),
    income: classifications.filter(c => c.class === 'income'),
    expense: classifications.filter(c => c.class === 'expense'),
    equity: classifications.filter(c => c.class === 'equity')
  };

  // Group by type within each class
  const getGroupedByType = (classificationList) => {
    const grouped = {};
    classificationList.forEach(c => {
      if (!grouped[c.type]) {
        grouped[c.type] = [];
      }
      grouped[c.type].push(c);
    });
    return grouped;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Classifications</CardTitle>
        <CardDescription>
          Customize how your account types are displayed. You can rename classifications to match your preferred terminology.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <Tabs value={selectedClass} onValueChange={setSelectedClass}>
            <TabsList className="grid w-full grid-cols-5 mb-6 h-auto p-1">
              <TabsTrigger value="asset" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900">
                <div className="flex items-center gap-1.5">
                  <span className="hidden sm:inline">Assets</span>
                  <span className="sm:hidden">Assets</span>
                  <span className="text-xs opacity-70">({classGroups.asset.length})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="liability" className="data-[state=active]:bg-rose-100 data-[state=active]:text-rose-900">
                <div className="flex items-center gap-1.5">
                  <span className="hidden sm:inline">Liabilities</span>
                  <span className="sm:hidden">Liabs</span>
                  <span className="text-xs opacity-70">({classGroups.liability.length})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="income" className="data-[state=active]:bg-sky-100 data-[state=active]:text-sky-900">
                <div className="flex items-center gap-1.5">
                  <span>Income</span>
                  <span className="text-xs opacity-70">({classGroups.income.length})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="expense" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900">
                <div className="flex items-center gap-1.5">
                  <span className="hidden sm:inline">Expenses</span>
                  <span className="sm:hidden">Exp</span>
                  <span className="text-xs opacity-70">({classGroups.expense.length})</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="equity" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900">
                <div className="flex items-center gap-1.5">
                  <span>Equity</span>
                  <span className="text-xs opacity-70">({classGroups.equity.length})</span>
                </div>
              </TabsTrigger>
            </TabsList>

            {Object.entries(classGroups).map(([classType, classList]) => (
              <TabsContent key={classType} value={classType} className="space-y-4">
                {Object.entries(getGroupedByType(classList)).map(([type, items]) => (
                  <div key={type} className="space-y-2">
                    <h4 className="font-medium text-sm text-slate-700 capitalize">{type}</h4>
                    <div className="space-y-2">
                      {items.map(classification => (
                        <ClassificationItem
                          key={classification.id}
                          classification={classification}
                          onEdit={handleEdit}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        )}

        <EditClassificationDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          classification={editingClassification}
        />
      </CardContent>
    </Card>
  );
}
