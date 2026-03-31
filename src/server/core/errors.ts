/**
 * Base error class for all application errors.
 *
 * Carrying statusCode on the error means route handlers can respond correctly
 * without a separate switch/lookup — throw once, catch once.
 *
 * Extend this for every domain-specific error (e.g. TenantNotFoundError).
 */
export class AppError extends Error {
  public readonly statusCode: number;

  // Distinguishes expected failures (bad input, missing resource) from bugs.
  // Use this in a global error handler to decide whether to log a full stack trace.
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // TypeScript compiling to ES5 breaks instanceof for Error subclasses.
    // This restores the correct prototype chain so `err instanceof AppError` works.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}
