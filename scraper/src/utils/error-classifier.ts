// Utility to classify errors into categories for structured reporting

import { HttpError, RateLimitError } from './errors.js';

/**
 * Error types for structured error reporting
 */
export type ErrorType = 'http_429' | 'http_5xx' | 'http_4xx' | 'network' | 'parse' | 'timeout';

/**
 * Classify an error into a structured error type
 *
 * @param error - The error to classify
 * @returns Error type string for reporting
 */
export function classifyError(error: unknown): ErrorType {
  // Check for RateLimitError first (most specific)
  if (error instanceof RateLimitError) {
    return 'http_429';
  }

  // Check for other HttpError types
  if (error instanceof HttpError) {
    if (error.statusCode >= 500 && error.statusCode < 600) {
      return 'http_5xx';
    }
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return 'http_4xx';
    }
  }

  // Check for timeout errors (Playwright, fetch, etc.)
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('network') || message.includes('enotfound') || message.includes('econnrefused')) {
      return 'network';
    }
  }

  // Default to parse error (JSON parsing, HTML parsing, etc.)
  return 'parse';
}
