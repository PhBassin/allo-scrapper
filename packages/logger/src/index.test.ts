import { describe, it, expect } from 'vitest';
import { createLogger } from './index.js';

describe('Shared Logger', () => {
  it('should create a logger with the correct service name', () => {
    const serviceName = 'test-service';
    const logger = createLogger(serviceName);
    
    expect(logger.defaultMeta.service).toBe(serviceName);
  });
});
