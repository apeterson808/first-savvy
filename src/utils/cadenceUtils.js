const DAYS_PER_MONTH = 30.4375;
const WEEKS_PER_MONTH = 4.3333;
const MONTHS_PER_YEAR = 12;

export function convertToDaily(amount, fromCadence) {
  switch (fromCadence) {
    case 'daily':
      return amount;
    case 'weekly':
      return amount / 7;
    case 'monthly':
      return amount / DAYS_PER_MONTH;
    case 'yearly':
      return amount / (DAYS_PER_MONTH * MONTHS_PER_YEAR);
    default:
      return amount;
  }
}

export function convertToWeekly(amount, fromCadence) {
  switch (fromCadence) {
    case 'daily':
      return amount * 7;
    case 'weekly':
      return amount;
    case 'monthly':
      return amount / WEEKS_PER_MONTH;
    case 'yearly':
      return amount / (WEEKS_PER_MONTH * MONTHS_PER_YEAR);
    default:
      return amount;
  }
}

export function convertToMonthly(amount, fromCadence) {
  switch (fromCadence) {
    case 'daily':
      return amount * DAYS_PER_MONTH;
    case 'weekly':
      return amount * WEEKS_PER_MONTH;
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
      return amount * DAYS_PER_MONTH * MONTHS_PER_YEAR;
    case 'weekly':
      return amount * WEEKS_PER_MONTH * MONTHS_PER_YEAR;
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

export function formatCadenceAmount(amount, decimals = 0) {
  if (typeof amount !== 'number' || isNaN(amount)) return '$0';

  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function getAllCadenceValues(amount, sourceCadence) {
  return {
    daily: convertCadence(amount, sourceCadence, 'daily'),
    weekly: convertCadence(amount, sourceCadence, 'weekly'),
    monthly: convertCadence(amount, sourceCadence, 'monthly'),
    yearly: convertCadence(amount, sourceCadence, 'yearly'),
    source: sourceCadence
  };
}
