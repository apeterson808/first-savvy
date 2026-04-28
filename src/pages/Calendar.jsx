import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useProfile } from '@/contexts/ProfileContext';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Settings2, CalendarDays, List,
  LayoutGrid, ChefHat, CalendarRange
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth,
  addDays, isToday, startOfDay, isBefore
} from 'date-fns';

// Returns true if a recurring task should appear on a given calendar day
function taskAppearsOnDay(task, day) {
  // One-off task with a specific due date
  if (task.due_date) {
    const dueDateStr = task.due_date.startsWith
      ? task.due_date.slice(0, 10)
      : format(new Date(task.due_date), 'yyyy-MM-dd');
    return dueDateStr === format(day, 'yyyy-MM-dd');
  }

  const today = startOfDay(new Date());
  const dayStart = startOfDay(day);

  // Don't show recurring tasks on past days
  if (isBefore(dayStart, today)) return false;

  const { reset_mode, frequency } = task;

  // Instant-reset tasks are grab-whenever — not scheduled on the calendar
  if (reset_mode === 'instant') return false;

  const isRecurring = frequency === 'always_available' || reset_mode === 'daily' || reset_mode === 'weekly';
  if (!isRecurring) return false;

  if (reset_mode === 'daily' || frequency === 'always_available') return true;

  if (reset_mode === 'weekly') {
    // Show on every day of the current week only
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
    return !isBefore(dayStart, weekStart) && !isBefore(weekEnd, dayStart);
  }

  return false;
}

import { mealRecipesAPI } from '@/api/mealRecipes';
import { mealPlanEntriesAPI } from '@/api/mealPlanEntries';
import { calendarEventsAPI } from '@/api/calendarEvents';
import { calendarPreferencesAPI } from '@/api/calendarPreferences';
import { childProfilesAPI } from '@/api/childProfiles';
import { tasksAPI } from '@/api/tasks';
import { taskCompletionsAPI } from '@/api/taskCompletions';
import { supabase } from '@/api/supabaseClient';

import DayDetailPanel from '@/components/calendar/DayDetailPanel';
import WeekMealPlanner from '@/components/calendar/WeekMealPlanner';
import RecipeLibrary from '@/components/calendar/RecipeLibrary';

const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner'];

function getMealIcon(mealType) {
  return { breakfast: '🌅', lunch: '☀️', dinner: '🍽' }[mealType] || '🍴';
}

// ─── Month Grid ────────────────────────────────────────────────────────────────

