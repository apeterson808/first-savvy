import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Gift, CheckCircle, XCircle, Clock } from 'lucide-react';

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

export function ActivityTab({ childId, child }) {
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
          .select('id, status, stars_earned, submitted_at, reviewed_at, tasks(title)')
          .eq('child_profile_id', childId)
          .order('submitted_at', { ascending: false })
          .limit(50),
        supabase
          .from('reward_redemptions')
          .select('id, status, requested_at, rewards(title, star_cost)')
          .eq('child_profile_id', childId)
          .order('requested_at', { ascending: false })
          .limit(50),
      ]);

      const completionEvents = (completionsResult.data || []).map((c) => {
        // One-time direct award (no task linked)
        if (!c.tasks) {
          return {
            id: `tc-${c.id}`,
            type: 'stars_awarded',
            description: c.note || c.submission_notes || 'Direct star award',
            starsDelta: c.stars_earned || 0,
            time: c.reviewed_at || c.submitted_at,
          };
        }

        let type = 'task_pending';
        let starsDelta = 0;
        let sortTime = c.submitted_at;

        if (c.status === 'approved') {
          type = 'task_approved';
          starsDelta = c.stars_earned || 0;
          sortTime = c.reviewed_at || c.submitted_at;
        } else if (c.status === 'rejected') {
          type = 'task_rejected';
          sortTime = c.reviewed_at || c.submitted_at;
        } else if (c.status === 'pending') {
          type = 'task_pending';
        }

        return {
          id: `tc-${c.id}`,
          type,
          description: c.tasks?.title || 'Task',
          starsDelta,
          time: sortTime,
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

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading activity...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Activity Log</h3>
        {child && (
          <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-800">{child.stars_balance ?? 0} stars</span>
          </div>
        )}
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-slate-500 py-8">No activity yet</p>
          </CardContent>
        </Card>
      ) : (
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
      )}
    </div>
  );
}
