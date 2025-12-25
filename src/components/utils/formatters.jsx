// Shared formatting utilities for consistent display across the app

/**
 * Formats a number as USD currency with commas and 2 decimal places
 * @param {number} amount - The amount to format
 * @param {object} options - Optional settings
 * @param {boolean} options.showSign - Show + for positive amounts (default: false)
 * @param {boolean} options.absoluteValue - Use absolute value (default: false)
 * @returns {string} Formatted currency string (e.g., "$1,234.56" or "-$1,234.56")
 */
export function formatCurrency(amount, options = {}) {
  const { showSign = false, absoluteValue = false } = options;
  
  const value = absoluteValue ? Math.abs(amount) : amount;
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  const formatted = absValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  if (isNegative) {
    return `-$${formatted}`;
  }
  
  if (showSign && value > 0) {
    return `+$${formatted}`;
  }
  
  return `$${formatted}`;
}

/**
 * Formats a number as a percentage
 * @param {number} value - The percentage value (e.g., 75 for 75%)
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted percentage string (e.g., "75%")
 */
export function formatPercent(value, decimals = 0) {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formats a transaction description from bank format (UPPERCASE) to readable format
 * @param {string} description - The description to format
 * @returns {string} Formatted description
 */
export function formatTransactionDescription(description) {
  if (!description) return '';

  const commonAcronyms = ['ATM', 'POS', 'ACH', 'LLC', 'INC', 'CO', 'USA', 'US', 'UK', 'NY', 'CA', 'TX', 'FL'];
  const commonWords = ['THE', 'AND', 'OR', 'OF', 'IN', 'ON', 'AT', 'TO', 'FOR', 'WITH'];

  const words = description.split(/\s+/);

  const formatted = words.map((word, index) => {
    if (!word) return '';

    if (word.includes('.COM') || word.includes('.NET') || word.includes('.ORG')) {
      const parts = word.split('.');
      return parts.map((part, i) =>
        i === parts.length - 1 ? part.toLowerCase() :
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join('.');
    }

    if (word.match(/^#\d+$/)) {
      return word;
    }

    if (word.match(/^\d/)) {
      return word;
    }

    if (commonAcronyms.includes(word.toUpperCase())) {
      return word.toUpperCase();
    }

    if (index > 0 && commonWords.includes(word.toUpperCase()) && word.length <= 3) {
      return word.toLowerCase();
    }

    if (word.includes('-')) {
      return word.split('-').map(part =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join('-');
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return formatted.join(' ');
}

export function formatLabel(text) {
  if (!text) return '';

  return text
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}