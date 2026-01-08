import { z } from 'zod';
import { router, protectedProcedure, IdSchema } from '@dxlander/shared';
import { SecretService } from '../services/secret.service';
import { db, schema } from '@dxlander/database';
import { randomUUID } from 'crypto';

const secretService = new SecretService();

// Validation schemas
const CreateSecretSchema = z.object({
  name: z.string().min(1, 'Secret name is required'),
  service: z.string().min(1, 'Service type is required'),
  fields: z
    .array(
      z.object({
        key: z.string().min(1, 'Field key is required'),
        value: z.string().min(1, 'Field value is required'),
      })
    )
    .min(1, 'At least one field is required'),
  autoInjected: z.boolean().optional().default(true),
  projectId: z.string().optional(),
});

const UpdateSecretSchema = z.object({
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

export const secretsRouter = router({
  /**
   * Get all saved secrets for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const secrets = await secretService.getSecretsByUserId(userId);
    return secrets;
  }),

  /**
   * Get a specific secret (metadata only, no credentials)
   */
  get: protectedProcedure.input(IdSchema).query(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const secret = await secretService.getSecretById(input.id, userId);
    if (!secret) {
      throw new Error('Secret not found');
    }

    return secret;
  }),

  /**
   * Get just the key names from a secret (for UI loading without exposing values)
   */
  getKeys: protectedProcedure.input(IdSchema).query(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const keys = await secretService.getSecretKeys(input.id, userId);
    if (!keys) {
      throw new Error('Secret not found or failed to decrypt');
    }

    return keys;
  }),

  /**
   * Get decrypted fields for a secret (for editing)
   */
  getFields: protectedProcedure.input(IdSchema).query(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const credentials = await secretService.getDecryptedCredentials(input.id, userId);
    if (!credentials) {
      throw new Error('Secret not found or failed to decrypt');
    }

    // Convert credentials object to fields array
    const fields = Object.entries(credentials).map(([key, value]) => ({
      key,
      value: String(value),
    }));

    return fields;
  }),

  /**
   * Create a new secret with dynamic fields
   */
  create: protectedProcedure.input(CreateSecretSchema).mutation(async ({ input, ctx }) => {
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

      // Map service type from dropdown to serviceType field
      const serviceType = input.service.toLowerCase();

      const secret = await secretService.createSecret({
        userId,
        name: input.name,
        service: input.service,
        serviceType,
        credentialType: 'key_value',
        credentials,
        autoInjected: input.autoInjected,
        projectId: input.projectId,
      });

      // Log audit event
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId,
        action: 'secret_created',
        resourceType: 'secret',
        resourceId: secret.id,
        metadata: JSON.stringify({ service: input.service, fieldCount: input.fields.length }),
        status: 'success',
        createdAt: new Date(),
      });

      return secret;
    } catch (error) {
      console.error('Failed to create secret:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create secret');
    }
  }),

  /**
   * Update an existing secret
   */
  update: protectedProcedure.input(UpdateSecretSchema).mutation(async ({ input, ctx }) => {
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

      const secret = await secretService.updateSecret(input.id, userId, {
        name: input.name,
        credentials,
        autoInjected: input.autoInjected,
      });

      // Log audit event
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId,
        action: 'secret_updated',
        resourceType: 'secret',
        resourceId: secret.id,
        metadata: JSON.stringify({
          service: secret.service,
          fieldsUpdated: input.fields ? input.fields.length : 0,
        }),
        status: 'success',
        createdAt: new Date(),
      });

      return secret;
    } catch (error) {
      console.error('Failed to update secret:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update secret');
    }
  }),

  /**
   * Delete a secret
   */
  delete: protectedProcedure.input(IdSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      // Get secret before deleting (for audit log)
      const secret = await secretService.getSecretById(input.id, userId);
      if (!secret) {
        throw new Error('Secret not found');
      }

      await secretService.deleteSecret(input.id, userId);

      // Log audit event
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId,
        action: 'secret_deleted',
        resourceType: 'secret',
        resourceId: input.id,
        metadata: JSON.stringify({ service: secret.service }),
        status: 'success',
        createdAt: new Date(),
      });

      return {
        success: true,
        deletedSecret: secret,
      };
    } catch (error) {
      console.error('Failed to delete secret:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete secret');
    }
  }),

  /**
   * Get secrets by service name
   */
  listByService: protectedProcedure
    .input(z.object({ service: z.string() }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const secrets = await secretService.getSecretsByService(userId, input.service);
      return secrets;
    }),
});
