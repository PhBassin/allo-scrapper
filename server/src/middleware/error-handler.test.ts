import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from './error-handler.js';

describe('errorHandler middleware', () => {
  it('should handle SyntaxError from express.json() with 400 status', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', (req, res) => {
      res.status(200).json({ success: true });
    });
    app.use(errorHandler);

    // Send malformed JSON string directly
    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send('{"invalid": json}'); 

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Invalid JSON payload'
    });
  });
});
