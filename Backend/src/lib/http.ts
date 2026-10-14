export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, message, details);
}

export function unauthorized(message = 'Authentication required'): ApiError {
  return new ApiError(401, message);
}

export function forbidden(message = 'You do not have access to this resource'): ApiError {
  return new ApiError(403, message);
}

export function notFound(message = 'Resource not found'): ApiError {
  return new ApiError(404, message);
}

export function serviceUnavailable(message: string): ApiError {
  return new ApiError(503, message);
}

type AsyncHandler = (req: any, res: any, next: any) => Promise<unknown>;

export function asyncHandler(handler: AsyncHandler) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
