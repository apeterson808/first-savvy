import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const DEFAULT_ACCOUNTS = [
  // Bank Accounts
  {
    entity: 'BankAccount',
    data: {
      account_name: 'Checking Account',
      account_type: 'checking',
      current_balance: 0,
      is_active: true
    },
    checkField: 'account_name',
    checkValue: 'Checking Account'
  },
  {
    entity: 'BankAccount',
    data: {
      account_name: 'Savings Account',
      account_type: 'savings',
      current_balance: 0,
      is_active: true
    },
    checkField: 'account_name',
    checkValue: 'Savings Account'
  },
  {
    entity: 'BankAccount',
    data: {
      account_name: 'Credit Card',
      account_type: 'credit_card',
      current_balance: 0,
      is_active: true
    },
    checkField: 'account_name',
    checkValue: 'Credit Card'
  },
  // Assets
  {
    entity: 'Asset',
    data: {
      name: 'Beginning Balance',
      type: 'beginning_balance',
      current_value: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Beginning Balance'
  },
  {
    entity: 'Asset',
    data: {
      name: 'Cash',
      type: 'cash',
      current_value: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Cash'
  },
  {
    entity: 'Asset',
    data: {
      name: 'Crypto',
      type: 'crypto',
      current_value: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Crypto'
  },
  {
    entity: 'Asset',
    data: {
      name: 'Investment',
      type: 'investment',
      current_value: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Investment'
  },
  {
    entity: 'Asset',
    data: {
      name: 'Loan to Others',
      type: 'personal_loan',
      current_value: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Loan to Others'
  },
  {
    entity: 'Asset',
    data: {
      name: 'Property',
      type: 'property',
      current_value: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Property'
  },
  {
    entity: 'Asset',
    data: {
      name: 'Stocks',
      type: 'stocks',
      current_value: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Stocks'
  },
  {
    entity: 'Asset',
    data: {
      name: 'Vehicle',
      type: 'vehicle',
      current_value: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Vehicle'
  },
  // Liabilities
  {
    entity: 'Liability',
    data: {
      name: 'Car Loan',
      type: 'car_loan',
      current_balance: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Car Loan'
  },
  {
    entity: 'Liability',
    data: {
      name: 'Mortgage',
      type: 'mortgage',
      current_balance: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Mortgage'
  },
  {
    entity: 'Liability',
    data: {
      name: 'Personal Loan',
      type: 'personal_loan',
      current_balance: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Personal Loan'
  },
  {
    entity: 'Liability',
    data: {
      name: 'Student Loan',
      type: 'student_loan',
      current_balance: 0,
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Student Loan'
  },
  // Income Categories
  {
    entity: 'Category',
    data: {
      name: 'Business Income',
      type: 'income',
      detail_type: 'business_income',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Business Income'
  },
  {
    entity: 'Category',
    data: {
      name: 'Interest Earned',
      type: 'income',
      detail_type: 'interest_earned',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Interest Earned'
  },
  {
    entity: 'Category',
    data: {
      name: 'Investment Income',
      type: 'income',
      detail_type: 'investment_income',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Investment Income'
  },
  {
    entity: 'Category',
    data: {
      name: 'Other Income',
      type: 'income',
      detail_type: 'other_income',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Other Income'
  },
  {
    entity: 'Category',
    data: {
      name: 'Rental Income',
      type: 'income',
      detail_type: 'rental_income',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Rental Income'
  },
  {
    entity: 'Category',
    data: {
      name: 'Salary',
      type: 'income',
      detail_type: 'salary',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Salary'
  },
  {
    entity: 'Category',
    data: {
      name: 'Transfer',
      type: 'income',
      detail_type: 'transfer',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Transfer',
    checkField2: 'type',
    checkValue2: 'income'
  },
  // Expense Categories
  {
    entity: 'Category',
    data: {
      name: 'Clothing',
      type: 'expense',
      detail_type: 'clothing',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Clothing'
  },
  {
    entity: 'Category',
    data: {
      name: 'Debt Payments',
      type: 'expense',
      detail_type: 'debt_payments',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Debt Payments'
  },
  {
    entity: 'Category',
    data: {
      name: 'Dining Out',
      type: 'expense',
      detail_type: 'dining_out',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Dining Out'
  },
  {
    entity: 'Category',
    data: {
      name: 'Education',
      type: 'expense',
      detail_type: 'education',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Education'
  },
  {
    entity: 'Category',
    data: {
      name: 'Entertainment',
      type: 'expense',
      detail_type: 'entertainment',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Entertainment'
  },
  {
    entity: 'Category',
    data: {
      name: 'Fees & Charges',
      type: 'expense',
      detail_type: 'fees_charges',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Fees & Charges'
  },
  {
    entity: 'Category',
    data: {
      name: 'Gas & Fuel',
      type: 'expense',
      detail_type: 'gas_fuel',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Gas & Fuel'
  },
  {
    entity: 'Category',
    data: {
      name: 'Gifts & Donations',
      type: 'expense',
      detail_type: 'gifts_donations',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Gifts & Donations'
  },
  {
    entity: 'Category',
    data: {
      name: 'Groceries',
      type: 'expense',
      detail_type: 'groceries',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Groceries'
  },
  {
    entity: 'Category',
    data: {
      name: 'Healthcare',
      type: 'expense',
      detail_type: 'healthcare',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Healthcare'
  },
  {
    entity: 'Category',
    data: {
      name: 'Home Improvement',
      type: 'expense',
      detail_type: 'home_improvement',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Home Improvement'
  },
  {
    entity: 'Category',
    data: {
      name: 'Insurance',
      type: 'expense',
      detail_type: 'insurance',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Insurance'
  },
  {
    entity: 'Category',
    data: {
      name: 'Kids',
      type: 'expense',
      detail_type: 'kids',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Kids'
  },
  {
    entity: 'Category',
    data: {
      name: 'Mortgage',
      type: 'expense',
      detail_type: 'mortgage',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Mortgage'
  },
  {
    entity: 'Category',
    data: {
      name: 'Other Expenses',
      type: 'expense',
      detail_type: 'other_expenses',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Other Expenses'
  },
  {
    entity: 'Category',
    data: {
      name: 'Personal Care',
      type: 'expense',
      detail_type: 'personal_care',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Personal Care'
  },
  {
    entity: 'Category',
    data: {
      name: 'Pets',
      type: 'expense',
      detail_type: 'pets',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Pets'
  },
  {
    entity: 'Category',
    data: {
      name: 'Rent',
      type: 'expense',
      detail_type: 'rent',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Rent'
  },
  {
    entity: 'Category',
    data: {
      name: 'Shopping',
      type: 'expense',
      detail_type: 'shopping',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Shopping'
  },
  {
    entity: 'Category',
    data: {
      name: 'Subscriptions',
      type: 'expense',
      detail_type: 'subscriptions',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Subscriptions'
  },
  {
    entity: 'Category',
    data: {
      name: 'Taxes',
      type: 'expense',
      detail_type: 'taxes',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Taxes'
  },
  {
    entity: 'Category',
    data: {
      name: 'Transportation',
      type: 'expense',
      detail_type: 'transportation',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Transportation'
  },
  {
    entity: 'Category',
    data: {
      name: 'Travel',
      type: 'expense',
      detail_type: 'travel',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Travel'
  },
  {
    entity: 'Category',
    data: {
      name: 'Transfer',
      type: 'expense',
      detail_type: 'transfer',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Transfer'
  },
  {
    entity: 'Category',
    data: {
      name: 'Utilities',
      type: 'expense',
      detail_type: 'utilities',
      is_active: true
    },
    checkField: 'name',
    checkValue: 'Utilities'
  }
];

export function useDefaultAccounts() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeDefaults = async () => {
      try {
        for (const defaultAccount of DEFAULT_ACCOUNTS) {
          // Check if account already exists
          const filter = {
            [defaultAccount.checkField]: defaultAccount.checkValue
          };

          // Handle special case for income Transfer category
          if (defaultAccount.checkField2 && defaultAccount.checkValue2) {
            filter[defaultAccount.checkField2] = defaultAccount.checkValue2;
          }

          const existing = await base44.entities[defaultAccount.entity].filter(filter);

          // Remove duplicates if multiple exist
          if (existing.length > 1) {
            // Keep the first one, delete the rest
            for (let i = 1; i < existing.length; i++) {
              await base44.entities[defaultAccount.entity].delete(existing[i].id);
            }
          } else if (existing.length === 0) {
            // Create if doesn't exist
            await base44.entities[defaultAccount.entity].create(defaultAccount.data);
          }
        }
        setInitialized(true);
      } catch (error) {
        console.error('Error initializing default accounts:', error);
        setInitialized(true);
      }
    };

    initializeDefaults();
  }, []);

  return initialized;
}