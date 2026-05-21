/** Base Shopio SDK error. Per `28-developer-platform.md §6.6`. */
export class ShopioError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ShopioError';
  }
}

export class RateLimitError extends ShopioError {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(message, 'RATE_LIMITED', 429);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends ShopioError {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[]>,
  ) {
    super(message, 'VALIDATION_FAILED', 422);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ShopioError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class AuthError extends ShopioError {
  constructor(message: string) {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'AuthError';
  }
}
