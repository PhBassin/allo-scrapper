import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cinemaConfig from '../services/cinema-config.js';
import router from './cinemas.js';
import { db } from '../db/client.js';

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

// Helper to get the actual route handler (skips middleware like rate limiters)
function getRouteHandler(path: string, method: 'get' | 'post' | 'put' | 'delete') {
  const route = router.stack.find(s => s.route?.path === path && s.route?.methods[method])?.route;
  return route?.stack[route.stack.length - 1]?.handle;
}

describe('Routes - Cinemas - Validation', () => {
  let mockRes: any;
  let mockReq: any;
  let mockNext: any;
  let mockApp: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApp = {
      get: vi.fn((key: string) => {
        if (key === 'db') return db;
        return undefined;
      })
    };
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn();
  });



  it('should reject POST with invalid ID format (non-alphanumeric)', async () => {
    mockReq = {
      body: {
        id: 'invalid-id!',
        name: 'Test Cinema',
        url: 'https://www.allocine.fr/test'
      },
      app: mockApp
    };

    const handler = getRouteHandler('/', 'post');
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
      },
      app: mockApp
    };

    const handler = getRouteHandler('/', 'post');
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
      },
      app: mockApp
    };

    const handler = getRouteHandler('/', 'post');
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
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Name must be a string between')
    }));
  });
});
