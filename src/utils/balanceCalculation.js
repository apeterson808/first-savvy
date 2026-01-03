export function calculateOpeningBalance(statements, accountType) {
  if (!statements || statements.length === 0) {
    return {
      openingBalance: null,
      calculationMethod: 'none',
      explanation: 'No statements selected',
      isAutoCalculated: false,
      hasBalanceData: false
    };
  }

  const sortedStatements = [...statements].sort((a, b) => {
    if (a.statement_year !== b.statement_year) {
      return a.statement_year - b.statement_year;
    }
    const monthOrder = { sep: 9, oct: 10, nov: 11, dec: 12 };
    return (monthOrder[a.statement_month] || 0) - (monthOrder[b.statement_month] || 0);
  });

  const earliestStatement = sortedStatements[0];

  if (earliestStatement.beginning_balance !== null && earliestStatement.beginning_balance !== undefined) {
    return {
      openingBalance: earliestStatement.beginning_balance,
      calculationMethod: 'from_statement',
      explanation: `Based on ${getMonthYearLabel(earliestStatement)} statement beginning balance`,
      isAutoCalculated: true,
      hasBalanceData: true,
      statementDate: getMonthYearLabel(earliestStatement)
    };
  }

  if (accountType === 'credit' || accountType === 'credit_card') {
    return {
      openingBalance: 0,
      calculationMethod: 'credit_card_default',
      explanation: 'Credit card opening balance defaulted to $0',
      isAutoCalculated: true,
      hasBalanceData: false,
      note: 'For credit cards importing full history, starting at $0 is typical'
    };
  }

  return {
    openingBalance: null,
    calculationMethod: 'manual_required',
    explanation: 'Balance information not available from statement',
    isAutoCalculated: false,
    hasBalanceData: false,
    suggestion: 'Please enter the balance your account had on the first transaction date'
  };
}

export function validateEndingBalance(openingBalance, transactions, expectedEndingBalance) {
  if (!transactions || transactions.length === 0) {
    return {
      isValid: true,
      calculatedBalance: openingBalance,
      expectedBalance: expectedEndingBalance,
      discrepancy: 0
    };
  }

  let calculatedBalance = openingBalance || 0;

  transactions.forEach(tx => {
    const amount = parseFloat(tx.amount || 0);
    if (tx.type === 'income') {
      calculatedBalance += amount;
    } else if (tx.type === 'expense') {
      calculatedBalance -= amount;
    }
  });

  const discrepancy = expectedEndingBalance !== null
    ? Math.abs(calculatedBalance - expectedEndingBalance)
    : 0;

  return {
    isValid: discrepancy < 0.01,
    calculatedBalance: Math.round(calculatedBalance * 100) / 100,
    expectedBalance: expectedEndingBalance,
    discrepancy: Math.round(discrepancy * 100) / 100,
    hasExpectedBalance: expectedEndingBalance !== null && expectedEndingBalance !== undefined
  };
}

export function getBalanceSummary(statements, openingBalance) {
  if (!statements || statements.length === 0) {
    return null;
  }

  const sortedStatements = [...statements].sort((a, b) => {
    if (a.statement_year !== b.statement_year) {
      return a.statement_year - b.statement_year;
    }
    const monthOrder = { sep: 9, oct: 10, nov: 11, dec: 12 };
    return (monthOrder[a.statement_month] || 0) - (monthOrder[b.statement_month] || 0);
  });

  const earliestStatement = sortedStatements[0];
  const latestStatement = sortedStatements[sortedStatements.length - 1];

  const allTransactions = sortedStatements.flatMap(stmt =>
    Array.isArray(stmt.transactions_data) ? stmt.transactions_data : []
  );

  const validation = validateEndingBalance(
    openingBalance,
    allTransactions,
    latestStatement.ending_balance
  );

  return {
    startDate: getMonthYearLabel(earliestStatement),
    endDate: getMonthYearLabel(latestStatement),
    statementCount: statements.length,
    transactionCount: allTransactions.length,
    openingBalance,
    expectedEndingBalance: latestStatement.ending_balance,
    calculatedEndingBalance: validation.calculatedBalance,
    validation
  };
}

function getMonthYearLabel(statement) {
  const monthNames = {
    sep: 'September',
    oct: 'October',
    nov: 'November',
    dec: 'December',
    '9': 'September',
    '10': 'October',
    '11': 'November',
    '12': 'December'
  };

  const monthKey = String(statement.statement_month).toLowerCase();
  const monthName = monthNames[monthKey] || statement.statement_month;
  return `${monthName} ${statement.statement_year}`;
}
