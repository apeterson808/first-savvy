// Centralized constants for account and detail types

// Base44 Color Palette
export const BASE44_COLORS = {
  softGreen: '#AACC96',
  darkForestGreen: '#25533F',
  peach: '#F4BEAE',
  skyBlue: '#52A5CE',
  pink: '#FF7BAC',
  brown: '#876029',
  burgundy: '#6D1F42',
  lavender: '#D3B6D3',
  yellow: '#EFCE7B',
  lightBlue: '#B8CEE8',
  orange: '#EF6F3C',
  olive: '#AFAB23',
};

export const CHART_COLORS = [
  BASE44_COLORS.skyBlue,
  BASE44_COLORS.softGreen,
  BASE44_COLORS.orange,
  BASE44_COLORS.yellow,
  BASE44_COLORS.pink,
  BASE44_COLORS.peach,
  BASE44_COLORS.lightBlue,
  BASE44_COLORS.lavender,
  BASE44_COLORS.burgundy,
  BASE44_COLORS.brown,
  BASE44_COLORS.olive,
  BASE44_COLORS.darkForestGreen,
];

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
    { value: 'income', label: 'Income' },
  ],
  expense: [
    { value: 'expense', label: 'Expense' },
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

  // For Income and Expense categories, use the name field (user's custom display name)
  if (account.account_type === 'income' || account.account_type === 'expense' || account.type === 'income' || account.type === 'expense') {
    return account.name || account.account_name || '';
  }

  // For all other account types, use the account name
  return account.account_name || account.name || '';
}