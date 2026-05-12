import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Lock, Unlock, Plus, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/api/supabaseClient';

function usePeriods(profileId) {
  return useQuery({
    queryKey: ['accounting-periods', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_periods')
        .select('*')
        .eq('profile_id', profileId)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId
  });
}

export default function AccountingPeriodsTab() {
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();
  const { data: periods = [], isLoading } = usePeriods(activeProfile?.id);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ period_name: '', start_date: '', end_date: '' });

  const createMutation = useMutation({
    mutationFn: async (values) => {
      const { data, error } = await supabase.rpc('create_accounting_period', {
        p_profile_id: activeProfile.id,
        p_period_name: values.period_name,
        p_start_date: values.start_date,
        p_end_date: values.end_date
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
      setShowCreate(false);
      setForm({ period_name: '', start_date: '', end_date: '' });
      toast.success('Accounting period created');
    },
    onError: (err) => toast.error(err.message || 'Failed to create period')
  });

  const lockMutation = useMutation({
    mutationFn: async (periodId) => {
      const { data, error } = await supabase.rpc('lock_accounting_period', {
        p_period_id: periodId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
      queryClient.invalidateQueries({ queryKey: ['je-entry-numbers'] });
      toast.success('Period locked — journal entries in this period are now read-only');
    },
    onError: (err) => toast.error(err.message || 'Failed to lock period')
  });

  const unlockMutation = useMutation({
    mutationFn: async (periodId) => {
      const { data, error } = await supabase.rpc('unlock_accounting_period', {
        p_period_id: periodId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
      queryClient.invalidateQueries({ queryKey: ['je-entry-numbers'] });
      toast.success('Period unlocked — journal entries can now be edited');
    },
    onError: (err) => toast.error(err.message || 'Failed to unlock period')
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.period_name || !form.start_date || !form.end_date) {
      toast.error('All fields are required');
      return;
    }
    if (form.start_date > form.end_date) {
      toast.error('Start date must be before end date');
      return;
    }
    createMutation.mutate(form);
  };

  const formatDate = (d) => {
    try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Accounting Periods</CardTitle>
              <CardDescription>
                Lock periods to prevent editing of journal entries. Locked periods preserve your
                finalized books and cannot be changed until unlocked.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreate(v => !v)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Period
            </Button>
          </div>
        </CardHeader>

        {showCreate && (
          <CardContent className="border-t pt-4">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Period Name</Label>
                  <Input
                    placeholder="e.g. Q1 2026"
                    value={form.period_name}
                    onChange={e => setForm(p => ({ ...p, period_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Period'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}

        <CardContent className={showCreate ? 'pt-2' : ''}>
          {isLoading ? (
            <div className="text-sm text-slate-500 py-4 text-center">Loading periods...</div>
          ) : periods.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>No accounting periods defined.</p>
              <p className="text-xs mt-1">Create a period to lock a set of journal entries.</p>
            </div>
          ) : (
            <div className="divide-y">
              {periods.map(period => (
                <div key={period.id} className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{period.period_name}</span>
                      {period.is_locked ? (
                        <Badge variant="outline" className="text-xs border-red-200 text-red-600 bg-red-50">
                          Locked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-green-200 text-green-600 bg-green-50">
                          Open
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatDate(period.start_date)} — {formatDate(period.end_date)}
                      {period.lock_date && (
                        <span className="ml-2 text-slate-400">
                          Locked {formatDate(period.lock_date)}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-1.5 text-xs ${
                      period.is_locked
                        ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      if (period.is_locked) {
                        if (confirm(`Unlock "${period.period_name}"? Journal entries in this period will become editable again.`)) {
                          unlockMutation.mutate(period.id);
                        }
                      } else {
                        if (confirm(`Lock "${period.period_name}"? All posted journal entries between ${formatDate(period.start_date)} and ${formatDate(period.end_date)} will become read-only.`)) {
                          lockMutation.mutate(period.id);
                        }
                      }
                    }}
                    disabled={lockMutation.isPending || unlockMutation.isPending}
                  >
                    {period.is_locked ? (
                      <>
                        <Unlock className="w-3 h-3" />
                        Unlock
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        Lock Period
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Period Locking Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>When you lock a period, all <strong>posted</strong> journal entries with dates in that range become read-only.</p>
          <p>Transactions in locked periods cannot be edited, re-categorized, or have their amounts changed.</p>
          <p>You can unlock a period at any time to make corrections, then re-lock it when done.</p>
          <p className="text-xs text-slate-400 pt-2">Opening balance entries and draft entries are not affected by period locking.</p>
        </CardContent>
      </Card>
    </div>
  );
}
