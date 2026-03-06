import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

export function getDateRangeFromPreset(preset) {
  const today = new Date();

  switch (preset) {
    case 'today':
      return {
        start: startOfDay(today),
        end: endOfDay(today)
      };

    case 'yesterday':
      const yesterday = subDays(today, 1);
      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday)
      };

    case 'last7':
      return {
        start: startOfDay(subDays(today, 6)),
        end: endOfDay(today)
      };

    case 'last30':
      return {
        start: startOfDay(subDays(today, 29)),
        end: endOfDay(today)
      };

    case 'last3months':
      return {
        start: startOfDay(subMonths(today, 3)),
        end: endOfDay(today)
      };

    case 'last6months':
      return {
        start: startOfDay(subMonths(today, 6)),
        end: endOfDay(today)
      };

    case 'last12months':
      return {
        start: startOfDay(subMonths(today, 12)),
        end: endOfDay(today)
      };

    case 'mtd':
      return {
        start: startOfMonth(today),
        end: endOfDay(today)
      };

    case 'qtd':
      return {
        start: startOfQuarter(today),
        end: endOfDay(today)
      };

    case 'ytd':
      return {
        start: startOfYear(today),
        end: endOfDay(today)
      };

    case 'thisMonth':
      return {
        start: startOfMonth(today),
        end: endOfMonth(today)
      };

    case 'lastMonth':
      const lastMonth = subMonths(today, 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth)
      };

    case 'thisQuarter':
      return {
        start: startOfQuarter(today),
        end: endOfQuarter(today)
      };

    case 'thisYear':
      return {
        start: startOfYear(today),
        end: endOfYear(today)
      };

    case 'all':
    default:
      return {
        start: null,
        end: null
      };
  }
}

export function formatDateForDb(date) {
  if (!date) return null;
  return date.toISOString().split('T')[0];
}
