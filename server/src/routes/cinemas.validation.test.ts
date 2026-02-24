import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cinemaConfig from '../services/cinema-config.js';
import router from './cinemas.js';

// Mock dependencies
vi.mock('../db/client.js', () => ({
  db: { query: vi.fn() }
}));

vi.mock('../services/cinema-config.js', () => ({
  addCinemaWithSync: vi.fn(),
  updateCinemaWithSync: vi.fn(),
  deleteCinemaWithSync: vi.fn(),
  syncCinemasFromDatabase: vi.fn(),
}));

vi.mock('../services/scraper/index.js', () => ({
  addCinemaAndScrape: vi.fn(),
}));

vi.mock('../services/scraper/utils.js', () => ({
  isValidAllocineUrl: vi.fn().mockImplementation((url) => url.startsWith('https://www.allocine.fr/')),
}));

describe('Routes - Cinemas - Validation', () => {
  let mockRes: any;
  let mockReq: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn();
  });

  const getHandler = (method: string, path: string) => {
    return router.stack.find(s => s.route?.path === path && s.route?.methods[method])?.route.stack[0].handle;
  };

  it('should reject POST with invalid ID format (non-alphanumeric)', async () => {
    mockReq = {
      body: {
        id: 'invalid-id!',
        name: 'Test Cinema',
        url: 'https://www.allocine.fr/test'
      }
    };

    const handler = getHandler('post', '/');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Invalid ID format. Must be alphanumeric string.')
    }));
    expect(cinemaConfig.addCinemaWithSync).not.toHaveBeenCalled();
  });

  it('should reject POST with ID too long', async () => {
    mockReq = {
      body: {
        id: 'A'.repeat(21),
        name: 'Test Cinema',
        url: 'https://www.allocine.fr/test'
      }
    };

    const handler = getHandler('post', '/');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('ID is too long')
    }));
  });

  it('should reject POST with Name too long', async () => {
    mockReq = {
      body: {
        id: 'C001',
        name: 'A'.repeat(101),
        url: 'https://www.allocine.fr/test'
      }
    };

    const handler = getHandler('post', '/');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Name must be a string between')
    }));
  });

   it('should reject PUT with Name too long', async () => {
    mockReq = {
      params: { id: 'C001' },
      body: {
        name: 'A'.repeat(101)
      }
    };

    const handler = getHandler('put', '/:id');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Name must be a string between')
    }));
  });
});
