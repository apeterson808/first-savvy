import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { taskCompletionsAPI } from '@/api/taskCompletions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Gift, CheckCircle, XCircle, Clock, Check, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatTimeAgo(iso) {
  const now = new Date();
  const diffMs = now - new Date(iso);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

const TYPE_CONFIG = {
  pending: {
    label: 'Needs Review',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    rowClass: 'bg-amber-50/60',
  },
  task_approved: {
    label: 'Task Approved',
    icon: <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />,
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    rowClass: '',
  },
  task_rejected: {
    label: 'Task Rejected',
    icon: <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />,
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    rowClass: '',
  },
  stars_awarded: {
    label: 'Stars Awarded',
    icon: <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400 shrink-0" />,
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    rowClass: '',
  },
  reward_redeemed: {
    label: 'Reward Claimed',
    icon: <Gift className="h-3.5 w-3.5 text-blue-500 shrink-0" />,
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    rowClass: '',
  },
};

function PendingActions({ item, onApprove, onReject }) {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [acting, setActing] = useState(false);

  const handle = async (fn) => {
    setActing(true);
    try { await fn(item.completionId, note || null); }
    finally { setActing(false); }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          disabled={acting}
          onClick={() => handle(onReject)}
          className="h-6 px-2.5 rounded-full text-xs font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          <X className="h-2.5 w-2.5" /> Reject
        </button>
        <button
          disabled={acting}
          onClick={() => handle(onApprove)}
          className="h-6 px-2.5 rounded-full text-xs font-medium text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          <Check className="h-2.5 w-2.5" /> Approve
        </button>
        <button
          onClick={() => setShowNote(v => !v)}
          className="h-6 px-2 rounded-full text-xs text-slate-400 hover:text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          Note
        </button>
      </div>
      {showNote && (
        <Textarea
          placeholder="Add feedback (optional)..."
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          className="resize-none text-xs py-1.5"
        />
      )}
    </div>
  );
}

const PAGE_SIZE = 10;

