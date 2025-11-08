import { z } from 'zod';
import { router, publicProcedure, protectedProcedure, IdSchema } from '@dxlander/shared';
import { IntegrationService } from '../services/integration.service';
import { IntegrationTesterService } from '../services/integration-tester.service';
import { db, schema } from '@dxlander/database';
import { randomUUID } from 'crypto';

const integrationService = new IntegrationService();

// Define service types
const SERVICE_TYPES = [
  'database',
  'payment',
  'storage',
  'email',
  'auth',
  'analytics',
  'communication',
] as const;

// Define credential types
const CREDENTIAL_TYPES = [
  'api_key',
  'json_service_account',
  'oauth_token',
  'connection_string',
  'key_value',
] as const;

// Integration metadata for all supported services
const INTEGRATION_METADATA = [
  {
    service: 'supabase',
    name: 'Supabase',
    type: 'database',
    description: 'Open source Firebase alternative',
    icon: 'database',
    requiredCredentials: ['url', 'anonKey'],
    optionalCredentials: ['serviceRoleKey'],
    credentialType: 'key_value',
  },
  {
    service: 'stripe',
    name: 'Stripe',
    type: 'payment',
    description: 'Payment processing platform',
    icon: 'credit-card',
    requiredCredentials: ['secretKey'],
    optionalCredentials: ['publishableKey'],
    credentialType: 'key_value',
  },
  {
    service: 'firebase',
    name: 'Firebase',
    type: 'database',
    description: 'Google\'s mobile and web app development platform',
    icon: 'flame',
    requiredCredentials: ['projectId'],
    optionalCredentials: ['privateKey', 'clientEmail'],
    credentialType: 'json_service_account',
  },
  {
    service: 'mongodb-atlas',
    name: 'MongoDB Atlas',
    type: 'database',
    description: 'Cloud MongoDB database',
    icon: 'database',
    requiredCredentials: ['connectionString'],
    optionalCredentials: [],
    credentialType: 'connection_string',
  },
  {
    service: 'planetscale',
    name: 'PlanetScale',
    type: 'database',
    description: 'Serverless MySQL platform',
    icon: 'database',
    requiredCredentials: ['host', 'username', 'password'],
    optionalCredentials: [],
    credentialType: 'key_value',
  },
  {
    service: 'postgresql',
    name: 'PostgreSQL',
    type: 'database',
    description: 'Open source relational database',
    icon: 'database',
    requiredCredentials: [],
    optionalCredentials: ['host', 'port', 'database', 'username', 'password', 'connectionString'],
    credentialType: 'connection_string',
  },
  {
    service: 'auth0',
    name: 'Auth0',
    type: 'auth',
    description: 'Authentication and authorization platform',
    icon: 'shield',
    requiredCredentials: ['domain', 'clientId', 'clientSecret'],
    optionalCredentials: [],
    credentialType: 'key_value',
  },
  {
    service: 'clerk',
    name: 'Clerk',
    type: 'auth',
    description: 'User management and authentication',
    icon: 'shield',
    requiredCredentials: ['publishableKey', 'secretKey'],
    optionalCredentials: [],
    credentialType: 'api_key',
  },
  {
    service: 'aws-s3',
    name: 'AWS S3',
    type: 'storage',
    description: 'Amazon cloud storage',
    icon: 'cloud',
    requiredCredentials: ['accessKeyId', 'secretAccessKey'],
    optionalCredentials: ['region', 'bucket'],
    credentialType: 'key_value',
  },
  {
    service: 'sendgrid',
    name: 'SendGrid',
    type: 'email',
    description: 'Email delivery service',
    icon: 'mail',
    requiredCredentials: ['apiKey'],
    optionalCredentials: [],
    credentialType: 'api_key',
  },
  {
    service: 'twilio',
    name: 'Twilio',
    type: 'communication',
    description: 'SMS and communication platform',
    icon: 'message-square',
    requiredCredentials: ['accountSid', 'authToken'],
    optionalCredentials: [],
    credentialType: 'key_value',
  },
  {
    service: 'cloudinary',
    name: 'Cloudinary',
    type: 'storage',
    description: 'Image and video management',
    icon: 'image',
    requiredCredentials: ['cloudName', 'apiKey', 'apiSecret'],
    optionalCredentials: [],
    credentialType: 'key_value',
  },
  {
    service: 'nextauth',
    name: 'NextAuth.js',
    type: 'auth',
    description: 'Authentication for Next.js',
    icon: 'shield',
    requiredCredentials: ['secret'],
    optionalCredentials: [],
    credentialType: 'api_key',
  },
  {
    service: 'uploadthing',
    name: 'UploadThing',
    type: 'storage',
    description: 'File uploads for Next.js',
    icon: 'upload',
    requiredCredentials: ['secret', 'appId'],
    optionalCredentials: [],
    credentialType: 'api_key',
  },
  {
    service: 'openai',
    name: 'OpenAI',
    type: 'ai',
    description: 'AI and language models',
    icon: 'cpu',
    requiredCredentials: ['apiKey'],
    optionalCredentials: [],
    credentialType: 'api_key',
  },
  {
    service: 'google-analytics',
    name: 'Google Analytics',
    type: 'analytics',
    description: 'Web analytics service',
    icon: 'bar-chart',
    requiredCredentials: ['measurementId'],
    optionalCredentials: [],
    credentialType: 'api_key',
  },
  {
    service: 'mixpanel',
    name: 'Mixpanel',
    type: 'analytics',
    description: 'Product analytics platform',
    icon: 'bar-chart',
    requiredCredentials: ['token'],
    optionalCredentials: [],
    credentialType: 'api_key',
  },
  {
    service: 'posthog',
    name: 'PostHog',
    type: 'analytics',
    description: 'Open source product analytics',
    icon: 'bar-chart',
    requiredCredentials: ['apiKey', 'host'],
    optionalCredentials: [],
    credentialType: 'key_value',
  },
];

