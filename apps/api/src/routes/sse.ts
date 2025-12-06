/**
 * Server-Sent Events (SSE) Routes
 *
 * These endpoints provide real-time streaming of progress updates.
 * SSE is the enterprise-standard for one-way server→client real-time communication.
 */

import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { SSEService } from '../services/sse.service';

const sseApp = new Hono();

/**
 * Custom auth middleware for SSE (supports token in query params)
 * EventSource doesn't support custom headers, so we accept token via query param
 */
const sseAuthMiddleware = async (c: any, next: any) => {
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

    // Verify JWT token directly
    const secret = process.env.JWT_SECRET || 'development-secret';

    try {
      const decoded = jwt.verify(token, secret) as any;

      // Set user context for downstream handlers
      c.set('user', {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      });

      console.log('[SSE Auth] Successfully authenticated user:', decoded.email);
      return next();
    } catch (error: any) {
      console.error('[SSE Auth] Token verification failed:', error.message);
      return c.json({ error: 'Invalid or expired token', details: error.message }, 401);
    }
  } catch (error: any) {
    console.error('[SSE Auth] Unexpected error:', error);
    return c.json({ error: 'Unauthorized', details: error.message }, 401);
  }
};

/**
 * Stream analysis progress in real-time
 * GET /sse/analysis/:analysisId?token=xxx
 */
sseApp.get('/analysis/:analysisId', sseAuthMiddleware, async (c) => {
  const analysisId = c.req.param('analysisId');

  if (!analysisId) {
    return c.json({ error: 'Analysis ID is required' }, 400);
  }

  return SSEService.streamAnalysisProgress(c, analysisId);
});

/**
 * Stream config generation progress in real-time
 * GET /sse/config/:configSetId?token=xxx
 */
sseApp.get('/config/:configSetId', sseAuthMiddleware, async (c) => {
  const configSetId = c.req.param('configSetId');

  if (!configSetId) {
    return c.json({ error: 'Config set ID is required' }, 400);
  }

  return SSEService.streamConfigProgress(c, configSetId);
});

export { sseApp };
