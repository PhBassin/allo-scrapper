import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the validation functions and URL construction logic.
// Network calls are mocked to avoid real HTTP requests.

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock playwright to avoid launching a real browser
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      isConnected: vi.fn().mockReturnValue(true),
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(null),
          content: vi.fn().mockResolvedValue('<html></html>'),
          evaluate: vi.fn().mockResolvedValue([]),
          close: vi.fn(),
        }),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  },
}));

describe('http-client SSRF protections', () => {
  let fetchShowtimesJson: (cinemaId: string, date: string) => Promise<unknown>;
  let fetchFilmPage: (filmId: number) => Promise<string>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../../src/scraper/http-client.js');
    fetchShowtimesJson = mod.fetchShowtimesJson;
    fetchFilmPage = mod.fetchFilmPage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // validateCinemaId
  // -------------------------------------------------------------------------
  describe('validateCinemaId (via fetchShowtimesJson)', () => {
    it('should accept valid cinema IDs like C0072', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchShowtimesJson('C0072', '2024-01-15')).resolves.toBeDefined();
    });

    it('should accept valid cinema IDs like W7517', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchShowtimesJson('W7517', '2024-01-15')).resolves.toBeDefined();
    });

    it('should reject IDs with path traversal characters (../)', async () => {
      await expect(fetchShowtimesJson('../etc/passwd', '2024-01-15')).rejects.toThrow(
        /Invalid cinema ID format/
      );
    });

    it('should reject IDs with slashes', async () => {
      await expect(fetchShowtimesJson('C0072/evil', '2024-01-15')).rejects.toThrow(
        /Invalid cinema ID format/
      );
    });

    it('should reject empty cinema ID', async () => {
      await expect(fetchShowtimesJson('', '2024-01-15')).rejects.toThrow(
        /Invalid cinema ID format/
      );
    });

    it('should reject cinema ID with lowercase letters', async () => {
      await expect(fetchShowtimesJson('c0072', '2024-01-15')).rejects.toThrow(
        /Invalid cinema ID format/
      );
    });

    it('should reject cinema ID with injection characters', async () => {
      await expect(fetchShowtimesJson('C0072;evil', '2024-01-15')).rejects.toThrow(
        /Invalid cinema ID format/
      );
    });
  });

  // -------------------------------------------------------------------------
  // validateDate
  // -------------------------------------------------------------------------
  describe('validateDate (via fetchShowtimesJson)', () => {
    it('should accept valid dates like 2024-01-15', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchShowtimesJson('C0072', '2024-01-15')).resolves.toBeDefined();
    });

    it('should reject dates without dashes', async () => {
      await expect(fetchShowtimesJson('C0072', '20240115')).rejects.toThrow(
        /Invalid date format/
      );
    });

    it('should reject dates with slashes', async () => {
      await expect(fetchShowtimesJson('C0072', '2024/01/15')).rejects.toThrow(
        /Invalid date format/
      );
    });

    it('should reject empty date', async () => {
      await expect(fetchShowtimesJson('C0072', '')).rejects.toThrow(
        /Invalid date format/
      );
    });

    it('should reject dates with injection characters', async () => {
      await expect(fetchShowtimesJson('C0072', '2024-01-15; DROP TABLE')).rejects.toThrow(
        /Invalid date format/
      );
    });
  });

  // -------------------------------------------------------------------------
  // validateFilmId
  // -------------------------------------------------------------------------
  describe('validateFilmId (via fetchFilmPage)', () => {
    it('should accept positive integer film IDs', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<html></html>'),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchFilmPage(12345)).resolves.toBeDefined();
    });

    it('should reject negative film IDs', async () => {
      await expect(fetchFilmPage(-1)).rejects.toThrow(/Invalid film ID/);
    });

    it('should reject zero as film ID', async () => {
      await expect(fetchFilmPage(0)).rejects.toThrow(/Invalid film ID/);
    });

    it('should reject NaN as film ID', async () => {
      await expect(fetchFilmPage(NaN)).rejects.toThrow(/Invalid film ID/);
    });

    it('should reject non-integer film IDs', async () => {
      await expect(fetchFilmPage(1.5)).rejects.toThrow(/Invalid film ID/);
    });
  });

  // -------------------------------------------------------------------------
  // SSRF hostname guard — fetchShowtimesJson
  // -------------------------------------------------------------------------
  describe('SSRF hostname guard in fetchShowtimesJson', () => {
    it('should use new URL() construction and call the correct allocine.fr host', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      await fetchShowtimesJson('C0072', '2024-01-15');

      expect(mockFetch).toHaveBeenCalledOnce();
      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toMatch(/^https:\/\/www\.allocine\.fr\//);
      expect(calledUrl).toContain('theater-C0072');
      expect(calledUrl).toContain('d-2024-01-15');
    });
  });

  // -------------------------------------------------------------------------
  // SSRF hostname guard — fetchFilmPage
  // -------------------------------------------------------------------------
  describe('SSRF hostname guard in fetchFilmPage', () => {
    it('should use new URL() construction and call the correct allocine.fr host', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<html></html>'),
      });
      vi.stubGlobal('fetch', mockFetch);

      await fetchFilmPage(12345);

      expect(mockFetch).toHaveBeenCalledOnce();
      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toMatch(/^https:\/\/www\.allocine\.fr\//);
      expect(calledUrl).toContain('12345');
    });
  });
});
