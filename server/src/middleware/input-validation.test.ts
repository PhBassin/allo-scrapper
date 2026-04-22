import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { validateInputSize } from './input-validation.js';

describe('Middleware: validateInputSize', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
  });

  it('should allow requests within limits', async () => {
    app.use(express.json());
    app.post('/test', validateInputSize({ maxStringLength: 10 }), (req, res) => {
      res.status(200).json({ success: true });
    });

    const res = await request(app)
      .post('/test')
      .send({ name: 'Short' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('should block requests exceeding maxTotalSize based on Content-Length', async () => {
    app.use(validateInputSize({ maxTotalSize: 10 }));
    app.use(express.json());
    app.post('/test', (req, res) => {
      res.status(200).json({ success: true });
    });

    const res = await request(app)
      .post('/test')
      .set('Content-Length', '100')
      // Don't actually send a large body to avoid hang in supertest
      .send({ a: 1 })
      .expect(413);

    expect(res.body.error).toBe('Request payload too large');
  });

  it('should block body string parameters exceeding maxStringLength', async () => {
    app.use(express.json());
    app.post('/test', validateInputSize({ maxStringLength: 5 }), (req, res) => {
      res.status(200).json({ success: true });
    });

    const res = await request(app)
      .post('/test')
      .send({ name: 'TooLongString' })
      .expect(400);

    expect(res.body.error).toContain('too long');
  });

  it('should block query string parameters exceeding maxStringLength', async () => {
    app.get('/test', validateInputSize({ maxStringLength: 5 }), (req, res) => {
      res.status(200).json({ success: true });
    });

    const res = await request(app)
      .get('/test?search=TooLongString')
      .expect(400);

    expect(res.body.error).toContain('too long');
  });

  it('should block body array parameters exceeding maxArrayLength', async () => {
    app.use(express.json());
    app.post('/test', validateInputSize({ maxArrayLength: 2 }), (req, res) => {
      res.status(200).json({ success: true });
    });

    const res = await request(app)
      .post('/test')
      .send({ ids: [1, 2, 3] })
      .expect(400);

    expect(res.body.error).toContain('too many items');
  });

  it('should allow large base64 strings if they start with data:image/', async () => {
    app.use(express.json({ limit: '10mb' }));
    app.post('/test', validateInputSize({ maxStringLength: 100 }), (req, res) => {
      res.status(200).json({ success: true });
    });

    const largeBase64 = 'data:image/png;base64,' + 'a'.repeat(200);

    const res = await request(app)
      .post('/test')
      .send({ image: largeBase64 })
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});
