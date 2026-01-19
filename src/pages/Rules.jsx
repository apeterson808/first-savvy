import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProfile } from '../contexts/ProfileContext';
import { transactionRulesApi } from '../api/transactionRules';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Play,
  TrendingUp,
  Filter,
  FileText
} from 'lucide-react';
import { CreateRuleDialog } from '../components/rules/CreateRuleDialog';
import { EditRuleDialog } from '../components/rules/EditRuleDialog';
import { TestRuleDialog } from '../components/rules/TestRuleDialog';
import { ApplyRulesDialog } from '../components/rules/ApplyRulesDialog';

export default function Rules() {
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [ruleToDelete, setRuleToDelete] = useState(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['transaction-rules', activeProfile?.id],
    queryFn: () => transactionRulesApi.listRules(activeProfile.id),
    enabled: !!activeProfile?.id
  });

  const toggleMutation = useMutation({
    mutationFn: ({ ruleId, enabled }) => transactionRulesApi.toggleRule(ruleId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries(['transaction-rules']);
      toast.success('Rule updated');
    },
    onError: (error) => {
      console.error('Error toggling rule:', error);
      toast.error('Failed to update rule');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId) => transactionRulesApi.deleteRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries(['transaction-rules']);
      toast.success('Rule deleted');
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: (ruleId) => transactionRulesApi.duplicateRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries(['transaction-rules']);
      toast.success('Rule duplicated');
    },
    onError: (error) => {
      console.error('Error duplicating rule:', error);
      toast.error('Failed to duplicate rule');
    }
  });

  const handleToggle = (rule) => {
    toggleMutation.mutate({
      ruleId: rule.id,
      enabled: !rule.is_enabled
    });
  };

  const handleEdit = (rule) => {
    setSelectedRule(rule);
    setEditDialogOpen(true);
  };

  const handleTest = (rule) => {
    setSelectedRule(rule);
    setTestDialogOpen(true);
  };

  const handleDuplicate = (rule) => {
    duplicateMutation.mutate(rule.id);
  };

  const handleDelete = (rule) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  const getMatchModeLabel = (mode) => {
    const labels = {
      contains: 'Contains',
      starts_with: 'Starts with',
      ends_with: 'Ends with',
      exact: 'Exact match',
      regex: 'Regex'
    };
    return labels[mode] || mode;
  };

  const getActionSummary = (rule) => {
    const actions = [];
    if (rule.action_set_category_id) actions.push('Set category');
    if (rule.action_set_contact_id) actions.push('Set contact');
    if (rule.action_add_note) actions.push('Add note');
    if (rule.action_add_tags?.length) actions.push('Add tags');
    return actions.join(', ') || 'No actions';
  };

  const enabledRules = rules.filter(r => r.is_enabled).length;
  const disabledRules = rules.filter(r => !r.is_enabled).length;
  const totalMatches = rules.reduce((sum, r) => sum + (r.times_matched || 0), 0);
  const avgAcceptanceRate = rules.length > 0
    ? rules.reduce((sum, r) => sum + (r.acceptance_rate || 0), 0) / rules.length
    : 0;

  if (!activeProfile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Please select a profile</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Transaction Rules</h1>
          <p className="text-slate-500 mt-1">Automatically categorize and tag transactions</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setApplyDialogOpen(true)}
            disabled={enabledRules === 0}
          >
            <Play className="w-4 h-4 mr-2" />
            Apply Rules
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Rule
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Rules</CardDescription>
            <CardTitle className="text-3xl">{rules.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 text-sm text-slate-600">
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {enabledRules} enabled
              </Badge>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                {disabledRules} disabled
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Matches</CardDescription>
            <CardTitle className="text-3xl">{totalMatches}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Across all rules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg. Acceptance</CardDescription>
            <CardTitle className="text-3xl">{avgAcceptanceRate.toFixed(0)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-green-600">
              <TrendingUp className="w-4 h-4" />
              Rule quality
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>High Priority</CardDescription>
            <CardTitle className="text-3xl">
              {rules.filter(r => r.priority >= 75).length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Priority ≥ 75</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>
            Manage your transaction categorization rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Loading rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No rules created yet</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead>Acceptance</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Switch
                        checked={rule.is_enabled}
                        onCheckedChange={() => handleToggle(rule)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{rule.name}</span>
                        {rule.description && (
                          <span className="text-xs text-slate-500">{rule.description}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        {rule.match_description_pattern && (
                          <Badge variant="outline" className="text-xs">
                            <Filter className="w-3 h-3 mr-1" />
                            {getMatchModeLabel(rule.match_description_mode)}: "{rule.match_description_pattern.substring(0, 20)}"
                          </Badge>
                        )}
                        {(rule.match_amount_min || rule.match_amount_max || rule.match_amount_exact) && (
                          <Badge variant="outline" className="text-xs">
                            Amount filter
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-600">{getActionSummary(rule)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={rule.priority >= 75 ? 'default' : 'secondary'}
                        className={
                          rule.priority >= 75
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }
                      >
                        {rule.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{rule.times_matched || 0}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {rule.times_matched > 0 ? `${(rule.acceptance_rate || 0).toFixed(0)}%` : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(rule)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTest(rule)}>
                            <Play className="w-4 h-4 mr-2" />
                            Test Rule
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(rule)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(rule)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateRuleDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        profileId={activeProfile?.id}
      />

      {selectedRule && (
        <>
          <EditRuleDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            rule={selectedRule}
            profileId={activeProfile?.id}
          />

          <TestRuleDialog
            open={testDialogOpen}
            onOpenChange={setTestDialogOpen}
            rule={selectedRule}
            profileId={activeProfile?.id}
          />
        </>
      )}

      <ApplyRulesDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        profileId={activeProfile?.id}
        rules={rules.filter(r => r.is_enabled)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{ruleToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(ruleToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
