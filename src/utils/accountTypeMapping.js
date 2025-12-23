export const ACCOUNT_TYPE_MAPPING = {
  asset: {
    'Bank Account': [
      'Checking',
      'Savings',
      'Money Market',
      'Certificate of Deposit'
    ],
    'Cash': [
      'Physical Cash',
      'Petty Cash',
      'Cash on Hand'
    ],
    'Investment': [
      '401(k)',
      'IRA',
      'Roth IRA',
      'Brokerage Account',
      'Stock Portfolio',
      'Mutual Funds',
      'ETFs',
      'Bonds'
    ],
    'Cryptocurrency': [
      'Bitcoin',
      'Ethereum',
      'Other Crypto'
    ],
    'Property': [
      'Primary Residence',
      'Rental Property',
      'Commercial Property',
      'Land',
      'Vacation Home'
    ],
    'Vehicle': [
      'Car',
      'Truck',
      'SUV',
      'Motorcycle',
      'RV',
      'Boat',
      'Other Vehicle'
    ],
    'Other Asset': [
      'Collectibles',
      'Art',
      'Jewelry',
      'Business Equipment',
      'Other'
    ]
  },
  liability: {
    'Credit Card': [
      'Personal Credit Card',
      'Business Credit Card',
      'Store Credit Card'
    ],
    'Loan': [
      'Personal Loan',
      'Student Loan',
      'Auto Loan',
      'Home Equity Loan',
      'Medical Debt',
      'Other Loan'
    ],
    'Mortgage': [
      'Primary Mortgage',
      'Second Mortgage',
      'HELOC',
      'Reverse Mortgage'
    ],
    'Other Liability': [
      'Tax Liability',
      'Legal Debt',
      'Other'
    ]
  },
  equity: {
    'Owner Equity': [
      'Owner\'s Equity',
      'Partner Equity',
      'Member Equity'
    ],
    'Retained Earnings': [
      'Current Year Earnings',
      'Prior Year Earnings'
    ],
    'Capital': [
      'Contributed Capital',
      'Additional Paid-in Capital'
    ]
  }
};

export function getAccountTypes(classType) {
  return Object.keys(ACCOUNT_TYPE_MAPPING[classType] || {});
}

export function getAccountDetails(classType, accountType) {
  return ACCOUNT_TYPE_MAPPING[classType]?.[accountType] || [];
}

export function getAllTypes() {
  const allTypes = [];
  Object.values(ACCOUNT_TYPE_MAPPING).forEach(classTypes => {
    Object.keys(classTypes).forEach(type => {
      if (!allTypes.includes(type)) {
        allTypes.push(type);
      }
    });
  });
  return allTypes;
}