export function ActivityTab({ childId, child, onUpdate, isChildView = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (childId) {
      setVisibleCount(PAGE_SIZE);
      loadActivity();
    }
  }, [childId]);

  const loadActivity = async () => {
    try {
      setLoading(true);

      const [completionsResult, redemptionsResult] = await Promise.all([
        supabase
          .from('task_completions')
          .select('id, status, stars_earned, submitted_at, reviewed_at, note, submission_notes, tasks(id, title, icon, color)')
          .eq('child_profile_id', childId)
          .order('submitted_at', { ascending: false })
          .limit(100),
        supabase
          .from('reward_redemptions')
          .select('id, status, requested_at, rewards(title, star_cost)')
          .eq('child_profile_id', childId)
          .order('requested_at', { ascending: false })
          .limit(50),
      ]);

      const allCompletions = completionsResult.data || [];

      const completionRows = allCompletions.map(c => {
        if (!c.tasks) {
          return {
            id: `tc-${c.id}`,
            type: 'stars_awarded',
            title: c.note || c.submission_notes || 'Direct star award',
            starsDelta: c.stars_earned || 0,
            time: c.reviewed_at || c.submitted_at,
            completionId: c.id,
          };
        }
        if (c.status === 'pending') {
          return {
            id: `tc-${c.id}`,
            type: 'pending',
            title: c.tasks?.title || 'Task',
            taskIcon: c.tasks?.icon,
            taskColor: c.tasks?.color,
            starsDelta: c.stars_earned || 0,
            time: c.submitted_at,
            note: c.note || c.submission_notes,
            completionId: c.id,
          };
        }
        return {
          id: `tc-${c.id}`,
          type: c.status === 'approved' ? 'task_approved' : 'task_rejected',
          title: c.tasks?.title || 'Task',
          starsDelta: c.status === 'approved' ? (c.stars_earned || 0) : 0,
          time: c.reviewed_at || c.submitted_at,
          completionId: c.id,
        };
      });

      const redemptionRows = (redemptionsResult.data || []).map(r => ({
        id: `rr-${r.id}`,
        type: 'reward_redeemed',
        title: r.rewards?.title || 'Reward',
        starsDelta: -(r.rewards?.star_cost || 0),
        time: r.requested_at,
      }));

      const sorted = [...completionRows, ...redemptionRows].sort(
        (a, b) => new Date(b.time) - new Date(a.time)
      );

      // compute running balance — pending rows don't affect the balance display
      const currentBalance = child?.stars_balance ?? 0;
      let running = currentBalance;
      const withBalance = sorted.map(row => {
        const bal = running;
        if (row.type !== 'pending') running -= row.starsDelta;
        return { ...row, balanceAfter: bal };
      });

      setRows(withBalance);
    } catch (err) {
      console.error('Error loading activity:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (completionId, reviewNotes) => {
    try {
      await taskCompletionsAPI.approveCompletion(completionId, reviewNotes);
      toast.success('Task approved!');
      await loadActivity();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve task');
    }
  };

  const handleReject = async (completionId, reviewNotes) => {
    try {
      await taskCompletionsAPI.rejectCompletion(completionId, reviewNotes);
      toast.success('Task rejected');
      await loadActivity();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject task');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading activity...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Activity</h3>
        {child && (
          <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-800">{child.stars_balance ?? 0} stars</span>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-slate-500 py-8">No activity yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Mobile: card-style rows */}
            <div className="sm:hidden divide-y divide-slate-100">
              {rows.slice(0, visibleCount).map(row => {
                const cfg = TYPE_CONFIG[row.type];
                const isPending = row.type === 'pending';
                return (
                  <div key={row.id} className={`px-3 py-3 ${cfg.rowClass}`}>
                    <div className="flex items-start gap-2">
                      {/* icon */}
                      {isPending ? (
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: row.taskColor || '#F59E0B' }}
                        >
                          {(() => { const I = PICKER_ICON_MAP[row.taskIcon] || Clock; return <I className="w-3.5 h-3.5 text-white" />; })()}
                        </div>
                      ) : (
                        <div className="mt-0.5 shrink-0">
                          {cfg.icon || <Clock className="h-3.5 w-3.5 text-slate-400" />}
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-medium text-sm text-slate-900 leading-tight">{row.title}</span>
                          {row.starsDelta !== 0 && (
                            <span className={`text-xs font-bold shrink-0 ${row.starsDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {row.starsDelta > 0 ? '+' : ''}{row.starsDelta}★
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-slate-400">
                            {formatDateTime(row.time)}
                          </span>
                          {isPending && (
                            <span className="text-[11px] text-amber-600 font-medium">
                              {formatTimeAgo(row.time)}
                            </span>
                          )}
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium leading-5 ${cfg.badgeClass}`}>
                            {cfg.label}
                          </Badge>
                        </div>

                        {row.note && (
                          <p className="text-[11px] text-slate-500 italic">"{row.note}"</p>
                        )}

                        {isPending && !isChildView && (
                          <PendingActions item={row} onApprove={handleApprove} onReject={handleReject} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Date & Time</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Event</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Stars</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Balance</th>
                    {!isChildView && <th className="px-4 py-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, visibleCount).map((row, idx) => {
                    const cfg = TYPE_CONFIG[row.type];
                    const isPending = row.type === 'pending';
                    const isLast = idx === Math.min(visibleCount, rows.length) - 1;
                    return (
                      <tr
                        key={row.id}
                        className={`${!isLast ? 'border-b' : ''} ${cfg.rowClass} transition-colors`}
                      >
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs align-top">
                          <div>{formatDateTime(row.time)}</div>
                          {isPending && (
                            <div className="text-amber-600 font-medium">{formatTimeAgo(row.time)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-start gap-2">
                            {isPending ? (
                              <div
                                className="w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5"
                                style={{ backgroundColor: row.taskColor || '#F59E0B' }}
                              >
                                {(() => { const I = PICKER_ICON_MAP[row.taskIcon] || Clock; return <I className="w-3 h-3 text-white" />; })()}
                              </div>
                            ) : (
                              <div className="mt-0.5">{cfg.icon}</div>
                            )}
                            <div>
                              <span className="font-medium text-slate-800">{row.title}</span>
                              {row.note && (
                                <p className="text-xs text-slate-400 italic mt-0.5">"{row.note}"</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge variant="outline" className={`text-xs font-medium ${cfg.badgeClass}`}>
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                          {row.starsDelta !== 0 ? (
                            <span className={`font-semibold ${row.starsDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {row.starsDelta > 0 ? '+' : ''}{row.starsDelta}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                          {!isPending ? (
                            <span className="flex items-center justify-end gap-1 text-slate-700 font-medium">
                              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                              {row.balanceAfter}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        {!isChildView && (
                          <td className="px-4 py-3 align-top">
                            {isPending && (
                              <PendingActions item={row} onApprove={handleApprove} onReject={handleReject} />
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length > visibleCount && (
        <div className="flex justify-center pt-1">
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
