import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity, Tag, DollarSign, Check, X, Star, Gift,
  PlusCircle, Pencil, Trash2, FileText, ChevronDown
} from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { getHouseholdActivityFeed } from '@/api/auditLog';
import { format, formatDistanceToNow } from 'date-fns';

const ACTION_CONFIG = {
  categorize_transaction: {
    icon: <Tag className="h-3.5 w-3.5" />,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    label: 'Categorized',
  },
  post_transaction: {
    icon: <Check className="h-3.5 w-3.5" />,
    color: 'text-green-600',
    bg: 'bg-green-50',
    label: 'Posted',
  },
  undo_transaction: {
    icon: <X className="h-3.5 w-3.5" />,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    label: 'Undone',
  },
  import_transactions: {
    icon: <FileText className="h-3.5 w-3.5" />,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    label: 'Imported',
  },
  create_budget: {
    icon: <PlusCircle className="h-3.5 w-3.5" />,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    label: 'Budget created',
  },
  update_budget: {
    icon: <Pencil className="h-3.5 w-3.5" />,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    label: 'Budget updated',
  },
  delete_budget: {
    icon: <Trash2 className="h-3.5 w-3.5" />,
    color: 'text-red-600',
    bg: 'bg-red-50',
    label: 'Budget deleted',
  },
  create_journal_entry: {
    icon: <FileText className="h-3.5 w-3.5" />,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    label: 'Journal entry',
  },
  edit_journal_entry: {
    icon: <Pencil className="h-3.5 w-3.5" />,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    label: 'Entry edited',
  },
  delete_journal_entry: {
    icon: <Trash2 className="h-3.5 w-3.5" />,
    color: 'text-red-600',
    bg: 'bg-red-50',
    label: 'Entry deleted',
  },
  approve_task: {
    icon: <Check className="h-3.5 w-3.5" />,
    color: 'text-green-600',
    bg: 'bg-green-50',
    label: 'Approved task',
  },
  reject_task: {
    icon: <X className="h-3.5 w-3.5" />,
    color: 'text-red-600',
    bg: 'bg-red-50',
    label: 'Rejected task',
  },
  approve_reward: {
    icon: <Gift className="h-3.5 w-3.5" />,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    label: 'Approved reward',
  },
  reject_reward: {
    icon: <X className="h-3.5 w-3.5" />,
    color: 'text-red-600',
    bg: 'bg-red-50',
    label: 'Rejected reward',
  },
  fulfill_reward: {
    icon: <Gift className="h-3.5 w-3.5" />,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    label: 'Fulfilled reward',
  },
  award_stars: {
    icon: <Star className="h-3.5 w-3.5" />,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    label: 'Awarded stars',
  },
};

function getActionConfig(action) {
  return ACTION_CONFIG[action] || {
    icon: <Activity className="h-3.5 w-3.5" />,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    label: action?.replace(/_/g, ' ') || 'Action',
  };
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function AvatarBubble({ name }) {
  const initials = getInitials(name);
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
    'bg-rose-500', 'bg-violet-500', 'bg-cyan-500',
  ];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`h-7 w-7 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
      <span className="text-white text-[10px] font-semibold">{initials}</span>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function HouseholdActivityFeed({ compact = false }) {
  const { activeProfile } = useProfile();
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [entityFilter, setEntityFilter] = useState(null);

  const load = useCallback(async (reset = false) => {
    if (!activeProfile?.id) return;
    const currentOffset = reset ? 0 : offset;
    if (reset) setLoading(true); else setLoadingMore(true);

    try {
      const result = await getHouseholdActivityFeed({
        profileId: activeProfile.id,
        limit: PAGE_SIZE,
        offset: currentOffset,
        entityType: entityFilter,
      });
      setItems(prev => reset ? result.items : [...prev, ...result.items]);
      setTotalCount(result.totalCount);
      if (!reset) setOffset(currentOffset + result.items.length);
    } catch {
      // silently fail — activity feed is non-critical
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeProfile?.id, offset, entityFilter]);

  useEffect(() => {
    setOffset(0);
    load(true);
  }, [activeProfile?.id, entityFilter]);

  const handleLoadMore = () => {
    load(false);
  };

  const displayItems = compact ? items.slice(0, 8) : items;

  if (loading) {
    return (
      <Card className="border border-slate-100 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <span className="font-semibold text-sm text-slate-700">Household Activity</span>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="h-7 w-7 rounded-full bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <Card className="border border-slate-100 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <span className="font-semibold text-sm text-slate-700">Household Activity</span>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-6 text-center">
          <Activity className="h-8 w-8 text-slate-200 mx-auto mb-2 mt-2" />
          <p className="text-sm text-slate-400">No activity yet</p>
          <p className="text-xs text-slate-300 mt-0.5">Actions by household members will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-500" />
            <span className="font-semibold text-sm text-slate-700">Household Activity</span>
            {totalCount > 0 && (
              <span className="text-xs text-slate-400 font-normal">{totalCount} actions</span>
            )}
          </div>
          {!compact && (
            <div className="flex items-center gap-1.5">
              {[null, 'transaction', 'task_completion', 'budget'].map(f => (
                <button
                  key={String(f)}
                  onClick={() => setEntityFilter(f)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    entityFilter === f
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'
                  }`}
                >
                  {f === null ? 'All' : f === 'task_completion' ? 'Tasks' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        <div className="space-y-0">
          {displayItems.map((item, idx) => {
            const config = getActionConfig(item.action);
            const isLast = idx === displayItems.length - 1;
            return (
              <div key={item.id} className="relative flex items-start gap-3 py-2.5">
                {!isLast && (
                  <div className="absolute left-3.5 top-9 bottom-0 w-px bg-slate-100" />
                )}
                <AvatarBubble name={item.actor_display_name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {item.actor_display_name}
                    </span>
                    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
                      {config.icon}
                      {config.label}
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    <span className="mx-1">·</span>
                    {format(new Date(item.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {!compact && items.length < totalCount && (
          <div className="pt-2 border-t border-slate-100 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-slate-500 hover:text-slate-700 text-xs h-8"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                'Loading...'
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 mr-1" />
                  Load more ({totalCount - items.length} remaining)
                </>
              )}
            </Button>
          </div>
        )}

        {compact && totalCount > 8 && (
          <p className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100 mt-1">
            +{totalCount - 8} more actions · view all in Settings
          </p>
        )}
      </CardContent>
    </Card>
  );
}
