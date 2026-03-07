export const ACCOUNT_TYPE_LABELS = {
  earned_income: 'Earned Income',
  passive_income: 'Passive Income',
  fixed_expenses: 'Fixed Expenses',
  variable_expenses: 'Variable Expenses',
  discretionary_expenses: 'Discretionary Expenses',
  uncategorized: 'Uncategorized'
};

export const ACCOUNT_TYPE_ORDER = {
  earned_income: 1,
  passive_income: 2,
  fixed_expenses: 1,
  variable_expenses: 2,
  discretionary_expenses: 3,
  uncategorized: 99
};

export function getAccountTypeLabel(accountType) {
  return ACCOUNT_TYPE_LABELS[accountType] || accountType || 'Uncategorized';
}

export function getAccountTypeOrder(accountType) {
  return ACCOUNT_TYPE_ORDER[accountType] || 99;
}
