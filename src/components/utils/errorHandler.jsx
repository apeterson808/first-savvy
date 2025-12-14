/**
 * Comprehensive Error Handling Utilities
 * Handles network failures, validation errors, and provides fallback mechanisms
 */

import { toast } from 'sonner';

// Error types for categorization
export const ErrorTypes = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  AUTH: 'auth',
  SERVER: 'server',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown'
};

// Categorize error by type
export function categorizeError(error) {
  const message = error?.message?.toLowerCase() || '';
  
  if (!navigator.onLine || message.includes('network') || message.includes('fetch')) {
    return ErrorTypes.NETWORK;
  }
  if (message.includes('unauthorized') || message.includes('401') || message.includes('forbidden')) {
    return ErrorTypes.AUTH;
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return ErrorTypes.TIMEOUT;
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorTypes.VALIDATION;
  }
  if (message.includes('500') || message.includes('server')) {
    return ErrorTypes.SERVER;
  }
  return ErrorTypes.UNKNOWN;
}

// User-friendly error messages
const errorMessages = {
  [ErrorTypes.NETWORK]: 'Unable to connect. Please check your internet connection and try again.',
  [ErrorTypes.AUTH]: 'Your session has expired. Please log in again.',
  [ErrorTypes.TIMEOUT]: 'The request took too long. Please try again.',
  [ErrorTypes.VALIDATION]: 'Please check your input and try again.',
  [ErrorTypes.SERVER]: 'Something went wrong on our end. Please try again later.',
  [ErrorTypes.UNKNOWN]: 'An unexpected error occurred. Please try again.'
};

// Get user-friendly message
export function getUserFriendlyMessage(error) {
  const type = categorizeError(error);
  return errorMessages[type] || errorMessages[ErrorTypes.UNKNOWN];
}

// Log error for debugging (could send to monitoring service)
export function logError(error, context = {}) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    type: categorizeError(error),
    message: error?.message || 'Unknown error',
    stack: error?.stack,
    context,
    userAgent: navigator.userAgent,
    url: window.location.href,
    online: navigator.onLine
  };
  
  // In production, send to monitoring service
  console.error('[Error Log]', errorLog);
  
  // Store in sessionStorage for debugging (last 10 errors)
  try {
    const storedErrors = JSON.parse(sessionStorage.getItem('errorLog') || '[]');
    storedErrors.unshift(errorLog);
    sessionStorage.setItem('errorLog', JSON.stringify(storedErrors.slice(0, 10)));
  } catch (e) {
    // Ignore storage errors
  }
  
  return errorLog;
}

// Show error toast with appropriate styling
export function showErrorToast(error, options = {}) {
  const type = categorizeError(error);
  const message = options.customMessage || getUserFriendlyMessage(error);
  
  const toastOptions = {
    duration: type === ErrorTypes.NETWORK ? 5000 : 4000,
    ...options
  };

  if (type === ErrorTypes.NETWORK) {
    toast.error(message, {
      ...toastOptions,
      action: {
        label: 'Retry',
        onClick: options.onRetry
      }
    });
  } else if (type === ErrorTypes.AUTH) {
    toast.error(message, {
      ...toastOptions,
      action: {
        label: 'Log in',
        onClick: () => window.location.reload()
      }
    });
  } else {
    toast.error(message, toastOptions);
  }
}

// Retry wrapper with exponential backoff
export async function withRetry(fn, options = {}) {
  const { 
    maxRetries = 3, 
    baseDelay = 1000, 
    maxDelay = 10000,
    onRetry,
    shouldRetry = (error) => categorizeError(error) === ErrorTypes.NETWORK
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      onRetry?.(attempt + 1, delay, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Safe async wrapper that catches errors
export function safeAsync(fn, options = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, { function: fn.name, args: options.logArgs ? args : undefined });
      
      if (options.showToast !== false) {
        showErrorToast(error, { onRetry: options.onRetry });
      }
      
      if (options.fallback !== undefined) {
        return options.fallback;
      }
      
      if (options.rethrow) {
        throw error;
      }
      
      return null;
    }
  };
}

// Network status hook helper
export function setupNetworkListeners(onOnline, onOffline) {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

// Validation error formatter
export function formatValidationErrors(errors) {
  if (typeof errors === 'string') return errors;
  if (Array.isArray(errors)) return errors.join('. ');
  if (typeof errors === 'object') {
    return Object.entries(errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join('. ');
  }
  return 'Validation failed';
}

// Safe JSON parse with fallback
export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Debounced error handler to prevent spam
let errorTimeout = null;
export function debouncedErrorToast(error, delay = 1000) {
  if (errorTimeout) return;
  
  showErrorToast(error);
  errorTimeout = setTimeout(() => {
    errorTimeout = null;
  }, delay);
}