// Validation schemas
const CreateIntegrationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  service: z.string().min(1, 'Service is required'),
  serviceType: z.enum(SERVICE_TYPES),
  credentialType: z.enum(CREDENTIAL_TYPES),
  credentials: z.record(z.any()).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one credential is required',
  }),
  autoInjected: z.boolean().optional(),
  projectId: z.string().optional(),
});

const UpdateIntegrationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  credentials: z.record(z.any()).optional(),
  autoInjected: z.boolean().optional(),
});

const TestIntegrationSchema = z.object({
  id: z.string().min(1),
});

const TestConnectionSchema = z.object({
  service: z.string().min(1),
  credentials: z.record(z.any()),
});

export const integrationsRouter = router({
  /**
   * List all available integrations (metadata)
   */
  listAvailable: publicProcedure.query(async () => {
    return INTEGRATION_METADATA;
  }),

  /**
   * Get all saved integrations for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const integrations = await integrationService.getIntegrationsByUserId(userId);
    return integrations;
  }),

  /**
   * Get a specific integration
   */
  get: protectedProcedure.input(IdSchema).query(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const integration = await integrationService.getIntegrationById(input.id, userId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    return integration;
  }),

  /**
   * Create a new integration
   */
  create: protectedProcedure.input(CreateIntegrationSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      const integration = await integrationService.createIntegration({
        userId,
        name: input.name,
        service: input.service,
        serviceType: input.serviceType,
        credentialType: input.credentialType,
        credentials: input.credentials,
        autoInjected: input.autoInjected,
        projectId: input.projectId,
      });

      // Log audit event
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId,
        action: 'integration_created',
        resourceType: 'integration',
        resourceId: integration.id,
        metadata: JSON.stringify({ service: input.service }),
        status: 'success',
        createdAt: new Date(),
      });

      return {
        id: integration.id,
        message: 'Integration created successfully',
      };
    } catch (error) {
      console.error('Failed to create integration:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create integration');
    }
  }),

  /**
   * Update an existing integration
   */
  update: protectedProcedure.input(UpdateIntegrationSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      const integration = await integrationService.updateIntegration(input.id, userId, {
        name: input.name,
        credentials: input.credentials,
        autoInjected: input.autoInjected,
      });

      // Log audit event
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId,
        action: 'integration_updated',
        resourceType: 'integration',
        resourceId: integration.id,
        metadata: JSON.stringify({ service: integration.service }),
        status: 'success',
        createdAt: new Date(),
      });

      return {
        success: true,
        message: 'Integration updated successfully',
      };
    } catch (error) {
      console.error('Failed to update integration:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update integration');
    }
  }),

  /**
   * Delete an integration
   */
  delete: protectedProcedure.input(IdSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      // Get integration before deleting (for audit log)
      const integration = await integrationService.getIntegrationById(input.id, userId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      await integrationService.deleteIntegration(input.id, userId);

      // Log audit event
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId,
        action: 'integration_deleted',
        resourceType: 'integration',
        resourceId: input.id,
        metadata: JSON.stringify({ service: integration.service }),
        status: 'success',
        createdAt: new Date(),
      });

      return {
        success: true,
        message: 'Integration deleted successfully',
      };
    } catch (error) {
      console.error('Failed to delete integration:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete integration');
    }
  }),

  /**
   * Test an existing integration
   */
  test: protectedProcedure.input(TestIntegrationSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      // Get integration
      const integration = await integrationService.getIntegrationById(input.id, userId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      // Get decrypted credentials
      const credentials = await integrationService.getDecryptedCredentials(input.id, userId);
      if (!credentials) {
        throw new Error('Failed to decrypt credentials');
      }

      // Test connection
      const result = await IntegrationTesterService.testConnection({
        service: integration.service,
        credentials,
      });

      // Update test status
      await integrationService.updateTestStatus(
        input.id,
        result.success ? 'connected' : 'error',
        result.success ? undefined : result.message
      );

      // Log audit event
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId,
        action: 'integration_tested',
        resourceType: 'integration',
        resourceId: input.id,
        metadata: JSON.stringify({ service: integration.service, success: result.success }),
        status: result.success ? 'success' : 'failed',
        createdAt: new Date(),
      });

      return result;
    } catch (error) {
      console.error('Failed to test integration:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to test integration');
    }
  }),

  /**
   * Test connection before saving (pre-save validation)
   */
  testConnection: protectedProcedure.input(TestConnectionSchema).mutation(async ({ input }) => {
    try {
      const result = await IntegrationTesterService.testConnection({
        service: input.service,
        credentials: input.credentials,
      });

      return result;
    } catch (error) {
      console.error('Failed to test connection:', error);
      throw new Error(error instanceof Error ? error.message : 'Connection test failed');
    }
  }),

  /**
   * Get integrations by service type
   */
  listByServiceType: protectedProcedure
    .input(z.object({ serviceType: z.string() }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const integrations = await integrationService.getIntegrationsByServiceType(
        userId,
        input.serviceType
      );
      return integrations;
    }),

  /**
   * Get integrations by service
   */
  listByService: protectedProcedure
    .input(z.object({ service: z.string() }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const integrations = await integrationService.getIntegrationsByService(userId, input.service);
      return integrations;
    }),
});
