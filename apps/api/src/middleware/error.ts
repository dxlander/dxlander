import { TRPCError } from '@trpc/server';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

/**
 * Global Error Handling Middleware
 * Standardizes error responses and logging
 */

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
  timestamp: string;
}

export const errorHandler = (err: Error, c: Context) => {
  console.error('API Error:', {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString(),
  });

  // Handle HTTP exceptions (thrown by our middleware/handlers)
  if (err instanceof HTTPException) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: err.message,
        code: err.cause as string,
        details: err.getResponse(),
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, err.status);
  }

  // Handle validation errors (Zod, tRPC, etc.)
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.errors,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, 400);
  }

  // Handle tRPC errors
  if (err instanceof TRPCError) {
    const trpcError = err;
    const statusMap: Record<string, number> = {
      BAD_REQUEST: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      METHOD_NOT_SUPPORTED: 405,
      TIMEOUT: 408,
      CONFLICT: 409,
      PRECONDITION_FAILED: 412,
      PAYLOAD_TOO_LARGE: 413,
      UNPROCESSABLE_CONTENT: 422,
      TOO_MANY_REQUESTS: 429,
      CLIENT_CLOSED_REQUEST: 499,
      INTERNAL_SERVER_ERROR: 500,
    };

    const status = statusMap[trpcError.code] || 500;

    const response: ErrorResponse = {
      success: false,
      error: {
        message: trpcError.message,
        code: trpcError.code,
        details: trpcError.cause,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, status as any);
  }

  // Handle database errors
  if (err.message.includes('SQLITE') || err.message.includes('database')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: 'Database operation failed',
        code: 'DATABASE_ERROR',
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response, 500);
  }

  // Default internal server error
  const response: ErrorResponse = {
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    timestamp: new Date().toISOString(),
  };

  return c.json(response, 500);
};
