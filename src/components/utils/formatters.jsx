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