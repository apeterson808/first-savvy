import React, { useState } from 'react';
import {
  ChefHat, CheckSquare, CalendarDays, DollarSign, Plus, X,
  Check, Clock, Star, ChevronRight, Pencil, Trash2,
  ArrowUpRight, ArrowDownRight, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, parseISO, isSameDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/pages/utils';
import MealPickerPanel from './MealPickerPanel';
import EventDialog from './EventDialog';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_TYPE_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

function getMealDisplay(entries, mealType) {
  return entries.filter(e => e.meal_type === mealType);
}

function ChildTaskRow({ child, tasks, childColor, taskCompletions, onApproveTask, onRejectTask }) {
  const [open, setOpen] = useState(false);

  const incomplete = tasks.filter(t => {
    const completion = taskCompletions.find(c => c.task_id === t.id && c.status === 'pending');
    return !completion && t.status !== 'completed';
  }).length;
  const pending = tasks.filter(t =>
    taskCompletions.find(c => c.task_id === t.id && c.status === 'pending')
  ).length;

  const initials = (child?.child_name || child?.display_name || '?').charAt(0).toUpperCase();
  const name = child?.child_name || child?.display_name || 'Child';

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ backgroundColor: childColor }}
        >
          {child?.avatar_url ? (
            <img src={child.avatar_url} alt={name} className="w-8 h-8 rounded-full object-cover" />
          ) : initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            {incomplete > 0 ? `${incomplete} task${incomplete > 1 ? 's' : ''} remaining` : 'All done'}
            {pending > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-600 font-medium">
                <Clock className="w-3 h-3" />{pending} pending
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-semibold tabular-nums w-4 text-center text-muted-foreground">{tasks.length}</span>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="border-t divide-y">
          {tasks.map(task => {
            const completion = taskCompletions.find(c => c.task_id === task.id && c.status === 'pending');
            const done = task.status === 'completed';
            return (
              <div key={task.id} className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: childColor }} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm truncate', done && 'line-through text-muted-foreground')}>{task.title}</p>
                  {task.star_reward > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                      <Star className="w-3 h-3 fill-amber-500" />{task.star_reward}
                    </span>
                  )}
                </div>
                {completion ? (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" className="h-6 w-6 bg-green-500 hover:bg-green-600" onClick={() => onApproveTask(completion.id)}>
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-6 w-6 border-red-300 text-red-500 hover:bg-red-50" onClick={() => onRejectTask(completion.id)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Badge variant="outline" className={cn('text-xs shrink-0', done && 'border-green-300 text-green-600')}>
                    {done ? 'Done' : task.status === 'in_progress' ? 'Active' : task.status}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TasksByChildSection({ tasks, taskCompletions, childProfiles, childColors, onApproveTask, onRejectTask }) {
  const grouped = tasks.reduce((acc, task) => {
    const id = task.assigned_to_child_id || 'unassigned';
    if (!acc[id]) acc[id] = [];
    acc[id].push(task);
    return acc;
  }, {});

  return (
    <section>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-2">
        <CheckSquare className="w-4 h-4 text-blue-500" />
        Tasks
      </div>
      <div className="space-y-2">
        {Object.entries(grouped).map(([childId, childTasks]) => {
          const child = childProfiles.find(c => c.id === childId);
          const color = childColors[childId] || '#3b82f6';
          return (
            <ChildTaskRow
              key={childId}
              child={child}
              tasks={childTasks}
              childColor={color}
              taskCompletions={taskCompletions}
              onApproveTask={onApproveTask}
              onRejectTask={onRejectTask}
            />
          );
        })}
      </div>
    </section>
  );
}

export default function DayDetailPanel({
  selectedDate,
  onClose,
  mealEntries = [],
  tasks = [],
  taskCompletions = [],
  calendarEvents = [],
  transactions = [],
  recipes = [],
  childProfiles = [],
  childColors = {},
  showFinancials = true,
  onAddMealEntry,
  onUpdateMealEntry,
  onRemoveMealEntry,
  onCreateRecipe,
  onApproveTask,
  onRejectTask,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onOpenTaskDialog,
  hideHeader = false,
}) {
  const navigate = useNavigate();
  const [mealPickerState, setMealPickerState] = useState(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  if (!selectedDate) return null;

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const dayMeals = mealEntries.filter(e => {
    const d = typeof e.scheduled_date === 'string' ? parseISO(e.scheduled_date) : e.scheduled_date;
    return isSameDay(d, selectedDate);
  });

  const dayTasks = tasks; // already filtered by caller to match this day

  const dayEvents = calendarEvents.filter(e => e.event_date === dateStr);

  const dayTransactions = transactions.filter(t => t.date === dateStr || t.date?.startsWith(dateStr));

  const dayIncome = dayTransactions.filter(t => t.type === 'income' && t.status === 'posted');
  const dayExpenses = dayTransactions.filter(t => t.type === 'expense' && t.status === 'posted');

  const getCompletionForTask = (taskId) =>
    taskCompletions.find(c => c.task_id === taskId && c.status === 'pending');

  const getChildName = (childId) => {
    const child = childProfiles.find(c => c.id === childId);
    return child?.child_name || child?.display_name || 'Child';
  };

  const getChildColor = (childId) => childColors[childId] || '#3b82f6';

  const handleMealSelect = async (mealType, mealData) => {
    const existing = dayMeals.find(e => e.meal_type === mealType);
    const payload = {
      scheduled_date: dateStr,
      meal_type: mealType,
      recipe_id: mealData.recipe_id || null,
      custom_meal_name: mealData.custom_meal_name || '',
    };
    if (existing) {
      await onUpdateMealEntry(existing.id, payload);
    } else {
      await onAddMealEntry(payload);
    }
    setMealPickerState(null);
  };

  return (
    <div className="flex flex-col bg-background">
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {format(selectedDate, 'EEEE')}
            </p>
            <h3 className="font-semibold text-base">{format(selectedDate, 'MMMM d, yyyy')}</h3>
          </div>
        </div>
      )}

      {mealPickerState ? (
        <MealPickerPanel
          date={selectedDate}
          mealType={mealPickerState}
          recipes={recipes}
          existingEntry={dayMeals.find(e => e.meal_type === mealPickerState)}
          onSelect={(data) => handleMealSelect(mealPickerState, data)}
          onCustom={(data) => handleMealSelect(mealPickerState, data)}
          onRemove={async (id) => { await onRemoveMealEntry(id); setMealPickerState(null); }}
          onClose={() => setMealPickerState(null)}
          onAddRecipe={() => {/* handled in parent */}}
        />
      ) : (
        <div>
          <div className="px-4 py-3 space-y-5">

            {/* Meals */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ChefHat className="w-4 h-4 text-amber-500" />
                  Meals
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MEAL_TYPES.filter(t => t !== 'snack').map(mealType => {
                  const entry = dayMeals.find(e => e.meal_type === mealType);
                  const mealName = entry?.meal_recipes?.name || entry?.custom_meal_name;
                  return (
                    <button
                      key={mealType}
                      onClick={() => setMealPickerState(mealType)}
                      className="flex flex-col items-start gap-1 p-2.5 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                    >
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        {MEAL_TYPE_LABELS[mealType]}
                      </span>
                      {mealName ? (
                        <span className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{mealName}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">Not planned</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Tasks grouped by child */}
            {dayTasks.length > 0 && (
              <TasksByChildSection
                tasks={dayTasks}
                taskCompletions={taskCompletions}
                childProfiles={childProfiles}
                childColors={childColors}
                onApproveTask={onApproveTask}
                onRejectTask={onRejectTask}
              />
            )}

            {/* Calendar Events */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <CalendarDays className="w-4 h-4 text-emerald-500" />
                  Events
                  {dayEvents.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-5">{dayEvents.length}</Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>
              {dayEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-1">No events</p>
              ) : (
                <div className="space-y-1.5">
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border group hover:border-primary/40 transition-colors"
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: event.color || '#3b82f6' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        {!event.all_day && event.start_time && (
                          <p className="text-xs text-muted-foreground">{event.start_time}{event.end_time ? ` – ${event.end_time}` : ''}</p>
                        )}
                        {event.child_profiles && (
                          <p className="text-xs text-muted-foreground">
                            {event.child_profiles.child_name || event.child_profiles.display_name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => { setEditingEvent(event); setEventDialogOpen(true); }}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => onDeleteEvent(event.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Financial */}
            {showFinancials && (dayIncome.length > 0 || dayExpenses.length > 0) && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <DollarSign className="w-4 h-4 text-slate-500" />
                    Transactions
                    <Badge variant="secondary" className="text-xs h-5">
                      {dayIncome.length + dayExpenses.length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => navigate(`${createPageUrl('Banking')}?tab=transactions&date=${dateStr}`)}
                  >
                    View all
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {[...dayIncome, ...dayExpenses].slice(0, 5).map(txn => (
                    <div key={txn.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      {txn.type === 'income' ? (
                        <ArrowUpRight className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <p className="flex-1 text-xs truncate text-foreground/80">{txn.description || txn.notes || 'Transaction'}</p>
                      <span className={cn(
                        'text-xs font-semibold shrink-0',
                        txn.type === 'income' ? 'text-green-600' : 'text-red-500'
                      )}>
                        {txn.type === 'income' ? '+' : '-'}${Math.abs(txn.amount || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {dayIncome.length + dayExpenses.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{dayIncome.length + dayExpenses.length - 5} more
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Add Task shortcut */}
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed text-muted-foreground hover:text-foreground gap-1.5"
                onClick={() => onOpenTaskDialog(selectedDate)}
              >
                <Plus className="w-3.5 h-3.5" />
                Add task for this day
              </Button>
            </div>
          </div>
        </div>
      )}

      <EventDialog
        open={eventDialogOpen}
        onOpenChange={(open) => { setEventDialogOpen(open); if (!open) setEditingEvent(null); }}
        event={editingEvent}
        defaultDate={selectedDate}
        childProfiles={childProfiles}
        onSave={async (data) => {
          if (editingEvent) {
            await onUpdateEvent(editingEvent.id, data);
          } else {
            await onCreateEvent(data);
          }
        }}
      />
    </div>
  );
}
