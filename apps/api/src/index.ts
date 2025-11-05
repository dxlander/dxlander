import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './routes';
import { createContext } from './context';
import { initializeEncryptionService } from '@dxlander/shared';
import { db, isSetupComplete } from '@dxlander/database';
import { sql } from 'drizzle-orm';

// Import our custom middleware
import { setupMiddleware } from './middleware/setup';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';

// Import auth routes
import authRoutes from './routes/auth';
import uploadRoutes from './routes/upload';

// Initialize encryption service on startup
initializeEncryptionService();

const app = new Hono();

// Global error handler
app.onError(errorHandler);

// Core middleware (order matters!)
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  })
);

// Setup detection middleware
app.use('*', setupMiddleware);

// Authentication middleware (for non-setup routes)
app.use('/trpc/*', authMiddleware);
app.use('/upload/*', authMiddleware);

// Health check
app.get('/health', async (c) => {
  const startTime = Date.now();

  try {
    // Check database connectivity
    let dbOk = true;
    try {
      db.all(sql`SELECT 1`);
    } catch (error) {
      console.error('Database health check failed:', error);
      dbOk = false;
    }

    const setupComplete = dbOk ? await isSetupComplete() : false;

    // Collect system metrics
    const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
    const uptime = process.uptime();
    const responseTime = Date.now() - startTime;

    // Determine status code and overall status
    const statusCode = dbOk ? 200 : 503;
    const overallStatus = dbOk ? 'ok' : 'error';

    return c.json(
      {
        status: overallStatus,
        checks: {
          database: dbOk ? 'ok' : 'error',
          setupComplete,
        },
        system: {
          uptime: `${uptime.toFixed(0)}s`,
          memory: `${memoryUsage.toFixed(2)} MB`,
          responseTime: `${responseTime}ms`,
        },
        timestamp: new Date().toISOString(),
      },
      statusCode
    );
  } catch (error) {
    console.error('Health check failed:', error);
    const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
    const uptime = process.uptime();
    const responseTime = Date.now() - startTime;

    return c.json(
      {
        status: 'error',
        checks: {
          database: 'error',
          setupComplete: false,
        },
        system: {
          uptime: `${uptime.toFixed(0)}s`,
          memory: `${memoryUsage.toFixed(2)} MB`,
          responseTime: `${responseTime}ms`,
        },
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});

// Setup status check (for first-time setup wizard)
app.get('/setup/status', async (c) => {
  try {
    const { initializeDatabase, isSetupComplete } = await import('@dxlander/database');

    // Initialize database first
    await initializeDatabase();

    // Check if setup is complete
    const setupComplete = await isSetupComplete();

    return c.json({
      setupComplete,
      hasAdminUser: setupComplete,
      databaseConnected: true,
    });
  } catch (error) {
    console.error('Setup status check failed:', error);
    return c.json(
      {
        setupComplete: false,
        hasAdminUser: false,
        databaseConnected: false,
      },
      500
    );
  }
});

// Development helper: reset setup state
app.post('/setup/reset', async (c) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SETUP_RESET !== 'true') {
    return c.json({ success: false, message: 'Setup reset is disabled in production' }, 403);
  }

  try {
    const { resetSetupState } = await import('@dxlander/database');
    await resetSetupState();
    return c.json({ success: true, message: 'Setup has been reset' });
  } catch (error) {
    console.error('Setup reset failed:', error);
    return c.json({ success: false, message: 'Failed to reset setup state' }, 500);
  }
});

// Auth routes (login, logout, verify)
app.route('/auth', authRoutes);

// Upload routes (file upload)
app.route('/upload', uploadRoutes);

// tRPC route
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  })
);

// Default route
app.get('/', (c) => {
  return c.json({
    message: 'DXLander API Server',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      setup: '/setup/status',
      auth: {
        login: '/auth/login',
        logout: '/auth/logout',
        verify: '/auth/verify',
      },
      trpc: '/trpc',
    },
  });
});

import { serve } from '@hono/node-server';

const port = Number(process.env.PORT) || 3001;

console.log(`🚀 DXLander API Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`🚀 DXLander API Server running on port ${port}`);
