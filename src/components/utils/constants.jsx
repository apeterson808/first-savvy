// Centralized constants for account and detail types

// Detail type display names
export const DETAIL_TYPE_LABELS = {
  // Bank
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  investment: 'Investment',
  business: 'Business',
  // Asset
  property: 'Property',
  vehicle: 'Vehicle',
  cash: 'Cash',
  crypto: 'Crypto',
  stocks: 'Stocks',
  beginning_balance: 'Beginning Balance',
  personal_loan: 'Loan to Others',
  other: 'Other',
  // Liability
  mortgage: 'Mortgage',
  car_loan: 'Car Loan',
  student_loan: 'Student Loan',
  business_loan: 'Business Loan',
  // Income/Expense
  salary: 'Salary',
  business_income: 'Business Income',
  investment_income: 'Investment Income',
  rental_income: 'Rental Income',
  other_income: 'Other Income',
  interest_earned: 'Interest Earned',
  income: 'Income',
  groceries: 'Groceries',
  dining_out: 'Dining Out',
  gas_fuel: 'Gas & Fuel',
  transportation: 'Transportation',
  rent: 'Rent',
  utilities: 'Utilities',
  insurance: 'Insurance',
  healthcare: 'Healthcare',
  subscriptions: 'Subscriptions',
  shopping: 'Shopping',
  clothing: 'Clothing',
  personal_care: 'Personal Care',
  entertainment: 'Entertainment',
  travel: 'Travel',
  education: 'Education',
  kids: 'Kids',
  pets: 'Pets',
  gifts_donations: 'Gifts & Donations',
  home_improvement: 'Home Improvement',
  taxes: 'Taxes',
  debt_payments: 'Debt Payments',
  fees_charges: 'Fees & Charges',
  other_expenses: 'Other Expenses',
  transfer: 'Transfer',
};

// Default detail types by account type (for dropdowns)
export const DEFAULT_DETAIL_TYPES = {
  bank: [
    { value: 'checking', label: 'Checking' },
    { value: 'savings', label: 'Savings' },
  ],
  credit_card: [
    { value: 'credit_card', label: 'Credit Card' }
  ],
  asset: [
    { value: 'cash', label: 'Cash' },
    { value: 'property', label: 'Property' },
    { value: 'vehicle', label: 'Vehicle' },
    { value: 'investment', label: 'Investment' },
    { value: 'retirement', label: 'Retirement' },
    { value: 'crypto', label: 'Crypto' },
    { value: 'other_asset', label: 'Other Asset' },
  ],
  liability: [
    { value: 'mortgage', label: 'Mortgage' },
    { value: 'car_loan', label: 'Car Loan' },
    { value: 'student_loan', label: 'Student Loan' },
    { value: 'personal_loan', label: 'Personal Loan' },
    { value: 'medical_debt', label: 'Medical Debt' },
    { value: 'other_liability', label: 'Other Liability' },
  ],
  income: [
    { value: 'salary', label: 'Salary' },
    { value: 'bonus', label: 'Bonus' },
    { value: 'freelance_income', label: 'Freelance Income' },
    { value: 'interest_earned', label: 'Interest Earned' },
    { value: 'investment_income', label: 'Investment Income' },
    { value: 'rental_income', label: 'Rental Income' },
    { value: 'gifts_received', label: 'Gifts Received' },
    { value: 'tax_refund', label: 'Tax Refund' },
    { value: 'reimbursements', label: 'Reimbursements' },
    { value: 'other_income', label: 'Other Income' },
    { value: 'transfer', label: 'Transfer' },
  ],
  expense: [
    { value: 'groceries', label: 'Groceries' },
    { value: 'dining_out', label: 'Dining Out' },
    { value: 'gas_fuel', label: 'Gas & Fuel' },
    { value: 'transportation', label: 'Transportation' },
    { value: 'rent_mortgage_interest', label: 'Rent / Mortgage Interest' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'subscriptions', label: 'Subscriptions' },
    { value: 'shopping', label: 'Shopping' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'personal_care', label: 'Personal Care' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'travel', label: 'Travel' },
    { value: 'education', label: 'Education' },
    { value: 'kids_childcare', label: 'Kids / Childcare' },
    { value: 'pet_care', label: 'Pet Care' },
    { value: 'gifts_donations', label: 'Gifts & Donations' },
    { value: 'home_improvement', label: 'Home Improvement' },
    { value: 'taxes', label: 'Taxes' },
    { value: 'debt_payments', label: 'Debt Payments' },
    { value: 'fees_charges', label: 'Fees & Charges' },
    { value: 'other_expenses', label: 'Other Expenses' },
    { value: 'transfer', label: 'Transfer' },
  ],
};

// Liability type labels (for display)
export const LIABILITY_TYPE_LABELS = {
  mortgage: 'Mortgages',
  car_loan: 'Auto Loans',
  student_loan: 'Student Loans',
  credit_card: 'Credit Cards',
  personal_loan: 'Personal Loans',
  other: 'Other Liabilities',
};

// Helper function to get detail type display name
export function getDetailTypeDisplayName(detailType) {
  return DETAIL_TYPE_LABELS[detailType] || detailType?.replace(/_/g, ' ') || 'Other';
}

// Helper function to get display name for accounts (QuickBooks-style)
export function getAccountDisplayName(account) {
  if (!account) return '';
  
  // For Income and Expense accounts, use the detail_type as display name
  if (account.account_type === 'income' || account.account_type === 'expense') {
    return getDetailTypeDisplayName(account.detail_type);
  }
  
  // For all other account types, use the account name
  return account.account_name || account.name || '';
}