import { z } from 'zod';
import {
  router,
  protectedProcedure,
  ServiceCategorySchema,
  ServiceSourceModeSchema,
  KnownProvisionableServiceSchema,
  SecretCredentialFieldSchema,
  getKnownProvisionableServices,
  getServiceCategories,
} from '@dxlander/shared';
import { ConfigServiceService } from '../services/config-service.service';

/**
 * Config Services Router
 *
 * Manages detected third-party services and their source configuration:
 * - provision: Create a container as part of deployment
 * - external: Use external credentials (manual entry OR reference to Secret Manager)
 * - none: Skip this service / remove from deployment
 */
export const configServicesRouter = router({
  /**
   * List all config services for a config set
   */
  list: protectedProcedure
    .input(
      z.object({
        configSetId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { configSetId } = input;

      return await ConfigServiceService.getConfigServices(userId, configSetId);
    }),

  /**
   * Get a single config service
   */
  get: protectedProcedure
    .input(
      z.object({
        serviceId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { serviceId } = input;

      return await ConfigServiceService.getConfigService(userId, serviceId);
    }),

  /**
   * Create config services from AI-detected services
   *
   * The AI provides composeServiceName which is the exact service name in docker-compose.yml
   * This is used during deployment to add/remove services based on user's mode selection
   */
  createFromDetected: protectedProcedure
    .input(
      z.object({
        configSetId: z.string().min(1),
        detected: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            detectedFrom: z.string().optional(),
            optional: z.boolean().optional(),
            requiredKeys: z.array(z.string()).optional(),
            notes: z.string().optional(),
            composeServiceName: z.string().nullish(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { configSetId, detected } = input;

      return await ConfigServiceService.createFromDetectedServices(userId, configSetId, detected);
    }),

  /**
   * Create a single config service (for manual addition)
   */
  create: protectedProcedure
    .input(
      z.object({
        configSetId: z.string().min(1),
        name: z.string().min(1),
        category: ServiceCategorySchema,
        detectedFrom: z.string().optional(),
        isRequired: z.boolean().optional(),
        isProvisionable: z.boolean().optional(),
        knownService: KnownProvisionableServiceSchema.optional(),
        requiredEnvVars: z
          .array(
            z.object({
              key: z.string(),
              description: z.string().optional(),
              example: z.string().optional(),
            })
          )
          .optional(),
        notes: z.string().optional(),
        sourceMode: ServiceSourceModeSchema.optional(),
        orderIndex: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;

      return await ConfigServiceService.createConfigService(userId, input);
    }),

  /**
   * Update a config service
   */
  update: protectedProcedure
    .input(
      z.object({
        serviceId: z.string().min(1),
        name: z.string().optional(),
        category: ServiceCategorySchema.optional(),
        isRequired: z.boolean().optional(),
        isProvisionable: z.boolean().optional(),
        knownService: KnownProvisionableServiceSchema.nullable().optional(),
        requiredEnvVars: z
          .array(
            z.object({
              key: z.string(),
              description: z.string().optional(),
              example: z.string().optional(),
            })
          )
          .optional(),
        notes: z.string().optional(),
        sourceMode: ServiceSourceModeSchema.optional(),
        provisionConfig: z
          .object({
            service: KnownProvisionableServiceSchema.optional(),
            image: z.string().optional(),
            tag: z.string().optional(),
            credentials: z
              .object({
                username: z.string(),
                password: z.string(),
                database: z.string().optional(),
                host: z.string().optional(),
                port: z.number().optional(),
              })
              .optional(),
            customEnv: z.record(z.string()).optional(),
            volumes: z.array(z.string()).optional(),
          })
          .nullable()
          .optional(),
        secretCredentials: z.record(SecretCredentialFieldSchema).optional(),
        orderIndex: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { serviceId, ...updates } = input;

      return await ConfigServiceService.updateConfigService(userId, serviceId, updates);
    }),

  /**
   * Delete a config service
   */
  delete: protectedProcedure
    .input(
      z.object({
        serviceId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { serviceId } = input;

      await ConfigServiceService.deleteConfigService(userId, serviceId);
      return { success: true };
    }),

  /**
   * Configure provision mode for a config service
   */
  configureProvision: protectedProcedure
    .input(
      z.object({
        serviceId: z.string().min(1),
        service: KnownProvisionableServiceSchema,
        image: z.string().optional(),
        tag: z.string().optional(),
        credentials: z
          .object({
            username: z.string().optional(),
            password: z.string().optional(),
            database: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { serviceId, service, ...options } = input;

      return await ConfigServiceService.configureProvision(userId, serviceId, service, options);
    }),

  /**
   * Configure external mode for a config service
   * Each field can be manual (encrypted value) or reference (points to Secret Manager)
   */
  configureExternal: protectedProcedure
    .input(
      z.object({
        serviceId: z.string().min(1),
        credentials: z.record(SecretCredentialFieldSchema),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { serviceId, credentials } = input;

      return await ConfigServiceService.configureExternal(userId, serviceId, credentials);
    }),

  /**
   * Get secret credentials for a config service (structure only, values masked)
   */
  getSecretCredentials: protectedProcedure
    .input(
      z.object({
        serviceId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { serviceId } = input;

      return await ConfigServiceService.getSecretCredentials(userId, serviceId);
    }),

  /**
   * Get resolved environment variables for all config services
   * (Keys only, values are not exposed in this endpoint for security)
   */
  getResolvedEnvVars: protectedProcedure
    .input(
      z.object({
        configSetId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { configSetId } = input;

      const envVars = await ConfigServiceService.getResolvedEnvVars(userId, configSetId);

      return {
        keys: Object.keys(envVars),
        count: Object.keys(envVars).length,
      };
    }),

  /**
   * Get available provisionable services for dropdown
   */
  getProvisionableServices: protectedProcedure.query(async () => {
    return getKnownProvisionableServices();
  }),

  /**
   * Get available categories for dropdown
   */
  getCategories: protectedProcedure.query(async () => {
    return getServiceCategories();
  }),
});
