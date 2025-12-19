import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function ContactMatchingRulesManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const queryClient = useQueryClient();

  const { data: rules = [] } = useQuery({
    queryKey: ['contactMatchingRules'],
    queryFn: () => base44.entities.ContactMatchingRule.list('-priority')
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list('name')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContactMatchingRule.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactMatchingRules'] });
      setDialogOpen(false);
      setEditingRule(null);
      toast.success('Contact matching rule created');
    },
    onError: (error) => {
      toast.error('Failed to create rule: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContactMatchingRule.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactMatchingRules'] });
      setDialogOpen(false);
      setEditingRule(null);
      toast.success('Contact matching rule updated');
    },
    onError: (error) => {
      toast.error('Failed to update rule: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContactMatchingRule.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactMatchingRules'] });
      toast.success('Contact matching rule deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete rule: ' + error.message);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.ContactMatchingRule.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactMatchingRules'] });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      match_type: formData.get('match_type'),
      match_value: formData.get('match_value'),
      contact_id: formData.get('contact_id'),
      transaction_type: formData.get('transaction_type') || 'all',
      priority: parseInt(formData.get('priority')) || 0,
      is_active: formData.get('is_active') === 'true'
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact?.name || 'Unknown';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Contact Matching Rules
            </h3>
            <CardDescription className="mt-1">
              Create rules to automatically assign contacts to transactions based on description patterns
            </CardDescription>
          </div>
          <Button onClick={() => { setEditingRule(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Match Type</TableHead>
                <TableHead>Pattern</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Priority</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No matching rules yet. Create your first rule to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 bg-slate-100 rounded">
                        {rule.match_type.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{rule.match_value}</TableCell>
                    <TableCell>{getContactName(rule.contact_id)}</TableCell>
                    <TableCell>
                      <span className="text-xs capitalize">
                        {rule.transaction_type === 'all' ? 'All' : rule.transaction_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{rule.priority}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: rule.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingRule(rule); setDialogOpen(true); }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this rule?')) {
                              deleteMutation.mutate(rule.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingRule ? 'Edit' : 'Create'} Contact Matching Rule</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Amazon payments"
                defaultValue={editingRule?.name || ''}
                required
              />
            </div>

            <div>
              <Label htmlFor="match_type">Match Type</Label>
              <Select name="match_type" defaultValue={editingRule?.match_type || 'contains'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="exact">Exact Match</SelectItem>
                  <SelectItem value="starts_with">Starts With</SelectItem>
                  <SelectItem value="ends_with">Ends With</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="match_value">Match Pattern</Label>
              <Input
                id="match_value"
                name="match_value"
                placeholder="e.g., AMAZON, wholefds, starbucks"
                defaultValue={editingRule?.match_value || ''}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                The text pattern to match in transaction descriptions (case insensitive)
              </p>
            </div>

            <div>
              <Label htmlFor="contact_id">Contact</Label>
              <Select name="contact_id" defaultValue={editingRule?.contact_id || ''} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.type && <span className="text-muted-foreground ml-2">({contact.type})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="transaction_type">Transaction Type Filter (Optional)</Label>
              <Select name="transaction_type" defaultValue={editingRule?.transaction_type || 'all'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income Only</SelectItem>
                  <SelectItem value="expense">Expense Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                name="priority"
                type="number"
                placeholder="0"
                defaultValue={editingRule?.priority || 0}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Higher priority rules are evaluated first
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="hidden"
                name="is_active"
                value={editingRule?.is_active !== false ? 'true' : 'false'}
              />
              <Switch
                id="is_active"
                defaultChecked={editingRule?.is_active !== false}
                onCheckedChange={(checked) => {
                  document.querySelector('input[name="is_active"]').value = checked.toString();
                }}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingRule ? 'Update' : 'Create'} Rule
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
