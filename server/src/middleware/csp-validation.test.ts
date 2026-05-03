import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Content Security Policy', () => {
  it('should not allow unsafe-inline in script-src', async () => {
    const app = createApp();
    const response = await request(app).get('/api/health');
    
    const cspHeader = response.headers['content-security-policy'];
    expect(cspHeader).toBeDefined();
    
    // Extract script-src directive
    const scriptSrcMatch = cspHeader.match(/script-src[^;]+/);
    expect(scriptSrcMatch).toBeDefined();
    
    const scriptSrc = scriptSrcMatch![0];
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('should set secure CSP directives', async () => {
    const app = createApp();
    const response = await request(app).get('/api/health');
    const cspHeader = response.headers['content-security-policy'];
    
    expect(cspHeader).toContain("default-src 'self'");
    expect(cspHeader).toContain("script-src 'self'");
    expect(cspHeader).toContain("object-src 'none'");
    expect(cspHeader).toContain("base-uri 'self'");
  });

  it('should allow inline styles for React components', async () => {
    const app = createApp();
    const response = await request(app).get('/api/health');
    const cspHeader = response.headers['content-security-policy'];
    
    // style-src needs unsafe-inline for React inline styles
    const styleSrcMatch = cspHeader.match(/style-src[^;]+/);
    expect(styleSrcMatch).toBeDefined();
    expect(styleSrcMatch![0]).toContain("'unsafe-inline'");
  });

  it('should restrict form submissions to same origin', async () => {
    const app = createApp();
    const response = await request(app).get('/api/health');
    const cspHeader = response.headers['content-security-policy'];

    expect(cspHeader).toContain("form-action 'self'");
  });

  it('should prevent clickjacking via frame-ancestors none', async () => {
    const app = createApp();
    const response = await request(app).get('/api/health');
    const cspHeader = response.headers['content-security-policy'];

    expect(cspHeader).toContain("frame-ancestors 'none'");
  });
});
