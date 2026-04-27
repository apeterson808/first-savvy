import React, { useState } from 'react';
import { ChefHat, Plus, Clock, Search, Edit2, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import RecipeDialog from './RecipeDialog';

const CATEGORIES = ['all', 'breakfast', 'lunch', 'dinner', 'snack'];
const CATEGORY_COLORS = {
  breakfast: 'bg-amber-100 text-amber-700',
  lunch: 'bg-sky-100 text-sky-700',
  dinner: 'bg-slate-100 text-slate-700',
  snack: 'bg-green-100 text-green-700',
};

export default function RecipeLibrary({ recipes = [], onCreateRecipe, onUpdateRecipe, onDeleteRecipe }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  const filtered = recipes.filter(r => {
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.tags?.some(t => t.includes(search.toLowerCase()));
    const matchesCategory = category === 'all' || r.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleSave = async (data) => {
    if (editingRecipe) {
      await onUpdateRecipe(editingRecipe.id, data);
    } else {
      await onCreateRecipe(data);
    }
    setEditingRecipe(null);
    setShowDialog(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Recipe Library</h2>
          <p className="text-sm text-muted-foreground">{recipes.length} saved meals</p>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingRecipe(null); setShowDialog(true); }}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Recipe
        </Button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recipes..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize',
              category === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
          <ChefHat className="w-12 h-12 mb-3 opacity-30" />
          {recipes.length === 0 ? (
            <>
              <p className="font-medium mb-1">No recipes yet</p>
              <p className="text-sm text-center max-w-xs">
                Add your family's favorite meals to quickly plan your week and generate shopping lists.
              </p>
              <Button
                className="mt-4"
                onClick={() => { setEditingRecipe(null); setShowDialog(true); }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Your First Recipe
              </Button>
            </>
          ) : (
            <p className="text-sm">No recipes match your filter</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pb-4">
          {filtered.map(recipe => (
            <Card key={recipe.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{recipe.name}</h3>
                    {recipe.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{recipe.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setEditingRecipe(recipe); setShowDialog(true); }}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onDeleteRecipe(recipe.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CATEGORY_COLORS[recipe.category])}>
                    {recipe.category}
                  </span>
                  {recipe.prep_time_minutes > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {recipe.prep_time_minutes}m
                    </span>
                  )}
                  {recipe.ingredients?.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {recipe.ingredients.length} ingredients
                    </span>
                  )}
                </div>

                {recipe.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {recipe.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                    {recipe.tags.length > 3 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        +{recipe.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RecipeDialog
        open={showDialog}
        onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingRecipe(null); }}
        recipe={editingRecipe}
        onSave={handleSave}
      />
    </div>
  );
}
