import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const SUGGESTED_TAGS = ['quick', 'vegetarian', 'kids love it', 'healthy', 'easy', 'slow cooker', 'freezer meal'];

export default function RecipeDialog({ open, onOpenChange, recipe, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('dinner');
  const [prepTime, setPrepTime] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [ingredients, setIngredients] = useState([{ name: '', quantity: '', unit: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recipe) {
      setName(recipe.name || '');
      setDescription(recipe.description || '');
      setCategory(recipe.category || 'dinner');
      setPrepTime(recipe.prep_time_minutes ? String(recipe.prep_time_minutes) : '');
      setTags(recipe.tags || []);
      setIngredients(
        recipe.ingredients?.length > 0
          ? recipe.ingredients
          : [{ name: '', quantity: '', unit: '' }]
      );
    } else {
      setName('');
      setDescription('');
      setCategory('dinner');
      setPrepTime('');
      setTags([]);
      setTagInput('');
      setIngredients([{ name: '', quantity: '', unit: '' }]);
    }
  }, [recipe, open]);

  const addIngredient = () => {
    setIngredients(prev => [...prev, { name: '', quantity: '', unit: '' }]);
  };

  const removeIngredient = (index) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const updateIngredient = (index, field, value) => {
    setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, [field]: value } : ing));
  };

  const addTag = (tag) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags(prev => [...prev, t]);
    }
    setTagInput('');
  };

  const removeTag = (tag) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const cleanIngredients = ingredients.filter(i => i.name.trim());
      await onSave({
        name: name.trim(),
        description: description.trim(),
        category,
        prep_time_minutes: prepTime ? parseInt(prepTime) : 0,
        tags,
        ingredients: cleanIngredients,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recipe ? 'Edit Recipe' : 'Add Recipe'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Meal Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Taco Tuesday, Pasta Night..."
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Prep Time (min)
              </Label>
              <Input
                type="number"
                min="0"
                value={prepTime}
                onChange={e => setPrepTime(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any notes about this meal..."
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              Tags
            </Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-xs"
                  onClick={() => removeTag(tag)}
                >
                  {tag} ×
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="Add a tag..."
                className="text-sm"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(tagInput))}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => addTag(tagInput)}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {SUGGESTED_TAGS.filter(t => !tags.includes(t)).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTag(t)}
                  className="text-xs px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ingredients</Label>
            <div className="space-y-2">
              {ingredients.map((ing, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    value={ing.name}
                    onChange={e => updateIngredient(index, 'name', e.target.value)}
                    placeholder="Ingredient"
                    className="flex-1 text-sm"
                  />
                  <Input
                    value={ing.quantity}
                    onChange={e => updateIngredient(index, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="w-16 text-sm"
                  />
                  <Input
                    value={ing.unit}
                    onChange={e => updateIngredient(index, 'unit', e.target.value)}
                    placeholder="Unit"
                    className="w-20 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeIngredient(index)}
                    disabled={ingredients.length === 1}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-1 border-dashed"
              onClick={addIngredient}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Ingredient
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Saving...' : recipe ? 'Save Changes' : 'Add Recipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
