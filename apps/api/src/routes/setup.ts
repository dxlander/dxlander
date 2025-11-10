import { z } from 'zod';
import {
  router,
  publicProcedure,
  SetupConfigSchema,
  SetupStepValidationSchema,
} from '@dxlander/shared';
import jwt from 'jsonwebtoken';
import { initializeDatabase, isSetupComplete, completeSetup } from '@dxlander/database';

export const setupRouter = router({
  // Check if setup is already complete
  getStatus: publicProcedure.query(async () => {
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
      console.error('Failed to check setup status:', error);
      return {
        setupComplete: false,
        hasAdminUser: false,
        databaseConnected: false,
      };
    }
  }),

  // Validate individual step data
  validateStep: publicProcedure
    .input(SetupStepValidationSchema.omit({ isValid: true, errors: true }))
    .mutation(async ({ input }) => {
      const { step, data } = input;
      const errors: Record<string, string> = {};

      try {
        switch (step) {
          case 'auth': {
            const authSchema = z
              .object({
                instanceName: z.string().min(1, 'Instance name is required'),
                adminEmail: z.string().email('Valid email is required'),
                adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
                confirmPassword: z.string(),
              })
              .refine((data) => data.adminPassword === data.confirmPassword, {
                message: "Passwords don't match",
                path: ['confirmPassword'],
              });

            const result = authSchema.safeParse(data);
            if (!result.success) {
              result.error.errors.forEach((err) => {
                if (err.path[0]) {
                  errors[err.path[0] as string] = err.message;
                }
              });
            }
            break;
          }

          case 'database': {
            const dbSchema = z
              .object({
                dbType: z.enum(['sqlite', 'postgresql', 'mysql']),
                dbPath: z.string().optional(),
                dbHost: z.string().optional(),
                dbPort: z.string().optional(),
                dbName: z.string().optional(),
                dbUser: z.string().optional(),
                dbPassword: z.string().optional(),
              })
              .refine(
                (data) => {
                  if (data.dbType === 'sqlite') {
                    return data.dbPath && data.dbPath.length > 0;
                  }
                  if (data.dbType === 'postgresql' || data.dbType === 'mysql') {
                    return data.dbHost && data.dbPort && data.dbName && data.dbUser;
                  }
                  return true;
                },
                {
                  message: 'Database configuration is incomplete',
                  path: ['dbHost'],
                }
              );

            const result = dbSchema.safeParse(data);
            if (!result.success) {
              result.error.errors.forEach((err) => {
                if (err.path[0]) {
                  errors[err.path[0] as string] = err.message;
                }
              });
            }
            break;
          }

          case 'ai': {
            const aiSchema = z
              .object({
                aiProvider: z.enum(['claude', 'openai', 'local']),
                aiApiKey: z.string().optional(),
                aiModel: z.string().optional(),
              })
              .refine(
                (data) => {
                  if (
                    (data.aiProvider === 'claude' || data.aiProvider === 'openai') &&
                    !data.aiApiKey
                  ) {
                    return false;
                  }
                  return true;
                },
                {
                  message: 'API key is required for this provider',
                  path: ['aiApiKey'],
                }
              );

            const result = aiSchema.safeParse(data);
            if (!result.success) {
              result.error.errors.forEach((err) => {
                if (err.path[0]) {
                  errors[err.path[0] as string] = err.message;
                }
              });
            }
            break;
          }

          case 'advanced': {
            const advancedSchema = z.object({
              serverPort: z.string().refine((port) => {
                const num = parseInt(port);
                return !isNaN(num) && num > 0 && num < 65536;
              }, 'Port must be between 1 and 65535'),
              customDomain: z.string().optional(),
              logLevel: z.enum(['error', 'warn', 'info', 'debug']),
            });

            const result = advancedSchema.safeParse(data);
            if (!result.success) {
              result.error.errors.forEach((err) => {
                if (err.path[0]) {
                  errors[err.path[0] as string] = err.message;
                }
              });
            }
            break;
          }
        }

        return {
          step,
          isValid: Object.keys(errors).length === 0,
          errors: Object.keys(errors).length > 0 ? errors : undefined,
        };
      } catch (error) {
        throw new Error(`Failed to validate ${step} step`);
      }
    }),

  // Test database connection
  testDatabase: publicProcedure
    .input(
      z.object({
        dbType: z.enum(['sqlite', 'postgresql', 'mysql']),
        dbPath: z.string().optional(),
        dbHost: z.string().optional(),
        dbPort: z.string().optional(),
        dbName: z.string().optional(),
        dbUser: z.string().optional(),
        dbPassword: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // TODO: Implement actual database connection testing
        // For now, simulate connection test
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (input.dbType === 'sqlite') {
          return { success: true, message: 'SQLite database file is accessible' };
        } else {
          return { success: true, message: `Successfully connected to ${input.dbType} database` };
        }
      } catch (error) {
        return { success: false, message: 'Failed to connect to database' };
      }
    }),

  // Test AI API connection
  testAI: publicProcedure
    .input(
      z.object({
        provider: z.enum(['claude', 'openai', 'local']),
        apiKey: z.string().optional(),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        if (input.provider === 'local') {
          return { success: true, message: 'Local AI setup detected' };
        }

        if (!input.apiKey) {
          return { success: false, message: 'API key is required' };
        }

        // TODO: Implement actual AI API testing
        // For now, simulate API test
        await new Promise((resolve) => setTimeout(resolve, 1500));

        return { success: true, message: `Successfully connected to ${input.provider} API` };
      } catch (error) {
        return { success: false, message: 'Failed to connect to AI service' };
      }
    }),

  // Complete setup and initialize instance
  completeSetup: publicProcedure.input(SetupConfigSchema).mutation(async ({ input }) => {
    try {
      // Check if setup is already complete
      const alreadyComplete = await isSetupComplete();
      if (alreadyComplete) {
        throw new Error('Setup has already been completed');
      }

      // Validate the complete configuration
      const validatedConfig = SetupConfigSchema.parse(input);

      // Validate SQLite path if provided to prevent path traversal attacks
      if (validatedConfig.sqlitePath) {
        const sqlitePath = validatedConfig.sqlitePath.trim();

        // Basic path validation (defense in depth)
        if (sqlitePath.includes('..') || sqlitePath.includes('~') || /[<>:"|?*]/.test(sqlitePath)) {
          throw new Error('Invalid database path: path traversal or special characters detected');
        }

        // TODO: When implementing custom SQLite paths, use path.resolve() to normalize
        // and validate the path is in an acceptable location
        // Currently, the database always uses ~/.dxlander/data/dxlander.db
        console.warn('Custom SQLite path provided but not yet implemented:', sqlitePath);
      }

      // TODO: Validate PostgreSQL configuration when implementing custom database support
      if (validatedConfig.postgresHost) {
        console.warn('PostgreSQL configuration provided but not yet implemented');
      }

      // Initialize database
      await initializeDatabase();

      // Complete setup with admin user
      const result = await completeSetup(validatedConfig.adminEmail, validatedConfig.adminPassword);

      // Encryption service is already initialized on server startup
      // Just get backup instructions
      const { getBackupInstructions } = await import('@dxlander/shared');

      // Log backup instructions
      console.log(`\n${'='.repeat(80)}`);
      console.log(getBackupInstructions());
      console.log(`${'='.repeat(80)}\n`);

      // Note: No default AI provider is created
      // Users must configure their own AI provider with API keys

      // Generate JWT token for admin user
      const token = jwt.sign(
        { userId: result.userId, email: result.email, role: 'admin' },
        process.env.JWT_SECRET || 'development-secret',
        { expiresIn: '7d' }
      );

      return {
        success: true,
        adminUserId: result.userId,
        token,
        setupComplete: true,
        message: 'Setup completed successfully!',
      };
    } catch (error) {
      console.error('Setup completion failed:', error);
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.errors.map((e) => e.message).join(', ')}`);
      }
      throw new Error(error instanceof Error ? error.message : 'Failed to complete setup');
    }
  }),
});
