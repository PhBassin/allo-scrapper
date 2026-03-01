import { describe, it, expect } from 'vitest';
import { validateImage, ImageValidationError } from './image-validator.js';

describe('validateImage', () => {
  describe('valid images', () => {
    it('should accept valid PNG image under size limit', async () => {
      // 1x1 transparent PNG (68 bytes)
      const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const result = await validateImage(validPng, 'logo', 200000);
      expect(result.valid).toBe(true);
      expect(result.compressedBase64).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should accept valid JPEG image under size limit', async () => {
      // Minimal JPEG (134 bytes)
      const validJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
      
      const result = await validateImage(validJpeg, 'favicon', 50000);
      expect(result.valid).toBe(true);
      expect(result.compressedBase64).toBeDefined();
    });

    it('should return compressed version when image exceeds size limit', async () => {
      // Simulate large image by repeating base64 data
      const largePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.repeat(100);
      
      const result = await validateImage(largePng, 'logo', 200000);
      expect(result.valid).toBe(true);
      expect(result.compressedBase64).toBeDefined();
      // Compressed version should be smaller
      expect(result.compressedBase64!.length).toBeLessThan(largePng.length);
    });

    it('should handle image without data URL prefix', async () => {
      const base64Only = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const result = await validateImage(base64Only, 'logo', 200000);
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid images', () => {
    it('should reject empty string', async () => {
      const result = await validateImage('', 'logo', 200000);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Image data is empty');
    });

    it('should reject null or undefined', async () => {
      const resultNull = await validateImage(null as any, 'logo', 200000);
      expect(resultNull.valid).toBe(false);
      expect(resultNull.error).toBe('Image data is empty');

      const resultUndefined = await validateImage(undefined as any, 'logo', 200000);
      expect(resultUndefined.valid).toBe(false);
      expect(resultUndefined.error).toBe('Image data is empty');
    });

    it('should reject invalid base64 data', async () => {
      const invalidBase64 = 'data:image/png;base64,!!!invalid!!!';
      
      const result = await validateImage(invalidBase64, 'logo', 200000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid image');
    });

    it('should reject unsupported image formats', async () => {
      const svgData = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==';
      
      const result = await validateImage(svgData, 'logo', 200000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });

    it('should reject corrupted image data', async () => {
      const corruptedPng = 'data:image/png;base64,iVBORw0KGgoAAAANSU';
      
      const result = await validateImage(corruptedPng, 'logo', 200000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid image');
    });

    it('should reject when compressed image still exceeds size limit', async () => {
      // For this test, we'll use a very small size limit to simulate
      // a case where even the compressed image is too large
      const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      // Set max size to only 10 bytes - smaller than any valid PNG
      const result = await validateImage(validPng, 'logo', 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum size');
    });
  });

  describe('size limits', () => {
    it('should enforce logo size limit of 200KB', async () => {
      const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const result = await validateImage(validPng, 'logo', 200000);
      expect(result.valid).toBe(true);
    });

    it('should enforce favicon size limit of 50KB', async () => {
      const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const result = await validateImage(validPng, 'favicon', 50000);
      expect(result.valid).toBe(true);
    });
  });

  describe('compression', () => {
    it('should compress PNG images', async () => {
      const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const result = await validateImage(validPng, 'logo', 200000);
      expect(result.valid).toBe(true);
      expect(result.compressedBase64).toContain('data:image/png;base64,');
    });

    it('should compress JPEG images', async () => {
      const validJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
      
      const result = await validateImage(validJpeg, 'logo', 200000);
      expect(result.valid).toBe(true);
      expect(result.compressedBase64).toContain('data:image/jpeg;base64,');
    });

    it('should preserve data URL format in compressed output', async () => {
      const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const result = await validateImage(validPng, 'logo', 200000);
      expect(result.compressedBase64).toMatch(/^data:image\/(png|jpeg);base64,/);
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace in base64 data', async () => {
      const withWhitespace = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB\nCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const result = await validateImage(withWhitespace, 'logo', 200000);
      expect(result.valid).toBe(true);
    });

    it('should calculate size correctly for data URLs', async () => {
      // Base64 encoding increases size by ~33%
      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const dataUrl = `data:image/png;base64,${base64}`;
      
      const result = await validateImage(dataUrl, 'logo', 200000);
      expect(result.valid).toBe(true);
    });
  });
});

// Export error class for testing
export { ImageValidationError };
