export class AppError extends Error {
  public statusCode: number;
  public details?: any[];

  constructor(message: string, statusCode: number, details?: any[]) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any[]) {
    super(message, 400, details);
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Unauthorized', statusCode: number = 401) {
    super(message, statusCode);
  }
}
