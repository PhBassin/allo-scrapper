// Custom error classes for HTTP and rate limiting errors

/**
 * HTTP error with preserved status code and URL context
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public url: string
  ) {
    super(message);
    this.name = 'HttpError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
  }
}

/**
 * Rate limit error (HTTP 429) - extends HttpError
 */
export class RateLimitError extends HttpError {
  constructor(message: string, statusCode: number, url: string) {
    super(message, statusCode, url);
    this.name = 'RateLimitError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RateLimitError);
    }
  }
}
