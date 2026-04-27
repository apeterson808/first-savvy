import React, { useState } from 'react';
import {
  ChefHat, CheckSquare, CalendarDays, DollarSign, Plus, X,
  Check, Clock, Star, ChevronRight, Pencil, Trash2,
  ArrowUpRight, ArrowDownRight
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

  const dayTasks = tasks.filter(t => t.due_date === dateStr);

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
    <div className="flex flex-col h-full bg-background border-l">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {format(selectedDate, 'EEEE')}
          </p>
          <h3 className="font-semibold text-base">{format(selectedDate, 'MMMM d, yyyy')}</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

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
        <ScrollArea className="flex-1">
          <div className="px-4 py-3 space-y-5">

            {/* Meals */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ChefHat className="w-4 h-4 text-amber-500" />
                  Meals
                </div>
              </div>
              <div className="space-y-1.5">
                {MEAL_TYPES.filter(t => t !== 'snack').map(mealType => {
                  const entry = dayMeals.find(e => e.meal_type === mealType);
                  const mealName = entry?.meal_recipes?.name || entry?.custom_meal_name;
                  return (
                    <button
                      key={mealType}
                      onClick={() => setMealPickerState(mealType)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                    >
                      <span className="text-xs text-muted-foreground font-medium w-16 shrink-0 uppercase tracking-wide">
                        {MEAL_TYPE_LABELS[mealType]}
                      </span>
                      {mealName ? (
                        <span className="flex-1 text-sm font-medium text-foreground truncate">{mealName}</span>
                      ) : (
                        <span className="flex-1 text-sm text-muted-foreground/60 italic">Not planned</span>
                      )}
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Tasks */}
            {dayTasks.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <CheckSquare className="w-4 h-4 text-blue-500" />
                    Tasks
                    <Badge variant="secondary" className="text-xs h-5">{dayTasks.length}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  {dayTasks.map(task => {
                    const completion = getCompletionForTask(task.id);
                    const childColor = getChildColor(task.assigned_to_child_id);
                    return (
                      <div
                        key={task.id}
                        className="p-2.5 rounded-lg border-l-4 bg-muted/30"
                        style={{ borderLeftColor: childColor }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {getChildName(task.assigned_to_child_id)}
                              {task.star_reward > 0 && (
                                <span className="ml-2 inline-flex items-center gap-0.5 text-amber-600 font-medium">
                                  <Star className="w-3 h-3 fill-amber-500" />
                                  {task.star_reward}
                                </span>
                              )}
                            </p>
                          </div>
                          {completion ? (
                            <div className="flex gap-1 shrink-0">
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                              <Button
                                size="icon"
                                className="h-6 w-6 bg-green-500 hover:bg-green-600"
                                onClick={() => onApproveTask(completion.id)}
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6 border-red-300 text-red-500 hover:bg-red-50"
                                onClick={() => onRejectTask(completion.id)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs shrink-0',
                                task.status === 'completed' ? 'border-green-300 text-green-600' : ''
                              )}
                            >
                              {task.status === 'in_progress' ? 'Active' : task.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
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
        </ScrollArea>
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
