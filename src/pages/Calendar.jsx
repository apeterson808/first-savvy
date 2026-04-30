import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useProfile } from '@/contexts/ProfileContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, CalendarDays,
  ChefHat, Check, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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
    <div>
      <div className="grid grid-cols-7 border-b bg-background z-10">
        {DOW.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {allDays.map((day, idx) => {
          const { dayMeals, dayTasks, pendingCount, dayEvents } = getDayData(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const todayDay = isToday(day);

          // Collect up to 4 indicator dots
          const taskDots = dayTasks.slice(0, 4).map(t => childColors[t.assigned_to_child_id] || '#3b82f6');
          const remaining = 4 - taskDots.length;
          const eventDots = dayEvents.slice(0, remaining).map(e => e.color || '#10b981');
          const mealDot = dayMeals.length > 0 && taskDots.length + eventDots.length < 4 ? ['#f59e0b'] : [];
          const dots = [...taskDots, ...eventDots, ...mealDot].slice(0, 4);

          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                'border-b border-r cursor-pointer transition-colors select-none flex flex-col items-center py-2 gap-1 min-h-[64px]',
                isCurrentMonth ? 'bg-background hover:bg-muted/40 active:bg-muted/60' : 'bg-muted/10 hover:bg-muted/20',
                isSelected ? 'ring-2 ring-inset ring-primary bg-primary/5' : '',
                idx % 7 === 0 ? 'border-l' : ''
              )}
            >
              <span className={cn(
                'text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors',
                todayDay ? 'bg-primary text-primary-foreground' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/30'
              )}>
                {format(day, 'd')}
              </span>
              <div className="flex gap-0.5 h-2 items-center flex-wrap justify-center max-w-[28px]">
                {dots.map((color, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                ))}
                {pendingCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                )}
              </div>
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
  const location = useLocation();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = location.state?.selectedDate;
    if (d) { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = location.state?.selectedDate;
    if (d) { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); }
    return null;
  });
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

  const handleDaySelect = (day) => {
    setSelectedDate(day);
    setCurrentMonth(day);
  };

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Header ── */}
      <div className="shrink-0 bg-background border-b">
        {/* Top row: tabs */}
        <div className="flex items-center gap-1 px-4 border-b">
          <button
            onClick={() => setActiveTab('calendar')}
            className={cn(
              'flex items-center gap-1.5 text-sm py-2.5 border-b-2 transition-colors font-medium mr-2',
              activeTab === 'calendar' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Calendar
          </button>
          <button
            onClick={() => setActiveTab('meals')}
            className={cn(
              'flex items-center gap-1.5 text-sm py-2.5 border-b-2 transition-colors font-medium',
              activeTab === 'meals' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <ChefHat className="w-3.5 h-3.5" />
            Meals
          </button>
        </div>

        {/* Calendar controls row — only shown on Calendar tab */}
        {activeTab === 'calendar' && (
          <div className="flex items-center justify-center gap-2 px-3 py-2">
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r"
                onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-semibold px-3 select-none whitespace-nowrap">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-l"
                onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs px-2.5 shrink-0"
              onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>
            {monthStats.pending > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-xs shrink-0 h-6 px-1.5">
                {monthStats.pending}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col">

        {/* Calendar tab */}
        {activeTab === 'calendar' && (
          <>
            <MonthGrid
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              onSelectDate={(day) => {
                if (selectedDate && isSameDay(day, selectedDate)) {
                  setSelectedDate(null);
                } else {
                  handleDaySelect(day);
                }
              }}
              mealEntries={mealEntries}
              tasks={tasks}
              taskCompletions={allCompletions}
              calendarEvents={calendarEvents}
              transactions={transactions}
              childColors={childColors}
              activeChildFilters={activeChildFilters}
              showFinancials={showFinancials}
            />

            {/* Day detail panel — flows below the grid */}
            {selectedDate && (
              <div className="border-t flex flex-col">
                {/* Day detail mini-header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium leading-none mb-0.5">
                      {format(selectedDate, 'EEEE')}
                    </p>
                    <p className="text-sm font-semibold leading-none">
                      {format(selectedDate, 'MMMM d, yyyy')}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedDate(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <DayDetailPanel
                  selectedDate={selectedDate}
                  onClose={() => setSelectedDate(null)}
                  mealEntries={mealEntries}
                  tasks={tasks.filter(t => taskAppearsOnDay(t, selectedDate))}
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
                  onOpenTaskDialog={() => navigate('/Dashboard')}
                  hideHeader
                />
              </div>
            )}
          </>
        )}

        {/* Meals tab */}
        {activeTab === 'meals' && (
          <div className="p-4">
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
