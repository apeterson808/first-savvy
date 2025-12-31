import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import AddEditCategorySheet from './AddEditCategorySheet';

export default function CategoriesManagementTab({ categories, transactions }) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);

  const getCategoryUsageCount = (categoryId) => {
    return transactions.filter(t => t.chart_account_id === categoryId).length;
  };

  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return categories.filter(cat => {
      const name = cat.display_name || cat.account_detail || '';
      return name.toLowerCase().includes(query);
    });
  }, [categories, searchQuery]);

  const incomeCategories = filteredCategories.filter(c => c.class === 'income');
  const expenseCategories = filteredCategories.filter(c => c.class === 'expense');

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;

    try {
      const usageCount = getCategoryUsageCount(deletingCategory.id);

      if (usageCount > 0) {
        await firstsavvy.supabase.from('transactions')
          .update({ chart_account_id: null })
          .eq('category_account_id', deletingCategory.id);
      }

      await firstsavvy.entities.ChartAccount.delete(deletingCategory.id);

      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['user-chart-accounts-income-expense'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });

      toast.success(`Category "${deletingCategory.display_name || deletingCategory.account_detail}" deleted successfully`);
      setDeletingCategory(null);
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  const CategoryRow = ({ category }) => {
    const IconComponent = Icons[category.icon] || Icons.Circle;
    const usageCount = getCategoryUsageCount(category.id);
    const isSystemCategory = !category.is_user_created;
    const categoryName = category.display_name || category.account_detail;

    return (
      <TableRow>
        <TableCell className="w-12 py-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${category.color}20` }}
          >
            <IconComponent className="w-3.5 h-3.5" style={{ color: category.color }} />
          </div>
        </TableCell>
        <TableCell className="font-medium py-2 flex-1">
          <div className="flex items-center gap-2">
            {categoryName}
            {isSystemCategory && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                System
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-slate-600 py-2 w-48">
          {usageCount} {usageCount === 1 ? 'transaction' : 'transactions'}
        </TableCell>
        <TableCell className="text-right py-2 w-32">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setEditingCategory(category)}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            {!isSystemCategory && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setDeletingCategory(category)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setAddSheetOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-green-700 uppercase tracking-wide">
            Income Categories ({incomeCategories.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incomeCategories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="flex-1">Name</TableHead>
                  <TableHead className="w-48">Usage</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeCategories.map(category => (
                  <CategoryRow key={category.id} category={category} />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-slate-500">
              No income categories found
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Expense Categories ({expenseCategories.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenseCategories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="flex-1">Name</TableHead>
                  <TableHead className="w-48">Usage</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseCategories.map(category => (
                  <CategoryRow key={category.id} category={category} />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-slate-500">
              No expense categories found
            </div>
          )}
        </CardContent>
      </Card>

      <AddEditCategorySheet
        open={addSheetOpen || !!editingCategory}
        onOpenChange={(open) => {
          if (!open) {
            setAddSheetOpen(false);
            setEditingCategory(null);
          }
        }}
        editingCategory={editingCategory}
      />

      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete Category
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCategory && (
                <>
                  Are you sure you want to delete the category "{deletingCategory.display_name || deletingCategory.account_detail}"?
                  {getCategoryUsageCount(deletingCategory.id) > 0 && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900">
                      <p className="font-medium">Warning:</p>
                      <p className="text-sm mt-1">
                        This category is used in {getCategoryUsageCount(deletingCategory.id)} transaction(s).
                        These transactions will be set to "Uncategorized".
                      </p>
                    </div>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
