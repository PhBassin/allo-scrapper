// Tests for error classification utility

import { describe, it, expect } from 'vitest';
import { classifyError } from './error-classifier.js';
import { HttpError, RateLimitError } from './errors.js';

describe('Error Classifier', () => {
  describe('classifyError', () => {
    it('should classify RateLimitError as http_429', () => {
      const error = new RateLimitError(
        'Rate limit exceeded',
        429,
        'https://www.allocine.fr/example'
      );
      expect(classifyError(error)).toBe('http_429');
    });

    it('should classify HttpError with 5xx as http_5xx', () => {
      const error500 = new HttpError('Server error', 500, 'https://example.com');
      expect(classifyError(error500)).toBe('http_5xx');

      const error503 = new HttpError('Service unavailable', 503, 'https://example.com');
      expect(classifyError(error503)).toBe('http_5xx');

      const error502 = new HttpError('Bad gateway', 502, 'https://example.com');
      expect(classifyError(error502)).toBe('http_5xx');
    });

    it('should classify HttpError with 4xx (non-429) as http_4xx', () => {
      const error404 = new HttpError('Not found', 404, 'https://example.com');
      expect(classifyError(error404)).toBe('http_4xx');

      const error403 = new HttpError('Forbidden', 403, 'https://example.com');
      expect(classifyError(error403)).toBe('http_4xx');

      const error400 = new HttpError('Bad request', 400, 'https://example.com');
      expect(classifyError(error400)).toBe('http_4xx');
    });

    it('should classify errors with "timeout" in message as timeout', () => {
      const error = new Error('Request timeout after 60s');
      expect(classifyError(error)).toBe('timeout');

      const error2 = new Error('page.goto: Timeout 60000ms exceeded');
      expect(classifyError(error2)).toBe('timeout');
    });

    it('should classify errors with "network" in message as network', () => {
      const error = new Error('Network connection failed');
      expect(classifyError(error)).toBe('network');

      const error2 = new Error('fetch failed: ENOTFOUND');
      expect(classifyError(error2)).toBe('network');
    });

    it('should classify unknown errors as parse', () => {
      const error = new Error('Unexpected token in JSON');
      expect(classifyError(error)).toBe('parse');

      const error2 = new Error('Invalid HTML structure');
      expect(classifyError(error2)).toBe('parse');
    });

    it('should classify non-Error objects as parse', () => {
      expect(classifyError('string error')).toBe('parse');
      expect(classifyError(123)).toBe('parse');
      expect(classifyError(null)).toBe('parse');
      expect(classifyError(undefined)).toBe('parse');
    });

    it('should prioritize RateLimitError over generic 429 check', () => {
      // Even if message contains "429", should detect RateLimitError class
      const error = new RateLimitError('HTTP 429', 429, 'https://example.com');
      expect(classifyError(error)).toBe('http_429');
    });

    it('should handle Error objects without message', () => {
      const error = new Error();
      expect(classifyError(error)).toBe('parse');
    });
  });
});
