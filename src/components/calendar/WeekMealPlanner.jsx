import React, { useState } from 'react';
import { ChefHat, ShoppingCart, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import MealPickerPanel from './MealPickerPanel';
import RecipeDialog from './RecipeDialog';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];
const MEAL_TYPE_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

const MEAL_SLOT_STYLES = {
  breakfast: 'border-amber-200 hover:border-amber-400',
  lunch: 'border-sky-200 hover:border-sky-400',
  dinner: 'border-slate-200 hover:border-slate-400',
};

function buildShoppingList(mealEntries) {
  const ingredientMap = {};

  mealEntries.forEach(entry => {
    const ingredients = entry.meal_recipes?.ingredients || [];
    ingredients.forEach(ing => {
      if (!ing.name) return;
      const key = ing.name.toLowerCase();
      if (ingredientMap[key]) {
        ingredientMap[key].sources.push(entry.meal_recipes.name);
      } else {
        ingredientMap[key] = {
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          sources: [entry.meal_recipes?.name || entry.custom_meal_name],
        };
      }
    });
  });

  return Object.values(ingredientMap);
}

export default function WeekMealPlanner({
  open,
  onOpenChange,
  weekStart,
  onWeekChange,
  mealEntries = [],
  recipes = [],
  onAddEntry,
  onUpdateEntry,
  onRemoveEntry,
  onCreateRecipe,
}) {
  const [pickerState, setPickerState] = useState(null); // { date, mealType }
  const [showShopping, setShowShopping] = useState(false);
  const [showRecipeDialog, setShowRecipeDialog] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getEntry = (date, mealType) => {
    return mealEntries.find(e => {
      const entryDate = e.scheduled_date instanceof Date ? e.scheduled_date : parseISO(e.scheduled_date);
      return isSameDay(entryDate, date) && e.meal_type === mealType;
    });
  };

  const handleSlotClick = (date, mealType) => {
    setPickerState({ date, mealType });
    setShowShopping(false);
  };

  const handleSelectMeal = async (date, mealType, mealData) => {
    const existing = getEntry(date, mealType);
    const payload = {
      scheduled_date: format(date, 'yyyy-MM-dd'),
      meal_type: mealType,
      recipe_id: mealData.recipe_id || null,
      custom_meal_name: mealData.custom_meal_name || '',
    };

    if (existing) {
      await onUpdateEntry(existing.id, payload);
    } else {
      await onAddEntry(payload);
    }
    setPickerState(null);
  };

  const handleRemoveMeal = async (entryId) => {
    await onRemoveEntry(entryId);
    setPickerState(null);
  };

  const shoppingList = buildShoppingList(
    mealEntries.filter(e => e.meal_recipes?.ingredients?.length > 0)
  );

  const hasAnyMeals = mealEntries.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <DialogTitle className="text-lg font-semibold">Weekly Meal Planner</DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {format(weekStart, 'MMM d')} — {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasAnyMeals && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowShopping(true); setPickerState(null); }}
                className="gap-1.5"
              >
                <ShoppingCart className="w-4 h-4" />
                Shopping List
              </Button>
            )}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none border-r"
                onClick={() => onWeekChange(addDays(weekStart, -7))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-none text-xs px-3"
                onClick={() => onWeekChange(startOfWeek(new Date(), { weekStartsOn: 0 }))}
              >
                This Week
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none border-l"
                onClick={() => onWeekChange(addDays(weekStart, 7))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Main grid */}
          <div className={cn('flex-1 overflow-auto p-4', pickerState || showShopping ? 'border-r' : '')}>
            <div className="grid grid-cols-7 gap-2 min-w-[600px]">
              {weekDays.map(day => (
                <div key={day.toISOString()} className="text-center">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                    {format(day, 'EEE')}
                  </p>
                  <p className={cn(
                    'text-sm font-semibold mb-2 w-7 h-7 flex items-center justify-center rounded-full mx-auto',
                    isSameDay(day, new Date()) ? 'bg-primary text-primary-foreground' : 'text-foreground'
                  )}>
                    {format(day, 'd')}
                  </p>
                </div>
              ))}

              {MEAL_TYPES.map(mealType => (
                <React.Fragment key={mealType}>
                  {weekDays.map(day => {
                    const entry = getEntry(day, mealType);
                    const isSelected = pickerState && isSameDay(pickerState.date, day) && pickerState.mealType === mealType;
                    const mealName = entry?.meal_recipes?.name || entry?.custom_meal_name;

                    return (
                      <div key={`${day.toISOString()}-${mealType}`} className="mb-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 font-medium">
                          {MEAL_TYPE_LABELS[mealType]}
                        </p>
                        <button
                          onClick={() => handleSlotClick(day, mealType)}
                          className={cn(
                            'w-full min-h-[64px] rounded-lg border-2 border-dashed p-2 text-left transition-all',
                            MEAL_SLOT_STYLES[mealType],
                            isSelected ? 'border-primary bg-primary/5 border-solid' : '',
                            entry ? 'border-solid bg-muted/30' : 'hover:bg-muted/30'
                          )}
                        >
                          {mealName ? (
                            <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                              {mealName}
                            </p>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-1 opacity-40">
                              <Plus className="w-4 h-4" />
                              <span className="text-[10px]">Add</span>
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Picker sidebar */}
          {pickerState && !showShopping && (
            <div className="w-80 shrink-0 flex flex-col">
              <MealPickerPanel
                date={pickerState.date}
                mealType={pickerState.mealType}
                recipes={recipes}
                existingEntry={getEntry(pickerState.date, pickerState.mealType)}
                onSelect={(mealData) => handleSelectMeal(pickerState.date, pickerState.mealType, mealData)}
                onCustom={(mealData) => handleSelectMeal(pickerState.date, pickerState.mealType, mealData)}
                onRemove={handleRemoveMeal}
                onClose={() => setPickerState(null)}
                onAddRecipe={() => setShowRecipeDialog(true)}
              />
            </div>
          )}

          {/* Shopping list sidebar */}
          {showShopping && (
            <div className="w-80 shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">This Week</p>
                  <h3 className="font-semibold text-base">Shopping List</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowShopping(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                {shoppingList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground px-4">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No ingredients to list yet. Add meals with recipes to see their ingredients here.</p>
                  </div>
                ) : (
                  <div className="px-4 py-3 space-y-1">
                    {shoppingList.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 py-2 border-b border-muted last:border-0">
                        <div className="w-4 h-4 rounded border-2 border-muted-foreground/30 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          {(item.quantity || item.unit) && (
                            <p className="text-xs text-muted-foreground">
                              {[item.quantity, item.unit].filter(Boolean).join(' ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {shoppingList.length > 0 && (
                <div className="px-4 pb-4 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const text = shoppingList.map(i => `${i.name}${i.quantity ? ` - ${i.quantity} ${i.unit || ''}`.trim() : ''}`).join('\n');
                      navigator.clipboard?.writeText(text);
                    }}
                  >
                    Copy to Clipboard
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      <RecipeDialog
        open={showRecipeDialog}
        onOpenChange={setShowRecipeDialog}
        recipe={null}
        onSave={async (data) => {
          await onCreateRecipe(data);
          setShowRecipeDialog(false);
        }}
      />
    </Dialog>
  );
}
