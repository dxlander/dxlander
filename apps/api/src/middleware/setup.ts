import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { initializeDatabase, isSetupComplete } from '@dxlander/database';

/**
 * Setup Detection Middleware
 * Checks if DXLander has been set up properly
 */

interface SetupStatus {
  setupComplete: boolean;
  hasAdminUser: boolean;
  databaseConnected: boolean;
}

// Routes that don't require setup completion
const SETUP_EXEMPT_ROUTES = [
  '/health',
  '/setup/status',
  '/setup/complete',
  '/setup/validate-step',
  '/setup/test-database',
  '/setup/test-ai',
  '/setup/reset',
  '/trpc/setup.', // All tRPC setup endpoints
  '/auth/', // All auth endpoints (login requires setup to be complete, but shouldn't block on setup middleware)
];

async function checkSetupStatus(): Promise<SetupStatus> {
  try {
    // Initialize database first
    await initializeDatabase();

    // Check if setup is complete
    const setupComplete = await isSetupComplete();

    return {
      setupComplete,
      hasAdminUser: setupComplete,
      databaseConnected: true,
    };
  } catch (error) {
    console.error('Setup status check failed:', error);
    return {
      setupComplete: false,
      hasAdminUser: false,
      databaseConnected: false,
    };
  }
}

function isSetupExemptRoute(path: string): boolean {
  return SETUP_EXEMPT_ROUTES.some((route) => path.includes(route));
}

export const setupMiddleware = async (c: Context, next: Next) => {
  const path = c.req.path;

  // Skip setup check for exempt routes
  if (isSetupExemptRoute(path)) {
    return next();
  }

  try {
    const setupStatus = await checkSetupStatus();

    // Add setup status to context for use in handlers
    c.set('setupStatus', setupStatus);

    // If setup is not complete and accessing non-exempt routes
    if (!setupStatus.setupComplete) {
      throw new HTTPException(503, {
        message: 'DXLander setup is incomplete. Please complete setup first.',
        cause: 'SETUP_INCOMPLETE',
      });
    }

    return next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Setup middleware error:', error);
    throw new HTTPException(500, {
      message: 'Setup status check failed',
      cause: 'SETUP_CHECK_ERROR',
    });
  }
};
