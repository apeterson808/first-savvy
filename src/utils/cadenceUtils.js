const DAYS_PER_YEAR = 365;
const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

export function convertToDaily(amount, fromCadence) {
  switch (fromCadence) {
    case 'daily':
      return amount;
    case 'weekly':
      const yearlyFromWeekly = amount * WEEKS_PER_YEAR;
      return yearlyFromWeekly / DAYS_PER_YEAR;
    case 'monthly':
      const yearlyFromMonthly = amount * MONTHS_PER_YEAR;
      return yearlyFromMonthly / DAYS_PER_YEAR;
    case 'yearly':
      return amount / DAYS_PER_YEAR;
    default:
      return amount;
  }
}

export function convertToWeekly(amount, fromCadence) {
  switch (fromCadence) {
    case 'daily':
      const yearlyFromDaily = amount * DAYS_PER_YEAR;
      return yearlyFromDaily / WEEKS_PER_YEAR;
    case 'weekly':
      return amount;
    case 'monthly':
      const yearlyFromMonthly = amount * MONTHS_PER_YEAR;
      return yearlyFromMonthly / WEEKS_PER_YEAR;
    case 'yearly':
      return amount / WEEKS_PER_YEAR;
    default:
      return amount;
  }
}

export function convertToMonthly(amount, fromCadence) {
  switch (fromCadence) {
    case 'daily':
      const yearlyFromDaily = amount * DAYS_PER_YEAR;
      return yearlyFromDaily / MONTHS_PER_YEAR;
    case 'weekly':
      const yearlyFromWeekly = amount * WEEKS_PER_YEAR;
      return yearlyFromWeekly / MONTHS_PER_YEAR;
    case 'monthly':
      return amount;
    case 'yearly':
      return amount / MONTHS_PER_YEAR;
    default:
      return amount;
  }
}

export function convertToYearly(amount, fromCadence) {
  switch (fromCadence) {
    case 'daily':
      return amount * DAYS_PER_YEAR;
    case 'weekly':
      return amount * WEEKS_PER_YEAR;
    case 'monthly':
      return amount * MONTHS_PER_YEAR;
    case 'yearly':
      return amount;
    default:
      return amount;
  }
}

export function convertCadence(amount, fromCadence, toCadence) {
  if (fromCadence === toCadence) return amount;

  switch (toCadence) {
    case 'daily':
      return convertToDaily(amount, fromCadence);
    case 'weekly':
      return convertToWeekly(amount, fromCadence);
    case 'monthly':
      return convertToMonthly(amount, fromCadence);
    case 'yearly':
      return convertToYearly(amount, fromCadence);
    default:
      return amount;
  }
}

export function formatCadenceAmount(amount, cadence = 'monthly') {
  if (typeof amount !== 'number' || isNaN(amount)) return '$0';

  const decimals = cadence === 'daily' ? 2 : 0;

  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function getAllCadenceValues(amount, sourceCadence) {
  const daily = convertCadence(amount, sourceCadence, 'daily');
  const weekly = convertCadence(amount, sourceCadence, 'weekly');
  const monthly = convertCadence(amount, sourceCadence, 'monthly');
  const yearly = convertCadence(amount, sourceCadence, 'yearly');

  return {
    daily: Math.ceil(daily),
    weekly: Math.ceil(weekly),
    monthly: Math.ceil(monthly),
    yearly: Math.ceil(yearly),
    source: sourceCadence
  };
}

export function formatAccountingAmount(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { sign: '$', amount: '0' };
  }

  const roundedAmount = Math.round(amount);
  const formattedNumber = roundedAmount.toLocaleString('en-US');

  return {
    sign: '$',
    amount: formattedNumber
  };
}
