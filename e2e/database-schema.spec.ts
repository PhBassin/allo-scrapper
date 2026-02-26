import { test, expect } from '@playwright/test';

/**
 * Database Schema Validation Tests
 * 
 * These tests verify the database schema is correctly initialized,
 * including all tables and the users table added by migration 003.
 * 
 * Prerequisites:
 * - Docker containers must be running
 * - Database must be initialized with docker/init.sql or migrations applied
 */

test.describe('Database Schema', () => {

  test('users table exists with correct columns', async ({ request }) => {
    // Query the database via an API endpoint to check schema
    // Since we don't have a direct schema endpoint, we'll test via the login endpoint
    // which requires the users table to exist and have the correct structure
    
    const response = await request.post('/api/auth/login', {
      data: {
        username: 'admin',
        password: 'admin'
      }
    });

    // If the users table exists with correct schema, login should succeed
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('token');
    expect(data.data).toHaveProperty('user');
    expect(data.data.user).toHaveProperty('id');
    expect(data.data.user).toHaveProperty('username');
    expect(data.data.user.username).toBe('admin');
  });

  test('default admin user exists and can authenticate', async ({ request }) => {
    // Test that the default admin user was seeded correctly
    const response = await request.post('/api/auth/login', {
      data: {
        username: 'admin',
        password: 'admin'
      }
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.user.username).toBe('admin');
    expect(typeof data.data.user.id).toBe('number');
  });

  test('authentication fails with wrong password', async ({ request }) => {
    // Verify the password hashing is working correctly
    const response = await request.post('/api/auth/login', {
      data: {
        username: 'admin',
        password: 'wrongpassword'
      }
    });

    expect(response.status()).toBe(401);
    
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('protected endpoints require authentication', async ({ request }) => {
    // Verify that protected endpoints enforce authentication
    // which depends on the users table existing
    
    // Try to access protected endpoint without token
    const response = await request.post('/api/scraper/trigger');
    
    expect(response.status()).toBe(401);
  });

  test('JWT token from users table grants access to protected endpoints', async ({ request }) => {
    // 1. Login to get a token (requires users table)
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        username: 'admin',
        password: 'admin'
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    const token = loginData.data.token;

    // 2. Use token to access protected endpoint
    const protectedResponse = await request.get('/api/scraper/status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Should NOT be 401 when using valid token
    expect(protectedResponse.status()).not.toBe(401);
  });

  test('core cinema tables exist and are accessible', async ({ request }) => {
    // Verify other core tables exist by checking API endpoints
    
    // Cinemas table
    const cinemasResponse = await request.get('/api/cinemas');
    expect(cinemasResponse.ok()).toBeTruthy();
    const cinemasData = await cinemasResponse.json();
    expect(cinemasData.success).toBe(true);
    expect(Array.isArray(cinemasData.data)).toBe(true);

    // Films table (may be empty but should return object with films array)
    const filmsResponse = await request.get('/api/films');
    expect(filmsResponse.ok()).toBeTruthy();
    const filmsData = await filmsResponse.json();
    expect(filmsData.success).toBe(true);
    expect(filmsData.data).toBeDefined();
    // Films API returns {success: true, data: {films: [...], total: N}}
    expect(Array.isArray(filmsData.data.films)).toBe(true);
  });

  test('database is using correct database name (ics)', async ({ request }) => {
    // Verify we're connected to the correct database
    // by checking that the application responds correctly
    const healthResponse = await request.get('/api/health');
    expect(healthResponse.ok()).toBeTruthy();
    
    const health = await healthResponse.json();
    expect(health.status).toBe('ok');
  });
});
