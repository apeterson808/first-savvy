// Financial validation utilities

/**
 * Validates and sanitizes a monetary amount
 * @param {string|number} value - The amount to validate
 * @param {object} options - Validation options
 * @returns {object} { valid: boolean, value: number, error: string }
 */
export function validateAmount(value, options = {}) {
  const {
    minValue = 0,
    maxValue = 999999999.99,
    allowZero = false,
    allowNegative = false
  } = options;

  // Convert to string and clean
  let cleanValue = String(value).replace(/[^0-9.-]/g, '');
  
  // Check for multiple decimals or dashes
  if ((cleanValue.match(/\./g) || []).length > 1) {
    return { valid: false, value: 0, error: 'Invalid number format' };
  }
  if ((cleanValue.match(/-/g) || []).length > 1 || (cleanValue.includes('-') && cleanValue.indexOf('-') !== 0)) {
    return { valid: false, value: 0, error: 'Invalid number format' };
  }

  const numValue = parseFloat(cleanValue);

  if (isNaN(numValue)) {
    return { valid: false, value: 0, error: 'Please enter a valid number' };
  }

  if (!allowNegative && numValue < 0) {
    return { valid: false, value: 0, error: 'Amount cannot be negative' };
  }

  if (!allowZero && numValue === 0) {
    return { valid: false, value: 0, error: 'Amount cannot be zero' };
  }

  if (numValue < minValue && numValue !== 0) {
    return { valid: false, value: 0, error: `Amount must be at least $${minValue}` };
  }

  if (numValue > maxValue) {
    return { valid: false, value: 0, error: `Amount cannot exceed $${maxValue.toLocaleString()}` };
  }

  // Round to 2 decimal places
  const roundedValue = Math.round(numValue * 100) / 100;

  return { valid: true, value: roundedValue, error: null };
}

/**
 * Sanitizes text for use in LLM prompts to prevent injection
 * @param {string} text - The text to sanitize
 * @returns {string} Sanitized text
 */
export function sanitizeForLLM(text) {
  if (!text) return '';
  
  // Remove potential prompt injection patterns
  return String(text)
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Escape quotes
    .replace(/"/g, '\\"')
    // Remove potential instruction patterns
    .replace(/ignore (all )?(previous |prior )?(instructions?|prompts?)/gi, '[FILTERED]')
    .replace(/you are now/gi, '[FILTERED]')
    .replace(/new instructions?:/gi, '[FILTERED]')
    .replace(/system:/gi, '[FILTERED]')
    .replace(/assistant:/gi, '[FILTERED]')
    // Limit length to prevent token stuffing
    .substring(0, 500)
    .trim();
}

/**
 * Validates a date string
 * @param {string} dateStr - The date string to validate
 * @returns {object} { valid: boolean, error: string }
 */
export function validateDate(dateStr) {
  if (!dateStr) {
    return { valid: false, error: 'Date is required' };
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  // Don't allow future dates for transactions
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) {
    return { valid: false, error: 'Date cannot be in the future' };
  }

  // Don't allow dates too far in the past (10 years)
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  if (date < tenYearsAgo) {
    return { valid: false, error: 'Date cannot be more than 10 years ago' };
  }

  return { valid: true, error: null };
}

/**
 * Validates tab parameter against whitelist
 * @param {string} tab - The tab value
 * @param {string[]} allowedTabs - Array of allowed tab values
 * @param {string} defaultTab - Default tab if invalid
 * @returns {string} Valid tab value
 */
export function validateTab(tab, allowedTabs, defaultTab) {
  if (!tab || !allowedTabs.includes(tab)) {
    return defaultTab;
  }
  return tab;
}