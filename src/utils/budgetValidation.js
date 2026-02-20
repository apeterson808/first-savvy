import { convertCadence } from './cadenceUtils';

/**
 * Validates if a child budget amount would exceed its parent budget
 * @param {number} childAmount - The amount for the child budget
 * @param {string} childCadence - The cadence for the child budget (daily/weekly/monthly/yearly)
 * @param {object} parentBudget - The parent budget object with allocated_amount and cadence
 * @param {array} siblingBudgets - Array of sibling budget objects to sum up
 * @param {string} excludeBudgetId - Optional budget ID to exclude from sibling sum (for editing existing budgets)
 * @returns {object} Validation result with isValid, overflow, parentBudget, and totalSiblings
 */
export function validateChildBudgetAgainstParent(
  childAmount,
  childCadence,
  parentBudget,
  siblingBudgets = [],
  excludeBudgetId = null
) {
  // If no parent budget exists, validation fails
  if (!parentBudget) {
    return {
      isValid: false,
      overflow: childAmount,
      parentBudget: null,
      totalSiblings: childAmount,
      cadence: childCadence
    };
  }

  // Convert parent budget to child's cadence
  const parentAmountInChildCadence = convertCadence(
    parentBudget.allocated_amount || 0,
    parentBudget.cadence || 'monthly',
    childCadence
  );

  // Sum up all sibling budgets (excluding the one being edited if applicable)
  const totalSiblingsInChildCadence = siblingBudgets
    .filter(sibling => sibling.id !== excludeBudgetId)
    .reduce((sum, sibling) => {
      const siblingAmountInChildCadence = convertCadence(
        sibling.allocated_amount || 0,
        sibling.cadence || 'monthly',
        childCadence
      );
      return sum + siblingAmountInChildCadence;
    }, 0);

  // Add the new/edited child amount to the total
  const newTotalInChildCadence = totalSiblingsInChildCadence + childAmount;

  // Check if it exceeds parent budget
  const overflow = newTotalInChildCadence - parentAmountInChildCadence;
  const isValid = overflow <= 0;

  return {
    isValid,
    overflow: isValid ? 0 : overflow,
    parentBudget: {
      ...parentBudget,
      amountInChildCadence: parentAmountInChildCadence
    },
    totalSiblings: newTotalInChildCadence,
    cadence: childCadence
  };
}

/**
 * Formats a validation error message with proper cadence display
 * @param {object} validationResult - Result from validateChildBudgetAgainstParent
 * @param {string} parentCategoryName - Name of the parent category
 * @returns {string} Formatted error message
 */
export function formatValidationError(validationResult, parentCategoryName) {
  const cadenceLabels = {
    daily: '/day',
    weekly: '/wk',
    monthly: '/mo',
    yearly: '/yr'
  };

  const cadenceLabel = cadenceLabels[validationResult.cadence] || '/mo';

  if (!validationResult.parentBudget) {
    return `Cannot create child budget: Parent category "${parentCategoryName}" must have a budget first.`;
  }

  const parentAmount = Math.round(validationResult.parentBudget.amountInChildCadence);
  const totalAmount = Math.round(validationResult.totalSiblings);
  const overflowAmount = Math.round(validationResult.overflow);

  return `Would exceed parent budget of $${parentAmount.toLocaleString()}${cadenceLabel}. Total would be $${totalAmount.toLocaleString()}${cadenceLabel} (over by $${overflowAmount.toLocaleString()}${cadenceLabel}).`;
}

/**
 * Gets the cadence label for display
 * @param {string} cadence - The cadence (daily/weekly/monthly/yearly)
 * @returns {string} The formatted label
 */
export function getCadenceLabel(cadence) {
  const labels = {
    daily: '/day',
    weekly: '/wk',
    monthly: '/mo',
    yearly: '/yr'
  };
  return labels[cadence] || '/mo';
}
