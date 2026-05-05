import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { taskCompletionsAPI } from '@/api/taskCompletions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Gift, CheckCircle, XCircle, Clock, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';

const EVENT_CONFIGS = {
  stars_awarded: {
    label: 'Stars Awarded',
    icon: <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />,
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  task_approved: {
    label: 'Task Approved',
    icon: <CheckCircle className="h-4 w-4 text-green-600" />,
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
  },
  task_pending: {
    label: 'Pending Approval',
    icon: <Clock className="h-4 w-4 text-slate-500" />,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  task_rejected: {
    label: 'Task Rejected',
    icon: <XCircle className="h-4 w-4 text-red-500" />,
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
  },
  reward_redeemed: {
    label: 'Reward Claimed',
    icon: <Gift className="h-4 w-4 text-blue-500" />,
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
};

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatTimeAgo(iso) {
  const now = new Date();
  const then = new Date(iso);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function PendingItem({ item, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [acting, setActing] = useState(false);

  const IconComp = item.taskIcon ? (PICKER_ICON_MAP[item.taskIcon] || Clock) : Clock;

  const handleApprove = async () => {
    setActing(true);
    try {
      await onApprove(item.id, reviewNotes || null);
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    setActing(true);
    try {
      await onReject(item.id, reviewNotes || null);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="border border-amber-200 rounded-lg bg-amber-50/60 p-3 space-y-2">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: item.taskColor || '#F59E0B' }}
        >
          <IconComp className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900 leading-tight">{item.taskTitle}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-500">{formatDateTime(item.submitted_at)}</span>
            <span className="text-xs text-amber-700 font-medium">({formatTimeAgo(item.submitted_at)})</span>
          </div>
          {item.note && (
            <p className="text-xs text-slate-600 mt-1 italic">"{item.note}"</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-yellow-600 font-bold text-sm shrink-0">
          <Star className="w-3.5 h-3.5 fill-yellow-500" />
          {item.stars_earned}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="h-7 px-3 rounded-full text-xs font-medium text-red-600 bg-white hover:bg-red-50 border border-red-200 transition-colors flex items-center gap-1 disabled:opacity-50"
          onClick={handleReject}
          disabled={acting}
        >
          <X className="h-3 w-3" />
          Reject
        </button>
        <button
          className="h-7 px-3 rounded-full text-xs font-medium text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center gap-1 disabled:opacity-50"
          onClick={handleApprove}
          disabled={acting}
        >
          <Check className="h-3 w-3" />
          Approve
        </button>
        <button
          className="h-7 px-3 rounded-full text-xs font-medium text-slate-500 bg-white hover:bg-slate-50 border border-slate-200 transition-colors flex items-center gap-1 ml-auto"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Note
        </button>
      </div>

      {expanded && (
        <div className="pt-1">
          <Textarea
            placeholder="Add feedback (optional)..."
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={2}
            className="resize-none text-xs"
          />
        </div>
      )}
    </div>
  );
}

export function ActivityTab({ childId, child, onUpdate, isChildView = false }) {
  const [pending, setPending] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (childId) loadActivity();
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

      const pendingItems = allCompletions
        .filter(c => c.status === 'pending' && c.tasks)
        .map(c => ({
          id: c.id,
          taskTitle: c.tasks?.title || 'Task',
          taskIcon: c.tasks?.icon,
          taskColor: c.tasks?.color,
          stars_earned: c.stars_earned || 0,
          submitted_at: c.submitted_at,
          note: c.note || c.submission_notes,
        }));

      setPending(pendingItems);

      const reviewedCompletions = allCompletions.filter(c => c.status !== 'pending');

      const completionEvents = reviewedCompletions.map((c) => {
        if (!c.tasks) {
          return {
            id: `tc-${c.id}`,
            type: 'stars_awarded',
            description: c.note || c.submission_notes || 'Direct star award',
            starsDelta: c.stars_earned || 0,
            time: c.reviewed_at || c.submitted_at,
          };
        }

        const type = c.status === 'approved' ? 'task_approved' : 'task_rejected';
        return {
          id: `tc-${c.id}`,
          type,
          description: c.tasks?.title || 'Task',
          starsDelta: c.status === 'approved' ? (c.stars_earned || 0) : 0,
          time: c.reviewed_at || c.submitted_at,
        };
      });

      const redemptionEvents = (redemptionsResult.data || []).map((r) => ({
        id: `rr-${r.id}`,
        type: 'reward_redeemed',
        description: r.rewards?.title || 'Reward',
        starsDelta: -(r.rewards?.star_cost || 0),
        time: r.requested_at,
      }));

      const all = [...completionEvents, ...redemptionEvents].sort(
        (a, b) => new Date(b.time) - new Date(a.time)
      );

      const currentBalance = child?.stars_balance ?? 0;
      let runningBalance = currentBalance;
      const withBalances = all.map((e) => {
        const balanceAtEvent = runningBalance;
        runningBalance -= e.starsDelta;
        return { ...e, balanceAfter: balanceAtEvent };
      });

      setEvents(withBalances);
    } catch (error) {
      console.error('Error loading activity:', error);
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
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Failed to approve task');
    }
  };

  const handleReject = async (completionId, reviewNotes) => {
    try {
      await taskCompletionsAPI.rejectCompletion(completionId, reviewNotes);
      toast.success('Task rejected');
      await loadActivity();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error rejecting:', error);
      toast.error('Failed to reject task');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading activity...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Activity</h3>
        {child && (
          <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-800">{child.stars_balance ?? 0} stars</span>
          </div>
        )}
      </div>

      {/* Pending approvals section — only shown to parent */}
      {!isChildView && pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-amber-800">Needs Review</h4>
            <span className="bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {pending.length}
            </span>
          </div>
          <div className="space-y-2">
            {pending.map(item => (
              <PendingItem
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        </div>
      )}

      {/* Child-view: show their pending items read-only */}
      {isChildView && pending.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-amber-700">Waiting for Approval</h4>
          {pending.map(item => (
            <div key={item.id} className="border border-amber-200 rounded-lg bg-amber-50/60 p-3 flex items-center gap-3">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{item.taskTitle}</p>
                <p className="text-xs text-slate-500">{formatDateTime(item.submitted_at)}</p>
              </div>
              <div className="flex items-center gap-1 text-yellow-600 font-bold text-sm shrink-0">
                <Star className="w-3.5 h-3.5 fill-yellow-500" />
                {item.stars_earned}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History log */}
      {events.length === 0 && pending.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-slate-500 py-8">No activity yet</p>
          </CardContent>
        </Card>
      ) : events.length > 0 && (
        <div className="space-y-1">
          {!isChildView && events.length > 0 && pending.length > 0 && (
            <h4 className="text-sm font-semibold text-slate-600 pt-1">History</h4>
          )}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Date & Time</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Event</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Stars</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event, idx) => {
                      const config = EVENT_CONFIGS[event.type] || EVENT_CONFIGS.task_pending;
                      const isLast = idx === events.length - 1;
                      return (
                        <tr
                          key={event.id}
                          className={`${!isLast ? 'border-b' : ''} hover:bg-slate-50 transition-colors`}
                        >
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                            {formatDateTime(event.time)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {config.icon}
                              <span className="font-medium text-slate-800">{event.description}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium ${config.badgeClass}`}
                            >
                              {config.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {event.starsDelta !== 0 ? (
                              <span className={`font-semibold ${event.starsDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {event.starsDelta > 0 ? '+' : ''}{event.starsDelta}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className="flex items-center justify-end gap-1 text-slate-700 font-medium">
                              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                              {event.balanceAfter}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
