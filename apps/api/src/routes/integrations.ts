import { z } from 'zod';
import { router, protectedProcedure, IdSchema } from '@dxlander/shared';
import { IntegrationService } from '../services/integration.service';
import { db, schema } from '@dxlander/database';
import { randomUUID } from 'crypto';

const integrationService = new IntegrationService();

// Validation schemas
const CreateIntegrationSchema = z.object({
  name: z.string().min(1, 'Integration name is required'),
  service: z.string().min(1, 'Service type is required'), // e.g., "SUPABASE", "STRIPE", "CUSTOM_API"
  fields: z
    .array(
      z.object({
        key: z.string().min(1, 'Field key is required'),
        value: z.string().min(1, 'Field value is required'),
      })
    )
    .min(1, 'At least one field is required'),
  autoInjected: z.boolean().optional().default(true),
  projectId: z.string().optional(), // Optional: if adding from project detection
});

const UpdateIntegrationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  fields: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.string().min(1),
      })
    )
    .optional(),
  autoInjected: z.boolean().optional(),
});

export const integrationsRouter = router({
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
   * Get decrypted fields for an integration
   */
  getFields: protectedProcedure.input(IdSchema).query(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const credentials = await integrationService.getDecryptedCredentials(input.id, userId);
    if (!credentials) {
      throw new Error('Integration not found or failed to decrypt');
    }

    // Convert credentials object to fields array
    const fields = Object.entries(credentials).map(([key, value]) => ({
      key,
      value: String(value),
    }));

    return fields;
  }),

  /**
   * Create a new integration with dynamic fields
   */
  create: protectedProcedure.input(CreateIntegrationSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      // Convert fields array to credentials object
      const credentials: Record<string, string> = {};
      for (const field of input.fields) {
        credentials[field.key] = field.value;
      }

      const integration = await integrationService.createIntegration({
        userId,
        name: input.name,
        service: input.service,
        serviceType: 'custom', // All are custom now
        credentialType: 'key_value', // All use key-value pairs
        credentials,
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
        metadata: JSON.stringify({ service: input.service, fieldCount: input.fields.length }),
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
      // Convert fields array to credentials object if provided
      let credentials: Record<string, string> | undefined;
      if (input.fields) {
        credentials = {};
        for (const field of input.fields) {
          credentials[field.key] = field.value;
        }
      }

      const integration = await integrationService.updateIntegration(input.id, userId, {
        name: input.name,
        credentials,
        autoInjected: input.autoInjected,
      });

      // Log audit event
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId,
        action: 'integration_updated',
        resourceType: 'integration',
        resourceId: integration.id,
        metadata: JSON.stringify({
          service: integration.service,
          fieldsUpdated: input.fields ? input.fields.length : 0,
        }),
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
   * Get integrations by service name
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
