import { convertCadence } from './cadenceUtils';

/**
 * Finds all parent-child budget conflicts where child budgets exceed parent budgets
 * @param {Array} budgets - Array of budget objects with allocated_amount and cadence
 * @param {Array} categories - Array of category objects with parent_account_id
 * @returns {Array} Array of conflict objects with details
 */
export function findBudgetConflicts(budgets, categories) {
  const conflicts = [];

  const parentCategories = categories.filter(c => !c.parent_account_id);

  parentCategories.forEach(parentCategory => {
    const parentBudget = budgets.find(b => b.chart_account_id === parentCategory.id);

    if (!parentBudget) return;

    const childCategories = categories.filter(c => c.parent_account_id === parentCategory.id);
    const childBudgets = budgets.filter(b => {
      const category = categories.find(c => c.id === b.chart_account_id);
      return category?.parent_account_id === parentCategory.id;
    });

    if (childBudgets.length === 0) return;

    const parentCadence = parentBudget.cadence || 'monthly';
    const parentAmount = parentBudget.allocated_amount || 0;

    const totalChildrenInParentCadence = childBudgets.reduce((sum, childBudget) => {
      const childAmount = childBudget.allocated_amount || 0;
      const childCadence = childBudget.cadence || 'monthly';
      const childInParentCadence = convertCadence(childAmount, childCadence, parentCadence);
      return sum + childInParentCadence;
    }, 0);

    const overflow = totalChildrenInParentCadence - parentAmount;

    if (overflow > 0.01) {
      conflicts.push({
        parentCategory,
        parentBudget,
        childBudgets: childBudgets.map(cb => ({
          ...cb,
          category: categories.find(c => c.id === cb.chart_account_id)
        })),
        totalChildrenAmount: totalChildrenInParentCadence,
        overflow,
        cadence: parentCadence
      });
    }
  });

  return conflicts;
}

/**
 * Generates updates to fix budget conflicts by increasing parent budgets
 * @param {Array} conflicts - Array of conflict objects from findBudgetConflicts
 * @returns {Array} Array of budget updates { id, allocated_amount }
 */
export function generateConflictResolutions(conflicts) {
  return conflicts.map(conflict => ({
    id: conflict.parentBudget.id,
    allocated_amount: conflict.totalChildrenAmount,
    reason: `Increased to match child budgets total`,
    parentName: conflict.parentCategory.display_name,
    oldAmount: conflict.parentBudget.allocated_amount,
    newAmount: conflict.totalChildrenAmount,
    increase: conflict.overflow,
    cadence: conflict.cadence
  }));
}
