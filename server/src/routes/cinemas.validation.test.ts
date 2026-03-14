import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as queries from '../db/showtime-queries.js';
import * as cinemaQueries from '../db/cinema-queries.js';
import router from './cinemas.js';
import { db } from '../db/client.js';

// Mock dependencies
vi.mock('../db/client.js', () => ({
  db: { query: vi.fn() }
}));

vi.mock('../db/cinema-queries.js', () => ({
  addCinema: vi.fn(),
  updateCinemaConfig: vi.fn(),
  deleteCinema: vi.fn(),
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
    expect(cinemaQueries.addCinema).not.toHaveBeenCalled();
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

  // --- Tests for new location and screen count fields ---

  it('should reject PUT with address too long (> 200 chars)', async () => {
    mockReq = {
      params: { id: 'C001' },
      body: {
        address: 'A'.repeat(201)
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Address must be at most 200 characters')
    }));
  });

  it('should reject PUT with postal_code too long (> 10 chars)', async () => {
    mockReq = {
      params: { id: 'C001' },
      body: {
        postal_code: 'A'.repeat(11)
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Postal code must be at most 10 characters')
    }));
  });

  it('should reject PUT with postal_code containing invalid characters', async () => {
    mockReq = {
      params: { id: 'C001' },
      body: {
        postal_code: '75001-@!'
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Postal code must be alphanumeric')
    }));
  });

  it('should reject PUT with city too long (> 100 chars)', async () => {
    mockReq = {
      params: { id: 'C001' },
      body: {
        city: 'A'.repeat(101)
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('City must be at most 100 characters')
    }));
  });

  it('should reject PUT with negative screen_count', async () => {
    mockReq = {
      params: { id: 'C001' },
      body: {
        screen_count: -1
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Screen count must be between 1 and 50')
    }));
  });

  it('should reject PUT with zero screen_count', async () => {
    mockReq = {
      params: { id: 'C001' },
      body: {
        screen_count: 0
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Screen count must be between 1 and 50')
    }));
  });

  it('should reject PUT with screen_count > 50', async () => {
    mockReq = {
      params: { id: 'C001' },
      body: {
        screen_count: 51
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Screen count must be between 1 and 50')
    }));
  });

  it('should reject PUT with non-integer screen_count', async () => {
    mockReq = {
      params: { id: 'C001' },
      body: {
        screen_count: 5.5
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Screen count must be an integer')
    }));
  });

  it('should accept PUT with valid address only', async () => {
    vi.mocked(cinemaQueries.updateCinemaConfig).mockResolvedValue({
      id: 'C001',
      name: 'Test Cinema',
      url: 'https://www.allocine.fr/test'
    });

    mockReq = {
      params: { id: 'C001' },
      body: {
        address: '123 Main Street'
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(cinemaQueries.updateCinemaConfig).toHaveBeenCalledWith(db, 'C001', {
      address: '123 Main Street'
    });
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true
    }));
  });

  it('should accept PUT with valid city only', async () => {
    vi.mocked(cinemaQueries.updateCinemaConfig).mockResolvedValue({
      id: 'C001',
      name: 'Test Cinema',
      url: 'https://www.allocine.fr/test'
    });

    mockReq = {
      params: { id: 'C001' },
      body: {
        city: 'Paris'
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(cinemaQueries.updateCinemaConfig).toHaveBeenCalledWith(db, 'C001', {
      city: 'Paris'
    });
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true
    }));
  });

  it('should accept PUT with valid postal_code only', async () => {
    vi.mocked(cinemaQueries.updateCinemaConfig).mockResolvedValue({
      id: 'C001',
      name: 'Test Cinema',
      url: 'https://www.allocine.fr/test'
    });

    mockReq = {
      params: { id: 'C001' },
      body: {
        postal_code: '75001'
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(cinemaQueries.updateCinemaConfig).toHaveBeenCalledWith(db, 'C001', {
      postal_code: '75001'
    });
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true
    }));
  });

  it('should accept PUT with valid screen_count only', async () => {
    vi.mocked(cinemaQueries.updateCinemaConfig).mockResolvedValue({
      id: 'C001',
      name: 'Test Cinema',
      url: 'https://www.allocine.fr/test'
    });

    mockReq = {
      params: { id: 'C001' },
      body: {
        screen_count: 10
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(cinemaQueries.updateCinemaConfig).toHaveBeenCalledWith(db, 'C001', {
      screen_count: 10
    });
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true
    }));
  });

  it('should accept PUT with all location and screen fields together', async () => {
    vi.mocked(cinemaQueries.updateCinemaConfig).mockResolvedValue({
      id: 'C001',
      name: 'Test Cinema',
      url: 'https://www.allocine.fr/test'
    });

    mockReq = {
      params: { id: 'C001' },
      body: {
        address: '123 Main Street',
        postal_code: '75001',
        city: 'Paris',
        screen_count: 10
      },
      app: mockApp
    };

    const handler = getRouteHandler('/:id', 'put');
    await handler(mockReq, mockRes, mockNext);

    expect(cinemaQueries.updateCinemaConfig).toHaveBeenCalledWith(db, 'C001', {
      address: '123 Main Street',
      postal_code: '75001',
      city: 'Paris',
      screen_count: 10
    });
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true
    }));
  });
});
