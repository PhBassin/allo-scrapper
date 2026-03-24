// Tests for HTTP client error handling

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchShowtimesJson, fetchFilmPage } from './http-client.js';
import { HttpError, RateLimitError } from '../utils/errors.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('HTTP Client - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchShowtimesJson', () => {
    describe('HTTP 429 Rate Limit', () => {
      it('should throw RateLimitError on 429 response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        });

        await expect(fetchShowtimesJson('C0072', '2026-03-24')).rejects.toThrow(
          RateLimitError
        );
      });

      it('should preserve status code in RateLimitError', async () => {
        const testUrl = 'https://www.allocine.fr/_/showtimes/theater-C0072/d-2026-03-24/';
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        });

        try {
          await fetchShowtimesJson('C0072', '2026-03-24');
          expect.fail('Should have thrown RateLimitError');
        } catch (error) {
          expect(error).toBeInstanceOf(RateLimitError);
          expect((error as RateLimitError).statusCode).toBe(429);
          expect((error as RateLimitError).url).toContain('theater-C0072');
        }
      });

      it('should include meaningful error message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        });

        await expect(fetchShowtimesJson('C0072', '2026-03-24')).rejects.toThrow(
          /rate limit/i
        );
      });
    });

    describe('HTTP 5xx Server Errors', () => {
      it('should throw HttpError on 503 response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        });

        await expect(fetchShowtimesJson('C0072', '2026-03-24')).rejects.toThrow(
          HttpError
        );
      });

      it('should preserve status code in HttpError for 500', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        try {
          await fetchShowtimesJson('C0072', '2026-03-24');
          expect.fail('Should have thrown HttpError');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpError);
          expect((error as HttpError).statusCode).toBe(500);
        }
      });
    });

    describe('HTTP 4xx Client Errors', () => {
      it('should throw HttpError on 404 response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        await expect(fetchShowtimesJson('C0072', '2026-03-24')).rejects.toThrow(
          HttpError
        );
      });

      it('should throw HttpError on 403 response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        });

        try {
          await fetchShowtimesJson('C0072', '2026-03-24');
          expect.fail('Should have thrown HttpError');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpError);
          expect((error as HttpError).statusCode).toBe(403);
        }
      });
    });

    describe('Success Cases', () => {
      it('should succeed on 200 OK response', async () => {
        const mockData = { results: [], theater: { name: 'Test Cinema' } };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        });

        const result = await fetchShowtimesJson('C0072', '2026-03-24');
        expect(result).toEqual(mockData);
      });
    });
  });

  describe('fetchFilmPage', () => {
    describe('HTTP 429 Rate Limit', () => {
      it('should throw RateLimitError on 429 response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        });

        await expect(fetchFilmPage(12345)).rejects.toThrow(RateLimitError);
      });

      it('should preserve status code in RateLimitError', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        });

        try {
          await fetchFilmPage(12345);
          expect.fail('Should have thrown RateLimitError');
        } catch (error) {
          expect(error).toBeInstanceOf(RateLimitError);
          expect((error as RateLimitError).statusCode).toBe(429);
          expect((error as RateLimitError).url).toContain('12345');
        }
      });
    });

    describe('HTTP 5xx Server Errors', () => {
      it('should throw HttpError on 500 response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        try {
          await fetchFilmPage(12345);
          expect.fail('Should have thrown HttpError');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpError);
          expect((error as HttpError).statusCode).toBe(500);
        }
      });
    });

    describe('Success Cases', () => {
      it('should succeed on 200 OK response', async () => {
        const mockHtml = '<html><body>Film Page</body></html>';
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => mockHtml,
        });

        const result = await fetchFilmPage(12345);
        expect(result).toBe(mockHtml);
      });
    });
  });
});
