
import { describe, it, expect } from 'vitest';
import { validateImage } from './image-validator.js';

describe('validateImage - Security/Performance', () => {
  it('should reject extremely large base64 strings before processing to prevent DoS', async () => {
    // Create a string larger than the 2MB limit (e.g., 3MB)
    const hugeString = 'a'.repeat(3 * 1024 * 1024);
    
    const result = await validateImage(hugeString, 'logo', 200000);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Image data exceeds maximum allowed input length');
  });
});
