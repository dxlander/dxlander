/**
 * Server-Sent Events (SSE) Routes
 *
 * These endpoints provide real-time streaming of progress updates.
 * SSE is the enterprise-standard for one-way server→client real-time communication.
 */

import { Hono, Context, Next } from 'hono';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { SSEService } from '../services/sse.service';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface DecodedPayload extends JwtPayload {
  userId: string;
  email: string;
  role: string;
}

type SSEEnv = {
  Variables: {
    user: AuthUser;
  };
};

const sseApp = new Hono<SSEEnv>();

/**
 * Custom auth middleware for SSE (supports token in query params)
 * EventSource doesn't support custom headers, so we accept token via query param
 */
const sseAuthMiddleware = async (c: Context<SSEEnv>, next: Next) => {
  try {
    // Get token from query param (for EventSource compatibility)
    const tokenFromQuery = c.req.query('token');

    // Get token from header (fallback)
    const authHeader = c.req.header('Authorization');
    const tokenFromHeader = authHeader?.replace('Bearer ', '');

    const token = tokenFromQuery || tokenFromHeader;

    if (!token) {
      console.error('[SSE Auth] No token provided');
      return c.json({ error: 'Authentication required - no token' }, 401);
    }

    // Verify JWT token - use same pattern as auth.ts middleware
    const secret = process.env.JWT_SECRET || 'development-secret';

    try {
      const decoded = jwt.verify(token, secret) as DecodedPayload;

      // Set user context for downstream handlers
      c.set('user', {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      });

      console.log('[SSE Auth] Successfully authenticated user:', decoded.email);
      return next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SSE Auth] Token verification failed:', errorMessage);
      return c.json({ error: 'Invalid or expired token', details: errorMessage }, 401);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SSE Auth] Unexpected error:', error);
    return c.json({ error: 'Unauthorized', details: errorMessage }, 401);
  }
};

/**
 * Stream analysis progress in real-time
 * GET /sse/analysis/:analysisId?token=xxx
 */
sseApp.get('/analysis/:analysisId', sseAuthMiddleware, async (c) => {
  const analysisId = c.req.param('analysisId');
  const user = c.get('user');

  if (!analysisId) {
    return c.json({ error: 'Analysis ID is required' }, 400);
  }

  if (!user?.id) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  return SSEService.streamAnalysisProgress(c, analysisId, user.id);
});

/**
 * Stream config generation progress in real-time
 * GET /sse/config/:configSetId?token=xxx
 */
sseApp.get('/config/:configSetId', sseAuthMiddleware, async (c) => {
  const configSetId = c.req.param('configSetId');
  const user = c.get('user');

  if (!configSetId) {
    return c.json({ error: 'Config set ID is required' }, 400);
  }

  if (!user?.id) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  return SSEService.streamConfigProgress(c, configSetId, user.id);
});

/**
 * Stream deployment progress in real-time
 * GET /sse/deployment/:deploymentId?token=xxx
 *
 * Events emitted:
 * - connected: Initial connection established
 * - progress: Deployment status and activity updates
 * - done: Deployment reached terminal state (running/stopped/failed/terminated)
 * - error: Error occurred during streaming
 */
sseApp.get('/deployment/:deploymentId', sseAuthMiddleware, async (c) => {
  const deploymentId = c.req.param('deploymentId');
  const user = c.get('user');

  if (!deploymentId) {
    return c.json({ error: 'Deployment ID is required' }, 400);
  }

  if (!user?.id) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  return SSEService.streamDeploymentProgress(c, deploymentId, user.id);
});

export { sseApp };
