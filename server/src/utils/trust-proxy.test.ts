import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { logger } from './logger.js';
import { DEFAULT_TRUST_PROXY, parseTrustProxy, warnOnceOnUntrustedForwardedFor } from './trust-proxy.js';

vi.mock('./logger.js');

describe('parseTrustProxy', () => {
  it('defaults to trusting no proxy when unset or blank', () => {
    expect(DEFAULT_TRUST_PROXY).toBe(false);
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('   ')).toBe(false);
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
    expect(() => parseTrustProxy('99999999999999999999')).toThrow(/TRUST_PROXY/);
  });

  it('rejects ranges proxy-addr would refuse with a TRUST_PROXY error', () => {
    expect(() => parseTrustProxy('10.0.0.0/0')).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy('::/0')).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy('10.0.0.0/33')).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy('10.0.0.0/255.0.255.0')).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy('10.0.0.0/0.0.0.0')).toThrow(/TRUST_PROXY/);
  });

  it('accepts every value it validates as a valid Express setting', () => {
    for (const value of ['10.0.0.0/255.0.0.0', '10.0.0.0/255.255.255.255', '10.0.0.0/1', '::1/128', '1', '0']) {
      expect(() => express().set('trust proxy', parseTrustProxy(value))).not.toThrow();
    }
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

  it('ignores X-Forwarded-For by default', async () => {
    const res = await request(ipApp(undefined)).get('/ip').set('X-Forwarded-For', '198.51.100.9');
    expect(res.body.ip).toMatch(/127\.0\.0\.1|::1/);
  });

  it('uses the forwarded client IP behind one trusted proxy', async () => {
    const res = await request(ipApp('1')).get('/ip').set('X-Forwarded-For', '198.51.100.9');
    expect(res.body.ip).toBe('198.51.100.9');
  });

  it('only trusts the entry the proxy appended in a spoofed chain', async () => {
    // The client prepends a fake address; the proxy appends the real one it saw.
    const res = await request(ipApp('1')).get('/ip').set('X-Forwarded-For', '1.2.3.4, 198.51.100.9');
    expect(res.body.ip).toBe('198.51.100.9');
  });
});

describe('warnOnceOnUntrustedForwardedFor', () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear();
  });

  it('warns once when X-Forwarded-For arrives while trust proxy is off', async () => {
    const app = express();
    app.use(warnOnceOnUntrustedForwardedFor());
    app.get('/', (_req, res) => res.end());

    await request(app).get('/');
    expect(logger.warn).not.toHaveBeenCalled();

    await request(app).get('/').set('X-Forwarded-For', '198.51.100.9');
    await request(app).get('/').set('X-Forwarded-For', '198.51.100.9');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.warn).mock.calls[0][0]).toMatch(/TRUST_PROXY/);
  });
});
