import sharp from 'sharp';
import { logger } from './logger.js';

export interface ImageValidationResult {
  valid: boolean;
  compressedBase64?: string;
  error?: string;
  originalSize?: number;
  compressedSize?: number;
}

/**
 * Validates and compresses an image
 * @param imageData - Base64 string (with or without data URL prefix)
 * @param type - Image type for logging (e.g., 'logo', 'favicon')
 * @param maxSizeBytes - Maximum allowed size in bytes
 * @returns Validation result with compressed image if successful
 */
export async function validateImage(
  imageData: string | null | undefined,
  type: string,
  maxSizeBytes: number
): Promise<ImageValidationResult> {
  // Check for empty/null/undefined
  if (!imageData || imageData.trim().length === 0) {
    return {
      valid: false,
      error: 'Image data is empty',
    };
  }

  try {
    // Extract base64 data (remove data URL prefix if present)
    let base64Data = imageData.trim();

    // Handle data URL format (allow for whitespace in the pattern)
    const dataUrlMatch = base64Data.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/s);
    if (dataUrlMatch) {
      base64Data = dataUrlMatch[2];
    } else if (base64Data.startsWith('data:')) {
      // Unsupported format
      return {
        valid: false,
        error: 'Unsupported format. Only PNG and JPEG are supported.',
      };
    }

    // Remove any whitespace from base64 data
    base64Data = base64Data.replace(/\s/g, '');

    // Decode base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    const originalSize = buffer.length;

    // Validate with sharp
    let image: sharp.Sharp;
    try {
      image = sharp(buffer);
      const metadata = await image.metadata();

      // Verify it's a supported format
      if (metadata.format !== 'png' && metadata.format !== 'jpeg') {
        return {
          valid: false,
          error: `Unsupported format: ${metadata.format}. Only PNG and JPEG are supported.`,
        };
      }
    } catch (err) {
      logger.warn(`Invalid image data for ${type}:`, err);
      return {
        valid: false,
        error: 'Invalid image data. Could not parse image.',
      };
    }

    // Compress the image
    const metadata = await image.metadata();
    let compressed: Buffer;

    if (metadata.format === 'png') {
      compressed = await image
        .png({ compressionLevel: 9, quality: 80 })
        .toBuffer();
    } else {
      // JPEG
      compressed = await image
        .jpeg({ quality: 80, progressive: true })
        .toBuffer();
    }

    const compressedSize = compressed.length;

    // Check if compressed size is within limit
    if (compressedSize > maxSizeBytes) {
      return {
        valid: false,
        error: `Image exceeds maximum size of ${Math.round(maxSizeBytes / 1024)}KB even after compression (compressed: ${Math.round(compressedSize / 1024)}KB)`,
        originalSize,
        compressedSize,
      };
    }

    // Convert compressed buffer back to base64 data URL
    const compressedBase64 = compressed.toString('base64');
    const outputMimeType = metadata.format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${outputMimeType};base64,${compressedBase64}`;

    logger.debug(`Image ${type} validated and compressed: ${originalSize} → ${compressedSize} bytes`);

    return {
      valid: true,
      compressedBase64: dataUrl,
      originalSize,
      compressedSize,
    };
  } catch (err) {
    logger.error(`Image validation error for ${type}:`, err);
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown error during image validation',
    };
  }
}
