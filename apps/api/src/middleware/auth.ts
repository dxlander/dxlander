import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt, { JwtPayload } from 'jsonwebtoken';

/**
 * Authentication Middleware
 * Validates JWT tokens and user sessions
 */

interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

interface DecodedPayload extends JwtPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

interface AuthContext {
  user: AuthUser;
  token: string;
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/health',
  '/setup/',
  '/trpc/setup.', // All tRPC setup endpoints
  '/auth/', // All auth endpoints (login, logout, verify)
];

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.includes(route));
}

function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  // Support both "Bearer token" and "token" formats
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1];
  }

  // Direct token without Bearer prefix
  return authHeader;
}

function verifyJWT(token: string): AuthUser {
  try {
    const secret = process.env.JWT_SECRET || 'development-secret';
    const decoded = jwt.verify(token, secret) as DecodedPayload;

    return {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
  } catch (_error) {
    throw new HTTPException(401, {
      message: 'Invalid or expired token',
      cause: 'INVALID_TOKEN',
    });
  }
}

export const authMiddleware = async (c: Context, next: Next) => {
  const path = c.req.path;

  // Skip auth for public routes
  if (isPublicRoute(path)) {
    return next();
  }

  try {
    // Extract token from Authorization header
    const authHeader = c.req.header('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      throw new HTTPException(401, {
        message: 'Authentication required',
        cause: 'NO_TOKEN',
      });
    }

    // Verify and decode token
    const user = verifyJWT(token);

    // Add auth context to request context
    const authContext: AuthContext = {
      user,
      token,
    };

    c.set('auth', authContext);
    c.set('user', user);

    return next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Auth middleware error:', error);
    throw new HTTPException(401, {
      message: 'Authentication failed',
      cause: 'AUTH_ERROR',
    });
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (requiredRole: string) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthUser;

    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required',
        cause: 'NO_USER',
      });
    }

    if (user.role !== requiredRole && user.role !== 'admin') {
      throw new HTTPException(403, {
        message: `Access denied. Required role: ${requiredRole}`,
        cause: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    return next();
  };
};

/**
 * Admin-only middleware
 */
export const requireAdmin = requireRole('admin');
