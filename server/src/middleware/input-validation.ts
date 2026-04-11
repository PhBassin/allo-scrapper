import { Request, Response, NextFunction } from 'express';

export interface ValidationLimits {
  maxStringLength?: number;
  maxArrayLength?: number;
  maxObjectDepth?: number;
  maxTotalSize?: number;
}

const DEFAULT_LIMITS: ValidationLimits = {
  maxStringLength: 1000,
  maxArrayLength: 100,
  maxObjectDepth: 5,
  maxTotalSize: 100 * 1024, // 100KB
};

class ValidationError extends Error {
  constructor(public message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function validateObject(obj: any, limits: ValidationLimits, path: string = '', depth: number = 0) {
  if (!obj || typeof obj !== 'object') return;

  if (limits.maxObjectDepth && depth > limits.maxObjectDepth) {
    throw new ValidationError(`Object depth exceeds limit of ${limits.maxObjectDepth}`, path);
  }

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string') {
      if (limits.maxStringLength && value.length > limits.maxStringLength) {
        throw new ValidationError(`String parameter '${currentPath}' is too long (max ${limits.maxStringLength} chars)`, currentPath);
      }
    } else if (Array.isArray(value)) {
      if (limits.maxArrayLength && value.length > limits.maxArrayLength) {
        throw new ValidationError(`Array parameter '${currentPath}' has too many items (max ${limits.maxArrayLength})`, currentPath);
      }
      // Recursively validate array items
      for (let i = 0; i < value.length; i++) {
        validateObject(value[i], limits, `${currentPath}[${i}]`, depth + 1);
      }
    } else if (typeof value === 'object' && value !== null) {
      validateObject(value, limits, currentPath, depth + 1);
    }
  }
}

export function validateInputSize(customLimits?: Partial<ValidationLimits>) {
  const limits = { ...DEFAULT_LIMITS, ...customLimits };

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check total request size via Content-Length header
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (limits.maxTotalSize && contentLength > limits.maxTotalSize) {
        return res.status(413).json({
          success: false,
          error: 'Request payload too large',
          maxSize: limits.maxTotalSize,
          received: contentLength,
        });
      }

      // Validate query parameters
      if (req.query) {
        validateObject(req.query, limits, 'query');
      }

      // Validate body parameters
      if (req.body) {
        validateObject(req.body, limits, 'body');
      }

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          field: error.field,
        });
      }
      next(error);
    }
  };
}
