// Shared sorting logic for accounts - used by AccountsTable

export function sortAccountsForDisplay(allAccounts) {
  // Group by institution or entity type (only top-level accounts, no parent)
  const topLevelAccounts = allAccounts.filter(a => !a.parent_bank_account_id);
  const subAccounts = allAccounts.filter(a => a.parent_bank_account_id);

  const groupedByInstitution = topLevelAccounts.reduce((groups, account) => {
    let groupKey;
    if (account.entityType === 'BankAccount') {
      groupKey = account.institution && account.institution.trim() !== '' ? account.institution : 'Other Banks';
    } else if (account.entityType === 'Income') {
      groupKey = '__Income';
    } else if (account.entityType === 'Expense') {
      groupKey = '__Expense';
    } else if (account.entityType === 'Asset') {
      groupKey = '__Assets';
    } else if (account.entityType === 'Liability') {
      groupKey = '__Liabilities';
    } else {
      groupKey = 'Other';
    }
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(account);
    return groups;
  }, {});

  // Custom sort: bank institutions first (alphabetically), then Assets, Liabilities, Income, Expense
  const specialOrder = ['__Assets', '__Liabilities', '__Income', '__Expense', 'Other Banks', 'Other'];
  const sortedInstitutions = Object.entries(groupedByInstitution).sort(([a], [b]) => {
    const aSpecial = specialOrder.indexOf(a);
    const bSpecial = specialOrder.indexOf(b);
    if (aSpecial === -1 && bSpecial === -1) return a.localeCompare(b);
    if (aSpecial === -1) return -1;
    if (bSpecial === -1) return 1;
    return aSpecial - bSpecial;
  });

  // Flatten into ordered list, inserting sub-accounts after their parent
  const orderedAccounts = [];
  sortedInstitutions.forEach(([groupKey, groupAccounts]) => {
    const sorted = [...groupAccounts].sort((a, b) => 
      (a.account_name || '').localeCompare(b.account_name || '')
    );
    sorted.forEach(parent => {
      orderedAccounts.push(parent);
      // Find and add children of this parent
      const children = subAccounts
        .filter(s => s.parent_bank_account_id === parent.id)
        .sort((a, b) => (a.account_name || '').localeCompare(b.account_name || ''));
      children.forEach(child => {
        orderedAccounts.push({ ...child, isSubAccount: true });
      });
    });
  });

  return orderedAccounts;
}

// Returns grouped data for table rendering with group headers
export function getGroupedAccountsForTable(allAccounts) {
  // Separate top-level and sub-accounts
  const topLevelAccounts = allAccounts.filter(a => !a.parent_bank_account_id);
  const subAccounts = allAccounts.filter(a => a.parent_bank_account_id);

  // Group by institution or entity type (only top-level)
  const groupedByInstitution = topLevelAccounts.reduce((groups, account) => {
    let groupKey;
    if (account.entityType === 'BankAccount') {
      groupKey = account.institution && account.institution.trim() !== '' ? account.institution : 'Other Banks';
    } else if (account.entityType === 'Income') {
      groupKey = '__Income';
    } else if (account.entityType === 'Expense') {
      groupKey = '__Expense';
    } else if (account.entityType === 'Asset') {
      groupKey = '__Assets';
    } else if (account.entityType === 'Liability') {
      groupKey = '__Liabilities';
    } else {
      groupKey = 'Other';
    }
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(account);
    return groups;
  }, {});

  // Custom sort: bank institutions first (alphabetically), then Assets, Liabilities, Income, Expense
  const specialOrder = ['__Assets', '__Liabilities', '__Income', '__Expense', 'Other Banks', 'Other'];
  const sortedInstitutions = Object.entries(groupedByInstitution).sort(([a], [b]) => {
    const aSpecial = specialOrder.indexOf(a);
    const bSpecial = specialOrder.indexOf(b);
    if (aSpecial === -1 && bSpecial === -1) return a.localeCompare(b);
    if (aSpecial === -1) return -1;
    if (bSpecial === -1) return 1;
    return aSpecial - bSpecial;
  });

  return sortedInstitutions.map(([groupKey, groupAccounts]) => {
    // Sort parents alphabetically, then insert their children after each parent
    const sortedParents = [...groupAccounts].sort((a, b) => 
      (a.account_name || '').localeCompare(b.account_name || '')
    );
    
    const orderedAccounts = [];
    sortedParents.forEach(parent => {
      orderedAccounts.push(parent);
      // Find and add children of this parent
      const children = subAccounts
        .filter(s => s.parent_bank_account_id === parent.id)
        .sort((a, b) => (a.account_name || '').localeCompare(b.account_name || ''));
      children.forEach(child => {
        orderedAccounts.push({ ...child, isSubAccount: true });
      });
    });
    
    return { groupKey, accounts: orderedAccounts };
  });
}