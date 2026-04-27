import React, { useState } from 'react';
import { Search, ChefHat, Plus, Clock, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

const MEAL_TYPE_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const CATEGORY_COLORS = {
  breakfast: 'bg-amber-100 text-amber-700',
  lunch: 'bg-sky-100 text-sky-700',
  dinner: 'bg-slate-100 text-slate-700',
  snack: 'bg-green-100 text-green-700',
};

export default function MealPickerPanel({
  date,
  mealType,
  recipes = [],
  existingEntry,
  onSelect,
  onCustom,
  onRemove,
  onClose,
  onAddRecipe,
}) {
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const filtered = recipes.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = r.category === mealType || r.category === 'snack';
    return matchesSearch && (search ? matchesSearch : matchesType);
  });

  const handleSelectRecipe = (recipe) => {
    onSelect({ recipe_id: recipe.id, custom_meal_name: '', recipe });
  };

  const handleCustomSubmit = () => {
    if (customName.trim()) {
      onCustom({ recipe_id: null, custom_meal_name: customName.trim() });
      setCustomName('');
      setShowCustom(false);
    }
  };

  const dateLabel = date instanceof Date ? format(date, 'EEE, MMM d') : format(parseISO(date), 'EEE, MMM d');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {MEAL_TYPE_LABELS[mealType]} · {dateLabel}
          </p>
          <h3 className="font-semibold text-base">Pick a Meal</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {existingEntry && (
        <div className="mx-4 mt-3 p-2.5 rounded-lg bg-muted/50 border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Currently planned</p>
              <p className="text-sm font-medium">
                {existingEntry.meal_recipes?.name || existingEntry.custom_meal_name}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-7 text-xs"
            onClick={() => onRemove(existingEntry.id)}
          >
            Remove
          </Button>
        </div>
      )}

      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search meals..."
            className="pl-9 h-9"
            autoFocus
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        {filtered.length === 0 && !showCustom && (
          <div className="text-center py-8 text-muted-foreground">
            <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {search ? 'No meals match your search' : `No ${MEAL_TYPE_LABELS[mealType].toLowerCase()} recipes yet`}
            </p>
          </div>
        )}

        <div className="space-y-1.5 pb-3">
          {filtered.map(recipe => (
            <button
              key={recipe.id}
              onClick={() => handleSelectRecipe(recipe)}
              className={cn(
                'w-full text-left p-3 rounded-lg border transition-all hover:border-primary hover:bg-primary/5 group',
                existingEntry?.recipe_id === recipe.id
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent bg-muted/30'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{recipe.name}</p>
                  {recipe.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{recipe.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', CATEGORY_COLORS[recipe.category])}>
                      {recipe.category}
                    </span>
                    {recipe.prep_time_minutes > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {recipe.prep_time_minutes}m
                      </span>
                    )}
                    {recipe.tags?.slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs text-muted-foreground">· {tag}</span>
                    ))}
                  </div>
                </div>
                {recipe.ingredients?.length > 0 && (
                  <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                    {recipe.ingredients.length} ingredients
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      <div className="px-4 pb-4 pt-2 border-t space-y-2">
        {showCustom ? (
          <div className="flex gap-2">
            <Input
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Type a meal name..."
              className="flex-1 h-9 text-sm"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
            />
            <Button size="sm" onClick={handleCustomSubmit} disabled={!customName.trim()}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowCustom(false); setCustomName(''); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-dashed text-sm h-9"
              onClick={() => setShowCustom(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Custom meal name
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-dashed text-sm h-9"
              onClick={onAddRecipe}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New recipe
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
