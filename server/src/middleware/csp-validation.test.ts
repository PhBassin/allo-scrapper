import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

  describe('upgrade-insecure-requests directive (env-gated)', () => {
    // Helmet 8.x enables upgrade-insecure-requests by default in its CSP.
    // We must explicitly disable it outside production, otherwise browsers
    // force http:// → https:// on HTTP-only deploys (e.g. local Docker, dev
    // VPS without TLS), producing TLS handshake errors.
    // See: https://helmetjs.github.io/ (CSP section).
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should NOT include upgrade-insecure-requests when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development';
      const app = createApp();
      const response = await request(app).get('/api/health');
      const cspHeader = response.headers['content-security-policy'];

      expect(cspHeader).toBeDefined();
      expect(cspHeader).not.toContain('upgrade-insecure-requests');
    });

    it('should include upgrade-insecure-requests when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      const app = createApp();
      const response = await request(app).get('/api/health');
      const cspHeader = response.headers['content-security-policy'];

      expect(cspHeader).toBeDefined();
      expect(cspHeader).toContain('upgrade-insecure-requests');
    });
  });
});