function MonthGrid({
  currentMonth, selectedDate, onSelectDate,
  mealEntries, tasks, taskCompletions, calendarEvents, transactions,
  childColors, activeChildFilters, showFinancials
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDayData = useCallback((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayMeals = mealEntries.filter(e => {
      const d = typeof e.scheduled_date === 'string'
        ? e.scheduled_date
        : format(e.scheduled_date, 'yyyy-MM-dd');
      return d === dateStr;
    });
    const allDayTasks = tasks.filter(t => taskAppearsOnDay(t, day));
    const dayTasks = activeChildFilters.length > 0
      ? allDayTasks.filter(t => activeChildFilters.includes(t.assigned_to_child_id))
      : allDayTasks;
    const pendingCount = isToday(day)
      ? taskCompletions.filter(c => c.status === 'pending').length
      : 0;
    const dayEvents = calendarEvents.filter(e => e.event_date === dateStr);
    const dayTxns = transactions.filter(t => (t.date || '').startsWith(dateStr));
    const income = dayTxns.filter(t => t.type === 'income' && t.status === 'posted')
      .reduce((s, t) => s + (t.amount || 0), 0);
    const expense = dayTxns.filter(t => t.type === 'expense' && t.status === 'posted')
      .reduce((s, t) => s + (t.amount || 0), 0);
    return { dayMeals, dayTasks, pendingCount, dayEvents, income, expense };
  }, [mealEntries, tasks, taskCompletions, calendarEvents, transactions, activeChildFilters]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 border-b sticky top-0 bg-background z-10">
        {DOW.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {allDays.map((day, idx) => {
          const { dayMeals, dayTasks, pendingCount, dayEvents, income, expense } = getDayData(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const todayDay = isToday(day);
          const totalItems = dayMeals.length + dayTasks.length + dayEvents.length;
          const visibleMeals = dayMeals.slice(0, 2);
          const visibleTasks = dayTasks.slice(0, Math.max(0, 3 - visibleMeals.length));
          const visibleEvents = dayEvents.slice(0, Math.max(0, 3 - visibleMeals.length - visibleTasks.length));
          const overflow = totalItems - visibleMeals.length - visibleTasks.length - visibleEvents.length;

          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                'min-h-[100px] border-b border-r p-1.5 cursor-pointer transition-colors select-none',
                isCurrentMonth ? 'bg-background hover:bg-muted/40' : 'bg-muted/10 hover:bg-muted/20',
                isSelected ? 'ring-2 ring-inset ring-primary bg-primary/5' : '',
                idx % 7 === 0 ? 'border-l' : ''
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
                  todayDay ? 'bg-primary text-primary-foreground' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40'
                )}>
                  {format(day, 'd')}
                </span>
                {pendingCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </div>

              {visibleMeals.map(meal => {
                const mealName = meal.meal_recipes?.name || meal.custom_meal_name;
                return (
                  <div key={meal.id} className="flex items-center gap-0.5 mb-0.5 px-1 py-0.5 rounded bg-amber-50 border border-amber-100 dark:bg-amber-950/30 dark:border-amber-900">
                    <span className="text-[9px] shrink-0">{getMealIcon(meal.meal_type)}</span>
                    <span className="text-[10px] text-amber-800 dark:text-amber-300 font-medium truncate leading-tight">{mealName}</span>
                  </div>
                );
              })}

              {visibleTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-1 mb-0.5 px-1 py-0.5 rounded text-[10px] font-medium truncate border-l-2"
                  style={{
                    backgroundColor: `${childColors[task.assigned_to_child_id] || '#3b82f6'}15`,
                    color: childColors[task.assigned_to_child_id] || '#3b82f6',
                    borderLeftColor: childColors[task.assigned_to_child_id] || '#3b82f6'
                  }}
                >
                  {task.title}
                </div>
              ))}

              {visibleEvents.map(event => (
                <div
                  key={event.id}
                  className="flex items-center gap-1 mb-0.5 px-1 py-0.5 rounded text-[10px] font-medium truncate"
                  style={{
                    backgroundColor: `${event.color || '#10b981'}15`,
                    color: event.color || '#10b981',
                  }}
                >
                  {event.title}
                </div>
              ))}

              {showFinancials && (income > 0 || expense > 0) && (
                <div className="flex gap-1 mt-0.5">
                  {income > 0 && (
                    <span className="text-[9px] font-semibold text-green-600 bg-green-50 dark:bg-green-950/30 px-1 rounded">
                      +${income < 1000 ? income.toFixed(0) : `${(income / 1000).toFixed(1)}k`}
                    </span>
                  )}
                  {expense > 0 && (
                    <span className="text-[9px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/30 px-1 rounded">
                      -${expense < 1000 ? expense.toFixed(0) : `${(expense / 1000).toFixed(1)}k`}
                    </span>
                  )}
                </div>
              )}

              {overflow > 0 && (
                <span className="text-[9px] text-muted-foreground mt-0.5 block pl-1">
                  +{overflow} more
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Agenda View ───────────────────────────────────────────────────────────────

function AgendaView({ startDate, mealEntries, tasks, calendarEvents, transactions, childColors, showFinancials, onSelectDate }) {
  const days = useMemo(() => Array.from({ length: 60 }, (_, i) => addDays(startOfDay(startDate), i)), [startDate]);

  const hasContent = useCallback((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return mealEntries.some(e => (e.scheduled_date || '').startsWith(dateStr)) ||
      tasks.some(t => taskAppearsOnDay(t, day)) ||
      calendarEvents.some(e => e.event_date === dateStr) ||
      (showFinancials && transactions.some(t => (t.date || '').startsWith(dateStr)));
  }, [mealEntries, tasks, calendarEvents, transactions, showFinancials]);

  const activeDays = useMemo(() => days.filter(hasContent), [days, hasContent]);

  if (activeDays.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
        <CalendarDays className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-medium">Nothing scheduled in the next 60 days</p>
        <p className="text-sm mt-1">Click a day on the calendar or add meals and events to get started</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {activeDays.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayMeals = mealEntries.filter(e => (e.scheduled_date || '').startsWith(dateStr));
        const dayTasks = tasks.filter(t => taskAppearsOnDay(t, day));
        const dayEvents = calendarEvents.filter(e => e.event_date === dateStr);
        const dayTxns = showFinancials ? transactions.filter(t => (t.date || '').startsWith(dateStr)) : [];

        return (
          <div
            key={dateStr}
            className="flex gap-4 px-4 py-3 border-b hover:bg-muted/30 cursor-pointer transition-colors"
            onClick={() => onSelectDate(day)}
          >
            <div className="shrink-0 w-12 text-center pt-0.5">
              <p className="text-xs text-muted-foreground uppercase font-medium">{format(day, 'EEE')}</p>
              <p className={cn(
                'text-xl font-bold w-9 h-9 flex items-center justify-center rounded-full mx-auto',
                isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground'
              )}>
                {format(day, 'd')}
              </p>
              <p className="text-[10px] text-muted-foreground">{format(day, 'MMM')}</p>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5 pt-1">
              {dayMeals.map(meal => (
                <div key={meal.id} className="flex items-center gap-2 text-sm">
                  <span>{getMealIcon(meal.meal_type)}</span>
                  <span className="text-foreground font-medium">
                    {meal.meal_recipes?.name || meal.custom_meal_name}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{meal.meal_type}</span>
                </div>
              ))}
              {dayTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: childColors[task.assigned_to_child_id] || '#3b82f6' }}
                  />
                  <span className="text-foreground truncate">{task.title}</span>
                </div>
              ))}
              {dayEvents.map(event => (
                <div key={event.id} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: event.color || '#10b981' }} />
                  <span className="text-foreground truncate">{event.title}</span>
                  {!event.all_day && event.start_time && (
                    <span className="text-xs text-muted-foreground shrink-0">{event.start_time}</span>
                  )}
                </div>
              ))}
              {dayTxns.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {dayTxns.length} transaction{dayTxns.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Calendar Page ────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState('month');
  const [activeChildFilters, setActiveChildFilters] = useState([]);
  const [weekPlannerOpen, setWeekPlannerOpen] = useState(false);
  const [weekPlannerStart, setWeekPlannerStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [activeTab, setActiveTab] = useState('calendar');

  const profileId = activeProfile?.id;

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: preferences } = useQuery({
    queryKey: ['calendarPreferences', profileId],
    queryFn: () => calendarPreferencesAPI.getPreferences(profileId),
    enabled: !!profileId,
    staleTime: 60000,
  });

  const showFinancials = preferences?.show_financials !== false;

  const monthRange = useMemo(() => ({
    start: format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd'),
    end: format(endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd'),
  }), [currentMonth]);

  const { data: childProfiles = [] } = useQuery({
    queryKey: ['childProfiles', profileId],
    queryFn: () => childProfilesAPI.getChildProfiles(profileId),
    enabled: !!profileId,
    staleTime: 60000,
  });

  const { data: mealEntries = [] } = useQuery({
    queryKey: ['mealPlanEntries', profileId, monthRange.start, monthRange.end],
    queryFn: () => mealPlanEntriesAPI.getEntriesForRange(profileId, monthRange.start, monthRange.end),
    enabled: !!profileId,
    staleTime: 30000,
  });

  const weekPlannerRange = useMemo(() => ({
    start: format(weekPlannerStart, 'yyyy-MM-dd'),
    end: format(addDays(weekPlannerStart, 6), 'yyyy-MM-dd'),
  }), [weekPlannerStart]);

  const { data: weekMealEntries = [] } = useQuery({
    queryKey: ['mealPlanEntries', profileId, weekPlannerRange.start, weekPlannerRange.end],
    queryFn: () => mealPlanEntriesAPI.getEntriesForRange(profileId, weekPlannerRange.start, weekPlannerRange.end),
    enabled: !!profileId && weekPlannerOpen,
    staleTime: 30000,
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ['mealRecipes', profileId],
    queryFn: () => mealRecipesAPI.getRecipes(profileId),
    enabled: !!profileId,
    staleTime: 60000,
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendarEvents', profileId, monthRange.start, monthRange.end],
    queryFn: () => calendarEventsAPI.getEventsForRange(profileId, monthRange.start, monthRange.end),
    enabled: !!profileId,
    staleTime: 30000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', profileId],
    queryFn: () => tasksAPI.getTasks(profileId),
    enabled: !!profileId,
    staleTime: 30000,
  });

  const { data: allCompletions = [] } = useQuery({
    queryKey: ['taskCompletionsPending', profileId],
    queryFn: async () => {
      if (!profileId || childProfiles.length === 0) return [];
      const results = await Promise.all(
        childProfiles.map(c => taskCompletionsAPI.getCompletions(c.id, { status: 'pending' }))
      );
      return results.flat();
    },
    enabled: !!profileId && childProfiles.length > 0,
    staleTime: 30000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', profileId, 'calendar', monthRange.start, monthRange.end],
    queryFn: async () => {
      if (!profileId || !showFinancials) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('id, date, amount, type, status, description, notes')
        .eq('profile_id', profileId)
        .gte('date', monthRange.start)
        .lte('date', monthRange.end)
        .order('date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId,
    staleTime: 30000,
  });

  const childColors = useMemo(() => {
    const existing = preferences?.child_colors || {};
    if (Object.keys(existing).length > 0) return existing;
    return calendarPreferencesAPI.assignColorsToChildren(childProfiles, {});
  }, [preferences?.child_colors, childProfiles]);

  const monthStats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income' && t.status === 'posted')
      .reduce((s, t) => s + (t.amount || 0), 0);
    const expense = transactions.filter(t => t.type === 'expense' && t.status === 'posted')
      .reduce((s, t) => s + (t.amount || 0), 0);
    const pending = allCompletions.filter(c => c.status === 'pending').length;
    return { income, expense, net: income - expense, pending };
  }, [transactions, allCompletions]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidateMeals = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mealPlanEntries', profileId] });
  }, [queryClient, profileId]);

  const addMealEntry = useMutation({
    mutationFn: (data) => mealPlanEntriesAPI.createEntry(profileId, data),
    onSuccess: invalidateMeals,
    onError: () => toast.error('Failed to add meal'),
  });

  const updateMealEntry = useMutation({
    mutationFn: ({ id, data }) => mealPlanEntriesAPI.updateEntry(id, data),
    onSuccess: invalidateMeals,
    onError: () => toast.error('Failed to update meal'),
  });

  const removeMealEntry = useMutation({
    mutationFn: (id) => mealPlanEntriesAPI.deleteEntry(id),
    onSuccess: invalidateMeals,
    onError: () => toast.error('Failed to remove meal'),
  });

  const createRecipe = useMutation({
    mutationFn: (data) => mealRecipesAPI.createRecipe(profileId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealRecipes', profileId] });
      toast.success('Recipe added');
    },
    onError: () => toast.error('Failed to add recipe'),
  });

  const updateRecipe = useMutation({
    mutationFn: ({ id, data }) => mealRecipesAPI.updateRecipe(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mealRecipes', profileId] }),
    onError: () => toast.error('Failed to update recipe'),
  });

  const deleteRecipe = useMutation({
    mutationFn: (id) => mealRecipesAPI.deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealRecipes', profileId] });
      toast.success('Recipe removed');
    },
    onError: () => toast.error('Failed to delete recipe'),
  });

  const createEvent = useMutation({
    mutationFn: (data) => calendarEventsAPI.createEvent(profileId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents', profileId] });
      toast.success('Event added');
    },
    onError: () => toast.error('Failed to add event'),
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, data }) => calendarEventsAPI.updateEvent(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendarEvents', profileId] }),
    onError: () => toast.error('Failed to update event'),
  });

  const deleteEvent = useMutation({
    mutationFn: (id) => calendarEventsAPI.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents', profileId] });
      toast.success('Event deleted');
    },
    onError: () => toast.error('Failed to delete event'),
  });

  const approveTask = useMutation({
    mutationFn: async (completionId) => {
      const { error } = await supabase
        .from('task_completions')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', completionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskCompletionsPending', profileId] });
      toast.success('Task approved');
    },
    onError: () => toast.error('Failed to approve task'),
  });

  const rejectTask = useMutation({
    mutationFn: async (completionId) => {
      const { error } = await supabase
        .from('task_completions')
        .update({ status: 'rejected' })
        .eq('id', completionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskCompletionsPending', profileId] });
      toast.success('Task rejected');
    },
    onError: () => toast.error('Failed to reject task'),
  });

  const savePreference = useCallback(async (updates) => {
    if (!profileId) return;
    try {
      await calendarPreferencesAPI.upsertPreferences(profileId, updates);
      queryClient.invalidateQueries({ queryKey: ['calendarPreferences', profileId] });
    } catch (e) {
      toast.error('Failed to save preference');
    }
  }, [profileId, queryClient]);

  const handleChildFilterToggle = (childId) => {
    setActiveChildFilters(prev =>
      prev.includes(childId) ? prev.filter(id => id !== childId) : [...prev, childId]
    );
  };

  const handleChildColorChange = async (childId, newColor) => {
    const updated = { ...childColors, [childId]: newColor };
    await savePreference({ child_colors: updated });
  };

  const COLOR_SWATCHES = ['#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#64748b'];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b bg-background">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {activeTab === 'calendar' && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-base font-semibold min-w-[140px] text-center select-none">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <Button variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs"
                  onClick={() => setCurrentMonth(new Date())}>
                  Today
                </Button>
              </>
            )}
            {activeTab === 'meals' && (
              <h2 className="text-base font-semibold">Recipe Library</h2>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'calendar' && (
              <>
                {showFinancials && (monthStats.income > 0 || monthStats.expense > 0) && (
                  <div className="hidden md:flex items-center gap-3 text-xs border rounded-lg px-3 py-1.5 bg-muted/30 mr-1">
                    <span className="text-green-600 font-semibold">+${monthStats.income.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-red-500 font-semibold">-${monthStats.expense.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className={cn('font-semibold', monthStats.net >= 0 ? 'text-green-600' : 'text-red-500')}>
                      {monthStats.net >= 0 ? '+' : ''}${monthStats.net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}

                {monthStats.pending > 0 && (
                  <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-xs cursor-default">
                    {monthStats.pending} pending approval
                  </Badge>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs hidden sm:flex"
                  onClick={() => {
                    setWeekPlannerStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
                    setWeekPlannerOpen(true);
                  }}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  Plan Week
                </Button>

                <div className="flex border rounded-lg overflow-hidden">
                  <Button
                    variant={view === 'month' ? 'default' : 'ghost'}
                    size="icon"
                    className="h-8 w-8 rounded-none"
                    onClick={() => setView('month')}
                    title="Month view"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={view === 'agenda' ? 'default' : 'ghost'}
                    size="icon"
                    className="h-8 w-8 rounded-none border-l"
                    onClick={() => setView('agenda')}
                    title="Agenda view"
                  >
                    <List className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-3">Calendar Settings</h4>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-fin" className="text-sm cursor-pointer">Show financial info</Label>
                      <Switch
                        id="show-fin"
                        checked={showFinancials}
                        onCheckedChange={(val) => savePreference({ show_financials: val })}
                      />
                    </div>
                  </div>

                  {childProfiles.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold text-sm mb-2.5">Child Colors</h4>
                        <div className="space-y-2.5">
                          {childProfiles.map(child => (
                            <div key={child.id} className="flex items-center justify-between gap-2">
                              <span className="text-sm flex-1 truncate">{child.child_name || child.display_name}</span>
                              <div className="flex gap-1">
                                {COLOR_SWATCHES.map(c => (
                                  <button
                                    key={c}
                                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none"
                                    style={{
                                      backgroundColor: c,
                                      borderColor: childColors[child.id] === c ? 'currentColor' : 'transparent',
                                      outlineOffset: '2px',
                                    }}
                                    onClick={() => handleChildColorChange(child.id, c)}
                                    title={c}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Child filter chips */}
        {activeTab === 'calendar' && childProfiles.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-0.5">Filter:</span>
            <button
              onClick={() => setActiveChildFilters([])}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors',
                activeChildFilters.length === 0
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              )}
            >
              All
            </button>
            {childProfiles.map(child => {
              const color = childColors[child.id] || '#3b82f6';
              const isActive = activeChildFilters.includes(child.id);
              return (
                <button
                  key={child.id}
                  onClick={() => handleChildFilterToggle(child.id)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition-all"
                  style={{
                    backgroundColor: isActive ? color : 'transparent',
                    borderColor: color,
                    color: isActive ? '#fff' : color,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.5)' : color }}
                  />
                  {child.child_name || child.display_name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b px-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('calendar')}
              className={cn(
                'flex items-center gap-1.5 text-sm py-2.5 border-b-2 transition-colors font-medium',
                activeTab === 'calendar'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Calendar
            </button>
            <button
              onClick={() => setActiveTab('meals')}
              className={cn(
                'flex items-center gap-1.5 text-sm py-2.5 border-b-2 transition-colors font-medium',
                activeTab === 'meals'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <ChefHat className="w-3.5 h-3.5" />
              Meals
            </button>
          </div>
        </div>

        {activeTab === 'calendar' && (
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
              {view === 'month' ? (
                <MonthGrid
                  currentMonth={currentMonth}
                  selectedDate={selectedDate}
                  onSelectDate={(day) => setSelectedDate(day)}
                  mealEntries={mealEntries}
                  tasks={tasks}
                  taskCompletions={allCompletions}
                  calendarEvents={calendarEvents}
                  transactions={transactions}
                  childColors={childColors}
                  activeChildFilters={activeChildFilters}
                  showFinancials={showFinancials}
                />
              ) : (
                <AgendaView
                  startDate={new Date()}
                  mealEntries={mealEntries}
                  tasks={tasks}
                  calendarEvents={calendarEvents}
                  transactions={transactions}
                  childColors={childColors}
                  showFinancials={showFinancials}
                  onSelectDate={(day) => {
                    setSelectedDate(day);
                    setCurrentMonth(day);
                    setView('month');
                  }}
                />
              )}
            </div>

            {selectedDate && (
              <div className="w-72 lg:w-80 shrink-0 overflow-hidden flex flex-col border-l">
                <DayDetailPanel
                  selectedDate={selectedDate}
                  onClose={() => setSelectedDate(null)}
                  mealEntries={mealEntries}
                  tasks={selectedDate ? tasks.filter(t => taskAppearsOnDay(t, selectedDate)) : []}
                  taskCompletions={allCompletions}
                  calendarEvents={calendarEvents}
                  transactions={transactions}
                  recipes={recipes}
                  childProfiles={childProfiles}
                  childColors={childColors}
                  showFinancials={showFinancials}
                  onAddMealEntry={(data) => addMealEntry.mutateAsync(data)}
                  onUpdateMealEntry={(id, data) => updateMealEntry.mutateAsync({ id, data })}
                  onRemoveMealEntry={(id) => removeMealEntry.mutateAsync(id)}
                  onCreateRecipe={(data) => createRecipe.mutateAsync(data)}
                  onApproveTask={(id) => approveTask.mutateAsync(id)}
                  onRejectTask={(id) => rejectTask.mutateAsync(id)}
                  onCreateEvent={(data) => createEvent.mutateAsync(data)}
                  onUpdateEvent={(id, data) => updateEvent.mutateAsync({ id, data })}
                  onDeleteEvent={(id) => deleteEvent.mutateAsync(id)}
                  onOpenTaskDialog={(date) => navigate(`/Dashboard`)}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'meals' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <RecipeLibrary
              recipes={recipes}
              onCreateRecipe={(data) => createRecipe.mutateAsync(data)}
              onUpdateRecipe={(id, data) => updateRecipe.mutateAsync({ id, data })}
              onDeleteRecipe={(id) => deleteRecipe.mutateAsync(id)}
            />
          </div>
        )}
      </div>

      <WeekMealPlanner
        open={weekPlannerOpen}
        onOpenChange={setWeekPlannerOpen}
        weekStart={weekPlannerStart}
        onWeekChange={setWeekPlannerStart}
        mealEntries={weekMealEntries}
        recipes={recipes}
        onAddEntry={(data) => addMealEntry.mutateAsync(data)}
        onUpdateEntry={(id, data) => updateMealEntry.mutateAsync({ id, data })}
        onRemoveEntry={(id) => removeMealEntry.mutateAsync(id)}
        onCreateRecipe={(data) => createRecipe.mutateAsync(data)}
      />
    </div>
  );
}
