import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { DEFAULT_TRUST_PROXY, parseTrustProxy } from './trust-proxy.js';

describe('parseTrustProxy', () => {
  it('defaults to private networks when unset or blank', () => {
    expect(parseTrustProxy(undefined)).toEqual(DEFAULT_TRUST_PROXY);
    expect(parseTrustProxy('')).toEqual(DEFAULT_TRUST_PROXY);
    expect(parseTrustProxy('   ')).toEqual(DEFAULT_TRUST_PROXY);
    expect(DEFAULT_TRUST_PROXY).toEqual(['loopback', 'linklocal', 'uniquelocal']);
  });

  it('parses booleans case-insensitively', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('FALSE')).toBe(false);
    expect(parseTrustProxy(' True ')).toBe(true);
  });

  it('parses a hop count', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('0')).toBe(0);
    expect(parseTrustProxy(' 2 ')).toBe(2);
  });

  it('parses a comma-separated list of addresses, subnets and keywords', () => {
    expect(parseTrustProxy('loopback, 10.0.0.0/8 ,fc00::/7,,')).toEqual(['loopback', '10.0.0.0/8', 'fc00::/7']);
    expect(parseTrustProxy('203.0.113.7')).toEqual(['203.0.113.7']);
  });

  it('rejects values Express would misread', () => {
    expect(() => parseTrustProxy('-1')).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy('1.5')).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy('not-an-ip')).toThrow(/TRUST_PROXY/);
  });
});

describe('trust proxy resolution of req.ip', () => {
  function ipApp(trustProxy: string | undefined) {
    const app = express();
    app.set('trust proxy', parseTrustProxy(trustProxy));
    app.get('/ip', (req, res) => res.json({ ip: req.ip }));
    return app;
  }

  it('ignores a forged X-Forwarded-For from a client outside the trusted networks', async () => {
    // supertest connects from loopback, so trusting only another range stands in for a public client
    const res = await request(ipApp('10.0.0.0/8')).get('/ip').set('X-Forwarded-For', '198.51.100.9');
    expect(res.body.ip).not.toBe('198.51.100.9');
    expect(res.body.ip).toMatch(/127\.0\.0\.1|::1/);
  });

  it('uses the forwarded client IP behind a reverse proxy on a private network (default)', async () => {
    const res = await request(ipApp(undefined)).get('/ip').set('X-Forwarded-For', '198.51.100.9');
    expect(res.body.ip).toBe('198.51.100.9');
  });

  it('only trusts the private hops of a spoofed chain by default', async () => {
    // The client prepends a fake address; the proxy appends the real one it saw.
    const res = await request(ipApp(undefined)).get('/ip').set('X-Forwarded-For', '1.2.3.4, 198.51.100.9');
    expect(res.body.ip).toBe('198.51.100.9');
  });

  it('ignores X-Forwarded-For entirely when set to false', async () => {
    const res = await request(ipApp('false')).get('/ip').set('X-Forwarded-For', '198.51.100.9');
    expect(res.body.ip).toMatch(/127\.0\.0\.1|::1/);
  });
});
